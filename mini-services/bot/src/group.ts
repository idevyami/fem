// FEMBOY WAR 🎀 — V5: لایه‌ی گروه — ربات، پیام‌رسانِ «شهرِ زنده»ی گروه‌هاست.
//
// هیچ منطقِ بازی این‌جا نیست؛ هر متن/دکمه/تصمیم از موتور (Next.js :3000) می‌آید
// و این فایل فقط رندر و تحویل است:
//   • observe   — متنِ غیرفرمانیِ گروه به خط لوله‌ی حضورِ موتور می‌رود؛ قانونِ
//                 ضداسپم: ربات هرگز خودش به متنِ گروه جواب نمی‌دهد، مگر موتور بگوید.
//   • command   — فرمان‌های شهر (/game /city /play /event /vote /projects
//                 /members /history /help /duel /gadmin) → کارتِ HTML + کیبوردِ
//                 رنگیِ موتور. پاسخِ kind:"home" (کارتِ خانه) به‌جای پیامِ تازه،
//                 کارتِ خانه‌ی ذخیره‌شده‌ی همان چت را در جایش ویرایش می‌کند (§6.4).
//   • callback  — پیشوندهای ge:/gg:/gv:/ru:/gp:/cit:/gm:/gc:/gs: به موتور برمی‌گردند.
//                 gs: (تنظیماتِ ادمین) پیش از فرستادن، ادمینِ زنده از تلگرام
//                 شناسایی می‌شود (getChatMember ∈ {administrator, creator}) و پرچمِ
//                 isAdmin همراهش می‌رود — قراردادِ اعتمادِ موجِ ۲ (router.ts).
//   • member    — عضوهای تازه‌ی انسانی ثبت می‌شوند؛ کارتِ خوش‌آمد از تیکِ outbox می‌رسد.
//                 left_chat_member → action:"member_left" (کشِ جمعیت موتور یکی کم می‌شود).
//   • lifecycle — my_chat_member: افزودنِ ربات = ثبتِ گروه + کارتِ خانه؛ اخراج/ترک =
//                 گزارشِ unreachable (همان مسیرِ delivered) تا شهر تا بازگشتِ ربات ساکت بماند.
//   • tick      — هر ۴۵ ثانیه: زهکشیِ outbox، تحویل به تلگرام (chatId ممکن است
//                 خصوصی باشد — سرنخ‌های نامتقارن) و گزارشِ messageId برای ویرایش‌ها
//                 (editMessageId برای همه‌ی kind ها — از جمله دعوت‌نامه‌ی دوئل).

import { InlineKeyboard } from "grammy"
import type { Bot, Context } from "grammy"
import {
  api,
  GameApiError,
  type DeliveryReport,
  type GroupCallbackResponse,
  type GroupCommandResponse,
  type GroupMemberResponse,
  type GroupTickResponse,
  type ObserveResponse,
  type OutboxButton,
} from "./api"
import { outboxKeyboard, privateLink } from "./keyboards"
import { CITY_UNREACHABLE, safeCut } from "./ui"
import { esc, toLatinDigits } from "./format"
import { bumpError, log, stats } from "./stats"

// ─── ابزارهای کوچک ───────────────────────────────────────────────────────────

function isGroupChat(ctx: Context): boolean {
  const t = ctx.chat?.type
  return t === "group" || t === "supergroup"
}

function botUsername(): string {
  return stats.username ?? "femwarbot"
}

/** متنِ کارت را برای سقفِ تلگرام برش می‌دهد (۴۰۹۶) — و رقم‌هایش را انگلیسی می‌کند
 *  (متنِ موتور ممکن است رقمِ فارسی داشته باشد؛ تگ‌های HTML دست‌نخورده می‌مانند).
 *  V12 — برشِ امنِ تگ‌آگاه: هیچ‌وقت وسطِ «<tag» نمی‌بُرد (safeCut از ui.ts) */
function cardBody(text: string): string {
  return safeCut(toLatinDigits(text), 4000)
}

/** خطای زیرساختی (شبکه/پاسخِ خراب) یا صدای خودِ موتور؟ */
function isInfraError(e: unknown): boolean {
  return e instanceof GameApiError && (e.code === "network" || e.code === "bad_response")
}

