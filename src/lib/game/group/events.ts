// FEMBOY WAR — V5: موتورِ رویدادهای گروهی — قالب → رندر → کارت → انتخاب → عاقبت.
// هر رویداد عواقبِ واقعی دارد: پول/صندوق/رابطه/اعتبار/حافظه/شایعه/سرنخ/پیگیری.

import { db } from "@/lib/db"
import type { GroupWorld, GroupEvent, Player } from "@prisma/client"
import { ITEMS } from "../content"
import { NPCS } from "../content"
import { mulberry32, seedFrom, weightedPick, randInt, pickOne, clamp } from "../rng"
import type { GroupEventTemplate, GroupOutcomeTemplate, OutboxButton } from "./types"
import { GROUP_EVENT_TEMPLATES } from "./content"
import {
  esc, parseJson, pushOutbox, pushOutboxTx, addHistoryTx, addNewsTx,
  activeMembers, bumpCulture, checkAchievementsTx, cultureOf,
} from "./domain"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { awardPlayerStat, awardSoulProgress } from "./awards"
import { adjustRelationship, adjustMemberRep } from "./social"
import { revealMysteryClueTx } from "./world"
import { resolveStyleShowEvent, STYLE_SHOW_ID } from "./style"
import { eventWindowMinutes, eventWindowLine, pacingOf } from "./pacing"
import { SUB, DOTS, chip, spoiler, expand, quote, emblem, toLatinDigits } from "./text"

export type Tx = import("@prisma/client").Prisma.TransactionClient

// ─── انتخاب قالب ───────────────────────────────────────────────────────────────

/** هم‌خوانی نوعِ رویداد با فرهنگِ گروه — هر شهر به مزه‌ی خودش */
const KIND_CULTURE_AFFINITY: Record<string, string[]> = {
  chaos: ["chaotic", "comedic"],
  meme: ["comedic", "chaotic"],
  competition: ["competitive"],
  cooperative: ["peaceful", "social"],
  social: ["social", "peaceful"],
  economic: ["criminal", "competitive"],
  political: ["competitive", "social"],
  mystery: ["mysterious"],
  world: ["mysterious", "chaotic"],
  npc: ["social"],
  group: ["social"],
  personal: ["unset"],
}

/** tag های قالب با tag های پروژه‌های ساخته‌شده/فرهنگ تقویت می‌شوند */
export async function pickEventTemplate(
  group: GroupWorld,
  memberCount: number,
  opts: { kind?: string; tag?: string } = {},
): Promise<GroupEventTemplate | null> {
  const rng = mulberry32(seedFrom("gepick", group.id, Date.now()))
  const since = new Date(Date.now() - 6 * 3600000)
  const recent = await db.groupEvent.findMany({
    where: { groupId: group.id, createdAt: { gte: since } },
    select: { templateId: true, createdAt: true },
  })
  const cultureTag = group.cultureTag
  const c = cultureOf(group)
  const projBoost = collectProjectBoosts(group)
  const pollBias = collectPollBias(group)

  const candidates = GROUP_EVENT_TEMPLATES.filter((t) => {
    if (t.minMembers > memberCount) return false
    if (opts.kind && t.kind !== opts.kind) return false
    if (opts.tag && !t.tags.includes(opts.tag)) return false
    // کول‌داونِ قالب در همین گروه
    const last = recent.filter((r) => r.templateId === t.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    if (last && Date.now() - last.createdAt.getTime() < t.cooldownMinutes * 60000) return false
    return true
  }).map((t) => {
    let w = t.weight
    const affinity = KIND_CULTURE_AFFINITY[t.kind] ?? []
    if (cultureTag !== "unset" && affinity.includes(cultureTag)) w *= 1.6
    for (const tag of t.tags) {
      if (projBoost[tag]) w *= projBoost[tag]!
      if (pollBias[tag]) w *= pollBias[tag]!
      if (c[`tag:${tag}`] && typeof c[`tag:${tag}`] === "number") w *= 1 + 0.05 * Math.min(8, (c[`tag:${tag}`] as number) ?? 0)
    }
    return { templateId: t.id, weight: w }
  })

  if (candidates.length === 0) return null
  const chosen = weightedPick(candidates, rng)
  if (!chosen) return null
  return GROUP_EVENT_TEMPLATES.find((t) => t.id === chosen.templateId) ?? null
}

function collectProjectBoosts(group: GroupWorld): Record<string, number> {
  // اثر پروژه‌های ساخته‌شده در culture ذخیره شده: projBoost:{tag} = mult
  const c = cultureOf(group)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith("projBoost:") && typeof v === "number") out[k.slice("projBoost:".length)] = v
  }
  return out
}

/** V27 — سوگیریِ موقتِ همه‌پرسی: pollBias:{tag} = ISO انقضا؛ تا وقتی زنده است
 *  وزنِ رویدادهایِ آن tag ×1.35 می‌شود. خواندنِ زمان‌آگاه — کلیدِ مُرده اثری
 *  ندارد و در نوشتنِ بعدی جای خود را می‌دهد. */
