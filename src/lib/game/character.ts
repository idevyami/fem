// FEMBOY WAR — V8: موتورِ فمبویِ روح‌بسته (Soulbound Femboy engine — نامِ کدِ V7: Soulbound Character)
// سرور-مرجع: ساخت (یکتا و اتمیک)، کارتِ رسمی، روحیه/استقامت، تعامل،
// تغییرِ اسم، ارتقای مهارت، فرگشت، XP/سطح/رتبه، سابقه و تالارِ افتخارات.

import { db } from "@/lib/db"
import type { Player, SoulCharacter } from "@prisma/client"
import {
  CLASSES,
  CLASS_MAP,
  getClass,
  RANKS,
  rankOf,
  spiritCondition,
  SPIRIT_CONDITIONS,
  XP_TRACK_META,
  MASTERY_TIERS,
  masteryLevelOf,
  masteryNextXp,
  masteryTierOf,
  type ClassDef,
  type CombatStats,
  type Evolution,
  type PassiveParam,
  type XpTrack,
} from "./content/classes"
import { ENEMIES, availableEnemies, getEnemy, type EnemyDef } from "./content/enemies"
import { COSMETICS, SOURCE_LABELS, getCosmetic, parseEquipped, parseOwned, type CosmeticDef, type CosmeticSource } from "./content/appearance"
import { PERSONAS, getPersona, type PersonaDef, type InteractKindKey } from "./content/personas"
import { getTalent, getFlaw, DOMAIN_LABELS, type TalentDef, type FlawDef, type TalentDomain } from "./content/talents"
import { STORY_MAP, getStory, STORY_TOTAL_CHAPTERS, trustTierOf, nextTrustTier, type StoryDef, type StoryChoice } from "./content/stories"
import type {
  SoulCardDTO,
  ClassCardDTO,
  SkillStateDTO,
  EvolutionStateDTO,
  EvolutionChoiceDTO,
  CharacterLogDTO,
  HallDTO,
  HallEntryDTO,
  PublicFemboyCardDTO,
  FemboySummaryDTO,
  AppearanceDTO,
  CosmeticDTO,
  MasteryDTO,
  PersonaCardDTO,
  TalentCardDTO,
  AffinityRowDTO,
  StoryCardDTO,
} from "./contract"
import { clamp, mulberry32, seedFrom, pickOne } from "./rng"
import { faDigits } from "./helpers"
import { TITLE_MAP, ACHIEVEMENT_MAP } from "./content/globals"
import type { Tx } from "./economy"
import { applyMoney } from "./economy"

// ─── ثابت‌های تعادل (قابل‌تنظیم، در یک‌جا) ────────────────────────────────────
export const SOUL = {
  STAMINA_REGEN_MIN: 3, // هر 3 دقیقه +1
  STAMINA_START: 18,
  PVE_COST: 3,
  DUEL_COST: 4,
  INTERACT_COOLDOWN_MIN: 10,
  RENAME_COOLDOWN_DAYS: 3,
  ENCOUNTER_TTL_MIN: 15, // رهاسازیِ نبردِ رهاشده
  RECHARGE_COST_PER: 120, // سکه به‌ازای هر واحدِ استقامت
  RECHARGE_MAX_AT_ONCE: 9,
  XP_PER_LEVEL_BASE: 50,
  XP_PER_LEVEL_STEP: 45,
  SKILL_POINT_EVERY: 2, // هر 2 سطح یک نقطه‌مهارت
  NAME_MIN: 2,
  NAME_MAX: 24,
  DUEL_MIN_FIGHTS_WINRATE: 10, // حداقلِ نبرد برای تابلوی نسبتِ برد
  // ── V10: کلاس-تسلط — سقف‌های ضدِ مزرعه (در روز) ──
  MASTERY_DAILY_VICTORIES: 5,
  MASTERY_DAILY_EVENTS: 4,
  MASTERY_DAILY_INTERACTS: 6,
  // ── V10: تعامل — سقفِ روزانه‌ی XP (بعد از آن فقط طعم) ──
  INTERACT_XP_DAILY: 6,
} as const

// ─── V19: شخصیتِ عمیق — طبع/استعداد/ضعف (حلِ قطعی و ماندگار) ────────────────────
//
// حلِ سه‌لایه قطعی است: personaKey/talentKey/flawKey روی رکورد می‌نشینند؛ اگر
// رکوردِ قدیمی خالی باشد (قبل از backfill)، از بذرِ charId قطعی حل می‌شوند —
// همان بازیکن، همان طبع، هر بار. هیچ rngِ شناورِ ری‌رول وجود ندارد.

/** طبعِ مؤثر — کلیدِ رکورد یا حلِ قطعیِ میراث */
export function personaOf(char: Pick<SoulCharacter, "id" | "personaKey">): PersonaDef {
  if (char.personaKey) {
    const p = getPersona(char.personaKey)
    if (p) return p
  }
  const rng = mulberry32(seedFrom("persona", char.id))
  return PERSONAS[Math.floor(rng() * PERSONAS.length) % PERSONAS.length]!
}

/** استعدادِ قطعی برای (charId, طبع) — برای ساختِ تازه و backfill */
function rollTalentFor(charId: string, persona: PersonaDef): TalentDef {
  const rng = mulberry32(seedFrom("talent", charId))
  const pool = persona.talents.map(getTalent).filter((t): t is TalentDef => t !== null)
  return pool[Math.floor(rng() * pool.length) % pool.length] ?? pool[0] ?? TALENT_FALLBACK
}
const TALENT_FALLBACK: TalentDef = {
  key: "quick_study", emoji: "📚", name: "آموزش‌پذیر", desc: "از هر اتفاق زودتر یاد می‌گیرد: 6% XPِ بیشتر در همه‌ی مسیرها.", domain: "xp", pct: 6,
}

/** ضعفِ قطعی برای (charId, طبع, استعداد) — دامنه‌ی هم‌پوشان با استعداد نمی‌گیرد */
function rollFlawFor(charId: string, persona: PersonaDef, talent: TalentDef): FlawDef {
  const rng = mulberry32(seedFrom("flaw", charId))
  const all = persona.flaws.map(getFlaw).filter((f): f is FlawDef => f !== null)
  const pool = all.filter((f) => f.domain !== talent.domain)
  const use = pool.length > 0 ? pool : all
  return use[Math.floor(rng() * use.length) % use.length] ?? all[0] ?? FLAW_FALLBACK
}
const FLAW_FALLBACK: FlawDef = {
  key: "slow_learner", emoji: "🐌", name: "آهسته‌آموز", desc: "با وقتم یاد می‌گیرد: 5% XPِ کمتر در همه‌ی مسیرها.", domain: "xp", pct: -5,
}

export interface PersonaChain {
  persona: PersonaDef
  talent: TalentDef
  flaw: FlawDef
}

/** حلِ کاملِ شخصیت — طبع + استعداد + ضعف (رکورد یا قطعیِ میراث) */
export function resolvePersonaChain(char: Pick<SoulCharacter, "id" | "personaKey" | "talentKey" | "flawKey">): PersonaChain {
  const persona = personaOf(char)
  let talent = char.talentKey ? getTalent(char.talentKey) : null
  if (!talent || !persona.talents.includes(talent.key)) talent = rollTalentFor(char.id, persona)
  let flaw = char.flawKey ? getFlaw(char.flawKey) : null
  const validFlaws = persona.flaws.map(getFlaw).filter((f): f is FlawDef => f !== null)
  const nonOverlap = validFlaws.filter((f) => f.domain !== talent!.domain)
  if (!flaw || !(validFlaws.some((f) => f.key === flaw!.key) && flaw.domain !== talent!.domain)) flaw = rollFlawFor(char.id, persona, talent)
  return { persona, talent, flaw }
}

/** ماتریسِ دامنه‌ها — درصدِ امضای استعداد+ضعف (کلمپ [−12,+12]؛ سقفِ رانشِ محتوا) */
export interface Affinity {
  work: number
  market: number
  spirit: number
  rest: number
  combatMoney: number
  drop: number
  xp: number
  duel: number
  recharge: number
  group: number
}

export function affinityOf(char: Pick<SoulCharacter, "id" | "personaKey" | "talentKey" | "flawKey">): Affinity {
  const { talent, flaw } = resolvePersonaChain(char)
  const a: Affinity = { work: 0, market: 0, spirit: 0, rest: 0, combatMoney: 0, drop: 0, xp: 0, duel: 0, recharge: 0, group: 0 }
  a[talent.domain] += talent.pct
  if (flaw) a[flaw.domain] += flaw.pct
  for (const k of Object.keys(a) as (keyof Affinity)[]) a[k] = clamp(a[k], -12, 12)
  return a
}

/** هزینه‌ی هر واحدِ شارژ برای «این» فمبوی — صرفه‌جو ارزان‌تر (کف 60) */
export function rechargeCostPer(char: Pick<SoulCharacter, "id" | "personaKey" | "talentKey" | "flawKey">): number {
  const aff = affinityOf(char)
  return Math.max(60, Math.round(SOUL.RECHARGE_COST_PER * (1 + aff.recharge / 100)))
}

/** بسته‌ی طبع‌ها برای مرحله‌ی پیمان (bot + Mini App) */
export function personaCardsDTO(): PersonaCardDTO[] {
  return PERSONAS.map((p) => ({ key: p.key, emoji: p.emoji, name: p.name, tagline: p.tagline, traits: [...p.traits], voiceSample: null }))
}

/** نمونه‌ی صدای فمبوی (خطِ talk طبع) — «این‌جوری حرف می‌زنه» */
export function voiceSampleOf(char: Pick<SoulCharacter, "id" | "personaKey" | "name">): string {
  return personaOf(char).voice.talk.replaceAll("{name}", char.name)
}

function talentCardDTOOf(t: TalentDef | FlawDef): TalentCardDTO {
  return { key: t.key, emoji: t.emoji, name: t.name, desc: t.desc, domain: t.domain, domainLabel: DOMAIN_LABELS[t.domain].label, pct: t.pct }
}

function affinityRowsOf(talent: TalentDef, flaw: FlawDef): AffinityRowDTO[] {
  return [
    { domain: talent.domain, label: DOMAIN_LABELS[talent.domain].label, icon: DOMAIN_LABELS[talent.domain].icon, pct: talent.pct, kind: "talent" },
    { domain: flaw.domain, label: DOMAIN_LABELS[flaw.domain].label, icon: DOMAIN_LABELS[flaw.domain].icon, pct: flaw.pct, kind: "flaw" },
  ]
}

// ─── V19: داستانِ شخصی — وضعیت/نما/پیش‌بردن ─────────────────────────────────────

export interface StoryState {
  ch: number
  choices: Record<string, number>
  lastStoryAt: string | null
}

export function storyStateOf(char: Pick<SoulCharacter, "storyJson">): StoryState {
  try {
    const obj = JSON.parse(char.storyJson || "{}") as Partial<StoryState>
    const ch = typeof obj.ch === "number" && obj.ch >= 0 ? Math.min(STORY_TOTAL_CHAPTERS, Math.floor(obj.ch)) : 0
    const choices = obj.choices && typeof obj.choices === "object" ? (obj.choices as Record<string, number>) : {}
    return { ch, choices, lastStoryAt: typeof obj.lastStoryAt === "string" ? obj.lastStoryAt : null }
  } catch {
    return { ch: 0, choices: {}, lastStoryAt: null }
  }
}

/** فاصله تا سدهای فصلِ بعد — null یعنی باز است */
function storyRequirementLine(char: Pick<SoulCharacter, "trust" | "level" | "personaKey" | "id" | "storyJson">): string | null {
  const st = storyStateOf(char)
  if (st.ch >= STORY_TOTAL_CHAPTERS) return null
  const story = getStory(personaOf(char).key)
  if (!story) return null
  const c = story.chapters[st.ch]
  if (!c) return null
  const miss: string[] = []
  if (char.trust < c.req.trust) miss.push(`${faDigits(c.req.trust - char.trust)} اعتماد دیگر`)
  if (char.level < c.req.level) miss.push(`سطحِ ${faDigits(c.req.level)} فمبوی`)
  return miss.length > 0 ? miss.join(" · ") : null
}

/** نمایِ داستان برای DTO — بدون memories (مسیرهایِ لاگ‌دار جدا پرش می‌کنند) */
export function storyView(char: SoulCharacter): StoryCardDTO {
  const persona = personaOf(char)
  const story = getStory(persona.key)
  const st = storyStateOf(char)
  const tier = trustTierOf(char.trust)
  const next = nextTrustTier(char.trust)
  const req = storyRequirementLine(char)
  const status: StoryCardDTO["status"] = st.ch >= STORY_TOTAL_CHAPTERS ? "complete" : req !== null ? "locked" : "available"
  const cur = story && st.ch < STORY_TOTAL_CHAPTERS ? story.chapters[st.ch] : null
  return {
    arcKey: story?.key ?? persona.key,
    arcTitle: story?.title ?? "داستانِ ثبت‌نشده",
    arcEmoji: story?.emoji ?? persona.emoji,
    chaptersTotal: STORY_TOTAL_CHAPTERS,
    chaptersDone: st.ch,
    status,
    requirement: status === "locked" ? req : null,
    current:
      status === "available" && cur
        ? {
            index: st.ch,
            title: cur.title,
            icon: cur.icon,
            text: [...cur.text],
            choices: cur.choices.map((c, i) => ({ idx: i, label: c.label, hint: c.hint })),
          }
        : null,
    trust: char.trust,
    trustPct: char.trust,
    trustTier: { label: tier.label, emoji: tier.emoji },
    nextTrustTier: next ? { label: next.label, emoji: next.emoji, at: next.min } : null,
    memories: [],
  }
}

