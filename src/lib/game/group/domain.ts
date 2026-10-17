// FEMBOY WAR — V5: دامنه‌ی گروه (GroupWorld / عضو / فرهنگ / زمانِ تهران).

import { db } from "@/lib/db"
import type { GroupWorld, GroupMember, Player, Prisma } from "@prisma/client"
import { DISTRICTS } from "../content"
import { seedFrom, mulberry32 } from "../rng"
import { CULTURE_LABELS } from "./content"
import { grantStarterKit, STARTER_DEFAULTS } from "../starter-kit"

export type Tx = Prisma.TransactionClient

// ─── ابزارها ───────────────────────────────────────────────────────────────────

/** رقم‌های فارسی/عربی و جداکننده‌های عربیِ یک رشته → لاتینِ انگلیسی
 *  (V11: آینه‌ی toLatinDigits سمتِ ربات — منبعِ موتور باید خودش انگلیسی بفرستد؛
 *  برچسبِ دکمه‌ها از لاتین‌سازیِ لحظه‌ی ارسالِ ربات رد می‌شوند) */
export function toLatinDigits(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹"
  const ar = "٠١٢٣٤٥٦٧٨٩"
  let out = ""
  for (const ch of s) {
    const f = fa.indexOf(ch)
    const a = ar.indexOf(ch)
    out += f >= 0 ? String(f) : a >= 0 ? String(a) : ch === "٬" ? "," : ch === "٫" ? "." : ch
  }
  return out
}

/** escape متن برای HTML تلگرام + نرمال‌سازی رقم‌ها به انگلیسی (هم‌ارزشِ esc ربات).
 *  هر رشته‌ی پویا (حتی اسمِ بازیکن) قبل از رفتن به کارت‌های HTML از این‌جا رد می‌شود. */
export function esc(s: string): string {
  return toLatinDigits(s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
}

/** ساعت تهران (۰..۲۳) */
export function tehranHour(now = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Tehran" })
  return Number(fmt.format(now)) % 24
}

/** روزِ هفته‌ی تهران: ۰=یکشنبه … ۶=شنبه */
export function tehranWeekday(now = new Date()): number {
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Tehran" })
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[fmt.format(now)] ?? 0
}

export function minutesAgo(d: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000))
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

// ─── قفلِ بخشی (V15-3 — مأموریت §3B: هم‌زمانیِ پنل‌هایِ اشتراکی) ─────────────────
// حالتِ رأی/کمکِ پروژه/بازیِ گروهی فیلدهایِ JSONِ «بخوان-بگردان-بنویس» اند. کاوشِ
// تجربیِ V15-3 رویِ رأی‌گیریِ واقعی نشان داد: ۶ فشارِ هم‌زمانِ gv: → SQLite برای
// ۳-۵ تراکنشِ هم‌زمان خطای busy (500) می‌دهد و رأی‌ها گم می‌شوند. موتور یک
// فرایند است؛ این قفلِ in-process، نوشتنِ «همان ردیفِ مرجع» را سریال می‌کند —
// کوچک‌ترین اصلاحِ محکم، بدونِ تغییرِ اسکیما. globalThis-guard تا نسل‌هایِ
// hot-reload رویِ همان صف بمانند.

const gLocks = globalThis as typeof globalThis & {
  __femwarSectionLocks?: Map<string, Promise<unknown>>
}
const sectionLocks: Map<string, Promise<unknown>> = gLocks.__femwarSectionLocks ?? new Map()
gLocks.__femwarSectionLocks = sectionLocks

/** سریال‌سازیِ نوشتنِ همان کلید — زنجیره‌ی وعده‌ها؛ شکستِ پیشینی صف را نمی‌شکند.
 *  کلید = ردیفِ مرجع (مثلاً «vote:{id}» / «project:{id}» / «game:{id}») — ردیف‌های
 *  مختلف هم‌زمان می‌مانند. خواندنِ نهایی باید داخلِ fn باشد تا بعد از نوبتِ
 *  پیشین دیده شود. */
