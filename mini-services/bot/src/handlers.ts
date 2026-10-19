// FEMBOY WAR 🎀 — هندلرها و مسیریاب (V6).
// این فایل فقط «نمایش + ناوبری» است؛ هر نتیجه‌ای از موتور می‌آید.
//
// دو حالت دارد:
//  • خصوصی = «زندگیِ من» — پیشخوانِ غنی، راهنما، اهداف، فرصت‌ها، آرزوها، من ۲.۰،
//    کیفِ تعاملی (استفاده/پوشیدن/فروش)، بدهی، عنوان‌ها، شغل‌ها، بازار، خبرها، بینگو
//  • گروه  = «شهرِ ما»    — فرمان‌های شهرِ زنده از موتورِ V5 (لایه‌ی group.ts)
//     + ناظرِ حضور: متنِ گروه فقط با اجازه‌ی موتور جواب می‌گیرد (قانونِ ضداسپم)

import { InlineKeyboard, InputFile } from "grammy"
import type { Bot, Context } from "grammy"
import { api, type GameSnapshot, type GuideResponse, type NextActionDTO } from "./api"
import { bumpCommand, bumpError, log, stats } from "./stats"
import {
  backKeyboard,
  bagKeyboard,
  bingoConfirmKeyboard,
  bingoKeyboard,
  CB,
  cityKeyboard,
  debtKeyboard,
  eventKeyboard,
  errorKeyboard,
  guideKeyboard,
  goalsKeyboard,
  homeKeyboard,
  jobsKeyboard,
  livingConfirmKeyboard,
  livingKeyboard,
  marketKeyboard,
  marketPriceKeyboard,
  marketSellKeyboard,
  MINIAPP_URL,
  miniAppCardKeyboard,
  notifyKeyboard,
  nudgeKeyboard,
  opsKeyboard,
  parseCallback,
  achievementsKeyboard,
  privateLink,
  profileKeyboard,
  dreamsKeyboard,
  replyKeyboard,
  titlesKeyboard,
  withMiniApp,
  type Callback,
} from "./keyboards"
import {
  handleGroupCallback,
  isBotMessage,
  isGroupCallbackData,
  observeGroupText,
  onGroupLeftMember,
  onGroupNewMembers,
  onMyChatMember,
  sendEngineCommand,
  verifyChatAdmin,
} from "./group"
import { isDuplicateUpdate } from "./dedup"
import { admitCallback, admitCommand, admitTextCommand, SLOW_DOWN_TOAST } from "./limits"
import { INTENT_HINT, cardHint, resolveIntent, type HintContext, type IntentId } from "./intent"
import {
  handleChampCommand,
  handleDuelCommand,
  handleFemboyCommand,
  handleMyFemboyCommand,
  handleSoulCallback,
  isSoulCallbackData,
  rememberUser,
  soulTextGuard,
} from "./soul"
import { handleHelpCallback, isHelpCallbackData, showHelpHome } from "./help"
import { guardOwnerPanel, openPrivatePanel } from "./panels"
import {
  answer,
  botUsername,
  CITY_UNREACHABLE,
  fail,
  GENERIC,
  isGroupChat,
  isPrivate,
  safeCut,
  show,
  showOutcome,
  tgId,
} from "./ui"
import {
  achievementsText,
  actionText,
  bagText,
  bingoCap,
  bingoText,
  BINGO_CONFIRM_STAKE,
  cityNewsText,
  cityStatusText,
  cityText,
  clampText,
  chip,
  debtText,
  dreamsText,
  eventText,
  expand,
  goalsText,
  guideText,
  historyText,
  homeText,
  jobsText,
  livingConfirmText,
  livingText,
  marketPriceText,
  marketSellText,
  marketText,
  notifyText,
  opsText,
  outcomeText,
  profileText,
  SEP,
  suggestedPrices,
  SUB,
  titlesText,
  topText,
  vehiclePriceOf,
  type LivingWhich,
  esc,
  faNum,
  toLatinDigits,
} from "./format"

// ─── ابزارهای مشترکِ نمایش (answer/show/fail/tgId/…) از ./ui می‌آیند ─────────

/** V16-3 — خطِ عبارت‌هایِ بافتاریِ انتهای کارت (ممیزی ⑭: هر کارت ۶ عبارتِِ
 *  مرتبطِ خودش را معرفی می‌کند — نه ۶ عبارتِ ثابت برای کلِ بازی). */
function withHint(text: string, context: HintContext): string {
  const hint = cardHint(context)
  return hint ? `${text}\n\n${hint}` : text
}

// ─── حافظه‌ی جلسه (درون‌حافظه‌ای؛ hot-reload رویش می‌رود ولی مشکلی نیست) ────────

/** آخرین اکشن هر چت برای دکمه‌ی «🔄 دوباره» — سقف ۱۰۰ */
const lastAction = new Map<number, () => Promise<void>>()

/** نشانگرِ «در حال نوشتن…» — بی‌انتظار (fire-and-forget)، فقط در چتِ خصوصی:
 *  موتور تا چند ثانیه جواب می‌دهد؛ کاربر از همان لحظه‌ی اول بازخورد می‌بیند.
 *  در گروه فقط فرمان‌های شهر این را می‌گیرند (group.ts — sendEngineCommand). */
function typing(ctx: Context): void {
  if (ctx.chat?.type !== "private") return
  void ctx.replyWithChatAction("typing").catch(() => {})
}

async function run(ctx: Context, fn: (ctx: Context) => Promise<void>): Promise<void> {
  typing(ctx) // V12 — بازخوردِ فوری پیش از هر فراخوانیِ موتور
  const chatId = ctx.chat?.id
  if (chatId !== undefined) {
    lastAction.set(chatId, () => fn(ctx))
    if (lastAction.size > 100) {
      const oldest = lastAction.keys().next().value
      if (oldest !== undefined) lastAction.delete(oldest)
    }
  }
  await fn(ctx)
}

export async function onRetry(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id
  const fn = chatId !== undefined ? lastAction.get(chatId) : undefined
  if (!fn) {
    await answer(ctx, "چیزی برای تکرار نیست")
    await sendHome(ctx)
    return
  }
  await fn()
}

/** نرم‌گیری از guide — اگر موتور V4 هنوز راه نیفتاده، null برمی‌گردد */
async function fetchGuide(telegramId: string): Promise<GuideResponse | null> {
  try {
    return await api.guide(telegramId)
  } catch {
    return null
  }
}

async function fetchSnapshot(telegramId: string): Promise<GameSnapshot | null> {
  try {
    return (await api.state(telegramId)).snapshot
  } catch {
    return null
  }
}

// ─── کارت‌های عکسی (V12 — الگوی هابِ /femboy در soul.ts: آرتِ کلاس + کپشنِ HTML) ──

const ART_DIR = "/home/z/my-project/public/art/classes"

/** آرتِ قهرمانِ خوش‌آمدِ /start — یک تصویرِ ثابت به‌عنوانِ چهره‌ی شهر؛
 *  کپشن همیشه بی‌طرفِ کلاسی است (هیچ اشاره‌ای به کلاسِ تصویر نمی‌شود). */
const HERO_ART = "wizard"

/** بارگذاریِ آرتِ کلاس از دیسک — همان مکانیزمِ soul.ts (آپلود مستقیم به Bot API) */
async function classArt(classKey: string): Promise<InputFile | null> {
  try {
    const buf = new Uint8Array(await Bun.file(`${ART_DIR}/${classKey}.jpg`).arrayBuffer())
    if (buf.byteLength === 0) return null
    return new InputFile(buf, `${classKey}.jpg`)
  } catch {
    return null // عکس نبود — کارتِ متنی می‌ماند
  }
}

/** سقفِ کپشنِ تلگرام — ۱۰۲۴؛ با حاشیه ۱۰۰۰ و برشِ امنِ تگ + رقم‌های انگلیسی */
const cap = (text: string): string => safeCut(toLatinDigits(text), 1000)

/** کارتِ عکسی با fallbackِ متنی — بدونِ عکس (یا اگر ارسال شکست خورد) همان show() */
async function sendPhotoCard(
  ctx: Context,
  classKey: string | null,
  caption: string,
  kb: InlineKeyboard,
): Promise<void> {
  const file = classKey ? await classArt(classKey) : null
  if (!file) {
    await show(ctx, caption, kb)
    return
  }
  try {
    await ctx.replyWithPhoto(file, { caption: cap(caption), parse_mode: "HTML", reply_markup: kb })
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`home photo: ${stats.lastError}`)
    await show(ctx, caption, kb)
  }
}

// ─── /start — خصوصی ──────────────────────────────────────────────────────────

