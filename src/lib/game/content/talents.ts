// FEMBOY WAR — V19: استعدادها و ضعف‌ها (talents & flaws)
//
// قاعده‌ی طلایی (مأموریت §6/§16): «اگر استعدادی برای فعالیتی «مفید» نشان داده
// می‌شود، آن فعالیت واقعاً باید استعداد را اعمال کند.» هر دامنه‌ی این جدول
// دقیقاً به یک نقطه‌ی واقعیِ موتور سیم‌کشی شده است (ماتریسِ پایین).
//
// ماتریسِ دامنه → قلابِ موتور (سیمِ واقعی، تک‌منبع):
//   work        → actions.ts «work» — payoutPct (درصدِ دستمزدِ شیفت)
//   market      → actions.ts femboyBargainPct — درصدِ چانه‌زنیِ فروش
//   spirit      → character.ts interactWithCharacter — درصدِ جلای تعامل
//   rest        → actions.ts «rest» — درصدِ جلای خوابِ توأمان
//   combatMoney → combat.ts پاداشِ نبردِ حل‌شده — درصدِ جایزه
//   drop        → combat.ts رولِ افتِ آیتم — نقطه‌ی درصدی روی شانسِ پایه
//   xp          → character.ts awardXpTx — درصدِ همه‌ی XPِ فمبوی
//   duel        → combat.ts duelCharacters — درصدِ جایزه‌ی دوئل
//   recharge    → character.ts rechargeStamina — درصدِ هزینه‌ی هر واحد (منفی=تخفیف)
//   group       → group/awards.ts — درصدِ XPِ شهرِ گروه (پیش از سقفِ روزانه)
//
// تعادل (§11): هر لایه (استعداد/ضعف/مهارت/تسلط) با محتوایش سقف‌دار است؛
// جمعِ استعداد+ضعف در affinityOf به [−12,+12] کلمپ می‌شود تا رانشِ آینده
// محتوا هم نتواند از تعادل خارج شود. ضعف‌ها کوچک‌اند (−5 تا −7) و همیشه
// روی کارت دیده می‌شوند — جریمه‌ی پنهان ممنوع.

export type TalentDomain =
  | "work"
  | "market"
  | "spirit"
  | "rest"
  | "combatMoney"
  | "drop"
  | "xp"
  | "duel"
  | "recharge"
  | "group"

export const DOMAIN_LABELS: Record<TalentDomain, { label: string; icon: string }> = {
  work: { label: "دستمزدِ شیفت", icon: "💼" },
  market: { label: "چانه‌زنیِ بازار", icon: "🤝" },
  spirit: { label: "جلای تعامل", icon: "💗" },
  rest: { label: "خوابِ توأمان", icon: "🛏️" },
  combatMoney: { label: "جایزه‌ی نبرد", icon: "⚔️" },
  drop: { label: "شانسِ غنیمتِ میدان", icon: "🎁" },
  xp: { label: "XPِ فمبوی", icon: "⭐" },
  duel: { label: "جایزه‌ی دوئل", icon: "🥊" },
  recharge: { label: "هزینه‌ی شارژِ استقامت", icon: "🔌" },
  group: { label: "XPِ شهرِ گروه", icon: "🌍" },
}

export interface TalentDef {
  key: string
  emoji: string
  name: string
  /** توضیحِ صادقانه — دقیقاً همان کاری که موتور می‌کند */
  desc: string
  domain: TalentDomain
  /** درصدِ امضا (مثبت). برای drop یعنی نقطه‌ی درصدی. */
  pct: number
}

export interface FlawDef {
  key: string
  emoji: string
  name: string
  desc: string
  domain: TalentDomain
  /** درصدِ منفی (کوچک و منصفانه) */
  pct: number
}

export const TALENTS: TalentDef[] = [
  {
    key: "night_owl",
    emoji: "🦉",
    name: "جغدِ شب",
    desc: "شیفت‌های آخرِ شبِ او خوش‌برکت‌اند: 10% دستمزدِ بیشتر.",
    domain: "work",
    pct: 10,
  },
  {
    key: "silver_tongue",
    emoji: "🗣️",
    name: "زبانِ نقره‌ای",
    desc: "با دلال‌ها خوب گیر می‌دهد: 8% چانه‌زنیِ بهتر در فروش.",
    domain: "market",
    pct: 8,
  },
  {
    key: "morning_breeze",
    emoji: "🌬️",
    name: "نسیمِ سپیده",
    desc: "کنارش بودن روح‌بخش است: 10% جلای بیشتر در تعامل‌ها.",
    domain: "spirit",
    pct: 10,
  },
  {
    key: "deep_sleeper",
    emoji: "💤",
    name: "خوابِ سنگین",
    desc: "کنارِ تو عمیق می‌خوابد: 10% جلای بیشتر در خوابِ توأمان.",
    domain: "rest",
    pct: 10,
  },
  {
    key: "iron_will",
    emoji: "🛡️",
    name: "اراده‌ی آهنین",
    desc: "میدان را ول نمی‌کند: 8% جایزه‌ی نبردِ بیشتر.",
    domain: "combatMoney",
    pct: 8,
  },
  {
    key: "sharp_eye",
    emoji: "👁️",
    name: "چشمِ تیز",
    desc: "غنیمت را از دور می‌بیند: 6+ شانسِ افتِ آیتم (نقطه‌ی درصدی).",
    domain: "drop",
    pct: 6,
  },
  {
    key: "quick_study",
    emoji: "📚",
    name: "آموزش‌پذیر",
    desc: "از هر اتفاق زودتر یاد می‌گیرد: 6% XPِ بیشتر در همه‌ی مسیرها.",
    domain: "xp",
    pct: 6,
  },
  {
    key: "duelist_heart",
    emoji: "⚔️",
    name: "قلبِ دوئل‌باز",
    desc: "در دوئل می‌درخشد: 8% جایزه‌ی دوئلِ بیشتر.",
    domain: "duel",
    pct: 8,
  },
  {
    key: "thrifty",
    emoji: "🪙",
    name: "صرفه‌جو",
    desc: "خرجِ هوایش را می‌داند: 10% ارزان‌تر شارژِ استقامت.",
    domain: "recharge",
    pct: -10,
  },
  {
    key: "crowd_charmer",
    emoji: "🎪",
    name: "عشقه‌ی جمع",
    desc: "شهرِ گروه او را دوست دارد: 10% XPِ بیشتر از بازی‌های گروه.",
    domain: "group",
    pct: 10,
  },
]

