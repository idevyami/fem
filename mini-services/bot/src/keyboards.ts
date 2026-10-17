// FEMBOY WAR 🎀 — کیبوردها و callback-ها (V6 — دکمه‌های شیشه‌ایِ رنگی Bot API 9.4).
// ناوبری، نه منطق. زبانِ رنگ‌ها:
//   🔵 primary (آبی)  → ناوبری و اطلاعات: خانه، راهنما، شهر، من، آرزوها…
//   🟢 success (سبز)  → کارهای مطمئن/مثبت: کار، استراحت، غذا دادن، خرید، فرصتِ امن
//   🔴 danger  (قرمز) → پرخطر/وحشی: بینگو، بی‌کاری، فرصتِ wild، سفر به ممنوعه ☢

import { InlineKeyboard, Keyboard } from "grammy"
import type {
  ActiveEventDTO,
  CatalogJobDTO,
  ChoiceDTO,
  GuideResponse,
  InventoryEntryDTO,
  MarketSnapshot,
  OpportunityDTO,
  OutboxButton,
  PetDTO,
  PlayerDTO,
} from "./api"
import { affordableStakes, clampText, faNum } from "./format"

// فقط وقتی URL عمومیِ https واقعی باشد دکمه‌ی Mini App نمایش داده می‌شود
export const MINIAPP_URL = /^https:\/\//.test(process.env.MINIAPP_URL || "") ? (process.env.MINIAPP_URL as string) : ""

// لیست محله‌ها برای ناوبری (فقط ارائه — منطق سفر در موتور است)
export const DISTRICTS: { key: string; name: string; emoji: string }[] = [
  { key: "center", name: "مرکز شهر", emoji: "🏛" },
  { key: "bazaar", name: "بازار", emoji: "🏪" },
  { key: "park", name: "پارک", emoji: "🌳" },
  { key: "industrial", name: "منطقه‌ی صنعتی", emoji: "🏭" },
  { key: "old_town", name: "محله‌ی قدیمی", emoji: "🏚" },
  { key: "luxury", name: "منطقه‌ی لوکس", emoji: "💎" },
  { key: "suburbs", name: "حومه", emoji: "🌾" },
  { key: "forbidden", name: "منطقه‌ی ممنوعه", emoji: "☢" },
]

// لینک گفت‌وگوی خصوصی — برای nudging در گروه‌ها
export function privateLink(username: string): string {
  return `https://t.me/${username || "femwarbot"}`
}

// ─── callback data (کوتاه؛ سقف ۶۴ بایت) ─────────────────────────────────────

export const CB = {
  menu: "m:menu",
  event: "m:event",
  me: "m:me",
  city: "m:city",
  items: "m:items",
  history: "m:history",
  work: "a:work",
  rest: "a:rest",
  guide: "m:guide",
  goals: "m:goals",
  ops: "m:ops",
  dreams: "m:dreams",
  news: "m:news",
  top: "m:top",
  status: "m:status",
  rand: "g:rand",
  nextGo: "n:go",
  retry: "e:retry",
  // V6 — نمای‌های تازه‌ی زندگیِ من
  debt: "m:debt",
  titles: "m:titles",
  jobs: "m:jobs",
  market: "m:market",
  notify: "m:notify",
  bingo: "m:bingo",
  // V15-2 — خانه‌ی راهنما (کدکسِ تعاملیِ خصوصی) · حساب و تنظیمات · شهرِ گروهی
  help: "m:help",
  settings: "m:settings",
  groupCity: "m:groupcity",
  // V16-4 — دستاوردها (کارتِ عمیقِ پروفایل) · فهرست‌کردن در بازار
  ach: "m:ach",
  marketSell: "m:mk",
} as const

