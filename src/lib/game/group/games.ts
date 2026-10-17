// FEMBOY WAR — V5: موتورِ بازی‌های اجتماعی گروهی.
// چارچوبِ عمومی: lobby → (quiz | brief | vote | bidding) → نتیجه.
// همه‌ی بازی‌ها داده‌محورند (content/games.ts) — افزودنِ ۱۰۰ بازیِ آینده بدون بازنویسیِ موتور.

import { db } from "@/lib/db"
import type { GroupWorld, GameSession, Player } from "@prisma/client"
import { mulberry32, seedFrom, weightedPick, randInt, pickOne, clamp } from "../rng"
import { applyMoney } from "../economy"
import {
  GAME_MAP, WHO_WOULD_SUBJECTS, COURT_CHARGES, MEME_BATTLE_SUBJECTS, PET_SHOW_SUBJECTS,
  FASHION_SUBJECTS, WEALTH_SUBJECTS, TRUTH_SUBJECTS, AUCTION_ITEMS, SURVIVAL_SUBJECTS, ELECTION_SUBJECTS,
} from "./content"
import type { GameDef, OutboxButton, QuizQuestion } from "./types"
import { esc, parseJson, pushOutbox, pushOutboxTx, addHistoryTx, activeMembers, bumpCulture, cultureOf, checkAchievementsTx, isGroupMember, NOT_CITIZEN_MSG, toLatinDigits, withSectionLock } from "./domain"
import { adjustRelationship, adjustMemberRep } from "./social"
import { applyPlayerStat } from "./events"
import { awardSoulProgress } from "./awards"
import { SEP, DOTS, faNum, chip, spoiler } from "./text"

export type Tx = import("@prisma/client").Prisma.TransactionClient

interface Participant {
  playerId: string
  name: string
  data: Record<string, unknown> // answers/votes/role/bid
}

interface GameState {
  subject?: string
  qi?: number // ایندکس سؤالِ فعلی کوییز
  questions?: QuizQuestion[] // سؤال‌های انتخاب‌شده (وزن‌ها همراهشان می‌آیند)
  roles?: Record<string, string> // playerId → roleKey
  votes?: Record<string, string> // playerId → optionKey
  bid?: { current: number; leader: string | null; base: number; item: string }
  scores?: Record<string, number>
  phaseStartedAt?: number
}

// ─── موضوع‌های تصادفی ──────────────────────────────────────────────────────────

function subjectFor(game: GameDef, rng: () => number): string {
  switch (game.key) {
    case "who_would": return pickOne(WHO_WOULD_SUBJECTS, rng)
    case "court": return pickOne(COURT_CHARGES, rng)
    case "meme_battle": return pickOne(MEME_BATTLE_SUBJECTS, rng)
    case "pet_show": return pickOne(PET_SHOW_SUBJECTS, rng)
    case "fashion_battle": return pickOne(FASHION_SUBJECTS, rng)
    case "wealth_war": return pickOne(WEALTH_SUBJECTS, rng)
    case "truth_or_lie": return pickOne(TRUTH_SUBJECTS, rng)
    case "auction": return pickOne(AUCTION_ITEMS, rng).label
    case "survival": return pickOne(SURVIVAL_SUBJECTS, rng)
    case "election_special": return pickOne(ELECTION_SUBJECTS, rng)
    default: return game.tagline
  }
}

// ─── شروعِ بازی ────────────────────────────────────────────────────────────────

export async function startGame(
  group: GroupWorld,
  gameKey: string,
  instigator?: Player,
): Promise<{ ok: boolean; message: string }> {
  const def = GAME_MAP[gameKey]
  if (!def) return { ok: false, message: "چنین بازی‌ای در این شهر شناخته نمی‌شود." }

  const open = await db.gameSession.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return { ok: false, message: "یه بازی تازه داره اجرا می‌شه. صبرش کن؛ شهر دو تا بازیِ هم‌زمان ندارد." }

  // کول‌داونِ این بازی در این گروه
  const c = cultureOf(group)
  const last = typeof c[`gameCd:${gameKey}`] === "number" ? (c[`gameCd:${gameKey}`] as number) : 0
  if (Date.now() - last < def.cooldownMinutes * 60000) {
    return { ok: false, message: "این بازی تازه اجرا شده. شهر هنوز نفس تازه نکرده." }
  }

  const members = await activeMembers(group.id, 96)
  const need = def.candidatesFrom === "members" ? Math.max(def.minPlayers, 2) : def.minPlayers
  if (members.length < need) {
    return { ok: false, message: `برای «${def.name}» حداقل ${need} شهروندِ فعال لازم است. فعلاً ${members.length} تن‌اند.` }
  }

  const rng = mulberry32(seedFrom("ggstart", group.id, Date.now()))
  const subject = subjectFor(def, rng)
  const participants: Participant[] = []
  if (instigator) participants.push({ playerId: instigator.id, name: instigator.name, data: {} })

  const session = await db.gameSession.create({
    data: {
      groupId: group.id,
      gameKey,
      phase: "lobby",
      stateJson: JSON.stringify({ subject } satisfies GameState),
      participantsJson: JSON.stringify(participants),
      closesAt: new Date(Date.now() + def.joinWindowMinutes * 60000),
    },
  })

  const n = participants.length
  const text = gameLobbyText(def, n, group.title, subject, def.joinWindowMinutes)
  const buttons: OutboxButton[] = [
    { label: "✋ ثبت‌نام", style: "success", cb: `gg:${session.id}:j` },
    { label: "🚀 همین حالا شروع کن", style: "primary", cb: `gg:${session.id}:b` },
  ]
  await pushOutbox(group, { kind: "game", text, buttons, refType: "game", refId: session.id, priority: 7 })
  return { ok: true, message: "بازی اعلام شد." }
}