export async function withSectionLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = sectionLocks.get(key) ?? Promise.resolve()
  const run = prev.then(
    () => fn(),
    () => fn(),
  )
  const tail = run.then(
    () => undefined,
    () => undefined,
  )
  sectionLocks.set(key, tail)
  void tail.then(() => {
    if (sectionLocks.get(key) === tail) sectionLocks.delete(key)
  })
  return run
}

// ─── شمارنده‌های فرهنگ ─────────────────────────────────────────────────────────

export interface CultureCounters {
  cooperation?: number
  crime?: number
  chaosEvents?: number
  gamesPlayed?: number
  competitions?: number
  memes?: number
  trades?: number
  eventsResolved?: number
  votes?: number
  festival?: number
  mystery?: number
  socialMsgs?: number
  unsolicitedToday?: number
  unsolicitedDay?: string
  lastSalaryWeek?: number
  lastElectionDay?: string
  lastStyleShowDay?: string // روزِ آخرینِ نمایشِ استایل (تدوینِ ۳روزه)
  styleShows?: number // شمارِ نمایش‌های برگزارشده
  treasuryDay?: string
  [key: string]: number | string | undefined
}

export function cultureOf(group: GroupWorld): CultureCounters {
  return parseJson<CultureCounters>(group.cultureJson, {})
}

export async function bumpCulture(
  tx: Tx,
  groupId: string,
  patches: Record<string, number | string>,
): Promise<void> {
  const g = await tx.groupWorld.findUnique({ where: { id: groupId } })
  if (!g) return
  const cur = cultureOf(g)
  const next: CultureCounters = { ...cur }
  for (const [k, v] of Object.entries(patches)) {
    if (typeof v === "number" && typeof next[k] === "number") {
      ;(next as Record<string, number>)[k] = ((next[k] as number) ?? 0) + v
    } else if (typeof v === "number") {
      ;(next as Record<string, number>)[k] = v
    } else {
      ;(next as Record<string, string>)[k] = v
    }
  }
  await tx.groupWorld.update({ where: { id: groupId }, data: { cultureJson: JSON.stringify(next) } })
}

/** برچسب امروزِ تهران — برای شمارنده‌های روزانه */
export function tehranDayKey(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Tehran" })
  return fmt.format(now)
}

/** شماره‌ی هفته از epoch — برای حقوق‌ها */
export function weekNumber(now = new Date()): number {
  return Math.floor(now.getTime() / (7 * 86400000))
}

// ─── GroupWorld ────────────────────────────────────────────────────────────────

/** district قطعی از chatId — هر گروه همیشه محله‌ی خودش را دارد */
function districtForChat(chatId: string): string {
  const rng = mulberry32(seedFrom("district", chatId))
  return DISTRICTS[Math.floor(rng() * DISTRICTS.length)]!.key
}

export async function ensureGroup(chatId: string, title?: string): Promise<GroupWorld> {
  const clean = (title ?? "").trim().slice(0, 60)
  const existing = await db.groupWorld.findUnique({ where: { chatId } })
  if (existing) {
    const patch: { title?: string; cultureJson?: string } = {}
    if (clean && clean !== existing.title) patch.title = clean
    // ربات برگشته — فرمان/پیام/کال‌بک از همین چت رسیده؛ پرچمِ «شهرِ بدونِ ربات»
    // برداشته می‌شود تا موتور دوباره برای این شهر پیام تولید کند.
    if (cultureOf(existing).botMissingAt) {
      const rest: Record<string, number | string> = {}
      for (const [k, v] of Object.entries(cultureOf(existing))) {
        if (k !== "botMissingAt" && v !== undefined) rest[k] = v
      }
      patch.cultureJson = JSON.stringify(rest)
    }
    if (patch.title !== undefined || patch.cultureJson !== undefined) {
      return db.groupWorld.update({ where: { id: existing.id }, data: patch })
    }
    return existing
  }
  const district = districtForChat(chatId)
  return db.groupWorld.create({
    data: {
      chatId,
      title: clean || "شهرِ بی‌نام",
      district,
      lastEventAt: new Date(Date.now() - 3600000), // اجازه‌ی رویداد زودهنگام برای گروهِ تازه
      lastBotMsgAt: new Date(Date.now() - 1800000),
    },
  })
}