export const FLAWS: FlawDef[] = [
  {
    key: "sleepy_head",
    emoji: "😴",
    name: "خواب‌الود",
    desc: "صبح‌هایش سنگین است: 7% دستمزدِ کمتر.",
    domain: "work",
    pct: -7,
  },
  {
    key: "big_spender",
    emoji: "💸",
    name: "دستِ باز",
    desc: "هوسِ خرج دارد: 5% چانه‌زنیِ ضعیف‌تر در فروش.",
    domain: "market",
    pct: -5,
  },
  {
    key: "restless",
    emoji: "🌀",
    name: "بی‌قرار",
    desc: "خوابِ سبک: 7% جلای کمتر در خوابِ توأمان.",
    domain: "rest",
    pct: -7,
  },
  {
    key: "stage_fright",
    emoji: "🙈",
    name: "ترسِ صحنه",
    desc: "جمع برایش سنگین است: 6% XPِ کمتر از بازی‌های گروه.",
    domain: "group",
    pct: -6,
  },
  {
    key: "slow_learner",
    emoji: "🐌",
    name: "آهسته‌آموز",
    desc: "با وقتم یاد می‌گیرد: 5% XPِ کمتر در همه‌ی مسیرها.",
    domain: "xp",
    pct: -5,
  },
  {
    key: "soft_heart",
    emoji: "💗",
    name: "دلِ نرم",
    desc: "از جنگ خسته می‌شود: 5% جایزه‌ی نبردِ کمتر.",
    domain: "combatMoney",
    pct: -5,
  },
  {
    key: "butterfingers",
    emoji: "🧦",
    name: "دست‌وپاچلفتی",
    desc: "غنیمت جا می‌ماند: 5− شانسِ افتِ آیتم (نقطه‌ی درصدی).",
    domain: "drop",
    pct: -5,
  },
  {
    key: "show_off",
    emoji: "🎩",
    name: "خودنما",
    desc: "در دوئل بیش از حد نمایش می‌دهد: 6% جایزه‌ی کمتر.",
    domain: "duel",
    pct: -6,
  },
]

export const TALENT_MAP: Map<string, TalentDef> = new Map(TALENTS.map((t) => [t.key, t]))
export const FLAW_MAP: Map<string, FlawDef> = new Map(FLAWS.map((f) => [f.key, f]))

export function getTalent(key: string): TalentDef | null {
  return TALENT_MAP.get(key) ?? null
}

export function getFlaw(key: string): FlawDef | null {
  return FLAW_MAP.get(key) ?? null
}

// ─── اعتبارسنجیِ بارگذاری — ارجاع‌های personas.ts باید همین‌جا موجود باشند ───────

function validateTalents(): void {
  const talentDomains = new Set<string>()
  for (const t of TALENTS) {
    if (!t.key || !t.name || !t.desc || !t.domain) throw new Error(`استعدادِ ناقص: ${t.key}`)
    if (!DOMAIN_LABELS[t.domain]) throw new Error(`استعدادِ ${t.key}: دامنه‌ی ناشناخته`)
    if (talentDomains.has(t.domain)) throw new Error(`استعدادِ تکراری در دامنه‌ی ${t.domain}`)
    talentDomains.add(t.domain)
    // recharge استعدادِ منفیِ مشروع دارد (صرفه‌جو = تخفیف)؛ بقیه‌ی دامنه‌ها مثبت‌اند
    if (t.domain === "recharge" ? t.pct >= 0 : t.pct <= 0) throw new Error(`استعدادِ ${t.key}: pct باید ${t.domain === "recharge" ? "منفی" : "مثبت"} باشد`)
  }
  const flawDomains = new Set<string>()
  for (const f of FLAWS) {
    if (!f.key || !f.name || !f.desc || !f.domain) throw new Error(`ضعفِ ناقص: ${f.key}`)
    if (!DOMAIN_LABELS[f.domain]) throw new Error(`ضعفِ ${f.key}: دامنه‌ی ناشناخته`)
    if (flawDomains.has(f.domain)) throw new Error(`ضعفِ تکراری در دامنه‌ی ${f.domain}`)
    flawDomains.add(f.domain)
    if (f.pct >= 0) throw new Error(`ضعفِ ${f.key}: pct باید منفی باشد`)
  }
  // ترتیبِ import: personas.ts این ماژول را می‌خواهد؛ برای جلوگیری از دور،
  // ارجاع‌های personas را با require-وار ایمپورت نمی‌کنیم — validation در
  // character.ts (resolvePersonaChain) انجام می‌شود که هر دو را دارد.
}

validateTalents()