export async function handleStart(ctx: Context): Promise<void> {
  // V7 — لینکِ عمیقِ پیمانِ فمبوی (دکمه‌ی گروه/تالار): مستقیم به جریانِ /femboy
  const payload = typeof ctx.match === "string" ? ctx.match.trim() : ""
  if (payload === "femboy") {
    await handleFemboyCommand(ctx)
    return
  }
  // V6 — لینکِ عمیقِ /start app (دکمه‌ی «اپ» کارت‌های گروه): کارتِ کوتاهِ بومیِ
  // مینی‌اپ با دکمه‌ی web_app — بدون جریانِ کاملِ خوش‌آمد.
  if (payload === "app" && MINIAPP_URL) {
    await show(
      ctx,
      ["🎀 <b>FEMBOY WAR</b>", "", "زندگی‌ات یک لمس جلوتر است — شهر، کیف، بازار و بقیه‌اش این‌جا زنده‌اند 👇"].join("\n"),
      miniAppCardKeyboard(),
    )
    return
  }
  // V16-1 (مشکل ⑥ ممیزی) — لینک‌های عمیقِ بافتاری از هابِ شهر: همان کارتی که
  // intentِ همان نام در خصوصی می‌دهد (کیف/بازار/اهداف) — نه کارتِ خوش‌آمدِ عکسی.
  // api.auth مثلِ /startِ معمول بازیکن را ثبت/تازه می‌کند تا کارتِ مقصد صادقانه
  // رندر شود (بازیکنِ گروهیِ که هرگز خصوصی را باز نکرده نیز پذیرفته می‌شود).
  if (payload === "items" || payload === "market" || payload === "goals") {
    try {
      await api.auth(tgId(ctx), ctx.from?.first_name || ctx.from?.username)
    } catch {
      /* ثبت نشد — کارتِ مقصد خودش صدای موتور را می‌دهد (no_player صادقانه) */
    }
    if (payload === "items") return showItems(ctx)
    if (payload === "market") return showMarket(ctx)
    return showGoals(ctx)
  }

  const name = ctx.from?.first_name || ctx.from?.username
  const res = await api.auth(tgId(ctx), name)

  // V9 — فمبوی مرکزِ جهان است: بدونِ او، همه‌چیز از پیمان شروع می‌شود.
  // پیشخوانِ عمومی این‌جا نمایش داده نمی‌شود؛ بعد از قفلِ پیمان، هاب خودش می‌آید.
  // V12 — کارتِ عکسیِ خوش‌آمد: آرتِ hero (بی‌طرفِ کلاسی) + پیمان + ردیفِ مینی‌اپ.
  if (!res.snapshot.femboy) {
    const head = res.created
      ? [
          "به این شهر خوش آمدی.",
          "",
          "هر بازیکن یک فمبویِ اختصاصی دارد — اسمش را تو انتخاب می‌کنی، مسیرش را شهر می‌نویسد.",
          "شهر زندگی می‌کند، تو تصمیم می‌گیری، فمبویت رشد می‌کند.",
        ].join("\n")
      : ["برگشتی — ولی هنوز فمبوی نداری.", "در این جهان یعنی هنوز شروع نکردی."].join("\n")
    const caption = [
      "🎀 <b>FEMBOY WAR</b>",
      SEP,
      "",
      head,
      "",
      SUB,
      "",
      "اول از همه: <b>پیمانِ فمبویت را ببندیم.</b>",
    ].join("\n")
    const kb = new InlineKeyboard().text("✨ شروعِ پیمان", "fw:begin").primary()
    await sendPhotoCard(ctx, HERO_ART, caption, withMiniApp(kb))
  } else {
    // بازیکنِ برگشته با فمبوی — کارتِ عکسیِ پیشخوان (آرتِ کلاسِ فمبویِ خودش؛
    // خطِ هویتِ فمبوی را خودِ homeText از snapshot.femboy می‌سازد — مثل /menu)
    // V12 — خلاصه‌ی آفلاین داخلِ نقل‌قولِ بازشدنی («چه خبر شده؟») جمع می‌شود.
    let prefix = "برگشتی. شهر یادش نرفته.\n\n"
    const recap = res.snapshot.offlineRecap
    if (recap && recap.lines.length > 0) {
      const body = recap.lines.map((l) => `${l.icon} ${esc(l.text)}`).join("\n")
      prefix += `🕰 <b>چه خبر شده؟</b>\n${expand(`در نبودت…\n${body}`)}\n\n`
    }
    const guide = await fetchGuide(tgId(ctx))
    const caption = prefix + homeText({ name: name ?? "غریبه", snapshot: res.snapshot, guide })
    await sendPhotoCard(ctx, res.snapshot.femboy.classKey, withHint(caption, "home"), homeKeyboard())
  }

  // کیبوردِ ثابتِ خصوصی — جدا از پیامِ پیشخوان (کارتِ عکس، کیبوردِ inline دارد؛
  // reply_markup روی یک پیام دوگانه نیست) — V12: با صدایِ شیشه‌ای
  try {
    await ctx.reply("🎛 <b>میان‌برهای ثابَتت</b>\nهمیشه پیشِ روی‌ات‌اند — لمسشان کن، یا برای شهر چیزی بنویس…", {
      parse_mode: "HTML",
      reply_markup: replyKeyboard(),
    })
  } catch {
    /* کیبورد فرستاده نشد؛ اهمیتی ندارد */
  }
}

// ─── پیشخوان / «زندگیِ من» ──────────────────────────────────────────────────────

export async function sendHome(ctx: Context, seedSnapshot?: GameSnapshot): Promise<void> {
  const id = tgId(ctx)
  const guide = await fetchGuide(id)
  const snapshot = seedSnapshot ?? (await fetchSnapshot(id))
  if (!guide && !snapshot) {
    await show(ctx, `⚠️ ${CITY_UNREACHABLE}`, errorKeyboard())
    return
  }
  const name = ctx.from?.first_name || ctx.from?.username || "غریبه"
  // V12 — پیشخوانِ عکسی (الگویِ هابِ /femboy): آرتِ کلاسِ فمبویِ بازیکن + کپشنِ داشبورد؛
  // بدونِ فمبوی (یا بدونِ عکس) همان کارتِ متنی می‌ماند.
  const caption = homeText({ name, snapshot, guide })
  await sendPhotoCard(ctx, snapshot?.femboy?.classKey ?? null, withHint(caption, "home"), homeKeyboard())
}

// ─── 🎯 قدمِ بعدی ────────────────────────────────────────────────────────────