/** خواندنِ فصلِ جاری — بی‌اثر؛ فقط نما + پیامِ تعارفِ طبع */
export async function storyRead(player: Player, char: SoulCharacter): Promise<{ ok?: { message: string; story: StoryCardDTO }; error?: string }> {
  const persona = personaOf(char)
  const story = getStory(persona.key)
  if (!story) return { error: "برای این طبع هنوز قصه‌ای نوشته نشده." }
  const st = storyStateOf(char)
  if (st.ch >= STORY_TOTAL_CHAPTERS) {
    const memories = await db.characterLog.findMany({ where: { characterId: char.id, type: "story" }, orderBy: { createdAt: "desc" }, take: 5 })
    const view = storyView(char)
    view.memories = memories.map((m) => ({ id: m.id, type: m.type, icon: m.icon, text: m.text, at: m.createdAt.toISOString() }))
    return { ok: { message: `📖 قصه‌ی «${story.title}» تمام شده — از این به بعد، فصل‌هایش را خودتان می‌نویسید.`, story: view } }
  }
  const req = storyRequirementLine(char)
  if (req !== null) return { error: `این فصل هنوز قفل است: ${req} لازم است.` }
  const chapter = story.chapters[st.ch]!
  const opener = persona.voice.memory.replaceAll("{name}", char.name)
  const view = storyView(char)
  const memories = await db.characterLog.findMany({ where: { characterId: char.id, type: "story" }, orderBy: { createdAt: "desc" }, take: 5 })
  view.memories = memories.map((m) => ({ id: m.id, type: m.type, icon: m.icon, text: m.text, at: m.createdAt.toISOString() }))
  return { ok: { message: `${opener}\n📖 فصلِ ${faDigits(st.ch + 1)} از ${faDigits(STORY_TOTAL_CHAPTERS)}: «${chapter.title}»`, story: view } }
}

/** انتخابِ فصلِ جاری — ایدمپوتنت (فصلِ خوانده‌شده دوباره حل نمی‌شود) */
export async function storyChoose(
  player: Player,
  char: SoulCharacter,
  choiceIdx: number,
): Promise<{ ok?: { message: string; story: StoryCardDTO }; error?: string }> {
  const persona = personaOf(char)
  const story = getStory(persona.key)
  if (!story) return { error: "برای این طبع هنوز قصه‌ای نوشته نشده." }
  const st = storyStateOf(char)
  if (st.ch >= STORY_TOTAL_CHAPTERS) return { error: `قصه‌ی «${story.title}» تمام شده — پایانش مالِ خودتان است.` }
  const chapter = story.chapters[st.ch]!
  const choice = chapter.choices[choiceIdx]
  if (!choice) return { error: "چنین انتخابی در این فصل نیست." }
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    const st2 = storyStateOf(fresh)
    if (st2.ch !== st.ch) return { error: "این فصل دیگر جلو نیست — قصه را از فصلِ تازه ادامه بده." }
    if (st2.choices[chapter.id] !== undefined) return { error: "این فصل را خوانده‌ای — قصه جلوتر است." }
    if (fresh.trust < chapter.req.trust || fresh.level < chapter.req.level) {
      const miss: string[] = []
      if (fresh.trust < chapter.req.trust) miss.push(`${faDigits(chapter.req.trust - fresh.trust)} اعتماد دیگر`)
      if (fresh.level < chapter.req.level) miss.push(`سطحِ ${faDigits(chapter.req.level)} فمبوی`)
      return { error: `این فصل هنوز قفل است: ${miss.join(" · ")}` }
    }
    // پیامدها — اعتماد/پیوند/روحیه + پول/XP اگر فصل خواسته باشد
    const newTrust = clamp(fresh.trust + choice.trust, 0, 100)
    const data: Partial<SoulCharacter> = {
      trust: newTrust,
      bond: Math.min(999, fresh.bond + (choice.bond ?? 0)),
      spirit: clamp(fresh.spirit + (choice.spirit ?? 0), 0, 100),
      storyJson: JSON.stringify({ ch: st.ch + 1, choices: { ...st2.choices, [chapter.id]: choiceIdx }, lastStoryAt: new Date().toISOString() }),
    }
    let updated = await tx.soulCharacter.update({ where: { id: fresh.id }, data })
    if (choice.money) await applyMoney(tx, player, choice.money, "misc", `داستانِ شخصی: ${chapter.title}`)
    if (choice.xp && choice.xp > 0) updated = (await awardXpTx(tx, updated, { tracks: { spirit: choice.xp } })).char
    await addCharLog(tx, fresh.id, "story", chapter.icon, `${chapter.title} — ${choice.outcome}`, true)
    const lines: string[] = [choice.outcome]
    // پله‌ی اعتمادِ تازه
    const prevTier = trustTierOf(fresh.trust)
    const nowTier = trustTierOf(newTrust)
    if (nowTier.min > prevTier.min) lines.push(`🤝 پله‌ی اعتماد تازه: ${nowTier.emoji} «${nowTier.label}»`)
    // پایانِ قوس — عنوانِ «راویِ پیمان» + جلا
    if (st.ch + 1 >= STORY_TOTAL_CHAPTERS) {
      const spiritBonus = 15
      updated = await tx.soulCharacter.update({ where: { id: fresh.id }, data: { spirit: clamp(updated.spirit + spiritBonus, 0, 100) } })
      await grantPlayerTitleTx(tx, player.id, "story_weaver")
      await addCharLog(tx, fresh.id, "milestone", "📖", `قصه‌ی «${story.title}» کامل شد.`, true)
      lines.push(`📖 قصه‌ی «${story.title}» به پایان رسید — عنوانِ «راویِ پیمان» به تو رسید و ${faDigits(spiritBonus)} روحیه‌ی جلا به ${fresh.name}.`)
    }
    const memories = await tx.characterLog.findMany({ where: { characterId: fresh.id, type: "story" }, orderBy: { createdAt: "desc" }, take: 5 })
    const view = storyView(updated)
    view.memories = memories.map((m) => ({ id: m.id, type: m.type, icon: m.icon, text: m.text, at: m.createdAt.toISOString() }))
    return { ok: { message: lines.join("\n"), story: view } }
  })
}

// ─── V10: کلاس-تسلط — سطح/پاداش‌ها ─────────────────────────────────────────────

/** پاداشِ استقامتِ تسلط (M3: +2 · M7: +2) */
export function masteryStaminaBonus(masteryLevel: number): number {
  return (masteryLevel >= 3 ? 2 : 0) + (masteryLevel >= 7 ? 2 : 0)
}

/** پاداشِ درصدیِ دستمزدِ شیفت از تسلط (M5: 3% · M10: 5%) */
export function masteryPayoutBonus(masteryLevel: number): number {
  if (masteryLevel >= 10) return 5
  if (masteryLevel >= 5) return 3
  return 0
}

/** پاداشِ درصدیِ جایزه‌ی نبرد از تسلط (M7: 3% · M10: 5%) */
export function masteryRewardBonus(masteryLevel: number): number {
  if (masteryLevel >= 10) return 5
  if (masteryLevel >= 7) return 3
  return 0
}

/** حداکثرِ استقامتِ مؤثر = پایه از سطح + پاداشِ تسلط */
export function effectiveStaminaMax(char: Pick<SoulCharacter, "level" | "masteryXp">): number {
  return SOUL.STAMINA_START + Math.floor((Math.max(1, char.level) - 1) / 5) * 2 + masteryStaminaBonus(masteryLevelOf(char.masteryXp))
}

/** شمارنده‌های روزانه‌ی ضدِ مزرعه (کلید = تاریخِ محلی) */
interface MasteryDaily {
  day: string
  victories: number
  events: number
  interacts: number
  proofs: string[]
}

function dayKeyNow(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseMasteryDaily(raw: string): MasteryDaily {
  try {
    const obj = JSON.parse(raw || "{}") as Partial<MasteryDaily>
    const today = dayKeyNow()
    if (obj.day !== today)
      return { day: today, victories: 0, events: 0, interacts: 0, proofs: [] }
    return {
      day: today,
      victories: Math.max(0, obj.victories ?? 0),
      events: Math.max(0, obj.events ?? 0),
      interacts: Math.max(0, obj.interacts ?? 0),
      proofs: Array.isArray(obj.proofs) ? obj.proofs.slice(-6) : [],
    }
  } catch {
    return { day: dayKeyNow(), victories: 0, events: 0, interacts: 0, proofs: [] }
  }
}

// ─── V8: نقاطِ عطفِ فمبوی — دستاورد/عنوانِ بازیکن (ایدمپوتنت) ──────────────────

/** اعطای دستاورد به بازیکن داخلِ تراکنش — فقط بارِ اول؛ با خبرِ جایزه (الگویِ engine.autoAchievements) */
export async function grantPlayerAchievementTx(tx: Tx, playerId: string, key: string): Promise<boolean> {
  const a = ACHIEVEMENT_MAP[key]
  if (!a) return false
  const existing = await tx.playerAchievement.findUnique({
    where: { playerId_achievementKey: { playerId, achievementKey: key } },
  })
  if (existing) return false
  await tx.playerAchievement.create({ data: { playerId, achievementKey: key } })
  await tx.notification.create({
    data: { playerId, icon: a.emoji, title: `دستاورد: ${a.name}`, body: a.description, kind: "reward" },
  })
  return true
}

/** اعطای عنوان به بازیکن داخلِ تراکنش — فقط بارِ اول (الگویِ outcome.grantTitle در engine) */
export async function grantPlayerTitleTx(tx: Tx, playerId: string, key: string): Promise<boolean> {
  const t = TITLE_MAP[key]
  if (!t) return false
  const existing = await tx.playerTitle.findUnique({
    where: { playerId_titleKey: { playerId, titleKey: key } },
  })
  if (existing) return false
  await tx.playerTitle.create({ data: { playerId, titleKey: key } })
  return true
}

/** اعطای کلاس-تسلط داخلِ تراکنش — با سقفِ روزانه و پاداشِ سطح‌بندی
 *  فقط برای اعمالِ واجدشرط صدا شود: victory/defeat/skillUse/event/interact.
 *  برمی‌گرداند: { char, masteryLevel, tierUps } */
export async function awardMasteryTx(
  tx: Tx,
  char: SoulCharacter,
  reason: "victory" | "defeat" | "skillUse" | "event" | "interact",
  amount: number,
  proofText: string,
): Promise<{ char: SoulCharacter; masteryLevel: number; tierUps: number[] }> {
  const daily = parseMasteryDaily(char.masteryDaily)
  // سقف‌های روزانه — مزرعه‌ی بی‌پایان ممنوع
  if (reason === "victory" || reason === "defeat") {
    if (daily.victories >= SOUL.MASTERY_DAILY_VICTORIES + 3) return { char, masteryLevel: masteryLevelOf(char.masteryXp), tierUps: [] }
    daily.victories += 1
  } else if (reason === "event") {
    if (daily.events >= SOUL.MASTERY_DAILY_EVENTS) return { char, masteryLevel: masteryLevelOf(char.masteryXp), tierUps: [] }
    daily.events += 1
  } else if (reason === "interact") {
    if (daily.interacts >= SOUL.INTERACT_XP_DAILY) return { char, masteryLevel: masteryLevelOf(char.masteryXp), tierUps: [] }
    daily.interacts += 1
  }
  daily.proofs = [...daily.proofs, proofText].slice(-6)
  const oldLevel = masteryLevelOf(char.masteryXp)
  const newXp = char.masteryXp + Math.max(1, Math.round(amount))
  const newLevel = masteryLevelOf(newXp)
  const data: Partial<SoulCharacter> = { masteryXp: newXp, masteryDaily: JSON.stringify(daily) }
  // پاداش‌های گذرِ سطحِ تسلط — مستند در MASTERY_TIERS
  const tierUps: number[] = []
  for (let l = oldLevel + 1; l <= newLevel; l++) {
    tierUps.push(l)
    if (l === 5) {
      data.skillPoints = (data.skillPoints ?? char.skillPoints) + 1
      // V8 — نقطه‌عطفِ تسلط: دستاوردِ «استادِ کلاس»
      await grantPlayerAchievementTx(tx, char.playerId, "class_master")
    }
    if (l === 10) {
      data.skillPoints = (data.skillPoints ?? char.skillPoints) + 2
      // V8 — نقطه‌عطفِ تسلط: عنوانِ «افسانه‌ی کلاس»
      await grantPlayerTitleTx(tx, char.playerId, "mastery_legend")
    }
    const tier = masteryTierOf(l)
    await addCharLog(tx, char.id, "mastery", tier.emoji, `کلاس-تسلطش به «${tier.label}» رسید.`, true)
    // کیهاناتِ تسلط
    for (const cos of COSMETICS) {
      if (cos.source === (`mastery${l}` as CosmeticSource)) await grantCosmeticTx(tx, char, cos.key, cos.source)
    }
  }
  // استقامتِ مؤثر با تسلط رشد می‌کند
  const effMax = SOUL.STAMINA_START + Math.floor((Math.max(1, char.level) - 1) / 5) * 2 + masteryStaminaBonus(newLevel)
  if (effMax > char.staminaMax) {
    data.staminaMax = effMax
    data.stamina = Math.min(char.stamina + (effMax - char.staminaMax), effMax)
  }
  const updated = await tx.soulCharacter.update({ where: { id: char.id }, data })
  return { char: updated, masteryLevel: newLevel, tierUps }
}

// ─── V10: کیهانات — اعطا/پوشیدن ────────────────────────────────────────────────

/** اعطای کیهنات (ایدمپوتنت). اکسسوریِ تازه خودکار پوشیده می‌شود اگر جای خالی باشد. */
export async function grantCosmeticTx(tx: Tx, char: SoulCharacter, key: string, source: CosmeticSource): Promise<boolean> {
  const def = getCosmetic(key)
  if (!def) return false
  const owned = parseOwned(char.cosmeticsJson)
  if (owned[key]) return false
  owned[key] = { source, at: new Date().toISOString() }
  const equipped = parseEquipped(char.appearanceJson)
  if (def.kind === "accessory" && !equipped.accessory) equipped.accessory = key
  const data: Partial<SoulCharacter> = {
    cosmeticsJson: JSON.stringify(owned),
    appearanceJson: JSON.stringify(equipped),
  }
  await tx.soulCharacter.update({ where: { id: char.id }, data })
  return true
}

function cosmeticDTO(def: CosmeticDef, owned: boolean, equipped: boolean): CosmeticDTO {
  return {
    key: def.key,
    kind: def.kind,
    emoji: def.emoji,
    name: def.name,
    desc: def.desc,
    sourceLabel: SOURCE_LABELS[def.source],
    owned,
    equipped,
    colors: def.colors ?? null,
  }
}

export function appearanceDTO(char: SoulCharacter): AppearanceDTO {
  const ownedMap = parseOwned(char.cosmeticsJson)
  const equipped = parseEquipped(char.appearanceJson)
  const mk = (slot: "accessory" | "palette" | "frame"): CosmeticDTO | null => {
    const key = equipped[slot]
    if (!key) return null
    const def = getCosmetic(key)
    return def ? cosmeticDTO(def, true, true) : null
  }
  return {
    equipped: { accessory: mk("accessory"), palette: mk("palette"), frame: mk("frame") },
    owned: COSMETICS.filter((c) => ownedMap[c.key]).map((c) => cosmeticDTO(c, true, equipped[c.kind] === c.key)),
  }
}

/** پوشیدن/درآوردنِ کیهنات — فقط مالِ خودش، فقط جای درست. */
export async function equipAppearance(player: Player, char: SoulCharacter, slot: "accessory" | "palette" | "frame", key: string | null): Promise<{ ok?: { message: string }; error?: string }> {
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    const equipped = parseEquipped(fresh.appearanceJson)
    const owned = parseOwned(fresh.cosmeticsJson)
    if (key === null) {
      delete equipped[slot]
      await tx.soulCharacter.update({ where: { id: fresh.id }, data: { appearanceJson: JSON.stringify(equipped) } })
      return { ok: { message: `${SOURCE_LABELS.starter === "" ? "" : ""}«${fresh.name}» ساده‌تر شد — ${slot === "accessory" ? "بدون اکسسوار" : slot === "palette" ? "با رنگِ کلاس" : "بدون قاب"}.` } }
    }
    const def = getCosmetic(key)
    if (!def || def.kind !== slot) return { error: "این کیهنات برای این جای ظاهر نیست." }
    if (!owned[key]) return { error: `«${def.name}» هنوز مالِ «${fresh.name}» نشده — ${SOURCE_LABELS[def.source]} را بگیر.` }
    equipped[slot] = key
    await tx.soulCharacter.update({ where: { id: fresh.id }, data: { appearanceJson: JSON.stringify(equipped) } })
    return { ok: { message: `«${fresh.name}» از این به بعد با ${def.emoji} «${def.name}» دیده می‌شود.` } }
  })
}

