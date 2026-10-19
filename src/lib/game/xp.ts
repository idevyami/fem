// FEMBOY WAR V17 — سیمِ XP→سطح (مشترکِ همه‌ی منابعِ XP).
// باگِ تاریخی: work/buyVehicle/buyHouse/gamble در actions.ts XP اضافه می‌کردند ولی
// level را هرگز بازمحاسبه نمی‌کردند — بازیکنی که فقط «کار» می‌کرد (مسیرِ آموزش‌داده‌شده‌ی
// خودِ بازی برای پول) تا ابد سطح ۱ می‌ماند و از شیفتِ شب/استریمر/فرصت‌های L2/L3 و رویدادِ
// داستانیِ L3 قفل می‌شد. این ماژولِ واحد، هم سطح را بازمحاسبه می‌کند و هم پیامِ level-up
// اسمِ واقعیِ چیزی‌که باز شده را می‌گوید (نه شعرِ بی‌نام).
import type { Player } from "@prisma/client"
import type { Prisma } from "@prisma/client"
import { JOBS } from "./content/jobs"
import { EVENTS } from "./content/events"
import { levelFromXp } from "./helpers"

/** نامِ چیزهایی که با رسیدن به «level» باز می‌شوند — از خودِ محتوا، نه هاردکدِ گیج‌کننده. */
export function levelUnlocks(level: number): string[] {
  const out: string[] = []
  for (const j of JOBS) if (j.minLevel === level) out.push(`شغلِ «${j.name}»`)
  for (const e of EVENTS) if (e.conditions?.minLevel === level) out.push(`رویدادِ داستانیِ «${e.title}»`)
  // فرصت‌ها شرطِشان lambda است و بازخوانی مستقیم ندارند — همان دو قالبِ level-gated:
  if (level === 2) out.push("فرصتِ «جعبه‌ی بدون برچسب» آرش")
  if (level === 3) out.push("فرصتِ «بسته‌ی کیمو»")
  return out
}

/** متنِ اعلانِ level-up: همیشه صادق — اگر چیزی باز شده اسمش، اگر نه خودِ سطح. */
export function levelUpBody(level: number): string {
  const unlocks = levelUnlocks(level)
  if (unlocks.length === 0) return `دربِ تازه‌ای باز شد — شهر تو را جدی‌تر می‌گیرد. XP تا سطح ${level + 1} را از کار، فرصت‌ها و اتفاق‌ها بگیر.`
  return `باز شد: ${unlocks.join(" · ")}. XP بعدی را از کار، فرصت‌ها و اتفاق‌ها بگیر.`
}

export interface XpApplyResult {
  player: Player
  leveledTo: number | null // null = سطحِ تغییری نکرد
}

/**
 * XP اضافه کن، سطح را بازمحاسبه کن، در صورتِ ارتقا اعلانِ «با اسمِ بازشدنی‌ها» بساز.
 * همه‌ی مسیرهای XP بازی (رویدادها، فرصت‌ها، کار، خریدِ خانه/وسیله، قمار) باید از این
 * تابع واحد بگذرند تا قانونِ «XP همیشه سطح را دنبال می‌کند» در هر سه سطحِ بازی برقرار بماند.
 */
export async function applyPlayerXp(
  tx: Prisma.TransactionClient,
  player: Pick<Player, "id" | "xp" | "level">,
  gain: number,
): Promise<XpApplyResult> {
  const newXp = Math.max(0, Math.round(player.xp + gain))
  const newLevel = levelFromXp(newXp)
  const updated = await tx.player.update({
    where: { id: player.id },
    data: { xp: newXp, level: newLevel },
  })
  if (newLevel > player.level) {
    await tx.notification.create({
      data: {
        playerId: player.id,
        icon: "🎉",
        title: `سطح ${newLevel}`,
        body: levelUpBody(newLevel),
        kind: "reward",
      },
    })
    return { player: updated, leveledTo: newLevel }
  }
  return { player: updated, leveledTo: null }
}