// ─── ثبت‌نام ───────────────────────────────────────────────────────────────────

export async function joinGame(
  group: GroupWorld,
  player: Player,
  sessionId: string,
): Promise<{ ok: boolean; ackText: string; cardText: string; cardButtons: OutboxButton[] }> {
  // دروازه‌ی شهروندی — بازیِ شهر فقط برای شهروندهای ثبت‌شده
  if (!(await isGroupMember(group.id, player.id)))
    return { ok: false, ackText: NOT_CITIZEN_MSG, cardText: "", cardButtons: [] }
  // V15-3 — قفلِ بخشیِ «همان بازی»: ثبت‌نام/رأی/پیشنهادِ هم‌زمانِ بازیکن‌ها رویِ
  // JSONِ جلسه سریال می‌شود (همان کلاسِ خطایِ رأی — مأموریت §3B)؛ خواندن هم
  // داخلِ نوبت است تا ثبت‌نامِ هم‌زمان گم نشود.
  return withSectionLock(`game:${sessionId}`, async () => {
    const session = await db.gameSession.findFirst({ where: { id: sessionId, groupId: group.id, status: "open" } })
    if (!session) return { ok: false, ackText: "این بازی دیگه باز نیست.", cardText: "", cardButtons: [] }
    const def = GAME_MAP[session.gameKey]!
    const parts = parseJson<Participant[]>(session.participantsJson, [])
    if (session.phase !== "lobby") return { ok: false, ackText: "بازی شروع شده. تماشا کن یا دفعه‌ی بعد زودتر بیا.", cardText: lobbyCard(session, def), cardButtons: lobbyButtons(session) }
    if (parts.some((p) => p.playerId === player.id)) return { ok: false, ackText: "اسمت ثبت شده. نفس عمیق بکش.", cardText: lobbyCard(session, def), cardButtons: lobbyButtons(session) }
    if (def.maxPlayers && parts.length >= def.maxPlayers) return { ok: false, ackText: "ظرفیتِ این بازی پر است.", cardText: lobbyCard(session, def), cardButtons: lobbyButtons(session) }
    parts.push({ playerId: player.id, name: player.name, data: {} })
    await db.gameSession.update({ where: { id: session.id }, data: { participantsJson: JSON.stringify(parts) } })
    return { ok: true, ackText: "ثبت‌نام شدی.", cardText: lobbyCard(session, def), cardButtons: lobbyButtons(session) }
  })
}

function lobbyCard(session: GameSession, def: GameDef): string {
  const parts = parseJson<Participant[]>(session.participantsJson, [])
  const state = parseJson<GameState>(session.stateJson, {})
  return lobbyCardText(def, parts, state.subject ?? "")
}

/** کارتِ لابیِ بازی — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ رسترِ هم‌ردیف با DOTS */
export function lobbyCardText(def: GameDef, parts: { name: string }[], subject: string): string {
  const names = parts.map((p) => `• ${esc(p.name)}`).join("\n")
  const roster = names ? `\n\n${DOTS}\n\n👥 (${chip(parts.length)})\n${names}` : "\n\n👥 هنوز کسی نیست. اولین باش."
  return `<b>${def.emoji} ${def.name}</b>\n${SEP}\n\n${renderGame(def.introText, { game: def.name, n: parts.length, group: "", subject })}${roster}`
}

/** کارتِ اعلامِ بازی — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ مهلتِ ثبت‌نام تراش می‌خورد */
export function gameLobbyText(def: GameDef, n: number, groupTitle: string, subject: string, joinWindowMinutes: number): string {
  return `<b>${def.emoji} ${def.name}</b>\n<i>${def.tagline}</i>\n${SEP}\n\n${renderGame(def.introText, { game: def.name, n, group: groupTitle, subject })}\n\n⏳ ${chip(joinWindowMinutes)} دقیقه مهلتِ ثبت‌نام.`
}

