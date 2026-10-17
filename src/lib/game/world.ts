import { db } from "@/lib/db"
import type { Player, WorldState, Pet } from "@prisma/client"
import { GLOBAL_EVENTS, getGlobalEvent } from "./content"
import { driftMarketPrices, restockNpcShops } from "./economy"
import { mulberry32, seedFrom, weightedPick, clamp, chance } from "./rng"
import { WEATHER_LABEL } from "./helpers"

const TICK_MIN = 5 // حداقل فاصله‌ی دو تیک
const STEP_MIN = 30 // هر گام شبیه‌سازی 30 دقیقه‌ی واقعی است
const MAX_STEPS = 96 // حداکثر 2 روز در هر تیک
const WORLD_DAY_HOURS = 6 // هر «روزِ» جهان 6 ساعت واقعی
const RETENTION_INTERVAL_MS = 6 * 3600000 // جاروی حافظه — هر 6 ساعت، ارزان و بی‌اثرِ تکراری

// آخرین باری که این فرایند جارو زد (ایدمپوتنت — چند فرایند هم مشکلی ندارد)
let lastRetentionSweep = 0

/** جاروی حافظه: تصمیم‌های رباتِ قدیمی حذف؛ فییدِ جهان سقفِ 150 خط دارد */
async function retentionSweep(): Promise<void> {
  await db.botDecision.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 14 * 86400000) } } })
  // سقفِ فیید: قدیمی‌تر از خطِ 150م حذف می‌شود
  const cutoff = await db.worldFeed.findFirst({ orderBy: { createdAt: "desc" }, skip: 149, select: { createdAt: true } })
  if (cutoff) await db.worldFeed.deleteMany({ where: { createdAt: { lt: cutoff.createdAt } } })
}

// ─── World singleton ──────────────────────────────────────────────────────────

export async function getWorld(): Promise<WorldState> {
  let world = await db.worldState.findUnique({ where: { id: "world" } })
  if (!world) {
    world = await db.worldState.create({ data: { id: "world" } })
    await restockNpcShops(db)
  }
  // seed قیمت‌ها اگر هنوز وجود ندارند (idempotent)
  if ((await db.marketPrice.count()) === 0) {
    const { ensureMarketPrices } = await import("./economy")
    await ensureMarketPrices(db)
  }
  return world
}

// ─── Tick ─────────────────────────────────────────────────────────────────────

/**
 * شبیه‌سازی تنبل جهان: هر بار که کسی state می‌گیرد، جهان به روز می‌شود.
 * worldTick جهانِ مشترک؛ playerTick زندگیِ خود بازیکن (حیوان، اجاره، بدهی).
 */
