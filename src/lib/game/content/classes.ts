// FEMBOY WAR — V8: کلاس‌های همیشگیِ فمبویِ روح‌بسته (SOULBOUND CLASSES — کدنامِ V7: کلاس‌هایِ همدم)
// هشت کلاس، هر کدام یک راهِ متفاوت برای نزدیک‌شدن به نبرد، منابع و پیشرفت.
// داده‌محور: افزودنِ کلاسِ جدید بدون بازنویسیِ موتورِ نبرد؛ در بارگذاری
// محتوا اعتبارسنجی می‌شود (validateClasses).

// ─── مدلِ آمارِ رزمی ──────────────────────────────────────────────────────────
export interface CombatStats {
  atk: number // قدرتِ حمله‌ی پایه
  def: number // کاهشِ آسیب (نیم‌سهمِ تخت)
  crit: number // % شانسِ بحرانی (سقف 60)
  critDmg: number // % ضریبِ بحرانی (پایه 150)
  dodge: number // % گریز (سقف 40)
  acc: number // % دقت — در برابرِ گریزِ حریف
  speed: number // ابتکار عمل / تمپو
  luck: number // تریگرهای ویژه
  loot: number // % پاداشِ اضافه
}

// ─── اثرِ مهارت (فقط مکانیک‌های ثبت‌شده؛ config کد اجرا نمی‌کند) ─────────────
export type SkillEffect =
  | { kind: "stat"; stat: keyof CombatStats; perRank: number }
  | { kind: "passive"; param: PassiveParam; perRank: number }
  | { kind: "active" } // مهارتِ فعالِ امضای کلاس (کلیدش از کلاس می‌آید)
  // V10 — هویتِ کلاس فراتر از نبرد:
  | { kind: "economy"; param: "payout" | "bargain"; perRank: number } // شیفت: % حقوقِ بیشتر · بازار: % فروشِ گران‌تر
  | { kind: "life"; param: "spiritGain" | "restGain"; perRank: number } // تعامل: % روحیه‌ی بیشتر · استراحت: % جلای بیشتر

// پارامترهایی که مهارت‌ها می‌توانند در passive امضا تنظیم کنند
export type PassiveParam =
  | "shadowMarkDmg" // % آسیبِ هر نشانِ سایه (شینوبی)
  | "focusDmg" // % آسیبِ هر تمرکز (رنجر)
  | "burstChance" // % شانسِ انفجار کهکشانی (جادوگر)
  | "burstBonus" // % جایزه‌ی سکه‌ی انفجار (جادوگر)
  | "deceptionChance" // % شانسِ فریبِ سلطنتی (شیاد)
  | "resolveMitg" // % کاهشِ آسیبِ عهدِ تایتان (پالادین)
  | "tempoDmg" // % آسیبِ هر تمپو (دوئل‌کار)
  | "wolfPower" // % قدرتِ گرگِ روح (احضارکننده)
  | "crimsonDmg" // % آسیبِ مومنتومِ سرخ (دروگر)
  | "crimsonCost" // % خونِ پرداختیِ هر ضربه (دروگر)

export interface ClassSkill {
  id: string
  name: string
  icon: string
  desc: string
  type: "passive" | "active"
  unlockLevel: number
  maxRank: number
  spCost: number // هزینه‌ی نقطه‌مهارت به‌ازای هر رتبه
  effect: SkillEffect
  branch: "core" | "life" | "art" // V10 — درخت: هسته‌ی رزمی · مسیرِ زندگی · قله‌ی هنر
  requires?: string // V10 — پیش‌نیاز: skillId که باید رتبه‌ی ≥1 داشته باشد
  evolutionReq?: number // V10 — فقط بعد از این مرحله‌ی فرگشت باز می‌شود (1..3)
}

export interface Evolution {
  name: string // نامِ فُرم
  emoji: string
  reqLevel: number
  reqWins: number
  statMult: number // ضریبِ آمارِ پایه
  lore: string
  pathLabel?: string // V10 — نامِ شاخه (برای نمایشِ انتخاب)
  statBonus?: Partial<CombatStats> // V10 — سوگیریِ شاخه (بعد از رشد اعمال می‌شود)
  passiveBonus?: Partial<Record<PassiveParam, number>> // V10 — تقویتِ امضای کلاس
  art?: string // V8 §24 — پرتره‌ی اختصاصیِ این فُرم (مرحله‌ی ۲/۳؛ مرحله‌ی ۱ = آرتِ کلاس)
}

export interface ClassPassive {
  name: string
  icon: string
  desc: string
  // پارامترهای پایه‌ی امضا (پیش از مهارت‌ها)
  base: Partial<Record<PassiveParam, number>>
}

export interface ClassDef {
  key: string
  emoji: string
  name: string // نامِ فارسی
  roleName: string // نقشِ رزمی
  fantasy: string
  difficulty: 1 | 2 | 3 // 1=آسان … 3=سخت
  strengths: string[]
  weaknesses: string[]
  playStyle: string
  base: CombatStats
  growth: CombatStats // به‌ازای هر سطح
  hpBase: number // HP = hpBase + hpPerLvl*(lvl-1) + def*2
  hpPerLvl: number
  xpBias: { primary: XpTrack; secondary: XpTrack }
  passive: ClassPassive
  activeSkill: {
    id: string
    name: string
    icon: string
    desc: string
    cooldown: number // راند
    power: number // % ضریبِ ATK
    selfCost?: number // % خونِ فعلی (دروگر/جادوگر)
  }
  skills: ClassSkill[] // 7 مهارتِ قابل‌ارتقا در سه شاخه (+1 فعالِ امضا جدا)
  evolutions: [Evolution, Evolution, Evolution] // شاخه‌ی الف — مسیرِ موروثی (سازگار با داده‌ی قدیمی)
  evolutionAlt: [Evolution, Evolution, Evolution] // V10 — شاخه‌ی ب: انتخابِ دوم در هر مرحله
  lore: { intro: string; deep: string[] }
  art: string // مسیرِ ثابتِ پرتره (asset id پایدار)
  palette: { primary: string; soft: string } // شیشه‌ی رنگی در UI
}

// ─── مسیرهای XP ──────────────────────────────────────────────────────────────
export type XpTrack = "battle" | "arcane" | "agility" | "fortune" | "guard" | "trickery" | "spirit"

export const XP_TRACK_META: Record<XpTrack, { label: string; icon: string }> = {
  battle: { label: "نبرد", icon: "⚔️" },
  arcane: { label: "اسرار", icon: "🔮" },
  agility: { label: "چابکی", icon: "⚡" },
  fortune: { label: "شانس", icon: "🍀" },
  guard: { label: "ایستادگی", icon: "🛡️" },
  trickery: { label: "نیرنگ", icon: "🎭" },
  spirit: { label: "هم‌نفَس", icon: "🌿" },
}

// ─── رتبه‌ها (rank = قله‌ی عریانِ سطح) ────────────────────────────────────────
export const RANKS: { min: number; emoji: string; name: string }[] = [
  { min: 1, emoji: "🐣", name: "کارآموز" },
  { min: 5, emoji: "🗡️", name: "تازه‌کار" },
  { min: 10, emoji: "⚔️", name: "ماهر" },
  { min: 15, emoji: "🛡️", name: "کهنه‌کار" },
  { min: 20, emoji: "💠", name: "نخبه" },
  { min: 25, emoji: "👑", name: "عالی‌مقام" },
  { min: 30, emoji: "🌌", name: "افسانه‌ای" },
  { min: 40, emoji: "♾️", name: "جاودان" },
]

export function rankOf(level: number): { emoji: string; name: string; min: number } {
  let cur = RANKS[0]
  for (const r of RANKS) if (level >= r.min) cur = r
  return cur
}

// ─── حالتِ روحیه (spirit stat) ─────────────────────────────────────────────
export const SPIRIT_CONDITIONS: { min: number; label: string; emoji: string; dmgMod: number; canFight: boolean }[] = [
  { min: 90, label: "شوریده", emoji: "🔥", dmgMod: 0.1, canFight: true },
  { min: 70, label: "بااعتماد", emoji: "✨", dmgMod: 0.05, canFight: true },
  { min: 40, label: "رویِ پا", emoji: "🙂", dmgMod: 0, canFight: true },
  { min: 20, label: "دل‌شکسته", emoji: "😔", dmgMod: -0.05, canFight: true },
  { min: 1, label: "خسته", emoji: "😵", dmgMod: -0.1, canFight: true },
  { min: 0, label: "تهی", emoji: "💔", dmgMod: -0.15, canFight: false },
]