function collectPollBias(group: GroupWorld, now = new Date()): Record<string, number> {
  const c = cultureOf(group)
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith("pollBias:") && typeof v === "string") {
      const until = new Date(v)
      if (!Number.isNaN(until.getTime()) && until.getTime() > now.getTime()) {
        out[k.slice("pollBias:".length)] = 1.35
      }
    }
  }
  return out
}

export function getEventTemplate(templateId: string): GroupEventTemplate | undefined {
  return GROUP_EVENT_TEMPLATES.find((t) => t.id === templateId)
}

// ─── رندر متغیرها ──────────────────────────────────────────────────────────────

export interface RenderVars {
  p1: string
  p2: string
  p3: string
  npc: string
  item: string
  amount: number
  group: string
  day: number
}

/** id های بازیکن‌های نقش‌ها — نام‌ها یکتا نیستند، id هست */
export interface RenderVarsIds extends RenderVars {
  p1Id: string | null
  p2Id: string | null
  p3Id: string | null
}

export function renderVars(group: GroupWorld, players: Player[], instigator?: Player, bonded?: { aId: string; bId: string } | null): RenderVarsIds {
  const rng = mulberry32(seedFrom("rendervars", group.id, Date.now()))
  const shuffled = [...players].sort(() => rng() - 0.5)
  const p1p = instigator ?? shuffled[0] ?? null
  let p2p = shuffled.find((p) => p.id !== p1p?.id) ?? null
  let p3p = shuffled.find((p) => p.id !== p1p?.id && p.id !== p2p?.id) ?? null
  // V27 — پیوندهای واقعی: وقتی شهر رابطه‌ی زنده‌ای (رقابت/دوستی) دارد، {p2}/{p3}
  // همان زوج است و بدونِ محرک، {p1} خودِ یکی از آن دو — روایت‌های ۱۱۱قالبی
  // حالا به روابطِ واقعیِ بازیکن‌ها اشاره می‌کنند، نه به قرعه‌ی خام.
  if (bonded) {
    const a = players.find((p) => p.id === bonded.aId) ?? null
    const b = players.find((p) => p.id === bonded.bId) ?? null
    if (a && b) {
      if (!instigator) {
        // بدونِ محرک، زوجِ پیوسته خودش قهرمانِ روایت است: {p1}/{p2} همان زوج؛
        // {p3} رهگذرِ سومِ تصادفی می‌ماند (نه دوبارِ همان آدم)
        const [first, second] = rng() < 0.5 ? [a, b] : [b, a]
        const third = shuffled.find((p) => p.id !== first.id && p.id !== second.id) ?? null
        return {
          p1: first.name,
          p2: second.name,
          p3: third?.name ?? "رهگذر",
          p1Id: first.id,
          p2Id: second.id,
          p3Id: third?.id ?? null,
          npc: pickOne(NPCS, rng).name,
          item: pickOne(ITEMS, rng).name,
          amount: randInt(400, 9000, rng),
          group: group.title,
          day: Math.floor((Date.now() - new Date(group.createdAt).getTime()) / 86400000) + 1,
        }
      }
      // با محرک: {p2}/{p3} خودِ زوج است — روایت حولِ محرک و پیوندش می‌چرخد
      p2p = a
      p3p = b
    }
  }
  return {
    p1: p1p?.name ?? "یک شهروند",
    p2: p2p?.name ?? "همسایه‌ی ناشناس",
    p3: p3p?.name ?? "رهگذر",
    p1Id: p1p?.id ?? null,
    p2Id: p2p?.id ?? null,
    p3Id: p3p?.id ?? null,
    npc: pickOne(NPCS, rng).name,
    item: pickOne(ITEMS, rng).name,
    amount: randInt(400, 9000, rng),
    group: group.title,
    day: Math.floor((Date.now() - new Date(group.createdAt).getTime()) / 86400000) + 1,
  }
}

/** V27 — زوجِ پیوسته‌ی واقعی این شهر: برای روایت‌های پرقابل (رقابت) یا
 *  اجتماع‌گرا (دوستی)، بالاترین رابطه‌ی زندهٔ میانِ اعضای فعال. خالصِ DB —
 *  حداقل ۱۵ امتیاز تا داستان‌سازی روی رابطه‌ی واقعی سوار شود. */
export async function pickBondedPair(
  groupId: string,
  kind: string,
  playerIds: string[],
): Promise<{ aId: string; bId: string } | null> {
  if (playerIds.length < 2) return null
  const wantRivalry = ["chaos", "competition", "meme", "political"].includes(kind)
  const order = wantRivalry ? { rivalry: "desc" as const } : { friendship: "desc" as const }
  const rows = await db.playerRelationship.findMany({
    where: { groupId, aId: { in: playerIds }, bId: { in: playerIds } },
    orderBy: order,
    take: 8,
  })
  for (const r of rows) {
    const score = wantRivalry ? r.rivalry : r.friendship
    if (score >= 15) return { aId: r.aId, bId: r.bId }
  }
  return null
}