// ─── حافظه‌ی پیام‌های خودِ ربات — برای تشخیصِ «پاسخ به ربات» ───────────────────

const BOT_MSG_MEMORY = 60 // پیامِ اخیرِ هر چت
const botMsgIds = new Map<number, number[]>()

/** ثبتِ پیامِ فرستاده‌شده‌ی خودِ ربات (LRU کوچک) */
export function trackBotMessage(chatId: number, messageId: number): void {
  const arr = botMsgIds.get(chatId) ?? []
  arr.push(messageId)
  if (arr.length > BOT_MSG_MEMORY) arr.splice(0, arr.length - BOT_MSG_MEMORY)
  botMsgIds.set(chatId, arr)
  if (botMsgIds.size > 300) {
    const oldest = botMsgIds.keys().next().value
    if (oldest !== undefined) botMsgIds.delete(oldest)
  }
}

export function isBotMessage(chatId: number | undefined, messageId: number | undefined): boolean {
  if (chatId === undefined || messageId === undefined) return false
  return (botMsgIds.get(chatId) ?? []).includes(messageId)
}

// ─── کارتِ خانه‌ی شهر — ویرایش در جا (V13 §6.4) ────────────────────────────────

const HOME_TTL_MS = 5 * 60_000 // عمرِ کارتِ خانه‌ی ذخیره‌شده

const gHome = globalThis as typeof globalThis & {
  __femwarHomeCards?: Map<number, { messageId: number; at: number }>
}
const homeCards: Map<number, { messageId: number; at: number }> = gHome.__femwarHomeCards ?? new Map()
gHome.__femwarHomeCards = homeCards

// ─── رندرِ کارت‌های موتور ─────────────────────────────────────────────────────

interface CardOpts {
  /** افزودنِ خط و ردیفِ «زندگی‌ات خصوصی است» (برای /start گروهی و ورودِ ربات) */
  privateNudge?: boolean
  /** پاسخ به پیامِ کاربر — برای حسِ گفت‌وگو (خط لوله‌ی حضور) */
  replyToMessageId?: number
  /** V13 (Part 9) — پرچمِ ادمینِ تاییدشده‌ی زنده (getChatMember)؛ همراهِ /gadmin
   *  و gs: می‌رود. موتور به ترنسپورتِ service-key اعتماد می‌کند، نه payload کاربر. */
  isAdmin?: boolean
}

/** بدنه و کیبوردِ نهاییِ کارت — همان خط لوله‌ی همیشه (نudge خصوصی + دکمه‌ها) */
function buildCard(text: string, buttons: OutboxButton[], opts: CardOpts): { body: string; kb: InlineKeyboard } {
  let body = cardBody(text)
  const kb = buttons.length > 0 ? outboxKeyboard(buttons) : new InlineKeyboard()
  if (opts.privateNudge) {
    body += "\n\n🔑 <i>زندگیِ شخصی‌ات در گفت‌وگوی خصوصیِ ربات است.</i>"
    kb.url("🔑 زندگی‌ات در خصوصی", privateLink(botUsername())).primary()
  }
  return { body, kb }
}

/** فرستادنِ کارتِ موتور به چتِ فعلی — HTML + کیبوردِ رنگی + ثبت در حافظه‌ی خودی */
async function sendCard(ctx: Context, text: string, buttons: OutboxButton[], opts: CardOpts = {}): Promise<void> {
  const { body, kb } = buildCard(text, buttons, opts)
  const chatId = ctx.chat?.id
  try {
    const sent = await ctx.reply(body, {
      parse_mode: "HTML",
      ...(kb.inline_keyboard.length > 0 ? { reply_markup: kb } : {}),
      ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
    })
    if (chatId !== undefined) trackBotMessage(chatId, sent.message_id)
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`group send: ${stats.lastError}`)
  }
}

/** کارتِ خانه‌ی شهر (kind:"home") — §6.4: به‌جای سیلیِ /game، همان پیامِ ذخیره‌شده
 *  (< 5 دقیقه) در جایش ویرایش می‌شود؛ هر خطا (حذف‌شده/قدیمی/قفل) = ارسالِ تازه.
 *  فقط چت‌های گروهی — پیوی هرگز کارتِ خانه ندارد. */
