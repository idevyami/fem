import { db } from "@/lib/db"
import type { Player, WorldState, ActiveEvent, InventoryItem, Pet, Relationship } from "@prisma/client"
import type {
  EventDef,
  EventCondition,
  Outcome,
  PlayerFlags,
  StatKey,
  Rarity,
} from "./types"
import { EVENTS, findChainEvent, getEvent, ITEM_MAP, PET_MAP, ACHIEVEMENT_MAP, TITLE_MAP, getDistrict, getNpc, NPC_MAP } from "./content"
import { RARITY_LABEL, CATEGORY_LABEL } from "./types"
import { parseFlags, clampStat, xpProgress, STAT_META, WEATHER_LABEL, MOOD_LABEL } from "./helpers"
import { applyMoney } from "./economy"
import { getWorld, getFeed, worldTick, playerTick } from "./world"
import { stageBadge as stageBadgeOf, EMPTY_TOTALS, type PlayerTotals } from "./progression"
import { mulberry32, seedFrom, weightedPick, clamp } from "./rng"
import type {
  GameSnapshot,
  PlayerDTO,
  ActiveEventDTO,
  ChoiceDTO,
  OutcomeDTO,
  DeltaLineDTO,
  PetDTO,
  InventoryEntryDTO,
  NpcDTO,
  WorldDTO,
  OfflineRecapDTO,
  NotificationDTO,
  FemboyXpDTO,
} from "./contract"
import { getJob, getVehicle, getHouse } from "./content"
import { awardXpTx, awardMasteryTx, femboySummaryDTO, getSyncedCharacter } from "./character"
import { getClass } from "./content/classes"
import { XP_TRACK_META, type XpTrack } from "./content/classes"

// ─── V9: تربیتِ فمبوی از راهِ زندگی — XPِ تجربه‌های شهر ─────────────────────────
// قانونِ مستند: «تجربه‌ی شهر، فمبوی را تربیت می‌کند.» هر اتفاقِ حل‌شده به فمبویِ
// حاضر XP می‌دهد؛ مسیرِ XP از جنسِ اتفاق می‌آید. مقدار از کمیابی می‌آید.
// هیچ جایزه‌ای بدونِ این قانونِ واحد داده نمی‌شود — نه بونوسِ تصادفی، نه ضرب‌در-
// همه‌چیز.

const CATEGORY_XP_TRACK: Record<string, XpTrack> = {
  story: "spirit",
  wholesome: "spirit",
  funny: "trickery",
  absurd: "trickery",
  dark: "battle",
  mystery: "arcane",
  legendary: "battle",
}

const RARITY_XP: Record<Rarity, number> = {
  common: 2,
  uncommon: 4,
  rare: 7,
  epic: 12,
  legendary: 18,
  unknown: 2,
}

/** جایزه‌ی XPِ فمبوی برای یک اتفاق — داخلِ همان تراکنشِ حلِ اتفاق اعمال می‌شود. */
async function awardEventFemboyXp(
  tx: import("@prisma/client").Prisma.TransactionClient,
  playerId: string,
  category: string,
  rarity: Rarity,
): Promise<FemboyXpDTO | null> {
  const char = await tx.soulCharacter.findUnique({ where: { playerId } })
  if (!char) return null
  const track = CATEGORY_XP_TRACK[category] ?? "spirit"
  const amount = RARITY_XP[rarity] ?? 2
  const { char: updated, levelUps } = await awardXpTx(tx, char, { tracks: { [track]: amount } })
  // V10 — کلاس-تسلط: اتفاقِ کمیاب+ در مسیرِ اصلیِ کلاس = تجربه‌ی عمیقِ کلاسی (سقفِ روزانه داخلش)
  let masteryLevel: number | undefined
  const cls = getClass(char.classKey)
  if (cls && (RARITY_XP[rarity] ?? 2) >= 7 && cls.xpBias.primary === track) {
    const r = await awardMasteryTx(tx, updated, "event", 3, `تجربه‌ی ${RARITY_LABEL[rarity]} در مسیرِ ${cls.name}`)
    masteryLevel = r.masteryLevel
  }
  // لاگِ سابقه‌ی فمبوی — فقط اتفاق‌های کمیاب و بالاتر سابقه می‌سازند (قانونِ ضدِ شلوغی)
  if ((RARITY_XP[rarity] ?? 2) >= 7) {
    await tx.characterLog.create({
      data: {
        characterId: char.id,
        type: "milestone",
        icon: "🎲",
        text: `از دلِ یک اتفاقِ ${RARITY_LABEL[rarity]} تجربه‌ای گرفت که مسیرش را عوض کرد.`,
        isPublic: true,
      },
    })
  }
  const meta = XP_TRACK_META[track]
  return {
    name: updated.name,
    trackKey: track,
    trackLabel: meta.label,
    trackIcon: meta.icon,
    amount,
    levelUps: levelUps.map((l) => String(l)),
    masteryLevel,
  }
}

// ─── Effective stats (اثر وسایل equip شده) ───────────────────────────────────

export interface EffectiveStats {
  health: number
  energy: number
  luck: number
  intelligence: number
  chaos: number
  fame: number
  crime: number
  reputation: number
}

