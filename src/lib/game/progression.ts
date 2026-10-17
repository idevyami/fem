// FEMBOY WAR V4 — مقطع‌ها، توصیفِ وضعیت و جهتِ بازیکن.
// همه‌چیز از وضعیت زنده محاسبه می‌شود؛ هیچ چیز در DB ذخیرته نمی‌شود.
import type { Player, Pet } from "@prisma/client"
import type { StageDTO, StatusDescriptorsDTO, DirectionDTO } from "./contract"
import { clamp } from "./rng"

// ─── Totals (جمعِ زندگیِ بازیکن تا الان) ──────────────────────────────────────

export interface PlayerTotals {
  eventsResolved: number
  moneyEarned: number
  moneySpent: number
  petsAdopted: number
  rareFinds: number
  achievementCount: number
  titleCount: number
  distinctItems: number
  trustedNpcs: number // NPCهایی با اعتمادِ 40+
  avgTrust: number // میانگین اعتمادِ NPCهای آشنا
  districtsVisited: number
}

export const EMPTY_TOTALS: PlayerTotals = {
  eventsResolved: 0,
  moneyEarned: 0,
  moneySpent: 0,
  petsAdopted: 0,
  rareFinds: 0,
  achievementCount: 0,
  titleCount: 0,
  distinctItems: 0,
  trustedNpcs: 0,
  avgTrust: 0,
  districtsVisited: 0,
}

// ─── مقطع‌ها (7 پله از هیچ‌کس تا افسانه‌ای) ───────────────────────────────────

export interface StageDef {
  key: string
  name: string
  emoji: string
  description: string
  nextName: string | null
}

export const STAGES: StageDef[] = [
  {
    key: "nobody",
    name: "هیچ‌کس",
    emoji: "🫥",
    description: "شهر هنوز اسمت را یاد نگرفته. بعضی‌ها همین‌جا می‌مانند و اتفاقی نمی‌افتد.",
    nextName: "ساکنِ تازه",
  },
  {
    key: "resident",
    name: "ساکنِ تازه",
    emoji: "🚪",
    description: "داری واردِ شهر می‌شوی. کلیدهای هنوز قفل‌اند ولی صدایت را می‌شنوند.",
    nextName: "جاافتاده",
  },
  {
    key: "established",
    name: "جاافتاده",
    emoji: "🪴",
    description: "جایت را در این شهر گرفتی. آدم‌ها سرشان را تکان می‌دهند وقتی رد می‌شوی.",
    nextName: "شناخته‌شده",
  },
  {
    key: "known",
    name: "شناخته‌شده",
    emoji: "👀",
    description: "اسمت در حرف‌های کوچه می‌آید. نه همیشه خوش، ولی می‌آید.",
    nextName: "نفوذدار",
  },
  {
    key: "influential",
    name: "نفوذدار",
    emoji: "🎩",
    description: "حرف‌هایت وزنه دارد. بعضی‌ها قبل از حرف زدن، به تو نگاه می‌کنند.",
    nextName: "قدرتمند",
  },
  {
    key: "powerful",
    name: "قدرتمند",
    emoji: "👑",
    description: "شهر با تو حساب می‌کند. قدرتِ واقعی، ساکت است. تو ساکت نیستی — هنوز.",
    nextName: "افسانه‌ای",
  },
  {
    key: "legendary",
    name: "افسانه‌ای",
    emoji: "🌟",
    description: "دیگر آدم نیستی؛ قصه‌ای. سال‌های بعد، کسی شبیه تو را «دیدم» خواهد گفت.",
    nextName: null,
  },
]

// آستانه‌های هر مقطع — بالاترین مقطعی که همه‌ی شرط‌هایش برقرار باشد
const STAGE_REQS: { level?: number; money?: number; fame?: number }[] = [
  {}, // 0: هیچ‌کس
  { level: 2 }, // 1: ساکنِ تازه
  { level: 5, money: 10_000 }, // 2: جاافتاده
  { fame: 25 }, // 3: شناخته‌شده
  { fame: 50, money: 50_000 }, // 4: نفوذدار
  { level: 15, money: 100_000, fame: 75 }, // 5: قدرتمند
  { level: 20, money: 250_000, fame: 90 }, // 6: افسانه‌ای
]

function reqFractions(player: Player, req: { level?: number; money?: number; fame?: number }): number[] {
  const fr: number[] = []
  if (req.level !== undefined) fr.push(clamp(player.level / req.level, 0, 1))
  if (req.money !== undefined) fr.push(clamp(player.money / req.money, 0, 1))
  if (req.fame !== undefined) fr.push(clamp(player.fame / req.fame, 0, 1))
  return fr.length ? fr : [1]
}

/**
 * مقطعِ فعلی بازیکن — ترکیبی از سطح، پول، شهرت (و کمی «غنای زندگی» از totals).
 * progressPct = پیشرفت تا مقطعِ بعد (100 در افسانه‌ای).
 */
