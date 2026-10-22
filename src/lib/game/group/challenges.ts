// FEMBOY WAR — V13 موجِ ۲ (§5.2): چالشِ دوئل — چرخه‌ی حیاتِ رضایتی.
//
//   /duel {targetTelegramId}  →  create()  →  ردیفِ pending + دعوت‌نامه از outbox
//   →  gc:{id}:accept|decline|cancel  →  act()  →  فلیپِ شرطی (تنها یک برنده دارد)
//   →  قبول: duelCharacters در-پروسه (مرجعِ اقتدارگرا؛ گاردهای استقامت/روحیه
//       داخلِ تراکنشِ خودش دوباره چک می‌شوند) → resolved + کارتِ نتیجه
//       با ویرایشِ همان پیامِ دعوت (editMessageId) یا کارتِ تازه
//   →  تیک: expireStaleChallenges — دعوتِ سرآمده می‌میرد و کارتش عوض می‌شود.
//
// حفاظ‌ها (§5.5/§8):
//   • بازپخش/دوبار-قبولی: فلیپِ شرطی updateMany — کنشِ دوم count=0 می‌گیرد و
//     «این اتفاق دیگه باز نیست.» می‌شنود؛ duelCharacters فقط دستِ برنده‌ی فلیپ
//     صدا می‌شود → پاداش دقیقاً یک‌بار.
//   • مالکیت: قبول/رد فقط هدف؛ لغو فقط مهاجم؛ عضویتِ هر دو طرف دوباره چک می‌شود.
//   • ایزولاسیونِ گروهی: هر خواندن/نوشتن با groupId همان شهر مقید است.
//   • کول‌داونِ جفت + سقف‌های pending (گروه/بازیکن) پیش از ساخت.
//
// لایه‌ی متن (V11 «شیشه»): کارت‌ها HTML — نام‌های پویا esc()، اعداد chip()،
// مکالمه‌ی دوئل زیرِ expand()؛ برچسبِ دکمه‌ها و ackText خام/PLAIN با رقمِ انگلیسی.

import { db } from "@/lib/db"
import type { GroupWorld, Player, SoulCharacter, GroupChallenge, Prisma } from "@prisma/client"
import type { GroupCallCtx } from "./router"
import type { OutboxButton } from "./types"
import { duelCharacters } from "../combat"
import { getClass, spiritCondition } from "../content/classes"
import { SOUL, regenElapsed, effectiveStaminaMax } from "../character"
import {
  esc, parseJson, cultureOf, bumpCulture, pushOutbox, pushOutboxTx, addHistoryTx,
} from "./domain"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { SUB, DOTS, chip, spoiler, expand, quote, emblem } from "./text"

export type ChDb = Prisma.TransactionClient

// ─── پیچ‌های تنظیم (قابلِ چرخش در بالانس) ─────────────────────────────────────

/** مهلتِ جوابِ دعوت (دقیقه) */
export const EXPIRY_MIN = 10
/** کول‌داونِ دوئلِ دوباره‌ی همان جفت (دقیقه) */
export const PAIR_COOLDOWN_MIN = 30
/** سقفِ دعوت‌های بی‌جوابِ هم‌زمان در هر گروه */
export const GROUP_PENDING_CAP = 2
/** سقفِ دعوتِ بی‌جوابِ هم‌زمان به‌ازایِ هر بازیکن (به‌عنوان مهاجم و به‌عنوان هدف) */
export const PER_PLAYER_PENDING_CAP = 1

/** لینکِ عمومیِ پی‌ویِ ربات برای ساختنِ فمبوی — گروه سازنده‌ی کاراکتر نیست (§4.3) */
export const FEMBOY_START_URL = "https://t.me/femwarbot?start=femboy"

/** پیامِ حالتِ مرده — دعوتی که دیگر باز نیست (همان صدای رویدادها) */
export const STALE_ACK = "این اتفاق دیگه باز نیست."

// ─── اشکالِ نتیجه ──────────────────────────────────────────────────────────────

/** پاسخِ کارت‌دار به فرمانِ /duel — ساختاریاً همانِ GroupCommandResult روت‌ر */
export interface ChallengeCard {
  text: string
  buttons: OutboxButton[]
}

/** پاسخِ کنشِ gc: — ساختاریاً همانِ CallbackResult روت‌ر */
export interface ChallengeActResult {
  ok: boolean
  ackText: string
  editCard?: { text: string; buttons: OutboxButton[] }
}

