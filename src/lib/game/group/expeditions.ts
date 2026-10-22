// FEMBOY WAR — V27: کاروانِ شهر — مأموریتِ تعاونیِ چندنفره با سهم‌های مکمل.
//
// ── چرا این ماژول هست ──────────────────────────────────────────────────────────
// ممیزیِ V27: عمیق‌ترین حفره‌ی بازیِ گروهی این بود که هیچ کنشی «مکملِ» کنشِ
// بازیکنِ دیگر نبود — رویدادها انتخاب‌های موازی‌اند، بازی‌ها رأی/کوییزِ هم‌شکل،
// پروژه‌ها فقط پول. کاروان اولین چرخه‌ی حیاتِ واقعاً تعاونی است:
//
//   recruit → هر شهروند یک «سهم» برمی‌دارد (اولین-رسیده؛ یک سهم برای همیشه)
//   act     → هر سهم‌دار کنشِ خودش را می‌زند (رولِ قطعی، بازخوردِ همان لحظه)؛
//             تماشاگرها «تشویق» می‌کنند — همه نقشی دارند
//   resolve → حکمِ کاروان از جمعِ کنش‌ها می‌آید؛ پاداش/پیامدِ واقعی؛ کارتِ نتیجه
//             همان پیامِ کاروان را ویرایش می‌کند (پنلِ اشتراکی تا آخرِ عمرش یکی است)
//
// ── پل‌های معماری که رعایت شده‌اند ─────────────────────────────────────────────
//   • SharedGroupPanel (router.ts): ثبتِ یک نفر پنل را نمی‌کُشد — همه‌ی
//     کال‌بک‌ها editCard برمی‌گردانند و دکمه‌ها سِرو می‌مانند.
//   • withSectionLock (domain.ts): نوشتنِ rolesJson/cheersJson سریال می‌شود.
//   • فلیپِ شرطی: depart/resolve فقط با updateMany({status/phase}) — تیکِ ۴۵ثانیه‌ای
//     و کال‌بکِ هم‌زمان فقط یک‌بار حکم می‌دهند.
//   • awards.ts: تنها دروازه‌ی نوشتنِ Player-stat؛ awardSoulProgress سقفِ روزانه دارد.
//   • outbox + markDelivered(refType:"expedition"): کارت همان پیام ویرایش می‌شود.
//   • متن کارت‌ها: سازنده‌های خالص (تست‌پذیر)؛ نام‌ها esc؛ ارقام chip/faNum؛
//     روایتِ بلند زیرِ quote؛ نشانِ 🧭 در مرکزِ جداکننده — هم‌زبانِ V24/V26.
//
// ── ریاضیِ شانس (قواعدِ صریح؛ رولِ قطعی) ────────────────────────────────────────
//   کنشِ هر سهم: p = clamp(0.42 + 0.16·(کلاسِ هم‌افزا؟) + 0.018·سطح (سقف 0.18)
//                     + 0.0012·(شانس−50), 0.20, 0.93)
//   حکمِ کاروان:  p = clamp(0.28 + 0.11·تعدادِ کنش‌های موفق + 0.02·تشویق (سقف 5),
//                     0.15, 0.95)
//   سهمِ هرگز-کنش‌نکرده «لنگ می‌ماند» — شکستِ همان سهم؛ پاداشِ کوچکِ همدلی می‌گیرد
//   (تنبیه نیست؛ غیبت هزینه‌ی اجتماعیِ کوچک دارد، نه نابودی).

import { db } from "@/lib/db"
import type { GroupWorld, GroupExpedition, Player, SoulCharacter } from "@prisma/client"
import { mulberry32, seedFrom, randInt, clamp } from "../rng"
import { getClass } from "../content/classes"
import type { ExpeditionTemplate, OutboxButton } from "./types"
import { EXPEDITION_TEMPLATES, EXPEDITION_MAP } from "./content"
import {
  esc, parseJson, pushOutbox, pushOutboxTx, addHistoryTx, addNewsTx,
  activeMembers, bumpCulture, checkAchievementsTx, cultureOf, withSectionLock,
} from "./domain"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { awardPlayerStat, awardSoulProgress } from "./awards"
import { adjustRelationship } from "./social"
import { SUB, chip, faNum, quote, emblem, expand, remainChip } from "./text"

export type Tx = import("@prisma/client").Prisma.TransactionClient

// ─── نوع‌های داخلی ─────────────────────────────────────────────────────────────

/** یک سهمِ گرفته‌شده — سطرِ rolesJson */
export interface ExpeditionRoleRow {
  playerId: string
  roleKey: string
  /** عددِ نمایشیِ کنش (۰..۱۰۰) — در لحظه‌ی کنش قطعی می‌شود */
  roll?: number
  success?: boolean
  actedAt?: string
}

export function parseExpeditionRoles(ex: GroupExpedition): ExpeditionRoleRow[] {
  return parseJson<ExpeditionRoleRow[]>(ex.rolesJson, [])
}

function parseCheers(ex: GroupExpedition): string[] {
  return parseJson<string[]>(ex.cheersJson, [])
}

// ─── انتخابِ قالب ──────────────────────────────────────────────────────────────

function pickExpeditionTemplate(lastId: string | undefined): ExpeditionTemplate | null {
  const pool = EXPEDITION_TEMPLATES.filter((t) => t.id !== lastId)
  const list = pool.length > 0 ? pool : EXPEDITION_TEMPLATES
  const rng = mulberry32(seedFrom("gxpick", String(lastId ?? ""), Date.now()))
  return list[Math.floor(rng() * list.length)] ?? null
}

