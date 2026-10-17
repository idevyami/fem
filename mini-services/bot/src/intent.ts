// FEMBOY WAR 🎀 — V13 (Part IV §7-10): تعاملِ بدونِ اسلش — لایه‌ی نیتِ زبانِ طبیعی.
// فارسی و انگلیسی، بدونِ پیشوندِ «/»، در خصوصی و گروه — قواعدِ قطعی، بدونِ LLM.
//
//   • نرمال‌سازیِ قطعی: ي→ی · ك→ک (حروفِ عربی→فارسی)، حذفِ اِعراب، ارقامِ
//     فارسی/عربی→لاتین، حذفِ نیم‌فاصله، حذفِ ایموجی/نشانه‌ها، جمعِ فاصله‌ها،
//     کوچک‌سازیِ انگلیسی — هر دو سمت (ورودی و واژه‌نامه) یک قاعده.
//   • تطبیقِ عینِ عبارتِ نرمال‌شده — هیچ حدسِ فازی: جمله‌ی گفتگو هرگز فرمان
//     نمی‌شود (§16: گروه بدونِ آدرس‌دهی هijack نمی‌شود).
//   • عبارت‌های «باز» (open) در گروه بدونِ آدرس‌دهی هم جواب می‌گیرند؛
//     عبارت‌های «شخصی» فقط در خصوصی یا با آدرس‌دهی (و آن‌گاه → دعوت به خصوصی).
//   • این ماژول خالص است: منطقِ بازی هیچ‌جا این‌جا ساخته نمی‌شود — نیت فقط
//     به همان هندلرهایی می‌رسد که فرمانِ متناظرشان می‌رسد.

/** شناسه‌ی نیت‌ها — آینه‌ی فرمان‌های موجود؛ چیزی تازه اضافه نمی‌شود
 *  (V15-2: duels/economy/fame آینه‌ی سه فرمانِ تازه‌ی هابِ شهرِ V15-1 موتورند) */
export type IntentId =
  | "menu"
  | "start"
  | "help"
  | "guide"
  | "femboy"
  | "myfemboy"
  | "profile"
  | "city"
  | "status"
  | "events"
  | "players"
  | "leaderboard"
  | "inventory"
  | "work"
  | "rest"
  | "champ"
  | "news"
  | "games"
  | "cancel"
  | "back"
  | "duel"
  | "goals"
  | "ops"
  | "dreams"
  | "market"
  | "jobs"
  | "debt"
  | "titles"
  | "notify"
  | "bingo"
  | "vote"
  | "court"
  | "projects"
  | "history"
  | "gadmin"
  // V15-2 — فرمان‌های تازه‌ی هابِ شهر (duels/economy/fame در موتور)
  | "duels"
  | "economy"
  | "fame"
  // V16-4 — دستاوردهای شخصی (کارتِ عمیقِ پروفایل؛ ممیزی ⑰). در گروه همان
  // fameِ شهرِ دیروز است (routeGroupIntent) — عبارتِ «دستاوردها» از fameِ خصوصی
  // به این‌جا آمد: در پیوی کارتِ شخصی صادقانه‌تر است از تالار.
  | "achievements"

/** نتیجه‌ی تطبیق — open یعنی در گروهِ بی‌آدرس هم مجاز است */
export interface IntentHit {
  id: IntentId
  open: boolean
}

// ─── نرمال‌سازی (§9) ──────────────────────────────────────────────────────────

const ARABIC_YE = "\u064A" // ي
const PERSIAN_YE = "\u06CC" // ی
const ARABIC_KAF = "\u0643" // ك
const PERSIAN_KAF = "\u06A9" // ک
const ZWNJ = "\u200C" // نیم‌فاصله
const TASHKEEL = /[\u064B-\u065F\u0670]/g // اِعراب
/** ارقامِ فارسی و عربی → لاتین */
const DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
}

/** عبارت را به شکلِ مقایسه‌پذیر می‌آورد — حروف/ارقام/فاصله می‌مانند، بقیه فاصله */
export function normalizePhrase(raw: string): string {
  let t = raw.trim()
  t = t.split(ARABIC_YE).join(PERSIAN_YE)
  t = t.split(ARABIC_KAF).join(PERSIAN_KAF)
  t = t.replace(TASHKEEL, "")
  t = t.split(ZWNJ).join("")
  for (const [fa, en] of Object.entries(DIGITS)) t = t.split(fa).join(en)
  t = t.toLowerCase()
  // هر چیزی که حرف (فارسی/انگلیسی)، رقم یا فاصله نیست → فاصله (ایموجی/نشانه/منشن‌نشانه)
  t = t.replace(/[^0-9a-z\u0600-\u06FF\s]/g, " ")
  return t.replace(/\s+/g, " ").trim()
}

// ─── واژه‌نامه‌ی نیت‌ها (فارسی + انگلیسی؛ رجیستری در زمانِ ساخت نرمال می‌شود) ──