export function effectiveStats(player: Player, inventory: InventoryItem[]): EffectiveStats {
  const base: EffectiveStats = {
    health: player.health,
    energy: player.energy,
    luck: player.luck,
    intelligence: player.intelligence,
    chaos: player.chaos,
    fame: player.fame,
    crime: player.crime,
    reputation: player.reputation,
  }
  for (const entry of inventory) {
    if (!entry.equipped) continue
    const def = ITEM_MAP[entry.itemKey]
    if (def?.effect && def.category === "gear") {
      const stat = def.effect.stat as keyof EffectiveStats
      if (stat in base) base[stat] += def.effect.amount
    }
  }
  for (const k of Object.keys(base) as (keyof EffectiveStats)[]) {
    base[k] = clamp(base[k], 0, 100)
  }
  return base
}

// ─── Condition engine ─────────────────────────────────────────────────────────

export interface ConditionCtx {
  player: Player
  eff: EffectiveStats
  flags: PlayerFlags
  world: WorldState
  itemKeys: Set<string>
  hasPet: boolean
}

export function checkCondition(cond: EventCondition | undefined, ctx: ConditionCtx): { ok: boolean; reason: string | null } {
  if (!cond) return { ok: true, reason: null }
  const p = ctx.player
  const eff = ctx.eff
  if (cond.minLevel !== undefined && p.level < cond.minLevel)
    return { ok: false, reason: `سطح ${cond.minLevel} لازم است` }
  if (cond.minMoney !== undefined && p.money < cond.minMoney)
    return { ok: false, reason: `${cond.minMoney} سکه لازم داری` }
  if (cond.minDebt !== undefined && p.debt < cond.minDebt)
    return { ok: false, reason: `بدهی‌ات باید ${cond.minDebt}+ باشد` }
  if (cond.stats) {
    const st = cond.stats as Record<string, number>
    for (const [k, v] of Object.entries(st)) {
      const value = (eff as unknown as Record<string, number>)[k]
      if (value === undefined || value < v) {
        const label = STAT_META[k as StatKey]?.label ?? k
        return { ok: false, reason: `${label} ${v}+ لازم است` }
      }
    }
  }
  if (cond.hasItem && !ctx.itemKeys.has(cond.hasItem)) {
    const def = ITEM_MAP[cond.hasItem]
    return { ok: false, reason: def ? `${def.name} لازم داری` : "آیتم لازم داری" }
  }
  if (cond.hasPet && !ctx.hasPet) return { ok: false, reason: "حیوان خانگی لازم داری" }
  if (cond.hasJob && !p.jobKey) return { ok: false, reason: "شغل لازم داری" }
  if (cond.hasHouse && !p.houseKey) return { ok: false, reason: "خانه لازم داری" }
  if (cond.hasVehicle && !p.vehicleKey) return { ok: false, reason: "وسیله‌ی نقلیه لازم داری" }
  if (cond.districts && !cond.districts.includes(p.currentDistrict)) {
    const names = cond.districts.map((d) => getDistrict(d).name).join("، ")
    return { ok: false, reason: `فقط در ${names}` }
  }
  if (cond.weathers && !cond.weathers.includes(ctx.world.weather))
    return { ok: false, reason: `فقط در هوای ${cond.weathers.map((w) => WEATHER_LABEL[w]?.label ?? w).join("، ")}` }
  if (cond.moods && !cond.moods.includes(ctx.world.mood)) return { ok: false, reason: "حالِ شهر مناسب نیست" }
  if (cond.globalEvent && ctx.world.activeGlobalEvent !== cond.globalEvent)
    return { ok: false, reason: "رویداد جهانی لازم است" }
  if (cond.minWorldChaos !== undefined && ctx.world.chaosLevel < cond.minWorldChaos)
    return { ok: false, reason: "آشوبِ جهان باید بالاتر باشد" }
  if (cond.maxWorldChaos !== undefined && ctx.world.chaosLevel > cond.maxWorldChaos)
    return { ok: false, reason: "آشوبِ جهان باید پایین‌تر باشد" }
  if (cond.requiresFlag && !(cond.requiresFlag in ctx.flags)) return { ok: false, reason: "هنوز وقتش نرسیده" }
  if (cond.excludesFlag && cond.excludesFlag in ctx.flags) return { ok: false, reason: "دیگه ممکن نیست" }
  return { ok: true, reason: null }
}

// ─── Event selection ──────────────────────────────────────────────────────────

async function recentlyResolvedKeys(playerId: string, withinMin: number): Promise<Map<string, Date>> {
  const since = new Date(Date.now() - withinMin * 60000)
  const rows = await db.activeEvent.findMany({
    where: { playerId, status: "resolved", resolvedAt: { gte: since } },
    select: { eventKey: true, resolvedAt: true },
    orderBy: { resolvedAt: "desc" },
  })
  const map = new Map<string, Date>()
  for (const r of rows) if (!map.has(r.eventKey)) map.set(r.eventKey, r.resolvedAt as Date)
  return map
}

export interface DrawResult {
  event: ActiveEvent
  snapshot: GameSnapshot
}

const EVENT_ENERGY_COST = 8