export async function ensureGroupTx(tx: Tx, chatId: string, title?: string): Promise<GroupWorld> {
  const clean = (title ?? "").trim().slice(0, 60)
  const existing = await tx.groupWorld.findUnique({ where: { chatId } })
  if (existing) {
    if (clean && clean !== existing.title) {
      return tx.groupWorld.update({ where: { id: existing.id }, data: { title: clean } })
    }
    return existing
  }
  return tx.groupWorld.create({
    data: {
      chatId,
      title: clean || "شهرِ بی‌نام",
      district: districtForChat(chatId),
      lastEventAt: new Date(Date.now() - 3600000),
      lastBotMsgAt: new Date(Date.now() - 1800000),
    },
  })
}

/** بازیکنِ تلگرامی را find-or-create می‌کند (شهروندِ تازه در صورت نبود) */
export async function ensurePlayerTx(tx: Tx, telegramId: string, name?: string): Promise<Player> {
  const existing = await tx.player.findUnique({ where: { telegramId } })
  if (existing) return existing
  const fallback = `مسافر ${telegramId.slice(-4)}`
  const player = await tx.player.create({
    data: {
      name: (name ?? fallback).slice(0, 24),
      avatar: "🧑‍🦰",
      telegramId,
      money: STARTER_DEFAULTS.money,
      houseKey: STARTER_DEFAULTS.houseKey,
      jobKey: STARTER_DEFAULTS.jobKey,
      currentDistrict: STARTER_DEFAULTS.currentDistrict,
      houseRentDue: new Date(Date.now() + 24 * 3600000),
    },
  })
  // کیتِ آغازینِ مشترک — شهروندِ گروهی هم مثل بازیکنِ Mini App شروع می‌کند
  await grantStarterKit(tx, player.id, player.name)
  return player
}

export async function ensureMemberTx(tx: Tx, groupId: string, playerId: string): Promise<GroupMember> {
  const existing = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId, playerId } } })
  if (existing) return existing
  return tx.groupMember.create({ data: { groupId, playerId } })
}

// ─── دروازه‌ی شهروندی ──────────────────────────────────────────────────────────

/** پیامِ ردِ عضویت — کنش‌های شهر فقط برای شهروندهای ثبت‌شده (V14 Task 15b:
 *  عبارت‌محور — بدونِ فرمانِ اسلش، هم‌صدای لایه‌ی نیتِ ربات) */
export const NOT_CITIZEN_MSG = "تو هنوز شهروندِ این شهر نیستی — اول تو گروه حرف بزن یا «منو» را بگو."

/** آیا بازیکن عضوِ این شهر است؟ — کنش‌های گروهی بدون این دروازه قبول نمی‌شوند */
export async function isGroupMember(groupId: string, playerId: string): Promise<boolean> {
  const m = await db.groupMember.findUnique({ where: { groupId_playerId: { groupId, playerId } } })
  return m !== null
}

/** اعضای فعال = بازدید در ۴۸ ساعت گذشته */
export async function activeMembers(groupId: string, hours = 48): Promise<(GroupMember & { player: Player })[]> {
  const since = new Date(Date.now() - hours * 3600000)
  return db.groupMember.findMany({
    where: { groupId, lastSeenAt: { gte: since } },
    include: { player: true },
    orderBy: { lastSeenAt: "desc" },
  })
}