/** هر عبارت: [متن, open?] — open = در گروهِ بی‌آدرس هم مجاز */
const PHRASES: Partial<Record<IntentId, [string, boolean?][]>> = {
  menu: [
    ["منو", true], ["پیشخوان", true], ["menu", true],
  ],
  start: [
    ["شروع بازی", true], ["شروع", true],
    ["start", true], ["start game", true],
  ],
  duel: [
    // §2 مثالِ مأموریت: «جنگ فمبوی» = دوئل (نه شروعِ کلِ بازی)
    ["جنگ فمبوی", true], ["دوئل", true], ["دعوت به دوئل", true],
    ["duel", true], ["femboy battle", true],
  ],
  // V15-2 — سه فرمانِ تازه‌ی هابِ شهر: «دوئل‌ها» (کارتِ دعوت‌های دوئل)،
  // «اقتصاد» (صندوق/شاخص/آگهی‌ها)، «افتخارات» (تالار + دستاوردهای شهر).
  // «تالار»/«تالار افتخارات» عمداً روی champ می‌مانند — انتخابِ آگاهانه.
  duels: [
    ["دوئل‌ها", true], ["دوئلهای گروه", true], ["نبردها", true],
    ["نبردها و رقابت‌ها", true], ["duels", true],
  ],
  economy: [
    ["اقتصاد", true], ["اقتصاد شهر", true], ["صندوق شهر", true], ["economy", true],
  ],
  fame: [
    // V16-4 — «دستاوردها» به نیتِ شخصیِ achievements رفت (پیوی = کارتِ خودِ
    // بازیکن)؛ «افتخارات»/«مأموریت‌ها و دستاوردها» عمداً همین‌جا می‌مانند —
    // انتخابِ آگاهانه (تالار در پیوی = champ؛ در گروه = کارتِ fame موتور).
    ["افتخارات", true], ["مأموریت‌ها و دستاوردها", true],
    ["ماموریتها و دستاوردها", true], ["fame", true], ["hall", true],
  ],
  achievements: [
    ["دستاوردها", true], ["دستاوردهای من"], ["افتخارات من"],
    ["achievements"], ["my achievements"],
  ],
  help: [
    ["راهنما", true], ["کمک", true], ["help", true],
  ],
  guide: [
    // V16-3 — «قدمِ بعدی» برچسبِ قاعده‌مندِ واژه‌نامه است (TERM.nextStep)؛
    // «راهنمای من» نامِ قدیمی است و به‌عنوانِ عبارتِ کار می‌کند (مهاجرتِ زنده)
    ["قدمِ بعدی"], ["راهنمای من"], ["حالا چیکار کنم"], ["الان چیکار کنم"], ["guide"],
  ],
  femboy: [
    ["فمبوی", true], ["پیمان", true], ["پیمان فمبوی", true], ["femboy", true], ["pact", true],
  ],
  myfemboy: [
    ["فمبوی من", true], ["کارت فمبوی من", true], ["my femboy", true],
  ],
  profile: [
    ["من"], ["پروفایل"], ["شخصیت من"], ["پروفایل من"], ["me"], ["profile"], ["my character"],
  ],
  city: [
    ["شهر"], ["شهر من"], ["city"],
  ],
  status: [
    ["وضعیت شهر", true], ["وضعیت بازی", true], ["وضعیت"], ["status", true], ["city status", true], ["game status", true],
  ],
  events: [
    ["رویدادها", true], ["رویداد", true], ["اتفاق", true], ["اتفاق امروز", true], ["events", true], ["event", true],
  ],
  players: [
    ["بازیکنها", true], ["بازیکنهای گروه", true], ["اعضا", true], ["اعضای گروه", true], ["players", true], ["members", true],
  ],
  leaderboard: [
    ["رتبهبندی", true], ["برترینها", true], ["برترینهای شهر", true], ["leaderboard", true], ["top", true],
  ],
  inventory: [
    ["کیف"], ["کیف من"], ["کوله"], ["inventory"], ["bag"], ["my inventory"],
  ],
  work: [
    ["کار"], ["شیفت"], ["work"],
  ],
  rest: [
    ["استراحت"], ["rest"], ["sleep"],
  ],
  champ: [
    ["تالار", true], ["تالار افتخارات", true], ["champ", true], ["hall of fame", true],
  ],
  news: [
    ["اخبار", true], ["خبرنامه", true], ["news", true],
  ],
  games: [
    ["بازیهای گروه", true], ["بازی گروهی", true], ["بازیها", true], ["group games", true], ["games", true],
  ],
  cancel: [
    ["لغو"], ["انصراف"], ["کنسل"], ["cancel"],
  ],
  back: [
    ["بازگشت", true], ["برگشت", true], ["عقب", true], ["back", true],
  ],
  goals: [
    ["اهداف"], ["goals"],
  ],
  ops: [
    ["فرصت‌ها"], ["ops"],
  ],
  dreams: [
    ["آرزوها"], ["dreams"],
  ],
  market: [
    // شخصی: در گروه فقط با آدرس‌دهی (تا با محله‌ی «بازار» شهر اشتباه نشود)
    ["بازار"], ["مغازه"], ["market"],
  ],
  jobs: [
    ["شغل‌ها"], ["jobs"],
  ],
  debt: [
    ["بدهی"], ["بدهی من"], ["debt"],
  ],
  titles: [
    ["عنوان‌ها"], ["titles"],
  ],
  notify: [
    ["اعلان‌ها"], ["notify"],
  ],
  bingo: [
    ["بینگو"], ["bingo"],
  ],
  vote: [
    ["رأی‌گیری", true], ["رای‌گیری", true], ["vote", true],
  ],
  court: [
    ["دادگاه", true], ["court", true],
  ],
  projects: [
    ["پروژه‌ها", true], ["projects", true],
  ],
  history: [
    ["تاریخچه", true], ["تاریخچه شهر", true], ["history", true],
  ],
  gadmin: [
    // ادمین‌گیتِ زنده در هندلر خودش هست؛ عبارت آزاد است
    ["تنظیمات شهر", true], ["تنظیمات بازی", true],
  ],
}