export function getExpeditionTemplate(templateId: string): ExpeditionTemplate | undefined {
  return EXPEDITION_MAP[templateId]
}

// ─── ریاضیِ شانس — خالص (تست‌پذیر) ─────────────────────────────────────────────

/** شانسِ کنشِ یک سهم — کلاسِ هم‌افزا + سطحِ فمبوی + شانسِ بازیکن */
export function actSuccessChance(char: SoulCharacter | null, playerLuck: number, favored: boolean): number {
  const level = char?.level ?? 0
  return clamp(0.42 + (favored ? 0.16 : 0) + Math.min(0.18, level * 0.018) + (playerLuck - 50) * 0.0012, 0.2, 0.93)
}

/** شانسِ حکمِ کاروان از جمعِ کنش‌ها و تشویق‌ها — خالص */
export function teamSuccessChance(successes: number, cheers: number): number {
  return clamp(0.28 + 0.11 * successes + 0.02 * Math.min(5, Math.max(0, cheers)), 0.15, 0.95)
}

// ─── کارت‌ها — سازنده‌های خالص (تست‌پذیر) ────────────────────────────────────────

/** ایموجی‌های کلاس‌های هم‌افزا — خطِ فشرده‌ی «هم‌افزا: …» */
function favoredLine(tpl: ExpeditionTemplate, roleKey: string): string {
  const role = tpl.roles.find((r) => r.key === roleKey)
  if (!role) return ""
  return role.favoredClasses.map((k) => getClass(k)?.emoji ?? "").filter(Boolean).join("")
}

export interface ExpeditionHolder {
  name: string
  classEmoji: string | null
}

/** کارتِ سهم‌گیری — فازِ recruit؛ windowLine از بیرون می‌آید تا سازنده خالص بماند */
export function expeditionRecruitCardText(
  tpl: ExpeditionTemplate,
  groupTitle: string,
  holders: Record<string, ExpeditionHolder | undefined>,
  windowLine: string,
): string {
  const filled = Object.keys(holders).length
  const duties = expand(
    tpl.roles.map((r) => `${r.emoji} ${r.label} — ${r.duty}`).join("\n"),
  )
  const roleLines = tpl.roles.map((r) => {
    const h = holders[r.key]
    return h
      ? `▪ ${r.emoji} <b>${esc(h.name)}</b>${h.classEmoji ? ` ${esc(h.classEmoji)}` : ""} ✓`
      : `▪ ${r.emoji} <b>${r.label}</b> — آزاد <i>هم‌افزا: ${favoredLine(tpl, r.key) || "—"}</i>`
  })
  return [
    `🧭 <b>کاروانِ ${esc(groupTitle)}: ${tpl.emoji} ${tpl.title}</b>`,
    emblem("🧭"),
    "",
    quote(tpl.hook),
    "",
    SUB,
    "",
    `🧑‍🤝‍🧑 <b>سهم‌ها</b> — ${chip(filled)} از ${chip(tpl.roles.length)} پر:`,
    ...roleLines,
    duties,
    "",
    windowLine || `⏳ ${chip(tpl.recruitMinutes)} دقیقه تا حرکت — حداقل ${chip(tpl.minRoles)} سهمِ متفاوت.`,
    "<i>سهمِ هر شهروند یکی است و قطعی می‌شود؛ کلاسِ هم‌افزا شانسِ کنشت را بالا می‌برد. تماشاگرها در راه تشویق می‌کنند.</i>",
  ].join("\n")
}

/** رندرِ مهلتِ واقعی — کارت‌سازِ خالص باقی بماند، مهلت از بیرون می‌آید */
export function expeditionWindowLine(ex: GroupExpedition, now = new Date()): string {
  const until = ex.phase === "recruit" ? ex.recruitEndsAt : ex.actEndsAt
  if (!until) return ""
  const mins = Math.ceil((until.getTime() - now.getTime()) / 60000)
  if (mins <= 0) return ""
  return `⏳ ${chip(mins)} دقیقه ${ex.phase === "recruit" ? "تا حرکت" : "تا رسیدن"}.`
}

/** دکمه‌های سهم‌گیری — فقط سهم‌های آزاد + حرکت + خانه */
export function expeditionRecruitCardButtons(
  ex: GroupExpedition,
  tpl: ExpeditionTemplate,
  rows: ExpeditionRoleRow[],
): OutboxButton[] {
  const taken = new Set(rows.map((r) => r.roleKey))
  const buttons: OutboxButton[] = tpl.roles
    .filter((r) => !taken.has(r.key))
    .map((r) => ({ label: `${r.emoji} ${r.label}`, style: "primary" as const, cb: `gx:${ex.id}:join:${r.key}` }))
  const distinct = taken.size
  if (distinct >= tpl.minRoles) {
    buttons.push({ label: "🚀 حرکتِ کاروان", style: "success" as const, cb: `gx:${ex.id}:begin` })
  }
  buttons.push({ label: "↩ خانه", style: "primary" as const, cb: "gm:game" })
  return buttons
}

