// FEMBOY WAR — V5: تیکِ جهانِ گروه‌ها — ریتمِ روزانه، رویدادهای خودجوش، بستن‌ها، تولدِ جهان.
// ربات هر ~۴۵ ثانیه صدا می‌زند؛ موتور تصمیم می‌گیرد چه چیزی بگوید و چه چیزی را برای بعد نگه دارد.

import { db } from "@/lib/db"
import type { GroupWorld } from "@prisma/client"
import { mulberry32, seedFrom, chance, randInt, clamp, weightedPick } from "../rng"
import { tehranHour, tehranDayKey, weekNumber, cultureOf, bumpCulture, computeCultureTag, parseJson, activeMembers, pushOutbox } from "./domain"
import { expireOpenEvents, spawnGroupEvent } from "./events"
import { pacingOf } from "./pacing"
import { tickGames, startGame } from "./games"
import { closeVotes, openElection, paySalaries, collectProjectIncome, openCityPoll } from "./politics"
import { tickExpeditions, spawnExpedition } from "./expeditions"
import { pushCityNews, ensureMysteryActive, decayMemories, spawnRumor } from "./world"
import { spawnStyleShow } from "./style"
import { expireRumors } from "./safety"
import { expireStaleChallenges } from "./challenges"
import { getGroupSettings, eventFreqMultiplier } from "./admin"
import { SOCIAL_GAMES, STYLE_SHOW } from "./content"
import { WEATHER_VOICE, CHAOS_VOICE } from "./content/misc"
import { emblem, quote, chip, esc } from "./text"

// ─── ریتمِ روزانه (به وقتِ تهران) ──────────────────────────────────────────────

const RHYTHMS: Record<string, { hours: [number, number]; label: string }> = {
  morning: { hours: [8, 11], label: "☀️" },
  evening: { hours: [19, 23], label: "🌙" },
  night: { hours: [0, 2], label: "💤" },
}

/** متنِ ریتم — از داده‌های واقعیِ همین گروه */

/** کارتِ صبح — سازنده‌ی خالص (تست‌پذیر؛ V11)
 *  V25 «کارت‌های ماندنی»: نشانِ ☀️ در مرکزِ جداکننده + زمزمه‌ی پایانی زیرِ نقل‌قول. */
export function morningCardText(title: string, weather: string, activeCount: number): string {
  // عنوانِ گروه esc (پارَسِ HTML مقدّس است)؛ شمارش تراش می‌خورد
  return `☀️ <b>گزارشِ صبحِ ${esc(title)}</b>\n${emblem("☀️")}\n\n${chip(activeCount)} شهروندِ فعال امروز.\nآسمون: ${weather === "clear" ? "صاف" : "عجیب"}. هنوز چیزی منفجر نشده.\n\n${quote("روزِ خوبی برای خراب‌کاریِ قانونی است.")}`
}

/** کارتِ خواب — سازنده‌ی خالص (تست‌پذیر؛ V11)
 *  V25 «کارت‌های ماندنی»: نشانِ 💤 + خداحافظیِ شب زیرِ نقل‌قول. */
export function nightCardText(active: number, resolvedEvents: number, games: number, wanted: number): string {
  const lines = [
    `👥 ${chip(active)} شهروند امروز این‌جا بودند.`,
    `🎲 ${chip(resolvedEvents)} اتفاق مختومه.`,
    `🎯 ${chip(games)} بازی تمام‌شده.`,
    `🚨 ${chip(wanted)} نفر زیرِ نظر.`,
    "هیچ‌کس چیزی یاد نگرفت.",
  ]
  return `💤 <b>گزارشِ خوابِ شهر</b>\n${emblem("💤")}\n\n${lines.join("\n")}\n\n${quote("فردا شاید بدتر باشد.")}`
}

