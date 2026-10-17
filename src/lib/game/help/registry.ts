// FEMBOY WAR 🎀 — V14 (Task 15b, Task A): رجیستریِ مرکزیِ راهنما — منبعِ یگانه‌ی حقیقت.
//
// کدکسِ تعاملیِ بازی: دسته‌ها + موضوع‌ها + بلوک‌ها + عبارت‌ها + مثال‌ها.
// قواعدِ محتوا (مأموریتِ V14 بخشِ V):
//   • هر عدد از کدِ واقعی آمده است (فایلِ منبع در سربرگِ هر content/*.ts).
//   • رقم‌ها همه‌جا انگلیسی؛ عبارت‌های پشتیبانی‌شده با «»؛ بدونِ هیچ فرمانِ اسلش.
//   • بلوک ≤ ۸ خط؛ موضوع ≤ ۱۰ بلوک (صفحه‌بندی در رندر).
//   • این رجیستری «توصیفِ» قواعدِ معتبر است، نه جایگزینشان — قواعد در
//     character.ts/combat.ts/classes.ts/… می‌مانند و این‌جا فقط آینه می‌شوند.
//
// ساختار: محتوای دستی در content/*.ts · موضوع‌های کلاس‌ها به‌صورت خودکار از
// CLASSES ساخته می‌شوند (drift غیرممکن) · موضوع‌های عبارت‌ها از جدولِ تولیدشده‌ی
// phrase-table.generated.json (خروجیِ scripts/export-help.ts از رویِ intent ربات).

import type { HelpBlock, HelpPhrase, HelpTopic, HelpCategory } from "./types"
import { START_TOPICS, NAV_TOPICS, START_CATEGORY, NAV_CATEGORY } from "./content/start"
import { FEMBOY_TOPICS, FEMBOY_CATEGORY } from "./content/femboy"
import { CLASS_TOPICS, CLASSES_CATEGORY, buildClassTopics } from "./content/classes"
import { PROGRESSION_TOPICS, RULES_TOPICS, PROGRESSION_CATEGORY, RULES_CATEGORY } from "./content/progression"
import { COMBAT_TOPICS, COMBAT_CATEGORY } from "./content/combat"
import { GAMES_TOPICS, SOCIAL_TOPICS, GAMES_CATEGORY, SOCIAL_CATEGORY } from "./content/group"
import {
  EVENTS_TOPICS, ITEMS_TOPICS, ECONOMY_TOPICS, FAME_TOPICS,
  EVENTS_CATEGORY, ITEMS_CATEGORY, ECONOMY_CATEGORY, FAME_CATEGORY,
} from "./content/world"
import { FAQ_TOPICS, FAQ_CATEGORY } from "./content/faq"
import { buildPhraseTopics, PHRASES_CATEGORY } from "./content/phrases-topics"

export type { HelpBlock, HelpPhrase, HelpTopic, HelpCategory }

// ─── موضوع‌های کلاس: تولیدِ خودکار از رویِ CLASSES (محتوای دست‌نویس ممنوع) ──────
const AUTO_CLASS_TOPICS = buildClassTopics()

/** موضوع‌های ثابتِ رجیستری — موضوع‌های کلاس و عبارت‌ها به آن‌ها می‌پیوندند */
const STATIC_TOPICS: HelpTopic[] = [
  ...START_TOPICS,
  ...FEMBOY_TOPICS,
  ...CLASS_TOPICS,
  ...AUTO_CLASS_TOPICS,
  ...PROGRESSION_TOPICS,
  ...COMBAT_TOPICS,
  ...GAMES_TOPICS,
  ...EVENTS_TOPICS,
  ...ITEMS_TOPICS,
  ...ECONOMY_TOPICS,
  ...FAME_TOPICS,
  ...SOCIAL_TOPICS,
  ...NAV_TOPICS,
  ...FAQ_TOPICS,
  ...RULES_TOPICS,
]

/** موضوع‌های عبارت‌ها از جدولِ تولیدشده (src/lib/game/help/phrase-table.generated.json) */
const PHRASE_TOPICS = buildPhraseTopics()

/** کلِ موضوع‌های کدکس — موضوعِ هر دسته در HelpCategory.topics فهرست شده */
export const HELP_TOPICS: HelpTopic[] = [...STATIC_TOPICS, ...PHRASE_TOPICS]

/** دسته‌های کدکس — ۱۵ دسته‌ی واقعی، همه‌شان پشتیبانِ ویژگیِ زنده‌اند */
export const HELP_CATEGORIES: HelpCategory[] = [
  START_CATEGORY,
  FEMBOY_CATEGORY,
  CLASSES_CATEGORY,
  PROGRESSION_CATEGORY,
  COMBAT_CATEGORY,
  GAMES_CATEGORY,
  EVENTS_CATEGORY,
  ITEMS_CATEGORY,
  ECONOMY_CATEGORY,
  FAME_CATEGORY,
  SOCIAL_CATEGORY,
  NAV_CATEGORY,
  PHRASES_CATEGORY,
  FAQ_CATEGORY,
  RULES_CATEGORY,
]