/** قرعه‌کشی رویداد — تنها منبع تصمیم، سرور */
export async function drawEvent(player: Player): Promise<{ error?: string; event?: ActiveEvent }> {
  const world = await worldTick()
  const [inventory, petCount] = await Promise.all([
    db.inventoryItem.findMany({ where: { playerId: player.id } }),
    db.pet.count({ where: { playerId: player.id } }),
  ])
  const flags = parseFlags(player)
  const eff = effectiveStats(player, inventory)
  const ctx: ConditionCtx = {
    player,
    eff,
    flags,
    world,
    itemKeys: new Set(inventory.map((i) => i.itemKey)),
    hasPet: petCount > 0,
  }

  // فقط یک رویداد فعال در هر لحظه
  const existing = await db.activeEvent.findFirst({ where: { playerId: player.id, status: "active" } })
  if (existing) return { event: existing }

  if (player.energy < EVENT_ENERGY_COST) {
    return { error: "انرژی نداری. استراحت کن، رامن بخور یا بمون تا حال بهتر شود." }
  }

  const now = Date.now()
  const rng = mulberry32(seedFrom("draw", player.id, now))

  let def: EventDef | null = null

  // 1) شروع بازی → رویداد روز اول
  if (!flags.onboardIntroDone) {
    def = getEvent("first_day") ?? null
  }

  // 2) زنجیره‌ی در انتظار
  if (!def && flags.pendingChain && flags.pendingChain.notBefore <= now) {
    def = findChainEvent(flags.pendingChain.key, flags.pendingChain.nextStep) ?? null
  }

  // 3) انتخاب وزن‌دار از رویدادهای مستقل
  if (!def) {
    const recent = await recentlyResolvedKeys(player.id, 60 * 72) // 3 روز
    const seen = new Set(flags.seenEvents ?? [])
    const candidates: { def: EventDef; weight: number }[] = []

    for (const ev of EVENTS) {
      if (ev.chain) continue // مراحل زنجیره مستقیماً کشیده نمی‌شوند
      if (ev.weight <= 0) continue
      if (ev.once && seen.has(ev.key)) continue
      if (ev.once && recent.has(ev.key)) continue
      if (ev.districts && !ev.districts.includes(player.currentDistrict)) continue
      const cond = checkCondition(ev.conditions, ctx)
      if (!cond.ok) continue

      // وزن پایه
      let w = ev.weight

      // بایاس محله (از eventBias تعریف منطقه)
      const district = getDistrict(player.currentDistrict)
      const bias = district.eventBias[ev.category] ?? 1
      w *= bias

      // بایاس رویداد جهانی فعال
      if (world.activeGlobalEvent) {
        const ge = (await import("./content")).getGlobalEvent(world.activeGlobalEvent)
        if (ge?.effects.boostCategory === ev.category) w *= 2.2
      }

      // آشوبِ جهان: دسته‌های تاریک/عجیب/افسانه‌ای
      if (["dark", "absurd", "legendary"].includes(ev.category)) w *= 0.6 + world.chaosLevel / 100
      // آشوبِ شخص بازیکن
      if (["dark", "absurd"].includes(ev.category)) w *= 0.7 + eff.chaos / 130
      // شهرت: رویدادهای funny/story
      if (["funny", "story"].includes(ev.category)) w *= 0.8 + eff.fame / 120

      // کمیابی: شانس شخص کمیابی بالا را کمی تقویت می‌کند
      if (["rare", "epic", "legendary"].includes(ev.rarity)) w *= 0.7 + eff.luck / 90

      // جریمه‌ی تازگی — همین اواخر دیده شده؟
      if (recent.has(ev.key)) w *= 0.35

      // health پایین → رویدادهای سنگین کمتر
      if (ev.category === "dark" && eff.health < 30) w *= 0.5

      candidates.push({ def: ev, weight: w })
    }

    const picked = weightedPick(candidates, rng)
    def = picked?.def ?? null
  }

  if (!def) return { error: "الان هیچ اتفاقی ندارد. شهر دارد خودش را نگه می‌دارد. کمی بعد برگرد." }

  const created = await db.activeEvent.create({
    data: {
      playerId: player.id,
      eventKey: def.key,
      category: def.category,
      rarity: def.rarity,
      chainKey: def.chain?.key ?? null,
      chainStep: def.chain?.step ?? 0,
      status: "active",
      expiresAt: new Date(now + 24 * 3600000),
    },
  })

  // کم شدن انرژی برای «توجه به جهان»
  await db.player.update({
    where: { id: player.id },
    data: { energy: clamp(player.energy - EVENT_ENERGY_COST, 0, 100) },
  })

  return { event: created }
}

// ─── Choice resolution ────────────────────────────────────────────────────────

function deltaLine(stat: StatKey, amount: number): DeltaLineDTO {
  const meta = STAT_META[stat]
  const good = amount > 0
  // برای بدهی و سابقه، «کم شدن» خوب است
  const inverted = stat === "debt" || stat === "crime"
  const tone: DeltaLineDTO["tone"] = amount === 0 ? "neutral" : inverted ? (good ? "bad" : "good") : good ? "good" : "bad"
  return { icon: meta.icon, label: meta.label, amount, tone }
}

export interface ResolveResult {
  outcome: OutcomeDTO
  snapshot: GameSnapshot
}

