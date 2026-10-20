// FEMBOY WAR 🎀 — V14 (Task 15b, Task B): خروجیِ رجیستریِ راهنما + اعتبارسنجی.
//
// دو مصنوع می‌سازد:
//   1. src/lib/game/help/phrase-table.generated.json — جدولِ عبارت‌ها برای موتور
//      (دسته‌ی «عبارت‌های طبیعی» از همین می‌خواند).
//   2. mini-services/bot/src/help-snapshot.json — رجیستریِ کاملِ سریال‌شده برای
//      موجِ 2 (16a: رندرِ کدکس در ربات خصوصی/گروهی).
//
// نام‌های مستعار مستقیم از mini-services/bot/src/intent.ts می‌آیند — آن ماژول
// خالص است (بدونِ import) اما PHRASES را export نمی‌کند؛ پس با regex می‌خوانیم
// ( همان توصیه‌ی مأموریت: اگر import ممکن نیست، parse کن).
//
// اعتبارسنجی‌ها (هر خطا throw می‌کند):
//   • هر 36 نیتِ intent.ts سند شده باشد و هر سطرِ جدول به نیتِ موجود اشاره کند.
//   • related هر موضوع موجود باشد؛ دسته خالی نباشد؛ هر موضوع ≥ 2 بلوک و
//     titleFa+summaryFa داشته باشد.
//   • هیچ رشته‌ی رو به بازیکن فرمانِ «/کلمه» نداشته باشد (https:// مجاز است).
//
// Run: bun scripts/export-help.ts   (از ریشه‌ی مخزن)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { INTENT_SUMMARIES } from "../src/lib/game/help/phrases"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const INTENT_TS = resolve(ROOT, "mini-services/bot/src/intent.ts")
const PHRASE_TABLE_OUT = resolve(ROOT, "src/lib/game/help/phrase-table.generated.json")
const SNAPSHOT_OUT = resolve(ROOT, "mini-services/bot/src/help-snapshot.json")

// ─── 1) نام‌های مستعار از intent.ts (regex — فرمتِ فایل پایدار است) ──────────────

interface ParsedAlias {
  fa: string[]
  en: string[]
  open: boolean
}

function parseIntents(): { ids: string[]; byId: Map<string, ParsedAlias> } {
  const src = readFileSync(INTENT_TS, "utf8")
  const tableStart = src.indexOf("const PHRASES")
  if (tableStart < 0) throw new Error("intent.ts: PHRASES table not found")
  const body = src.slice(tableStart, src.indexOf("\n}", tableStart))
  const byId = new Map<string, ParsedAlias>()
  // هر بلوک (فرمتِ پایدارِ فایل):
  //   menu: [
  //     ["منو", true], ["پیشخوان", true],
  //   ],
  const blockRe = /^  ([a-zA-Z_]+): \[$([\s\S]*?)^  \],$/gm
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(body))) {
    const id = m[1]!
    const entries = m[2]!
    const alias: ParsedAlias = { fa: [], en: [], open: false }
    const entryRe = /\[\s*"([^"]+)"\s*(?:,\s*(true|false))?\s*\]/g
    let e: RegExpExecArray | null
    while ((e = entryRe.exec(entries))) {
      const phrase = e[1]!
      const isOpen = e[2] === "true"
      if (/^[\u0600-\u06FF]/.test(phrase)) alias.fa.push(phrase)
      else alias.en.push(phrase)
      if (isOpen) alias.open = true
    }
    if (alias.fa.length + alias.en.length === 0) throw new Error(`intent.ts: no aliases parsed for "${id}"`)
    byId.set(id, alias)
  }
  // ترتیب از خودِ فایل (همان ترتیبِ IntentId)
  const ids = [...byId.keys()]
  return { ids, byId }
}

// ─── 2) نقشه‌ی مسیریابی گروه (آینه‌ی handlers.ts/routeGroupIntent — فقط‌خواندنی) ──

// نیت‌هایی که routeGroupIntent در گروه هم به موتور/هندلر می‌فرستد؛ بقیه در گروه
// فقط دعوت به خصوصی می‌شوند (nudge). منبع: mini-services/bot/src/handlers.ts.
// V16-3 — سه‌گانه‌ی V15-2 (duels/economy/fame) اضافه شدند (آینه بودن، یادشان رفته بود).
const GROUP_ROUTED = new Set([
  "menu", "start", "back", "help", "city", "status", "events", "players", "games",
  "leaderboard", "champ", "news", "femboy", "myfemboy", "duel", "vote", "court",
  "projects", "history", "gadmin", "cancel", "duels", "economy", "fame",
])

// ─── 3) ساختِ جدولِ عبارت‌ها ────────────────────────────────────────────────────

interface TableRow {
  id: string
  faSummary: string
  expectFa: string
  where: "private" | "group" | "both"
  open: boolean
  aliasesFa: string[]
  aliasesEn: string[]
}

const { ids, byId } = parseIntents()
const rows: TableRow[] = ids.map((id) => {
  const alias = byId.get(id)!
  const summary = INTENT_SUMMARIES[id]
  if (!summary) throw new Error(`INTENT_SUMMARIES missing entry for intent "${id}" (add to src/lib/game/help/phrases.ts)`)
  return {
    id,
    faSummary: summary.faSummary,
    expectFa: summary.expectFa,
    where: GROUP_ROUTED.has(id) ? "both" : "private",
    open: alias.open,
    aliasesFa: alias.fa,
    aliasesEn: alias.en,
  }
})

