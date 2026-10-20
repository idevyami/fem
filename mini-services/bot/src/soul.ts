// FEMBOY WAR 🎀 V10 — لایه‌ی فمبویِ روح‌بسته (سول‌باند؛ V7 می‌نامیدش «همدم» — واژه‌ی منسوخ).
// تمام منطق در موتور (Next.js :3000) است؛ این فایل فقط نمایش + ناوبری است:
//   • /femboy  — خصوصی: پیمانِ فمبوی (انتخابِ کلاس با آرت → اسم → قفل) یا هابِ کامل
//                گروه: هابِ جمع‌وجور + لینکِ خصوصی · با هدف (ریپلای/منشن/عدد): کارتِ عمومیِ فمبویِ او
//   • /myfemboy — خصوصی: همان هابِ کامل · گروه: کارتِ عمومیِ امنِ فمبویِ خودِ بازیکن
//   • /duel    — دعوتِ دوئلِ گروهی (V13): ریپلای یا @username یا آیدیِ عددی → دعوت‌نامه‌ی
//                رضایتی از موتورِ شهر؛ جواب از دکمه‌های کارت می‌آید (gc:accept/decline/cancel)
//   • /champ   — تالارِ افتخارات (خصوصی + گروه) با سوییچِ تخته‌ها
//
// V10 — فمبویِ عمیق:
//   • هاب: خطِ کلاس-تسلط + اکسسوارِ پوشیده کنارِ اسم + سنگِ میلِ بعدی
//   • مهارت‌ها: درختِ سه‌شاخه (هسته‌ی رزمی / مسیرِ زندگی / قله‌ی هنر)
//   • فرگشت: انتخابِ شاخه (A موروثی / B تازه) با گامِ تأییدِ برگشت‌ناپذیر
//   • ظاهر و استایل: کیهاناتِ اکسسوار/پالت/قاب — پوشیدن و درآوردن
//   • کلاس-تسلط: سطح/مزیت/پیشرفت + کارهای واجدشرطِ امروز
//   • تعامل: ۹ نوع (از جمله جشن/هدیه/مرورِ خاطره) — مستقیم از موتور
//   • شربتِ روح + تغییرِ نام — دکمه‌های هاب (V8 ممیزی؛ DoD 14)
//
// کال‌بک‌ها (کوتاه؛ همه < ۶۴ بایت):
//   fw:hub fw:begin fw:next fw:prev fw:class:{key} fw:name2 fw:confirm fw:rename
//   fw:hunt fw:interact fw:skills fw:evo fw:evoGo:{0|1} fw:evoYes:{0|1}
//   fw:style fw:wear:{kind}:{key} fw:strip:{kind} fw:mastery
//   fw:history fw:hall fw:charge fw:duel
//   fwt:{enemyKey} fwa:{encId}:{act} fwi:{kind} fwk:{skillId} fwh:{board} fwr:{units}
//   fwsp:go (شربتِ روح)
//
// رنگِ دکمه‌های شیشه‌ای (قراردادِ V5): 🔴 خطر/هزینه · 🟢 امن/مثبت · 🔵 ناوبری.

import { InlineKeyboard, InputFile } from "grammy"
import type { Context } from "grammy"
import {
  api,
  GameApiError,
  type BotPersonaCardDTO,
  type BotStoryCardDTO,
  type CosmeticDTO,
  type EvolutionChoiceDTO,
  type HallDTO,
  type PublicFemboyCardDTO,
  type SoulCardDTO,
  type SoulClassDTO,
  type SoulCombatDTO,
  type SoulGetData,
} from "./api"
import { bumpError, log, stats } from "./stats"
import { privateLink, withMiniApp } from "./keyboards"
import { sendEngineCommand } from "./group"
import { bar, chip, clampText, DOTS, esc, expand, faNum, pct, quote, SEP, spoiler, SUB, toLatinDigits } from "./format"
import { answer, botUsername, errText, fail, isGroupChat, isInfraError, isPrivate, show, tgId } from "./ui"
import { guardOwnerPanel, openPrivatePanel } from "./panels"
// V16-3 — خطِ عبارت‌هایِ بافتاریِ هابِ فمبوی (intent.ts — ماژولِ خالص، بدونِ حلقه)
import { cardHint } from "./intent"

// ─── آرتِ کلاس‌ها (فایل‌های محلی؛ آپلود مستقیم به Bot API) ─────────────────────

const ART_DIR = "/home/z/my-project/public/art/classes"

/** کلیدِ فایل = نامِ فایلِ آرت (پیش‌فرض: «{classKey}.jpg»)
 *  V8 §24 — فرگشتِ ≥۲ فایلِ پرتره‌ی اختصاصیِ فُرمِ فعلی را می‌آورد (مثلاً «shinobi-a2.png») */
async function classArt(classKey: string, artFile?: string | null): Promise<InputFile | null> {
  const file = artFile ?? `${classKey}.jpg`
  try {
    const buf = new Uint8Array(await Bun.file(`${ART_DIR}/${file}`).arrayBuffer())
    if (buf.byteLength === 0) return null
    return new InputFile(buf, file)
  } catch {
    return null // عکس نبود — کارتِ متنی می‌ماند
  }
}

/** سقفِ کپشنِ تلگرام — ۱۰۲۴؛ رقم‌ها هم این‌جا انگلیسی می‌شوند */
const cap = (text: string): string => clampText(toLatinDigits(text), 1000)

/** ارسالِ کارتِ عکسی — بدونِ عکس، همان متن بدونِ گیر */
async function sendPhotoCard(ctx: Context, classKey: string, caption: string, kb: InlineKeyboard, artFile?: string | null): Promise<void> {
  const file = await classArt(classKey, artFile)
  if (!file) {
    await show(ctx, caption, kb)
    return
  }
  try {
    await ctx.replyWithPhoto(file, { caption: cap(caption), parse_mode: "HTML", reply_markup: kb })
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`soul photo: ${stats.lastError}`)
    await show(ctx, caption, kb)
  }
}

/** ویرایشِ کارتِ عکسی (ناوبریِ انتخابگرِ کلاس) — اگر نشد، false */
async function editPhotoCard(ctx: Context, classKey: string, caption: string, kb: InlineKeyboard): Promise<boolean> {
  const file = await classArt(classKey)
  if (!file) return false
  try {
    await ctx.editMessageMedia(
      { type: "photo", media: file, caption: cap(caption), parse_mode: "HTML" },
      { reply_markup: kb },
    )
    return true
  } catch {
    return false // «not modified» یا پیامِ عکس نیست — فرستنده‌ی تازه می‌آید
  }
}

// ─── ابزارهای کوچک ───────────────────────────────────────────────────────────

/** رقم‌های فارسی/عربی → عدد (برای /duel ۱۲۳…) */
function toNum(s: string): number {
  const fa = "۰۱۲۳۴۵۶۷۸۹"
  const ar = "٠١٢٣٤٥٦٧٨٩"
  let out = ""
  for (const ch of s) {
    const f = fa.indexOf(ch)
    const a = ar.indexOf(ch)
    out += f >= 0 ? String(f) : a >= 0 ? String(a) : ch
  }
  return Number(out)
}

/** تاریخِ کوتاهِ فارسی برای سابقه‌ی فمبوی — nu-latn: نامِ ماهِ فارسی، رقمِ لاتین («12 مهر») */
const faDate = new Intl.DateTimeFormat("fa-IR-u-nu-latn", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
})
function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? faDate.format(d) : "—"
}

/** رتبه‌های تالار — نشانِ مدال */
const MEDALS = ["🥇", "🥈", "🥉"] as const

/** لینکِ عمیقِ پیمانِ فمبوی — از گروه به خصوصی */
function soulDeepLink(): string {
  return `https://t.me/${botUsername()}?start=femboy`
}

/** هاب/زیرصفحه‌های خصوصی — «فمبویی نداری» (تورِ امنیتی برای دکمه‌های کهنه) */
async function noCharacter(ctx: Context): Promise<void> {
  const kb = new InlineKeyboard().text("🎀 پیمانِ فمبوی", "fw:begin").primary()
  await show(ctx, `فمبویِ اختصاصی‌ات هنوز آماده‌ی نبرده — برای بستنِ پیمان ${chip("پیمان فمبوی")} را بگو.`, kb)
}

/** ریدایرکتِ خصوصی برای دکمه‌های خصوصیِ زده‌شده در گروه */
async function privateNudge(ctx: Context): Promise<void> {
  // V17-3 — واژگانِ قاعده‌مند (§16): «فمبویِ من» — نه نامِ قدیمیِ «روح‌بسته»
  const kb = new InlineKeyboard().url("🎀 فمبویِ من", soulDeepLink()).primary()
  await show(ctx, "مدیریتِ فمبوی در گفت‌وگوی خصوصی است — این‌جا فقط تالار زنده است.", kb)
}

// ─── حافظه‌ی جریانِ پیمان (خصوصی؛ ۵ دقیقه اعتبار) ─────────────────────────────

type SoulFlowStep = "picker" | "persona" | "name" | "confirm" | "rename"

interface SoulFlow {
  step: SoulFlowStep
  idx: number // جایگاهِ انتخابگرِ کلاس
  classKey?: string
  classEmoji?: string
  className?: string
  classRole?: string
  personaKey?: string // V19 — طبعِ برگزیده در مراسمِ پیمان
  personaEmoji?: string
  personaName?: string
  name?: string
  at: number
}

const FLOW_TTL_MS = 5 * 60_000
const soulFlows = new Map<number, SoulFlow>()

const gs = globalThis as typeof globalThis & {
  __femwarSoulFlows?: Map<number, SoulFlow>
  __femwarSoulSweeper?: ReturnType<typeof setInterval>
}
gs.__femwarSoulFlows = soulFlows // هر نسلِ hot-reload مپِ خودش را معرفی می‌کند
if (!gs.__femwarSoulSweeper) {
  gs.__femwarSoulSweeper = setInterval(() => {
    const now = Date.now()
    const map = gs.__femwarSoulFlows
    if (!map) return
    for (const [k, v] of map) if (now - v.at > FLOW_TTL_MS) map.delete(k)
  }, 60_000)
  gs.__femwarSoulSweeper.unref?.()
}

function flowOf(chatId: number): SoulFlow | null {
  const f = soulFlows.get(chatId)
  if (!f) return null
  if (Date.now() - f.at > FLOW_TTL_MS) {
    soulFlows.delete(chatId)
    return null
  }
  return f
}

function setFlow(chatId: number, f: SoulFlow): void {
  f.at = Date.now()
  soulFlows.set(chatId, f)
}

const clearFlow = (chatId: number): void => {
  soulFlows.delete(chatId)
}

// ─── حافظه‌ی @username → telegramId (برای /duel @حریف) ────────────────────────

const seenUsers = new Map<string, number>() // username (کوچک) → telegramId
const SEEN_MAX = 600

/** ثبتِ یوزرنیم‌های دیده‌شده — /duel @username را ممکن می‌کند */
export function rememberUser(from: { id: number; username?: string; is_bot?: boolean } | undefined): void {
  if (!from || from.is_bot || !from.username) return
  const key = from.username.toLowerCase()
  if (seenUsers.get(key) === from.id) return
  seenUsers.set(key, from.id)
  if (seenUsers.size > SEEN_MAX) {
    const first = seenUsers.keys().next().value
    if (first !== undefined) seenUsers.delete(first)
  }
}

// ─── /femboy — ورودیِ اصلی ────────────────────────────────────────────────────

export async function handleFemboyCommand(ctx: Context): Promise<void> {
  const id = tgId(ctx)
  if (!id) return
  // V8 — گروه + هدف (ریپلای/منشن/عدد/@یوزرنیم): کارتِ عمومیِ فمبویِ آن بازیکن
  if (isGroupChat(ctx)) {
    const target = resolveCommandTarget(ctx, "femboy")
    if (target) {
      if ("miss" in target) {
        await show(ctx, `🎀 ${target.miss}`)
        return
      }
      await inspectPublicCard(ctx, target.targetId, target.name)
      return
    }
    // بدونِ هدف — هابِ جمع‌وجورِ خود (رفتارِ V7، فقط واژگانِ V8)
  }
  // بازیکن باید باشد (مثل /start) — upsert ارزان
  try {
    await api.auth(id, ctx.from?.first_name || ctx.from?.username)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(id)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists) {
    if (isGroupChat(ctx)) {
      const kb = new InlineKeyboard().url("🎀 بستنِ پیمانِ فمبوی", soulDeepLink()).primary()
      await show(ctx, `برای بستنِ پیمانِ فمبوی، در خصوصی بگو: ${chip("پیمان فمبوی")}`, kb)
      return
    }
    await sendIntro(ctx)
    return
  }
  const card = data.card
  if (!card) {
    await sendIntro(ctx)
    return
  }
  if (isGroupChat(ctx)) {
    await sendGroupHub(ctx, card)
    return
  }
  await sendHub(ctx, card)
}

// ─── گامِ ۱ — کارتِ معرفیِ پیمان ───────────────────────────────────────────────

// V9 — دومین لمسِ آشنایی (اولی /start است): کوتاه، هویت‌محور، بدون تکرارِ خوش‌آمد.
const INTRO = [
  "🎀 <b>پیمانِ فمبوی</b>",
  SEP,
  "",
  expand(
    "هر شهروندِ این جهان یک فمبوی دارد — امضای روحِ خودش در شهر.\n" +
      "اسمش را تو انتخاب می‌کنی، مسیرش را شهر می‌نویسد.\n" +
      "او کنارِ تو کار می‌کند، می‌جنگد، فرگشت می‌یابد.",
  ),
  "",
  "⚠️ کلاسش همیشگی است — با دقت انتخاب کن.",
].join("\n")