export function render(text: string, v: RenderVars): string {
  // V11: {amount}/{day} با تراشِ مونو می‌روند (LTR و خوانا در RTL)؛ نام‌ها esc.
  // این خروجی فقط به بافت‌های HTML می‌رود (کارت‌ها/تاریخچه/حافظه) — نه برچسبِ دکمه.
  return text
    .replace(/\{p1\}/g, esc(v.p1))
    .replace(/\{p2\}/g, esc(v.p2))
    .replace(/\{p3\}/g, esc(v.p3))
    .replace(/\{npc\}/g, esc(v.npc))
    .replace(/\{item\}/g, esc(v.item))
    .replace(/\{amount\}/g, chip(v.amount))
    .replace(/\{group\}/g, esc(v.group))
    .replace(/\{day\}/g, chip(v.day))
}

// ─── کارتِ رویداد ──────────────────────────────────────────────────────────────

export interface EventCardParticipants {
  playerId: string
  name: string
  choiceLabel: string
  /** V17-W3 (W3-F2) — کلیدِ خامِ انتخاب؛ snapshot بدونِ کوئریِ اضافه myChoice را
   *  از همین فهرست برمی‌دارد (همان داده‌ای که کارتِ گروه می‌سازد) */
  choiceKey: string
}

export function eventCardText(
  event: GroupEvent,
  participants: EventCardParticipants[],
  now = new Date(),
): string {
  // title/body/label ذخیره‌شده از render() می‌آیند (HTML-safe در نوشتن) — بدون esc دوباره؛
  // نامِ بازیکن خام است → esc در همین‌جا (لایه‌ی امنیت: domain.ts)
  //
  // V26 (بازسازی §4.A/§4.B — کارتِ رویدادِ گروهی): ساختارِ معناییِ صریح به‌جای
  // دیوارِ متن — روایتِ بلند زیرِ پرده‌ی expand جمع می‌شود (نویزِ چتِ پرحرف)؛
  // رستری از انتخاب‌ها با سقفِ ۵ + شمارنده؛ خطِ «یک انتخاب» قاعده‌ی مشارکت را
  // از همان کارت می‌گوید (eligible بودن / دوبله‌کردن)؛ مهلت زیرِ quote.
  const bodyBlock = event.body.length > 280 ? expand(event.body) : event.body
  const shown = participants.slice(0, 5)
  const rest = participants.length - shown.length
  const roster =
    participants.length > 0
      ? `\n\n${DOTS}\n\n👥 <b>که انتخاب کرده‌اند</b> (${chip(participants.length)}):\n${shown.map((p) => `▪ <b>${esc(p.name)}</b> ← ${p.choiceLabel}`).join("\n")}${rest > 0 ? `\n<i>… و ${chip(rest)} نفرِ دیگر</i>` : ""}`
      : ""
  const windowLine = eventWindowLine(event.expiresAt, now)
  const windowBlock = windowLine ? `\n\n${quote(windowLine)}` : ""
  // فشرده‌سازیِ سطرهای خالیِ پشت‌سرهم (الگوی challengeResultCardText) — ریتمِ
  // «شیشه» حفظ می‌شود ولی دیوارِ خالی نمی‌افتد وقتی roster/window خالی‌اند
  const parts = [
    `<b>${event.emoji} ${event.title}</b>`,
    emblem(event.emoji),
    "",
    bodyBlock,
    roster,
    windowBlock,
    "",
    "<i>هر شهروندِ این شهر یک انتخاب دارد — نتیجه برای خودش؛ شهر نتیجه‌ی جمعی را هم خواهد دید.</i>",
  ]
  const lines: string[] = []
  for (const s of parts) {
    if (s === "" && lines[lines.length - 1] === "") continue
    lines.push(s)
  }
  return lines.join("\n")
}