/** کارتِ فازِ عمل — هر سهم‌دار کنشِ خودش را می‌زند */
export function expeditionActCardText(
  tpl: ExpeditionTemplate,
  holders: { roleKey: string; name: string; classEmoji: string | null; acted: boolean }[],
  cheers: number,
  windowLine: string,
): string {
  const roleOf = new Map(tpl.roles.map((r) => [r.key, r]))
  const lines = holders.map((h) => {
    const role = roleOf.get(h.roleKey)
    if (!role) return ""
    return `▪ ${role.emoji} <b>${esc(h.name)}</b>${h.classEmoji ? ` ${esc(h.classEmoji)}` : ""} — ${h.acted ? "✅ انجام شد" : "⏳ منتظرِ کنش"}`
  })
  return [
    `🧭 <b>کاروان در راه است: ${tpl.emoji} ${tpl.title}</b>`,
    emblem("🧭"),
    "",
    quote(tpl.hook),
    "",
    SUB,
    "",
    "🎯 <b>کنشِ سهم‌ها</b>:",
    ...lines.filter(Boolean),
    "",
    `📣 ${chip(cheers)} تشویق از شهر.`,
    windowLine,
    "",
    "<i>هر سهم‌دار کنشِ خودش را می‌زند — نتیجه‌ی کنش همان لحظه به خودش می‌رسد. بقیه‌ی شهروندها تشویق می‌کنند؛ تشویق شانسِ کاروان را بالا می‌برد.</i>",
  ].join("\n")
}

/** دکمه‌های فازِ عمل — کنش (برای سهم‌داران) + تشویق (برای بقیه) + خانه.
 *  سرور نقش‌ها را جدا می‌کند؛ دکمه‌ی نامربوط جوابِ صادقانه می‌گیرد. */
export function expeditionActCardButtons(ex: GroupExpedition): OutboxButton[] {
  return [
    { label: "🎯 کنشِ سهمِ خودت", style: "danger", cb: `gx:${ex.id}:act` },
    { label: "📣 تشویقِ کاروان", style: "primary", cb: `gx:${ex.id}:cheer`, sameRow: true },
    { label: "↩ خانه", style: "primary", cb: "gm:game" },
  ]
}

/** کارتِ نتیجه — حکم + کنشِ تک‌تک + پاداش‌ها؛ همان پیامِ کاروان ویرایش می‌شود */
export function expeditionResultCardText(
  tpl: ExpeditionTemplate,
  holders: { roleKey: string; name: string; success: boolean; neverActed: boolean; successText: string; failText: string }[],
  verdict: { success: boolean; perfect: boolean; treasury: number; each: number; cheers: number; mvpName: string | null },
): string {
  const lines = holders.map((h) =>
    h.success
      ? `▪ ✅ ${h.successText}`
      : `▪ ❌ ${h.neverActed ? `${h.failText} <i>(سهم هرگز کنش نشد)</i>` : h.failText}`,
  )
  const head = verdict.success
    ? `🏆 <b>کاروان موفق بود</b>`
    : `🪦 <b>کاروان نصفه‌کاره ماند</b>`
  const rewards = verdict.success
    ? [
        `💰 صندوقِ شهر: ${chip(verdict.treasury)} سکه`,
        `🪙 سهمِ هر کنشگر: ~${chip(verdict.each)} سکه`,
        verdict.mvpName ? `🎖 بهترین کنش: <b>${esc(verdict.mvpName)}</b>` : "",
      ].filter(Boolean)
    : [
        `🪙 سهمِ همدلیِ هر سهم‌دار: ~${chip(verdict.each)} سکه`,
        `📣 ${chip(verdict.cheers)} تشویق شنیده شد — کافی نبود، ولی شنیده شد.`,
      ]
  return [
    `🧭 <b>نتیجه‌ی کاروان: ${tpl.emoji} ${tpl.title}</b>`,
    emblem("🧭"),
    "",
    ...lines,
    "",
    SUB,
    "",
    head,
    ...(verdict.perfect ? ["⭐ <b>بی‌نقص.</b>"] : []),
    quote(verdict.perfect ? tpl.perfectLine : verdict.success ? tpl.successLine : tpl.failLine),
    "",
    ...rewards,
  ].join("\n")
}

// ─── رندرِ زنده‌ی کارتِ فعلی (فرمان/کال‌بک) ────────────────────────────────────

/** نام + ایموجیِ کلاسِ دارنده‌های سهم — lookupِ مشترکِ کارت‌ها */
async function holdersOf(ex: GroupExpedition): Promise<Record<string, ExpeditionHolder>> {
  const rows = parseExpeditionRoles(ex)
  if (rows.length === 0) return {}
  const players = await db.player.findMany({ where: { id: { in: rows.map((r) => r.playerId) } } })
  const chars = await db.soulCharacter.findMany({ where: { playerId: { in: rows.map((r) => r.playerId) } }, select: { playerId: true, classKey: true } })
  const nameOf = new Map(players.map((p) => [p.id, p]))
  const classOf = new Map(chars.map((c) => [c.playerId, c.classKey]))
  const out: Record<string, ExpeditionHolder> = {}
  for (const r of rows) {
    const p = nameOf.get(r.playerId)
    if (!p) continue
    out[r.roleKey] = { name: p.name, classEmoji: getClass(classOf.get(r.playerId) ?? "")?.emoji ?? null }
  }
  return out
}

/** کارتِ فعلیِ کاروان — recruit یا act؛ برای فرمانِ «مامموریت» و gm:mission */
export async function currentExpeditionCard(
  group: GroupWorld,
  ex: GroupExpedition,
): Promise<{ text: string; buttons: OutboxButton[] }> {
  const tpl = getExpeditionTemplate(ex.templateId)
  if (!tpl) return { text: "این کاروان از دفترِ شهر حذف شده.", buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }] }
  const holders = await holdersOf(ex)
  if (ex.phase === "recruit") {
    const rows = parseExpeditionRoles(ex)
    const text = expeditionRecruitCardText(tpl, group.title, holders, expeditionWindowLine(ex))
    return { text, buttons: expeditionRecruitCardButtons(ex, tpl, rows) }
  }
  const rows = parseExpeditionRoles(ex)
  const actHolders = rows.map((r) => ({
    roleKey: r.roleKey,
    name: holders[r.roleKey]?.name ?? "؟",
    classEmoji: holders[r.roleKey]?.classEmoji ?? null,
    acted: Boolean(r.actedAt),
  }))
  const cheers = parseCheers(ex).length
  return {
    text: expeditionActCardText(tpl, actHolders, cheers, expeditionWindowLine(ex)),
    buttons: expeditionActCardButtons(ex),
  }
}

