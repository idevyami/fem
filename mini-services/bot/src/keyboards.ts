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
import { affordableStakes, clampText, faNum, type LivingWhich } from "./format"

/** V26 — تبِ فعالِ هابِ اصلی (سه تب: امروز/فمبوی/شهر) */
export type HomeTab = "dash" | "fem" | "city"

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
  // V20 — مقصدهای اولیه‌ی ناوبری (مأموریت §3.2: بازی/فمبوی/فعالیت/وسایل/شهر/راهنما)
  acts: "m:acts",
  // V26 — تب‌های هابِ اصلی (کنترل‌پنلِ سه‌تبی: امروز/فمبوی/شهر)
  tabDash: "m:tab:dash",
  tabFem: "m:tab:fem",
  tabCity: "m:tab:city",
  // V15-2 — خانه‌ی راهنما (کدکسِ تعاملیِ خصوصی) · حساب و تنظیمات · شهرِ گروهی
  help: "m:help",
  settings: "m:settings",
  groupCity: "m:groupcity",
  // V16-4 — دستاوردها (کارتِ عمیقِ پروفایل) · فهرست‌کردن در بازار
  ach: "m:ach",
  marketSell: "m:mk",
  // V17-3 — خانه و وسیله (ممیزی ⑨: خرید خانه/وسیله فقط مینی‌اپ نباشد)
  livingHome: "lv:home",
  livingVeh: "lv:veh",
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
// V17-3 — خانه و وسیله (ممیزی ⑨): لیست ← تأیید ← اجرا (الگوی b:go بینگو).
// lv:home/lv:veh لیست‌ها · lv:buyh:{key}/lv:buyv:{key} کارتِ تأیید ·
// lv:go:{h|v}:{key} فقط از کارتِ تأیید (خریدِ پول‌سوز با تأییدِ دومرحله‌ای).
export const cbLivingBuy = (which: LivingWhich, key: string): string =>
  `lv:buy${which === "house" ? "h" : "v"}:${key}`
export const cbLivingGo = (which: LivingWhich, key: string): string =>
  `lv:go:${which === "house" ? "h" : "v"}:${key}`

export type Callback =
  | { kind: "menu" }
  | { kind: "tab"; tab: HomeTab }
  | { kind: "event" }
  | { kind: "me" }
  | { kind: "city" }
  | { kind: "items" }
  | { kind: "history" }
  | { kind: "acts" }
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
  // V17-3 — خانه و وسیله: لیست · تأیید · اجرا (فقط از کارتِ تأیید)
  | { kind: "living"; which: LivingWhich }
  | { kind: "livingBuy"; which: LivingWhich; key: string }
  | { kind: "livingGo"; which: LivingWhich; key: string }