async function sendHomeCard(ctx: Context, text: string, buttons: OutboxButton[], opts: CardOpts): Promise<void> {
  const { body, kb } = buildCard(text, buttons, opts)
  const chatId = ctx.chat?.id
  if (chatId !== undefined) {
    const h = homeCards.get(chatId)
    if (h && Date.now() - h.at < HOME_TTL_MS) {
      try {
        await ctx.api.editMessageText(chatId, h.messageId, body, {
          parse_mode: "HTML",
          ...(kb.inline_keyboard.length > 0 ? { reply_markup: kb } : {}),
        })
        h.at = Date.now() // تازه‌سازیِ عمر — تا کارتِ خانه زنده بماند
        trackBotMessage(chatId, h.messageId)
        return
      } catch {
        /* کارت حذف‌شده/قفل — می‌افتیم روی ارسالِ تازه */
      }
    }
  }
  try {
    const sent = await ctx.reply(body, {
      parse_mode: "HTML",
      ...(kb.inline_keyboard.length > 0 ? { reply_markup: kb } : {}),
      ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
    })
    if (chatId !== undefined) {
      trackBotMessage(chatId, sent.message_id)
      homeCards.set(chatId, { messageId: sent.message_id, at: Date.now() })
    }
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`group send: ${stats.lastError}`)
  }
}

/** خطای فرمانِ گروه: صدای موتور عیناً (مثل «اول به ربات بنویس: شروع بازی.»)؛
 *  خطای زیرساخت با متنِ حمل‌ونقلِ فارسی */
async function sendEngineError(ctx: Context, e: unknown, opts: CardOpts): Promise<void> {
  if (e instanceof GameApiError && !isInfraError(e)) {
    await sendCard(ctx, `⚠️ ${esc(e.message)}`, [], opts)
    return
  }
  bumpError(e instanceof Error ? e.message : String(e))
  log(`group command: ${stats.lastError}`)
  await sendCard(ctx, `⚠️ ${CITY_UNREACHABLE}`, [], opts)
}

/** اجرای فرمانِ شهر در موتور و رندرِ کارتش — تمامِ متن/دکمه‌ها از موتور */
export async function sendEngineCommand(ctx: Context, command: string, opts: CardOpts = {}): Promise<void> {
  stats.groupCommands++
  // V12 — بازخوردِ فوری: «در حال نوشتن…» تا کارتِ موتور برسد (بی‌انتظار؛ هرگز نمی‌بُرد)
  void ctx.replyWithChatAction("typing").catch(() => {})
  let r: GroupCommandResponse
  try {
    r = await api.groupCommand<GroupCommandResponse>("command", {
      chatId: String(ctx.chat?.id ?? ""),
      chatTitle: ctx.chat?.title ?? "",
      telegramId: String(ctx.from?.id ?? ""),
      command,
      ...(opts.isAdmin === true ? { isAdmin: true } : {}),
    })
  } catch (e) {
    await sendEngineError(ctx, e, opts)
    return
  }
  // متنِ خالی یعنی کارت از راهِ outbox می‌رسد (مثل /event) — این‌جا چیزی نمی‌فرستیم
  if (!r.text.trim()) return
  // کارتِ خانه — در جایش ویرایش می‌شود، نه پیامِ تازه (V13 §6.4)
  if (r.kind === "home" && isGroupChat(ctx)) {
    await sendHomeCard(ctx, r.text, r.buttons, opts)
    return
  }
  await sendCard(ctx, r.text, r.buttons, opts)
}

// ─── ناظرِ حضور — متنِ گروه فقط با اجازه‌ی موتور جواب می‌گیرد ──────────────────

const OBSERVE_MAX = 500

/** مشاهده‌گرِ V5: متنِ غیرفرمانیِ گروه را برای موتور می‌برد و اگر موتور گفت،
 *  جواب می‌دهد (به‌عنوانِ reply به همان پیام). هرگز فرمان/سرویس/رسانه نمی‌بیند. */