// شمارشِ واقعیِ نیت‌ها در intent.ts = 38 (35 تا V14 + سه‌گانه‌ی هابِ شهرِ V15-2:
// duels/economy/fame — V16-3 سندشان کرد و این عدد به‌روز شد). اگر رجیستری رشد
// کرد این عدد را به‌روز کن.
const EXPECTED_INTENT_COUNT = 42
if (rows.length !== EXPECTED_INTENT_COUNT) {
  throw new Error(`intent.ts exposes ${rows.length} intents, expected ${EXPECTED_INTENT_COUNT} (update EXPECTED_INTENT_COUNT if the registry grew)`)
}
for (const key of Object.keys(INTENT_SUMMARIES)) {
  if (!byId.has(key)) throw new Error(`INTENT_SUMMARIES documents unknown intent "${key}" — resolver has no such id`)
}

// نوشتنِ جدولِ عبارت‌ها پیش از بارگذاریِ رجیستری (رجیستری همین فایل را می‌خواند)
mkdirSync(dirname(PHRASE_TABLE_OUT), { recursive: true })
writeFileSync(PHRASE_TABLE_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), intents: rows }, null, 2) + "\n")
console.log(`✓ phrase-table.generated.json — ${rows.length} intents`)

// ─── 4) بارگذاریِ رجیستری (بعد از نوشتنِ جدول — import دینامیک) ────────────────

const registry = await import("../src/lib/game/help/registry")
const { HELP_CATEGORIES, HELP_TOPICS } = registry as {
  HELP_CATEGORIES: import("../src/lib/game/help/types").HelpCategory[]
  HELP_TOPICS: import("../src/lib/game/help/types").HelpTopic[]
}

// ─── 5) اعتبارسنجی‌های رجیستری ─────────────────────────────────────────────────

const topicIds = new Set(HELP_TOPICS.map((t) => t.id))
const problems: string[] = []

if (HELP_CATEGORIES.length < 12) problems.push(`کمتر از 12 دسته (${HELP_CATEGORIES.length})`)
for (const cat of HELP_CATEGORIES) {
  if (cat.topics.length === 0) problems.push(`دسته‌ی خالی: ${cat.id}`)
  for (const tid of cat.topics) {
    if (!topicIds.has(tid)) problems.push(`${cat.id}: topic id "${tid}" در رجیستری نیست`)
  }
}
const catIds = new Set(HELP_CATEGORIES.map((c) => c.id))
for (const t of HELP_TOPICS) {
  if (!catIds.has(t.cat)) problems.push(`topic "${t.id}" cat "${t.cat}" وجود ندارد`)
  if (!t.titleFa || !t.summaryFa) problems.push(`topic "${t.id}" بدون titleFa/summaryFa`)
  if (t.blocks.length < 2) problems.push(`topic "${t.id}" کمتر از 2 بلوک دارد (${t.blocks.length})`)
  if (t.blocks.length > 10) problems.push(`topic "${t.id}" بیش از 10 بلوک دارد (${t.blocks.length})`)
  for (const r of t.related ?? []) {
    if (!topicIds.has(r)) problems.push(`topic "${t.id}" related "${r}" موجود نیست`)
  }
}
// موضوع‌های عبارت‌ها باید همه‌ی 36 نیت را بپوشانند
for (const row of rows) {
  if (!topicIds.has(`phrase-${row.id}`)) problems.push(`phrase topic برای "${row.id}" ساخته نشد`)
}

// هیچ فرمانِ اسلش در رشته‌ی رو به بازیکن (https:// مجاز — لینکِ مینی‌اپ/ربات)
const URL_RE = /https:\/\/[^\s"»]+/g
const SLASH_CMD_RE = /\/[a-z]{2,}/
function slashTokens(s: string): string[] {
  return s.replace(URL_RE, "").match(/\/[a-z]{2,}/g) ?? []
}
for (const t of HELP_TOPICS) {
  const surfaces = [t.titleFa, t.summaryFa, ...(t.examples ?? []), ...(t.phrases ?? []).flatMap((p) => [p.fa, p.en ?? ""])]
  for (const b of t.blocks) surfaces.push(b.h ?? "", ...b.lines)
  for (const s of surfaces) {
    const hits = slashTokens(s)
    if (hits.length > 0) problems.push(`topic "${t.id}" فرمانِ اسلش دارد: ${hits.join(",")} در «${s.slice(0, 60)}»`)
  }
}
for (const c of HELP_CATEGORIES) {
  for (const hit of slashTokens(`${c.titleFa} ${c.descFa}`)) problems.push(`category "${c.id}" فرمانِ اسلش دارد: ${hit}`)
}

if (problems.length > 0) {
  console.error("✗ validation failed:")
  for (const p of problems) console.error("  -", p)
  process.exit(1)
}
console.log(`✓ registry validated — ${HELP_CATEGORIES.length} categories / ${HELP_TOPICS.length} topics, zero slash tokens`)

// ─── 6) اسنپ‌شاتِ کامل برای ربات (موجِ 2 — 16a) ────────────────────────────────

const snapshot = {
  meta: {
    generatedAt: new Date().toISOString(),
    version: "v14-help-1",
    categories: HELP_CATEGORIES.length,
    topics: HELP_TOPICS.length,
    intents: rows.length,
  },
  categories: HELP_CATEGORIES,
  topics: HELP_TOPICS,
  phraseTable: rows,
}

mkdirSync(dirname(SNAPSHOT_OUT), { recursive: true })
writeFileSync(SNAPSHOT_OUT, JSON.stringify(snapshot, null, 2) + "\n")
const size = (readFileSync(SNAPSHOT_OUT).length / 1024).toFixed(1)
console.log(`✓ mini-services/bot/src/help-snapshot.json — ${HELP_TOPICS.length} topics, ${size} KB`)