async function rhythmCard(group: GroupWorld, key: string): Promise<void> {
  const members = await activeMembers(group.id, 24)
  const day = tehranDayKey()
  if (key === "morning") {
    await pushOutbox(group, {
      kind: "rhythm",
      text: morningCardText(group.title, group.weather, members.length),
      priority: 4,
    })
  } else if (key === "evening") {
    await pushCityNews(group)
  } else if (key === "night") {
    const since = new Date(Date.now() - 86400000)
    // resolved و expired هر دو «مختومه»اند (V13 موج ۱: سرآمدگیِ وقت دیگر resolved ثبت نمی‌شود
    // ولی کارتِ خواب همان شمارشِ قبل را می‌بیند)
    const resolvedEvents = await db.groupEvent.count({ where: { groupId: group.id, status: { in: ["resolved", "expired"] }, resolvedAt: { gte: since } } })
    const games = await db.gameSession.count({ where: { groupId: group.id, status: "done", resolvedAt: { gte: since } } })
    const wanted = await db.player.count({
      where: { crime: { gt: 30 }, groupMemberships: { some: { groupId: group.id } } },
    })
    await pushOutbox(group, {
      kind: "rhythm",
      text: nightCardText(members.length, resolvedEvents, games, wanted),
      priority: 4,
    })
  }
  await db.groupWorld.update({ where: { id: group.id }, data: { lastRhythmKey: `${key}:${day}`, lastRhythmAt: new Date() } })
}

// ─── تیکِ تک‌گروه ──────────────────────────────────────────────────────────────

