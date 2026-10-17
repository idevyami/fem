// FEMBOY WAR — V13 (موجِ ۲، ب): facade لایه‌ی گروه — تنها نقطه‌ی ورودِ API route ها.
// همه‌ی اعمال server-authoritative اند: ربات فقط پیام‌رسان و دکمه‌ساز است.
//
// نقشِ این فایل بعد از موجِ ۱ (V13 §2.1): «فاساد» — گروه/بازیکن را یک‌بار حل
// می‌کند (ensureGroup/ensurePlayer) و dispatch را به router.ts می‌سپارد؛
// کارت‌های عمومی در presentation.ts، دروازه‌ها/انقضاها در safety.ts، و
// نوشتنِ آمارِ بازیکن فقط از awards.ts. خودِ فاساد فقط خطِ لوله را می‌بندد:
//   parse (route) → validate (route: service-key/session) → resolve (این‌جا)
//   → dispatch (router) → persist (دامنه‌ها) → render (presentation/دامنه‌ها)
// امضاهای عمومی برای API routeها بی‌تغییر مانده‌اند (به‌جز افزودنی‌هایِ اختیاریِ
// انتهای آرگومان: opts.chatTitle برای شفادهیِ عنوان، که پیش‌تر route دورش
// می‌انداخت). «kind:'home'» تنها فیلدِ نتیجه‌ای است که اضافه شده و route آن
// را هنوز بی‌صدا می‌اندازد — فرمتِ سیمِ ربات دست‌نخورده.

import { db } from "@/lib/db"
import type { GroupWorld, Player } from "@prisma/client"
import { pickOne } from "../rng"
import type {
  ObserveResponseDTO, GroupTickResponseDTO, OutboxMessageDTO,
  GroupSnapshotDTO, GroupActionResponseDTO,
} from "./types"
import { ensureGroup, ensureGroupTx, ensurePlayerTx, ensureMemberTx } from "./domain"
import { observe as observeMessage, welcomeNewCitizen } from "./presence"
import { tickAllGroups, markDelivered, markUnreachable } from "./tick"
import { buildGroupSnapshot, myGroups } from "./snapshot"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { getGroupSettings, PAUSED_CARD_TEXT, PAUSED_ACK } from "./admin"
import {
  dispatchCommand, dispatchCallback, dispatchAction,
  type GroupCallCtx, type GroupCommandResult, type CallbackResult,
} from "./router"

export type { GroupCommandResult, CallbackResult } from "./router"

// ─── ثبتِ گروه/عضو ─────────────────────────────────────────────────────────────

export async function registerGroupChat(chatId: string, title: string): Promise<GroupWorld> {
  return ensureGroup(chatId, title)
}

/** عضویتِ بازیکن در گروه — بازیکنِ تلگرامی در صورت نبود ساخته می‌شود */
export async function registerMember(
  chatId: string,
  chatTitle: string,
  telegramId: string,
  playerName?: string,
  opts: { welcomeIfNew?: boolean } = {},
): Promise<{ group: GroupWorld; player: Player; member: { id: string; isNew: boolean } }> {
  const group = await registerGroupChat(chatId, chatTitle)
  const player = await ensurePlayerTx(db, telegramId, playerName)
  const existing = await db.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: player.id } } })
  if (existing) {
    return { group, player, member: { id: existing.id, isNew: false } }
  }
  const member = await ensureMemberTx(db, group.id, player.id)
  if (opts.welcomeIfNew !== false) {
    await welcomeNewCitizen(group, player)
  }
  // عضو جدید => population cache
  await db.groupWorld.update({ where: { id: group.id }, data: { population: { increment: 1 } } })
  return { group, player, member: { id: member.id, isNew: true } }
}

// ─── مشاهده‌ی پیام گروه ────────────────────────────────────────────────────────

export interface ObserveRequest {
  chatId: string
  chatTitle?: string
  chatType?: string
  telegramId: string
  playerName?: string
  text: string
  addressedToBot: boolean
  replyToTelegramId?: string | null
}

export async function observe(req: ObserveRequest): Promise<ObserveResponseDTO> {
  const { group, player } = await registerMember(req.chatId, req.chatTitle ?? "", req.telegramId, req.playerName, { welcomeIfNew: false })
  const member = await db.groupMember.findUniqueOrThrow({ where: { groupId_playerId: { groupId: group.id, playerId: player.id } } })

  let replyToPlayerId: string | null = null
  if (req.replyToTelegramId) {
    const other = await db.player.findUnique({ where: { telegramId: req.replyToTelegramId } })
    replyToPlayerId = other?.id ?? null
  }

  return observeMessage({
    group,
    member,
    player,
    text: req.text,
    addressedToBot: req.addressedToBot,
    replyToPlayerId,
  })
}

// ─── فرمان‌ها/کال‌بک‌های ربات (فاساد → router) ────────────────────────────────

