// FEMBOY WAR — V13 §2.1B: router — dispatch اعلانیِ (declarative) و قطعیِ لایه‌ی گروه.
//
// ── خطِ لوله (هر فرمان/کال‌بک/اکشن همین مسیر را می‌رود) ─────────────────────────
//   transport (API route / ربات)  →  parse (route: command/data/action را می‌کَند)
//   →  validate context (service-key/session؛ facade انجام می‌دهد)
//   →  resolve state (facade: ensureGroup + player یک‌بار — GroupCallCtx)
//   →  dispatch service (این ماژول: جدول‌های COMMANDS/CALLBACKS/ACTIONS)
//   →  persist (سرویس‌های دامنه: events/games/politics/world/… خودشان می‌نویسند)
//   →  render (presentation.ts + کارت‌builderهای هم‌جا با دامنه‌ها)
// engine.ts فقط facade است: امضاهایش برای API routeها ثابت مانده‌اند؛ این ماژول
// تنها مقصدِ dispatch آن‌هاست. موجِ ۲ handlerهای تازه (چالش/onboarding/admin)
// را در همین جدول‌ها ثبت می‌کند — نه switch جدید در facade.
//
// ── قراردادِ گرامرِ کال‌بک (رشته‌ایِ بین‌سرویسی؛ ربات می‌سازد، موتور می‌خواند) ──
//   ge:{eventId}:{choiceKey}          انتخابِ گزینه‌ی رویداد
//   gg:{sessionId}:{j|b|a:qi:ai|v:key|bid:step|pass}   بازیِ گروهی
//   gv:{voteId}:{optionKey}            رأی — بعد از ثبت، همان پنل با سطرِ بی‌نامِ
//                                      «N رأی تا الان» بازچینی می‌شود (V16-1؛
//                                      شمارشِ گزینه‌به‌گزینه‌ی انتخابات/دادگاه مخفی)
//   ru:{rumorId}:{inv|spr|deny}        شایعه
//   gp:{projectId}:{amount}            کمکِ پروژه — مبلغ رویِ خودِ دکمه (کارت‌های
//                                      قدیمی و دکمه‌های انتخابگرِ مبلغ؛ V16-1)
//   cit:{playerId}:{vibe}              حضور/فمبوی
//   gm:{arg}                           منویِ کارت‌های شهر (game:…/newproject:…/…)
//     V15-1: gm:nav:{key} → کارتِ بخشِ هابِ ۱۲گانه (hub.ts)؛ gm:duels/economy/
//     fame[:{board}]/top/help/gadmin/city → کارت‌های فرزندِ همان هاب
//     V16-1: gm:contribute:{templateKey} → انتخابگرِ مبلغِ کمک از جیبِ واقعیِ
//     بازیکن (دکمه‌های gp:{projectId}:{amount} — دیگر 2000ِ ثابت نیست)
//   gc:{challengeId}:{accept|decline|cancel}   دعوتِ دوئل (موجِ ۲؛ §5.2)
//   gs:{toggle:enabled|set:noise:v|set:eventFreq:v|recover|view}   ادمین (موجِ ۲؛ Part 9)
//   gh:{m|c:{catId}[:{page}]|t:{topicId}:{page}}   کدکسِ راهنما (V14 Task 15b)
//   prefix ناشناخته → «دکمه‌ی ناشناخته.» (رفتارِ امروز، بی‌تغییر)
//
// ── قراردادِ اعتمادِ isAdmin (موجِ ۲؛ Part 9) ─────────────────────────────
//   isAdmin فقط از ترنسپورتِ ربات با service key می‌رسد — ربات پیش از فرستادن،
//   زنده getChatMember(chatId, userId) ∈ {administrator, creator} را چک کرده
//   است. موتور به ترنسپورت اعتماد می‌کند، هرگز به payload کاربر؛ تزریق از
//   مسیرِ بی‌کلید ممکن نیست (route فقط با x-service-key صحیح وارد می‌شود).
//   موجِ ۵ ربات این پرچم را برای /gadmin و gs: پر می‌کند.
//
// ── قراردادِ جای‌گذاریِ رندر ──────────────────────────────────────────────────
//   کارت‌های عمومیِ فرمان → presentation.ts؛ کارت‌های دامنه‌ای کنارِ ماشینِ حالتِ
//   خودشان می‌مانند (events.eventCardText و…) — رسمِ تثبیت‌شده، مستند در presentation.ts.
//
// ── قراردادِ SharedGroupPanel (V15-3 — مأموریت §3B/§4؛ آینه‌ی سمتِ ربات:
//    mini-services/bot/src/panels.ts) ──────────────────────────────────────────
//   «پنلِ اشتراکیِ شهر» = یک پیام در گروه، شرکت‌کننده‌هایِ زیاد، وضعیتِ مرجع در
//   همین موتور — پنل فقط «نما»یی از وضعیتِ واقعی است، نه خودِ وضعیت. دامنه‌ها
//   و گرامرشان هر مرحله‌ی چرخه‌ی حیات را پیاده می‌کنند:
//
//     created → open      gv: ← openElection/openCourt (politics.ts) · ge: ←
//                         spawnGroupEvent (events.ts) · gg: ← startGame
//                         (games.ts) · gc: ← createChallenge (challenges.ts) ·
//                         gp: ← startProject (politics.ts) — کارت با دکمه‌ها از
//                         pushOutbox به گروه می‌رود (outbox → tick → تحویل).
//     open → updated      هر submission با telegramIdِ «فشاردهنده» ثبت می‌شود
//                         (GroupCallCtx.telegramId — هرچند نفر هم‌زمان)؛ شمارش/رستر
//                         روی همان پیام ویرایش می‌شود (editCard / editMessageId)
//                         و دکمه‌ها تا وقتیِ رویداد باز است می‌مانند — ثبتِ یک نفر
//                         پنل را برای بقیه نمی‌کُشد (§3B؛ ge: از V15-3 دکمه‌ها را
//                         نگه می‌دارد؛ gv: از V16-1 سطرِ بی‌نامِ «N رأی تا الان» را
//                         بازچینی می‌کند و شمارشِ گزینه‌به‌گزینه‌ی مخفی را می‌پوشاند).
//     updated → locked    انقضای مهلت یا شرطِ پایان: resolveVote/closeVotes
//                         (فلیپِ شرطی status:"open"→"closed" — دوباره‌شماری ممکن
//                         نیست)، expireOpenEvents/resolveGroupEvent،
//                         expireStaleChallenges (همه فلیپِ شرطی).
//     locked → finalized  حلِ نهایی + کارتِ نتیجه از outbox (انتخابِ شهردار/
//                         حکمِ دادگاه/نتیجه‌ی بازی/دوئل)؛ رأی/انتخابِ تازه رد
//                         می‌شود («این رأی‌گیری بسته‌ست.» / «این اتفاق دیگه باز
//                         نیست.» / STALE_ACK) — هیچ پاداشی دوباره پرداخت نمی‌شود.
//
//   هم‌زمانی: ثبتِ هم‌زمانِ چند شهروند رویِ «همان ردیفِ مرجع» با قفلِ بخشیِ
//   in-process سریال می‌شود (domain.ts withSectionLock — vote:{id}/project:{id}/
//   game:{id})؛ مشارکتِ رویداد با unique constraint (eventId_playerId + P2002)
//   و دوبله‌فرستیِ تلگرام با dedup آپدیت‌ها (ربات). دامنه‌ی هر submission:
//   groupId + refId (vote/event/project/challenge) + playerId — دو گروهِ مختلف
//   هرگز شمارش/نتیجه‌ی هم را نمی‌بینند.
//   مالکیت ≠ مشارکت: سازنده‌ی رویداد مالکِ پنل نیست؛ فعل‌های مدیریتی (gs:/بازیابی)
//   دروازه‌ی isAdminِ جدا دارند (admin.ts) و gc: نقش‌ها را می‌سنجد (هدف/مهاجم).

