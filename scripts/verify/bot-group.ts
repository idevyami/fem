// FEMBOY WAR 🎀 — V13 Wave 4 (Task 8): PERSISTENT VERIFICATION HARNESS — bot side.
//
// Durable port of the wave-3 offline bot suite (was /home/z/verify-5.mjs, 48/48) into
// the repo. Drives the REAL bot middleware chain (registerBot on a real grammY Bot)
// with:
//   • engine calls  → mocked globalThis.fetch (captured + canned responses — NO real
//     engine traffic; this suite never touches :3000)
//   • telegram calls → grammY api transformer (captured + canned, can throw)
//   • updates       → bot.handleUpdate({...}) with real update objects
//
// V13 Part 10 coverage (see scripts/verify/README.md — mostly 10.4-adjacent transport
// behavior proven offline; live-Telegram specifics stay in the 10.4 boundary report):
//   ① update-id dedup            ⑥ home edit-in-place (kind:"home")
//   ② per-user anti-flood limits ⑦ lifecycle (kicked/left/bot-added/promotion)
//   ③ /duel → challenge transport ⑧ private regression spot-checks
//   ④ gc:/gs: routing             ⑨ /gadmin admin gating
//   ⑤ live admin verify + cache   ⑩ outbox drain (challenge edit + delivery report)
//
// Run: bun scripts/verify/bot-group.ts   (from repo root; bot need NOT be running)

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))

// ── bot-secret.env replication (mini-services/bot/src/env.ts, same semantics:
//    tracked file → process.env, only for keys not already present) ──────────────
const SECRET_FILE = join(REPO_ROOT, "mini-services", "bot", "bot-secret.env")
if (existsSync(SECRET_FILE)) {
  try {
    for (const line of readFileSync(SECRET_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m?.[1] || !m[2]) continue
      if (!(m[1] in process.env)) process.env[m[1]] = m[2]
    }
  } catch { /* same swallow as env.ts */ }
}

// ── mocks BEFORE importing bot src (dynamic imports) ──────────────────────────
const engineCalls: any[] = []
let msgSeq = 4242
const nextMsgId = () => ++msgSeq

// V16-3 §16 — snapshot (state) با بازیکنِ قابل‌تغییر — تا بینگو/شهر/حساب از داده‌ی
// واقعی‌نما رندر شوند (پولِ بازیکن سناریویی است: پولدار/تنگدست/بی‌پول)
let mockStatePlayer: any = {
  id: "p-state", name: "بازیکنِ شهر", avatar: "🐱", level: 3, day: 4,
  money: 30000, debt: 0, energy: 50, chaos: 5, fame: 10,
  district: "bazaar", districtName: "بازار", districtEmoji: "🏪",
  job: null, vehicle: null, house: null, activeTitle: null, titles: [], achievements: [],
}

// V16-4 §17/§19 — overrides پروفایل (دستاوردها/کیفِ بزرگ) + §18 بازارِ stateful
const mockProfileOverrides = new Map<string, { achievements?: any[]; achievementsTotal?: number; inventory?: any[] }>()
const MOCK_ITEMS: Record<string, { name: string; emoji: string }> = {
  water: { name: "آب", emoji: "💧" },
  pet_food: { name: "غذای حیوان", emoji: "🥫" },
}
let mockMarketListings: any[] = []
let mockListingSeq = 0

globalThis.fetch = (async (url: any, init: any) => {
  const u = new URL(String(url))
  const body = init?.body ? JSON.parse(init.body as string) : null
  engineCalls.push({ path: u.pathname, method: init?.method ?? "GET", body })
  // V15-3 §14 — soulGet خصوصی (GET /api/game/character?telegramId=…): بازیکنِ بدونِ
  // فمبوی → کارتِ noCharacter (پنلِ خودش)؛ مسیرِ pathname خالص از body خبر ندارد
  if (u.pathname === "/api/game/character" && u.searchParams.has("telegramId")) {
    return new Response(JSON.stringify({ ok: true, data: { exists: false } }), { status: 200, headers: { "content-type": "application/json" } })
  }
  const data = engineResponse(u.pathname, body)
  // mock engine errors: {__fail:{message, code, status}} → {ok:false,...}
  if (data && typeof data === "object" && "__fail" in data) {
    const f = (data as any).__fail
    return new Response(JSON.stringify({ ok: false, error: f.message, code: f.code }), { status: f.status ?? 400, headers: { "content-type": "application/json" } })
  }
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } })
}) as typeof fetch

function engineResponse(path: string, body: any): any {
  if (path === "/api/auth") return { created: true, snapshot: { player: {}, femboy: null } }
  if (path === "/api/group/command") {
    const action = body?.action ?? "command"
    if (action === "command") {
      const c = (body.command ?? "").split(" ")[0]
      if (c === "game") return { text: "🏙 <b>خانه‌ی شهر</b>", buttons: [{ label: "🎲 بازی گروهی", style: "primary", cb: "gm:play" }], kind: "home" }
      if (c === "duel") return { text: "⚔️ <b>دعوت‌نامه فرستاده شد</b>", buttons: [{ label: "🏠 خانه‌ی شهر", style: "primary", cb: "gm:game" }] }
      if (c === "gadmin") return { text: "🛠 <b>تنظیماتِ شهر</b>", buttons: [{ label: "⛔ بستنِ بازیِ شهر", style: "danger", cb: "gs:toggle:enabled" }] }
      if (c === "economy") {
        // V15-2 — دکمه‌های همان الگویِ hub.ts (economyCommandCard): جفتِ گرید +
        // sameRow بلند (ردیفِ خودش) + دکمه‌هایِ بی‌نشانه (ردیفِ کامل)
        return {
          text: "💰 <b>اقتصاد و بازار</b>",
          buttons: [
            { label: "🏛 صندوق", style: "primary", cb: "gm:city" },
            { label: "🏗 پروژه‌ها", style: "primary", cb: "gm:projects", sameRow: true },
            { label: "🛍 بازارِ شخصی — در خصوصیِ ربات خیلی بلند", style: "primary", url: "https://t.me/femwarbot", sameRow: true },
            { label: "📖 اقتصاد", style: "primary", cb: "gh:c:economy" },
            { label: "↩ خانه", style: "primary", cb: "gm:game" },
          ],
        }
      }
      return { text: "کارتِ موتور", buttons: [] }
    }
    if (action === "callback") return { ok: true, ackText: "باشه", editCard: { text: "کارتِ ویرایش‌شده", buttons: [] } }
    if (action === "member") return { welcomed: true }
    if (action === "member_left") return { left: true }
    if (action === "delivered") return { ok: true }
    if (action === "tick") return { messages: [], groupsTicked: 0 }
  }
  if (path === "/api/group/observe") return { action: "none" }
  // V16-4 §17/§19 — لایه‌ی overrides برای پروفایل: دستاوردها/کیفِ بزرگ برای
  // بازیکن‌هایِ سناریویی (بقیه همانِ دیروز را می‌گیرند)
  const profOverride = mockProfileOverrides.get(String(body?.telegramId ?? "x"))
  // V15-3 §14 — Test A/C: پروفایل (کیف) + اکشنِ آیتم برای دو بازیکنِ مستقل
  if (path === "/api/game/profile") {
    const who = String(body?.telegramId ?? "x")
    return {
      player: { id: `p-${who}`, name: `بازیکنِ ${who}`, avatar: "🐱", level: 3, fame: 10, money: 3000, debt: 0, energy: 50, chaos: 5, day: 4, district: "bazaar", districtName: "بازار", districtEmoji: "🏪", job: null, vehicle: null, house: null, activeTitle: null, titles: [], achievements: profOverride?.achievements ?? [] },
      pets: [{ id: "pet-1", name: "گربه", emoji: "🐱", rarityLabel: "معمولی", hunger: 80, loyalty: 40, moodLabel: "سرحال" }],
      inventory: profOverride?.inventory ?? [
        { itemKey: "water", name: "آب", emoji: "💧", rarityLabel: "معمولی", category: "consumable", quantity: 2, equipped: false, favorite: false, locked: false, usable: true, tradable: true, effectLabel: null },
      ],
      story: [], history: [],
      totals: { eventsResolved: 0, moneyEarned: 0, moneySpent: 0, petsAdopted: 0, rareFinds: 0 },
      achievementsTotal: profOverride?.achievementsTotal,
    }
  }
  // V16-4 §18 — بازارِ stateful: createListing/cancelListing رویِ ماک اجرا می‌شوند
  // (ردیفِ واقعیِ Listing در mockMarketListings ساخته/برداشته می‌شود)
  if (path === "/api/game/action") {
    const action = String(body?.action ?? "")
    if (action === "createListing") {
      const itemKey = String(body?.payload?.itemKey ?? "")
      const quantity = Number(body?.payload?.quantity ?? 1)
      const price = Number(body?.payload?.price ?? 0)
      const def = MOCK_ITEMS[itemKey] ?? { name: itemKey, emoji: "📦" }
      const who = String(body?.telegramId ?? "x")
      const row = {
        listingId: `ml-${++mockListingSeq}`, itemKey, name: def.name, emoji: def.emoji,
        rarity: "common", price, quantity, sellerName: `بازیکنِ ${who}`, sellerId: `p-${who}`,
      }
      mockMarketListings.push(row)
      return { message: `آگهیت زده شد: ${quantity}× ${def.name} — ${price} سکه. سه‌روزه اعتبار دارد.`, flavor: null, deltas: [], snapshot: { player: {}, femboy: null } }
    }
    if (action === "cancelListing") {
      const listingId = String(body?.payload?.listingId ?? "")
      const idx = mockMarketListings.findIndex((l) => l.listingId === listingId)
      if (idx >= 0) mockMarketListings.splice(idx, 1)
      return { message: "آگهی پس گرفته شد. جنس برگشت تو کیف.", flavor: null, deltas: [], snapshot: { player: {}, femboy: null } }
    }
    return { message: "انجام شد", flavor: null, deltas: [], snapshot: { player: {}, femboy: null } }
  }
  // V16-3 §16 — snapshot کامل برای /api/game/state (بینگو/شهر/حساب)
  if (path === "/api/game/state") {
    return {
      snapshot: {
        player: { ...mockStatePlayer },
        world: { dayCount: 4, weatherLabel: "آفتابی", weatherEmoji: "☀️", chaosLevel: 10, globalEvent: null },
        activeEvent: null, pets: [], inventory: [], notifications: [], unreadNotifications: 0,
        offlineRecap: null, femboy: null,
      },
    }
  }
  // §12-D — بازار: DTO واقعی (V16-4: قیمت‌ها + آگهی‌های stateful) تا کارتِ بازار
  // (نه کارتِ خطا) رندر شود — قیمتِ روزِ «آب» = 30 → پیشنهادها 27/30/33
  if (path === "/api/game/market") {
    const who = String(body?.telegramId ?? "x")
    return {
      listings: mockMarketListings.map((l) => ({ ...l, mine: l.sellerId === `p-${who}` })),
      prices: [
        { itemKey: "water", name: "آب", emoji: "💧", base: 20, current: 30, trend: 2 },
        { itemKey: "pet_food", name: "غذای حیوان", emoji: "🥫", base: 40, current: 50, trend: -1 },
      ],
      shop: [], playerMoney: 3000,
    }
  }
  // V15-2 — تالارِ افتخارات (برای مسیرِ خصوصیِ «افتخارات» → /champ ربات)
  if (path === "/api/game/character/hall") {
    return {
      board: "level", boardLabel: "سطح",
      boards: [{ key: "level", label: "سطح", icon: "⭐" }, { key: "wins", label: "برد", icon: "🏅" }],
      entries: [], note: "",
    }
  }
  // V15-2 — کدکسِ راهنما (/api/game/help): 3 دسته؛ combat با 13 موضوع → دو صفحه
  if (path === "/api/game/help") {
    const action = body?.action
    if (action === "categories") {
      return {
        categories: [
          { id: "start", icon: "🎀", titleFa: "شروع و آشنایی با بازی", titleEn: "Start", descFa: "اولین قدم‌ها.", topicCount: 1 },
          { id: "combat", icon: "⚔️", titleFa: "جنگ فمبوی و مبارزه", titleEn: "Combat", descFa: "نبرد و دوئل.", topicCount: 13 },
          { id: "faq", icon: "🛠️", titleFa: "رفع اشکال", titleEn: "FAQ", descFa: "خطاها و محدودیت‌ها.", topicCount: 2 },
        ],
      }
    }
    if (action === "topics") {
      if (body?.categoryId === "combat") {
        const topics = Array.from({ length: 13 }, (_, i) => ({
          id: i === 0 ? "combat-duels" : `combat-t${i}`,
          cat: "combat", icon: "⚔️",
          titleFa: i === 0 ? "دوئل — جنگِ فمبویِ دو نفر" : `موضوعِ ${i + 1}`,
          titleEn: `T${i}`, summaryFa: "خلاصه.",
        }))
        return { category: { id: "combat", icon: "⚔️", titleFa: "جنگ فمبوی و مبارزه", descFa: "نبرد و دوئل." }, topics }
      }
      if (body?.categoryId === "faq") {
        return {
          category: { id: "faq", icon: "🛠️", titleFa: "رفع اشکال", descFa: "خطاها." },
          topics: [{ id: "faq-x", cat: "faq", icon: "🛠️", titleFa: "چرا؟", titleEn: "Why", summaryFa: "چون." }],
        }
      }
      return { __fail: { message: "چنین دسته‌ای در کدکس نیست — شاید نسخه‌ی کهنه.", code: "no_category", status: 404 } }
    }
    if (action === "topic") {
      if (body?.id === "combat-duels") {
        const page = Math.max(0, Math.min(Number(body.page ?? 0) || 0, 1))
        return {
          topic: {
            id: "combat-duels", cat: "combat", icon: "⚔️",
            titleFa: "دوئل — جنگِ فمبویِ دو نفر", titleEn: "Duels",
            summaryFa: "دعوت با رضایتِ طرفین.",
            related: [{ id: "faq-x", icon: "⚔️", titleFa: "چرا دعوت نمی‌رود؟", summaryFa: "سقف‌ها." }],
            phrases: [{ fa: "جنگ فمبوی", en: "duel", where: "both" }],
            examples: ["reply روی پیامِ حریف و «جنگ فمبوی» → دعوت‌نامه با دکمه‌ها"],
          },
          blocks: page === 0
            ? [{ h: "چطور دعوت کنی", lines: ["در گروه، روی پیامِ حریف reply بزن و «جنگ فمبوی» بگو."] }, { h: "چرخه‌ی رضایت", lines: ["دعوت‌نامه با سه دکمه می‌رسد."] }]
            : [{ h: "سقف‌ها", lines: ["هر بازیکن 1 دعوتِ باز."] }],
          page, pageCount: 2,
        }
      }
      return { __fail: { message: "چنین موضوعی در کدکس نیست — شاید نسخه‌ی کهنه.", code: "no_topic", status: 404 } }
    }
  }
  // §15 (V16-1) — راهنمای زنده (اهداف): DTO حداقلی تا کارتِ اهداف رندر شود
  if (path === "/api/game/guide") {
    return {
      stage: { key: "early", name: "قدم‌های اول", emoji: "🌱", description: "شروعِ کار.", nextName: null, progressPct: 10 },
      status: { wealthLabel: "تنگدست", fameLabel: "ناشناس", chaosLabel: "آرام", riskLabel: "کم" },
      direction: { key: "pact", name: "پیمان", emoji: "🎀", description: "فمبویت را بساز." },
      goals: [{ id: "g1", title: "اولین شغل", icon: "💼", category: "immediate", progressPct: 40, progressLabel: "در حالِ جست‌وجو", hint: "به شهر برو", rewardLabel: null }],
      opportunities: [], nextActions: [], aspirations: [],
      headline: "شهر نفس می‌کشد", whatsHappening: "هیچ",
    }
  }
  return { ok: true }
}

// ── telegram stub via grammY transformer ──────────────────────────────────────
const tgCalls: any[] = []
let getChatMemberResult: any = { status: "member" } // mutable per scenario
let failEditMessageText = false

