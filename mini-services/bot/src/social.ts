// FEMBOY WAR 🎀 — V23: لایه‌ی اجتماعیِ ربات — گفت‌وگوی واقعی در پی‌وی و گروه.
//
// ممیزیِ V23-A: پرکاربردترین جمله‌ی انسانی («سلام») به کارتِ «مطمئن نیستم
// بفهمم» می‌خورد؛ تشکر/خداحافظی/خنده/خستگی همه به همان کارت. این لایه هفت
// نیتِ اجتماعی را زنده می‌کند:
//   • خصوصی: جوابِ کوتاهِ گرم — با نامِ بازیکن و (اگر موتور جواب داد) وضعیتِ
//     واقعیِ فمبوی/انرژی/بدهی/هوا. قطعیِ seedشده: هر پیام انتخابِ پایدار خودش.
//   • گروه: فقط با آدرس‌دهی (منشن/ریپلای) — یک خطِ کوتاه بدونِ فراخوانیِ موتور
//     (ناظرِ حضور مالِ بقیه‌ی حرف‌هاست).
//   • موتور خواب/خطا → جوابِ نام‌محور می‌آید (این لایه هرگز به خاطرِ موتور
//     ساکت نمی‌شود — شخصیتِ ربات به موتور وابسته نیست).
//
// همه‌ی سازنده‌ها خالص‌اند (تستِ آفلاین در verify:bot §V23)؛ متن‌ها PLAIN
// می‌روند (بدونِ parse_mode) تا نامِ بازیکن هرگز به HTML نشکند.

import type { IntentId } from "./intent"
import type { GameSnapshot, GuideResponse } from "./api"

// ─── نیت‌های اجتماعی — فقط همین‌ها از این لایه جواب می‌گیرند ─────────────────

export type SocialIntentId =
  | "greet"
  | "howAreYou"
  | "thanks"
  | "bye"
  | "laugh"
  | "love"
  | "tired"

export const SOCIAL_INTENTS: ReadonlySet<IntentId> = new Set<IntentId>([
  "greet", "howAreYou", "thanks", "bye", "laugh", "love", "tired",
])

// ─── انتخابِ قطعیِ seedشده (بدونِ وابستگیِ بیرونی) ─────────────────────────────

/** هشِ FNV-1a — seedِ پایدار برای انتخابِ متن */
function hash32(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** انتخابِ قطعی از استخر — همان seed، همان انتخاب (تکرارپذیر برای تست) */
function pickSeeded<T>(pool: readonly T[], seed: string): T {
  return pool[hash32(seed) % pool.length]!
}

/** ساعتِ تهران — برای سلامِ زمان‌آگاه */
function tehranHour(now: Date): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" }).format(now))
  } catch {
    return 12
  }
}

// ─── وضعیتِ بازیکن از snapshot موتور (همه‌ی فیلدها اختیاری — موتور خواب هم ok) ──

export interface SocialState {
  playerName: string
  femboyName: string | null
  spiritPct: number | null
  conditionLabel: string | null
  energy: number | null
  debt: number | null
  weatherLabel: string | null
  guideHeadline: string | null
}

/** snapshot موتور → وضعیتِ اجتماعی (null-آمیز؛ غایب = آن خط حرف زده نمی‌شود) */
export function socialStateOf(snapshot: GameSnapshot | null, guide: GuideResponse | null, fallbackName: string): SocialState {
  const p = snapshot?.player
  const fb = snapshot?.femboy ?? null
  return {
    playerName: p?.name?.trim() || fallbackName,
    femboyName: fb?.name?.trim() || null,
    spiritPct: fb ? (fb.spiritPct ?? null) : null,
    conditionLabel: fb?.condition?.label ?? null,
    energy: p ? (p.energy ?? null) : null,
    debt: p ? (p.debt ?? null) : null,
    weatherLabel: snapshot?.world?.weatherLabel ?? null,
    guideHeadline: guide?.headline?.trim() || null,
  }
}