export function eventCardButtons(event: GroupEvent): OutboxButton[] {
  const choices = parseJson<{ key: string; label: string; style: string | null }[]>(event.choicesJson, [])
  // برچسبِ دکمه = PLAIN (توست/دکمه parse_mode ندارند) — متنِ ذخیره‌شده HTML-safe است؛
  // موجودیت‌های HTML برای دکمه به متنِ خام برمی‌گردند + ارقام لاتین. cb دست‌نخورده.
  const plain = (s: string) =>
    toLatinDigits(s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"))
  return choices.map((c) => ({
    label: plain(c.label),
    style: (c.style as "primary" | "success" | "danger" | null) ?? null,
    cb: `ge:${event.id}:${c.key}`,
  }))
}

// ─── ساختِ رویداد ─────────────────────────────────────────────────────────────

export interface SpawnEventOpts {
  templateId?: string
  instigator?: Player
  priority?: number
  expiresMinutes?: number
}

export async function spawnGroupEvent(group: GroupWorld, opts: SpawnEventOpts = {}): Promise<GroupEvent | null> {
  // فقط یک رویداد باز در هر گروه
  const open = await db.groupEvent.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return null

  // V18 — دروازه‌ی ریتمِ هوشمند: تک‌نگهبانِ تولدِ هر ماجراست (خودجوشِ تیک،
  // پیگیریِ زمان‌بندی‌شده و فرمانِ شهروند). شهر عجله ندارد: حداقلِ ۲ ساعت و
  // ۱۰۰ پیامِ گفت‌وگو از آخرین ماجراست (یا در شهرِ آرام: ۶ ساعت و ۳۰ پیام).
  // ردیفِ تازه خوانده می‌شود چون groupِ دست‌کهد ممکن است از لحظه‌ی تیک کهنه باشد.
  const fresh = await db.groupWorld.findUnique({ where: { id: group.id } })
  const pacing = pacingOf(fresh ?? group)
  if (!pacing.gateOpen) return null

  const members = await activeMembers(group.id, 96)
  const template =
    (opts.templateId ? getEventTemplate(opts.templateId) : undefined) ??
    (await pickEventTemplate(group, members.length))
  if (!template) return null

  const players = members.map((m) => m.player)
  const bonded = await pickBondedPair(group.id, template.kind, players.map((p) => p.id))
  const v = renderVars(group, players, opts.instigator, bonded)

  const event = await db.groupEvent.create({
    data: {
      groupId: group.id,
      templateId: template.id,
      kind: template.kind,
      title: render(template.title, v),
      body: render(template.body, v),
      emoji: template.emoji,
      choicesJson: JSON.stringify(template.choices.map((c) => ({ key: c.key, label: render(c.label, v), style: c.style }))),
      payloadJson: JSON.stringify({ ...v, tags: template.tags }),
      // V18 — پنجره‌ی جنس‌به‌جنس (۴۵ تا ۱۲۰ دقیقه؛ پیش‌فرض ۷۵) — جایگزینِ ۱۰ دقیقه‌ی دیروز
      expiresAt: new Date(Date.now() + (opts.expiresMinutes ?? eventWindowMinutes(template.kind)) * 60000),
    },
  })

  await pushOutbox(group, {
    kind: "event",
    text: eventCardText(event, []),
    buttons: eventCardButtons(event),
    refType: "event",
    refId: event.id,
    priority: opts.priority ?? 7,
  })
  // V18 — ریتم: تولدِ ماجرا شمارنده‌ی پیام‌های بعد از ماجرایِ قبل را صفر می‌کند
  // (bumpCulture جمعی است؛ صفر کردن = منفیِ مقدارِ فعلی)
  if (pacing.msgsSince > 0) {
    await bumpCulture(db, group.id, { msgsSinceEvent: -pacing.msgsSince })
  }
  await db.groupWorld.update({ where: { id: group.id }, data: { lastEventAt: new Date() } })
  return event
}

// ─── انتخابِ گزینه ─────────────────────────────────────────────────────────────

export interface ChooseEventResult {
  ok: boolean
  ackText: string
  cardText: string
  /** V15-3 — دکمه‌هایِ کارتِ رویدادِ اشتراکی: بعد از ثبتِ انتخابِ یک شهروند،
   *  دکمه‌هایِ انتخاب رویِ همان پیام می‌مانند تا بقیه هم از همان پنل انتخاب کنند
   *  (مأموریت §3B — ثبتِ یک نفر پنل را برای همه نمی‌کُشد). */
  cardButtons: OutboxButton[]
}

export async function chooseEventOption(
  group: GroupWorld,
  player: Player,
  eventId: string,
  choiceKey: string,
): Promise<ChooseEventResult> {
  // دروازه‌ی شهروندی (V13 موج ۱ / safety.ts) — انتخابِ اتفاق فقط برای شهروندهایِ ثبت‌شده؛
  // همان سبک/متنِ دروازه‌های joinGame/castVote
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, ackText: NOT_CITIZEN_MSG, cardText: "", cardButtons: [] }
  }
  const event = await db.groupEvent.findFirst({ where: { id: eventId, groupId: group.id, status: "open" } })
  if (!event) return { ok: false, ackText: "این اتفاق دیگه باز نیست.", cardText: "", cardButtons: [] }
  if (event.expiresAt && event.expiresAt.getTime() < Date.now()) {
    return { ok: false, ackText: "وقتِ این اتفاق تمام شده بود.", cardText: "", cardButtons: [] }
  }
  const choices = parseJson<{ key: string; label: string; style: string | null }[]>(event.choicesJson, [])
  const choice = choices.find((c) => c.key === choiceKey)
  if (!choice) return { ok: false, ackText: "چنین گزینه‌ای نبود.", cardText: "", cardButtons: [] }

  const existing = await db.groupEventParticipant.findUnique({ where: { eventId_playerId: { eventId, playerId: player.id } } })
  if (existing)
    return {
      ok: false,
      ackText: "انتخابت ثبت شده. شهر عجله ندارد.",
      cardText: eventCardText(event, await participantsOf(event)),
      cardButtons: eventCardButtons(event),
    }

  try {
    await db.groupEventParticipant.create({ data: { eventId, playerId: player.id, choiceKey } })
  } catch (e) {
    // دو کلیکِ هم‌زمان — انتخابِ تکراری با پیامِ شهر جا می‌ماند، نه با خطای ۵۰۰
    if ((e as { code?: string }).code === "P2002") {
      return {
        ok: false,
        ackText: "انتخابت قبلاً ثبت شده. شهر عجله ندارد.",
        cardText: eventCardText(event, await participantsOf(event)),
        cardButtons: eventCardButtons(event),
      }
    }
    throw e
  }

  const parts = await participantsOf(event)
  return {
    ok: true,
    ackText: "ثبت شد. عاقبتش را در پایانِ کارت ببین.",
    cardText: eventCardText(event, parts),
    cardButtons: eventCardButtons(event),
  }
}