/** تجزیه‌ی callback data → دستور قابل route شدن */
export function parseCallback(data: string | undefined): Callback | null {
  if (!data) return null
  switch (data) {
    case CB.menu:
      return { kind: "menu" }
    case CB.tabDash:
      return { kind: "tab", tab: "dash" }
    case CB.tabFem:
      return { kind: "tab", tab: "fem" }
    case CB.tabCity:
      return { kind: "tab", tab: "city" }
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
    case CB.acts:
      return { kind: "acts" }
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
    // V17-3 — خانه و وسیله: دو لیستِ همان کارت
    case CB.livingHome:
      return { kind: "living", which: "house" }
    case CB.livingVeh:
      return { kind: "living", which: "vehicle" }
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
  // V17-3 — خانه و وسیله: buyh:/buyv: (تأیید) · go:h:/go:v: (اجرا)
  if (tag === "lv") {
    if (arg.startsWith("buyh:") && arg.length > 5) return { kind: "livingBuy", which: "house", key: arg.slice(5) }
    if (arg.startsWith("buyv:") && arg.length > 5) return { kind: "livingBuy", which: "vehicle", key: arg.slice(5) }
    if (arg.startsWith("go:h:") && arg.length > 5) return { kind: "livingGo", which: "house", key: arg.slice(5) }
    if (arg.startsWith("go:v:") && arg.length > 5) return { kind: "livingGo", which: "vehicle", key: arg.slice(5) }
  }
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

/** کیبورد ریسپانسیِ همیشه‌حاضرِ چتِ خصوصی — V26 (بازسازی §3.C): دو ردیفِ ۴تایی
 *  با گروه‌بندیِ روشن — ردیفِ اول «هویت و امروز»، ردیفِ دوم «کنش و مقصد».
 *  دیروز ۳×۳ بود؛ حالا ۲×۴ — هم‌عرضِ ردیف‌های هاب، هم‌خوانِ انگشتِ روی موبایل.
 *  هر برچسب پس از نرمال‌سازی نیتِ زنده است (مسیریابِ intent.ts می‌گیردشان). */
export function replyKeyboard(): Keyboard {
  const kb = new Keyboard()
  kb.text("🎀 فمبوی", "primary")
  kb.text("🎲 اتفاق", "primary")
  kb.text("🎯 قدمِ بعدی", "primary")
  kb.text("👤 من", "primary").row()
  kb.text("⚡ فعالیت‌ها", "primary")
  kb.text("🎒 کیف", "primary")
  kb.text("🌍 شهر", "primary")
  kb.text("💼 کار", "success")
  return kb.persistent().resized().placeholder("برای شهر چیزی بنویس…")
}

// ─── V26 — ستونِ فقراتِ پنل: دکمه‌های بازگشتِ یکدست ────────────────────────

/** دکمه‌ی خانه — همه‌ی کارت‌ها با همین یک برچسب به هاب برمی‌گردند */
export function homeBtn(): ReturnType<InlineKeyboard["text"]> {
  return new InlineKeyboard().text("🏠 خانه", CB.menu).primary()
}

/** ردیفِ پایانیِ هر پنل — V26 (بازسازی §3.B): بازگشتِ والد + خانه، همیشه آخرین
 *  ردیف، همیشه هم‌برچسب. parent = داده‌ی callback والد، parentLabel = نامش.
 *  بدونِ والد → فقط خانه (کارت‌های فرزندِ مستقیمِ هاب). */
export function panelFooterRows(kb: InlineKeyboard, parent?: { data: string; label: string }): InlineKeyboard {
  kb.row()
  if (parent) {
    kb.text(`↩ ${parent.label}`, parent.data).primary()
    kb.text("🏠 خانه", CB.menu).primary()
  } else {
    kb.text("🏠 خانه", CB.menu).primary()
  }
  return kb
}

/** کیبوردِ کاملِ پنل با footer — سازنده‌ی مشترکِ همه‌ی کارت‌های ویژگی */
export function panelKeyboard(parent?: { data: string; label: string }): InlineKeyboard {
  return panelFooterRows(new InlineKeyboard(), parent)
}

// ─── کیبوردهای Inline (نماهای پویا) ─────────────────────────────────────────

/** خانه — V26 (بازسازی §3.A): کنترل‌پنلِ سه‌تبی. ردیفِ اول = سه تبِ هاب
 *  (محتوای همان پیام عوض می‌شود — ویرایشِ درجا، بدونِ پیامِ تازه)؛ تبِ فعال
 *  با ● و رنگِ سبز نشان می‌شود. ردیفِ دوم = دو فعلِ اصلیِ روز. ردیفِ سوم =
 *  مقصدهای تب (فمبوی/شهر تب‌های خودشان را دارند). ردیفِ چهارم = بازار (اکنون
 *  سطحِ هاب — §3.2 اقتصاد) + راهنما. مینی‌اپ همیشه تهِ کارت. */
export function homeKeyboard(tab: HomeTab = "dash"): InlineKeyboard {
  const kb = new InlineKeyboard()
  // تب‌ها — فعال: ● + success؛ غیرفعال: بی‌رنگ (چشم اول به تبِ فعال می‌افتد)
  const tabs: { label: string; active: boolean; data: string }[] = [
    { label: "امروز", active: tab === "dash", data: CB.tabDash },
    { label: "فمبوی", active: tab === "fem", data: CB.tabFem },
    { label: "شهر", active: tab === "city", data: CB.tabCity },
  ]
  for (const t of tabs) {
    const btn = kb.text(t.active ? `● ${t.label}` : t.label, t.data)
    if (t.active) btn.style("success")
  }
  kb.row()
  // فعل‌های اصلی — رنگ‌دار (آبی = قدمِ بعدی، سبز = اتفاقِ امروز)
  kb.text("🧭 قدمِ بعدی", CB.guide).primary()
  kb.text("🎲 اتفاقِ امروز", CB.event).success().row()
  // مقصدهای تب — هر تب سهمِ خودش را دارد
  if (tab === "fem") {
    kb.text("🎀 هابِ کاملِ فمبوی", "fw:hub").primary().row()
    kb.text("👤 من", CB.me)
    kb.text("🎒 کیف و بازار", CB.items).row()
  } else if (tab === "city") {
    kb.text("🗺 سفرِ بین محله‌ها", CB.city).primary()
    kb.text("👥 شهرِ گروه", CB.groupCity).row()
    kb.text("👤 من", CB.me)
    kb.text("🎒 کیف و بازار", CB.items).row()
  } else {
    kb.text("👤 من", CB.me)
    kb.text("⚡ فعالیت‌ها", CB.acts)
    kb.text("🎒 کیف و بازار", CB.items).row()
  }
  // بازارِ سطحِ هاب + راهنما (§5.4 برچسب‌های صریح)
  kb.text("🏪 بازار", CB.market)
  kb.text("📖 راهنما", CB.help)
  return withMiniApp(kb)
}

/** ⚡ فعالیت‌ها — V20 (مأموریت §3.2: یک مقصدِ «انجامِ کارِ مفید»): کار/استراحت/
 *  سفر/شغل در یک کارت با هزینه‌های روشن (متن از format.ts activitiesText).
 *  دکمه‌ی کار سبز است — کنشِ مطمئنِ روزمره؛ سفر آبی — ناوبری. */
export function activitiesKeyboard(player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  void player // شغل/انرژی در متنِ کارت است (format.ts) — دکمه‌ها ثابت‌اند
  kb.text("💼 شیفتِ کار", CB.work).success()
  kb.text("😴 استراحت", CB.rest).success().row()
  kb.text("🗺 سفرِ بین محله‌ها", CB.city).primary()
  kb.text("💼 شغل‌ها", CB.jobs).primary().row()
  kb.text("🏠 خانه", CB.menu)
  return kb
}

/** قدمِ بعدی — انتخاب تصادفی + ناوبریِ اهداف/فرصت/آرزو (فرصت‌ها و آرزوها
 *  V16-3 دکمه‌ی همین کارت‌اند — دیگر دکمه‌ی سطحِ خانه نیستند). */
export function guideKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎲 انتخاب تصادفی", CB.rand).primary().row()
  kb.text("🎯 اهداف", CB.goals)
  kb.text("⚡ فرصت‌ها", CB.ops).row()
  kb.text("✨ آرزوها", CB.dreams)
  return panelFooterRows(kb)
}

export function goalsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎯 قدمِ بعدی", CB.guide).primary()
  kb.text("⚡ فرصت‌ها", CB.ops)
  return panelFooterRows(kb)
}