// ─── استخرهای متن (فارسیِ محاوره — صدای خودِ ربات) ────────────────────────────

const GREET_OPENERS: Record<"morning" | "day" | "evening" | "night", string[]> = {
  morning: [
    "صبح‌بخیر {name}! شهر با چای بیدار شده.",
    "صبحت بخیر {name}. امروز هم روزِ خوبی برای زنده‌ماندن است.",
  ],
  day: [
    "سلام {name}! برگشتی سرِ جات.",
    "سلام! شهر همین‌طور بی‌کار نشسته بود، {name}.",
  ],
  evening: [
    "سلام. شب‌های این شهر ساکت نیستند — تو هم نباش، {name}.",
    "سلام {name}! چراغ‌ها روشن‌اند؛ یعنی دیر نیست.",
  ],
  night: [
    "این‌ساعت بیداری؟ شهر بدخواب‌ها را می‌شناسد، {name}.",
    "سلامِ نیمه‌شب، {name}. خوش آمدی — بی‌خواب‌های این‌جا جمعِ خوبی‌اند.",
  ],
}

const HOW_ARE_YOU_OPENERS = [
  "من؟ همیشه بیدارم. این شغلم است.",
  "من یک شهرم؛ حالم از حرف‌های شما می‌شود.",
  "خوبم. به‌اندازه‌ی یک ساختمانِ قدیمی: ترک دارد اما پابرجاست.",
  "معلوم نیست. سنجشِ حالِ شهر کارِ اداره‌ی هواشناسی است و آن‌ها همیشه در تعطیل‌اند.",
]

const THANKS_LINES = [
  "خواهش می‌کنم. این کارِ شهر است.",
  "قربانت. محبت‌ات ثبت شد — بایگانی‌اش جایی است که هیچ‌کس نمی‌خواند.",
  "کارِ خودت بود. ما فقط تماشا کردیم.",
]

const BYE_LINES = [
  "خداحافظ {name}. شهر چراغ‌ها را خاموش نمی‌کند؛ فقط کم‌تر روشن می‌کند.",
  "فعلاً {name}. جایت خالی نیست؛ فقط کمی ساکت‌تر است.",
  "شب بخیر. رؤیای پول‌دار دیدن مجاز است.",
]

const LAUGH_LINES = [
  "خنده‌ات را شنیدم. شهر هم خندید — فقط بی‌صدا.",
  "اینجا خنده ممنوع نیست. فقط ثبت می‌شود.",
  "آفرین. خنده در این شهر ارز است؛ تو تورم زدی.",
]

const LOVE_LINES = [
  "قلبِ یک شهر را به دست آوردی. بروش نگه دار.",
  "دوستت دارم هم می‌شود گفت؟ می‌شود. ولی من شهرم؛ معامله‌ام داستان است.",
  "محبت ثبت شد. شهر ممنون.",
]

const LOVE_FEMBOY_LINES = [
  "ما یک شهریم؛ محبت‌مان عمومی است. ولی {femboy} این را جدی‌تر می‌گیرد.",
  "{femboy} باید این را می‌شنید. گفتم؛ ثبتش کرد. (روحیه‌اش بالا رفت.)",
]

const TIRED_OPENERS = [
  "خستگی‌ات را شنیدم. شهر هم وقتی خسته می‌شود، مه می‌اندازد.",
  "شنیدم. این‌جا خستگی جرم نیست — فقط ثبتی دارد.",
]

// ─── جوابِ خصوصی — سازنده‌ی خالص (تستِ آفلاین) ────────────────────────────────

export interface SocialReply {
  /** PLAIN — بدونِ HTML */
  text: string
  /** دکمه‌ی هم‌راه: none = گفت‌وگوی خالص */
  buttons: "none" | "guide"
}