// ─── V10: شاخه‌های فرگشت — حلِ انتخاب‌شده ────────────────────────────────────────

export function evolutionPathOf(char: Pick<SoulCharacter, "evolutionPath">): number[] {
  try {
    const arr = JSON.parse(char.evolutionPath || "[]") as unknown[]
    return Array.isArray(arr) ? arr.map((v) => (v === 1 ? 1 : 0)) : []
  } catch {
    return []
  }
}

/** فرمِ مؤثرِ فمبوی در مرحله‌ی فعلی — شاخه‌ی انتخابی (پیش‌فرض = موروثیِ الف) */
export function resolveEvolution(cls: ClassDef, stage: number, path: number[]): Evolution | null {
  if (stage <= 0) return null
  const s = Math.min(stage, 3)
  const choice = path[s - 1] === 1 ? 1 : 0
  return (choice === 1 ? cls.evolutionAlt : cls.evolutions)[s - 1] ?? null
}

export function xpForLevel(level: number): number {
  // XP لازم برای عبور از این سطح
  return SOUL.XP_PER_LEVEL_BASE + (level - 1) * SOUL.XP_PER_LEVEL_STEP
}

export function totalXpForLevel(level: number): number {
  // مجموعِ XP برای رسیدن به این سطح
  let sum = 0
  for (let l = 1; l < level; l++) sum += xpForLevel(l)
  return sum
}

function levelFromTotalXp(total: number): number {
  let lvl = 1
  let acc = 0
  while (lvl < 60) {
    const need = xpForLevel(lvl)
    if (acc + need > total) break
    acc += need
    lvl++
  }
  return lvl
}

// ─── اسمِ فمبوی: اعتبارسنجی ────────────────────────────────────────────────────
const RESERVED_NAMES = new Set(
  [
    ...CLASSES.map((c) => c.name),
    ...CLASSES.map((c) => c.key),
    // V8: «همدم» (واژه‌ی منسوخِ V7) دیگر رزرو نیست — هویتِ شخص، «فمبوی» است
    "femboy", "فمبوی", "شهر", "تهران", "admin", "مدیر", "ربات", "bot",
  ],
)

export function validateCharacterName(raw: string): { ok: boolean; error?: string } {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name.length < SOUL.NAME_MIN) return { ok: false, error: "اسمِ فمبوی باید حداقل 2 حرف باشد." }
  if (name.length > SOUL.NAME_MAX) return { ok: false, error: `اسم حداکثر ${faDigits(SOUL.NAME_MAX)} حرف است.` }
  // حروف فارسی/لاتین/رقم/فاصله + ایموجی‌های ساده‌ی مجاز
  if (!/^[\p{L}\p{N} \u200C]+$/u.test(name)) return { ok: false, error: "فقط حرف، عدد و فاصله — بدونِ علامت‌های عجیب." }
  if (RESERVED_NAMES.has(name.toLowerCase())) return { ok: false, error: "این اسم برای خودِ شهر رزرو شده." }
  return { ok: true }
}

// ─── مهارت‌ها/فرگشت: پارامترهای مؤثر ─────────────────────────────────────────

export function skillRanks(char: Pick<SoulCharacter, "skillsJson">): Map<string, number> {
  try {
    const obj = JSON.parse(char.skillsJson) as Record<string, number>
    return new Map(Object.entries(obj).filter(([, v]) => typeof v === "number" && v > 0))
  } catch {
    return new Map()
  }
}

export function effectivePassiveParams(cls: ClassDef, ranks: Map<string, number>, evo: Evolution | null = null): Record<PassiveParam, number> {
  const out = { ...cls.passive.base } as Record<PassiveParam, number>
  for (const s of cls.skills) {
    if (s.effect.kind !== "passive") continue
    const rank = ranks.get(s.id) ?? 0
    if (rank <= 0) continue
    const cur = (out[s.effect.param] ?? 0) + s.effect.perRank * rank
    out[s.effect.param] = cur
  }
  // V10 — سوگیریِ شاخه‌ی فرگشتِ انتخاب‌شده
  if (evo?.passiveBonus) {
    for (const [k, v] of Object.entries(evo.passiveBonus)) {
      const key = k as PassiveParam
      out[key] = (out[key] ?? 0) + (v ?? 0)
    }
  }
  return out
}

export interface DerivedStats extends CombatStats {
  hp: number
}

export function deriveStats(char: Pick<SoulCharacter, "classKey" | "level" | "evolution" | "evolutionPath" | "skillsJson">): DerivedStats {
  const cls = getClass(char.classKey)
  if (!cls) throw new Error(`کلاسِ ناشناخته: ${char.classKey}`)
  const ranks = skillRanks(char)
  const evo = resolveEvolution(cls, char.evolution, evolutionPathOf(char))
  const mult = evo?.statMult ?? 1
  const lvl = Math.max(1, char.level)
  const out: DerivedStats = { hp: 0, atk: 0, def: 0, crit: 0, critDmg: 0, dodge: 0, acc: 0, speed: 0, luck: 0, loot: 0 }
  for (const k of ["atk", "def", "crit", "critDmg", "dodge", "acc", "speed", "luck", "loot"] as const) {
    const grown = cls.base[k] + cls.growth[k] * (lvl - 1)
    out[k] = grown * mult
  }
  // V10 — سوگیریِ شاخه‌ی فرگشت (بعد از رشد)
  if (evo?.statBonus) {
    for (const [k, v] of Object.entries(evo.statBonus)) {
      const key = k as keyof CombatStats
      out[key] += v ?? 0
    }
  }
  // اثرِ مهارت‌های آماری
  for (const s of cls.skills) {
    if (s.effect.kind !== "stat") continue
    const rank = ranks.get(s.id) ?? 0
    if (rank <= 0) continue
    out[s.effect.stat] += s.effect.perRank * rank
  }
  // سقف‌ها
  out.crit = clamp(out.crit, 0, 60)
  out.dodge = clamp(out.dodge, 0, 40)
  out.acc = clamp(out.acc, 40, 99)
  out.critDmg = clamp(out.critDmg, 100, 400)
  out.hp = Math.round(cls.hpBase + cls.hpPerLvl * (lvl - 1) + out.def * 2)
  // گردکردنِ نهایی
  out.atk = Math.round(out.atk * 10) / 10
  out.def = Math.round(out.def * 10) / 10
  return out
}

// ─── استقامت: بازسازیِ زمان-محور (خوانش = محاسبه؛ بدونِ وابستگی به فرایندِ زنده) ─

export function regenElapsed(stamina: number, staminaMax: number, staminaAt: Date, now = new Date()): { stamina: number; staminaAt: Date; minutesToNext: number | null } {
  if (stamina >= staminaMax) return { stamina: staminaMax, staminaAt: now, minutesToNext: null }
  const elapsedMin = Math.max(0, (now.getTime() - staminaAt.getTime()) / 60000)
  const gained = Math.floor(elapsedMin / SOUL.STAMINA_REGEN_MIN)
  if (gained <= 0) {
    const left = SOUL.STAMINA_REGEN_MIN - (elapsedMin % SOUL.STAMINA_REGEN_MIN)
    return { stamina, staminaAt, minutesToNext: Math.ceil(left) }
  }
  const newSt = Math.min(staminaMax, stamina + gained)
  const remainderMin = elapsedMin % SOUL.STAMINA_REGEN_MIN
  const newAt = new Date(now.getTime() - remainderMin * 60000)
  const minutesToNext = newSt >= staminaMax ? null : Math.ceil(SOUL.STAMINA_REGEN_MIN - remainderMin)
  return { stamina: newSt, staminaAt: newAt, minutesToNext }
}

/** همگام‌سازیِ تنبل (خواندنی + ماندگار). از elapsed-time می‌آید → ایدمپوتنت.
 *  V10: حداکثرِ استقامتِ مؤثر را هم آشتی می‌دهد (پاداشِ تسلط روی داده‌ی قدیمی) */
export async function syncCharacter(char: SoulCharacter): Promise<SoulCharacter> {
  const effMax = effectiveStaminaMax(char)
  const staminaMax = Math.max(char.staminaMax, effMax)
  const r = regenElapsed(char.stamina, staminaMax, char.staminaAt)
  if (r.stamina === char.stamina && staminaMax === char.staminaMax) return char
  // به‌روزرسانیِ شرطی: فقط اگر کسی غیر ازِ ما تغییر نداده
  const res = await db.soulCharacter.updateMany({
    where: { id: char.id, stamina: char.stamina, staminaMax: char.staminaMax },
    data: { stamina: r.stamina, staminaAt: r.staminaAt, staminaMax },
  })
  if (res.count === 0) return db.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
  return { ...char, stamina: r.stamina, staminaAt: r.staminaAt, staminaMax }
}

// ─── سابقه‌ی فمبوی (CharacterLog) ──────────────────────────────────────────────

export async function addCharLog(tx: Tx, characterId: string, type: string, icon: string, text: string, isPublic = true) {
  await tx.characterLog.create({ data: { characterId, type, icon, text, isPublic } })
}

export async function getCharLogs(characterId: string, limit = 30): Promise<CharacterLogDTO[]> {
  const rows = await db.characterLog.findMany({ where: { characterId }, orderBy: { createdAt: "desc" }, take: limit })
  return rows.map((r) => ({ id: r.id, type: r.type, icon: r.icon, text: r.text, at: r.createdAt.toISOString() }))
}

// ─── XP و سطح ─────────────────────────────────────────────────────────────────

export interface XpAward {
  tracks: Partial<Record<XpTrack, number>>
}

/** اعطای XP داخلِ تراکنش + ارتقای سطح/رتبه + لاگ. کاراکترِ به‌روزشده را برمی‌گرداند.
 *  V19 — استعداد/ضعفِ «XP» همین‌جا اعمال می‌شود: تک‌قلابِ همه‌ی مسیرهایِ XP. */
export async function awardXpTx(tx: Tx, char: SoulCharacter, award: XpAward): Promise<{ char: SoulCharacter; levelUps: number[]; rankUps: string[] }> {
  const xpJson = JSON.parse(char.xpJson || "{}") as Record<string, number>
  let total = char.totalXp
  const xpPct = affinityOf(char).xp // V19 — استعدادِ آموزش‌پذیر / ضعفِ آهسته‌آموز
  for (const [k, v] of Object.entries(award.tracks)) {
    if (!v || v <= 0) continue
    const scaled = Math.max(1, Math.round(v * (1 + xpPct / 100)))
    xpJson[k] = (xpJson[k] ?? 0) + scaled
    total += scaled
  }
  const oldLevel = char.level
  const newLevel = levelFromTotalXp(total)
  const levelUps: number[] = []
  for (let l = oldLevel + 1; l <= newLevel; l++) levelUps.push(l)
  // نقاطِ مهارت: هر SKILL_POINT_EVERY سطح یک‌بار
  const gainedBefore = Math.floor((oldLevel - 1) / SOUL.SKILL_POINT_EVERY)
  const gainedAfter = Math.floor((newLevel - 1) / SOUL.SKILL_POINT_EVERY)
  const spGain = (gainedAfter - gainedBefore) * 1
  const data: Partial<SoulCharacter> = { xpJson: JSON.stringify(xpJson), totalXp: total, level: newLevel }
  if (spGain > 0) data.skillPoints = char.skillPoints + spGain
  // staminaMax رشد می‌کند: +2 به‌ازای هر 5 سطح + پاداشِ تسلط (V10)
  const oldMax = char.staminaMax
  const newMax = effectiveStaminaMax({ level: newLevel, masteryXp: char.masteryXp })
  if (newMax > oldMax) {
    data.staminaMax = newMax
    data.stamina = Math.min(char.stamina + (newMax - oldMax), newMax)
  }
  const updated = await tx.soulCharacter.update({ where: { id: char.id }, data })
  const rankUps: string[] = []
  if (newLevel !== oldLevel) {
    const oldRank = rankOf(oldLevel)
    const newRank = rankOf(newLevel)
    if (oldRank.min !== newRank.min) {
      rankUps.push(newRank.name)
      await addCharLog(tx, char.id, "rank", newRank.emoji, `رتبه‌ی «${newRank.name}» را گرفت.`, true)
    }
    for (const l of levelUps) {
      if ((l - 1) % SOUL.SKILL_POINT_EVERY === 0) {
        await addCharLog(tx, char.id, "level", "⭐", `به سطح ${faDigits(l)} رسید.`, true)
      }
      // V10 — کیهاناتِ سطح + قاب‌ها
      for (const cos of COSMETICS) {
        if (cos.source === (`level${l}` as CosmeticSource)) await grantCosmeticTx(tx, char, cos.key, cos.source)
      }
    }
  }
  return { char: updated, levelUps, rankUps }
}