export async function participantsOf(event: GroupEvent): Promise<EventCardParticipants[]> {
  const rows = await db.groupEventParticipant.findMany({ where: { eventId: event.id }, orderBy: { createdAt: "asc" } })
  if (rows.length === 0) return []
  const players = await db.player.findMany({ where: { id: { in: rows.map((r) => r.playerId) } } })
  const nameOf = new Map(players.map((p) => [p.id, p.name]))
  const choices = parseJson<{ key: string; label: string }[]>(event.choicesJson, [])
  const labelOf = new Map(choices.map((c) => [c.key, c.label]))

  return rows.map((r) => ({ playerId: r.playerId, name: nameOf.get(r.playerId) ?? "؟", choiceLabel: labelOf.get(r.choiceKey) ?? r.choiceKey, choiceKey: r.choiceKey }))
}

// ─── عاقبت‌ها ──────────────────────────────────────────────────────────────────

interface ResolvedParticipant {
  playerId: string
  name: string
  outcomeText: string
}

/** حالتِ پایانیِ رویداد — resolveGroupEvent با «resolved» می‌بندد؛
 *  بستنِ زودهنگام (انتخابِ همه) هم resolved است؛ فقط سرآمدگیِ وقت (expireOpenEvents)
 *  از بیرون «expired» می‌فرستد (موج ۱) — عواقب/کارت‌ها در هر دو حالت یکسان اعمال می‌شوند. */
export interface ResolveEventOpts {
  endStatus?: "resolved" | "expired"
  /** برچسبِ ماشینیِ دلیل در outcomeJson (مثلاً "time_expired") — فقط برایِ حسابرسی */
  reason?: string
}

/** بستنِ رویداد — عواقبِ فردی + پیامِ نتیجه + تاریخ؛ همه در یک تراکنشِ واقعی.
 *  نمایشِ استایل همیشه «resolved» می‌ماند: پنجره‌ی ۱۵دقیقه‌ایِ او طراحیِ حل است، نه سرآمدگی. */