/** یک طرفِ دوئل برای کارت‌ها — فمبوی روح‌بسته، نه فقط بازیکن */
export interface DuelSideInfo {
  playerName: string
  femboyName: string
  classEmoji: string
  className: string
  level: number
}

// ─── پیش‌چک‌های گارد (آینه‌ی duelCharacters — فقط پیش‌فیلتر مهربان؛
//     حکمِ نهایی داخلِ تراکنشِ خودِ دوئل داده می‌شود) ────────────────────────────

/** استقامتِ مؤثر با احتسابِ بازسازی — همان ریاضیِ syncCharacter بدون نوشتن */
function effectiveStamina(char: SoulCharacter): number {
  const max = Math.max(char.staminaMax, effectiveStaminaMax(char))
  return regenElapsed(char.stamina, max, char.staminaAt).stamina
}

async function sideInfo(playerId: string): Promise<{ player: Player; char: SoulCharacter } | null> {
  const player = await db.player.findUnique({ where: { id: playerId } })
  if (!player) return null
  const char = await db.soulCharacter.findUnique({ where: { playerId } })
  if (!char) return null
  return { player, char }
}

function sideInfoOf(player: Player, char: SoulCharacter): DuelSideInfo {
  const cls = getClass(char.classKey)
  return {
    playerName: player.name,
    femboyName: char.name,
    classEmoji: cls?.emoji ?? "✨",
    className: cls?.name ?? char.classKey,
    level: char.level,
  }
}

// ─── کارت‌سازهای خالص (تست‌پذیر؛ V11 «شیشه») ───────────────────────────────────

/** کارتِ دعوت‌نامه — مهمانِ اصلیِ outbox با اولویتِ بالا.
 *  V24 «ظاهرِ شهر»: نشانِ ⚔️ در مرکزِ جداکننده + بلوکِ VS با ایموجیِ کلاسِ هر دو
 *  طرف + مهلتِ جواب زیرِ بلوکِ نقل‌قولی (چشم را می‌گیرد). */
export function invitationCardText(a: DuelSideInfo, b: DuelSideInfo, minutes: number): string {
  const mm = String(minutes).padStart(2, "0")
  // V26 (بازسازی §4.D — کیبورد/کارتِ تعاملِ اشتراکیِ گروه): کارتِ دعوت حالا
  // «اسکورکارتِ دو ستونه» است — هر طرف یک بلوکِ یکسانِ ۳خطی (فمبوی/کلاس/سطح)
  // با نشانگرِ 🔴 آغازگر / 🔵 مدعو؛ خطِ VS وسط؛ مالکیتِ دکمه‌ها (§4.C) و هزینه
  // آخرِ کارت. دیروز دو بلوکِ ناهم‌اندازه با تکرارِ سطحِ جدا بود.
  return [
    "⚔️ <b>دعوتِ دوئل</b>",
    emblem("⚔️"),
    "",
    `🔴 ${a.classEmoji} <b>${esc(a.femboyName)}</b> — آغازگر`,
    `${esc(a.className)} · سطح ${chip(a.level)}`,
    "",
    "⚡ <b>در برابرِ</b> ⚡",
    "",
    `🔵 ${b.classEmoji} <b>${esc(b.femboyName)}</b> — مدعو`,
    `${esc(b.className)} · سطح ${chip(b.level)}`,
    "",
    DOTS,
    "",
    quote(`⏳ مهلتِ جواب: ${chip(`${mm}:00`)}`),
    spoiler(`جایزه‌ی شهر: ${chip(250)}–${chip(420)} سکه به برنده — به انتخابِ شانس`),
    "",
    `↩️ قبول/رد فقط از ${esc(b.playerName)} · پس‌گرفتن فقط از ${esc(a.playerName)}.`,
    `هر دو فمبوی ${chip(SOUL.DUEL_COST)} استقامت می‌دهند.`,
  ].join("\n")
}

/** کارتِ حالتِ مرده — رد/لغو/انقضا؛ کوتاه و بسته‌شده.
 *  V24: نشانِ ⚔️ + عبارتِ پایانی زیرِ quote. */