export function spiritCondition(spirit: number) {
  // آرایه نزولی است — اولین تطابق، بالاترین حالت است
  for (const c of SPIRIT_CONDITIONS) if (spirit >= c.min) return c
  return SPIRIT_CONDITIONS[SPIRIT_CONDITIONS.length - 1]
}

// ═══ تعریفِ کلاس‌ها ═══════════════════════════════════════════════════════════

export const CLASSES: ClassDef[] = [
  {
    key: "shinobi",
    emoji: "🥷",
    name: "شینوبیِ سایه",
    roleName: "قاتلِ دقیق",
    fantasy: "آدمکشِ چابک و پنهان‌کار که با دقت، گریز و ضربه‌های بحرانی می‌برد.",
    difficulty: 3,
    strengths: ["آسیبِ بحرانی سرسام‌آور", "گریزِ بالا", "ابتکار عمل"],
    weaknesses: ["پایداریِ دفاعی پایین", "وابسته به زمان‌بندی و مدیریتِ منبع"],
    playStyle: "منتظر بمان، گریز کن، نشان‌های سایه بساز، بعد یک‌ضربه‌ی تمام‌کننده بزن.",
    base: { atk: 12, def: 5, crit: 13, critDmg: 165, dodge: 14, acc: 86, speed: 11, luck: 10, loot: 5 },
    growth: { atk: 1.6, def: 0.6, crit: 0.9, critDmg: 5, dodge: 0.7, acc: 0.5, speed: 0.8, luck: 0.6, loot: 0.5 },
    hpBase: 46,
    hpPerLvl: 4.5,
    xpBias: { primary: "agility", secondary: "battle" },
    passive: {
      name: "اعدِ سایه",
      icon: "🌑",
      // V14: متن = داده (shadowMarkDmg) + منبعِ ساختِ نشان (مطابقِ موتورِ PvE: هر حلِ دفاعی)
      desc: "مقابلِ هر حرکتِ حریف — جاخالی بدهی یا ضربه بخوری — یک «نشانِ سایه» فشرده می‌شود (حداکثر 3). ضربه‌ی بعدی نشان‌ها را می‌بلعد: +10% آسیب به‌ازای هر نشان.",
      base: { shadowMarkDmg: 10 },
    },
    activeSkill: {
      id: "as_shinobi",
      name: "شبح‌زنی",
      icon: "💫",
      desc: "ضربه‌ی 130% با بحرانیِ تضمینی.",
      cooldown: 3,
      power: 130,
    },
    skills: [
      { id: "sk_shinobi_step", name: "گامِ سایه", icon: "👣", desc: "چابکی‌ات در سایه‌ها سفت می‌شود.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "dodge", perRank: 4 }, branch: "core" },
      { id: "sk_shinobi_edge", name: "تیغِ دقیق", icon: "🗡️", desc: "چشمِت لبه‌ی نقطه‌ی ضعف را پیدا می‌کند.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "crit", perRank: 5 }, branch: "core" },
      { id: "sk_shinobi_mark", name: "اثرِ نشانِ عمیق", icon: "🌑", desc: "هر نشانِ سایه سخت‌تر می‌گیرد.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "shadowMarkDmg", perRank: 4 }, branch: "core" },
      { id: "sk_shinobi_eye", name: "چشمِ مرگ", icon: "👁️", desc: "بحرانی‌هایت عمیق‌تر می‌شوند.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "critDmg", perRank: 15 }, branch: "core" },
      // V10 — مسیرِ زندگی: نینجایِ کارگر و مراقب
      { id: "sk_shinobi_courier", name: "پیکِ شبانه", icon: "📜", desc: "سفارش‌های شب را بی‌سر‌و‌صدا می‌رسانی — دستمزدش هم بی‌سؤال می‌آید. % حقوقِ شیفت بیشتر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "payout", perRank: 4 }, branch: "life", requires: "sk_shinobi_step" },
      { id: "sk_shinobi_quiet", name: "حضورِ بی‌صدا", icon: "🌙", desc: "وقتی کنارش می‌نشینی و حرفی نمی‌زنی، آرام می‌شود. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_shinobi_courier" },
      // V10 — قله‌ی هنر: فقط بعد از فرگشتِ اول
      { id: "sk_shinobi_kage", name: "کاگِرا", icon: "🌌", desc: "سایه‌ات خون می‌شود، می‌فهمد، برمی‌گردد. بحرانی بیشتر.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "crit", perRank: 7 }, branch: "art", requires: "sk_shinobi_edge", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "سایه‌ی خاموش", emoji: "🌒", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "سایه‌ات دیگر از تو جدا نیست — تو سایه‌ی خودت شده‌ای.", pathLabel: "مسیرِ سایه", statBonus: { dodge: 5, crit: 3 } },
      { name: "شب‌پیمایِ بی‌صدا", art: "/art/classes/shinobi-a2.png", emoji: "🌑", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "شب یاد گرفته اول صدا را قورت بدهد، بعد تو را نشان بدهد.", pathLabel: "مسیرِ سایه", statBonus: { dodge: 8, crit: 5 } },
      { name: "مُرغِ شبِ ابدی", art: "/art/classes/shinobi-a3.png", emoji: "🕊️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "افسانه‌ای که فقط وقتی می‌بینیش که دیگر دیر شده.", pathLabel: "مسیرِ سایه", statBonus: { dodge: 12, crit: 8 } },
    ],
    evolutionAlt: [
      { name: "تیغِ سپیده", emoji: "🌅", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "از سایه بیرون آمدی تا دیده شوی — و کسی پشیمان شد که دید.", pathLabel: "مسیرِ تیغ", statBonus: { def: 3, acc: 4 } },
      { name: "شمشیرزنِ روز", art: "/art/classes/shinobi-b2.png", emoji: "⚔️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "نورِ روز دیگر دشمن نیست — تمرینِ توست.", pathLabel: "مسیرِ تیغ", statBonus: { def: 5, acc: 6 } },
      { name: "خورشیدِ چنگیز", art: "/art/classes/shinobi-b3.png", emoji: "☀️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "کسی که در نور می‌جنگد، چیزی برای پنهان‌کاری نگذاشته — جز مهارتش.", pathLabel: "مسیرِ تیغ", statBonus: { def: 8, acc: 9 } },
    ],
    lore: {
      intro: "بچه‌کوچه‌های شمیران هر شب یکی را انتخاب می‌کنند تا در تاریکی راه بلد باشد. تو همان یکی هستی.",
      deep: [
        "شینوبی‌ها اولین بار برای پس‌زدنِ دزدانِ روبان از کوچه‌های بازار پا به میدان گذاشتند.",
        "قانونِ اول: هر ضربه‌ای که دیده شود، شکست خورده است.",
        "فرگشتِ نهاییِ شینوبی، شبِ خودش را ساختن است — نه در تاریکی ماندن.",
      ],
    },
    art: "/art/classes/shinobi.jpg",
    palette: { primary: "#a78bfa", soft: "#2a2340" },
  },
  {
    key: "ranger",
    emoji: "🎯",
    name: "کمانگیرِ تاکتیکی",
    roleName: "تیراندازِ دقیق",
    fantasy: "جنگاورِ هدف‌گیر که با دقتِ خونسرد، نشانه‌گذاری و آسیبِ پیوسته می‌بَرد.",
    difficulty: 1,
    strengths: ["آسیبِ مطمئن", "دقتِ بی‌رقیب", "بهره‌وریِ منابع"],
    weaknesses: ["بدون آماده‌سازی ضعیف‌تر", "آسیب‌پذیر در نزدیک"],
    playStyle: "ضربه‌ پشتِ ضربه بدون خطا بزن تا «تمرکز» رویش بماند.",
    base: { atk: 11, def: 7, crit: 12, critDmg: 160, dodge: 10, acc: 95, speed: 10, luck: 8, loot: 8 },
    growth: { atk: 1.5, def: 0.8, crit: 0.8, critDmg: 5, dodge: 0.6, acc: 0.8, speed: 0.7, luck: 0.5, loot: 0.8 },
    hpBase: 58,
    hpPerLvl: 5,
    xpBias: { primary: "battle", secondary: "fortune" },
    passive: {
      name: "تمرکزِ شکارچی",
      icon: "🎯",
      // V14: متن = داده (focusDmg) + منبعِ ساخت (PvE: ضربه‌ی موفقِ پیاپی؛ پاداشِ دقت وجود ندارد)
      desc: "هر ضربه‌ی پیاپیِ موفق «تمرکز» می‌سازد (حداکثر 3): هر تمرکز +8% آسیب. خطا زدن یا ضربه‌خوردن آن را صفر می‌کند.",
      base: { focusDmg: 8 },
    },
    activeSkill: {
      id: "as_ranger",
      name: "تیرِ نشانه",
      icon: "🏹",
      desc: "تیری که نصفِ زره را نادیده می‌گیرد (+30 دقت).",
      cooldown: 3,
      power: 125,
    },
    skills: [
      { id: "sk_ranger_aim", name: "نشانه‌گیری", icon: "🎯", desc: "چشمِت خاک نمی‌خورد.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "acc", perRank: 4 }, branch: "core" },
      { id: "sk_ranger_volley", name: "رگبارِ دوتیغ", icon: "🏹", desc: "کمانت تندتر می‌خرد.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "atk", perRank: 1.2 }, branch: "core" },
      { id: "sk_ranger_focus", name: "ذهنِ شکار", icon: "🧘", desc: "تمرکزت عمیق‌تر می‌شود.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "focusDmg", perRank: 3 }, branch: "core" },
      { id: "sk_ranger_pack", name: "کوله‌ی شکارچی", icon: "🎒", desc: "از هر شکار، بیشتر برمی‌گردی.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "loot", perRank: 6 }, branch: "core" },
      // V10 — مسیرِ زندگی: تیراندازِ کاروان
      { id: "sk_ranger_caravan", name: "قراردادِ کاروان", icon: "📜", desc: "کاروان‌ها حاضرند برای محافظِ مطمئن بیشتر بپردازند. % حقوقِ شیفت بیشتر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "payout", perRank: 4 }, branch: "life", requires: "sk_ranger_aim" },
      { id: "sk_ranger_brew", name: "دمنوشِ اردک", icon: "☕", desc: "چایِ کوهی‌ات سینه را باز می‌کند — اصرار به آرامش می‌کند. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_ranger_caravan" },
      // V10 — قله‌ی هنر
      { id: "sk_ranger_hawk", name: "چشمِ شاهین", icon: "🦅", desc: "هدف از پشتِ مه هم خودش را نشان می‌دهد. دقتِ مطلق.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "acc", perRank: 5 }, branch: "art", requires: "sk_ranger_volley", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "تیربانِ شهر", emoji: "🌆", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "پشت‌بام‌های شهر، تیراندازِ خودش را دارند.", pathLabel: "مسیرِ دقت", statBonus: { acc: 5, crit: 2 } },
      { name: "کمانگیرِ طلوع", art: "/art/classes/ranger-a2.png", emoji: "🌅", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "اولین نورِ روز هدفِ تو را نمی‌ترساند — تو زودتر بیداری.", pathLabel: "مسیرِ دقت", statBonus: { acc: 7, crit: 4 } },
      { name: "شکارچیِ افق", art: "/art/classes/ranger-a3.png", emoji: "🌇", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "افق فقط از این به بعد خطِ تیرِ توست.", pathLabel: "مسیرِ دقت", statBonus: { acc: 10, crit: 6 } },
    ],
    evolutionAlt: [
      { name: "تیراندازِ کوله‌سنگین", emoji: "🪨", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای دویدن، ایستادی و ساکتتر زدی.", pathLabel: "مسیرِ سنگ", statBonus: { def: 4, atk: 1 } },
      { name: "دیده‌بانِ سنگی", art: "/art/classes/ranger-b2.png", emoji: "🗿", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "کوه‌ها تیراندازِ خودشان را دارند — تو یکی‌ای.", pathLabel: "مسیرِ سنگ", statBonus: { def: 6, atk: 2 } },
      { name: "ستونِ افق", art: "/art/classes/ranger-b3.png", emoji: "⛰️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "جایی که می‌ایستی، جغرافیا عوض می‌شود.", pathLabel: "مسیرِ سنگ", statBonus: { def: 9, atk: 3 } },
    ],
    lore: {
      intro: "کوچه‌پهنه‌های شهر به تیری که هرگز خطا نمی‌زند احترام می‌گذارند — حتی دزدها.",
      deep: [
        "کمانگیرها نگهبانانِ کاروانِ روبان بودند؛ کسی که خطا زد، کاروان را از دست داد.",
        "قانونِ شکار: اول نشانه، بعد نفس، آخر تیر.",
        "شکارچیِ افق دیگر تیر نمی‌اندازد — افق خودش جلو می‌آید.",
      ],
    },
    art: "/art/classes/ranger.jpg",
    palette: { primary: "#34d399", soft: "#1e3328" },
  },
  {
    key: "wizard",
    emoji: "🔮",
    name: "جادوگرِ رازآگاه",
    roleName: "افسون‌گرِ انفجاری",
    fantasy: "متخصصِ جادوی پرقدرت که انرژیِ ناپایدارِ کهکشانی را مهار می‌کند.",
    difficulty: 3,
    strengths: ["آسیبِ انفجاری", "اثرهای جادویی", "پیوند با اسرار و آیتم‌های کمیاب"],
    weaknesses: ["مدیریتِ منبعِ سخت", "وقتی تهی شود بی‌رحم", "آسیب‌پذیر در برابرِ قطع‌شدن"],
    playStyle: "بحران‌ها را انبار کن تا «انفجارِ کهکشانی» دوبل بزند.",
    base: { atk: 13.5, def: 4.5, crit: 11, critDmg: 200, dodge: 8, acc: 85, speed: 8, luck: 12, loot: 10 },
    growth: { atk: 1.65, def: 0.5, crit: 0.8, critDmg: 7, dodge: 0.5, acc: 0.4, speed: 0.5, luck: 0.9, loot: 1.0 },
    hpBase: 52,
    hpPerLvl: 4.5,
    xpBias: { primary: "arcane", secondary: "battle" },
    passive: {
      name: "انفجارِ کهکشانی",
      icon: "✨",
      desc: "با هر بحرانی، 35% شانسِ انفجارِ اسرار: +25% آسیبِ اضافی و یافتنِ سکه. فقط یک‌بار در هر نبردِ حل‌شده.",
      base: { burstChance: 35, burstBonus: 25 },
    },
    activeSkill: {
      id: "as_wizard",
      name: "انفجارِ مهبانگ",
      icon: "🌌",
      desc: "165% آسیبِ خام — کمی از خونِ خودت هم می‌گیرد.",
      cooldown: 4,
      power: 165,
      selfCost: 5,
    },
    skills: [
      { id: "sk_wizard_burst", name: "رگبارِ اسرار", icon: "✨", desc: "احتمالِ انفجارِ کهکشانی بالا می‌رود.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "burstChance", perRank: 6 }, branch: "core" },
      { id: "sk_wizard_mind", name: "ذهنِ ستاره‌ای", icon: "🌟", desc: "ستاره‌ها با تو محک‌تر حرف می‌زنند.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "critDmg", perRank: 10 }, branch: "core" },
      { id: "sk_wizard_veil", name: "روشن‌کردنِ حجاب", icon: "🌙", desc: "سکه‌های گم‌شده در لایه‌های راز پیدا می‌شوند.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "burstBonus", perRank: 10 }, branch: "core" },
      { id: "sk_wizard_ward", name: "ذخیره‌ی مِهر", icon: "🛡️", desc: "پیش‌بینیِ جادویی، ضربه‌ها را نرم می‌کند.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "def", perRank: 1.2 }, branch: "core" },
      // V10 — مسیرِ زندگی: جادوگرِ بازار
      { id: "sk_wizard_divination", name: "فالِ بازار", icon: "🔮", desc: "قیمتِ فردا را یک روز زودتر می‌بینی — وگرنه چایِ مغازه‌دار را فال می‌گیری. % فروشِ گران‌تر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "bargain", perRank: 3 }, branch: "life", requires: "sk_wizard_burst" },
      { id: "sk_wizard_starlight", name: "آرامشِ اختر", icon: "🌠", desc: "نورِ ستاره‌ها روی شونه‌ات می‌نشیند — سختی‌ها را آرام می‌کند. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_wizard_divination" },
      // V10 — قله‌ی هنر
      { id: "sk_wizard_rift", name: "هستهِ شکاف", icon: "💫", desc: "از شکافِ اختری، آسیبِ خام بیرون می‌زند. ضریبِ بحرانیِ عمیق‌تر.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "critDmg", perRank: 18 }, branch: "art", requires: "sk_wizard_mind", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "دانش‌پژوهِ اختر", emoji: "🔭", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "ستاره‌ها اسمت را یاد گرفتند.", pathLabel: "مسیرِ راز", statBonus: { critDmg: 12, luck: 3 } },
      { name: "اختری‌بان", art: "/art/classes/wizard-a2.png", emoji: "🌠", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "کهکشان‌ها برایت صف می‌بندند تا حرف بزنی.", pathLabel: "مسیرِ راز", statBonus: { critDmg: 18, luck: 5 } },
      { name: "فرمانروایِ اختر", art: "/art/classes/wizard-a3.png", emoji: "🌌", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "آن‌قدر راز دیدی که خودت شدی رازی که باید کشف شود.", pathLabel: "مسیرِ راز", statBonus: { critDmg: 25, luck: 8 } },
    ],
    evolutionAlt: [
      { name: "شاگردِ مهر", emoji: "💗", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای عقب‌رفتن در راز، جلو رفتی در مردم.", pathLabel: "مسیرِ مهر", statBonus: { def: 4, crit: 3 } },
      { name: "شفادهندهِ ستاره", art: "/art/classes/wizard-b2.png", emoji: "🌟", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "جرقه‌هایت حالا به‌جای سوختن، روشن می‌کنند.", pathLabel: "مسیرِ مهر", statBonus: { def: 6, crit: 5 } },
      { name: "نگهبانِ شکافِ مهر", art: "/art/classes/wizard-b3.png", emoji: "✨", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "شکاف‌ها یاد گرفتند به‌جای بلعیدن، نفس بدهند.", pathLabel: "مسیرِ مهر", statBonus: { def: 9, crit: 7 } },
    ],
    lore: {
      intro: "زیرِ پلِ عروس‌ها جادوگری خوابیده بود که شهردار جرئت بیدار کردنش را نداشت. تو بیدارش کردی.",
      deep: [
        "جادوگرِ رازآگاه انرژی را از «شکاف‌های اختری» می‌گیرد — جاهایی که شهر فراموش کرده نگاه کند.",
        "قانونِ طلایی: هر انفجار، یک قیمت دارد. گاهی خون، گاهی حافظه.",
        "فرمانروایِ اختر دیگر طلسم نمی‌خواند؛ واقعیت خودش گوش می‌دهد.",
      ],
    },
    art: "/art/classes/wizard.jpg",
    palette: { primary: "#f472b6", soft: "#3b2140" },
  },
  {
    key: "trickster",
    emoji: "🎭",
    name: "شیادِ نجیب",
    roleName: "فریب‌کارِ کاریزماتیک",
    fantasy: "فریب‌کاری خوش‌قیافه که بخت و موقعیت‌های عجیب را به برتری تبدیل می‌کند.",
    difficulty: 2,
    strengths: ["پاداش‌های موقعیتی", "مکانیکِ شانسی", "نیرنگ‌های غیرقابل‌پیش‌بینی"],
    weaknesses: ["خروجیِ نامطمئن", "مهارت‌های موقعیتی", "نیازمند فهمِ استراتژیک"],
    playStyle: "کارت‌هایت را نگه دار تا لحظه‌ای که حریف مطمئن شود. بعد بکَندش.",
    base: { atk: 12, def: 6, crit: 14, critDmg: 165, dodge: 16, acc: 86, speed: 11, luck: 20, loot: 12 },
    growth: { atk: 1.5, def: 0.7, crit: 1.0, critDmg: 5, dodge: 1.0, acc: 0.5, speed: 0.8, luck: 1.4, loot: 1.1 },
    hpBase: 54,
    hpPerLvl: 5,
    xpBias: { primary: "trickery", secondary: "fortune" },
    passive: {
      name: "فریبِ سلطنتی",
      icon: "🃏",
      // V14: متن = داده (deceptionChance) + توانِ تلمبه (PvE: 75% — نه 60%)؛ شانس با luck بالا نمی‌رود
      desc: "27% شانس در هر راند: حرکتِ حریف فرو می‌پاشد و تَلَمبه‌ی 75% آسیب می‌خورد.",
      base: { deceptionChance: 27 },
    },
    activeSkill: {
      id: "as_trickster",
      name: "کارتِ سلطنتی",
      icon: "🂡",
      desc: "کارتِ برگردان: آسیب 70% یا 110% یا 220% — کارتِ سلطنتی حریف را گیج می‌کند (دقتِ او −20).",
      cooldown: 3,
      power: 100,
    },
    skills: [
      { id: "sk_trick_luck", name: "شانسِ نقطه‌چین", icon: "🎲", desc: "کلاهت عمیق‌تر از چیزی است که فکر می‌کنند.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "luck", perRank: 5 }, branch: "core" },
      { id: "sk_trick_face", name: "چهره‌های متعدد", icon: "🎭", desc: "کدام‌یک واقعی است؟ حتی خودت هم نمی‌دانی.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "dodge", perRank: 4 }, branch: "core" },
      { id: "sk_trick_royal", name: "لبخندِ مذاکره", icon: "👑", desc: "مغازه‌داران همیشه چیزی به تو اضافه می‌دهند.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "loot", perRank: 7 }, branch: "core" },
      { id: "sk_trick_deck", name: "دسته‌ی نشانه‌شده", icon: "🃏", desc: "فریبِ سلطنتی بیشتر می‌افتد.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "passive", param: "deceptionChance", perRank: 4 }, branch: "core" },
      // V10 — مسیرِ زندگی: شیادِ بازار
      { id: "sk_trick_haggle", name: "چانه‌زنیِ دربار", icon: "🤝", desc: "قیمت را با یک لبخند و یک دروغِ کوچکِ سفید بالا می‌بری. % فروشِ گران‌تر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "bargain", perRank: 4 }, branch: "life", requires: "sk_trick_luck" },
      { id: "sk_trick_show", name: "نمایشِ کوچک", icon: "🎪", desc: "برایش یک تردستی می‌کنی و شبِ او را می‌سازی. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_trick_haggle" },
      // V10 — قله‌ی هنر
      { id: "sk_trick_hidden", name: "دستهِ پنهان", icon: "🎴", desc: "کارتِ پنهان در آستینِ جهان — فریبِ سلطنتی سخت‌تر می‌افتد.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "passive", param: "deceptionChance", perRank: 5 }, branch: "art", requires: "sk_trick_face", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "کارت‌بازِ دربار", emoji: "♠️", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "در دربار، همه کارت دارند — تو کل deck را داری.", pathLabel: "مسیرِ بخت", statBonus: { luck: 5, dodge: 3 } },
      { name: "شعبده‌بازِ ماسک‌دار", art: "/art/classes/trickster-a2.png", emoji: "🎭", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "ماسکت را که برداری، جای خالی‌اش چیزی غیرقابل‌تکرار است.", pathLabel: "مسیرِ بخت", statBonus: { luck: 8, dodge: 5 } },
      { name: "پرنسِ دوه‌لو", art: "/art/classes/trickster-a3.png", emoji: "🤴", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "دو تاج، یک سر — و هیچ‌کس نمی‌داند کدام واقعی است.", pathLabel: "مسیرِ بخت", statBonus: { luck: 12, dodge: 8 } },
    ],
    evolutionAlt: [
      { name: "بازرگانِ دوپهلو", emoji: "🪙", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای دربار، بازار را انتخاب کردی — و بازار رشوه نمی‌خواهد، سهم می‌خواهد.", pathLabel: "مسیرِ سکه", statBonus: { loot: 6, def: 2 } },
      { name: "خزانه‌دارِ شهر", art: "/art/classes/trickster-b2.png", emoji: "💎", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "صندوقِ شهر قفل ندارد — اعتماد دارد. تو هر دو را داری.", pathLabel: "مسیرِ سکه", statBonus: { loot: 9, def: 3 } },
      { name: "ترازویِ بازارِ بزرگ", art: "/art/classes/trickster-b3.png", emoji: "⚖️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "هر چیز در جهان ارزش دارد — تو کسی‌ای که قیمت را می‌نویسد.", pathLabel: "مسیرِ سکه", statBonus: { loot: 14, def: 5 } },
    ],
    lore: {
      intro: "در عروسی‌های شهر همیشه یکی بود که جای هدیه را عوض می‌کرد و بعد مهمانِ عروس می‌شد. تو حرفه‌ای‌تر از او هستی.",
      deep: [
        "شیادهای نجیب از مکتبِ «هفت‌نیم‌تخمه» می‌آیند؛ درسی که می‌گفت بخت همیشه با رندوم‌ترهاست.",
        "قانونِ کارت: هر دستی را که نشانه نکنی، خوانده می‌شوی.",
        "پرنسِ دوه‌لو وقتی تاج می‌گذارد، دربار دو روز طول می‌کشد بفهمد تاجش کجاست.",
      ],
    },
    art: "/art/classes/trickster.jpg",
    palette: { primary: "#fbbf24", soft: "#3a2f1a" },
  },
  {
    key: "paladin",
    emoji: "🛡️",
    name: "پالادینِ تایتان",
    roleName: "نگهبانِ ایستاده",
    fantasy: "محافظِ ایستادگی که فشار را می‌بلعد، هم‌تیمی‌ها را نگاه می‌دارد و صبر را به قوت تبدیل می‌کند.",
    difficulty: 1,
    strengths: ["دفاعِ سنگی", "جانِ بالا", "حمایت از دیگران"],
    weaknesses: ["آسیبِ انفجاریِ کم", "ریتمِ کندِ حمله", "ضعیف در مکانیک‌های سرعتی"],
    playStyle: "بایست، بخور، زره بپوش، و وقتی عهدت فعّال شد برگردان.",
    base: { atk: 12, def: 12, crit: 6, critDmg: 150, dodge: 4, acc: 84, speed: 6, luck: 8, loot: 6 },
    growth: { atk: 1.5, def: 1.4, crit: 0.5, critDmg: 4, dodge: 0.3, acc: 0.4, speed: 0.4, luck: 0.5, loot: 0.6 },
    hpBase: 72,
    hpPerLvl: 7,
    xpBias: { primary: "guard", secondary: "battle" },
    passive: {
      name: "عهدِ تایتان",
      icon: "🛡️",
      // V14: متن = داده (resolveMitg) + رفتارِ موتور (همان ضربه نرم می‌شود + 6% خونِ کل)
      desc: "وقتی خونت زیر 40% بیفتد و ضربه بخوری، عهدِ تایتان همان ضربه را 30% نرم‌تر می‌کند و 6% خونِ کل برمی‌گرداند.",
      base: { resolveMitg: 30 },
    },
    activeSkill: {
      id: "as_paladin",
      name: "سپرِ عهد",
      icon: "✝️",
      desc: "گاردِ کامل + برگشتِ 8% خونِ کل.",
      cooldown: 4,
      power: 0,
    },
    skills: [
      { id: "sk_pala_oath", name: "پیمانِ فولاد", icon: "⛓️", desc: "زره‌ات مثل عهدت سفت می‌شود.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "def", perRank: 1.6 }, branch: "core" },
      { id: "sk_pala_heart", name: "قلبِ تایتان", icon: "❤️", desc: "دلی که تایتان در آن می‌کوبد.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "atk", perRank: 1.0 }, branch: "core" },
      { id: "sk_pala_stand", name: "ایستادگی", icon: "🏔️", desc: "همّتِ عهدِ تایتان محکم‌تر می‌شود.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "resolveMitg", perRank: 8 }, branch: "core" },
      { id: "sk_pala_grace", name: "سخاوتِ محافظ", icon: "🤲", desc: "بختِ محافظ، سکه‌های اضافه می‌آورد.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "luck", perRank: 5 }, branch: "core" },
      // V10 — مسیرِ زندگی: محافظِ کارگر
      { id: "sk_pala_shift", name: "شیفتِ نگهبانی", icon: "🏦", desc: "شب‌هایی که پشتِ درِ کارگاه می‌ایستی، دستمزدش جدا حساب می‌شود. % حقوقِ شیفت بیشتر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "payout", perRank: 4 }, branch: "life", requires: "sk_pala_oath" },
      { id: "sk_pala_vigil", name: "شب‌خوابِ آرام", icon: "🕯️", desc: "خوابِ سبکِ محافظ — تو که بیدار می‌شوی، او هم راحت می‌خوابد. % جلای استراحتِ توأمان بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "restGain", perRank: 10 }, branch: "life", requires: "sk_pala_shift" },
      // V10 — قله‌ی هنر
      { id: "sk_pala_wall", name: "دیوارِ عهد", icon: "🧱", desc: "وقتی می‌ایستی، خطِ جلو عقب نمی‌رود. دفاعِ خاموش.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "def", perRank: 2.4 }, branch: "art", requires: "sk_pala_heart", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "سوگندخورده‌ی سپر", emoji: "🥈", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "سوگندت را خوردی و سپر خورد.", pathLabel: "مسیرِ سپر", statBonus: { def: 4 } },
      { name: "دیده‌بانِ عهد", art: "/art/classes/paladin-a2.png", emoji: "🛡️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "شهر یاد گرفت پشتِ تو نفس بکشد.", pathLabel: "مسیرِ سپر", statBonus: { def: 6 } },
      { name: "پاسدارِ جاودانه", art: "/art/classes/paladin-a3.png", emoji: "⚜️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "دیگر نمی‌افتد — فشار یاد گرفته از رویش رد شود.", pathLabel: "مسیرِ سپر", statBonus: { def: 9 } },
    ],
    evolutionAlt: [
      { name: "نیه‌گزارِ سپرِ شکسته", emoji: "💢", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "سپر را گذاشتی و مشت را برداشتی — عهد همان است، ادبش عوض شد.", pathLabel: "مسیرِ مشت", statBonus: { atk: 2, crit: 3 } },
      { name: "شمشیرِ عهد", art: "/art/classes/paladin-b2.png", emoji: "⚔️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "بهترین دفاع، آن‌قدر ایستادن نیست که مالِ خودت را پس گرفتن است.", pathLabel: "مسیرِ مشت", statBonus: { atk: 3, crit: 5 } },
      { name: "خشمِ تایتان", art: "/art/classes/paladin-b3.png", emoji: "🌋", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "کوه‌ها هم آرام‌اند — تا وقتی که نه.", pathLabel: "مسیرِ مشت", statBonus: { atk: 5, crit: 7 } },
    ],
    lore: {
      intro: "وقتی آشوبِ بازار شکست، یکی باید پشتش بایستد. تو کسی هستی که بچه‌ها وقتی چشمشان گیر می‌کند پیدا می‌کنند.",
      deep: [
        "پالادین‌های تایتان از نگهبانانِ کاروانِ ابریشمِ روبان می‌آیند.",
        "قانونِ عهد: محافظ اول خودش را حفظ نمی‌کند — عهدش را حفظ می‌کند.",
        "پاسدارِ جاودانه وقتی می‌ایستد، زمین هم ترتیبِ خودش را می‌دهد.",
      ],
    },
    art: "/art/classes/paladin.jpg",
    palette: { primary: "#f87171", soft: "#3a2224" },
  },
  {
    key: "duelist",
    emoji: "⚡",
    name: "دوئل‌کارِ توفان",
    roleName: "حمله‌کننده‌ی زنجیره‌ای",
    fantasy: "دوئل‌کننده‌ی سریع و تهاجمی که ضربه‌ها را زنجیر می‌کند و تمپوی نبرد را در دست می‌گیرد.",
    difficulty: 2,
    strengths: ["چابکیِ مرگبار", "حملاتِ پیاپی", "ابتکار عملِ بی‌رحم"],
    weaknesses: ["شکستِ زنجیره = افتِ شدید", "مصرفِ بالای منبع", "ضعیف در دفاعِ طولانی"],
    playStyle: "ضربه بزن، ضربه بزن، ضربه بزن. اگر خطا خوردی زنجیر از اول.",
    base: { atk: 12.5, def: 6, crit: 13, critDmg: 168, dodge: 14, acc: 90, speed: 16, luck: 9, loot: 6 },
    growth: { atk: 1.6, def: 0.7, crit: 0.9, critDmg: 5, dodge: 0.9, acc: 0.6, speed: 1.2, luck: 0.6, loot: 0.6 },
    hpBase: 56,
    hpPerLvl: 5,
    xpBias: { primary: "agility", secondary: "battle" },
    passive: {
      name: "ریتمِ توفان",
      icon: "⚡",
      // V14: متن = داده (tempoDmg)
      desc: "ضربه‌های پیاپی «تمپو» می‌سازند (حداکثر 3): هر تمپو +8% آسیب. ضربه‌خوردن یا گاردکردن ریتم را صفر می‌کند.",
      base: { tempoDmg: 8 },
    },
    activeSkill: {
      id: "as_duelist",
      name: "رَپیدِ توفان",
      icon: "🌩️",
      desc: "دو ضربه‌ی 65% پشتِ هم.",
      cooldown: 3,
      power: 65,
    },
    skills: [
      { id: "sk_duel_rhythm", name: "ریتمِ برق", icon: "⚡", desc: "هر تمپو سخت‌تر می‌گیرد.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "tempoDmg", perRank: 3 }, branch: "core" },
      { id: "sk_duel_feet", name: "پایِ سبک", icon: "🦶", desc: "پاهایت مثل تردمیلِ نئون.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "dodge", perRank: 4 }, branch: "core" },
      { id: "sk_duel_edge", name: "لبه‌ی دوقطبی", icon: "⚔️", desc: "تیغِ دوتای تو یک لحظه کور می‌کند.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "crit", perRank: 5 }, branch: "core" },
      { id: "sk_duel_burst", name: "شتابِ مطلق", icon: "🌪️", desc: "سرعت، آسیب است.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "atk", perRank: 1.3 }, branch: "core" },
      // V10 — مسیرِ زندگی: ستاره‌ی محل
      { id: "sk_duel_sponsor", name: "قراردادِ نمایش", icon: "🏆", desc: "قهرمانِ محل، اسمِ مغازه را روی دوشش می‌کشد — و دستمزدش را هم می‌گیرد. % حقوقِ شیفت بیشتر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "payout", perRank: 4 }, branch: "life", requires: "sk_duel_rhythm" },
      { id: "sk_duel_dance", name: "رقصِ تعادل", icon: "🩰", desc: "جنگ و رقص و زندگی — هر سه یک پایه دارند: نفس. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_duel_sponsor" },
      // V10 — قله‌ی هنر
      { id: "sk_duel_flash", name: "تُندِ پیکر", icon: "💨", desc: "سرعتت از چشمِ شهر تندتر است — ابتکارِ عملِ مطلق.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "speed", perRank: 3 }, branch: "art", requires: "sk_duel_feet", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "رقاصِ تیغ", emoji: "🩰", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "تیغ‌هایت یاد گرفتند با موسیقی بخوابند.", pathLabel: "مسیرِ توفان", statBonus: { speed: 4, crit: 2 } },
      { name: "تندبادِ دوقطبی", art: "/art/classes/duelist-a2.png", emoji: "🌬️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "حریف قبل از شروعِ دوئل، نسکت را حساب می‌کند.", pathLabel: "مسیرِ توفان", statBonus: { speed: 6, crit: 4 } },
      { name: "توفانِ برق‌پیکر", art: "/art/classes/duelist-a3.png", emoji: "🌩️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "دیگر دوئل نیست — نمایشِ برق با یک تماشاگرِ غافل.", pathLabel: "مسیرِ توفان", statBonus: { speed: 9, crit: 6 } },
    ],
    evolutionAlt: [
      { name: "مربیِ باشگاه", emoji: "🥊", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای صحنه، جای مربی را گرفتی — بچه‌ها از دستت می‌ترسند و دوستت دارند.", pathLabel: "مسیرِ مربی", statBonus: { def: 3, acc: 3 } },
      { name: "استادِ باشگاه", art: "/art/classes/duelist-b2.png", emoji: "🎗️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "شاگردانت حالا خودشان مربی می‌شوند — با مُهرِ امضای تو.", pathLabel: "مسیرِ مربی", statBonus: { def: 5, acc: 5 } },
      { name: "اسطوره‌ی رینگ", art: "/art/classes/duelist-b3.png", emoji: "👑", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "رینگ را که ترک می‌کنی، رینگ باقی می‌ماند — با اسمِ تو.", pathLabel: "مسیرِ مربی", statBonus: { def: 8, acc: 8 } },
    ],
    lore: {
      intro: "در قهوه‌خانه‌های قدیم، دوئل با چای شروع می‌شد و با آپلاوس تمام. تو هنوز چایت را نخورده همه‌چیز تمام است.",
      deep: [
        "دوئل‌کارهای توفان از مدرسه‌ی «رقصِ تیغِ جنوب» می‌آیند.",
        "قانونِ ریتم: سه ضربه‌ی پیاپی، یک نفسِ واقعی است.",
        "توفانِ برق‌پیکر نبرد را تموم می‌کند قبل از اینکه تعریفش را بنویسند.",
      ],
    },
    art: "/art/classes/duelist.jpg",
    palette: { primary: "#38bdf8", soft: "#1c2c3f" },
  },
  {
    key: "summoner",
    emoji: "🌿",
    name: "احضارکننده‌ی روح",
    roleName: "هم‌نفَسِ ارواح",
    fantasy: "متخصصِ عرفانی که با ارواح پیمان می‌بندد و شرایطِ میدان را دست‌کاری می‌کند.",
    difficulty: 2,
    strengths: ["سودمندیِ بالا", "همراهِ روحی", "انعطافِ تاکتیکی"],
    weaknesses: ["وابسته به آماده‌سازی", "عملکردِ موقعیتی", "بعضی کارها نیازمند پیش‌زمینه"],
    playStyle: "گرگِ روحت را بیدار نگه دار؛ هر دو راند یک‌بار کنارت می‌زند.",
    base: { atk: 12, def: 8, crit: 10, critDmg: 160, dodge: 10, acc: 88, speed: 9, luck: 14, loot: 9 },
    growth: { atk: 1.6, def: 0.9, crit: 0.6, critDmg: 4, dodge: 0.7, acc: 0.6, speed: 0.6, luck: 1.0, loot: 0.9 },
    hpBase: 60,
    hpPerLvl: 5,
    xpBias: { primary: "spirit", secondary: "fortune" },
    passive: {
      name: "پیمانِ روح",
      icon: "🐺",
      desc: "هر دومین راند، گرگِ روح کنارت می‌زند: 55% آسیبِ تو، بی‌هزینه. پیوندِ دلت با او را قوی‌تر می‌کند.",
      base: { wolfPower: 55 },
    },
    activeSkill: {
      id: "as_summoner",
      name: "هم‌نفَسِ گرگ",
      icon: "🐺",
      desc: "ضربه‌ی 110% + گرگِ روح راندِ بعدش با 70% می‌زند.",
      cooldown: 3,
      power: 110,
    },
    skills: [
      { id: "sk_sum_bond", name: "پیوندِ عمیق", icon: "🔗", desc: "گرگت بلندتر و سنگین‌تر می‌شود.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "wolfPower", perRank: 8 }, branch: "core" },
      { id: "sk_sum_breath", name: "نفسِ جنگل", icon: "🍃", desc: "از هر جنگل، چیزی اضافه برمی‌گردد.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "loot", perRank: 6 }, branch: "core" },
      { id: "sk_sum_ward", name: "روحِ نگهبان", icon: "🪄", desc: "ارواحِ نگهبان ضربه‌ها را خنثی می‌کنند.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "def", perRank: 1.2 }, branch: "core" },
      { id: "sk_sum_sight", name: "چشمِ جهانِ روح", icon: "👁️", desc: "شانست از آن‌سوی پرده می‌آید.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "luck", perRank: 5 }, branch: "core" },
      // V10 — مسیرِ زندگی: هم‌پیمانِ بازار
      { id: "sk_sum_pact", name: "پیمانِ چهارراه", icon: "🍀", desc: "ارواحِ بازار بهترین قیمت را بلدند — تو را به مشتریِ درست می‌رسانند. % فروشِ گران‌تر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "bargain", perRank: 3 }, branch: "life", requires: "sk_sum_bond" },
      { id: "sk_sum_companion", name: "هم‌نفسیِ عمیق", icon: "🌿", desc: "ارواحِ مهربان وقتی کنار می‌نشینند، سکوت را درمان می‌کنند. % جلای استراحتِ توأمان بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "restGain", perRank: 10 }, branch: "life", requires: "sk_sum_pact" },
      // V10 — قله‌ی هنر
      { id: "sk_sum_duet", name: "صدای دوئت", icon: "🐺", desc: "گرگِ روحت حالا حرف هم می‌زند — هر دو یک‌جا می‌زنید. قدرتِ گرگِ روحِ بیشتر.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "passive", param: "wolfPower", perRank: 9 }, branch: "art", requires: "sk_sum_ward", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "هم‌سایه‌ی روح", emoji: "🌲", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "سایه‌ات حالا دوتاست — یکی نفس می‌کشد.", pathLabel: "مسیرِ پیمان", statBonus: { luck: 4, loot: 3 } },
      { name: "بانویِ ارواح", art: "/art/classes/summoner-a2.png", emoji: "🧚", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "ارواح شهر صف می‌زنند تا پیمانِ تو را امضا کنند.", pathLabel: "مسیرِ پیمان", statBonus: { luck: 6, loot: 5 } },
      { name: "پیشوایِ جهانِ روح", art: "/art/classes/summoner-a3.png", emoji: "🌳", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "درختِ پیمان دیگر ریشه ندارد — ریشه، تو هستی.", pathLabel: "مسیرِ پیمان", statBonus: { luck: 9, loot: 8 } },
    ],
    evolutionAlt: [
      { name: "شمنِ کوچه", emoji: "🪶", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای جنگلِ بزرگ، کوچه‌های شهر را پیمان بستی — و کوچه پذیرفت.", pathLabel: "مسیرِ کوچه", statBonus: { def: 3, speed: 2 } },
      { name: "جان‌پناهِ محله", art: "/art/classes/summoner-b2.png", emoji: "🏘️", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "بچه‌های محل وقتی کج‌خلق می‌شوند، اول به درِ تو می‌کوبند.", pathLabel: "مسیرِ کوچه", statBonus: { def: 5, speed: 3 } },
      { name: "قلبِ بافتِ شهر", art: "/art/classes/summoner-b3.png", emoji: "💗", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "شهری که قلب دارد، تو را می‌شناسد — با اسمِ کوچکش.", pathLabel: "مسیرِ کوچه", statBonus: { def: 8, speed: 5 } },
    ],
    lore: {
      intro: "بچه‌ها می‌گویند در بافتِ شهر، گرگی هست که فقط بچه‌های مهربان می‌بینندش. تو فقط مهربان نیستی — رفیقشه.",
      deep: [
        "احضارکننده‌ها از شمن‌های کوه‌های شمال می‌آیند؛ آن‌جا روح بدونِ پیمان، مهمانِ ناخوانده است.",
        "قانونِ پیمان: روح چیزی نمی‌گیرد — فقط وفاداری می‌دهد و توقعِ همان را دارد.",
        "پیشوایِ جهانِ روح، درخت را به آتش نمی‌زند؛ درخت خودش برایش می‌سوزد.",
      ],
    },
    art: "/art/classes/summoner.jpg",
    palette: { primary: "#4ade80", soft: "#1f3324" },
  },
  {
    key: "reaper",
    emoji: "🩸",
    name: "دَروگرِ سرخ",
    roleName: "قماربازِ خونین",
    fantasy: "جنگاورِ پرریسک که فدیه‌های حساب‌شده را به قدرتِ حمله تبدیل می‌کند.",
    difficulty: 3,
    strengths: ["گزینه‌های تهاجمیِ خطرناک", "پاداشِ آسیبِ مشروط", "تبدیلِ منبع"],
    weaknesses: ["خطرِ جریمه‌ی خودخواسته", "نیازمند مدیریتِ حساب‌شده", "ضعیف در اضافه‌کُشی"],
    playStyle: "خون بده تا بخورَندت؛ ولی از خطِ سرخی که برای خودت کشیده‌ای رد نشو.",
    base: { atk: 11.5, def: 5, crit: 12, critDmg: 170, dodge: 9, acc: 87, speed: 12, luck: 11, loot: 7 },
    growth: { atk: 1.55, def: 0.55, crit: 0.8, critDmg: 4, dodge: 0.6, acc: 0.5, speed: 0.9, luck: 0.7, loot: 0.7 },
    hpBase: 50,
    hpPerLvl: 5,
    xpBias: { primary: "battle", secondary: "fortune" },
    passive: {
      name: "مومنتومِ سرخ",
      icon: "🩸",
      desc: "هر ضربه 6% خونِ فعلی‌ات را می‌گیرد ولی تا وقتی خونت بالای 50% است +10% آسیب می‌دهی.",
      base: { crimsonDmg: 10, crimsonCost: 6 },
    },
    activeSkill: {
      id: "as_reaper",
      name: "دَرَوِ سرخ",
      icon: "⚰️",
      desc: "170% آسیب — بهایش 10% خونِ فعلی است.",
      cooldown: 4,
      power: 170,
      selfCost: 10,
    },
    skills: [
      { id: "sk_reap_momentum", name: "شتابِ سرخ", icon: "🩸", desc: "مومنتومِ سرخت عمیق‌تر می‌زند.", type: "passive", unlockLevel: 1, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "crimsonDmg", perRank: 5 }, branch: "core" },
      { id: "sk_reap_pact", name: "عهدِ خون", icon: "🤝", desc: "بهایِ هر ضربه را نصف می‌کنی.", type: "passive", unlockLevel: 3, maxRank: 3, spCost: 1, effect: { kind: "passive", param: "crimsonCost", perRank: -0.8 }, branch: "core" },
      { id: "sk_reap_humble", name: "دروِ فروتن", icon: "🌹", desc: "حتی دروینده‌ها گاهی آرام می‌زنند — اما دقیق.", type: "passive", unlockLevel: 6, maxRank: 3, spCost: 1, effect: { kind: "stat", stat: "crit", perRank: 5 }, branch: "core" },
      { id: "sk_reap_edge", name: "لبه‌ی قربانگاه", icon: "🗡️", desc: "تیغت از خطِ سرخِ خودش گذشته.", type: "passive", unlockLevel: 9, maxRank: 3, spCost: 2, effect: { kind: "stat", stat: "atk", perRank: 1.5 }, branch: "core" },
      // V10 — مسیرِ زندگی: گل‌فروشِ سرچشمه
      { id: "sk_reap_shop", name: "گل‌فروشیِ سرچشمه", icon: "🌹", desc: "دکمه‌ی گل دستِ مشتری، دستمزدِ بهترین را می‌گیرد. % حقوقِ شیفت بیشتر.", type: "passive", unlockLevel: 4, maxRank: 3, spCost: 1, effect: { kind: "economy", param: "payout", perRank: 4 }, branch: "life", requires: "sk_reap_momentum" },
      { id: "sk_reap_dew", name: "شبنمِ سرخ", icon: "🌧️", desc: "شبنمِ صبح، گلِ دیروز را نمی‌ترساند — آرام می‌کند. % روحیه‌ی تعامل بیشتر.", type: "passive", unlockLevel: 8, maxRank: 3, spCost: 1, effect: { kind: "life", param: "spiritGain", perRank: 8 }, branch: "life", requires: "sk_reap_shop" },
      // V10 — قله‌ی هنر
      { id: "sk_reap_altar", name: "قربانگاهِ تاریک", icon: "🕯️", desc: "در تاریکی، خطِ سرخِ تو تنها خطِ روشنِ میدان است. بحرانیِ بیشتر.", type: "passive", unlockLevel: 12, maxRank: 2, spCost: 2, effect: { kind: "stat", stat: "crit", perRank: 6 }, branch: "art", requires: "sk_reap_pact", evolutionReq: 1 },
    ],
    evolutions: [
      { name: "دَروگرِ سرخ", emoji: "🌹", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "گلِ سرخی که از دَرو به یادگار ماند.", pathLabel: "مسیرِ دَرو", statBonus: { atk: 2, crit: 2 } },
      { name: "شب‌چراغِ گلِ سرخ", art: "/art/classes/reaper-a2.png", emoji: "🥀", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "هر شب‌چراغی که روشن می‌شود، یک دَرو را روشن کرده.", pathLabel: "مسیرِ دَرو", statBonus: { atk: 3, crit: 4 } },
      { name: "مِهرِ سرخِ جاودان", art: "/art/classes/reaper-a3.png", emoji: "♥️", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "خون یاد گرفت به نفعِ تو جریان پیدا کند.", pathLabel: "مسیرِ دَرو", statBonus: { atk: 5, crit: 6 } },
    ],
    evolutionAlt: [
      { name: "باغبانِ شب", emoji: "🌷", reqLevel: 8, reqWins: 3, statMult: 1.06, lore: "به‌جای درو، کاشتنی — و شهر گل‌هایش را از تو می‌خرد.", pathLabel: "مسیرِ باغ", statBonus: { def: 3, luck: 3 } },
      { name: "نگهبانِ گلخانه", art: "/art/classes/reaper-b2.png", emoji: "🪴", reqLevel: 16, reqWins: 10, statMult: 1.12, lore: "گلخانه‌ات در شب‌های طوفان، پناهگاهِ گل‌های همه‌ی شهر است.", pathLabel: "مسیرِ باغ", statBonus: { def: 5, luck: 5 } },
      { name: "باغبانِ جاودانِ بهار", art: "/art/classes/reaper-b3.png", emoji: "🌸", reqLevel: 28, reqWins: 25, statMult: 1.2, lore: "بهارِ شهر اسم دارد — و اسمش دستِ توست.", pathLabel: "مسیرِ باغ", statBonus: { def: 8, luck: 8 } },
    ],
    lore: {
      intro: "در گل‌فروشیِ سرچشمه، دختری بود که مشتری‌های بد روبراه می‌کرد. حالا او مالکِ گل‌فروشی است — با قیمتی که خودش تعیین می‌کند.",
      deep: [
        "دروگرهای سرخ از آیینِ «ششِ آخرِ پاییز» می‌آیند: شش قطره امروز، یک پیروزیِ فردا.",
        "قانونِ دَرو: هر قیمتی که مخفی باشد، دو برابرِ قیمتِ آشکار است.",
        "مِهرِ سرخِ جاودان دیگر خون نمی‌دهد — خون، به او داده می‌شود.",
      ],
    },
    art: "/art/classes/reaper.jpg",
    palette: { primary: "#fb7185", soft: "#3a1f28" },
  },
]

export const CLASS_MAP: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.key, c]))

export function getClass(key: string): ClassDef | null {
  return CLASS_MAP[key] ?? null
}

// ─── V10: کلاس-تسلط (Class Mastery) ────────────────────────────────────────────
// تسلط از «استفاده‌ی معنادارِ مکانیک‌های کلاس» می‌آید — نه از فشردنِ دکمه.
// فقط اعمالِ واجدشرط XP می‌دهند (برد با کلاس، اجرای موفقِ مهارتِ امضا،
// اتفاقاتِ کمیابِ هم‌مسیرِ کلاس، شیفتِ اهدا شده) — و هر کدام سقفِ روزانه دارند.
export const MASTERY_TIERS: { level: number; emoji: string; label: string; perk: string }[] = [
  { level: 1, emoji: "🌱", label: "نوآموزِ راه", perk: "—" },
  { level: 2, emoji: "🍃", label: "راه‌آشنا", perk: "—" },
  { level: 3, emoji: "🥾", label: "راه‌رونده", perk: "2+ حداکثرِ استقامت" },
  { level: 4, emoji: "🧭", label: "راهنما", perk: "—" },
  { level: 5, emoji: "🎓", label: "استادِ کلاس", perk: "1 نقطه‌مهارت + 3% پاداشِ دستمزدِ شیفت" },
  { level: 6, emoji: "⭐", label: "استادِ راه", perk: "—" },
  { level: 7, emoji: "🌟", label: "استادِ بزرگ", perk: "2+ حداکثرِ استقامت + 3% جایزه‌ی نبرد" },
  { level: 8, emoji: "💫", label: "رهروِ فن", perk: "—" },
  { level: 9, emoji: "🔥", label: "آتشِ فن", perk: "—" },
  { level: 10, emoji: "👑", label: "افسانه‌ی کلاس", perk: "2 نقطه‌مهارت + 5% پاداشِ دستمزد و جایزه" },
]

/** سطحِ تسلط از XP — قانونِ ثابت: lvl = ⌊√(xp/20)⌋ (کفِ 1، سقفِ 10) */
export function masteryLevelOf(xp: number): number {
  if (xp <= 0) return 1
  return Math.max(1, Math.min(10, Math.floor(Math.sqrt(xp / 20))))
}

/** XP لازم برای رسیدن به سطحِ بعدیِ تسلط (null = سقف) */
export function masteryNextXp(level: number): number | null {
  if (level >= 10) return null
  return (level + 1) * (level + 1) * 20
}

export function masteryTierOf(level: number) {
  return MASTERY_TIERS[Math.max(0, Math.min(9, level - 1))]
}

// ─── اعتبارسنجیِ محتوا (در بارگذاری؛ config کد اجرا نمی‌کند) ──────────────────
export function validateClasses(): string[] {
  const errs: string[] = []
  const keys = new Set<string>()
  const skillIds = new Set<string>()
  for (const c of CLASSES) {
    if (keys.has(c.key)) errs.push(`کلاسِ تکراری: ${c.key}`)
    keys.add(c.key)
    for (const s of [...c.skills, { id: c.activeSkill.id } as { id: string }]) {
      if (skillIds.has(s.id)) errs.push(`مهارتِ تکراری: ${s.id}`)
      skillIds.add(s.id)
    }
    if (c.evolutions.length !== 3) errs.push(`${c.key}: فرگشت باید 3 مرحله باشد`)
    if (c.evolutionAlt.length !== 3) errs.push(`${c.key}: شاخه‌ی دومِ فرگشت باید 3 مرحله باشد`)
    for (const s of c.skills) {
      if (s.unlockLevel < 1 || s.unlockLevel > 30) errs.push(`${c.key}/${s.id}: سطحِ بازشدگی نامعتبر`)
      if (s.maxRank < 1 || s.maxRank > 5) errs.push(`${c.key}/${s.id}: maxRank نامعتبر`)
      if (s.spCost < 1) errs.push(`${c.key}/${s.id}: هزینه‌ی نامعتبر`)
      if (s.effect.kind === "stat" && s.effect.perRank === 0) errs.push(`${c.key}/${s.id}: اثرِ صفر`)
      if (s.effect.kind === "passive" && s.effect.param === "crimsonCost" && s.effect.perRank >= 0)
        errs.push(`${c.key}/${s.id}: عهدِ خون باید کاهشی باشد`)
      // V10 — درخت: پیش‌نیاز باید همین کلاس باشد و زودتر باز شود
      if (s.requires) {
        const req = c.skills.find((x) => x.id === s.requires)
        if (!req) errs.push(`${c.key}/${s.id}: پیش‌نیازِ ناشناخته ${s.requires}`)
        else if (req.unlockLevel >= s.unlockLevel) errs.push(`${c.key}/${s.id}: پیش‌نیاز باید زودتر باز شود`)
      }
      if (s.evolutionReq !== undefined && (s.evolutionReq < 1 || s.evolutionReq > 3))
        errs.push(`${c.key}/${s.id}: evolutionReq نامعتبر`)
    }
    // مسیرِ فرگشت باید صعودی باشد
    const evs = c.evolutions
    if (!(evs[0].reqLevel < evs[1].reqLevel && evs[1].reqLevel < evs[2].reqLevel)) errs.push(`${c.key}: سطح‌های فرگشت نامعودی`)
    if (!(evs[0].reqWins < evs[1].reqWins && evs[1].reqWins < evs[2].reqWins)) errs.push(`${c.key}: بردهای فرگشت نامعودی`)
    // V10 — شاخه‌ی دوم باید همان نیازها را داشته باشد (انتخاب، نه میان‌بُر)
    for (let i = 0; i < 3; i++) {
      const a = c.evolutions[i]
      const b = c.evolutionAlt[i]
      if (a.reqLevel !== b.reqLevel || a.reqWins !== b.reqWins)
        errs.push(`${c.key}: مرحله‌ی ${i + 1} — شاخه‌ها باید نیازِ یکسان داشته باشند`)
    }
    // آمارهای پایه معقول
    for (const [k, v] of Object.entries(c.base)) {
      if (!Number.isFinite(v) || v < 0) errs.push(`${c.key}: آمارِ پایه‌ی خراب ${k}=${v}`)
    }
    // V14 — توصیفِ امضا باید مقدارِ پایه را عیناً داشته باشد (رقمِ انگلیسی):
    // رانشِ متن/داده همان‌جا و در بارگذاری فوراً فاش می‌شود
    for (const [k, v] of Object.entries(c.passive.base)) {
      if (typeof v !== "number" || !Number.isFinite(v)) {
        errs.push(`${c.key}: پارامترِ امضای خراب ${k}=${String(v)}`)
        continue
      }
      if (!c.passive.desc.includes(String(v))) {
        errs.push(`${c.key}: توصیفِ امضا مقدارِ ${k}=${v} را ندارد — متن باید با داده یکی باشد`)
      }
    }
    if (!c.art.startsWith("/art/classes/") || !c.art.endsWith(".jpg")) errs.push(`${c.key}: مسیرِ آرت نامعتبر`)
  }
  return errs
}

// اجرا در بارگذاری — محتوای خراب بالا نمی‌آید
const _validationErrors = validateClasses()
if (_validationErrors.length > 0) {
  throw new Error(`FEMBOY WAR V7 — خطای محتوای کلاس‌ها:\n${_validationErrors.join("\n")}`)
}