function lobbyButtons(session: GameSession): OutboxButton[] {
  return [
    { label: "✋ ثبت‌نام", style: "success", cb: `gg:${session.id}:j` },
    { label: "🚀 همین حالا شروع کن", style: "primary", cb: `gg:${session.id}:b` },
  ]
}

// ─── شروعِ فاز اصلی ────────────────────────────────────────────────────────────

export async function beginGame(group: GroupWorld, sessionId: string, forcedBy?: Player): Promise<{ ok: boolean; message: string }> {
  const session = await db.gameSession.findFirst({ where: { id: sessionId, groupId: group.id, status: "open" } })
  if (!session || session.phase !== "lobby") return { ok: false, message: "بازی در این مرحته نیست." }
  const def = GAME_MAP[session.gameKey]!
  const parts = parseJson<Participant[]>(session.participantsJson, [])
  if (forcedBy && !parts.some((p) => p.playerId === forcedBy.id) && parts.length > 0) {
    return { ok: false, message: "فقط بازیکنانِ ثبت‌نام‌شده می‌تونند شروع کنند." }
  }
  if (parts.length < def.minPlayers) {
    return { ok: false, message: `هنوز کم‌تر از حدِ لازم است (${def.minPlayers}).` }
  }

  const rng = mulberry32(seedFrom("ggbegin", session.id))
  const state = parseJson<GameState>(session.stateJson, {})

  // نقش‌های نامتقارن — بریف در پی‌وی
  if (def.roles && def.roles.length > 0) {
    const roles: Record<string, string> = {}
    const shuffled = [...parts].sort(() => rng() - 0.5)
    const roleDefs = [...def.roles]
    for (let i = 0; i < shuffled.length; i++) {
      const role = roleDefs[i % roleDefs.length]!
      roles[shuffled[i]!.playerId] = role.key
    }
    state.roles = roles
    for (const p of parts) {
      const role = def.roles.find((r) => r.key === roles[p.playerId])!
      const player = await db.player.findUnique({ where: { id: p.playerId } })
      if (player?.telegramId) {
        await pushOutbox(group, {
          kind: "clue",
          // پی‌ویِ مخفی — بریفِ نقش زیرِ اسپویلر
          text: roleDmText(def.name, role.label, role.brief),
          targetChatId: player.telegramId,
          priority: 8,
        })
      }
    }
  }

  // کوییز — انتخابِ سؤال‌ها
  if (def.quiz) {
    const picked = [...def.quiz.questions].sort(() => rng() - 0.5).slice(0, def.quiz.pickCount)
    state.questions = picked
    state.qi = 0
    state.scores = {}
    await db.gameSession.update({
      where: { id: session.id },
      data: { phase: "quiz", stateJson: JSON.stringify(state), closesAt: new Date(Date.now() + def.actionWindowMinutes * 60000) },
    })
    await askQuestion(group, session.id)
    return { ok: true, message: "کوییز شروع شد." }
  }

  // مزایده
  if (session.gameKey === "auction") {
    const item = pickOne(AUCTION_ITEMS, rng)
    const members = await activeMembers(group.id, 96)
    const base = 200 + Math.min(members.length, 8) * 100
    state.bid = { current: 0, leader: null, base, item: item.label }
    await db.gameSession.update({
      where: { id: session.id },
      data: { phase: "bidding", stateJson: JSON.stringify(state), closesAt: new Date(Date.now() + def.actionWindowMinutes * 60000) },
    })
    await pushOutbox(group, {
      kind: "game",
      text: auctionOpenCardText(item.label, base, def.actionWindowMinutes),
      buttons: bidButtons(session.id, base),
      refType: "game",
      refId: session.id,
      priority: 7,
    })
    return { ok: true, message: "مزایده شروع شد." }
  }

  // رأیِ عمومی
  const members = await activeMembers(group.id, 96)
  const candidates: { key: string; label: string; style: string | null }[] =
    def.candidatesFrom === "options"
      ? (def.options ?? []).map((o) => ({ key: o.key, label: o.label, style: o.style }))
      // برچسبِ دکمه = PLAIN (بدون تگ)؛ نامِ بازیکن فقط لاتین‌سازیِ رقم می‌خورد
      : members.slice(0, 8).map((m) => ({ key: `u:${m.playerId}`, label: toLatinDigits(m.player.name), style: null as string | null }))
  if (candidates.length === 0) return { ok: false, message: "کاندیدایی پیدا نشد." }

  state.votes = {}
  await db.gameSession.update({
    where: { id: session.id },
    data: { phase: "vote", stateJson: JSON.stringify(state), closesAt: new Date(Date.now() + def.actionWindowMinutes * 60000) },
  })
  const subject = state.subject ?? def.tagline
  await pushOutbox(group, {
    kind: "game",
    text: gameVoteCardText(def, parts.length, group.title, subject),
    buttons: candidates.map((c) => ({ label: c.label, style: (c.style as "primary" | "success" | "danger" | null) ?? null, cb: `gg:${session.id}:v:${c.key}` })),
    refType: "game",
    refId: session.id,
    priority: 7,
  })
  return { ok: true, message: "رأی‌گیری شروع شد." }
}