export async function resolveChoice(playerId: string, eventId: string, optionIndex: number): Promise<{ error?: string; result?: ResolveResult }> {
  const event = await db.activeEvent.findFirst({ where: { id: eventId, playerId } })
  if (!event) return { error: "چنین اتفاقی برای تو نیست." }
  if (event.status !== "active") return { error: "این اتفاق دیگر تمام شده. شهر ادامه داده." }
  // مهلتِ پاسخ — اتفاقِ سرآمده بدون جایزه دفن می‌شود
  if (event.expiresAt && event.expiresAt.getTime() <= Date.now()) {
    await db.activeEvent.updateMany({ where: { id: event.id, status: "active" }, data: { status: "expired" } })
    return { error: "این اتفاق دیگر از زمانش گذشته. شهر جوابِ دیگری برایش داشت." }
  }
  const def = getEvent(event.eventKey)
  if (!def) return { error: "این اتفاق از جهان پاک شده است." }
  const choice = def.choices[optionIndex]
  if (!choice) return { error: "چنین انتخابی وجود ندارد." }

  const world = await getWorld()
  const [inventoryFull, petCount] = await Promise.all([
    db.inventoryItem.findMany({ where: { playerId } }),
    db.pet.count({ where: { playerId } }),
  ])
  const player = await db.player.findUnique({ where: { id: playerId } })
  if (!player) return { error: "بازیکن پیدا نشد." }
  const flags = parseFlags(player)
  const eff = effectiveStats(player, inventoryFull)
  const ctx: ConditionCtx = {
    player,
    eff,
    flags,
    world,
    itemKeys: new Set(inventoryFull.map((i) => i.itemKey)),
    hasPet: petCount > 0,
  }

  if (choice.requires) {
    const lock = checkCondition(choice.requires, ctx)
    if (!lock.ok) return { error: lock.reason ?? "این گزینه برای تو بسته است." }
  }

  // انتخاب وزنی نتیجه — seed قابل تکرار از event+option
  const rng = mulberry32(seedFrom("outcome", event.id, optionIndex, Date.now()))
  const outcome = weightedPick(choice.outcomes, rng)
  if (!outcome) return { error: "شهری نتیجه‌ای برای این انتخاب ندارد. هنوز." }

  const deltas: DeltaLineDTO[] = []
  const grantedItems: { name: string; emoji: string; rarity: Rarity }[] = []
  const grantedPet: { name: string; emoji: string; rarity: Rarity } | null = null
  let petGranted: { name: string; emoji: string; rarity: Rarity } | null = null
  const grantedTitles: string[] = []
  const grantedAchievements: string[] = []
  const npcNotes: string[] = []
  let femboyXpGranted: FemboyXpDTO | null = null // V9 — جایزه‌ی XPِ فمبوی از این تجربه

  const result = await db.$transaction(async (tx) => {
    // قفلِ بستنِ رویداد: فلیپِ شرطی — دو انتخابِ هم‌زمان فقط یک‌بار جایزه می‌گیرند
    const flipped = await tx.activeEvent.updateMany({
      where: { id: event.id, status: "active" },
      data: { status: "resolved", optionLabel: choice.label, resolvedAt: new Date(), data: JSON.stringify({ outcomeText: outcome.text }) },
    })
    if (flipped.count === 0) throw new Error("ALREADY_RESOLVED")

    let p = await tx.player.findUniqueOrThrow({ where: { id: playerId } })
    const f = parseFlags(p)

    // اثرات آماری
    if (outcome.effects?.length) {
      const data: Record<string, number> = {
        health: p.health,
        energy: p.energy,
        luck: p.luck,
        intelligence: p.intelligence,
        chaos: p.chaos,
        fame: p.fame,
        crime: p.crime,
        reputation: p.reputation,
        xp: p.xp,
        debt: p.debt,
      }
      for (const e of outcome.effects) {
        if (e.stat === "money") continue
        data[e.stat] = (data[e.stat] ?? 0) + e.amount
        deltas.push(deltaLine(e.stat, e.amount))
      }
      const leveled = levelFromXpClamp(data.xp)
      const beforeLevel = p.level
      p = await tx.player.update({
        where: { id: p.id },
        data: {
          health: clampStat("health", data.health),
          energy: clampStat("energy", data.energy),
          luck: clampStat("luck", data.luck),
          intelligence: clampStat("intelligence", data.intelligence),
          chaos: clampStat("chaos", data.chaos),
          fame: clampStat("fame", data.fame),
          crime: clampStat("crime", data.crime),
          reputation: clampStat("reputation", data.reputation),
          xp: Math.max(0, Math.round(data.xp)),
          debt: Math.max(0, Math.round(data.debt)),
          level: leveled,
        },
      })
      if (leveled > beforeLevel) {
        await tx.notification.create({
          data: {
            playerId: p.id,
            icon: "🎉",
            title: `سطح ${leveled}`,
            body: "شهر کمی جدی‌تر گرفتیت. دقیقاً به اندازه‌ای که خودش تصمیم گرفت.",
            kind: "reward",
          },
        })
      }
    }

    // پول
    const moneyEffect = outcome.effects?.find((e) => e.stat === "money")
    if (moneyEffect) {
      await applyMoney(tx, p, moneyEffect.amount, "event", def.title)
      deltas.push(deltaLine("money", moneyEffect.amount))
    }

    // آیتم
    if (outcome.grantItem) {
      const itemDef = ITEM_MAP[outcome.grantItem.itemKey]
      if (itemDef) {
        const qty = outcome.grantItem.quantity ?? 1
        const existing = await tx.inventoryItem.findFirst({ where: { playerId: p.id, itemKey: itemDef.key } })
        if (existing) {
          await tx.inventoryItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } })
        } else {
          await tx.inventoryItem.create({ data: { playerId: p.id, itemKey: itemDef.key, quantity: qty } })
        }
        if (!f.discovered?.includes(itemDef.key)) {
          f.discovered = [...(f.discovered ?? []), itemDef.key]
        }
        grantedItems.push({ name: itemDef.name, emoji: itemDef.emoji, rarity: itemDef.rarity })
      }
    }

    // حیوان
    if (outcome.grantPet) {
      const species = PET_MAP[outcome.grantPet.speciesKey]
      if (species) {
        const name = outcome.grantPet.suggestedName ?? species.species
        const created = await tx.pet.create({
          data: {
            playerId: p.id,
            speciesKey: species.key,
            name,
            rarity: species.rarity,
            personality: species.personality,
            loyalty: species.baseLoyalty,
          },
        })
        petGranted = { name: created.name, emoji: species.emoji, rarity: species.rarity }
        await tx.historyEntry.create({
          data: {
            playerId: p.id,
            icon: species.emoji,
            text: `${species.species}ای به نام «${created.name}» به زندگی تو اضافه شد.`,
            category: "pet",
            day: p.day,
          },
        })
      }
    }

    // عنوان
    if (outcome.grantTitle) {
      const t = TITLE_MAP[outcome.grantTitle]
      if (t) {
        await tx.playerTitle.upsert({
          where: { playerId_titleKey: { playerId: p.id, titleKey: t.key } },
          update: {},
          create: { playerId: p.id, titleKey: t.key },
        })
        grantedTitles.push(`${t.emoji} ${t.name}`)
      }
    }

    // دستاورد
    if (outcome.grantAchievement) {
      const a = ACHIEVEMENT_MAP[outcome.grantAchievement]
      if (a) {
        await tx.playerAchievement.upsert({
          where: { playerId_achievementKey: { playerId: p.id, achievementKey: a.key } },
          update: {},
          create: { playerId: p.id, achievementKey: a.key },
        })
        grantedAchievements.push(`${a.emoji} ${a.name}`)
        await tx.notification.create({
          data: {
            playerId: p.id,
            icon: a.emoji,
            title: `دستاورد: ${a.name}`,
            body: a.description,
            kind: "reward",
          },
        })
      }
    }

    // NPCها
    if (outcome.npc?.length) {
      for (const nd of outcome.npc) {
        const npcDef = getNpc(nd.npcKey)
        if (!npcDef) continue
        const existingRel = await tx.relationship.findUnique({
          where: { playerId_npcKey: { playerId: p.id, npcKey: nd.npcKey } },
        })
        const base = {
          trust: existingRel?.trust ?? npcDef.base.trust,
          affection: existingRel?.affection ?? npcDef.base.affection,
          respect: existingRel?.respect ?? npcDef.base.respect,
          fear: existingRel?.fear ?? npcDef.base.fear,
        }
        await tx.relationship.upsert({
          where: { playerId_npcKey: { playerId: p.id, npcKey: nd.npcKey } },
          update: {
            trust: clamp(base.trust + (nd.trust ?? 0), -100, 100),
            affection: clamp(base.affection + (nd.affection ?? 0), -100, 100),
            respect: clamp(base.respect + (nd.respect ?? 0), -100, 100),
            fear: clamp(base.fear + (nd.fear ?? 0), -100, 100),
          },
          create: {
            playerId: p.id,
            npcKey: nd.npcKey,
            trust: clamp(npcDef.base.trust + (nd.trust ?? 0), -100, 100),
            affection: clamp(npcDef.base.affection + (nd.affection ?? 0), -100, 100),
            respect: clamp(npcDef.base.respect + (nd.respect ?? 0), -100, 100),
            fear: clamp(npcDef.base.fear + (nd.fear ?? 0), -100, 100),
          },
        })
        if (nd.memory) {
          await tx.npcMemory.create({
            data: { npcKey: nd.npcKey, playerId: p.id, memory: nd.memory, sentiment: (nd.trust ?? 0) + (nd.respect ?? 0) - (nd.fear ?? 0) },
          })
          npcNotes.push(`${npcDef.emoji} ${npcDef.name} دیگر فراموش نمی‌کند: «${nd.memory}»`)
        }
      }
    }

    // flag ها
    if (outcome.setFlag) f[outcome.setFlag] = true
    if (outcome.clearFlag) delete f[outcome.clearFlag]

    // ثبت دیده‌شدن رویداد
    f.seenEvents = [...new Set([...(f.seenEvents ?? []), def.key])]
    if (def.key === "first_day") {
      f.onboardIntroDone = true
      p = await tx.player.update({ where: { id: p.id }, data: { onboarded: true } })
    }

    // ادامه‌ی زنجیره
    if (outcome.continueChain) {
      f.pendingChain = {
        key: def.chain?.key ?? event.chainKey ?? def.key,
        nextStep: outcome.continueChain.nextStep,
        notBefore: Date.now() + outcome.continueChain.afterMinutes * 60000,
      }
    } else if (event.chainKey) {
      f.pendingChain = null // زنجیره تمام شد
    }

    await tx.player.update({ where: { id: p.id }, data: { flags: JSON.stringify(f) } })

    // نوتیفیکیشن با تأخیر اختیاری
    if (outcome.notification) {
      const delay = (outcome.notification.delayMinutes ?? 0) * 60000
      await tx.notification.create({
        data: {
          playerId: p.id,
          icon: outcome.notification.icon,
          title: outcome.notification.title,
          body: outcome.notification.body,
          kind: "event",
          createdAt: new Date(Date.now() + delay),
        },
      })
    }

    // فیید جهانی
    if (outcome.worldFeed) {
      await tx.worldFeed.create({ data: { worldId: "world", icon: def.emoji, text: outcome.worldFeed } })
    }

    // تغییر آب‌وهوا
    if (outcome.weatherChange) {
      await tx.worldState.update({ where: { id: "world" }, data: { weather: outcome.weatherChange } })
    }

    // تاریخچه
    const historyText = outcome.historyText ?? outcome.text.slice(0, 110)
    await tx.historyEntry.create({
      data: {
        playerId: p.id,
        icon: def.emoji,
        text: historyText,
        category: "event",
        day: p.day,
      },
    })

    // V9 — تربیتِ فمبوی: تجربه‌ی این اتفاق، XPِ فمبویِ حاضر را جلو می‌برد
    femboyXpGranted = await awardEventFemboyXp(tx, playerId, def.category, def.rarity)

    // دستاوردهای خودکار
    await autoAchievements(tx, p)

    return true
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "ALREADY_RESOLVED") return null
    throw e
  })

  if (!result) return { error: "این اتفاق دیگر تمام شده. شهر ادامه داده." }

  const fresh = await db.player.findUniqueOrThrow({ where: { id: playerId } })
  const snapshot = await buildSnapshot(fresh)
  const outcomeDto: OutcomeDTO = {
    text: outcome.text,
    deltas,
    grantedItems,
    grantedPet: petGranted,
    grantedTitles,
    grantedAchievements,
    npcNotes,
    worldFeed: outcome.worldFeed ?? null,
    femboyXp: femboyXpGranted,
  }
  return { result: { outcome: outcomeDto, snapshot } }
}