export const cbChoice = (eventId: string, idx: number) => `c:${eventId}:${idx}`
export const cbTravel = (district: string) => `t:${district}`
export const cbFeed = (petId: string) => `p:feed:${petId}`
export const cbPlay = (petId: string) => `p:play:${petId}`
export const cbClaim = (opportunityId: string) => `o:${opportunityId}`
// V6 — کیف: عملیاتِ هر آیتم
export const cbItemUse = (itemKey: string) => `i:use:${itemKey}`
export const cbItemEquip = (itemKey: string) => `i:eq:${itemKey}`
export const cbItemFav = (itemKey: string) => `i:fav:${itemKey}`
export const cbItemSell = (itemKey: string) => `i:sell:${itemKey}`
// V6 — بدهی/عنوان/شغل/بازار/خبرها/بینگو
export const cbPayDebt = (amount: number | "all") => `d:${amount}`
export const cbTitle = (titleKey: string) => `ti:${titleKey}`
export const cbJob = (jobKey: string) => `jb:${jobKey}`
export const cbJobQuit = () => "jb:quit"
export const cbBuy = (listingId: string) => `mk:${listingId}`
// V16-4 — فهرست‌کردن در بازار (همان اکشن‌های مینی‌اپ: createListing/cancelListing)
/** گامِ ۲ — انتخابِ جنس برای قیمت‌گذاری (ms = market sell) */
export const cbMarketPrice = (itemKey: string) => `ms:${itemKey}`
/** گامِ ۳ — تأیید: آگهی با همین قیمت زده می‌شود (mp = market price؛ هر دکمه = یک قیمت) */
export const cbMarketListAt = (itemKey: string, price: number) => `mp:${itemKey}:${price}`
/** پس‌گرفتنِ آگهیِ خودم (cancelListing) */
export const cbMarketCancel = (listingId: string) => `mc:${listingId}`
// V16-4 — صفحه‌بندیِ کیف (ممیزی ⑬): i:page:{n} در فضای‌ نامِ آیتم‌های کیف
export const cbBagPage = (page: number) => `i:page:${page}`
export const cbGamble = (stake: number) => `b:${stake}`
// V16-3 — واخواهیِ بینگو (مأموریت §6C): شرطِ گران دو‌مرحله‌ای است؛ «بفرست»
// فقط از کارتِ تأیید می‌آید (b:go:{stake}) — هر b:{stake}ِ گران اول واخواهی می‌گیرد.
export const cbGambleGo = (stake: number) => `b:go:${stake}`

export type Callback =
  | { kind: "menu" }
  | { kind: "event" }
  | { kind: "me" }
  | { kind: "city" }
  | { kind: "items" }
  | { kind: "history" }
  | { kind: "work" }
  | { kind: "rest" }
  | { kind: "guide" }
  | { kind: "goals" }
  | { kind: "ops" }
  | { kind: "dreams" }
  | { kind: "news" }
  | { kind: "top" }
  | { kind: "status" }
  | { kind: "rand" }
  | { kind: "nextGo" }
  | { kind: "retry" }
  | { kind: "claim"; opportunityId: string }
  | { kind: "choose"; eventId: string; idx: number }
  | { kind: "travel"; district: string }
  | { kind: "feed"; petId: string }
  | { kind: "play"; petId: string }
  // V6
  | { kind: "debt" }
  | { kind: "titles" }
  | { kind: "jobs" }
  | { kind: "market" }
  | { kind: "notify" }
  | { kind: "bingo" }
  | { kind: "item"; act: "use" | "eq" | "fav" | "sell"; itemKey: string }
  | { kind: "setTitle"; titleKey: string }
  | { kind: "setJob"; jobKey: string }
  | { kind: "quitJob" }
  | { kind: "buy"; listingId: string }
  | { kind: "gamble"; stake: number }
  // V16-3 — بینگوی تأییدشده (فقط از کارتِ واخواهی)
  | { kind: "gambleGo"; stake: number }
  | { kind: "payDebt"; amount: number | "all" }
  | { kind: "readNotifications" }
  // V15-2 — کدکسِ خصوصی · حساب و تنظیمات · شهرِ گروهی (کارتِ ناوبری)
  | { kind: "help" }
  | { kind: "settings" }
  | { kind: "groupCity" }
  // V16-4 — دستاوردها (کارتِ عمیقِ پروفایل) · فروش در بازار · صفحه‌ی کیف
  | { kind: "achievements" }
  | { kind: "marketSell" }
  | { kind: "marketPrice"; itemKey: string }
  | { kind: "marketListAt"; itemKey: string; price: number }
  | { kind: "marketCancel"; listingId: string }
  | { kind: "bagPage"; page: number }