// ─── سازنده‌های خالصِ کارت (تست‌پذیر؛ V11) ─────────────────────────────────────

/** پی‌ویِ نقش — سازنده‌ی خالص؛ بریفِ نقش زیرِ اسپویلر */
export function roleDmText(gameName: string, roleLabel: string, roleBrief: string): string {
  return `🎭 <b>نقشِ تو در «${esc(gameName)}»</b>\n${SEP}\n\n<b>${roleLabel}</b>\n${spoiler(roleBrief)}\n\n<i>به هیچ‌کس نگفته باش. مخصوصاً به کسی که می‌شناسی.</i>`
}

/** کارتِ مزایده — سازنده‌ی خالص */
export function auctionOpenCardText(itemLabel: string, base: number, actionWindowMinutes: number): string {
  return `🔨 <b>مزایده شروع شد</b>\n${SEP}\n\nجنس: <b>${esc(itemLabel)}</b>\nپایه: ${chip(base)} سکه — پول به صندوقِ شهر می‌رود.\n\n<i>بالاترین پیشنهاد تا ${chip(actionWindowMinutes)} دقیقه‌ی دیگه برنده‌ست.</i>`
}

/** کارتِ رأیِ بازی — سازنده‌ی خالص */
export function gameVoteCardText(def: GameDef, n: number, groupTitle: string, subject: string): string {
  return `<b>${def.emoji} ${def.name}</b>\n${SEP}\n\n${renderGame(def.introText, { game: def.name, n, group: groupTitle, subject })}\n\n🗳 رأی می‌دهید — هر کس یک بار.`
}

function bidButtons(sessionId: string, current: number): OutboxButton[] {
  const steps = [100, 300, 700, 1500]
  // برچسبِ دکمه = PLAIN — رقمِ انگلیسی (faNum ← en-US)؛ cb دست‌نخورده
  return [
    ...steps.map((s) => ({ label: `➕ ${faNum(s)}`, style: "primary" as const, cb: `gg:${sessionId}:bid:${s}` })),
    { label: "🙌 گذشته", style: "success", cb: `gg:${sessionId}:pass` },
  ]
}

async function askQuestion(group: GroupWorld, sessionId: string): Promise<void> {
  const session = await db.gameSession.findUnique({ where: { id: sessionId } })
  if (!session) return
  const def = GAME_MAP[session.gameKey]!
  const state = parseJson<GameState>(session.stateJson, {})
  const qi = state.qi ?? 0
  const q = state.questions?.[qi]
  if (!q) {
    await resolveGame(session)
    return
  }
  const total = state.questions?.length ?? 0
  await pushOutbox(group, {
    kind: "game",
    text: quizCardText(qi + 1, total, q.text),
    buttons: q.answers.map((a, i) => ({ label: a, style: null, cb: `gg:${session.id}:a:${qi}:${i}` })),
    refType: "game",
    refId: session.id,
    priority: 7,
  })
}

/** کارتِ سؤالِ کوییز — سازنده‌ی خالص؛ شمارشِ «n از m» تراشِ یک‌تکه */
export function quizCardText(qNumber: number, total: number, question: string): string {
  return `❓ <b>سؤال ${chip(`${faNum(qNumber)}/${faNum(total)}`)}</b>\n${SEP}\n\n${question}`
}

// ─── کنش‌های بازیکن ────────────────────────────────────────────────────────────

export interface GameActionResult {
  ok: boolean
  ackText: string
  cardText?: string
  cardButtons?: OutboxButton[]
}