// ─── ساخت ──────────────────────────────────────────────────────────────────────

export interface SpawnExpeditionOpts {
  templateId?: string
  priority?: number
}

export async function spawnExpedition(group: GroupWorld, opts: SpawnExpeditionOpts = {}): Promise<GroupExpedition | null> {
  // فقط یک کاروانِ باز در هر شهر
  const open = await db.groupExpedition.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return null

  // کول‌داون از culture (expReadyAt = ISO) — ردیفِ تازه خوانده می‌شود (کفِ تیک)
  const fresh = await db.groupWorld.findUnique({ where: { id: group.id } })
  const c = cultureOf(fresh ?? group)
  const readyAt = typeof c.expReadyAt === "string" ? new Date(c.expReadyAt) : null
  if (readyAt && readyAt.getTime() > Date.now()) return null

  const members = await activeMembers(group.id, 96)
  const template =
    (opts.templateId ? getExpeditionTemplate(opts.templateId) : undefined) ??
    pickExpeditionTemplate(typeof c.expLastId === "string" ? c.expLastId : undefined)
  if (!template || members.length < template.minMembers) return null

  const expedition = await db.groupExpedition.create({
    data: {
      groupId: group.id,
      templateId: template.id,
      title: template.title,
      emoji: template.emoji,
      phase: "recruit",
      recruitEndsAt: new Date(Date.now() + template.recruitMinutes * 60000),
      payloadJson: JSON.stringify({ hook: template.hook }),
    },
  })

  await pushOutbox(group, {
    kind: "expedition",
    text: expeditionRecruitCardText(template, group.title, {}, `⏳ ${chip(template.recruitMinutes)} دقیقه تا حرکت — حداقل ${chip(template.minRoles)} سهمِ متفاوت.`),
    buttons: expeditionRecruitCardButtons(expedition, template, []),
    refType: "expedition",
    refId: expedition.id,
    priority: opts.priority ?? 7,
  })
  // کول‌داون همان لحظه‌ی تولد می‌نشیند — کاروانِ بعدی بعد از همین قالب تمام شود
  await bumpCulture(db, group.id, {
    expReadyAt: new Date(Date.now() + template.cooldownMinutes * 60000).toISOString(),
    expLastId: template.id,
  })
  return expedition
}

// ─── کنش‌های شهروند (کال‌بکِ gx:) ──────────────────────────────────────────────

export interface ExpeditionActionResult {
  ok: boolean
  ackText: string
  /** پنلِ اشتراکی زنده می‌ماند — هر کنش کارتِ تازه‌ی همان پیام را برمی‌گرداند */
  cardText: string
  cardButtons: OutboxButton[]
}

const NO_CARD = { cardText: "", cardButtons: [] as OutboxButton[] }

async function openExpeditionOf(groupId: string, expeditionId: string): Promise<GroupExpedition | null> {
  return db.groupExpedition.findFirst({ where: { id: expeditionId, groupId, status: "open" } })
}

/** سهم‌گیری — gx:{id}:join:{roleKey} */
export async function joinExpedition(
  group: GroupWorld,
  player: Player,
  expeditionId: string,
  roleKey: string,
): Promise<ExpeditionActionResult> {
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, ackText: NOT_CITIZEN_MSG, ...NO_CARD }
  }
  const ex = await openExpeditionOf(group.id, expeditionId)
  if (!ex) return { ok: false, ackText: "این کاروان دیگر باز نیست.", ...NO_CARD }
  const tpl = getExpeditionTemplate(ex.templateId)
  const role = tpl?.roles.find((r) => r.key === roleKey)
  if (!tpl || !role) return { ok: false, ackText: "چنین سهمی در این کاروان نیست.", ...NO_CARD }

  const r = await withSectionLock(`expedition:${ex.id}`, async () => {
    const fresh = await db.groupExpedition.findUnique({ where: { id: ex.id } })
    if (!fresh || fresh.status !== "open") return { ok: false, ackText: "این کاروان دیگر باز نیست." }
    if (fresh.phase !== "recruit") return { ok: false, ackText: "کاروان حرکت کرده — سهم‌ها بسته‌اند." }
    if (fresh.recruitEndsAt.getTime() < Date.now()) return { ok: false, ackText: "مهلتِ سهم‌گیری تمام شده بود." }
    const rows = parseExpeditionRoles(fresh)
    if (rows.some((row) => row.playerId === player.id)) {
      return { ok: false, ackText: "سهمت قطعی است — کاروان عجله دارد." }
    }
    if (rows.some((row) => row.roleKey === roleKey)) {
      return { ok: false, ackText: `سهمِ ${role.label} گرفته شده — یکی از سهم‌های آزاد را بردار.` }
    }
    const next = [...rows, { playerId: player.id, roleKey }]
    await db.groupExpedition.update({ where: { id: fresh.id }, data: { rolesJson: JSON.stringify(next) } })
    return { ok: true, ackText: `سهمِ ${role.label} مالِ تو — کاروان منتظرِ بقیه است.` }
  })

  // کارتِ تازه برای همه — ثبتِ یک نفر پنل را نمی‌کُشد
  const after = await openExpeditionOf(group.id, expeditionId)
  const card = after ? await currentExpeditionCard(group, after) : null
  return { ...r, cardText: card?.text ?? "", cardButtons: card?.buttons ?? [] }
}