export function dreamsKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🎯 قدمِ بعدی", CB.guide).primary()
  kb.text("🎯 اهداف", CB.goals)
  return panelFooterRows(kb)
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
  return panelFooterRows(kb)
}

/** دکمه‌های یک اتفاق — هر گزینه یک ردیف؛ قفل‌ها 🔒 بی‌رنگ، ریسک از hint.
 *  V20 (مأموریت §4.3 — حذفِ بن‌بست): ردیفِ «↩ خانه» همیشه پایینِ گزینه‌هاست —
 *  اتفاق دیگر گیرکرد‌کننده نیست؛ انتخاب یا بازگشت، هر دو مسیرِ زنده‌اند. */
export function eventKeyboard(e: ActiveEventDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  e.choices.forEach((c, i) => {
    const label = c.locked ? `${c.label} 🔒` : c.label
    const btn = kb.text(clampText(label, 44), cbChoice(e.id, i))
    const st = choiceStyle(c)
    if (st) btn.style(st)
    btn.row()
  })
  return panelFooterRows(kb)
}

/** بازگشتِ یک‌دکمه‌ای به خانه — برای کارت‌های بدونِ ناوبریِ خاص (V26: برچسبِ
 *  یکدستِ «🏠 خانه» — همان واژه‌نامه‌ی همه‌ی پنل‌ها) */
