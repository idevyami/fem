// FEMBOY WAR — V5: snapshot گروه — «الان توی این گروه چی می‌گذره؟»
// هر دو رابط (ربات + Mini App) از همین یک منبع می‌خوانند.

import { db } from "@/lib/db"
import type { GroupWorld, GroupMember, Player, Prisma } from "@prisma/client"
import { DISTRICT_MAP } from "../content"
import { WEATHER_LABEL, MOOD_LABEL } from "../helpers"
import { getClass } from "../content/classes"
import type {
  GroupSnapshotDTO, GroupEventDTO, GameSessionDTO, GroupVoteDTO, GroupRumorDTO,
  GroupMemeDTO, GroupProjectDTO, GroupMysteryDTO, GroupMemberDTO, GroupHistoryDTO,
  GroupChallengeDTO,
} from "./types"
import {
  GROUP_ROLE_MAP, GROUP_PROJECT_MAP, GROUP_ACHIEVEMENTS,
  GROUP_EVENT_KIND_LABELS, CULTURE_LABELS, SOCIAL_TEMP_LABELS, STATE_LABELS, REPUTATION_LABELS,
  MYSTERY_THREADS, GAME_MAP,
} from "./content"
import { parseJson, cultureOf, cultureLine, activeMembers } from "./domain"
import { memberRep, emergentTitle } from "./social"
import { participantsOf } from "./events"
import { STYLE_SHOW_ID } from "./style"
import { faNum } from "./text"

// نکته‌ی DTO: فیلدهای snapshot خام می‌مانند (بدونِ تگِ HTML) — هم ربات و هم مینی‌اپ
// می‌خوانندش؛ تراش/اسپویلر فقط در سازنده‌های کارتِ سمتِ موتور (engine/politics/...) می‌افتد.
// ارقام: faNum ← en-US (V11)

/** پارامترِ سوم (V13 موج ۱): گروهِ ازپیش‌حل‌شده — فاساد/engine آن را یک‌بار
 *  ensureGroup کرده؛ snapshot دیگر findUnique تکراری نمی‌زند (رفتار/خروجی هم‌ارز). */
