// V8 فمبوی — ثابت‌های client-safe برای تبِ فمبوی
// ⚠️ این فایل فقط داده‌ی نمایشی دارد؛ محتوای اصلی در src/lib/game/content/classes.ts
// زندگی می‌کند (سمتِ سرور). مهارتِ فعالِ امضا در SoulCardDTO نیست، پس نسخه‌ی
// ارائه‌ای‌اش این‌جا کپی شده است — تکرارِ آگاهانه برای نازک‌ماندنِ باندلِ کلاینت.

import type { SoulCardDTO } from "@/lib/game/contract"

/** مهارتِ امضای کلاس — کپیِ تحتِ کنترل از content/classes.ts (فعال‌سازیِ موتور، نه متن) */
export interface ActiveSkillMeta {
  name: string
  icon: string
  desc: string
  cooldown: number // راند
}

export const ACTIVE_SKILLS: Record<string, ActiveSkillMeta> = {
  shinobi: { name: "شبح‌زنی", icon: "💫", desc: "ضربه‌ی 130% با بحرانیِ تضمینی.", cooldown: 3 },
  ranger: { name: "تیرِ نشانه", icon: "🏹", desc: "تیری که نصفِ زره را نادیده می‌گیرد (+30 دقت).", cooldown: 3 },
  wizard: { name: "انفجارِ مهبانگ", icon: "🌌", desc: "165% آسیبِ خام — کمی از خونِ خودت هم می‌گیرد.", cooldown: 4 },
  trickster: { name: "کارتِ سلطنتی", icon: "🂡", desc: "کارتِ برگردان: آسیب 70% یا 110% یا 220% — کارتِ سلطنتی حریف را گیج می‌کند (دقتِ او −20).", cooldown: 3 },
  paladin: { name: "سپرِ عهد", icon: "✝️", desc: "گاردِ کامل + برگشتِ 8% خونِ کل.", cooldown: 4 },
  duelist: { name: "رَپیدِ توفان", icon: "🌩️", desc: "دو ضربه‌ی 65% پشتِ هم.", cooldown: 3 },
  summoner: { name: "هم‌نفَسِ گرگ", icon: "🐺", desc: "ضربه‌ی 110% + گرگِ روح راندِ بعدش با 70% می‌زند.", cooldown: 3 },
  reaper: { name: "دَرَوِ سرخ", icon: "⚰️", desc: "170% آسیب — بهایش 10% خونِ فعلی است.", cooldown: 4 },
}

/** مهارتِ امضای فمبویِ فعلی — با fallback خالی */
export function activeSkillOf(classKey: string): ActiveSkillMeta | null {
  return ACTIVE_SKILLS[classKey] ?? null
}

// ─── نمایشِ آمار — برچسب‌های فارسی + درصدی‌بودن ─────────────────────────────

export interface StatDisplay {
  key: keyof SoulCardDTO["stats"]
  icon: string
  label: string
  /** نمایش به‌صورت درصد */
  pct?: boolean
}

export const STAT_DISPLAY: StatDisplay[] = [
  { key: "atk", icon: "⚔️", label: "حمله" },
  { key: "def", icon: "🛡️", label: "دفاع" },
  { key: "crit", icon: "💥", label: "بحرانی", pct: true },
  { key: "critDmg", icon: "🗡️", label: "ضریبِ بحرانی", pct: true },
  { key: "dodge", icon: "💨", label: "گریز", pct: true },
  { key: "acc", icon: "🎯", label: "دقت", pct: true },
  { key: "speed", icon: "⚡", label: "سرعت" },
  { key: "luck", icon: "🍀", label: "شانس", pct: true },
  { key: "loot", icon: "💰", label: "غنیمت", pct: true },
]

/** سقفِ نامِ فمبوی — آینه‌ی SOUL.NAME_MAX در موتور */
export const NAME_MAX = 24
export const NAME_MIN = 2

/** اعتبارسنجیِ سمتِ کلاینتِ اسم — همان قواعدِ موتور، پیامِ فارسی */
export function validateNameClient(raw: string): { ok: boolean; error?: string } {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name.length < NAME_MIN) return { ok: false, error: "اسمِ فمبوی باید حداقل 2 حرف باشد." }
  if (name.length > NAME_MAX) return { ok: false, error: `اسم حداکثر ${NAME_MAX} حرف است.` }
  // هم‌ارزِ regex موتور (character.ts: validateCharacterName) — \u200C = نیم‌فاصله
  if (!/^[\p{L}\p{N} \u200C]+$/u.test(name)) return { ok: false, error: "فقط حرف، عدد و فاصله — بدونِ علامت‌های عجیب." }
  return { ok: true }
}

// ─── دکمه‌ی شیشه‌ایِ آبی (🔵 ناوبری/خنثی — قراردادِ V5) ──────────────────────

export const GLASS_BLUE =
  "border-sky-400/25 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 hover:border-sky-400/40"

/** رنگِ نوارِ روحیه بر اساسِ dmgMod: مثبت=زمردی · منفی=رز · صفر=صورتیِ بازی */
export function spiritBarClass(dmgMod: number): string {
  if (dmgMod > 0) return "bg-emerald-400"
  if (dmgMod < 0) return "bg-rose-400"
  return "bg-primary"
}

/** «+10% آسیب» / «−5% آسیب» — با ارقامِ انگلیسی */
export function dmgModLabel(dmgMod: number): string | null {
  if (dmgMod === 0) return null
  const v = Math.round(Math.abs(dmgMod) * 100)
  return `${dmgMod > 0 ? "+" : "−"}${new Intl.NumberFormat("en-US").format(v)}% آسیب`
}

// ─── V10: کلاس-تسلط — ریاضیاتِ client-safeِ نوارِ پیشرفت ──────────────────────

/**
 * XPِ ابتدایِ سطحِ تسلطِ فعلی — قانونِ موتور: lvl = ⌊√(xp/20)⌋،
 * پس رسیدن به سطحِ L نیاز به L²·20 XP دارد (سطحِ 1 از صفر شروع می‌شود).
 */
export function masteryTierBaseXp(level: number): number {
  if (level <= 1) return 0
  return level * level * 20
}

/** مقدار/سقفِ نوارِ پیشرفتِ تسلط — [0،1] وقتی سقف است (نوارِ خاموش) */
export function masteryProgress(xp: number, level: number, nextTierXp: number | null): { value: number; max: number } {
  if (nextTierXp === null) return { value: 1, max: 1 }
  const base = masteryTierBaseXp(level)
  return { value: Math.max(0, xp - base), max: Math.max(1, nextTierXp - base) }
}