export async function gameAction(
  group: GroupWorld,
  player: Player,
  sessionId: string,
  action: string,
  arg: string,
): Promise<GameActionResult> {
  // V15-3 — قفلِ بخشیِ «همان بازی»: جواب/رأی/پیشنهادِ هم‌زمان رویِ JSONِ جلسه
  // سریال می‌شود؛ رأیِ هم‌زمان گم نمی‌شود و دوباره‌رأیِ مسابقه‌ای رخ نمی‌دهد (§3B).
  return withSectionLock(`game:${sessionId}`, async () => {
    const session = await db.gameSession.findFirst({ where: { id: sessionId, groupId: group.id, status: "open" } })
    if (!session) return { ok: false, ackText: "این بازی بسته شده." } as GameActionResult
    const def = GAME_MAP[session.gameKey]!
    const parts = parseJson<Participant[]>(session.participantsJson, [])
    const state = parseJson<GameState>(session.stateJson, {})
    const me = parts.find((p) => p.playerId === player.id)

    switch (action) {
    case "a": {
      // پاسخِ کوییز
      if (session.phase !== "quiz") return { ok: false, ackText: "کوییز در جریان نیست." }
      if (!me) return { ok: false, ackText: "تو بازی نبودی. تماشا هم یه مهارت است." }
      const [qiRaw, aiRaw] = arg.split(":")
      const qi = Number(qiRaw)
      const ai = Number(aiRaw)
      const q = state.questions?.[qi]
      if (!q || qi !== (state.qi ?? 0)) return { ok: false, ackText: "برای همین سؤالِ الان نیست." }
      const already = (me.data[`q${qi}`] as number | undefined) !== undefined
      if (already) return { ok: false, ackText: "به این یکی جواب دادی." }
      me.data[`q${qi}`] = ai
      // امتیازِ واقعی — وزنِ همین جواب؛ بدونِ وزن، مشارکت = ۱ امتیاز
      const w = q.weights?.[ai] ?? 1
      state.scores = state.scores ?? {}
      state.scores[player.id] = (state.scores[player.id] ?? 0) + w
      await db.gameSession.update({
        where: { id: session.id },
        data: { participantsJson: JSON.stringify(parts), stateJson: JSON.stringify(state) },
      })
      // اگر همه جواب دادند → سؤالِ بعد
      const all = parts.every((p) => (p.data[`q${qi}`] as number | undefined) !== undefined)
      if (all) return await advanceQuiz(group, session.id)
      return { ok: true, ackText: q.weights ? `جواب ثبت شد — ${faNum(w)} امتیاز.` : "جواب ثبت شد." }
    }
    case "v": {
      // رأی
      if (session.phase !== "vote") return { ok: false, ackText: "رأی‌گیری در جریان نیست." }
      if (!me && def.candidatesFrom !== "options") return { ok: false, ackText: "فقط بازیکن‌ها رأی می‌دن." }
      state.votes = state.votes ?? {}
      if (state.votes[player.id] !== undefined) return { ok: false, ackText: "رأیت را داده‌ای. دموکراسی پرهزینه است." }
      state.votes[player.id] = arg
      await db.gameSession.update({ where: { id: session.id }, data: { stateJson: JSON.stringify(state) } })
      const voted = Object.keys(state.votes).length
      if (voted >= parts.length && parts.length > 0) {
        await resolveGame(await db.gameSession.findUnique({ where: { id: session.id } }) ?? session)
        return { ok: true, ackText: "رأی ثبت شد — و شمارش تمام شد!" }
      }
      return { ok: true, ackText: `رأیت ثبت شد (${faNum(voted)}/${faNum(parts.length)}).` }
    }
    case "bid": {
      if (session.phase !== "bidding") return { ok: false, ackText: "مزایده در جریان نیست." }
      if (!me) return { ok: false, ackText: "تو مزایده نبودی." }
      const step = Number(arg)
      if (!Number.isFinite(step) || step <= 0) return { ok: false, ackText: "پیشنهاد معتبر نیست." }
      const bid = state.bid!
      const next = bid.current + step
      if (next < bid.base) return { ok: false, ackText: `پایه‌ی مزایده ${faNum(bid.base)} است.` }
      const p = await db.player.findUnique({ where: { id: player.id } })
      if (!p || p.money < next) return { ok: false, ackText: "پولِ کافی نداری. بانکِ شهر هم باورت نمی‌شود." }
      bid.current = next
      bid.leader = player.id
      await db.gameSession.update({ where: { id: session.id }, data: { stateJson: JSON.stringify(state) } })
      return { ok: true, ackText: `پیشنهادِ ${faNum(next)} ثبت شد. تو جلوتری — فعلاً.` }
    }
    case "pass": {
      if (session.phase !== "bidding") return { ok: false, ackText: "مزایده در جریان نیست." }
      await resolveGame(session)
      return { ok: true, ackText: "مزایده بسته شد." }
    }
    default:
      return { ok: false, ackText: "چنین کنشی نیست." }
    }
  })
}

async function advanceQuiz(group: GroupWorld, sessionId: string): Promise<GameActionResult> {
  const session = await db.gameSession.findUnique({ where: { id: sessionId } })
  if (!session) return { ok: false, ackText: "بازی گم شد." }
  const state = parseJson<GameState>(session.stateJson, {})
  state.qi = (state.qi ?? 0) + 1
  if ((state.qi ?? 0) >= (state.questions?.length ?? 0)) {
    await db.gameSession.update({ where: { id: session.id }, data: { stateJson: JSON.stringify(state) } })
    await resolveGame(session)
    return { ok: true, ackText: "کوییز تمام شد." }
  }
  await db.gameSession.update({
    where: { id: session.id },
    data: { stateJson: JSON.stringify(state), closesAt: new Date(Date.now() + 90000) },
  })
  await askQuestion(group, sessionId)
  return { ok: true, ackText: "سؤالِ بعدی رفت." }
}

// ─── تیکِ بازی‌ها ──────────────────────────────────────────────────────────────

