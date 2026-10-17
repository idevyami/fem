// FEMBOY WAR — V13 §2.3: awards — تک‌مرجعِ نوشتنِ آمارِ بازیکن در لایه‌ی گروه.
//
// قرارداد (موجِ ۱): هیچ ماژولِ دیگری از لایه‌ی گروه حق ندارد Player.xp/mood/fame/…
// را مستقیم بنویسد — همیشه از همین‌جا می‌گذرد. دلیل: تا امروز سه نقطه‌ی نوشتنِ
// موازی بود (events.applyPlayerStat، style.awardStyleStat کپیِ خوداعتراف‌شده،
// world.ts increment خامِ xp) که هر سه اکنون به awardPlayerStat تفویض شده‌اند.
//
// معناشناسی — دقیقاً همانِ applyPlayerStatِ رویدادها (رفتار حفظ‌شده):
//   money  → applyMoney (سرویسِ اقتصاد — بدهی/کتاب‌حساب همان‌جا می‌ماند)
//   xp     → جمعی، بدونِ سقفِ بالا، کفِ صفر: Math.max(0, player.xp + delta)
//   سایر   → clamp(current + delta, 0, 100) — fame/chaos/crime/reputation/luck/energy
// مقدار از ردیفِ playerِ داده‌شده خوانده می‌شود (نه بازخوانی) — همان الگوی
// «ردیفِ تازه‌ی همین تراکنش» که style/duel از آن استفاده می‌کنند؛ فراخواننده
// مسئولِ ردیفِ به‌روز است (resolveها ردیف‌ها را داخلِ tx تازه می‌خوانند).
//
// Wave 2: چالش‌ها/جوایزِ جدید هم از همین تابع استفاده می‌کنند — نه write مستقیم.

import type { Player, Prisma } from "@prisma/client"
import { clamp } from "../rng"
import { applyMoney } from "../economy"
import { parseFlags, serializeFlags } from "../helpers"
import { getClass } from "../content/classes"
import { awardXpTx, awardMasteryTx } from "../character"

/** دستگیره‌ی دیتابیس — تراکنش یا کلاینتِ عادی (ساختاریاً هر دو پذیرفته می‌شوند) */
export type AwardDb = Prisma.TransactionClient

/** آمارِ قابلِ اهدای لایه‌ی گروه — هم‌ارزِ GroupPlayerStat در types.ts */
export type AwardableStat = "money" | "xp" | "fame" | "chaos" | "crime" | "reputation" | "luck" | "energy"

/** منبعِ جایزه — فقط مسیرِ money را رنگ می‌کند (کتاب‌حسابِ اقتصاد) */
export interface AwardSource {
  moneyCategory?: string
  moneyNote?: string
}

/** اهدای آمار به بازیکن — تنها دروازه‌ی نوشتنِ Player-stat از سمتِ گروه.
 *  delta صفر = no-op (همانِ قبل). انکارِ منفیِ xp تا کفِ صفر؛ بقیه clamp 0..100. */
export async function awardPlayerStat(
  tx: AwardDb,
  player: Player,
  stat: AwardableStat,
  delta: number,
  source: AwardSource = {},
): Promise<void> {
  if (delta === 0) return
  if (stat === "money") {
    await applyMoney(tx, player, delta, source.moneyCategory ?? "event", source.moneyNote ?? "رویداد گروهی")
    return
  }
  const data: Record<string, number> = {}
  if (stat === "xp") data.xp = Math.max(0, player.xp + delta)
  else data[stat] = clamp((player as unknown as Record<string, number>)[stat] + delta, 0, 100)
  await tx.player.update({ where: { id: player.id }, data })
}

// ─── V14: زندگیِ گروه، سفرِ فمبوی را هم می‌راند (مأموریتِ III.5) ──────────────────
//
// شکافِ ممیزیِ ③: awardPlayerStat فقط Player را می‌نوشت — فمبوی از زندگیِ گروه
// هیچ نمی‌گرفت و حلقه‌ی «شهر → پیمان» در پرشِ پاداش می‌شکست. این هم‌خواهِ
// همان انضباط است: تراکنشی، دقیقاً-یک‌بار (فقط بعد از فلیپِ شرطیِ resolve صدا
// شود تا امنیتِ کال‌بکِ تکراری به ارث برسد)، با سقفِ ضدِ مزرعه در روز.