export function challengeDeadCardText(
  a: DuelSideInfo,
  b: DuelSideInfo,
  status: "declined" | "cancelled" | "expired" | "guards",
  note?: string,
): string {
  const lines: Record<string, string> = {
    declined: "✖️ رد شد. شهر عذرخواهی‌های کوتاه را دوست دارد.",
    cancelled: "🚪 مهاجم پسش گرفت. شجاعت هم گاهی پست‌اندازه است.",
    expired: "⌛ مهلت گذشت. دعوت‌نامه در آرشیوِ شهر دفن شد.",
    guards: "⚡ شهر هنگامِ سنجشِ فمبوی‌ها کمبود دید — دوئل برگزار نشد.",
  }
  return [
    "⚔️ <b>دعوتِ دوئل</b> — بسته شد",
    emblem("⚔️"),
    "",
    `${a.classEmoji} <b>${esc(a.femboyName)}</b> در برابرِ ${b.classEmoji} <b>${esc(b.femboyName)}</b>`,
    "",
    quote(lines[status] ?? ""),
    ...(note ? ["", `<i>${esc(note)}</i>`] : []),
  ].join("\n")
}

/** کارتِ نتیجه — بردِ برنده + خطِ هر بازیکن + مکالمه‌ی دوئل زیرِ expand.
 *  V24: نشانِ ⚔️ + ردیف‌های مدال/XP با نشانگرِ ▪ (محتوا دست‌نخورده). */
export function challengeResultCardText(
  a: DuelSideInfo,
  b: DuelSideInfo,
  r: {
    winnerIsChallenger: boolean
    rounds: number
    prize: number
    log: string[]
  },
): string {
  const w = r.winnerIsChallenger ? a : b
  const l = r.winnerIsChallenger ? b : a
  // سطرهای خالیِ پشت‌سرِ‌هم یکی می‌شوند (وقتی log خالی است دوتا خالی نمی‌افتد)
  // — اما ریتمِ «شیشه» (سطرِ خالیِ بینِ بلوک‌ها) حفظ می‌شود.
  const lines: string[] = []
  for (const s of [
    "⚔️ <b>نتیجه‌ی دوئلِ شهر</b>",
    emblem("⚔️"),
    "",
    `🏆 <b>${esc(w.femboyName)}</b> دوئل را برد — ${chip(r.rounds)} راند.`,
    "",
    DOTS,
    "",
    `▪ ${w.classEmoji} <b>${esc(w.femboyName)}</b> · سطح ${chip(w.level)}: جایزه ${chip(r.prize)} سکه · روحیه ${chip("+6")}`,
    `▪ ${l.classEmoji} <b>${esc(l.femboyName)}</b> · سطح ${chip(l.level)}: روحیه ${chip("-10")}`,
    `▪ استقامتِ هر دو: ${chip(SOUL.DUEL_COST)}−`,
    "",
    r.log.length > 0 ? expand(r.log.map((line) => esc(line)).join("\n")) : "",
    "",
    SUB,
    "",
    "<i>شهر شمشیرها را جمع کرد. سابقه‌ی هر دو فمبوی ثبت شد.</i>",
  ]) {
    if (s === "" && lines[lines.length - 1] === "") continue
    lines.push(s)
  }
  return lines.join("\n")
}

/** کارتِ راهنمای کوتاهِ دوئل بدونِ هدف — V24: نشانِ ⚔️ + قانونِ رضایت زیرِ quote */
export function duelUsageCardText(): string {
  return [
    "⚔️ <b>دوئل</b>",
    emblem("⚔️"),
    "",
    `روی پیامِ رقیب reply بزن و ${chip("جنگ فمبوی")} بگو — یا از کارتِ عمومیِ فمبوی‌اش دکمه‌ی دوئل را بزن.`,
    `هزینه: ${chip(SOUL.DUEL_COST)} استقامت از هر دو فمبوی · مهلتِ جواب ${chip(EXPIRY_MIN)} دقیقه · هر دو باید فمبوی داشته باشند.`,
    `امضای کلاسِ هر دو فمبوی در میدان زنده است — نشانِ سایه، سپرِ عهد، کارتِ سلطنتی، گرگِ روح و…`,
    "",
    quote("بدونِ رضایتِ هدف، دوئلی در کار نیست — شهر دعوت‌نامه‌های بی‌جواب را دفن می‌کند."),
  ].join("\n")
}

