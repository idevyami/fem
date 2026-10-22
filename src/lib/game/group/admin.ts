// FEMBOY WAR — V13 موجِ ۲ (Part 9): مدیریتِ گروه — settingsJson زنده شد.
//
//   {enabled, noise, eventFreq} روی GroupWorld.settingsJson (فیلدِ مرده از V5).
//   پیش‌فرض‌ها محافظه‌کارانه: بازی باز، صدا عادی، اتفاق‌ها عادی (Part 9: «رفتارِ
//   امن و محترمانه به گفت‌وگویِ معمولی» — خاموشی فقط با خواستِ ادمین).
//
// اجرا (enforcement):
//   enabled=false → engine.groupCommand (به‌جز help/gadmin) کارتِ «بسته» می‌دهد؛
//     groupCallback (به‌جز gs:) ack بسته؛ tickGroup قبل از فازِ ۱ برمی‌گردد.
//   noise → presence: ضریبِ بودجه‌ی پیام‌های داوطلبانه (silent=0, quiet=0.5, normal=1).
//   eventFreq → tick فازِ ۶: ضریبِ احتمالِ رویدادِ خودجوش (off=0, rare=0.4, normal=1)
//     — فقط فازِ ۶؛ نمایشِ استایل و بازی‌های خودجوش دست‌نخورده.
//
// اعتماد (isAdmin): فقط از ترنسپورتِ ربات با service key می‌رسد — ربات زنده
// getChatMember(chatId, userId) ∈ {administrator, creator} را چک کرده. موتور به
// ترنسپورت اعتماد می‌کند، هرگز به payload کاربر. gs: بدونِ isAdmin فقط توستِ
// «فقط ادمین‌های گروه.» می‌شنود.
//
// بازیابی (recover): دعوت‌های pending → expired (همان expire)، رویدادهای باز →
// حل (همان مسیرِ انقضا)، رأی‌های باز → بسته (همان resolve)، بازی‌های باز →
// نتیجه (همان tickGames)، claimهای سرآمده‌ی outbox → آزاد. هیچ پاداشی دوباره
// نمی‌خورد — همه‌ی مسیرها فلیپِ شرطی‌اند.

import { db } from "@/lib/db"
import type { GroupWorld } from "@prisma/client"
import type { GroupCallCtx } from "./router"
import type { OutboxButton, GroupSettingsDTO } from "./types"
import { parseJson } from "./domain"
import { expireStaleChallenges } from "./challenges"
import { expireOpenEvents } from "./events"
import { closeVotes } from "./politics"
import { tickGames } from "./games"
import { SUB, chip, quote, emblem } from "./text"

export type GroupSettings = GroupSettingsDTO

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  enabled: true,
  noise: "normal",
  eventFreq: "normal",
}

const NOISE_LEVELS: GroupSettings["noise"][] = ["normal", "quiet", "silent"]
const FREQ_LEVELS: GroupSettings["eventFreq"][] = ["off", "rare", "normal"]

/** خواندنِ تنظیمات — JSON گمشده/خراب/نامعتبر = پیش‌فرض‌ها (fail-safe) */
export function getGroupSettings(group: GroupWorld): GroupSettings {
  const raw = parseJson<Partial<GroupSettings>>(group.settingsJson, {})
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_GROUP_SETTINGS.enabled,
    noise: NOISE_LEVELS.includes(raw.noise as GroupSettings["noise"]) ? (raw.noise as GroupSettings["noise"]) : DEFAULT_GROUP_SETTINGS.noise,
    eventFreq: FREQ_LEVELS.includes(raw.eventFreq as GroupSettings["eventFreq"]) ? (raw.eventFreq as GroupSettings["eventFreq"]) : DEFAULT_GROUP_SETTINGS.eventFreq,
  }
}

