import type { JobDef, VehicleDef, HouseDef } from "../types"

export const JOBS: JobDef[] = [
  {
    key: "barista",
    name: "باریستای کافه‌ی ماهور",
    emoji: "☕",
    description: "قهوه دم کن، حرف گوش بده، از ساندویچ‌ها مراقبت کن.",
    income: [220, 400],
    energyCost: 15,
    risk: 0.05,
    cooldownMinutes: 45,
    minLevel: 1,
    quirks: "خانم ماهور گاهی یه مهمانی کوچیک بهت می‌ده",
    workLines: [
      "یه شیفت تمیز. خانم ماهور گفت «دستت درد نکنه». از دهنش در اومد، نادیده بگیر.",
      "یه مشتری انگلیسی داشت. برای دفعه‌ی بعد بهش «اسپرسو بدون آب» فروختی. خوشش اومد.",
      "شیفت آرام بود. به فکر فرو رفتی.",
    ],
    failLines: ["یه لیوان روی لپ‌تاپ یه مشتری ریخت. ماهور نگاهت کرد. کافیه."],
  },
  {
    key: "courier",
    name: "پیک موتوری",
    emoji: "🛵",
    description: "بسته بده، بسته بگیر، تو ترافیک دعا کن.",
    income: [300, 650],
    energyCost: 25,
    risk: 0.22,
    cooldownMinutes: 40,
    minLevel: 1,
    quirks: "چaos بالا یعنی سفارش‌های عجیب‌تر و پرپرداخت‌تر",
    workLines: [
      "امروز فقط بسته‌های معمولی. یکی‌شون تکان می‌خورد ولی خب، حقوقه.",
      "یه بسته رو رساندی که آدرسش یه خونه‌ی که نباید باشه بود. پولش خوب بود.",
      "رکورد سرعت زدی. از خودت بیمناک شدی.",
    ],
    failLines: [
      "یه ماشین قرمز جلو زد و بسته‌ها پخش شد. راننده داد زد. تو آرام موندی. این یک مهارته.",
      "بارون گرفت و بسته‌ی «شکستنی» خیس شد. هنوز نمی‌دونی چی توش بود.",
    ],
  },
  {
    key: "shopkeeper",
    name: "نوکری مغازه‌ی عمو قنبر",
    emoji: "🛒",
    description: "قفسه مرتب کن، به قصه‌ها گوش بده، یادت باشه چی کجاست.",
    income: [180, 320],
    energyCost: 12,
    risk: 0.04,
    cooldownMinutes: 50,
    minLevel: 1,
    quirks: "عمو قنبر گاهی یه وسیله‌ی قدیمی بهت می‌بخشه",
    workLines: [
      "عمو قنبر کل روز از «اون سال‌ها» حرف زد. حقوقت رو هم کمی بیشتر داد که شنیده باشی.",
      "یه مشتری اومد سراغ جنس «قفسه‌ی پشتی». جوابش رو دادی. قنبر لبخند زد.",
      "مرتب‌سازی امروز راحتی بود. تقریباً خوابیدی.",
    ],
    failLines: ["یه جعبه رو غلط جا گذاشتی. قنبر هیچی نگفت. این بدتر از داد زدنه."],
  },
  {
    key: "night_shift",
    name: "شیفت‌شب کارخانه",
    emoji: "🏭",
    description: "از 10 شب تا 6 صبح. صدای ماشین‌ها بعد یه مدتی مثل موسیقی میشه.",
    income: [400, 800],
    energyCost: 40,
    risk: 0.3,
    cooldownMinutes: 90,
    minLevel: 3,
    quirks: "چیزهایی که شب‌ها تو خط تولید می‌گذره رو به هیچ‌کس نگه نمی‌داره",
    workLines: [
      "شیفت ساده‌ای بود. فقط یه بار تسمه‌ی نقاله خودش توقف کرد. معلوم نبود چرا.",
      "مهندسا یه دستگاه رو از خط خارج کردن. با چادر پوشوندنش. تو خیره شدی.",
      "پول خوبی در اومد. انرژیت نه.",
    ],
    failLines: [
      "دستگاه شماره‌ی 7 یه صدایی داد که همه رفتن و تو ماندی. خوشبختانه فقط قطعه ریخت.",
      "یه شیفت کامل خوابیدی سر پات. سرکل اتفاق نیفتاد. این بار.",
    ],
  },
  {
    key: "streamer",
    name: "استریمر",
    emoji: "📺",
    description: "از زندگیت محتوا بساز. تو این شهر، کمبود محتوا نیست.",
    income: [100, 1200],
    energyCost: 20,
    risk: 0.25,
    cooldownMinutes: 60,
    minLevel: 4,
    quirks: "شهرت بیشتر = درآمد بیشتر. آشوب بیشتر = وایرال‌تر.",
    workLines: [
      "استریم امروز رفت روی وایرال. دارن می‌گن «اون آدمِ عجیب». منظورشون تویی.",
      "یه لحظه واقعاً بامزه شد. کلیپش رو هنوز می‌فرستند.",
      "دونات گرفتی از کسی به اسم «DuckWatcher». هیچی نپرسیدی.",
    ],
    failLines: [
      "استریم قطع شد دقیقاً وسط بهترین قسمتش. برگشتی، فقط 2 نفر موندن. یکی‌شون خودت بودی.",
      "یه هیت کنم رفت. فالوورها گفتن «قبلاً هم این کار رو کرده بودی». کردن.",
    ],
  },
  {
    key: "mystery_contractor",
    name: "پیمانکارِ کارهای عجیب",
    emoji: "📋",
    description: "کارفرما ناشناس. شرح کار مبهم. پرداخت نقدی و دقیق.",
    income: [800, 2200],
    energyCost: 45,
    risk: 0.5,
    cooldownMinutes: 120,
    minLevel: 6,
    quirks: "سابقه‌ی جنایی و آشوب تأثیر مستقیم داره. بعضی کارها فقط برای بعضی آدم‌ها میاد.",
    workLines: [
      "کار انجام شد. هیچ‌سوالی نپرسیدی. کارفرما راضی بود. تو هم ولی دیگه.",
      "امشب فقط قرار بود یه جعبه رو از نقطه‌ی A به B ببری. گوشه‌ی جعبه خزه داشت.",
      "پول رو شمردی. دقیق بود. یه ریال کم و زیاد نه. این چیز خوبیه. فکر کنم.",
    ],
    failLines: [
      "کار خراب شد. کارفرما فقط یه پیام فرستاد: «دمت گرم.» ترسیدی.",
      "پلیس اومد ولی چیزی پیدا نکرد چون هنوز چیزی برنداشته بودی. این بار.",
    ],
  },
]