// ترتیبِ فازها (موجِ ۲ — مستند):
//   ۰) شهرِ بدونِ ربات؟ · ۰.۵) شهرِ بسته (enabled=false؛ Part 9)؟ · ۱) فعالیّت
//   ۲) بستن‌ها: رویدادهایِ سرآمده → دعوت‌های دوئلِ سرآمده (موجِ ۲) → بازی‌ها → رأی‌ها
//   ۲.۵) کاروان‌ها (V27): گذارِ فازِ سهم‌گیری→عمل، حل/لغوِ سرآمده
//   ۳) ریتم · ۴) حقوق/درآمد · ۵) انتخابات · ۵.۵) استایل‌شو
//   ۵.۷) همه‌پرسیِ خودجوش (V27 — هر ~۳ روز) · ۶) رویدادِ خودجوش
//   (ضریبِ eventFreq) · ۶.۵) کاروانِ خودجوش (V27) · ۷) بازیِ خودجوش · ۸) شایعه
//   ۹) معما · ۱۰) زوال+انقضای شایعه · ۱۱) هواشناسی · ۱۲) فرهنگ.
export async function tickGroup(group: GroupWorld, now = new Date()): Promise<void> {
  // ۰) شهرِ بدونِ ربات — تحویل دائماً رد شده (ربات حذف/بیرون شده).
  // شهر فقط نفس می‌کشد و حرف نمی‌زند تا ربات با یک فرمان/پیام/کال‌بک برگردد
  // (ensureGroup پرچم botMissingAt را برمی‌دارد).
  if (cultureOf(group).botMissingAt) {
    await db.groupWorld.update({ where: { id: group.id }, data: { lastTickAt: now } })
    return
  }

  // ۰.۵) شهرِ بسته (Part 9 — موجِ ۲) — تیکِ کامل رد می‌شود: تولیدِ تازه متوقف؛
  // زهکشیِ outbox سراسری است و فقط ردیف‌هایِ پیشین را می‌رساند. بازگشت با gs:toggle.
  if (!getGroupSettings(group).enabled) {
    await db.groupWorld.update({ where: { id: group.id }, data: { lastTickAt: now } })
    return
  }

  // ۱) جمع‌بندیِ روز: آیا گروه فعاله؟ (فعالیت در ۴۸ ساعت)
  const members = await activeMembers(group.id, 48)
  const isActive = members.length >= 1
  const hour = tehranHour(now)
  const day = tehranDayKey()

  // ۲) بستنِ رویدادها/بازی‌ها/رأی‌ها
  await expireOpenEvents(group, now)
  // موجِ ۲ — دعوت‌های دوئلِ سرآمده، بلافاصله بعد از رویدادها (فازِ ۲؛ ترتیبِ فازها در سردرِ فایل)
  await expireStaleChallenges(db, group.id, now)
  await tickGames(group, now)
  await closeVotes(group, now)
  // ۲.۵) کاروان‌ها (V27) — گذارِ فاز و حلِ سرآمده؛ بعد از رأی‌ها تا کارتِ نتیجه
  // در همان دورِ زهکشی هم راه بیفتد (اولویت ۷/۸ بالاتر از ریتم)
  await tickExpeditions(group, now)

  if (!isActive) {
    // شهرِ خفته فقط نفس می‌کشد — بدون پیام
    await db.groupWorld.update({ where: { id: group.id }, data: { lastTickAt: now } })
    return
  }

  // ۳) ریتمِ روزانه
  for (const [key, r] of Object.entries(RHYTHMS)) {
    if (hour >= r.hours[0] && hour < r.hours[1] && group.lastRhythmKey !== `${key}:${day}`) {
      await rhythmCard(group, key)
      break
    }
  }

  // ۴) حقوق‌ها و درآمدِ پروژه‌ها
  await paySalaries(group, weekNumber(now))
  await collectProjectIncome(group, day)

  // ۵) انتخاباتِ خودکار — هر ۷ روز، در ساعتِ ۲۰
  const c = cultureOf(group)
  const lastElection = typeof c.lastElectionDay === "string" ? c.lastElectionDay : ""
  if (hour === 20 && lastElection !== day && members.length >= 3) {
    const daysSince = daysBetween(lastElection, day)
    if (!lastElection || daysSince >= 7) {
      await openElection(group, "mayor")
      await bumpCulture(db, group.id, { lastElectionDay: day })
    }
  }

  // ۵.۵) نمایشِ استایل — هر ۳ شب، عصرها: فمبوی‌هایِ روح‌بسته‌ی شهر روی صحنه می‌روند.
  // اولین رویدادِ گروهی که بیلدِ واقعیِ کاراکتر (کلاس/فرگشت/تسلط/کیهانات) را می‌خواند؛
  // روز فقط بعد ازِ روشن‌شدنِ موفقِ صحنه ثبت می‌شود — شهرِ پرمشغله بعداً دوباره تلاش می‌کند
  const lastShowDay = typeof c.lastStyleShowDay === "string" ? c.lastStyleShowDay : ""
  if (hour >= 19 && hour < 23 && members.length >= 2 && lastShowDay !== day) {
    if (!lastShowDay || daysBetween(lastShowDay, day) >= STYLE_SHOW.everyDays) {
      const show = await spawnStyleShow(group)
      if (show) await bumpCulture(db, group.id, { lastStyleShowDay: day })
    }
  }

  // ۵.۷) همه‌پرسیِ خودجوش (V27) — هر ~۳ روز، بعدازظهر؛ فقط وقتی رأیِ بازیتی باز
  // نیست (openCityPoll خودش هم چک می‌کند — کمربند+حمّال). شهردار هم هر وقت
  // بخواهد می‌تواند فراخوان کند (gm:poll — قدرتِ واقعیِ نقش).
  const lastPollDay = typeof c.lastPollDay === "string" ? c.lastPollDay : ""
  if (hour >= 12 && hour < 22 && members.length >= 3 && lastPollDay !== day && (!lastPollDay || daysBetween(lastPollDay, day) >= 3)) {
    const openVote = await db.groupVote.findFirst({ where: { groupId: group.id, status: "open" } })
    if (!openVote) {
      await openCityPoll(group)
    }
  }

  // ۶) رویدادِ خودجوش — V18: ریتمِ هوشمند. دروازه در خودِ spawnGroupEvent نشسته
  // (۲ ساعت + ۱۰۰ پیام؛ یا ۶ ساعت + ۳۰ پیام در شهرِ آرام) — شانسِ این‌جا فقط
  // جیترِ شخصیتِ شهر است: آشوبِ بالا زودتر از دروازه‌ی بازشده رد می‌شود، ولی هیچ
  // شهری ازِ ۲ ماجرا در ۲ ساعت بیشتر نمی‌گیرد (نباید روی اعصاب شود).
  const chaosBoost = 1 + (group.chaos / 100) * 1.2
  const roleBoost = members.some((m) => m.role === "chaos_minister") ? 1.3 : 1
  // موجِ ۲ — ضریبِ رویّه‌ی ادمین (Part 9): off=0 · rare=0.4× · normal=1×.
  // فقط همین فاز؛ استایل‌شو (۵.۵) و بازیِ خودجوش (۷) از تنظیمِ ادمین تبعیت نمی‌کنند.
  const eventChance = Math.min(0.5, 0.12 * chaosBoost * roleBoost) * eventFreqMultiplier(getGroupSettings(group))
  const quietHours = hour >= 1 && hour < 7
  const pacing = pacingOf(group, now)
  if (pacing.gateOpen && !quietHours && chance(eventChance, mulberry32(seedFrom("amb", group.id, Math.floor(now.getTime() / 60000))))) {
    await spawnGroupEvent(group, { priority: 6 })
  }

  // ۶.۵) کاروانِ خودجوش (V27) — مأموریتِ تعاونی؛ کول‌داون و «فقط یکی باز» در
  // خودِ spawnExpedition پاسداری می‌شود. با رویداد موازی می‌تواند باشد (فعالیتِ
  // جنسِ متفاوت) ولی با رویدادِ همان‌لحظه نمی‌آید — ۳۰ دقیقه فاصله از آخرین ماجرا
  // تا چت دو کارتِ هم‌زمان نخورد.
  if (!quietHours && hour >= 9 && hour < 23 && members.length >= 3 && now.getTime() - group.lastEventAt.getTime() >= 30 * 60000) {
    if (chance(0.045, mulberry32(seedFrom("gx", group.id, Math.floor(now.getTime() / 60000))))) {
      await spawnExpedition(group, { priority: 6 })
    }
  }

  // ۷) بازیِ خودجوش — اگر کسی «بازی» گفته باشد یا شانسِ پایین
  const openGame = await db.gameSession.findFirst({ where: { groupId: group.id, status: "open" } })
  const openEvent = await db.groupEvent.findFirst({ where: { groupId: group.id, status: "open" } })
  if (!openGame && !openEvent && members.length >= 3 && !quietHours && hour >= 10 && hour < 24) {
    if (chance(0.06, mulberry32(seedFrom("game", group.id, Math.floor(now.getTime() / 60000))))) {
      const rng = mulberry32(seedFrom("gpick", group.id, now.getTime()))
      const candidates = SOCIAL_GAMES.map((g) => ({ key: g.key, weight: g.weight }))
      const pick = weightedPick(candidates, rng)
      if (pick) await startGame(group, pick.key)
    }
  }

  // ۸) شایعه‌ی خودجوش
  if (!quietHours && chance(0.04, mulberry32(seedFrom("rum", group.id, Math.floor(now.getTime() / 60000))))) {
    await spawnRumor(group)
  }

  // ۹) معما — اگر هیچ‌معمایی فعال نیست
  await ensureMysteryActive(group)

  // ۱۰) زوالِ حافظه + انقضای شایعه‌ها (V13 موج ۱: فازِ تازه‌ی expireRumors کنارِ decayMemories —
  //     شایعه‌ی مُدها دیگر قابلِ تحقیق/پخش نیست؛ ردیف‌ها GCِ هفتگیِ world.ts می‌برد)
  await decayMemories(group)
  await expireRumors(db, group.id, now)

  // ۱۱) هواشناسی/مود — رانِ آرام + V23: وقتی آسمون عوض می‌شود شهر یک‌بار می‌گوید
  const rng = mulberry32(seedFrom("wx", group.id, day))
  if (chance(0.3, rng)) {
    const roll = rollWeather(group, rng)
    if (roll) {
      await db.groupWorld.update({ where: { id: group.id }, data: { weather: roll.weather, socialTemp: roll.socialTemp, mood: roll.mood } })
      // V23 — صدای جهان: تغییرِ هوای زنده، بی‌کارت — فقط یک خط روی outbox
      // (ساعاتِ بیداری؛ شب که شهر می‌خوابد آسمون هم بی‌سروصدا عوض می‌شود)
      const hour = tehranHour(now)
      if (roll.weather !== group.weather && hour >= 8 && hour < 23) {
        const pool = WEATHER_VOICE[roll.weather] ?? WEATHER_VOICE.clear!
        await pushOutbox(group, { kind: "system", text: pool[Math.floor(rng() * pool.length)]!, priority: 3 })
      }
    }
  }

  // ۱۲) بازمحاسبه‌ی فرهنگ
  const fresh = await db.groupWorld.findUnique({ where: { id: group.id } })
  if (fresh) {
    const tag = computeCultureTag(cultureOf(fresh))
    if (tag !== fresh.cultureTag) {
      await db.groupWorld.update({ where: { id: fresh.id }, data: { cultureTag: tag } })
    }
    // clamp شاخص‌ها
    await db.groupWorld.update({
      where: { id: fresh.id },
      data: {
        chaos: clamp(fresh.chaos, 0, 100),
        socialTemp: clamp(fresh.socialTemp, 0, 100),
        crimeLevel: clamp(fresh.crimeLevel, 0, 100),
        reputation: clamp(fresh.reputation, 0, 100),
      },
    })
    // V23 — صدای آشوب: شاخص ≥ ۷۰ → شهر یک‌بار در روز یادآوری می‌کند
    // (بی‌سروصدا رها نمی‌شود؛ اما اسپم هم نیست — سقفِ روزانه با کلیدِ culture)
    if (fresh.chaos >= 70 && cultureOf(fresh).chaosVoiceDay !== day) {
      await pushOutbox(fresh, { kind: "system", text: CHAOS_VOICE[Math.floor(rng() * CHAOS_VOICE.length)]!, priority: 4 })
      await bumpCulture(db, fresh.id, { chaosVoiceDay: day })
    }
  }

  await db.groupWorld.update({ where: { id: group.id }, data: { lastTickAt: now } })
}