export async function buildGroupSnapshot(chatId: string, viewerPlayerId?: string, preGroup?: GroupWorld): Promise<GroupSnapshotDTO> {
  const group = preGroup ?? (await db.groupWorld.findUnique({ where: { chatId } }))
  if (!group) {
    return emptySnapshot(chatId)
  }
  const now = new Date()

  const [membersAll, actives] = await Promise.all([
    db.groupMember.findMany({ where: { groupId: group.id }, include: { player: true }, orderBy: { messageCount: "desc" }, take: 40 }),
    activeMembers(group.id, 24),
  ])

  const mayorMember = membersAll.find((m) => m.role === "mayor")
  const roles = Object.values(GROUP_ROLE_MAP).map((r) => {
    const holder = membersAll.find((m) => m.role === r.key)
    return { key: r.key, name: r.name, emoji: r.emoji, holder: holder?.player.name ?? null }
  })

  // رویدادِ جاری
  const openEvent = await db.groupEvent.findFirst({ where: { groupId: group.id, status: "open" } })
  let currentEvent: GroupEventDTO | null = null
  if (openEvent) {
    const parts = await participantsOf(openEvent)
    const choices = parseJson<{ key: string; label: string; style: string | null }[]>(openEvent.choicesJson, [])
    currentEvent = {
      id: openEvent.id,
      emoji: openEvent.emoji,
      title: openEvent.title,
      body: openEvent.body,
      kind: openEvent.kind,
      kindLabel: GROUP_EVENT_KIND_LABELS[openEvent.kind] ?? openEvent.kind,
      status: openEvent.status,
      participantsCount: parts.length,
      choices: choices.map((c) => ({ key: c.key, label: c.label, style: (c.style as "primary" | "success" | "danger" | null) ?? null, voters: parts.filter((p) => p.choiceLabel === c.label).length })),
      expiresAt: openEvent.expiresAt?.toISOString() ?? null,
      createdAt: openEvent.createdAt.toISOString(),
    }
  }

  // بازیِ فعال
  const openGame = await db.gameSession.findFirst({ where: { groupId: group.id, status: "open" } })
  let activeGame: GameSessionDTO | null = null
  if (openGame) {
    const def = GAME_MAP[openGame.gameKey]
    const parts = parseJson<{ playerId: string }[]>(openGame.participantsJson, [])
    const players = parts.length ? await db.player.findMany({ where: { id: { in: parts.map((p) => p.playerId) } } }) : []
    const state = parseJson<{ subject?: string }>(openGame.stateJson, {})
    activeGame = {
      id: openGame.id,
      gameKey: openGame.gameKey,
      name: def?.name ?? openGame.gameKey,
      emoji: def?.emoji ?? "🎲",
      phase: openGame.phase,
      phaseLabel: phaseLabel(openGame.phase),
      status: openGame.status,
      participants: players.map((p) => ({ playerId: p.id, name: p.name, avatar: p.avatar })),
      subject: state.subject ?? "",
      closesAt: openGame.closesAt?.toISOString() ?? null,
      createdAt: openGame.createdAt.toISOString(),
    }
  }

  // رأی‌های باز
  const openVotes = await db.groupVote.findMany({ where: { groupId: group.id, status: "open" }, orderBy: { closesAt: "asc" }, take: 3 })
  const voteDtos: GroupVoteDTO[] = openVotes.map((v) => {
    const options = parseJson<{ key: string; label: string; style: string | null }[]>(v.optionsJson, [])
    const tally = parseJson<Record<string, string[]>>(v.tallyJson, {})
    const myVote = Object.entries(tally).find(([, ids]) => viewerPlayerId && ids.includes(viewerPlayerId))?.[0] ?? null
    return {
      id: v.id,
      kind: v.kind,
      subject: v.subject,
      options: options.map((o) => ({ key: o.key, label: o.label, style: (o.style as "primary" | "success" | "danger" | null) ?? null, count: (tally[o.key] ?? []).length, voted: false })),
      closesAt: v.closesAt.toISOString(),
      myVote,
    }
  })

  const members: GroupMemberDTO[] = membersAll.slice(0, 12).map((m) => toMemberDto(m, now))

  const historyRows = await db.groupHistory.findMany({ where: { groupId: group.id }, orderBy: { createdAt: "desc" }, take: 12 })
  const history: GroupHistoryDTO[] = historyRows.map((h) => ({ id: h.id, icon: h.icon, text: h.text, createdAt: h.createdAt.toISOString() }))

  const rumorRows = await db.groupRumor.findMany({ where: { groupId: group.id, status: "active" }, orderBy: { createdAt: "desc" }, take: 4 })
  const rumors: GroupRumorDTO[] = rumorRows.map((r) => ({
    id: r.id,
    text: r.text,
    truthOddsLabel: r.confidence >= 65 ? "احتمالاً درست" : r.confidence <= 35 ? "احتمالاً دروغ" : "نامعلوم",
    spreadCount: r.spreadCount,
    createdAt: r.createdAt.toISOString(),
  }))

  const memeRows = await db.groupMemory.findMany({ where: { groupId: group.id, kind: "meme" }, orderBy: { confidence: "desc" }, take: 5 })
  const memes: GroupMemeDTO[] = memeRows.map((m) => ({ id: m.id, emoji: "😂", text: m.text, confidence: m.confidence, usageCount: m.usageCount }))

  // دعوت‌های دوئلِ باز (موجِ ۲) — نقشِ بیننده مثل myVote از همان viewerPlayerId
  const challengeRows = await db.groupChallenge.findMany({
    where: { groupId: group.id, status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 2,
  })
  const challenges: GroupChallengeDTO[] = challengeRows.map((c) => {
    const outcome = parseJson<{ winnerName?: string }>(c.outcomeJson, {})
    return {
      id: c.id,
      status: c.status,
      challengerName: "؟",
      targetName: "؟",
      myRole: viewerPlayerId === c.challengerId ? "challenger" : viewerPlayerId === c.targetId ? "target" : null,
      winnerName: outcome.winnerName ?? null,
      expiresAt: c.expiresAt.toISOString(),
      createdAt: c.createdAt.toISOString(),
    }
  })
  // نام‌های نمایشی — lookup جدا تا کوئری سنگین نشود
  if (challengeRows.length > 0) {
    const ids = challengeRows.flatMap((c) => [c.challengerId, c.targetId])
    const players = await db.player.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    const nameOf = new Map(players.map((p) => [p.id, p.name]))
    challengeRows.forEach((row, i) => {
      challenges[i]!.challengerName = nameOf.get(row.challengerId) ?? "؟"
      challenges[i]!.targetName = nameOf.get(row.targetId) ?? "؟"
    })
  }

  const projectRows = await db.groupProject.findMany({ where: { groupId: group.id }, orderBy: { createdAt: "desc" }, take: 6 })
  const projects: GroupProjectDTO[] = projectRows.map((p) => {
    const contributed = parseJson<Record<string, number>>(p.contributedJson, {})
    const total = Object.values(contributed).reduce((s, v) => s + v, 0)
    const tpl = GROUP_PROJECT_MAP[p.templateId]
    return {
      id: p.id,
      key: p.templateId,
      name: p.name,
      emoji: p.emoji,
      description: tpl?.description ?? "",
      benefit: tpl?.benefit ?? "",
      goal: p.goal,
      contributed: total,
      myContribution: viewerPlayerId ? (contributed[viewerPlayerId] ?? 0) : 0,
      status: p.status,
    }
  })

  const mysteryRows = await db.groupMystery.findMany({ where: { groupId: group.id }, orderBy: { updatedAt: "desc" }, take: 3 })
  const mysteries: GroupMysteryDTO[] = mysteryRows.map((m) => {
    const thread = MYSTERY_THREADS.find((t) => t.key === m.threadId)
    return {
      id: m.id,
      title: m.title,
      emoji: thread?.emoji ?? "🕯",
      status: m.status,
      progress: m.progress,
      cluesTotal: thread?.clues.length ?? 5,
      hook: thread?.hook ?? "",
    }
  })

  const achievementsUnlocked = parseJson<string[]>(group.achievementsJson, [])
  const c = cultureOf(group)
  const culture = CULTURE_LABELS[group.cultureTag] ?? CULTURE_LABELS.unset!
  // V14 Task 15b — شمارِ آماده برای رندرِ مینی‌اپ (افزودنی؛ آرایه‌ها همان‌هایی‌اند که بودند)
  const achievementsUnlockedCount = achievementsUnlocked.length

  const whatsHappening = currentEvent
    ? openEvent?.templateId === STYLE_SHOW_ID
      ? `${currentEvent.emoji} ${currentEvent.title} — صحنه روشن است، قضاوت در راه است`
      : `${currentEvent.emoji} ${currentEvent.title} — منتظرِ انتخاب‌هاست`
    : activeGame
      ? `${activeGame.emoji} ${activeGame.name} در جریانه`
      : voteDtos.length > 0
        ? `🗳 ${voteDtos[0]!.subject}`
        : "شهر نفس می‌کشد. مخصوصاً اگر کسی کاری بکند."

  const whyComeBack = [
    openGame ? `${activeGame?.name} تا ${new Date(openGame.closesAt ?? now).getHours()}:${String(new Date(openGame.closesAt ?? now).getMinutes()).padStart(2, "0")} باز است` : null,
    mysteries.find((m) => m.status === "active") ? `معما: ${mysteries.find((m) => m.status === "active")!.progress}/${mysteries.find((m) => m.status === "active")!.cluesTotal} سرنخ` : null,
    projects.find((p) => p.status === "building") ? `${projects.find((p) => p.status === "building")!.name} تا ${Math.floor((projects.find((p) => p.status === "building")!.contributed / projects.find((p) => p.status === "building")!.goal) * 100)}%` : null,
    "قورباغه یادت را نگه می‌دارد.",
  ].filter(Boolean).join(" · ")

  const district = DISTRICT_MAP[group.district] ?? DISTRICT_MAP.old_town!
  const weather = WEATHER_LABEL[group.weather] ?? WEATHER_LABEL.clear!

  return {
    exists: true,
    chatId,
    title: group.title,
    district: group.district,
    districtName: district.name,
    districtEmoji: district.emoji,
    moodLabel: MOOD_LABEL[group.mood] ?? group.mood,
    moodEmoji: group.mood === "calm" ? "🙂" : group.mood === "tense" ? "😤" : group.mood === "festive" ? "🎉" : "🌀",
    state: group.state,
    stateLabel: STATE_LABELS[group.state] ?? group.state,
    weatherLabel: weather.label,
    weatherEmoji: weather.emoji,
    cultureTag: group.cultureTag,
    cultureLabel: culture.label,
    cultureEmoji: culture.emoji,
    cultureLine: cultureLine(group.cultureTag, c),
    chaos: group.chaos,
    socialTemp: group.socialTemp,
    socialTempLabel: SOCIAL_TEMP_LABELS(group.socialTemp),
    treasury: group.treasury,
    reputationLabel: REPUTATION_LABELS(group.reputation),
    population: membersAll.length,
    activePlayers: actives.length,
    mayor: mayorMember ? { name: mayorMember.player.name, avatar: mayorMember.player.avatar } : null,
    roles,
    currentEvent,
    activeGame,
    openVotes: voteDtos,
    members,
    history,
    rumors,
    memes,
    projects,
    mysteries,
    achievements: GROUP_ACHIEVEMENTS,
    achievementsUnlocked,
    whatsHappening,
    whyComeBack: whyComeBack || "شهر منتظرِ کاری است که هنوز نشده.",
    challenges,
    achievementsUnlockedCount,
    serverTime: now.toISOString(),
  }
}

// ─── بیننده‌ی کارتِ خانه (موجِ ۲؛ §6.3) ─────────────────────────────────────

/** خلاصه‌ی بیننده برای کارتِ خانه‌ی state-aware — هویتِ فمبوی + وضعیتِ حضور */
export interface HomeViewer {
  playerId: string
  isMember: boolean
  roleLabel: string | null
  roleEmoji: string | null
  title: string | null
  character: { femboyName: string; classEmoji: string; className: string; level: number } | null
  /** رویدادِ باز — انتخابش ثبت شده؟ */
  joinedEvent: boolean
  /** بازیِ باز — نامش ثبت شده؟ */
  joinedGame: boolean
  /** رأیِ باز — رأی داده؟ */
  voted: boolean
}

/** جمع‌کردنِ وضعیتِ بیننده برای کارتِ خانه — از همان snapshot (بازی/رأی) + دو
 *  lookupِ سبک (عضویت/فمبوی) + یک چکِ شرکت‌کننده‌ی رویدادِ باز. */
export async function buildHomeViewer(
  dbx: Prisma.TransactionClient,
  group: GroupWorld,
  player: Player,
  snap: GroupSnapshotDTO,
): Promise<HomeViewer> {
  const [member, char] = await Promise.all([
    dbx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: player.id } } }),
    dbx.soulCharacter.findUnique({ where: { playerId: player.id } }),
  ])
  const role = member?.role ? GROUP_ROLE_MAP[member.role] : null
  const cls = char ? getClass(char.classKey) : null
  let joinedEvent = false
  if (snap.currentEvent) {
    const part = await dbx.groupEventParticipant.findUnique({
      where: { eventId_playerId: { eventId: snap.currentEvent.id, playerId: player.id } },
    })
    joinedEvent = part !== null
  }
  return {
    playerId: player.id,
    isMember: member !== null,
    roleLabel: role?.name ?? null,
    roleEmoji: role?.emoji ?? null,
    title: member?.title ?? null,
    character: char
      ? {
          femboyName: char.name,
          classEmoji: cls?.emoji ?? "✨",
          className: cls?.name ?? char.classKey,
          level: char.level,
        }
      : null,
    joinedEvent,
    joinedGame: snap.activeGame ? snap.activeGame.participants.some((p) => p.playerId === player.id) : false,
    voted: snap.openVotes.some((v) => v.myVote !== null),
  }
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case "lobby": return "ثبت‌نام"
    case "quiz": return "سؤال‌ها"
    case "vote": return "رأی‌گیری"
    case "bidding": return "مزایده"
    case "brief": return "بریفِ نقش‌ها"
    case "done": return "تمام"
    default: return phase
  }
}