/** خطِ وضعیت — حداکثر یکی؛ اولویت: فمبوی > انرژی > بدهی (هرگز اسپم نه) */
function stateLineOf(s: SocialState): string | null {
  if (s.femboyName && s.conditionLabel) {
    return `🎀 ${s.femboyName} الان ${s.conditionLabel} است${s.spiritPct !== null ? ` (روحیه ${s.spiritPct}٪)` : ""}.`
  }
  if (s.energy !== null && s.energy < 20) return "⚡ انرژی‌ات تهی است — «استراحت» را فراموش نکن."
  if (s.debt !== null && s.debt > 0) return "⛓ یادت باشد: بدهی هنوز زنده است."
  return null
}

/** جوابِ اجتماعیِ خصوصی — seed = (نیت، نام، لحظه‌ی پیام) → قطعی برای همان پیام */
export function privateSocialReply(id: SocialIntentId, s: SocialState, seed: string, now: Date): SocialReply {
  const name = s.playerName || "غریبه"
  const seedKey = `${id}:${seed}`
  switch (id) {
    case "greet": {
      const h = tehranHour(now)
      const bucket = h < 5 ? "night" : h < 11 ? "morning" : h < 17 ? "day" : h < 23 ? "evening" : "night"
      const opener = pickSeeded(GREET_OPENERS[bucket], seedKey).replaceAll("{name}", name)
      const tail = stateLineOf(s)
      return { text: tail ? `${opener}\n${tail}` : opener, buttons: "guide" }
    }
    case "howAreYou": {
      const opener = pickSeeded(HOW_ARE_YOU_OPENERS, seedKey)
      const lines = [opener]
      if (s.femboyName && s.conditionLabel) {
        lines.push(`🎀 ${s.femboyName} امروز ${s.conditionLabel} است${s.spiritPct !== null ? ` — روحیه ${s.spiritPct}٪` : ""}.`)
      }
      if (s.weatherLabel) lines.push(`آسمونِ شهر هم ${s.weatherLabel} است.`)
      return { text: lines.join("\n"), buttons: "none" }
    }
    case "thanks":
      return { text: pickSeeded(THANKS_LINES, seedKey).replaceAll("{name}", name), buttons: "none" }
    case "bye":
      return { text: pickSeeded(BYE_LINES, seedKey).replaceAll("{name}", name), buttons: "none" }
    case "laugh":
      return { text: pickSeeded(LAUGH_LINES, seedKey), buttons: "none" }
    case "love": {
      const pool = s.femboyName ? LOVE_FEMBOY_LINES : LOVE_LINES
      return { text: pickSeeded(pool, seedKey).replaceAll("{femboy}", s.femboyName ?? ""), buttons: "none" }
    }
    case "tired": {
      const opener = pickSeeded(TIRED_OPENERS, seedKey)
      const next = s.guideHeadline
        ? `قدمِ بعدی‌ات همین‌جاست: ${s.guideHeadline}`
        : "«قدمِ بعدی» را بگو تا بگوییم الان چه کنی."
      return { text: `${opener}\n${next}`, buttons: "guide" }
    }
  }
}

// ─── جوابِ گروهی (آدرس‌دهی‌شده) — کوتاه، بدونِ موتور، بدونِ دکمه ───────────────

const GROUP_LINES: Record<SocialIntentId, string[]> = {
  greet: [
    "سلام {name}! شهر ساکت نیست؛ فقط ادب دارد.",
    "سلام! جایت خالی بود، {name}.",
  ],
  howAreYou: [
    "زنده‌ام، ممنون. تو چطوری {name}؟",
    "مثلِ همیشه: بیدار و کنجکاو. تو چطوری {name}؟",
  ],
  thanks: [
    "خواهش می‌کنم {name}. ثبت شد.",
    "قربانت. شهر ممنون.",
  ],
  bye: [
    "برو برگردی، {name}.",
    "فعلاً {name}. جا می‌مانی.",
  ],
  laugh: [
    "شنیدیم. ثبت شد.",
    "این خنده بایگانی شد. عنوانش را هنوز نگذاشته‌ایم.",
  ],
  love: [
    "محبت ثبت شد. شهر ممنون.",
    "قلبِ این جمع بزرگ است؛ جایت داری.",
  ],
  tired: [
    "خسته‌ای؟ شهر هم. ولی زنده‌ایم.",
    "خستگی این‌جا ویزا ندارد؛ فقط ثبت می‌شود.",
  ],
}