export function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🏠 خانه", CB.menu).primary()
}

/** کارتِ بومیِ باز کردنِ مینی‌اپ — لینکِ عمیقِ /start app از کارت‌های گروه این‌جا فرود می‌آید */
export function miniAppCardKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (MINIAPP_URL) kb.webApp("📱 Femboy War", MINIAPP_URL).primary().row()
  kb.text("🏠 خانه", CB.menu)
  return kb
}

/** پروفایل — V20: مقصدِ «من و پیشرفت» (مأموریت §6.2: هویت/وضعیت/پیشرفت یک‌جا).
 *  استراحت به «فعالیت‌ها» رفت (کنش است، نه مقصد)؛ «🔔 خبرها» آمد — پیش از این
 *  هیچ دکمه‌ای به کارتِ خبرها نمی‌رسید (ممیزی V20-گ: مسیرِ یتیم). بدهی فقط
 *  وقتی هست دکمه می‌گیرد. */
export function profileKeyboard(player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (player.debt > 0) {
    kb.text(`💳 پرداختِ بدهی (${faNum(player.debt)})`, CB.debt).danger().row()
  }
  kb.text("📜 تاریخچه", CB.history)
  kb.text("🏆 دستاوردها", CB.ach).row()
  kb.text("🏷 عنوان‌ها", CB.titles)
  kb.text("🏠 خانه و وسیله", CB.livingHome).row()
  kb.text("🔔 خبرها", CB.notify)
  kb.text("⚙ حساب", CB.settings).row()
  return panelFooterRows(kb)
}

/** 🏆 دستاوردها — کارتِ عمیقِ پروفایل (V16-4)؛ V26: بازگشتِ والدآگاه — «من» صاحبِ بخش است */
export function achievementsKeyboard(): InlineKeyboard {
  return panelKeyboard({ data: CB.me, label: "من" })
}

/** 📜 تاریخچه‌ی شخصی — V26: «من» صاحبِ بخش است (بازگشتِ والدآگاه) */
export function historyKeyboard(): InlineKeyboard {
  return panelKeyboard({ data: CB.me, label: "من" })
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
  // V20 — دو «شهر» یک مقصدند (ممیزی V20-ف): سفرِ محلی + شهرِ گروه از همین کارت
  kb.text("👥 شهرِ گروه", CB.groupCity).primary()
  return panelFooterRows(kb)
}

/** 🎒 کیف (V6) — V20: بازار پایشِ کیف است (مأموریت §3.2: «وسایل و بازار» یک
 *  مقصد) — دکمه‌ی «🏪 بازار» همیشه تهِ کیف است؛ سقفِ کل ~۱۲ دکمه
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
    // V26 — هر ردیفِ عملیات با ایموجیِ خودِ آیتم شروع می‌شود: دکمه‌ها از این
    // پس به آیتمِ خودشان گره می‌خورند (دیروز «استفاده»ی خالی برای چند آیتم
    // هم‌زمان رام‌های گمراه‌کننده داشت — §3.C برچسب‌هایی که کارِ خودشان را بگویند)
    const row: { label: string; data: string; style?: "primary" | "success" }[] = []
    if (it.usable) row.push({ label: `${it.emoji} استفاده`, data: cbItemUse(it.itemKey), style: "success" })
    if (it.category === "gear") row.push({ label: `${it.emoji} پوشیدن`, data: cbItemEquip(it.itemKey), style: "success" })
    // ⭐ خنثی — بدون استایل (برایِ علاقه‌مندی، «برداشتن» لازم است تا فروش باز شود)
    row.push({ label: it.favorite ? `${it.emoji} ♡ بردار` : `${it.emoji} ⭐`, data: cbItemFav(it.itemKey) })
    const price = p.prices.get(it.itemKey)
    if (it.tradable && !it.favorite && !it.locked && price) {
      row.push({ label: `💰 ${faNum(price)}`, data: cbItemSell(it.itemKey), style: "primary" })
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

  // V17-W3 (W3-F9) — کیفِ خالی دیگر بن‌بست نیست؛ V20: بازار هم کنارش است
  if (kb.inline_keyboard.length === 0 && pageCount <= 1) {
    return new InlineKeyboard()
      .text("🎲 اتفاقِ امروز", CB.event).primary().row()
      .text("🏪 بازار", CB.market).primary()
      .text("🏠 خانه", CB.menu).primary()
  }
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
  // V20 — «وسایل و بازار» یک مقصد: بازار همیشه پایشِ کیف است
  kb.text("🏪 بازار", CB.market).primary()
  return panelFooterRows(kb)
}

/** 💳 بدهی — پرداختِ پله‌ای + همه (سبز: کارِ مطمئنِ مالی) */
export function debtKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("💳 100", cbPayDebt(100)).success()
  kb.text("💳 500", cbPayDebt(500)).success()
  kb.text("💸 همه‌اش", cbPayDebt("all")).success().row()
  return panelFooterRows(kb)
}

