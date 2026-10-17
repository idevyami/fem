import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { tickAndSnapshot } from "@/lib/game/engine"
import { resolveCaller, readBody, jsonOk, handleApiError } from "@/lib/game/api"
import { ensureOpportunities, listOpportunities } from "@/lib/game/opportunities"
import {
  computeStage,
  statusDescriptors,
  detectDirection,
  EMPTY_TOTALS,
  type PlayerTotals,
} from "@/lib/game/progression"
import { activeGoals } from "@/lib/game/goals"
import { nextActions } from "@/lib/game/recommender"
import { aspirationProgress } from "@/lib/game/content"
import { ITEM_MAP, DISTRICTS } from "@/lib/game/content"
import { parseFlags, faNum } from "@/lib/game/helpers"
import type { GuideResponse } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

// «راهنمای شهر» — تجربه‌ی V4: مقطع، وضعیت، جهت، هدف‌ها، فرصت‌ها، قدمِ بعدی، آرزوها.
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)

    // فرصت‌های تازه (پاکسازی + تولید تا ۲ فعال)
    await ensureOpportunities(player)

    // تیکِ کامل جهان/بازیکن + snapshot
    const { snapshot } = await tickAndSnapshot(player)
    const fresh = await db.player.findUniqueOrThrow({ where: { id: player.id } })
    const flags = parseFlags(fresh)

    // ── جمعِ زندگیِ بازیکن
    const [eventsResolved, earnedAgg, spentAgg, pets, rels, inventory, achCount, titleCount, memoriesCount, eventsTodayCount] =
      await Promise.all([
        db.activeEvent.count({ where: { playerId: fresh.id, status: "resolved" } }),
        db.currencyLedger.aggregate({ where: { playerId: fresh.id, amount: { gt: 0 } }, _sum: { amount: true } }),
        db.currencyLedger.aggregate({ where: { playerId: fresh.id, amount: { lt: 0 } }, _sum: { amount: true } }),
        db.pet.findMany({ where: { playerId: fresh.id } }),
        db.relationship.findMany({ where: { playerId: fresh.id } }),
        db.inventoryItem.findMany({ where: { playerId: fresh.id } }),
        db.playerAchievement.count({ where: { playerId: fresh.id } }),
        db.playerTitle.count({ where: { playerId: fresh.id } }),
        db.npcMemory.count({ where: { playerId: fresh.id } }),
        db.activeEvent.count({
          where: {
            playerId: fresh.id,
            status: "resolved",
            resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ])

    const rareFinds = inventory.filter((i) =>
      ["rare", "epic", "legendary"].includes(ITEM_MAP[i.itemKey]?.rarity ?? "common"),
    ).length
    const trustedNpcs = rels.filter((r) => r.trust >= 40).length
    const avgTrust = rels.length > 0 ? rels.reduce((s, r) => s + r.trust, 0) / rels.length : 0

    // محله‌های دیده‌شده: فلگ + تاریخچه‌ی سفر + محله‌ی فعلی
    const travelHistory = await db.historyEntry.findMany({
      where: { playerId: fresh.id, category: "world" },
      select: { text: true },
      take: 300,
    })
    const visited = new Set<string>([...(flags.visitedDistricts ?? []), fresh.currentDistrict])
    for (const h of travelHistory) {
      const match = DISTRICTS.find((d) => h.text.includes(d.name))
      if (match) visited.add(match.key)
    }

    const totals: PlayerTotals = {
      ...EMPTY_TOTALS,
      eventsResolved,
      moneyEarned: earnedAgg._sum.amount ?? 0,
      moneySpent: -1 * (spentAgg._sum.amount ?? 0),
      petsAdopted: pets.length,
      rareFinds,
      achievementCount: achCount,
      titleCount,
      distinctItems: inventory.length,
      trustedNpcs,
      avgTrust: Math.round(avgTrust * 10) / 10,
      districtsVisited: visited.size,
    }

    // ── تجربه‌ی V4
    const stage = computeStage(fresh, totals)
    const status = statusDescriptors(fresh)
    const direction = detectDirection(fresh, totals, pets)
    const goals = activeGoals(fresh, { pets, eventsToday: eventsTodayCount, npcMemories: memoriesCount }, totals)
    const opportunities = await listOpportunities(fresh)
    const actions = nextActions(fresh, snapshot, opportunities, goals)
    const aspirations = aspirationProgress(fresh, totals, pets, trustedNpcs)

    // ── سرخط
    let headline: string
    if (snapshot.activeEvent) {
      headline = `${snapshot.activeEvent.title} منتظر توست`
    } else {
      const unread = snapshot.notifications.find((n) => !n.read)
      headline = unread ? unread.title : "شهر آرام است. زیاد هم اعتماد نکن."
    }

    // ── الان چه خبر
    const w = snapshot.world
    let whatsHappening = `هوای شهر ${w.weatherLabel} است و حال‌وهوایش ${w.moodLabel}. آشوبش ${faNum(w.chaosLevel)} از ${faNum(100)}.`
    if (w.globalEvent) {
      whatsHappening += ` ${w.globalEvent.emoji} ${w.globalEvent.name}: ${w.globalEvent.description}`
    }

    const response: GuideResponse = {
      stage,
      status,
      direction,
      goals,
      opportunities,
      nextActions: actions,
      aspirations,
      headline,
      whatsHappening,
    }
    return jsonOk(response)
  } catch (e) {
    return handleApiError(e)
  }
}
