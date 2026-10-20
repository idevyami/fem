// FEMBOY WAR — V19: backfill یک‌باره‌ی طبع/استعداد/ضعف برای فمبوی‌هایِ موجود
//
// ستون‌هایِ personaKey/talentKey/flawKey با db:push اضافه شده‌اند و default ""
// دارند. این اسکریپت برای هر فمبویِ قدیمی همان حلِ قطعیِ موتور را «می‌نشاناند»
// (seedFrom(charId)) — یعنی چیزی که بازیکن تا حالا در UI می‌دید (حلِ تنبل) همان
// می‌شود که DB می‌گوید. ایدمپوتنت است: ردیف‌هایِ پر را دست نمی‌زند.
//
// اجرا: bun scripts/backfill-persona.ts

import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

// همان منطقِ موتور — بدونِ import از Next (اسکریپتِ مستقل):
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedFrom(...parts: (string | number)[]): number {
  const s = parts.join("|")
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const PERSONA_KEYS = ["sunny", "shadow", "noble", "sly", "gentle", "prickly", "storm", "mind"] as const
const TALENTS: Record<string, string[]> = {
  sunny: ["morning_breeze", "crowd_charmer", "thrifty"],
  shadow: ["night_owl", "sharp_eye", "quick_study"],
  noble: ["iron_will", "duelist_heart", "silver_tongue"],
  sly: ["silver_tongue", "sharp_eye", "thrifty"],
  gentle: ["morning_breeze", "deep_sleeper", "quick_study"],
  prickly: ["duelist_heart", "iron_will", "night_owl"],
  storm: ["duelist_heart", "sharp_eye", "iron_will"],
  mind: ["quick_study", "thrifty", "silver_tongue"],
}
const FLAWS: Record<string, string[]> = {
  sunny: ["big_spender", "soft_heart"],
  shadow: ["stage_fright", "restless"],
  noble: ["big_spender", "show_off"],
  sly: ["sleepy_head", "slow_learner"],
  gentle: ["soft_heart", "stage_fright"],
  prickly: ["restless", "show_off"],
  storm: ["sleepy_head", "big_spender"],
  mind: ["stage_fright", "slow_learner"],
}
// دامنه‌ی هر کلید — برای فیلترِ هم‌پوشانیِ استعداد/ضعف
const TALENT_DOMAIN: Record<string, string> = {
  night_owl: "work", silver_tongue: "market", morning_breeze: "spirit", deep_sleeper: "rest",
  iron_will: "combatMoney", sharp_eye: "drop", quick_study: "xp", duelist_heart: "duel",
  thrifty: "recharge", crowd_charmer: "group",
}
const FLAW_DOMAIN: Record<string, string> = {
  sleepy_head: "work", big_spender: "market", restless: "rest", stage_fright: "group",
  slow_learner: "xp", soft_heart: "combatMoney", butterfingers: "drop", show_off: "duel",
}

async function main() {
  const rows = await db.soulCharacter.findMany({ select: { id: true, personaKey: true, talentKey: true, flawKey: true } })
  let touched = 0
  for (const r of rows) {
    const personaKey = r.personaKey || PERSONA_KEYS[Math.floor(mulberry32(seedFrom("persona", r.id))() * 8) % 8]!
    const tPool = TALENTS[personaKey] ?? []
    const talentKey = r.talentKey && tPool.includes(r.talentKey) ? r.talentKey : tPool[Math.floor(mulberry32(seedFrom("talent", r.id))() * tPool.length) % tPool.length] ?? "quick_study"
    const fPool = (FLAWS[personaKey] ?? []).filter((f) => FLAW_DOMAIN[f] !== TALENT_DOMAIN[talentKey])
    const usePool = fPool.length > 0 ? fPool : (FLAWS[personaKey] ?? [])
    const flawKey = r.flawKey && usePool.includes(r.flawKey) ? r.flawKey : usePool[Math.floor(mulberry32(seedFrom("flaw", r.id))() * usePool.length) % usePool.length] ?? "slow_learner"
    if (personaKey === r.personaKey && talentKey === r.talentKey && flawKey === r.flawKey) continue
    await db.soulCharacter.update({
      where: { id: r.id },
      data: { personaKey, talentKey, flawKey },
    })
    touched++
  }
  console.log(`backfill-persona: ${rows.length} فمبوی بررسی شد، ${touched} ردیف نشست.`)
  const dist = await db.soulCharacter.groupBy({ by: ["personaKey"], _count: { _all: true } })
  console.log("توزیعِ طبع‌ها:", dist.map((d) => `${d.personaKey || "(خالی)"}=${d._count}`).join(" "))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