/** 🏷 عنوان‌ها — فعال ✅ سبز؛ بقیه آبی */
export function titlesKeyboard(player: PlayerDTO): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const t of player.titles.slice(0, 8)) {
    const active = t.key === player.activeTitle
    kb.text(`${t.emoji} ${clampText(t.name, 20)}${active ? " ✅" : ""}`, cbTitle(t.key)).style(active ? "success" : "primary").row()
  }
  if (kb.inline_keyboard.length === 0) return backKeyboard()
  return panelFooterRows(kb)
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
  return panelFooterRows(kb)
}

/** 🏪 بازار — خریدِ مغازه‌ی محله و آگهی‌های مردم (سبز) · فروشِ خودت (V16-4) ·
 *  پس‌گرفتنِ آگهی‌های خودم (قرمز). V20 (مأموریت §5.4: برچسبِ صریح): «فهرست‌کردن»
 *  → «به فروش بگذار» (فعلِ روشن) · «برداشتن» → «پس‌گرفتنِ» (بدونِ ابهام با ⭐) ·
 *  «🎒 کیف» همیشه کنارِ خانه — بازار/کیف یک مقصدند (§3.2). سقفِ ~۱۲ دکمه. */
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
    kb.text(`✂️ پس‌گرفتنِ ${clampText(l.name, 12)} · ${faNum(l.price)}`, cbMarketCancel(l.listingId)).danger().row()
    budget--
  }
  // V16-4 — مسیرِ فروش (انتخابِ جنس ← قیمت ← آگهی)؛ همیشه هست — حتی وقتی
  // قفسه‌ها خالی‌اند، فروشِ خودت شروعِ بازار است
  kb.text("🛍 به فروش بگذار", CB.marketSell).success().row()
  kb.text("🎒 کیف", CB.items).primary()
  return panelFooterRows(kb)
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
    return new InlineKeyboard().text("🏪 بازار", CB.market).primary().row().text("🏠 خانه", CB.menu).primary()
  }
  kb.text("🏪 بازار", CB.market).primary()
  return panelFooterRows(kb)
}

/** 🏷 گامِ ۲ — کارتِ قیمت: هر دکمه = یک قیمتِ پیشنهادی (تأییدِ تک‌ضربی،
 *  افشایِ کاملِ هزینه‌ها قبل از لمس — الگوی بینگوی ۱۰۰) + بازگشت‌ها (V16-4) */
export function marketPriceKeyboard(itemKey: string, suggestions: number[]): InlineKeyboard {
  const kb = new InlineKeyboard()
  for (const p of suggestions) {
    kb.text(`🏷 ${faNum(p)} سکه`, cbMarketListAt(itemKey, p)).success().row()
  }
  kb.text("🛍 جنسِ دیگر", CB.marketSell).primary()
  kb.text("🎒 کیف", CB.items).primary().row()
  return panelFooterRows(kb, { data: CB.market, label: "بازار" })
}