function levelFromXpClamp(xp: number): number {
  let level = 1
  let remaining = xp
  while (remaining >= 100 + (level - 1) * 80 && level < 99) {
    remaining -= 100 + (level - 1) * 80
    level++
  }
  return level
}

async function autoAchievements(tx: import("@prisma/client").Prisma.TransactionClient, p: Player): Promise<void> {
  const has = async (key: string) =>
    !!(await tx.playerAchievement.findUnique({ where: { playerId_achievementKey: { playerId: p.id, achievementKey: key } } }))
  const grant = async (key: string) => {
    const a = ACHIEVEMENT_MAP[key]
    if (!a || (await has(key))) return
    await tx.playerAchievement.create({ data: { playerId: p.id, achievementKey: key } })
    await tx.notification.create({
      data: { playerId: p.id, icon: a.emoji, title: `دستاورد: ${a.name}`, body: a.description, kind: "reward" },
    })
  }
  if (p.debt >= 10000) await grant("deep_debt")
  if (p.chaos >= 50) await grant("chaos_agent")
  if (p.fame >= 50) await grant("local_celebrity")
  if (p.crime === 0 && p.day >= 3) await grant("lawbringer")
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export async function buildSnapshot(player: Player, opts?: { recap?: OfflineRecapDTO | null }): Promise<GameSnapshot> {
  const world = await getWorld()
  const [inventory, pets, activeEvent, notifications, relationships, titles, achievements, memories, soulChar] = await Promise.all([
    db.inventoryItem.findMany({ where: { playerId: player.id } }),
    db.pet.findMany({ where: { playerId: player.id } }),
    db.activeEvent.findFirst({ where: { playerId: player.id, status: "active" } }),
    db.notification.findMany({
      where: { playerId: player.id, createdAt: { lte: new Date(Date.now() + 1000) } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    db.relationship.findMany({ where: { playerId: player.id } }),
    db.playerTitle.findMany({ where: { playerId: player.id } }),
    db.playerAchievement.findMany({ where: { playerId: player.id } }),
    db.npcMemory.findMany({ where: { playerId: player.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    getSyncedCharacter(player.id),
  ])
  const feed = await getFeed(10)

  const eff = effectiveStats(player, inventory)
  const xpP = xpProgress(player.xp)
  const flags = parseFlags(player)
  const district = getDistrict(player.currentDistrict)

  const job = getJob(player.jobKey)
  const vehicle = getVehicle(player.vehicleKey)
  const house = getHouse(player.houseKey)

  const lastWorkedMin = player.lastWorkedAt ? (Date.now() - player.lastWorkedAt.getTime()) / 60000 : Infinity
  const canWork = !!job && lastWorkedMin >= job.cooldownMinutes && !player.restUntil
  const activeTitleRow = titles.find((t) => t.active)
  const activeTitleDef = activeTitleRow ? TITLE_MAP[activeTitleRow.titleKey] : null

  // V4: زیرنشانِ مقطع — فقط از داده‌ی همین snapshot (بدون کوئریِ اضافه)
  const badgeTotals: PlayerTotals = {
    ...EMPTY_TOTALS,
    achievementCount: achievements.length,
    titleCount: titles.length,
    petsAdopted: pets.length,
  }
  const badge = stageBadgeOf(player, badgeTotals)

  // ── Player DTO
  const playerDto: PlayerDTO = {
    id: player.id,
    name: player.name,
    avatar: player.avatar,
    level: player.level,
    xp: xpP.into,
    xpToNext: xpP.need,
    day: player.day,
    money: player.money,
    debt: player.debt,
    health: eff.health,
    energy: eff.energy,
    luck: eff.luck,
    intelligence: eff.intelligence,
    chaos: eff.chaos,
    fame: eff.fame,
    crime: eff.crime,
    reputation: eff.reputation,
    district: district.key,
    districtName: district.name,
    districtEmoji: district.emoji,
    job: job
      ? {
          key: job.key,
          name: job.name,
          emoji: job.emoji,
          description: job.description,
          incomeMin: job.income[0],
          incomeMax: job.income[1],
          energyCost: job.energyCost,
          risk: job.risk > 0.4 ? "بالا" : job.risk > 0.15 ? "متوسط" : "کم",
          quirks: job.quirks,
        }
      : null,
    vehicle: vehicle ? { key: vehicle.key, name: vehicle.name, emoji: vehicle.emoji, quirk: vehicle.quirk } : null,
    house: house
      ? {
          key: house.key,
          name: house.name,
          emoji: house.emoji,
          rent: house.rent,
          rentDueInHours: Math.max(0, Math.round((player.houseRentDue.getTime() - Date.now()) / 3600000)),
          comfort: house.comfort,
          security: house.security,
        }
      : null,
    canWork,
    workCooldownMinutes: job ? Math.max(0, Math.ceil(job.cooldownMinutes - lastWorkedMin)) : 0,
    resting: !!player.restUntil && player.restUntil.getTime() > Date.now(),
    restMinutesLeft: player.restUntil ? Math.max(0, Math.ceil((player.restUntil.getTime() - Date.now()) / 60000)) : 0,
    activeTitle: activeTitleDef ? `${activeTitleDef.emoji} ${activeTitleDef.name}` : null,
    titles: titles
      .map((t) => TITLE_MAP[t.titleKey])
      .filter(Boolean)
      .map((t) => ({ key: t!.key, name: t!.name, emoji: t!.emoji, description: t!.description })),
    achievements: achievements.flatMap((row) => {
      const def = ACHIEVEMENT_MAP[row.achievementKey]
      if (!def) return []
      // V16-4 — unlockedAt (افزایشی): مرتب‌سازیِ «آخرینِ دستاوردها» در رباتِ خصوصی
      return [{ key: def.key, name: def.name, emoji: def.emoji, description: def.description, unlockedAt: row.unlockedAt.toISOString() }]
    }),
    statsSummary: buildStory(player, pets, inventory, achievements.length),
    stageBadge: badge,
  }

  // ── World DTO
  const globalDef = world.activeGlobalEvent ? (await import("./content")).getGlobalEvent(world.activeGlobalEvent) : null
  const worldDto: WorldDTO = {
    dayCount: world.dayCount,
    weather: world.weather,
    weatherLabel: WEATHER_LABEL[world.weather]?.label ?? world.weather,
    weatherEmoji: WEATHER_LABEL[world.weather]?.emoji ?? "🌤",
    mood: world.mood,
    moodLabel: MOOD_LABEL[world.mood] ?? world.mood,
    chaosLevel: world.chaosLevel,
    economyIndex: world.economyIndex,
    globalEvent: globalDef
      ? {
          key: globalDef.key,
          name: globalDef.name,
          emoji: globalDef.emoji,
          description: globalDef.description,
          endsInMinutes: world.globalEventEndsAt
            ? Math.max(0, Math.ceil((world.globalEventEndsAt.getTime() - Date.now()) / 60000))
            : 0,
        }
      : null,
    feed: feed.map((f) => ({ id: f.id, icon: f.icon, text: f.text, at: f.createdAt.toISOString() })),
  }

  // ── Active event DTO
  let activeEventDto: ActiveEventDTO | null = null
  if (activeEvent) {
    const def = getEvent(activeEvent.eventKey)
    if (def) {
      const choices: ChoiceDTO[] = def.choices.map((c) => {
        const lock = c.requires ? checkCondition(c.requires, { player, eff, flags, world, itemKeys: new Set(inventory.map((i) => i.itemKey)), hasPet: pets.length > 0 }) : { ok: true, reason: null }
        return { label: c.label, hint: c.hint ?? null, locked: !lock.ok, lockedReason: lock.reason }
      })
      activeEventDto = {
        id: activeEvent.id,
        key: def.key,
        title: def.title,
        emoji: def.emoji,
        category: def.category,
        categoryLabel: CATEGORY_LABEL[def.category],
        rarity: def.rarity,
        rarityLabel: RARITY_LABEL[def.rarity],
        text: def.text,
        isChainStep: !!def.chain,
        chainStep: def.chain?.step ?? 0,
        expiresAt: activeEvent.expiresAt?.toISOString() ?? null,
        choices,
      }
    }
  }

  // ── Pets
  const petDtos: PetDTO[] = pets.map((pet) => {
    const species = PET_MAP[pet.speciesKey]
    const moodLabel =
      pet.hunger < 25 ? "ناراضی" : pet.energy < 20 ? "خسته" : pet.loyalty > 60 ? "وفادار" : "راضی"
    const statusNote =
      pet.hunger < 25
        ? "اگر غذا ندهی، ممکن است به زندگی قبلی‌اش برگردد."
        : pet.loyalty > 70
          ? "همیشه دنبالت می‌آید. حتی تو خواب."
          : null
    return {
      id: pet.id,
      speciesKey: pet.speciesKey,
      species: species?.species ?? pet.speciesKey,
      name: pet.name,
      emoji: species?.emoji ?? "🐾",
      rarity: (pet.rarity as Rarity) ?? "common",
      rarityLabel: RARITY_LABEL[(pet.rarity as Rarity) ?? "common"],
      personality: pet.personality,
      traits: species?.traits ?? [],
      hunger: pet.hunger,
      energy: pet.energy,
      loyalty: pet.loyalty,
      mood: pet.mood,
      moodLabel,
      statusNote,
    }
  })

  // ── Inventory
  const inventoryDtos: InventoryEntryDTO[] = inventory
    .map((entry): InventoryEntryDTO | null => {
      const def = ITEM_MAP[entry.itemKey]
      if (!def) return null
      const discovered = flags.discovered?.includes(def.key) ?? false
      const secret = def.secret && !discovered && entry.quantity <= 0
      return {
        itemKey: entry.itemKey,
        name: secret ? "؟؟؟" : def.name,
        emoji: def.emoji,
        rarity: def.rarity,
        rarityLabel: RARITY_LABEL[def.rarity],
        category: def.category as string,
        quantity: entry.quantity,
        equipped: entry.equipped,
        favorite: entry.favorite,
        locked: entry.locked,
        usable: def.usable,
        tradable: def.tradable && !entry.locked,
        description: secret ? "هنوز نمی‌دانی چیست." : def.description,
        effectLabel: def.effect ? `${STAT_META[def.effect.stat].label} ${def.effect.amount > 0 ? "+" : ""}${def.effect.amount}` : null,
        unitPrice: 0,
      }
    })
    .filter((x): x is InventoryEntryDTO => x !== null)
    .sort((a, b) => {
      const cat = ["gear", "consumable", "collectible", "mystery", "junk"]
      return cat.indexOf(a.category) - cat.indexOf(b.category) || b.quantity - a.quantity
    })

  // ─── Notifications
  const notificationDtos: NotificationDTO[] = notifications.map((n) => ({
    id: n.id,
    icon: n.icon,
    title: n.title,
    body: n.body,
    kind: n.kind,
    read: n.read,
    at: n.createdAt.toISOString(),
  }))

  // ─── NPCs
  const relMap = new Map<string, Relationship>(relationships.map((r) => [r.npcKey, r] as [string, Relationship]))
  const lastMemories = new Map<string, string>()
  for (const m of memories) {
    if (!lastMemories.has(m.npcKey)) lastMemories.set(m.npcKey, m.memory)
  }
  const npcDtos: NpcDTO[] = Object.values(NPC_MAP).map((npc) => {
    const rel = relMap.get(npc.key)
    const trust = rel?.trust ?? npc.base.trust
    const affection = rel?.affection ?? npc.base.affection
    const respect = rel?.respect ?? npc.base.respect
    const fear = rel?.fear ?? npc.base.fear
    const statusLabel =
      fear > 60 ? "از تو می‌ترسد" :
      trust > 50 ? "به تو اعتماد دارد" :
      trust < -20 ? "اعتمادش را از دست داده" :
      affection > 40 ? "دوستت دارد" :
      respect > 40 ? "به تو احترام می‌گذارد" :
      "آشنای معمولی"
    return {
      key: npc.key,
      name: npc.name,
      emoji: npc.emoji,
      occupation: npc.occupation,
      district: npc.district,
      districtName: getDistrict(npc.district).name,
      description: npc.description,
      relationship: { trust, affection, respect, fear },
      statusLabel,
      lastMemory: lastMemories.get(npc.key) ?? null,
      hasSecret: !!npc.secret,
    }
  })

  // ── V9: هویتِ مرکزی — فمبویِ روح‌بسته در هر snapshot (برای ربات، مینی‌اپ و راهنما)
  const femboyDto = soulChar ? femboySummaryDTO(soulChar) : null

  return {
    player: playerDto,
    world: worldDto,
    activeEvent: activeEventDto,
    pets: petDtos,
    inventory: inventoryDtos,
    notifications: notificationDtos,
    unreadNotifications: notifications.filter((n) => !n.read).length,
    npcs: npcDtos,
    offlineRecap: opts?.recap ?? null,
    serverTime: new Date().toISOString(),
    femboy: femboyDto,
  }
}

function buildStory(player: Player, pets: Pet[], inventory: InventoryItem[], achievementCount: number): string[] {
  const lines: string[] = []
  if (player.crime > 30) lines.push(`سابقه‌ی جنایی‌اش پلیس را خسته کرده`)
  if (player.debt > 3000) lines.push(`به دایی فرهاد ${player.debt} سکه بدهکار است`)
  if (pets.length >= 2) lines.push(`${pets.length} حیوان زیر یک سقف جمع کرده`)
  else if (pets.length === 1) lines.push(`با یک ${PET_MAP[pets[0].speciesKey]?.species ?? "حیوان"} زندگی می‌کند`)
  if (player.fame > 30) lines.push(`تو کوچه‌ها برمی‌گردند وقتی رد می‌شود`)
  if (player.chaos > 40) lines.push(`آشوبِ شهر اسمش را می‌داند`)
  if (achievementCount >= 5) lines.push(`${achievementCount} دستاورد در کارنامه دارد`)
  const rare = inventory.filter((i) => ["rare", "epic", "legendary"].includes(ITEM_MAP[i.itemKey]?.rarity ?? "common")).length
  if (rare > 0) lines.push(`${rare} چیزِ کمیاب در کیفش نگه می‌دارد`)
  if (lines.length === 0) lines.push("این شهر هنوز درباره‌ش تصمیم نگرفته")
  return lines.slice(0, 6)
}

// اجرای tick کامل (جهان + بازیکن) و ساخت snapshot — برای endpoint ها
export async function tickAndSnapshot(player: Player): Promise<{ snapshot: GameSnapshot; recap: OfflineRecapDTO | null }> {
  await worldTick()
  const { player: ticked, recap } = await playerTick(player)
  const recapDto: OfflineRecapDTO | null =
    recap && recap.length > 0
      ? {
          elapsedHours: Math.round(((Date.now() - player.lastSeenAt.getTime()) / 3600000) * 10) / 10,
          lines: recap,
        }
      : null
  const snapshot = await buildSnapshot(ticked, { recap: recapDto })
  return { snapshot, recap: recapDto }
}

export { drawEvent as drawEventInternal }
