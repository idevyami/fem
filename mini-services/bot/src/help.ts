// FEMBOY WAR 🎀 — V15-2: مرورگرِ تعاملیِ کدکس در گفت‌وگوی خصوصی (مأموریت §6).
//
// راهنما یک «سیستمِ ناوبری» است، نه یک مقاله‌ی بزرگِ چسبیده به تلگرام. این
// ماژول درختِ کدکسِ موتور (15 دسته × 111 موضوع — POST /api/game/help با
// service-key + telegramId) را روی کارت‌های خصوصی می‌نشاند:
//
//     خانه‌ی دسته‌ها → موضوع‌های دسته (12 در صفحه) → صفحه‌ی موضوع
//                    (4 بلوک در صفحه — صفحه‌بندیِ سمتِ سرورِ موتور)
//
// ناوبریِ درجا: همه‌ی کارت‌ها با show() رندر می‌شوند — در callback همان پیام
// ویرایش می‌شود و اگر نشد پیامِ تازه می‌آید (الگویِ soul.ts). پیوی تمیز
// می‌ماند؛ هر کلیک مقاله‌ی تازه نمی‌ریزد (ضدِ اسپمِ مقاله).
//
// گرامرِ کال‌بک (hp: = help-private — فقط پیوی؛ در گروه «راهنما» از قبل به
// کدکسِ gh: موتور می‌رود و همان می‌ماند):
//   hp:h                        خانه‌ی راهنما (دسته‌ها)
//   hp:c:{catId}[:{page}]       فهرستِ موضوع‌های دسته (12 در صفحه)
//   hp:t:{topicId}:{page}       صفحه‌ی موضوع (بلوک‌ها/عبارت‌ها/مثال‌ها/مرتبط‌ها)
// شناسه‌ی کهته/نامعتبر → کارتِ یک‌خطیِ مهربان (لحنِ STALE_CARD کدکسِ گروهی)
// با دکمه‌ی «↩ راهنما» — نه خطا.
//
// نرخ: دسته‌ها 60 ثانیه کشِ درون‌حافظه‌ای دارند (رضایتیِ نرخِ 120/دقیقه‌ی
// موتور — دسته‌ها برای همه یکسان‌اند)؛ موضوع‌ها و دسته‌ها هنگامِ باز شدن
// همیشه تازه واکشی می‌شوند. متن‌ها همه از esc() می‌گذرند و رقم‌ها با
// show() انگلیسی به تلگرام می‌رسند — همان زبانِ شیشه‌ی بقیه‌ی کارت‌ها.

import { InlineKeyboard } from "grammy"
import type { Context } from "grammy"
import { api, GameApiError } from "./api"
import type { HelpCategoryDTO } from "./api"
import { backKeyboard, CB } from "./keyboards"
import { fail, show, tgId } from "./ui"
import { chip, clampText, esc, SEP, SUB } from "./format"

// ─── ثابت‌های رندر ─────────────────────────────────────────────────────────────

/** عمرِ کشِ دسته‌ها — دسته‌ها برای همه‌ی بازیکن‌ها یکسان‌اند */
const CATEGORIES_TTL_MS = 60_000
/** موضوع در هر صفحه‌ی فهرستِ دسته — همان سقفِ کدکسِ گروهی (gh:c) */
const TOPICS_PER_PAGE = 12
/** سقفِ نویسه‌ی برچسبِ جفت‌شونده — خواناییِ موبایل (همان قاعده‌ی outboxKeyboard) */
const PAIR_LABEL_MAX = 14

// ─── گرامرِ کال‌بک ─────────────────────────────────────────────────────────────

/** خانه‌ی راهنما */
export const CB_HELP_HOME = "hp:h"
/** دسته با صفحه‌ی اختیاری — صفحه‌ی 0 حذف می‌شود تا بایت‌ها کم بمانند */
export const cbHelpCat = (catId: string, page = 0): string =>
  `hp:c:${catId}${page > 0 ? `:${page}` : ""}`