/** کارتِ ack برای فرستنده‌ی دعوت — V24: نشانِ ⚔️ + سرنوشتِ دعوت زیرِ quote */
export function challengeSentCardText(b: DuelSideInfo, minutes: number): string {
  const mm = String(minutes).padStart(2, "0")
  return [
    "⚔️ <b>دعوت‌نامه فرستاده شد</b>",
    emblem("⚔️"),
    "",
    `فمبویِ تو در برابرِ ${b.classEmoji} <b>${esc(b.femboyName)}</b> ایستاده است.`,
    `جواب روی کارتِ دعوت‌نامه می‌آید — مهلت ${chip(`${mm}:00`)}.`,
    "",
    quote("اگر جواب نیامد، شهر خودش دعوت را دفن می‌کند."),
  ].join("\n")
}

// ─── ساختِ دعوت (فرمانِ /duel) ─────────────────────────────────────────────────

/** کول‌داونِ جفت — کلیدِ کانونیِ {aId}:{bId} با ترتیبِ الفبایی؛ مقدار = ISO رشته‌ی
 *  زمانِ آخرین دعوت. چرا رشته؟ bumpCulture اعداد را «جمع» می‌کند و رشته‌ها را
 *  «نِشسته» می‌گذارد — مهرِ زمانی باید نِشسته شود (همان ترفندِ botMissingAt). */
function pairCooldownKey(aId: string, bId: string): string {
  return `duelCd:${[aId, bId].sort().join(":")}`
}