export interface GroupCallOpts {
  /** عنوانِ چت وقتی ربات می‌فرستد — شفادهیِ «شهرِ بی‌نام» (ensureGroup اعمال می‌کند) */
  chatTitle?: string
  /** پرچمِ ادمینِ تاییدشده‌ی زنده توسطِ ربات — فقط با service key قابلِ فرستادن است
   *  (قراردادِ اعتماد در سردرِ router.ts؛ موجِ ۲/Part 9) */
  isAdmin?: boolean
}

function callCtx(chatId: string, chatTitle: string | undefined, group: GroupWorld, player: Player | null, isAdmin?: boolean): GroupCallCtx {
  return {
    chatId,
    chatTitle: chatTitle || undefined,
    telegramId: player?.telegramId ?? undefined,
    isAdmin: isAdmin === true ? true : undefined,
    playerName: player?.name,
    group,
    player,
    db,
  }
}

export async function groupCommand(
  chatId: string,
  command: string,
  player: Player | null,
  arg?: string,
  opts: GroupCallOpts = {},
): Promise<GroupCommandResult> {
  const group = await registerGroupChat(chatId, opts.chatTitle ?? "")
  // شهرِ بسته (Part 9) — فرمان‌هایِ بازی یک‌خطِ «بسته» می‌گیرند؛ help/gadmin بازند
  // تا ادمین بتواند وضعیت را ببیند و بازش کند
  if (!getGroupSettings(group).enabled && command !== "help" && command !== "gadmin") {
    return { text: PAUSED_CARD_TEXT, buttons: [] }
  }
  return dispatchCommand(callCtx(chatId, opts.chatTitle, group, player, opts.isAdmin), command, arg)
}

export async function groupCallback(
  chatId: string,
  player: Player,
  data: string,
  opts: GroupCallOpts = {},
): Promise<CallbackResult> {
  const group = await registerGroupChat(chatId, opts.chatTitle ?? "")
  // شهرِ بسته — همه‌ی کال‌بک‌هایِ بازی ack بسته؛ gs: (تنظیماتِ ادمین) و gh:
  // (کدکسِ راهنما — دانشِ عمومی، مثلِ خودِ help) باز می‌مانند تا ادمین بتواند
  // وضعیت را ببیند و بازیکن راهنما را بخواند
  const tag = data.split(":")[0]
  if (!getGroupSettings(group).enabled && tag !== "gs" && tag !== "gh") {
    return { ok: false, ackText: PAUSED_ACK }
  }
  return dispatchCallback(callCtx(chatId, opts.chatTitle, group, player, opts.isAdmin), data)
}

// ─── تیک + تحویل ──────────────────────────────────────────────────────────────

export async function groupTick(maxPerGroup = 2): Promise<GroupTickResponseDTO> {
  const r = await tickAllGroups(maxPerGroup)
  const messages: OutboxMessageDTO[] = r.messages.map((m) => ({
    outboxId: m.outboxId,
    chatId: m.chatId,
    text: m.text,
    kind: m.kind,
    buttons: m.buttons.map((b) => ({ label: b.label, style: (b.style as "primary" | "success" | "danger" | null) ?? null, cb: b.cb, url: b.url })),
    editMessageId: m.editMessageId,
  }))
  return { messages, groupsTicked: r.groupsTicked }
}

export async function reportDelivered(outboxId: string, messageId: string | number): Promise<void> {
  await markDelivered(outboxId, messageId)
}

/** ربات گزارش داد که چتِ گروهی برای همیشه از دسترس خارج شده (ربات حذف شده).
 *  شهر تا بازگشتِ ربات خاموش می‌ماند — بدون اسپمِ خطا و بدون انبارِ پیام. */
export async function markGroupUnreachable(chatId: string): Promise<boolean> {
  return markUnreachable(chatId)
}

// ─── snapshot / گروه‌های من ────────────────────────────────────────────────────

export async function groupSnapshot(chatId: string, viewerPlayerId?: string): Promise<GroupSnapshotDTO> {
  return buildGroupSnapshot(chatId, viewerPlayerId)
}

export async function playerGroups(playerId: string) {
  return myGroups(playerId)
}

// ─── رفتنِ عضو (left_chat_member) ─────────────────────────────────────────────

/** بازیکن گروه را ترک کرد (ربات گزارش می‌دهد): کشِ جمعیت یکی کم می‌شود (کفِ صفر)
 *  و ردیفِ عضویت برای بازگشتِ احتمالی نگه داشته می‌شود — فقط آخرین دید تازه
 *  می‌شود. حذفی در کار نیست. عضوِ نبودِه = no-op (idempotent برایِ دوبله‌فرستیِ
 *  تلگرام/ربات). موجِ ۵ ربات این را با action:"member_left" صدا می‌زند. */
export async function memberLeft(chatId: string, telegramId: string): Promise<{ left: boolean }> {
  const group = await db.groupWorld.findUnique({ where: { chatId } })
  if (!group) return { left: false }
  const player = await db.player.findUnique({ where: { telegramId } })
  if (!player) return { left: false }
  const member = await db.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: player.id } } })
  if (!member) return { left: false }
  await db.groupMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } })
  await db.groupWorld.update({ where: { id: group.id }, data: { population: Math.max(0, group.population - 1) } })
  return { left: true }
}