export async function resolveGroupEvent(event: GroupEvent, now = new Date(), opts: ResolveEventOpts = {}): Promise<void> {
  if (event.status !== "open") return
  const group = await db.groupWorld.findUnique({ where: { id: event.groupId } })
  if (!group) return
  // نمایشِ استایل — رویدادِ بیلدخوانِ فمبوی: قضاوت با بیلد است، نه با گزینه/رأی؛
  // مسیرِ حلِ خودش را دارد (داورها، امتیازِ آماری + هویت، جوایز، کارتِ نتیجه)
  if (event.templateId === STYLE_SHOW_ID) {
    await resolveStyleShowEvent(event, group, now)
    return
  }
  const template = getEventTemplate(event.templateId)
  const parts = await db.groupEventParticipant.findMany({ where: { eventId: event.id } })
  const players = parts.length ? await db.player.findMany({ where: { id: { in: parts.map((p) => p.playerId) } } }) : []
  const playerById = new Map(players.map((p) => [p.id, p]))

  const payload = parseJson<RenderVarsIds & { tags: string[] }>(event.payloadJson, {
    p1: "شهروند", p2: "همسایه", p3: "رهگذر", npc: "آرش", item: "ریبون", amount: 1000, group: group.title, day: 1,
    p1Id: null, p2Id: null, p3Id: null, tags: [],
  })

  const choices = parseJson<{ key: string; label: string }[]>(event.choicesJson, [])
  const labelOf = new Map(choices.map((c) => [c.key, c.label]))

  const resolved: ResolvedParticipant[] = []
  const clueTargets: { playerId: string; clue: string }[] = []

  // گزینه‌ی برنده (بیشترین رأی) — عواقبِ جمعی
  let winningKey = ""
  let winningCount = 0
  const tally = new Map<string, number>()
  for (const p of parts) tally.set(p.choiceKey, (tally.get(p.choiceKey) ?? 0) + 1)
  for (const [k, n] of tally) if (n > winningCount) { winningKey = k; winningCount = n }

  const winningChoice = template?.choices.find((c) => c.key === winningKey)
  const winningOutcome =
    winningChoice
      ? weightedPick(winningChoice.outcomes, mulberry32(seedFrom("gewin", event.id))) ?? winningChoice.outcomes[0]!
      : null

  // عواقبِ فردی — متن‌ها خالص حساب می‌شوند تا فلیپِ شرطی با داده‌ی کامل اول بیفتد
  const perParticipant: { player: Player; outcome: GroupOutcomeTemplate }[] = []
  for (const p of parts) {
    const player = playerById.get(p.playerId)
    if (!player || !template) continue
    const choice = template.choices.find((c) => c.key === p.choiceKey)
    if (!choice) continue
    const outcome = weightedPick(choice.outcomes, mulberry32(seedFrom("geo", event.id, p.playerId))) ?? choice.outcomes[0]!
    resolved.push({ playerId: p.playerId, name: player.name, outcomeText: render(outcome.text, { ...payload, p1: player.name }) })
    perParticipant.push({ player, outcome })
  }

  await db.$transaction(
    async (tx) => {
      // قفلِ حل: فلیپِ شرطی اول — تیکِ ۴۵ثانیه‌ای و کال‌بکِ هم‌زمان فقط یک‌بار عاقبت می‌دهند
      const flipped = await tx.groupEvent.updateMany({
        where: { id: event.id, status: "open" },
        data: {
          status: opts.endStatus ?? "resolved",
          resolvedAt: now,
          outcomeJson: JSON.stringify({ resolved, winningKey, winningCount, ...(opts.reason ? { reason: opts.reason } : {}) }),
        },
      })
      if (flipped.count === 0) return

      // عواقبِ فردی — برای هر شرکت‌کننده، داخلِ همان تراکنش
      for (const pp of perParticipant) {
        if (!template) continue
        await applyOutcomeEffects(tx, group, event, template, pp.outcome, pp.player, payload, clueTargets)
        // V14 — شرکت‌کننده‌ی رویدادِ شهر: +8 XP به فمبویش (سقفِ روزانه در awards.ts؛
        // بعد از فلیپِ شرطی → دقیقاً-یک‌بار). جراحیِ موجِ 15a — کارت از presentation می‌آید.
        if (pp.player.telegramId) {
          await awardSoulProgress(tx, pp.player.telegramId, { soulXp: 8, reason: `رویدادِ شهر: ${event.title}` })
        }
      }

      // عواقبِ جمعیِ گزینه‌ی برنده — صندوق/مود/حافظه/خبر/شایعه/رابطه‌های کل
      if (winningOutcome) {
        await applyCollectiveEffects(tx, group, event, winningOutcome, payload)
      }

      const closeText = buildResultText(event, resolved, winningOutcome ? render(winningOutcome.text, payload) : null, labelOf.get(winningKey) ?? "")
      await pushOutboxTx(tx, group, { kind: "event", text: closeText, priority: 6, refType: "event", refId: event.id })

      await addHistoryTx(tx, group.id, event.emoji, `${event.title} — ${parts.length} شرکت‌کننده${winningCount ? `، برنده: «${labelOf.get(winningKey)}»` : ""}`, 60)
      // ↑ متنِ title/label از render() می‌آید (HTML-safe در نوشتن) — بدون esc دوباره

      // شمارنده‌های فرهنگ
      const tagCounters: Record<string, number | string> = { eventsResolved: 1 }
      if (template) {
        if (template.kind === "chaos") tagCounters.chaosEvents = 1
        if (template.kind === "cooperative") tagCounters.cooperation = 1
        if (template.kind === "competition") tagCounters.competitions = 1
        if (template.kind === "mystery") tagCounters.mystery = 1
        if (template.kind === "economic") tagCounters.trades = 1
        if (template.kind === "meme") tagCounters.memes = 1
        if (template.kind === "world") tagCounters.mystery = 1
        for (const tag of template.tags) tagCounters[`tag:${tag}`] = 1
      }
      await bumpCulture(tx, group.id, tagCounters)

      // دستاوردِ اولین اتفاق
      await checkAchievementsTx(tx, group)

      // سرنخ‌های نامتقارن — فقط برای یابنده، در پی‌وی (V11: سرنخ زیرِ اسپویلر)
      for (const t of clueTargets) {
        const player = playerById.get(t.playerId)
        if (!player?.telegramId) continue
        await pushOutboxTx(tx, group, {
          kind: "clue",
          text: `🕯 <b>سرنخ</b>\n${emblem("🕯")}\n\n${spoiler(t.clue)}\n\n<i>این را هر جا که خواستی بگو. یا نگهش دار. شهر تشخیص می‌دهد.</i>`,
          targetChatId: player.telegramId,
          priority: 8,
        })
      }

      // پیگیریِ زمان‌بندی‌شده
      const fuRng = mulberry32(seedFrom("futime", event.id))
      const fu = winningOutcome?.effects?.followUp ?? resolvedOutcomeFollowUps(template, parts)
      if (fu) {
        await tx.groupOutbox.create({
          data: {
            groupId: group.id,
            targetChatId: group.chatId,
            kind: "spawn_event",
            text: fu.templateId,
            priority: 5,
            refType: "event",
            refId: event.id,
            deliverAfter: new Date(Date.now() + randInt(fu.afterMinutesMin, fu.afterMinutesMax, fuRng) * 60000),
          },
        })
      }

      // به‌روزرسانی وضعیتِ گروه از آشوب/تنش
      const chaosDelta = winningOutcome?.effects?.group?.chaos ?? 0
      if (chaosDelta) {
        const chaos = clamp(group.chaos + chaosDelta, 0, 100)
        await tx.groupWorld.update({
          where: { id: group.id },
          data: { chaos, state: chaos >= 75 ? "chaos" : chaos >= 55 ? "tense" : group.state === "chaos" ? "normal" : group.state },
        })
      }
    },
    { timeout: 15000 },
  )
}

function resolvedOutcomeFollowUps(
  template: GroupEventTemplate | undefined,
  parts: { playerId: string; choiceKey: string }[],
): NonNullable<GroupOutcomeTemplate["effects"]>["followUp"] | null {
  if (!template || parts.length === 0) return null
  // پیگیری از آخرین انتخابِ ثبت‌شده با شانسِ کم
  const last = parts[parts.length - 1]!
  const choice = template.choices.find((c) => c.key === last.choiceKey)
  const outcome = choice?.outcomes[0]
  return outcome?.effects?.followUp ?? null
}