async function sendIntro(ctx: Context): Promise<void> {
  const kb = new InlineKeyboard().text("✨ شروعِ پیمان", "fw:begin").primary()
  await show(ctx, INTRO, kb)
}

// ─── گامِ ۲ — انتخابگرِ کلاس (کارت‌به‌کارت با آرت) ────────────────────────────

function classCardText(c: SoulClassDTO, pos: number, total: number): string {
  const diff = "◆".repeat(Math.max(0, Math.min(3, c.difficulty))) + "◇".repeat(Math.max(0, 3 - c.difficulty))
  const strengths = c.strengths.slice(0, 3).map((s) => clampText(s, 40)).join(" · ")
  const weaknesses = c.weaknesses.slice(0, 2).map((s) => clampText(s, 40)).join(" · ")
  return [
    `${c.emoji} <b>${esc(c.name)}</b> — ${esc(c.roleName)}`,
    `<i>${diff} ${esc(c.difficultyLabel)} · ${chip(`${faNum(pos)}/${faNum(total)}`)}</i>`,
    SEP,
    "",
    expand(`<i>${esc(clampText(c.fantasy, 110))}</i>`),
    "",
    SUB,
    "",
    `🌀 ${c.passive.icon} <b>${esc(c.passive.name)}</b>`,
    `<i>${esc(clampText(c.passive.desc, 90))}</i>`,
    `✨ ${c.activeSkill.icon} <b>${esc(c.activeSkill.name)}</b>`,
    `<i>${esc(clampText(c.activeSkill.desc, 90))} — کول‌داون ${chip(c.activeSkill.cooldown)} راند</i>`,
    "",
    SUB,
    "",
    `💪 ${esc(strengths)}`,
    `⚠️ ${esc(weaknesses)}`,
  ].join("\n")
}

function classPickerKeyboard(c: SoulClassDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("→ بعدی", "fw:next").primary()
  kb.text("قبلی ←", "fw:prev").primary().row()
  kb.text(`✅ انتخابِ ${clampText(c.name, 16)}`, `fw:class:${c.key}`).success().row()
  return kb
}

const wrapIdx = (i: number, len: number): number => ((i % len) + len) % len

function idxOfClass(classes: SoulClassDTO[], key: string | undefined): number {
  if (!key) return 0
  const i = classes.findIndex((c) => c.key === key)
  return i >= 0 ? i : 0
}

/** نمایشِ کارتِ کلاس — در ناوبری ویرایشِ عکس، در ورودِ تازه پیامِ تازه */
async function sendClassCard(ctx: Context, classes: SoulClassDTO[], idx: number, edit: boolean): Promise<void> {
  if (classes.length === 0) {
    await show(ctx, `شهر هنوز فهرستِ کلاس‌ها را آماده نکرده — یک لحظه بعد دوباره ${chip("پیمان فمبوی")} را بگو.`)
    return
  }
  const i = wrapIdx(idx, classes.length)
  const c = classes[i]!
  const caption = classCardText(c, i + 1, classes.length)
  const kb = classPickerKeyboard(c)
  if (edit && ctx.callbackQuery) {
    const ok = await editPhotoCard(ctx, c.key, caption, kb)
    if (ok) return
  }
  await sendPhotoCard(ctx, c.key, caption, kb)
}

/** fw:begin — شروع/بازگشت به انتخابگرِ کلاس (فقط خصوصی) */
async function onBegin(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await answer(ctx, "پیمان در گفت‌وگوی خصوصی بسته می‌شود.")
    await privateNudge(ctx)
    return
  }
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (data.exists && data.card) {
    clearFlow(chatId)
    await sendHub(ctx, data.card)
    return
  }
  const classes = data.classes ?? []
  const prev = flowOf(chatId)
  const idx = prev?.classKey ? idxOfClass(classes, prev.classKey) : 0
  setFlow(chatId, {
    step: "picker",
    idx,
    classKey: classes[idx]?.key,
    classEmoji: classes[idx]?.emoji,
    className: classes[idx]?.name,
    classRole: classes[idx]?.roleName,
    at: Date.now(),
  })
  await sendClassCard(ctx, classes, idx, false)
}

/** ناوبریِ انتخابگر — fw:next / fw:prev */
async function onPickerNav(ctx: Context, dir: 1 | -1): Promise<void> {
  const chatId = ctx.chat?.id
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (data.exists && data.card) {
    if (chatId !== undefined) clearFlow(chatId)
    await sendHub(ctx, data.card)
    return
  }
  const classes = data.classes ?? []
  const flow = chatId !== undefined ? flowOf(chatId) : null
  const cur = flow?.step === "picker" ? flow.idx : idxOfClass(classes, flow?.classKey)
  const next = wrapIdx(cur + dir, Math.max(1, classes.length))
  if (chatId !== undefined) {
    setFlow(chatId, {
      step: "picker",
      idx: next,
      classKey: classes[next]?.key,
      classEmoji: classes[next]?.emoji,
      className: classes[next]?.name,
      classRole: classes[next]?.roleName,
      at: Date.now(),
    })
  }
  await sendClassCard(ctx, classes, next, true)
}

// ─── گامِ ۳ — اسم ────────────────────────────────────────────────────────────

const NAME_PROMPT = `📛 <b>اسمِ فمبویِ اختصاصی‌ات را بفرست</b> (${chip(2)} تا ${chip(24)} حرف):\n\n<i>«لغو» برای انصراف.</i>`

/** fw:class:{key} — کلاس انتخاب شد؛ طبع را بخواه (V19: گامِ تازه‌ی پیمان) */
async function onPickClass(ctx: Context, classKey: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await answer(ctx, "پیمان در گفت‌وگوی خصوصی بسته می‌شود.")
    return
  }
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (data.exists && data.card) {
    clearFlow(chatId)
    await sendHub(ctx, data.card)
    return
  }
  const c = (data.classes ?? []).find((x) => x.key === classKey)
  if (!c) {
    await answer(ctx, "چنین کلاسی نیست — دوباره انتخاب کن.")
    return
  }
  const idx = idxOfClass(data.classes ?? [], classKey)
  setFlow(chatId, {
    step: "persona",
    idx,
    classKey: c.key,
    classEmoji: c.emoji,
    className: c.name,
    classRole: c.roleName,
    at: Date.now(),
  })
  await sendPersonaPicker(ctx, data.personas ?? [])
}

// ─── گامِ ۳ (V19) — انتخابگرِ طبع ────────────────────────────────────────────

function personaPickerText(p: BotPersonaCardDTO, classEmoji?: string, className?: string): string {
  const traits = p.traits.map((t) => `▫️ ${esc(t)}`).join("\n")
  return [
    // کلاسِ برگزیده + طبعِ درِ دست
    `${classEmoji ?? "🎀"} <b>${esc(className ?? "فمبوی")}</b> — حالا طبعش را برگزین:`,
    SEP,
    "",
    `${p.emoji} <b>${esc(p.name)}</b>`,
    `<i>${esc(p.tagline)}</i>`,
    "",
    traits,
    "",
    SUB,
    "",
    "<i>کلاس می‌گوید «چه‌کاره است»؛ طبع می‌گوید «چطور رفتار می‌کند» — روی حرف‌هاش، داستانِ شخصی‌اش و استعدادهایش اثر می‌گذارد. مثلِ کلاس، برای همیشه است.</i>",
  ].join("\n")
}

const PERSONA_ORDER = ["sunny", "shadow", "noble", "sly", "gentle", "prickly", "storm", "mind"] as const

/** انتخابگرِ طبع — یک کارت برای هر طبع؛ دکمه‌ی «بعدی/قبلی» می‌چرخاند */
async function sendPersonaPicker(ctx: Context, personas: BotPersonaCardDTO[]): Promise<void> {
  if (personas.length === 0) {
    // موتور بسته‌ی طبع‌ها را نفرستاد — همان مسیرِ قدیمی (اسم) ادامه می‌یابد
    const chatId = ctx.chat?.id
    const flow = chatId !== undefined ? flowOf(chatId) : null
    if (flow) {
      flow.step = "name"
      setFlow(chatId!, flow)
    }
    await show(ctx, NAME_PROMPT)
    return
  }
  const sorted = [...personas].sort((a, b) => PERSONA_ORDER.indexOf(a.key as never) - PERSONA_ORDER.indexOf(b.key as never))
  const idx = personaPickerIdx(ctx, sorted)
  const p = sorted[idx] ?? sorted[0]!
  const flow = ctx.chat?.id !== undefined ? flowOf(ctx.chat.id) : null
  const kb = new InlineKeyboard()
  kb.text("→ بعدی", "fw:pNext").primary()
  kb.text("قبلی ←", "fw:pPrev").primary().row()
  kb.text(`✅ همین طبع — ${clampText(p.name, 14)}`, `fw:persona:${p.key}`).success().row()
  kb.text("↩️ کلاسِ دیگری", "fw:begin").primary()
  await show(ctx, personaPickerText(p, flow?.classEmoji, flow?.className), kb)
}

function personaPickerIdx(ctx: Context, personas: BotPersonaCardDTO[]): number {
  const flow = ctx.chat?.id !== undefined ? flowOf(ctx.chat.id) : null
  if (flow?.personaKey) {
    const i = personas.findIndex((p) => p.key === flow.personaKey)
    if (i >= 0) return i
  }
  return 0
}

/** ناوبریِ طبع — fw:pNext / fw:pPrev */
async function onPersonaNav(ctx: Context, dir: 1 | -1): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  const flow = flowOf(chatId)
  if (!flow || flow.step !== "persona") {
    await answer(ctx, "پیمان از یاد رفته — از نو بگو: پیمان فمبوی")
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (data.exists && data.card) {
    clearFlow(chatId)
    await sendHub(ctx, data.card)
    return
  }
  const personas = data.personas ?? []
  if (personas.length === 0) {
    await answer(ctx)
    return
  }
  const cur = personaPickerIdx(ctx, personas)
  const next = wrapIdx(cur + dir, personas.length)
  flow.personaKey = personas[next]?.key
  flow.personaEmoji = personas[next]?.emoji
  flow.personaName = personas[next]?.name
  setFlow(chatId, flow)
  await sendPersonaPicker(ctx, personas)
}

/** fw:persona:{key} — طبع انتخاب شد؛ اسم را بخواه */
async function onPickPersona(ctx: Context, personaKey: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await answer(ctx, "پیمان در گفت‌وگوی خصوصی بسته می‌شود.")
    return
  }
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  const flow = flowOf(chatId)
  if (!flow || flow.step !== "persona") {
    await answer(ctx, "پیمان از یاد رفته — از نو بگو: پیمان فمبوی")
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (data.exists && data.card) {
    clearFlow(chatId)
    await sendHub(ctx, data.card)
    return
  }
  const p = (data.personas ?? []).find((x) => x.key === personaKey)
  if (!p) {
    await answer(ctx, "چنین طبعی نیست — دوباره انتخاب کن.")
    return
  }
  flow.step = "name"
  flow.personaKey = p.key
  flow.personaEmoji = p.emoji
  flow.personaName = p.name
  setFlow(chatId, flow)
  await show(ctx, NAME_PROMPT)
}

/** fw:name2 — پس از خطای ساخت، دوباره اسم بخواه */
async function onAskName(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  const flow = flowOf(chatId)
  if (!flow) {
    await handleFemboyCommand(ctx)
    return
  }
  flow.step = "name"
  flow.name = undefined
  setFlow(chatId, flow)
  await show(ctx, NAME_PROMPT)
}

/** مصرف‌کننده‌ی متنِ آزادِ جریانِ پیمان — فقط وقتی حالتِ «اسم» یا «تغییرِ نام» در انتظار است.
 *  true = مصرف شد (زنجیره‌ی هندلرها همین‌جا تمام) · false = ربطی نداشت */
export async function soulTextGuard(ctx: Context): Promise<boolean> {
  if (!isPrivate(ctx)) return false
  const chatId = ctx.chat?.id
  if (chatId === undefined) return false
  const flow = flowOf(chatId)
  if (!flow) return false
  // V8 — تغییرِ نامِ فمبویِ موجود: گامِ مستقل با انصرافِ صریح
  if (flow.step === "rename") return consumeRenameText(ctx, chatId)
  if (flow.step !== "name") return false
  const text = (ctx.message?.text ?? "").trim()
  if (!text || text.startsWith("/")) return false // فرمان‌ها آزاد می‌مانند

  // V13 (Part IV §9) — «لغو» در جریانِ فعال یعنی انصرافِ همین جریان، نه اسمِ فمبوی
  if (text === "لغو" || text === "انصراف") {
    clearFlow(chatId)
    await show(ctx, "✨ <b>پیمانِ نیمه‌کاره رها شد.</b> اسمی ثبت نشد — هر وقت خواستی از نو شروع کن.")
    return true
  }

  const len = Array.from(text).length
  if (len < 2 || len > 24) {
    await ctx.reply(`اسم باید ${chip(2)} تا ${chip(24)} حرف باشد — دوباره بفرست:`, { parse_mode: "HTML" })
    return true
  }
  flow.name = text
  flow.step = "confirm"
  setFlow(chatId, flow)
  await sendConfirm(ctx, flow)
  return true
}

