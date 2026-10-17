// FEMBOY WAR V4 — آرزوها (aspirations): هدف‌های بلندِ بازیکن، محاسبه‌شده از زندگیِ واقعی‌اش.
// همه‌چیز computed است؛ هیچ رکوردی در DB نوشته نمی‌شود.
import type { Player, Pet } from "@prisma/client"
import type { PlayerTotals } from "../progression"
import type { AspirationDTO } from "../contract"
import { JOBS } from "./jobs"
import { faNum } from "../helpers"

export interface AspirationMilestone {
  label: string
  check: (totals: PlayerTotals, player: Player, trusted: number) => boolean
}

export interface AspirationDef {
  key: string
  name: string
  emoji: string
  description: string
  titleReward: string | null
  milestones: AspirationMilestone[]
}

function jobTier(player: Player): number {
  if (!player.jobKey) return 0
  return JOBS.findIndex((j) => j.key === player.jobKey) + 1
}

export const ASPIRATIONS: AspirationDef[] = [
  {
    key: "tycoon",
    name: "تاجرِ بزرگ",
    emoji: "💰",
    description: "می‌خواهی جیبت از شهر سنگین‌تر باشد. بقیه‌اش مالِ خودِ پول است.",
    titleReward: "برجسته‌ی بورس",
    milestones: [
      { label: `${faNum(10_000)} سکه دار باش`, check: (t) => t.moneyEarned >= 10_000 },
      { label: `${faNum(50_000)} سکه جمع کن`, check: (_t, p) => p.money >= 50_000 },
      { label: `${faNum(200_000)} سکه`, check: (_t, p) => p.money >= 200_000 },
      { label: `یک میلیون سکه`, check: (_t, p) => p.money >= 1_000_000 },
      { label: "یه وسیله‌ی نقلیه مالِ خودت باش", check: (_t, p) => !!p.vehicleKey },
    ],
  },
  {
    key: "celebrity",
    name: "ستاره‌ی شهر",
    emoji: "⭐",
    description: "اسمت باید از خودت بلندتر شود. این شهر ستاره‌ها را خوب می‌سازد و بد نگه می‌دارد.",
    titleReward: "چهره‌ی آشنا",
    milestones: [
      { label: `شهرت ${faNum(10)}`, check: (_t, p) => p.fame >= 10 },
      { label: `شهرت ${faNum(30)}`, check: (_t, p) => p.fame >= 30 },
      { label: `شهرت ${faNum(60)}`, check: (_t, p) => p.fame >= 60 },
      { label: `شهرت ${faNum(90)} — اسمِ تو در حرف‌های شب`, check: (_t, p) => p.fame >= 90 },
    ],
  },
  {
    key: "mayor",
    name: "شهردار",
    emoji: "🏛",
    description: "روزی که تصمیم‌های شهر با امضای تو باشند. قبل از آن، باید شهر تو را بخواهد.",
    titleReward: "نگهبانِ شهر",
    milestones: [
      { label: `شهرت ${faNum(50)} — مردم بفهمند کیستی`, check: (_t, p) => p.fame >= 50 },
      { label: `اعتبار ${faNum(60)} — دستِ پاکیزه`, check: (_t, p) => p.reputation >= 60 },
      { label: `${faNum(100_000)} سکه برای کمپین`, check: (_t, p) => p.money >= 100_000 },
      { label: `سطح ${faNum(12)} — جرئتِ امضا`, check: (_t, p) => p.level >= 12 },
    ],
  },
  {
    key: "collector",
    name: "کلکسیونر",
    emoji: "🎀",
    description: "چیزهای عجیب را جمع می‌کنی. یک روز کسی خواهد پرسید: «این‌ها از کجا آمده‌اند؟»",
    titleReward: "خزینه‌دار",
    milestones: [
      { label: `${faNum(5)} چیزِ متفاوت در کیف`, check: (t) => t.distinctItems >= 5 },
      { label: `${faNum(10)} چیزِ متفاوت`, check: (t) => t.distinctItems >= 10 },
      { label: `${faNum(2)} حیوان زیر سقفت`, check: (t) => t.petsAdopted >= 2 },
      { label: `${faNum(20)} چیزِ متفاوت`, check: (t) => t.distinctItems >= 20 },
      { label: `${faNum(35)} چیز — موزه‌ی شخصی`, check: (t) => t.distinctItems >= 35 },
    ],
  },
  {
    key: "detective",
    name: "کارآگاه",
    emoji: "🔍",
    description: "رازهای این شهر زیادند و صاحبانشان کم. تو صاحبِ هیچ‌کدام نیستی — فقط پیدا می‌کنی.",
    titleReward: "چشمِ تیز",
    milestones: [
      { label: "اولین یافته‌ی نایاب", check: (t) => t.rareFinds >= 1 },
      { label: `${faNum(3)} یافته‌ی نایاب`, check: (t) => t.rareFinds >= 3 },
      { label: `${faNum(6)} یافته‌ی نایاب`, check: (t) => t.rareFinds >= 6 },
      { label: `${faNum(10)} یافته — دفترچه‌ات پر شد`, check: (t) => t.rareFinds >= 10 },
    ],
  },
  {
    key: "entrepreneur",
    name: "کارفرما",
    emoji: "🏪",
    description: "به‌جای اینکه برای شهر کار کنی، شهر برای تو کار کند. اول سرمایه، بعد صندلیِ بزرگ.",
    titleReward: "کارفرمای نمونه",
    milestones: [
      { label: "شغلی جدی‌تر از اولِ راه (پله‌ی 3 به بالا)", check: (_t, p) => jobTier(p) >= 3 },
      { label: `${faNum(20_000)} سکه سرمایه`, check: (_t, p) => p.money >= 20_000 },
      { label: `${faNum(80_000)} سکه سرمایه`, check: (_t, p) => p.money >= 80_000 },
      { label: `${faNum(300_000)} سکه — صندلیِ بزرگ`, check: (_t, p) => p.money >= 300_000 },
    ],
  },
  {
    key: "chaos",
    name: "عاملِ آشوب",
    emoji: "🔥",
    description: "قاعده‌ها برای آدم‌های معمولی نوشته شده‌اند. تو معمولی نیستی — یا قاعده‌ها اشتباه‌اند.",
    titleReward: "عاملِ بی‌قاعده",
    milestones: [
      { label: `آشوبِ شخصی ${faNum(30)}`, check: (_t, p) => p.chaos >= 30 },
      { label: `آشوبِ شخصی ${faNum(50)}`, check: (_t, p) => p.chaos >= 50 },
      { label: `آشوبِ شخصی ${faNum(70)}`, check: (_t, p) => p.chaos >= 70 },
      { label: `آشوبِ شخصی ${faNum(90)} — شهر نامت را می‌داند`, check: (_t, p) => p.chaos >= 90 },
    ],
  },
  {
    key: "socialite",
    name: "مردِ مردم",
    emoji: "🤝",
    description: "این شهر با آدم‌ها ساخته شده، نه با آجر. تو آدم‌هایش را می‌شناخی — و آن‌ها تو را.",
    titleReward: "دلِ محله",
    milestones: [
      { label: `${faNum(2)} آشنا که بهت اعتماد کنند`, check: (_t, _p, trusted) => trusted >= 2 },
      { label: `${faNum(4)} اعتماد`, check: (_t, _p, trusted) => trusted >= 4 },
      { label: `${faNum(6)} اعتماد`, check: (_t, _p, trusted) => trusted >= 6 },
      { label: `${faNum(8)} اعتماد — کلِ شهر`, check: (_t, _p, trusted) => trusted >= 8 },
    ],
  },
  {
    key: "explorer",
    name: "کاوشگر",
    emoji: "🗺",
    description: "نقشه‌ی این شهر کامل نیست. کوچه‌هایی هست که روی هیچ نقشه‌ای نیستند. تو آن‌هایی.",
    titleReward: "نقشه‌خوان",
    milestones: [
      { label: `${faNum(3)} محله‌ی متفاوت را ببین`, check: (t) => t.districtsVisited >= 3 },
      { label: `${faNum(5)} محله`, check: (t) => t.districtsVisited >= 5 },
      { label: `${faNum(8)} محله — همه‌ی پلاک‌ها`, check: (t) => t.districtsVisited >= 8 },
    ],
  },
  {
    key: "legend",
    name: "افسانه‌ی شهر",
    emoji: "🌟",
    description: "بالاتر از اسم، بالاتر از پول. چیزی که بعد از رفتنت می‌ماند و قابلِ خرج‌کردن نیست.",
    titleReward: "افسانه‌ی زنده",
    milestones: [
      { label: `سطح ${faNum(20)}`, check: (_t, p) => p.level >= 20 },
      { label: `شهرت ${faNum(90)}`, check: (_t, p) => p.fame >= 90 },
      { label: `${faNum(250_000)} سکه — سنگینِ تاریخ`, check: (_t, p) => p.money >= 250_000 },
    ],
  },
]

/**
 * پیشرفتِ آرزوها — مرتب‌شده بر اساس progressPct (نزولی).
 * milestoneLabel = اولین سنگ‌میلمه‌ی نرسیده یا «کامل».
 */
export function aspirationProgress(
  player: Player,
  totals: PlayerTotals,
  pets: Pet[],
  relationshipCounts: number,
): AspirationDTO[] {
  const trusted = Math.max(relationshipCounts, 0)
  const t: PlayerTotals = { ...totals, petsAdopted: Math.max(totals.petsAdopted, pets.length) }

  return ASPIRATIONS.map((a) => {
    const done = a.milestones.filter((m) => m.check(t, player, trusted)).length
    const next = a.milestones.find((m) => !m.check(t, player, trusted))
    return {
      key: a.key,
      name: a.name,
      emoji: a.emoji,
      description: a.description,
      progressPct: Math.round((done / a.milestones.length) * 100),
      milestoneLabel: next ? next.label : "کامل",
      milestonesDone: done,
      milestonesTotal: a.milestones.length,
      titleReward: a.titleReward,
    }
  }).sort((x, y) => y.progressPct - x.progressPct || x.key.localeCompare(y.key))
}
