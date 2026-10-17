// FEMBOY WAR V4 — فرصت‌ها: پیشنهادهای زمان‌دار که شهر سرِ وقت می‌فرستد.
// سرور-مرجع؛ پاداش‌ها در لحظه‌ی claim با seed قابل تکرار تعیین می‌شوند.
import { db } from "@/lib/db"
import type { Player, WorldState } from "@prisma/client"
import type { Rarity } from "./types"
import { ITEM_MAP, getNpc } from "./content"
import { applyMoney } from "./economy"
import { STAT_META, clampStat, parseFlags, levelFromXp, faNum } from "./helpers"
import { mulberry32, seedFrom, weightedPick, clamp, chance, randInt } from "./rng"
import type { DeltaLineDTO, OpportunityDTO } from "./contract"

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface OpportunityPayload {
  moneyMin?: number
  moneyMax?: number
  itemKeys?: string[] // برای wild: جایزه‌های احتمالی
  fame?: number // ± پایه (برای wild علامتش برمی‌گردد)
  chaos?: number
  crime?: number
  reputation?: number
  xp?: number
  npcKey?: string // رابطه تقویت می‌شود
  npcTrust?: number
  npcMemory?: string
}

interface OppTemplate {
  key: string
  kind: "deal" | "job" | "social" | "mystery" | "city"
  title: string
  icon: string
  description: string
  sourceLabel: string
  rewardPreview: string
  claimStyle: "safe" | "risky" | "wild"
  weight: number
  condition?: (ctx: { player: Player; world: WorldState }) => boolean
  payload: OpportunityPayload
}

// ─── قالب‌ها (~15) — داده‌محور، همه فارسی ────────────────────────────────────

