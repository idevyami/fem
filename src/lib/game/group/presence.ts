// FEMBOY WAR — V5: موتورِ حضور — ربات تصمیم می‌گیرد کِی حرف بزند و کِی سکوت کند.
// خط لوله: پیام ← فیلترِ ارزان ← دسته‌بندی قاعده‌محور ← آستانه‌ی اعتماد ← بودجه‌ی مداخله ← تصمیم.
// سکوت هم بخشی از هوشمندی است.

import { db } from "@/lib/db"
import type { GroupWorld, GroupMember, Player } from "@prisma/client"
import { mulberry32, seedFrom, chance, randInt } from "../rng"
import type { ObserveResponseDTO } from "./types"
import { esc, tehranHour, minutesAgo, bumpCulture, cultureOf, pushOutbox } from "./domain"
import { scanMemeSignals, noteMemeSignal, memeCallbackLine } from "./world"
import { noteInteraction } from "./social"
import { getGroupSettings, noiseMultiplier } from "./admin"
import { welcome } from "./onboarding"
import { SEP, chip, expand } from "./text"

// ─── صداهای شخصیت — لایه‌های مستقل اما هم‌خانواده ─────────────────────────────

const VOICES = {
  system: [
    "ثبت شد. شهر این را شنید و چیزی نگفت.",
    "سیستمِ شهری این گفتگو را آرشیو کرد. بایگانیِ جایی که هیچ‌کس نمی‌خواندش.",
  ],
  world: [
    "آسمونِ شهر امروز یه‌کم عجیب‌تر از دیروزه. همین.",
    "باد از سمتِ بازار می‌آید. یعنی احتمالاً یکی داری گریه می‌زنه. یا نه.",
  ],
  chaos: [
    "این‌جا هر لحظه ممکن است اتفاق بیفتد. مثلاً الان. یا الان. یا… نه. صبر کن.",
    `آمار می‌گوید احتمالِ فاجعه ${chip("3%")} است. این شهر با آمار خوب است.`,
  ],
  social: [
    "شماها واقعاً یکی از جذاب‌ترین جمع‌های این محله‌اید. رقابت ندارید. جدی.",
    "این گفتگو دارد خوب می‌شود. popcorn دارم. شعر نمی‌گویم.",
  ],
  gm: [
    "یادتان باشد: هر کاری می‌کنید، عاقبتش می‌ماند. با علاقه یا بدونش.",
    "شهر قواعد دارد. بیشترش نوشته نشده. همه‌شان عادل نیستند.",
  ],
} as const

const BOT_IDENTITY = [
  "من سیستمِ این شهرم. نصفه‌ام قاعده، نصفه‌ام کنجکاوی.",
  "یه وقتی‌ها فقط یه ربات بودم. حالا شهروندِ شما هستم. بدهی‌ام ندارید، حضورم را دارید.",
  "من همین‌جام. همیشه. حتی وقتی ساکت‌ام — مخصوصاً وقتی ساکت‌ام.",
]

const MONEY_LINES = [
  "💸 <b>نبضِ شهر</b>\n\nظاهراً اقتصادِ این‌جا دوباره دارد فرو می‌ریزد.\nسیستمِ اقتصادیِ گروه این اطلاعات را ثبت کرد.",
  "💰 حرفِ پول شد؟ صندوقِ شهر هم گوش می‌دهد. صندوق همیشه گرسنه است.",
]

const AMBITION_LINES = [
  "🗳 شهر صدایت را شنید. چیزی نگفت. ولی شنید.",
  "جاه‌طلبی شنیدنی است. ثبتش کردیم. برای… بعد.",
]

const PET_LINES = [
  "🐾 حیوان‌های این شهر همیشه یه‌کم بیشتر از صاحب‌هاشون می‌دانن.",
  "گربه‌ها/قورباغه‌ها/اردک‌ها از ما بزرگ‌ترند. به‌معنای معنوی کلمه.",
]

const AGGRESSION_LINES = [
  "🌡 دمای این گفتگو دارد بالا می‌رود. سیستمِ اجتماعی ثبتش کرد. دادگاه همیشه باز است.",
  "تنش حس می‌شود. این‌جا کسی به کسی چیزی نمی‌گفت که… به‌هرحال. ثبت شد.",
]

const FRIENDLY_LINES = [
  "🤝 این نوعِ گفتگو برای اقتصادِ محلی مفید است. علمی هم هست. تقریباً.",
]