/** تجزیه‌ی callback data → دستور قابل route شدن */
export function parseCallback(data: string | undefined): Callback | null {
  if (!data) return null
  switch (data) {
    case CB.menu:
      return { kind: "menu" }
    case CB.event:
      return { kind: "event" }
    case CB.me:
      return { kind: "me" }
    case CB.city:
      return { kind: "city" }
    case CB.items:
      return { kind: "items" }
    case CB.history:
      return { kind: "history" }
    case CB.work:
      return { kind: "work" }
    case CB.rest:
      return { kind: "rest" }
    case CB.guide:
      return { kind: "guide" }
    case CB.goals:
      return { kind: "goals" }
    case CB.ops:
      return { kind: "ops" }
    case CB.dreams:
      return { kind: "dreams" }
    case CB.news:
      return { kind: "news" }
    case CB.top:
      return { kind: "top" }
    case CB.status:
      return { kind: "status" }
    case CB.debt:
      return { kind: "debt" }
    case CB.titles:
      return { kind: "titles" }
    case CB.jobs:
      return { kind: "jobs" }
    case CB.market:
      return { kind: "market" }
    case CB.notify:
      return { kind: "notify" }
    case CB.bingo:
      return { kind: "bingo" }
    case CB.help:
      return { kind: "help" }
    case CB.settings:
      return { kind: "settings" }
    case CB.groupCity:
      return { kind: "groupCity" }
    // V16-4 — دستاوردها (کارتِ عمیق) · فهرست‌کردن در بازار
    case CB.ach:
      return { kind: "achievements" }
    case CB.marketSell:
      return { kind: "marketSell" }
    case CB.rand:
      return { kind: "rand" }
    case CB.nextGo:
      return { kind: "nextGo" }
    case CB.retry:
      return { kind: "retry" }
  }
  const [tag, ...rest] = data.split(":")
  const arg = rest.join(":")
  if (tag === "c" && rest.length === 2) {
    const idx = Number(rest[1])
    if (!Number.isNaN(idx) && rest[0]) return { kind: "choose", eventId: rest[0], idx }
  }
  if (tag === "t" && arg) return { kind: "travel", district: arg }
  if (tag === "p" && rest.length === 2) {
    if (rest[0] === "feed" && rest[1]) return { kind: "feed", petId: rest[1] }
    if (rest[0] === "play" && rest[1]) return { kind: "play", petId: rest[1] }
  }
  if (tag === "o" && arg) return { kind: "claim", opportunityId: arg }
  // V6 — عملیاتِ آیتمِ کیف
  if (tag === "i" && rest.length === 2) {
    // V16-4 — صفحه‌بندیِ کیف: i:page:{n} (ممیزی ⑬) — فقط رقمِ تمام؛ «i:page:» رد
    if (rest[0] === "page" && rest[1] !== undefined && /^\d+$/.test(rest[1])) {
      const n = Number(rest[1])
      if (n < 100) return { kind: "bagPage", page: n }
    }
    const act = rest[0]
    if (rest[1] && (act === "use" || act === "eq" || act === "fav" || act === "sell")) {
      return { kind: "item", act, itemKey: rest[1] }
    }
  }
  // V6 — بدهی: d:100 / d:500 / d:all
  if (tag === "d") {
    if (arg === "all") return { kind: "payDebt", amount: "all" }
    const n = Number(arg)
    if (Number.isFinite(n) && n > 0) return { kind: "payDebt", amount: n }
  }
  // V6 — عنوان: ti:{titleKey}
  if (tag === "ti" && arg) return { kind: "setTitle", titleKey: arg }
  // V6 — شغل: jb:{jobKey} / jb:quit
  if (tag === "jb") {
    if (arg === "quit") return { kind: "quitJob" }
    if (arg) return { kind: "setJob", jobKey: arg }
  }
  // V6 — خریدِ آگهیِ بازار: mk:{listingId}
  if (tag === "mk" && arg) return { kind: "buy", listingId: arg }
  // V16-4 — فروش در بازار: ms:{itemKey} (انتخابِ جنس) · mp:{itemKey}:{price} (تأیید)
  // · mc:{listingId} (پس‌گرفتن) — همان اکشن‌های مینی‌اپ از موتور می‌گیرند
  if (tag === "ms" && arg) return { kind: "marketPrice", itemKey: arg }
  if (tag === "mp" && rest.length === 2) {
    const price = Number(rest[1])
    if (rest[0] && Number.isFinite(price) && price > 0) return { kind: "marketListAt", itemKey: rest[0], price }
  }
  if (tag === "mc" && arg) return { kind: "marketCancel", listingId: arg }
  // V6/V16-3 — بینگو: b:{stake} (درخواست — ۵۰۰۰ واخواهی می‌گیرد) · b:go:{stake} (تأییدشده)
  if (tag === "b") {
    if (arg.startsWith("go:")) {
      const g = Number(arg.slice(3))
      if (Number.isFinite(g) && g > 0) return { kind: "gambleGo", stake: g }
    }
    const n = Number(arg)
    if (Number.isFinite(n) && n > 0) return { kind: "gamble", stake: n }
  }
  // V6 — خبرها: خواندم
  if (data === "nt:read") return { kind: "readNotifications" }
  return null
}

// ─── استایل‌ها ───────────────────────────────────────────────────────────────

type InlineStyle = "primary" | "success" | "danger"

/** رنگِ دکمه‌ی claim بر اساس ریسک: امن=سبز، ریسکی=آبی، وحشی=قرمز */
export function claimStyleOf(style: OpportunityDTO["claimStyle"]): InlineStyle {
  if (style === "safe") return "success"
  if (style === "risky") return "primary"
  return "danger"
}