/** نوشتنِ mergeشده — فقط میدان‌های معتبر عبور می‌کنند */
export async function saveGroupSettings(group: GroupWorld, patch: Partial<GroupSettings>): Promise<GroupSettings> {
  const cur = getGroupSettings(group)
  const next: GroupSettings = {
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : cur.enabled,
    noise: NOISE_LEVELS.includes(patch.noise as GroupSettings["noise"]) ? (patch.noise as GroupSettings["noise"]) : cur.noise,
    eventFreq: FREQ_LEVELS.includes(patch.eventFreq as GroupSettings["eventFreq"]) ? (patch.eventFreq as GroupSettings["eventFreq"]) : cur.eventFreq,
  }
  await db.groupWorld.update({ where: { id: group.id }, data: { settingsJson: JSON.stringify(next) } })
  return next
}

// ─── ضریب‌های اجرا ─────────────────────────────────────────────────────────────

/** بودجه‌ی پیامِ داوطلبانه‌ی ربات: خاموش=0 · آرام=0.5 · عادی=1 */
export function noiseMultiplier(s: GroupSettings): number {
  return s.noise === "silent" ? 0 : s.noise === "quiet" ? 0.5 : 1
}

/** احتمالِ رویدادِ خودجوش (فقط فازِ ۶ تیک): خاموش=0 · کم=0.4 · عادی=1 */
export function eventFreqMultiplier(s: GroupSettings): number {
  return s.eventFreq === "off" ? 0 : s.eventFreq === "rare" ? 0.4 : 1
}

/** کارتِ «بازیِ شهر بسته» — پاسخِ فرمان‌های بازی وقتی enabled=false */
export const PAUSED_CARD_TEXT = "بازیِ شهر در این گروه فعلاً بسته‌است."

/** ack بسته — کال‌بک‌های بازی وقتی enabled=false (PLAIN؛ توست parse_mode ندارد) */
export const PAUSED_ACK = "بازیِ شهر فعلاً بسته‌است — فقط ادمینِ گروه می‌تواند بازش کند."

/** ack غیرادمین برای gs: (PLAIN) */
export const ADMIN_ONLY_ACK = "فقط ادمین‌های گروه."

// ─── کارت‌های تنظیمات (خالص؛ V11) ──────────────────────────────────────────────

const NOISE_LABELS: Record<GroupSettings["noise"], string> = {
  normal: "🔊 عادی",
  quiet: "🌫 آرام",
  silent: "🔇 خاموش",
}

const FREQ_LABELS: Record<GroupSettings["eventFreq"], string> = {
  normal: "✅ عادی",
  rare: "🌙 کم",
  off: "⛔ خاموش",
}

export interface AdminCounts {
  pendingChallenges: number
  openEvents: number
  openGames: number
  openVotes: number
}

/** کارتِ وضعیت/تنظیمات — یک سازنده برای هر دو گونه (ادمین دکمه‌های اکشن دارد).
 *  V24 «ظاهرِ شهر»: نشانِ 🛠 در مرکزِ جداکننده؛ سطرهای وضعیت عیناً مانده‌اند (لنگرِ verify). */
export function settingsCardText(s: GroupSettings, counts: AdminCounts, isAdmin: boolean): string {
  return [
    "🛠 <b>تنظیماتِ شهر</b>",
    emblem("🛠"),
    "",
    `وضعیتِ بازی: ${s.enabled ? "✅ باز" : "⛔ بسته"}`,
    `سروصدایِ شهر: ${NOISE_LABELS[s.noise]}`,
    `رویّه‌ی اتفاق‌ها: ${FREQ_LABELS[s.eventFreq]}`,
    "",
    SUB,
    "",
    `⚔️ ${chip(counts.pendingChallenges)} دعوتِ بی‌جواب · 💥 ${chip(counts.openEvents)} اتفاقِ باز`,
    `🎲 ${chip(counts.openGames)} بازیِ باز · 🗳 ${chip(counts.openVotes)} رأیِ باز`,
    "",
    quote(
      isAdmin
        ? "دکمه‌ها همین کارت را به‌روز می‌کنند. بازیابی، هرچه باز مانده را محترمانه می‌بندد."
        : "تنظیم فقط با ادمین‌های گروه — این کارت فقط گزارش است.",
    ),
  ].join("\n")
}