/** بازی‌هایِ سرآمده را جلو می‌برد/می‌بندد. V13 موج  ۲: opts.force — بازیابیِ ادمین
 *  همه‌ی بازی‌هایِ باز را بی‌چکِ مهلت پردازش می‌کند (لابی→شروع/لغو، کوییز→ادامه/پایان،
 *  بقیه→حل؛ همه با فلیپ‌هایِ شرطیِ خودشان — دوبارحالی ممکن نیست). */
export async function tickGames(group: GroupWorld, now = new Date(), opts: { force?: boolean } = {}): Promise<void> {
  const open = await db.gameSession.findMany({ where: { groupId: group.id, status: "open" } })
  for (const session of open) {
    if (!opts.force && (!session.closesAt || session.closesAt.getTime() > now.getTime())) continue
    if (session.phase === "lobby") {
      const def = GAME_MAP[session.gameKey]!
      const parts = parseJson<Participant[]>(session.participantsJson, [])
      if (parts.length >= def.minPlayers) {
        await beginGame(group, session.id)
      } else {
        await db.gameSession.update({ where: { id: session.id }, data: { status: "aborted", resolvedAt: now } })
        await pushOutbox(group, {
          kind: "game",
          text: `😴 بازیِ «${esc(GAME_MAP[session.gameKey]!.name)}» لغو شد — شرکت‌کننده کافی نشد.\n<i>شهر صبر می‌کند. بی‌صدا.</i>`,
          priority: 4,
        })
      }
    } else if (session.phase === "quiz") {
      await advanceQuiz(group, session.id)
    } else {
      await resolveGame(session, now)
    }
  }
}

// ─── نتیجه ─────────────────────────────────────────────────────────────────────