/** V23 — رانِ هواشناسی به‌عنوانِ تابعِ خالص (تست‌پذیر): خودِ رول را با rngِ
 *  تیک می‌زند (دروازه‌ی ۳۰٪ در tickGroup می‌مانَد و قبلش یک بار rng مصرف
 *  می‌کند — همان ترتیبِ مصرفِ بلوکِ قدیمی، رفتارِ زنده تغییر نکرد). */
export function rollWeather(group: GroupWorld, rng: () => number): { weather: string; socialTemp: number; mood: string } | null {
  const weathers = ["clear", "clear", "rain", "fog", "storm", "red_moon"]
  const weather = weathers[Math.floor(rng() * weathers.length)]!
  const socialTemp = clamp(group.socialTemp + randInt(-4, 4, rng), 0, 100)
  const mood = socialTemp >= 70 ? "tense" : socialTemp <= 30 ? "calm" : group.mood
  return { weather, socialTemp, mood }
}

function daysBetween(dayA: string, dayB: string): number {
  if (!dayA) return 99
  try {
    const a = new Date(dayA)
    const b = new Date(dayB)
    return Math.abs(Math.floor((b.getTime() - a.getTime()) / 86400000))
  } catch {
    return 99
  }
}

// ─── تیکِ همه‌ی گروه‌ها + جمع‌آوریِ پیام‌ها ────────────────────────────────────