// ─── ساختِ فمبوی (اتمیک؛ دوباره‌سازی غیرممکن) ──────────────────────────────────

/** V19 — طبع را بازیکن در مراسمِ پیمان برمی‌گزیند؛ اگر نیامد، قطعی از بذرِ بازیکن */
export async function createCharacter(
  player: Player,
  opts: { name: string; classKey: string; personaKey?: string },
): Promise<{ char?: SoulCharacter; error?: string }> {
  const nameCheck = validateCharacterName(opts.name)
  if (!nameCheck.ok) return { error: nameCheck.error }
  const cls = getClass(opts.classKey)
  if (!cls) return { error: "چنین کلاسی در این جهان وجود ندارد." }
  let persona: PersonaDef | null = null
  if (opts.personaKey !== undefined && opts.personaKey !== "") {
    persona = getPersona(opts.personaKey)
    if (!persona) return { error: "چنین طبعی در این شهر نمی‌روید — یکی از هشت طبعِ شهر را انتخاب کن." }
  } else {
    // قطعی از بذرِ بازیکن — همان بازیکن همیشه همان طبعِ پیش‌فرض را می‌گیرد
    const rng = mulberry32(seedFrom("persona", player.id))
    persona = PERSONAS[Math.floor(rng() * PERSONAS.length) % PERSONAS.length]!
  }
  const chosenPersona = persona
  try {
    return await db.$transaction(async (tx) => {
      // invariant: یک بازیکن = یک فمبوی — unique playerId این را تضمین می‌کند
      const existing = await tx.soulCharacter.findUnique({ where: { playerId: player.id } })
      if (existing) return { error: "فمبوی تو همین‌جاست. عهد، عهد است." }
      let char = await tx.soulCharacter.create({
        data: {
          playerId: player.id,
          name: opts.name.trim().replace(/\s+/g, " "),
          classKey: cls.key,
          stamina: SOUL.STAMINA_START,
          staminaMax: SOUL.STAMINA_START,
        },
      })
      // V19 — استعداد/ضعفِ قطعی روی رکورد بنشیند (همان منطقِ backfill)
      const talent = rollTalentFor(char.id, chosenPersona)
      const flaw = rollFlawFor(char.id, chosenPersona, talent)
      char = await tx.soulCharacter.update({
        where: { id: char.id },
        data: { personaKey: chosenPersona.key, talentKey: talent.key, flawKey: flaw.key },
      })
      // V10 — هدیه‌ی پیمان: پاپیونِ پیمان خودکار پوشیده می‌شود
      await grantCosmeticTx(tx, char, "acc_ribbon", "starter")
      await addCharLog(
        tx,
        char.id,
        "creation",
        cls.emoji,
        `پیمانِ فمبوی بسته شد: ${char.name}، ${cls.name} با طبعِ ${chosenPersona.emoji} «${chosenPersona.name}».`,
        true,
      )
      await tx.historyEntry.create({
        data: {
          playerId: player.id,
          icon: "🎀",
          text: `فمبوی‌اش به نامِ «${char.name}» متولد شد — ${cls.name}، ${chosenPersona.name}.`,
          category: "social",
          day: player.day,
        },
      })
      return { char }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("Unique constraint")) return { error: "فمبوی تو همین‌جاست. عهد، عهد است." }
    return { error: "پیمان بسته نشد — دوباره تلاش کن." }
  }
}

// ─── کارتِ رسمی (DTO) ─────────────────────────────────────────────────────────

export function classCardDTO(cls: ClassDef): ClassCardDTO {
  const diff = ["آسان", "متعادل", "چالشی"][cls.difficulty - 1] ?? "متعادل"
  return {
    key: cls.key,
    emoji: cls.emoji,
    name: cls.name,
    roleName: cls.roleName,
    fantasy: cls.fantasy,
    difficulty: cls.difficulty,
    difficultyLabel: diff,
    strengths: cls.strengths,
    weaknesses: cls.weaknesses,
    playStyle: cls.playStyle,
    passive: { name: cls.passive.name, icon: cls.passive.icon, desc: cls.passive.desc },
    activeSkill: { name: cls.activeSkill.name, icon: cls.activeSkill.icon, desc: cls.activeSkill.desc, cooldown: cls.activeSkill.cooldown },
    art: cls.art,
    palette: cls.palette,
    loreIntro: cls.lore.intro,
  }
}

export function classCardsDTO(): ClassCardDTO[] {
  return CLASSES.map(classCardDTO)
}

function effectPreviewOf(cls: ClassDef, skillId: string, nextRank: number): string {
  const s = cls.skills.find((x) => x.id === skillId)
  if (!s) return ""
  if (s.effect.kind === "stat") {
    const meta = STAT_LABELS[s.effect.stat]
    const total = s.effect.perRank * nextRank
    return faDigits(`${meta.label} +${fmtStat(s.effect.stat, total)}`)
  }
  if (s.effect.kind === "passive") {
    return faDigits(`${PASSIVE_PARAM_LABELS[s.effect.param] ?? s.effect.param} ${s.effect.perRank > 0 ? "+" : ""}${round1(s.effect.perRank * nextRank)}`)
  }
  return "مهارتِ فعالِ امضا"
}

const STAT_LABELS: Record<keyof CombatStats, { label: string }> = {
  atk: { label: "حمله" },
  def: { label: "دفاع" },
  crit: { label: "بحرانی" },
  critDmg: { label: "ضریبِ بحرانی" },
  dodge: { label: "گریز" },
  acc: { label: "دقت" },
  speed: { label: "سرعت" },
  luck: { label: "شانس" },
  loot: { label: "غنیمت" },
}

function fmtStat(stat: keyof CombatStats, v: number): string {
  return stat === "crit" || stat === "critDmg" || stat === "dodge" || stat === "acc" || stat === "luck" || stat === "loot" ? `${Math.round(v)}%` : `${Math.round(v * 10) / 10}`
}

const PASSIVE_PARAM_LABELS: Record<PassiveParam, string> = {
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

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

// ─── V14: لایه‌ی B — دیوارِ عددِ بی‌توضیح ممنوع (مأموریتِ II) ──────────────────

/** توضیحِ یک‌خطیِ هر آمار — چه در نبرد می‌کند، با سقف‌ها (اگر باشند) */
export const STAT_EXPLANATIONS: { key: keyof CombatStats; labelFa: string; textFa: string }[] = [
  { key: "atk", labelFa: "حمله", textFa: "قدرتِ هر ضربه — پیش از کسرِ دفاعِ حریف؛ همه‌ی ضریب‌های کلاسی روی این عدد سوار می‌شوند." },
  { key: "def", labelFa: "دفاع", textFa: "هر نقطه‌اش ضربه‌ی واردشده را نرم‌تر می‌کند؛ نیمی از آن در فرمولِ نبرد و دو برابرش در خونِ کل." },
  { key: "crit", labelFa: "بحرانی", textFa: "شانسِ ضربه‌ی بحرانی در هر حمله (سقفِ 60) — تریگرِ انفجارِ جادوگر هم همین‌جاست." },
  { key: "critDmg", labelFa: "ضریبِ بحرانی", textFa: "چقدرِ بیشترِ ضربه‌ی بحرانی (150 یعنی 1.5 برابر؛ محدوده‌ی 100 تا 400)." },
  { key: "dodge", labelFa: "گریز", textFa: "شانسِ کامل جاخالی‌دادن (سقفِ 40) — در برابرِ دقتِ حریف سنجیده می‌شود؛ جاخالیِ شینوبی نشان می‌سازد." },
  { key: "acc", labelFa: "دقت", textFa: "در برابرِ گریزِ حریف (محدوده‌ی 40 تا 99) — خطا زدن تمرکز و تمپو را صفر می‌کند." },
  { key: "speed", labelFa: "سرعت", textFa: "ابتکار عمل — سریع‌تر اول می‌زند و در دوئلِ مساوی، برنده است." },
  { key: "luck", labelFa: "شانس", textFa: "تریگرهایِ ویژه — از افتِ آیتم تا شانس‌هایِ پنهانِ شهر." },
  { key: "loot", labelFa: "غنیمت", textFa: "درصدِ پاداشِ اضافه‌ی نبرد و غنیمتِ میدان (سقف ندارد)." },
]

/** جزئیاتِ زنده‌ی امضای کلاس — مقادیرِ واقعی از پارامترهایِ مؤثر، با معنای هر-استک/هر-راند */
export function passiveDetailOf(cls: ClassDef, params: Record<string, number>): { name: string; descFa: string; paramsLive: Record<string, number> } {
  const v = (k: string, d: number) => params[k] ?? d
  let descFa = cls.passive.desc
  switch (cls.key) {
    case "shinobi":
      descFa = `هر نشانِ سایه +${faDigits(v("shadowMarkDmg", 10))}% آسیب به ضربه‌ی بعدی (حداکثر 3 نشان؛ هر حلِ دفاعی یکی می‌سازد و ضربه محوشان می‌کند).`
      break
    case "ranger":
      descFa = `هر تمرکز +${faDigits(v("focusDmg", 8))}% آسیب (حداکثر 3؛ هر ضربه‌ی موفقِ پیاپی یکی می‌سازد و خطا/ضربه‌خوردن صفرش می‌کند).`
      break
    case "wizard":
      descFa = `با هر بحرانی ${faDigits(v("burstChance", 35))}% شانسِ انفجارِ اسرار: +${faDigits(v("burstBonus", 25))}% آسیبِ اضافی و ${faDigits(v("burstBonus", 25))}% جایزه‌ی سکه — فقط یک‌بار در هر نبردِ حل‌شده.`
      break
    case "trickster":
      descFa = `${faDigits(v("deceptionChance", 27))}% شانس در هر راند: حرکتِ حریف فرو می‌پاشد و تلمبه‌ی 75% آسیب می‌خورد.`
      break
    case "paladin":
      descFa = `وقتی خون زیرِ 40% بیفتد، هر ضربه‌ی خورده ${faDigits(v("resolveMitg", 30))}% نرم‌تر می‌نشیند و 6% خونِ کل برمی‌گردد.`
      break
    case "duelist":
      descFa = `هر تمپو +${faDigits(v("tempoDmg", 8))}% آسیب (حداکثر 3؛ ضربه‌های پیاپی می‌سازند و ضربه‌خوردن/گارد صفرش می‌کند).`
      break
    case "summoner":
      descFa = `هر دومین راند، گرگِ روح با ${faDigits(v("wolfPower", 55))}% قدرتِ تو می‌زند؛ مهارتِ امضا گرگِ 70% را هم بلافاصله می‌خواند.`
      break
    case "reaper":
      descFa = `تا وقتی خون بالای 50% است +${faDigits(v("crimsonDmg", 10))}% آسیب؛ بهایش ${faDigits(v("crimsonCost", 6))}% خونِ فعلی به‌ازای هر ضربه است.`
      break
  }
  return { name: cls.passive.name, descFa, paramsLive: { ...params } }
}

// ─── V9: خلاصه‌ی هویتی — همه‌ی سطح‌ها (پیشخوان ربات، خانه‌ی مینی‌اپ، راهنما) ───

/** خلاصه‌ی سبکِ فمبوی از روی رکوردِ sync شده — بدونِ کوئریِ اضافه. */
/** سلوکِ بعدیِ فمبوی — یک خطِ راهنما برای کارتِ هویت */
function nextMilestoneOf(char: SoulCharacter, cls: ClassDef): string {
  if (char.skillPoints > 0) return `${char.name} ${faDigits(char.skillPoints)} نقطه‌مهارتِ بی‌استفاده دارد`
  const evoIdx = char.evolution
  if (evoIdx < 3) {
    const evo = cls.evolutions[evoIdx]
    if (char.level >= evo.reqLevel && char.wins >= evo.reqWins) return `فرگشتِ «${evo.name}» آماده است — شاخه‌اش را انتخاب کن`
    if (char.level < evo.reqLevel) return `${faDigits(evo.reqLevel - char.level)} سطح دیگر تا فرگشتِ بعدی`
  }
  const mLevel = masteryLevelOf(char.masteryXp)
  const nextXp = masteryNextXp(mLevel)
  if (nextXp !== null && nextXp - char.masteryXp <= 15)
    return `${faDigits(nextXp - char.masteryXp)} تسلط دیگر تا «${masteryTierOf(Math.min(10, mLevel + 1)).label}»`
  const need = xpForLevel(char.level)
  const into = char.totalXp - totalXpForLevel(char.level)
  return `${faDigits(Math.max(0, need - into))} XP تا سطحِ ${faDigits(char.level + 1)}`
}

export function femboySummaryDTO(char: SoulCharacter): FemboySummaryDTO {
  const cls = getClass(char.classKey)
  if (!cls) throw new Error(`کلاسِ ناشناخته: ${char.classKey}`)
  const cond = spiritCondition(char.spirit)
  const path = evolutionPathOf(char)
  const evo = resolveEvolution(cls, char.evolution, path)
  const effMax = Math.max(char.staminaMax, effectiveStaminaMax(char))
  const r = regenElapsed(char.stamina, effMax, char.staminaAt)
  const rank = rankOf(char.level)
  const mLevel = masteryLevelOf(char.masteryXp)
  const mTier = masteryTierOf(mLevel)
  const equipped = parseEquipped(char.appearanceJson)
  const acc = equipped.accessory ? getCosmetic(equipped.accessory) : null
  // V19 — طبع + تراشه‌ی داستان برای کارت‌های سبک (چیپِ قفل، فاصله تا سدها را می‌گوید)
  const persona = personaOf(char)
  const st = storyStateOf(char)
  const reqLine = storyRequirementLine(char)
  const storyChip =
    st.ch >= STORY_TOTAL_CHAPTERS
      ? "📖 قصه‌ش کامل شد"
      : `📖 فصلِ ${faDigits(st.ch + 1)} از ${faDigits(STORY_TOTAL_CHAPTERS)}${reqLine ? ` · ${reqLine}` : ""}`
  return {
    name: char.name,
    classKey: cls.key,
    classEmoji: cls.emoji,
    className: cls.name,
    evolutionName: evo?.name ?? "شکلِ آغازین",
    evolutionEmoji: evo?.emoji ?? cls.emoji,
    level: char.level,
    rank: { key: `rank_${rank.min}`, emoji: rank.emoji, name: rank.name },
    spirit: char.spirit,
    spiritPct: char.spirit,
    condition: { label: cond.label, emoji: cond.emoji, dmgMod: cond.dmgMod, canFight: cond.canFight },
    stamina: r.stamina,
    staminaMax: effMax,
    skillPoints: char.skillPoints,
    wins: char.wins,
    losses: char.losses,
    mastery: {
      level: mLevel,
      emoji: mTier.emoji,
      label: mTier.label,
      xp: char.masteryXp,
      nextTierXp: masteryNextXp(mLevel),
    },
    accessoryEmoji: acc?.emoji ?? null,
    evolutionPathName: evo && path.some((p) => p === 1) ? (evo.pathLabel ?? null) : null,
    nextMilestone: nextMilestoneOf(char, cls),
    // V19 — طبع + تراشه‌ی داستان
    persona: { key: persona.key, emoji: persona.emoji, name: persona.name },
    storyChip,
  }
}

export function soulCardDTO(char: SoulCharacter): SoulCardDTO {
  const cls = getClass(char.classKey)
  if (!cls) throw new Error(`کلاسِ ناشناخته: ${char.classKey}`)
  const ranks = skillRanks(char)
  const stats = deriveStats(char)
  const cond = spiritCondition(char.spirit)
  const evoIdx = char.evolution
  const path = evolutionPathOf(char)
  const evo = resolveEvolution(cls, evoIdx, path)
  const effMax = Math.max(char.staminaMax, effectiveStaminaMax(char))
  const r = regenElapsed(char.stamina, effMax, char.staminaAt)
  const rank = rankOf(char.level)
  const xpJson = JSON.parse(char.xpJson || "{}") as Record<string, number>

  const intoLevel = char.totalXp - totalXpForLevel(char.level)
  const need = xpForLevel(char.level)

  // V10 — برچسبِ شاخه‌ها
  const BRANCH_LABELS: Record<string, string> = { core: "هسته‌ی رزمی", life: "مسیرِ زندگی", art: "قله‌ی هنر" }

  const skills: SkillStateDTO[] = cls.skills.map((s) => {
    const rankN = ranks.get(s.id) ?? 0
    const prereq = s.requires ? cls.skills.find((x) => x.id === s.requires) ?? null : null
    const prereqRank = prereq ? (ranks.get(prereq.id) ?? 0) : 0
    const levelLocked = char.level < s.unlockLevel
    const evoLocked = s.evolutionReq !== undefined && evoIdx < s.evolutionReq
    const reqLocked = prereq !== null && prereqRank < 1
    const locked = levelLocked || evoLocked || reqLocked
    const maxed = rankN >= s.maxRank
    const canUpgrade = !locked && !maxed && char.skillPoints >= s.spCost
    let lockedReason: string | null = null
    let upgradeReason: string | null = null
    if (levelLocked) lockedReason = `سطح ${faDigits(s.unlockLevel)} لازم است`
    else if (evoLocked) lockedReason = `فرگشتِ ${faDigits(s.evolutionReq ?? 1)} لازم است`
    else if (reqLocked) lockedReason = `اول «${prereq?.name}» را باز کن`
    else if (maxed) upgradeReason = "در بالاترین رتبه است"
    else if (char.skillPoints < s.spCost) upgradeReason = `${faDigits(s.spCost)} نقطه‌مهارت لازم داری`
    return {
      id: s.id,
      name: s.name,
      icon: s.icon,
      desc: s.desc,
      type: s.type,
      unlockLevel: s.unlockLevel,
      maxRank: s.maxRank,
      rank: rankN,
      spCost: s.spCost,
      locked,
      lockedReason,
      canUpgrade,
      upgradeReason,
      effectPreview: effectPreviewOf(cls, s.id, Math.min(s.maxRank, rankN + 1)),
      branch: s.branch,
      branchLabel: BRANCH_LABELS[s.branch] ?? s.branch,
      requiresSkillId: s.requires ?? null,
      requiresSkillName: prereq?.name ?? null,
      evolutionReq: s.evolutionReq ?? null,
    }
  })

  /** فرمِ هر مرحله = شاخه‌ی انتخاب‌شده (گذشته) یا گزینه‌ی الف (آینده) */
  const evolutionDTO = (stage: number, chosen: boolean): EvolutionStateDTO => {
    const idx = chosen && path[stage - 1] === 1 ? 1 : 0
    const e = (idx === 1 ? cls.evolutionAlt : cls.evolutions)[stage - 1]
    const reached = char.level >= e.reqLevel && char.wins >= e.reqWins && char.evolution >= stage
    return {
      name: e.name,
      emoji: e.emoji,
      reqLevel: e.reqLevel,
      reqWins: e.reqWins,
      lore: e.lore,
      reached,
      isCurrent: char.evolution === stage,
      requirements: [
        { label: `سطح ${faDigits(e.reqLevel)}`, done: char.level >= e.reqLevel },
        { label: `${faDigits(e.reqWins)} برد`, done: char.wins >= e.reqWins },
      ],
      pathLabel: e.pathLabel ?? "مسیرِ اصلی",
      isChosen: chosen,
      preview: evolutionPreviewOf(e),
      art: e.art ?? null, // V8 §24 — پرتره‌ی اختصاصیِ فُرم (مرحله‌ی ۲/۳)
    }
  }

  // نردبانِ گذشته/حال — فرمِ انتخاب‌شده‌ی هر مرحله‌ی طی‌شده + فرمِ الف برای آینده
  const evolutions: EvolutionStateDTO[] = [0, 1, 2].map((i) => evolutionDTO(i + 1, char.evolution > i))

  // V10 — تصمیمِ بعدی: هر دو شاخه‌ی مرحله‌ی بعد
  let nextEvolution: EvolutionChoiceDTO | null = null
  if (evoIdx < 3) {
    const a = cls.evolutions[evoIdx]
    const eligible = char.level >= a.reqLevel && char.wins >= a.reqWins
    nextEvolution = {
      stage: evoIdx + 1,
      options: [evolutionDTO(evoIdx + 1, false), (() => {
        const b = cls.evolutionAlt[evoIdx]
        return {
          name: b.name,
          emoji: b.emoji,
          reqLevel: b.reqLevel,
          reqWins: b.reqWins,
          lore: b.lore,
          reached: eligible,
          isCurrent: false,
          requirements: [
            { label: `سطح ${faDigits(b.reqLevel)}`, done: char.level >= b.reqLevel },
            { label: `${faDigits(b.reqWins)} برد`, done: char.wins >= b.reqWins },
          ],
          pathLabel: b.pathLabel ?? "مسیرِ دوم",
          isChosen: false,
          preview: evolutionPreviewOf(b),
          art: b.art ?? null, // V8 §24 — پرتره‌ی اختصاصیِ فُرم (مرحله‌ی ۲/۳)
        }
      })()],
      eligible,
      isFinal: false,
    }
  }

  const equippedAppearance = parseEquipped(char.appearanceJson)
  const equippedPalette =
    equippedAppearance.palette && getCosmetic(equippedAppearance.palette)?.colors
      ? (getCosmetic(equippedAppearance.palette)?.colors as { primary: string; soft: string })
      : null

  const mLevel = masteryLevelOf(char.masteryXp)
  const mTier = masteryTierOf(mLevel)
  const mastery: MasteryDTO = {
    level: mLevel,
    emoji: mTier.emoji,
    label: mTier.label,
    perk: mTier.perk,
    xp: char.masteryXp,
    nextTierXp: masteryNextXp(mLevel),
    recentProofs: parseMasteryDaily(char.masteryDaily).proofs,
  }

  const fights = char.wins + char.losses
  const interactLeft = char.lastInteractAt ? Math.max(0, SOUL.INTERACT_COOLDOWN_MIN - (Date.now() - char.lastInteractAt.getTime()) / 60000) : 0
  const renameLeft = char.lastNameChangeAt ? Math.max(0, (SOUL.RENAME_COOLDOWN_DAYS * 24 * 60) - (Date.now() - char.lastNameChangeAt.getTime()) / 60000) : 0

  const xpTracks = (Object.keys(XP_TRACK_META) as XpTrack[]).filter((k) => (xpJson[k] ?? 0) > 0).map((k) => ({
    key: k,
    label: XP_TRACK_META[k].label,
    icon: XP_TRACK_META[k].icon,
    xp: xpJson[k] ?? 0,
  }))

  // V19 — حلِ کاملِ شخصیت + ماتریسِ دامنه‌ها + داستان
  const chain = resolvePersonaChain(char)

  return {
    name: char.name,
    classKey: cls.key,
    classEmoji: cls.emoji,
    className: cls.name,
    evolution: evoIdx,
    evolutionName: evo?.name ?? "شکلِ آغازین",
    evolutionEmoji: evo?.emoji ?? "✨",
    rank: { emoji: rank.emoji, name: rank.name },
    level: char.level,
    xpTotal: char.totalXp,
    xpIntoLevel: Math.max(0, Math.min(intoLevel, need)),
    xpForNext: need,
    spirit: char.spirit,
    spiritPct: char.spirit,
    condition: { label: cond.label, emoji: cond.emoji, dmgMod: cond.dmgMod, canFight: cond.canFight },
    stamina: r.stamina,
    staminaMax: effMax,
    staminaMinutesToNext: r.minutesToNext,
    skillPoints: char.skillPoints,
    bond: char.bond,
    wins: char.wins,
    losses: char.losses,
    crits: char.crits,
    fights,
    winRate: fights >= 1 ? Math.round((char.wins / fights) * 100) : null,
    stats: {
      atk: stats.atk,
      def: stats.def,
      crit: Math.round(stats.crit),
      critDmg: Math.round(stats.critDmg),
      dodge: Math.round(stats.dodge),
      acc: Math.round(stats.acc),
      speed: Math.round(stats.speed),
      luck: Math.round(stats.luck),
      loot: Math.round(stats.loot),
      hp: stats.hp,
    },
    passive: { name: cls.passive.name, icon: cls.passive.icon, desc: cls.passive.desc },
    passiveParams: effectivePassiveParams(cls, ranks, evo) as unknown as Record<string, number>,
    // V14 — لایه‌ی B: عددِ توضیح‌دار + امضای زنده + هویتِ رزمی (اختیاری؛ سازنده‌ی قدیمی نبند)
    statExplanations: STAT_EXPLANATIONS,
    passiveDetail: passiveDetailOf(cls, effectivePassiveParams(cls, ranks, evo) as unknown as Record<string, number>),
    combatIdentity: { strengths: cls.strengths, weaknesses: cls.weaknesses, playStyle: cls.playStyle },
    skills,
    evolutions,
    nextEvolution,
    appearance: appearanceDTO(char),
    mastery,
    masteryBoardAvailable: true,
    lore: { intro: cls.lore.intro, deep: cls.lore.deep },
    // V8 §24 — آرتِ کارت = پرتره‌ی فُرمِ فعلیِ فرگشت‌یافته (مرحله‌ی ≥۲)؛ وگرنه آرتِ کلاس
    art: evo?.art ?? cls.art,
    // V10 — پالتِ پوشیده (اگر بازیکن پالتِ کسب‌شده گذاشته باشد، رنگِ کلاس را می‌پوشاند)
    palette: equippedPalette ?? cls.palette,
    xpTracks,
    createdAt: char.createdAt.toISOString(),
    interactCooldownMin: Math.ceil(interactLeft),
    renameCooldownMin: Math.ceil(renameLeft),
    // ── V19: شخصیتِ عمیق — طبع/استعداد/ضعف/داستان/ماتریس ──
    persona: {
      key: chain.persona.key,
      emoji: chain.persona.emoji,
      name: chain.persona.name,
      tagline: chain.persona.tagline,
      traits: [...chain.persona.traits],
      voiceSample: voiceSampleOf(char),
    },
    talent: talentCardDTOOf(chain.talent),
    flaw: talentCardDTOOf(chain.flaw),
    story: storyView(char),
    affinityRows: affinityRowsOf(chain.talent, chain.flaw),
    rechargeCostPer: rechargeCostPer(char),
  }
}

/** پیش‌نمایشِ مکانیکیِ یک شاخه‌ی فرگشت — «سوگیری» در یک خط */
function evolutionPreviewOf(e: Evolution): string {
  const parts: string[] = []
  const STAT_FA: Record<string, string> = { atk: "حمله", def: "دفاع", crit: "بحرانی", critDmg: "ضریبِ بحرانی", dodge: "گریز", acc: "دقت", speed: "سرعت", luck: "شانس", loot: "غنیمت" }
  if (e.statBonus) {
    for (const [k, v] of Object.entries(e.statBonus)) {
      if (!v) continue
      parts.push(`${STAT_FA[k] ?? k} ${v > 0 ? "+" : ""}${faDigits(Math.round(v * 10) / 10)}`)
    }
  }
  if (e.passiveBonus) {
    for (const [k, v] of Object.entries(e.passiveBonus)) {
      if (!v) continue
      parts.push(`${PASSIVE_PARAM_LABELS[k as PassiveParam] ?? k} ${v > 0 ? "+" : ""}${faDigits(v)}`)
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "ضریبِ آمارِ متعادل"
}

// ─── تعامل با فمبوی ───────────────────────────────────────────────────────────

export interface InteractKind {
  key: "comfort" | "praise" | "talk" | "treat" | "restTogether" | "practice" | "celebrate" | "gift" | "memory"
  icon: string
  label: string
  moneyCost: number
  spiritGain: [number, number]
  bondGain: number
  /** V10 — مرورِ خاطره: بی‌اثرِ مکانیکی، فقط روایت از سابقه‌ی واقعی */
  flavorOnly?: boolean
}

export const INTERACTIONS: InteractKind[] = [
  { key: "comfort", icon: "💗", label: "آرامش‌دادن", moneyCost: 0, spiritGain: [4, 7], bondGain: 1 },
  { key: "praise", icon: "🎀", label: "تحسین", moneyCost: 0, spiritGain: [3, 6], bondGain: 1 },
  { key: "talk", icon: "🗣️", label: "گفت‌وگو", moneyCost: 0, spiritGain: [2, 5], bondGain: 1 },
  { key: "treat", icon: "🍰", label: "شیرینی‌دادن", moneyCost: 150, spiritGain: [6, 10], bondGain: 2 },
  { key: "restTogether", icon: "💤", label: "استراحتِ توأمان", moneyCost: 0, spiritGain: [5, 9], bondGain: 1 },
  { key: "practice", icon: "✨", label: "تمرینِ هم‌افزا", moneyCost: 0, spiritGain: [1, 4], bondGain: 1 },
  // ── V10 — تعامل‌های تازه ──
  { key: "celebrate", icon: "🎉", label: "جشنِ کوچک", moneyCost: 250, spiritGain: [7, 11], bondGain: 2 },
  { key: "gift", icon: "🎁", label: "هدیه‌دادن", moneyCost: 400, spiritGain: [9, 13], bondGain: 3 },
  { key: "memory", icon: "📖", label: "مرورِ خاطره", moneyCost: 0, spiritGain: [0, 0], bondGain: 0, flavorOnly: true },
]

const INTERACT_LINES: Record<string, string[]> = {
  comfort: ["{name} سرش را روی شونه‌ات می‌گذارد و نفسِ عمیق می‌کشد.", "دستت روی سرِ {name} است؛ آرام می‌شود.", "{name} زیر لب می‌گوید: «ممنون که اومدی.»"],
  praise: ["{name} کلاهش را کمی بالا می‌دهد: «معلومه که من بهترم.»", "چشم‌های {name} برق می‌زند — ادایش به خوشحالی نیست.", "«همینه؟» می‌گوید {name}، ولی خوشحال است."],
  talk: ["با {name} تا آخرِ کوچه و برگشت حرف می‌زنید — درباره‌ی هیچ‌چیزِ مهم.", "{name} داستانِ دیشبِ خیابان را تعریف می‌کند و وسطش می‌خندد.", "سکوتِ خوب. بعد یک شوخیِ بد. بعد خنده‌ی خوب."],
  treat: ["{name} کیک را با ادبِ کامل اما سرعتِ غیرمعمولی می‌خورد.", "«شیرینی‌ت حلالت» — {name} جدی می‌گویدش.", "{name} لبه‌ی خامه را نگه می‌دارد «برای بعداً»."],
  restTogether: ["چای، پتو، سکوت. {name} نفس‌نفس می‌زند و می‌خوابد.", "دوتایی به سقف نگاه می‌کنید. شهردار کاری نمی‌کند.", "{name} خوابش می‌برد؛ تو هم ولش نمی‌کنی."],
  practice: ["با {name} پایِ کوچه تمرین می‌کنید؛ ردگیری‌اش بهتر شد.", "تمرینِ امروز: سه حرکت، دو افتاد، یکی خندید.", "{name} حرکتِ امضا را یک‌بار قشنگ اجرا می‌کند — یک‌بار فقط."],
  celebrate: ["برای {name} دست می‌زنی. کوچه هم دست می‌زند. شهردار پنجره‌اش را می‌بندد.", "کیکِ کوچک، شمعِ کوچک، {name} با ادب فوت می‌کند و آرزویش را نمی‌گوید.", "«به به» می‌گوید {name}، «تا حالا کسی برام جشن نگرفته بود.»"],
  gift: ["{name} کاغذِ هدیه را با دقتِ یک جراح باز می‌کند — کاغذ را نگه می‌دارد.", "هدیه را که باز می‌کند، سه ثانیه ساکت می‌ماند. از خوشحالی.", "{name} هدیه را بالا می‌گیرد که همه‌ی کوچه ببینند. هیچ‌کس نبود. مهم نبود."],
  memory: [],
}

// ─── V10: لایه‌ی شخصیت — صدای کلاس‌محور (پیوندِ ≥50) ─────────────────────────
// قطعی و داده‌محور: بذر = (charId, روز, نوعِ تعامل) → همان روز همان لهجه؛ فردا عوض.
const CLASS_VOICE: Record<string, string[]> = {
  shinobi: ["{name} از سایه‌ی دیوار بیرون می‌آید — فقط برای این حرف: «می‌دونستی بهترین قتل، بی‌سروصدا بودنِ کنارِ یک نفره؟»", "{name} زیرِ لب: «امشب سه تا نشانِ سایه داشتم. هیچ‌کدوم به اندازه‌ی این لحظه خوب نبود.»"],
  ranger: ["{name} کمانش را زمین می‌گذارد: «وقتی تیر نمی‌ندازم، فقط به تو نگاه می‌کنم. این تمرکزه.»", "{name}: «قانونِ شکار: اول نشانه. تو نشونه‌ی منی — از وقتی پیمان بستیم.»"],
  wizard: ["{name} میانِ اسپارک‌ها لبخند می‌زند: «انفجارِ کهکشانی رو دیدی؟ هیچ‌وقت به‌اندازه‌ی بودنِ تو قابل‌اطمینان نیست.»", "{name}: «ستاره‌ها اسمِ تو را بلدن. من گفتم‌شون.»"],
  trickster: ["{name} کارتی برمی‌گرداند که پشتش نوشته: «تو تنها کسی‌ای که تقلبم رو لو نمی‌دی.»", "{name} با لبخند: «من به همه‌ی دروغ می‌گم. به تو؟ فقط حقیقت‌های عجیب.»"],
  paladin: ["{name} سپرش را کنار می‌گذارد: «عهدِ من به شهره. بودنم کنارِ تو — این کاریه که خودم برای خودم گذاشتم.»", "{name}: «می‌دونی چرا نمی‌افتم؟ چون پشتمون به هم دریه. بقیه‌ش جزئیاته.»"],
  duelist: ["{name} ریتمش را می‌شکند — عمداً، برای اولین بار: «تمپو با تو بهتره. بذریت تموم شه.»", "{name} با نفسِ زنان: «سه‌تا ضربه‌ی پیاپی زدم ولی بهترین حرکتِ امروزم همین بود: ایستادنْ کنارِ تو.»"],
  summoner: ["گرگِ روحِ {name} سرش را روی زانوی تو می‌گذارد. {name} لبخند می‌زند: «پیمانِ من با ارواحه، ولی خونه‌م این‌جاست.»", "{name}: «ارواح همیشه می‌پرسن چرا موقعِ بودنِ تو ساکت‌ترن. می‌گم چون امنه.»"],
  reaper: ["{name} دستکشش را درمی‌آورد — کاری که فقط پیشِ تو می‌کند: «دَرو قیمت داره. این لحظه‌ها فقط به من هزینه‌ی لبخند دارن.»", "{name} میانِ گل‌های سرخ: «قانونِ دَرو: قیمتِ مخفی دوبرابره. عشقِ تو به من رو هم‌زمان می‌دونم و نمی‌تونم حساب کنم.»"],
}

/** صدای تعاملِ امروز — قطعی (همان روز، همان لهجه) */
function voiceLineFor(char: SoulCharacter, kindKey: string, rng: () => number): string | null {
  const voice = CLASS_VOICE[char.classKey]
  if (!voice || char.bond < 50) return null
  // روزِ قطعیت: بذر = (charId, تاریخ, نوع) — شخصیتِ پیوسته در طولِ روز
  const dayVoice = mulberry32(seedFrom("voice", char.id, dayKeyNow(), kindKey))
  if (dayVoice() < 0.45) return null // امروز لهجه‌ی کلاس نداریم — عمومی
  return voice[Math.floor(rng() * voice.length) % voice.length]
}

// ─── V14: تعاملِ واعی به حال — لایه‌ی D (مأموریتِ II، لایه‌ی شخصیت/رابطه) ────────
// انتخابِ واریانت با سه عامل: نوارِ روحیه (6 نوار در SPIRIT_CONDITIONS) +
// مرحله‌ی فرگشت (0..3) + نوعِ تعامل. قطعی در طولِ روز: بذر = (charId, روز, نوع)
// — همانِ الگویِ CLASS_VOICE؛ هیچ rngِ تازه‌ای در بازی نمی‌ریزد.

/** مودِ واکنش بر اساسِ نوارِ روحیه — کلاس‌ناوابسته، 2 واریانت به‌ازای هر نوار */
const INTERACT_MOOD_VARIANTS: string[][] = [
  // شوریده (90+)
  [
    "{name} پر از انرژی است — تقریباً می‌رقصد. با تو، نه جلویِ شهر.",
    "همه‌چیز امروز برق می‌زند و {name} هم‌رنگِ شهر شده: بی‌قرار و شاید.",
  ],
  // بااعتماد (70+)
  [
    "شانه‌هایش باز است؛ راه‌رفتنش با تو آرام و مطمئن.",
    "امروز {name} خودِ خودش است — و خودِ واقعیش کنارِ تو بهتر است.",
  ],
  // رویِ پا (40+)
  [
    "حالِ {name} معمولی است؛ عادی، صادق، بدونِ ادعا.",
    "یه روزِ معمولی. کنارِ تو معمولیِ قابل‌تحمل‌تری است.",
  ],
  // دل‌شکسته (20+)
  [
    "{name} ساکت‌تر از همیشه است؛ حرف‌ها را نصفه می‌گذارد.",
    "چشم‌هایش دور است. حرفِ تو را می‌شنود، ولی کمی دیر.",
  ],
  // خسته (1+)
  [
    "{name} خسته است — حتی لبخندش نفس می‌خواهد.",
    "کم‌حرف است، نه بی‌اعتنا. فقط انبارش ته کشیده.",
  ],
  // تهی (0)
  [
    "{name} تهی است؛ فقط تکیه می‌دهد و چیزی نمی‌خواهد بگوید.",
    "دستش سرد است. بودنِ تو تنها چیزِ نرمِ این لحظه است.",
  ],
]

/** دنباله‌ی مرحله‌ی فرگشت — وزنِ فُرم در واکنش (مرحله‌ی 0 = بدونِ دنباله) */
const EVO_TAIL_VARIANTS: string[][] = [
  [], // شکلِ آغازین
  [
    "فُرمِ تازه‌اش هنوز تازه است؛ گاهی خودش هم به آینه نگاه می‌کند.",
    "بعد از فرگشت، حتی سکوتش رنگِ دیگری دارد.",
  ],
  [
    "فُرمِ فعلی‌اش از روزهای اول سنگین‌تر است — و بلدتر.",
    "شهردار هنوز به شکلِ دومش عادت نکرده؛ تو کرده‌ای.",
  ],
  [
    "این فُرمِ نهایی است. شهر برایش قصه می‌سازد و او فقط کنارِ تو می‌نشیند.",
    "افسانه‌شدن را که بلد باشد کسی، جایی برای نشستن کم پیدا می‌کند — تو آن جایی.",
  ],
]

/** اندیسِ نوارِ روحیه — SPIRIT_CONDITIONS نزولی است (0 = شوریده … 5 = تهی) */
function spiritBandIndex(spirit: number): number {
  for (let i = 0; i < SPIRIT_CONDITIONS.length; i++) {
    if (spirit >= (SPIRIT_CONDITIONS[i]?.min ?? 0)) return i
  }
  return SPIRIT_CONDITIONS.length - 1
}

export interface InteractVariantInfo {
  variantId: string
  spiritBand: string
  spiritBandIndex: number
  evolutionTier: number
  moodLine: string
  evoTail: string | null
}

/** واریانتِ امروزِ این تعامل — قطعی روی (charId, روز, نوع) */
function interactVariantFor(char: SoulCharacter, kindKey: string): InteractVariantInfo {
  const bandIdx = spiritBandIndex(char.spirit)
  const tier = Math.max(0, Math.min(3, char.evolution))
  const rng = mulberry32(seedFrom("variant", char.id, dayKeyNow(), kindKey))
  const mood = INTERACT_MOOD_VARIANTS[bandIdx] ?? INTERACT_MOOD_VARIANTS[2]!
  const moodLine = mood[Math.floor(rng() * mood.length) % mood.length] ?? mood[0]!
  const tails = EVO_TAIL_VARIANTS[tier] ?? []
  const evoTail = tails.length > 0 ? tails[Math.floor(rng() * tails.length) % tails.length] ?? null : null
  return {
    variantId: `${kindKey}:${bandIdx}:${tier}`,
    spiritBand: SPIRIT_CONDITIONS[bandIdx]?.label ?? "رویِ پا",
    spiritBandIndex: bandIdx,
    evolutionTier: tier,
    moodLine: moodLine.replaceAll("{name}", char.name),
    evoTail: evoTail ? evoTail.replaceAll("{name}", char.name) : null,
  }
}

// ─── V14: واکنش‌های گشوده‌شونده‌ی پیوند — 4 پله (کلاس‌ناوابسته، فقط طعم) ────────
// پله‌ی 100 همان‌جایی است که acc_heartpin می‌آید — این خط فقط طعم است؛
// خودِ اعطا در جایِ خودش (grantCosmeticTx) می‌ماند و تکرار نمی‌شود.

export interface BondReactionTier {
  threshold: number
  text: string
}

const BOND_REACTION_TIERS: BondReactionTier[] = [
  { threshold: 25, text: "دیگر لازم نیست هر بار از اول معرفی‌تان کنید — روتین‌تان خودش شکل گرفته." },
  { threshold: 100, text: "سنجاقِ قلبی که به یقه‌اش نشسته برق می‌زند؛ به تو نگاه می‌کند و چیزی نمی‌گوید." },
  { threshold: 250, text: "حرف‌های نصفه‌ات را تمام می‌کند — و معمولاً درست." },
  { threshold: 500, text: "شهر شما را با هم می‌شناسد: «آن دو تا». یکی از آن دو تا، تو‌ای." },
]

/** بالاترین پله‌ی پیوندِ رسیده — null اگر هنوز به 25 نرسیده */
function bondReactionOf(bond: number): BondReactionTier | null {
  let hit: BondReactionTier | null = null
  for (const t of BOND_REACTION_TIERS) if (bond >= t.threshold) hit = t
  return hit
}

/** V10 — اثرِ مهارت‌های زندگی روی تعامل (% روحیه‌ی بیشتر) */
export function spiritGainBonus(char: SoulCharacter): number {
  const cls = getClass(char.classKey)
  if (!cls) return 0
  const ranks = skillRanks(char)
  let pct = 0
  for (const s of cls.skills) {
    if (s.effect.kind === "life" && s.effect.param === "spiritGain") {
      pct += s.effect.perRank * (ranks.get(s.id) ?? 0)
    }
  }
  return pct
}

/** V10 — اثرِ مهارت‌های اقتصادِ کلاس روی حقوقِ شیفت (% بیشتر) */
export function workPayoutBonus(char: SoulCharacter): number {
  const cls = getClass(char.classKey)
  if (!cls) return 0
  const ranks = skillRanks(char)
  let pct = 0
  for (const s of cls.skills) {
    if (s.effect.kind === "economy" && s.effect.param === "payout") {
      pct += s.effect.perRank * (ranks.get(s.id) ?? 0)
    }
  }
  return pct
}

/** V10 — اثرِ مهارت‌های اقتصادِ کلاس روی قیمتِ فروش (% بیشتر) */
export function marketBargainBonus(char: SoulCharacter): number {
  const cls = getClass(char.classKey)
  if (!cls) return 0
  const ranks = skillRanks(char)
  let pct = 0
  for (const s of cls.skills) {
    if (s.effect.kind === "economy" && s.effect.param === "bargain") {
      pct += s.effect.perRank * (ranks.get(s.id) ?? 0)
    }
  }
  return pct
}

/** V10 — اثرِ مهارت‌های زندگی روی استراحتِ توأمان (% جلای بیشتر) */
export function restGainBonus(char: SoulCharacter): number {
  const cls = getClass(char.classKey)
  if (!cls) return 0
  const ranks = skillRanks(char)
  let pct = 0
  for (const s of cls.skills) {
    if (s.effect.kind === "life" && s.effect.param === "restGain") {
      pct += s.effect.perRank * (ranks.get(s.id) ?? 0)
    }
  }
  return pct
}

/** خروجیِ تعامل — شکلِ قدیمی (message/spirit/bond) دست‌نخورده؛ V14 فیلدهایِ
 *  اختیاری را اضافه می‌کند تا مصرف‌کننده‌هایِ قدیمی بی‌تغییر بمانند. */
export interface InteractOk {
  message: string
  spirit: number
  bond: number
  /** V14 — واریانتِ واعی به حالِ امروز (نوارِ روحیه × فرگشت × نوع) */
  variant?: InteractVariantInfo
  /** V14 — واکنشِ پیوندِ گشوده‌شده (بالاترین پله‌ی رسیده) */
  reaction?: { tier: number; threshold: number; text: string; justUnlocked: boolean }
  /** V14 — پله‌ای که همین الان گشوده شد */
  unlock?: { threshold: number; text: string }
  /** V14 — مرورِ خاطره: شمارِ خاطره‌هایِ برگردانده‌شده (≤5) */
  memory?: { count: number }
}

export async function interactWithCharacter(player: Player, char: SoulCharacter, kindKey: string): Promise<{ ok?: InteractOk; error?: string }> {
  const kind = INTERACTIONS.find((i) => i.key === kindKey)
  if (!kind) return { error: "چنین تعاملی وجود ندارد." }
  // V10 — مرورِ خاطره آزاد است: نه کول‌داون می‌خورد نه ذخیره‌ی نفس (فقط روایت)
  if (kind.flavorOnly) {
    const voice = voiceLineFor(char, kind.key, mulberry32(seedFrom("interact", char.id, Date.now())))
    // V14 — پنجره‌ی خاطره 5تایی + نوع‌های عنوان/دستاورد/داستان (اگر در پنجره باشند)
    const lastMilestones = await db.characterLog.findMany({
      where: { characterId: char.id, type: { in: ["creation", "evolution", "victory", "mastery", "milestone", "rank", "bond", "title", "achievement", "story"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    })
    const variant = interactVariantFor(char, kind.key)
    const persona = personaOf(char) // V19 — تعارفِ خاطره با صدای طبع
    const lines: string[] = []
    if (lastMilestones.length === 0) {
      lines.push(persona.voice.memory.replaceAll("{name}", char.name))
    } else {
      lines.push(`📖 با ${char.name} خاطره‌ها را ورق می‌زنید…`)
      for (const m of lastMilestones) {
        lines.push(`• «${m.text}» — ${faDaysAgo(m.createdAt)}`)
      }
    }
    lines.push(variant.moodLine)
    if (variant.evoTail) lines.push(variant.evoTail)
    if (voice) lines.push(voice.replaceAll("{name}", char.name))
    return { ok: { message: lines.join("\n"), spirit: char.spirit, bond: char.bond, variant, memory: { count: lastMilestones.length } } }
  }
  const left = char.lastInteractAt ? SOUL.INTERACT_COOLDOWN_MIN - (Date.now() - char.lastInteractAt.getTime()) / 60000 : 0
  if (left > 0) return { error: `${faDigits(Math.ceil(left))} دقیقه دیگر — فمبویت هم نفس می‌خواهد.` }
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    const left2 = fresh.lastInteractAt ? SOUL.INTERACT_COOLDOWN_MIN - (Date.now() - fresh.lastInteractAt.getTime()) / 60000 : 0
    if (left2 > 0) return { error: `${faDigits(Math.ceil(left2))} دقیقه دیگر — فمبویت هم نفس می‌خواهد.` }

    if (kind.moneyCost > 0) {
      if (player.money < kind.moneyCost) return { error: `${kind.key === "gift" ? "هدیه" : kind.key === "celebrate" ? "جشن" : "شیرینی"} ${faDigits(kind.moneyCost)} سکه است و پولت کم است.` }
      await applyMoney(tx, player, -kind.moneyCost, "misc", `تعامل: ${kind.label}`)
    }
    const rng = mulberry32(seedFrom("interact", char.id, Date.now()))
    // V10 — مهارتِ «% روحیه‌ی تعامل بیشتر» از شاخه‌ی زندگی + V19 استعداد/ضعفِ «جلای تعامل»
    const gainPct = spiritGainBonus(fresh) + affinityOf(fresh).spirit
    const rawSpirit = kind.spiritGain[0] + rng() * (kind.spiritGain[1] - kind.spiritGain[0])
    const spirit = Math.round(rawSpirit * (1 + gainPct / 100))
    const newSpirit = clamp(fresh.spirit + spirit, 0, 100)
    const oldBond = fresh.bond
    const updated = await tx.soulCharacter.update({
      where: { id: fresh.id },
      data: { spirit: newSpirit, bond: Math.min(999, fresh.bond + kind.bondGain), lastInteractAt: new Date() },
    })
    // XP هم‌نفس — فقط اولینِ چند تعاملِ روزانه (سقفِ ضدِ مزرعه)
    const daily = parseMasteryDaily(fresh.masteryDaily)
    // V19 — اعتماد: اولینِ تعاملِ روز، +1 (فقط همین — اسپم اعتماد نمی‌سازد)
    let trustGain = 0
    if (daily.interacts === 0) {
      trustGain = 1
      await tx.soulCharacter.updateMany({ where: { id: fresh.id }, data: { trust: Math.min(100, fresh.trust + 1) } })
    }
    if (daily.interacts < SOUL.INTERACT_XP_DAILY) {
      await awardXpTx(tx, updated, { tracks: { spirit: 2 } })
      await awardMasteryTx(tx, updated, "interact", 1, `تعاملِ ${kind.label} با بازیکنش`)
    }
    // V14 — واریانتِ واعی به حال (از ردیفِ تازه: روحیه‌ی همین لحظه) + واکنشِ پیوند
    const variant = interactVariantFor(updated, kind.key)
    const voice = voiceLineFor(fresh, kind.key, rng)
    // V19 — صدای طبع، خطِ پایه است؛ عمومی فقط پشتیبانِ طبع‌های گمشده
    const personaVoice = personaOf(fresh).voice[kind.key as InteractKindKey]
    const base = personaVoice
      ? personaVoice.replaceAll("{name}", fresh.name)
      : pickOne(INTERACT_LINES[kind.key] ?? INTERACT_LINES.talk, rng).replaceAll("{name}", fresh.name)
    const lines = [base, variant.moodLine]
    if (variant.evoTail) lines.push(variant.evoTail)
    if (voice) lines.push(voice.replaceAll("{name}", fresh.name))
    // V19 — پله‌ی اعتمادِ تازه از اولینِ تعاملِ روز
    if (trustGain > 0) {
      const prevTrustTier = trustTierOf(fresh.trust)
      const nowTrustTier = trustTierOf(Math.min(100, fresh.trust + 1))
      if (nowTrustTier.min > prevTrustTier.min) lines.push(`🤝 پله‌ی اعتماد تازه: ${nowTrustTier.emoji} «${nowTrustTier.label}»`)
    }
    // واکنشِ پیوند — پله‌ی تازه یا پله‌ی رسیده‌ی همیشگی
    const prevTier = bondReactionOf(oldBond)
    const nowTier = bondReactionOf(updated.bond)
    let reaction: InteractOk["reaction"] | null = null
    let unlock: InteractOk["unlock"] | null = null
    if (nowTier) {
      const justUnlocked = (prevTier?.threshold ?? 0) < nowTier.threshold
      reaction = { tier: 1 + BOND_REACTION_TIERS.indexOf(nowTier), threshold: nowTier.threshold, text: nowTier.text, justUnlocked }
      if (justUnlocked) unlock = { threshold: nowTier.threshold, text: nowTier.text }
      lines.push(`✨ ${justUnlocked ? "واکنش تازه: " : ""}${nowTier.text}`)
    }
    if (oldBond + kind.bondGain >= 100 && oldBond < 100) {
      await addCharLog(tx, char.id, "bond", "💞", "پیوند با بازیکنش به 100 رسید.", true)
      // V10 — سنجاقِ قلب: هدیه‌ی پیوندِ صد
      await grantCosmeticTx(tx, fresh, "acc_heartpin", "bond100")
      // V8 — نقطه‌عطفِ پیوند: دستاوردِ «پیوندِ صد»
      await grantPlayerAchievementTx(tx, player.id, "bond_hundred")
    }
    return { ok: { message: lines.join("\n"), spirit: newSpirit, bond: updated.bond, variant, ...(reaction ? { reaction } : {}), ...(unlock ? { unlock } : {}) } }
  })
}

/** «N روز پیش» فارسی برای خطِ خاطره */
function faDaysAgo(at: Date): string {
  const days = Math.max(0, Math.floor((Date.now() - at.getTime()) / 86400000))
  if (days <= 0) return "هنوز تازه است."
  if (days === 1) return "دیروز بود."
  return `${faDigits(days)} روز پیش بود.`
}

// ─── شربتِ روحیه / شارژِ استقامت ────────────────────────────────────────────────

export async function rechargeStamina(player: Player, char: SoulCharacter, units: number): Promise<{ ok?: { message: string; stamina: number }; error?: string }> {
  const n = Math.floor(units)
  if (n < 1 || n > SOUL.RECHARGE_MAX_AT_ONCE) return { error: `بین 1 تا ${faDigits(SOUL.RECHARGE_MAX_AT_ONCE)} واحد.` }
  // V19 — هزینه‌ی هر واحد شخصی است (استعدادِ صرفه‌جو)؛ سقفِ بازپرداخت هم همان
  const perUnit = rechargeCostPer(char)
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    const missing = fresh.staminaMax - fresh.stamina
    if (missing <= 0) return { error: "استقامتت پُر است." }
    const apply = Math.min(n, missing)
    const p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
    if (p.money < apply * perUnit) return { error: `هر واحد ${faDigits(perUnit)} سکه است — ${faDigits(apply)} واحد نمی‌خریداری.` }
    await applyMoney(tx, p, -apply * perUnit, "misc", "شارژِ استقامتِ فمبوی")
    const updated = await tx.soulCharacter.update({
      where: { id: fresh.id },
      data: { stamina: fresh.stamina + apply, staminaAt: new Date() },
    })
    return { ok: { message: `${faDigits(apply)} واحدِ استقامت خریده شد — دَمِ فمبویت گرم است.`, stamina: updated.stamina } }
  })
}

export async function applySpiritPotion(player: Player, char: SoulCharacter): Promise<{ ok?: { message: string; spirit: number }; error?: string }> {
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    if (fresh.spirit >= 100) return { error: "روحیه‌ش تهِ سقف است — لازم نیست." }
    // آیتم: کیک (اگر در کیف باشد مصرفش کن؛ وگرنه سکه)
    const inv = await tx.inventoryItem.findUnique({ where: { playerId_itemKey: { playerId: player.id, itemKey: "cake" } } })
    let usedItem = false
    if (inv && inv.quantity > 0) {
      usedItem = true
      if (inv.quantity <= 1) await tx.inventoryItem.delete({ where: { id: inv.id } })
      else await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: inv.quantity - 1 } })
    } else {
      const p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
      if (p.money < 200) return { error: "کیک در کیفت نیست و 200 سکه هم نداری." }
      await applyMoney(tx, p, -200, "misc", "شربتِ روحیه")
    }
    const gain = 22
    const updated = await tx.soulCharacter.update({ where: { id: fresh.id }, data: { spirit: clamp(fresh.spirit + gain, 0, 100) } })
    return { ok: { message: usedItem ? "کیکِ کیف رفت پایین — روحیه‌ش جلا افتاد." : "شربتِ روحیه خریدی و دادیش — جلا افتاد.", spirit: updated.spirit } }
  })
}

