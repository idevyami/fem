// V10 فمبوی — کیهانات: کاتالوگِ client-safe برای سکشنِ استایل
// ⚠️ این فایل فقط داده‌ی نمایشی دارد؛ محتوای اصلی در src/lib/game/content/appearance.ts
// زندگی می‌کند (سمتِ سرور). DTO فقط کیهناتِ «مال‌شده» را می‌فرستد؛ برای فهرستِ
// «قابلِ کسب» این کپیِ تحتِ کنترل این‌جاست — تکرارِ آگاهانه برای نازک‌ماندنِ
// باندلِ کلاینت (همان قراردادِ ACTIVE_SKILLS در classMeta). اکشن‌ها همیشه
// سمتِ سرور اعتبارسنجی می‌شوند؛ این‌جا هیچ چیزی قابلِ خرید/انتخاب نیست.

import type { CosmeticDTO } from "@/lib/game/contract"

export type CosmeticSlot = "accessory" | "palette" | "frame"

/** نمایِ نمایشیِ یک کیهنات — کلید/ایموجی/نام/برچسبِ منبع (بدونِ منطق) */
export interface CosmeticMeta {
  key: string
  kind: CosmeticSlot
  emoji: string
  name: string
  sourceLabel: string
  colors?: { primary: string; soft: string } | null
}

export const COSMETIC_SLOTS: { slot: CosmeticSlot; label: string; icon: string; hint: string }[] = [
  { slot: "accessory", label: "اکسسوار", icon: "🎀", hint: "کنارِ اسمِ فمبوی دیده می‌شود — ربات هم می‌شناسدش." },
  { slot: "palette", label: "پالت", icon: "🎨", hint: "رنگِ کارتِ فمبوی در مینی‌اپ." },
  { slot: "frame", label: "قاب", icon: "🖼️", hint: "حاشیه‌ی کارتِ فمبوی در مینی‌اپ." },
]

export const COSMETICS_CATALOG: CosmeticMeta[] = [
  // ── اکسسوارها ──
  { key: "acc_ribbon", kind: "accessory", emoji: "🎀", name: "پاپیونِ پیمان", sourceLabel: "پیمانِ آغازین" },
  { key: "acc_heartpin", kind: "accessory", emoji: "💝", name: "سنجاقِ قلب", sourceLabel: "پیوندِ صد" },
  { key: "acc_firstlight", kind: "accessory", emoji: "✨", name: "شراره‌ی فرگشت", sourceLabel: "فرگشتِ نخست" },
  { key: "acc_veil", kind: "accessory", emoji: "🌙", name: "نقابِ دوم", sourceLabel: "فرگشتِ دوم" },
  { key: "acc_halo", kind: "accessory", emoji: "🌟", name: "هالهِ نهایی", sourceLabel: "فرگشتِ نهایی" },
  { key: "acc_boots", kind: "accessory", emoji: "🥾", name: "چکمه‌های راه", sourceLabel: "کلاس-تسلط 3" },
  { key: "acc_scroll", kind: "accessory", emoji: "📜", name: "فرمانِ استادی", sourceLabel: "کلاس-تسلط 5" },
  { key: "acc_comet", kind: "accessory", emoji: "☄️", name: "دمِ دنباله‌دار", sourceLabel: "کلاس-تسلط 7" },
  { key: "acc_crown", kind: "accessory", emoji: "👑", name: "تاجِ افسانه‌ی کلاس", sourceLabel: "کلاس-تسلط 10" },
  { key: "acc_glasses", kind: "accessory", emoji: "🕶️", name: "عینکِ محله", sourceLabel: "سطحِ 10" },
  { key: "acc_scarf", kind: "accessory", emoji: "🧣", name: "شالِ بلندِ شب", sourceLabel: "سطحِ 20" },
  { key: "acc_wingpin", kind: "accessory", emoji: "🪽", name: "پرِ بالِ نقره", sourceLabel: "سطحِ 30" },
  // ── پالت‌ها ──
  { key: "pal_rosa", kind: "palette", emoji: "🌸", name: "پالتِ گلِ صبح", sourceLabel: "کلاس-تسلط 3", colors: { primary: "#f9a8d4", soft: "#3a2430" } },
  { key: "pal_mint", kind: "palette", emoji: "🍃", name: "پالتِ نعناعِ کوه", sourceLabel: "کلاس-تسلط 5", colors: { primary: "#6ee7b7", soft: "#1f3328" } },
  { key: "pal_gold", kind: "palette", emoji: "🏅", name: "پالتِ طلایِ بازار", sourceLabel: "کلاس-تسلط 7", colors: { primary: "#fcd34d", soft: "#3a2f1a" } },
  { key: "pal_aurora", kind: "palette", emoji: "🌌", name: "پالتِ شفقِ قطبی", sourceLabel: "کلاس-تسلط 10", colors: { primary: "#c4b5fd", soft: "#2a2340" } },
  { key: "pal_crimson", kind: "palette", emoji: "🌹", name: "پالتِ سرخِ گل‌فروشی", sourceLabel: "سطحِ 20", colors: { primary: "#fda4af", soft: "#3a1f28" } },
  // ── قاب‌ها ──
  { key: "frm_star", kind: "frame", emoji: "⭐", name: "قابِ ستاره", sourceLabel: "سطحِ 10" },
  { key: "frm_moon", kind: "frame", emoji: "🌙", name: "قابِ ماه", sourceLabel: "سطحِ 30" },
  { key: "frm_champion", kind: "frame", emoji: "🏆", name: "قابِ قهرمانی", sourceLabel: "کلاس-تسلط 5" },
  { key: "frm_legend", kind: "frame", emoji: "👑", name: "قابِ افسانه", sourceLabel: "کلاس-تسلط 10" },
]

/** کیهناتِ کش‌نشده — کل کاتالوگ منهایِ مال‌شده‌ها */
export function lockedCosmetics(owned: CosmeticDTO[]): CosmeticMeta[] {
  const ownedKeys = new Set(owned.map((c) => c.key))
  return COSMETICS_CATALOG.filter((c) => !ownedKeys.has(c.key))
}
