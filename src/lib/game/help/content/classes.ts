// FEMBOY WAR 🎀 — V14 (Task 15b): دسته‌ی «کلاس‌ها و مهارت‌ها» — تولیدِ خودکار.
//
// موضوع‌های هر کلاس از رویِ CLASSES ساخته می‌شوند (درگاهِ فقط‌خواندنی به
// src/lib/game/content/classes.ts) تا محتوا هرگز از داده جدا نیفتد.
// عینِ همان اعدادی که character.ts (soulCardDTO) نشان می‌دهد: passive واقعی با
// پارامترهای base، مهارتِ فعال با power/cd/selfCost، 7 مهارت با unlock/maxRank/spCost.
// پارامترهای پاسیوِ هر کلاس از cls.passive.base می‌آیند — نه از متنِ desc.

import { CLASSES, XP_TRACK_META, type ClassDef, type CombatStats, type PassiveParam } from "@/lib/game/content/classes"
import type { HelpTopic, HelpCategory } from "../types"

export const CLASSES_CATEGORY: HelpCategory = {
  id: "classes",
  icon: "🧬",
  titleFa: "کلاس‌ها و مهارت‌ها",
  titleEn: "Classes & Skills",
  descFa: "هر 8 کلاس با پسیوِ واقعی، مهارتِ امضا، درختِ 7 مهارتی و دو شاخه‌ی فرگشت — به‌علاوه‌ی مکانیکِ نقطه‌مهارت.",
  topics: ["skills-mechanics", ...CLASSES.map((c) => `class-${c.key}`)],
}

// ─── برچسب‌های فارسیِ آمار/پارامتر — آینه‌ی character.ts (STAT_LABELS/PASSIVE_PARAM_LABELS) ──

const STAT_FA: Record<keyof CombatStats, string> = {
  atk: "حمله",
  def: "دفاع",
  crit: "بحرانی",
  critDmg: "ضریبِ بحرانی",
  dodge: "گریز",
  acc: "دقت",
  speed: "سرعت",
  luck: "شانس",
  loot: "غنیمت",
}

const PARAM_FA: Record<PassiveParam, string> = {
  shadowMarkDmg: "آسیبِ هر نشانِ سایه (%)",
  focusDmg: "آسیبِ هر تمرکز (%)",
  burstChance: "شانسِ انفجار (%)",
  burstBonus: "جایزه‌ی انفجار (%)",
  deceptionChance: "شانسِ فریب (%)",
  resolveMitg: "کاهشِ آسیبِ همّت (%)",
  tempoDmg: "آسیبِ هر تمپو (%)",
  wolfPower: "قدرتِ گرگِ روح (%)",
  crimsonDmg: "آسیبِ مومنتوم (%)",
  crimsonCost: "خونِ هر ضربه (%)",
}

const BRANCH_FA: Record<string, string> = { core: "هسته‌ی رزمی", life: "مسیرِ زندگی", art: "قله‌ی هنر" }

function fmtStat(stat: keyof CombatStats, v: number): string {
  return stat === "crit" || stat === "critDmg" || stat === "dodge" || stat === "acc" || stat === "luck" || stat === "loot"
    ? `${Math.round(v)}%`
    : `${Math.round(v * 10) / 10}`
}

/** پیش‌نمایشِ اثرِ مهارت در رتبه‌ی n — همان ریاضیِ effectPreviewOf در character.ts */
function effectPreview(cls: ClassDef, skillId: string, rank: number): string {
  const s = cls.skills.find((x) => x.id === skillId)
  if (!s) return ""
  if (s.effect.kind === "stat") return `${STAT_FA[s.effect.stat]} +${fmtStat(s.effect.stat, s.effect.perRank * rank)}`
  if (s.effect.kind === "passive") return `${PARAM_FA[s.effect.param]} +${s.effect.perRank * rank}`
  if (s.effect.kind === "economy") {
    const lbl = s.effect.param === "payout" ? "حقوقِ شیفت" : "قیمتِ فروش"
    return `${lbl} +${s.effect.perRank * rank}%`
  }
  if (s.effect.kind === "life") {
    const lbl = s.effect.param === "spiritGain" ? "روحیه‌ی تعامل" : "جلای استراحت"
    return `${lbl} +${s.effect.perRank * rank}%`
  }
  return "مهارتِ فعالِ امضا"
}