/** حرکتِ کاروان — gx:{id}:begin (فقط خودِ سهم‌داران) */
export async function beginExpedition(
  group: GroupWorld,
  player: Player,
  expeditionId: string,
): Promise<ExpeditionActionResult> {
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, ackText: NOT_CITIZEN_MSG, ...NO_CARD }
  }
  const ex = await openExpeditionOf(group.id, expeditionId)
  if (!ex) return { ok: false, ackText: "این کاروان دیگر باز نیست.", ...NO_CARD }
  const tpl = getExpeditionTemplate(ex.templateId)
  if (!tpl) return { ok: false, ackText: "کاروانِ ناشناخته.", ...NO_CARD }
  const rows = parseExpeditionRoles(ex)
  if (!rows.some((row) => row.playerId === player.id)) {
    return { ok: false, ackText: "حرکت را فقط سهم‌دارها می‌توانند بگویند — اول سهم بگیر.", ...NO_CARD }
  }
  const distinct = new Set(rows.map((row) => row.roleKey)).size
  if (distinct < tpl.minRoles) {
    return { ok: false, ackText: `هنوز ${faNum(tpl.minRoles - distinct)} سهمِ متفاوت کم داریم.`, ...NO_CARD }
  }
  await departExpedition(group, ex, new Date())
  const after = await openExpeditionOf(group.id, expeditionId)
  const card = after ? await currentExpeditionCard(group, after) : null
  return { ok: true, ackText: "کاروان راه افتاد — کنشِ سهمت را بزن.", cardText: card?.text ?? "", cardButtons: card?.buttons ?? [] }
}

/** کنشِ سهم — gx:{id}:act؛ رولِ قطعی همین‌جا زده می‌شود و به خودِ کنشگر می‌رسد */
export async function actExpedition(
  group: GroupWorld,
  player: Player,
  expeditionId: string,
): Promise<ExpeditionActionResult> {
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, ackText: NOT_CITIZEN_MSG, ...NO_CARD }
  }
  const ex = await openExpeditionOf(group.id, expeditionId)
  if (!ex) return { ok: false, ackText: "این کاروان دیگر باز نیست.", ...NO_CARD }
  const tpl = getExpeditionTemplate(ex.templateId)
  if (!tpl) return { ok: false, ackText: "کاروانِ ناشناخته.", ...NO_CARD }

  const r = await withSectionLock(`expedition:${ex.id}`, async () => {
    const fresh = await db.groupExpedition.findUnique({ where: { id: ex.id } })
    if (!fresh || fresh.status !== "open") return { ok: false, ackText: "این کاروان دیگر باز نیست." }
    if (fresh.phase !== "act") return { ok: false, ackText: "کاروان هنوز حرکت نکرده — اول سهم‌ها کامل شود." }
    if (fresh.actEndsAt && fresh.actEndsAt.getTime() < Date.now()) {
      return { ok: false, ackText: "وقتِ کنش‌ها گذشته بود." }
    }
    const rows = parseExpeditionRoles(fresh)
    const mine = rows.find((row) => row.playerId === player.id)
    if (!mine) return { ok: false, ackText: "سهمی در این کاروان نداری — تشویق مالِ توست." }
    if (mine.actedAt) return { ok: false, ackText: "کارِ سهمِ تو انجام شده." }

    // رولِ قطعی — seed روی (کاروان، بازیکن): تکرارِ دکمه همان نتیجه را می‌دهد
    const role = tpl.roles.find((rr) => rr.key === mine.roleKey)
    if (!role) return { ok: false, ackText: "سهمِ ناشناخته." }
    const char = await db.soulCharacter.findUnique({ where: { playerId: player.id } })
    const favored = role.favoredClasses.includes(char?.classKey ?? "")
    const p = actSuccessChance(char, player.luck, favored)
    const rng = mulberry32(seedFrom("gxroll", fresh.id, player.id))
    const u = rng()
    const success = u < p
    const rollPct = Math.floor(u * 100)

    const next = rows.map((row) =>
      row.playerId === player.id ? { ...row, roll: rollPct, success, actedAt: new Date().toISOString() } : row,
    )
    await db.groupExpedition.update({ where: { id: fresh.id }, data: { rolesJson: JSON.stringify(next) } })
    const flavor = success ? role.act.successText : role.act.failText
    const synergy = favored ? " · هم‌افزاییِ کلاست کار کرد" : char ? "" : " · بدونِ فمبوی، با شانسِ خام"
    return { ok: true, ackText: `🎲 ${faNum(rollPct)} — ${flavor}${synergy}` }
  })

  // همه‌ی سهم‌دارها کنش کردند؟ حل فوری (بی‌درنگ به همه خبر می‌رسد)
  const after = await openExpeditionOf(group.id, expeditionId)
  if (after && after.phase === "act") {
    const rows = parseExpeditionRoles(after)
    if (rows.length > 0 && rows.every((row) => row.actedAt)) {
      await resolveExpedition(group, after, new Date(), "all_acted")
      return { ...r, cardText: "", cardButtons: [] } // کارتِ نتیجه خودش از outbox می‌رسد
    }
  }
  const card = after && after.phase === "act" ? await currentExpeditionCard(group, after) : null
  return { ...r, cardText: card?.text ?? "", cardButtons: card?.buttons ?? [] }
}

