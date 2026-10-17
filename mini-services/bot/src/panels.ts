// FEMBOY WAR 🎀 — V15-3: معماریِ صریحِ پنل‌ها (مأموریت §3/§4).
//
// دو مدلِ بنیادیِ تعامل — این ماژول مرزِ مفهومیِ آن‌ها را «کد» می‌کند، نه فقط
// مستند؛ نقطه‌هایِ ورودِ واقعی همان‌هایی‌اند که پایین‌تر آدرس داده شده‌اند:
//
//   PrivatePanel — پنلِ مالک‌محور: منو/کارتِ تعاملیِ «یک بازیکن» (پیشخوان، کیف،
//     فمبوی، پیشرفت، خرید، سفر، راهنمایِ خصوصی…). هویتش (مأموریت §3A):
//     telegramIdِ مالک + chatIdِ خصوصی + messageId + نوعِ پنل + وضعیتِ ناوبری.
//     در این ربات پنلِ خصوصی «ساختماناً» جدا است: هر بازیکن پنلش را در چتِ ۱:۱
//     خودش می‌گیرد (show()/editMessageText فقط در همان چت) — هیچ messageIdِ
//     سراسریِ مشترکی مثلِ «main_menu» وجود ندارد. openPrivatePanel هویت را
//     می‌سازد/ثبت می‌کند؛ guardOwnerPanel دروازه‌ی مجوز است.
//
//   SharedGroupPanel — پنلِ اشتراکیِ شهر: «یک پیام در گروه، شرکت‌کننده‌هایِ
//     زیاد». وضعیتِ مرجع در موتور است (رأی/رویداد/بازی/دوئل/پروژه)؛ پنل فقط
//     نماست و با ویرایشِ درجا تازه می‌شود؛ چرخه‌ی حیات: created → open →
//     updated (ثبت‌ها) → locked → finalized. سمتِ موتور همین مدل را پیاده
//     می‌کند (src/lib/game/group/router.ts — قراردادِ کامل در سردرِ همان فایل)
//     و لایه‌ی group.ts ربات (handleGroupCallback + drainOutbox) ترنسپورتش است.
//
// ── نگاشتِ صادقانه‌ی چک‌لیستِ مأموریتِ §3A به این کدبیس ──────────────────────
//   • هویتِ پنل (شناسه‌ی تلگرام + چت + پیام + نوع + ناوبری + موجودیت + اعتبار):
//       همین‌جا — PrivatePanel + openPrivatePanel/panelOf؛ nav = همان
//       callback-data (گرامرِ hp:/fw:/m:)؛ اعتبار = TTLِ رجیستری.
//   • اعتبارسنجیِ «هر» کال‌بکِ مالک‌محور: guardOwnerPanel — هر ۱۰ نقطه‌ی ورودِ
//       پنلِ شخصی که در گروه بیفتد (hp: · m:/c:/t:/p:/a:/n: غیرِشهری ·
//       fw: شخصی · fwa:/fwi:/fwk:/fwt:/fwr:/fwsp:) «پیش از هر فراخوانیِ موتور»
//       رد می‌شود — بدونِ جهشِ حالت، بدونِ افشایِ مالک.
//   • پیامِ ردِ غیرمالک: توستِ «این پنل متعلق به بازیکن دیگری است.» + دکمه‌ی
//       «باز کردنِ پنلِ خودت» (لینکِ عمیقِ چتِ خصوصی) — هیچ اطلاعاتی از مالک
//       در کار نیست (نه نام، نه شناسه).
//   • ویرایشِ پیام‌ها: پنلِ شخصی هیچ‌وقت پیامِ گروه را ویرایش نمی‌کند — کارتِ
//       رد «پیامِ تازه» است، چون پیامِ مِهره‌خورده خودش می‌تواند پنلِ اشتراکیِ
//       شهر باشد (§3B: پنلِ اشتراکی برای بقیه باید زنده بماند).
//   • کال‌بکِ کهنه/حذف‌شده/دوباره‌رسیده: stale-cardهایِ مهربانِ hp: (help.ts) و
//       fw: (soul.ts) با دکمه‌ی بازیابی؛ show() با fallbackِ ارسالِ تازه؛
//       dedup آپدیت‌ها + ضدسیل (index.ts/limits.ts)؛ سمتِ موتور unique
//       constraint مشارکتِ رویداد و قفلِ بخشیِ رأی/پروژه/بازی (domain.ts).
//   • «بازگشاییِ منو نباید جلسه‌ی بازیکنِ دیگر را بشکند»: چت‌های ۱:۱ + ویرایشِ
//       درجای فقط-همان-پیام؛ جداسازی در تستِ A (scripts/verify §14) اثبات می‌شود.
//
// طراحیِ کوچک و محکم (مأموریت §4): بدونِ لایه‌ی انتزاعِ عظیم، بدونِ موتورِ
// موازی — فقط نوع‌ها، رجیستریِ سبکِ هویت، و یک دروازه‌ی مجوزِ قابلِ استفاده‌ی
// مجدد (helper) تا هیچ منویی مجوز را دوباره از صفر نسازد.