const DIFF_FA = ["آسان", "متعادل", "چالشی"]

/** موضوعِ یک کلاس — کاملاً از داده ساخته می‌شود */
function classTopic(cls: ClassDef): HelpTopic {
  const passiveParts = Object.entries(cls.passive.base)
    .map(([k, v]) => `${PARAM_FA[k as PassiveParam] ?? k}: ${v}`)
    .join(" · ")
  const skillLines = cls.skills.map((s) => {
    const bits = [`${s.icon} ${s.name} — سطحِ ${s.unlockLevel} · ${BRANCH_FA[s.branch]}`]
    bits.push(`رتبه‌ی ${s.maxRank} · هر رتبه ${s.spCost} نقطه‌مهارت · ${effectPreview(cls, s.id, 1)} در هر رتبه`)
    if (s.requires) bits.push(`پیش‌نیاز: «${cls.skills.find((x) => x.id === s.requires)?.name ?? s.requires}»`)
    if (s.evolutionReq !== undefined) bits.push(`فقط بعد از فرگشتِ ${s.evolutionReq}`)
    return bits.join("\n")
  })
  const evoLines: string[] = []
  for (let stage = 0; stage < 3; stage++) {
    const a = cls.evolutions[stage]!
    const b = cls.evolutionAlt[stage]!
    evoLines.push(`مرحله‌ی ${stage + 1} (سطحِ ${a.reqLevel} + ${a.reqWins} برد · ×${a.statMult}):`)
    evoLines.push(`الف) ${a.emoji} ${a.name} — ${a.pathLabel}`)
    evoLines.push(`ب) ${b.emoji} ${b.name} — ${b.pathLabel}`)
  }
  return {
    id: `class-${cls.key}`,
    cat: "classes",
    icon: cls.emoji,
    titleFa: cls.name,
    titleEn: cls.key,
    summaryFa: `${cls.roleName} — ${cls.fantasy}`,
    keywords: [cls.key, cls.name, cls.roleName, cls.passive.name],
    blocks: [
      {
        h: "هویت و سبک",
        lines: [
          `${cls.fantasy}`,
          `سختی: ${DIFF_FA[cls.difficulty - 1]} · نقش: ${cls.roleName}`,
          `سبکِ بازی: ${cls.playStyle}`,
          `مسیرِ XP: ${XP_TRACK_META[cls.xpBias.primary].label} (اصلی) و ${XP_TRACK_META[cls.xpBias.secondary].label} (فرعی)`,
        ],
      },
      {
        h: "قوت و ضعف",
        lines: [
          `قوت‌ها: ${cls.strengths.join(" · ")}`,
          `ضعف‌ها: ${cls.weaknesses.join(" · ")}`,
        ],
      },
      {
        h: `پسیوِ امضا — ${cls.passive.name}`,
        lines: [cls.passive.desc, `پارامترهای پایه: ${passiveParts}`],
      },
      {
        h: `مهارتِ فعال — ${cls.activeSkill.name}`,
        lines: [
          cls.activeSkill.desc,
          `توان ${cls.activeSkill.power}% · کول‌داون ${cls.activeSkill.cooldown} راند${cls.activeSkill.selfCost ? ` · هزینه‌ی خود ${cls.activeSkill.selfCost}% خونِ فعلی` : ""}`,
        ],
      },
      {
        h: "درختِ 7 مهارتی",
        lines: skillLines.slice(0, 4),
      },
      {
        h: "درختِ 7 مهارتی (ادامه)",
        lines: skillLines.slice(4),
      },
      {
        h: "دو شاخه‌ی فرگشت",
        lines: evoLines,
      },
      {
        h: "برای تازه‌وارد",
        lines: [
          "پرتره‌ی اختصاصیِ کلاس در کارت دیده می‌شود؛ فرم‌های فرگشتِ 2 و 3 پرتره‌ی خودشان را دارند.",
          "اول رتبه‌های «هسته‌ی رزمی» را بگیر؛ «مسیرِ زندگی» زندگیِ روزمره (حقوق/روحیه) را عمیق می‌کند و «قله‌ی هنر» بعد از فرگشتِ اول باز می‌شود.",
        ],
      },
    ],
    related: ["skills-mechanics", "femboy-class-permanent", "femboy-evolution"],
    examples: [`کلاس ${cls.name} در کارتِ کلاس با همین اعداد دیده می‌شود`],
  }
}