// ─── اکشن‌های Mini App (session-auth؛ فاساد → router) ─────────────────────────

export async function groupAction(
  chatId: string,
  player: Player,
  action: string,
  payload: Record<string, unknown>,
): Promise<GroupActionResponseDTO> {
  const group = await registerGroupChat(chatId, "")
  // دروازه‌ی شهروندی — Mini App هر chatId را می‌فرستد؛ شهر فقط دستِ شهروندهای خودش را می‌بوسد
  if (!(await requireGroupMember(db, group.id, player.id))) {
    return { ok: false, message: NOT_CITIZEN_MSG }
  }
  return dispatchAction(callCtx(chatId, undefined, group, player), action, payload)
}

// ─── شبیه‌سازیِ توسعه (dev-only) ───────────────────────────────────────────────

export interface SimReport {
  groups: number
  virtualPlayers: number
  daysSimulated: number
  eventsSpawned: number
  gamesPlayed: number
  votesCast: number
  messagesQueued: number
  cultures: string[]
  topMemes: string[]
  relationshipEdges: number
  errors: string[]
}

/** شبیه‌سازیِ چند-بازیکنه — گروه + بازیکنانِ مجازی + گذرِ زمانِ فشرده */
export async function simulate(
  opts: { groups?: number; playersPerGroup?: number; minutes?: number } = {},
): Promise<SimReport> {
  const nGroups = Math.min(3, Math.max(1, opts.groups ?? 3))
  const perGroup = Math.min(10, Math.max(3, opts.playersPerGroup ?? 5))
  const report: SimReport = {
    groups: nGroups, virtualPlayers: nGroups * perGroup, daysSimulated: 0,
    eventsSpawned: 0, gamesPlayed: 0, votesCast: 0, messagesQueued: 0,
    cultures: [], topMemes: [], relationshipEdges: 0, errors: [],
  }
  const createdGroupIds: string[] = []
  const createdPlayerIds: string[] = []
  try {
    for (let gi = 0; gi < nGroups; gi++) {
      const chatId = `sim-group-${Date.now()}-${gi}`
      const group = await ensureGroupTx(db, chatId, `شهرِ آزمایشی ${gi + 1}`)
      createdGroupIds.push(group.id)
      const players: Player[] = []
      for (let pi = 0; pi < perGroup; pi++) {
        const p = await ensurePlayerTx(db, `sim-user-${Date.now()}-${gi}-${pi}`, `شبیه‌ساز ${gi + 1}-${pi + 1}`)
        players.push(p)
        createdPlayerIds.push(p.id)
        await ensureMemberTx(db, group.id, p.id)
      }
      // گذرِ زمانِ فشرده — N دقیقه‌ی مجازی با گام‌های ۴۵ ثانیه‌ای
      const steps = Math.min(40, Math.max(8, opts.minutes ?? 20))
      for (let s = 0; s < steps; s++) {
        // رفتارِ تصادفیِ بازیکنان
        for (const p of players) {
          if (Math.random() < 0.5) {
            await observe({
              chatId, chatTitle: group.title, telegramId: p.telegramId ?? "", playerName: p.name,
              text: pickOne(["قورباغه دیدم", "پول ندارم بابا", "من شهردار میشم", "سلام بچه‌ها", "چی شد؟", "باورت نمی‌شه", "🤣🤣", "یه بازی شروع کنیم"], Math.random),
              addressedToBot: Math.random() < 0.15,
            })
          }
        }
        await tickAllGroups(2, new Date(Date.now() + s * 45000))
      }
      report.daysSimulated = steps
    }
    // جمع‌آوریِ آمار
    for (const gid of createdGroupIds) {
      const g = await db.groupWorld.findUnique({ where: { id: gid } })
      if (!g) continue
      report.cultures.push(g.cultureTag)
      report.eventsSpawned += await db.groupEvent.count({ where: { groupId: gid } })
      report.gamesPlayed += await db.gameSession.count({ where: { groupId: gid, status: "done" } })
      report.votesCast += await db.groupVote.count({ where: { groupId: gid } })
      report.messagesQueued += await db.groupOutbox.count({ where: { groupId: gid } })
      report.relationshipEdges += await db.playerRelationship.count({ where: { groupId: gid } })
      const memes = await db.groupMemory.findMany({ where: { groupId: gid, kind: "meme" }, take: 3 })
      report.topMemes.push(...memes.map((m) => m.text))
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e))
  } finally {
    // پاک‌سازی کامل — دنیای شبیه‌سازی جدا از دنیای واقعی
    for (const gid of createdGroupIds) await db.groupWorld.delete({ where: { id: gid } }).catch(() => undefined)
    for (const pid of createdPlayerIds) await db.player.delete({ where: { id: pid } }).catch(() => undefined)
  }
  return report
}