// ─── تغییرِ اسم ───────────────────────────────────────────────────────────────

export async function renameCharacter(player: Player, char: SoulCharacter, newName: string): Promise<{ ok?: { message: string }; error?: string }> {
  const check = validateCharacterName(newName)
  if (!check.ok) return { error: check.error }
  const left = char.lastNameChangeAt ? (SOUL.RENAME_COOLDOWN_DAYS * 24 * 60) - (Date.now() - char.lastNameChangeAt.getTime()) / 60000 : 0
  if (left > 0) return { error: `اسمِ فعلی تا ${faDigits(Math.ceil(left / 60))} ساعت دیگر می‌ماند.` }
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    const clean = newName.trim().replace(/\s+/g, " ")
    if (clean === fresh.name) return { error: "همین اسم است که." }
    const updated = await tx.soulCharacter.update({ where: { id: fresh.id }, data: { name: clean, lastNameChangeAt: new Date() } })
    await addCharLog(tx, char.id, "name", "✏️", `اسمش از «${fresh.name}» به «${clean}» تغییر کرد.`, false)
    return { ok: { message: `از این‌به بعد صدایش می‌زنی: «${updated.name}».` } }
  })
}

// ─── ارتقای مهارت ─────────────────────────────────────────────────────────────

export async function upgradeSkill(player: Player, char: SoulCharacter, skillId: string): Promise<{ ok?: { message: string; skillPoints: number }; error?: string }> {
  const cls = getClass(char.classKey)
  if (!cls) return { error: "کلاسِ ناشناخته." }
  const skill = cls.skills.find((s) => s.id === skillId)
  if (!skill) return { error: "چنین مهارتی در این کلاس نیست." }
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    if (fresh.level < skill.unlockLevel) return { error: `سطح ${faDigits(skill.unlockLevel)} لازم است.` }
    // V10 — درختِ مهارت: پیش‌نیاز و گیتِ فرگشت
    if (skill.evolutionReq !== undefined && fresh.evolution < skill.evolutionReq)
      return { error: `این رتبه از هنر فقط بعد از فرگشتِ ${faDigits(skill.evolutionReq)} باز می‌شود.` }
    const ranks = skillRanks(fresh)
    if (skill.requires) {
      const prereq = cls.skills.find((s) => s.id === skill.requires)
      const prereqRank = prereq ? (ranks.get(prereq.id) ?? 0) : 1
      if (prereqRank < 1) return { error: `اول «${prereq?.name ?? skill.requires}» را رتبه‌ی 1 کن — این هنر روی آن سوار است.` }
    }
    const rank = ranks.get(skill.id) ?? 0
    if (rank >= skill.maxRank) return { error: "این مهارت در بالاترین رتبه است." }
    if (fresh.skillPoints < skill.spCost) return { error: `${faDigits(skill.spCost)} نقطه‌مهارت لازم داری؛ ${faDigits(fresh.skillPoints)} داری.` }
    ranks.set(skill.id, rank + 1)
    const updated = await tx.soulCharacter.update({
      where: { id: fresh.id },
      data: { skillsJson: JSON.stringify(Object.fromEntries(ranks)), skillPoints: fresh.skillPoints - skill.spCost },
    })
    if (rank + 1 === skill.maxRank) {
      await addCharLog(tx, char.id, "milestone", skill.icon, `مهارتِ «${skill.name}» به رتبه‌ی نهایی رسید.`, true)
    }
    return { ok: { message: `«${skill.name}» به رتبه ${faDigits(rank + 1)} رسید.`, skillPoints: updated.skillPoints } }
  })
}