/** استنباط ریسکِ یک انتخابِ اتفاق از hint آن */
export function choiceStyle(c: ChoiceDTO): InlineStyle | null {
  if (c.locked) return null
  const h = c.hint ?? ""
  if (/خطر|ریسک|ممنوع/.test(h)) return "danger"
  if (/امن|آرام/.test(h)) return "success"
  return null
}

/** ردیف Mini App — فقط با URL معتبر.
 *  دکمه‌ی web_app: در تلگرام به‌صورتِ مینی‌اپِ بومی باز می‌شود (با initData —
 *  یعنی هویتِ واقعیِ تلگرامیِ بازیکن و تمِ شیشه‌ایِ خودش)؛ دکمه‌ی url فقط
 *  مرورگر بیرونی را باز می‌کرد و بازیکن به‌عنوانِ مهمان می‌باخت.
 *  V7 — export شد تا لایه‌ی سول‌باند (soul.ts) هم همان ردیف را بچیند. */
export function withMiniApp(kb: InlineKeyboard): InlineKeyboard {
  if (MINIAPP_URL) {
    kb.row()
    kb.webApp("📱 Femboy War", MINIAPP_URL).primary()
  }
  return kb
}

// ─── کیبورد ثابتِ خصوصی (Reply) ─────────────────────────────────────────────

/** کیبورد ریسپانسیِ همیشه‌حاضرِ چتِ خصوصی — V16-3 (مأموریت §4): همان مقصدهای
 *  اولیه‌ی منویِ خانه، نه فهرستِ کامل. حداکثر ۳ دکمه در هر ردیف + placeholder.
 *  متنِ دکمه‌ها بعد از نرمال‌سازی باید نیتِ واقعی باشد (V13: مسیریابِ نیت می‌گیردشان) —
 *  «🎯 قدمِ بعدی» عبارتِ قاعده‌مندِ راهنماست (واژه‌نامه: nextStep). */
export function replyKeyboard(): Keyboard {
  const kb = new Keyboard()
  kb.text("🎀 فمبوی", "primary")
  kb.text("🎲 اتفاق", "primary")
  kb.text("🎯 قدمِ بعدی", "primary").row()
  kb.text("🎒 کیف", "primary")
  kb.text("💼 کار", "success").row()
  kb.text("📖 راهنما", "primary")
  kb.text("⚙ منو", "primary")
  return kb.persistent().resized().placeholder("برای شهر چیزی بنویس…")
}

// ─── کیبوردهای Inline (نماهای پویا) ─────────────────────────────────────────

/** خانه — هابِ گروه‌بندی‌شده (V16-3، مأموریت §4: «فقط مقصدهایِ واقعاً اولیه»).
 *  «👑 فمبوی من» با کال‌بکِ fw:hub می‌رود (لایه‌ی سول‌باند؛ مسیرِ مستقیمِ هاب).
 *  ۱۱ دکمه در ۴ ردیفِ معنادار: هویت/اقدام ← زندگی ← اقتصاد ← پشتیبانی/سطحِ دیگر.
 *  اهداف/فرصت‌ها/آرزوها/استراحت دیگر دکمه‌ی سطحِ خانه نیستند — فرصت‌ها و آرزوها
 *  بخش/دکمه‌ی کارتِ «قدمِ بعدی»‌اند، استراحت دکمه‌ی کارتِ «من» است؛ عبارت‌هایشان
 *  همیشه زنده‌اند (intent.ts). برچسب‌ها = واژه‌نامه‌ی قاعده‌مند (TERM):
 *  «قدمِ بعدی» (nextStep) · «شهرِ گروه» (groupWorld) — ۵ رشته‌ی قاعده‌مندِ
 *  bot-side عیناً از src/lib/game/terminology.ts تکرار می‌شوند (پکیجِ جدا،
 *  بدون import — مستند در worklogِ V16-3). */
export function homeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("👑 فمبوی من", "fw:hub").primary()
  kb.text("🎲 اتفاق امروز", CB.event).primary().row()
  kb.text("🎯 قدمِ بعدی", CB.guide).primary()
  kb.text("👤 من", CB.me).primary()
  kb.text("🏙 شهر", CB.city).primary().row()
  kb.text("🎒 کیف", CB.items).primary()
  kb.text("🏪 بازار", CB.market).primary()
  kb.text("💼 کار", CB.work).success().row()
  kb.text("📖 راهنما", CB.help).primary()
  kb.text("👥 شهرِ گروه", CB.groupCity).primary()
  kb.text("⚙ حساب", CB.settings).primary()
  return withMiniApp(kb)
}

