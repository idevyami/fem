// FEMBOY WAR V4 — موتورِ «قدمِ بعدی»: همیشه از وضعیتِ زنده، همیشه با دلیل.
import type { Player } from "@prisma/client"
import type { GameSnapshot, GoalDTO, NextActionDTO, OpportunityDTO } from "./contract"
import { DISTRICTS } from "./content"
import { faNum } from "./helpers"
import { mulberry32, seedFrom, pickOne } from "./rng"

const MAX_ACTIONS = 4

/**
 * کنش‌های پیشنهادیِ بعدی — رتبه‌بندی‌شده، حداکثر 4.
 * V9 — فمبوی‌آگاه: 0) بی‌فمبوی → پیمان (مهم‌ترین) 0.5) نقطه‌مهارتِ فمبوی
 * 0.7) روحیه‌ی کمِ فمبوی 1) رویداد فعال 2) انرژی 3) حیوانِ گرسنه 4) کار
 * 5) فرصتِ در حالِ انقضا 6) بدهی 7) شکارِ فمبوی 8) سفر 9) بازار.
 */
export function nextActions(
  player: Player,
  snapshot: GameSnapshot,
  opportunities: OpportunityDTO[],
  goals: GoalDTO[],
): NextActionDTO[] {
  const out: NextActionDTO[] = []
  const push = (a: NextActionDTO) => {
    if (out.length < MAX_ACTIONS && !out.some((x) => x.id === a.id)) out.push(a)
  }

  // 0) V9 — فمبوی نداری: مهم‌ترین قدمِ زندگی در این جهان
  if (!snapshot.femboy) {
    push({
      id: "femboy",
      icon: "🎀",
      title: "پیمانِ فمبوی را ببند",
      reason: "هر بازیکن یک فمبویِ اختصاصی دارد — تو هنوز نداری",
      actionLabel: "🎀 شروعِ پیمان",
      tone: "info",
    })
  }

  // 0.5) V9 — نقطه‌مهارتِ فمبوی بی‌استفاده مانده
  if (snapshot.femboy && snapshot.femboy.skillPoints > 0) {
    push({
      id: "femboySkills",
      icon: "✨",
      title: `نقطه‌مهارتِ ${snapshot.femboy.name} منتظر است`,
      reason: `${faNum(snapshot.femboy.skillPoints)} نقطه‌مهارتِ استفاده‌نشده داری`,
      actionLabel: "✨ ارتقای مهارت",
      tone: "good",
    })
  }

  // 0.6) V10 — سلوکِ بعدیِ فمبوی (از خودِ موتور): فرگشت آماده / تسلط نزدیک
  if (snapshot.femboy) {
    const ms = snapshot.femboy.nextMilestone ?? ""
    if (ms.includes("فرگشت") && ms.includes("آماده")) {
      push({
        id: "femboyEvolve",
        icon: "🌌",
        title: `فرگشتِ ${snapshot.femboy.name} آماده است`,
        reason: "هر دو شاخه را ببین — این انتخاب برای همیشه می‌ماند",
        actionLabel: "🌌 انتخابِ شاخه",
        tone: "good",
      })
    } else if (ms.includes("تسلط")) {
      push({
        id: "femboyMastery",
        icon: "🎓",
        title: `کلاس-تسلطِ ${snapshot.femboy.name} نزدیک است`,
        reason: ms,
        actionLabel: "🎓 راهِ تسلط",
        tone: "info",
      })
    }
  }

  // 0.7) V9 — روحیه‌ی فمبوی پایین است (V14: واژه‌ی قاعده‌ای «تعامل» — نه «وقت‌گذرانی»)
  if (snapshot.femboy && snapshot.femboy.spirit < 35) {
    push({
      id: "femboyInteract",
      icon: "💗",
      title: `${snapshot.femboy.name} دل‌گیر شده`,
      reason: `روحیه‌اش ${faNum(snapshot.femboy.spirit)}% است — تعامل لازم دارد`,
      actionLabel: "💗 تعامل با فمبوی",
      tone: "warn",
    })
  }

  // 1) رویدادِ فعال — مهم‌ترین چیزی که ناتمام است
  if (snapshot.activeEvent) {
    push({
      id: "event",
      icon: "🎲",
      title: "انتخابت را نهایی کن",
      reason: `${snapshot.activeEvent.title} منتظر توست`,
      actionLabel: "🎲 برو سراغش",
      tone: "info",
    })
  }

  // 2) انرژی
  if (player.energy < 25) {
    push({
      id: "rest",
      icon: "😴",
      title: "یه نفسی تازه کن",
      reason: "انرژی‌ات دارد تمام می‌شود",
      actionLabel: "😴 استراحت",
      tone: "warn",
    })
  }

  // 3) حیوانِ گرسنه
  const starving = [...snapshot.pets].sort((a, b) => a.hunger - b.hunger)[0]
  if (starving && starving.hunger < 30) {
    push({
      id: "feedPet",
      icon: "🐾",
      title: `به ${starving.name} غذا بده`,
      reason: `سیریِ ${starving.name} فقط ${faNum(starving.hunger)} است`,
      actionLabel: `🐾 غذا بده به ${starving.name}`,
      tone: "warn",
    })
  }

  // 4) کار — وقتی جیب سبک است
  if (snapshot.player.canWork && player.money < 10_000) {
    const goalHint = goals.find((g) => g.id === "savings")?.hint ?? goals[0]?.hint ?? "روزهای سخت"
    push({
      id: "work",
      icon: "💼",
      title: snapshot.player.job ? `شیفتِ ${snapshot.player.job.name}` : "شیفتِ بعدی",
      reason: `جیبت برای «${goalHint}» سبک است`,
      actionLabel: "💼 برو سرِ کار",
      tone: "good",
    })
  }

  // 5) فرصتِ در حالِ انقضا
  const urgent = opportunities.find((o) => o.minutesLeft < 45)
  if (urgent) {
    const tone: NextActionDTO["tone"] =
      urgent.claimStyle === "safe" ? "good" : urgent.claimStyle === "risky" ? "info" : "warn"
    push({
      id: `claim-${urgent.id}`,
      icon: urgent.icon,
      title: urgent.title,
      reason: `فقط ${faNum(urgent.minutesLeft)} دقیقه مانده`,
      actionLabel: "⚡ بگیرش",
      tone,
    })
  }

  // 6) بدهی
  if (player.debt > 0 && player.money > player.debt) {
    push({
      id: "payDebt",
      icon: "⛓",
      title: "بدهی را تسویه کن",
      reason: "همین حالا می‌توانی. بعداً سودش را می‌گیردت",
      actionLabel: "⛓ تسویه با دایی فرهاد",
      tone: "good",
    })
  }

  // 6.5) رویدادِ تازه — وقتی هیچ اتفاقی باز نیست
  if (!snapshot.activeEvent && player.energy >= 8) {
    push({
      id: "draw-event",
      icon: "🎲",
      title: "یک اتفاقِ تازه بکش",
      reason: "شهر چیزی برای گفتن دارد — فقط باید گوش بدهی",
      actionLabel: "🎲 گوش بده",
      tone: "info",
    })
  }

  // 7) V9 — شکار: استقامتِ فمبوی پر است و حالش برای نبرد هست
  if (snapshot.femboy && snapshot.femboy.stamina >= 3 && snapshot.femboy.condition.canFight) {
    push({
      id: "femboyHunt",
      icon: "⚔️",
      title: `${snapshot.femboy.name} دنبال هیجانی است`,
      reason: `استقامت ${faNum(snapshot.femboy.stamina)}/${faNum(snapshot.femboy.staminaMax)} — آماده‌ی نبرد`,
      actionLabel: "⚔️ شکار",
      tone: "info",
    })
  }

  // 8) سفر — این محله حرفی برای گفتن ندارد
  const others = DISTRICTS.filter((d) => d.key !== player.currentDistrict)
  const rng = mulberry32(seedFrom("nexttravel", player.id, player.day))
  const target = pickOne(others, rng)
  push({
    id: "travel",
    icon: "🧭",
    title: `برو به ${target.name}`,
    reason: "این محله دیگر حرفی برای گفتن ندارد",
    actionLabel: `${target.emoji} سفر به ${target.name}`,
    tone: "info",
  })

  // 9) بازار
  push({
    id: "market",
    icon: "🏪",
    title: "سرکشی به بازار",
    reason: "قیمت‌ها مثلِ حرفِ مردم، مدام عوض می‌شوند",
    actionLabel: "🏪 برو بازار",
    tone: "info",
  })

  return out.slice(0, MAX_ACTIONS)
}
