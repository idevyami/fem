// v14-poke
// FEMBOY WAR 🎀 — V14 (Task 15b, Task D): کدکسِ گروهی — گرامرِ gh: در ترنسپورتِ شهر.
//
// رندرِ راهنمای کامل از رجیستریِ مرکزی (help/registry) رویِ زبانِ بصریِ «شیشه»
// (text.ts: chip/SEP/SUB) — همان چیزی که کارت‌های دیگرِ شهر می‌گویند. ویرایشِ
// درجا: هر صفحه editCard برمی‌گرداند و ربات همان پیام را ویرایش می‌کند
// (الگویِ gg:/gc:) — صفحه‌ی تازه پیامِ تازه نمی‌سازد (ضدِ اسپم).
//
// گرامر (router.ts CALLBACKS.gh):
//   gh:m                     منویِ دسته‌ها (۱۵ دکمه + «🎮 بازی»)
//   gh:c:{catId}[:{page}]    فهرستِ موضوع‌های دسته (۱۲ موضوع در صفحه)
//   gh:t:{topicId}:{page}    صفحه‌ی موضوع (۴ بلوک در صفحه؛ کمتر اگر کوتاه باشد)
// شناسه‌ی کهته/نامعتبر → کارتِ یک‌خطیِ مهربان، نه خطا.
//
// کول‌داون/نرخ: همان لایه‌ی ربات (≥۳۰۰ms بینِ کال‌بک‌ها) — این‌جا فقط رندر است.
// دروازه‌ی شهروندی: راهنما دانشِ عمومی است — برای همه‌ی اعضای گروه باز (مثل help).
//
// برچسبِ بازگشت (V16-1 واژه‌نامه‌ی قاعده‌مند — terminology.ts قاعده‌ی ۶): استثنای
// مستند — بازگشتِ داخلِ کدکس به «↩ راهنما» (خانه‌ی خودِ کدکس) می‌رود، نه «↩ خانه»؛
// چون سلسله‌مراتبِ این سلسله، خودِ کدکس است. «🎮 بازی» = پرشِ مستقیم به شهر.

import type { CallbackResult, GroupCallCtx } from "./router"
import type { OutboxButton } from "./types"
import { chip, emblem, quote } from "./text"
import {
  HELP_CATEGORIES, getHelpCategory, getHelpTopic, helpTopicsOf, helpTopicPage, HELP_BLOCKS_PER_PAGE,
} from "../help/registry"

// ─── ثابت‌های رندر ─────────────────────────────────────────────────────────────

/** سقفِ نویسه‌ی هر کارت — ربات زیرِ 4000 تراش می‌دهد؛ ما از عهده جلوتر می‌ایستیم */
const MAX_CARD_CHARS = 3600
/** موضوع در هر صفحه‌ی فهرستِ دسته */
const TOPICS_PER_CATEGORY_PAGE = 12

const STALE_CARD: CallbackResult = {
  ok: false,
  ackText: "این برگه از کدکس کهنه شده — از «راهنما» دوباره بازش کن.",
}

function join(lines: string[]): string {
  return lines.join("\n")
}

/** بلوک‌های متن + دکمه‌ها تا سقفِ نویسه؛ اگر برید، دکمه‌ی صفحه‌ی بعد را بده */
function card(body: string, buttons: OutboxButton[], ackText: string): CallbackResult {
  return { ok: true, ackText, editCard: { text: body.slice(0, MAX_CARD_CHARS), buttons } }
}

// ─── gh:m — منویِ دسته‌ها ──────────────────────────────────────────────────────

// V24 «ظاهرِ شهر»: هر کارتِ کدکس نشانِ خودش را در مرکزِ جداکننده می‌گذارد و
// مقدمه‌هایِ کوتاه زیرِ نقل‌قول می‌روند — هم‌زبانِ بقیه‌ی کارت‌های شهر.
function categoryMenu(): CallbackResult {
  const lines = ["", "📚 <b>راهنمای کاملِ FEMBOY WAR</b>", emblem("📚"), "", quote("هر دسته یک راهنمایِ واقعی است — عددها از خودِ بازی."), ""]
  const buttons: OutboxButton[] = HELP_CATEGORIES.map((c) => ({
    label: `${c.icon} ${c.titleFa}`,
    style: "primary" as const,
    cb: `gh:c:${c.id}`,
  }))
  buttons.push({ label: "🎮 بازی", style: "primary", cb: "gm:game" })
  return card(join(lines), buttons, "کدکس — دسته‌ها")
}

// ─── gh:c:{catId}[:{page}] — فهرستِ موضوع‌های دسته ─────────────────────────────