// ─── نمایه‌گذاری ──────────────────────────────────────────────────────────────

const TOPIC_MAP = new Map(HELP_TOPICS.map((t) => [t.id, t]))
const CATEGORY_MAP = new Map(HELP_CATEGORIES.map((c) => [c.id, c]))

/** موضوع با شناسه‌ی پایدار — null یعنی «در این نسخه نیست» (دکمه‌ی کهنه/مهاجرت) */
export function getHelpTopic(id: string): HelpTopic | null {
  return TOPIC_MAP.get(id) ?? null
}

/** دسته با شناسه — null برای دکمه‌های کهنه */
export function getHelpCategory(id: string): HelpCategory | null {
  return CATEGORY_MAP.get(id) ?? null
}

/** موضوع‌های یک دسته به ترتیبِ تعریف */
export function helpTopicsOf(catId: string): HelpTopic[] {
  const cat = CATEGORY_MAP.get(catId)
  if (!cat) return []
  return cat.topics.map((id) => TOPIC_MAP.get(id)).filter((t): t is HelpTopic => Boolean(t))
}

// ─── جست‌وجو (بخشِ V §1 — «جست‌وجو یا یافتنِ موضوع با زبانِ طبیعی») ─────────────

/** نرمال‌سازیِ سبک برای تطبیق: ي/ك عربی → فارسی، ارقام فارسی → لاتین، حذفِ اِعراب */
function normQ(s: string): string {
  let t = s.trim().toLowerCase()
  t = t.split("\u064A").join("\u06CC").split("\u0643").join("\u06A9")
  t = t.replace(/[\u064B-\u065F\u0670]/g, "")
  const digits: Record<string, string> = {
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  }
  for (const [fa, en] of Object.entries(digits)) t = t.split(fa).join(en)
  return t.replace(/\s+/g, " ")
}

export type SearchMatch = { topic: HelpTopic; matchedOn: "title" | "summary" | "phrase" }

/** جست‌وجویِ کدکس — عنوان، خلاصه، کلیدواژه‌ها و عبارت‌ها (fa/en)؛ ۵ نتیجه‌ی برتر */
export function searchHelpTopics(q: string, limit = 5): SearchMatch[] {
  const nq = normQ(q)
  if (!nq) return []
  const scored: { m: SearchMatch; score: number }[] = []
  for (const topic of HELP_TOPICS) {
    const title = normQ(topic.titleFa)
    if (title.includes(nq)) { scored.push({ m: { topic, matchedOn: "title" }, score: 100 }); continue }
    const summary = normQ(topic.summaryFa)
    if (summary.includes(nq)) { scored.push({ m: { topic, matchedOn: "summary" }, score: 60 }); continue }
    const kw = (topic.keywords ?? []).some((k) => normQ(k).includes(nq))
    if (kw) { scored.push({ m: { topic, matchedOn: "summary" }, score: 50 }); continue }
    const phrase = (topic.phrases ?? []).some((p) => normQ(p.fa).includes(nq) || (p.en ? normQ(p.en).includes(nq) : false))
    if (phrase) { scored.push({ m: { topic, matchedOn: "phrase" }, score: 40 }); continue }
    // تطبیقِ واژه‌به‌واژه در عنوان (کوچک‌ترین واژه‌های پرس‌وجو)
    const words = nq.split(" ").filter((w) => w.length >= 3)
    if (words.length > 0 && words.every((w) => title.includes(w))) {
      scored.push({ m: { topic, matchedOn: "title" }, score: 30 })
    }
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.m)
}

// ─── صفحه‌بندی (بخشِ V §9 — «صفحه‌بندی برای فهرست‌های بلند») ────────────────────

/** بلوک در هر صفحه‌ی موضوع — برای رندرِ گروه (زیرِ سقفِ 4000 نویسه‌ی ربات) */
export const HELP_BLOCKS_PER_PAGE = 4

/** شمارِ صفحه‌های موضوع با perPage بلوک */
export function helpTopicPageCount(topic: HelpTopic, perPage = HELP_BLOCKS_PER_PAGE): number {
  return Math.max(1, Math.ceil(topic.blocks.length / perPage))
}

/** صفحه‌ی n از موضوع — بلوک‌های بریده‌شده + شماره‌ی صفحه‌ی امن‌شده */
export function helpTopicPage(topic: HelpTopic, page: number, perPage = HELP_BLOCKS_PER_PAGE): { blocks: HelpBlock[]; page: number; pageCount: number } {
  const pageCount = helpTopicPageCount(topic, perPage)
  const p = Math.max(0, Math.min(page, pageCount - 1))
  return { blocks: topic.blocks.slice(p * perPage, p * perPage + perPage), page: p, pageCount }
}

/** موضوع در یک نگاه برای فهرست‌ها — بدونِ بلوک‌ها */
export function helpTopicStub(topic: HelpTopic): { id: string; cat: string; icon: string; titleFa: string; titleEn: string; summaryFa: string } {
  return { id: topic.id, cat: topic.cat, icon: topic.icon, titleFa: topic.titleFa, titleEn: topic.titleEn, summaryFa: topic.summaryFa }
}