/** مصرف‌کننده‌ی متنِ گامِ «تغییرِ نام» — انصراف یا اسمِ تازه (اعتبارسنجیِ محلی + صدای موتور).
 *  دامنه‌ی طول آینه‌ی SOUL.NAME_MIN/NAME_MAX موتور است (۲ تا ۲۴). */
async function consumeRenameText(ctx: Context, chatId: number): Promise<boolean> {
  const text = (ctx.message?.text ?? "").trim()
  if (!text) return false
  // انصراف — قبل از قاعده‌ی «فرمان‌ها آزاد می‌مانند» تا /cancel همین‌جا تمام شود
  if (text === "/cancel" || text === "لغو") {
    clearFlow(chatId)
    await show(ctx, "✏️ <b>تغییرِ نام لغو شد.</b> اسمِ همان ماند.")
    return true
  }
  if (text.startsWith("/")) return false // فرمان‌های دیگر آزاد می‌مانند؛ جریان می‌مانَد

  const len = Array.from(text).length
  if (len < 2 || len > 24) {
    await show(ctx, `✏️ اسم باید ${chip(2)} تا ${chip(24)} حرف باشد — دوباره بفرست، یا «لغو» برای انصراف.`)
    return true
  }
  try {
    const res = await api.soulAction(tgId(ctx), "rename", { name: text })
    clearFlow(chatId)
    await show(ctx, `✏️ ${esc(res.message)}`)
    if (res.card) await sendHub(ctx, res.card) // کارتِ تازه با اسمِ جدید
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return true
    }
    // صدای موتور (کول‌داون/اسمِ رزرو/همین اسم) — عیناً؛ جریان برای اصلاح می‌مانَد
    await show(ctx, `⚠️ ${errText(e)}\n\n<i>دوباره بفرست، یا «لغو» برای انصراف.</i>`)
  }
  return true
}

// ─── گامِ ۴ — تأییدِ همیشگی ──────────────────────────────────────────────────

function confirmText(flow: SoulFlow): string {
  return [
    // V17-3 — واژگانِ قاعده‌مند (§16): «فمبویِ تو» — نه نامِ قدیمیِ «روح‌بسته»
    "👑 <b>فمبویِ تو</b>",
    SEP,
    "",
    `🏷 کلاس: ${flow.classEmoji ?? "🎀"} <b>${esc(flow.className ?? flow.classKey ?? "؟")}</b>`,
    ...(flow.classRole ? [`💬 ${esc(flow.classRole)}`] : []),
    ...(flow.personaName ? [`🎭 طبع: ${flow.personaEmoji ?? ""} <b>${esc(flow.personaName)}</b>`] : []),
    `📛 اسم: <b>${esc(flow.name ?? "")}</b>`,
    "",
    SUB,
    "",
    "⚠️ کلاسِ همیشگی‌ات بعد از تأیید عوض نمی‌شود.",
  ].join("\n")
}

function confirmKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🔒 قفلِ پیمان", "fw:confirm").success()
  kb.text("↩️ کلاسِ دیگری", "fw:begin").primary().row()
  return kb
}

async function sendConfirm(ctx: Context, flow: SoulFlow): Promise<void> {
  await show(ctx, confirmText(flow), confirmKeyboard())
}

/** fw:confirm — بستنِ عهد در موتور */
async function onConfirm(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  const flow = flowOf(chatId)
  if (!flow || flow.step !== "confirm" || !flow.name || !flow.classKey) {
    await answer(ctx, "پیمان از یاد رفته — از نو بگو: پیمان فمبوی")
    await sendIntro(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "create", {
      name: flow.name,
      classKey: flow.classKey,
      ...(flow.personaKey ? { personaKey: flow.personaKey } : {}),
    })
    clearFlow(chatId)
    if (res.card) {
      await sendHub(ctx, res.card)
    } else {
      await show(ctx, `🎀 ${esc(res.message)}`)
    }
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    // صدای موتور: اسمِ نامعتبر/تکراری/نرخ — قابلِ اصلاح
    const kb = new InlineKeyboard()
    kb.text("↩️ اسمِ دیگری", "fw:name2").primary()
    kb.text("↩️ کلاسِ دیگری", "fw:begin").primary().row()
    await show(ctx, `⚠️ ${errText(e)}`, kb)
  }
}

// ─── هابِ فمبوی (خصوصی — عکسِ کلاس + کپشن) ────────────────────────────────────

/** V10 — نزدیک‌ترین سنگِ میل، بازسازی‌شده از کارت (آینه‌ی nextMilestoneOf موتور) */
function milestoneOfCard(card: SoulCardDTO): string {
  if (card.skillPoints > 0) return `${esc(card.name)} ${chip(card.skillPoints)} نقطه‌مهارتِ بی‌استفاده دارد`
  const next = card.nextEvolution ?? null
  if (next && next.options.length > 0) {
    const a = next.options[0]!
    if (card.level >= a.reqLevel && card.wins >= a.reqWins) {
      return `فرگشتِ «${esc(a.name)}» آماده است — شاخه‌اش را انتخاب کن`
    }
    if (card.level < a.reqLevel) return `${chip(a.reqLevel - card.level)} سطح دیگر تا فرگشتِ بعدی`
  }
  const m = card.mastery ?? null
  if (m && m.nextTierXp !== null && m.nextTierXp !== undefined && m.nextTierXp - m.xp <= 15) {
    return `${chip(m.nextTierXp - m.xp)} تسلط دیگر تا سطحِ ${chip(Math.min(10, m.level + 1))}ِ کلاس-تسلط`
  }
  const need = card.xpForNext
  const into = card.xpIntoLevel
  return `${chip(Math.max(0, need - into))} XP تا سطحِ ${chip(card.level + 1)}`
}

function hubCaption(card: SoulCardDTO, banner = ""): string {
  const dmg = card.condition.dmgMod
  const dmgPart =
    dmg !== 0 ? ` · ${chip(`${faNum(Math.abs(dmg))}%${dmg > 0 ? "+" : "−"}`)} آسیب` : ""
  // V10 — اکسسوارِ پوشیده کنارِ اسم (مثل: شبنم ده 🎀)
  const acc = card.appearance?.equipped.accessory ?? null
  const namePart = `${esc(card.name)}${acc ? ` ${acc.emoji}` : ""}`
  // V10 — خطِ کلاس-تسلط
  const m = card.mastery ?? null
  const masteryLine = m
    ? `🎓 کلاس-تسلط: ${m.emoji} ${esc(m.label)} — سطح ${chip(m.level)} · ${
        m.nextTierXp !== null && m.nextTierXp !== undefined
          ? `${chip(`${faNum(m.xp)}/${faNum(m.nextTierXp)}`)} تسلط`
          : "سقفِ تسلط"
      }`
    : null
  return [
    `👑 <b>فمبویِ اختصاصی‌ام: ${namePart}</b>`,
    // V17-3 (ممیزی ④/§12) — قدمِ بعدیِ پیمانِ تازه: فقط یک خط، فقط برای فمبویِ
    // سطحِ ≤۲ در مرحله‌ی سفرِ bound (قراردادِ snapshot.journey موتور). دکمه‌ی
    // «💗 تعامل» همین کارت است — چیزی جز مسیرِ واقعی تبلیغ نمی‌شود (§16).
    ...(banner ? [banner] : []),
    SEP,
    "",
    `🎖 رتبه: ${card.rank.emoji} <b>${esc(card.rank.name)}</b> · ⭐ سطح ${chip(card.level)}`,
    `🏷 کلاس: ${card.classEmoji} ${esc(card.className)} · ${card.evolutionEmoji} ${esc(card.evolutionName)}`,
    ...(card.persona ? [`🎭 طبع: ${card.persona.emoji} <b>${esc(card.persona.name)}</b> — <i>${esc(clampText(card.persona.tagline, 60))}</i>`] : []),
    ...(card.story && card.story.status === "available" ? [`📖 <b>فصلِ ${chip(card.story.chaptersDone + 1)} از ${chip(card.story.chaptersTotal)} — آماده است</b>`] : []),
    ...(masteryLine ? [masteryLine] : []),
    "",
    SUB,
    "",
    `❤️ روحیه ${pct(card.spirit)} (${card.condition.emoji} ${esc(card.condition.label)}${dmgPart})`,
    `⚡ استقامت ${chip(`${faNum(card.stamina)}/${faNum(card.staminaMax)}`)}`,
    // V8 — خطِ هزینه‌ی شربت (مثلِ هزینه‌های تعامل)؛ در سقفِ روحیه لازم نیست
    ...(card.spirit < 100 ? [`🧪 شربتِ روح — کیک از کیف، یا 200 سکه`] : []),
    `⚔️ نبرد ${chip(`${faNum(card.wins)}W/${faNum(card.losses)}L`)}`,
    "",
    `🌀 ${card.passive.icon} ${esc(card.passive.name)}`,
    `<i>${esc(clampText(card.passive.desc, 90))}</i>`,
    "",
    // milestoneOfCard خودش esc/chip می‌سازد — دوباره esc نمی‌شود (وگرنه تراش‌ها لو می‌روند)
    `🎯 ${milestoneOfCard(card)}`,
  ].join("\n")
}

function hubKeyboard(): InlineKeyboard {
  // V10 — ردیف‌های تمیز (حداکثر ~۳ دکمه): جنگ / منبع / هویت / خانه
  // V8 — 🧪 شربتِ روح کنارِ تعامل (نفس‌های روحی) · ✏️ تغییرِ نام در ردیفِ هویت
  // V19 — 🎭 طبع و 📖 داستان کنارِ هویت (شخصیتِ عمیق)
  const kb = new InlineKeyboard()
  kb.text("⚔️ شکار", "fw:hunt").danger()
  kb.text("💗 تعامل", "fw:interact").success()
  kb.text("✨ مهارت‌ها", "fw:skills").primary().row()
  kb.text("🎭 طبع", "fw:about").primary()
  kb.text("📖 داستان", "fw:story").success()
  kb.text("🧪 شربتِ روح", "fwsp:go").danger().row()
  kb.text("⚡ شارژِ استقامت", "fw:charge").danger()
  kb.text("🌌 فرگشت", "fw:evo").primary()
  kb.text("🎨 ظاهر و استایل", "fw:style").primary().row()
  kb.text("✏️ تغییرِ نام", "fw:rename").primary()
  kb.text("🎓 تسلط", "fw:mastery").primary()
  kb.text("🕰 سابقه", "fw:history").primary().row()
  kb.text("🏆 تالار", "fw:hall").primary()
  kb.text("🏠 خانه", "m:menu").primary().row()
  return withMiniApp(kb)
}

/** V8 §24 — فایلِ آرتِ فُرمِ فعلیِ فمبوی: فرگشتِ ≥۲ پرتره‌ی اختصاصیِ خودش را دارد
 *  (هم کارتِ کاملِ خصوصی، هم کارتِ عمومیِ گروهی — فیلدهای «evolution/art» مشترک‌اند) */
function evolutionArtFile(card: { evolution: number; art?: string | null }): string | null {
  if (card.evolution < 2 || !card.art) return null
  return card.art.split("/").pop() ?? null
}

/** V17-3 — خطِ «قدمِ بعدی» بالای هاب، فقط برای پیمانِ تازه (فمبویِ سطحِ ≤۲).
 *  استیج از قراردادِ server-authoritativeِ snapshot.journey می‌آید؛ واکشی فقط
 *  وقتی لازم است (فمبویِ تازه) — بازیکنِ ریشه‌دار هیچ فراخوانیِ اضافه نمی‌دهد.
 *  «💗 تعامل» دکمه‌ی همین کارت است؛ عبارتِ متنی‌ای برای تعامل در intent.ts
 *  ثبت نشده (فقط دکمه) — پس تبلیغ هم فقط دکمه است (§16: فقط مسیرِ واقعی). */
async function firstInteractBanner(telegramId: string, card: SoulCardDTO): Promise<string> {
  if (card.level > 2 || !telegramId) return ""
  try {
    const { snapshot } = await api.state(telegramId)
    if (snapshot.journey?.stage !== "bound") return ""
  } catch {
    return "" // استیج نامعلوم — خطی آموزش نمی‌دهیم
  }
  return "🌱 <b>قدمِ بعدی: اولین تعامل را انجام بده — دکمه‌ی «💗 تعامل» همین کارت.</b>"
}

async function sendHub(ctx: Context, card: SoulCardDTO): Promise<void> {
  // V16-3 — خطِ عبارت‌هایِ مرتبطِ هاب (ممیزی ⑭) — کپشنِ عکس با safeCutِ خودش
  // مدیریت می‌شود؛ اگر جا نشد بی‌صدا می‌افتد، کارت خراب نمی‌شود.
  const hint = cardHint("femboy")
  const banner = await firstInteractBanner(tgId(ctx), card)
  const caption = hint ? `${hubCaption(card, banner)}\n\n${hint}` : hubCaption(card, banner)
  await sendPhotoCard(ctx, card.classKey, caption, hubKeyboard(), evolutionArtFile(card))
}

/** تازه‌سازیِ کارتِ هاب در جا — همان پیامِ عکس (که دکمه‌اش زده شده) ویرایش می‌شود؛
 *  اگر نشد (پیامِ دیرشده/گم‌شده)، کارتِ تازه فرستاده می‌شود */