// ─── فرگشت (V10: انتخابِ شاخه) ─────────────────────────────────────────────────

/** پیش‌نمایشِ تصمیمِ فرگشت برای تأیید — هر دو شاخه + هشدارِ برگشت‌ناپذیری */
export function evolutionDecisionDTO(char: SoulCharacter): EvolutionChoiceDTO | null {
  const cls = getClass(char.classKey)
  if (!cls || char.evolution >= 3) return null
  return soulCardDTO(char).nextEvolution
}

export async function evolveCharacter(player: Player, char: SoulCharacter, choice: 0 | 1 = 0): Promise<{ ok?: { message: string; evolution: number }; error?: string }> {
  const cls = getClass(char.classKey)
  if (!cls) return { error: "کلاسِ ناشناخته." }
  if (char.evolution >= 3) return { error: "به آخرِ راهِ فرگشت رسیده — از این‌جا فقط افسانه می‌شود." }
  return db.$transaction(async (tx) => {
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.playerId !== player.id) return { error: "این فمبوی مالِ تو نیست." }
    if (fresh.evolution >= 3) return { error: "به آخرِ راهِ فرگشت رسیده." }
    const stage = fresh.evolution + 1
    const evo = choice === 1 ? cls.evolutionAlt[fresh.evolution] : cls.evolutions[fresh.evolution]
    if (fresh.level < evo.reqLevel || fresh.wins < evo.reqWins) {
      return { error: `برای «${evo.name}»: سطح ${faDigits(evo.reqLevel)} و ${faDigits(evo.reqWins)} برد لازم است — ${evo.lore}` }
    }
    // مسیرِ شاخه‌ها را ثبت کن (ایدمپوتنت برای گزینه‌ی الفِ موروثی)
    const path = evolutionPathOf(fresh)
    while (path.length < stage) path.push(0)
    path[stage - 1] = choice
    const updated = await tx.soulCharacter.update({ where: { id: fresh.id }, data: { evolution: stage, evolutionPath: JSON.stringify(path) } })
    // V10 — کیهاناتِ فرگشت
    const cosKey = ["acc_firstlight", "acc_veil", "acc_halo"][stage - 1]
    const cosSource = (["evolution1", "evolution2", "evolution3"] as CosmeticSource[])[stage - 1]
    await grantCosmeticTx(tx, fresh, cosKey, cosSource)
    await addCharLog(tx, char.id, "evolution", evo.emoji, `فرگشت: به «${evo.name}» بدل شد (${evo.pathLabel ?? "مسیرِ اصلی"}). ${evo.lore}`, true)
    await tx.historyEntry.create({
      data: {
        playerId: player.id,
        icon: evo.emoji,
        text: `فمبویش «${fresh.name}» در شاخه‌ی «${evo.pathLabel ?? "مسیرِ اصلی"}» به فُرمِ «${evo.name}» فرگشت یافت.`,
        category: "social",
        day: player.day,
      },
    })
    // V10 — فرگشت، خودش یک کارِ واجدشرطِ کلاسی است
    await awardMasteryTx(tx, updated, "event", 6, `فرگشت به «${evo.name}» — ${evo.pathLabel ?? "مسیرِ اصلی"}`)
    // V8 — نقاطِ عطفِ فرگشت: دستاوردِ اول/آخر + عنوانِ «فقط افسانه»
    if (stage === 1) await grantPlayerAchievementTx(tx, player.id, "first_evolution")
    if (stage === 3) {
      await grantPlayerAchievementTx(tx, player.id, "final_evolution")
      await grantPlayerTitleTx(tx, player.id, "only_legend")
    }
    return { ok: { message: `${evo.emoji} نور فرو می‌ریزد… ${fresh.name} حالا «${evo.name}» است (${evo.pathLabel ?? "مسیرِ اصلی"}). ${evo.lore}`, evolution: updated.evolution } }
  })
}