export async function membersWithPlayers(groupId: string, limit = 50): Promise<(GroupMember & { player: Player })[]> {
  return db.groupMember.findMany({
    where: { groupId },
    include: { player: true },
    orderBy: { messageCount: "desc" },
    take: limit,
  })
}

// ─── هویتِ فرگتِ فرهنگ ─────────────────────────────────────────────────────────

/** از شمارنده‌ها tag فرهنگ را می‌سازد — «چه جایی است این‌جا؟» */
export function computeCultureTag(c: CultureCounters): string {
  const scores: Record<string, number> = {
    chaotic: (c.chaosEvents ?? 0) * 2 + (c.memes ?? 0) * 0.5,
    competitive: (c.competitions ?? 0) * 2 + (c.gamesPlayed ?? 0) * 0.6,
    social: (c.socialMsgs ?? 0) * 0.3 + (c.cooperation ?? 0) * 1.5,
    criminal: (c.crime ?? 0) * 2.5,
    comedic: (c.memes ?? 0) * 1.6,
    mysterious: (c.mystery ?? 0) * 2.2,
    peaceful: (c.cooperation ?? 0) * 1.6 - (c.crime ?? 0) * 1.2 - (c.chaosEvents ?? 0) * 0.5,
  }
  let best = "unset"
  let bestScore = 0.6 // آستانه: تا وقتی سیگنال‌ها کم‌اند، شهر «در حال شکل‌گیری» است
  for (const [tag, score] of Object.entries(scores)) {
    if (score > bestScore) {
      best = tag
      bestScore = score
    }
  }
  return best
}

export function cultureLabel(tag: string): { label: string; emoji: string } {
  return CULTURE_LABELS[tag] ?? CULTURE_LABELS.unset!
}

/** یک جمله‌ی خطی درباره‌ی «این‌جا چه جاییه» — برای کارت خانه‌ی گروه */
export function cultureLine(tag: string, counters: CultureCounters): string {
  switch (tag) {
    case "chaotic":
      return "اینجا هر روز یه چیزی خراب می‌شه و همه عادت کردن."
    case "competitive":
      return `اینجا همه یه چیزی رو می‌سنجن: چه کسی بهتره. (${counters.gamesPlayed ?? 0} بازی ثبت‌شده)`
    case "social":
      return "اینجا حرف‌ها از پنجره‌ها بیرون نمی‌ریزن. این‌جا حرف‌ها پله‌ها رو می‌گیرن."
    case "criminal":
      return "اینجا قانون هست. فقط همه‌ش بحث‌برانگیزه."
    case "comedic":
      return "اینجا حتی جدی‌ترین آدم‌ها یه میم دارند."
    case "mysterious":
      return "اینجا همه‌چیز عادیه. فقط یه‌کم زیادی عادی. مشکوکانه عادی."
    case "peaceful":
      return "اینجا آدم‌ها همدیگه رو می‌شناسن و این کافی‌ست."
    default:
      return "این شهر هنوز داره تصمیم می‌گیره چی باشه. تو هم یه رأی داری."
  }
}

// ─── outbox ────────────────────────────────────────────────────────────────────

export interface OutboxButton {
  label: string
  style?: "primary" | "success" | "danger" | null
  cb?: string
  url?: string
}

export interface PushOutboxOpts {
  kind: string
  text: string
  buttons?: OutboxButton[]
  targetChatId?: string // پیش‌فرض: خودِ گروه
  priority?: number
  refType?: string
  refId?: string
  deliverAfter?: Date
  editMessageId?: string
}

export async function pushOutboxTx(tx: Tx, group: GroupWorld, opts: PushOutboxOpts): Promise<void> {
  await tx.groupOutbox.create({
    data: {
      groupId: group.id,
      targetChatId: opts.targetChatId ?? group.chatId,
      kind: opts.kind,
      text: opts.text,
      buttonsJson: JSON.stringify(opts.buttons ?? []),
      priority: opts.priority ?? 5,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      deliverAfter: opts.deliverAfter ?? new Date(),
      editMessageId: opts.editMessageId ?? null,
    },
  })
}

