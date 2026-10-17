import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { resolveCaller, readBody, jsonOk, handleApiError } from "@/lib/game/api"
import { TITLE_MAP } from "@/lib/game/content"
import { getWorld, worldTick } from "@/lib/game/world"
import type { LeaderRowDTO, LeaderboardResponse } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    await resolveCaller(req, body) // فقط برای auth
    await worldTick()
    const world = await getWorld()

    // مرتب‌سازی در خودِ DB — قبلاً take:50 بدون orderBy بود و بازیکنِ ۵۱ام به بعد
    // هرگز دیده نمی‌شد؛ حالا ۵۰ نفرِ برتر از DB می‌آیند و همان فرمول نهایی را می‌گیرند
    const players = await db.player.findMany({
      where: { onboarded: true },
      select: {
        id: true,
        name: true,
        avatar: true,
        level: true,
        money: true,
        fame: true,
        chaos: true,
        debt: true,
        day: true,
        titles: { where: { active: true }, select: { titleKey: true } },
        pets: { select: { speciesKey: true } },
        achievements: { select: { achievementKey: true } },
      },
      orderBy: [{ level: "desc" }, { money: "desc" }, { fame: "desc" }],
      take: 50,
    })

    const rows: LeaderRowDTO[] = players
      .map((p) => {
        const titleDef = p.titles[0] ? TITLE_MAP[p.titles[0].titleKey] : null
        const highlight =
          p.pets.length >= 2
            ? `${p.pets.length} حیوان دارد`
            : p.debt > 5000
              ? "غرق در بدهی دایی فرهاد"
              : p.chaos > 45
                ? "آشوب با اسمش صدا می‌زند"
                : p.achievements.length >= 5
                  ? `${p.achievements.length} دستاورد`
                  : `روز ${p.day} در شهر`
        return {
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          level: p.level,
          money: p.money,
          fame: p.fame,
          chaos: p.chaos,
          title: titleDef ? `${titleDef.emoji} ${titleDef.name}` : null,
          highlight,
        }
      })
      .sort((a, b) => b.level * 1000 + b.money + b.fame * 50 - (a.level * 1000 + a.money + a.fame * 50))
      .slice(0, 20)

    const response: LeaderboardResponse = { rows, worldDay: world.dayCount }
    return jsonOk(response)
  } catch (e) {
    return handleApiError(e)
  }
}