async function applyOutcomeEffects(
  tx: Tx,
  group: GroupWorld,
  event: GroupEvent,
  template: GroupEventTemplate,
  outcome: GroupOutcomeTemplate,
  player: Player,
  payload: RenderVarsIds & { tags: string[] },
  clueTargets: { playerId: string; clue: string }[],
): Promise<void> {
  const e = outcome.effects
  if (!e) return
  const rng = mulberry32(seedFrom("eff", event.id, player.id, outcome.text.length))

  // آمار بازیکن — آرایه‌ای
  for (const ps of e.playerStats ?? []) {
    const amount = randInt(ps.min, ps.max, rng)
    await applyPlayerStat(tx, player, ps.stat, amount)
  }

  // عنوانِ فرگت
  if (e.title && rng() < e.title.chance) {
    await tx.groupMember.updateMany({ where: { groupId: group.id, playerId: player.id }, data: { title: render(e.title.text, { ...payload, p1: player.name }) } })
  }

  // روابطِ دونفره با p2 — با id قطعی (نام‌ها یکتا نیستند؛ fallback نام فقط برای رویدادهای قدیمی)
  for (const rel of e.relationships ?? []) {
    if (rel.scope !== "pair") continue
    let p2Id = payload.p2Id ?? null
    if (!p2Id) {
      const p2Member = await tx.player.findFirst({ where: { name: payload.p2 }, select: { id: true } })
      p2Id = p2Member?.id ?? null
    }
    if (p2Id) {
      await adjustRelationship(tx, group.id, player.id, p2Id, rel.dim, randInt(rel.min, rel.max, rng))
    }
  }

  // سرنخ — حلقه‌ی معما: اگر شهر معمای فعالی دارد، سرنخِ بعدیِ همان معما باز می‌شود
  // (پی‌ویِ سرنخ از خودِ معما می‌رسد)؛ اگر معما نیست، متنِ سرنخِ رویداد پی‌وی می‌شود
  if (e.clue) {
    const mysteryAdvanced = await revealMysteryClueTx(tx, group, player)
    if (!mysteryAdvanced) clueTargets.push({ playerId: player.id, clue: render(e.clue, { ...payload, p1: player.name }) })
  }
}

/** اعمالِ عواقبِ سطحِ جمعی (گزینه‌ی برنده) */
async function applyCollectiveEffects(
  tx: Tx,
  group: GroupWorld,
  event: GroupEvent,
  outcome: GroupOutcomeTemplate,
  payload: RenderVarsIds & { tags: string[] },
): Promise<void> {
  const e = outcome.effects
  if (!e) return
  const rng = mulberry32(seedFrom("col", event.id))

  if (e.treasury) {
    const amount = randInt(e.treasury.min, e.treasury.max, rng)
    await tx.groupWorld.update({ where: { id: group.id }, data: { treasury: { increment: Math.max(0, amount) } } })
  }
  if (e.group) {
    const g = e.group
    const fresh = await tx.groupWorld.findUnique({ where: { id: group.id } })
    if (fresh) {
      await tx.groupWorld.update({
        where: { id: group.id },
        data: {
          chaos: clamp(fresh.chaos + (g.chaos ?? 0), 0, 100),
          socialTemp: clamp(fresh.socialTemp + (g.socialTemp ?? 0), 0, 100),
          reputation: clamp(fresh.reputation + (g.reputation ?? 0), 0, 100),
          crimeLevel: clamp(fresh.crimeLevel + (g.crime ?? 0), 0, 100),
          influence: Math.max(0, fresh.influence + (g.influence ?? 0)),
        },
      })
    }
  }
  for (const rel of e.relationships ?? []) {
    if (rel.scope !== "all_pairs") continue
    const members = await tx.groupMember.findMany({ where: { groupId: group.id }, select: { playerId: true } })
    const ids = members.map((m) => m.playerId).slice(0, 12)
    const amount = randInt(rel.min, rel.max, rng)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        await adjustRelationship(tx, group.id, ids[i]!, ids[j]!, rel.dim, Math.round(amount / 4))
      }
    }
  }
  if (e.memory) {
    await tx.groupMemory.create({
      data: {
        groupId: group.id,
        kind: e.memory.kind,
        text: render(e.memory.text, payload),
        originPlayerId: payload.p1Id,
        importance: e.memory.importance,
      },
    })
  }
  if (e.news) {
    await addNewsTx(tx, group.id, event.emoji, render(e.news, payload))
  }
  if (e.rumor) {
    await tx.groupRumor.create({
      data: {
        groupId: group.id,
        text: render(e.rumor.text, payload),
        truth: e.rumor.truth,
        confidence: e.rumor.truth ? 40 : 55,
        originPlayerId: payload.p1Id,
      },
    })
  }
}