function categoryList(catId: string, pageRaw: number): CallbackResult {
  const cat = getHelpCategory(catId)
  if (!cat) return STALE_CARD
  const topics = helpTopicsOf(catId)
  if (topics.length === 0) return STALE_CARD
  const pageCount = Math.max(1, Math.ceil(topics.length / TOPICS_PER_CATEGORY_PAGE))
  const page = Math.max(0, Math.min(pageRaw, pageCount - 1))
  const slice = topics.slice(page * TOPICS_PER_CATEGORY_PAGE, page * TOPICS_PER_CATEGORY_PAGE + TOPICS_PER_CATEGORY_PAGE)
  const lines = [
    "", `${cat.icon} <b>${cat.titleFa}</b>`, emblem(cat.icon), "", cat.descFa, "",
    ...(slice.map((t, i) => `${page * TOPICS_PER_CATEGORY_PAGE + i + 1}. ${t.icon} <b>${t.titleFa}</b>`)),
  ]
  if (pageCount > 1) lines.push("", `<i>صفحه‌ی ${page + 1} از ${pageCount}</i>`)
  const buttons: OutboxButton[] = slice.map((t) => ({
    label: `${t.icon} ${t.titleFa}`,
    style: "primary" as const,
    cb: `gh:t:${t.id}:0`,
  }))
  // صفحه‌بندیِ فهرست (دسته‌ی عبارت‌ها 35 موضوع دارد)
  if (pageCount > 1) {
    const nav: OutboxButton[] = []
    if (page > 0) nav.push({ label: "◀ قبلی", style: "primary", cb: `gh:c:${catId}:${page - 1}` })
    if (page < pageCount - 1) nav.push({ label: "ادامه ▶", style: "primary", cb: `gh:c:${catId}:${page + 1}` })
    buttons.push(...nav)
  }
  buttons.push({ label: "↩ راهنما", style: "primary", cb: "gh:m" })
  buttons.push({ label: "🎮 بازی", style: "primary", cb: "gm:game" })
  return card(join(lines), buttons, cat.titleFa)
}

// ─── gh:t:{topicId}:{page} — صفحه‌ی موضوع ─────────────────────────────────────

function topicPage(topicId: string, pageRaw: number): CallbackResult {
  const topic = getHelpTopic(topicId)
  if (!topic) return STALE_CARD
  const cat = getHelpCategory(topic.cat)
  const { blocks, page, pageCount } = helpTopicPage(topic, pageRaw, HELP_BLOCKS_PER_PAGE)
  const lines = ["", `${topic.icon} <b>${topic.titleFa}</b>`, `${cat ? `${cat.icon} ${cat.titleFa} · ` : ""}صفحه‌ی ${page + 1} از ${pageCount}`, emblem(topic.icon), ""]
  if (page === 0) lines.push(`<i>${topic.summaryFa}</i>`, "")
  for (const b of blocks) {
    if (b.h) lines.push(`<b>${b.h}</b>`)
    lines.push(...b.lines, "")
  }
  // عبارت‌های پشتیبانی‌شده — همان چیپِ مونو که کارت‌های شهر استفاده می‌کنند
  // V24: ردیف‌های ▪ (هم‌زبانِ فهرست‌های شهر)
  if (page === pageCount - 1 && topic.phrases && topic.phrases.length > 0) {
    lines.push("عبارت‌ها:", ...topic.phrases.map((p) => `▪ ${chip(p.fa)}${p.en ? ` · ${chip(p.en)}` : ""} — ${p.where === "private" ? "خصوصی" : p.where === "group" ? "گروه" : "خصوصی و گروه"}`), "")
  }
  if (page === pageCount - 1 && topic.examples && topic.examples.length > 0) {
    lines.push("مثال:", ...topic.examples.map((e) => `» ${e}`), "")
  }
  const buttons: OutboxButton[] = []
  if (page > 0) buttons.push({ label: "◀ قبلی", style: "primary", cb: `gh:t:${topic.id}:${page - 1}` })
  if (page < pageCount - 1) buttons.push({ label: "ادامه ▶", style: "primary", cb: `gh:t:${topic.id}:${page + 1}` })
  if (topic.related && topic.related.length > 0 && page === pageCount - 1) {
    for (const r of topic.related.slice(0, 2)) {
      const rel = getHelpTopic(r)
      if (rel) buttons.push({ label: `🔗 ${rel.icon} ${rel.titleFa}`, style: "primary", cb: `gh:t:${rel.id}:0` })
    }
  }
  buttons.push({ label: "↩ دسته", style: "primary", cb: `gh:c:${topic.cat}` })
  buttons.push({ label: "🏠 راهنما", style: "primary", cb: "gh:m" })
  return card(join(lines), buttons, topic.titleFa)
}

// ─── نقطه‌ی ورودِ router ───────────────────────────────────────────────────────

/** کال‌بکِ gh: — بدونِ state، بدونِ DB؛ رندرِ خالص از رجیستری */
export function ghCallback(_ctx: GroupCallCtx, data: string): CallbackResult {
  const rest = data.split(":").slice(1)
  const verb = rest[0] ?? ""
  if (verb === "m") return categoryMenu()
  if (verb === "c") {
    const catId = rest[1] ?? ""
    const page = Number(rest[2] ?? "0")
    return categoryList(catId, Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0)
  }
  if (verb === "t") {
    const topicId = rest[1] ?? ""
    const page = Number(rest[2] ?? "0")
    return topicPage(topicId, Number.isFinite(page) ? Math.max(0, Math.floor(page)) : 0)
  }
  return STALE_CARD
}