// ─── دسته‌بندیِ قاعده‌محور (فیلترِ ارزان — قبل از هر هزینه) ─────────────────────

interface Classification {
  category: "bot_address" | "money" | "ambition" | "pet" | "aggression" | "friendly" | "game_word" | "smalltalk"
  confidence: number
}

const RULES: { re: RegExp; category: Classification["category"]; confidence: number }[] = [
  { re: /شهردار|انتخاب|رأی|رای|کاندید|منصب/, category: "ambition", confidence: 0.7 },
  { re: /پول|سکه|بدهکار|قرض|فقیر|پولدار|مالیات|شکسته/, category: "money", confidence: 0.75 },
  { re: /قورباغه|گربه|اردک|پت|بچه‌گربه/, category: "pet", confidence: 0.65 },
  { re: /دعوا|مفت|بیشعور|خوار|مسخره|احمق|کثیف|خایه|بی‌ادب/, category: "aggression", confidence: 0.6 },
  { re: /مرسی|ممنون|دوست|عشق|محبت|خوشحال|دلم|جونم/, category: "friendly", confidence: 0.6 },
  { re: /بازی|مسابقه|تورنومنت|نبرد|چالش|فمبوی/, category: "game_word", confidence: 0.6 },
]

export function classify(text: string, addressedToBot: boolean): Classification {
  if (addressedToBot) return { category: "bot_address", confidence: 0.95 }
  for (const r of RULES) {
    if (r.re.test(text)) return { category: r.category, confidence: r.confidence }
  }
  return { category: "smalltalk", confidence: 0.2 }
}

// ─── بودجه‌ی مداخله ─────────────────────────────────────────────────────────────

interface Budget {
  allowed: boolean
  reason: string
}

/** سقفِ روزانه‌ی پیام‌هایِ داوطلبانه — با ضریبِ نویزِ ادمین (Part 9):
 *  silent=0 · quiet=0.5 · normal=1. خاموش یعنی هیچ پیامِ داوطلبانه‌ای (خطابِ
 *  مستقیم به ربات همچنان جواب می‌گیرد — آن پاسخ است، نه مداخله). */
function dailyCap(group: GroupWorld): number {
  return Math.round(6 * noiseMultiplier(getGroupSettings(group)))
}

/** ضریبِ شانسِ واکنش/میم — همان نویز؛ کم‌صدا شهر کم‌تر حرف می‌زند */
function reactScale(group: GroupWorld): number {
  return noiseMultiplier(getGroupSettings(group))
}

async function checkBudget(group: GroupWorld, now: Date, priority: "high" | "normal"): Promise<Budget> {
  const c = cultureOf(group)
  const day = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(now)
  const unsolicitedToday = c.unsolicitedDay === day ? (c.unsolicitedToday ?? 0) : 0

  const hour = tehranHour(now)
  if (hour >= 1 && hour < 7 && priority !== "high") {
    return { allowed: false, reason: "quiet_hours" }
  }
  if (unsolicitedToday >= dailyCap(group)) {
    return { allowed: false, reason: "daily_cap" }
  }
  const sinceLast = minutesAgo(group.lastBotMsgAt, now)
  const floor = priority === "high" ? 8 : 20
  if (sinceLast < floor) {
    return { allowed: false, reason: "too_recent" }
  }
  return { allowed: true, reason: "ok" }
}

async function spendBudget(group: GroupWorld, now: Date): Promise<void> {
  const c = cultureOf(group)
  const day = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Tehran" }).format(now)
  const unsolicitedToday = c.unsolicitedDay === day ? (c.unsolicitedToday ?? 0) : 0
  await bumpCulture(db, group.id, { unsolicitedToday: unsolicitedToday + 1, unsolicitedDay: day })
  await db.groupWorld.update({ where: { id: group.id }, data: { lastBotMsgAt: now } })
}

async function logDecision(group: GroupWorld, trigger: string, confidence: number, decision: string, reason: string): Promise<void> {
  await db.botDecision.create({ data: { groupId: group.id, trigger, confidence, decision, reason } })
}

// ─── خط لوله‌ی مشاهده ──────────────────────────────────────────────────────────

export interface ObserveInput {
  group: GroupWorld
  member: GroupMember
  player: Player
  text: string
  addressedToBot: boolean
  replyToPlayerId: string | null
  now?: Date
}

