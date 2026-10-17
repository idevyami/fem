// FEMBOY WAR — V7: رژه‌ی دشمنان (PvE)
// دشمنانِ شهرِ فمبوی — هم‌راستا با جهانِ بازی (شهرِ ایرانیِ نئون‌وشیشه‌ای).
// tier پلکانی؛ سطحِ بازیکن تعیین می‌کند کدام‌ها را می‌بیند.

export interface EnemyDef {
  key: string
  emoji: string
  name: string
  tier: 1 | 2 | 3 | 4
  minLevel: number // بازیکنِ زیرِ این سطح این دشمن را نمی‌بیند
  hp: number
  atk: number
  def: number
  dodge: number
  acc: number
  crit: number
  speed: number
  xp: number // XP نبرد
  money: [number, number] // بازه‌ی سکه
  special?: string // توضیحِ مکانیکِ ویژه (نمایش)
  flavor: string // یک‌خطِ معرفی
  taunts: string[] // خطِ راند
}

export const ENEMIES: EnemyDef[] = [
  // ─── Tier 1: کوچه‌ها ────────────────────────────────────────────────────────
  {
    key: "chain_cat",
    emoji: "🐈‍⬛",
    name: "گربه‌ی زنجیره‌ایِ کوچه",
    tier: 1,
    minLevel: 1,
    hp: 58, atk: 13, def: 2, dodge: 14, acc: 82, crit: 8, speed: 11,
    xp: 14, money: [40, 90],
    special: "هر سه راند یک‌بار خش‌می‌گیرد و دو ضربه می‌زند.",
    flavor: "زنجیرش را از لوله‌ی بخار باز کرده و حالا فکر می‌کند صاحبِ کوچه است.",
    taunts: ["شلوولولو!", "مِیو؟ نه. مِیـو!"],
  },
  {
    key: "ribbon_tout",
    emoji: "🎀",
    name: "تودَمِ روبان‌فروش",
    tier: 1,
    minLevel: 1,
    hp: 62, atk: 13, def: 3, dodge: 8, acc: 86, crit: 6, speed: 9,
    xp: 16, money: [60, 120],
    flavor: "روبان‌های قلابی‌اش را با قیمتِ طلا می‌فروشد؛ خریدارِ اعتراض‌کننده «مشتریِ ویژه» می‌شود.",
    taunts: ["این روبانِ اصلِ ژاپنه داداش!", "خرید نکردی؟ پس دعواست."],
  },
  {
    key: "earring_crow",
    emoji: "🐦‍⬛",
    name: "کلاغِ دزدِ گوشواره",
    tier: 1,
    minLevel: 2,
    hp: 56, atk: 14, def: 1, dodge: 20, acc: 88, crit: 12, speed: 13,
    xp: 18, money: [70, 150],
    special: "گریزش بالاست؛ ضربه‌های ناامیدکننده‌ای می‌خورَدت.",
    flavor: "گوشواره‌ی مامان‌بزرگ را دزدیده و حالا مدعی مالکیتِ چراغِ خیابان هم هست.",
    taunts: ["قا-قاشنگ!", "بکِر! بکِر!"],
  },
  {
    key: "park_dog",
    emoji: "🐕",
    name: "سگِ نگهبانِ پارک",
    tier: 1,
    minLevel: 3,
    hp: 66, atk: 14, def: 4, dodge: 6, acc: 84, crit: 5, speed: 8,
    xp: 20, money: [50, 110],
    flavor: "ساعتِ 11 شب، واخ‌واخِ رسمی پارک. هیچ‌کس نمی‌داند حقوقش را کی می‌دهد.",
    taunts: ["واخ! واخ! واخ!", "گوشتِ کنسروی وعده داده بودن!"],
  },
  // ─── Tier 2: بازارِ شب ──────────────────────────────────────────────────────
  {
    key: "ribbon_smuggler",
    emoji: "🎁",
    name: "قاچاقچیِ روبان",
    tier: 2,
    minLevel: 5,
    hp: 140, atk: 21, def: 6, dodge: 12, acc: 88, crit: 10, speed: 11,
    xp: 34, money: [140, 280],
    special: "سومین ضربه‌اش «بسته‌ی قاچاق» است: 150% آسیب.",
    flavor: "مخفیانه روبانِ ممنوعه می‌فروشد — روبانی که رنگش از فامیلِ شهردار خوش‌تر است.",
    taunts: ["بیزینس خانوادگیه، دخالت نکن.", "رسیدش هنوز از گمرک نیومده!"],
  },
  {
    key: "knife_flirt",
    emoji: "🗡️",
    name: "مماسِ چاق‌به‌چاقِ فسقلی",
    tier: 2,
    minLevel: 6,
    hp: 125, atk: 23, def: 4, dodge: 16, acc: 90, crit: 14, speed: 13,
    xp: 38, money: [120, 260],
    flavor: "اول تعارف می‌کند، بعد چاقو. ترتیبش همیشه همین است.",
    taunts: ["خودتی جنی؟ خودتم بُرو ببین!", "دعوا کِی شروع شه؟"],
  },
  {
    key: "angry_chef",
    emoji: "🍳",
    name: "آشپزِ خشمگینِ کافه",
    tier: 2,
    minLevel: 7,
    hp: 150, atk: 20, def: 9, dodge: 5, acc: 86, crit: 6, speed: 7,
    xp: 40, money: [130, 300],
    special: "«مویسِ تندِ ویژه»: ضربه‌ی آتیشی که گارد را 25% کم‌تر کار می‌کند.",
    flavor: "کیفِ غذا را زیرِ سؤال بردی. حالا ماهیتابه در دست و آبرویش در خطر است.",
    taunts: ["سُس گیر کرده تو دندونات؟!", "این‌همه سال دستِ من طلا بوده!"],
  },
  {
    key: "bridge_hexer",
    emoji: "🌀",
    name: "ساحرِ نیمه‌کاره‌ی زیرِ پل",
    tier: 2,
    minLevel: 8,
    hp: 125, atk: 23, def: 5, dodge: 10, acc: 85, crit: 12, speed: 9,
    xp: 44, money: [160, 340],
    special: "هر چهار راند «طلسمِ نیمه‌کاره»: دقتِ تو 15% کم می‌شود.",
    flavor: "نصفِ طلسمش کار می‌کند؛ کدام نصف؟ هر بار یکی.",
    taunts: ["أبر... کدومش بود؟!", "طلسمتم نصفه — عشقتم نصفه."],
  },
  // ─── Tier 3: عمقِ شهر ───────────────────────────────────────────────────────
  {
    key: "subway_warden",
    emoji: "🚇",
    name: "دخمه‌بانِ مترو",
    tier: 3,
    minLevel: 10,
    hp: 215, atk: 30, def: 12, dodge: 8, acc: 88, crit: 8, speed: 9,
    xp: 70, money: [280, 520],
    special: "زیرِ 30% خون، «شیفتِ شب»: +30% آسیب.",
    flavor: "بیست‌سال است آخرین قطار را ندیده و نمی‌گذارد کس دیگری ببیند.",
    taunts: ["بلیتت کجاست؟", "شیفتِ شب تموم نمی‌شه، بچّه."],
  },
  {
    key: "cinema_ghost",
    emoji: "👻",
    name: "شبحِ سینمای قدیمی",
    tier: 3,
    minLevel: 12,
    hp: 185, atk: 32, def: 7, dodge: 22, acc: 86, crit: 14, speed: 14,
    xp: 80, money: [300, 600],
    special: "«دیالوگِ آخرِ فیلم»: هر پنجمین راند یک‌بار، ضربه‌ی 160% با روایت.",
    flavor: "هنوز منتظرِ پایانِ فیلمیه که سالِ 65 نیمه‌کاره قطع شد.",
    taunts: ["این پارتِ منه!", "چراغا رو خاموش نکنید..."],
  },
  {
    key: "night_bull",
    emoji: "🐂",
    name: "گاوِ نرِ بازارِ شب",
    tier: 3,
    minLevel: 14,
    hp: 240, atk: 30, def: 14, dodge: 4, acc: 85, crit: 6, speed: 8,
    xp: 90, money: [340, 640],
    special: "اولِ نبرد «شروعِ چارگوش»: تا وقتی گارد نکنی، 25% بیشتر می‌خوری.",
    flavor: "کسی توی قفسِ گاوی یک عروسکِ روبانی به گردنش انداخته. حالا دیگر مهم نیست؛ فقط نبرد.",
    taunts: ["قِر قِر!", "راه بده، پیام ندارم!"],
  },
  {
    key: "hawala_enforcer",
    emoji: "🕴️",
    name: "حواله‌دارِ مافیایی",
    tier: 3,
    minLevel: 16,
    hp: 210, atk: 35, def: 10, dodge: 12, acc: 92, crit: 12, speed: 12,
    xp: 105, money: [420, 800],
    special: "«وصولِ قسط»: هر ضربه‌اش 5% از سکه‌ی کیفِ نبردِ تو کم می‌کند.",
    flavor: "دفترش یک قلم‌دان و یک چاقوست؛ هر دو همیشه امضا می‌کنند.",
    taunts: ["قسطِ این‌هفته جایی نره.", "حسابِ تو داره سنگین می‌شه."],
  },
  // ─── Tier 4: افسانه‌ها ──────────────────────────────────────────────────────
  {
    key: "fallen_diamond",
    emoji: "💎",
    name: "فرشته‌ی سقوط‌کرده‌ی الماس",
    tier: 4,
    minLevel: 17,
    hp: 300, atk: 40, def: 16, dodge: 14, acc: 93, crit: 16, speed: 15,
    xp: 150, money: [700, 1200],
    special: "«تابشِ استِلار»: هر سومین راند پرتو می‌زند — گارد لازم است.",
    flavor: "از شاخه‌های نئونِ برجِ الماس افتاد؛ حالا زمینِ شهر را می‌شناسد و خوشش نیامده.",
    taunts: ["من از جنسِ ستاره‌ام.", "شهرِ شما کثیف است."],
  },
  {
    key: "vault_dragon",
    emoji: "🐉",
    name: "اژدهای کوچکِ گاوصندوق",
    tier: 4,
    minLevel: 20,
    hp: 355, atk: 43, def: 20, dodge: 8, acc: 90, crit: 10, speed: 10,
    xp: 190, money: [900, 1600],
    special: "«نفَسِ تومانی»: آتشِ گاوصندوق — گارد بدونش بی‌معناست.",
    flavor: "روی سکه‌های قدیمی خوابیده و هرکس بیدارش کند، بدهکار بیدار می‌شود.",
    taunts: ["هر سکه‌ای شماره داره!", "بیدارم — بدهکارم."],
  },
  {
    key: "neon_queen",
    emoji: "🐝",
    name: "ملکه‌ی زنبورهای نئون",
    tier: 4,
    minLevel: 24,
    hp: 330, atk: 45, def: 14, dodge: 18, acc: 95, crit: 18, speed: 18,
    xp: 240, money: [1100, 2000],
    special: "«گره‌گلِ نئون»: هر ضربه‌ی بحرانی، زنبور اضافه می‌کند (حداکثر 5) — هر زنبور 15% آسیبِ اضافه.",
    flavor: "چراغ‌های خیابان، کندویِ او هستند و شهر، باغِ گلِ سرخش.",
    taunts: ["کل شهر عسلِ منه.", "نئون هرگز نمی‌خوابد."],
  },
]

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.key, e]))

export function getEnemy(key: string): EnemyDef | null {
  return ENEMY_MAP[key] ?? null
}

/** دشمنانِ در دسترسِ بازیکن (سطح‌ِ کافی) — برای صفحه‌ی شکار */
export function availableEnemies(level: number): EnemyDef[] {
  return ENEMIES.filter((e) => level >= e.minLevel)
}

// اعتبارسنجیِ بارگذاری
const _errs: string[] = []
const _keys = new Set<string>()
for (const e of ENEMIES) {
  if (_keys.has(e.key)) _errs.push(`دشمنِ تکراری: ${e.key}`)
  _keys.add(e.key)
  if (e.hp <= 0 || e.atk <= 0) _errs.push(`${e.key}: آمارِ خراب`)
  if (e.money[0] > e.money[1]) _errs.push(`${e.key}: بازه‌ی سکه معکوس`)
  if (e.taunts.length === 0) _errs.push(`${e.key}: بدونِ taunt`)
  if (![1, 2, 3, 4].includes(e.tier)) _errs.push(`${e.key}: tier نامعتبر`)
}
if (_errs.length > 0) throw new Error(`FEMBOY WAR V7 — خطای محتوای دشمنان:\n${_errs.join("\n")}`)