export async function observeGroupText(ctx: Context): Promise<void> {
  if (!isGroupChat(ctx)) return
  const from = ctx.from
  if (!from || from.is_bot) return // خودِ ربات و ربات‌های دیگر هرگز
  const text = (ctx.message?.text ?? "").trim()
  if (!text || text.startsWith("/")) return // فرمان‌ها به موتورِ حضور نمی‌روند
  if (text.length > OBSERVE_MAX) return // متنِ بلند = اسپم

  const chatId = ctx.chat?.id
  const uname = botUsername().toLowerCase()
  const mentioned = uname ? text.toLowerCase().includes(`@${uname}`) : false
  const reply = ctx.message?.reply_to_message
  const replyToBot =
    Boolean(reply) && (reply?.from?.id === ctx.me.id || isBotMessage(chatId, reply?.message_id))
  const addressedToBot = mentioned || replyToBot

  let replyToTelegramId = ""
  if (reply?.from && !reply.from.is_bot && reply.from.id !== ctx.me.id) {
    replyToTelegramId = String(reply.from.id)
  }

  stats.observed++
  let r: ObserveResponse
  try {
    r = await api.groupObserve({
      chatId: String(chatId ?? ""),
      chatTitle: ctx.chat?.title ?? "",
      chatType: ctx.chat?.type,
      telegramId: String(from.id),
      playerName: from.first_name || from.username || "",
      text,
      addressedToBot,
      ...(replyToTelegramId ? { replyToTelegramId } : {}),
    })
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`group observe: ${stats.lastError}`)
    return
  }
  // قانونِ ضداسپم: بدونِ تصمیمِ موتور هیچ جوابی نیست
  if (r.action === "none" || !r.text?.trim()) return
  await sendCard(ctx, r.text, r.buttons ?? [], { replyToMessageId: ctx.message?.message_id })
}

// ─── اعضای تازه‌ی گروه ────────────────────────────────────────────────────────

/** new_chat_members — انسانی‌ها در موتور ثبت می‌شوند (خوش‌آمد از outbox می‌رسد)؛
 *  اگر خودِ ربات اضافه شده باشد، کارتِ خانه‌ی شهرِ V5 معرفی‌اش است. */
export async function onGroupNewMembers(ctx: Context): Promise<void> {
  if (!isGroupChat(ctx)) return
  const members = ctx.message?.new_chat_members ?? []
  if (members.length === 0) return

  const chatId = ctx.chat?.id
  const chatIdStr = String(chatId ?? "")
  const chatTitle = ctx.chat?.title ?? ""

  // خودِ ربات به گروه اضافه شد → کارتِ خانه‌ی شهر (معرفیِ V5) از موتور.
  // V13: my_chat_member هم همین لحظه می‌رسد — نخستین‌رسیده کارت را می‌گیرد؛
  // دومی بی‌صدا رد می‌شود تا کارت دوبار نیفتد.
  if (members.some((m) => m.id === ctx.me.id)) {
    if (chatId !== undefined && claimBotAdd(chatId)) {
      await sendEngineCommand(ctx, "game", { privateNudge: true })
    }
  }

  // عضوهای انسانیِ تازه → ثبت در موتور؛ موتور خوش‌آمد را از طریقِ تیک می‌فرستد
  for (const m of members) {
    if (m.is_bot || m.id === ctx.me.id) continue
    try {
      await api.groupCommand<GroupMemberResponse>("member", {
        chatId: chatIdStr,
        chatTitle,
        telegramId: String(m.id),
        playerName: m.first_name || m.username || "",
      })
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`group member: ${stats.lastError}`)
    }
  }
}

// ─── چرخه‌ی حیاتِ ربات در گروه (V13 — my_chat_member / left_chat_member) ────────

const BOT_ADD_CLAIM_MS = 10_000

const gLifecycle = globalThis as typeof globalThis & { __femwarBotAddClaim?: Map<number, number> }
const botAddClaim: Map<number, number> = gLifecycle.__femwarBotAddClaim ?? new Map()
gLifecycle.__femwarBotAddClaim = botAddClaim

/** ادعای یکتاییِ «ربات همین حالا اضافه شد» — my_chat_member و پیامِ سرویسِ
 *  new_chat_members هر دو می‌رسند؛ نخستین فراخوان true می‌گیرد، دومی تا ۱۰
 *  ثانیه false. بعد از آن ادعا می‌گسلد تا افزودنِ واقعیِ بعدی کارت بگیرد. */