async function resolveGame(session: GameSession, now = new Date()): Promise<void> {
  if (session.status !== "open") return
  const group = await db.groupWorld.findUnique({ where: { id: session.groupId } })
  if (!group) return
  const def = GAME_MAP[session.gameKey]!
  const parts = parseJson<Participant[]>(session.participantsJson, [])
  const state = parseJson<GameState>(session.stateJson, {})
  const rng = mulberry32(seedFrom("ggres", session.id))

  let winnerId: string | null = null
  let outcomeText = ""
  let amount = 0

  if (session.gameKey === "auction" && state.bid) {
    const bid = state.bid
    if (bid.leader && bid.current >= bid.base) {
      // برنده و مبلغ مشخص است — واریز/برداشت فقط داخلِ تراکنشِ حل (پایین)
      winnerId = bid.leader
      amount = bid.current
    } else {
      outcomeText = "هیچ‌کس پیشنهادِ کافی نداد. جنس — هرچه بود — پیش فروشنده ماند."
    }
  } else if (session.phase === "quiz" && state.scores) {
    let best = -1
    for (const [pid, score] of Object.entries(state.scores)) {
      if (score > best) { best = score; winnerId = pid }
    }
    outcomeText = "پاسخ‌ها ثبت و سنجیده شد."
  } else if (state.votes) {
    const tally = new Map<string, number>()
    for (const v of Object.values(state.votes)) tally.set(v, (tally.get(v) ?? 0) + 1)
    let best = 0
    let bestKey: string | null = null
    for (const [k, n] of tally) if (n > best) { best = n; bestKey = k }
    if (bestKey) {
      if (bestKey.startsWith("u:")) winnerId = bestKey.slice(2)
      else winnerId = null
      outcomeText = `«${esc(optionLabel(def, bestKey, parts))}» با ${chip(best)} رأی.`
    } else {
      outcomeText = "هیچ رأیی نیامد. دموکراسی گاهی خجالت می‌کشد."
    }
    // اجتماعِ نقش‌ها (سرقت/شکار گنج): موفقیت از پوششِ نقش‌ها
    if (def.roles && state.roles) {
      const covered = new Set(Object.values(state.roles)).size
      const total = def.roles.length
      const success = rng() < clamp(0.25 + 0.6 * (covered / total), 0.1, 0.92)
      outcomeText = success
        ? `نقش‌ها درست چیدند (${chip(`${faNum(covered)}/${faNum(total)}`)}). نتیجه: موفقیتِ کامل.`
        : "یه جا لیز خورد. بگذریم. مقصر مشخص نیست — همه‌چیزِ دیگه مشخص است."
      if (!success && winnerId) winnerId = null
    }
  }

  const winnerName = () => parts.find((p) => p.playerId === winnerId)?.name ?? "هیچ‌کس"

  // پاداش‌ها — مبالغ خالص حساب می‌شوند؛ اعمال فقط داخلِ تراکنش
  const rewardWinner = def.rewardWinner ? randInt(def.rewardWinner[0], def.rewardWinner[1], rng) : 0
  const rewardAll = def.rewardAll ? randInt(def.rewardAll[0], def.rewardAll[1], rng) : 0

  await db.$transaction(
    async (tx) => {
      // قفلِ حل: فلیپِ شرطی اول — تیکِ ۴۵ثانیه‌ای و کال‌بکِ «تمام» هم‌زمان فقط یک‌بار می‌بندند
      const flipped = await tx.gameSession.updateMany({
        where: { id: session.id, status: "open" },
        data: { status: "done", resolvedAt: now, phase: "done" },
      })
      if (flipped.count === 0) return

      // مزایده — اسکرو در همان تراکنشِ بستن:
      // موجودیِ برنده داخلِ تراکنش دوباره چک می‌شود؛ کم بود پول یعنی مزایده‌ی بی‌خریدار
      // (بدون تبدیلِ کسری به بدهی، بدون ریختنِ پولِ نو به صندوق)
      if (session.gameKey === "auction" && state.bid && winnerId && amount > 0) {
        const bid = state.bid
        const winner = await tx.player.findUnique({ where: { id: bid.leader! } })
        if (winner && winner.money >= amount) {
          await applyMoney(tx, winner, -amount, "gamble", "بردِ مزایده")
          await tx.groupWorld.update({ where: { id: group.id }, data: { treasury: { increment: amount } } })
          outcomeText = `${esc(winner.name)} جنس را با ${chip(amount)} سکه برد. پول در صندوقِ شهر نشست.`
        } else {
          winnerId = null
          amount = 0
          outcomeText = winner
            ? `${esc(winner.name)} پولش کم بود — مزایده بدون خریدار بسته شد. جنس پیشِ فروشنده ماند.`
            : "برنده پیدا نشد. مزایده بی‌نتیجه بسته شد."
        }
      }

      const winner = winnerId ? parts.find((p) => p.playerId === winnerId) ?? null : null

      if (winner && rewardWinner > 0) {
        const w = await tx.player.findUnique({ where: { id: winner.playerId } })
        if (w) {
          await applyMoney(tx, w, rewardWinner, "reward", `بردِ ${def.name}`)
          amount = rewardWinner
        }
      }
      if (rewardAll > 0) {
        for (const p of parts) {
          const pl = await tx.player.findUnique({ where: { id: p.playerId } })
          if (pl && pl.id !== winnerId) await applyMoney(tx, pl, rewardAll, "reward", `${def.name}`)
        }
      }

      // V14 — زندگیِ گروه، سفرِ فمبوی را می‌راند (مأموریتِ III.5):
      // برنده +12 (با رویدادِ تسطّ) · بقیه‌ی شرکت‌کننده‌ها +4 — سقفِ روزانه در awards.ts
      // بعد از فلیپِ شرطی → امنیتِ دقیقاً-یک‌بار به ارث می‌رسد
      let winnerSoulLine = ""
      let othersWithSoul = 0
      const partPlayers = await tx.player.findMany({ where: { id: { in: parts.map((p) => p.playerId) } } })
      for (const pl of partPlayers) {
        if (!pl.telegramId) continue
        const isWinner = pl.id === winnerId
        const soul = await awardSoulProgress(tx, pl.telegramId, {
          soulXp: isWinner ? 12 : 4,
          masteryEvent: isWinner,
          reason: `${def.name} — ${isWinner ? "برد" : "شرکت"}`,
        })
        if (!soul || soul.appliedXp <= 0) continue
        if (isWinner) winnerSoulLine = `🎀 فمبویِ ${esc(pl.name)}: +${soul.appliedXp} XP (مسیر ${soul.trackLabel})`
        else othersWithSoul++
      }
      const soulText = [
        winnerSoulLine,
        othersWithSoul > 0 ? `🎀 ${faNum(othersWithSoul)} فمبویِ دیگر هم از شرکت‌کردن جلو رفت` : "",
      ]
        .filter(Boolean)
        .join("\n")

      // اثرهای اجتماعی
      for (const p of parts) {
        await tx.groupMember.updateMany({
          where: { groupId: group.id, playerId: p.playerId },
          data: { gameCount: { increment: 1 }, winCount: p.playerId === winnerId ? { increment: 1 } : undefined },
        })
        const member = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: p.playerId } } })
        if (member) {
          if (def.social.winnerRep && p.playerId === winnerId) await adjustMemberRep(tx, member, def.social.winnerRep.dim, def.social.winnerRep.amount)
          if (def.social.loserRep && p.playerId !== winnerId && parts.length > 1) await adjustMemberRep(tx, member, def.social.loserRep.dim, def.social.loserRep.amount)
        }
      }
      if (def.social.relationship) {
        const ids = parts.map((p) => p.playerId)
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            await adjustRelationship(tx, group.id, ids[i]!, ids[j]!, def.social.relationship.dim, def.social.relationship.amount)
          }
        }
      }

      // متنِ نتیجه — V11: هدرِ رندرشده + SEP + بدنه؛ {outcome} خودش HTML-safe ساخته می‌شود
      const rendered = renderGame(def.resultText, {
        game: def.name,
        n: Object.values(state.votes ?? {}).length || parts.length,
        group: group.title,
        subject: state.subject ?? "",
        winner: winnerName(),
        amount: Math.max(amount, rewardAll),
        outcome: outcomeText,
      })
      await pushOutboxTx(tx, group, {
        kind: "game",
        text: gameResultCardText(rendered, outcomeText, soulText),
        priority: 7,
        refType: "game",
        refId: session.id,
      })

      // history در نوشتن HTML-safe (نامِ برندِ پویا esc)
      await addHistoryTx(tx, group.id, def.emoji, `${def.name}${winner ? ` — برنده: ${esc(winner.name)}` : ""}`, 65)
      await bumpCulture(tx, group.id, {
        gamesPlayed: 1,
        competitions: def.tags.includes("competitive") ? 1 : 0,
        cooperation: def.tags.includes("cooperative") ? 1 : 0,
        memes: def.tags.includes("meme") ? 1 : 0,
        mystery: def.tags.includes("mystery") ? 1 : 0,
        [`gameCd:${session.gameKey}`]: Date.now(),
      })
      await checkAchievementsTx(tx, group)
    },
    { timeout: 15000 },
  )
}