/** قدمِ بعدی — انتخاب تصادفی + ناوبریِ اهداف/فرصت/آرزو (فرصت‌ها و آرزوها
 *  V16-3 دکمه‌ی همین کارت‌اند — دیگر دکمه‌ی سطحِ خانه نیستند). */
export function guideKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎲 انتخاب تصادفی", CB.rand).primary().row()
  kb.text("🎯 اهداف", CB.goals).primary()
  kb.text("⚡ فرصت‌ها", CB.ops).primary().row()
  kb.text("✨ آرزوها", CB.dreams).primary()
  kb.text("↩ خانه", CB.menu).primary()
  return withMiniApp(kb)
}

export function goalsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎯 قدمِ بعدی", CB.guide).primary()
  kb.text("⚡ فرصت‌ها", CB.ops).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

export function dreamsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎯 قدمِ بعدی", CB.guide).primary()
  kb.text("🎯 اهداف", CB.goals).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** فرصت‌ها — دکمه‌ی claim هر فرصت با رنگِ ریسکش */
export function opsKeyboard(g: GuideResponse): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const o of g.opportunities.slice(0, 6)) {
    kb.text(`${o.icon} ${clampText(o.title, 26)}`, cbClaim(o.id)).style(claimStyleOf(o.claimStyle)).row()
  }
  if (g.opportunities.length === 0) {
    kb.text("🎲 اتفاق امروز", CB.event).primary().row()
  }
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** دکمه‌های یک اتفاق — هر گزینه یک ردیف؛ قفل‌ها 🔒 بی‌رنگ، ریسک از hint */
export function eventKeyboard(e: ActiveEventDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  e.choices.forEach((c, i) => {
    const label = c.locked ? `${c.label} 🔒` : c.label
    const btn = kb.text(clampText(label, 44), cbChoice(e.id, i))
    const st = choiceStyle(c)
    if (st) btn.style(st)
    btn.row()
  })
  return kb
}

/** «🧭 بعدی: …» — بعد از نتیجه‌ی انتخاب/کار/claim */
export function nextKeyboard(label: string): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text(`🧭 ${clampText(label, 30)}`, CB.nextGo).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

export function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩ خانه", CB.menu).primary()
}

/** کارتِ بومیِ باز کردنِ مینی‌اپ — لینکِ عمیقِ /start app از کارت‌های گروه این‌جا فرود می‌آید */
export function miniAppCardKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (MINIAPP_URL) kb.webApp("📱 Femboy War", MINIAPP_URL).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** پروفایل — با ردیفِ قرمزِ بدهی (وقتی بدهی دارد) · V16-3: «😴 استراحت» این‌جاست
 *  (انرژی همین کارت دیده می‌شود — کنشِ بافتاری، مأموریت §4) · V16-4: «🏆 دستاوردها»
 *  همین‌جاست (کارتِ عمیق؛ ممیزی ⑪ — دستاورد دیگر فقطِ مینی‌اپ نیست) · عنوان‌ها و حساب */