function claimBotAdd(chatId: number): boolean {
  const now = Date.now()
  for (const [k, t] of botAddClaim) if (now - t > BOT_ADD_CLAIM_MS) botAddClaim.delete(k)
  if (botAddClaim.has(chatId)) return false
  botAddClaim.set(chatId, now)
  return true
}

/** پاک‌کردنِ حافظه‌های محلیِ یک چت — ربات از چت بیرون افتاده است؛ دیگر چیزی
 *  به آن نمی‌فرستیم و کارتِ خانه/پیام‌های خودی‌اش را هم فراموش می‌کنیم. */
function forgetChat(chatId: number): void {
  botMsgIds.delete(chatId)
  homeCards.delete(chatId)
}

/** my_chat_member — تنها منبعِ تضمینیِ وضعیتِ ربات در چت (§6.4/§8):
 *   • افزودن (left/kicked → member/administrator/restricted): ثبتِ گروه + کارتِ
 *     خانه‌ی شهر — همان مسیرِ پیامِ سرویس؛ ادعای یکتا از دوبله‌جلوگیری می‌کند.
 *   • اخراج/ترک (kicked/left): شهر باید تا بازگشتِ ربات ساکت بماند — همان مسیرِ
 *     unreachable گزارشِ تحویل (markGroupUnreachable موتور): پرچمِ botMissingAt
 *     می‌نشیند و صفِ معلق پاک می‌شود؛ نخستین کنشِ پس از بازگشت (ensureGroup)
 *     پرچم را برمی‌دارد. member_left برای خودِ ربات معنا ندارد — ربات بازیکن نیست. */
export async function onMyChatMember(ctx: Context): Promise<void> {
  const u = ctx.update.my_chat_member
  if (!u) return
  const type = u.chat.type
  if (type !== "group" && type !== "supergroup") return // بلوک/آنبلاکِ پیوی — شهر در کار نیست
  const chatId = u.chat.id
  const chatTitle = u.chat.title ?? ""
  const newStatus = u.new_chat_member.status
  const oldStatus = u.old_chat_member.status
  const gone = newStatus === "kicked" || newStatus === "left"
  const added = !gone && (oldStatus === "kicked" || oldStatus === "left")

  if (gone) {
    forgetChat(chatId)
    try {
      await api.groupDelivered([], [String(chatId)])
      log(`lifecycle: ربات از «${chatTitle || chatId}» بیرون افتاد (${newStatus}) — شهر تا بازگشت ساکت می‌شود.`)
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`lifecycle unreachable report: ${stats.lastError}`)
    }
    return
  }
  if (!added) return // ترفیع/تنزل/محدودیت — برای شهر خبر نیست
  if (!claimBotAdd(chatId)) return // کارتِ معرفی همین حالا از پیامِ سرویس آمد
  await sendEngineCommand(ctx, "game", { privateNudge: true })
}

/** left_chat_member — یک عضوِ انسانی گروه را ترک کرد: action:"member_left"
 *  (کشِ جمعیتِ موتور یکی کم می‌شود؛ ردیف برای بازگشت می‌ماند). دوبله‌فرستیِ
 *  تلگرام را لایه‌ی dedup آپدیت‌ها می‌خورَد. رباتِ خارج‌شده را این‌جا نمی‌بینیم
 *  (is_bot) — مسیرِ my_chat_member بالاست. */
export async function onGroupLeftMember(ctx: Context): Promise<void> {
  if (!isGroupChat(ctx)) return
  const leaver = ctx.message?.left_chat_member
  if (!leaver || leaver.is_bot) return
  try {
    await api.groupCommand<{ left: boolean }>("member_left", {
      chatId: String(ctx.chat?.id ?? ""),
      chatTitle: ctx.chat?.title ?? "",
      telegramId: String(leaver.id),
    })
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`group member_left: ${stats.lastError}`)
  }
}

// ─── تاییدِ زنده‌ی ادمین (V13 Part 9 — قراردادِ isAdmin) ──────────────────────

const ADMIN_VERIFY_TTL_MS = 60_000
const ADMIN_STATUSES = new Set(["administrator", "creator"])

