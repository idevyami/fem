// FEMBOY WAR V4 — هدف‌های فعال: از وضعیتِ زنده محاسبه می‌شوند، در DB چیزی ذخیره نمی‌شود.
import type { Player, Pet } from "@prisma/client"
import type { GoalDTO } from "./contract"
import type { PlayerTotals } from "./progression"
import { HOUSES } from "./content"
import { faNum, xpForLevel } from "./helpers"
import { clamp } from "./rng"

export interface GoalContext {
  pets: Pet[]
  eventsToday: number // رویدادهای تمام‌شده از ابتدای امروزِ واقعی
  npcMemories: number // تعداد خاطره‌های مشترک با NPCها
}

const MAX_GOALS = 4

function pct(v: number): number {
  return Math.round(clamp(v, 0, 1) * 100)
}

/**
 * هدف‌های فعال — حداکثر 4، همیشه حداقل یکی immediate.
 * اولویت: بدهی → حیوان گرسنه → خانه → پس‌انداز → شهرت → سطح → پرکننده‌ها.
 */
export function activeGoals(player: Player, ctx: GoalContext, totals: PlayerTotals): GoalDTO[] {
  const goals: GoalDTO[] = []

  // 1) بدهی — اگر نصفش را داری، وقتِ تمام‌کردنش است
  if (player.debt > 0 && player.money > player.debt * 0.5) {
    goals.push({
      id: "debt",
      title: "از زیرِ بارِ بدهی رد شو",
      icon: "⛓",
      category: "immediate",
      progressPct: pct(player.money / player.debt),
      progressLabel: `${faNum(Math.min(player.money, player.debt))}/${faNum(player.debt)} سکه`,
      hint: "بدهی‌ات را جمع کن تا سودش نگیردت.",
      rewardLabel: "آزادی از دایی فرهاد",
    })
  }

  // 2) حیوانِ گرسنه
  const starving = [...ctx.pets].sort((a, b) => a.hunger - b.hunger)[0]
  if (starving && starving.hunger < 30) {
    goals.push({
      id: "pet-care",
      title: `به ${starving.name} رسیدگی کن`,
      icon: "🐾",
      category: "immediate",
      progressPct: Math.round(clamp(starving.hunger, 0, 100)),
      progressLabel: `سیری ${faNum(starving.hunger)} از ${faNum(100)}`,
      hint: "گرسنه‌ست. حیوانی که رها شود، اسمت را فراموش می‌کند.",
      rewardLabel: null,
    })
  }

  // 3) سقفِ بالای سر
  if (!player.houseKey) {
    const cheapest = Math.min(...HOUSES.filter((h) => h.price > 0).map((h) => h.price))
    goals.push({
      id: "house",
      title: "سقفی بالای سرت پیدا کن",
      icon: "🏠",
      category: "short",
      progressPct: pct(player.money / cheapest),
      progressLabel: `${faNum(Math.min(player.money, cheapest))}/${faNum(cheapest)} سکه`,
      hint: "خانه اول از همه «جای مشخص» می‌دهد. شهر با آدمِ بی‌جای مشخص رحم نمی‌کند.",
      rewardLabel: "کلیدِ خودت",
    })
  }

  // 4) پس‌انداز
  if (player.money < 20_000) {
    const thing = !player.houseKey
      ? "خانه"
      : !player.vehicleKey
        ? "وسیله‌ی نقلیه"
        : "روزهای سختِ پیش‌رو"
    goals.push({
      id: "savings",
      title: `برای ${thing} پول جمع کن`,
      icon: "💰",
      category: player.money < 5_000 ? "short" : "medium",
      progressPct: pct(player.money / 20_000),
      progressLabel: `${faNum(Math.min(player.money, 20_000))}/${faNum(20_000)} سکه`,
      hint: "کم‌کم. سکه‌ها از راه می‌آیند اگر بخوانی‌شان را.",
      rewardLabel: null,
    })
  }

  // 5) شهرت
  if (player.fame < 25) {
    goals.push({
      id: "fame",
      title: "کسب‌وکارِ شهرت",
      icon: "⭐",
      category: "medium",
      progressPct: pct(totals.eventsResolved / 12),
      progressLabel: `${faNum(totals.eventsResolved)} اتفاق`,
      hint: "هر اتفاقی که تمام می‌کنی، اسمت یک بار جایی تکرار می‌شود.",
      rewardLabel: "شناخته‌شده",
    })
  }

  // 6) سطح
  if (player.level < 5) {
    let xpNeed = 0
    for (let l = 1; l <= 4; l++) xpNeed += xpForLevel(l)
    goals.push({
      id: "level",
      title: `به سطح ${faNum(5)} برس`,
      icon: "✨",
      category: "short",
      progressPct: pct(player.xp / xpNeed),
      progressLabel: `سطح ${faNum(player.level)} از ${faNum(5)}`,
      hint: "کار کن، اتفاق‌ها را تمام کن، بخواب. سطح، خودش می‌آید.",
      rewardLabel: "شهر جدی‌تر گرفتیت",
    })
  }

  // پرکننده‌ها — همیشه در دسترس
  const fillers: GoalDTO[] = [
    {
      id: "fresh-event",
      title: "یک اتفاق تازه را تجربه کن",
      icon: "🎲",
      category: "immediate",
      progressPct: pct(ctx.eventsToday / 1),
      progressLabel: `امروز ${faNum(ctx.eventsToday)} اتفاق`,
      hint: "به خیابان نگاه کن. شهر همیشه یک چیزی برای گفتن دارد.",
      rewardLabel: null,
    },
    {
      id: "meet-npc",
      title: "با یک غریبه حرف بزن",
      icon: "👤",
      category: "medium",
      progressPct: pct(ctx.npcMemories / 8),
      progressLabel: `${faNum(ctx.npcMemories)} خاطره‌ی مشترک`,
      hint: "آدم‌های این شهر حرف‌هایشان را نگه می‌دارند — برای کسی که برگردد.",
      rewardLabel: null,
    },
    {
      id: "rare-find",
      title: "یک چیزِ نایاب پیدا کن",
      icon: "💎",
      category: "long",
      progressPct: pct(totals.rareFinds / 10),
      progressLabel: `${faNum(totals.rareFinds)} یافته‌ی نایاب`,
      hint: "نایاب‌ها دنبالِ شانس می‌آیند، نه دنبالِ پول.",
      rewardLabel: null,
    },
    {
      id: "story-maker",
      title: "داستانِ خودت را بساز",
      icon: "📖",
      category: "long",
      progressPct: pct(totals.eventsResolved / 50),
      progressLabel: `${faNum(totals.eventsResolved)} اتفاق`,
      hint: "پنجاه اتفاق. بعدش هرچه بگویی درباره‌ی خودت، درست است.",
      rewardLabel: null,
    },
  ]

  // تکمیل تا 4 هدف
  for (const f of fillers) {
    if (goals.length >= MAX_GOALS) break
    if (goals.some((g) => g.id === f.id)) continue
    goals.push(f)
  }

  // همیشه حداقل یک هدفِ فوری
  if (!goals.some((g) => g.category === "immediate")) {
    goals.unshift(fillers[0])
    while (goals.length > MAX_GOALS) goals.pop()
  }

  return goals.slice(0, MAX_GOALS)
}