import type { GroupWorld, Player } from "@prisma/client"
import type { OutboxButton, GroupActionResponseDTO } from "./types"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { spawnGroupEvent, chooseEventOption, eventCardText, eventCardButtons, participantsOf } from "./events"
import { startGame, joinGame, beginGame, gameAction, playableGames } from "./games"
import { openElection, openCourtAuto, castVote, contribute, startProject, projectMenu, contributePickerCard } from "./politics"
import { parseJson } from "./domain"
import { rumorAction } from "./world"
import { citizenVibe } from "./presence"
import { buildGroupSnapshot, buildHomeViewer } from "./snapshot"
import { createChallenge, actChallenge } from "./challenges"
import { gadminCommand, gsCallback } from "./admin"
import { ghCallback } from "./codex"
import { getCosmetic } from "../content/appearance"
import { parseEquipped } from "../content/appearance"
import { getClass } from "../content/classes"
import {
  gameHomeCardText, gameHomeButtons, cityCardText, playCardText, voteCardText,
  projectsCardText, membersCardText, historyCardText, helpCardText, MINIAPP_URL,
} from "./presentation"
import { navSection, duelsCommandCard, economyCommandCard, fameCommandCard, topCommandCard } from "./hub"

// ─── بافتِ فراخوانی (یک‌بار در facade حل می‌شود) ───────────────────────────────

/** دستگیره‌ی دیتابیس — PrismaClient و TransactionClient هر دو ساختاریاً می‌نشینند */
export type GroupDb = import("@prisma/client").Prisma.TransactionClient

/** بافتِ یک کنشِ گروهی — گروه/بازیکن یک‌بار در facade حل شده‌اند؛ handlerها
 *  فقط تصمیم می‌گیرند و دامنه را صدا می‌زنند. telegramId/isAdmin/playerName
 *  متادیتایِ ترنسپورت‌اند (موجِ ۲: ادمین/چالش از آن‌ها می‌خوانند). */