export async function observe(input: ObserveInput): Promise<ObserveResponseDTO> {
  const now = input.now ?? new Date()
  const { group, member, player, text } = input
  const rng = mulberry32(seedFrom("obs", group.id, player.id, now.getTime()))

  // ۱) لمسِ عضو + شمارش
  await db.groupMember.update({
    where: { id: member.id },
    data: { lastSeenAt: now, messageCount: { increment: 1 } },
  })
  await bumpCulture(db, group.id, { socialMsgs: 1 })

  // ۲) بازگشته؟ — خلاصه‌ی «در نبودت» در outbox
  const gapHours = (now.getTime() - member.lastSeenAt.getTime()) / 3600000
  if (gapHours > 36 && member.lastSeenAt.getTime() > 0) {
    await queueReturningRecap(group, member, player, now)
  }

  // ۳) سیگنال‌های میمی — فقط واژه‌های فهرست‌شده
  const signals = scanMemeSignals(text)
  for (const s of signals) await noteMemeSignal(group, s, player.id)

  // ۴) رابطه‌ی دونفره از reply
  if (input.replyToPlayerId) {
    await noteInteraction(db, group.id, player.id, input.replyToPlayerId, true)
  }

  // ۵) دسته‌بندی
  const cls = classify(text, input.addressedToBot)

  // ۶) خطابِ مستقیم به ربات → همیشه جواب
  if (cls.category === "bot_address") {
    const identity = pick2(BOT_IDENTITY, rng)
    const short = text.length < 25
    const text2 = short
      ? `${identity}\n<i>(برای بازی‌های گروهی «بازی‌های گروه» — برای زندگی‌ات، پی‌وی)</i>`
      : identity
    await logDecision(group, `addressed:${cls.category}`, cls.confidence, "speak", "direct_address")
    return { action: "reply", text: text2 }
  }

  // ۷) بودجه‌ی مداخله برای هر چیزِ دیگری
  const priority = cls.confidence >= 0.7 ? "high" : "normal"
  const budget = await checkBudget(group, now, priority)
  if (!budget.allowed) {
    await logDecision(group, `cls:${cls.category}`, cls.confidence, "ignore", budget.reason)
    return { action: "none" }
  }

  // ۸) واکنشِ متناسب — با شانس و اعتماد (کم‌صدا: شانس هم ضریبِ نویز می‌خورد)
  if (chance(cls.confidence * 0.5 * reactScale(group), rng)) {
    let line: string | null = null
    switch (cls.category) {
      case "money": line = pick2(MONEY_LINES, rng); break
      case "ambition": line = pick2(AMBITION_LINES, rng); break
      case "pet": line = pick2(PET_LINES, rng); break
      case "aggression": line = pick2(AGGRESSION_LINES, rng); break
      case "friendly": line = pick2(FRIENDLY_LINES, rng); break
      case "game_word": {
        // «بازی» گفتند → بازی پیشنهاد بده (فقط اگه بازیِ بازی نباشد)
        return { action: "none" } // ساختِ بازی از طریق tick — این‌جا فقط علامت
      }
      default: line = null
    }
    if (line) {
      await spendBudget(group, now)
      await logDecision(group, `cls:${cls.category}`, cls.confidence, "react", "contextual_reaction")
      return { action: "react", text: line }
    }
  }

  // ۹) پیگیریِ میم — گاهی یادآوریِ شیرین (ضریبِ نویز این‌جا هم)
  if (chance(0.12 * reactScale(group), rng)) {
    const memeLine = await memeCallbackLine(group)
    if (memeLine) {
      await spendBudget(group, now)
      await logDecision(group, "meme_recall", 0.6, "follow_up", "running_gag")
      // متنِ میمِ ذخیره‌شده خام است (نامِ بازیکن esc نشده) — رندرِ کارت این‌جا esc می‌کند
      return { action: "react", text: `🔁 ${esc(memeLine)}` }
    }
  }

  await logDecision(group, `cls:${cls.category}`, cls.confidence, "ignore", "below_threshold")
  return { action: "none" }
}

// ─── خلاصه‌ی بازگشت ────────────────────────────────────────────────────────────