const gAdmin = globalThis as typeof globalThis & {
  __femwarAdminCache?: Map<string, { ok: boolean; at: number }>
}
const adminCache: Map<string, { ok: boolean; at: number }> = gAdmin.__femwarAdminCache ?? new Map()
gAdmin.__femwarAdminCache = adminCache

/** ادمینِ زندهٔ تلگرام؟ getChatMember ∈ {administrator, creator} — پرچمِ isAdmin
 *  فقط با این تایید همراه می‌شود (موتور به ترنسپورتِ service-key اعتماد می‌کند).
 *  خطای شبکه = غیرادمین + لاگ (و بی‌کش — دفعه‌ی بعد دوباره تلاش می‌شود).
 *  کشِ ۶۰ثانیه‌ای فقط برای gs: (هر فشارِ دکمه)؛ فرمان‌ها بدون کش می‌آیند. */
export async function verifyChatAdmin(
  ctx: Context,
  chatId: string,
  telegramId: string,
  opts: { cache?: boolean } = {},
): Promise<boolean> {
  const uid = Number(telegramId)
  if (!chatId || !Number.isFinite(uid) || uid <= 0) return false
  const key = `${chatId}:${telegramId}`
  if (opts.cache !== false) {
    const c = adminCache.get(key)
    if (c && Date.now() - c.at < ADMIN_VERIFY_TTL_MS) return c.ok
  }
  let ok = false
  try {
    const m = await ctx.api.getChatMember(chatId, uid)
    ok = ADMIN_STATUSES.has(m.status)
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`admin verify: ${stats.lastError}`)
    return false
  }
  adminCache.set(key, { ok, at: Date.now() })
  if (adminCache.size > 500) {
    const oldest = adminCache.keys().next().value
    if (oldest !== undefined) adminCache.delete(oldest)
  }
  return ok
}

// ─── مسیریابِ callback های گروهی ─────────────────────────────────────────────

// V15-hotfix (Oct 17): «gh:» (کدکسِ راهنما — دسته‌ها/موضوع‌ها/صفحه‌ها) جا مانده
// بود. علامتِ زنده‌اش: در گروهِ واقعی، هر دکمه‌ی راهنما («📚 کدکسِ کامل»،
// «✨ عبارت‌های جادویی»، همه‌ی gh:c:/gh:t:) کورکورانه answer می‌شد و به موتور
// نمی‌رسید — دکمه‌ی مرده. گرامرِ کاملِ موتور: ge/gg/gv/ru/gp/cit/gm/gc/gh/gs
// (روترِ موتور، سربرگِ CALLBACKS) — این لیست باید آینه‌ی کاملِ همان باشد.
const GROUP_CB_PREFIXES = ["ge:", "gg:", "gv:", "ru:", "gp:", "cit:", "gm:", "gc:", "gh:", "gs:"] as const

/** آیا این callback-data مالِ لایه‌ی گروهِ موتور است؟ */
export function isGroupCallbackData(data: string | undefined): boolean {
  if (!data) return false
  return (GROUP_CB_PREFIXES as readonly string[]).some((p) => data.startsWith(p))
}

/** ackText خطای واقعی است (نه شانه‌بال‌های «؟») */
function isRealAckError(ack: string): boolean {
  const t = ack.trim()
  return t !== "" && t !== "؟" && t !== "?"
}

/** کال‌بکِ گروهی: به موتور می‌رود؛ توست/هشدار از ackText، کارت در همان پیام ویرایش
 *  می‌شود (messageId حفظ می‌شود؛ «message is not modified» بی‌صدا رد می‌شود).
 *  V15-3 — این تابع «ترنسپورتِ پنلِ اشتراکیِ شهر» است (SharedGroupPanel در
 *  panels.ts): یک پیام، شرکت‌کننده‌هایِ زیاد، وضعیتِ مرجع در موتور و چرخه‌ی حیاتِ
 *  created→open→updated→locked→finalized (قراردادِ کامل: router.ts موتور).
 *  مشارکت‌ها با telegramIdِ فشاردهنده ثبت می‌شوند؛ editCard فقط «نما» را تازه
 *  می‌کند و کال‌بک‌هایِ رد/بسته‌شده فقط توست می‌گیرند — پنل هرگز برای بقیه
 *  نمی‌میرد (مأموریت §3B).
 *  V13: gs: (تنظیمات) پیش از فرستادن ادمینِ زنده شناسایی می‌شود — پرچمِ isAdmin
 *  فقط با تاییدِ getChatMember می‌رود؛ بدونِ آن موتور توستِ «فقط ادمین‌های گروه.» می‌دهد. */