/** تشویق — gx:{id}:cheer؛ هر شهروندِ بیرونِ کاروان یک‌بار؛ +۲٪ تا سقفِ ۵ نفر */
export async function cheerExpedition(
  group: GroupWorld,
  player: Player,
  expeditionId: string,
): Promise<ExpeditionActionResult> {
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, ackText: NOT_CITIZEN_MSG, ...NO_CARD }
  }
  const ex = await openExpeditionOf(group.id, expeditionId)
  if (!ex) return { ok: false, ackText: "این کاروان دیگر باز نیست.", ...NO_CARD }

  const r = await withSectionLock(`expedition:${ex.id}`, async () => {
    const fresh = await db.groupExpedition.findUnique({ where: { id: ex.id } })
    if (!fresh || fresh.status !== "open") return { ok: false, ackText: "این کاروان دیگر باز نیست." }
    if (fresh.phase !== "act") return { ok: false, ackText: "کاروان هنوز حرکت نکرده — فعلاً فقط سهم‌گیری باز است." }
    const rows = parseExpeditionRoles(fresh)
    if (rows.some((row) => row.playerId === player.id)) {
      return { ok: false, ackText: "تو وسطِ کاری — تشویقِ تو یعنی همان کار کردن. کنشت را بزن." }
    }
    const cheers = parseCheers(fresh)
    if (cheers.includes(player.id)) return { ok: false, ackText: "تشویقت قبلاً رسید." }
    if (cheers.length >= 5) return { ok: false, ackText: "شهر دارد سُر و صدا می‌کند — تشویقِ بیشتر جایی ندارد." }
    await db.groupExpedition.update({ where: { id: fresh.id }, data: { cheersJson: JSON.stringify([...cheers, player.id]) } })
    return { ok: true, ackText: "تشویقت رسید — کاروان قوت گرفت." }
  })

  const after = await openExpeditionOf(group.id, expeditionId)
  const card = after && after.phase === "act" ? await currentExpeditionCard(group, after) : null
  return { ...r, cardText: card?.text ?? "", cardButtons: card?.buttons ?? [] }
}

// ─── گذارِ فازها (تیک) ─────────────────────────────────────────────────────────

/** حرکتِ کاروان — recruit → act با فلیپِ شرطی؛ کارتِ همان پیام ویرایش می‌شود */
export async function departExpedition(group: GroupWorld, ex: GroupExpedition, now = new Date()): Promise<boolean> {
  const tpl = getExpeditionTemplate(ex.templateId)
  if (!tpl) return false
  const flipped = await db.groupExpedition.updateMany({
    where: { id: ex.id, phase: "recruit", status: "open" },
    data: { phase: "act", actEndsAt: new Date(now.getTime() + tpl.actMinutes * 60000) },
  })
  if (flipped.count === 0) return false

  const fresh = await db.groupExpedition.findUnique({ where: { id: ex.id } })
  if (!fresh) return true
  const card = await currentExpeditionCard(group, fresh)
  // پنلِ اشتراکی همان پیام می‌ماند — اگر کارت هنوز تحویل نشده (messageId ندارد)،
  // هر لمسِ بعدی همان خودش را تازه می‌کند (کال‌بک‌ها کارتِ فازِ تازه برمی‌گردانند)
  await pushOutbox(group, {
    kind: "expedition",
    text: card.text,
    buttons: card.buttons,
    refType: "expedition",
    refId: fresh.id,
    priority: 8,
    ...(fresh.messageId ? { editMessageId: fresh.messageId } : {}),
  })
  return true
}

/** کاروانِ کم‌جان — سهم‌های متفاوت کافی نشد؛ honest card */
export async function abortExpedition(group: GroupWorld, ex: GroupExpedition, now = new Date()): Promise<boolean> {
  const flipped = await db.groupExpedition.updateMany({
    where: { id: ex.id, phase: "recruit", status: "open" },
    data: { status: "aborted", resolvedAt: now, outcomeJson: JSON.stringify({ reason: "not_enough_roles" }) },
  })
  if (flipped.count === 0) return false
  const rows = parseExpeditionRoles(ex)
  const text = [
    `🧭 <b>کاروانِ ${esc(group.title)} راه نیفتاد</b>`,
    emblem("🧭"),
    "",
    `سهم‌هایِ متفاوتِ کافی جمع نشد (${chip(rows.length)} سهم گرفته شد).`,
    quote("شهر این را جدی نگرفت. دفعه‌ی بعد شاید."),
    "",
    "<i>گفتنِ «مامموریت» یا «کاروان» در گروه، کاروانِ تازه می‌سازد.</i>",
  ].join("\n")
  await pushOutbox(group, {
    kind: "expedition",
    text,
    buttons: [
      { label: "🧭 کاروانِ تازه", style: "primary", cb: "gm:mission" },
      { label: "↩ خانه", style: "primary", cb: "gm:game", sameRow: true },
    ],
    refType: "expedition",
    refId: ex.id,
    priority: 5,
    ...(ex.messageId ? { editMessageId: ex.messageId } : {}),
  })
  return true
}