/** رجیستریِ نهایی — کلید = عبارتِ نرمال‌شده (خودِ عبارت‌ها هم نرمال می‌شوند) */
const LOOKUP = new Map<string, IntentHit>()
for (const [id, entries] of Object.entries(PHRASES) as [IntentId, [string, boolean?][]][]) {
  for (const [phrase, open] of entries) {
    const key = normalizePhrase(phrase)
    if (key) LOOKUP.set(key, { id, open: open === true })
  }
}

/** عبارتِ خام → نیت · null = نیتِ شناخته‌شده‌ای نبود (سکوت/راهنمای کوتاه) */
export function resolveIntent(raw: string): IntentHit | null {
  const key = normalizePhrase(raw)
  if (!key) return null
  return LOOKUP.get(key) ?? null
}

// ─── صدای راهنمایِ کوتاه (§9: ورودیِ مبهم → انتخاب‌های کوتاه، نه حدس) ─────────

/** پاسخِ یک‌خطی وقتی در گروه به ربات آدرس داده شده ولی نیت شناخته نشد — PLAIN.
 *  V16-3 (ممیزی ⑭): همان ۶ عبارتِ هسته‌ای + اشاره‌گرِ «عبارت‌های جادویی» —
 *  دسته‌ی «زبانِ طبیعی» کدکس (id: phrases) همه‌ی عبارت‌ها را دارد. */
export const INTENT_HINT =
  "هنوز متنِ آزاد نمی‌فهمم 🙂 این‌ها را بنویس: «منو» · «راهنما» · «وضعیت شهر» · «رویدادها» · «بازیکن‌ها» · «بازی‌های گروه» — بقیه‌ی عبارت‌های جادویی: دسته‌ی «زبانِ طبیعی» در راهنما."

// ─── V16-3 — راهنمایِ بافتاریِ کارت‌ها (مأموریت §13/§6: کمکیِ کوتاه، نزدیکِ کنش) ──

/** بافتِ کارت‌هایِ اصلیِ خصوصی — هر کارت خطِ خودش را دارد */
export type HintContext =
  | "home"
  | "guide"
  | "bag"
  | "city"
  | "market"
  | "profile"
  | "bingo"
  | "femboy"

/** تا ۶ عبارتِ مرتبط برای هر کارت — همه باید از resolveIntent رد شوند
 *  (تضمینِ ایستا در verify:bot §16)؛ عبارتِ ناموجود هرگز تبلیغ نمی‌شود. */
export const CARD_HINTS: Readonly<Record<HintContext, readonly string[]>> = {
  home: ["فمبوی من", "اتفاق امروز", "قدمِ بعدی", "کار", "استراحت", "راهنما"],
  guide: ["فرصت‌ها", "آرزوها", "اهداف", "اتفاق امروز", "کار"],
  bag: ["بازار", "کار", "استراحت", "بدهی"],
  city: ["اخبار", "وضعیت", "استراحت", "کار"],
  market: ["کیف", "کار", "بدهی", "بینگو"],
  profile: ["استراحت", "کار", "تاریخچه", "عنوان‌ها"],
  bingo: ["کار", "بازار", "بدهی"],
  femboy: ["فمبوی من", "جنگ فمبوی", "تالار", "پیمان فمبوی"],
}

/** خطِ یک‌سطریِ انتهای کارت — HTML (کارت‌ها HTML‌اند)؛ بافتِ ناشناخته = "" */
export function cardHint(context: HintContext): string {
  const phrases = CARD_HINTS[context] ?? []
  if (phrases.length === 0) return ""
  return `💬 <i>بنویس: ${phrases.map((p) => `«${p}»`).join(" · ")}</i>`
}