export interface DrainedMessage {
  outboxId: string
  chatId: string
  text: string
  kind: string
  buttons: { label: string; style: string | null; cb?: string; url?: string }[]
  editMessageId?: string | null
}

/** پنجره‌ی ردِ claimِ سرآمده — بعدش پیام دوباره قابلِ تصاحب است (at-least-once) */
const CLAIM_STALE_MS = 5 * 60000

export async function tickAllGroups(maxPerGroup = 2, now = new Date()): Promise<{ messages: DrainedMessage[]; groupsTicked: number }> {
  const groups = await db.groupWorld.findMany()
  let ticked = 0
  for (const g of groups) {
    // هر گروه حداکثر هر ۴۰ ثانیه تیک می‌خورد (به وقتِ همان now — شبیه‌سازی هم درست کار کند)
    if (now.getTime() - g.lastTickAt.getTime() < 40000) continue
    await tickGroup(g, now)
    ticked++
  }

  // پیام‌های آماده — اولویت‌دار، حداکثر N تا در هر گروه؛ فقط ردیف‌های قابلِ تصاحب
  // (claimِ تازه‌ی درینِ دیگر یا تحویل‌شده قبلی نه — پنجره‌ی ضدِ دوبله)
  const ready = await db.groupOutbox.findMany({
    where: {
      deliveredAt: null,
      deliverAfter: { lte: now },
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - CLAIM_STALE_MS) } }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 40,
  })
  const byGroup = new Map<string, typeof ready>()
  for (const m of ready) {
    const list = byGroup.get(m.groupId) ?? []
    if (list.length < maxPerGroup) {
      list.push(m)
      byGroup.set(m.groupId, list)
    }
  }

  const messages: DrainedMessage[] = []
  const sendIds: string[] = []
  for (const list of byGroup.values()) {
    for (const m of list) {
      if (m.kind === "spawn_event") {
        // اکشنِ زمان‌بندی‌شده: تولدِ رویدادِ پیگیری — بدون ارسالِ متن.
        // V18 — پیگیری هم ریتمِ هوشمند را رعایت می‌کند: شهرِ خسته پیگیری را به
        // بعد می‌گذارد (defer: +۳۰ دقیقه) نه اینکه پشتِ سرِ هم ماجرا باز کند؛
        // زنجیره‌ها زنده می‌مانند تا شهر نفس بکشد. سقفِ صبر: ۱۴ روز.
        const g = await db.groupWorld.findUnique({ where: { id: m.groupId } })
        const tooOld = now.getTime() - m.createdAt.getTime() > 14 * 86400000
        const fuPacing = g ? pacingOf(g, now) : null
        if (g && !tooOld && fuPacing && !fuPacing.gateOpen) {
          await db.groupOutbox.updateMany({
            where: { id: m.id, deliveredAt: null },
            data: { deliverAfter: new Date(now.getTime() + 30 * 60000) },
          })
          continue
        }
        const spawned = await db.groupOutbox.updateMany({ where: { id: m.id, deliveredAt: null }, data: { deliveredAt: now } })
        if (spawned.count === 0) continue
        if (g && !tooOld) {
          const roll = mulberry32(seedFrom("fu", m.id))()
          if (roll < 0.75) await spawnGroupEvent(g, { templateId: m.text, priority: 6 })
        }
        continue
      }
      sendIds.push(m.id)
    }
  }

  // فازِ claim: پیام‌ها «تصدیق» می‌شوند نه «تحویل‌شده» — سقوطِ ربات یعنی برگشتِ خودکار به صف
  // (claimِ سرآمده‌ی بیش از ۵ دقیقه دوباره قابلِ تصاحب است)
  if (sendIds.length > 0) {
    const claimAt = new Date()
    await db.groupOutbox.updateMany({
      where: {
        id: { in: sendIds },
        deliveredAt: null,
        OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(claimAt.getTime() - CLAIM_STALE_MS) } }],
      },
      data: { claimedAt: claimAt },
    })
    // فقط ردیف‌هایی که مُهرِ claimِ همین لحظه را دارند — claimِ درینِ دیگر را نمی‌دزدیم
    const claimed = sendIds.length
      ? await db.groupOutbox.findMany({ where: { id: { in: sendIds }, claimedAt: claimAt } })
      : []
    const claimedIds = new Set(claimed.map((c) => c.id))
    for (const id of sendIds) {
      if (!claimedIds.has(id)) continue
      const m = ready.find((r) => r.id === id)
      if (!m) continue
      messages.push({
        outboxId: m.id,
        chatId: m.targetChatId,
        text: m.text,
        kind: m.kind,
        buttons: parseJson<{ label: string; style: string | null; cb?: string; url?: string }[]>(m.buttonsJson, []),
        editMessageId: m.editMessageId,
      })
    }
  }
  return { messages, groupsTicked: ticked }
}

