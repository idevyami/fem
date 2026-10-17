import type { GlobalEventDef, AchievementDef, TitleDef } from "../types"

export const GLOBAL_EVENTS: GlobalEventDef[] = [
  {
    key: "red_moon",
    name: "ماه قرمز",
    emoji: "🌕",
    description: "امشب ماه قرمز شده. NPCها رفتار عجیب دارند. قیمت بعضی آیتم‌ها بالا رفته. بعضی Eventها فقط امشwohl فعال‌اند.",
    feedText: "🌕 امشب ماه قرمز شده. تمام شهر تغییر کرده.",
    durationMinutes: 120,
    weight: 8,
    effects: {
      weather: "red_moon",
      mood: "weird",
      chaos: 15,
      priceBoost: { itemKeys: ["nazar", "lucky_charm", "blue_flower"], percent: 30 },
    },
  },
  {
    key: "duck_day",
    name: "روز اردک",
    emoji: "🦆",
    description: "امروز اردک‌ها صاحب شهرند. هیچ‌کس نمی‌داند این یعنی چه. اردک‌ها هم توضیح نمی‌دهند.",
    feedText: "🦆 امروز روز اردک است. سؤال نپرسید. اردک‌ها دوست ندارند.",
    durationMinutes: 180,
    weight: 5,
    effects: {
      mood: "festive",
      chaos: 10,
      boostCategory: "absurd",
      priceBoost: { itemKeys: ["duck"], percent: 50 },
    },
  },
  {
    key: "black_friday",
    name: "جمعه‌ی سیاه بازار",
    emoji: "🏷",
    description: "آرش یه جشنواره تخفیف راه انداخته. همه‌چیز ارزون‌تره. تا وقتی هست.",
    feedText: "🏷 بازار امروز جشنواره تخفیف دارد. آرش می‌گوید «فقط امروز». همیشه می‌گوید.",
    durationMinutes: 90,
    weight: 9,
    effects: {
      economyIndex: 70,
      mood: "festive",
    },
  },
  {
    key: "storm",
    name: "طوفان",
    emoji: "⛈",
    description: "طوفان شهر رو گرفته. بعضی مسیرها بسته‌ان، بعضی چیزها شسته می‌شن پایین.",
    feedText: "⛈ طوفان آمده. شهر نفسش را حبس کرده.",
    durationMinutes: 100,
    weight: 7,
    effects: {
      weather: "storm",
      mood: "tense",
      chaos: 8,
    },
  },
  {
    key: "strange_static",
    name: "اختلال",
    emoji: "📡",
    description: "همه رادیوها و تلویزیون‌ها یه صدای ثابت پخش می‌کنند که شبیه زمزمه‌ست. رقیه چیزی نمی‌گوید.",
    feedText: "📡 اختلال عجیبی در شهر. همه صدای ثابت می‌شنوند. بعضی‌ها کلمه می‌شنوند.",
    durationMinutes: 150,
    weight: 5,
    effects: {
      mood: "weird",
      chaos: 12,
      boostCategory: "mystery",
    },
  },
  {
    key: "harvest_fest",
    name: "جشنواره‌ی حومه",
    emoji: "🎃",
    description: "حومه میزبان است. همه مهمانند. حتی اونایی که دعوت نشدن. مخصوصاً اونا.",
    feedText: "🎃 جشنواره‌ی حومه شروع شد. همه دعوتند. حتی اونایی که نیستند.",
    durationMinutes: 200,
    weight: 6,
    minWorldDay: 3,
    effects: {
      mood: "festive",
      economyIndex: 115,
      boostCategory: "wholesome",
    },
  },
  {
    key: "silent_day",
    name: "روز سکوت",
    emoji: "🤫",
    description: "امروز همه ساکت‌اند. نه عزاست نه مراسمی. فقط سکوت. گوش بده؛ شهر چیزی می‌گوید.",
    feedText: "🤫 امروز روز سکوت است. حرف نزن. گوش بده.",
    durationMinutes: 120,
    weight: 4,
    effects: {
      mood: "calm",
      chaos: -10,
      boostCategory: "dark",
    },
  },
]

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "good_samaritan", name: "نېکوکار", emoji: "😇", description: "کیفی را به صاحبش برگرداندی. در این شهر، این یک اتفاق است." },
  { key: "burned_the_card", name: "سوزاننده", emoji: "🔥", description: "کارت سبز را سوزاندی. بعضی دعوت‌ها را باید سوزاند." },
  { key: "cat_person", name: "گربه‌باز", emoji: "🐈", description: "یک گربه تو را انتخاب کرد. انتخابش را قبول کردی." },
  { key: "duck_lord", name: "خداوندگار اردک", emoji: "🦆", description: "یک اردک در خانه‌ات ماند. ماندگار." },
  { key: "the_duck", name: "دارنده‌ی اردک", emoji: "🦆", description: "اردک لاستیکی مقدس مال توست. افسانه‌ها راکد نمی‌مانند." },
  { key: "duck_procession", name: "شاهد رژه", emoji: "🎖", description: "رژه‌ی اردک‌ها را دیدی و احترام گذاشتی." },
  { key: "the_bench", name: "نشنیده که می‌شنود", emoji: "🪑", description: "کنار کسی نشستی که هیچ‌کس نمی‌بیند." },
  { key: "said_no", name: "نه‌گو", emoji: "✋", description: "به ماشین خاکستری «نه» گفتی. شهر روشن نگه می‌دارد." },
  { key: "tree_climber", name: "درخت‌نورد", emoji: "🌳", description: "برای یک بچه‌گربه از درخت بالا رفتی." },
  { key: "quiet_kindness", name: "مهربانیِ بی‌شاهد", emoji: "🕯", description: "کسی نبود ببیند. انجامش دادی." },
  { key: "slept_through_it", name: "خواب‌آلود", emoji: "😴", description: "به پیشنهاد عجیب گفتی نه و خوابیدی." },
  { key: "mahoor_table", name: "مهمانِ میز", emoji: "☕", description: "بعد از بسته‌شدن کافه، پای میز ماهور نشستی." },
  { key: "bench_sitter", name: "نشسته‌ی نیمکت", emoji: "🪑", description: "روی نیمکتی نشستی که همیشه خالی است." },
  { key: "crossing_guard", name: "راهنمای چهارراه", emoji: "🚸", description: "دستِ پیرمردِ چهارراه را گرفتی." },
  { key: "witness_of_the_well", name: "شاهدِ چاه", emoji: "🕳", description: "به چاه گفتی «می‌دانم هستی». چاه شنید." },
  { key: "survivor", name: "زنده‌مانده", emoji: "🫀", description: "7 روز در این شهر زندگی کردی. خودت می‌دانی یعنی چه.", hidden: true },
  { key: "deep_debt", name: "غرق در بدهی", emoji: "⛓", description: "بدهی‌ات از 10,000 گذشت. دایی فرهاد نامت را قاب کرده.", hidden: true },
  { key: "chaos_agent", name: "عامل آشوب", emoji: "🌀", description: "آشوب‌ات به 50 رسید. شهر خودش را به تو منتسب می‌کند.", hidden: true },
  { key: "local_celebrity", name: "چهره‌ی شهر", emoji: "🌟", description: "شهرت‌ات به 50 رسید. آدم‌ها تو کوچه‌ها برمی‌گردند.", hidden: true },
  { key: "lawbringer", name: "چشمِ قانون", emoji: "⚖", description: "سابقه‌ی جنایی‌ات صفر شد وقتی روزگار جنایی داشتی.", hidden: true },
  // ── V8: نقاطِ عطفِ فمبوی — فرگشت/تسلط/دوئل/پیوند ──
  { key: "first_evolution", name: "اولین دگردیسی", emoji: "🦋", description: "فمبویت برای اولین‌بار فرگشت یافت. اسم همان ماند؛ چیزِ دیگری شد." },
  { key: "final_evolution", name: "آخرین دگردیسی", emoji: "✨", description: "فمبویت به فرمِ سوم و نهایی رسید. از این‌جا به بعد فقط افسانه می‌شود." },
  { key: "class_master", name: "استادِ کلاس", emoji: "🎓", description: "کلاس-تسلطِ فمبویت به سطح 5 رسید. راه، دیگر عادت نیست؛ خانه است." },
  { key: "first_duel_win", name: "بردِ اولِ میدان", emoji: "⚔️", description: "اولین دوئلت را بردی. حریف هنوز دنبالِ توضیح است." },
  { key: "duel_veteran", name: "کهنه‌کارِ میدان", emoji: "🥇", description: "10 دوئل بردی. میدان، دیگر غریبه نیست." },
  { key: "bond_hundred", name: "پیوندِ صد", emoji: "💞", description: "پیوندِ فمبویت با تو به 100 رسید. سنجاقِ قلب فقط علامتِ بیرونیِ آن است." },
]