/** سقفِ روزانه‌ی XPِ فمبوی از منابعِ گروهی (به‌ازای هر بازیکن) */
export const SOUL_GROUP_XP_DAY_CAP = 40

/** شمارنده‌ی روزانه در Player.flags (بدونِ تغییرِ اسکیما) */
interface SoulGroupXpFlag {
  day: string // YYYY-MM-DD
  xp: number
}

export interface SoulProgressResult {
  appliedXp: number
  leveledUp: boolean
  masteryApplied: boolean
  /** مسیرِ XP که روی آن نوشتیم (xpBias.secondary کلاس) — برای خطِ کارت */
  track: string
  trackLabel: string
}

/** اهدای پیشرفتِ فمبوی از زندگیِ گروه — XP رویِ مسیرِ ثانویه‌ی کلاس (+ تسلطِ رویدادی).
 *  null = بازیکن فمبوی ندارد (خطا نیست؛ بی‌پیمان‌ها فقط تماشا می‌کنند).
 *  سقفِ SOUL_GROUP_XP_DAY_CAP در روز با grantِ جزئی رعایت می‌شود. */
export async function awardSoulProgress(
  tx: AwardDb,
  telegramId: string,
  opts: { soulXp: number; masteryEvent?: boolean; reason: string },
): Promise<SoulProgressResult | null> {
  if (!telegramId) return null
  const player = await tx.player.findUnique({ where: { telegramId } })
  if (!player) return null
  const char = await tx.soulCharacter.findUnique({ where: { playerId: player.id } })
  if (!char) return null
  const cls = getClass(char.classKey)
  if (!cls) return null

  // سقفِ روزانه — شمارنده در flags (بازنشانی رویِ چرخشِ روز، grantِ جزئی مجاز)
  const flags = parseFlags(player)
  const today = new Date().toISOString().slice(0, 10)
  const raw = (flags as Record<string, unknown>)["soulGroupXp"]
  const cur = raw && typeof raw === "object" && typeof (raw as SoulGroupXpFlag).day === "string" ? (raw as SoulGroupXpFlag) : null
  const used = cur && cur.day === today && typeof cur.xp === "number" && cur.xp > 0 ? cur.xp : 0
  const applied = Math.max(0, Math.min(Math.round(opts.soulXp), SOUL_GROUP_XP_DAY_CAP - used))
  if (applied > 0) {
    ;(flags as Record<string, unknown>)["soulGroupXp"] = { day: today, xp: used + applied } satisfies SoulGroupXpFlag
    await tx.player.update({ where: { id: player.id }, data: { flags: serializeFlags(flags) } })
  }

  const track = cls.xpBias.secondary
  let leveledUp = false
  let base = char
  if (applied > 0) {
    const r = await awardXpTx(tx, char, { tracks: { [track]: applied } })
    leveledUp = r.levelUps.length > 0
    base = r.char
  }
  // رویدادِ واجدشرطِ کلاس — سقفِ روزانه‌ی خودش (4) داخلِ awardMasteryTx محافظت می‌شود؛
  // masteryApplied فقط وقتی است که واقعاً نوشته شد (نه وقتی سقف روزانه بست)
  let masteryApplied = false
  if (opts.masteryEvent) {
    const mr = await awardMasteryTx(tx, base, "event", 2, opts.reason)
    masteryApplied = mr.char.masteryXp > base.masteryXp
  }
  return {
    appliedXp: applied,
    leveledUp,
    masteryApplied,
    track,
    trackLabel: TRACK_LABELS_FA[track] ?? track,
  }
}

/** برچسبِ فارسیِ مسیرهای XP — هم‌ارزِ XP_TRACK_META (برای خطِ کارت) */
export const TRACK_LABELS_FA: Record<string, string> = {
  battle: "نبرد",
  arcane: "اسرار",
  agility: "چابکی",
  fortune: "شانس",
  guard: "ایستادگی",
  trickery: "نیرنگ",
  spirit: "هم‌نفَس",
}