export async function handleGroupCallback(ctx: Context): Promise<void> {
  const cq = ctx.callbackQuery
  if (!cq) return
  const data = cq.data ?? ""
  const chatId = String(cq.message?.chat?.id ?? "")
  // V6 — chatTitle همیشه همراهِ فرمان/کال‌بک می‌رود (موتور عنوانِ تازه‌شده را
  // ذخیره می‌کند؛ کارت‌های قدیمیِ «گروهِ بی‌نام» این‌طور شفاء می‌یابند)
  const chatTitle = (ctx.chat?.title || cq.message?.chat?.title) ?? ""
  const telegramId = String(ctx.from?.id ?? "")

  // V13 — تاییدِ زندهٔ ادمین برای gs: (کشِ ۶۰ ثانیه تا هر فشارِ دکمه یک getChatMember نخورد)
  const isAdmin = data.startsWith("gs:") ? await verifyChatAdmin(ctx, chatId, telegramId, { cache: true }) : false

  let ackText = ""
  let alert = false

  try {
    const r = await api.groupCommand<GroupCallbackResponse>("callback", {
      chatId,
      chatTitle,
      telegramId,
      data,
      ...(isAdmin ? { isAdmin: true } : {}),
    })
    ackText = r.ackText
    alert = !r.ok && isRealAckError(r.ackText)
    if (r.editCard) {
      // ویرایشِ همان پیامی که دکمه‌اش زده شد — کیبوردِ خالی یعنی حذفِ دکمه‌ها
      const kb = outboxKeyboard(r.editCard.buttons)
      try {
        await ctx.editMessageText(cardBody(r.editCard.text), { parse_mode: "HTML", reply_markup: kb })
      } catch (e) {
        const s = e instanceof Error ? e.message : String(e)
        if (!/message is not modified/i.test(s)) {
          // کارت کهنه/ازدست‌رفته است — نسخه‌ی تازه می‌فرستیم
          await sendCard(ctx, r.editCard.text, r.editCard.buttons, {})
        }
      }
    }
  } catch (e) {
    if (e instanceof GameApiError && !isInfraError(e)) {
      ackText = e.message // صدای خودِ موتور (مثل «اول به ربات بنویس: شروع بازی.»)
      alert = true
    } else {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`group callback: ${stats.lastError}`)
      ackText = `⚠️ ${CITY_UNREACHABLE}`
      alert = true
    }
  }

  try {
    if (ackText.trim()) {
      // توست HTML نمی‌فهمد — تگ‌ها را می‌شویم و رقم‌ها را انگلیسی می‌کنیم
      const toast = toLatinDigits(ackText.replace(/<[^>]+>/g, "")).slice(0, 190)
      await ctx.answerCallbackQuery(alert ? { text: toast, show_alert: true } : { text: toast })
    } else {
      await ctx.answerCallbackQuery()
    }
  } catch {
    /* کوئری دیر جواب شد؛ بی‌صدا */
  }
}

// ─── اسکِیپ‌بانِ ۴۵ ثانیه‌ای — زهکشیِ outbox و تحویل ────────────────────────────

const TICK_INTERVAL_MS = 45_000

/** خطاهای «همیشگی» تحویل — چت برای ربات بسته شده (حذف/بلوک/اخراج).
 *  این‌ها خطا نیستند، وضعیت‌اند: موتور باید آن شهر را تا بازگشتِ ربات خاموش کند.
 *  V7: هر شکلِ chatId (گروهی عددی-منفی، یا شناسه‌های آزمایشی غیرعددی) —
 *  بدونِ این، دنیاهای مرده‌ی غیرعددی هر ۴۵ ثانیه تا ابد خطا می‌دهند. */
const PERMANENT_DELIVERY =
  /chat not found|bot was kicked|bot was blocked|chat_write_forbidden|user is deactivated|not have access to the chat/i

const g = globalThis as typeof globalThis & { __femwarGroupTicker?: ReturnType<typeof setInterval> }