/** حلِ نهایی — پاداش/پیامد در یک تراکنش؛ کارتِ نتیجه همان پیام را ویرایش می‌کند */
export async function resolveExpedition(
  group: GroupWorld,
  ex: GroupExpedition,
  now = new Date(),
  reason: "time" | "all_acted" = "time",
): Promise<void> {
  const tpl = getExpeditionTemplate(ex.templateId)
  if (!tpl) return

  // داده‌ی حکم — قبل از فلیپ، از ردیفِ مرجع
  const rows = parseExpeditionRoles(ex)
  const cheers = parseCheers(ex)
  // سهم‌های بی‌کنش: لنگ ماندند — شکستِ همان سهم
  const resolvedRows = rows.map((r) => ({ ...r, success: r.success ?? false }))
  const successes = resolvedRows.filter((r) => r.success).length
  const pTeam = teamSuccessChance(successes, cheers.length)
  const u = mulberry32(seedFrom("gxteam", ex.id))()
  const success = u < pTeam
  const perfect = success && resolvedRows.length >= tpl.minRoles && resolvedRows.every((r) => r.success)

  const players = rows.length ? await db.player.findMany({ where: { id: { in: rows.map((r) => r.playerId) } } }) : []
  const playerById = new Map(players.map((p) => [p.id, p]))
  const chars = await db.soulCharacter.findMany({ where: { playerId: { in: rows.map((r) => r.playerId) } }, select: { playerId: true, classKey: true } })
  const classEmojiOf = new Map(chars.map((c) => [c.playerId, getClass(c.classKey)?.emoji ?? ""]))

  // MVP — بهترین رول میانِ کنش‌های موفق
  let mvpId: string | null = null
  let mvpRoll = -1
  for (const r of resolvedRows) {
    if (r.success && typeof r.roll === "number" && r.roll > mvpRoll) {
      mvpRoll = r.roll
      mvpId = r.playerId
    }
  }
  const mvpName = mvpId ? playerById.get(mvpId)?.name ?? null : null

  const treasuryGain = randInt(tpl.reward.treasury[0], tpl.reward.treasury[1], mulberry32(seedFrom("gxtreas", ex.id)))
  const eachGain = randInt(tpl.reward.eachPlayer[0], tpl.reward.eachPlayer[1], mulberry32(seedFrom("gxeach", ex.id)))
  const eachFail = randInt(tpl.reward.failPlayer[0], tpl.reward.failPlayer[1], mulberry32(seedFrom("gxfail", ex.id)))

  // کارتِ نتیجه — کنشِ تک‌تک با متنِ خودش
  const holders = resolvedRows.map((r) => {
    const role = tpl.roles.find((rr) => rr.key === r.roleKey)!
    return {
      roleKey: r.roleKey,
      name: playerById.get(r.playerId)?.name ?? "؟",
      success: Boolean(r.success),
      neverActed: !r.actedAt,
      successText: `${role.emoji} <b>${esc(playerById.get(r.playerId)?.name ?? "؟")}</b> — ${role.act.successText}`,
      failText: `${role.emoji} <b>${esc(playerById.get(r.playerId)?.name ?? "؟")}</b> — ${role.act.failText}`,
    }
  })
  const resultText = expeditionResultCardText(tpl, holders, {
    success,
    perfect,
    treasury: success ? treasuryGain : 0,
    each: success ? eachGain : eachFail,
    cheers: cheers.length,
    mvpName,
  })

  await db.$transaction(
    async (tx) => {
      // فلیپِ حل — تیک و «آخرین کنش» فقط یک‌بار حکم می‌دهند
      const flipped = await tx.groupExpedition.updateMany({
        where: { id: ex.id, status: "open", phase: "act" },
        data: {
          status: "done",
          resolvedAt: now,
          outcomeJson: JSON.stringify({ success, perfect, successes, cheers: cheers.length, mvpId, reason }),
        },
      })
      if (flipped.count === 0) return

      // پاداشِ هر سهم‌دار — تنها از awards.ts (سقفِ XP روزانه همان‌جا پاسداری می‌شود)
      for (const r of resolvedRows) {
        const player = playerById.get(r.playerId)
        if (!player) continue
        const gain = success ? eachGain : eachFail
        await awardPlayerStat(tx, player, "money", gain, { moneyCategory: "reward", moneyNote: `کاروانِ شهر: ${tpl.title}` })
        if (player.telegramId) {
          await awardSoulProgress(tx, player.telegramId, {
            soulXp: success ? tpl.reward.soulXp : tpl.reward.failSoulXp,
            reason: `کاروانِ شهر: ${tpl.title}`,
          })
        }
      }

      // MVP — آبروی شهر + شانسِ عنوان
      if (success && mvpId) {
        const member = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: mvpId } } })
        if (member) {
          await tx.groupMember.update({ where: { id: member.id }, data: { winCount: { increment: 1 } } })
          if (!member.title) {
            await tx.groupMember.update({ where: { id: member.id }, data: { title: "🎖 ستاره‌ی کاروان" } })
          }
        }
      }

      // صندوق + روابطِ کاری — هم‌سفرها هم‌بسته می‌شوند
      if (success) {
        await tx.groupWorld.update({ where: { id: group.id }, data: { treasury: { increment: treasuryGain } } })
      }
      const ids = resolvedRows.slice(0, 12).map((r) => r.playerId)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          await adjustRelationship(tx, group.id, ids[i]!, ids[j]!, "cooperation", 2)
        }
      }

      // حافظه/خبر/تاریخ — شهر قصه‌اش را نگه می‌دارد
      await tx.groupMemory.create({
        data: {
          groupId: group.id,
          kind: perfect ? "legend" : success ? "victory" : "moment",
          text: `کاروانِ ${tpl.title} — ${success ? (perfect ? "بی‌نقص" : "موفق") : "نصفه‌کاره"} (${resolvedRows.length} سهم)`,
          originPlayerId: mvpId,
          importance: perfect ? 95 : success ? 75 : 50,
        },
      })
      await addNewsTx(tx, group.id, tpl.emoji, `کاروانِ ${tpl.title} ${success ? "برگشت و برداشت" : "برگشت — بدونِ حرفِ جدید"}`)
      await addHistoryTx(
        tx,
        group.id,
        tpl.emoji,
        `کاروانِ ${tpl.title} ${success ? (perfect ? "بی‌نقص تمام شد" : "موفق بود") : "ناکام ماند"} — ${resolvedRows.length} سهم، ${cheers.length} تشویق${mvpName ? `، بهترین: ${mvpName}` : ""}`,
        perfect ? 90 : success ? 75 : 55,
      )

      // شمارنده‌های فرهنگ — همکاریِ واقعی، نه رویدادِ همکارانه‌ی عمومی
      await bumpCulture(tx, group.id, {
        expeditions: 1,
        cooperation: 1,
        ...(perfect ? { perfectExpeditions: 1 } : {}),
        expReadyAt: new Date(now.getTime() + tpl.cooldownMinutes * 60000).toISOString(),
      })
      // دستاورد با ردیفِ تازه چک می‌شود — bumpCulture بالا در همین tx نوشته؛
      // groupِ دست‌کهد شمارنده‌ی تازه را نمی‌بیند (الگوی ردیفِ تازه‌ی resolveEvent)
      const freshGroup = await tx.groupWorld.findUnique({ where: { id: group.id } })
      if (freshGroup) await checkAchievementsTx(tx, freshGroup)

      // کارتِ نتیجه — همان پیامِ کاروان (پنل تا آخرِ عمرش یکی می‌ماند)
      await pushOutboxTx(tx, group, {
        kind: "expedition",
        text: resultText,
        buttons: [],
        refType: "expedition",
        refId: ex.id,
        priority: 7,
        ...(ex.messageId ? { editMessageId: ex.messageId } : {}),
      })
    },
    { timeout: 15000 },
  )
}