/** موضوع با صفحه — صفحه همیشه می‌آید (بدونِ آن هم 0 فرض می‌شود) */
export const cbHelpTopic = (topicId: string, page: number): string => `hp:t:${topicId}:${page}`

/** آیا این callback-data مالِ کدکسِ خصوصی است؟ */
export function isHelpCallbackData(data: string | undefined): boolean {
  return typeof data === "string" && data.startsWith("hp:")
}

/** ردیفِ امنِ عددِ صفحه از قطعه‌های کال‌بک */
function toPage(raw: string | undefined): number {
  const n = Number(raw ?? "0")
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

// ─── کشِ دسته‌ها (globalThis-guard — از reloadِ داغ جان سالم به در می‌برد) ──────

const gHelp = globalThis as typeof globalThis & {
  __femwarHelpCats?: { at: number; cats: HelpCategoryDTO[] }
}
const helpCats: { at: number; cats: HelpCategoryDTO[] } = gHelp.__femwarHelpCats ?? {
  at: 0,
  cats: [],
}
gHelp.__femwarHelpCats = helpCats

function cachedCategories(): HelpCategoryDTO[] | null {
  if (helpCats.cats.length > 0 && Date.now() - helpCats.at < CATEGORIES_TTL_MS) {
    return helpCats.cats
  }
  return null
}

// ─── کیبوردِ راهنما — جفت‌جفت برای برچسب‌های کوتاه (قصدِ گریدِ موبایل) ──────────

interface HelpBtn {
  label: string
  cb: string
}

/** «row» = جداسازِ بخش‌ها — ردیفِ باز را می‌بندد تا دکمه‌یِ پایین با دکمه‌یِ
 *  بالایی جفت نشود (دکمه‌یِ برگشت همیشه ردیفِ خودش را دارد). */
type HelpItem = HelpBtn | "row"

/** برچسبِ کوتاهِ جفت‌شونده؟ — طولِ نویسه‌ای بدونِ ZWJ (ایموجیِ ترکیبی یکی حساب می‌شود) */
function shortLabel(label: string): boolean {
  return Array.from(label.replace(/\u200D/g, "")).length <= PAIR_LABEL_MAX
}

/** کیبوردِ راهنما — دکمه‌هایِ کوتاهِِ پشت‌سرِهم جفت می‌شوند (حداکثر ۲ در ردیف)؛
 *  دکمه‌یِ بلند ردیفِ تمام‌عرضِ خودش را می‌گیرد. الگویِ sameRow موتور، این‌جا
 *  محلی است چون برچسب‌ها از پیش معلوم‌اند. */
function helpKeyboard(items: HelpItem[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  let open = false // ردیفِ بازِ تک‌دکمه‌ای که منتظرِ جفتِ کوتاه است
  for (const it of items) {
    if (it === "row") {
      if (open) kb.row()
      open = false
      continue
    }
    if (open && shortLabel(it.label)) {
      kb.text(it.label, it.cb).primary()
      kb.row()
      open = false
    } else {
      if (open) kb.row()
      kb.text(it.label, it.cb).primary()
      open = shortLabel(it.label)
    }
  }
  if (open) kb.row()
  return kb
}

// ─── خطاها ────────────────────────────────────────────────────────────────────

/** بازیکنِ هنوز‌واردنشده → کارتِ شروعِ صادق (بدونِ تبلیغِ اسلش — §7)؛
 *  بقیه‌ی خطاها همان fail() مشترک (صدای موتور یا «شهر جواب نمی‌دهد»). */
async function failHelp(ctx: Context, e: unknown): Promise<void> {
  if (e instanceof GameApiError && e.code === "no_player") {
    await show(
      ctx,
      [
        "📖 <b>کدکس پیشِ رویِ توست — ولی هنوز شهروندِ این شهر نشده‌ای.</b>",
        "",
        `اول ${chip("شروع بازی")} را بفرست تا پیمانِ فمبوی‌ات را ببندیم؛ بعد همه‌ی دسته‌ها همین‌جا باز می‌شوند.`,
      ].join("\n"),
      backKeyboard(),
    )
    return
  }
  await fail(ctx, e)
}

/** کارتِ کهته — لحنِ STALE_CARD کدکسِ گروهی + راهِ برگشت */
async function showStale(ctx: Context): Promise<void> {
  await show(
    ctx,
    ["🕸 <b>این برگه از کدکس کهنه شده</b>", "", "شاید نسخه‌ی راهنما عوض شده — از «راهنما» دوباره بازش کن."].join("\n"),
    helpKeyboard([{ label: "↩ راهنما", cb: CB_HELP_HOME }]),
  )
}

// ─── hp:h — خانه‌ی راهنما (دسته‌ها) ───────────────────────────────────────────

/** شروعِ سریعِ ۳-۴ خطی — تنها بازمانده‌ی HELP_TEXTِ ایستایِ دیروز */
const QUICK_START = [
  "شروعِ سریع:",
  `🎀 ${chip("پیمان فمبوی")} — فمبویِ اختصاصی‌ات را ببند؛ او مرکزِ جهان است.`,
  `🎲 ${chip("اتفاق امروز")} · 💼 ${chip("کار")} · 😴 ${chip("استراحت")} — حلقه‌ی روزانه‌ات.`,
  `💬 بقیه‌ی عبارت‌ها: دسته‌ی «زبانِ طبیعی» همین کدکس همه‌شان را دارد.`,
]

export async function showHelpHome(ctx: Context): Promise<void> {
  const id = tgId(ctx)
  let cats = cachedCategories()
  if (!cats) {
    try {
      const r = await api.helpCategories(id)
      cats = r.categories
      helpCats.at = Date.now()
      helpCats.cats = cats
    } catch (e) {
      await failHelp(ctx, e)
      return
    }
  }
  const lines = [
    "",
    "📖 <b>راهنمای FEMBOY WAR</b>",
    SEP,
    "",
    ...QUICK_START,
    "",
    SUB,
    "",
    `کدکسِ شهر: ${chip(cats.length)} دسته‌ی واقعی — هر عددش از خودِ بازی.`,
    "دسته‌ات را باز کن 👇",
    "",
  ]
  const items: HelpItem[] = cats.map((c) => ({
    label: `${c.icon} ${clampText(c.titleFa, 24)}`,
    cb: cbHelpCat(c.id),
  }))
  items.push("row")
  items.push({ label: "🏠 خانه", cb: CB.menu })
  await show(ctx, lines.join("\n"), helpKeyboard(items))
}

// ─── hp:c:{catId}[:{page}] — فهرستِ موضوع‌های دسته ────────────────────────────

async function showCategory(ctx: Context, catId: string, pageRaw: number): Promise<void> {
  let r: Awaited<ReturnType<typeof api.helpTopics>>
  try {
    r = await api.helpTopics(tgId(ctx), catId)
  } catch (e) {
    if (e instanceof GameApiError && e.code === "no_category") {
      await showStale(ctx)
      return
    }
    await failHelp(ctx, e)
    return
  }
  const cat = r.category
  const topics = r.topics
  if (topics.length === 0) {
    await showStale(ctx)
    return
  }
  const pageCount = Math.max(1, Math.ceil(topics.length / TOPICS_PER_PAGE))
  const page = Math.max(0, Math.min(pageRaw, pageCount - 1))
  const slice = topics.slice(page * TOPICS_PER_PAGE, page * TOPICS_PER_PAGE + TOPICS_PER_PAGE)

  const lines = [
    "",
    `${cat.icon} <b>${esc(cat.titleFa)}</b>`,
    SEP,
    "",
    esc(cat.descFa),
    "",
    ...slice.map((t, i) => `${page * TOPICS_PER_PAGE + i + 1}. ${t.icon} <b>${esc(t.titleFa)}</b>`),
  ]
  if (pageCount > 1) lines.push("", `<i>صفحه‌ی ${page + 1} از ${pageCount}</i>`)

  const items: HelpItem[] = slice.map((t) => ({
    label: `${t.icon} ${clampText(t.titleFa, 26)}`,
    cb: cbHelpTopic(t.id, 0),
  }))
  if (pageCount > 1) {
    items.push("row")
    if (page > 0) items.push({ label: "◀ قبلی", cb: cbHelpCat(catId, page - 1) })
    if (page < pageCount - 1) items.push({ label: "ادامه ▶", cb: cbHelpCat(catId, page + 1) })
  }
  items.push("row")
  items.push({ label: "↩ راهنما", cb: CB_HELP_HOME })
  items.push({ label: "🏠 خانه", cb: CB.menu })
  await show(ctx, lines.join("\n"), helpKeyboard(items))
}

// ─── hp:t:{topicId}:{page} — صفحه‌ی موضوع ────────────────────────────────────

async function showTopic(ctx: Context, topicId: string, pageRaw: number): Promise<void> {
  let r: Awaited<ReturnType<typeof api.helpTopic>>
  try {
    r = await api.helpTopic(tgId(ctx), topicId, pageRaw)
  } catch (e) {
    if (e instanceof GameApiError && e.code === "no_topic") {
      await showStale(ctx)
      return
    }
    await failHelp(ctx, e)
    return
  }
  const t = r.topic
  const { blocks, page, pageCount } = r

  const lines = [
    "",
    `${t.icon} <b>${esc(t.titleFa)}</b>`,
    `صفحه‌ی ${page + 1} از ${pageCount}`,
    SEP,
    "",
  ]
  if (page === 0) lines.push(`<i>${esc(t.summaryFa)}</i>`, "")
  for (const b of blocks) {
    if (b.h) lines.push(`<b>${esc(b.h)}</b>`)
    lines.push(...b.lines.map((l) => esc(l)))
    lines.push("")
  }
  // عبارت‌های پشتیبانی‌شده — همان چیپِ مونوی کارت‌های شهر (آخرین صفحه)
  if (page === pageCount - 1 && t.phrases.length > 0) {
    lines.push(
      "عبارت‌ها:",
      ...t.phrases.map(
        (p) =>
          `• ${chip(p.fa)}${p.en ? ` · ${chip(p.en)}` : ""} — ${p.where === "private" ? "خصوصی" : p.where === "group" ? "گروه" : "خصوصی و گروه"}`,
      ),
      "",
    )
  }
  // مثال‌های عینی — سطرهای » (همان قالبِ کدکسِ گروهی)
  if (page === pageCount - 1 && t.examples.length > 0) {
    lines.push("مثال:", ...t.examples.map((e) => `» ${esc(e)}`), "")
  }

  const items: HelpItem[] = []
  if (page > 0) items.push({ label: "◀ قبلی", cb: cbHelpTopic(t.id, page - 1) })
  if (page < pageCount - 1) items.push({ label: "ادامه ▶", cb: cbHelpTopic(t.id, page + 1) })
  // موضوع‌های مرتبط — حداکثر ۲ دکمه‌ی پرش (همان سقفِ کدکسِ گروهی)
  if (page === pageCount - 1) {
    for (const rel of t.related.slice(0, 2)) {
      items.push({ label: `🔗 ${rel.icon} ${clampText(rel.titleFa, 22)}`, cb: cbHelpTopic(rel.id, 0) })
    }
  }
  items.push("row")
  items.push({ label: "↩ دسته", cb: cbHelpCat(t.cat) })
  items.push({ label: "🏠 راهنما", cb: CB_HELP_HOME })
  await show(ctx, lines.join("\n"), helpKeyboard(items))
}

// ─── نقطه‌ی ورودِ callback — فقط خصوصی (در گروه gh: موتور مالکِ راهنماست) ──────

/** کال‌بکِ hp: — پیمایشِ درختِ کدکس؛ ویرایشِ درجای همان پیام از طریقِ show() */
export async function handleHelpCallback(ctx: Context, data: string): Promise<void> {
  const rest = data.split(":").slice(1)
  const verb = rest[0] ?? ""
  if (verb === "h") return showHelpHome(ctx)
  if (verb === "c") return showCategory(ctx, rest[1] ?? "", toPage(rest[2]))
  if (verb === "t") return showTopic(ctx, rest[1] ?? "", toPage(rest[2]))
  return showStale(ctx)
}
