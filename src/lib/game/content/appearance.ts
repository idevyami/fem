// FEMBOY WAR 🎀 — V10: کیهاناتِ فمبوی (Cosmetics Catalog)
// فقط چیزهایی که واقعاً قابلِ رندرند: ایموجیِ اکسسوار (ربات + مینی‌اپ)،
// پالتِ رنگی (مینی‌اپ)، قابِ کارت (مینی‌اپ). هیچ کیهناتی که آرتش وجود
// ندارد ارائه نمی‌شود — قانونِ «کیهناتِ غیرواقعی ممنوع».
//
// منبعِ کسب (source) همیشه سمتِ موتور اعطا می‌کند — خرید/فروش نیست.

export type CosmeticKind = "accessory" | "palette" | "frame"
export type CosmeticSource =
  | "starter" // هنگامِ پیمان
  | "bond100" // پیوند 100
  | "evolution1" | "evolution2" | "evolution3" // فرگشتِ 1/2/3 (هر شاخه)
  | "mastery3" | "mastery5" | "mastery7" | "mastery10" // کلاس-تسلط
  | "level10" | "level20" | "level30" // سطحِ فمبوی

export interface CosmeticDef {
  key: string
  kind: CosmeticKind
  emoji: string
  name: string
  desc: string
  source: CosmeticSource
  /** فقط برای palette: رنگِ اصلی/نرم جایگزین کلاس در مینی‌اپ */
  colors?: { primary: string; soft: string }
}

export const SOURCE_LABELS: Record<CosmeticSource, string> = {
  starter: "پیمانِ آغازین",
  bond100: "پیوندِ صد",
  evolution1: "فرگشتِ نخست",
  evolution2: "فرگشتِ دوم",
  evolution3: "فرگشتِ نهایی",
  mastery3: "کلاس-تسلط 3",
  mastery5: "کلاس-تسلط 5",
  mastery7: "کلاس-تسلط 7",
  mastery10: "کلاس-تسلط 10",
  level10: "سطحِ 10",
  level20: "سطحِ 20",
  level30: "سطحِ 30",
}

// ─── اکسسوارها (نمایش در نامِ فمبوی — ربات و مینی‌اپ) ──────────────────────────
const ACCESSORIES: CosmeticDef[] = [
  // هدیه‌ی پیمان — هر کلاس یکی
  { key: "acc_ribbon", kind: "accessory", emoji: "🎀", name: "پاپیونِ پیمان", desc: "پاپیونی که روزِ پیمان روی گیشه‌اش بود.", source: "starter" },
  // پیوند
  { key: "acc_heartpin", kind: "accessory", emoji: "💝", name: "سنجاقِ قلب", desc: "وقتی پیوندتان صد شد، خودش نخواست؛ سنجاق شد.", source: "bond100" },
  // فرگشت‌ها
  { key: "acc_firstlight", kind: "accessory", emoji: "✨", name: "شراره‌ی فرگشت", desc: "نخستین نورِ فرگشت، پیشانی‌اش را رها نمی‌کند.", source: "evolution1" },
  { key: "acc_veil", kind: "accessory", emoji: "🌙", name: "نقابِ دوم", desc: "فرگشتِ دوم شکلِ خودش را با خودش آورد.", source: "evolution2" },
  { key: "acc_halo", kind: "accessory", emoji: "🌟", name: "هالهِ نهایی", desc: "فرگشتِ نهایی — هاله‌ای که شهر قاب می‌گیرد.", source: "evolution3" },
  // کلاس-تسلط
  { key: "acc_boots", kind: "accessory", emoji: "🥾", name: "چکمه‌های راه", desc: "کلاس-تسلط 3 — کفش‌هایی که خودشان جاده بلدند.", source: "mastery3" },
  { key: "acc_scroll", kind: "accessory", emoji: "📜", name: "فرمانِ استادی", desc: "کلاس-تسلط 5 — مدرکِ استادی، مُهرِ شهر.", source: "mastery5" },
  { key: "acc_comet", kind: "accessory", emoji: "☄️", name: "دمِ دنباله‌دار", desc: "کلاس-تسلط 7 — جایی که می‌گذرد، برق می‌ماند.", source: "mastery7" },
  { key: "acc_crown", kind: "accessory", emoji: "👑", name: "تاجِ افسانه‌ی کلاس", desc: "کلاس-تسلط 10 — فقط یک نفر در هر نسل. تو.", source: "mastery10" },
  // سطح
  { key: "acc_glasses", kind: "accessory", emoji: "🕶️", name: "عینکِ محله", desc: "سطحِ 10 — از این به بعد با ادب نگاه می‌کند.", source: "level10" },
  { key: "acc_scarf", kind: "accessory", emoji: "🧣", name: "شالِ بلندِ شب", desc: "سطحِ 20 — شالی که دمِ سردِ شهر را می‌فهمد.", source: "level20" },
  { key: "acc_wingpin", kind: "accessory", emoji: "🪽", name: "پرِ بالِ نقره", desc: "سطحِ 30 — پرِ پرنده‌ای که هنوز پرواز نکرده، فقط قصد دارد.", source: "level30" },
]