export interface GroupCallCtx {
  chatId: string            // شناسه‌ی چتِ تلگرام (صورتِ رشته‌ای — همانِ امروزِ موتور)
  chatTitle?: string        // وقتی ربات می‌فرستد (شفادهیِ عنوانِ شهر)
  telegramId?: string       // بازیکنِ کنشگر (حقیقتِ سمتِ سرور؛ player از همین حل شده)
  isAdmin?: boolean         // ادمینِ تاییدشده‌ی زنده توسطِ ربات (ترنسپورتِ service-key)
  playerName?: string       // ثبتِ عضویت
  group: GroupWorld         // ensureGroup — یک‌بار
  player: Player | null     // حل‌شده یک‌بار؛ ناظرِ خالی مجاز است — handler خودش دروازه می‌گذارد
  db: GroupDb               // برایِ lookupهای dispatch-level (مسیرِ tx در موجِ ۲)
}

// ─── شکلِ نتیجه‌ها (سیمِ پاسخ به ربات — بی‌تغییر از engineِ امروز) ─────────────

export interface GroupCommandResult {
  text: string
  buttons: OutboxButton[]
  /** نشانه‌ی «کارتِ خانه» — تنها افزودِ مجازِ موجِ ۱؛ فقط پاسخِ game/menu.
   *  رباتِ موجِ ۵ از آن برای edit-in-place استفاده می‌کند؛ تا آن موقع
   *  route آن را بی‌صدا می‌اندازد (فرمتِ سیمِ امروز دست‌نخورده). */
  kind?: "home"
}

export interface CallbackResult {
  ok: boolean
  ackText: string
  editCard?: { text: string; buttons: OutboxButton[] }
}

// ─── جدولِ فرمان‌ها ────────────────────────────────────────────────────────────

export type GroupCommandHandler = (ctx: GroupCallCtx, arg?: string) => Promise<GroupCommandResult>

