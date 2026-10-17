// FEMBOY WAR 🎀 — ابزارهای مشترکِ نمایش (V11 — زبانِ بصریِ «شیشه»).
// نمایش + ناوبری، بدونِ وابستگی به هندلرها — تا لایه‌های تازه (مثل soul.ts)
// بدونِ importِ چرخه‌ای همان زبانِ مشترک را داشته باشند.

import type { Context } from "grammy"
import { InlineKeyboard } from "grammy"
import { GameApiError, GENERIC_STYLED } from "./api"
import { bumpError, log, stats } from "./stats"
import { errorKeyboard } from "./keyboards"
import { esc, toLatinDigits } from "./format"

/** پیامِ خطای عمومی — ⚠️ را فراخوان‌کننده می‌گذارد تا دوبار تکرار نشود؛
 *  مسیرِ توست (بدونِ HTML) خودش در answer() تگ‌ها را می‌شوید.
 *  واژگان از api.ts می‌آید (منبعِ یگانه — پیامِ GameApiError همان متن را خالی از تگ دارد). */
export const GENERIC = GENERIC_STYLED

/** صدایِ «شهر» برای خطاهای زیرساختی (موتور بی‌پاسخ/شبکه/تایم‌اوت) —
 *  واحد در همه‌ی لایه‌ها: پیوی (ui.fail) و گروه (group.ts). صدای خودِ موتور دست‌نخورده می‌ماند. */
export const CITY_UNREACHABLE = "شهر الان جواب نمی‌دهد — یک لحظه بعد دوباره امتحان کن."

/** برشِ امنِ متنِ HTML در سقفِ تلگرام — هیچ‌وقت وسطِ تگ نمی‌بُرد:
 *  آخرین سطرِ کاملِ زیرِ سقف + حذفِ خرده‌تگِ نیمه‌کاره‌ی انتها («<tag» باز‌نشده کشنده است؛
 *  تگِ باز‌مانده بسته نمی‌شود — تلگرام تحملش می‌کند، فقط برشِ وسطِ تگ ممنوع).
 *  برای show() (سقفِ پیام) و کپشن/کارت‌های گروه (همان قاعده) — export تا همه یک‌جور ببُرند. */
export function safeCut(text: string, max: number): string {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  let cut = chars.slice(0, Math.max(0, max - 1)).join("")
  const nl = cut.lastIndexOf("\n")
  if (nl > 0) cut = cut.slice(0, nl) // سطرِ نیمه‌کاره را کامل می‌اندازیم
  const lt = cut.lastIndexOf("<")
  if (lt !== -1 && !cut.slice(lt).includes(">")) cut = cut.slice(0, lt) // «<tag ناقص
  return `${cut}…`
}

/** شناسه‌ی تلگرامیِ کاربرِ فعلی */
export function tgId(ctx: Context): string {
  return String(ctx.from?.id ?? "")
}

export function isPrivate(ctx: Context): boolean {
  return ctx.chat?.type === "private"
}

export function isGroupChat(ctx: Context): boolean {
  const t = ctx.chat?.type
  return t === "group" || t === "supergroup"
}

export function botUsername(): string {
  return stats.username ?? "femwarbot"
}

export function errText(e: unknown): string {
  // صدای موتور: فرارِ HTML + نرمال‌سازی رقم‌ها به انگلیسی — همان قاعده‌ی esc()
  if (e instanceof GameApiError) return esc(e.message)
  bumpError(e instanceof Error ? e.message : String(e))
  log(`error: ${stats.lastError}`)
  return GENERIC
}

/** آیا خطا از نوع زیرساختی است (شبکه/پاسخِ خراب) یا صدای بازی؟ */
export function isInfraError(e: unknown): boolean {
  return e instanceof GameApiError && (e.code === "network" || e.code === "bad_response")
}

/** جوابِ callback — توست کوتاه (حداکثر ~۲۰۰ کاراکتر).
 *  توست HTML نمی‌فهمد: تگ‌ها را می‌شوید و رقم‌ها را انگلیسی می‌کند —
 *  یعنی هر متنی از هر لایه‌ای که به این‌جا برسد، تمیز و بدونِ تگِ خام دیده می‌شود. */
export function toastText(text: string): string {
  return toLatinDigits(text.replace(/<[^>]+>/g, ""))
}

export async function answer(ctx: Context, text?: string): Promise<void> {
  try {
    await ctx.answerCallbackQuery(text ? toastText(text).slice(0, 190) : "")
  } catch {
    /* کوئری دیر شد یا قبلاً جواب داده شده؛ بی‌صدا می‌گذریم */
  }
}