import { InlineKeyboard } from "grammy"
import type { Context } from "grammy"
import { privateLink } from "./keyboards"
import { answer, botUsername, isGroupChat, safeCut } from "./ui"
import { toLatinDigits } from "./format"
import { log } from "./stats"

// ─── PrivatePanel — هویتِ پنلِ مالک‌محور (مأموریت §3A) ─────────────────────────

/** هویتِ کاملِ یک پنلِ شخصی — تاپلِ مالکیت که §3A می‌خواهد */
export interface PrivatePanel {
  readonly scope: "private"
  /** شناسه‌ی تلگرامیِ مالک — کلیدِ رجیستری */
  readonly ownerTelegramId: string
  /** چتِ خصوصی (در ۱:۱ همان شناسه‌ی مالک) */
  readonly chatId: number
  /** پیامی که پنل رویش باز است (در callback ویرایشِ درجا روی همین می‌نشیند) */
  readonly messageId?: number
  /** نوعِ پنل: "hp" | "fw" | "m" | "c" | … (همان kind گرامرِ کال‌بک) */
  readonly type: string
  /** وضعیتِ ناوبریِ فعلی — همان callback-data */
  readonly nav?: string
  /** موجودیتِ بازیِ مرتبط، اگر باشد (شناسه‌ی آیتم/حریف/…) */
  readonly entity?: string
  readonly openedAt: number
}

const PANEL_TTL_MS = 30 * 60_000
const PANEL_MAX = 300

const gPanels = globalThis as typeof globalThis & {
  __femwarPrivatePanels?: Map<string, PrivatePanel>
}
const panels: Map<string, PrivatePanel> = gPanels.__femwarPrivatePanels ?? new Map()
gPanels.__femwarPrivatePanels = panels // hot-reload: نسلِ تازه، همان رجیستری

/** بازکردن/ثبتِ پنلِ شخصی — فقط در چتِ خصوصی معنا دارد؛ در گروه null
 *  (پنلِ شخصی در گروه «باز» نمی‌شود — مالک با تعریف کسی است که در پیوی است).
 *  هر کال‌بکِ خصوصیِ ربات از همین‌جا هویتِ پنلش را مُهر می‌کند (handlers/soul). */
export function openPrivatePanel(
  ctx: Context,
  opts: { type: string; nav?: string; entity?: string },
): PrivatePanel | null {
  const chat = ctx.chat
  const from = ctx.from
  if (!chat || chat.type !== "private" || !from) return null
  const panel: PrivatePanel = {
    scope: "private",
    ownerTelegramId: String(from.id),
    chatId: chat.id,
    messageId: ctx.callbackQuery?.message?.message_id,
    type: opts.type,
    ...(opts.nav !== undefined ? { nav: opts.nav } : {}),
    ...(opts.entity !== undefined ? { entity: opts.entity } : {}),
    openedAt: Date.now(),
  }
  panels.set(panel.ownerTelegramId, panel)
  if (panels.size > PANEL_MAX) {
    // قدیمی‌ترین را بینداز — این رجیستری «پنلِ فعالِ» هر مالک است، نه آرشیو
    let oldestKey: string | null = null
    let oldestAt = Infinity
    for (const [k, p] of panels) {
      if (p.openedAt < oldestAt) {
        oldestAt = p.openedAt
        oldestKey = k
      }
    }
    if (oldestKey) panels.delete(oldestKey)
  }
  return panel
}

/** پنلِ فعالِ یک مالک (برای مشاهده‌پذیری/تستِ جداسازی) — کهنه = null */
export function panelOf(ownerTelegramId: string): PrivatePanel | null {
  const p = panels.get(ownerTelegramId)
  if (!p) return null
  if (Date.now() - p.openedAt > PANEL_TTL_MS) {
    panels.delete(ownerTelegramId)
    return null
  }
  return p
}

// ─── SharedGroupPanel — قراردادِ سمتِ ربات (مأموریت §3B/§4) ────────────────────
// وضعیتِ مرجع در موتور است؛ این نوع‌ها «چیزی که ربات رندر/ترنسپورت می‌کند» را
// اسم‌گذاری می‌کنند تا مرزِ دو مدل در کد صریح باشد. مرجعِ کاملِ چرخه‌ی حیات:
// سردرِ src/lib/game/group/router.ts (کدام دامنه کدام مرحله را می‌سازد).

/** مرحله‌ی چرخه‌ی حیاتِ پنلِ اشتراکی — آینه‌ی وضعیتِ مرجعِ موتور */
export type SharedPanelLifecycle = "created" | "open" | "updated" | "locked" | "finalized"

/** دامنه‌هایی که پنلِ اشتراکی می‌سازند (refTypeِ همان outbox موتور) */
export type SharedPanelDomain = "vote" | "event" | "game" | "challenge" | "system"