// dynamic (computed-path) imports keep the bot's own tsconfig the only place its
// sources are typechecked — this suite treats them as the black box they are.
const BOT_ROOT = join(REPO_ROOT, "mini-services", "bot")
const { Bot } = (await import(join(BOT_ROOT, "node_modules", "grammy", "out", "mod.js"))) as any
const { registerBot } = (await import(join(BOT_ROOT, "src", "handlers"))) as any
const { drainOutbox } = (await import(join(BOT_ROOT, "src", "group"))) as any
// V16-3 §16 — کیبوردها و نیت‌ها به‌صورتِ مستقیم (تضمینِ ایستا) + رفتاری از همان زنجیره
const kbMod = (await import(join(BOT_ROOT, "src", "keyboards"))) as any
const intentMod = (await import(join(BOT_ROOT, "src", "intent"))) as any

const BOT_ID = 42
const bot = new Bot("1:test-token")
bot.botInfo = { id: BOT_ID, is_bot: true, first_name: "fem", username: "femwarbot" }
bot.api.config.use((prev: any, method: string, payload: any) => {
  const entry: any = { method, payload }
  tgCalls.push(entry)
  // transformer must return Bot-API shape: {ok, result}
  const res = (result: any) => { entry.res = { ok: true, result }; return entry.res }
  if (method === "getChatMember") {
    if (getChatMemberResult instanceof Error) throw getChatMemberResult
    return res(getChatMemberResult)
  }
  if (method === "editMessageText") {
    if (failEditMessageText) throw new Error("Bad Request: message to edit not found")
    return res({ message_id: payload.message_id, date: 1 })
  }
  if (method === "sendMessage") return res({ message_id: nextMsgId(), chat: { id: payload.chat_id, type: "supergroup" } })
  if (method === "sendChatAction") return res(true)
  return res({})
})
const botErrors: string[] = []
bot.catch((err: any) => botErrors.push(String(err.error)))
registerBot(bot)

// ── helpers ───────────────────────────────────────────────────────────────────
let updateSeq = 90000
const nextUpdateId = () => ++updateSeq
const user = (id: number, name = "بازیکن") => ({ id, is_bot: false, first_name: name, username: `u${id}` })
const chat = (id: number, title = "شهرِ آزمون") => ({ id, type: "supergroup", title })
const privChat = (id: number) => ({ id, type: "private", first_name: "پیوی" })
const privMsgUpdate = (userId: number, text: string, extra: any = {}) => ({
  update_id: nextUpdateId(),
  message: {
    message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId),
    text, entities: [{ type: "bot_command", offset: 0, length: text.indexOf(" ") > 0 ? text.indexOf(" ") : text.length }],
    ...extra,
  },
})

const msgUpdate = (chatId: number, from: any, text: string, extra: any = {}) => ({
  update_id: nextUpdateId(),
  message: {
    message_id: nextUpdateId(), date: 1, chat: chat(chatId), from, text,
    // telegram sends bot_command entities for commands — grammY relies on them
    entities: text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: text.indexOf(" ") > 0 ? text.indexOf(" ") : text.length }] : [],
    ...extra,
  },
})
const cbUpdate = (chatId: number, from: any, data: string, msgId = 77) => ({
  update_id: nextUpdateId(),
  callback_query: { id: `cq${nextUpdateId()}`, from, message: { message_id: msgId, date: 1, chat: chat(chatId) }, data },
})
const leftMemberUpdate = (chatId: number, from: any, leaver: any) => ({
  update_id: nextUpdateId(),
  message: { message_id: nextUpdateId(), date: 1, chat: chat(chatId), from, left_chat_member: leaver },
})
const myChatMemberUpdate = (chatId: number, fromId: number, oldStatus: string, newStatus: string) => ({
  update_id: nextUpdateId(),
  my_chat_member: {
    chat: chat(chatId), from: user(fromId, "افزودنی‌ده"), date: 1,
    old_chat_member: { status: oldStatus, user: { id: BOT_ID, is_bot: true, first_name: "fem" } },
    new_chat_member: { status: newStatus, user: { id: BOT_ID, is_bot: true, first_name: "fem" } },
  },
})

const engineCallsFor = (pred: (c: any) => boolean) => engineCalls.filter(pred)
const groupAction = (action: string) => engineCallsFor((c: any) => c.path === "/api/group/command" && c.body?.action === action)
const tg = (method: string) => tgCalls.filter((c: any) => c.method === method)
const sendTexts = () => tg("sendMessage").map((c: any) => c.payload?.text ?? "")
const sendPayloads = (chatId: number) => tg("sendMessage").filter((c: any) => String(c.payload.chat_id) === String(chatId))
const editPayloads = () => tg("editMessageText").map((c: any) => c.payload)