/** دکمه‌های تنظیمات — فقط برای ادمین؛ برچسب‌ها PLAIN با رقمِ انگلیسی */
export function settingsButtons(s: GroupSettings, isAdmin: boolean): OutboxButton[] {
  if (!isAdmin) return [{ label: "↩ خانه", style: "primary", cb: "gm:game" }]
  return [
    { label: s.enabled ? "⛔ بستنِ بازیِ شهر" : "✅ بازکردنِ بازیِ شهر", style: s.enabled ? "danger" : "success", cb: "gs:toggle:enabled" },
    { label: `🔊 صدای عادی${s.noise === "normal" ? " ✓" : ""}`, style: "primary", cb: "gs:set:noise:normal" },
    { label: `🌫 آرام${s.noise === "quiet" ? " ✓" : ""}`, style: "primary", cb: "gs:set:noise:quiet" },
    { label: `🔇 خاموش${s.noise === "silent" ? " ✓" : ""}`, style: "primary", cb: "gs:set:noise:silent" },
    { label: `✅ اتفاق‌های عادی${s.eventFreq === "normal" ? " ✓" : ""}`, style: "primary", cb: "gs:set:eventFreq:normal" },
    { label: `🌙 اتفاق‌های کم${s.eventFreq === "rare" ? " ✓" : ""}`, style: "primary", cb: "gs:set:eventFreq:rare" },
    { label: `⛔ بدونِ اتفاق${s.eventFreq === "off" ? " ✓" : ""}`, style: "primary", cb: "gs:set:eventFreq:off" },
    { label: "🧹 بازیابیِ شهر (بستنِ بازمانده‌ها)", style: "danger", cb: "gs:recover" },
  ]
}

async function adminCounts(groupId: string): Promise<AdminCounts> {
  const [pendingChallenges, openEvents, openGames, openVotes] = await Promise.all([
    db.groupChallenge.count({ where: { groupId, status: "pending" } }),
    db.groupEvent.count({ where: { groupId, status: "open" } }),
    db.gameSession.count({ where: { groupId, status: "open" } }),
    db.groupVote.count({ where: { groupId, status: "open" } }),
  ])
  return { pendingChallenges, openEvents, openGames, openVotes }
}

// ─── فرمانِ gadmin ─────────────────────────────────────────────────────────────

/** /gadmin — ادمین: کارتِ تنظیمات با دکمه‌ها؛ غیرادمین: گزارشِ فقط-خواندنی */
export async function gadminCommand(ctx: GroupCallCtx): Promise<{ text: string; buttons: OutboxButton[] }> {
  const s = getGroupSettings(ctx.group)
  const counts = await adminCounts(ctx.group.id)
  return {
    text: settingsCardText(s, counts, ctx.isAdmin === true),
    buttons: settingsButtons(s, ctx.isAdmin === true),
  }
}

// ─── کال‌بک‌های gs: ────────────────────────────────────────────────────────────

/** gs:{toggle:enabled|set:noise:v|set:eventFreq:v|recover} — فقط ادمین */
export async function gsCallback(ctx: GroupCallCtx, data: string): Promise<{ ok: boolean; ackText: string; editCard?: { text: string; buttons: OutboxButton[] } }> {
  if (ctx.isAdmin !== true) return { ok: false, ackText: ADMIN_ONLY_ACK }
  const arg = data.split(":").slice(1).join(":")

  if (arg === "toggle:enabled") {
    const cur = getGroupSettings(ctx.group)
    const next = await saveGroupSettings(ctx.group, { enabled: !cur.enabled })
    return { ok: true, ackText: next.enabled ? "بازیِ شهر باز شد." : "بازیِ شهر بسته شد.", editCard: await freshSettingsCard(ctx.group.id) }
  }
  if (arg.startsWith("set:noise:")) {
    const v = arg.slice("set:noise:".length) as GroupSettings["noise"]
    if (!NOISE_LEVELS.includes(v)) return { ok: false, ackText: "چنین سطخی از صدا در شهر شناخته نمی‌شود." }
    await saveGroupSettings(ctx.group, { noise: v })
    return { ok: true, ackText: `سروصدا: ${NOISE_LABELS[v]}.`, editCard: await freshSettingsCard(ctx.group.id) }
  }
  if (arg.startsWith("set:eventFreq:")) {
    const v = arg.slice("set:eventFreq:".length) as GroupSettings["eventFreq"]
    if (!FREQ_LEVELS.includes(v)) return { ok: false, ackText: "چنین رویه‌ای برای اتفاق‌ها شناخته نمی‌شود." }
    await saveGroupSettings(ctx.group, { eventFreq: v })
    return { ok: true, ackText: `رویّه‌ی اتفاق‌ها: ${FREQ_LABELS[v]}.`, editCard: await freshSettingsCard(ctx.group.id) }
  }
  if (arg === "recover") {
    const r = await recover(ctx.group)
    return {
      ok: true,
      ackText: "بازیابی انجام شد — گزارش روی کارت.",
      editCard: { text: recoverCardText(r), buttons: [{ label: "🛠 تنظیمات", style: "primary", cb: "gs:view" }] },
    }
  }
  if (arg === "view") {
    // بازگشت به کارتِ تنظیمات از کارتِ بازیابی — فقط ادمین (این‌جا هستیم)
    return { ok: true, ackText: "تنظیماتِ شهر.", editCard: await freshSettingsCard(ctx.group.id) }
  }
  return { ok: false, ackText: "دکمه‌ی ناشناخته." }
}