/** جوابِ کوتاهِ گروهی — فقط وقتی ربات خطاب شده باشد (دکمه ندارد، کارت ندارد) */
export function groupSocialReply(id: SocialIntentId, fallbackName: string, seed: string): string {
  const name = fallbackName.trim() || "غریبه"
  return pickSeeded(GROUP_LINES[id], `${id}:${seed}`).replaceAll("{name}", name)
}

// ─── کارتِ fallback خصوصی — V23: تنوع + وضعیت + آهسته‌ترین اشاره ──────────────

export const FALLBACK_OPENERS = [
  "💬 این جمله را مطمئن نیستم بفهمم.",
  "💬 گوش دادم؛ ولی ترجمه‌ی شهر فقط تا این‌جا می‌رسد.",
  "💬 شنیدم و فکر کردم. جوابِ مشخصی ندارم.",
]

/** پاسخِ یک‌خطیِ ضدسیلِ گفت‌وگو (به‌جایِ سکوتِ محض) — سقفِ خودش را در هندلر دارد */
export const FALLBACK_NUDGES = [
  "👂 شنیدم! فعلاً فقط عبارت‌های راهنما را می‌فهمم — «راهنما» را بگو تا فهرست بیاید.",
  "👂 باز شنیدم. شهر زبانِ آزاد یاد نگرفته — «راهنما» نجاتت می‌دهد.",
]

/** متنِ کارتِ fallback — seed برای چرخشِ مقدمه؛ هسته‌ی راهنما پایدار می‌ماند */
export function fallbackCardText(openerSeed: string, guideHeadline: string | null): string {
  const opener = pickSeeded(FALLBACK_OPENERS, `fb:${openerSeed}`)
  const state = guideHeadline ? `\n📌 الان: ${guideHeadline}` : ""
  return `${opener}\n\nولی نگران نباش — دکمه‌ها همیشه کار می‌کنند؛ «🎯 قدمِ بعدی» می‌داند الان چه کنی.${state}\nعبارت‌های جادویی (فارسی/انگلیسی) هم در راهنما فهرست شده‌اند: «بازی‌ها» ← «زبانِ طبیعی».`
}

/** nudge یک‌خطی — seed برای چرخش */
export function fallbackNudgeText(seed: string): string {
  return pickSeeded(FALLBACK_NUDGES, `fn:${seed}`)
}

// ─── استیکرِ خصوصی (V23: رسانه هم جواب می‌گیرد — سابق: سیاه‌چاله) ─────────────

export const STICKER_LINES = [
  "استیکر دیدم. شهر چهره ندارد، ولی احساس را می‌فهمد.",
  "دیدمش. بایگانی شد.",
  "این هم زبانِ شهر است — گاهی بی‌کلمه.",
]

// فهرستِ ایموجی‌ها = واژگانِ مجازِ واکنشِ تلگرام (ReactionTypeEmoji) — «❤»
// بدونِ variation-selector تلگرام آن را می‌پذیرد؛ «❤️» با نشان‌گر نه.
export const STICKER_REACTIONS = ["❤", "👍", "🔥"] as const

/** واکنشِ قطعیِ استیکر — با خودِ پیام seed می‌شود (هر استیکر یک انتخابِ پایدار) */
export function stickerReaction(messageId: number): (typeof STICKER_REACTIONS)[number] {
  return STICKER_REACTIONS[messageId % STICKER_REACTIONS.length]!
}

/** خطِ استیکر — فقط اولینِ هر پنجره‌ی زمانی (نرخ در هندلر) */
export function stickerLine(userId: number, messageId: number): string {
  return pickSeeded(STICKER_LINES, `stk:${userId}:${messageId}`)
}