export const JOB_MAP: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.key, j]))

export function getJob(key: string | null | undefined): JobDef | null {
  if (!key) return null
  return JOB_MAP[key] ?? null
}

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export const VEHICLES: VehicleDef[] = [
  {
    key: "wobbly_bike",
    name: "دوچرخه‌ی لرزان",
    emoji: "🚲",
    rarity: "common",
    basePrice: 900,
    speed: 2,
    description: "فرمونش کمی می‌چرخه. زنگش کار می‌کنه. زنگش خیلی بلنده.",
    quirk: "صدای زنگش سگ‌ها رو گیج می‌کنه",
  },
  {
    key: "e_scooter",
    name: "اسکوتر الکتریکی",
    emoji: "🛴",
    rarity: "uncommon",
    basePrice: 2400,
    speed: 3,
    description: "باتری‌ش واقعیه. بردش واقعی نیست. ولی قشنگه.",
    quirk: "وقتی باتری تموم میشه خودش بوق می‌زنه",
  },
  {
    key: "black_bike",
    name: "موتور سیاه",
    emoji: "🏍",
    rarity: "rare",
    basePrice: 7500,
    speed: 4,
    description: "یکی‌ش می‌گفت این موتور قبلاً مال کسی بوده که «دیگه نیست». موتور مشکلی نداره.",
    quirk: "شب‌ها روشنش یه لحظه دیر میاد",
  },
  {
    key: "red_car",
    name: "ماشین قرمز قدیمی",
    emoji: "🚗",
    rarity: "epic",
    basePrice: 22000,
    speed: 5,
    description: "رادیوش فقط یه ایستگاه رو می‌گیره. همون ایستگاهی که forecast آب‌وهوا نمی‌ده، «پیش‌بینی» می‌کنه.",
    quirk: "برف‌پاک‌کنش گاهی خودکار کار می‌کنه، تو تابستون",
  },
]

export const VEHICLE_MAP: Record<string, VehicleDef> = Object.fromEntries(VEHICLES.map((v) => [v.key, v]))

export function getVehicle(key: string | null | undefined): VehicleDef | null {
  if (!key) return null
  return VEHICLE_MAP[key] ?? null
}

// ─── Houses ───────────────────────────────────────────────────────────────────

export const HOUSES: HouseDef[] = [
  {
    key: "attic",
    name: "اتاق زیر شیروانی",
    emoji: "🛏",
    price: 0,
    rent: 200,
    comfort: 1,
    security: 1,
    description: "یه تخت، یه پنجره، یه صدای تقی‌توق که شاید مال لوله‌ها باشه.",
  },
  {
    key: "small_flat",
    name: "آپارتمان کوچیک",
    emoji: "🏢",
    price: 6000,
    rent: 400,
    comfort: 2,
    security: 2,
    description: "دو اتاق. آسانسور پنج دقیقه‌ای میاد. بوی همسایه که ماهی می‌پزده یادت نمی‌ره.",
  },
  {
    key: "suburb_house",
    name: "خونه‌ی حومه",
    emoji: "🏡",
    price: 18000,
    rent: 300,
    comfort: 3,
    security: 3,
    description: "یه حیاط کوچیک با پرچین. شب‌ها علف‌ها صدا می‌دان. علف‌ها که صدا نمی‌دان.",
  },
  {
    key: "penthouse",
    name: "پنت‌هاوس لوکس",
    emoji: "🏙",
    price: 60000,
    rent: 1500,
    comfort: 5,
    security: 4,
    description: "پنجره‌ی سقفی بزرگ. منظره‌ی کل شهر. تو شب‌های ماه قرمز، بهتره پرده رو بکشی.",
  },
]

export const HOUSE_MAP: Record<string, HouseDef> = Object.fromEntries(HOUSES.map((h) => [h.key, h]))

export function getHouse(key: string | null | undefined): HouseDef | null {
  if (!key) return null
  return HOUSE_MAP[key] ?? null
}