/** فرمان‌هایِ /… ربات در گروه — فرمان‌هایِ دیروز + سه فرمانِ V15-1 (duels/economy/fame) */
export const COMMANDS: Record<string, GroupCommandHandler> = {
  game: async (ctx) => {
    // کارتِ خانه‌ی گروه — درِ ورودیِ شهر؛ state-aware (موجِ ۲؛ §6.3)
    const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
    const viewer = ctx.player ? await buildHomeViewer(ctx.db, ctx.group, ctx.player, snap) : null
    return {
      text: gameHomeCardText(snap, ctx.group.title, viewer),
      buttons: gameHomeButtons(snap, viewer),
      kind: "home",
    }
  },
  city: async (ctx) => {
    const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
    return {
      text: cityCardText(snap, ctx.group.title),
      buttons: [
        { label: "🎲 بازی گروهی", style: "primary", cb: "gm:play" },
        { label: "🏘 اعضا", style: "primary", cb: "gm:members" },
        { label: "🏗 پروژه‌ها", style: "primary", cb: "gm:projects" },
        // V15-1 — بازگشت به خانه از عمقِ بخشِ «شهر و جهان»/«اقتصاد»
        { label: "↩ خانه", style: "primary", cb: "gm:game" },
      ],
    }
  },
  play: async (ctx, arg) => {
    // V14 Task 15b — صفحه‌بندیِ فهرستِ بازی‌ها: 10 خط و 8 دکمه در هر صفحه.
    const page = Math.max(0, Number.isFinite(Number(arg)) ? Math.floor(Number(arg)) : 0)
    const games = await playableGames(ctx.group)
    const pageCount = Math.max(1, Math.ceil(games.length / 10))
    const p = Math.min(page, pageCount - 1)
    const buttons = games.slice(p * 8, p * 8 + 8).map((g) => ({
      label: `${g.emoji} ${g.name}`,
      style: (g.ok ? "primary" : null) as "primary" | null,
      cb: `gm:game:${g.key}`,
    }))
    if (pageCount > 1 && p < pageCount - 1) {
      buttons.push({ label: "بازی‌های بیشتر ▶", style: "primary", cb: `gm:play:${p + 1}` })
    }
    if (pageCount > 1 && p > 0) {
      buttons.push({ label: "◀ قبلی", style: "primary", cb: `gm:play:${p - 1}` })
    }
    // V15-1 — بازگشت به خانه از عمقِ بخشِ «بازی‌ها»
    buttons.push({ label: "↩ خانه", style: "primary", cb: "gm:game" })
    return { text: playCardText(games, p), buttons }
  },
  event: async (ctx) => {
    const ev = await spawnGroupEvent(ctx.group, { instigator: ctx.player ?? undefined, priority: 8 })
    if (!ev) {
      return {
        text: "یه اتفاقِ باز در شهر هست. اول همان تمام شود — شهر دو تا بحرانِ هم‌زمان نمی‌خواهد.",
        buttons: [{ label: "🎲 بازی گروهی", style: "primary", cb: "gm:play" }],
      }
    }
    return { text: "", buttons: [] } // کارت از طریق outbox می‌رود
  },
  court: async (ctx) => {
    // دادگاهِ خودجوش — متهم تصادفی از شهروندهای فعال + اتهام از حوضه‌ی COURT_CHARGES.
    // کارتِ رأی از طریق outbox با همان دکمه‌های gv: می‌رسد (ماشینِ رأیِ موجود).
    if (!ctx.player) return { text: "برای دادگاه اول باید شهروند باشی — تو گروه «منو» را بگو تا شهرت ثبت کند.", buttons: [] }
    if (!(await requireGroupMember(ctx.db, ctx.group.id, ctx.player.id))) return { text: NOT_CITIZEN_MSG, buttons: [] }
    const r = await openCourtAuto(ctx.group, ctx.player)
    return { text: r.message, buttons: [] }
  },
  vote: async (ctx) => {
    const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
    if (snap.openVotes.length === 0) {
      return {
        text: "🗳 رأی‌گیریِ بازی در جریان نیست.\nانتخاباتِ شهردار هر هفته خودکار برگزار می‌شود؛ یا می‌توانید دادگاه بسازید.",
        buttons: [
          { label: "🗳 انتخاباتِ فوری", style: "danger", cb: "gm:elect" },
          { label: "⚖️ دادگاه بساز", style: "primary", cb: "gm:court" },
          { label: "↩ خانه", style: "primary", cb: "gm:game" },
        ],
      }
    }
    const v = snap.openVotes[0]!
    return {
      text: voteCardText(v),
      buttons: v.options.map((o) => ({ label: o.label, style: o.style, cb: `gv:${v.id}:${o.key}` })),
    }
  },
  projects: async (ctx) => {
    const menu = await projectMenu(ctx.group)
    const text = projectsCardText(menu)
    const buttons = menu
      .filter((p) => p.status === "none" || p.status === "building")
      .slice(0, 6)
      .map((p) => ({
        label: p.status === "building" ? `${p.emoji} ادامه‌ی ${p.name}` : `${p.emoji} ${p.name}`,
        style: (p.status === "building" ? "success" : "primary") as "success" | "primary",
        cb: p.status === "building" ? `gm:contribute:${p.key}` : `gm:newproject:${p.key}`,
      }))
    // V15-1 — بازگشت به خانه از عمقِ بخش‌های «شهر و جهان»/«اقتصاد»
    buttons.push({ label: "↩ خانه", style: "primary", cb: "gm:game" })
    return { text, buttons }
  },
  members: async (ctx) => {
    const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
    // V14 Task 15b — چیپِ هویتِ فمبوی کنارِ هر عضوی که فمبوی دارد: ایموجیِ کلاس
    // + ✨ به‌ازایِ مرحله‌ی فرگشت + ایموجیِ اکسسوارِ پوشیده (batch lookupِ سبک)
    const memberIds = snap.members.map((m) => m.playerId)
    const souls = memberIds.length
      ? await ctx.db.soulCharacter.findMany({
          where: { playerId: { in: memberIds } },
          select: { playerId: true, classKey: true, evolution: true, appearanceJson: true },
        })
      : []
    const chips: Record<string, string> = {}
    for (const s of souls) {
      const cls = getClass(s.classKey)
      const acc = parseEquipped(s.appearanceJson).accessory
      const accEmoji = acc ? getCosmetic(acc)?.emoji ?? "" : ""
      chips[s.playerId] = [cls?.emoji ?? "✨", ...Array.from({ length: Math.min(3, s.evolution) }, () => "✨"), accEmoji]
        .filter(Boolean)
        .join("")
    }
    const text = membersCardText(snap.members.slice(0, 8), chips)
    return {
      text,
      buttons: [
        { label: "↩ خانه", style: "primary", cb: "gm:game" },
        { label: "🏗 پروژه‌ها", style: "primary", cb: "gm:projects" },
      ],
    }
  },
  history: async (ctx) => {
    const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
    const text = historyCardText(snap.history.slice(0, 8))
    return {
      text,
      buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }],
    }
  },
  help: async () => {
    return {
      text: helpCardText(),
      buttons: [
        { label: "📚 راهنمای کامل", style: "primary", cb: "gh:m" },
        { label: "🎀 ساختنِ فمبوی", style: "success", url: "https://t.me/femwarbot?start=femboy" },
        { label: "↩ خانه", style: "primary", cb: "gm:game" },
      ],
    }
  },
  duel: async (ctx, arg) => {
    // /duel {targetTelegramId} — موجِ ۲؛ ربات شناسه‌ی تلگرامیِ هدف را به‌عنوانِ آرگومان
    // می‌فرستد (قراردادِ موجِ ۵). بدونِ آرگومان → کارتِ راهنمایِ کوتاه.
    // تا موجِ ۵ ربات /duel خودش را حل می‌کند؛ این فرمان بی‌صدا می‌ماند — بدونِ تضاد.
    return createChallenge(ctx, (arg ?? "").trim())
  },
  duels: async (ctx) => {
    // V15-1 — دعوت‌های دوئلِ این شهر: بازها با دکمه‌های نقشی (gc:)، آخرین نتیجه‌ها،
    // راهنمایِ reply. عبارتِ ربات در موجِ V15-2 به همین فرمان وصل می‌شود.
    return duelsCommandCard(ctx)
  },
  economy: async (ctx) => {
    // V15-1 — اقتصاد و بازار: صندوق/اعتبار/پروژه از شهر + شاخصِ جهان و آگهی‌هایِ فعال
    // از همان داده‌ای که رباتِ خصوصی/مینی‌اپ می‌بینند (بدونِ شمارنده‌ی ساختگی).
    return economyCommandCard(ctx)
  },
  fame: async (ctx, arg) => {
    // V15-1 — تالارِ افتخارات: همان hallOfFameِ موتور (۶ تابلو از soulCharacterهایِ
    // واقعی) + شمارِ دستاوردهایِ همین شهر. آرگومان = کلیدِ تخته (اختیاری).
    return fameCommandCard(ctx, (arg ?? "").trim() || "level")
  },
  gadmin: async (ctx) => {
    // /gadmin — کارتِ وضعیت/تنظیماتِ شهر (Part 9)؛ دکمه‌ها فقط برای ادمینِ تاییدشده
    return gadminCommand(ctx)
  },
}