async function refreshHub(ctx: Context, card: SoulCardDTO): Promise<void> {
  const banner = await firstInteractBanner(tgId(ctx), card)
  const file = await classArt(card.classKey, evolutionArtFile(card))
  if (file) {
    try {
      await ctx.editMessageMedia(
        { type: "photo", media: file, caption: cap(hubCaption(card, banner)), parse_mode: "HTML" },
        { reply_markup: hubKeyboard() },
      )
      return
    } catch {
      /* ویرایش نشد — فرستنده‌ی تازه می‌آید */
    }
  }
  await sendHub(ctx, card)
}

// ─── هابِ جمع‌وجور (گروه) ─────────────────────────────────────────────────────

function groupHubText(card: SoulCardDTO): string {
  return [
    // V17-3 — واژگانِ قاعده‌مند (§16): «فمبوی: X» — نه نامِ قدیمیِ «روح‌بسته»
    `👑 <b>فمبوی: ${esc(card.name)}</b>`,
    SEP,
    "",
    `🎖 ${card.rank.emoji} ${esc(card.rank.name)} · ⭐ سطح ${chip(card.level)} · ${card.classEmoji} ${esc(card.className)}`,
    ...(card.persona ? [`🎭 ${card.persona.emoji} ${esc(card.persona.name)}${card.talent ? ` · ${card.talent.emoji} ${esc(card.talent.name)}` : ""}`] : []),
    `❤️ روحیه ${pct(card.spirit)} (${card.condition.emoji}) · ⚡ ${chip(`${faNum(card.stamina)}/${faNum(card.staminaMax)}`)} · ⚔️ ${chip(`${faNum(card.wins)}W/${faNum(card.losses)}L`)}`,
    "",
    `<i>برای مدیریتِ کامل، در خصوصی بگو: ${chip("پیمان فمبوی")}</i>`,
  ].join("\n")
}

function groupHubKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.url("👑 مدیریتِ کامل در خصوصی", soulDeepLink()).primary()
  kb.text("🏆 تالارِ افتخارات", "fwh:level").primary().row()
  return kb
}

async function sendGroupHub(ctx: Context, card: SoulCardDTO): Promise<void> {
  await show(ctx, groupHubText(card), groupHubKeyboard())
}

/** fw:hub — هابِ تازه (خصوصی: عکس · گروه: جمع‌وجور) */
async function soulHub(ctx: Context): Promise<void> {
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    if (isGroupChat(ctx)) {
      const kb = new InlineKeyboard().url("🎀 بستنِ پیمانِ فمبوی", soulDeepLink()).primary()
      await show(ctx, `برای بستنِ پیمانِ فمبوی، در خصوصی بگو: ${chip("پیمان فمبوی")}`, kb)
      return
    }
    await sendIntro(ctx)
    return
  }
  if (isGroupChat(ctx)) {
    await sendGroupHub(ctx, data.card)
    return
  }
  await sendHub(ctx, data.card)
}

// ─── ⚔️ شکار + نبردِ(round-based) ─────────────────────────────────────────────

/** کارتِ نبرد — وضعیتِ راند یا کارتِ نتیجه */
function combatText(enc: SoulCombatDTO): string {
  const hp = (hp: number, hpMax: number): string => chip(`${faNum(hp)}/${faNum(hpMax)}`)
  const hpBar = (hp: number, hpMax: number): string => bar((hp / Math.max(1, hpMax)) * 100)
  const lines: string[] = []
  if (enc.status === "active") {
    lines.push(`⚔️ <b>نبرد — راندِ ${chip(enc.round)}</b>`, SEP, "")
    if (enc.enemy) {
      lines.push(`${enc.enemy.emoji} <b>${esc(enc.enemy.name)}</b> — ❤️ ${hp(enc.enemy.hp, enc.enemy.hpMax)}`)
      lines.push(hpBar(enc.enemy.hp, enc.enemy.hpMax))
    }
    lines.push(`${enc.you.emoji} <b>${esc(enc.you.name)}</b> — ❤️ ${hp(enc.you.hp, enc.you.hpMax)}`)
    lines.push(hpBar(enc.you.hp, enc.you.hpMax))
    lines.push(enc.cooldown > 0 ? `✨ امضا: ${chip(enc.cooldown)} راند دیگر` : "✨ امضا: آماده")
    const log = enc.log.slice(-6).map((l) => esc(clampText(l, 110))).join("\n")
    if (log) lines.push("", SUB, "", quote(log))
    return lines.join("\n")
  }
  const head = enc.status === "won" ? "🏆 <b>پیروزی!</b>" : enc.status === "lost" ? "💀 <b>شکست…</b>" : "🏃 <b>فرار کردی</b>"
  lines.push(head, SEP, "")
  if (enc.enemy) {
    lines.push(`${enc.enemy.emoji} ${esc(enc.enemy.name)} — ❤️ ${hp(enc.enemy.hp, enc.enemy.hpMax)}`)
  }
  lines.push(`${enc.you.emoji} ${esc(enc.you.name)} — ❤️ ${hp(enc.you.hp, enc.you.hpMax)}`)
  if (enc.result) {
    lines.push("", SUB, "")
    const story = enc.result.lines.slice(0, 4).map((l) => esc(clampText(l, 110))).join("\n")
    if (story) lines.push(quote(story))
    if (enc.result.money > 0) lines.push(`🪙 ${chip(`${faNum(enc.result.money)}+`)} سکه`)
    for (const x of enc.result.xp.slice(0, 3)) {
      lines.push(`${x.icon} ${chip(`${faNum(x.amount)}+`)} XPِ ${esc(x.label)}`)
    }
    if (enc.result.spiritDelta !== 0) {
      lines.push(`❤️ روحیه ${chip(`${faNum(Math.abs(enc.result.spiritDelta))}${enc.result.spiritDelta > 0 ? "+" : "−"}`)}`)
    }
  }
  return lines.join("\n")
}

function combatKeyboard(enc: SoulCombatDTO): InlineKeyboard {
  if (enc.status !== "active") {
    const kb = new InlineKeyboard()
    kb.text("⚔️ شکارِ بعدی", "fw:hunt").danger()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary().row()
    return kb
  }
  const kb = new InlineKeyboard()
  const skillLabel = enc.cooldown > 0 ? `✨ امضا (${faNum(enc.cooldown)} راند)` : "✨ امضا"
  kb.text("⚔️ ضربه", `fwa:${enc.id}:strike`).primary()
  kb.text(skillLabel, `fwa:${enc.id}:skill`).primary().row()
  kb.text("🛡️ گارد", `fwa:${enc.id}:guard`).primary()
  kb.text("🏃 فرار", `fwa:${enc.id}:flee`).danger().row()
  return kb
}

// ─── V19: طبع/استعداد — کارتِ «شخصیتش رو بیشتر بشناسم» ────────────────────────

/** متنِ کارتِ طبع — طبع + صفت‌ها + صدای نمونه + استعداد/ضعف + ماتریسِ دامنه‌ها */
function personaCardText(card: SoulCardDTO): string {
  const p = card.persona
  if (!p) return "شخصیتِ این فمبوی هنوز ثبت نشده."
  const t = card.talent
  const f = card.flaw
  const rows = (card.affinityRows ?? []).map(
    (r) => `${r.icon} ${esc(r.label)} — <b>${r.pct > 0 ? "+" : "−"}${faNum(Math.abs(r.pct))}%</b> (${r.kind === "talent" ? "استعداد" : "ضعف"})`,
  )
  return [
    `🎭 <b>طبعِ ${esc(card.name)}: ${p.emoji} ${esc(p.name)}</b>`,
    `<i>${esc(p.tagline)}</i>`,
    "",
    p.traits.map((x) => `▫️ ${esc(x)}`).join("\n"),
    "",
    SUB,
    "",
    ...(p.voiceSample ? [quote(p.voiceSample), ""] : []),
    ...(t ? [`${t.emoji} <b>استعداد: ${esc(t.name)}</b>`, `<i>${esc(clampText(t.desc, 110))}</i>`] : []),
    ...(f ? [`${f.emoji} <b>ضعف: ${esc(f.name)}</b>`, `<i>${esc(clampText(f.desc, 110))}</i>`] : []),
    ...(rows.length > 0 ? ["", SUB, "", ...rows] : []),
    "",
    "<i>این اعداد واقعی‌اند: هر سطر دقیقاً همان‌جای بازی اعمال می‌شود که می‌گوید.</i>",
  ].join("\n")
}

function personaCardKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("📖 داستانِ شخصی", "fw:story").success()
  kb.text("👑 هابِ فمبوی", "fw:hub").primary().row()
  return kb
}

/** fw:about / «شخصیتش رو بیشتر بشناسم» — کارتِ طبع + استعداد/ضعف */
async function showPersona(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await sendIntro(ctx)
    return
  }
  await openPrivatePanel(ctx, { type: "fw:about", nav: "fw:hub" })
  await show(ctx, personaCardText(data.card), personaCardKeyboard())
}

// ─── V19: داستانِ شخصی — فصل/انتخاب/اعتماد ────────────────────────────────────

/** متنِ کارتِ داستان — اعتماد + فصلِ جاری (متن درِ expand) + انتخاب‌ها */
function storyCardText(story: BotStoryCardDTO, name: string): string {
  const trustBar = bar(story.trust, 8)
  const nextTier = story.nextTrustTier
  const header = [
    `📖 <b>داستانِ شخصیِ ${esc(name)}</b> — ${story.arcEmoji} <i>${esc(story.arcTitle)}</i>`,
    `فصلِ ${chip(Math.min(story.chaptersDone + 1, story.chaptersTotal))} از ${chip(story.chaptersTotal)}`,
    SEP,
    "",
    `🤝 اعتماد: ${story.trustTier.emoji} <b>${esc(story.trustTier.label)}</b> ${chip(`${faNum(story.trust)}/100`)}`,
    `${trustBar}${nextTier ? ` — ${chip(faNum(Math.max(0, nextTier.at - story.trust)))} تا «${esc(nextTier.label)}»` : " — سقف"}`,
  ]
  if (story.status === "complete") {
    return [
      ...header,
      "",
      SUB,
      "",
      "👑 <b>قصه کامل شد.</b> عنوانِ «راویِ پیمان» مالِ توست — فصل‌های بعدی را خودتان با هم می‌نویسید.",
      ...(story.memories.length > 0 ? ["", SUB, "", ...story.memories.map((m) => `${m.icon} ${esc(clampText(m.text, 90))}`)] : []),
    ].join("\n")
  }
  if (story.status === "locked" || !story.current) {
    return [
      ...header,
      "",
      SUB,
      "",
      `🔒 <b>فصلِ بعدی هنوز قفل است.</b>`,
      ...(story.requirement ? [`نیاز: ${esc(story.requirement)}`] : []),
      "",
      "<i>اعتماد از انتخاب‌های داستان، اولینِ تعاملِ هر روز و پیروزی‌ها می‌آید.</i>",
    ].join("\n")
  }
  const c = story.current
  const body = c.text.map((p) => esc(clampText(p, 220))).join("\n\n")
  return [
    ...header,
    "",
    `${c.icon} <b>${esc(c.title)}</b>`,
    "",
    expand(body),
    "",
    SUB,
    "",
    "<b>انتخابت چیست؟</b>",
    ...c.choices.map((ch) => `${chip(faNum(ch.idx + 1))} ${esc(ch.label)} — <i>${esc(clampText(ch.hint, 48))}</i>`),
    "",
    `<i>دکمه‌ها را بزن؛ پیامدش برای همیشه در سابقه می‌نشیند.</i>`,
  ].join("\n")
}

function storyKeyboard(story: BotStoryCardDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (story.status === "available" && story.current) {
    for (const ch of story.current.choices) {
      kb.text(`${ch.label}`, `fwd:${ch.idx}`).primary().row()
    }
    kb.text("👑 هابِ فمبوی", "fw:hub").primary().row()
  } else {
    kb.text("💗 تعامل (اعتماد)", "fw:interact").success()
    kb.text("👑 هابِ فمبوی", "fw:hub").primary().row()
  }
  return kb
}

/** fw:story / «داستانش رو ادامه بده» — خواندنِ فصلِ جاری (بی‌اثر) */
async function showStory(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  const id = tgId(ctx)
  if (!id) return
  let data: SoulGetData
  try {
    data = await api.soulGet(id)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await sendIntro(ctx)
    return
  }
  const name = data.card.name
  let res: Awaited<ReturnType<typeof api.soulStory>>
  try {
    res = await api.soulStory(id, "read")
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await show(ctx, `📖 ${errText(e)}`)
    return
  }
  if (!res.story) {
    await show(ctx, "قصه‌ای برای این فمبوی ثبت نشده.")
    return
  }
  await openPrivatePanel(ctx, { type: "fw:story", nav: "fw:hub" })
  await show(ctx, `${esc(res.message)}\n\n${storyCardText(res.story, name)}`, storyKeyboard(res.story))
}

/** fwd:{idx} — انتخابِ فصل: پیامد + داستانِ تازه از همان پاسخ */
async function onStoryChoose(ctx: Context, choiceIdx: number): Promise<void> {
  const id = tgId(ctx)
  if (!id) return
  let res: Awaited<ReturnType<typeof api.soulStory>>
  try {
    res = await api.soulStory(id, "choose", choiceIdx)
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await show(ctx, `⚠️ ${errText(e)}`)
    return
  }
  const card = res.card
  const name = card?.name ?? "فمبویِ تو"
  const story = res.story
  await show(ctx, `✍️ <b>پیامدِ انتخابت</b>\n${esc(res.message)}${story ? `\n\n${storyCardText(story, name)}` : ""}`, story ? storyKeyboard(story) : new InlineKeyboard().text("👑 هابِ فمبوی", "fw:hub").primary())
}