function toMemberDto(m: GroupMember & { player: Player }, now: Date): GroupMemberDTO {
  const r = memberRep(m)
  const role = m.role ? GROUP_ROLE_MAP[m.role] : null
  const mins = Math.floor((now.getTime() - m.lastSeenAt.getTime()) / 60000)
  const onlineLabel = mins < 10 ? "آنلاین" : mins < 120 ? `${faNum(mins)} دقیقه پیش` : mins < 2880 ? "امروز" : "غایب"
  return {
    playerId: m.playerId,
    name: m.player.name,
    avatar: m.player.avatar,
    role: m.role,
    roleLabel: role?.name ?? null,
    roleEmoji: role?.emoji ?? null,
    title: emergentTitle(m),
    rep: { fame: r.fame, trust: r.trust, chaos: r.chaos },
    messageCount: m.messageCount,
    gameCount: m.gameCount,
    winCount: m.winCount,
    lastSeenAt: m.lastSeenAt.toISOString(),
    onlineLabel,
  }
}

function emptySnapshot(chatId: string): GroupSnapshotDTO {
  return {
    exists: false, chatId, title: "", district: "old_town", districtName: "محله‌ی قدیمی", districtEmoji: "🏚",
    moodLabel: "", moodEmoji: "", state: "normal", stateLabel: "", weatherLabel: "", weatherEmoji: "",
    cultureTag: "unset", cultureLabel: "در حال شکل‌گیری", cultureEmoji: "🌫", cultureLine: "",
    chaos: 0, socialTemp: 50, socialTempLabel: "", treasury: 0, reputationLabel: "", population: 0, activePlayers: 0,
    mayor: null, roles: [], currentEvent: null, activeGame: null, openVotes: [], members: [], history: [],
    rumors: [], memes: [], projects: [], mysteries: [], achievements: [], achievementsUnlocked: [],
    challenges: [],
    achievementsUnlockedCount: 0,
    whatsHappening: "", whyComeBack: "", serverTime: new Date().toISOString(),
  }
}