export const TITLES: TitleDef[] = [
  { key: "newcomer", name: "تازه‌وارد", emoji: "🚪", description: "این شهر هنوز تصمیم نگرفته درباره‌ت." },
  { key: "strange_one", name: "عجیب‌بَر", emoji: "🌀", description: "آدم‌های عادی هم عجیب‌اند. تو یک پله بالاتری." },
  { key: "duck_lord_title", name: "خداوندگارِ اردک", emoji: "🦆", description: "اردک‌ها رأی دادند. رأی آوردی." },
  { key: "night_walker", name: "شب‌گرد", emoji: "🌙", description: "خیابان‌های شب، اسمت را بلدند." },
  { key: "bench_keeper", name: "نگهبانِ نیمکت", emoji: "🪑", description: "نیمکت خالی دیگر تنها خالی نیست." },
  { key: "chosen_by_butterflies", name: "منتخبِ پروانه‌ها", emoji: "🦋", description: "دسته‌ای که مثل یک فکر حرکت می‌کنند، تو را شناختند." },
  { key: "redeemed", name: "آمرزیده", emoji: "🕊", description: "کارنامه‌ات از یکی از این چاه‌ها بیرون آمد پاک." },
  // ── V8: عنوان‌هایِ نقاطِ عطفِ فمبوی ──
  { key: "only_legend", name: "فقط افسانه", emoji: "🌟", description: "به آخرِ راهِ فرگشت رسیدی. از این‌جا فقط افسانه می‌شود." },
  { key: "mastery_legend", name: "افسانه‌ی کلاس", emoji: "👑", description: "کلاس-تسلط در پله‌ی 10 نشست. شاگردی تمام شد؛ معلم شدی." },
  { key: "duel_champion", name: "قهرمانِ دوئل", emoji: "⚔️", description: "10 دوئل بردی. میدان، اسمِ فمبویت را قاب کرده." },
]

export const GLOBAL_EVENT_MAP: Record<string, GlobalEventDef> = Object.fromEntries(GLOBAL_EVENTS.map((g) => [g.key, g]))
export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]))
export const TITLE_MAP: Record<string, TitleDef> = Object.fromEntries(TITLES.map((t) => [t.key, t]))

export function getGlobalEvent(key: string): GlobalEventDef | undefined {
  return GLOBAL_EVENT_MAP[key]
}