async function freshSettingsCard(groupId: string): Promise<{ text: string; buttons: OutboxButton[] }> {
  const group = await db.groupWorld.findUniqueOrThrow({ where: { id: groupId } })
  const s = getGroupSettings(group)
  const counts = await adminCounts(group.id)
  return { text: settingsCardText(s, counts, true), buttons: settingsButtons(s, true) }
}

// ─── بازیابی ───────────────────────────────────────────────────────────────────

export interface RecoverReport {
  challenges: number
  events: number
  votes: number
  games: number
  outboxUnclaimed: number
}

/** بستنِ محترمانه‌ی هرچه باز مانده — همه با همان مسیرهای انقضای تیک (فلیپِ شرطی)،
 *  پس هیچ پاداشی دوباره پرداخت نمی‌شود و هیچ دو تیکِ هم‌زمانی دوباره نمی‌بندند. */
export async function recover(group: GroupWorld): Promise<RecoverReport> {
  const now = new Date()
  // شمارشِ پیش از بستن — برای گزارشِ درست
  const [eventsBefore, votesBefore, gamesBefore] = await Promise.all([
    db.groupEvent.count({ where: { groupId: group.id, status: "open" } }),
    db.groupVote.count({ where: { groupId: group.id, status: "open" } }),
    db.gameSession.count({ where: { groupId: group.id, status: "open" } }),
  ])
  const challenges = await expireStaleChallenges(db, group.id, now, { force: true })
  await expireOpenEvents(group, now, { force: true })
  await closeVotes(group, now, { force: true })
  await tickGames(group, now, { force: true })
  const staleClaimBefore = new Date(now.getTime() - 5 * 60000)
  const unclaimed = await db.groupOutbox.updateMany({
    where: { groupId: group.id, deliveredAt: null, claimedAt: { lt: staleClaimBefore } },
    data: { claimedAt: null },
  })
  return {
    challenges,
    events: eventsBefore,
    votes: votesBefore,
    games: gamesBefore,
    outboxUnclaimed: unclaimed.count,
  }
}

/** کارتِ گزارشِ بازیابی (خالص؛ V11) — V24: نشانِ 🧹 + تعهدِ بی‌پاداشِ دوباره زیرِ quote */
export function recoverCardText(r: RecoverReport): string {
  return [
    "🧹 <b>بازیابیِ شهر</b>",
    emblem("🧹"),
    "",
    `⚔️ ${chip(r.challenges)} دعوتِ دوئل بسته شد.`,
    `💥 ${chip(r.events)} اتفاقِ باز به مسیرِ حل رفت.`,
    `🎲 ${chip(r.games)} بازیِ باز نتیجه گرفت (یا لغو شد).`,
    `🗳 ${chip(r.votes)} رأیِ باز بسته شد.`,
    `📤 ${chip(r.outboxUnclaimed)} پیامِ گیرکرده در صف، آزاد شد.`,
    "",
    quote("هیچ پاداشی دوباره پرداخت نشد — همه‌ی بستن‌ها همان فلیپ‌های شرطیِ تیک‌اند."),
  ].join("\n")
}