const UNKNOWN_COMMAND: GroupCommandResult = { text: "چنین فرمانی در دفترِ شهر نیست.", buttons: [] }

/** dispatch فرمان — قطعی: تطابقِ دقیقِ نام؛ گم‌شده = کارتِ «در دفترِ شهر نیست» */
export async function dispatchCommand(ctx: GroupCallCtx, command: string, arg?: string): Promise<GroupCommandResult> {
  const handler = COMMANDS[command]
  if (!handler) return UNKNOWN_COMMAND
  return handler(ctx, arg)
}

// ─── جدولِ کال‌بک‌ها ────────────────────────────────────────────────────────────

export type GroupCallbackHandler = (ctx: GroupCallCtx, data: string) => Promise<CallbackResult>

/** کال‌بک‌هایِ دکمه‌ای — کلید = prefix (تا اولین «:»)؛ گرامر در سردرِ فایل */
export const CALLBACKS: Record<string, GroupCallbackHandler> = {
  ge: async (ctx, data) => {
    // ge:{eventId}:{choiceKey}
    const rest = data.split(":").slice(1)
    const eventId = rest[0]
    const choiceKey = rest.slice(1).join(":")
    if (!eventId || !choiceKey) return { ok: false, ackText: "دکمه‌ی ناقص." }
    const r = await chooseEventOption(ctx.group, ctx.player!, eventId, choiceKey)
    if (!r.ok) return { ok: false, ackText: r.ackText }
    // V15-3 (مأموریت §3B) — کارتِ رویدادِ اشتراکی دکمه‌هایِ انتخابش را نگه می‌دارد:
    // ثبتِ یک شهروند پنل را برای بقیه نمی‌کُشد؛ تکرارِ همان شهروند توستِ مهربان
    // می‌گیرد (chooseEventOption) و بقیه از همان پیام انتخاب می‌کنند.
    return { ok: true, ackText: r.ackText, editCard: { text: r.cardText, buttons: r.cardButtons } }
  },
  gg: async (ctx, data) => {
    // gg:{sessionId}:{j|b|a:qi:ai|v:key|bid:step|pass}
    const rest = data.split(":").slice(1)
    const sessionId = rest[0]!
    const action = rest[1] ?? ""
    const inner = rest.slice(2).join(":")
    if (action === "j") {
      const r = await joinGame(ctx.group, ctx.player!, sessionId)
      return { ok: r.ok, ackText: r.ackText, editCard: { text: r.cardText, buttons: r.cardButtons } }
    }
    if (action === "b") {
      const r = await beginGame(ctx.group, sessionId, ctx.player!)
      return { ok: r.ok, ackText: r.message }
    }
    const r = await gameAction(ctx.group, ctx.player!, sessionId, action, inner)
    return { ok: r.ok, ackText: r.ackText }
  },
  gv: async (ctx, data) => {
    // gv:{voteId}:{optionKey}
    const rest = data.split(":").slice(1)
    const voteId = rest[0]
    const optionKey = rest.slice(1).join(":")
    if (!voteId || !optionKey) return { ok: false, ackText: "رأی ناقص." }
    const r = await castVote(ctx.group, ctx.player!, voteId, optionKey)
    if (!r.ok) return { ok: false, ackText: r.ackText }
    // V16-1 (مشکل ③ ممیزی) — پنلِ رأی زنده: همان پیام با سطرِ بی‌نامِ «N رأی تا
    // الان» بازچینی می‌شود و دکمه‌های gv: دوباره سِرو می‌شوند (الگویِ ge:)؛ رأی‌هایِ
    // مخفی همچنان مخفی‌اند — فقط شمارِ مشارکت عمومی است.
    return { ok: true, ackText: r.ackText, editCard: { text: r.cardText, buttons: r.cardButtons } }
  },
  ru: async (ctx, data) => {
    // ru:{rumorId}:{inv|spr|deny}
    const rest = data.split(":").slice(1)
    const rumorId = rest[0]
    const action = rest[1] as "inv" | "spr" | "deny"
    if (!rumorId || !action) return { ok: false, ackText: "؟" }
    const msg = await rumorAction(ctx.group, ctx.player!, rumorId, action)
    return { ok: true, ackText: msg }
  },
  gp: async (ctx, data) => {
    // gp:{projectId}:{amount}
    const rest = data.split(":").slice(1)
    const projectId = rest[0]
    const amount = Number(rest[1])
    if (!projectId || !Number.isFinite(amount)) return { ok: false, ackText: "مبلغ نامفهوم." }
    const project = await ctx.db.groupProject.findFirst({ where: { id: projectId, groupId: ctx.group.id } })
    if (!project) return { ok: false, ackText: "پروژه پیدا نشد." }
    const r = await contribute(ctx.group, ctx.player!, projectId, amount)
    return { ok: r.ok, ackText: r.ackText }
  },
  cit: async (ctx, data) => {
    // cit:{playerId}:{vibe}
    const rest = data.split(":").slice(1)
    const targetId = rest[0]
    const vibe = rest[1]
    if (!targetId || !vibe) return { ok: false, ackText: "؟" }
    if (targetId !== ctx.player!.id) return { ok: false, ackText: "آبروی کسِ دیگری را نمی‌توان انتخاب کرد. متأسفانه." }
    const msg = await citizenVibe(ctx.group, ctx.player!, vibe)
    return { ok: true, ackText: msg }
  },
  gm: async (ctx, data) => {
    return groupMenuCallback(ctx, data.split(":").slice(1).join(":"))
  },
  gc: async (ctx, data) => {
    // gc:{challengeId}:{accept|decline|cancel} — چرخه‌ی رضایتیِ دوئل (موجِ ۲)
    const rest = data.split(":").slice(1)
    const challengeId = rest[0]
    const verb = rest[1] ?? ""
    if (!challengeId || !verb) return { ok: false, ackText: "دکمه‌ی ناقص." }
    return actChallenge(ctx, challengeId, verb)
  },
  gs: async (ctx, data) => {
    // gs:{…} — ادمین/تنظیمات (موجِ ۲)؛ دروازه‌ی isAdmin داخلِ gsCallback است
    return gsCallback(ctx, data)
  },
  gh: async (ctx, data) => {
    // gh:{m|c:{catId}|t:{topicId}:{page}} — کدکسِ راهنما (V14 Task 15b)؛
    // رندرِ خالص از رجیستری — بدونِ state/DB؛ درجا-ویرایش مثلِ gg:
    return ghCallback(ctx, data)
  },
}

