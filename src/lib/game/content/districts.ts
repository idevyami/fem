import type { DistrictDef } from "../types"

export const DISTRICTS: DistrictDef[] = [
  {
    key: "center",
    name: "مرکز شهر",
    emoji: "🏛",
    description: "ساعتِ بزرگِ میدون همیشه یه ربع جلوتره. کسی نمی‌دونه چرا. همه عادت کردن.",
    mood: "شلوغ و رسمی",
    risk: 1,
    eventBias: { story: 1.3, wholesome: 1.2 },
    shops: ["coffee", "cake", "nazar", "sunglasses"],
  },
  {
    key: "old_town",
    name: "محله‌ی قدیمی",
    emoji: "🏚",
    description: "کوچه‌هایی که آدرس‌دهی‌شون با نقشه درست درنمیاد. عمو قنبر می‌گه قبلاً جاده بود.",
    mood: "دنج و پچ‌پچی",
    risk: 2,
    eventBias: { mystery: 1.5, story: 1.2 },
    shops: ["flashlight", "umbrella", "old_key", "nazar"],
  },
  {
    key: "bazaar",
    name: "بازار",
    emoji: "🏪",
    description: "قلب اقتصاد شهر. قیمت‌ها اینجا نفس می‌کشن. آرش همیشه یه جایی اینجاست.",
    mood: "پرحرکت و چانه‌زنی",
    risk: 2,
    eventBias: { funny: 1.4, story: 1.2 },
    shops: ["ramen", "energy_drink", "ribbon", "phone", "pet_food"],
  },
  {
    key: "industrial",
    name: "منطقه‌ی صنعتی",
    emoji: "🏭",
    description: "دود از دودکش‌هاش همیشه به شکل یه چیز دیگه‌ست. امروز شبیه گربه بود.",
    mood: "فلزی و مشکوک",
    risk: 3,
    eventBias: { dark: 1.6, absurd: 1.3 },
    shops: ["energy_drink", "flashlight", "phone"],
  },
  {
    key: "luxury",
    name: "منطقه‌ی لوکس",
    emoji: "💎",
    description: "فواره‌هاش آب می‌ده که شاید آب نباشه. حیاط خونه‌هاش از آپارتمان تو بزرگ‌تره.",
    mood: "براق و نشان‌دادنی",
    risk: 2,
    eventBias: { funny: 1.3, story: 1.2 },
    shops: ["lipstick", "trophy", "cake", "coin"],
  },
  {
    key: "park",
    name: "پارک",
    emoji: "🌳",
    description: "سنگ‌هاش مرتب چیده شدن. کسی می‌گه شب‌ها خودشون جابه‌جا می‌شن.",
    mood: "سبز و عجیب‌امن",
    risk: 1,
    eventBias: { wholesome: 1.7, funny: 1.2, mystery: 1.1 },
    shops: ["ramen", "cake", "pet_food"],
  },
  {
    key: "suburbs",
    name: "حومه",
    emoji: "🌾",
    description: "سکوت. علف‌های بلند. صدای یه چیزی که نمی‌خواد معلوم شه چی هست.",
    mood: "ساکت و موذی",
    risk: 2,
    eventBias: { mystery: 1.4, dark: 1.2, wholesome: 1.1 },
    shops: ["pet_food", "ramen", "umbrella"],
  },
  {
    key: "forbidden",
    name: "منطقه‌ی ممنوعه",
    emoji: "☢",
    description: "پلاک روی دیوارش نوشته «ورود ممنوع». زیرش با ماژیک نوشته «ممنوع نیست، فقط نرو».",
    mood: "نامرئی و سنگین",
    risk: 4,
    eventBias: { dark: 1.8, mystery: 1.6, legendary: 2.5 },
    shops: [],
  },
]

export const DISTRICT_MAP: Record<string, DistrictDef> = Object.fromEntries(DISTRICTS.map((d) => [d.key, d]))

export function getDistrict(key: string): DistrictDef {
  return DISTRICT_MAP[key] ?? DISTRICT_MAP.bazaar
}