export function computeStage(player: Player, totals: PlayerTotals): StageDTO {
  let stageIdx = 0
  for (let i = STAGE_REQS.length - 1; i >= 0; i--) {
    const req = STAGE_REQS[i]
    if (req.level !== undefined && player.level < req.level) continue
    if (req.money !== undefined && player.money < req.money) continue
    if (req.fame !== undefined && player.fame < req.fame) continue
    stageIdx = i
    break
  }

  const def = STAGES[stageIdx]
  let progressPct: number
  if (stageIdx >= STAGES.length - 1) {
    progressPct = 100
  } else {
    // پیشرفتِ سخت: میانگینِ رضایتِ شرط‌های مقطعِ بعد
    const nextReq = STAGE_REQS[stageIdx + 1]
    const hard = reqFractions(player, nextReq).reduce((s, x) => s + x, 0) / reqFractions(player, nextReq).length
    // پیشرفتِ نرم: زندگیِ پُرتحرک کمی جلوترِ ذره‌بین است (سقفِ 55)
    const soft =
      clamp((totals.eventsResolved / 25 + totals.achievementCount / 8 + totals.titleCount / 4) / 3, 0, 1) * 55
    progressPct = Math.round(clamp(Math.max(hard * 100, soft), 0, 100))
  }

  return {
    key: def.key,
    name: def.name,
    emoji: def.emoji,
    description: def.description,
    nextName: def.nextName,
    progressPct,
  }
}

/** زیرنشانِ بازیکن برای snapshot — فقط کلید/اسم/ایموجی */
export function stageBadge(player: Player, totals: PlayerTotals): { key: string; name: string; emoji: string } {
  const s = computeStage(player, totals)
  return { key: s.key, name: s.name, emoji: s.emoji }
}

// ─── توصیفِ وضعیت (برچسب‌های فارسی) ───────────────────────────────────────────

export function statusDescriptors(player: Player): StatusDescriptorsDTO {
  const net = player.money - player.debt

  const wealthLabel =
    net < 0
      ? "تهی‌جیب"
      : net < 3_000
        ? "کندوکاو"
        : net < 15_000
          ? "روبه‌راه"
          : net < 60_000
            ? "پُرپا"
            : net < 200_000
              ? "مرفه"
              : "کلان‌دار"

  const fameLabel =
    player.fame < 10
      ? "بی‌نام"
      : player.fame < 30
        ? "آشنا"
        : player.fame < 50
          ? "شناخته‌شده"
          : player.fame < 70
            ? "معروف"
            : player.fame < 90
              ? "ستاره‌ی شهر"
              : "افسانه"

  const chaosLabel =
    player.chaos < 10
      ? "آرام"
      : player.chaos < 25
        ? "هنوز آرام"
        : player.chaos < 45
          ? "عجیب"
          : player.chaos < 65
            ? "بی‌قاعده"
            : player.chaos < 85
              ? "هرج‌ومرج"
              : "کاملاً دیوانه"

  const riskScore = player.crime * 0.6 + player.chaos * 0.4
  const riskLabel =
    riskScore < 10
      ? "بی‌خطر"
      : riskScore < 25
        ? "مراقب باش"
        : riskScore < 45
          ? "دیده می‌شی"
          : riskScore < 70
            ? "تحتِ نظری"
            : "مطرود"

  return { wealthLabel, fameLabel, chaosLabel, riskLabel }
}

// ─── جهتِ بازیکن (رفتارشناسی، نه خطِ داستان) ────────────────────────────────

export function detectDirection(
  player: Player,
  totals: PlayerTotals,
  pets: Pet[],
): DirectionDTO | null {
  const candidates: { score: number; dir: DirectionDTO }[] = [
    {
      score: totals.moneyEarned / 60_000,
      dir: {
        key: "wealth",
        name: "در حال ساختن ثروت",
        emoji: "💰",
        description: "حساب‌هایت دارد ضخیم می‌شود. پول در این شهر بی‌صدا می‌آید — و بی‌صدا می‌رود.",
      },
    },
    {
      score: Math.max(player.fame / 60, totals.eventsResolved / 30),
      dir: {
        key: "fame",
        name: "در جست‌وجوی نام",
        emoji: "⭐",
        description: "می‌خواهی اسمت را کسی فراموش نکند. شهر اسم‌ها را خوب نگه می‌دارد؛ بد هم برمی‌گرداند.",
      },
    },
    {
      score: (totals.rareFinds * 2 + pets.length) / 10,
      dir: {
        key: "collector",
        name: "کلکسیونر",
        emoji: "🎀",
        description: "چیزهای نایاب و موجوداتِ عجیب سمتت می‌آیند. شاید تصادفی نیست.",
      },
    },
    {
      score: (player.chaos + player.crime) / 90,
      dir: {
        key: "chaos",
        name: "عاملِ آشوب",
        emoji: "🔥",
        description: "کوچه‌ها وقتی تو توشان هستی، شکل دیگری به خودشان می‌گیرند. پلیس یادداشت می‌کند.",
      },
    },
    {
      score: totals.avgTrust / 50,
      dir: {
        key: "social",
        name: "مردِ مردم",
        emoji: "🤝",
        description: "آدم‌های این شهر به تو اعتماد می‌کنند. اعتماد، ارزان به‌دست نمی‌آید.",
      },
    },
  ]

  let best: { score: number; dir: DirectionDTO } | null = null
  for (const c of candidates) {
    if (c.score >= 0.35 && (!best || c.score > best.score)) best = c
  }
  return best?.dir ?? null
}