function pairCooldownAt(group: GroupWorld, aId: string, bId: string): number {
  const v = cultureOf(group)[pairCooldownKey(aId, bId)]
  if (typeof v === "number") return v // پشتیبانِ مقدارهای عددیِ قدیمی
  if (typeof v === "string") {
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

/** /duel {targetTelegramId} — ساختِ دعوت با تمامِ دروازه‌ها؛ خروجی = کارتِ پاسخ */
export async function createChallenge(ctx: GroupCallCtx, targetTelegramId: string): Promise<ChallengeCard> {
  const group = ctx.group
  const player = ctx.player
  if (!player) return { text: "برای دوئل اول باید شهروند باشی — تو گروه «بازی‌های گروه» را بگو.", buttons: [] }
  if (!(await requireGroupMember(ctx.db, group.id, player.id))) return { text: NOT_CITIZEN_MSG, buttons: [] }

  // هدف — ربات شناسه‌ی تلگرامیِ هدف را به‌عنوانِ آرگومان می‌فرستد
  const digits = targetTelegramId.replace(/\D/g, "")
  if (!digits) return { text: duelUsageCardText(), buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }] }
  const target = await ctx.db.player.findUnique({ where: { telegramId: digits } })
  if (!target) {
    return {
      text: `⚔️ این شهروند هنوز به شهر معرفی نشده — اول باید در پی‌ویِ ربات ${chip("شروع")} بگوید.`,
      buttons: [],
    }
  }
  if (target.id === player.id) return { text: "با خودت دوئل؟ شهر این‌قدر هم خسته نیست.", buttons: [] }
  if (!(await requireGroupMember(ctx.db, group.id, target.id))) {
    return { text: `«${esc(target.name)}» هنوز شهروندِ این شهر نیست — دوئل فقط بینِ هم‌شهری‌ها ثبت می‌شود.`, buttons: [] }
  }

  // فمبویِ روح‌بسته — سازنده‌ی کاراکتر پی‌وی است (§4.3)
  const challengerSide = await sideInfo(player.id)
  if (!challengerSide) {
    // کارتِ onboarding-گونه با دکمه‌ی url پی‌وی — گروه فقط راهنمای درست را نشان می‌دهد
    // V24: نشانِ 🎀 در مرکزِ جداکننده
    return {
      text: [
        "🎀 <b>فمبوی نداری</b>",
        emblem("🎀"),
        "",
        "دوئلِ شهر بینِ فمبوی‌هاست. بدونِ فمبوی فقط تماشاگری — و تماشاچی‌ها شانسِ قهرمانی ندارند.",
        "ساختنِ فمبوی در پی‌ویِ ربات است؛ گروه فقط صدایش را می‌شنود.",
        "",
        `<i>پیمانِ فمبوی ${chip(2)} دقیقه طول می‌کشد. شهر صبر می‌کند.</i>`,
      ].join("\n"),
      buttons: [
        { label: "🎀 ساختنِ فمبوی", style: "success", url: FEMBOY_START_URL },
        { label: "↩ خانه", style: "primary", cb: "gm:game" },
      ],
    }
  }
  const targetSide = await sideInfo(target.id)
  if (!targetSide) {
    return {
      text: `⚔️ «${esc(target.name)}» هنوز فمبوی ندارد. بدونِ دو فمبوی، شهر دوئل ثبت نمی‌کند.`,
      buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }],
    }
  }

  // گاردهای روحیه/استقامت — پیش‌فیلترِ همان چک‌های duelCharacters (حکمِ نهایی آنجاست)
  if (!spiritCondition(challengerSide.char.spirit).canFight) {
    return { text: "روحیه‌ی فمبویت تهی است — اول آرامشش کن.", buttons: [] }
  }
  if (!spiritCondition(targetSide.char.spirit).canFight) {
    return { text: `روحیه‌ی فمبویِ «${esc(target.name)}» تهی است.`, buttons: [] }
  }
  if (effectiveStamina(challengerSide.char) < SOUL.DUEL_COST) {
    return { text: `استقامتت کم است (${chip(SOUL.DUEL_COST)} لازم).`, buttons: [] }
  }
  if (effectiveStamina(targetSide.char) < SOUL.DUEL_COST) {
    return { text: `استقامتِ فمبویِ «${esc(target.name)}» کافی نیست.`, buttons: [] }
  }

  // کول‌داونِ جفت
  const since = Date.now() - pairCooldownAt(group, player.id, target.id)
  if (since < PAIR_COOLDOWN_MIN * 60000) {
    const leftMin = Math.max(1, Math.ceil((PAIR_COOLDOWN_MIN * 60000 - since) / 60000))
    return {
      text: `شهر هنوز از دوئلِ قبلیِ شما دو نفَر جان نیاورده — ${chip(leftMin)} دقیقه دیگر دوباره بیایید.`,
      buttons: [],
    }
  }

  // سقف‌های pending
  const [groupPending, byChallenger, byTarget] = await Promise.all([
    ctx.db.groupChallenge.count({ where: { groupId: group.id, status: "pending" } }),
    ctx.db.groupChallenge.count({ where: { challengerId: player.id, status: "pending" } }),
    ctx.db.groupChallenge.count({ where: { targetId: target.id, status: "pending" } }),
  ])
  if (groupPending >= GROUP_PENDING_CAP) {
    return {
      text: `شهر همین حالا ${chip(groupPending)} دعوتِ بی‌جواب دارد. اول همان‌ها جمع شوند.`,
      buttons: [{ label: "↩ خانه", style: "primary", cb: "gm:game" }],
    }
  }
  if (byChallenger >= PER_PLAYER_PENDING_CAP) {
    return { text: "دعوتِ دیگری از تو بی‌جواب مانده — اول جوابش را بگیر.", buttons: [] }
  }
  if (byTarget >= PER_PLAYER_PENDING_CAP) {
    return { text: `برای «${esc(target.name)}» دعوتِ دیگری بی‌جواب مانده — هنوز جوابش را نداده.`, buttons: [] }
  }

  // ساخت — ردیف + دعوت‌نامه‌ی پرباولویت + مهرِ کول‌داونِ جفت
  const challenge = await db.groupChallenge.create({
    data: {
      groupId: group.id,
      challengerId: player.id,
      targetId: target.id,
      expiresAt: new Date(Date.now() + EXPIRY_MIN * 60000),
    },
  })
  const a = sideInfoOf(challengerSide.player, challengerSide.char)
  const b = sideInfoOf(targetSide.player, targetSide.char)
  await pushOutbox(group, {
    kind: "challenge",
    text: invitationCardText(a, b, EXPIRY_MIN),
    buttons: [
      { label: "⚔️ قبول می‌کنم", style: "success", cb: `gc:${challenge.id}:accept` },
      { label: "✖️ رد می‌کنم", style: "danger", cb: `gc:${challenge.id}:decline` },
      { label: "🚪 پس می‌گیرم", style: "primary", cb: `gc:${challenge.id}:cancel` },
    ],
    refType: "challenge",
    refId: challenge.id,
    priority: 8,
  })
  await bumpCulture(db, group.id, { [pairCooldownKey(player.id, target.id)]: new Date().toISOString() })

  return {
    text: challengeSentCardText(b, EXPIRY_MIN),
    buttons: [
      { label: "↩ خانه", style: "primary", cb: "gm:game" },
      { label: "🎲 بازی گروهی", style: "primary", cb: "gm:play" },
    ],
  }
}