// ─── پالت‌ها (رنگِ کارتِ فمبوی در مینی‌اپ — همیشه واقعی رندر می‌شود) ───────────
const PALETTES: CosmeticDef[] = [
  { key: "pal_rosa", kind: "palette", emoji: "🌸", name: "پالتِ گلِ صبح", desc: "صورتیِ ملایمِ شکوفه‌های حیاطِ پشتی.", source: "mastery3", colors: { primary: "#f9a8d4", soft: "#3a2430" } },
  { key: "pal_mint", kind: "palette", emoji: "🍃", name: "پالتِ نعناعِ کوه", desc: "سبزِ آرامِ چایِ عصرِ جمعه.", source: "mastery5", colors: { primary: "#6ee7b7", soft: "#1f3328" } },
  { key: "pal_gold", kind: "palette", emoji: "🏅", name: "پالتِ طلایِ بازار", desc: "زرینِ ویترینِ صرافِ قدیمی.", source: "mastery7", colors: { primary: "#fcd34d", soft: "#3a2f1a" } },
  { key: "pal_aurora", kind: "palette", emoji: "🌌", name: "پالتِ شفقِ قطبی", desc: "بنفشِ نابِ شب‌های بی‌مه.", source: "mastery10", colors: { primary: "#c4b5fd", soft: "#2a2340" } },
  { key: "pal_crimson", kind: "palette", emoji: "🌹", name: "پالتِ سرخِ گل‌فروشی", desc: "سرخی که دستِ گل‌فروش از یاد نمی‌برد.", source: "level20", colors: { primary: "#fda4af", soft: "#3a1f28" } },
]

// ─── قاب‌ها (قالبِ کارتِ فمبوی در مینی‌اپ — کلاسِ CSS واقعی) ────────────────────
const FRAMES: CosmeticDef[] = [
  { key: "frm_star", kind: "frame", emoji: "⭐", name: "قابِ ستاره", desc: "حاشیه‌ای که ستاره‌ها امضا کرده‌اند.", source: "level10" },
  { key: "frm_moon", kind: "frame", emoji: "🌙", name: "قابِ ماه", desc: "هلالی که فقط شب‌های شیشه‌ای دیده می‌شود.", source: "level30" },
  { key: "frm_champion", kind: "frame", emoji: "🏆", name: "قابِ قهرمانی", desc: "قالبِ تالارِ افتخارات — برای قهرمان‌ها.", source: "mastery5" },
  { key: "frm_legend", kind: "frame", emoji: "👑", name: "قابِ افسانه", desc: "قابی که فقط در افسانه‌ها دوخته شده.", source: "mastery10" },
]

export const COSMETICS: CosmeticDef[] = [...ACCESSORIES, ...PALETTES, ...FRAMES]

export const COSMETIC_MAP: Record<string, CosmeticDef> = Object.fromEntries(COSMETICS.map((c) => [c.key, c]))

export function getCosmetic(key: string): CosmeticDef | null {
  return COSMETIC_MAP[key] ?? null
}

/** اعتبارسنجیِ محتوا در بارگذاری */
const _dup = new Set<string>()
for (const c of COSMETICS) {
  if (_dup.has(c.key)) throw new Error(`کیهناتِ تکراری: ${c.key}`)
  _dup.add(c.key)
  if (c.kind === "palette" && (!c.colors?.primary || !c.colors?.soft)) throw new Error(`پالتِ بدونِ رنگ: ${c.key}`)
}

// ─── مدلِ ذخیره (JSON روی SoulCharacter) ────────────────────────────────────────
// cosmeticsJson: { [key]: { source: CosmeticSource, at: ISO } }
// appearanceJson: { accessory?: key, palette?: key, frame?: key }

export interface OwnedCosmetic {
  source: CosmeticSource
  at: string
}

export function parseOwned(raw: string): Record<string, OwnedCosmetic> {
  try {
    const obj = JSON.parse(raw || "{}") as Record<string, OwnedCosmetic>
    return Object.fromEntries(Object.entries(obj).filter(([k, v]) => COSMETIC_MAP[k] && v && typeof v.source === "string"))
  } catch {
    return {}
  }
}

export function parseEquipped(raw: string): { accessory?: string; palette?: string; frame?: string } {
  try {
    const obj = JSON.parse(raw || "{}") as Record<string, unknown>
    const out: { accessory?: string; palette?: string; frame?: string } = {}
    for (const slot of ["accessory", "palette", "frame"] as const) {
      const v = obj[slot]
      if (typeof v === "string" && COSMETIC_MAP[v]?.kind === slot) out[slot] = v
    }
    return out
  } catch {
    return {}
  }
}
