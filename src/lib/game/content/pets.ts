import type { PetSpeciesDef } from "../types"

export const PET_SPECIES: PetSpeciesDef[] = [
  {
    key: "street_cat",
    species: "گربه‌ی خیابانی",
    emoji: "🐈",
    rarity: "common",
    personality: "مغرور",
    description: "با اینکه خیابانیه، رفتارش انگار از یه خانواده‌ی اشرافی فرار کرده.",
    traits: ["نازک‌آتیشه", "شب‌گرد", "آدم‌بیش‌مایه"],
    baseLoyalty: 30,
  },
  {
    key: "loyal_dog",
    species: "سگ وفادار",
    emoji: "🐕",
    rarity: "common",
    personality: "وفادار",
    description: "تو رو قبول کرده. این یعنی همه‌چیز. برای همیشه.",
    traits: ["وفادارِ وفادار", "زودحوصله‌سرمی‌ره", "از پلیس می‌ترسه"],
    baseLoyalty: 55,
  },
  {
    key: "talking_crow",
    species: "کلاغ حرف‌زن",
    emoji: "🐦‍⬛",
    rarity: "rare",
    personality: "شایعه‌پراکن",
    description: "حرف‌هایی می‌زنه که نباید بزنه. اطلاعاتش از تو بیشتره.",
    traits: ["دروغگو در 40% مواقع", "حافظه‌ی عجیب", "از آینه می‌ترسه"],
    baseLoyalty: 20,
  },
  {
    key: "hostile_duck",
    species: "اردک متخاصم",
    emoji: "🦆",
    rarity: "rare",
    personality: "متخاصم",
    description: "وارد خونه‌ات شد. دلیلش معلوم نیست. قصد رفتن هم ندارد.",
    traits: ["نمیشینه", "حق داره عصبانی باشه", "مرموز"],
    baseLoyalty: 10,
  },
  {
    key: "neon_rooster",
    species: "خروسک نئونی",
    emoji: "🐓",
    rarity: "epic",
    personality: "الکتریکی",
    description: "توی تاریکی می‌درخشه. ساعت 4 صبح فریاد می‌زنه. همیشه دقیقه 4.",
    traits: ["ساعت‌دار", "شارژ میشه", "صداش شبیه بوق ماشینیه"],
    baseLoyalty: 25,
  },
  {
    key: "city_fox",
    species: "روباه شهر",
    emoji: "🦊",
    rarity: "rare",
    personality: "زیرک",
    description: "به تو لبخند زد. روباه‌ها لبخند نمی‌زنند. چیزی تو ذهنشه.",
    traits: ["معامله‌گر", "شب‌ها غیب میشه", "کلید جیبته"],
    baseLoyalty: 35,
  },
  {
    key: "engineer_hamster",
    species: "همستر مهندس",
    emoji: "🐹",
    rarity: "epic",
    personality: "کمال‌گرا",
    description: "وقتی خوابی چیزها رو جابه‌جا می‌کنه. همیشه بهتر از قبل. معمولاً.",
    traits: ["ساختنی‌ها رو مرتب می‌کنه", "آجیل‌خور", "نظم عجیب"],
    baseLoyalty: 40,
  },
  {
    key: "void_snail",
    species: "حلزون خلأ",
    emoji: "🐌",
    rarity: "legendary",
    personality: "بین‌بُعدی",
    description: "از یه جای دیگه اومده. جای دیگه‌ای که بهتره درباره‌ش فکر نکنی.",
    traits: ["جای خالی رو پر می‌کنه", "سرد نیست، گرم هم نیست", "کِی می‌میره؟"],
    baseLoyalty: 50,
  },
]

export const PET_MAP: Record<string, PetSpeciesDef> = Object.fromEntries(PET_SPECIES.map((p) => [p.key, p]))

export function getPetSpecies(key: string): PetSpeciesDef | undefined {
  return PET_MAP[key]
}