/** تیکِ کاروان‌های باز — گذارِ فاز و سرآمدی (tick.ts فازِ ۲.۵ صدا می‌زند) */
export async function tickExpeditions(group: GroupWorld, now = new Date()): Promise<void> {
  const open = await db.groupExpedition.findFirst({ where: { groupId: group.id, status: "open" } })
  if (!open) return
  if (open.phase === "recruit") {
    if (open.recruitEndsAt.getTime() > now.getTime()) return
    const tpl = getExpeditionTemplate(open.templateId)
    const distinct = new Set(parseExpeditionRoles(open).map((r) => r.roleKey)).size
    if (tpl && distinct >= tpl.minRoles) await departExpedition(group, open, now)
    else await abortExpedition(group, open, now)
  } else if (open.phase === "act") {
    const rows = parseExpeditionRoles(open)
    const allActed = rows.length > 0 && rows.every((r) => r.actedAt)
    if (allActed || (open.actEndsAt && open.actEndsAt.getTime() <= now.getTime())) {
      await resolveExpedition(group, open, now, allActed ? "all_acted" : "time")
    }
  }
}

// ─── فرمانِ «مامموریت/کاروان» — کارتِ فعلی یا کاروانِ تازه ─────────────────────

export async function missionCommandCard(group: GroupWorld): Promise<{ text: string; buttons: OutboxButton[]; spawned: boolean }> {
  const open = await db.groupExpedition.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) {
    const card = await currentExpeditionCard(group, open)
    return { text: card.text, buttons: card.buttons, spawned: false }
  }
  const fresh = await db.groupWorld.findUnique({ where: { id: group.id } })
  const c = cultureOf(fresh ?? group)
  const readyAt = typeof c.expReadyAt === "string" ? new Date(c.expReadyAt) : null
  const members = await activeMembers(group.id, 96)
  if (readyAt && readyAt.getTime() > Date.now()) {
    const mins = Math.ceil((readyAt.getTime() - Date.now()) / 60000)
    return {
      text: [
        "🧭 <b>کاروانی در راه نیست</b>",
        emblem("🧭"),
        "",
        `شهر تازه از یک کاروان برگشته — جان می‌گیرد و دوباره می‌رود.`,
        "",
        `⏳ کاروانِ بعدی: حدود ${chip(mins)} دقیقه‌ی دیگر.`,
        "",
        quote("هیچ‌کس عجله ندارد. جاده همان‌جا است."),
      ].join("\n"),
      buttons: [
        { label: "🎲 بازی گروهی", style: "primary", cb: "gm:play" },
        { label: "↩ خانه", style: "primary", cb: "gm:game", sameRow: true },
      ],
      spawned: false,
    }
  }
  if (members.length < 3) {
    return {
      text: "🧭 کاروان با کمتر از ۳ شهروندِ فعال راه نمی‌افتد — جاده با دو نفر فقط پیاده‌روی است.",
      buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }],
      spawned: false,
    }
  }
  const ex = await spawnExpedition(group, { priority: 8 })
  if (!ex) {
    return {
      text: "🧭 کاروانِ تازه الان ممکن نیست — دفترِ شهر جوابِ روشنی ندارد. کمی بعد دوباره بگو.",
      buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }],
      spawned: false,
    }
  }
  return { text: "", buttons: [], spawned: true } // کارت از طریق outbox می‌رود
}

/** مهلتِ کاروانِ بعدی — برای خطِ «در راه»ی کارتِ خانه (انتظار) */
export function expeditionCooldownLabel(group: GroupWorld, now = new Date()): string | null {
  const c = cultureOf(group)
  const readyAt = typeof c.expReadyAt === "string" ? new Date(c.expReadyAt) : null
  if (!readyAt || readyAt.getTime() <= now.getTime()) return null
  return `کاروانِ بعدی ${remainChip(readyAt.toISOString())}`
}