export const OPPORTUNITY_TEMPLATES: OppTemplate[] = [
  {
    key: "mahoor_courier",
    kind: "social",
    title: "پیکِ گریخته",
    icon: "☕",
    description: "خانم ماهور می‌گوید یکی از پیک‌هایش فرار کرده و بسته‌ای باید همین امشب برسد. کسی که برساندش، پاک‌دست حساب می‌شود.",
    sourceLabel: "کافه‌ی ماهور",
    rewardPreview: `+${faNum(6000)} تا ${faNum(10000)} سکه`,
    claimStyle: "safe",
    weight: 3,
    payload: { moneyMin: 6000, moneyMax: 10000, npcKey: "mahoor", npcTrust: 6, npcMemory: "بسته‌ی من را رساند" },
  },
  {
    key: "arash_box",
    kind: "deal",
    title: "جعبه‌ی بدون برچسب",
    icon: "🕶",
    description: "آرش یک جعبه‌ی بدون برچسب دارد. نمی‌گوید چیست. می‌گوید «موقع پیدا شد» — و پولش نقد است.",
    sourceLabel: "آرش، بازار",
    rewardPreview: "شاید دو برابر، شاید هیچ",
    claimStyle: "risky",
    weight: 2,
    condition: ({ player }) => player.level >= 2,
    payload: { moneyMin: 8000, moneyMax: 15000, crime: 4, npcKey: "arash", npcTrust: 3 },
  },
  {
    key: "factory_cash",
    kind: "job",
    title: "شیفتِ اضطراری",
    icon: "🏭",
    description: "کارگاهِ منطقه‌ی صنعتی برای شیفتِ شب پولِ نقد می‌دهد. کسی نمی‌پرسد چرا خطِ تولید ساعتِ سه شب روشن است.",
    sourceLabel: "کارگاهِ صنعتی",
    rewardPreview: `+${faNum(5000)} تا ${faNum(9000)} سکه`,
    claimStyle: "safe",
    weight: 3,
    payload: { moneyMin: 5000, moneyMax: 9000, xp: 8 },
  },
  {
    key: "old_radio",
    kind: "mystery",
    title: "رادیوی محله‌ی قدیمی",
    icon: "📻",
    description: "صدای عجیبی از رادیوی محله‌ی قدیمی می‌آید. کسی که گوش می‌دهد، دیگر همان نمی‌ماند.",
    sourceLabel: "محله‌ی قدیمی",
    rewardPreview: "چیزهایی که اسم ندارند",
    claimStyle: "wild",
    weight: 2,
    payload: { itemKeys: ["old_key", "cassette", "nazar"], fame: 5, chaos: 5, xp: 10 },
  },
  {
    key: "cityhall_cleanup",
    kind: "city",
    title: "بودجه‌ی پاک‌سازی",
    icon: "🏛",
    description: "شهرداری بعد از آخرین هرج‌ومرج بودجه‌ی پاک‌سازی داده. کار ساده است: جمع‌کردن چیزهایی که «باید جمع می‌شدند».",
    sourceLabel: "شهرداری",
    rewardPreview: `+${faNum(4000)} سکه و اعتبار`,
    claimStyle: "safe",
    weight: 2,
    condition: ({ world }) => world.chaosLevel >= 20,
    payload: { moneyMin: 4000, moneyMax: 7000, reputation: 5 },
  },
  {
    key: "kimo_package",
    kind: "social",
    title: "بسته‌ی کیمو",
    icon: "🧢",
    description: "کیمو بسته‌ای زیر بازویش دارد که به‌قول خودش «مالِ کسی نیست». می‌خواهد یک‌بار فقط تحویلش بدهی. پرسیدن ممنوع.",
    sourceLabel: "کیمو، محله‌ی قدیمی",
    rewardPreview: "پولِ خوب، سابقه‌ی کوچک",
    claimStyle: "risky",
    weight: 2,
    condition: ({ player }) => player.level >= 3,
    payload: { moneyMin: 3000, moneyMax: 12000, crime: 6, npcKey: "kimo", npcTrust: 4 },
  },
  {
    key: "roghayeh_file",
    kind: "mystery",
    title: "تلگرامِ ناشناس",
    icon: "💻",
    description: "تلگرامِ ناشناسی می‌گوید: «یک فایل. یک شب. پولِ خوب.» آی‌دی‌اش شبیه رقیه است — یا کسی که می‌خواهد شبیهش باشد.",
    sourceLabel: "؟؟؟",
    rewardPreview: "پولِ زیاد، ردِپای زیاد",
    claimStyle: "risky",
    weight: 2,
    condition: ({ player }) => player.intelligence >= 15,
    payload: { moneyMin: 10000, moneyMax: 20000, crime: 8, chaos: 5 },
  },
  {
    key: "nemati_files",
    kind: "city",
    title: "بازخوانیِ پرونده‌ها",
    icon: "🚔",
    description: "سرگرد نعمتی برای بازخوانیِ پرونده‌های قدیمی دستیار می‌خواهد. حضوری نه. اسمی هم نه.",
    sourceLabel: "کلانتریِ مرکز",
    rewardPreview: `+${faNum(3500)} سکه و اعتبار`,
    claimStyle: "safe",
    weight: 2,
    condition: ({ player }) => player.reputation >= 10 || player.crime >= 10,
    payload: { moneyMin: 3500, moneyMax: 6000, reputation: 4 },
  },
  {
    key: "penthouse_party",
    kind: "social",
    title: "لیستِ پنت‌هاوس",
    icon: "💎",
    description: "یکی از پنت‌هاوس‌ها مهمانی می‌دهد و اسمِ تو روی لیست است. کسی ننوشته چه کسی اسمت را نوشته.",
    sourceLabel: "منطقه‌ی لوکس",
    rewardPreview: "شهرت، سوغات، صبحِ مبهم",
    claimStyle: "wild",
    weight: 1,
    condition: ({ player }) => player.fame >= 20,
    payload: { itemKeys: ["cake", "lipstick", "trophy"], fame: 8, chaos: 4, moneyMin: 1000, moneyMax: 4000 },
  },
  {
    key: "duck_sighting",
    kind: "mystery",
    title: "گزارشِ اردک‌ها",
    icon: "🦆",
    description: "گزارش‌هایی از «اردک‌هایی که دنبال می‌کنند» به دست ما رسیده. سرگرد نعمتی پرونده دارد. تو فقط نگاه می‌کنی... شاید.",
    sourceLabel: "شایعه‌ی شهر",
    rewardPreview: "شاید خودِ اردک",
    claimStyle: "wild",
    weight: 1,
    condition: ({ world }) => world.chaosLevel >= 25,
    payload: { itemKeys: ["duck", "nazar"], chaos: 8, fame: 6, xp: 12 },
  },
  {
    key: "courier_rush",
    kind: "job",
    title: "موجِ سفارش‌ها",
    icon: "🛵",
    description: "موجِ سفارش‌ها رستوران‌ها را غرق کرده. پیکِ ساعتی می‌خواهند. هرچه سریع‌تر، بهتر. هرچه عجله‌تر، عجیب‌تر.",
    sourceLabel: "شبکه‌ی سفارش",
    rewardPreview: `+${faNum(4000)} تا ${faNum(8000)} سکه`,
    claimStyle: "safe",
    weight: 3,
    payload: { moneyMin: 4000, moneyMax: 8000, xp: 6 },
  },
  {
    key: "farhad_reminder",
    kind: "deal",
    title: "پیامِ دایی فرهاد",
    icon: "💼",
    description: "دایی فرهاد می‌خواهد یکی از بدهکارها «متوجه» شود. تو فقط پیام می‌بری. بقیه‌اش مالِ خودِ شهر است.",
    sourceLabel: "دایی فرهاد",
    rewardPreview: "پولِ نقد، خوابِ سنگین",
    claimStyle: "risky",
    weight: 2,
    condition: ({ player }) => player.debt > 0,
    payload: { moneyMin: 7000, moneyMax: 13000, crime: 5, npcKey: "daii_farhad", npcTrust: 5 },
  },
  {
    key: "flea_market",
    kind: "deal",
    title: "حراجِ حومه",
    icon: "🗑",
    description: "در حومه، حراجِ چیزهای عجیب برپاست. عمو قنبر گفته «همه‌ش اصل است». عمو قنبر زیاد حرف می‌زند.",
    sourceLabel: "حومه",
    rewardPreview: "شاید یه چیزِ نایاب…",
    claimStyle: "wild",
    weight: 2,
    payload: { itemKeys: ["old_key", "flashlight", "umbrella", "blue_flower"], moneyMin: 500, moneyMax: 2000 },
  },
  {
    key: "lost_cat",
    kind: "social",
    title: "گربه‌ی گمشده",
    icon: "🐈",
    description: "گربه‌ای در پارک گم شده. جایزه‌ی پیدا کردنش بیشتر از ارزشِ یک گربه است. صاحبش نمی‌گوید چرا.",
    sourceLabel: "تابلوی پارک",
    rewardPreview: `+${faNum(2500)} تا ${faNum(4500)} سکه`,
    claimStyle: "safe",
    weight: 3,
    payload: { moneyMin: 2500, moneyMax: 4500, reputation: 3 },
  },
  {
    key: "red_moon_deal",
    kind: "mystery",
    title: "خریدارِ همه‌چیز",
    icon: "🌕",
    description: "در شبِ ماهِ قرمز، کسی در منطقه‌ی ممنوعه خریدارِ «همه‌چیز» است. چهره‌اش را نبین. قیمت را هم نجنگ.",
    sourceLabel: "منطقه‌ی ممنوعه",
    rewardPreview: "پولِ بزرگ، آشوبِ بزرگ",
    claimStyle: "wild",
    weight: 1,
    condition: ({ world }) => world.weather === "red_moon" || world.activeGlobalEvent === "red_moon",
    payload: { moneyMin: 12000, moneyMax: 25000, itemKeys: ["cursed_card"], chaos: 10, fame: 8 },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delta(stat: keyof typeof STAT_META, amount: number): DeltaLineDTO {
  const meta = STAT_META[stat]
  const inverted = stat === "debt" || stat === "crime"
  const tone: DeltaLineDTO["tone"] = amount === 0 ? "neutral" : inverted ? (amount > 0 ? "bad" : "good") : amount > 0 ? "good" : "bad"
  return { icon: meta.icon, label: meta.label, amount, tone }
}

function parsePayload(json: string | null): OpportunityPayload {
  if (!json) return {}
  try {
    return JSON.parse(json) as OpportunityPayload
  } catch {
    return {}
  }
}

// ─── Ensure / List ────────────────────────────────────────────────────────────

const TARGET_ACTIVE = 2
const EXPIRY_MIN = 30
const EXPIRY_MAX = 180

/** پاکسازی و تولیدِ فرصت — در guide صدا زده می‌شود. */
export async function ensureOpportunities(player: Player): Promise<void> {
  const now = new Date()
  // منقضی‌ها + گرفته‌شده‌های قدیمی‌تر از 1 ساعت
  await db.opportunity.deleteMany({
    where: {
      playerId: player.id,
      OR: [
        { expiresAt: { lt: now } },
        { AND: [{ claimedAt: { not: null } }, { claimedAt: { lt: new Date(now.getTime() - 3600000) } }] },
      ],
    },
  })

  const activeRows = await db.opportunity.findMany({
    where: { playerId: player.id, claimedAt: null, expiresAt: { gt: now } },
    select: { key: true },
  })
  if (activeRows.length >= TARGET_ACTIVE) return

  const { getWorld } = await import("./world")
  const world = await getWorld()
  // قالب‌های اخیراً گرفته‌شده را هم کنار بگذار — شهر تکراری نیست
  const recentlyClaimed = await db.opportunity.findMany({
    where: { playerId: player.id, claimedAt: { gte: new Date(now.getTime() - 2 * 3600000) } },
    select: { key: true },
  })
  const takenKeys = new Set<string>([...activeRows.map((o) => o.key), ...recentlyClaimed.map((o) => o.key)])
  const rng = mulberry32(seedFrom("opp", player.id, Math.floor(now.getTime() / 60000)))

  const eligible = OPPORTUNITY_TEMPLATES.filter(
    (t) => !takenKeys.has(t.key) && (!t.condition || t.condition({ player, world })),
  )

  let active = activeRows.length
  while (active < TARGET_ACTIVE && eligible.length > 0) {
    const pick = weightedPick(eligible, rng)
    if (!pick) break
    eligible.splice(eligible.indexOf(pick), 1)
    const expiresAt = new Date(now.getTime() + randInt(EXPIRY_MIN, EXPIRY_MAX, rng) * 60000)
    await db.opportunity.create({
      data: {
        key: pick.key,
        playerId: player.id,
        kind: pick.kind,
        title: pick.title,
        icon: pick.icon,
        description: pick.description,
        sourceLabel: pick.sourceLabel,
        rewardPreview: pick.rewardPreview,
        claimStyle: pick.claimStyle,
        payloadJson: JSON.stringify(pick.payload),
        expiresAt,
      },
    })
    active++
  }
}

/** فرصت‌های فعالِ اخذنشده — مرتب بر اساس دقایقِ باقی‌مانده (صعودی)، حداکثر 4. */
export async function listOpportunities(player: Player): Promise<OpportunityDTO[]> {
  const now = new Date()
  const rows = await db.opportunity.findMany({
    where: { playerId: player.id, claimedAt: null, expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    take: 8,
  })
  return rows
    .map((o) => ({
      id: o.id,
      title: o.title,
      icon: o.icon,
      description: o.description,
      sourceLabel: o.sourceLabel,
      minutesLeft: Math.max(1, Math.round((o.expiresAt.getTime() - now.getTime()) / 60000)),
      kind: o.kind as OpportunityDTO["kind"],
      rewardPreview: o.rewardPreview,
      claimStyle: o.claimStyle as OpportunityDTO["claimStyle"],
    }))
    .sort((a, b) => a.minutesLeft - b.minutesLeft)
    .slice(0, 4)
}

// ─── Claim ────────────────────────────────────────────────────────────────────

export interface ClaimOk {
  message: string
  flavor: string
  deltas: DeltaLineDTO[]
  extra?: Record<string, unknown>
}

export async function claimOpportunity(
  player: Player,
  opportunityId: string,
): Promise<{ error?: string; ok?: ClaimOk }> {
  if (!opportunityId) return { error: "کدوم فرصت؟" }
  const opp = await db.opportunity.findUnique({ where: { id: opportunityId } })
  if (!opp || opp.playerId !== player.id) return { error: "چنین فرصتی برای تو نیست." }
  if (opp.claimedAt) return { error: "این فرصت را گرفته‌ای. شهر تکراری نیست." }
  if (opp.expiresAt.getTime() <= Date.now()) return { error: "این فرصت دیگر نیست. شهر منتظر نمی‌ماند." }

  const payload = parsePayload(opp.payloadJson)
  const rng = mulberry32(seedFrom("claimopp", opp.id, Date.now()))

  // پاداش پایه
  const baseMoney =
    payload.moneyMin !== undefined ? randInt(payload.moneyMin, payload.moneyMax ?? payload.moneyMin, rng) : 0
  let money = 0
  let riskyMiss = false
  if (baseMoney > 0) {
    if (opp.claimStyle === "safe") {
      money = Math.round((baseMoney * randInt(90, 110, rng)) / 100)
    } else if (opp.claimStyle === "risky") {
      if (chance(0.4, rng)) {
        money = 0
        riskyMiss = true
      } else {
        money = Math.round(baseMoney * (1.2 + rng() * 0.6))
      }
    } else {
      money = Math.round((baseMoney * randInt(70, 130, rng)) / 100)
    }
  }

  // wild: جایزه‌های تصادفی + نوسان علامتِ fame/chaos
  const wildItems: string[] = []
  if (opp.claimStyle === "wild" && payload.itemKeys?.length) {
    const count = randInt(1, Math.min(2, payload.itemKeys.length), rng)
    const pool = [...payload.itemKeys]
    for (let i = 0; i < count && pool.length > 0; i++) {
      wildItems.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
    }
  }
  const swing = (v: number) => (opp.claimStyle === "wild" && v !== 0 ? (chance(0.5, rng) ? v : -v) : v)
  const fameDelta = swing(payload.fame ?? 0)
  const chaosDelta = swing(payload.chaos ?? 0)
  const crimeDelta = payload.crime ?? 0
  const repDelta = payload.reputation ?? 0
  const xpGain = payload.xp ?? 0

  const deltas: DeltaLineDTO[] = []
  const grantedItems: { name: string; emoji: string; rarity: Rarity }[] = []

  try {
    await db.$transaction(async (tx) => {
      // قفلِ دوباره‌claim داخل تراکنش
      const locked = await tx.opportunity.findUnique({ where: { id: opp.id } })
      if (!locked || locked.claimedAt || locked.playerId !== player.id) throw new Error("CLAIMED")
      if (locked.expiresAt.getTime() <= Date.now()) throw new Error("EXPIRED")

      let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })

      // پول
      if (money !== 0) {
        await applyMoney(tx, p, money, "reward", `فرصت: ${opp.title}`)
        deltas.push(delta("money", money))
      }

      // آمارها
      const statDeltas: { key: "fame" | "chaos" | "crime" | "reputation"; amount: number }[] = []
      if (fameDelta !== 0) statDeltas.push({ key: "fame", amount: fameDelta })
      if (chaosDelta !== 0) statDeltas.push({ key: "chaos", amount: chaosDelta })
      if (crimeDelta !== 0) statDeltas.push({ key: "crime", amount: crimeDelta })
      if (repDelta !== 0) statDeltas.push({ key: "reputation", amount: repDelta })
      const newXp = Math.max(0, Math.round(p.xp + xpGain))
      if (xpGain !== 0) deltas.push(delta("xp", xpGain))
      if (statDeltas.length > 0 || xpGain !== 0) {
        const beforeLevel = p.level
        const statData: Record<string, number> = {
          fame: p.fame,
          chaos: p.chaos,
          crime: p.crime,
          reputation: p.reputation,
        }
        for (const sd of statDeltas) {
          statData[sd.key] = clampStat(sd.key, (statData[sd.key] ?? 0) + sd.amount)
          deltas.push(delta(sd.key, sd.amount))
        }
        p = await tx.player.update({
          where: { id: p.id },
          data: {
            fame: statData.fame,
            chaos: statData.chaos,
            crime: statData.crime,
            reputation: statData.reputation,
            xp: newXp,
            level: levelFromXp(newXp),
          },
        })
        if (p.level > beforeLevel) {
          await tx.notification.create({
            data: {
              playerId: p.id,
              icon: "🎉",
              title: `سطح ${p.level}`,
              body: "شهر کمی جدی‌تر گرفتیت. دقیقاً به اندازه‌ای که خودش تصمیم گرفت.",
              kind: "reward",
            },
          })
        }
      }

      // آیتم‌های wild
      if (wildItems.length > 0) {
        const f = parseFlags(p)
        for (const itemKey of wildItems) {
          const def = ITEM_MAP[itemKey]
          if (!def) continue
          await tx.inventoryItem.upsert({
            where: { playerId_itemKey: { playerId: p.id, itemKey } },
            update: { quantity: { increment: 1 } },
            create: { playerId: p.id, itemKey, quantity: 1 },
          })
          if (!f.discovered?.includes(itemKey)) f.discovered = [...(f.discovered ?? []), itemKey]
          grantedItems.push({ name: def.name, emoji: def.emoji, rarity: def.rarity })
        }
        await tx.player.update({ where: { id: p.id }, data: { flags: JSON.stringify(f) } })
      }

      // رابطه با NPC
      if (payload.npcKey) {
        const npcDef = getNpc(payload.npcKey)
        if (npcDef) {
          const existing = await tx.relationship.findUnique({
            where: { playerId_npcKey: { playerId: p.id, npcKey: npcDef.key } },
          })
          const bump = payload.npcTrust ?? 3
          if (existing) {
            await tx.relationship.update({
              where: { id: existing.id },
              data: { trust: clamp(existing.trust + bump, -100, 100) },
            })
          } else {
            await tx.relationship.create({
              data: {
                playerId: p.id,
                npcKey: npcDef.key,
                trust: clamp(npcDef.base.trust + bump, -100, 100),
                affection: npcDef.base.affection,
                respect: npcDef.base.respect,
                fear: npcDef.base.fear,
              },
            })
          }
          if (payload.npcMemory) {
            await tx.npcMemory.create({
              data: { npcKey: npcDef.key, playerId: p.id, memory: payload.npcMemory, sentiment: bump },
            })
          }
        }
      }

      // تاریخچه
      await tx.historyEntry.create({
        data: {
          playerId: p.id,
          icon: opp.icon,
          text: `فرصتِ «${opp.title}» را گرفتی (${opp.sourceLabel})`,
          category: "event",
          day: p.day,
        },
      })

      // نوتیفیکیشن
      await tx.notification.create({
        data: {
          playerId: p.id,
          icon: opp.icon,
          title: "فرصت گرفته شد",
          body:
            money > 0
              ? `«${opp.title}» درآمد داشت: ${money} سکه. بقیه‌اش میان و می‌روند.`
              : `«${opp.title}» پولی نداشت. ولی چیزی شد که بود.`,
          kind: "reward",
        },
      })

      // فیید جهانی — گاهی
      if (chance(0.4, rng)) {
        await tx.worldFeed.create({
          data: {
            worldId: "world",
            icon: opp.icon,
            text: `${p.name} فرصتی را از چنگِ شهر بیرون کشید. کسی نپرسید کدام فرصت.`,
          },
        })
      }

      // علامت‌گذاری
      await tx.opportunity.update({ where: { id: opp.id }, data: { claimedAt: new Date() } })
    })
  } catch (e) {
    if (e instanceof Error && e.message === "CLAIMED") return { error: "این فرصت را گرفته‌ای. شهر تکراری نیست." }
    if (e instanceof Error && e.message === "EXPIRED") return { error: "این فرصت دیگر نیست. شهر منتظر نمی‌ماند." }
    throw e
  }

  // ─── پیام‌ها بر اساس نتیجه ───
  let message: string
  let flavor: string
  if (riskyMiss) {
    message = "هیچ. دستت خالی برگشت."
    flavor = "جعبه خالی بود، حرف‌ها نیمه‌کاره ماند و یک درس شبیهِ سکه توی جیبت نشست."
  } else if (opp.claimStyle === "wild") {
    message = "چیزی شد که در هیچ برنامه‌ای نبود."
    flavor =
      grantedItems.length > 0
        ? `دستت وقتی برگشت، ${grantedItems.map((i) => `${i.emoji} ${i.name}`).join(" و ")} داشت. خودت هم نمی‌دانی از کجا.`
        : "شهر یه لحظه ساکت شد، بعد به کارِ خودش برگشت. تو هم."
  } else if (opp.claimStyle === "risky") {
    message = `قمار درآمد. ${money} سکه مالِ تو شد.`
    flavor = "این‌بار شهر با تو بود. دفعه‌ی بعد هم با تو باشد، لازم نیست."
  } else {
    message = `کارِ تمیز بود. ${money > 0 ? `${money} سکه ` : ""}دستی پر برگشت.`
    flavor = `${opp.sourceLabel} جوابش را داد. بی‌سروصدا. مثلِ همه‌ی چیزهای مطمئن.`
  }

  return {
    ok: {
      message,
      flavor,
      deltas,
      extra: { grantedItems, opportunityKey: opp.key },
    },
  }
}
