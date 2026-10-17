import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { buildSnapshot } from "@/lib/game/engine"
import { ITEM_MAP, PET_MAP, TITLE_MAP, ACHIEVEMENT_MAP, ACHIEVEMENTS } from "@/lib/game/content"
import { resolveCaller, readBody, jsonOk, handleApiError } from "@/lib/game/api"
import type { ProfileResponse } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const caller = await resolveCaller(req, body)
    // پروفایل: فقط خودِ فراخواننده — مگر فراخواننده‌ی سرویس (ربات) که برای
    // نمایش پروفایل اعضای گروه به playerId دیگر نیاز دارد.
    const isService = Boolean(req.headers.get("x-service-key"))
    const targetId =
      isService && typeof body.playerId === "string" ? (body.playerId as string) : caller.id
    const player = targetId === caller.id ? caller : await db.player.findUnique({ where: { id: targetId } })
    if (!player) return jsonOk(null)

    const snapshot = await buildSnapshot(player)
    const [ledger, history, pets, inventory] = await Promise.all([
      db.currencyLedger.findMany({ where: { playerId: player.id }, select: { amount: true, source: true } }),
      db.historyEntry.findMany({ where: { playerId: player.id }, orderBy: { createdAt: "desc" }, take: 30 }),
      db.pet.findMany({ where: { playerId: player.id } }),
      db.inventoryItem.findMany({ where: { playerId: player.id } }),
    ])

    const moneyEarned = ledger.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)
    const moneySpent = ledger.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0)
    const eventsResolved = await db.activeEvent.count({ where: { playerId: player.id, status: "resolved" } })
    const rareFinds = inventory.filter((i) =>
      ["rare", "epic", "legendary"].includes(ITEM_MAP[i.itemKey]?.rarity ?? "common"),
    ).length

    // داستان بازیکن — از داده‌ی واقعی
    const story: string[] = []
    const crimeEvents = history.filter((h) => h.category === "crime").length
    if (eventsResolved > 0) story.push(`${eventsResolved} اتفاق را با چشم خودت تمام کردی`)
    if (moneyEarned > 0) story.push(`${moneyEarned} سکه از این شهر گرفتی (و ${moneySpent} را پسش دادی)`)
    if (pets.length > 0) story.push(`${pets.length} حیوان زیر سقفت جمع کردی`)
    if (rareFinds > 0) story.push(`${rareFinds} چیزِ کمیاب در کیفت مانده`)
    if (player.crime > 20) story.push("پلیس پرونده‌ای برایت باز کرده. سرگرد نعمتی اسمت را کنار گوشه‌ی ذهنش نوشته")
    if (player.debt > 0) story.push(`به دایی فرهاد ${player.debt} سکه بدهکاری و هنوز لبخندش را می‌بینی`)
    if (player.fame > 30) story.push("وقتی از کوچه رد می‌شوی، کسی به کسی چیزی می‌گوید")
    if (player.day >= 7) story.push(`از روز اول، ${player.day} روز گذشته و هنوز اینجایی`)
    if (story.length === 0) story.push("این شهر هنوز درباره‌ات ساکت است. سکوت هم یه معناست.")

    const response: ProfileResponse = {
      player: snapshot.player,
      pets: snapshot.pets,
      inventory: snapshot.inventory,
      story,
      history: history.map((h) => ({
        id: h.id,
        icon: h.icon,
        text: h.text,
        category: h.category,
        day: h.day,
        at: h.createdAt.toISOString(),
      })),
      totals: { eventsResolved, moneyEarned, moneySpent, petsAdopted: pets.length, rareFinds },
      // V16-4 — افزایشی: N از M برای نوارِ دستاوردهای رباتِ خصوصی (مینی‌اپ رجیستری را باندل دارد)
      achievementsTotal: ACHIEVEMENTS.length,
    }
    return jsonOk(response)
  } catch (e) {
    return handleApiError(e)
  }
}
