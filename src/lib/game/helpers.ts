import type { PlayerFlags, StatKey, Rarity } from "./types"
import type { Player } from "@prisma/client"

// ─── Flags helpers ────────────────────────────────────────────────────────────

export function parseFlags(player: Pick<Player, "flags">): PlayerFlags {
  try {
    return JSON.parse(player.flags || "{}") as PlayerFlags
  } catch {
    return {}
  }
}

export function serializeFlags(flags: PlayerFlags): string {
  return JSON.stringify(flags)
}

// ─── Stats helpers ────────────────────────────────────────────────────────────

export const STAT_META: Record<StatKey, { label: string; icon: string; min: number; max: number }> = {
  health: { label: "سلامتی", icon: "❤️", min: 0, max: 100 },
  energy: { label: "انرژی", icon: "⚡", min: 0, max: 100 },
  luck: { label: "شانس", icon: "🍀", min: 0, max: 100 },
  intelligence: { label: "هوش", icon: "🧠", min: 0, max: 100 },
  chaos: { label: "آشوب", icon: "🌀", min: 0, max: 100 },
  fame: { label: "شهرت", icon: "⭐", min: 0, max: 100 },
  crime: { label: "سابقه", icon: "🚨", min: 0, max: 100 },
  reputation: { label: "اعتبار", icon: "🕊", min: 0, max: 100 },
  xp: { label: "تجربه", icon: "✨", min: 0, max: Number.MAX_SAFE_INTEGER },
  money: { label: "سکه", icon: "💰", min: 0, max: 999_999_999 },
  debt: { label: "بدهی", icon: "⛓", min: 0, max: 999_999_999 },
}

export function clampStat(stat: StatKey, value: number): number {
  const meta = STAT_META[stat]
  return Math.min(meta.max, Math.max(meta.min, Math.round(value)))
}

export function xpForLevel(level: number): number {
  // مجموع XP لازم برای رسیدن به level بعدی از ابتدای این level
  return 100 + (level - 1) * 80
}

export function levelFromXp(xp: number): number {
  let level = 1
  let remaining = xp
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level++
    if (level > 99) break
  }
  return level
}

export function xpProgress(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let remaining = xp
  while (remaining >= xpForLevel(level) && level < 99) {
    remaining -= xpForLevel(level)
    level++
  }
  return { level, into: remaining, need: xpForLevel(level) }
}

// ─── Rarity helpers ───────────────────────────────────────────────────────────

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9ca3af",
  uncommon: "#34d399",
  rare: "#f472b6",
  epic: "#c084fc",
  legendary: "#fbbf24",
  unknown: "#94a3b8",
}

export const WEATHER_LABEL: Record<string, { label: string; emoji: string }> = {
  clear: { label: "صاف", emoji: "☀️" },
  rain: { label: "بارانی", emoji: "🌧" },
  storm: { label: "طوفانی", emoji: "⛈" },
  fog: { label: "مه", emoji: "🌫" },
  red_moon: { label: "ماه قرمز", emoji: "🌕" },
}

export const MOOD_LABEL: Record<string, string> = {
  calm: "آرام",
  tense: "پرتنش",
  festive: "جشن‌واره",
  weird: "عجیب",
}

// ─── قالب‌بندیِ اعداد (V11: رقمِ انگلیسی از منبع) ─────────────────────────────

const en = new Intl.NumberFormat("en-US")

export function formatMoney(n: number): string {
  return en.format(Math.round(n))
}

/** عدد با جداکننده‌ی هزارگانِ انگلیسی — برای برچسب‌های داخلِ متن
 *  (نامِ تاریخی faNum حفظ شده تا فراخوانی‌های موجود دست‌نخورده بمانند؛
 *  V11: en-US — رقمِ فارسی دیگر از موتور بیرون نمی‌رود) */
export function faNum(n: number): string {
  return en.format(Math.round(n))
}

/** رقم‌های فارسی/عربی و جداکننده‌های عربیِ یک رشته → لاتینِ انگلیسی
 *  (V11: آینه‌ی toLatinDigits سمتِ گروه — «راند ۳» → «راند 3»؛
 *  نامِ تاریخی faDigits حفظ شده تا فراخوانی‌های موجود دست‌نخورده بمانند) */
export function faDigits(v: string | number): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹"
  const ar = "٠١٢٣٤٥٦٧٨٩"
  let out = ""
  for (const ch of String(v)) {
    const f = fa.indexOf(ch)
    const a = ar.indexOf(ch)
    out += f >= 0 ? String(f) : a >= 0 ? String(a) : ch === "٬" ? "," : ch === "٫" ? "." : ch
  }
  return out
}