export async function worldTick(): Promise<WorldState> {
  const now = new Date()
  const world = await getWorld()
  const elapsedMin = (now.getTime() - world.lastTickAt.getTime()) / 60000
  if (elapsedMin < TICK_MIN) return world

  const steps = Math.min(MAX_STEPS, Math.max(1, Math.floor(elapsedMin / STEP_MIN)))
  const rng = mulberry32(seedFrom("world", world.id, world.dayCount, Math.floor(now.getTime() / 60000)))

  let { weather, mood, chaosLevel, economyIndex, dayCount, activeGlobalEvent, globalEventEndsAt } = world

  const feedLines: { icon: string; text: string }[] = []

  for (let i = 0; i < steps; i++) {
    // پایان رویداد جهانی
    if (activeGlobalEvent && globalEventEndsAt && globalEventEndsAt.getTime() < now.getTime()) {
      const def = getGlobalEvent(activeGlobalEvent)
      if (def) {
        feedLines.push({ icon: "🕊", text: `${def.emoji} ${def.name} تمام شد. شهر نفس کشید.` })
      }
      activeGlobalEvent = null
      globalEventEndsAt = null
      mood = "calm"
      economyIndex = Math.round((economyIndex + 100) / 2)
      if (weather === "red_moon") weather = "clear"
    }

    // شروع رویداد جهانی جدید (شانس کم در هر گام)
    if (!activeGlobalEvent && chance(0.045 * (1 + chaosLevel / 200), rng)) {
      const eligible = GLOBAL_EVENTS.filter((g) => (g.minWorldDay ?? 1) <= dayCount)
      const pick = weightedPick(eligible, rng)
      if (pick) {
        activeGlobalEvent = pick.key
        globalEventEndsAt = new Date(now.getTime() + pick.durationMinutes * 60000)
        if (pick.effects.weather) weather = pick.effects.weather
        if (pick.effects.mood) mood = pick.effects.mood
        if (pick.effects.chaos) chaosLevel = clamp(chaosLevel + pick.effects.chaos, 0, 100)
        if (pick.effects.economyIndex) economyIndex = clamp(economyIndex + pick.effects.economyIndex, 50, 200)
        feedLines.push({ icon: pick.emoji, text: pick.feedText })
      }
    }

    // آب‌وهوای عادی وقتی رویداد خاصی هوا را نگه نداشته
    if (!activeGlobalEvent || !["red_moon", "storm"].includes(weather)) {
      if (chance(0.12, rng)) {
        weather = weightedPick(
          [
            { key: "clear", weight: 60 },
            { key: "rain", weight: 20 },
            { key: "fog", weight: 12 },
            { key: "storm", weight: 8 },
          ],
          rng,
        )!.key
      }
    }

    // رانش آشوب و اقتصاد
    chaosLevel = clamp(chaosLevel + Math.round((rng() - 0.45) * 3), 0, 100)
    economyIndex = clamp(Math.round(economyIndex + (100 - economyIndex) * 0.08 + (rng() - 0.5) * 6), 60, 190)

    // پیش‌روی «روزِ» جهان
    // dayCount هر WORLD_DAY_HOURS ساعت جلو می‌رود — از روی کل زمان سپری‌شده
  }

  // روز جهان بر اساس زمان واقعی سپری‌شده از شروع
  const totalElapsedHours = (now.getTime() - new Date(world.createdAt).getTime()) / 3600000
  const computedDay = Math.max(1, Math.floor(totalElapsedHours / WORLD_DAY_HOURS) + 1)
  let dayChanged = false
  if (computedDay > dayCount) {
    dayCount = computedDay
    dayChanged = true
    feedLines.push({ icon: "📅", text: `روز ${dayCount} از زندگی این شهر آغاز شد.` })
  }

  // گاردِ هم‌زمانی: تیکِ رقیب با مُهرِ lastTickAtِ خوانده‌شده جا می‌ماند —
  // رانش دو بار اعمال نمی‌شود
  const guarded = await db.worldState.updateMany({
    where: { id: "world", lastTickAt: world.lastTickAt },
    data: { weather, mood, chaosLevel, economyIndex, dayCount, activeGlobalEvent, globalEventEndsAt, lastTickAt: now },
  })
  if (guarded.count === 0) return world
  const updated = await db.worldState.findUniqueOrThrow({ where: { id: "world" } })

  // رانش بازار و استوک مغازه‌ها
  const priceCount = await db.marketPrice.count()
  if (priceCount === 0) {
    const { ensureMarketPrices } = await import("./economy")
    await ensureMarketPrices(db)
  }
  await driftMarketPrices(db, economyIndex, steps)
  await restockNpcShops(db)

  // آگهی‌های بازیکن که زمانشان گذشته — لغو + برگشتِ جنس در تراکنش
  await expirePlayerListings(now)

  // جاروی حافظه — روزِ تازه یا هر 6 ساعت
  if (dayChanged || now.getTime() - lastRetentionSweep > RETENTION_INTERVAL_MS) {
    lastRetentionSweep = now.getTime()
    await retentionSweep()
  }

  for (const line of feedLines.slice(-6)) {
    await db.worldFeed.create({ data: { worldId: "world", icon: line.icon, text: line.text } })
  }

  return updated
}

/** آگهیِ سرآمده‌ی بازیکن — لغو می‌شود و جنس به کیفش برمی‌گردد (ترد-امن) */
async function expirePlayerListings(now: Date): Promise<void> {
  const expired = await db.marketListing.findMany({
    where: { status: "active", sellerId: { not: null }, expiresAt: { lt: now } },
    take: 20,
  })
  for (const l of expired) {
    await db.$transaction(async (tx) => {
      // فلیپِ شرطی — خریدارِ هم‌زمان/سوئیپِ موازی جا می‌ماند
      const flipped = await tx.marketListing.updateMany({
        where: { id: l.id, status: "active", expiresAt: { lt: now } },
        data: { status: "cancelled" },
      })
      if (flipped.count === 0) return
      const sellerId = l.sellerId!
      await tx.inventoryItem.upsert({
        where: { playerId_itemKey: { playerId: sellerId, itemKey: l.itemKey } },
        update: { quantity: { increment: l.quantity } },
        create: { playerId: sellerId, itemKey: l.itemKey, quantity: l.quantity },
      })
      const seller = await tx.player.findUnique({ where: { id: sellerId }, select: { day: true } })
      if (seller) {
        await tx.historyEntry.create({
          data: { playerId: sellerId, icon: "📦", text: `آگهی‌ات سه‌روزه‌اش تمام شد — جنسش برگشت تو کیف.`, category: "money", day: seller.day },
        })
      }
    })
  }
}