/** ربات بعد از تحویل، messageId را گزارش می‌دهد تا ویرایش‌های بعدی ممکن شود.
 *  deliveredAt قطعی می‌شود و claim پاک — پیام دیگر هرگز دوباره ارسال نمی‌شود. */
export async function markDelivered(outboxId: string, messageId: string | number): Promise<void> {
  const row = await db.groupOutbox.findUnique({ where: { id: outboxId } })
  if (!row) return
  await db.groupOutbox.update({
    where: { id: outboxId },
    data: { deliveredAt: row.deliveredAt ?? new Date(), claimedAt: null, messageId: String(messageId) },
  })
  // اتصال به مرجع برای ویرایش‌های آینده (بازی/رأی/رویداد/دعوتِ دوئل — موجِ ۲)
  if (row.refType === "game" && row.refId) {
    await db.gameSession.updateMany({ where: { id: row.refId }, data: { messageId: String(messageId) } })
  } else if (row.refType === "vote" && row.refId) {
    await db.groupVote.updateMany({ where: { id: row.refId }, data: { messageId: String(messageId) } })
  } else if (row.refType === "event" && row.refId) {
    await db.groupEvent.updateMany({ where: { id: row.refId }, data: { messageId: String(messageId) } })
  } else if (row.refType === "challenge" && row.refId) {
    // messageId دعوت‌نامه — حل/رد/انقضای بعدی کارتِ همان پیام را ویرایش می‌کند
    await db.groupChallenge.updateMany({ where: { id: row.refId }, data: { messageId: String(messageId) } })
  } else if (row.refType === "expedition" && row.refId) {
    // V27 — messageId کاروان: گذارِ فاز و کارتِ نتیجه همان پیام را ویرایش می‌کنند
    await db.groupExpedition.updateMany({ where: { id: row.refId }, data: { messageId: String(messageId) } })
  }
}

// ─── گزارشِ بی‌دسترسیِ چت — از خودِ ربات ──────────────────────────────────

/** تحویل به یک چتِ گروهی دائماً رد می‌شود (ربات حذف شده/بیرون افتاده).
 *  شهر تا بازگشتِ ربات خاموش می‌ماند: پرچمِ botMissingAt در فرهنگ + پاک‌سازیِ
 *  صفِ معلق تا انبار نشود. برگشتِ ربات = نخستین فرمان/پیام/کال‌بک از همان
 *  چت — ensureGroup پرچم را برمی‌دارد و شهر دوباره زنده می‌شود. */
export async function markUnreachable(chatId: string): Promise<boolean> {
  const group = await db.groupWorld.findUnique({ where: { chatId } })
  if (!group) return false
  if (!cultureOf(group).botMissingAt) {
    await bumpCulture(db, group.id, { botMissingAt: new Date().toISOString() })
  }
  await db.groupOutbox.deleteMany({ where: { groupId: group.id, deliveredAt: null } })
  return true
}