// ─── کنش‌های gc: (قبول/رد/لغو) ─────────────────────────────────────────────────

/** gc:{challengeId}:{accept|decline|cancel} — همه‌ی مسیرها با فلیپِ شرطی */
export async function actChallenge(ctx: GroupCallCtx, challengeId: string, verb: string): Promise<ChallengeActResult> {
  const group = ctx.group
  const player = ctx.player
  if (!player) return { ok: false, ackText: NOT_CITIZEN_MSG }

  const challenge = await ctx.db.groupChallenge.findFirst({ where: { id: challengeId, groupId: group.id } })
  if (!challenge) return { ok: false, ackText: "این دعوت در دفترِ این شهر ثبت نشده." }
  const now = new Date()

  const [challengerSide, targetSide] = await Promise.all([sideInfo(challenge.challengerId), sideInfo(challenge.targetId)])

  if (verb === "accept") {
    if (player.id !== challenge.targetId) return { ok: false, ackText: "این دعوت برای تو نیست." }
    if (!(await requireGroupMember(ctx.db, group.id, player.id))) return { ok: false, ackText: NOT_CITIZEN_MSG }

    // برنده‌شدنِ سکه‌ی شانس — تنها یک قبولی از دنیا عبور می‌کند
    const flip = await ctx.db.groupChallenge.updateMany({
      where: { id: challenge.id, status: "pending", expiresAt: { gt: now } },
      data: { status: "accepted", respondedAt: now },
    })
    if (flip.count === 0) return { ok: false, ackText: STALE_ACK }

    // عضویتِ مهاجم دوباره — ممکن است شهر را ترک کرده باشد
    if (!(await requireGroupMember(ctx.db, group.id, challenge.challengerId))) {
      await closeAfterGuards(challenge, "challenger_left", "مهاجم دیگر شهروندِ این شهر نیست.")
      return { ok: false, ackText: "مهاجم دیگر شهروندِ این شهر نیست — دعوت بسته شد." }
    }
    if (!challengerSide || !targetSide) {
      await closeAfterGuards(challenge, "missing_character", "فمبویِ یکی از دو طرف پیدا نشد.")
      return { ok: false, ackText: STALE_ACK }
    }

    // حلِ اقتدارگرا — duelCharacters گاردها را داخلِ تراکنشِ خودش دوباره می‌سنجد
    let duel: Awaited<ReturnType<typeof duelCharacters>>
    try {
      duel = await duelCharacters(challengerSide.player, targetSide.player, group.id)
    } catch (e) {
      await closeAfterGuards(challenge, "engine_error", e instanceof Error ? e.message : String(e))
      return { ok: false, ackText: "دوئل وسطِ راه گیر کرد — شهر دعوت را بست. دوباره دعوت بگیرید." }
    }
    if (!duel.duel || duel.error) {
      await closeAfterGuards(challenge, "guards", duel.error ?? "شرط کافی نبود.")
      const a = sideInfoOf(challengerSide.player, challengerSide.char)
      const b = sideInfoOf(targetSide.player, targetSide.char)
      const dead = challengeDeadCardText(a, b, "guards", duel.error)
      await pushChallengeEdit(group, challenge, dead, [])
      return { ok: false, ackText: toPlain(duel.error ?? "انرژی/شرط کافی نبود."), editCard: { text: dead, buttons: [] } }
    }

    // جایزه‌ی واقعی از دفترِ پول (مرجع) — resultJson فقط از دیدِ آغازگر است
    const winnerPlayer = duel.duel.winnerIsInitiator ? challengerSide.player : targetSide.player
    const prizeRow = await db.currencyLedger.findFirst({
      where: { playerId: winnerPlayer.id, source: "reward", note: "برنده‌ی دوئل" },
      orderBy: { createdAt: "desc" },
    })
    const prize = Math.max(0, prizeRow?.amount ?? 0)

    const outcome = {
      winnerTelegramId: winnerPlayer.telegramId ?? null,
      winnerName: duel.duel.winnerName,
      loserName: duel.duel.loserName,
      winnerIsChallenger: duel.duel.winnerIsInitiator,
      rounds: duel.duel.rounds,
      prize,
    }
    const a = sideInfoOf(challengerSide.player, challengerSide.char)
    const b = sideInfoOf(targetSide.player, targetSide.char)
    const resultCard = challengeResultCardText(a, b, {
      winnerIsChallenger: duel.duel.winnerIsInitiator,
      rounds: duel.duel.rounds,
      prize,
      log: duel.duel.log,
    })

    await db.$transaction(async (tx) => {
      await tx.groupChallenge.updateMany({
        where: { id: challenge.id, status: "accepted" },
        data: { status: "resolved", resolvedAt: new Date(), outcomeJson: JSON.stringify(outcome) },
      })
      await addHistoryTx(
        tx,
        group.id,
        "⚔️",
        `دوئلِ ${esc(a.femboyName)} و ${esc(b.femboyName)} — برنده: ${esc(outcome.winnerName)}`,
        70,
      )
      await pushOutboxTx(tx, group, {
        kind: "challenge",
        text: resultCard,
        buttons: [],
        refType: "challenge",
        refId: challenge.id,
        priority: 8,
        ...(challenge.messageId ? { editMessageId: challenge.messageId } : {}),
      })
    })

    return {
      ok: true,
      ackText: "شمشیرها خلوت کردند — نتیجه روی کارت.",
      editCard: { text: resultCard, buttons: [] },
    }
  }

  if (verb === "decline") {
    if (player.id !== challenge.targetId) return { ok: false, ackText: "این دعوت برای تو نیست." }
    // §8 — عضویتِ کنشگر لازم است (همان پذیرش): شهروندِ نبودِه دعوتِ شهر را نمی‌بندد
    if (!(await requireGroupMember(ctx.db, group.id, player.id))) return { ok: false, ackText: NOT_CITIZEN_MSG }
    const flip = await ctx.db.groupChallenge.updateMany({
      where: { id: challenge.id, status: "pending", expiresAt: { gt: now } },
      data: { status: "declined", respondedAt: now },
    })
    if (flip.count === 0) return { ok: false, ackText: STALE_ACK }
    const sides = await deadSides(ctx.db, challenge)
    const dead = challengeDeadCardText(sides.a, sides.b, "declined")
    await finishDead(group, challenge, dead, `دعوتِ دوئلِ ${esc(sides.a.playerName)} به ${esc(sides.b.playerName)} رد شد`, 40)
    return { ok: true, ackText: "رد شد. شهری کهنه این را می‌بخشد… شاید.", editCard: { text: dead, buttons: [] } }
  }

  if (verb === "cancel") {
    if (player.id !== challenge.challengerId) return { ok: false, ackText: "فقط فرستنده‌ی دعوت می‌تواند پسش بگیرد." }
    // §8 — لغو هم شهروندی می‌خواهد: مهاجمِ رفته‌شده فقط انتظارِ انقضا می‌ماند
    if (!(await requireGroupMember(ctx.db, group.id, player.id))) return { ok: false, ackText: NOT_CITIZEN_MSG }
    const flip = await ctx.db.groupChallenge.updateMany({
      where: { id: challenge.id, status: "pending", expiresAt: { gt: now } },
      data: { status: "cancelled", respondedAt: now },
    })
    if (flip.count === 0) return { ok: false, ackText: STALE_ACK }
    const sides = await deadSides(ctx.db, challenge)
    const dead = challengeDeadCardText(sides.a, sides.b, "cancelled")
    await finishDead(group, challenge, dead, `دعوتِ دوئلِ ${esc(sides.a.playerName)} به ${esc(sides.b.playerName)} پس گرفته شد`, 40)
    return { ok: true, ackText: "پس گرفته شد. شهر ترجیح می‌دهد دلیل نپرسد.", editCard: { text: dead, buttons: [] } }
  }

  return { ok: false, ackText: "دکمه‌ی ناقص." }
}