/** fw:hunt — لیستِ شکار (یا ادامه‌ی نبردِ باز) */
async function showHunt(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  if (data.encounter && data.encounter.status === "active") {
    // نبردِ باز — همان کارتِ زنده
    await show(ctx, combatText(data.encounter), combatKeyboard(data.encounter))
    return
  }
  const allEnemies = data.enemies ?? []
  const enemies = allEnemies.slice(0, 8)
  const lines = [
    "⚔️ <b>شکار</b>",
    `⚡ استقامت ${chip(`${faNum(card.stamina)}/${faNum(card.staminaMax)}`)} · هر نبرد ${chip(3)} استقامت`,
    SEP,
    "",
  ]
  if (enemies.length === 0) {
    lines.push("<i>فعلاً چیزی در تیررسِ سطحِ تو نیست.</i>")
    lines.push("", "<i>سطح بگیر — شکارِ بهتر راه می‌افتد.</i>")
  } else {
    enemies.forEach((e, i) => {
      lines.push(`${chip(i + 1)}. ${e.emoji} <b>${esc(e.name)}</b> — ردهٔ ${chip(e.tier)} · ${chip(3)} استقامت`)
    })
    if (allEnemies.length > enemies.length) {
      lines.push("", `<i>… و ${chip(allEnemies.length - enemies.length)} شکارِ دیگر</i>`)
    }
    if (card.stamina < 3) {
      lines.push("", "⚠️ استقامتت برای نبرد کافی نیست — اول شارژ کن.")
    }
  }
  const kb = new InlineKeyboard()
  enemies.forEach((e, i) => {
    const btn = kb.text(`نبردِ ${faNum(i + 1)}`, `fwt:${e.key}`).danger()
    if (i % 2 === 1) btn.row()
  })
  kb.row() // بستنِ ردیفِ نیمه‌کار
  if (card.stamina < 3) kb.text("⚡ شارژِ استقامت", "fw:charge").danger().row()
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  await show(ctx, lines.join("\n"), kb)
}

/** fwt:{enemyKey} — شروعِ نبرد */
async function onStartFight(ctx: Context, enemyKey: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  try {
    const res = await api.combatAction(tgId(ctx), "start", { enemyKey })
    if ("encounter" in res && res.encounter) {
      await show(ctx, combatText(res.encounter), combatKeyboard(res.encounter))
    }
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await answer(ctx, errText(e)) // صدای موتور (استقامت/روحیه/نبردِ باز) — لیستِ شکار می‌ماند
  }
}

/** fwa:{encId}:{act} — راندِ بعدی؛ کارتِ همان پیام ویرایش می‌شود */
async function onCombatAct(ctx: Context, encId: string, act: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (!["strike", "skill", "guard", "flee"].includes(act)) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.combatAction(tgId(ctx), "act", { encounterId: encId, act })
    if ("encounter" in res && res.encounter) {
      await show(ctx, combatText(res.encounter), combatKeyboard(res.encounter))
    }
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await answer(ctx, errText(e)) // مثل «این راند دیگر مالِ گذشته است» — کارتِ نبرد می‌ماند
  }
}

// ─── 💗 تعامل ────────────────────────────────────────────────────────────────

/** پشتیبانِ محلیِ ۹ تعامل (V10) — فقط وقتی موتور فهرست را نفرستاد */
const INTERACT_FALLBACK: { key: string; label: string; icon: string; cost: number }[] = [
  { key: "comfort", label: "آرامش‌دادن", icon: "💗", cost: 0 },
  { key: "praise", label: "تحسین", icon: "🎀", cost: 0 },
  { key: "talk", label: "گفت‌وگو", icon: "🗣️", cost: 0 },
  { key: "treat", label: "شیرینی‌دادن", icon: "🍰", cost: 150 },
  { key: "restTogether", label: "استراحتِ توأمان", icon: "💤", cost: 0 },
  { key: "practice", label: "تمرینِ هم‌افزا", icon: "✨", cost: 0 },
  { key: "celebrate", label: "جشنِ کوچک", icon: "🎉", cost: 250 },
  { key: "gift", label: "هدیه‌دادن", icon: "🎁", cost: 400 },
  { key: "memory", label: "مرورِ خاطره", icon: "📖", cost: 0 },
]

/** کلیدهای تعاملِ مجاز (V10 — ۹ نوع؛ جشن/هدیه/مرورِ خاطره تازه‌اند) */
const INTERACT_KEYS = new Set(INTERACT_FALLBACK.map((i) => i.key))

/** سطرِ دکمه‌ی تعامل: «🎁 هدیه‌دادن (۴۰۰ سکه)» — بی‌هزینه بدونِ پرانتز */
function interactButtonLabel(it: { icon: string; label: string; moneyCost: number }): string {
  return `${it.icon} ${clampText(it.label, 18)}${it.moneyCost > 0 ? ` (${faNum(it.moneyCost)} سکه)` : ""}`
}

function interactKeyboard(items: { icon: string; label: string; moneyCost: number; key: string }[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  items.forEach((it, i) => {
    const btn = kb.text(interactButtonLabel(it), `fwi:${it.key}`).style(it.moneyCost > 0 ? "danger" : "success")
    if (i % 2 === 1) btn.row()
  })
  kb.row()
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  return kb
}

/** فهرستِ تعامل‌ها برای رندر — از موتور، وگرنه پشتیبانِ محلی */
function interactItems(data: SoulGetData): { icon: string; label: string; moneyCost: number; key: string }[] {
  if (data.interactions && data.interactions.length > 0) {
    return data.interactions.map((it) => ({ icon: it.icon, label: it.label, moneyCost: it.moneyCost, key: it.key }))
  }
  return INTERACT_FALLBACK.map((it) => ({ icon: it.icon, label: it.label, moneyCost: it.cost, key: it.key }))
}

/** fw:interact — منویِ ۹ تعامل (V10 — مستقیم از موتور) */
async function showInteract(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  const lines = [
    "💗 <b>تعامل با فمبوی</b>",
    SEP,
    "",
    `❤️ روحیه ${pct(card.spirit)} (${card.condition.emoji} ${esc(card.condition.label)}) · 🤝 پیوند ${chip(card.bond)}`,
    card.interactCooldownMin > 0
      ? `⏳ فمبویت نفس می‌خواهد — ${chip(card.interactCooldownMin)} دقیقه دیگر`
      : "فمبویت آماده‌ی تعامل است.",
    "",
    SUB,
    "",
    `<i>هر ${chip(10)} دقیقه یک تعامل — 🍰 ${chip(150)} · 🎉 ${chip(250)} · 🎁 ${chip(400)} سکه · 📖 مرورِ خاطره همیشه آزاد است.</i>`,
  ]
  await show(ctx, lines.join("\n"), interactKeyboard(interactItems(data)))
}

/** fwi:{kind} — اجرای تعامل */
async function onInteract(ctx: Context, kind: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (!INTERACT_KEYS.has(kind)) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "interact", { kind })
    const lines = [`💗 ${esc(res.message)}`]
    // V17-W2 (§13/§15): واکنشِ تازه‌ی پیوند — همان‌جا که باز شده جشن گرفته می‌شود،
    // نه فقط در سابقه. فیلد از V14 در موتور بود؛ حالا این سطح هم می‌خواندش.
    if (res.unlock) {
      lines.push("", `🔓 واکنشِ تازه‌ی پیوند باز شد: ${esc(res.unlock.text)}`)
    }
    if (res.card) {
      lines.push(
        "",
        SUB,
        "",
        `❤️ روحیه ${pct(res.card.spirit)} (${res.card.condition.emoji} ${esc(res.card.condition.label)}) · 🤝 پیوند ${chip(res.card.bond)}`,
        // V17-W2 (§16): زبانِ واحدِ «🧭 بعدی» — همان گرامری که کار/قمار/استراحت
        // از V4 دارند؛ تعاملِ فمبوی هم حالا قدمِ بعدیِ روشن می‌گوید.
        res.card.interactCooldownMin > 0
          ? `🧭 بعدی: ⏳ ${chip(res.card.interactCooldownMin)} دقیقه دیگر دوباره تعامل`
          : "🧭 بعدی: 💗 دوباره تعامل",
      )
    }
    const kb = new InlineKeyboard()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
    kb.text("💗 تعامل", "fw:interact").primary().row()
    await show(ctx, lines.join("\n"), kb)
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    const kb = new InlineKeyboard()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
    kb.text("💗 تعامل", "fw:interact").primary().row()
    await show(ctx, `⏳ ${errText(e)}`, kb) // کول‌داون — صدای موتور
  }
}

// ─── ✨ مهارت‌ها (درختِ سه‌شاخه — V10) ──────────────────────────────────────────

/** ترتیب و آیکنِ شاخه‌ها — برچسبِ فارسی از موتور (branchLabel) می‌آید */
const BRANCH_ORDER: { key: "core" | "life" | "art"; icon: string; label: string }[] = [
  { key: "core", icon: "⚔️", label: "هسته‌ی رزمی" },
  { key: "life", icon: "🌿", label: "مسیرِ زندگی" },
  { key: "art", icon: "🌌", label: "قله‌ی هنر" },
]

function pips(n: number, max: number): string {
  return "●".repeat(Math.max(0, Math.min(n, max))) + "○".repeat(Math.max(0, max - n))
}

/** fw:skills — درختِ مهارت در سه شاخه با نشانِ رتبه و دکمه‌ی ارتقا */
async function showSkills(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  const lines = [
    `✨ <b>مهارت‌های ${esc(card.name)}</b>`,
    SEP,
    "",
    `🎖 نقطه‌مهارت ${chip(card.skillPoints)} · ⭐ سطح ${chip(card.level)}`,
  ]
  const kb = new InlineKeyboard()
  const skills = card.skills.slice(0, 9)
  if (skills.length === 0) {
    lines.push("<i>هنوز مهارتی در کارت نیست.</i>")
    lines.push("", "<i>شهر هنوز چیزی به او یاد نداده است.</i>")
  }
  // گروه‌بندی بر اساسِ شاخه (میدانِ branch از موتورِ V10؛ پیش‌فرض: هسته)
  const byBranch = new Map<string, typeof skills>()
  for (const s of skills) {
    const b = s.branch ?? "core"
    const arr = byBranch.get(b) ?? []
    arr.push(s)
    byBranch.set(b, arr)
  }
  for (const br of BRANCH_ORDER) {
    const list = byBranch.get(br.key)
    if (!list || list.length === 0) continue
    lines.push("", SUB, "")
    lines.push(`${br.icon} <b>${esc(list[0]?.branchLabel ?? br.label)}</b>`)
    lines.push("")
    for (const s of list) {
      const mark = s.locked ? " 🔒" : s.rank >= s.maxRank ? " ✅" : ""
      lines.push(
        `${s.icon} <b>${esc(s.name)}</b> — رتبه ${chip(`${faNum(s.rank)}/${faNum(s.maxRank)}`)} ${pips(s.rank, s.maxRank)}${mark}`,
      )
      const detail = s.locked ? (s.lockedReason ?? "قفل است") : s.effectPreview
      lines.push(`<i>${esc(clampText(detail, 100))}</i>`)
      lines.push("")
    }
  }
  if (card.skills.length > skills.length) {
    lines.push(`<i>… و ${chip(card.skills.length - skills.length)} مهارتِ دیگر</i>`)
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  for (const s of skills) {
    if (s.canUpgrade) {
      kb.text(`ارتقای ${clampText(s.name, 14)} · ${faNum(s.spCost)}✨`, `fwk:${s.id}`).success().row()
    }
  }
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  await show(ctx, lines.join("\n"), kb)
}

/** fwk:{skillId} — ارتقای مهارت */
async function onSkillUp(ctx: Context, skillId: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "skillup", { skillId })
    await answer(ctx, `✅ ${res.message}`) // توست
    await showSkills(ctx) // تازه‌سازی در همان پیام
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await answer(ctx, errText(e))
  }
}

// ─── 🌌 فرگشت (انتخابِ شاخه — V10) ─────────────────────────────────────────────

/** یک شاخه‌ی فرگشت به‌شکلِ بلوکِ متن: نام + مسیر + روایت + پیش‌نمایش + شرط‌ها */
function evolutionOptionLines(opt: {
  emoji: string
  name: string
  pathLabel?: string
  lore: string
  preview?: string
  requirements: { label: string; done: boolean }[]
}): string[] {
  const reqLine = opt.requirements.map((r) => `${r.done ? "✅" : "✖"} ${esc(r.label)}`).join(" · ")
  return [
    `${opt.emoji} <b>${esc(opt.name)}</b> — ${esc(opt.pathLabel ?? "مسیرِ اصلی")}`,
    expand(`<i>${esc(clampText(opt.lore, 130))}</i>`),
    ...(opt.preview ? [`⚙️ ${spoiler(esc(clampText(opt.preview, 80)))}`] : []),
    ...(reqLine ? [reqLine] : []),
  ]
}