async function queueReturningRecap(group: GroupWorld, member: GroupMember, player: Player, now: Date): Promise<void> {
  const since = member.lastRecapSeenAt
  const events = await db.groupHistory.findMany({
    where: { groupId: group.id, createdAt: { gte: since } },
    orderBy: { importance: "desc" },
    take: 5,
  })
  // متنِ ذخیره‌شده‌ی history در نوشتن HTML-safe شده — این‌جا بدون esc رندر می‌شود
  const parts = events.map((e) => `${e.icon} ${e.text}`)
  const gapDays = Math.floor((now.getTime() - since.getTime()) / 86400000)
  const lines = parts.length > 0 ? parts : ["شهر همون‌طور که گذاشتیش گذاشتت. یعنی هیچ."]
  // سه رویدادِ اول پیدا؛ بقیه زیرِ نقل‌قولِ بازشدنی
  const visible = lines.slice(0, 3).map((l) => `• ${l}`)
  const hidden = lines.length > 3 ? `\n${expand(lines.slice(3).map((l) => `• ${l}`).join("\n"))}` : ""
  await pushOutbox(group, {
    kind: "recap",
    text: recapCardText(gapDays, visible.join("\n"), hidden),
    priority: 7,
  })
  await db.groupMember.update({ where: { id: member.id }, data: { lastRecapSeenAt: now } })
}

/** کارتِ بازگشت — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ ردیف‌های ذخیره‌شده HTML-safe رندرِ بدون esc */
export function recapCardText(gapDays: number, visibleBlock: string, hiddenBlock: string): string {
  return `👁 <b>برگشتی.</b>\n${SEP}\n\nدر نبودت (${chip(gapDays)} روز):\n${visibleBlock}${hiddenBlock}\n\n<i>شهر یادت را نگه داشت. مشروط.</i>`
}

// ─── شهروندِ تازه ──────────────────────────────────────────────────────────────

/** خوش‌آمدِ شهروندِ تازه — نمایندگی به onboarding.welcome (موجِ ۲؛ §3.2):
 *  کارتِ آگاه از کاراکتر + پلِ پی‌وی + ردیفِ cit:. dedup همانِ دیروز است —
 *  فقط از registerMemberِ عضوِ تازه صدا می‌شود. */
export async function welcomeNewCitizen(group: GroupWorld, player: Player): Promise<void> {
  await welcome(group, player)
}

/** انتخابِ آبروی شروع توسط خودِ شهروند */
export async function citizenVibe(group: GroupWorld, player: Player, vibe: string): Promise<string> {
  const map: Record<string, { title: string; note: string }> = {
    innocent: { title: "😇 تازه‌واردِ بی‌گناه", note: "بی‌گناهی در این شهر یه‌کم دوام نمی‌آورد. ولی خب." },
    suspicious: { title: "😈 تازه‌واردِ مشکوک", note: "مشکوک بودن انتخابِ منصفانه‌ای است. حداقل صادقانه." },
    chaotic: { title: "🤡 تازه‌واردِ آشوبگر", note: "آشوبگرها زود ترقی می‌گیرن. یا اخراج. یکی از این دو." },
    mysterious: { title: "🕵️ تازه‌واردِ مرموز", note: "مرموز بودن رایگان است. لو رفتنش نه." },
  }
  const v = map[vibe]
  if (!v) return "چنین آبرویی در لیست نیست."
  await db.groupMember.updateMany({ where: { groupId: group.id, playerId: player.id }, data: { title: v.title } })
  await pushOutbox(group, {
    kind: "system",
    text: vibeCardText(player.name, v.title, v.note),
    priority: 5,
  })
  return "آبرویت ثبت شد. خوش آمدی."
}

/** کارتِ خوش‌آمدِ شهروندِ قدیمی (پیش از موجِ ۲) — برای سازگاری نگه داشته
 *  می‌شود؛ مسیرِ زنده onboarding.ts است. */
export function welcomeCardText(playerName: string, groupTitle: string): string {
  return `🎀 <b>شهروندِ جدیدِ شناسایی شد</b>\n${SEP}\n\n<b>${esc(playerName)}</b> واردِ «${esc(groupTitle)}» شد.\n\nلطفاً رفتار عادی داشته باشید.\nشهر خواهش می‌کند حداقل ${chip(30)} ثانیه به ایشان چیزیِ غیرقانونی یاد ندهید.`
}

/** کارتِ انتخابِ آبرو — سازنده‌ی خالص (تست‌پذیر؛ V11) */
export function vibeCardText(playerName: string, title: string, note: string): string {
  return `👤 <b>${esc(playerName)}</b> آبروی شروعش را انتخاب کرد:\n<b>${title}</b>\n${SEP}\n\n<i>${note}</i>`
}

function pick2<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]!
}