/** آمارِ بازیکن — نمایِ نازک روی تک‌مرجعِ awards.ts (V13 §2.3).
 *  امضاش برایِ فراخوان‌هایِ موجود (رویدادها/بازی‌ها) ثابت مانده؛ معناشناسی بی‌تغییر: money → applyMoney("event")، xp جمعی با کفِ صفر، بقیه clamp 0..100. */
export async function applyPlayerStat(
  tx: Tx,
  player: Player,
  stat: "money" | "xp" | "fame" | "chaos" | "crime" | "reputation" | "luck" | "energy",
  amount: number,
): Promise<void> {
  await awardPlayerStat(tx, player, stat, amount)
}

/** کارتِ نتیجه‌ی رویداد — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ روایت‌ها زیرِ expand، حکم با SUB.
 *  title/label/winningText از render() می‌رسند (HTML-safe در نوشتن) — بدون esc دوباره؛
 *  name خام است → esc. سقفِ کارت: ردیف‌ها تا بودجه‌ی متن جا می‌شوند؛ بقیه با دُمِ شمارشیِ
 *  تراش‌خورده اعتراف می‌کنند (۲۰ شرکت‌کننده × متنِ بلند = بیرونِ سقفِ ۴۰۹۶ِ تلگرام). */
export function buildResultText(
  event: GroupEvent,
  resolved: ResolvedParticipant[],
  winningText: string | null,
  winningLabel: string,
): string {
  // V11: روایت‌های بلندِ هر بازیکن زیرِ نقل‌قولِ بازشدنی؛ حکمِ شهر با SUB جدا
  const lines = resolved.map((r) => `▪ <b>${esc(r.name)}</b>: ${r.outcomeText}`)
  const BUDGET = 3200
  const shown: string[] = []
  let used = 0
  let hidden = 0
  for (const [i, l] of lines.entries()) {
    if (i > 0 && used + l.length + 1 > BUDGET) {
      hidden = lines.length - shown.length
      break
    }
    shown.push(l)
    used += l.length + 1
  }
  // V20 (ممتیز V20-۱۸: «دفترِ ثبت» که در دسترس نبود) — انتهای برش حالا به کارتِ
  // تاریخچه‌ی همین گروه اشاره می‌کند («تاریخچه» را بگو)؛ قولِ نامرئی داده نمی‌شود.
  const tail = hidden > 0 ? `\n<i>… و ${chip(hidden)} عاقبتِ دیگر — «تاریخچه» را بگو تا ببینیشان.</i>` : ""
  const body = shown.length
    ? `\n\n👥 <b>عاقبتِ تک‌تک‌تان:</b>\n${expand(`${shown.join("\n")}${tail}`)}`
    : "\n\n<i>هیچ‌کس انتخابی نکرد. اتفاق، بی‌تصمیم ماند.</i>"
  const win = winningLabel
    ? `\n\n${SUB}\n\n🏆 حکمِ شهر: <b>${winningLabel}</b>${winningText ? `\n${quote(winningText)}` : ""}`
    : ""
  return `<b>${event.emoji} نتیجه‌ی «${event.title}»</b>\n${emblem(event.emoji)}${body}${win}`
}

// ─── بستنِ رویدادهای سرآمده ────────────────────────────────────────────────────

/** رویدادهایِ سرآمده: حلِ کامل (عواقب/کارت/تاریخ — همانِ قبل) ولی با status:'expired'
 *  + outcomeJson.reason (V13 موج ۱: مقدارِ مرده‌ی enum زنده شد؛ پیش‌تر سرآمده‌ها هم
 *  «resolved» ثبت می‌شدند و تفکیکِ «بسته‌شده با انتخاب» از «سرآمده» ممکن نبود).
 *  بستنِ زودهنگام (انتخابِ همه‌ی فعال‌ها) resolved می‌ماند. نمایشِ استایل هم resolved
 *  (پنجره‌اش طراحیِ حل است). شمارنده‌ی شبانه‌ی tick.ts هر دو وضعیت را می‌شمارد تا
 *  متنِ کارتِ خواب بی‌تغییر بماند.
 *  V13 موج  ۲: opts.force — بازیابیِ ادمین (admin.recover) همه‌ی بازها را بی‌چکِ
 *  مهلت به همین مسیرِ حل می‌فرستد (فلیپِ شرطی داخلِ resolveGroupEvent پاسدار است). */
export async function expireOpenEvents(group: GroupWorld, now = new Date(), opts: { force?: boolean } = {}): Promise<void> {
  const open = await db.groupEvent.findMany({
    where: { groupId: group.id, status: "open", ...(opts.force ? {} : { expiresAt: { lt: now } }) },
  })
  for (const e of open) {
    await resolveGroupEvent(e, now, { endStatus: "expired", reason: opts.force ? "recovered" : "time_expired" })
  }
  // بستنِ زودهنگام وقتی همه‌ی اعضای فعال انتخاب کرده‌اند
  const active = await activeMembers(group.id, 12)
  if (active.length >= 2) {
    const stillOpen = await db.groupEvent.findMany({ where: { groupId: group.id, status: "open" } })
    for (const e of stillOpen) {
      const parts = await db.groupEventParticipant.findMany({ where: { eventId: e.id } })
      if (parts.length >= Math.max(2, active.length)) await resolveGroupEvent(e, now)
    }
  }
}