export async function pushOutbox(group: GroupWorld, opts: PushOutboxOpts): Promise<void> {
  await db.groupOutbox.create({
    data: {
      groupId: group.id,
      targetChatId: opts.targetChatId ?? group.chatId,
      kind: opts.kind,
      text: opts.text,
      buttonsJson: JSON.stringify(opts.buttons ?? []),
      priority: opts.priority ?? 5,
      refType: opts.refType ?? null,
      refId: opts.refId ?? null,
      deliverAfter: opts.deliverAfter ?? new Date(),
      editMessageId: opts.editMessageId ?? null,
    },
  })
}

// ─── تاریخچه / خبر ────────────────────────────────────────────────────────────

// لایه‌ی امنیتِ متنِ ذخیره‌شده (V11): ردیف‌های history/news/title در لحظه‌ی «نوشتن»
// HTML-safe می‌شوند — هر نام/متنِ پویا پیش از ذخیره از esc() می‌گذرد. سایت‌های رندر
// (خبرنامه، خلاصه‌ی بازگشت، /history) متنِ ذخیره‌شده را «بدون» esc نمایش می‌دهند؛
// esc دوباره یعنی double-escape. ردیف‌های قدیمیِ پیش از این قاعده استاتیک‌اند (بررسی شد).

export async function addHistoryTx(tx: Tx, groupId: string, icon: string, text: string, importance = 50): Promise<void> {
  await tx.groupHistory.create({ data: { groupId, icon, text, importance } })
}

export async function addNewsTx(tx: Tx, groupId: string, icon: string, text: string): Promise<void> {
  await tx.groupNews.create({ data: { groupId, icon, text } })
}

// ─── دستاورد گروهی ─────────────────────────────────────────────────────────────

import { GROUP_ACHIEVEMENTS } from "./content"

export async function grantGroupAchievementTx(tx: Tx, group: GroupWorld, key: string): Promise<boolean> {
  const unlocked = new Set(parseJson<string[]>(group.achievementsJson, []))
  const def = GROUP_ACHIEVEMENTS.find((a) => a.key === key)
  if (!def || unlocked.has(key)) return false
  unlocked.add(key)
  await tx.groupWorld.update({ where: { id: group.id }, data: { achievementsJson: JSON.stringify([...unlocked]) } })
  await addHistoryTx(tx, group.id, def.emoji, `دستاوردِ شهر: «${def.name}»`, 80)
  return true
}

/** بررسی دستاوردهای شمارشی — بعد از هر رویداد/بازی/رأی صدا شود */
export async function checkAchievementsTx(tx: Tx, group: GroupWorld): Promise<string[]> {
  const c = cultureOf(group)
  const checks: Record<string, boolean> = {
    first_event: (c.eventsResolved ?? 0) >= 1,
    hundred_events: (c.eventsResolved ?? 0) >= 100,
    millionaire_city: group.treasury >= 1000000,
    games_10: (c.gamesPlayed ?? 0) >= 10,
    games_50: (c.gamesPlayed ?? 0) >= 50,
    memes_10: (c.memes ?? 0) >= 10,
    votes_20: (c.votes ?? 0) >= 20,
    survived_100: (c.chaosEvents ?? 0) >= 100,
    festival_5: (c.festival ?? 0) >= 5,
    mystery_10: (c.mystery ?? 0) >= 10,
    crime_wave: (c.crime ?? 0) >= 30,
    cooperative_20: (c.cooperation ?? 0) >= 20,
  }
  const granted: string[] = []
  for (const [key, ok] of Object.entries(checks)) {
    if (ok) {
      const done = await grantGroupAchievementTx(tx, group, key)
      if (done) granted.push(key)
    }
  }
  return granted
}