/** fw:evo — شکلِ فعلی + نردبانِ طی‌شده + هر دو شاخه‌ی مرحله‌ی بعد */
async function showEvolution(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  // فرمِ فعلی: از نردبان (isCurrent) — با مسیرِ انتخاب‌شده اگر شاخه رفته باشد
  const current = card.evolutions.find((e) => e.isCurrent) ?? null
  const pathPart = current?.isChosen && current.pathLabel ? ` (${esc(current.pathLabel)})` : ""
  const lines: string[] = ["🌌 <b>فرگشت</b>", SEP, ""]
  lines.push(`شکلِ فعلی: ${card.evolutionEmoji} <b>${esc(card.evolutionName)}</b>${pathPart}`)
  // نردبانِ طی‌شده — فرم‌های انتخاب‌شده‌ی گذشته
  const ladder = card.evolutions.filter((e) => e.isChosen && !e.isCurrent)
  if (ladder.length > 0) {
    lines.push(`نردبانِ طی‌شده: ${ladder.map((e) => `${e.emoji} ${esc(clampText(e.name, 22))}`).join(" ← ")}`)
  }
  const next = card.nextEvolution ?? null
  const kb = new InlineKeyboard()
  if (!next || next.options.length === 0) {
    lines.push("", SUB, "", "به آخرِ مسیرِ فرگشت رسیده‌ای — جایی که افسانه‌ها تمام نمی‌شوند.")
  } else {
    lines.push("", SUB, "", `🌙 <b>فرگشتِ بعدی — مرحله‌ی ${chip(next.stage)}</b>`, "")
    for (const [i, opt] of next.options.slice(0, 2).entries()) {
      if (i > 0) lines.push(DOTS, "")
      lines.push(...evolutionOptionLines(opt))
      lines.push("")
    }
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    if (next.eligible) {
      lines.push("", "🌙 شکلِ بعدی آماده است — شاخه‌ات را انتخاب کن:")
      next.options.slice(0, 2).forEach((opt, i) => {
        kb.text(`${opt.emoji} ${clampText(opt.name, 16)}`, `fw:evoGo:${i}`).success()
      })
      kb.row()
    } else {
      lines.push("", "<i>شرط‌ها هنوز کامل نیست — شهر صبور است.</i>")
    }
  }
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  await show(ctx, lines.join("\n"), kb)
}

/** fw:evoGo:{0|1} — گامِ تأییدِ برگشت‌ناپذیر: پیش‌نمایشِ بی‌حالت + هشدار + تثبیت/برگشت */
async function onEvolveGo(ctx: Context, choice: number): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (choice !== 0 && choice !== 1) {
    await answer(ctx)
    return
  }
  let decision: EvolutionChoiceDTO | null = null
  try {
    const res = await api.soulEvolutionChoice(tgId(ctx))
    decision = res.decision ?? null
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!decision || decision.options.length < 2 || !decision.eligible) {
    await answer(ctx, "این شاخه الان آماده نیست — شرط‌ها را ببین.")
    await showEvolution(ctx)
    return
  }
  const opt = decision.options[choice]!
  const lines = [
    "🌌 <b>تثبیتِ فرگشت</b>",
    SEP,
    "",
    `شاخه‌ی انتخابی: ${opt.emoji} <b>${esc(opt.name)}</b> — ${esc(opt.pathLabel ?? "مسیرِ اصلی")}`,
    ...(opt.preview ? [`⚙️ ${spoiler(esc(clampText(opt.preview, 80)))}`] : []),
    "",
    SUB,
    "",
    "⚠️ این انتخاب برای همیشه می‌ماند — کلاسِ همیشگی می‌ماند اما فرم و مسیرِ این مرحله دیگر عوض نمی‌شود. مطمئنی؟",
  ]
  const kb = new InlineKeyboard()
  kb.text("✅ تثبیت", `fw:evoYes:${choice}`).success()
  kb.text("↩️ برگشت", "fw:evo").primary().row()
  await show(ctx, lines.join("\n"), kb)
}

/** fw:evoYes:{0|1} — اجرای فرگشت با شاخه‌ی انتخاب‌شده + هابِ تازه */
async function onEvolveYes(ctx: Context, choice: number): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (choice !== 0 && choice !== 1) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "evolve", { choice })
    const lines = [`🌌 ${esc(res.message)}`]
    if (res.card) {
      lines.push(
        "",
        SUB,
        "",
        `${res.card.evolutionEmoji} <b>${esc(res.card.evolutionName)}</b> — شکلِ تازه‌ی ${esc(res.card.name)}`,
      )
    }
    await show(ctx, lines.join("\n"), new InlineKeyboard())
    if (res.card) await sendHub(ctx, res.card) // هابِ تازه با شکلِ نو
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    const kb = new InlineKeyboard()
    kb.text("↩️ برگشت", "fw:evo").primary()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary().row()
    await show(ctx, `⚠️ ${errText(e)}`, kb)
  }
}

// ─── 🕰 سابقه ────────────────────────────────────────────────────────────────

/** fw:history — ۱۰ رویدادِ آخرِ فمبوی */
async function showHistory(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists) {
    await noCharacter(ctx)
    return
  }
  const allLogs = data.logs ?? []
  const logs = allLogs.slice(0, 10)
  const lines = ["🕰 <b>سابقه‌ی فمبوی</b>", SEP, ""]
  if (logs.length === 0) {
    lines.push("<i>هنوز چیزی ننوشته.</i>")
    lines.push("", "<i>سابقه با اولین قدم شروع می‌شود.</i>")
  } else {
    // ۳ رویدادِ آخرِ نمایان؛ بقیه زیرِ پرده‌ی بازشدنی — صفحه کوتاه می‌ماند
    const entry = (l: { icon: string; text: string; at: string }): string =>
      `${l.icon} ${esc(clampText(l.text, 90))} <i>· ${esc(shortDate(l.at))}</i>`
    for (const l of logs.slice(0, 3)) lines.push(entry(l))
    const rest = logs.slice(3)
    if (rest.length > 0) {
      lines.push("", expand(rest.map(entry).join("\n")))
    }
    if (allLogs.length > logs.length) {
      lines.push("", `<i>… و ${chip(allLogs.length - logs.length)} رویدادِ کهنه‌تر</i>`)
    }
  }
  const kb = new InlineKeyboard().text("🏠 هابِ فمبوی", "fw:hub").primary()
  await show(ctx, lines.join("\n"), kb)
}

// ─── 🎨 ظاهر و استایل (کیهانات — V10) ──────────────────────────────────────────

/** برچسبِ فارسیِ هر جایِ ظاهر */
const KIND_LABEL: Record<CosmeticDTO["kind"], string> = {
  accessory: "اکسسوار",
  palette: "پالتِ رنگ",
  frame: "قاب",
}

/** آیکنِ هر جایِ ظاهر */
const KIND_ICON: Record<CosmeticDTO["kind"], string> = {
  accessory: "🎀",
  palette: "🖌",
  frame: "🖼",
}

/** سرنخِ صادقانه‌ی منبعِ بازشدنِ هر جنس (آینه‌ی content/appearance.ts موتور) */
const KIND_HINT: Record<CosmeticDTO["kind"], string> = {
  accessory: `با پیمان، پیوندِ ${chip(100)}، فرگشت، کلاس-تسلط و سطح باز می‌شوند`,
  palette: `با کلاس-تسلط و سطحِ ${chip(20)} باز می‌شوند`,
  frame: `با سطحِ ${chip(10)} و ${chip(30)} و کلاس-تسلط باز می‌شوند`,
}

const COSMETIC_KINDS: CosmeticDTO["kind"][] = ["accessory", "palette", "frame"]

/** متنِ صفحه‌ی ظاهر: پوشیده‌ها + کلکسیونِ هر جنس (ایموجی + نام + منبع) */
function styleText(card: SoulCardDTO): string {
  const app = card.appearance ?? { equipped: { accessory: null, palette: null, frame: null }, owned: [] }
  const eq = app.equipped
  const lines: string[] = [`🎨 <b>ظاهر و استایل — ${esc(card.name)}</b>`, SEP, ""]
  lines.push(`🎀 اکسسوار: ${eq.accessory ? `${eq.accessory.emoji} ${esc(eq.accessory.name)}` : "—"}`)
  lines.push(`🖌 پالت: ${eq.palette ? `${eq.palette.emoji} ${esc(eq.palette.name)}` : "—"}`)
  lines.push(`🖼 قاب: ${eq.frame ? `${eq.frame.emoji} ${esc(eq.frame.name)}` : "—"}`)
  for (const kind of COSMETIC_KINDS) {
    const all = app.owned.filter((c) => c.kind === kind)
    const items = all.slice(0, 8)
    lines.push("", SUB, "")
    lines.push(`${KIND_ICON[kind]} <b>${KIND_LABEL[kind]}</b>`)
    lines.push("")
    if (items.length === 0) {
      lines.push(`<i>${KIND_HINT[kind]}</i>`)
    } else {
      for (const c of items) {
        lines.push(`${c.emoji} ${esc(c.name)} — ${esc(clampText(c.sourceLabel, 40))}${c.equipped ? " · ✓ پوشیده" : ""}`)
      }
      if (all.length > items.length) {
        lines.push(`<i>… و ${chip(all.length - items.length)} ${KIND_LABEL[kind]}ِ دیگر</i>`)
      }
    }
  }
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  lines.push("", SUB, "", "<i>پالت‌ها رنگشان را در مینی‌اپ نشان می‌دهند — این‌جا فقط اسم‌شان را می‌بینی.</i>")
  return lines.join("\n")
}

/** دکمه‌ها: درآوردنِ جایِ پُر + پوشیدنِ هر بی‌پوشیده‌ی مالکیت‌شده */
function styleKeyboard(card: SoulCardDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  const app = card.appearance
  if (app) {
    for (const kind of COSMETIC_KINDS) {
      if (app.equipped[kind]) {
        kb.text(`درآوردنِ ${KIND_LABEL[kind]}`, `fw:strip:${kind}`).primary().row()
      }
    }
    for (const c of app.owned.slice(0, 12)) {
      if (!c.equipped) {
        kb.text(`${c.emoji} ${clampText(c.name, 16)}`, `fw:wear:${c.kind}:${c.key}`).success().row()
      }
    }
  }
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  return kb
}

/** fw:style — کیهاناتِ ظاهر (کارتِ تازه از اکشن می‌آید؛ وگرنه soulGet) */
async function showStyle(ctx: Context, seedCard?: SoulCardDTO): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let card: SoulCardDTO | null = seedCard ?? null
  if (!card) {
    let data: SoulGetData
    try {
      data = await api.soulGet(tgId(ctx))
    } catch (e) {
      await fail(ctx, e)
      return
    }
    card = data.card ?? null
  }
  if (!card) {
    await noCharacter(ctx)
    return
  }
  await show(ctx, styleText(card), styleKeyboard(card))
}

/** fw:wear:{kind}:{key} — پوشیدنِ کیهنات + تازه‌سازیِ همان صفحه */
async function onWear(ctx: Context, rest: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  const i = rest.indexOf(":")
  if (i <= 0) {
    await answer(ctx)
    return
  }
  const kind = rest.slice(0, i)
  const key = rest.slice(i + 1)
  if (!COSMETIC_KINDS.some((k) => k === kind) || !key) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "appearance", { slot: kind, key })
    await answer(ctx, `✅ ${res.message}`) // توست
    await showStyle(ctx, res.card ?? undefined)
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    // صدای موتور («هنوز مالِ تو نشده…») — صفحه‌ی ظاهر دست‌نخورده می‌ماند
    await answer(ctx, errText(e))
  }
}

/** fw:strip:{kind} — درآوردنِ کیهناتِ پوشیده */
async function onStrip(ctx: Context, kind: string): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (!COSMETIC_KINDS.some((k) => k === kind)) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "appearance", { slot: kind, key: null })
    await answer(ctx, `✅ ${res.message}`) // توست
    await showStyle(ctx, res.card ?? undefined)
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await answer(ctx, errText(e))
  }
}

// ─── 🎓 کلاس-تسلط (V10) ────────────────────────────────────────────────────────

/** متنِ صفحه‌ی کلاس-تسلط: پله‌ی فعلی + پیشرفت + کارهای واجدشرطِ امروز + راهِ رشد */
function masteryText(card: SoulCardDTO): string {
  const lines: string[] = [`🎓 <b>کلاس-تسلط — ${esc(card.name)}</b>`, SEP, ""]
  const m = card.mastery
  if (!m) {
    lines.push("<i>هنوز کارنامه‌ی تسلطی نوشته نشده.</i>")
    lines.push("", "<i>یک لحظه بعد دوباره تلاش کن.</i>")
    return lines.join("\n")
  }
  lines.push(`${m.emoji} <b>${esc(m.label)}</b> — سطح ${chip(`${faNum(m.level)}/10`)}`)
  if (m.perk && m.perk !== "—") {
    lines.push(`<i>${esc(clampText(m.perk, 110))}</i>`)
  }
  if (m.nextTierXp !== null && m.nextTierXp !== undefined) {
    const p = m.nextTierXp > 0 ? Math.min(100, Math.round((m.xp / m.nextTierXp) * 100)) : 0
    lines.push(`${bar(p)} ${pct(p)} · ${chip(`${faNum(m.xp)}/${faNum(m.nextTierXp)}`)} تسلط`)
  } else {
    lines.push(`🏅 سقفِ تسلط — ${chip(m.xp)} تسلط`)
  }
  lines.push("", SUB, "")
  lines.push("✅ <b>کارهای واجدشرطِ امروز:</b>")
  lines.push("")
  const allProofs = m.recentProofs ?? []
  const proofs = allProofs.slice(0, 5)
  if (proofs.length === 0) {
    lines.push("<i>هنوز چیزی ننوشته — با کلاست بجنگ، کار کن، تعامل کن.</i>")
  } else {
    for (const p of proofs) lines.push(`· ${esc(clampText(p, 90))}`)
    if (allProofs.length > proofs.length) {
      lines.push(`<i>… و ${chip(allProofs.length - proofs.length)} کارِ دیگر</i>`)
    }
  }
  lines.push("", SUB, "")
  lines.push("📈 <b>چطور رشد می‌کند؟</b>", "")
  lines.push(
    `پیروزی با کلاس ${chip("4+")} · شکست ${chip("1+")} · اجرای مهارتِ امضا ${chip("1+")} · اتفاقِ کمیابِ هم‌مسیرِ کلاس ${chip("3+")} · فرگشت ${chip("6+")} · تعاملِ روزانه ${chip("1+")}`,
  )
  lines.push("", "<i>سقف‌های روزانه دارد — تسلط با بازیِ معنادار ساخته می‌شود، نه با تکرار.</i>")
  return lines.join("\n")
}

function masteryKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🏆 تخته‌ی کلاس-تسلط", "fwh:mastery").primary().row()
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  return kb
}

/** fw:mastery — صفحه‌ی کلاس-تسلط */
async function showMastery(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  await show(ctx, masteryText(data.card), masteryKeyboard())
}

// ─── 🏆 تالارِ افتخارات (خصوصی + گروه) ────────────────────────────────────────

/** رقم‌های داخلِ برچسبِ موتور را تراش می‌کند — «سطح 12» → «سطح <code>12</code>».
 *  esc اول انجام می‌شود (فرارِ HTML + لاتین‌سازی)، بعد فقط رقم/ comma / درصد / اعشار تراش می‌خورد؛
 *  علامتِ درصدِ فارسی (٪) هم داخلِ تراش به % لاتین می‌شود تا با pct() یکدست بماند. */
function chipDigits(label: string): string {
  return esc(label).replace(/\d[\d,]*(?:\.\d+)?[%٪]?/g, (m) => `<code>${m.replace(/٪/g, "%")}</code>`)
}

function hallText(hall: HallDTO): string {
  const lines = [`🏆 <b>تالارِ افتخارات — ${esc(hall.boardLabel)}</b>`, SEP, ""]
  if (hall.entries.length === 0) {
    lines.push("<i>هنوز کسی اسمی از خودش نگذاشته…</i>")
    lines.push("", "<i>اولین افسانه تو باش.</i>")
  } else {
    hall.entries.slice(0, 10).forEach((e, i) => {
      const rank = i < 3 ? (MEDALS[i] ?? `${chip(e.rank)}.`) : `${chip(e.rank)}.`
      lines.push(
        `${rank} ${esc(clampText(e.characterName, 24))} ${e.classEmoji} — ${chipDigits(clampText(e.valueLabel, 40))} <i>(بازیکن: ${esc(clampText(e.playerName, 18))})</i>`,
      )
    })
    if (hall.entries.length > 10) {
      lines.push("", `<i>… و ${chip(hall.entries.length - 10)} افسانه‌ی دیگر</i>`)
    }
  }
  if (hall.note) lines.push("", `<i>${esc(hall.note)}</i>`)
  return lines.join("\n")
}

function hallKeyboard(hall: HallDTO, privateChat: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
  hall.boards.forEach((b, i) => {
    const cur = b.key === hall.board
    const btn = kb.text(`${b.icon} ${b.label}${cur ? " ✅" : ""}`, `fwh:${b.key}`).style(cur ? "success" : "primary")
    if (i % 2 === 1) btn.row()
  })
  kb.row()
  if (privateChat) kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  return kb
}

/** واکشیِ تالار — اگر بازیکن نبود، اول upsert بعد تلاشِ دوباره (نباید گره بخورد) */
async function fetchHall(ctx: Context, board: string): Promise<HallDTO | null> {
  const id = tgId(ctx)
  if (!id) return null
  try {
    return await api.hall(id, board)
  } catch (e) {
    if (e instanceof GameApiError && (e.code === "no_player" || e.code === "no_telegram_id")) {
      try {
        await api.auth(id, ctx.from?.first_name || ctx.from?.username)
      } catch {
        throw e
      }
      return await api.hall(id, board)
    }
    throw e
  }
}

/** نمایشِ تالار (fwh:{board} · fw:hall · /champ) — تخته‌ها از خودِ موتور
 *  می‌آیند (boards در پاسخ؛ شاملِ V10: 🎓 mastery). کلیدِ ناشناخته را موتور
 *  به level برمی‌گرداند — ربات لیست را hardcode نمی‌کند. */
async function showHall(ctx: Context, board: string): Promise<void> {
  const safeBoard = board.trim().slice(0, 24) || "level"
  let hall: HallDTO | null
  try {
    hall = await fetchHall(ctx, safeBoard)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!hall) {
    await answer(ctx)
    return
  }
  await show(ctx, hallText(hall), hallKeyboard(hall, isPrivate(ctx)))
}

/** /champ — تالار در گروه و خصوصی */
export async function handleChampCommand(ctx: Context): Promise<void> {
  await showHall(ctx, "level")
}

// ─── ⚡ شارژِ استقامت ─────────────────────────────────────────────────────────

function rechargeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("+3 (360 سکه)", "fwr:3").danger()
  kb.text("+6 (720 سکه)", "fwr:6").danger().row()
  kb.text("+9 (1,080 سکه)", "fwr:9").danger().row()
  kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
  return kb
}

/** fw:charge — منویِ شارژ */
async function showRecharge(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  const next = card.staminaMinutesToNext
  const lines = [
    "⚡ <b>شارژِ استقامت</b>",
    SEP,
    "",
    `استقامت ${chip(`${faNum(card.stamina)}/${faNum(card.staminaMax)}`)}${next ? ` · ⏳ ${chip(next)} دقیقه تا +1` : ""}`,
    "",
    SUB,
    "",
    `هر واحد ${chip(120)} سکه — همان‌جا که می‌ایستی، نفس می‌کشد.`,
  ]
  await show(ctx, lines.join("\n"), rechargeKeyboard())
}

/** fwr:{units} — خریدِ استقامت */
async function onRecharge(ctx: Context, units: number): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  if (![3, 6, 9].includes(units)) {
    await answer(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "recharge", { units })
    const lines = [`⚡ ${esc(res.message)}`]
    if (res.card) {
      lines.push("", SUB, "", `استقامت ${chip(`${faNum(res.card.stamina)}/${faNum(res.card.staminaMax)}`)}`)
    }
    await show(ctx, lines.join("\n"), rechargeKeyboard()) // دکمه‌ها می‌مانند برای شارژِ بیشتر
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    await show(ctx, `⚠️ ${errText(e)}`, rechargeKeyboard())
  }
}

// ─── 🧪 شربتِ روح / ✏️ تغییرِ نام (V8 — DoD 14؛ تا حالا فقط مینی‌اپ) ───────────

/** fwsp:go — یک‌ضرب: کیک از کیف یا 200 سکه → +22 روحیه (منطق و صدای موتور).
 *  پیامِ نتیجه + تازه‌سازیِ کارتِ هاب در جا. */
async function onSpiritPotion(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  try {
    const res = await api.soulAction(tgId(ctx), "potion")
    const lines = [`🧪 ${esc(res.message)}`]
    if (res.card) {
      lines.push(
        "",
        SUB,
        "",
        `❤️ روحیه ${pct(res.card.spirit)} (${res.card.condition.emoji} ${esc(res.card.condition.label)})`,
      )
    }
    await show(ctx, lines.join("\n"))
    if (res.card) await refreshHub(ctx, res.card)
  } catch (e) {
    if (isInfraError(e)) {
      await fail(ctx, e)
      return
    }
    const kb = new InlineKeyboard()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
    await show(ctx, `⚠️ ${errText(e)}`, kb) // صدای موتور: «تهِ سقف است» · «کیک نیست و 200 سکه هم نه»
  }
}

/** fw:rename — پرسیدنِ اسمِ تازه؛ پیش‌گشتِ کول‌داونِ 3 روزه از کارت.
 *  گامِ بعدی («rename» جریان) با اولین پیامِ متنیِ خصوصی مصرف می‌شود. */
async function onRenameAsk(ctx: Context): Promise<void> {
  if (!isPrivate(ctx)) {
    await privateNudge(ctx)
    return
  }
  const chatId = ctx.chat?.id
  if (chatId === undefined) return
  let data: SoulGetData
  try {
    data = await api.soulGet(tgId(ctx))
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card) {
    await noCharacter(ctx)
    return
  }
  const card = data.card
  if (card.renameCooldownMin > 0) {
    const kb = new InlineKeyboard()
    kb.text("🏠 هابِ فمبوی", "fw:hub").primary()
    await show(ctx, `✏️ اسمِ فعلی تا ${chip(Math.ceil(card.renameCooldownMin / 60))} ساعت دیگر می‌ماند.`, kb)
    return
  }
  setFlow(chatId, { step: "rename", idx: 0, at: Date.now() })
  await show(
    ctx,
    [
      "✏️ <b>تغییرِ نام</b>",
      SEP,
      "",
      `📛 اسمِ فعلی: <b>${esc(card.name)}</b>`,
      "",
      `اسمِ تازه را بنویس — بینِ ${chip(2)} تا ${chip(24)} حرف.`,
      "<i>برای انصراف بنویس: لغو</i>",
    ].join("\n"),
  )
}

// ─── 🎀 کارتِ عمومیِ فمبوی (V8 — نمایِ گروه؛ فقط داده‌های عمومی) ────────────────

/** تشخیصِ هدفِ فرمان در گروه (زنجیره‌ی اثبات‌شده‌ی /duel):
 *  ریپلای ← text_mention ← عدد (رقمِ فارسی/عربی هم) ← @usernameِ دیده‌شده.
 *  name = بهترین نامِ در دسترس برای پیام‌های خطا (موتور نامِ کامل را می‌فرستد). */
type TargetResolution = { targetId: string; name: string } | { miss: string } | null

function resolveCommandTarget(ctx: Context, verb: "duel" | "femboy"): TargetResolution {
  const msg = ctx.message
  if (!msg) return null
  const rt = msg.reply_to_message?.from
  if (rt && !rt.is_bot) return { targetId: String(rt.id), name: rt.first_name || rt.username || "" }
  for (const ent of msg.entities ?? []) {
    if (ent.type === "text_mention" && ent.user && !ent.user.is_bot) {
      return { targetId: String(ent.user.id), name: ent.user.first_name || ent.user.username || "" }
    }
  }
  const arg = typeof ctx.match === "string" ? ctx.match.trim() : ""
  if (!arg) return null
  if (arg.startsWith("@")) {
    const uname = arg.slice(1)
    const id = seenUsers.get(uname.toLowerCase())
    if (id) return { targetId: String(id), name: `@${uname}` }
    // miss از پیشِ امنِ HTML ساخته می‌شود (یوزرنیم esc · فرمان مونو) — بی‌esc نمایش داده می‌شود
    return {
      miss: `${esc(`@${uname}`)} را این‌جا ندیدم — روی پیامش ریپلای کن و ${chip(verb === "duel" ? "جنگ فمبوی" : "پیمان فمبوی")} بگو.`,
    }
  }
  const num = toNum(arg)
  if (Number.isFinite(num) && num > 0) return { targetId: String(num), name: "" }
  return null
}

/** کول‌داونِ سبکِ بازرسی در گروه — یک کارتِ عمومی در هر ۱۰ ثانیه برای هر چت (ضداسپم) */
const INSPECT_COOLDOWN_MS = 10_000
const inspectAt = new Map<number, number>()

/** کپشنِ کارتِ عمومی — فقط زیرمجموعه‌ی عمومی: کلاس/سطح/رتبه/تکامل/برد-باخت/عنوان
 *  V10: اکسسوارِ پوشیده کنارِ اسم + مسیرِ فرگشت + کلاس-تسلط */
function publicCardCaption(playerName: string, card: NonNullable<PublicFemboyCardDTO["card"]>, tail?: string): string {
  const accPart = card.accessoryEmoji ? ` ${card.accessoryEmoji}` : ""
  const pathPart = card.evolutionPathName ? ` (${esc(card.evolutionPathName)})` : ""
  const lines = [
    `🎀 <b>فمبویِ ${esc(playerName)}${accPart}</b>`,
    SEP,
    "",
    `${card.classEmoji} ${esc(card.className)} — ${esc(card.classRole)}`,
    ...(card.persona ? [`🎭 ${card.persona.emoji} ${esc(card.persona.name)} — <i>${esc(clampText(card.persona.tagline, 60))}</i>`] : []),
    ...(card.talent ? [`✨ ${card.talent.emoji} ${esc(card.talent.name)}`] : []),
    `🎖 ${card.rankEmoji} ${esc(card.rankName)} · ⭐ سطح ${chip(card.level)} · ${esc(card.evolutionName)}${pathPart}`,
    ...(card.mastery ? [`🎓 ${card.mastery.emoji} ${esc(card.mastery.label)} — سطحِ تسلط ${chip(card.mastery.level)}`] : []),
    `⚔️ نبرد ${chip(`${faNum(card.wins)}W/${faNum(card.losses)}L`)}`,
    `🏷 ${card.activeTitle ? `${card.activeTitle.emoji} ${esc(card.activeTitle.name)}` : "بی‌عنوان"}`,
  ]
  if (tail) lines.push("", tail)
  return lines.join("\n")
}