// ─── Player tick (زندگی بازیکن حتی وقتی نیست) ────────────────────────────────

export interface OfflineLine {
  icon: string
  text: string
}

export async function playerTick(player: Player): Promise<{ player: Player; recap: OfflineLine[] | null }> {
  const now = new Date()
  const elapsedMs = now.getTime() - player.lastTickAt.getTime()
  const elapsedMin = elapsedMs / 60000
  if (elapsedMin < TICK_MIN) return { player, recap: null }

  const steps = Math.min(MAX_STEPS, Math.max(1, Math.floor(elapsedMin / STEP_MIN)))
  const rng = mulberry32(seedFrom("player", player.id, Math.floor(now.getTime() / 60000)))
  const recap: OfflineLine[] = []
  const significant = elapsedMin >= 120 // بیشتر از 2 ساعت → خلاصه‌ی «در نبودت»

  const data: Record<string, number> = {
    energy: player.energy,
    health: player.health,
    day: player.day,
    debt: player.debt,
  }

  // اتفاقاتِ بی‌جواب — بدون جایزه منقضی می‌شوند (سوئیپِ سرآمده‌ها)
  const staleEvents = await db.activeEvent.findMany({
    where: { playerId: player.id, status: "active", expiresAt: { lt: now } },
    select: { id: true },
  })
  for (const ev of staleEvents) {
    const flipped = await db.activeEvent.updateMany({ where: { id: ev.id, status: "active" }, data: { status: "expired" } })
    if (flipped.count > 0) {
      await db.historyEntry.create({
        data: { playerId: player.id, icon: "🕰", text: "اتفاقِ بی‌جواب ماند — و رفت. شهر چیزی از او یاد نگرفت.", category: "event", day: data.day },
      })
      if (significant) recap.push({ icon: "🕰", text: "یه اتفاق بی‌جواب ماند و رفت." })
    }
  }

  // تصاحبِ تیک: فلیپِ شرطی روی lastTickAtِ خوانده‌شده — تیکِ موازی جا می‌ماند
  // و حیوان/اجاره/بهره دو بار اعمال نمی‌شود
  const claimed = await db.player.updateMany({
    where: { id: player.id, lastTickAt: player.lastTickAt },
    data: { lastTickAt: now },
  })
  if (claimed.count === 0) return { player, recap: null }

  // بازیابی انرژی و سلامتی
  for (let i = 0; i < steps; i++) {
    data.energy = clamp(data.energy + 1, 0, 100)
    data.health = clamp(data.health + (data.energy > 50 ? 1 : 0), 0, 100)
  }

  // روزِ بازیکن (6 ساعت)
  const playerDay = Math.max(1, Math.floor((now.getTime() - player.createdAt.getTime()) / (WORLD_DAY_HOURS * 3600000)) + 1)
  if (playerDay > player.day) {
    data.day = playerDay
    recap.push({ icon: "📅", text: `به روز ${playerDay} زندگی‌ات رسیدی.` })
  }

  // حیوانات: گرسنگی و فرار
  const pets = await db.pet.findMany({ where: { playerId: player.id } })
  for (const pet of pets) {
    let hunger = pet.hunger - Math.floor(steps * 1.5)
    let mood = pet.mood
    let petFlag = pet.petFlag
    if (hunger < 30 && pet.mood !== "ناراضی") {
      mood = "ناراضی"
      const { PET_MAP } = await import("./content")
      const petEmoji = PET_MAP[pet.speciesKey]?.emoji ?? "🐾"
      if (significant) recap.push({ icon: petEmoji, text: `${pet.name} گرسنه است و نظرش درباره‌ت عوض شده.` })
    }
    if (hunger <= 0) {
      hunger = 0
      if (chance(0.5, rng)) {
        await db.pet.delete({ where: { id: pet.id } })
        await db.historyEntry.create({
          data: {
            playerId: player.id,
            icon: "🐾",
            text: `${pet.name} فرار کرد. جایی که می‌راست، اسمت را یادش نمی‌ماند.`,
            category: "pet",
            day: data.day,
          },
        })
        await db.notification.create({
          data: {
            playerId: player.id,
            icon: "🐾",
            title: "فرار",
            body: `${pet.name} رفت. گرسنگی در این شهر حیوانات را بی‌رحم می‌کند.`,
            kind: "warning",
          },
        })
        recap.push({ icon: "🐾", text: `${pet.name} فرار کرد.` })
        continue
      }
    }
    await db.pet.update({ where: { id: pet.id }, data: { hunger, mood, petFlag } })
  }

  // اجاره‌ی خانه (هر 24 ساعت واقعی) — تراکنش + گاردِ فلیپِ شرطی روی مهلتِ خوانده‌شده:
  // دو تیکِ هم‌زمان فقط یک‌بار اجاره حساب می‌کنند
  if (player.houseKey && now.getTime() > player.houseRentDue.getTime()) {
    const rentResult = await db.$transaction(async (tx) => {
      const fresh = await tx.player.findUnique({ where: { id: player.id } })
      if (!fresh || !fresh.houseKey || now.getTime() <= fresh.houseRentDue.getTime()) return null
      const { getHouse } = await import("./content")
      const house = getHouse(fresh.houseKey)
      if (!house) return null
      const cycles = Math.min(3, Math.floor((now.getTime() - fresh.houseRentDue.getTime()) / (24 * 3600000)) + 1)
      const rent = house.rent * cycles
      let money = fresh.money - rent
      let debt = fresh.debt
      if (money < 0) {
        debt += Math.round(-money * 1.5)
        money = 0
        await tx.notification.create({
          data: {
            playerId: player.id,
            icon: "💼",
            title: "پیام از دایی فرهاد",
            body: `اجاره‌ی خانه‌ات پرداخت نشد. ${rent} سکه به بدهی‌ات اضافه شد. لبخندش را می‌بینی؟ نه؟ ما هم.`,
            kind: "warning",
          },
        })
      }
      const moved = await tx.player.updateMany({
        where: { id: fresh.id, houseRentDue: fresh.houseRentDue },
        data: { money, debt, houseRentDue: new Date(now.getTime() + 24 * 3600000) },
      })
      if (moved.count === 0) return null // تیکِ موازی قبل از ما پرداخت کرد
      await tx.currencyLedger.create({
        data: { playerId: player.id, amount: -rent, balanceAfter: money, source: "house", note: "اجاره" },
      })
      await tx.historyEntry.create({
        data: { playerId: player.id, icon: "🏠", text: `اجاره‌ی خانه پرداخت شد: ${rent} سکه`, category: "house", day: data.day },
      })
      return { rent, money, debt }
    })
    if (rentResult) {
      recap.push({ icon: "🏠", text: `اجاره‌ی خانه‌ات پرداخت شد (${rentResult.rent} سکه).` })
      player = { ...player, money: rentResult.money, debt: rentResult.debt }
      data.debt = rentResult.debt
    }
  }

  // بهره‌ی بدهی (2% در هر گام، سقف مشخص) — از بدهیِ تازه (اجاره حساب شده باشد)
  if (data.debt > 0) {
    const interest = Math.min(data.debt * 0.02 * steps, data.debt * 0.2)
    const newDebt = Math.round(data.debt + interest)
    if (newDebt !== data.debt) {
      data.debt = newDebt
      if (significant)
        recap.push({
          icon: "⛓",
          text: `دایی فرهاد بابت «صبر» ${Math.round(interest)} سکه به بدهی‌ات اضافه کرد.`,
        })
    }
  }

  // روز زنده‌ماندن
  if (data.day >= 8 && player.level >= 1) {
    const has = await db.playerAchievement.findUnique({
      where: { playerId_achievementKey: { playerId: player.id, achievementKey: "survivor" } },
    })
    if (!has) {
      await db.playerAchievement.create({ data: { playerId: player.id, achievementKey: "survivor" } })
      await db.notification.create({
        data: {
          playerId: player.id,
          icon: "🫀",
          title: "دستاورد: زنده‌مانده",
          body: "7 روز در این شهر زندگی کردی. خودت می‌دانی یعنی چه.",
          kind: "reward",
        },
      })
    }
  }

  // تیکِ مالِ ماست — نتیجه نهایی بی‌قید ثبت می‌شود
  const updated = await db.player.update({
    where: { id: player.id },
    data: {
      energy: clamp(Math.round(data.energy), 0, 100),
      health: clamp(Math.round(data.health), 0, 100),
      day: data.day,
      debt: Math.round(data.debt),
      lastTickAt: now,
      lastSeenAt: now,
    },
  })

  return { player: updated, recap: significant ? recap : null }
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export async function getFeed(limit = 12) {
  return db.worldFeed.findMany({ where: { worldId: "world" }, orderBy: { createdAt: "desc" }, take: limit })
}