/** نمایش پیام با HTML — در callback ویرایش، در غیر آن پیام تازه (≤ ۴۰۹۶).
 *  تضمینِ پایانیِ V11: هر متنی از هر لایه‌ای، رقم‌هایش انگلیسی به تلگرام می‌رسد. */
export async function show(ctx: Context, text: string, kb?: InlineKeyboard): Promise<void> {
  const latin = toLatinDigits(text)
  const body = safeCut(latin, 4000)
  const opts: { parse_mode: "HTML"; reply_markup?: InlineKeyboard } = { parse_mode: "HTML" }
  if (kb) opts.reply_markup = kb
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(body, opts)
      return
    } catch {
      /* پیام عوض نشد (شاید عوض شده بود) — پیام تازه می‌فرستیم */
    }
  }
  await ctx.reply(body, opts)
}

// ─── V16-3 — بازکاربردِ لنگرِ نتیجه (مأموریت §13: ضدِ چین‌شدنِ کارت‌ها) ─────────

/** عمرِ لنگر — کارتِ نتیجه‌ی بعدی که با متن (نه دکمه) آمد، همین پیام را
 *  جایگزین می‌کند؛ قدیمی‌تر از این دیگر «تازه» نیست و پیامِ تازه می‌آید. */
const OUTCOME_REUSE_MS = 90_000

interface OutcomeAnchor {
  msgId: number
  at: number
}

const gAnchor = globalThis as typeof globalThis & {
  __femwarOutcomeAnchor?: Map<number, OutcomeAnchor>
}
/** آخرین کارتِ «نتیجه»ی هر چتِ خصوصی — درون‌حافظه‌ای، hot-reload-safe */
const outcomeAnchor: Map<number, OutcomeAnchor> = gAnchor.__femwarOutcomeAnchor ?? new Map()
gAnchor.__femwarOutcomeAnchor = outcomeAnchor

/** کارتِ نتیجه (کار/استراحت/بینگو/پرداخت…) — سه مسیر:
 *   • کال‌بک → همان show() (ویرایشِ درجای پیامِ دکمه‌زده‌شده)؛
 *   • متن در چتِ خصوصی + لنگرِ تازه (< 90s) → ویرایشِ همان پیامِ نتیجه‌ی قبلی
 *     (جلسه‌هایِ متنیِ پشت‌سرِهم دیگر کارت نمی‌چینند — ممیزی §4-⑷)؛
 *   • وگرنه پیامِ تازه + ثبتِ لنگر.
 *  عمداً فقط «نتیجه» — کارت‌هایِ منو دکمه‌هایِ زنده‌ی خانواده‌هایِ مختلف دارند و
 *  ویرایششان ریسکِ گم‌کردنِ پنل است (راهِ محافظه‌کارانه‌ی مأموریت). */
export async function showOutcome(ctx: Context, text: string, kb?: InlineKeyboard): Promise<void> {
  const chatId = ctx.chat?.id
  if (ctx.callbackQuery || chatId === undefined || ctx.chat?.type !== "private") {
    await show(ctx, text, kb)
    return
  }
  const latin = toLatinDigits(text)
  const body = safeCut(latin, 4000)
  const opts: { parse_mode: "HTML"; reply_markup?: InlineKeyboard } = { parse_mode: "HTML" }
  if (kb) opts.reply_markup = kb
  const anchor = outcomeAnchor.get(chatId)
  if (anchor && Date.now() - anchor.at < OUTCOME_REUSE_MS) {
    try {
      await ctx.api.editMessageText(chatId, anchor.msgId, body, opts)
      anchor.at = Date.now()
      return
    } catch {
      /* پیامِ لنگر رفت (حذف/کهنه) — پیامِ تازه می‌آید */
    }
  }
  const msg = await ctx.reply(body, opts)
  outcomeAnchor.set(chatId, { msgId: msg.message_id, at: Date.now() })
}

/** خطا: صدای بازیِ موتور عیناً؛ خطای زیرساختی با صدایِ شهر + دکمه‌ی «دوباره» */
export async function fail(ctx: Context, e: unknown): Promise<void> {
  const text = errText(e)
  if (ctx.callbackQuery) {
    // answer خودش تگ‌ها را می‌شوید — همه‌ی توست‌ها یک‌جور دیده می‌شوند
    await answer(ctx, isInfraError(e) ? undefined : text)
  }
  await show(ctx, isInfraError(e) ? `⚠️ ${CITY_UNREACHABLE}` : text, errorKeyboard())
}