/** دکمه‌های کارتِ عمومی در گروه — همان ساختِ کارتِ /myfemboy (دوئل + تالار + مینی‌اپ).
 *  کال‌بک‌ها موجودند: fw:duel (راهنمای دوئل) · fwh:level (تالار). */
function publicCardKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("⚔️ دوئل", "fw:duel").primary()
  kb.text("🏆 تالارِ افتخارات", "fwh:level").primary().row()
  return withMiniApp(kb)
}

/** /femboy با هدف در گروه — بازرسیِ کارتِ عمومیِ فمبویِ بازیکنِ هدف */
async function inspectPublicCard(ctx: Context, targetId: string, fallbackName: string): Promise<void> {
  const chatId = ctx.chat?.id
  if (chatId !== undefined) {
    const last = inspectAt.get(chatId) ?? 0
    if (Date.now() - last < INSPECT_COOLDOWN_MS) {
      await show(ctx, "⏳ همین‌جا تازه کارتی گذاشته شده — چند لحظه دیگر دوباره بفرست.")
      return
    }
    inspectAt.set(chatId, Date.now())
  }
  if (targetId === tgId(ctx)) {
    await show(ctx, `این خودت هستی 🙂 فمبوی‌ات را با ${chip("فمبوی من")} نشان بده.`)
    return
  }
  let data: PublicFemboyCardDTO
  try {
    data = await api.publicCard(targetId)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.target) {
    await show(ctx, `${esc(fallbackName || "این بازیکن")} هنوز واردِ شهر نشده.`)
    return
  }
  if (!data.exists || !data.card) {
    await show(ctx, `فمبویِ اختصاصیِ ${esc(data.target.playerName)} هنوز پیمان نبسته.`)
    return
  }
  await sendPhotoCard(
    ctx,
    data.card.classKey,
    publicCardCaption(data.target.playerName, data.card, `برای دیدنِ فمبویِ خودت: ${chip("فمبوی من")}`),
    publicCardKeyboard(),
    evolutionArtFile(data.card),
  )
}

/** /myfemboy — خصوصی: همان هابِ کامل · گروه: کارتِ عمومیِ امنِ فمبویِ خود */
export async function handleMyFemboyCommand(ctx: Context): Promise<void> {
  if (!isGroupChat(ctx)) return handleFemboyCommand(ctx)
  const id = tgId(ctx)
  if (!id) return
  try {
    await api.auth(id, ctx.from?.first_name || ctx.from?.username)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  let data: PublicFemboyCardDTO
  try {
    data = await api.publicCard(id)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  if (!data.exists || !data.card || !data.target) {
    const name = data.target?.playerName || ctx.from?.first_name || "تو"
    const kb = new InlineKeyboard().url("🎀 بستنِ پیمانِ فمبوی", soulDeepLink()).primary()
    await show(ctx, `فمبویِ اختصاصیِ ${esc(name)} هنوز پیمان نبسته.`, kb)
    return
  }
  const kb = publicCardKeyboard()
  await sendPhotoCard(
    ctx,
    data.card.classKey,
    publicCardCaption(data.target.playerName, data.card, "فمبوی تو در این گپ شناخته شده."),
    kb,
    evolutionArtFile(data.card),
  )
}

// ─── ⚔️ /duel — دعوتِ دوئلِ رضایتی (V13 §5.2) ───────────────────────────────

// V13: دوئلِ گروهی دیگر آنی حل نمی‌شود — ربات دعوت‌نامه را به موتورِ شهر
// می‌سپارد (action:"command" · command:"duel {targetTelegramId}") و فقط رندر
// است: کارتِ ack/راهنما/خطا همه از موتور می‌آیند؛ دعوت‌نامه از outbox با دکمه‌های
// gc:{id}:{accept|decline|cancel} می‌رسد. مسیرِ خصوصی (راهنمای دوئل) دست‌نخورده است.

export async function handleDuelCommand(ctx: Context): Promise<void> {
  if (!isGroupChat(ctx)) {
    const kb = new InlineKeyboard().url("⚔️ دوئل در گروهِ تو", privateLink(botUsername())).primary()
    await show(
      ctx,
      [
        "⚔️ <b>دوئل</b>",
        SEP,
        "",
        "دوئلِ فمبوی‌ها در گروه‌ها انجام می‌شود:",
        "",
        `· روی پیامِ حریف <b>ریپلای</b> کن و ${chip("جنگ فمبوی")} بگو`,
        `· یا از کارتِ عمومیِ فمبوی‌اش دکمه‌ی ⚔️ دوئل را بزن`,
        "",
        `<i>هر دوئل ${chip(4)} استقامت از هر طرف می‌گیرد؛ رقیب باید دعوت‌نامه را قبول کند — شهرِ دعوت‌های بی‌جواب را دفن می‌کند.</i>`,
      ].join("\n"),
      kb,
    )
    return
  }
  const me = tgId(ctx)
  if (!me) return
  const foe = resolveCommandTarget(ctx, "duel")
  if (foe && "miss" in foe) {
    await show(ctx, `⚔️ ${foe.miss}`)
    return
  }
  try {
    await api.auth(me, ctx.from?.first_name || ctx.from?.username)
  } catch (e) {
    await fail(ctx, e)
    return
  }
  // هدف حل‌شده → فرمانِ «duel {targetTelegramId}» به موتورِ شهر؛ بدونِ هدف →
  // کارتِ راهنمای موتور. مسیرِ آنیِ /api/game/combat برای گروه‌ها برداشته شد.
  await sendEngineCommand(ctx, foe ? `duel ${foe.targetId}` : "duel")
}

// ─── مسیریابِ کال‌بک‌های سول‌باند ─────────────────────────────────────────────

const SOUL_CB_PREFIXES = ["fw:", "fwa:", "fwi:", "fwk:", "fwh:", "fwt:", "fwr:", "fwsp:", "fwd:"] as const

/** آیا این callback-data مالِ لایه‌ی فمبویِ روح‌بسته است؟ */
export function isSoulCallbackData(data: string | undefined): boolean {
  if (!data) return false
  return (SOUL_CB_PREFIXES as readonly string[]).some((p) => data.startsWith(p))
}

const PRIVATE_ONLY_VERBS = new Set([
  "begin",
  "next",
  "prev",
  "pNext", // V19 — ناوبریِ انتخابگرِ طبع
  "pPrev",
  "name2",
  "confirm",
  "hunt",
  "interact",
  "skills",
  "evo",
  "evoGo", // قدیمیِ بدونِ آرگومان (V9) — به صفحه‌ی انتخابِ شاخه برمی‌گردد
  "evoYes",
  "history",
  "charge",
  "style",
  "mastery",
  "rename", // V8 — تغییرِ نام: جریانِ متنیِ خصوصی
  "about", // V19 — کارتِ طبع/استعداد
  "story", // V19 — داستانِ شخصی
])

/** فعل‌های خصوصیِ آرگومان‌دار (پیشوندی) — evoGo:/evoYes:/wear:/strip:/persona: */
const PRIVATE_ONLY_VERB_PREFIXES = ["evoGo:", "evoYes:", "wear:", "strip:", "persona:"] as const

export async function handleSoulCallback(ctx: Context, data: string): Promise<void> {
  // V15-3 — پنلِ فمبوی پنلِ شخصی است: هویتش در چتِ خصوصی مُهر می‌شود (§3A)؛
  // فعل‌هایِ شخصی که در گروه بیفتند از دروازه‌ی guardOwnerPanel رد می‌شوند
  // (متنِ مأموریت + دکمه‌ی پنلِ خودت؛ پیش از هر فراخوانیِ موتور). تالار (fwh:/hall)
  // عمومی می‌ماند و fw:hub/duel هم‌جنان در گروه زنده‌اند (هابِ جمع‌وجور/راهنمای دوئل).
  if (isPrivate(ctx)) openPrivatePanel(ctx, { type: "fw", nav: data })
  // fw:* — هاب و جریانِ پیمان
  if (data.startsWith("fw:")) {
    const verb = data.slice(3)
    if (verb.startsWith("class:")) {
      if (await guardOwnerPanel(ctx, { panel: "fw" })) return
      await onPickClass(ctx, verb.slice(6))
      return
    }
    // V19 — انتخابِ طبع در مراسمِ پیمان
    if (verb.startsWith("persona:")) {
      if (await guardOwnerPanel(ctx, { panel: "fw" })) return
      await onPickPersona(ctx, verb.slice(8))
      return
    }
    // زیرصفحه‌های خصوصی — در گروه فقط تالار و هابِ جمع‌وجور زنده‌اند
    const privateOnly =
      PRIVATE_ONLY_VERBS.has(verb) ||
      verb === "" ||
      PRIVATE_ONLY_VERB_PREFIXES.some((p) => verb.startsWith(p))
    if (privateOnly && (await guardOwnerPanel(ctx, { panel: "fw" }))) return
    switch (verb) {
      case "hub":
        return soulHub(ctx)
      case "begin":
        return onBegin(ctx)
      case "next":
        return onPickerNav(ctx, 1)
      case "prev":
        return onPickerNav(ctx, -1)
      case "pNext":
        return onPersonaNav(ctx, 1)
      case "pPrev":
        return onPersonaNav(ctx, -1)
      case "name2":
        return onAskName(ctx)
      case "confirm":
        return onConfirm(ctx)
      case "hunt":
        return showHunt(ctx)
      case "interact":
        return showInteract(ctx)
      case "skills":
        return showSkills(ctx)
      case "evo":
        return showEvolution(ctx)
      case "evoGo":
        // کال‌بکِ کهنه‌ی بدونِ آرگومان (پیام‌های V9) — دیگر مستقیم فرگشت نمی‌دهد؛
        // به صفحه‌ی انتخابِ شاخه (که تأییدِ برگشت‌ناپذیر دارد) برمی‌گردد.
        return showEvolution(ctx)
      case "history":
        return showHistory(ctx)
      case "hall":
        return showHall(ctx, "level")
      case "charge":
        return showRecharge(ctx)
      case "style":
        return showStyle(ctx)
      case "mastery":
        return showMastery(ctx)
      case "about":
        return showPersona(ctx)
      case "story":
        return showStory(ctx)
      case "rename":
        return onRenameAsk(ctx)
      case "duel":
        // V8 — راهنمای دوئل روی کارتِ عمومی (توست؛ در گروه و خصوصی بی‌صدا کار می‌کند)
        // V16-1 — آموزشِ بدونِ اسلش: ریپلای + عبارتِ «جنگ فمبوی» (همان مسیرِ زنده‌ی intent)
        return answer(ctx, "برای دوئل: روی پیامِ حریف ریپلای کن و «جنگ فمبوی» بگو.")
      default:
        // V10 — فعل‌های آرگومان‌دار: فرگشتِ شاخه‌ای و کیهاناتِ ظاهر
        if (verb.startsWith("evoGo:")) return onEvolveGo(ctx, toNum(verb.slice(6)))
        if (verb.startsWith("evoYes:")) return onEvolveYes(ctx, toNum(verb.slice(7)))
        if (verb.startsWith("wear:")) return onWear(ctx, verb.slice(5))
        if (verb.startsWith("strip:")) return onStrip(ctx, verb.slice(6))
        await answer(ctx)
        return
    }
  }
  // پیشوندهای عملیاتی
  if (data.startsWith("fwa:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwa" })) return
    const rest = data.slice(4)
    const i = rest.lastIndexOf(":")
    if (i > 0) return onCombatAct(ctx, rest.slice(0, i), rest.slice(i + 1))
    await answer(ctx)
    return
  }
  if (data.startsWith("fwi:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwi" })) return
    return onInteract(ctx, data.slice(4))
  }
  if (data.startsWith("fwk:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwk" })) return
    return onSkillUp(ctx, data.slice(4))
  }
  if (data.startsWith("fwt:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwt" })) return
    return onStartFight(ctx, data.slice(4))
  }
  if (data.startsWith("fwr:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwr" })) return
    return onRecharge(ctx, toNum(data.slice(4)))
  }
  // V19 — داستانِ شخصی: انتخابِ فصل
  if (data.startsWith("fwd:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwd" })) return
    return onStoryChoose(ctx, toNum(data.slice(4)))
  }
  // V8 — شربتِ روح (DoD 14): یک‌ضرب از هاب
  if (data.startsWith("fwsp:")) {
    if (await guardOwnerPanel(ctx, { panel: "fwsp" })) return
    if (data.slice(5) !== "go") {
      await answer(ctx)
      return
    }
    return onSpiritPotion(ctx)
  }
  if (data.startsWith("fwh:")) {
    return showHall(ctx, data.slice(4)) // تالار در گروه و خصوصی زنده است
  }
  await answer(ctx)
}

// ─── V19: هندلرهایِ نیتِ زبانِ طبیعیِ شخصیتِ عمیق (intent.ts → handlers.ts) ──────

/** «شخصیتش رو بیشتر بشناسم» / «طبعش چیه؟» — کارتِ طبع + استعداد/ضعف + ماتریس */
export async function handlePersonaCommand(ctx: Context): Promise<void> {
  await showPersona(ctx)
}

/** «استعدادهاش چیه؟» / «برای چه کاری مناسبه؟» — همان کارتِ شخصیت (بخشِ استعداد/ماتریس درِ آن) */
export async function handleTalentsCommand(ctx: Context): Promise<void> {
  await showPersona(ctx)
}

/** «داستانش رو ادامه بده» / «داستان فمبوی» — فصلِ جاری + انتخاب‌ها */
export async function handleStoryCommand(ctx: Context): Promise<void> {
  await showStory(ctx)
}