export function profileKeyboard(player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (player.debt > 0) {
    kb.text(`💳 پرداختِ بدهی (${faNum(player.debt)})`, CB.debt).danger().row()
  }
  kb.text("📜 تاریخچه", CB.history).primary()
  kb.text("🏆 دستاوردها", CB.ach).primary().row()
  kb.text("🏷 عنوان‌ها", CB.titles).primary()
  kb.text("✨ آرزوها", CB.dreams).primary().row()
  kb.text("⚙ حساب", CB.settings).primary()
  kb.text("😴 استراحت", CB.rest).success().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🏆 دستاوردها — کارتِ عمیقِ پروفایل (V16-4)؛ بازگشت به «من» و خانه */
export function achievementsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("👤 من", CB.me).primary()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** شهر — همه‌ی محله‌ها (به‌جزِ محله‌ی فعلی) در گریدِ دو‌ستونه (V16-3، ممیزی ④:
 *  دیروز ۴ محله‌ی تصادفی از ۸ تا نمایش داده می‌شد). محله‌هایِ عادی آبی و جفت‌
 *  جفت می‌نشینند (برچسب‌های کوتاه)؛ «منطقه‌ی ممنوعه» همیشه هست، قرمز است و
 *  ردیفِ تمام‌عرضِ خودش را می‌گیرد — کنشِ مخرب از ناوبریِ روزمره جدا (§4). */
export function cityKeyboard(currentDistrict: string): InlineKeyboard {
  const kb = new InlineKeyboard()
  const others = DISTRICTS.filter((d) => d.key !== currentDistrict)
  const normal = others.filter((d) => d.key !== "forbidden")
  const forbidden = others.find((d) => d.key === "forbidden")
  let open = false // ردیفِ بازِ تک‌دکمه‌ای که منتظرِ جفتِ کوتاه است
  for (const d of normal) {
    const label = `${d.emoji} ${d.name}`
    kb.text(label, cbTravel(d.key)).primary()
    if (open && pairableLabel(label)) {
      kb.row()
      open = false
    } else {
      if (open) kb.row()
      open = pairableLabel(label)
    }
  }
  if (open) kb.row()
  // منطقه‌ی ممنوعه همیشه در لیست سفرهاست — دکمه‌ی قرمزِ ثابتِ شهر، ردیفِ خودش
  if (forbidden) {
    kb.text(`${forbidden.emoji} ${forbidden.name}`, cbTravel(forbidden.key)).danger().row()
  }
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🎒 کیف (V6) — حیوان‌ها + عملیاتِ آیتم‌های صفحه‌ی فعلی؛ سقفِ کل ~۱۲ دکمه
 *  (V16-4، ممیزی ⑬: صفحه‌بندی — دکمه‌ی «آیتم‌های بیشتر» صفحه‌ی بعد را می‌آورد).
 *  هر حیوان: غذا/بازی (سبز) — برای همه‌ی حیوان‌ها تا سقفِ بودجه.
 *  هر آیتمِ همین صفحه: استفاده/پوشیدن (سبز) · ⭐ (خنثی) · فروش (آبی، با قیمت) — به‌ترتیبِ فهرست. */
export function bagKeyboard(p: {
  pets: PetDTO[]
  inventory: InventoryEntryDTO[]
  /** قیمتِ فروشِ فوریِ هر itemKey (۶۰٪ قیمتِ روز) — برای برچسبِ دکمه‌ی فروش */
  prices: Map<string, number>
  /** صفحه‌ی فعلی (V16-4) — پیش‌فرض 0 */
  page?: number
}): InlineKeyboard {
  const kb = new InlineKeyboard()
  let budget = 12

  for (const pet of p.pets) {
    if (budget < 2) break
    const name = clampText(pet.name, 10)
    kb.text(`🍖 ${name}`, cbFeed(pet.id)).success()
    kb.text(`🎾 ${name}`, cbPlay(pet.id)).success().row()
    budget -= 2
  }

  // V16-4 — آیتم‌های «همین صفحه» (هم‌ترتیبِ متنِ کارت)
  const live = [...p.inventory].filter((i) => i.quantity > 0).sort((a, b) => b.quantity - a.quantity)
  const pageCount = Math.max(1, Math.ceil(live.length / 8))
  const page = Math.max(0, Math.min(p.page ?? 0, pageCount - 1))
  const items = live.slice(page * 8, page * 8 + 8)
  for (const it of items) {
    if (budget <= 0) break
    const row: { label: string; data: string; style?: "primary" | "success" }[] = []
    if (it.usable) row.push({ label: "استفاده", data: cbItemUse(it.itemKey), style: "success" })
    if (it.category === "gear") row.push({ label: "پوشیدن", data: cbItemEquip(it.itemKey), style: "success" })
    // ⭐ خنثی — بدون استایل (برایِ علاقه‌مندی، «برداشتن» لازم است تا فروش باز شود)
    row.push({ label: it.favorite ? "برداشتن ⭐" : "⭐", data: cbItemFav(it.itemKey) })
    const price = p.prices.get(it.itemKey)
    if (it.tradable && !it.favorite && !it.locked && price) {
      row.push({ label: `فروش ${faNum(price)}`, data: cbItemSell(it.itemKey), style: "primary" })
    }
    // آیتمِ بی‌عملیات (نه مصرفی، نه لوازم، نه علاقه‌مندی) — ارزشِ یک ردیف ندارد
    if (row.length === 1 && !it.favorite) continue
    for (const b of row) {
      const btn = kb.text(b.label, b.data)
      if (b.style) btn.style(b.style)
    }
    kb.row()
    budget -= row.length
  }

  if (kb.inline_keyboard.length === 0 && pageCount <= 1) return backKeyboard()
  // V16-4 — ناوبریِ صفحه‌ها: جفتِ قبلی/بعدی + شمار‌صفحه (رقمِ انگلیسی)
  if (pageCount > 1) {
    if (page > 0) {
      kb.text(`◀ قبلی (${faNum(page)})`, cbBagPage(page - 1)).primary()
    }
    if (page < pageCount - 1) {
      kb.text(`آیتم‌های بیشتر (${faNum(page + 2)}/${faNum(pageCount)}) ▶`, cbBagPage(page + 1)).primary()
    }
    kb.row()
  }
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 💳 بدهی — پرداختِ پله‌ای + همه (سبز: کارِ مطمئنِ مالی) */
export function debtKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("💳 100", cbPayDebt(100)).success()
  kb.text("💳 500", cbPayDebt(500)).success()
  kb.text("💸 همه‌اش", cbPayDebt("all")).success().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🏷 عنوان‌ها — فعال ✅ سبز؛ بقیه آبی */
export function titlesKeyboard(player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const t of player.titles.slice(0, 8)) {
    const active = t.key === player.activeTitle
    kb.text(`${t.emoji} ${clampText(t.name, 20)}${active ? " ✅" : ""}`, cbTitle(t.key)).style(active ? "success" : "primary").row()
  }
  if (kb.inline_keyboard.length === 0) return backKeyboard()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 💼 شغل‌ها — شغلِ فعلی ✅ · سطحِ کافی نداری 🔒 (بی‌رنگ) · بقیه آبی · بی‌کاری قرمز */
export function jobsKeyboard(jobs: CatalogJobDTO[], player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  const current = player.job?.key ?? null
  for (const j of jobs.slice(0, 9)) {
    const mine = j.key === current
    const locked = player.level < j.minLevel
    const label = `${j.emoji} ${clampText(j.name, 18)}${mine ? " ✅" : locked ? " 🔒" : ""}`
    kb.text(label, cbJob(j.key)).style(mine ? "success" : locked ? undefined : "primary").row()
  }
  if (current) kb.text("📄 بی‌کار شو", cbJobQuit()).danger().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🏪 بازار — خریدِ مغازه‌ی محله و آگهی‌های مردم (سبز) · فهرست‌کردن (V16-4) ·
 *  پس‌گرفتنِ آگهی‌های خودم (قرمز). سقفِ ~۱۲ دکمه (خرید+پس‌گرفتن) + دکمه‌ی فروش. */
export function marketKeyboard(m: MarketSnapshot): InlineKeyboard {
  const kb = new InlineKeyboard()
  let budget = 12
  const buyable = m.listings.filter((l) => !l.mine && l.quantity > 0)
  const shop = buyable.filter((l) => l.sellerName === null).slice(0, 6)
  const players = buyable.filter((l) => l.sellerName !== null).slice(0, 6)
  for (const l of [...shop, ...players]) {
    if (budget <= 0) break
    const label = `🛒 ${clampText(l.name, 16)} · ${faNum(l.price)}`
    kb.text(label, cbBuy(l.listingId)).success().row()
    budget--
  }
  // V16-4 (ممیزی ⑪) — آگهی‌های خودم: «برداشتن» (cancelListing؛ جنس برمی‌گردد تو کیف)
  const mine = m.listings.filter((l) => l.mine && l.quantity > 0).slice(0, 3)
  for (const l of mine) {
    if (budget <= 0) break
    kb.text(`✂️ برداشتن ${clampText(l.name, 12)} · ${faNum(l.price)}`, cbMarketCancel(l.listingId)).danger().row()
    budget--
  }
  // V16-4 — فهرست‌کردن: مسیرِ فروش (انتخابِ جنس ← قیمت ← آگهی)؛ همیشه هست —
  // حتی وقتی قفسه‌ها خالی‌اند، فروشِ خودت شروعِ بازار است
  kb.text("🛍 فهرست‌کردن", CB.marketSell).success().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🛍 گامِ ۱ — جنس‌های قابلِ‌فروشِ کیف (تا ۸ دکمه) + بازگشت به بازار (V16-4) */
export function marketSellKeyboard(
  sellable: { itemKey: string; emoji: string; name: string }[],
): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const it of sellable) {
    kb.text(`${it.emoji} ${clampText(it.name, 18)}`, cbMarketPrice(it.itemKey)).primary().row()
  }
  if (kb.inline_keyboard.length === 0) {
    return new InlineKeyboard().text("🏪 بازار", CB.market).primary().row().text("↩ خانه", CB.menu).primary()
  }
  kb.text("🏪 بازار", CB.market).primary()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🏷 گامِ ۲ — کارتِ قیمت: هر دکمه = یک قیمتِ پیشنهادی (تأییدِ تک‌ضربی،
 *  افشایِ کاملِ هزینه‌ها قبل از لمس — الگوی بینگوی ۱۰۰) + بازگشت‌ها (V16-4) */
export function marketPriceKeyboard(itemKey: string, suggestions: number[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const p of suggestions) {
    kb.text(`🏷 ${faNum(p)} سکه`, cbMarketListAt(itemKey, p)).success().row()
  }
  kb.text("🛍 جنسِ دیگر", CB.marketSell).primary()
  kb.text("🏪 بازار", CB.market).primary().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🔔 خبرها — «خواندم» (سبز) + خانه */
export function notifyKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("✅ همه را خواندم", "nt:read").success().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** 🎲 بینگو — فقط شرط‌هایی که جیب واقعاً می‌کشد (V16-3، ممیزی ⑩: شرطِ گران
 *  دو‌مرحله‌ای؛ دکمه‌ی ۵۰۰۰ به واخواهی می‌رود — b:go فقط از کارتِ تأیید).
 *  شرط‌هایِ بی‌جیب دکمه نمی‌گیرند — کارت با خطِ صادقانه‌ی خودش می‌گوید چرا. */
export function bingoKeyboard(money: number): InlineKeyboard {
  const kb = new InlineKeyboard()
  const stakes = affordableStakes(money)
  let open = false
  for (const s of stakes) {
    kb.text(`🎲 ${faNum(s)}`, cbGamble(s)).danger()
    if (open) {
      kb.row()
      open = false
    } else {
      open = true
    }
  }
  if (open) kb.row()
  if (stakes.length === 0) {
    // جیب هیچ‌کدام را نمی‌کشد — دکمه‌ی مرجوعِ بی‌عمل نمی‌سازیم (§6D: صادق باش)
    kb.text("↩ خانه", CB.menu).primary()
    return kb
  }
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** کارتِ واخواهی — «💥 بفرست» فقط این‌جا است (b:go:{stake}) */
export function bingoConfirmKeyboard(stake: number): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("💥 بفرست", cbGambleGo(stake)).danger().row()
  kb.text("↩ خانه", CB.menu).primary()
  return kb
}

/** خطا — دوباره (قرمز) + خانه (آبی) */
export function errorKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🔄 دوباره", CB.retry).danger()
  kb.text("🏠 منو", CB.menu).primary()
  return kb
}

/** ریدایرکت به خصوصی — در گروه‌ها */
export function nudgeKeyboard(username: string): InlineKeyboard {
  return new InlineKeyboard().url("رفتن به گفت‌وگوی خصوصی", privateLink(username)).primary()
}

// ─── V5 — کیبوردِ دکمه‌های موتورِ گروه (outbox) ──────────────────────────────

/** سقفِ نویسه‌ی برچسبِ جفت‌شونده — خواناییِ موبایل (قصدِ گریدِ V15-1) */
const PAIR_LABEL_MAX = 14

/** برچسبِ کوتاهِ جفت‌شونده؟ — طولِ نویسه‌ای بدونِ ZWJ (ایموجی‌هایِ ترکیبی مثلِ
 *  🧑‍🤝‍🧑 یک نویسه‌ی ادراکی حساب می‌شوند، نه پنج‌تا) */
function pairableLabel(label: string): boolean {
  return Array.from(label.replace(/\u200D/g, "")).length <= PAIR_LABEL_MAX
}

/** کیبوردِ ساخته‌شده از دکمه‌های موتورِ شهرِ زنده — رنگ از استایلِ موتور
 *  (🔵 ناوبری · 🟢 مطمئن · 🔴 پرخطر) و url هم پشتیبانی می‌شود.
 *  V15-2 — sameRow: قصدِ چیدمانِ موتور (جفت‌هایِ گریدِ هابِ ۱۲گانه) — دکمه‌یِ
 *  نشانه‌دارِ کوتاه کنارِ دکمه‌یِ قبلیِ همان ردیف می‌نشیند (حداکثر ۲ در ردیف).
 *  دکمه‌یِ بی‌نشانه یا بلند ردیفِ تمام‌عرضِ خودش را می‌گیرد — دقیقاً رفتارِ
 *  دیروز؛ پس برایِ همه‌ی دکمه‌هایِ موجود بی‌تغییر است.
 *  خروجیِ خالیِ دکمه‌ها معتبر است: در editMessageText یعنی «حذفِ دکمه‌ها». */
export function outboxKeyboard(buttons: OutboxButton[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  let inRow = 0 // دکمه‌هایِ ردیفِ باز (۰ = ردیفِ بسته/خالی)
  const add = (b: OutboxButton): void => {
    if (b.url) kb.url(b.label, b.url)
    else if (b.cb) kb.text(b.label, b.cb)
    else return // دکمه‌ی بی‌عمل — موتور چنین چیزی نمی‌فرستد
    if (b.style === "primary") kb.primary()
    else if (b.style === "success") kb.success()
    else if (b.style === "danger") kb.danger()
  }
  for (const b of buttons) {
    if (!b.url && !b.cb) continue
    if (b.sameRow === true && inRow === 1 && pairableLabel(b.label)) {
      add(b) // کنارِ دکمه‌یِ قبلی — جفتِ گرید
      kb.row()
      inRow = 0
    } else {
      if (inRow > 0) kb.row()
      add(b)
      inRow = 1
    }
  }
  if (inRow > 0) kb.row()
  return kb
}