// ─── تالارِ افتخارات (Hall of Fame) ───────────────────────────────────────────

export const HALL_BOARDS: { key: string; label: string; icon: string; note: string }[] = [
  { key: "level", label: "بالاترین سطحِ فمبوی", icon: "⭐", note: "مجموعِ تجربه‌ی همه‌ی مسیرها" },
  { key: "wins", label: "بردهای نبرد", icon: "⚔️", note: "شمارِ پیروزی‌های تأییدشده" },
  { key: "winrate", label: "نسبتِ برد", icon: "📈", note: `حداقلِ ${faDigits(SOUL.DUEL_MIN_FIGHTS_WINRATE)} نبرد` },
  { key: "crits", label: "ضربه‌های ویژه", icon: "✨", note: "تریگرهای بحرانی و passive" },
  { key: "evolution", label: "فرگشت", icon: "🌌", note: "مرحله‌ی فرگشت و سطح" },
  // V10 — مقایسه‌ی معنادار: تسلطِ کلاس، نه عددِ خام
  { key: "mastery", label: "کلاس-تسلط", icon: "🎓", note: "استفاده‌ی معنادار از مکانیک‌های کلاس" },
]

export async function hallOfFame(board = "level"): Promise<HallDTO> {
  const def = HALL_BOARDS.find((b) => b.key === board) ?? HALL_BOARDS[0]
  const where =
    def.key === "winrate"
      ? {} // فیلترِ حداقلِ نبرد بعد از واکشی (wins+losses)
      : {}
  const rows = await db.soulCharacter.findMany({
    where,
    include: { player: { select: { name: true, avatar: true } } },
    take: 200,
    orderBy:
      def.key === "level"
        ? { totalXp: "desc" }
        : def.key === "wins"
          ? { wins: "desc" }
          : def.key === "crits"
            ? { crits: "desc" }
            : def.key === "evolution"
              ? [{ evolution: "desc" }, { level: "desc" }]
              : def.key === "mastery"
                ? { masteryXp: "desc" }
                : { wins: "desc" },
  })
  let entries: HallEntryDTO[] = rows.map((r, i) => {
    const cls = getClass(r.classKey)
    const evo = r.evolution > 0 && cls ? resolveEvolution(cls, r.evolution, evolutionPathOf(r)) : null
    const fights = r.wins + r.losses
    let value = 0
    let valueLabel = ""
    switch (def.key) {
      case "level":
        value = r.totalXp
        valueLabel = `سطح ${faDigits(r.level)} · ${faDigits(r.totalXp)} XP`
        break
      case "wins":
        value = r.wins
        valueLabel = `${faDigits(r.wins)} برد`
        break
      case "winrate":
        value = fights >= SOUL.DUEL_MIN_FIGHTS_WINRATE ? Math.round((r.wins / fights) * 100) : -1
        valueLabel = fights >= SOUL.DUEL_MIN_FIGHTS_WINRATE ? `${faDigits(Math.round((r.wins / fights) * 100))}% از ${faDigits(fights)} نبرد` : "نبردِ کافی ندارد"
        break
      case "crits":
        value = r.crits
        valueLabel = `${faDigits(r.crits)} ضربه‌ی ویژه`
        break
      case "evolution":
        value = r.evolution * 1000 + r.level
        valueLabel = `${evo ? evo.name : "شکلِ آغازین"} · سطح ${faDigits(r.level)}`
        break
      case "mastery": {
        const tier = masteryTierOf(masteryLevelOf(r.masteryXp))
        value = r.masteryXp
        valueLabel = `${tier.emoji} ${tier.label} · ${faDigits(r.masteryXp)} تسلط`
        break
      }
    }
    return {
      rank: i + 1,
      characterName: r.name,
      classEmoji: cls?.emoji ?? "❔",
      className: cls?.name ?? r.classKey,
      evolutionEmoji: evo?.emoji ?? "✨",
      playerName: r.player.name,
      playerAvatar: r.player.avatar,
      value,
      valueLabel,
    }
  })
  if (def.key === "winrate") {
    entries = entries.filter((e) => e.value >= 0).slice(0, 50)
    entries.forEach((e, i) => (e.rank = i + 1))
  } else {
    entries = entries.slice(0, 50)
  }
  return { board: def.key, boardLabel: def.label, boards: HALL_BOARDS.map((b) => ({ key: b.key, label: b.label, icon: b.icon })), entries, note: def.note }
}