export async function showGuide(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    await show(ctx, withHint(guideText(g), "guide"), guideKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🎯 اهداف ────────────────────────────────────────────────────────────────

export async function showGoals(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    await show(ctx, goalsText(g), goalsKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── ⚡ فرصت‌ها ───────────────────────────────────────────────────────────────

export async function showOps(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    await show(ctx, opsText(g), opsKeyboard(g))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** گرفتن یک فرصت — نتیجه از موتور، رنگِ دکمه از ریسک */
export async function doClaimOpportunity(ctx: Context, opportunityId: string): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), "claimOpportunity", { opportunityId })
    await outcomeShow(ctx, actionText(res))
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── ✨ آرزوها ───────────────────────────────────────────────────────────────

export async function showDreams(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    await show(ctx, dreamsText(g), dreamsKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── مسیریابیِ «قدم بعدی» ────────────────────────────────────────────────────

/** یکی از nextAction های راهنما را اجرا می‌کند — واژگانِ شناسه‌ها همانِ موتور است:
 *  event / draw-event / rest / feedPet / work / claim-{oppId} / payDebt / travel / market
 *  V9: femboy / femboySkills / femboyInteract / femboyHunt → /femboy (پیمان یا هاب) */
export async function routeNextAction(ctx: Context, na: NextActionDTO): Promise<void> {
  const raw = na.id

  // فرصت‌ها: شناسه مثل «claim-opp_x» است
  if (raw.startsWith("claim-") && raw.length > 6) {
    return doClaimOpportunity(ctx, raw.slice(6))
  }

  const i = raw.indexOf(":")
  const verb = i === -1 ? raw : raw.slice(0, i)
  const arg = i === -1 ? "" : raw.slice(i + 1)

  switch (verb) {
    case "event":
    case "draw-event":
    case "draw_event":
    case "daily-event":
    case "daily_event":
      return showEvent(ctx)
    case "rest":
      return doRest(ctx)
    case "feedPet":
    case "feed_pet":
      return arg ? doFeedPet(ctx, arg) : feedHungriest(ctx)
    case "work":
      return doWork(ctx)
    case "payDebt":
    case "pay_debt":
    case "debt":
      return showDebt(ctx)
    case "city":
      return arg ? doTravel(ctx, arg) : showCity(ctx)
    case "travel":
      return arg ? doTravel(ctx, arg) : showCity(ctx)
    case "market":
      return showMarket(ctx)
    case "me":
    case "profile":
      return showProfile(ctx)
    case "items":
    case "bag":
      return showItems(ctx)
    case "titles":
      return showTitles(ctx)
    case "jobs":
      return showJobs(ctx)
    case "notify":
    case "notifications":
      return showNotify(ctx)
    case "bingo":
    case "gamble":
      return showBingo(ctx)
    case "guide":
      return showGuide(ctx)
    case "goals":
      return showGoals(ctx)
    case "ops":
    case "opportunities":
      return showOps(ctx)
    case "dreams":
    case "aspirations":
      return showDreams(ctx)
    // V9 — فمبوی: هویتِ مرکزی؛ همه‌ی نشانه‌های راهنما به /femboy می‌رسند
    // (پیمان اگر نبسته؛ وگرنه هاب — که مهارت‌ها/تعامل/شکار را دارد)
    case "femboy":
    case "femboySkills":
    case "femboyInteract":
    case "femboyHunt":
      return handleFemboyCommand(ctx)
    case "menu":
    case "home":
      return sendHome(ctx)
    case "claim_opportunity":
    case "opportunity":
      return arg ? doClaimOpportunity(ctx, arg) : showOps(ctx)
    case "play_pet":
    case "playPet":
      return arg ? doPlayPet(ctx, arg) : showItems(ctx)
  }
  // شناخته‌نشده — همان شناسه را به موتور می‌دهیم؛ اگر بلد بود اجرایش می‌کند
  await runAction(ctx, verb, arg ? { target: arg } : {})
}

/** «غذا بده» بدون شناسه — گرسنه‌ترین حیوانِ کیف را پیدا و سیرش کن */
async function feedHungriest(ctx: Context): Promise<void> {
  try {
    const p = await api.profile(tgId(ctx))
    const starving = [...p.pets].sort((a, b) => a.hunger - b.hunger)[0]
    if (starving) return doFeedPet(ctx, starving.id)
    return showItems(ctx)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** «🧭 بعدی» — اولین پیشنهادِ راهنما */
export async function onNextGo(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    const na = g.nextActions[0]
    if (!na) {
      await show(ctx, "🧭 فعلاً قدمِ بعدی‌ای نیست… <i>یک نفس بکش.</i>", backKeyboard())
      return
    }
    await routeNextAction(ctx, na)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** «🎲 انتخاب تصادفی» — یکی از nextAction ها را برمی‌دارد و می‌رود */
export async function onRandomPick(ctx: Context): Promise<void> {
  try {
    const g = await api.guide(tgId(ctx))
    if (g.nextActions.length === 0) {
      await show(ctx, "🎲 راهنما فعلاً پیشنهادی ندارد. <i>خودت انتخاب کن — این هم زندگی است.</i>", guideKeyboard())
      return
    }
    const pick = g.nextActions[Math.floor(Math.random() * g.nextActions.length)]!
    await answer(ctx, `🎲 ${pick.title}`)
    await routeNextAction(ctx, pick)
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🎲 اتفاق امروز + انتخاب ─────────────────────────────────────────────────

export async function showEvent(ctx: Context): Promise<void> {
  try {
    const { event } = await api.event(tgId(ctx))
    await show(ctx, eventText(event), eventKeyboard(event))
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function onChoose(ctx: Context, eventId: string, idx: number): Promise<void> {
  try {
    const { outcome } = await api.choose(tgId(ctx), eventId, idx)
    await outcomeShow(ctx, outcomeText(outcome))
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 💼 کار / 😴 استراحت / عملیات‌ها ─────────────────────────────────────────

export async function doWork(ctx: Context): Promise<void> {
  await runAction(ctx, "work", {})
}

export async function doRest(ctx: Context): Promise<void> {
  await runAction(ctx, "rest", {})
}

async function runAction(ctx: Context, action: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), action, payload)
    await outcomeShow(ctx, actionText(res))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** نمای نتیجه + «🧭 بعدی: …» (طراحیِ جلسه‌ی V4) — فقط در خصوصی.
 *  V16-3: از showOutcome می‌رود — نتیجه‌ی متنیِ پیاپی، همان پیامِ نتیجه‌ی قبلی
 *  را جایگزین می‌کند (ضدِ چین‌شدنِ کارت — ممیزی §4-⑷).
 *  V17-W3 (W3-F8): پارامترِ extras — دکمه‌های بافتی (مثلِ «🛍 بازار» بعد از خرید)
 *  کنارِ «🧭 بعدی» و «↩ خانه»؛ بدونِ extras رفتار بایت‌به‌بایت همانِ قبل است. */
async function outcomeShow(ctx: Context, text: string, extras?: { label: string; data: string }[]): Promise<void> {
  if (!isPrivate(ctx)) {
    await show(ctx, text, backKeyboard())
    return
  }
  const g = await fetchGuide(tgId(ctx))
  const na = g?.nextActions[0]
  if (!na) {
    const kb0 = new InlineKeyboard()
    for (const b of extras ?? []) kb0.text(clampText(b.label, 30), b.data).primary().row()
    kb0.text("↩ خانه", CB.menu).primary()
    await showOutcome(ctx, text, kb0)
    return
  }
  const full = `${text}\n${SEP}\n🧭 <b>بعدی:</b> ${na.icon} ${esc(clampText(na.title, 48))}`
  const kb = new InlineKeyboard()
  kb.text(`🧭 ${clampText(na.actionLabel || na.title, 30)}`, CB.nextGo).primary().row()
  for (const b of extras ?? []) kb.text(clampText(b.label, 30), b.data).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  await showOutcome(ctx, full, kb)
}

// ─── 👤 من ۲.۰ / 📜 تاریخچه ──────────────────────────────────────────────────

export async function showProfile(ctx: Context): Promise<void> {
  try {
    const p = await api.profile(tgId(ctx))
    const g = await fetchGuide(tgId(ctx)) // زمینه‌های V4؛ اگر نبود، نمای قدیمی‌تر
    await show(ctx, withHint(profileText(p, g), "profile"), profileKeyboard(p.player))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** 🏆 دستاوردها — کارتِ عمیقِ پروفایل (V16-4، ممیزی ⑱: دستاورد فقطِ مینی‌اپ بود).
 *  داده از همان ProfileResponse می‌آید (باز‌شده‌ها + achievementsTotalِ افزایشی)؛
 *  قواعد در کدکسِ راهنما (دسته‌یِ مأموریت‌ها و دستاوردها) — تناقضی آموزش نمی‌دهد. */
export async function showAchievements(ctx: Context): Promise<void> {
  try {
    const p = await api.profile(tgId(ctx))
    await show(ctx, achievementsText(p), achievementsKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function showHistory(ctx: Context): Promise<void> {
  try {
    const p = await api.profile(tgId(ctx))
    await show(ctx, historyText(p), backKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🏙 شهر (خصوصی) / سفر ────────────────────────────────────────────────────

export async function showCity(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    await show(ctx, withHint(cityText(snapshot), "city"), cityKeyboard(snapshot.player.district))
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function doTravel(ctx: Context, district: string): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), "travel", { district })
    await answer(ctx, `✅ ${res.message}`) // توست
    await show(ctx, withHint(cityText(res.snapshot), "city"), cityKeyboard(res.snapshot.player.district))
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🎒 کیف / 🐾 حیوان‌ها (V6 — تعاملی) ──────────────────────────────────────

/** قیمتِ فروشِ فوریِ آیتم‌ها (۶۰٪ قیمتِ روز) از بازار — برای برچسب‌های کیف */
async function sellPrices(telegramId: string): Promise<Map<string, number>> {
  try {
    const m = await api.market(telegramId)
    return new Map(m.prices.map((p) => [p.itemKey, Math.max(1, Math.round(p.current * 0.6))]))
  } catch {
    return new Map() // بازار جواب نداد — بدونِ قیمت‌ها نمایش می‌دهیم
  }
}

/** 🎒 کیف — صفحه‌ی فعلی (V16-4، ممیزی ⑬: برشِ ۸تایی فقط بود). انبوهاری از
 *  پروفایل کامل می‌آید (موتور همه‌ی ردیف‌ها را می‌فرستد) — صفحه‌بندی صرفاً نمایشی. */
export async function showItems(ctx: Context, page = 0): Promise<void> {
  typing(ctx) // V12 — پروفایل + بازار: دو فراخوانیِ موازیِ موتور؛ بازخوردِ فوری
  try {
    const [p, prices] = await Promise.all([api.profile(tgId(ctx)), sellPrices(tgId(ctx))])
    await show(
      ctx,
      withHint(bagText(p, prices, page), "bag"),
      bagKeyboard({ pets: p.pets, inventory: p.inventory, prices, page }),
    )
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function doFeedPet(ctx: Context, petId: string): Promise<void> {
  await petAction(ctx, "feedPet", petId)
}

export async function doPlayPet(ctx: Context, petId: string): Promise<void> {
  await petAction(ctx, "playPet", petId)
}

async function petAction(ctx: Context, action: "feedPet" | "playPet", petId: string): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), action, { petId })
    await answer(ctx, `✅ ${res.message}`) // توست
    // تازه‌سازی نمای کیف (گرسنگی و حالِ حیوان)
    try {
      const [p, prices] = await Promise.all([api.profile(tgId(ctx)), sellPrices(tgId(ctx))])
      await show(ctx, withHint(bagText(p, prices), "bag"), bagKeyboard({ pets: p.pets, inventory: p.inventory, prices }))
    } catch {
      /* تازه‌سازی نشد؛ توست کافی بود */
    }
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── V6 — 💳 بدهی / 🏷 عنوان‌ها / 💼 شغل‌ها / 🏪 بازار / 🔔 خبرها / 🎲 بینگو ───

/** 💳 /debt — مبلغِ بدهی + دکمه‌های پرداخت */
export async function showDebt(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    if (snapshot.player.debt <= 0) {
      await show(ctx, "💳 <b>بدهی</b>\n\nبدهی نداری. <i>این هم یه اتفاق است.</i>", backKeyboard())
      return
    }
    await show(ctx, debtText(snapshot), debtKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

/** پرداختِ بدهی — «همه» یعنی هرچقدر جیب اجازه بدهد (موتور خودش clamp می‌کند) */
export async function doPayDebt(ctx: Context, amount: number | "all"): Promise<void> {
  await runAction(ctx, "payDebt", { amount: amount === "all" ? 1_000_000_000 : amount })
}

/** 🏷 /titles — عنوان‌های مالکیت‌شده + فعال‌سازی */
export async function showTitles(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    await show(ctx, titlesText(snapshot.player), titlesKeyboard(snapshot.player))
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function doSetTitle(ctx: Context, titleKey: string): Promise<void> {
  await runAction(ctx, "setTitle", { titleKey })
}

/** 💼 /jobs — کاتالوگِ شغل‌ها + شغلِ فعلی + قفلِ سطح */
export async function showJobs(ctx: Context): Promise<void> {
  try {
    const [cat, snap] = await Promise.all([api.catalog(tgId(ctx)), api.state(tgId(ctx))])
    await show(ctx, jobsText(cat, snap.snapshot.player), jobsKeyboard(cat.jobs, snap.snapshot.player))
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function doSetJob(ctx: Context, jobKey: string): Promise<void> {
  await runAction(ctx, "setJob", { jobKey })
}

export async function doQuitJob(ctx: Context): Promise<void> {
  await runAction(ctx, "quitJob", {})
}

/** 🏪 /market — مغازه‌ی محله + آگهی‌های مردم + خرید + فهرست‌کردن/پس‌گرفتن (V16-4) */
export async function showMarket(ctx: Context): Promise<void> {
  try {
    const m = await api.market(tgId(ctx))
    await show(ctx, withHint(marketText(m), "market"), marketKeyboard(m))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** خریدِ یک آگهی — V17-W3 (W3-F8): خرید هم مثلِ کار/قمار/استراحت کارتِ نتیجه
 *  (پیام + طعم + دلتاها) + «🧭 بعدی» می‌گیرد؛ دکمه‌ی بافتیِ «🛍 بازار» برای
 *  ادامه‌ی خرید؛ کارتِ بازار با فشردنش تازه می‌شود (همان m:market). */
export async function doBuy(ctx: Context, listingId: string): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), "buyItem", { listingId })
    await outcomeShow(ctx, actionText(res), [{ label: "🛍 بازار", data: CB.market }])
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🛍 فهرست‌کردن در بازار (V16-4 — ممیزی ⑰: createListing/cancelListing فقطِ مینی‌اپ بود) ──
// همان اکشن‌های معتبرِ موتور، از همان مسیر (POST /api/game/action با کلیدِ سرویس) —
// صفر منطقِ تازه‌ی بازی؛ ربات فقط انتخاب‌گرِ تلگرامیِ قیمت/جنس است (۳ گام).

/** گامِ ۱ — جنس‌های قابلِ‌فروشِ کیف (قابلِ‌معامله، غیرِقفل، غیرِعلاقه‌مندی، تنِ تو نیست) */
export async function showMarketSell(ctx: Context): Promise<void> {
  typing(ctx)
  try {
    const [p, m] = await Promise.all([api.profile(tgId(ctx)), api.market(tgId(ctx))])
    const prices = new Map(m.prices.map((pr) => [pr.itemKey, pr.current]))
    const sellable = p.inventory
      .filter((i) => i.quantity > 0 && i.tradable && !i.equipped && !i.favorite && !i.locked)
      .slice(0, 8)
      .map((i) => ({ ...i, reference: prices.get(i.itemKey) ?? null }))
    await show(ctx, marketSellText(sellable), marketSellKeyboard(sellable))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** گامِ ۲ — کارتِ قیمت: مرجعِ روزِ بازار + سه پیشنهاد (0.9x/1.0x/1.1x، کفِ 1) */
export async function showMarketPrice(ctx: Context, itemKey: string): Promise<void> {
  typing(ctx)
  try {
    const [p, m] = await Promise.all([api.profile(tgId(ctx)), api.market(tgId(ctx))])
    const item = p.inventory.find((i) => i.itemKey === itemKey && i.quantity > 0)
    if (!item || !item.tradable || item.favorite || item.locked) {
      await answer(ctx, "این دیگر قابلِ فهرست‌کردن نیست — کیف را تازه کن.")
      await showMarketSell(ctx)
      return
    }
    const row = m.prices.find((pr) => pr.itemKey === itemKey)
    const reference = row?.current ?? row?.base ?? null
    const suggestions = reference ? suggestedPrices(reference) : [50, 100, 200]
    await show(ctx, marketPriceText(item, reference, suggestions), marketPriceKeyboard(itemKey, suggestions))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** گامِ ۳ — تأیید: آگهی با همین قیمت (1 عدد) — همان createListing مینی‌اپ.
 *  V17-W3 (W3-F8): نتیجه با همان گرامرِ یکسان — کارتِ نتیجه + «🧭 بعدی» + «🛍 بازار». */
export async function doMarketListAt(ctx: Context, itemKey: string, price: number): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), "createListing", { itemKey, quantity: 1, price })
    await outcomeShow(ctx, actionText(res), [{ label: "🛍 بازار", data: CB.market }])
  } catch (e) {
    await fail(ctx, e)
  }
}

/** پس‌گرفتنِ آگهیِ خودم — همان cancelListing مینی‌اپ؛ جنس برمی‌گردد تو کیف.
 *  V17-W3 (W3-F8): همان گرامرِ نتیجه — کارتِ نتیجه + «🧭 بعدی» + «🛍 بازار». */
export async function doMarketCancel(ctx: Context, listingId: string): Promise<void> {
  try {
    const res = await api.action(tgId(ctx), "cancelListing", { listingId })
    await outcomeShow(ctx, actionText(res), [{ label: "🛍 بازار", data: CB.market }])
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🏠 خانه و وسیله (V17-3 — ممیزی ⑨: خرید خانه/وسیله فقطِ مینی‌اپ بود) ──────
// همان اکشن‌های معتبرِ موتور (buyHouse/buyVehicle) از همان مسیرِ همیشه —
// POST /api/game/action با کلیدِ سرویس؛ صفر منطقِ تازه‌ی بازی. سه گام:
// لیست (قیمتِ واقعی روی دکمه) ← تأیید (قیمتِ نهایی + جیبِ نوخوانده) ← اجرا.
// قیمتِ وسیله آینه‌ی موتور است: round(basePrice × economyIndex/100).

/** گامِ ۱ — کارتِ «🏠 خانه و وسیله» (دو لیستِ همان کارت، سوییچ با دکمه) */
export async function showLiving(ctx: Context, which: LivingWhich = "house"): Promise<void> {
  typing(ctx)
  try {
    const [cat, snap] = await Promise.all([api.catalog(tgId(ctx)), api.state(tgId(ctx))])
    const player = snap.snapshot.player
    const houses = cat.houses ?? []
    const vehicles = cat.vehicles ?? []
    const listHouses = houses
      .filter((h) => h.key !== (player.house?.key ?? "attic"))
      .map((h) => ({ key: h.key, name: h.name, emoji: h.emoji, price: h.price }))
    const listVehicles = vehicles
      .filter((v) => v.key !== player.vehicle?.key)
      .map((v) => ({ key: v.key, name: v.name, emoji: v.emoji, price: vehiclePriceOf(v.basePrice, cat.economyIndex) }))
    await show(
      ctx,
      withHint(livingText({ which, player, houses, vehicles, economyIndex: cat.economyIndex }), "living"),
      livingKeyboard({ which, houses: listHouses, vehicles: listVehicles }),
    )
  } catch (e) {
    await fail(ctx, e)
  }
}

/** گامِ ۲ — کارتِ تأیید: قیمتِ واقعی + جیبِ تازه‌خوانده + هزینه‌ی پیوسته.
 *  جیب که نکشد → دکمه‌ی «می‌خرم» نمی‌آید و خطِ صادقانه می‌ماند (الگوی بینگو) */
export async function showLivingBuy(ctx: Context, which: LivingWhich, key: string): Promise<void> {
  typing(ctx)
  try {
    const [cat, snap] = await Promise.all([api.catalog(tgId(ctx)), api.state(tgId(ctx))])
    const player = snap.snapshot.player
    if (which === "house") {
      const h = (cat.houses ?? []).find((x) => x.key === key)
      if (!h || h.key === (player.house?.key ?? "attic")) {
        await answer(ctx, "این خانه دیگر مالِ توست یا در فهرست نیست.")
        await showLiving(ctx, which)
        return
      }
      const affordable = player.money >= h.price
      const lines = [
        livingConfirmText({
          which,
          item: { name: h.name, emoji: h.emoji },
          price: h.price,
          money: player.money,
          tail: `اجاره‌ی روزانه‌اش ${chip(h.rent)} سکه · آسایش ${chip(h.comfort)} · امنیت ${chip(h.security)}`,
        }),
      ]
      lines.push(
        "",
        affordable
          ? "<i>«می‌خرم» پول را می‌برد و خانه‌ی فعلی‌ات را جابه‌جا می‌کند.</i>"
          : `🚫 جیب این را نمی‌کشد — ${chip("کار")} کن، بعد بیا.`,
      )
      await show(ctx, lines.join("\n"), livingConfirmKeyboard(which, key, affordable))
      return
    }
    const v = (cat.vehicles ?? []).find((x) => x.key === key)
    if (!v || v.key === player.vehicle?.key) {
      await answer(ctx, "این وسیله دیگر مالِ توست یا در فهرست نیست.")
      await showLiving(ctx, which)
      return
    }
    const price = vehiclePriceOf(v.basePrice, cat.economyIndex)
    const affordable = player.money >= price
    const lines = [
      livingConfirmText({
        which,
        item: { name: v.name, emoji: v.emoji },
        price,
        money: player.money,
        tail: v.quirk || v.description,
      }),
    ]
    lines.push(
      "",
      affordable
        ? "<i>«می‌خرم» پول را می‌برد و وسیله‌ی فعلی‌ات را جابه‌جا می‌کند.</i>"
        : `🚫 جیب این را نمی‌کشد — ${chip("کار")} کن، بعد بیا.`,
    )
    await show(ctx, lines.join("\n"), livingConfirmKeyboard(which, key, affordable))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** گامِ ۳ — تأییدشده (فقط lv:go از کارتِ تأیید): همان buyHouse/buyVehicle موتور.
 *  نتیجه = پیام + دلتاها + جیبِ تازه + «بعدی» راهنما (outcomeShow)؛ خطای موتور
 *  (پول کم / همین را داری) عیناً و بی‌واسطه می‌رسد. */
export async function doLivingBuy(ctx: Context, which: LivingWhich, key: string): Promise<void> {
  const engineAction = which === "house" ? "buyHouse" : "buyVehicle"
  const payload = which === "house" ? { houseKey: key } : { vehicleKey: key }
  try {
    const res = await api.action(tgId(ctx), engineAction, payload)
    const text = `${actionText(res)}\n💰 جیبِ الان: ${chip(res.snapshot.player.money)} سکه`
    await outcomeShow(ctx, text)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** 🔔 /notify — خبرهای خوانده‌نشده + «خواندم» */
export async function showNotify(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    await show(ctx, notifyText(snapshot), notifyKeyboard())
  } catch (e) {
    await fail(ctx, e)
  }
}

export async function doReadNotifications(ctx: Context): Promise<void> {
  await runAction(ctx, "readNotifications", {})
}

/** 🎲 /bingo — بینگوی مخرب: فقط شرط‌هایِ جیب‌ساز دکمه دارند + خطِ صادقانه (⑩) */
export async function showBingo(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    await show(ctx, withHint(bingoText(snapshot), "bingo"), bingoKeyboard(snapshot.player.money))
  } catch (e) {
    await fail(ctx, e)
  }
}

/** شرط — V16-3 (مأموریت §6C): ارزان یک‌ضرب، گران (۵۰۰۰) اول واخواهی.
 *  q:{stake}ِ قدیمی هم همین‌جا می‌افتد — کارت‌هایِ کهنه هم دیگر یک‌ضربِ ۵۰۰۰
 *  نمی‌فرستند. */
export async function doGamble(ctx: Context, stake: number): Promise<void> {
  if (stake >= BINGO_CONFIRM_STAKE) {
    await showGambleConfirm(ctx, stake)
    return
  }
  await runAction(ctx, "gamble", { stake })
}

/** کارتِ واخواهی — تأییدِ دومرحله‌ایِ شرطِ گران؛ جیبِ تازه‌خوانده‌شده،
 *  اگر در این فاصله کم آمد دکمه‌ی «بفرست» نمی‌آید (صداقت، نه دکمه‌ی مرجوع). */
async function showGambleConfirm(ctx: Context, stake: number): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    const p = snapshot.player
    const affordable = stake <= bingoCap(p.money)
    const lines = [
      "🎰 <b>واخواهی</b>",
      SEP,
      "",
      "این‌قدر توپ می‌ریزی؟ ضرش می‌خوره.",
      "",
      `🎲 شرط: <b>${chip(faNum(stake))} سکه</b> · 💰 جیبِ تو: ${chip(p.money)} سکه`,
    ]
    let kb: InlineKeyboard
    if (affordable) {
      lines.push("", SUB, "", "<i>«💥 بفرست» یعنی نفس‌ات را حبس کن — برگشتی ندارد.</i>")
      kb = bingoConfirmKeyboard(stake)
    } else {
      lines.push(
        "",
        SUB,
        "",
        `🚫 جیب دیگر نمی‌کشد — سقفِ الان ${chip(bingoCap(p.money))} سکه است. ${chip("کار")} کن، بعد بیا.`,
      )
      kb = new InlineKeyboard().text("🎲 بینگو", CB.bingo).danger().row().text("↩ خانه", CB.menu).primary()
    }
    await show(ctx, lines.join("\n"), kb)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** تأییدشده — فقط از کارتِ واخواهی (b:go:{stake})؛ این‌جا دیگر دریغ نیست */
export async function doGambleConfirmed(ctx: Context, stake: number): Promise<void> {
  await runAction(ctx, "gamble", { stake })
}

/** 🎒 عملیاتِ آیتمِ کیف — استفاده/پوشیدن/⭐/فروش؛ توست + تازه‌سازیِ کیف */
export async function doItemAction(
  ctx: Context,
  act: "use" | "eq" | "fav" | "sell",
  itemKey: string,
): Promise<void> {
  const engineAction = act === "use" ? "useItem" : act === "eq" ? "equipItem" : act === "fav" ? "favoriteItem" : "sellItem"
  try {
    const res = await api.action(tgId(ctx), engineAction, { itemKey })
    await answer(ctx, `✅ ${res.message}`) // توست
    await showItems(ctx) // تازه‌سازیِ کیف (موجودی/قیمت/حالت‌ها)
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── 🏙 «شهرِ ما» — گروه ─────────────────────────────────────────────────────

/** کیبوردِ گروهیِ V5 برای کارت‌های محلی (خبرنامه/برترین‌ها) → خانه‌ی شهرِ موتور + خصوصی */
function cityCardGroupKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  // V16-1 — برچسبِ بازگشتِ یکسانِ همه‌ی کارت‌های شهر: «↩ خانه» (واژه‌نامه‌ی قاعده‌مند)
  kb.text("↩ خانه", "gm:game").primary()
  kb.url("🔑 زندگی‌ات در خصوصی", privateLink(botUsername())).primary()
  return kb
}

/** /news — دیجست کامل شهر؛ بدون بازیکن هم کار می‌کند */
export async function sendNews(ctx: Context): Promise<void> {
  try {
    const cn = await api.citynews(isPrivate(ctx) ? tgId(ctx) : undefined)
    const kb = isPrivate(ctx) ? backKeyboard() : cityCardGroupKeyboard()
    await show(ctx, cityNewsText(cn), kb)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** /top — ۵ نفرِ برترِ شهر */
export async function sendTop(ctx: Context): Promise<void> {
  try {
    const cn = await api.citynews(isPrivate(ctx) ? tgId(ctx) : undefined)
    const kb = isPrivate(ctx) ? backKeyboard() : cityCardGroupKeyboard()
    await show(ctx, topText(cn), kb)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** m:status — نوار فشرده‌ی وضعیت شهر (کارت‌های قدیمی) */
export async function sendCityStatus(ctx: Context): Promise<void> {
  try {
    const cn = await api.citynews(isPrivate(ctx) ? tgId(ctx) : undefined)
    const kb = isPrivate(ctx) ? backKeyboard() : cityCardGroupKeyboard()
    await show(ctx, cityStatusText(cn), kb)
  } catch (e) {
    await fail(ctx, e)
  }
}

/** ریدایرکتِ نگاه‌های شخصی در گروه — با سقف ۱ در دقیقه برای هر چت */
const nudgeAt = new Map<number, number>()

async function nudge(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId !== undefined) {
    if ((nudgeAt.get(chatId) ?? 0) > Date.now() - 60_000) return
    nudgeAt.set(chatId, Date.now())
  }
  await show(ctx, "این‌جا شهر است — <i>زندگی‌ات خصوصیه 😉 برو خصوصی</i>", nudgeKeyboard(botUsername()))
}

/** /start در گروه — کارتِ خانه‌ی شهرِ موتور + خطِ «زندگی‌ات خصوصی است» */
function groupStart(ctx: Context): Promise<void> {
  return sendEngineCommand(ctx, "game", { privateNudge: true })
}

/** /gadmin در گروه (V13 Part 9) — کارتِ وضعیت/تنظیماتِ شهر از موتور؛ پرچمِ isAdmin
 *  فقط با تاییدِ زندهٔ getChatMember می‌رود (بدون کش — یک فرمان، یک تایید).
 *  غیرادمین همان کارت را فقط‌خواندنی می‌بیند (موتور تصمیم می‌گیرد). */
async function groupGadmin(ctx: Context): Promise<void> {
  const isAdmin = await verifyChatAdmin(ctx, String(ctx.chat?.id ?? ""), tgId(ctx), { cache: false })
  await sendEngineCommand(ctx, "gadmin", { isAdmin })
}

/** فرمان‌های شهر (/play /vote /projects /members /history …) در خصوصی — فقط
 *  راهنماییِ ناوبری. V15-2: عبارت‌های تازه‌ی هابِ ۱۲گانه‌ی شهر (V15-1) را هم
 *  معرفی می‌کند («دوئل‌ها»/«اقتصاد»/«افتخارات») و دکمه‌ی برگشت به خانه دارد. */
async function cityCommandsInPrivate(ctx: Context): Promise<void> {
  const lines = [
    "🏙 <b>این بخش مالِ شهرِ گروه است</b>",
    "",
    SEP,
    "",
    "ربات را به یک گروه دعوه کن تا جهانِ مشترک زنده شود — بعد همان‌جا این‌ها را بگو:",
    "",
    `🎲 ${chip("بازی‌های گروه")} · 🗳 ${chip("رأی‌گیری")} · ⚖️ ${chip("دادگاه")} · 🏗 ${chip("پروژه‌ها")}`,
    `👥 ${chip("بازیکن‌ها")} · 📜 ${chip("تاریخچه")} · 🏙 ${chip("وضعیت شهر")}`,
    `⚔️ ${chip("دوئل‌ها")} · 💰 ${chip("اقتصاد")} · 🏆 ${chip("افتخارات")}`,
    "",
    "در گروه، دکمه‌ی «منو» کارتِ شهر را با هر 12 بخشِش باز می‌کند.",
  ]
  const kb = new InlineKeyboard()
  if (MINIAPP_URL) kb.url("📱 Femboy War", MINIAPP_URL).primary()
  kb.text("↩ خانه", CB.menu).primary()
  await show(ctx, lines.join("\n"), kb)
}

// ─── /help — کدکسِ تعاملیِ خصوصی (V15-2؛ مأموریت §6) ─────────────────────────
// یک پیامِ عظیمِ ایستا جوابِ این مأموریت نیست — راهنما «سیستمِ ناوبری» است:
// کارتِ خانه با دسته‌های زنده‌ی موتور باز می‌شود (15 دسته × 111 موضوع) و
// بقیه‌اش با دکمه‌های hp: درجا ویرایش می‌شود (help.ts). «قدمِ بعدی» (guide)
// جداست — توصیه‌گرِ قدمِ بعدیِ بافتاری، نه کدکس.

export async function handleHelp(ctx: Context): Promise<void> {
  await showHelpHome(ctx)
}

// ─── ⚙ حساب (V16-3 — ممیزی: «تنظیمات» تکرارِ «من» بود؛ §4: تجمیع) ──────────────
// «👤 من» = پروفایلِ زنده (آمار/دارایی/بدهی)؛ «⚙ حساب» = هویت + تنظیم‌هایِ واقعی.
// آماری که «من» نشان می‌دهد این‌جا تکرار نمی‌شود — کارتِ حساب فقط هویت،
// تنظیم‌ها، آموزش و یک خطِ داده/حریم را می‌دهد. همه‌چیز از snapshotِ واقعی است.

/** کارتِ حساب — هویت (نام/آواتار/شناسه‌ها) + تنظیم‌هایِ واقعی + آموزش + داده‌ها.
 *  ویرایشِ نام و آواتارِ «بازیکن» در مینی‌اپ است (V16-2: من ← تنظیمات)؛ تغییرِ
 *  نامِ «فمبوی» در هابِ فمبوی (fw:rename). */
export async function showSettings(ctx: Context): Promise<void> {
  try {
    const { snapshot } = await api.state(tgId(ctx))
    const p = snapshot.player
    const avatar = p.avatar ? `${esc(p.avatar)} ` : ""
    const lines = [
      "⚙ <b>حساب</b>",
      SEP,
      "",
      `👤 ${avatar}<b>${esc(p.name)}</b> — بازیکنِ این شهر`,
      `🔑 تلگرام: ${chip(tgId(ctx))}`,
      `🆔 بازیکن: ${chip(p.id)}`,
      "",
      SUB,
      "",
      "تنظیم‌هایِ واقعی:",
      `🏷 ${chip("عنوان‌ها")} · 💼 ${chip("شغل‌ها")} · 🎀 ${chip("پیمان فمبوی")}`,
      ...(MINIAPP_URL ? ["✏️ ویرایشِ نام و آواتار: مینی‌اپ ← «من» ← «تنظیمات»"] : []),
      "",
      SUB,
      "",
      "🔒 داده‌هایِ تو فقط همین شهر را زنده نگه می‌دارند — نام، پیشرفت و شناسه‌ی تلگرام؛ چیزی با هیچ‌کس تقسیم نمی‌شود.",
    ]
    const kb = new InlineKeyboard()
    kb.text("🎓 آموزش", "hp:c:start").primary()
    kb.text("📖 راهنما", CB.help).primary().row()
    kb.text("🏷 عنوان‌ها", CB.titles).primary()
    kb.text("💼 شغل‌ها", CB.jobs).primary().row()
    if (MINIAPP_URL) kb.webApp("✏️ ویرایش نام و آواتار", MINIAPP_URL).primary().row()
    kb.text("👤 من", CB.me).primary()
    kb.text("↩ خانه", CB.menu).primary()
    await show(ctx, lines.join("\n"), kb)
  } catch (e) {
    await fail(ctx, e)
  }
}

// ─── مسیریاب callback + فرمان‌ها ─────────────────────────────────────────────

async function dispatch(ctx: Context, cb: Callback): Promise<void> {
  switch (cb.kind) {
    case "menu":
      return sendHome(ctx)
    case "event":
      return showEvent(ctx)
    case "me":
      return showProfile(ctx)
    case "city":
      return showCity(ctx)
    case "items":
      return showItems(ctx)
    case "history":
      return showHistory(ctx)
    case "work":
      return doWork(ctx)
    case "rest":
      return doRest(ctx)
    case "guide":
      return showGuide(ctx)
    case "goals":
      return showGoals(ctx)
    case "ops":
      return showOps(ctx)
    case "dreams":
      return showDreams(ctx)
    case "news":
      return sendNews(ctx)
    case "top":
      return sendTop(ctx)
    case "status":
      return sendCityStatus(ctx)
    case "rand":
      return onRandomPick(ctx)
    case "nextGo":
      return onNextGo(ctx)
    case "retry":
      return onRetry(ctx)
    // V6 — نمای‌های تازه
    case "debt":
      return showDebt(ctx)
    case "titles":
      return showTitles(ctx)
    case "jobs":
      return showJobs(ctx)
    case "market":
      return showMarket(ctx)
    case "notify":
      return showNotify(ctx)
    case "bingo":
      return showBingo(ctx)
    case "claim":
      return doClaimOpportunity(ctx, cb.opportunityId)
    case "choose":
      return onChoose(ctx, cb.eventId, cb.idx)
    case "travel":
      return doTravel(ctx, cb.district)
    case "feed":
      return doFeedPet(ctx, cb.petId)
    case "play":
      return doPlayPet(ctx, cb.petId)
    // V6 — عملیات‌های تازه
    case "item":
      return doItemAction(ctx, cb.act, cb.itemKey)
    case "setTitle":
      return doSetTitle(ctx, cb.titleKey)
    case "setJob":
      return doSetJob(ctx, cb.jobKey)
    case "quitJob":
      return doQuitJob(ctx)
    case "buy":
      return doBuy(ctx, cb.listingId)
    case "gamble":
      return doGamble(ctx, cb.stake)
    // V16-3 — تأییدشده‌ی واخواهی (b:go:{stake}) — فقط از کارتِ تأیید
    case "gambleGo":
      return doGambleConfirmed(ctx, cb.stake)
    case "payDebt":
      return doPayDebt(ctx, cb.amount)
    case "readNotifications":
      return doReadNotifications(ctx)
    // V15-2 — کدکسِ خصوصی · حساب و تنظیمات · شهرِ گروهی (کارتِ ناوبری)
    case "help":
      return showHelpHome(ctx)
    case "settings":
      return showSettings(ctx)
    case "groupCity":
      return cityCommandsInPrivate(ctx)
    // V16-4 — دستاوردها · فروش در بازار · صفحه‌ی کیف
    case "achievements":
      return showAchievements(ctx)
    case "marketSell":
      return showMarketSell(ctx)
    case "marketPrice":
      return showMarketPrice(ctx, cb.itemKey)
    case "marketListAt":
      return doMarketListAt(ctx, cb.itemKey, cb.price)
    case "marketCancel":
      return doMarketCancel(ctx, cb.listingId)
    case "bagPage":
      return showItems(ctx, cb.page)
    // V17-3 — خانه و وسیله: لیست · تأیید · اجرا (فقط از کارتِ تأیید)
    case "living":
      return showLiving(ctx, cb.which)
    case "livingBuy":
      return showLivingBuy(ctx, cb.which, cb.key)
    case "livingGo":
      return doLivingBuy(ctx, cb.which, cb.key)
  }
}

function wrap(fn: (ctx: Context) => Promise<void>) {
  return async (ctx: Context): Promise<void> => {
    try {
      // run() این اکشن را به‌عنوان «آخرین اکشن» ثبت می‌کند تا «🔄 دوباره» کار کند
      await run(ctx, fn)
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`handler: ${stats.lastError}`)
      try {
        await ctx.reply(`⚠️ ${GENERIC}`, { parse_mode: "HTML", reply_markup: errorKeyboard() })
      } catch {
        /* چت در دسترس نیست */
      }
    }
  }
}

// فرمان‌ها — دو حالتی: خصوصی = زندگیِ من، گروه = شهرِ زنده‌ی موتور (یا ریدایرکت)
function dual(privateFn: (ctx: Context) => Promise<void>, groupFn?: (ctx: Context) => Promise<void>) {
  return async (ctx: Context): Promise<void> => {
    if (isGroupChat(ctx)) {
      if (groupFn) return groupFn(ctx)
      return nudge(ctx)
    }
    return privateFn(ctx)
  }
}

// ─── V13 (Part IV §7-10) — مسیریابِ نیتِ بدونِ اسلش ──────────────────────────
// «منو» و «menu» و «راهنمای من»… بدونِ «/»، در خصوصی و گروه. منطقِ بازی تازه‌ای
// این‌جا نیست — نیت فقط به همان هندلری می‌رسد که فرمانِ متناظرش می‌رسد.
//
// اولویت‌ها (§9): ① جریانِ متنیِ فعال (soulTextGuard — قبل از این لایه) ② فرمان‌های
// اسلش ③ نیت‌های شناخته‌شده (این لایه) ④ ناظرِ حضورِ گروه ⑤ گفت‌وگوی عادی = سکوت.
//
// قانونِ ضدِهijack گروه (§16): بدونِ آدرس‌دهی (منشن/ریپلایِ ربات) فقط عبارت‌های
// «باز» و عینِ کامل جواب می‌گیرند — جمله‌ای که فقط کلمه‌ی بازی را دارد، فرمان نیست.

/** مسیرِ خصوصیِ هر نیت — همان هندلرِ فرمانِ متناظر (typing + «🔄 دوباره» از run) */
const PRIVATE_INTENT: Record<IntentId, (ctx: Context) => Promise<void>> = {
  menu: sendHome,
  start: handleStart,
  help: handleHelp,
  guide: showGuide,
  femboy: handleFemboyCommand,
  myfemboy: handleMyFemboyCommand,
  profile: showProfile,
  city: showCity,
  status: showCity,
  events: showEvent,
  players: cityCommandsInPrivate,
  leaderboard: sendTop,
  inventory: showItems,
  work: doWork,
  rest: doRest,
  champ: handleChampCommand,
  news: sendNews,
  games: cityCommandsInPrivate,
  cancel: cancelNoFlow,
  back: sendHome,
  duel: handleDuelCommand,
  goals: showGoals,
  ops: showOps,
  dreams: showDreams,
  market: showMarket,
  jobs: showJobs,
  debt: showDebt,
  titles: showTitles,
  notify: showNotify,
  bingo: showBingo,
  vote: cityCommandsInPrivate,
  court: cityCommandsInPrivate,
  projects: cityCommandsInPrivate,
  history: cityCommandsInPrivate,
  gadmin: cityCommandsInPrivate,
  // V15-2 — فرمان‌های تازه‌ی هابِ شهر (V15-1): در خصوصی معادلِ شخصیِ موجود،
  // نه فیچرِ خصوصیِ تازه — «دوئل‌ها» → راهنمای دوئل، «اقتصاد» → بازارِ شخصی،
  // «افتخارات» → تالارِ خودِ ربات (تخته‌های fwh:)
  duels: handleDuelCommand,
  economy: showMarket,
  fame: handleChampCommand,
  // V16-4 — «دستاوردها» شخصی است: کارتِ دستاوردهای خودِ بازیکن (ممیزی ⑰).
  // «تالار»/«تالارِ افتخارات» همچنان روی champ‌اند؛ «افتخارات» هم‌چنان fame.
  achievements: showAchievements,
}

/** مسیرِ گروهیِ هر نیت — فرمان‌های شهر از موتور؛ شخصی‌ها → دعوت به خصوصی */
async function routeGroupIntent(ctx: Context, id: IntentId): Promise<void> {
  switch (id) {
    case "menu":
    case "start":
    case "back":
      return sendEngineCommand(ctx, "game", id === "start" ? { privateNudge: true } : {})
    case "help":
      return sendEngineCommand(ctx, "help")
    case "city":
    case "status":
      return sendEngineCommand(ctx, "city")
    case "events":
      return sendEngineCommand(ctx, "event")
    case "players":
      return sendEngineCommand(ctx, "members")
    case "games":
      return sendEngineCommand(ctx, "play")
    case "leaderboard":
      return sendTop(ctx)
    case "champ":
      return handleChampCommand(ctx)
    case "news":
      return sendNews(ctx)
    case "femboy":
      return handleFemboyCommand(ctx)
    case "myfemboy":
      return handleMyFemboyCommand(ctx)
    case "duel":
      // §2 مثالِ مأموریت — «جنگ فمبوی» = دوئل؛ هدف با ریپلای/تک‌مِشن حل می‌شود،
      // بدونِ هدف → کارتِ راهنمای موتور
      return handleDuelCommand(ctx)
    // V15-2 — سه فرمانِ تازه‌ی موتور (hub.ts): عبارت‌های گروهی → کارتِ شهر
    case "duels":
      return sendEngineCommand(ctx, "duels")
    case "economy":
      return sendEngineCommand(ctx, "economy")
    case "fame":
      // «تالار»/«تالار افتخارات» روی champ می‌مانند (کارتِ تالارِ خودِ ربات)؛
      // «افتخارات»/«دستاوردها» کارتِ شهرمحورِ موتور را می‌گیرد (تخته‌های
      // gm:fame + دستاوردهای همین گروه) — هر دو واقعی‌اند، انتخابِ آگاهانه.
      return sendEngineCommand(ctx, "fame")
    // V16-4 — «دستاوردها» در گروه همان کارتِ شهرِ دیروز است (دستاوردهای شهر +
    // تالار)؛ کارتِ شخصی‌اش مالِ پیوی است (§17: تمایزِ مشترک/شخصی)
    case "achievements":
      return sendEngineCommand(ctx, "fame")
    case "vote":
      return sendEngineCommand(ctx, "vote")
    case "court":
      return sendEngineCommand(ctx, "court")
    case "projects":
      return sendEngineCommand(ctx, "projects")
    case "history":
      return sendEngineCommand(ctx, "history")
    case "gadmin":
      return groupGadmin(ctx)
    case "cancel":
      await ctx.reply("چیزی برای لغو در جریان نیست — دعوت‌نامه‌ها دکمه‌ی لغوی خودش را دارند.")
      return
    default:
      // شخصی (guide/profile/inventory/work/rest) — در گروه فقط راه خصوصی
      return nudge(ctx)
  }
}

/** «لغو» بدونِ جریانِ فعال — کوتاه و بی‌سروصدا */
async function cancelNoFlow(ctx: Context): Promise<void> {
  await show(ctx, "چیزی برای لغو در جریان نیست.", backKeyboard())
}

/** مسیریابِ اصلی — true = مصرف شد (زنجیره همین‌جا تمام) · false = ربطی نداشت */
async function routeIntent(ctx: Context): Promise<boolean> {
  const raw = ctx.message?.text
  if (!raw || raw.startsWith("/")) return false // فرمان‌ها مسیرِ خودشان را دارند
  const group = isGroupChat(ctx)

  // گروه: آدرس‌دهی = منشن یا ریپلایِ به ربات (منشن از متن کنار می‌رود تا عبارت عین بماند)
  let addressed = false
  let text = raw
  if (group) {
    const uname = botUsername().toLowerCase()
    if (uname) {
      const at = `@${uname}`
      if (text.toLowerCase().includes(at)) {
        addressed = true
        text = text.replace(new RegExp(`${at}`, "gi"), " ")
      }
    }
    const reply = ctx.message?.reply_to_message
    if (
      Boolean(reply) &&
      (reply?.from?.id === ctx.me.id || isBotMessage(ctx.chat?.id, reply?.message_id))
    ) {
      addressed = true
    }
  }

  const hit = resolveIntent(text)
  if (!hit) {
    // آدرس‌دهی بدونِ نیت → راهنمایِ کوتاهِ عبارت‌ها (§9: انتخاب، نه حدس) — با ضدسیل
    if (group && addressed && admitTextCommand(ctx)) {
      await ctx.reply(INTENT_HINT)
      return true
    }
    return false
  }
  // عبارتِ «شخصی» در گروهِ بی‌آدرس → سکوت (هijack ممنوع)؛ در خصوصی آزاد
  if (group && !addressed && !hit.open) return false
  // ضدسیل — نیتِ اجراشده همان قاعده‌ی فرمان‌ها را دارد (≥ ۲ ثانیه، ردِ بی‌صدا)
  if (!admitTextCommand(ctx)) return true

  stats.hears++
  if (!group) {
    await run(ctx, PRIVATE_INTENT[hit.id])
  } else {
    await routeGroupIntent(ctx, hit.id)
  }
  return true
}

export function registerBot(bot: Bot): void {
  // V13 (§8) — حذفِ تکرارِ آپدیت‌ها: نخستین لایه، قبل از هر شمردن و مسیریابی.
  // تلگرام گاهی یک update را دوبار می‌رساند؛ دوباره = ردِ بی‌صدا (نه فرمان، نه
  // کال‌بک، نه member_left دوباره — پاداش/گذارهای شرطی موتور هم‌جنان محکم‌اند).
  bot.use((ctx, next) => {
    if (isDuplicateUpdate(ctx.update.update_id)) return
    return next()
  })

  // شمارنده‌ی مرکزی آپدیت‌ها و فرمان‌ها (قبل از هر هندلری)
  bot.use((_ctx, next) => {
    stats.updates++
    stats.lastUpdateAt = new Date()
    return next()
  })
  bot.use((ctx, next) => {
    const text = ctx.message?.text
    if (text?.startsWith("/")) {
      stats.commands++
      bumpCommand(text) // V6 — تفکیکِ فرمان‌ها برای health
      // V13 (§6.4/§17) — ضدسیلِ فرمان‌ها: ≥ ۲ ثانیه بینِ دو فرمان برای هر
      // کاربر در هر چت؛ نقض = ردِ بی‌صدا (هیچ فراخوانیِ موتور، هیچ کارتی)
      if (!admitCommand(ctx)) return
    }
    rememberUser(ctx.from) // V7 — @username → id برای /duel @حریف
    return next()
  })

  // چرخه‌ی حیاتِ ربات در گروه (V13) — پیام‌های سرویس‌اند، فرمان نیستند
  bot.on("message:new_chat_members", wrap(onGroupNewMembers))
  bot.on("message:left_chat_member", wrap(onGroupLeftMember))
  // my_chat_member — منبعِ تضمینیِ افزودن/اخراجِ خودِ ربات (§6.4/§8)
  bot.on("my_chat_member", wrap(onMyChatMember))

  // ── فرمان‌ها ──
  // خصوصی = زندگیِ من · گروه = فرمان‌های شهرِ زنده از موتورِ V5 (یا ریدایرکت)
  bot.command("start", wrap(dual(handleStart, groupStart)))
  // V12 — /game («شروعِ شهر» در منوی گروه): خصوصی = پیشخوان (مثل /menu) ·
  // گروه = کارتِ خانه‌ی شهرِ موتور + خطِ خصوصی (همان رفتارِ /start در گروه)
  bot.command("game", wrap(dual(sendHome, groupStart)))
  bot.command("menu", wrap(dual(sendHome, (ctx) => sendEngineCommand(ctx, "game"))))
  // V13 (Part 9) — تنظیماتِ شهر: خصوصی = راهنمای فرمان‌های شهر · گروه = کارتِ ادمین
  bot.command("gadmin", wrap(dual(cityCommandsInPrivate, groupGadmin)))
  bot.command("guide", wrap(dual(showGuide)))
  bot.command("goals", wrap(dual(showGoals)))
  bot.command("ops", wrap(dual(showOps)))
  bot.command("dreams", wrap(dual(showDreams)))
  bot.command("me", wrap(dual(showProfile)))
  bot.command("city", wrap(dual(showCity, (ctx) => sendEngineCommand(ctx, "city"))))
  bot.command("status", wrap(dual(showCity, (ctx) => sendEngineCommand(ctx, "city"))))
  bot.command("items", wrap(dual(showItems)))
  bot.command("event", wrap(dual(showEvent, (ctx) => sendEngineCommand(ctx, "event"))))
  bot.command("work", wrap(dual(doWork)))
  bot.command("rest", wrap(dual(doRest)))
  // V6 — نمای‌های تازه‌ی زندگیِ من (خصوصی؛ در گروه → ریدایرکت به خصوصی)
  bot.command("debt", wrap(dual(showDebt)))
  bot.command("titles", wrap(dual(showTitles)))
  bot.command("jobs", wrap(dual(showJobs)))
  bot.command("market", wrap(dual(showMarket)))
  bot.command("notify", wrap(dual(showNotify)))
  bot.command("bingo", wrap(dual(showBingo)))
  bot.command("news", wrap(sendNews))
  bot.command("top", wrap(sendTop))
  // V7/V8 — فمبویِ روح‌بسته: خصوصی = پیمان/هابِ کامل · گروه = هابِ جمع‌وجور (+ هدف: کارتِ عمومی)
  bot.command("femboy", wrap(handleFemboyCommand))
  // V8 — کارتِ عمومیِ فمبویِ خود (خصوصی: هابِ کامل · گروه: نمایشِ عمومی)
  bot.command("myfemboy", wrap(handleMyFemboyCommand))
  // V7 — دوئلِ گروهی (در خصوصی فقط راهنما)
  bot.command("duel", wrap(handleDuelCommand))
  // V7 — تالارِ افتخارات (گروه + خصوصی)
  bot.command("champ", wrap(handleChampCommand))
  bot.command("help", wrap(dual(handleHelp, (ctx) => sendEngineCommand(ctx, "help"))))
  // فرمان‌های شهرِ زنده (V5/V6) — در گروه کارتِ موتور، در خصوصی فقط راهنماییِ ناوبری
  bot.command("play", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "play"))))
  bot.command("vote", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "vote"))))
  // V6 — دادگاهِ شهر (موتورِ گروه پرونده را باز می‌کند؛ کارتِ رأی از outbox می‌رسد)
  bot.command("court", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "court"))))
  bot.command("projects", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "projects"))))
  bot.command("members", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "members"))))
  bot.command("history", wrap(dual(cityCommandsInPrivate, (ctx) => sendEngineCommand(ctx, "history"))))

  // ── V7/V8 — ورودیِ آزادِ پیمانِ فمبوی (اسمِ فمبوی) — قبل از همه‌ی متن‌های آزاد ──
  // فقط وقتی برای این چتِ خصوصی حالتِ «اسم» در انتظار است مصرفش می‌کنیم؛
  // V13 (Part IV §9): جریانِ متنیِ فعال مقدم بر نیت‌ها و ناظر است («لغو» = انصرافِ جریان).
  bot.on("message:text", async (ctx, next) => {
    try {
      if (await soulTextGuard(ctx)) return // مصرف شد — اسمِ فمبوی
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`soul text: ${stats.lastError}`)
    }
    await next()
  })

  // ── V13 (Part IV §7-10) — مسیریابِ نیتِ بدونِ اسلش ──
  // «منو» / «menu» / «وضعیت شهر»… در خصوصی و گروه؛ عینِ عبارتِ نرمال‌شده، قطعی.
  // مصرف شد → زنجیره تمام؛ نیتِ نشناخته → ادامه به ناظر/سکوت.
  bot.on("message:text", async (ctx, next) => {
    try {
      if (await routeIntent(ctx)) return // مصرف شد — نیتِ شناخته‌شده
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`intent route: ${stats.lastError}`)
    }
    await next()
  })

  // ── ناظرِ شهرِ زنده (V5) — بعد از نیت‌ها ──
  // متنِ غیرفرمانیِ گروه به خط لوله‌ی حضورِ موتور می‌رود؛ ربات هرگز خودش جواب
  // نمی‌دهد — فقط اگر موتور بگوید (قانونِ ضداسپم)؛ زنجیره همیشه ادامه می‌یابد.
  bot.on("message:text", async (ctx, next) => {
    try {
      await observeGroupText(ctx)
    } catch {
      /* ناظر هرگز زنجیره را نمی‌شکند */
    }
    await next()
  })

  // ── دکمه‌های کیبوردِ ثابتِ خصوصی — از V13 بدونِ هندلرِ جدا ──
  // متنِ دقیقِ دکمه‌ها («🎀 فمبوی»، «🎲 اتفاق امروز»…) پس از نرمال‌سازی همین
  // نیت‌هاست؛ مسیریابِ بالا خودش می‌گیرد (ایموجی/نشانه در نرمال‌سازی فاصله می‌شود).

  // ── callback ها ──
  bot.on("callback_query", async (ctx) => {
    stats.callbacks++
    // V13 (§6.4/§17) — ضدسیلِ دکمه‌ها: ≥ ۳۰۰ میلی‌ثانیه بینِ دو کال‌بک برای هر
    // کاربر؛ نقض = توستِ «کمی آهسته‌تر 🐢» و هیچ فراخوانیِ موتور
    if (!admitCallback(ctx)) {
      await answer(ctx, SLOW_DOWN_TOAST)
      return
    }
    try {
      // لایه‌ی گروهِ V5: پیشوندهای موتورِ شهر (ge:/gg:/gv:/ru:/gp:/cit:/gm:/gc:/gs:)
      // فقط در گروه به موتور برمی‌گردند؛ خصوصی همان مسیرِ خودش را دارد.
      // gc: = دعوتِ دوئل · gs: = تنظیماتِ ادمین (ادمینِ زنده در group.ts تایید می‌شود).
      const data = ctx.callbackQuery.data ?? ""
      const cbChatType = ctx.callbackQuery.message?.chat?.type
      if (isGroupCallbackData(data) && (cbChatType === "group" || cbChatType === "supergroup")) {
        stats.groupCallbacks++
        await handleGroupCallback(ctx)
        return
      }
      // V7 — کال‌بک‌های فمبویِ روح‌بسته (fw:* fwa:* fwi:* fwk:* fwh:* fwt:* fwr:* fwsp:*)
      // خصوصی و گروه: تالار در گروه هم زنده است؛ بقیه به خصوصی هدایت می‌شوند.
      if (isSoulCallbackData(data)) {
        await run(ctx, () => handleSoulCallback(ctx, data))
        await answer(ctx)
        return
      }
      // V15-2 — کدکسِ خصوصی (hp:): مرورگرِ راهنما در پیوی — ناوبریِ درجا با
      // ویرایشِ همان پیام (show). در گروه راهنما مالِ gh: موتور است؛ hp: که در
      // گروه بیفتد = هijack پنلِ شخصیِ دیگری → دروازه‌ی guardOwnerPanel (V15-3 —
      // مأموریت §3A: توستِ «این پنل متعلق به بازیکن دیگری است.» + دکمه‌ی پنلِ
      // خودت؛ پیش از هر فراخوانیِ موتور، بدونِ جهشِ حالت).
      if (isHelpCallbackData(data)) {
        if (await guardOwnerPanel(ctx, { panel: "hp" })) return
        openPrivatePanel(ctx, { type: "hp", nav: data })
        await run(ctx, () => handleHelpCallback(ctx, data))
        await answer(ctx)
        return
      }
      const cb = parseCallback(data)
      if (!cb) {
        await answer(ctx)
        return
      }
      // در گروه فقط نگاه‌های شهری مجازند؛ بقیه = پنلِ شخصیِ مالک است که در گروه
      // فشرده شده → دروازه‌ی مالکیت (V15-3: guard به‌جای هدایتِ کلی — همان متنِ
      // مأموریت + دکمه‌ی نسخه‌ی خودت، بدونِ فراخوانیِ موتور)
      const chatType = ctx.callbackQuery.message?.chat?.type
      if (chatType && chatType !== "private") {
        const cityView = cb.kind === "news" || cb.kind === "top" || cb.kind === "status" || cb.kind === "retry"
        if (!cityView) {
          if (await guardOwnerPanel(ctx, { panel: cb.kind })) return
        }
      }
      // «🔄 دوباره» خودش در lastAction ثبت نمی‌شود — وگرنه تکرارِ پشتِ‌سرِ هم
      // به بازگشتِ بی‌نهایت (stack overflow) می‌رسید
      if (cb.kind === "retry") {
        await onRetry(ctx)
      } else {
        // V15-3 — مُهرِ هویتِ پنلِ شخصی (panels.ts): هر کال‌بکِ خصوصی پنلِ فعالِ
        // مالک را تازه می‌کند — تاپلِ «مالک+چت+پیام+نوع+ناوبری» (مأموریت §3A)
        openPrivatePanel(ctx, { type: cb.kind, nav: data })
        await run(ctx, () => dispatch(ctx, cb))
      }
    } catch (e) {
      bumpError(e instanceof Error ? e.message : String(e))
      log(`callback: ${stats.lastError}`)
      // توست — answer خودش تگ‌ها را می‌شوید و رقم‌ها را انگلیسی می‌کند (ui.toastText)
      await answer(ctx, GENERIC)
      return
    }
    await answer(ctx)
  })
}