/** گروه‌های من — برای صفحه‌ی Mini App.
 *  جمعیت (V13 موج ۱): شمارِ اعضایِ فعال (بازدید در ۴۸ ساعت — همان پنجره‌ی
 *  activeMembers تیک)؛ پیش‌تر صفرِ هاردکد بود. یک groupBy برای همه‌ی گروه‌ها. */
export async function myGroups(playerId: string): Promise<{ chatId: string; title: string; cultureLabel: string; cultureEmoji: string; moodEmoji: string; population: number; isMember: boolean }[]> {
  const memberships = await db.groupMember.findMany({ where: { playerId }, include: { group: true } })
  const since = new Date(Date.now() - 48 * 3600000)
  const activeCounts = await db.groupMember.groupBy({
    by: ["groupId"],
    where: { groupId: { in: memberships.map((m) => m.groupId) }, lastSeenAt: { gte: since } },
    _count: { groupId: true },
  })
  const activeBy = new Map(activeCounts.map((c) => [c.groupId, c._count.groupId]))
  return memberships.map((m) => {
    const culture = CULTURE_LABELS[m.group.cultureTag] ?? CULTURE_LABELS.unset!
    return {
      chatId: m.group.chatId,
      title: m.group.title,
      cultureLabel: culture.label,
      cultureEmoji: culture.emoji,
      moodEmoji: "🙂",
      population: activeBy.get(m.groupId) ?? 0,
      isMember: true,
    }
  })
}