// ─── خوانشِ عمومی (برای ربات/مینی‌اپ) ─────────────────────────────────────────

export async function getCharacterOf(playerId: string): Promise<SoulCharacter | null> {
  return db.soulCharacter.findUnique({ where: { playerId } })
}

/** فمبوی + همگام‌سازیِ استقامت (ایدمپوتنت). null اگر هنوز پیمان نبسته. */
export async function getSyncedCharacter(playerId: string): Promise<SoulCharacter | null> {
  const char = await getCharacterOf(playerId)
  if (!char) return null
  return syncCharacter(char)
}

// ─── V8: کارتِ عمومیِ فمبوی (نمایِ ربات؛ فقط زیرمجموعه‌ی عمومی) ─────────────────

/** رتبه‌ی پایدار برای کارتِ عمومی — از آستانه‌ی سطحِ رتبه می‌آید (rank_1، rank_5 …) */
function rankKeyOf(rank: { min: number }): string {
  return `rank_${rank.min}`
}

/**
 * کارتِ عمومی فمبویِ یک بازیکنِ هدف (برای نگاه‌کردن در گپ/ربات).
 * فقط داده‌ی عمومی: هرگز استقامت/روحیه/پیوند/مهارت‌ها/کیف/مسیرهای XP را نمی‌فرستد.
 * target = null یعنی چنین بازیکنی هر وارد بازی نشده؛ exists=false یعنی آمده ولی هنوز پیمان نبسته.
 */
export async function publicFemboyCard(targetTelegramId: string): Promise<PublicFemboyCardDTO> {
  const player = await db.player.findUnique({
    where: { telegramId: targetTelegramId },
    select: { id: true, telegramId: true, name: true, avatar: true },
  })
  if (!player || !player.telegramId) return { target: null, exists: false, card: null }
  const target = { telegramId: player.telegramId, playerName: player.name, playerAvatar: player.avatar }
  const char = await getSyncedCharacter(player.id)
  if (!char) return { target, exists: false, card: null }
  const cls = getClass(char.classKey)
  if (!cls) throw new Error(`کلاسِ ناشناخته: ${char.classKey}`)
  const rank = rankOf(char.level)
  const evo = resolveEvolution(cls, char.evolution, evolutionPathOf(char))
  const mTier = masteryTierOf(masteryLevelOf(char.masteryXp))
  const equipped = parseEquipped(char.appearanceJson)
  const acc = equipped.accessory ? getCosmetic(equipped.accessory) : null
  // عنوانِ فعالِ بازیکنِ هدف (اگر عنوانی فعال کرده باشد)
  const activeTitle = await db.playerTitle.findFirst({ where: { playerId: player.id, active: true } })
  const titleDef = activeTitle ? TITLE_MAP[activeTitle.titleKey] : undefined
  // V19 — هویتِ عمومیِ طبع/استعداد (عمومی‌اند — شخصیت، راز نیست)
  const chain = resolvePersonaChain(char)
  return {
    target,
    exists: true,
    card: {
      name: char.name,
      classKey: cls.key,
      className: cls.name,
      classEmoji: cls.emoji,
      classRole: cls.roleName,
      level: char.level,
      rankKey: rankKeyOf(rank),
      rankName: rank.name,
      rankEmoji: rank.emoji,
      evolution: char.evolution,
      evolutionName: evo?.name ?? "شکلِ آغازین",
      wins: char.wins,
      losses: char.losses,
      crits: char.crits,
      activeTitle: titleDef ? { key: titleDef.key, name: titleDef.name, emoji: titleDef.emoji } : null,
      // V10 — هویتِ عمومیِ عمیق: تسلط و ظاهر
      mastery: { level: masteryLevelOf(char.masteryXp), emoji: mTier.emoji, label: mTier.label },
      accessoryEmoji: acc?.emoji ?? null,
      evolutionPathName: evo?.pathLabel ?? null,
      // V8 §24 — آرتِ کارتِ عمومی = پرتره‌ی فُرمِ فعلیِ فرگشت‌یافته (مرحله‌ی ≥۲)؛ وگرنه آرتِ کلاس
      art: evo?.art ?? cls.art,
      // V19 — هویتِ عمومیِ طبع/استعداد
      persona: { key: chain.persona.key, emoji: chain.persona.emoji, name: chain.persona.name, tagline: chain.persona.tagline },
      talent: { key: chain.talent.key, emoji: chain.talent.emoji, name: chain.talent.name },
    },
  }
}

export { ENEMIES, availableEnemies, getEnemy, CLASSES, CLASS_MAP, getClass, RANKS, rankOf, spiritCondition }
export type { ClassDef, EnemyDef }