/** کارتِ مرده بعد از گاردِ شکست‌خورده‌ی حل — accepted → cancelled + outcomeJson دلیل */
async function closeAfterGuards(challenge: GroupChallenge, reason: string, note: string): Promise<void> {
  await db.groupChallenge.updateMany({
    where: { id: challenge.id, status: "accepted" },
    data: { status: "cancelled", resolvedAt: new Date(), outcomeJson: JSON.stringify({ reason, note }) },
  })
}

/** push کارتِ مرده (ویرایشِ دعوت‌نامه اگر messageId شناخته؛ وگرنه کارتِ تازه) */
async function pushChallengeEdit(group: GroupWorld, challenge: GroupChallenge, text: string, buttons: OutboxButton[]): Promise<void> {
  await pushOutbox(group, {
    kind: "challenge",
    text,
    buttons,
    refType: "challenge",
    refId: challenge.id,
    priority: 6,
    ...(challenge.messageId ? { editMessageId: challenge.messageId } : {}),
  })
}

/** حالتِ مرده‌ی کامل: ویرایشِ کارت + تاریخچه (برای رد/لغو) */
async function finishDead(
  group: GroupWorld,
  challenge: GroupChallenge,
  cardText: string,
  historyText: string,
  importance: number,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await pushOutboxTx(tx, group, {
      kind: "challenge",
      text: cardText,
      buttons: [],
      refType: "challenge",
      refId: challenge.id,
      priority: 6,
      ...(challenge.messageId ? { editMessageId: challenge.messageId } : {}),
    })
    await addHistoryTx(tx, group.id, "⚔️", historyText, importance)
  })
}