/** 🔔 خبرها — «خواندم» (سبز) + خانه */
export function notifyKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("✅ همه را خواندم", "nt:read").success()
  return panelFooterRows(kb)
}

// ─── 🏠 خانه و وسیله (V17-3 — ممیزی ⑨) ──────────────────────────────────────

/** لیستِ خرید — دکمه‌ی هر آیتم قیمتِ واقعی را روی خودش دارد (سبز = خرید؛
 *  زبانِ رنگ‌ها). سقفِ ≤ ۸ دکمه: آیتم‌ها + سوییچِ خانه/وسیله + بازگشت‌ها.
 *  موتورِ قدیمی که خانه/وسیله نمی‌فرستد → فقط سوییچ/بازگشت (کارتِ صادقِ خالی). */
export function livingKeyboard(opts: {
  which: LivingWhich
  houses: { key: string; name: string; emoji: string; price: number }[]
  vehicles: { key: string; name: string; emoji: string; price: number }[]
}): InlineKeyboard {
  const { which } = opts
  const items = which === "house" ? opts.houses : opts.vehicles
  const kb = new InlineKeyboard()
  let budget = 8
  for (const it of items.slice(0, 5)) {
    if (budget <= 0) break
    kb.text(`${it.emoji} ${clampText(it.name, 16)} · ${faNum(it.price)}`, cbLivingBuy(which, it.key)).success().row()
    budget--
  }
  // سوییچِ دو لیستِ همین کارت + بازگشتِ والدآگاه («من» صاحبِ بخش) و خانه
  kb.text(which === "house" ? "🚗 وسایل نقلیه ▶" : "◀ 🏠 خانه‌ها", which === "house" ? CB.livingVeh : CB.livingHome).primary().row()
  return panelFooterRows(kb, { data: CB.me, label: "من" })
}

/** کارتِ تأیید — «🤝 می‌خرم» فقط این‌جا (lv:go)، مثلِ «💥 بفرست» بینگو؛
 *  جیبِ نوخوانده که نکشد → دکمه نمی‌آید (هندلر تصمیم می‌گیرد، کیبورد صادق می‌ماند) */
export function livingConfirmKeyboard(which: LivingWhich, key: string, affordable: boolean): InlineKeyboard {
  const kb = new InlineKeyboard()
  if (affordable) {
    kb.text("🤝 می‌خرم", cbLivingGo(which, key)).success().row()
  }
  kb.text(which === "house" ? "◀ 🏠 خانه‌ها" : "◀ 🚗 وسایل", which === "house" ? CB.livingHome : CB.livingVeh).primary().row()
  return panelFooterRows(kb, { data: CB.me, label: "من" })
}

/** 🎲 بینگو — فقط شرط‌هایی که جیب واقعاً می‌کشد (V16-3، ممیزی ⑩: شرطِ گران
 *  دو‌مرحله‌ای؛ دکمه‌ی ۵۰۰۰ به تأیید می‌رود — b:go فقط از کارتِ تأیید).
 *  V20 (مأموریت §4.3): حالتِ خالی «💼 کار» را پیشنهاد می‌دهد — همان چیزی که
 *  متنِ کارت می‌گوید («کار کن، بعد بیا») حالا دکمه‌اش هم هست. */
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
    // جیب هیچ‌کدام را نمی‌کشد — مسیرِ پولِ صادقانه همان است که متن می‌گوید
    kb.text("💼 کار", CB.work).success()
    return panelFooterRows(kb)
  }
  return panelFooterRows(kb)
}

/** کارتِ تأییدِ شرطِ بزرگ — «💥 بفرست» فقط این‌جا است (b:go:{stake}) */
export function bingoConfirmKeyboard(stake: number): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("💥 بفرست", cbGambleGo(stake)).danger().row()
  kb.text("↩ بینگو", CB.bingo).primary()
  kb.text("🏠 خانه", CB.menu).primary()
  return kb
}

/** خطا — دوباره (قرمز) + خانه (آبی) — V26: برچسبِ بازگشتِ یکدستِ «🏠 خانه» */
export function errorKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard()
  kb.text("🔄 دوباره", CB.retry).danger()
  kb.text("🏠 خانه", CB.menu).primary()
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