// ── assertion bookkeeping ──────────────────────────────────────────────────────
let pass = 0, fail = 0
const failures: string[] = []
function ok(cond: boolean, label: string, detail = ""): void {
  if (cond) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; failures.push(label); console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`) }
}

// ═══ 1. dedup middleware ══════════════════════════════════════════════════════
console.log("① dedup: same update.id twice → handler runs once")
{
  const c1 = -100101, u1 = user(1001)
  const dup = msgUpdate(c1, u1, "/event")
  await bot.handleUpdate(structuredClone(dup))
  await bot.handleUpdate(structuredClone(dup))
  ok(groupAction("command").filter((c: any) => c.body.command === "event").length === 1, "duplicate update → exactly 1 engine command")
}

// ═══ 2. rate limiter ══════════════════════════════════════════════════════════
console.log("② rate limiter: 3 commands <2s → 1 engine call; callback <300ms → toast, no engine call")
{
  const c2 = -100202, u2 = user(2002)
  for (let i = 0; i < 3; i++) await bot.handleUpdate(msgUpdate(c2, u2, "/event"))
  ok(groupAction("command").filter((c: any) => c.body.command === "event" && c.body.chatId === String(c2)).length === 1, "3 rapid commands → exactly 1 engine call")
  ok(sendPayloads(c2).length === 1 && (sendPayloads(c2)[0]?.payload?.text ?? "").includes("کارتِ موتور"), "exactly 1 card rendered in that chat")
}
{
  const c3 = -100303, u3 = user(3003)
  const before = groupAction("callback").length
  await bot.handleUpdate(cbUpdate(c3, u3, "gm:game", 81))
  await bot.handleUpdate(cbUpdate(c3, u3, "gm:game", 82))
  const slowToast = tg("answerCallbackQuery").filter((c: any) => (c.payload?.text ?? "").includes("کمی آهسته‌تر"))
  ok(groupAction("callback").length === before + 1, "second callback <300ms → no engine call")
  ok(slowToast.length === 1, "slow-down toast «کمی آهسته‌تر 🐢» shown once")
}

// ═══ 3. group /duel → consent challenge ══════════════════════════════════════
console.log("③ group /duel with reply target → engine challenge, no instant combat")
{
  const c4 = -100404, u4 = user(4004), uTarget = user(888, "رقیب")
  const beforeCb = engineCallsFor((c: any) => c.path === "/api/game/combat").length
  await bot.handleUpdate(msgUpdate(c4, u4, "/duel", { reply_to_message: { message_id: 9, date: 1, chat: chat(c4), from: uTarget, text: "سلام" } }))
  const duelCmd = groupAction("command").filter((c: any) => c.body.chatId === String(c4))
  ok(duelCmd.length === 1 && duelCmd[0].body.command === "duel 888", `engine payload command:"duel 888"`, JSON.stringify(duelCmd.map((c: any) => c.body.command)))
  ok(duelCmd[0].body.telegramId === "4004", "challenger telegramId forwarded")
  ok(engineCallsFor((c: any) => c.path === "/api/game/combat").length === beforeCb, "NO call to /api/game/combat")
  ok(sendTexts().some((t: string) => (t ?? "").includes("دعوت‌نامه فرستاده شد")), "engine invitation-ack card rendered")
  // no target → engine usage card (bot is renderer; miss stays bot-side)
  const c4b = -100405
  await bot.handleUpdate(msgUpdate(c4b, user(4005), "/duel"))
  ok(groupAction("command").some((c: any) => c.body.chatId === String(c4b) && c.body.command === "duel"), "bare /duel → engine usage card path (command:\"duel\")")
}

// ═══ 4. gc:/gs: routing ═══════════════════════════════════════════════════════
console.log("④ gc:/gs: callback data routes to engine group callback path")
{
  const c5 = -100506, u5 = user(5005)
  await bot.handleUpdate(cbUpdate(c5, u5, "gc:challenge1:accept", 90))
  const gcCall = groupAction("callback").filter((c: any) => c.body.data === "gc:challenge1:accept")
  ok(gcCall.length === 1, "gc:{id}:accept → engine callback with exact data")
  ok(gcCall[0].body.chatId === String(c5) && gcCall[0].body.telegramId === "5005", "gc: carries chatId + telegramId")
  getChatMemberResult = { status: "member" }
  await bot.handleUpdate(cbUpdate(c5, user(5006), "gs:toggle:enabled", 91))
  const gsCall = groupAction("callback").filter((c: any) => c.body.data === "gs:toggle:enabled")
  ok(gsCall.length === 1, "gs:toggle:enabled → engine callback")
  ok(gsCall[0].body.isAdmin === undefined, "gs: with member status → NO isAdmin")
}

// ═══ 5. gs: live admin verification ═══════════════════════════════════════════
console.log("⑤ gs: isAdmin from live getChatMember (admin/member/throw)")
{
  const c6 = -100607
  getChatMemberResult = { status: "administrator" }
  await bot.handleUpdate(cbUpdate(c6, user(6006), "gs:set:noise:quiet", 95))
  let call = groupAction("callback").filter((c: any) => c.body.data === "gs:set:noise:quiet")
  ok(call.length === 1 && call[0].body.isAdmin === true, "administrator → isAdmin:true forwarded")

  const c6b = -100608
  getChatMemberResult = { status: "creator" }
  await bot.handleUpdate(cbUpdate(c6b, user(6007), "gs:set:noise:silent", 96))
  call = groupAction("callback").filter((c: any) => c.body.data === "gs:set:noise:silent")
  ok(call.length === 1 && call[0].body.isAdmin === true, "creator → isAdmin:true forwarded")

  const c6c = -100609
  getChatMemberResult = new Error("network broke")
  const errsBefore = botErrors.length
  await bot.handleUpdate(cbUpdate(c6c, user(6008), "gs:recover", 97))
  call = groupAction("callback").filter((c: any) => c.body.data === "gs:recover")
  ok(call.length === 1 && call[0].body.isAdmin === undefined, "getChatMember throw → no isAdmin")
  ok(botErrors.length === errsBefore, "getChatMember throw → no crash")
  // 60s cache: same chat+user, second press reuses cached admin WITHOUT a new getChatMember
  // (350ms wait so the 300ms anti-flood window passes — the flood itself is test ②)
  await new Promise((r) => setTimeout(r, 350))
  const gmBefore = tg("getChatMember").length
  getChatMemberResult = { status: "member" }
  await bot.handleUpdate(cbUpdate(c6, user(6006), "gs:view", 98))
  call = groupAction("callback").filter((c: any) => c.body.data === "gs:view")
  ok(tg("getChatMember").length === gmBefore, "60s cache: no repeat getChatMember for same (chat,user)")
  ok(call.length === 1 && call[0].body.isAdmin === true, "cached admin verdict reused (isAdmin:true)")
  getChatMemberResult = { status: "member" }
}

// ═══ 6. home edit-in-place ════════════════════════════════════════════════════
console.log("⑥ home edit-in-place: edit within 5min · error → fresh · stale → fresh")
{
  const c7 = -100701
  const sendsBefore = tg("sendMessage").length, editsBefore = tg("editMessageText").length
  await bot.handleUpdate(msgUpdate(c7, user(7001), "/game"))
  const firstSend = tg("sendMessage").slice(sendsBefore)[0]
  ok(Boolean(firstSend) && tg("editMessageText").length === editsBefore, "first home → fresh sendMessage")
  // second /game (different user → bypasses 2s limiter) → edit the same message
  await bot.handleUpdate(msgUpdate(c7, user(7002), "/game"))
  const edits = tg("editMessageText").slice(editsBefore)
  ok(edits.length === 1, "second home within 5min → editMessageText (no new message)")
  const editId = edits[0]?.payload?.message_id
  const sendId = firstSend?.res?.result?.message_id
  ok(editId !== undefined && sendId !== undefined && editId === sendId, "edit targets the first home message id", JSON.stringify({ editId, sendId }))
  ok((firstSend?.payload?.text ?? "").includes("🔑"), "private nudge line kept in home card")

  // edit error → fresh send fallback
  failEditMessageText = true
  const sendsBefore2 = tg("sendMessage").length
  await bot.handleUpdate(msgUpdate(c7, user(7003), "/game"))
  failEditMessageText = false
  ok(tg("sendMessage").length === sendsBefore2 + 1, "edit error → fresh send fallback")

  // stale (>5min) → fresh send (age the cache via the globalThis-guarded map)
  const homeMap = (globalThis as any).__femwarHomeCards
  const entry = homeMap?.get(c7)
  ok(Boolean(entry), "home cache is globalThis-guarded (accessible)")
  if (entry) entry.at = Date.now() - 6 * 60_000
  const sendsBefore3 = tg("sendMessage").length
  await bot.handleUpdate(msgUpdate(c7, user(7004), "/game"))
  ok(tg("sendMessage").length === sendsBefore3 + 1, "stale home (>5min) → fresh send")
  // non-home command in same chat does NOT edit home (plain card)
  const editsBefore4 = tg("editMessageText").length
  await bot.handleUpdate(msgUpdate(c7, user(7005), "/event"))
  ok(tg("editMessageText").length === editsBefore4, "non-home command → plain new card (no home edit)")
}

// ═══ 7. lifecycle: my_chat_member + left_chat_member ══════════════════════════
console.log("⑦ lifecycle: kicked → unreachable pause · left_chat_member → member_left · bot-add claimed once")
{
  const c8 = -100801
  await bot.handleUpdate(myChatMemberUpdate(c8, 8101, "member", "kicked"))
  const unreach = groupAction("delivered").filter((c: any) => (c.body.unreachable ?? []).includes(String(c8)))
  ok(unreach.length === 1, "bot kicked → unreachable report (engine pause path)")
  ok(groupAction("member_left").every((c: any) => c.body.telegramId !== String(BOT_ID)), "kicked bot → NO member_left for the bot itself")
  const homeMap2 = (globalThis as any).__femwarHomeCards
  ok(!homeMap2?.has(c8), "kicked chat → home cache forgotten locally")

  // left_chat_member (human) → member_left once; duplicate update id → still once
  const c9 = -100901, leaver = user(9999, "رفتنی")
  const leftMsg = leftMemberUpdate(c9, user(9001), leaver)
  await bot.handleUpdate(structuredClone(leftMsg))
  await bot.handleUpdate(structuredClone(leftMsg))
  const ml = groupAction("member_left").filter((c: any) => c.body.chatId === String(c9))
  ok(ml.length === 1 && ml[0].body.telegramId === "9999", "left_chat_member → member_left fired once (dedup)")

  // bot added via my_chat_member FIRST, then service message → one game card
  const c10 = -101001
  await bot.handleUpdate(myChatMemberUpdate(c10, 10101, "left", "member"))
  await bot.handleUpdate({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: chat(c10), from: user(10101), new_chat_members: [{ id: BOT_ID, is_bot: true, first_name: "fem" }] },
  })
  const games = groupAction("command").filter((c: any) => c.body.command === "game" && c.body.chatId === String(c10))
  ok(games.length === 1, "bot added (my_chat_member + service msg) → exactly ONE game registration/card")

  // reverse order: service message first, my_chat_member second → still one
  const c11 = -101101
  await bot.handleUpdate({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: chat(c11), from: user(11101), new_chat_members: [{ id: BOT_ID, is_bot: true, first_name: "fem" }, user(11102, "تازه‌وارد")] },
  })
  await bot.handleUpdate(myChatMemberUpdate(c11, 11101, "left", "member"))
  const games11 = groupAction("command").filter((c: any) => c.body.command === "game" && c.body.chatId === String(c11))
  ok(games11.length === 1, "reverse order → still exactly ONE game card")
  const memberCalls = groupAction("member").filter((c: any) => c.body.chatId === String(c11))
  ok(memberCalls.length === 1 && memberCalls[0].body.telegramId === "11102", "human newcomer still registered via action:\"member\"")

  // promotion (member → administrator) → silence
  const gamesBefore12 = groupAction("command").length
  await bot.handleUpdate(myChatMemberUpdate(-101201, 11201, "member", "administrator"))
  ok(groupAction("command").length === gamesBefore12, "promotion member→administrator → no card, no engine call")
}

// ═══ 8. private behavior untouched ═══════════════════════════════════════════
console.log("⑧ private routing untouched · PRIVATE_ONLY verb in group → privateNudge")
{
  const priv = 555001
  const groupCmdBefore = groupAction("command").length + groupAction("callback").length
  await bot.handleUpdate(privMsgUpdate(8001, "/help"))
  const helpCard = sendPayloads(8001).at(-1)?.payload
  ok((helpCard?.text ?? "").includes("راهنمای FEMBOY WAR"), "private /help → interactive help home (engine categories)")
  ok((helpCard?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.callback_data?.startsWith("hp:c:")), "...with hp:c: category buttons")
  ok(groupAction("command").length + groupAction("callback").length === groupCmdBefore, "private command → no group engine call")

  // V15-3 — فعلِ شخصیِ فمبوی در گروه → دروازه‌ی مالکیتِ پنل (guard به‌جای privateNudge)
  const c13 = -101301
  const before8 = engineCalls.length
  const toastsBefore8 = tg("answerCallbackQuery").length
  const editsBefore8 = tg("editMessageText").length
  await bot.handleUpdate(cbUpdate(c13, user(8101), "fw:skills", 120))
  const toasts8 = tg("answerCallbackQuery").slice(toastsBefore8).map((c: any) => c.payload?.text ?? "")
  ok(toasts8.includes("این پنل متعلق به بازیکن دیگری است."), "fw:skills in group → ownership-guard toast «این پنل متعلق به بازیکن دیگری است.»")
  const cards8 = sendPayloads(c13)
  ok(cards8.length === 1 && (cards8[0]?.payload?.text ?? "").includes("این پنل متعلق به بازیکن دیگری است."), "guard card: fresh REPLY in the group carrying the mission message")
  ok((cards8[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.text === "باز کردنِ پنلِ خودت" && (b.url ?? "") === "https://t.me/femwarbot"), "guard card carries «باز کردنِ پنلِ خودت» deep link (no owner info)")
  ok(engineCalls.length === before8, "guard fired BEFORE any engine call (zero mutation)")
  ok(tg("editMessageText").length === editsBefore8, "hijacked group message never edited (shared-panel safety §3B)")

  // fw:duel toast (public-card button) — private duel guide intact
  await bot.handleUpdate(cbUpdate(-101302, user(8102), "fw:duel", 121))
  ok(tg("answerCallbackQuery").some((c: any) => (c.payload?.text ?? "").includes("برای دوئل: روی پیامِ حریف ریپلای کن")), "fw:duel toast intact")
}

// ═══ 9. /gadmin admin gating ══════════════════════════════════════════════════
console.log("⑨ /gadmin: isAdmin attached per live getChatMember")
{
  const c14 = -101401
  getChatMemberResult = { status: "administrator" }
  await bot.handleUpdate(msgUpdate(c14, user(8201), "/gadmin"))
  let g = groupAction("command").filter((c: any) => c.body.command === "gadmin" && c.body.chatId === String(c14))
  ok(g.length === 1 && g[0].body.isAdmin === true, "gadmin + administrator → engine command with isAdmin:true")
  ok(sendTexts().some((t: string) => (t ?? "").includes("تنظیماتِ شهر")), "gadmin settings card rendered")

  const c15 = -101402
  getChatMemberResult = { status: "member" }
  await bot.handleUpdate(msgUpdate(c15, user(8202), "/gadmin"))
  g = groupAction("command").filter((c: any) => c.body.command === "gadmin" && c.body.chatId === String(c15))
  ok(g.length === 1 && g[0].body.isAdmin === undefined, "gadmin + member → no isAdmin (read-only card path)")

  // private /gadmin → city-commands navigation card (dual() private branch)
  const priv2 = 555002
  const groupBefore = groupAction("command").length
  await bot.handleUpdate(privMsgUpdate(8203, "/gadmin"))
  ok(sendTexts().some((t: string) => (t ?? "").includes("این بخش مالِ شهرِ گروه است")), "private /gadmin → navigation card")
  ok(groupAction("command").length === groupBefore, "private /gadmin → no group engine call")
  getChatMemberResult = { status: "member" }
}

// ═══ 10. ticker/outbox — generic edit + delivery report (challenge passthrough) ═
console.log("⑩ outbox drain: challenge edit + fresh send report (no refType filter)")
{
  const sentIds: any[] = []
  const mockBot = {
    api: {
      editMessageText: async (chatId: any, msgId: any, _text: any, _opts: any) => { sentIds.push({ op: "edit", chatId, msgId }); return { ok: true } },
      sendMessage: async (chatId: any, _text: any, _opts: any) => { const id = nextMsgId(); sentIds.push({ op: "send", chatId, id }); return { message_id: id, chat: { id: chatId } } },
    },
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (url: any, init: any) => {
    const u = new URL(String(url))
    const body = init?.body ? JSON.parse(init.body as string) : null
    if (u.pathname === "/api/group/command" && body?.action === "tick") {
      return new Response(JSON.stringify({ ok: true, data: { messages: [
        { outboxId: "ob-edit-1", chatId: "-102001", text: "⚔️ دعوتِ دوئل — بسته شد", kind: "challenge", buttons: [], editMessageId: "777" },
        { outboxId: "ob-send-1", chatId: "-102001", text: "⚔️ <b>دعوتِ دوئل</b>", kind: "challenge", buttons: [{ label: "⚔️ قبول می‌کنم", style: "success", cb: "gc:ch9:accept" }] },
      ], groupsTicked: 1 } }), { status: 200 })
    }
    engineCalls.push({ path: u.pathname, method: init?.method ?? "GET", body })
    return new Response(JSON.stringify({ ok: true, data: engineResponse(u.pathname, body) }), { status: 200 })
  }) as typeof fetch
  await drainOutbox(mockBot as any)
  globalThis.fetch = realFetch
  ok(sentIds.some((s: any) => s.op === "edit" && s.chatId === "-102001" && s.msgId === 777), "challenge EDIT (editMessageId) delivered via generic edit path")
  const fresh = sentIds.find((s: any) => s.op === "send")
  ok(Boolean(fresh), "challenge invitation (fresh send) delivered with gc: buttons")
  const report = groupAction("delivered").filter((c: any) => Array.isArray(c.body?.delivered)).pop()
  ok(report?.body?.delivered?.some((d: any) => d.outboxId === "ob-send-1" && d.messageId === fresh?.id), "delivery report {outboxId, messageId} flows back for challenge (no refType filter)")
}

// ═══ 11. V13 Part IV — no-slash natural-language intents ═════════════════════
console.log("⑪ no-slash intents: fa/en phrases · normalization (ZWNJ/Arabic ye) · group gating · anti-hijack · anti-flood")
{
  // plain private text WITHOUT bot_command entities (realistic natural language)
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })

  // A) private «راهنما» → interactive help home (engine categories), zero group API
  {
    const u = 11111
    const before = engineCalls.length
    await bot.handleUpdate(plainPriv(u, "راهنما"))
    const cards = sendPayloads(u)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("راهنمای FEMBOY WAR"), "private «راهنما» → interactive help home card")
    ok((cards[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.callback_data?.startsWith("hp:c:")), "...with live category buttons (hp:c:)")
    ok(engineCalls.slice(before).every((c: any) => c.path !== "/api/group/command"), "private intent → zero group API calls")
  }
  // B) private English "help" → same card
  {
    const u = 11112
    await bot.handleUpdate(plainPriv(u, "help"))
    ok(sendPayloads(u).length === 1 && (sendPayloads(u)[0]?.payload?.text ?? "").includes("راهنمای FEMBOY WAR"), "private \"help\" (en, no slash) → help home card")
  }
  // C) private «لغو» with no active flow → quiet cancel card
  {
    const u = 11113
    await bot.handleUpdate(plainPriv(u, "لغو"))
    ok(sendPayloads(u).length === 1 && (sendPayloads(u)[0]?.payload?.text ?? "").includes("چیزی برای لغو در جریان نیست"), "private «لغو» (no active flow) → quiet cancel card")
  }
  // D) private anti-flood: two rapid «راهنما» → one card
  {
    const u = 11114
    await bot.handleUpdate(plainPriv(u, "راهنما"))
    await bot.handleUpdate(plainPriv(u, "راهنما"))
    ok(sendPayloads(u).length === 1, "two rapid private intents → 1 card (admitTextCommand)")
  }
  // E) group unadressed «منو» → engine game (home card path)
  {
    const c = -1001101, u = user(11121)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "منو"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "game" && x.body.chatId === String(c)), "group «منو» (unadressed) → engine game")
  }
  // F) group «وضعیت شهر» → engine city
  {
    const c = -1001102, u = user(11122)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "وضعیت شهر"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "city" && x.body.chatId === String(c)), "group «وضعیت شهر» → engine city")
  }
  // G) ZWNJ normalization: «بازیکن‌ها» with a REAL half-space → engine members
  {
    const c = -1001103, u = user(11123)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "بازیکن" + "\u200C" + "ها"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "members" && x.body.chatId === String(c)), "group «بازیکن‌ها» (real ZWNJ) → engine members")
  }
  // H) Arabic-ye normalization: «وضعيت شهر» (Arabic ي) → engine city
  {
    const c = -1001104, u = user(11124)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "وضعیت شهر".replace("ی", "\u064A")))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "city" && x.body.chatId === String(c)), "group «وضعيت شهر» (Arabic ي) → engine city")
  }
  // I) exact «جنگ فمبوی» → engine duel (mission §2: the phrase IS the duel)
  {
    const c = -1001105, u = user(11125)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "جنگ فمبوی"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "duel" && x.body.chatId === String(c)), "group «جنگ فمبوی» (exact) → engine duel")
  }
  // J) anti-hijack: casual sentence mentioning the game + bare «شهر» → zero commands, observer only
  {
    const c = -1001106, u = user(11126)
    const before = groupAction("command").length
    const obsBefore = engineCallsFor((x: any) => x.path === "/api/group/observe").length
    await bot.handleUpdate(msgUpdate(c, u, "جنگ فمبوی رو دوست دارم"))
    await bot.handleUpdate(msgUpdate(c, u, "شهر"))
    ok(groupAction("command").length === before, "casual mention + bare «شهر» → zero engine commands (anti-hijack)")
    ok(engineCallsFor((x: any) => x.path === "/api/group/observe").length >= obsBefore + 2, "...and both fell through to the presence observer")
  }
  // K) personal unadressed «کیف من» → silence
  {
    const c = -1001107, u = user(11127)
    const before = groupAction("command").length
    const cardsBefore = sendPayloads(c).length
    await bot.handleUpdate(msgUpdate(c, u, "کیف من"))
    ok(groupAction("command").length === before && sendPayloads(c).length === cardsBefore, "group «کیف من» (unadressed, personal) → silence")
  }
  // L) addressed personal «@femwarbot کیف من» → private nudge, zero engine commands
  {
    const c = -1001108, u = user(11128)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "@femwarbot کیف من"))
    const cards = sendPayloads(c)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("خصوصی"), "group «@femwarbot کیف من» → private nudge card")
    ok(groupAction("command").length === before, "...with zero engine commands")
  }
  // M) addressed unknown «@femwarbot سلام» → short phrase hint (choices, not guessing)
  {
    const c = -1001109, u = user(11129)
    await bot.handleUpdate(msgUpdate(c, u, "@femwarbot سلام"))
    const cards = sendPayloads(c)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("«منو»"), "group «@femwarbot سلام» → short intent hint")
  }
  // N) reply-to-bot + «وضعیت شهر» → engine city (addressed via reply)
  {
    const c = -1001110, u = user(11130)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "وضعیت شهر", {
      reply_to_message: { message_id: 555, date: 1, chat: chat(c), from: { id: BOT_ID, is_bot: true, first_name: "fem" } },
    }))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "city" && x.body.chatId === String(c)), "group reply-to-bot «وضعیت شهر» → engine city")
  }
  // O) group anti-flood on intents: two rapid «منو» → 1 engine call
  {
    const c = -1001111, u = user(11131)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "منو"))
    await bot.handleUpdate(msgUpdate(c, u, "منو"))
    ok(groupAction("command").length === before + 1, "two rapid group intents → 1 engine call")
  }
}

// ═══ 12. V13 §VI closure — the no-slash surface ═══════════════════════════════
console.log("⑫ no-slash closure: duel/vote/gadmin/market intents · help & profile surfaces carry zero slash ads")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })

  // A) group «دوئل» (open, unadressed) → engine duel usage card
  {
    const c = -1001201, u = user(12101)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "دوئل"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "duel" && x.body.chatId === String(c)), "group «دوئل» (open) → engine duel")
  }
  // B) group «رأی‌گیری» → engine vote
  {
    const c = -1001202, u = user(12102)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, u, "رأی‌گیری"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "vote" && x.body.chatId === String(c)), "group «رأی‌گیری» → engine vote")
  }
  // C) group «تنظیمات شهر» by an admin → engine gadmin with isAdmin
  {
    const c = -1001203, u = user(12103)
    const before = groupAction("command").length
    getChatMemberResult = { status: "administrator" }
    await bot.handleUpdate(msgUpdate(c, u, "تنظیمات شهر"))
    const g = groupAction("command").slice(before).find((x: any) => x.body.command === "gadmin" && x.body.chatId === String(c))
    ok(Boolean(g), "group «تنظیمات شهر» (admin) → engine gadmin")
    ok(g?.body.isAdmin === true, "...with isAdmin:true")
    getChatMemberResult = { status: "member" }
  }
  // D) private «بازار» → engine market + the real market card (not an error card)
  {
    const u = 12104
    const before = engineCalls.length
    await bot.handleUpdate(plainPriv(u, "بازار"))
    ok(engineCalls.slice(before).some((c: any) => c.path === "/api/game/market"), "private «بازار» → engine market")
    const cards = sendPayloads(u)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("بازارِ شهر"), "...the real market card renders")
  }
  // E) private «جنگ فمبوی» → duel guide card (phrase-based, no slash)
  {
    const u = 12105
    await bot.handleUpdate(plainPriv(u, "جنگ فمبوی"))
    const text = sendPayloads(u)[0]?.payload?.text ?? ""
    ok(text.includes("دوئل"), "private «جنگ فمبوی» → duel guide card")
    ok(!/\/[a-z]+/i.test(text.replace(/<[^>]+>/g, "")), "...visible text carries zero slash tokens")
  }
  // F) no-slash sweep of the private help card (HTML tags stripped — only visible text)
  {
    const u = 12106
    await bot.handleUpdate(plainPriv(u, "راهنما"))
    const text = sendPayloads(u)[0]?.payload?.text ?? ""
    ok(!/\/[a-z]+/i.test(text.replace(/<[^>]+>/g, "")), "private help card carries zero slash tokens")
  }
  // G) static guarantee: no slash ads remain across bot+engine player-facing surfaces
  {
    const files = [
      "mini-services/bot/src/handlers.ts",
      "mini-services/bot/src/soul.ts",
      "mini-services/bot/src/format.ts",
      "mini-services/bot/src/keyboards.ts",
      "src/lib/game/group/presentation.ts",
      "src/lib/game/group/challenges.ts",
    ].map((f) => join(REPO_ROOT, f))
    ok(files.every((f) => !readFileSync(f, "utf8").includes('cmd("/')), 'no cmd("/") ads across bot+engine group surfaces')
    const idx = readFileSync(join(REPO_ROOT, "mini-services/bot/src/index.ts"), "utf8")
    ok(!/\{\s*command:\s*"/.test(idx), "Telegram command-menu registration is cleared (no command entries)")
    ok(!idx.includes("/start") && !idx.includes("/game") && !idx.includes("/myfemboy"), "bot descriptions carry no slash mentions")
  }
}

// ═══ 13. V15-2 — private interactive help (hp:) · duels/economy/fame wiring · sameRow ═
console.log("⑬ V15-2: private codex browser (hp:) · group guard · trio wiring · sameRow grid")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCbUpdate = (userId: number, data: string, msgId = 77) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const helpCalls = (action: string) => engineCallsFor((c: any) => c.path === "/api/game/help" && c.body?.action === action)
  const rowsOf = (payload: any) => payload?.reply_markup?.inline_keyboard ?? []
  const flatCbs = (payload: any) => rowsOf(payload).flat().map((b: any) => b.callback_data ?? b.url ?? "")
  const lastShown = () => {
    const edits = tg("editMessageText")
    const sends = tg("sendMessage")
    const ie = edits.length ? tgCalls.lastIndexOf(edits.at(-1)) : -1
    const isx = sends.length ? tgCalls.lastIndexOf(sends.at(-1)) : -1
    return ie >= isx ? edits.at(-1)?.payload : sends.at(-1)?.payload
  }

  // A) private «راهنما» → engine categories fetched once (60s cache), home card + hp: buttons
  {
    const cache = (globalThis as any).__femwarHelpCats
    if (cache) { cache.at = 0; cache.cats = [] } // reset the in-memory categories cache
    const u = 13001
    const before = helpCalls("categories").length
    await bot.handleUpdate(plainPriv(u, "راهنما"))
    const card = sendPayloads(u).at(-1)?.payload
    ok(helpCalls("categories").length === before + 1, "private «راهنما» → engine /api/game/help categories fetched")
    ok((card?.text ?? "").includes("راهنمای FEMBOY WAR") && (card?.text ?? "").includes("شروعِ سریع"), "help home card: title + quick-start lines")
    ok(flatCbs(card).includes("hp:c:combat") && flatCbs(card).includes("hp:c:start"), "help home carries hp:c: category buttons")
    ok(flatCbs(card).includes("m:menu"), "help home carries «🏠 پیشخوان» back button (m:menu)")
    const u2 = 13002
    await bot.handleUpdate(plainPriv(u2, "راهنما"))
    ok(helpCalls("categories").length === before + 1, "second user within 60s → cached categories (rate-limit conscious)")
    ok(flatCbs(sendPayloads(u2).at(-1)?.payload).includes("hp:c:combat"), "...and still gets the full category grid")
  }
  // B) hp:c:{catId} → topics list, 12-per-page pagination, edit-in-place
  {
    const u = 13003
    const topicsBefore = helpCalls("topics").length
    const editsBefore = tg("editMessageText").length
    await bot.handleUpdate(privCbUpdate(u, "hp:c:combat"))
    ok(helpCalls("topics").length === topicsBefore + 1, "hp:c:combat → engine topics fetch (always fresh)")
    ok(tg("editMessageText").length === editsBefore + 1, "category list EDITS the same message (edit-in-place, no article spam)")
    const cat = tg("editMessageText").at(-1)?.payload
    ok((cat?.text ?? "").includes("جنگ فمبوی و مبارزه") && (cat?.text ?? "").includes("صفحه‌ی 1 از 2"), "category card: title + page indicator (13 topics → 2 pages)")
    const cbs = flatCbs(cat)
    ok(cbs.filter((d: string) => d.startsWith("hp:t:")).length === 12, "page 1 shows 12 topic buttons")
    ok(cbs.includes("hp:c:combat:1"), "«ادامه ▶» list-pagination button present")
    ok(cbs.includes("hp:h") && cbs.includes("m:menu"), "category card carries «↩ راهنما» + «🏠 پیشخوان» back buttons")
    const u2 = 13004
    await bot.handleUpdate(privCbUpdate(u2, "hp:c:combat:1"))
    const cat2 = tg("editMessageText").at(-1)?.payload
    ok((cat2?.text ?? "").includes("موضوعِ 13"), "hp:c:combat:1 → page 2 shows the 13th topic")
    ok(flatCbs(cat2).includes("hp:c:combat"), "«◀ قبلی» back to page 1 present")
  }
  // C) hp:t:{topicId}:{page} → topic card, server-side pagination, related jumps
  {
    const u = 13005
    const topicBefore = helpCalls("topic").length
    await bot.handleUpdate(privCbUpdate(u, "hp:t:combat-duels:0"))
    ok(helpCalls("topic").length === topicBefore + 1, "hp:t:combat-duels:0 → engine topic fetch")
    const t0 = tg("editMessageText").at(-1)?.payload
    ok((t0?.text ?? "").includes("دوئل — جنگِ فمبویِ دو نفر") && (t0?.text ?? "").includes("چطور دعوت کنی"), "topic page renders heading/paragraph blocks")
    const cbs0 = flatCbs(t0)
    ok(cbs0.includes("hp:t:combat-duels:1"), "«ادامه ▶» topic pagination present")
    ok(!cbs0.some((d: string) => d.startsWith("hp:t:faq")), "related jumps render only on the last page (engine codex parity)")
    ok(cbs0.includes("hp:c:combat") && cbs0.includes("hp:h"), "topic card carries «↩ دسته» + «🏠 راهنما» back buttons")
    ok(!(t0?.text ?? "").includes("عبارت‌ها:"), "phrases render only on the last page")
    const u2 = 13006
    await bot.handleUpdate(privCbUpdate(u2, "hp:t:combat-duels:1"))
    const t1 = tg("editMessageText").at(-1)?.payload
    ok(helpCalls("topic").at(-1)?.body?.page === 1, "page 2 → engine called with page:1 (server-side pagination)")
    ok((t1?.text ?? "").includes("سقف‌ها") && (t1?.text ?? "").includes("عبارت‌ها:"), "page 2: remaining blocks + supported phrases")
    ok(flatCbs(t1).includes("hp:t:combat-duels:0"), "«◀ قبلی» present on page 2")
    ok(flatCbs(t1).includes("hp:t:faq-x:0"), "related topic jump button on the last page (≤ 2)")
  }
  // D) stale/unknown ids → friendly stale card + recovery button
  {
    const u = 13007
    await bot.handleUpdate(privCbUpdate(u, "hp:t:nonsense:0"))
    let shown = lastShown()
    ok((shown?.text ?? "").includes("کدکس کهنه شده"), "unknown topic id → friendly stale card (no error dump)")
    ok(flatCbs(shown).includes("hp:h"), "stale card carries «↩ راهنما» recovery button")
    const u2 = 13008
    await bot.handleUpdate(privCbUpdate(u2, "hp:c:nonsense"))
    shown = lastShown()
    ok((shown?.text ?? "").includes("کدکس کهنه شده"), "unknown category id → friendly stale card")
  }
  // E) hp: in GROUP chat is NOT private help; group «راهنما» still → engine gh: path
  {
    const c = -1001300
    const helpBefore = engineCallsFor((x: any) => x.path === "/api/game/help").length
    const toastsBeforeE = tg("answerCallbackQuery").length
    const editsBeforeE = tg("editMessageText").length
    await bot.handleUpdate(cbUpdate(c, user(13009), "hp:h", 901))
    ok(engineCallsFor((x: any) => x.path === "/api/game/help").length === helpBefore, "hp: callback in GROUP → NOT routed as private help (no /api/game/help)")
    const toastsE = tg("answerCallbackQuery").slice(toastsBeforeE).map((x: any) => x.payload?.text ?? "")
    ok(toastsE.includes("این پنل متعلق به بازیکن دیگری است."), "hp: in group → ownership-guard toast (V15-3 replaces the old private nudge)")
    ok(tg("editMessageText").length === editsBeforeE, "hp: in group → group message not edited (guard replies, never edits)")
    const cardE = sendPayloads(c).at(-1)?.payload
    ok((cardE?.text ?? "").includes("این پنل متعلق به بازیکن دیگری است."), "hp: in group → mission-text card")
    ok((cardE?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.text === "باز کردنِ پنلِ خودت"), "…with the «باز کردنِ پنلِ خودت» own-copy button")
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, user(13010), "راهنما"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "help" && x.body.chatId === String(c)), "group «راهنما» → engine help command (gh: codex path, unchanged)")
    ok(engineCallsFor((x: any) => x.path === "/api/game/help").length === helpBefore, "...with zero private-help API calls")
  }
  // E2) V15-hotfix regression: gh: codex buttons pressed IN A GROUP must reach the
  // engine as group callbacks (the missing "gh:" prefix in GROUP_CB_PREFIXES made
  // every group help button a silent dead button — user-reported bug).
  // سه کاربرِ متفاوت — هم عبور از ضدسیلِ ۳۰۰ms، هم اثباتِ مرورِ هم‌زمانِ کدکس.
  {
    const c = -1001309
    const cbBefore = groupAction("callback").length
    const editsBefore = tg("editMessageText").length
    const toastsBefore = tg("answerCallbackQuery").length
    // gh:m — کدکسِ کامل (دسته‌ها)
    await bot.handleUpdate(cbUpdate(c, user(13019), "gh:m", 903))
    // gh:c:{cat} — یک دسته‌ی عمیق
    await bot.handleUpdate(cbUpdate(c, user(13020), "gh:c:combat", 904))
    // gh:t:{topic}:{page} — صفحه‌ی موضوع
    await bot.handleUpdate(cbUpdate(c, user(13021), "gh:t:start-basics:0", 905))
    const ghCalls = groupAction("callback").slice(cbBefore).filter((x: any) => String(x.body?.data ?? "").startsWith("gh:"))
    ok(ghCalls.length === 3, "gh:m / gh:c: / gh:t: pressed in GROUP → all 3 reached the engine as group callbacks (was: 0 — dead buttons)")
    ok(ghCalls.every((x: any) => x.body.chatId === String(c) && x.body.action === "callback"), "...with correct chatId + action=callback")
    ok(new Set(ghCalls.map((x: any) => x.body.telegramId)).size === 3, "...each with its own presser identity (multi-user codex browse)")
    ok(tg("editMessageText").length === editsBefore + 3, "engine editCard applied in place for all 3 gh: presses")
    ok(tg("answerCallbackQuery").length >= toastsBefore + 3, "each gh: press acknowledged (no swallowed callbacks)")
  }
  // F) routeGroupIntent wiring: duels/economy/fame phrases → engine commands
  {
    const c = -1001301
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, user(13011), "دوئل" + "\u200C" + "ها"))
    await bot.handleUpdate(msgUpdate(c, user(13012), "اقتصاد"))
    await bot.handleUpdate(msgUpdate(c, user(13013), "افتخارات"))
    await bot.handleUpdate(msgUpdate(c, user(13014), "نبردها و رقابت" + "\u200C" + "ها"))
    const cmds = groupAction("command").slice(before).filter((x: any) => x.body.chatId === String(c)).map((x: any) => x.body.command)
    ok(cmds.includes("duels"), "group «دوئل‌ها» (real ZWNJ) → engine command duels")
    ok(cmds.includes("economy"), "group «اقتصاد» → engine command economy")
    ok(cmds.includes("fame"), "group «افتخارات» → engine command fame")
    ok(cmds.filter((x: any) => x === "duels").length === 2, "group «نبردها و رقابت‌ها» → engine duels (section 4 phrase)")
  }
  // G) private routing of the trio → existing personal equivalents (no new private features)
  {
    const u = 13015
    await bot.handleUpdate(plainPriv(u, "دوئل" + "\u200C" + "ها"))
    ok((sendPayloads(u).at(-1)?.payload?.text ?? "").includes("دوئلِ فمبوی‌ها در گروه‌ها"), "private «دوئل‌ها» → existing duel guide card")
    const u2 = 13016
    const before = engineCalls.length
    await bot.handleUpdate(plainPriv(u2, "اقتصاد"))
    ok(engineCalls.slice(before).some((c: any) => c.path === "/api/game/market"), "private «اقتصاد» → personal market (showMarket)")
    ok((sendPayloads(u2).at(-1)?.payload?.text ?? "").includes("بازارِ شهر"), "...the real market card renders")
    const u3 = 13017
    await bot.handleUpdate(plainPriv(u3, "افتخارات"))
    ok(engineCalls.slice(before).some((c: any) => c.path === "/api/game/character/hall"), "private «افتخارات» → champ hall (handleChampCommand)")
    ok((sendPayloads(u3).at(-1)?.payload?.text ?? "").includes("تالارِ افتخارات"), "...the real hall card renders")
  }
  // H) outboxKeyboard sameRow → 2-per-row grid; long/unmarked → full width (backward compatible)
  {
    const c = -1001302
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, user(13018), "اقتصاد"))
    ok(groupAction("command").slice(before).some((x: any) => x.body.command === "economy" && x.body.chatId === String(c)), "group «اقتصاد» → engine economy (grid render path)")
    const card = sendPayloads(c).at(-1)?.payload
    const rows = rowsOf(card).filter((r: any) => r.length > 0) // trailing empty row = yesterday's wire format too
    ok(rows.length === 4, "5 buttons → 4 rows (one pair + three full-width)", JSON.stringify(rowsOf(card).map((r: any) => r.length)))
    ok(rows[0]?.length === 2 && rows[0]?.[0]?.callback_data === "gm:city" && rows[0]?.[1]?.callback_data === "gm:projects", "sameRow short pair → 2 buttons in ONE row")
    ok(rows[1]?.length === 1 && rows[1]?.[0]?.url === "https://t.me/femwarbot", "sameRow but LONG label → own full-width row (pair refused)")
    ok(rows[2]?.length === 1 && rows[3]?.length === 1, "buttons without sameRow → one per row (yesterday's behavior, unchanged)")
  }
}

// ═══ 14. V15-3 — مأموریت §10: تست‌های A–D (پنل‌های خصوصی) ═════════════════════
// آفلاین رویِ همان زنجیره‌ی واقعیِ ربات: موتور mock (fetch سراسری) + تلگرام stub.
// هر حرفِ مأموریت این‌جا برچسبِ صریح دارد؛ رجیستریِ پنل‌ها (__femwarPrivatePanels)
// همان هویتِ §3A است که panels.ts در هر کال‌بکِ خصوصی مُهر می‌زند.
console.log("⑭ V15-3: mission tests A–D (private panels)")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCb = (userId: number, data: string, msgId: number) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const panelsMap = () => (globalThis as any).__femwarPrivatePanels as Map<string, any> | undefined
  const panelOf = (tid: string) => panelsMap()?.get(tid) ?? null
  const ownEdits = (chatId: number) => tg("editMessageText").filter((e: any) => String(e.payload?.chat_id) === String(chatId))
  const ownSends = (chatId: number) => sendPayloads(chatId)
  const missionToast = (fromIdx: number) =>
    tg("answerCallbackQuery").slice(fromIdx).map((c: any) => c.payload?.text ?? "")

  // ── Test A: دو بازیکن، همان منو («کیف») — پنل‌های مستقل ──────────────────────
  console.log("  ── §A two players, same menu (inventory) — independent panels ──")
  {
    const U1 = 14001, U2 = 14002
    await bot.handleUpdate(plainPriv(U1, "کیف"))
    await bot.handleUpdate(plainPriv(U2, "کیف"))
    const c1 = ownSends(U1), c2 = ownSends(U2)
    ok(c1.length === 1 && c2.length === 1, "A: each player got exactly ONE bag card in their own private chat")
    ok((c1[0]?.payload?.text ?? "").includes("🎒 <b>کیف</b>") && (c2[0]?.payload?.text ?? "").includes("🎒 <b>کیف</b>"), "A: both cards are the real inventory card")
    const id1 = c1[0]?.res?.result?.message_id, id2 = c2[0]?.res?.result?.message_id
    ok(id1 !== undefined && id2 !== undefined && id1 !== id2, "A: separate message ids (no shared message)")
    // دکمه‌ی آیتمِ واقعی از کارتِ کیفِ خودش — ناوبریِ عمیق‌تر
    const btn1 = (c1[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().find((b: any) => b.callback_data === "i:fav:water")
    ok(Boolean(btn1), "A: U1's card carries a real item-action button (i:fav:water)")
    const beforeA = engineCalls.length // بعد از باز شدنِ هر دو پنل — فقط پنجره‌ی فشارِ U1
    await bot.handleUpdate(privCb(U1, "i:fav:water", id1))
    ok(engineCallsFor((c: any) => c.path === "/api/game/action" && c.body?.telegramId === String(U1)).length === 1, "A: U1's deeper navigation dispatched with U1's own telegramId")
    ok(engineCalls.slice(beforeA).every((c: any) => c.body?.telegramId !== String(U2)), "A: zero engine calls carried U2's identity from U1's press")
    ok(ownEdits(U1).some((e: any) => e.payload?.message_id === id1) && ownEdits(U2).length === 0, "A: only U1's message was edited — U2's panel untouched")
    // U2 هم رویِ پنلِ خودش ناوبری می‌کند؛ بعد ناوبریِ عمیق‌ترِ U1 نباید رجیستریِ U2 را جابجا کند
    const btn2 = (c2[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().find((b: any) => b.callback_data === "i:fav:water")
    await bot.handleUpdate(privCb(U2, (btn2 ? "i:fav:water" : "i:use:water"), id2))
    await new Promise((r) => setTimeout(r, 350)) // ضدسیلِ همان کاربر (U1)
    await bot.handleUpdate(privCb(U1, "i:use:water", id1))
    const p1 = panelOf(String(U1)), p2 = panelOf(String(U2))
    ok(p1?.type === "item" && p1?.nav === "i:use:water" && p1?.chatId === U1, "A: registry — U1's panel identity (owner+chat+type+nav)")
    ok(p2?.type === "item" && p2?.chatId === U2 && p2?.nav === "i:fav:water", "A: registry — U2's navigation state NOT overwritten by U1's deeper navigation")
  }

  // ── Test B: کال‌بکِ غیرمجاز — دکمه‌ی پنلِ شخصی در گروه توسطِ دیگری ────────────
  console.log("  ── §B unauthorized callback — owner-panel button pressed in a GROUP ──")
  {
    const U1 = 14003, U2 = 14004, G = -1001400
    // U1 پنلِ فمبوی‌اش را در پیوی باز کرده (fw:skills → کارتِ noCharacter — پنلِ خودش)
    const beforeB0 = engineCalls.length
    await bot.handleUpdate(privCb(U1, "fw:skills", 601))
    ok(engineCalls.slice(beforeB0).some((c: any) => c.path === "/api/game/character" && c.method === "GET"), "B: U1 opened their femboy panel privately (soulGet)")
    const pU1 = panelOf(String(U1))
    ok(pU1?.type === "fw" && pU1?.nav === "fw:skills", "B: U1's panel registered (owner scope)")
    // همان callback-data رویِ پیامی در گروه — فشاردهنده = U2 (به‌تعریف ≠ مالک)
    const beforeB = engineCalls.length
    const toastsBeforeB = tg("answerCallbackQuery").length
    const editsBeforeB = tg("editMessageText").length
    const sendsBeforeB = tg("sendMessage").length
    await bot.handleUpdate(cbUpdate(G, user(U2), "fw:skills", 602))
    ok(missionToast(toastsBeforeB).includes("این پنل متعلق به بازیکن دیگری است."), "B: fw: hijack → mission toast «این پنل متعلق به بازیکن دیگری است.»")
    const guardCard = tg("sendMessage").slice(sendsBeforeB)
    ok(guardCard.length === 1 && String(guardCard[0]?.payload?.chat_id) === String(G), "B: guard card = ONE fresh reply in the group")
    ok((guardCard[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.text === "باز کردنِ پنلِ خودت" && (b.url ?? "") === "https://t.me/femwarbot"), "B: own-copy button «باز کردنِ پنلِ خودت» → private deep link")
    ok(engineCalls.length === beforeB, "B: ZERO engine mutation calls (no /api/game/* — no /api/group/command)")
    ok(tg("editMessageText").length === editsBeforeB, "B: no message edited anywhere (U1's panel + group message intact)")
    ok((panelOf(String(U1))?.nav ?? "") === "fw:skills" && panelOf(String(U1))?.chatId === U1, "B: U1's panel state untouched")
    // همان نتیجه برای hp: و m: (هر سه شاخه‌ی جایگزین‌شده با guard) — فشاردهنده‌های
    // متفاوت تا ضدسیلِ ۳۰۰ms نفسِ کاربر را نگیرد
    await bot.handleUpdate(cbUpdate(G, user(U2 + 10), "hp:h", 603))
    ok(missionToast(toastsBeforeB).filter((t: string) => t === "این پنل متعلق به بازیکن دیگری است.").length >= 2, "B: hp: hijack → same guard toast")
    ok(engineCalls.length === beforeB, "B: hp: hijack → still zero engine calls (no /api/game/help)")
    await bot.handleUpdate(cbUpdate(G, user(U2 + 11), "m:items", 604))
    ok(engineCalls.length === beforeB, "B: m:items hijack → still zero engine calls (guard before dispatch)")
    ok(missionToast(toastsBeforeB).filter((t: string) => t === "این پنل متعلق به بازیکن دیگری است.").length >= 3, "B: m: hijack → same guard toast")
    // نرخِ کارت: فشارِ تازه در همان چتِ گروهی → توست هست، کارتِ تازه نیست
    const sendsBeforeB2 = tg("sendMessage").length
    await bot.handleUpdate(cbUpdate(G, user(U2 + 12), "fw:style", 605))
    ok(missionToast(toastsBeforeB).filter((t: string) => t === "این پنل متعلق به بازیکن دیگری است.").length >= 4, "B: rate-limited press still gets the toast")
    ok(tg("sendMessage").length === sendsBeforeB2, "B: guard card is rate-limited (1/min/chat — no group spam)")
  }

  // ── Test C: کنش‌های خصوصیِ هم‌زمان — هر کس به چت/بازیکنِ خودش ─────────────────
  console.log("  ── §C concurrent private interactions — each lands on its own owner ──")
  {
    const U1 = 14005, U2 = 14006
    await bot.handleUpdate(plainPriv(U1, "کیف"))
    await bot.handleUpdate(plainPriv(U2, "کیف"))
    const id1 = ownSends(U1)[0]?.res?.result?.message_id
    const id2 = ownSends(U2)[0]?.res?.result?.message_id
    const beforeC = engineCalls.length
    const toastsBeforeC = tg("answerCallbackQuery").length
    const editsBeforeC = tg("editMessageText").length
    // دو آپدیتِ هم‌زمان (بدونِ await پشتِ‌سرِهم) — کاربرهای متفاوت، ضدسیل نقض نمی‌شود
    await Promise.all([
      bot.handleUpdate(privCb(U1, "i:use:water", id1)),
      bot.handleUpdate(privCb(U2, "i:use:water", id2)),
    ])
    const actionsC = engineCalls.slice(beforeC).filter((c: any) => c.path === "/api/game/action")
    ok(actionsC.length === 2 && actionsC.some((c: any) => c.body?.telegramId === String(U1)) && actionsC.some((c: any) => c.body?.telegramId === String(U2)), "C: both concurrent actions dispatched (U1 and U2, separately)")
    const editsC = tg("editMessageText").slice(editsBeforeC)
    ok(editsC.length === 2, "C: both outcomes landed (2 edit-in-place refreshes)")
    ok(editsC.some((e: any) => String(e.payload?.chat_id) === String(U1) && e.payload?.message_id === id1) && editsC.some((e: any) => String(e.payload?.chat_id) === String(U2) && e.payload?.message_id === id2), "C: each edit targeted its OWN chat+message (no cross-edit)")
    const toastsC = missionToast(toastsBeforeC)
    ok(toastsC.filter((t: string) => (t ?? "").includes("انجام شد")).length === 2, "C: each owner got their own ✅ acknowledgment toast")
  }

  // ── Test D: پنلِ کهنه — کارتِ مهربان + بازیابی؛ پنلِ دیگری سالم ────────────────
  console.log("  ── §D stale panel — friendly recovery, other players unaffected ──")
  {
    const U1 = 14007, U2 = 14008
    // U2 پنلِ بازِ خودش را دارد (رجیستری) — باید بعد از کهنه‌شدنِ پنلِ U1 دست‌نخورده بماند
    await bot.handleUpdate(plainPriv(U2, "کیف"))
    const idU2 = ownSends(U2)[0]?.res?.result?.message_id
    await bot.handleUpdate(privCb(U2, "i:fav:water", idU2))
    const pU2Before = panelOf(String(U2))
    // D-1: شناسه‌ی موضوعِ کهنه/نامعتبر در کدکسِ خصوصی → کارتِ مهربان + «↩ راهنما»
    const beforeD = engineCalls.length
    const editsBeforeD = tg("editMessageText").length
    const sendsBeforeD = tg("sendMessage").length
    await bot.handleUpdate(privCb(U1, "hp:t:nonsense:0", 701))
    const staleEdits = tg("editMessageText").slice(editsBeforeD)
    ok(staleEdits.length === 1 && String(staleEdits[0]?.payload?.chat_id) === String(U1), "D: stale hp:t:unknown-id → friendly stale card in U1's own chat")
    ok((staleEdits[0]?.payload?.text ?? "").includes("کدکس کهنه شده"), "D: stale card text («این برگه از کدکس کهنه شده»)")
    ok((staleEdits[0]?.payload?.reply_markup?.inline_keyboard ?? []).flat().some((b: any) => b.callback_data === "hp:h"), "D: «↩ راهنما» recovery button present")
    // D-2: قالبِ کهنِ fw:evoGo رویِ هدفِ کهنه → بی‌صدا و بی‌جهش
    await new Promise((r) => setTimeout(r, 350)) // ضدسیلِ همان کاربر (U1)
    const beforeD2 = engineCalls.length
    const editsBeforeD2 = tg("editMessageText").length
    const toastsBeforeD2 = tg("answerCallbackQuery").length
    await bot.handleUpdate(privCb(U1, "fw:evoGo:999", 702))
    ok(engineCalls.length === beforeD2, "D: old fw:evoGo:{stale} format → zero engine calls (safe no-op)")
    ok(tg("editMessageText").length === editsBeforeD2 && tg("sendMessage").length === sendsBeforeD, "D: stale target → no card, no edit (quiet toast only)")
    ok(tg("answerCallbackQuery").length > toastsBeforeD2, "D: the stale press was acknowledged (callback answered, no spinner)")
    // D-3: پنلِ بازیکنِ دیگر دست‌نخورده
    const pU2After = panelOf(String(U2))
    ok(pU2After?.nav === pU2Before?.nav && pU2After?.chatId === U2, "D: U2's panel registry entry unaffected by U1's stale presses")
    ok(ownEdits(U2).every((e: any) => e.payload?.message_id === idU2) && ownSends(U2).length === 1, "D: U2's chat saw only their own traffic")
    ok(engineCalls.slice(beforeD).every((c: any) => c.body?.telegramId !== String(U2)), "D: zero engine calls carried U2's identity")
  }
}

// ═══ 15. V16-1 — لینک‌های عمیقِ بافتاری (?start=items|market|goals) ═════════════
// دکمه‌های هابِ شهر (hub.ts) حالا بافت را حمل می‌کنند؛ /start در پیوی باید همان
// کارتی را بدهد که intentِ همان نام می‌دهد — نه کارتِ خوش‌آمدِ عمومی.
console.log("⑮ V16-1 deep links: /start items|market|goals → the RIGHT card, not the welcome photo")
{
  const deepStart = (userId: number, payload: string) => privMsgUpdate(userId, `/start ${payload}`)

  // A) ?start=items → کارتِ کیف (همان intentِ «کیف»)
  {
    const u = 15001
    const photosBefore = tg("replyWithPhoto").length
    await bot.handleUpdate(deepStart(u, "items"))
    const cards = sendPayloads(u)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("🎒 <b>کیف</b>"), "A: /start items → the real bag card («کیف»)")
    ok(!(cards[0]?.payload?.text ?? "").includes("خوش آمدی") && !(cards[0]?.payload?.text ?? "").includes("پیمانِ فمبویت را ببندیم"), "A: ...NOT the generic welcome card")
    ok(tg("replyWithPhoto").length === photosBefore, "A: no welcome photo card sent")
    ok(engineCallsFor((c: any) => c.path === "/api/game/profile" && c.body?.telegramId === String(u)).length >= 1, "A: bag data fetched for the deep-linked player (auth upsert + profile)")
  }

  // B) ?start=market → کارتِ بازارِ شهر
  {
    const u = 15002
    const photosBefore = tg("replyWithPhoto").length
    await bot.handleUpdate(deepStart(u, "market"))
    const cards = sendPayloads(u)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("🏪 <b>بازارِ شهر</b>"), "B: /start market → the real market card («بازارِ شهر»)")
    ok(!(cards[0]?.payload?.text ?? "").includes("خوش آمدی"), "B: ...NOT the generic welcome card")
    ok(tg("replyWithPhoto").length === photosBefore, "B: no welcome photo card sent")
    ok(engineCallsFor((c: any) => c.path === "/api/game/market" && c.body?.telegramId === String(u)).length >= 1, "B: market data fetched for the deep-linked player")
  }

  // C) ?start=goals → کارتِ اهداف
  {
    const u = 15003
    const photosBefore = tg("replyWithPhoto").length
    await bot.handleUpdate(deepStart(u, "goals"))
    const cards = sendPayloads(u)
    ok(cards.length === 1 && (cards[0]?.payload?.text ?? "").includes("🎯 <b>اهداف</b>"), "C: /start goals → the real goals card («اهداف»)")
    ok(!(cards[0]?.payload?.text ?? "").includes("خوش آمدی"), "C: ...NOT the generic welcome card")
    ok(tg("replyWithPhoto").length === photosBefore, "C: no welcome photo card sent")
    ok(engineCallsFor((c: any) => c.path === "/api/game/guide" && c.body?.telegramId === String(u)).length >= 1, "C: guide data fetched for the deep-linked player")
  }

  // D) بدونِ پیلود → همان جریانِ خوش‌آمدِ دیروز (رفتارِ /startِ معمول دست‌نخورده)
  {
    const u = 15004
    await bot.handleUpdate(privMsgUpdate(u, "/start"))
    ok(sendPayloads(u).length >= 1 && sendPayloads(u).some((c: any) => (c.payload?.text ?? "").includes("میان‌برهای ثابَتت")), "D: plain /start → the full welcome flow (persistent reply keyboard) — unchanged")
    ok(engineCallsFor((c: any) => c.path === "/api/auth" && c.body?.telegramId === String(u)).length >= 1, "D: plain /start still auths the player")
  }
}

// ═══ 16. V16-3 — بازسازیِ UXِ خصوصی (ممیزی ④⑨⑩⑭ + §4/§13) ═══════════════════
// منویِ خانه‌ی گروه‌بندی‌شده (۱۱ دکمه) · سفرِ کاملِ محله‌ها · واخواهیِ بینگو ·
// راهنمایِ بافتاریِ کارت‌ها · صداقتِ کارتِ حساب · بازکاربردِ لنگرِ نتیجه.
console.log("⑯ V16-3: home regroup · full travel · bingo confirm · card hints · settings honesty · outcome anchor")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCb = (userId: number, data: string, msgId: number) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const flatBtns = (kb: any) => (kb?.inline_keyboard ?? []).flat()
  const flatOf = (payload: any) => (payload?.reply_markup?.inline_keyboard ?? []).flat()
  const cbsOf = (payload: any) => flatOf(payload).map((b: any) => b.callback_data ?? "")

  // ── A) منویِ خانه: ۱۱ دکمه در ۴ ردیفِ گروه‌بندی‌شده (ممیزی ⑨) ───────────────
  console.log("  ── A home keyboard: 11 grouped buttons (was 15 flat) ──")
  {
    const home = kbMod.homeKeyboard()
    const rows = home.inline_keyboard.filter((r: any) => r.length > 0)
    const textBtns = flatBtns(home).filter((b: any) => b.callback_data !== undefined)
    const miniBtns = flatBtns(home).filter((b: any) => b.web_app !== undefined)
    ok(textBtns.length === 11, `A: home keyboard carries exactly 11 text buttons (got ${textBtns.length})`)
    ok(rows.length === 4 + (kbMod.MINIAPP_URL ? 1 : 0), `A: 4 navigation rows${kbMod.MINIAPP_URL ? " + Mini App row" : ""}`)
    const labels = textBtns.map((b: any) => b.text)
    const expected = [
      "👑 فمبوی من", "🎲 اتفاق امروز",
      "🎯 قدمِ بعدی", "👤 من", "🏙 شهر",
      "🎒 کیف", "🏪 بازار", "💼 کار",
      "📖 راهنما", "👥 شهرِ گروه", "⚙ حساب",
    ]
    ok(expected.every((l) => labels.includes(l)), "A: all 11 grouped labels present (identity/life/economy/support)")
    ok(!labels.includes("🎯 اهداف") && !labels.includes("⚡ فرصت‌ها") && !labels.includes("✨ آرزوها") && !labels.includes("😴 استراحت"), "A: goals/ops/dreams/rest are NOT home-level buttons anymore")
    ok(kbMod.MINIAPP_URL ? miniBtns.length === 1 : miniBtns.length === 0, "A: Mini App row only with a real https URL")
    // هر دکمه‌ی حذف‌شده هنوزreachable است — نقشه‌ی جایگزین (گزارشِ V16-3):
    ok(labels.includes("🎯 قدمِ بعدی"), "A: «راهنمای من» → «قدمِ بعدی» (TERM.nextStep — audit ②)")
    ok(labels.includes("👥 شهرِ گروه"), "A: «شهرِ گروهی» → «شهرِ گروه» (TERM.groupWorld)")
  }

  // ── B) کیبوردِ ثابتِ خصوصی: ۷ دکمه، همه نیتِ واقعی (ممیزی ⑨) ───────────────
  console.log("  ── B reply keyboard: 7 buttons, each normalizes to a real intent ──")
  {
    const u = 16001
    await bot.handleUpdate(privMsgUpdate(u, "/start"))
    const kbMsg = sendPayloads(u).find((c: any) => (c.payload?.text ?? "").includes("میان‌برهای ثابَتت"))
    const replyRows: any[][] = kbMsg?.payload?.reply_markup?.keyboard ?? []
    const replyBtns = replyRows.flat()
    ok(replyBtns.length === 7, `B: persistent reply keyboard = 7 buttons (got ${replyBtns.length})`)
    const intents = replyBtns.map((b: any) => intentMod.resolveIntent(b.text)?.id ?? null)
    ok(intents.every((id: any) => id !== null), `B: every reply button normalizes to a real intent (got ${JSON.stringify(intents)})`)
    ok(intents.includes("femboy") && intents.includes("events") && intents.includes("guide"), "B: femboy/event/guide intents reachable from the reply keyboard")
    ok(intents.includes("inventory") && intents.includes("work") && intents.includes("help") && intents.includes("menu"), "B: bag/work/help/menu intents reachable from the reply keyboard")
    ok(intentMod.resolveIntent("قدمِ بعدی")?.id === "guide", "B: NEW canonical phrase «قدمِ بعدی» resolves to guide (TERM.nextStep)")
    ok(intentMod.resolveIntent("راهنمای من")?.id === "guide", "B: legacy phrase «راهنمای من» still resolves (live migration)")
    ok(intentMod.resolveIntent("پیشخوان")?.id === "menu", "B: legacy phrase «پیشخوان» still resolves to home")
  }

  // ── C) حذف‌شده‌ها هنوز زنده‌اند: دکمه در کارتِ درست + عبارت + بخشِ کارت ───────
  console.log("  ── C removed buttons stay reachable (card buttons + phrases + sections) ──")
  {
    const guideKb = kbMod.guideKeyboard()
    const guideCbs = flatBtns(guideKb).map((b: any) => b.callback_data)
    ok(guideCbs.includes("m:ops") && guideCbs.includes("m:dreams") && guideCbs.includes("m:goals"), "C: guide card carries فرصت‌ها/آرزوها/اهداف buttons")
    const profileKb = kbMod.profileKeyboard({ debt: 0 })
    const profileCbs = flatBtns(profileKb).map((b: any) => b.callback_data)
    ok(profileCbs.includes("a:rest"), "C: «😴 استراحت» lives inside the profile card (a:rest)")
    ok(intentMod.resolveIntent("فرصت‌ها")?.id === "ops" && intentMod.resolveIntent("آرزوها")?.id === "dreams" && intentMod.resolveIntent("استراحت")?.id === "rest" && intentMod.resolveIntent("اهداف")?.id === "goals", "C: phrases فرصت‌ها/آرزوها/استراحت/اهداف all resolve")
    // کارتِ «قدمِ بعدی» خودش فرصت‌ها و آرزوها را به‌عنوانِ بخش حمل می‌کند
    const u = 16002
    await bot.handleUpdate(plainPriv(u, "قدمِ بعدی"))
    const card = sendPayloads(u).at(-1)?.payload
    const text = card?.text ?? ""
    ok(text.includes("🎯 <b>قدمِ بعدی</b>"), "C: guide card retitled «قدمِ بعدی» (canonical)")
    ok(text.includes("⚡ <b>فرصت‌ها</b>") && text.includes("✨ <b>آرزوها</b>"), "C: guide card carries فرصت‌ها + آرزوها as inline sections")
    ok(cbsOf(card).includes("m:ops") && cbsOf(card).includes("m:dreams"), "C: ...and as direct buttons inside the card")
  }

  // ── D) سفرِ کامل: همه‌ی محله‌ها، جفت‌جفت، ممنوعه‌ی جدا (ممیزی ④) ─────────────
  console.log("  ── D city keyboard: every district (was 4 random of 8) ──")
  {
    const allKeys = kbMod.DISTRICTS.map((d: any) => d.key)
    const city = kbMod.cityKeyboard("bazaar")
    const travelCbs = flatBtns(city).map((b: any) => b.callback_data).filter((d: string) => d.startsWith("t:"))
    const expected = allKeys.filter((k: string) => k !== "bazaar")
    ok(expected.every((k: string) => travelCbs.includes(`t:${k}`)), `D: ALL 7 non-current districts present (got ${travelCbs.length})`)
    ok(travelCbs.includes("t:forbidden"), "D: forbidden district always present")
    const rows = city.inline_keyboard.filter((r: any) => r.length > 0)
    ok(rows.some((r: any) => r.length === 2), "D: short district labels pair 2-per-row")
    const forbiddenRow = rows.find((r: any) => r.some((b: any) => b.callback_data === "t:forbidden"))
    ok((forbiddenRow ?? []).length === 1, "D: forbidden button gets its own full-width row (destructive separated, §4)")
    // مقصدِ ناشناخته (بازیکنِ بی‌محله) → کلِ ۸ محله
    const cityAll = kbMod.cityKeyboard("nowhere")
    const travelAll = flatBtns(cityAll).map((b: any) => b.callback_data).filter((d: string) => d.startsWith("t:"))
    ok(allKeys.every((k: string) => travelAll.includes(`t:${k}`)), `D: with an unknown current district, ALL 8 district buttons render (got ${travelAll.length})`)
    // رفتاری: «شهر» → کارتِ شهر با ۷ دکمه‌ی سفر + خطِ بافتاری
    const u = 16003
    await bot.handleUpdate(plainPriv(u, "شهر"))
    const card = sendPayloads(u).at(-1)?.payload
    const cardTravel = cbsOf(card).filter((d: string) => d.startsWith("t:"))
    ok(cardTravel.length === 7, `D: private «شهر» renders the full destination list (got ${cardTravel.length})`)
  }

  // ── E) بینگو: پولدار ۳ شرط · ۵۰۰۰ واخواهی · ۱۰۰/۵۰۰ یک‌ضرب (ممیزی ⑩) ───────
  console.log("  ── E bingo: affordable stakes only + two-step 5000 ──")
  {
    // E1) پولدار: money 30000 → سقف 5000 → هر سه شرط
    mockStatePlayer.money = 30000
    const u = 16010
    await bot.handleUpdate(plainPriv(u, "بینگو"))
    const bingoCard = sendPayloads(u).at(-1)?.payload
    const stakes = cbsOf(bingoCard).filter((d: string) => /^b:\d+$/.test(d))
    ok(stakes.includes("b:100") && stakes.includes("b:500") && stakes.includes("b:5000"), "E1: rich player sees all 3 stakes (100/500/5000)")
    ok(!(bingoCard?.text ?? "").includes("جیب این‌ها را نمی‌کشد"), "E1: no unaffordable line for a rich player")
    // E2) b:5000 → واخواهی، بدونِ فراخوانیِ موتور
    const bingoMsgId = sendPayloads(u).at(-1)?.res?.result?.message_id
    const beforeE2 = engineCalls.length
    await bot.handleUpdate(privCb(u, "b:5000", bingoMsgId))
    const gambleCallsE2 = engineCalls.slice(beforeE2).filter((c: any) => c.path === "/api/game/action" && c.body?.action === "gamble")
    ok(gambleCallsE2.length === 0, "E2: pressing 5,000 does NOT call the engine yet (confirm required)")
    const confirm = tg("editMessageText").at(-1)?.payload
    ok((confirm?.text ?? "").includes("واخواهی") && (confirm?.text ?? "").includes("این‌قدر توپ می‌ریزی؟ ضرش می‌خوره."), "E2: «واخواهی» confirm card with the mission voice")
    ok(cbsOf(confirm).includes("b:go:5000") && flatOf(confirm).some((b: any) => b.text === "💥 بفرست"), "E2: confirm card carries «💥 بفرست» (b:go:5000)")
    // E3) تأیید → موتور با stake:5000
    await new Promise((r) => setTimeout(r, 350)) // ضدسیلِ همان کاربر
    await bot.handleUpdate(privCb(u, "b:go:5000", bingoMsgId))
    const gambleCallsE3 = engineCalls.filter((c: any) => c.path === "/api/game/action" && c.body?.action === "gamble" && c.body?.payload?.stake === 5000)
    ok(gambleCallsE3.length === 1, "E3: only after «بفرست» does the engine gamble with stake 5,000")
    // E4) ۱۰۰ یک‌ضرب است (کاربرِ تازه — بدونِ واخواهی)
    const u4 = 16011
    mockStatePlayer.money = 30000
    await bot.handleUpdate(privCb(u4, "b:100", 901))
    const gamble100 = engineCalls.filter((c: any) => c.path === "/api/game/action" && c.body?.action === "gamble" && c.body?.payload?.stake === 100)
    ok(gamble100.length === 1, "E4: 100 stake stays one-tap (engine called directly)")
    // E5) کارتِ کهنه‌ی b:5000 (بدونِ دیدنِ کارتِ بینگو) هم واخواهی می‌گیرد
    const u5 = 16012
    mockStatePlayer.money = 30000
    const beforeE5 = engineCalls.length
    await bot.handleUpdate(privCb(u5, "b:5000", 902))
    ok(engineCalls.slice(beforeE5).every((c: any) => !(c.path === "/api/game/action" && c.body?.action === "gamble")), "E5: stale 5,000 button press is confirm-gated too (no instant engine call)")
    // E6) تنگدست: money 1000 → سقف 300 → فقط ۱۰۰ + خطِ صادقانه
    const u6 = 16013
    mockStatePlayer.money = 1000
    await bot.handleUpdate(plainPriv(u6, "بینگو"))
    const poorCard = sendPayloads(u6).at(-1)?.payload
    const poorStakes = cbsOf(poorCard).filter((d: string) => /^b:\d+$/.test(d))
    ok(poorStakes.length === 1 && poorStakes[0] === "b:100", "E6: poor player (money 1,000) sees ONLY the affordable stake (100)")
    ok((poorCard?.text ?? "").includes("جیب این‌ها را نمی‌کشد"), "E6: honest line explains why 500/5,000 are missing")
    ok(!(poorCard?.text ?? "").includes("6,000"), "E6: cap line reflects the engine rule (30% of wallet)")
    // E7) بی‌پول: money 100 → سقف 50 → هیچ شرطی
    const u7 = 16014
    mockStatePlayer.money = 100
    await bot.handleUpdate(plainPriv(u7, "بینگو"))
    const brokeCard = sendPayloads(u7).at(-1)?.payload
    ok(cbsOf(brokeCard).filter((d: string) => /^b:\d+$/.test(d)).length === 0, "E7: broke player (money 100) gets ZERO stake buttons")
    ok((brokeCard?.text ?? "").includes("جیبت هنوز هیچ‌کدام را نمی‌کشد"), "E7: broke player gets the honest «go work» line")
    // E8) واخواهی با جیبِ خالی در فاصله‌ی تأیید → دکمه‌ی «بفرست» نمی‌آید
    const u8 = 16015
    mockStatePlayer.money = 30000
    await bot.handleUpdate(privCb(u8, "b:5000", 903))
    mockStatePlayer.money = 100 // جیب در فاصله‌ی تأیید خالی شد
    await new Promise((r) => setTimeout(r, 350))
    await bot.handleUpdate(privCb(u8, "b:5000", 904))
    const confirm2 = tg("editMessageText").at(-1)?.payload
    ok((confirm2?.text ?? "").includes("جیب دیگر نمی‌کشد"), "E8: confirm re-checks the wallet — «بفرست» withheld when it no longer fits")
    ok(!cbsOf(confirm2).includes("b:go:5000"), "E8: no send button on the broke-confirm card")
    mockStatePlayer.money = 30000
  }

  // ── F) راهنمایِ بافتاری: هر کارت عبارت‌هایِ خودش (ممیزی ⑭) ──────────────────
  console.log("  ── F contextual card hints (was: 1 static 6-phrase line) ──")
  {
    // F0) تضمینِ ایستا: هر عبارتِ هر بافت نیتِ واقعی است
    const contexts = Object.keys(intentMod.CARD_HINTS)
    ok(contexts.length >= 8, `F0: CARD_HINTS covers ≥ 8 contexts (got ${contexts.length})`)
    const dangling: string[] = []
    for (const [ctx, phrases] of Object.entries(intentMod.CARD_HINTS as Record<string, string[]>)) {
      for (const p of phrases) if (!intentMod.resolveIntent(p)) dangling.push(`${ctx}:${p}`)
    }
    ok(dangling.length === 0, `F0: every advertised hint phrase resolves to a real intent (dangling: ${dangling.join(", ") || "none"})`)
    // F1) کیف → عبارت‌هایِ اقتصادی
    const u1 = 16020
    await bot.handleUpdate(plainPriv(u1, "کیف"))
    const bag = sendPayloads(u1).at(-1)?.payload
    ok((bag?.text ?? "").includes("بنویس:") && (bag?.text ?? "").includes("«بازار»"), "F1: bag card hint lists «بازار» (+کار/استراحت/بدهی)")
    // F2) شهر → عبارت‌هایِ شهری
    const u2 = 16021
    await bot.handleUpdate(plainPriv(u2, "شهر"))
    const cityCard = sendPayloads(u2).at(-1)?.payload
    ok((cityCard?.text ?? "").includes("«اخبار»") && (cityCard?.text ?? "").includes("«وضعیت»"), "F2: city card hint lists «اخبار» + «وضعیت»")
    // F3) من → عبارت‌هایِ پروفایل
    const u3 = 16022
    await bot.handleUpdate(plainPriv(u3, "من"))
    const meCard = sendPayloads(u3).at(-1)?.payload
    ok((meCard?.text ?? "").includes("«استراحت»") && (meCard?.text ?? "").includes("«تاریخچه»"), "F3: profile card hint lists «استراحت» + «تاریخچه»")
    // F4) خانه → عبارت‌هایِ هسته
    const u4 = 16023
    await bot.handleUpdate(plainPriv(u4, "منو"))
    const homeCard = sendPayloads(u4).at(-1)?.payload
    ok((homeCard?.text ?? "").includes("«فمبوی من»") && (homeCard?.text ?? "").includes("«قدمِ بعدی»"), "F4: home card hint lists «فمبوی من» + «قدمِ بعدی»")
    // F5) بینگو → مسیرهایِ پول
    const u5 = 16024
    mockStatePlayer.money = 30000
    await bot.handleUpdate(plainPriv(u5, "بینگو"))
    const bingoHint = sendPayloads(u5).at(-1)?.payload
    ok((bingoHint?.text ?? "").includes("«کار»"), "F5: bingo card hint points at «کار» (recovery path)")
    // F6) fallback گروهی: ۶ عبارتِ هسته + اشاره‌گرِ کدکس
    const c6 = -1001600
    await bot.handleUpdate(msgUpdate(c6, user(16025), "@femwarbot سلام"))
    const hintCard = sendPayloads(c6).at(-1)?.payload
    ok((hintCard?.text ?? "").includes("«منو»") && (hintCard?.text ?? "").includes("«بازی‌های گروه»"), "F6: group fallback keeps the 6 core phrases")
    ok((hintCard?.text ?? "").includes("زبانِ طبیعی"), "F6: group fallback points at the «زبانِ طبیعی» codex category (phrases)")
  }

  // ── G) کارتِ حساب: هویت + تنظیم + آموزش + داده — بدونِ آمارِ تکراری ─────────
  console.log("  ── G settings card: identity/settings only (stats live in «من») ──")
  {
    const u = 16030
    mockStatePlayer.money = 30000
    await bot.handleUpdate(privCb(u, "m:settings", 950))
    const card = tg("editMessageText").at(-1)?.payload
    const text = card?.text ?? ""
    ok(text.includes("⚙ <b>حساب</b>"), "G: settings card is now «حساب» (consolidated entry)")
    ok(text.includes("تلگرام") && text.includes("بازیکن:"), "G: identity lines present (telegramId + playerId)")
    ok(text.includes("تنظیم‌هایِ واقعی"), "G: real-settings pointers (عنوان‌ها/شغل‌ها/پیمان فمبوی)")
    ok(text.includes("آموزش") || cbsOf(card).length > 0, "G: settings card renders")
    ok(!text.includes("سکه") && !text.includes("سطح") && !text.includes("آبرو"), "G: NO duplicated money/level/fame stats (those live in «👤 من»)")
    ok(text.includes("داده‌هایِ تو"), "G: one-line data/privacy note")
    ok(cbsOf(card).includes("hp:c:start"), "G: «🎓 آموزش» → codex start category (hp:c:start)")
    ok(cbsOf(card).includes("m:titles") && cbsOf(card).includes("m:jobs"), "G: real settings buttons (عنوان‌ها/شغل‌ها)")
    ok(cbsOf(card).includes("m:me") && cbsOf(card).includes("m:menu"), "G: «👤 من» + «↩ خانه» navigation")
    if (kbMod.MINIAPP_URL) {
      ok(flatOf(card).some((b: any) => b.web_app !== undefined && (b.text ?? "").includes("ویرایش نام")), "G: Mini App identity-edit button (ویرایش نام و آواتار)")
      ok(text.includes("ویرایشِ نام و آواتار"), "G: identity-edit path is spelled out (Mini App ← من ← تنظیمات)")
    }
  }

  // ── H) بازکاربردِ لنگرِ نتیجه: نتیجه‌ی متنیِ پیاپی همان پیام را جایگزین می‌کند ──
  console.log("  ── H outcome anchor: consecutive text outcomes replace, not stack ──")
  {
    const u = 16040
    const sendsBefore = tg("sendMessage").length
    const editsBefore = tg("editMessageText").length
    await bot.handleUpdate(plainPriv(u, "کار"))
    const outcome1 = sendPayloads(u).at(-1)
    ok(tg("sendMessage").length === sendsBefore + 1, "H: first text outcome → fresh sendMessage")
    const outcome1Id = outcome1?.res?.result?.message_id
    await new Promise((r) => setTimeout(r, 2100)) // ضدسیلِ متنِ همان کاربر
    await bot.handleUpdate(plainPriv(u, "استراحت"))
    const editsH = tg("editMessageText").slice(editsBefore)
    ok(editsH.length === 1 && editsH[0]?.payload?.message_id === outcome1Id && String(editsH[0]?.payload?.chat_id) === String(u), "H: second consecutive outcome EDITS the first outcome message (no stacking)")
    ok(tg("sendMessage").length === sendsBefore + 1, "H: no new message for the second outcome")
    // لنگرِ کهنه (> 90s) → پیامِ تازه
    const anchorMap = (globalThis as any).__femwarOutcomeAnchor
    const entry = anchorMap?.get(u)
    ok(Boolean(entry), "H: outcome anchor registry is globalThis-guarded (accessible)")
    if (entry) entry.at = Date.now() - 91_000
    await new Promise((r) => setTimeout(r, 2100))
    const sendsBefore2 = tg("sendMessage").length
    await bot.handleUpdate(plainPriv(u, "کار"))
    ok(tg("sendMessage").length === sendsBefore2 + 1, "H: stale anchor (>90s) → fresh send")
    // کال‌بک → ویرایشِ درجای همان پیامِ دکمه (رفتارِ دیروز، دست‌نخورده)
    await new Promise((r) => setTimeout(r, 2100))
    await bot.handleUpdate(privCb(u, "a:work", 980))
    const editsH2 = tg("editMessageText").slice(tg("editMessageText").length - 1)
    ok((editsH2[0]?.payload?.message_id ?? 0) === 980, "H: callback-triggered outcome still edits the pressed message (edit-in-place)")
  }

  // ── I) برچسب‌های قاعده‌مند: بازگشتِ همه‌جا «↩ خانه» — بدونِ «پیشخوان» ────────
  console.log("  ── I canonical back labels («↩ خانه» everywhere) ──")
  {
    const backCbs = ["m:menu"]
    const builders: (() => any)[] = [
      () => kbMod.backKeyboard(),
      () => kbMod.guideKeyboard(),
      () => kbMod.goalsKeyboard(),
      () => kbMod.dreamsKeyboard(),
      () => kbMod.bingoKeyboard(30000),
      () => kbMod.bingoConfirmKeyboard(5000),
      () => kbMod.bagKeyboard({ pets: [], inventory: [], prices: new Map() }),
    ]
    for (const builder of builders) {
      const kbBtns = flatBtns(builder())
      const back = kbBtns.find((b: any) => backCbs.includes(b.callback_data))
      ok(back !== undefined && back.text === "↩ خانه", `I: back button label is «↩ خانه» (${back?.text ?? "missing"})`)
    }
    const cityKb = flatBtns(kbMod.cityKeyboard("bazaar"))
    const cityBack = cityKb.find((b: any) => b.callback_data === "m:menu")
    ok(cityBack?.text === "↩ خانه", "I: city card back is «↩ خانه»")
  }
}

// ═══ 17. V16-4 — دستاوردها در رباتِ خصوصی (ممیزی ⑪: فقطِ مینی‌اپ بود) ═════════
// نوارِ N از M در کارتِ «من» + کارتِ عمیقِ 🏆 + سیم‌کشیِ عبارت/دکمه + حفظِ رفتارِ گروه
console.log("⑰ V16-4: achievements strip + deep card + phrase wiring (was Mini-App-only)")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCb = (userId: number, data: string, msgId: number) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const flatOf = (payload: any) => (payload?.reply_markup?.inline_keyboard ?? []).flat()
  const cbsOf = (payload: any) => flatOf(payload).map((b: any) => b.callback_data ?? "")
  const textsOf = (payload: any) => flatOf(payload).map((b: any) => b.text ?? "")

  // سه دستاورد با timestamp های متفاوت — «آخرین» باید newest-first باشد
  const mockAch = (key: string, name: string, emoji: string, at: string) => ({
    key, name, emoji, description: `توضیحِ ${name}`, unlockedAt: at,
  })
  const ACH = [
    mockAch("good_samaritan", "نېکوکار", "😇", "2024-05-01T10:00:00.000Z"),
    mockAch("cat_person", "گربه‌باز", "🐈", "2024-06-01T10:00:00.000Z"),
    mockAch("duck_lord", "خداوندگار اردک", "🦆", "2024-07-01T10:00:00.000Z"),
  ]

  // ── A) نوارِ دستاوردها در کارتِ «من»: N از M با اعدادِ واقعیِ ماک ────────────
  console.log("  ── A profile card carries the «🏆 دستاوردها: N از M» strip ──")
  {
    const u = 17001
    mockProfileOverrides.set(String(u), { achievements: ACH, achievementsTotal: 26 })
    await bot.handleUpdate(plainPriv(u, "من"))
    const card = sendPayloads(u).at(-1)?.payload
    const text = card?.text ?? ""
    ok(text.includes("🏆 <b>دستاوردها:</b>"), "A: profile card carries the achievements strip header")
    ok(text.includes("دستاوردها:</b> <code>3</code> از <code>26</code>"), "A: strip counts «3 از 26» with real mocked numbers")
    ok(text.includes("آخرین:") && text.includes("خداوندگار اردک") && text.includes("گربه‌باز"), "A: strip lists the latest achievement names (emoji + name)")
    ok(!/[۰-۹٠-٩]/.test(text.replace(/<[^>]+>/g, "")), "A: strip digits are English-only")
    ok(cbsOf(card).includes("m:ach"), "A: profile card carries the «🏆 دستاوردها» deep-card button (m:ach)")
    ok(textsOf(card).includes("🏆 دستاوردها"), "A: deep-card button label is «🏆 دستاوردها»")
    // بازیکنِ بدونِ دستاورد — نوارِ صادقانه‌ی «0 از M»، بدونِ خطِ آخرین‌ها
    const u0 = 17002
    mockProfileOverrides.set(String(u0), { achievements: [], achievementsTotal: 26 })
    await bot.handleUpdate(plainPriv(u0, "من"))
    const text0 = sendPayloads(u0).at(-1)?.payload?.text ?? ""
    ok(text0.includes("دستاوردها:</b> <code>0</code> از <code>26</code>"), "A: zero-achievement player sees the honest «0 از 26» strip")
    ok(!text0.includes("آخرین:"), "A: no «آخرین» line when nothing is earned yet")
  }

  // ── B) کارتِ عمیق: شمارش + آخرین‌ها (newest-first) + قفل‌مانده + اشاره‌گر کدکس ──
  console.log("  ── B achievements deep card (m:ach) renders latest + locked counts ──")
  {
    const u = 17003
    mockProfileOverrides.set(String(u), { achievements: ACH, achievementsTotal: 26 })
    await bot.handleUpdate(privCb(u, "m:ach", 970))
    const card = tg("editMessageText").at(-1)?.payload
    const text = card?.text ?? ""
    ok(text.includes("🏆 <b>دستاوردها</b>"), "B: deep card title renders")
    ok(text.includes("<code>3</code> از <code>26</code> باز شده"), "B: «3 از 26 باز شده» with mocked numbers")
    const duckIdx = text.indexOf("خداوندگار اردک")
    const catIdx = text.indexOf("گربه‌باز")
    const goodIdx = text.indexOf("نېکوکار")
    ok(duckIdx >= 0 && catIdx > duckIdx && goodIdx > catIdx, "B: latest achievements ordered newest-first (duck → cat → samaritan)")
    ok(text.includes("<code>23</code> قفل مانده") || (text.includes("<code>23</code>") && text.includes("قفل مانده")), "B: locked count line (26−3=23)")
    ok(text.includes("راهنما") && text.includes("مأموریت‌ها و دستاوردها"), "B: honest pointer to the codex fame category (rules live there)")
    ok(cbsOf(card).includes("m:me") && cbsOf(card).includes("m:menu"), "B: back navigation («👤 من» + «↩ خانه»)")
  }

  // ── C) عبارتِ «دستاوردها» در پیوی → کارتِ شخصی (نه تالار) ──────────────────
  console.log("  ── C phrase «دستاوردها» in private reaches the personal card ──")
  {
    const u = 17004
    mockProfileOverrides.set(String(u), { achievements: ACH, achievementsTotal: 26 })
    const hallBefore = engineCalls.filter((c: any) => c.path === "/api/game/character/hall").length
    await bot.handleUpdate(plainPriv(u, "دستاوردها"))
    const text = sendPayloads(u).at(-1)?.payload?.text ?? ""
    ok(text.includes("🏆 <b>دستاوردها</b>") && text.includes("<code>3</code>"), "C: typing «دستاوردها» renders the achievements card")
    ok(engineCallsFor((c: any) => c.path === "/api/game/profile" && c.body?.telegramId === String(u)).length >= 1, "C: achievements card reads the real profile DTO")
    ok(engineCalls.filter((c: any) => c.path === "/api/game/character/hall").length === hallBefore, "C: ...and does NOT hit the champ hall (personal ≠ hall)")
    ok(intentMod.resolveIntent("دستاوردها")?.id === "achievements", "C: intent registry routes «دستاوردها» to the personal achievements intent")
    ok(intentMod.resolveIntent("دستاوردهای من")?.id === "achievements" && intentMod.resolveIntent("my achievements")?.id === "achievements", "C: «دستاوردهای من»/«my achievements» resolve too")
    // legacy: «افتخارات» همچنان تالار است (انتخابِ آگاهانه‌ی V15-2، دست‌نخورده)
    const u2 = 17005
    // (تالار با GET ?telegramId=… صدا می‌شود — بدنه ندارد؛ همان الگوی §13)
    const hallBefore2 = engineCalls.filter((c: any) => c.path === "/api/game/character/hall").length
    await bot.handleUpdate(plainPriv(u2, "افتخارات"))
    ok(engineCalls.filter((c: any) => c.path === "/api/game/character/hall").length > hallBefore2, "C: «افتخارات» still routes to the champ hall (deliberate V15-2 choice)")
    ok(intentMod.resolveIntent("تالار")?.id === "champ" && intentMod.resolveIntent("fame")?.id === "fame", "C: «تالار»/«fame» phrases keep their V15-2 targets")
  }

  // ── D) گروه: «دستاوردها» همان کارتِ fame شهرِ دیروز (رفتار حفظ شد) ──────────
  console.log("  ── D group «دستاوردها» keeps the city fame card (open phrase) ──")
  {
    const c = -1001700, g = user(17006)
    const before = groupAction("command").length
    await bot.handleUpdate(msgUpdate(c, g, "دستاوردها"))
    const fameCall = groupAction("command").slice(before).find((x: any) => x.body.command === "fame" && x.body.chatId === String(c))
    ok(Boolean(fameCall) && fameCall?.body?.telegramId === String(g.id), "D: group «دستاوردها» → engine fame card (same as V15-2)")
  }

  // پاک‌سازیِ overrides — بقیه‌ی تست‌ها پروفایلِ دیروز را می‌بینند
  mockProfileOverrides.clear()
}

// ═══ 18. V16-4 — فروش در بازارِ رباتِ خصوصی (ممیزی ⑪: createListing/cancelListing فقطِ مینی‌اپ بود) ═══
// سه‌گامِ تلگرامی (جنس ← قیمت ← آگهی) + پس‌گرفتن — همه از همان اکشن‌های موتور
console.log("⑱ V16-4: market listing flow (sell picker → price card → createListing) + cancelListing")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCb = (userId: number, data: string, msgId: number) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const flatOf = (payload: any) => (payload?.reply_markup?.inline_keyboard ?? []).flat()
  const cbsOf = (payload: any) => flatOf(payload).map((b: any) => b.callback_data ?? "")
  const textsOf = (payload: any) => flatOf(payload).map((b: any) => b.text ?? "")
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // ── A) کارتِ بازار دکمه‌ی «🛍 فهرست‌کردن» دارد؛ گامِ ۱ جنس‌هایِ قابلِ‌فروش ────
  console.log("  ── A market card → «🛍 فهرست‌کردن» → sellable picker ──")
  {
    const u = 18001
    await bot.handleUpdate(plainPriv(u, "بازار"))
    const marketCard = sendPayloads(u).at(-1)?.payload
    ok(cbsOf(marketCard).includes("m:mk") && textsOf(marketCard).includes("🛍 فهرست‌کردن"), "A: market card carries «🛍 فهرست‌کردن» (m:mk)")
    await sleep(350)
    await bot.handleUpdate(privCb(u, "m:mk", 960))
    const picker = tg("editMessageText").at(-1)?.payload
    const ptext = picker?.text ?? ""
    ok(ptext.includes("فهرست‌کردن در بازار"), "A: sell picker card renders")
    ok(ptext.includes("آب") && cbsOf(picker).includes("ms:water"), "A: tradable bag item offered as a picker button (ms:water)")
    ok(ptext.includes("کارمزدی ندارد") && ptext.includes("3 روز"), "A: honesty line on the picker (no fee · escrow · 3-day TTL)")
    // فیلترِ قابلِ‌فروش: قفل/علاقه‌مندی/پوشیده/غیرقابلِ‌معامله نمی‌آیند
    const u2 = 18002
    mockProfileOverrides.set(String(u2), {
      inventory: [
        { itemKey: "water", name: "آب", emoji: "💧", rarityLabel: "معمولی", category: "consumable", quantity: 2, equipped: false, favorite: false, locked: false, usable: true, tradable: true, effectLabel: null },
        { itemKey: "fav_thing", name: "علاقه‌مندی", emoji: "💗", rarityLabel: "معمولی", category: "consumable", quantity: 1, equipped: false, favorite: true, locked: false, usable: true, tradable: true, effectLabel: null },
        { itemKey: "locked_thing", name: "قفل‌شده", emoji: "🔒", rarityLabel: "معمولی", category: "consumable", quantity: 1, equipped: false, favorite: false, locked: true, usable: true, tradable: true, effectLabel: null },
        { itemKey: "worn_thing", name: "پوشیده", emoji: "👕", rarityLabel: "معمولی", category: "gear", quantity: 1, equipped: true, favorite: false, locked: false, usable: true, tradable: true, effectLabel: null },
        { itemKey: "soul_thing", name: "غیرقابلِ‌معامله", emoji: "🧿", rarityLabel: "معمولی", category: "consumable", quantity: 1, equipped: false, favorite: false, locked: false, usable: true, tradable: false, effectLabel: null },
      ],
    })
    await bot.handleUpdate(privCb(u2, "m:mk", 961))
    const picker2 = tg("editMessageText").at(-1)?.payload
    ok(cbsOf(picker2).includes("ms:water") && !cbsOf(picker2).some((d: string) => d.startsWith("ms:fav_thing")), "A: favorite item excluded from the sell picker")
    ok(!cbsOf(picker2).some((d: string) => d.startsWith("ms:locked_thing")) && !cbsOf(picker2).some((d: string) => d.startsWith("ms:worn_thing")), "A: locked + equipped items excluded")
    ok(!cbsOf(picker2).some((d: string) => d.startsWith("ms:soul_thing")), "A: non-tradable item excluded")
    mockProfileOverrides.delete(String(u2))
  }

  // ── B) گامِ ۲ — کارتِ قیمت: مرجعِ روز + سه پیشنهاد (0.9/1.0/1.1×) + هزینه‌ها ──
  console.log("  ── B price card: day reference + 3 suggestions + full cost disclosure ──")
  {
    const u = 18003
    await bot.handleUpdate(privCb(u, "ms:water", 962))
    const price = tg("editMessageText").at(-1)?.payload
    const ptext = price?.text ?? ""
    const pbtns = cbsOf(price)
    ok(ptext.includes("قیمتِ آگهی") && ptext.includes("<code>30</code>") && ptext.includes("قیمتِ روزِ بازار"), "B: price card shows the day reference (mocked current = 30)")
    ok(ptext.includes("کارمزدی نیست") && ptext.includes("همه‌اش مالِ توئه"), "B: fee disclosure — «کارمزدی نیست» (engine charges none)")
    ok(ptext.includes("از کیف") && ptext.includes("3 روز اعتبار"), "B: escrow + 3-day TTL disclosed on the confirm card")
    // 0.9/1.0/1.1 × 30 (کف) → 27/30/33 — هر دکمه یک قیمت
    ok(pbtns.includes("mp:water:27") && pbtns.includes("mp:water:30") && pbtns.includes("mp:water:33"), "B: three suggested-price buttons mp:water:27|30|33 (0.9/1.0/1.1 × day)")
    ok(pbtns.includes("m:mk") && pbtns.includes("m:market"), "B: picker/market back buttons present")
  }

  // ── C) گامِ ۳ — تأیید: همان createListing مینی‌اپ؛ ردیفِ واقعیِ Listing ────
  console.log("  ── C confirm → engine createListing → a real Listing row (stateful mock) ──")
  {
    const u = 18004
    const before = engineCalls.length
    await bot.handleUpdate(privCb(u, "mp:water:27", 963))
    const listCalls = engineCalls.slice(before).filter((c: any) => c.path === "/api/game/action" && c.body?.action === "createListing")
    ok(listCalls.length === 1 && listCalls[0]?.body?.telegramId === String(u), "C: exactly one engine createListing call for the presser")
    ok(listCalls[0]?.body?.payload?.itemKey === "water" && listCalls[0]?.body?.payload?.price === 27 && listCalls[0]?.body?.payload?.quantity === 1, "C: payload {itemKey, quantity:1, price} — the Mini App's contract")
    const row = mockMarketListings.find((l) => l.sellerId === `p-${u}` && l.itemKey === "water")
    ok(Boolean(row) && row?.price === 27 && row?.quantity === 1 && row?.listingId, "C: a real Listing row exists in the (mock) engine with the pressed price")
    const toasts = tg("answerCallbackQuery").filter((c: any) => String(c.payload?.callback_query_id ?? "").length > 0)
    ok(toasts.length >= 1, "C: toast answers the press (Telegram feedback)")
    // بازارِ تازه (ویرایشِ درجای همان پیام): بخشِ «آگهی‌های تو» + دکمه‌ی برداشتن
    const marketAfter = tg("editMessageText").at(-1)?.payload
    const mtext = marketAfter?.text ?? ""
    ok(mtext.includes("آگهی‌های تو") && mtext.includes("آب") && mtext.includes("<code>27</code>"), "C: refreshed market card lists my listing («آگهی‌های تو»)")
    ok(cbsOf(marketAfter).includes(`mc:${row?.listingId}`), "C: «برداشتن» button carries mc:{listingId}")
  }

  // ── D) پس‌گرفتن: همان cancelListing؛ ردیف برمی‌دارَد ───────────────────────
  console.log("  ── D cancel → engine cancelListing → listing removed ──")
  {
    const u = 18004 // همان بازیکنِ §C — آگهی‌اش هنوز باز است
    const row = mockMarketListings.find((l) => l.sellerId === `p-${u}`)
    ok(Boolean(row), "D: the §C listing is still active before cancel")
    await sleep(350)
    const before = engineCalls.length
    await bot.handleUpdate(privCb(u, `mc:${row?.listingId}`, 964))
    const cancelCalls = engineCalls.slice(before).filter((c: any) => c.path === "/api/game/action" && c.body?.action === "cancelListing")
    ok(cancelCalls.length === 1 && cancelCalls[0]?.body?.payload?.listingId === row?.listingId, "D: exactly one engine cancelListing with the right listingId")
    ok(!mockMarketListings.some((l) => l.listingId === row?.listingId), "D: the Listing row is gone from the (mock) engine")
    const marketAfter = tg("editMessageText").at(-1)?.payload
    ok(!(marketAfter?.text ?? "").includes("آگهی‌های تو"), "D: refreshed market card no longer lists my listings")
    // واگذاریِ مالکیت: دکمه‌ی برداشتنِ دیگری در گروه → guard (نه cancelListing)
    const c = -1001800, other = user(18005)
    mockMarketListings.push({ listingId: "ml-other", itemKey: "water", name: "آب", emoji: "💧", rarity: "common", price: 10, quantity: 1, sellerName: "دیگری", sellerId: "p-elsewhere" })
    const before2 = engineCalls.length
    const cbGroup = (chatId: number, from: any, data: string) => ({
      update_id: nextUpdateId(),
      callback_query: { id: `cq${nextUpdateId()}`, from, message: { message_id: 965, date: 1, chat: chat(chatId) }, data },
    })
    await bot.handleUpdate(cbGroup(c, other, "mc:ml-other"))
    ok(engineCalls.slice(before2).every((c2: any) => !(c2.path === "/api/game/action" && c2.body?.action === "cancelListing")), "D: another player's cancel button pressed in a GROUP → owner-guard, zero engine cancel")
    mockMarketListings = mockMarketListings.filter((l) => l.listingId !== "ml-other")
  }
}

// ═══ 19. V16-4 — صفحه‌بندیِ کیف (ممیزی ⑬: برشِ ۸تاییِ بالا فقط بود) ══════════
console.log("⑲ V16-4: bag pagination (i:page:{n}) — page 2 renders items 9-16, chip «2/3» EN digits")
{
  const plainPriv = (userId: number, text: string) => ({
    update_id: nextUpdateId(),
    message: { message_id: nextUpdateId(), date: 1, chat: privChat(userId), from: user(userId), text, entities: [] },
  })
  const privCb = (userId: number, data: string, msgId: number) => ({
    update_id: nextUpdateId(),
    callback_query: { id: `cq${nextUpdateId()}`, from: user(userId), message: { message_id: msgId, date: 1, chat: privChat(userId) }, data },
  })
  const flatOf = (payload: any) => (payload?.reply_markup?.inline_keyboard ?? []).flat()
  const cbsOf = (payload: any) => flatOf(payload).map((b: any) => b.callback_data ?? "")
  const textsOf = (payload: any) => flatOf(payload).map((b: any) => b.text ?? "")
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  // 18 جنسِ زنده → 3 صفحه؛ ترتیب = quantity نزولی (کالای 1 اول)
  const bigBag = Array.from({ length: 18 }, (_, i) => ({
    itemKey: `thing_${i + 1}`, name: `کالای ${i + 1}`, emoji: "📦", rarityLabel: "معمولی",
    category: "consumable", quantity: 100 - i, equipped: false, favorite: false, locked: false,
    usable: true, tradable: true, effectLabel: null,
  }))
  const u = 19001
  mockProfileOverrides.set(String(u), { inventory: bigBag })

  // ── A) صفحه‌ی ۱: ۸ آیتمِ اول + چیپِ 1/3 + دکمه‌ی «آیتم‌های بیشتر» ────────────
  await bot.handleUpdate(plainPriv(u, "کیف"))
  const page1 = sendPayloads(u).at(-1)?.payload
  {
    const text = page1?.text ?? ""
    ok(text.includes("کالای 1") && text.includes("کالای 8"), "A: page 1 renders items 1-8")
    ok(!text.includes("کالای 9"), "A: page 1 does NOT render item 9 (was the old top-8 truncation line)")
    ok(!text.includes("آیتمِ دیگر"), "A: the «… و N آیتمِ دیگر» dead-end line is gone (pagination replaces it)")
    ok(text.includes("صفحه‌ی") && text.includes("<code>1/3</code>"), "A: page chip «1/3» (EN digits)")
    ok(cbsOf(page1).includes("i:page:1") && textsOf(page1).some((t: string) => t.includes("آیتم‌های بیشتر")), "A: «آیتم‌های بیشتر ▶» button carries i:page:1")
    ok(!cbsOf(page1).includes("i:page:0"), "A: no «قبلی» button on page 1")
  }

  // ── B) صفحه‌ی ۲: آیتم‌های 9-16 + چیپِ 2/3 + «◀ قبلی» ────────────────────────
  await sleep(350)
  await bot.handleUpdate(privCb(u, "i:page:1", 990))
  const page2 = tg("editMessageText").at(-1)?.payload
  {
    const text = page2?.text ?? ""
    ok(text.includes("کالای 9") && text.includes("کالای 16"), "B: page 2 renders items 9-16")
    ok(!text.includes("کالای 8") && !text.includes("کالای 17"), "B: page 2 carries ONLY its own slice")
    ok(text.includes("<code>2/3</code>") && !/[۰-۹٠-٩]/.test(text.replace(/<[^>]+>/g, "")), "B: page chip «2/3» with English digits only")
    ok(cbsOf(page2).includes("i:page:0") && textsOf(page2).some((t: string) => t.includes("◀ قبلی")), "B: «◀ قبلی» back button works (i:page:0)")
    ok(cbsOf(page2).includes("i:page:2"), "B: forward button to page 3 present")
  }

  // ── C) دکمه‌ی برگشت واقعاً برمی‌گردد ────────────────────────────────────────
  await sleep(350)
  await bot.handleUpdate(privCb(u, "i:page:0", 991))
  const backTo1 = tg("editMessageText").at(-1)?.payload
  ok((backTo1?.text ?? "").includes("کالای 1") && (backTo1?.text ?? "").includes("<code>1/3</code>"), "C: pressing «◀ قبلی» returns to page 1")

  // ── D) صفحه‌ی آخر: 17-18، بدونِ دکمه‌ی «بیشتر»، چیپِ 3/3 ────────────────────
  await sleep(350)
  await bot.handleUpdate(privCb(u, "i:page:2", 992))
  const page3 = tg("editMessageText").at(-1)?.payload
  {
    const text = page3?.text ?? ""
    ok(text.includes("کالای 17") && text.includes("کالای 18") && !text.includes("کالای 16"), "D: page 3 renders only items 17-18")
    ok(text.includes("<code>3/3</code>"), "D: page chip «3/3»")
    ok(!cbsOf(page3).some((d: string) => d === "i:page:3"), "D: no forward button past the last page")
    ok(cbsOf(page3).includes("i:page:1") && cbsOf(page3).includes("m:menu"), "D: prev + «↩ خانه» still present")
  }

  // ── E) گرامر: i:page:{n} معتبر؛ نویسه‌ی خراب رد ─────────────────────────────
  {
    const parsed = kbMod.parseCallback("i:page:2")
    ok(parsed?.kind === "bagPage" && parsed?.page === 2, "E: parseCallback(\"i:page:2\") → {kind:bagPage, page:2}")
    ok(kbMod.parseCallback("i:page:x") === null && kbMod.parseCallback("i:page:") === null, "E: malformed page data → null (no dead buttons)")
    ok(kbMod.parseCallback("i:use:water")?.kind === "item", "E: item-op grammar untouched (i:use:water still an item action)")
    // آیتمِ بی‌عملیات در صفحه‌ی خالی از عملیات — کیبوردِ صفحه‌بندی همچنان رندر می‌شود
    const sparse = kbMod.bagKeyboard({
      pets: [],
      inventory: bigBag.slice(16).map((i) => ({ ...i, usable: false, tradable: false })),
      prices: new Map(),
      page: 0,
    })
    ok(cbsOf({ reply_markup: { inline_keyboard: sparse.inline_keyboard } }).includes("m:menu"), "E: op-less items still yield a keyboard with «↩ خانه»")
  }

  mockProfileOverrides.delete(String(u))
}

// ── result ─────────────────────────────────────────────────────────────────────
console.log(`\n══ RESULT: ${pass} PASS / ${fail} FAIL ══`)
if (botErrors.length > 0) console.log("bot.catch errors (should be none):", botErrors)
if (failures.length > 0) {
  console.log("Failures:")
  for (const f of failures) console.log(`  ✗ ${f}`)
}
process.exit(fail === 0 ? 0 : 1)