/** طرف‌های کارتِ مرده — بدونِ فمبوی هم کارت بسته می‌شود (نمایشِ بازیکن) */
async function deadSides(dbx: ChDb, challenge: GroupChallenge): Promise<{ a: DuelSideInfo; b: DuelSideInfo }> {
  const [pa, pb] = await Promise.all([
    dbx.player.findUnique({ where: { id: challenge.challengerId } }),
    dbx.player.findUnique({ where: { id: challenge.targetId } }),
  ])
  const fallback = (p: Player | null): DuelSideInfo => ({
    playerName: p?.name ?? "؟",
    femboyName: p?.name ?? "؟",
    classEmoji: "✨",
    className: "فمبوی",
    level: 1,
  })
  return { a: fallback(pa), b: fallback(pb) }
}

/** ackText باید PLAIN باشد (توست parse_mode ندارد) — تگ‌ها شسته و رقم‌ها انگلیسی */
function toPlain(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
}

// ─── انقضای تیک / بازیابیِ ادمین ───────────────────────────────────────────────

/** دعوت‌های سرآمده (یا همه‌ی pendingها با force) → expired + کارتِ «دعوت‌نامه مُرد».
 *  فلیپِ شرطی: تیکِ هم‌زمان/بازیابیِ ادمین فقط یک‌بار می‌بندند. عددِ بازگشتی =
 *  شمارِ دعوت‌هایی که همین فراخوان بست (برای گزارشِ recover). */
export async function expireStaleChallenges(
  dbx: ChDb,
  groupId?: string,
  now = new Date(),
  opts: { force?: boolean } = {},
): Promise<number> {
  const staleWhere: Prisma.GroupChallengeWhereInput = {
    status: "pending",
    ...(groupId ? { groupId } : {}),
    ...(opts.force ? {} : { expiresAt: { lt: now } }),
  }
  const stale = await dbx.groupChallenge.findMany({ where: staleWhere })
  let closed = 0
  for (const c of stale) {
    const expiredAt = c.expiresAt.getTime() < now.getTime() ? c.expiresAt : now
    const flip = await dbx.groupChallenge.updateMany({
      where: {
        id: c.id,
        status: "pending",
        ...(opts.force ? {} : { expiresAt: { lt: now } }),
      },
      data: { status: "expired", expiresAt: expiredAt, resolvedAt: now },
    })
    if (flip.count === 0) continue
    closed++
    const group = await dbx.groupWorld.findUnique({ where: { id: c.groupId } })
    if (!group) continue
    const sides = await deadSides(dbx, c)
    await pushOutbox(group, {
      kind: "challenge",
      text: challengeDeadCardText(sides.a, sides.b, "expired"),
      buttons: [],
      refType: "challenge",
      refId: c.id,
      priority: 4,
      ...(c.messageId ? { editMessageId: c.messageId } : {}),
    })
    await dbx.groupHistory.create({
      data: { groupId: c.groupId, icon: "⚔️", text: `دعوت‌نامه‌ی دوئلِ ${esc(sides.a.playerName)} به ${esc(sides.b.playerName)} مُرد — جوابی نیامد`, importance: 35 },
    })
  }
  return closed
}