/** قراردادِ پنلِ اشتراکی — یک پیام، شرکت‌کننده‌هایِ زیاد، موتورِ مرجع */
export interface SharedGroupPanel {
  readonly scope: "group"
  /** chatId گروه (صورتِ رشته‌ای — همان سیمِ موتور) */
  readonly chatId: string
  readonly domain: SharedPanelDomain
  /** شناسه‌ی ردیفِ مرجع (voteId/eventId/sessionId/challengeId/projectId) */
  readonly refId: string
  /** messageId کارتِ مشترک در گروه — ویرایشِ درجا روی همین می‌نشیند */
  messageId?: number
  state: SharedPanelLifecycle
  /** شرکت‌کننده‌ها با telegramIdِ «فشاردهنده» در موتور ثبت می‌شوند — نه این‌جا */
  readonly participantsAreEngineSide: true
}

// ─── دروازه‌ی مجوزِ پنلِ شخصی (مأموریت §3A — authorization) ────────────────────

/** پیامِ ردِ مأموریت — دقیقاً همان متنِ §3A */
export const NOT_YOUR_PANEL = "این پنل متعلق به بازیکن دیگری است."

/** دکمه‌ی نسخه‌ی خودت — لینکِ عمیقِ چتِ خصوصی (بدونِ داده‌ی مالک) */
export const OWN_PANEL_BUTTON = "باز کردنِ پنلِ خودت"

export interface PanelGuardOpts {
  /** نوعِ پنلِ شخصیِ زده‌شده — فقط برای لاگ؛ هیچ داده‌ی مالکی لو نمی‌رود */
  panel: string
}

const GUARD_CARD_MS = 60_000
const gGuard = globalThis as typeof globalThis & { __femwarPanelGuardAt?: Map<number, number> }
const guardCardAt: Map<number, number> = gGuard.__femwarPanelGuardAt ?? new Map()
gGuard.__femwarPanelGuardAt = guardCardAt

/** دروازه‌ی مجوزِ پنلِ مالک‌محور — «هر» کال‌بکِ owner-scoped که در گروه بیفتد.
 *
 *  فشاردهنده در گروه «به‌تعریف» مالک نیست (پنل در چتِ خصوصی زندگی می‌کند):
 *   ۱. توستِ «این پنل متعلق به بازیکن دیگری است.» — همیشه (متنِ مأموریت).
 *   ۲. کارتِ مهربان + دکمه‌ی «باز کردنِ پنلِ خودت» (لینکِ خصوصی) — سقفِ ۱ در
 *      دقیقه برای هر چت؛ «پیامِ تازه»، هرگز ویرایش (پیامِ مِهره‌خورده خودش می‌تواند
 *      پنلِ اشتراکیِ شهر باشد — §3B).
 *   ۳. پیش از هر فراخوانیِ موتور برمی‌گردد → هیچ جهشِ حالتی رخ نمی‌دهد؛
 *      هیچ اطلاعی از مالک (نام/شناسه/محتوا) افشا نمی‌شود.
 *
 *  خروجی: true = رد شد (فراخواننده ادامه نمی‌دهد) · false = مجاز (چتِ خصوصی —
 *  مالک به‌ساختگی؛ ۱:۱). استفاده: `if (await guardOwnerPanel(ctx, { panel: "hp" })) return` */
export async function guardOwnerPanel(ctx: Context, opts: PanelGuardOpts): Promise<boolean> {
  if (!isGroupChat(ctx)) return false // پیوی: مالک خودش — پنلِ خودش
  const chatId = ctx.chat?.id
  // ۱) توستِ رد — پیش از هر چیز؛ حتی اگر کارت سقفِ نرخ بخورد این می‌رسد
  await answer(ctx, NOT_YOUR_PANEL)
  // ۲) کارتِ «پنلِ خودت» — ۱ در دقیقه برای هر چت (ضدِ اسپمِ گروه)
  if (chatId !== undefined && (guardCardAt.get(chatId) ?? 0) <= Date.now() - GUARD_CARD_MS) {
    guardCardAt.set(chatId, Date.now())
    const kb = new InlineKeyboard().url(OWN_PANEL_BUTTON, privateLink(botUsername())).primary()
    const text = [
      `🔒 <b>${NOT_YOUR_PANEL}</b>`,
      "",
      "پنل‌های شخصی در گفت‌وگوی خصوصیِ خودِ هر بازیکن باز می‌شوند — نسخه‌ی خودت یک کلیک فاصله دارد.",
    ].join("\n")
    try {
      await ctx.reply(safeCut(toLatinDigits(text), 4000), { parse_mode: "HTML", reply_markup: kb })
    } catch {
      /* گروه ساکت/محدود — توستِ رد کافی است */
    }
  }
  log(`panel guard: «${opts.panel}» در گروه رد شد — بدونِ فراخوانیِ موتور`)
  return true
}