function optionLabel(def: GameDef, key: string, parts: Participant[]): string {
  if (key.startsWith("u:")) {
    const pid = key.slice(2)
    return parts.find((p) => p.playerId === pid)?.name ?? "یک شهروند"
  }
  return def.options?.find((o) => o.key === key)?.label ?? key
}

// ─── رندر ──────────────────────────────────────────────────────────────────────

/** کارتِ نتیجه‌ی بازی — سازنده‌ی خالص (تست‌پذیر؛ V11): SEP زیرِ سطرِ اولِ قالب
 *  V14: soulLine — خطِ فشردنیِ رشدِ فمبوی از زندگیِ گروه (اختیاری، بدونِ شکستنِ شکل) */
export function gameResultCardText(renderedResult: string, outcomeText: string, soulLine = ""): string {
  const [firstLine, ...restLines] = renderedResult.split("\n")
  const sepBody = restLines.length ? `\n${SEP}\n\n${restLines.join("\n")}` : `\n${SEP}`
  return `${firstLine}${sepBody}${outcomeText ? `\n\n<i>${outcomeText}</i>` : ""}${soulLine ? `\n\n${soulLine}` : ""}`
}

function renderGame(tpl: string, v: { game: string; n: number; group: string; subject: string; winner?: string; amount?: number; outcome?: string }): string {
  // V11: {n}/{amount} تراش می‌خورند؛ {outcome} از فراخواننده HTML-safe می‌رسد
  // (نام‌ها esc و اعداد chip شده‌اند) — پس بدون esc رد می‌شود
  return tpl
    .replace(/\{game\}/g, esc(v.game))
    .replace(/\{n\}/g, chip(v.n))
    .replace(/\{group\}/g, esc(v.group))
    .replace(/\{subject\}/g, esc(v.subject))
    .replace(/\{winner\}/g, esc(v.winner ?? "هیچ‌کس"))
    .replace(/\{amount\}/g, chip(v.amount ?? 0))
    .replace(/\{outcome\}/g, v.outcome ?? "")
}

/** منوی بازی — برای /play در گروه */
export async function playableGames(group: GroupWorld): Promise<{ key: string; name: string; emoji: string; tagline: string; ok: boolean; why: string }[]> {
  const members = await activeMembers(group.id, 96)
  const c = cultureOf(group)
  const open = await db.gameSession.findFirst({ where: { groupId: group.id, status: "open" } })
  const unlocked = new Set<string>()
  // بازی‌های باز شده با پروژه‌ها
  for (const [k, v] of Object.entries(c)) {
    if (k.startsWith("gameUnlock:") && typeof v === "number" && v > 0) unlocked.add(k.slice("gameUnlock:".length))
  }
  return Object.values(GAME_MAP).map((g) => {
    const last = typeof c[`gameCd:${g.key}`] === "number" ? (c[`gameCd:${g.key}`] as number) : 0
    const cd = Date.now() - last < g.cooldownMinutes * 60000
    const enough = members.length >= Math.max(g.minPlayers, g.candidatesFrom === "members" ? 2 : g.minPlayers)
    const needUnlock = g.key === "auction" || g.key === "heist" // با پروژه باز می‌شوند؟ نه — همه بازند؛ پروژه فقط وزن می‌دهد
    const ok = !open && !cd && enough
    const why = open ? "یه بازی در جریانه" : cd ? "تازه اجرا شده" : !enough ? "کمبود شهروندِ فعال" : ""
    return { key: g.key, name: g.name, emoji: g.emoji, tagline: g.tagline, ok, why }
  })
}