/** موضوع‌های 8 کلاس — هر بار از رویِ داده‌ی زنده ساخته می‌شوند */
export function buildClassTopics(): HelpTopic[] {
  return CLASSES.map(classTopic)
}

// ─── مکانیکِ مهارت‌ها (دستی — منبع: character.ts/SOUL + classes.ts) ────────────

export const CLASS_TOPICS: HelpTopic[] = [
  {
    id: "skills-mechanics",
    cat: "classes",
    icon: "✨",
    titleFa: "مکانیکِ مهارت‌ها و نقطه‌مهارت",
    titleEn: "Skill mechanics",
    summaryFa: "هر 2 سطح 1 نقطه‌مهارت (+M5 و M10)؛ هر رتبه spCost می‌خواهد؛ پیش‌نیاز و گیتِ فرگشت دارند.",
    keywords: ["نقطه مهارت", "skill point", "sp", "رتبه", "rank", "ارتقا", "upgrade skill", "درخت مهارت"],
    blocks: [
      {
        h: "درآمدِ نقطه‌مهارت (SP)",
        lines: [
          "• هر 2 سطح یک‌بار: 1 نقطه (SKILL_POINT_EVERY).",
          "• تسلطِ M5: +1 نقطه · M10: +2 نقطه.",
          "هزینه‌ی هر رتبه در خودِ مهارت نوشته شده (بیشتر 1، هنرها 2).",
        ],
      },
      {
        h: "سه قفلِ رتبه",
        lines: [
          "• قفلِ سطح — هر مهارت سطحِ unlockLevel خودش را می‌خواهد.",
          "• قفلِ پیش‌نیاز — بعضی مهارت‌ها روی مهارتی دیگر سوارند («اول X را باز کن»).",
          "• قفلِ فرگشت — مهارت‌های «قله‌ی هنر» فقط بعد از فرگشتِ 1 باز می‌شوند.",
        ],
      },
      {
        h: "شاخه‌ها",
        lines: [
          "• هسته‌ی رزمی — آمارِ نبرد و پارامترهای پسیو.",
          "• مسیرِ زندگی — خارج از نبرد: حقوقِ شیفت، قیمتِ فروش، روحیه‌ی تعامل، جلای استراحت.",
          "• قله‌ی هنر — عمیق‌ترین رتبه‌ها، پشتِ گیتِ فرگشت.",
        ],
      },
      {
        h: "خطاهای رایج",
        lines: [
          "«سطح X لازم است» · «این رتبه از هنر فقط بعد از فرگشتِ 1 باز می‌شود» ·",
          "«اول «Y» را رتبه‌ی 1 کن» · «در بالاترین رتبه است» · «N نقطه‌مهارت لازم داری؛ M داری».",
        ],
      },
    ],
    phrases: [{ fa: "فمبوی من", en: "my femboy", where: "both" }],
    examples: ["سطح 5 با 2 SP → دو رتبه‌ی 1-تومان یا یک رتبه‌ی 2-تومان"],
    related: ["faq-skill-fails", "progression-levels", "femboy-mastery"],
  },
]