/** تیکِ گروه‌ها — فقط با BOT_TOKEN؛ هرگز فرایند را نمی‌شکند؛ دورِ هم‌پوشان رد می‌شود */
export function startGroupTicker(bot: Bot): void {
  if (g.__femwarGroupTicker) clearInterval(g.__femwarGroupTicker) // hot-reload: فقط نسلِ تازه
  let inFlight = false
  g.__femwarGroupTicker = setInterval(() => {
    if (inFlight) return
    inFlight = true
    void drainOutbox(bot)
      .catch(() => {})
      .finally(() => {
        inFlight = false
      })
  }, TICK_INTERVAL_MS)
  log(`group ticker: هر ${TICK_INTERVAL_MS / 1000} ثانیه — زهکشیِ outboxِ موتور`)
}

/** یک دورِ تحویل: پیام‌های آماده‌ی موتور را می‌فرستد/ویرایش می‌کند و
 *  messageId های تازه را فوراً گزارش می‌دهد تا ویرایش‌های بعدی ممکن شود.
 *  چت‌های گروهی که تلگرام برای همیشه ردشان می‌کند به موتور گزارش می‌شوند (unreachable)
 *  تا شهرِ آن‌ها تا بازگشتِ ربات ساکت بماند — بی‌اسپمِ خطا، بی‌انبارِ پیام.
 *  V13: ویرایشِ editMessageId برای همه‌ی kind هاست (رویداد/بازی/رأی/دعوتِ دوئل) و
 *  گزارشِ messageId هیچ فیلتری روی refType ندارد — مهرِ GroupChallenge.messageId
 *  سمتِ موتور (markDelivered) زده می‌شود؛ این‌جا همه‌ی تحویل‌ها یکسان گزارش می‌شوند. */
export async function drainOutbox(bot: Bot): Promise<void> {
  let r: GroupTickResponse
  try {
    r = await api.groupTick()
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`group tick: ${stats.lastError}`)
    return
  }
  stats.lastGroupTickAt = new Date()

  const delivered: DeliveryReport[] = []
  const unreachable = new Set<string>()
  for (const m of r.messages) {
    if (!m.text.trim()) continue
    try {
      if (m.editMessageId) {
        // ویرایشِ کارتِ قبلی — موتور messageId را از گزارشِ قبلی می‌داند
        await bot.api.editMessageText(
          m.chatId,
          Number(m.editMessageId),
          cardBody(m.text),
          { parse_mode: "HTML", reply_markup: outboxKeyboard(m.buttons) },
        )
      } else {
        const sent = await bot.api.sendMessage(m.chatId, cardBody(m.text), {
          parse_mode: "HTML",
          ...(m.buttons.length > 0 ? { reply_markup: outboxKeyboard(m.buttons) } : {}),
        })
        delivered.push({ outboxId: m.outboxId, messageId: sent.message_id })
        // chatId ممکن است چتِ خصوصیِ بازیکنی باشد (سرنخِ نامتقارن) — فقط گروه‌ها ردگیری می‌شوند
        const cid = Number(m.chatId)
        if (Number.isFinite(cid) && cid < 0) trackBotMessage(cid, sent.message_id)
      }
    } catch (e) {
      const s = e instanceof Error ? e.message : String(e)
      if (/message is not modified/i.test(s)) continue // بی‌صدا
      if (PERMANENT_DELIVERY.test(s)) {
        // چتِ گروهی برای همیشه از دسترس خارج شده — به موتور گزارش می‌شود؛
        // DM های رد‌شده (بازیکن /start نزده) فقط همین‌بار رد می‌شوند و خطا نیستند
        unreachable.add(m.chatId)
        log(`group deliver (${m.kind} → ${m.chatId}): چت در دسترس نیست — شهر تا بازگشتِ ربات ساکت می‌شود`)
        continue
      }
      bumpError(s)
      log(`group deliver (${m.kind} → ${m.chatId}): ${s}`)
    }
  }

  if (delivered.length > 0) stats.outboxDelivered += delivered.length
  if (delivered.length > 0 || unreachable.size > 0) {
    try {
      await api.groupDelivered(delivered, [...unreachable])
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`group delivered report: ${stats.lastError}`)
    }
  }
}