const UNKNOWN_CALLBACK: CallbackResult = { ok: false, ackText: "دکمه‌ی ناشناخته." }

/** dispatch کال‌بک — کلید = prefix تا اولین «:»؛ ناشناخته = «دکمه‌ی ناشناخته.» */
export async function dispatchCallback(ctx: GroupCallCtx, data: string): Promise<CallbackResult> {
  const tag = data.split(":")[0] ?? ""
  const handler = CALLBACKS[tag]
  if (!handler) return UNKNOWN_CALLBACK
  return handler(ctx, data)
}

/** منویِ gm: — زیرمنوهایِ کارت‌هایِ شهر (کارت‌ها را از dispatchCommand می‌گیرند؛
 *  گروه دوباره resolve نمی‌شود — همان ctx) */
async function groupMenuCallback(ctx: GroupCallCtx, arg: string): Promise<CallbackResult> {
  const group = ctx.group
  const player = ctx.player!
  // V15-1 — هابِ ۱۲-بخشی: gm:nav:{key} → کارتِ بخش با فرزندان و بازگشت به خانه
  if (arg.startsWith("nav:")) {
    return navSection(ctx, arg.slice(4))
  }
  if (arg.startsWith("game:")) {
    const key = arg.slice(5)
    const r = await startGame(group, key, player)
    return { ok: r.ok, ackText: r.message }
  }
  if (arg.startsWith("newproject:")) {
    const key = arg.slice(11)
    const r = await startProject(group, key)
    return { ok: r.ok, ackText: r.message }
  }
  if (arg.startsWith("contribute:")) {
    const key = arg.slice(11)
    const project = await ctx.db.groupProject.findFirst({ where: { groupId: group.id, templateId: key, status: "building" } })
    if (!project) return { ok: false, ackText: "این پروژه در ساخت نیست." }
    // V16-1 (مشکل ⑩ ممیزی) — به‌جایِ 2000ِ ثابتِ پنهان: انتخابگرِ مبلغ با
    // پیشرفتِ واقعیِ پروژه و جیبِ واقعیِ بازیکن. دکمه‌ها همان گرامرِ موجودِ
    // gp:{projectId}:{amount} را می‌برند؛ کارت‌های قدیمیِ gp: (مثلاً 1000/5000/20000)
    // همچنان مستقیم و بی‌تغییر کار می‌کنند — سازگاریِ عقبیِ کامل.
    const contributed = parseJson<Record<string, number>>(project.contributedJson, {})
    const total = Object.values(contributed).reduce((s, v) => s + v, 0)
    const card = contributePickerCard(project, total, player.money)
    return { ok: true, ackText: "مبلغِ کمک را انتخاب کن.", editCard: { text: card.text, buttons: card.buttons } }
  }
  switch (arg) {
    case "play": {
      const r = await dispatchCommand(ctx, "play")
      return { ok: true, ackText: "منوی بازی", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "play:more": {
      // V14 Task 15b — صفحه‌ی بعدِ فهرستِ بازی‌ها (دکمه‌ی «بازی‌های بیشتر ▶»)
      const r = await dispatchCommand(ctx, "play", "1")
      return { ok: true, ackText: "صفحه‌ی بعدِ بازی‌ها", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "event": {
      // اگر اتفاقِ بازی باز است، کارتش دوباره رندر می‌شود (پیوستن با دکمه‌های خودش)؛
      // وگرنه همان رفتارِ دیروز — اتفاقِ تازه (موجِ ۲: دکمه‌ی contextuی خانه به این‌جا می‌آید)
      const open = await ctx.db.groupEvent.findFirst({ where: { groupId: group.id, status: "open" } })
      if (open) {
        return {
          ok: true,
          ackText: "اتفاقِ باز — انتخابت را بزن.",
          editCard: { text: eventCardText(open, await participantsOf(open)), buttons: eventCardButtons(open) },
        }
      }
      const ev = await spawnGroupEvent(group, { instigator: player, priority: 8 })
      return { ok: Boolean(ev), ackText: ev ? "اتفاق ساخته شد." : "یه اتفاقِ باز هست — اول همان." }
    }
    case "projects": {
      const r = await dispatchCommand(ctx, "projects")
      return { ok: true, ackText: "پروژه‌ها", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "vote": {
      const r = await dispatchCommand(ctx, "vote")
      return { ok: true, ackText: "رأی‌گیری", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "city": {
      // V15-1 — بخشِ «شهر و جهان»/«اقتصاد» به این کارت لینک می‌کند
      const r = await dispatchCommand(ctx, "city")
      return { ok: true, ackText: "وضعیتِ شهر", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "duels": {
      // V15-1 — بخشِ «نبردها»: کارتِ دعوت‌هایِ دوئل
      const r = await dispatchCommand(ctx, "duels")
      return { ok: true, ackText: "دعوت‌های دوئل", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "economy": {
      // V15-1 — بخشِ «اقتصاد»: کارتِ بازار و شاخص
      const r = await dispatchCommand(ctx, "economy")
      return { ok: true, ackText: "اقتصاد و بازار", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "fame": {
      // V15-1 — بخشِ «افتخارات»/«فمبوی‌ها»/«نبردها»: تالارِ افتخارات
      const r = await dispatchCommand(ctx, "fame")
      return { ok: true, ackText: "تالارِ افتخارات", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "top": {
      // V15-1 — بخشِ «بازیکن‌ها»: برترین‌های همین شهر از آمارِ واقعیِ اعضا
      const r = await topCommandCard(ctx)
      return { ok: true, ackText: "برترین‌های شهر", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "help": {
      // V15-1 — بخشِ «راهنما»: کارتِ راهنمایِ سریعِ گروه (همان فرمانِ help)
      const r = await dispatchCommand(ctx, "help")
      return { ok: true, ackText: "راهنما", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "gadmin": {
      // V15-1 — بخشِ «تنظیمات»: کارتِ ادمین (دکمه‌های gs: فقط برای ادمینِ تاییدشده)
      const r = await gadminCommand(ctx)
      return { ok: true, ackText: "تنظیماتِ شهر", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "members": {
      const r = await dispatchCommand(ctx, "members")
      return { ok: true, ackText: "شهروندها", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "history": {
      const r = await dispatchCommand(ctx, "history")
      return { ok: true, ackText: "تاریخچه", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "game": {
      const r = await dispatchCommand(ctx, "game")
      return { ok: true, ackText: "خانه‌ی شهر", editCard: { text: r.text, buttons: r.buttons } }
    }
    case "elect": {
      const r = await openElection(group, "mayor")
      return { ok: r.ok, ackText: r.message }
    }
    case "court": {
      // دکمه‌ی «⚖️ دادگاه بساز» از کارتِ رأی — همان مسیرِ فرمانِ court
      const r = await openCourtAuto(group, player)
      return { ok: r.ok, ackText: r.message }
    }
    case "app": {
      // کارت‌های قدیمی هنوز cb "gm:app" دارند — دکمه‌ی تازه در کارتِ خانه لینکِ مستقیم است
      return {
        ok: true,
        ackText: MINIAPP_URL ? "دوباره «منو» را بگو — دکمه‌ی 📱 حالا مستقیم مینی‌اپ را باز می‌کند." : "مینی‌اپ هنوز پیکربندی نشده.",
      }
    }
    default:
      if (arg.startsWith("play:")) {
        // gm:play:{page} — صفحه‌بندیِ فهرستِ بازی‌ها (V14 Task 15b)
        const page = arg.slice(5)
        const r = await dispatchCommand(ctx, "play", Number.isFinite(Number(page)) ? page : undefined)
        return { ok: true, ackText: "بازی‌ها", editCard: { text: r.text, buttons: r.buttons } }
      }
      if (arg.startsWith("fame:")) {
        // gm:fame:{board} — تعویضِ تخته‌ی تالارِ افتخارات (V15-1؛ کلیدها از hallOfFame)
        const r = await fameCommandCard(ctx, arg.slice(5))
        return { ok: true, ackText: "تالارِ افتخارات", editCard: { text: r.text, buttons: r.buttons } }
      }
      return { ok: false, ackText: "؟" }
  }
}

// ─── جدولِ اکشن‌های Mini App ─────────────────────────────────────────────────

export type GroupActionHandler = (ctx: GroupCallCtx, payload: Record<string, unknown>) => Promise<GroupActionResponseDTO>

/** اکشن‌های Mini App (session-auth) — دروازه‌ی شهروندی در facade است (امروز هم آنجاست) */
export const ACTIONS: Record<string, GroupActionHandler> = {
  contribute: async (ctx, payload) => {
    const key = String(payload.projectKey ?? "")
    const amount = Number(payload.amount ?? 0)
    const project = await ctx.db.groupProject.findFirst({ where: { groupId: ctx.group.id, templateId: key, status: "building" } })
    if (!project) return { ok: false, message: "این پروژه در ساخت نیست." }
    // سقف‌های موتور (politics.contribute): > 0 و ≤ 500,000 — همان قاعده‌ی gp:
    const r = await contribute(ctx.group, ctx.player!, project.id, Math.min(500000, Math.max(0, amount)))
    return { ok: r.ok, message: r.ackText }
  },
  startProject: async (ctx, payload) => {
    const r = await startProject(ctx.group, String(payload.projectKey ?? ""))
    return { ok: r.ok, message: r.message }
  },
  vote: async (ctx, payload) => {
    const voteId = String(payload.voteId ?? "")
    const optionKey = String(payload.optionKey ?? "")
    const r = await castVote(ctx.group, ctx.player!, voteId, optionKey)
    return { ok: r.ok, message: r.ackText }
  },
  joinGame: async (ctx, payload) => {
    const sessionId = String(payload.sessionId ?? "")
    const r = await joinGame(ctx.group, ctx.player!, sessionId)
    return { ok: r.ok, message: r.ackText }
  },
  startGame: async (ctx, payload) => {
    const r = await startGame(ctx.group, String(payload.gameKey ?? ""), ctx.player!)
    return { ok: r.ok, message: r.message }
  },
  triggerEvent: async (ctx) => {
    const ev = await spawnGroupEvent(ctx.group, { instigator: ctx.player!, priority: 8 })
    return { ok: Boolean(ev), message: ev ? "اتفاق در گروه اعلام شد." : "یه اتفاقِ باز هست." }
  },
  rumor: async (ctx, payload) => {
    const rumorId = String(payload.rumorId ?? "")
    const act = String(payload.rumorAction ?? "inv") as "inv" | "spr" | "deny"
    const msg = await rumorAction(ctx.group, ctx.player!, rumorId, act)
    return { ok: true, message: msg }
  },
  challenge: async (ctx, payload) => {
    // V14 موجِ ۱۶b — دعوتِ دوئل از Mini App: پلِ همانِ gc: (§5.2) رویِ سیمِ session.
    // actChallenge خودش نقش‌ها را می‌سنجد (هدف/مهاجم/ناظر) و متنِ receipt را می‌دهد.
    const challengeId = String(payload.challengeId ?? "")
    const verb = String(payload.verb ?? "")
    if (!challengeId || (verb !== "accept" && verb !== "decline" && verb !== "cancel")) {
      return { ok: false, message: "دعوت ناقص است — شهرداری نمی‌داند با کدام دوئل چه کند." }
    }
    const r = await actChallenge(ctx, challengeId, verb)
    return { ok: r.ok, message: r.ackText }
  },
}

const UNKNOWN_ACTION: GroupActionResponseDTO = { ok: false, message: "چنین کاری در این شهر تعریف نشده." }

/** dispatch اکشنِ Mini App — قطعی؛ گم‌شده = «چنین کاری در این شهر تعریف نشده.» */
export async function dispatchAction(ctx: GroupCallCtx, action: string, payload: Record<string, unknown>): Promise<GroupActionResponseDTO> {
  const handler = ACTIONS[action]
  if (!handler) return UNKNOWN_ACTION
  return handler(ctx, payload)
}
