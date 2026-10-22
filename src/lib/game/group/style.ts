// FEMBOY WAR — نمایشِ استایل: اولین رویدادِ جهانیِ گروهی که «بیلدِ واقعیِ فمبوی» را می‌خواند.
// داورهای NPC آمارِ مشتق‌شده‌ی هر فمبویِ روح‌بسته (deriveStats) را با هویتِ کلاس،
// مرحله‌ی فرگشت، سطحِ تسلط و کیهاناتِ پوشیده‌ی او قضاوت می‌کنند — با کمی تاسِ شهر.
//
// چرخه‌ی حیات (آینه‌ی رویدادهای موجود):
//   tick.ts (هر 3 شب، آخرِ روزِ سوم) → spawnStyleShow → کارتِ اعلام از outbox
//   → ۱۵ دقیقه پنجره‌ی صحنه (GroupEvent باز، بدون گزینه — همه‌ی فمبوی‌هایِ فعال
//   خودکار روی صحنه‌اند) → expireOpenEvents → resolveGroupEvent → resolveStyleShowEvent
//   → تراکنشِ یکپارچه: امتیازها، جوایز، تاریخ، فرهنگ، دستاورد + کارتِ نتیجه از outbox.
//
// لایه‌ی متن (V11 «شیشه»): کارت‌ها HTML — نام‌های پویا esc()، اعداد chip()،
// ریزسنجش زیرِ spoiler()، سکوی برتر بولد. رقم‌ها همیشه انگلیسی.

import { db } from "@/lib/db"
import type { GroupWorld, GroupEvent, Player } from "@prisma/client"
import { mulberry32, seedFrom, randInt } from "../rng"
import { applyMoney } from "../economy"
import { getClass, masteryLevelOf, type XpTrack } from "../content/classes"
import { parseEquipped } from "../content/appearance"
import { deriveStats, awardXpTx, addCharLog, type DerivedStats } from "../character"
import { STYLE_SHOW, type StyleComponent } from "./content"
import type { Tx } from "./domain"
import { esc, pushOutbox, pushOutboxTx, addHistoryTx, activeMembers, bumpCulture, checkAchievementsTx } from "./domain"
import { adjustMemberRep } from "./social"
import { awardPlayerStat, awardSoulProgress } from "./awards"
import { SUB, chip, spoiler, faNum, emblem, quote } from "./text"

/** templateId رویدادِ ذخیره‌شده — رشته‌ی قراردادی بین spawn/resolve */
export const STYLE_SHOW_ID: string = STYLE_SHOW.id

// ─── ورودیِ امتیازدهی ──────────────────────────────────────────────────────────

/** یک فمبوی روی صحنه — هرچه موتورِ شخصیت درباره‌اش می‌داند */
export interface StyleShowEntry {
  charId: string
  playerId: string
  playerName: string
  femboyName: string
  classKey: string
  classEmoji: string
  className: string
  level: number
  evolution: number // 0..3
  masteryLevel: number // 1..10
  spirit: number // 0..100 — حسِ صحنه، شکست‌دهنده‌ی تساوی
  equippedCount: number // 0..3 — کیهاناتِ پوشیده
  stats: DerivedStats
}

/** نتیجه‌ی قضاوتِ داورها برای یک فمبوی */
export interface StyleShowScored extends StyleShowEntry {
  score: number
  move: number // گریز + تمپو
  presence: number // دقت + شانسِ لحظه
  shine: number // شانس + جذابیت + ضریبِ حسی
  evolutionPts: number
  masteryPts: number
  wardrobePts: number
  flairPts: number
  dice: number // تاسِ شهر
}

/** ضریبِ محورِ محبوبِ کلاس — هویتِ کلاس در عددی‌شدن نقش دارد */
const FAVOR_MULT = 1.35
/** سهمِ ثابتِ هویتِ کلاس — برای همه‌ی کلاس‌ها یکسان؛ عدالتِ داورها */
const FLAIR_PTS = 8

/** قضاوتِ یک فمبوی — خالص و تکرارپذیر (rng بذر گرفته از رویداد + بازیکن) */
export function styleShowScore(entry: StyleShowEntry, rng: () => number): StyleShowScored {
  const flavor = STYLE_SHOW.flavors[entry.classKey] ?? STYLE_SHOW.defaultFlavor
  // آمارِ رزمی به زبانِ صحنه ترجمه می‌شوند — همان deriveStats، خوانشِ استایل
  const move = entry.stats.dodge * 1.5 + entry.stats.speed * 2.2
  const presence = (entry.stats.acc - 40) * 0.9 + entry.stats.crit * 1.1
  const shine = entry.stats.luck * 2 + entry.stats.loot * 1.8 + (entry.stats.critDmg - 100) * 0.12
  const evolutionPts = entry.evolution * 8
  const masteryPts = (entry.masteryLevel - 1) * 4
  const wardrobePts = entry.equippedCount * 5
  const dice = randInt(-8, 12, rng)
  const favor = (c: StyleComponent, v: number) => (flavor.favor === c ? v * FAVOR_MULT : v)
  const score = Math.max(
    1,
    Math.round(favor("move", move) + favor("presence", presence) + favor("shine", shine) + evolutionPts + masteryPts + wardrobePts + FLAIR_PTS + dice),
  )
  return {
    ...entry,
    score,
    move: Math.round(move),
    presence: Math.round(presence),
    shine: Math.round(shine),
    evolutionPts,
    masteryPts,
    wardrobePts,
    flairPts: FLAIR_PTS,
    dice,
  }
}

// ─── سازنده‌های خالصِ کارت (تست‌پذیر؛ V11) ────────────────────────────────────

/** کارتِ اعلام — صحنه روشن می‌شود؛ معیارها زیرِ اسپویلر، خطِ تماشاچی آخری.
 *  V24 «ظاهرِ شهر»: نشانِ 💅 در مرکزِ جداکننده + خطِ مهلتِ قضاوت زیرِ بلوکِ نقل‌قولی. */
export function styleShowOpenCardText(groupTitle: string, windowMinutes: number = STYLE_SHOW.windowMinutes): string {
  return [
    `${STYLE_SHOW.emoji} <b>نمایشِ استایلِ ${esc(groupTitle)}</b>`,
    emblem(STYLE_SHOW.emoji),
    "",
    STYLE_SHOW.openBody,
    "",
    `داورها سرِ جای‌شانند: ${STYLE_SHOW.judges}.`,
    "",
    SUB,
    "",
    quote(`⏳ قضاوت تا ${chip(windowMinutes)} دقیقه‌ی دیگر.`),
    spoiler(STYLE_SHOW.criteriaSpoiler),
    "",
    `<i>${STYLE_SHOW.spectatorTease}</i>`,
  ].join("\n")
}

/** سطرِ ریزسنجشِ یک فمبوی — داخلِ اسپویلرِ کارتِ نتیجه می‌نشیند */
export function styleShowBreakdownLine(e: StyleShowScored): string {
  const parts = [
    `${STYLE_SHOW.componentLabels.move} ${chip(e.move)}`,
    `${STYLE_SHOW.componentLabels.presence} ${chip(e.presence)}`,
    `${STYLE_SHOW.componentLabels.shine} ${chip(e.shine)}`,
    `فرگشت ${chip(e.evolutionPts)}`,
    `تسلط ${chip(e.masteryPts)}`,
    `کمد ${chip(e.wardrobePts)}`,
    // دلتای تاس — قاعده‌ی «عدد+» / «عدد−»
    `تاسِ شهر ${chip(`${Math.abs(e.dice)}${e.dice >= 0 ? "+" : "−"}`)}`,
  ]
  return `▪ ${e.classEmoji} <b>${esc(e.playerName)}</b> «<i>${esc(e.femboyName)}</i>» — ${chip(e.score)} · ${parts.join(" · ")}`
}

/** یک جایگاهِ سکو */
export interface StylePodiumEntry {
  playerName: string
  femboyName: string
  classEmoji: string
  className: string
  score: number
  flavorLine: string
}

export interface StyleShowResultInput {
  groupTitle: string
  podium: StylePodiumEntry[]
  solo: boolean // تک‌قهرمانِ بی‌رقیب
  breakdown: string[] // سطرهای ریزسنجشِ چیده‌شده
  hidden: number // سطرهای بریده‌شده زیرِ سقفِ متن
  awards: { first: number; second: number; third: number; firstXp: number } | null
  spectators: number // شهروندهای بی‌فمبوی
}

/** کارتِ نتیجه — سکو بولد با تراش، ریزسنجش زیرِ اسپویلر، جوایز با SUB.
 *  V24: نشانِ 💅 + بدرقه‌ی پایانی زیرِ نقل‌قول. */
export function styleShowResultCardText(input: StyleShowResultInput): string {
  const medals = ["🥇", "🥈", "🥉"]
  const lines: string[] = [
    `${STYLE_SHOW.emoji} <b>نتیجه‌ی نمایشِ استایلِ ${esc(input.groupTitle)}</b>`,
    emblem(STYLE_SHOW.emoji),
    "",
    "🏆 <b>سکوی برتر:</b>",
    "",
  ]
  input.podium.forEach((p, i) => {
    lines.push(
      `${medals[i]} ${p.classEmoji} <b>${esc(p.playerName)}</b> «<i>${esc(p.femboyName)}</i>» — ${chip(p.score)}${input.solo && i === 0 ? " — <i>بی‌رقیب. شهر حتی تعجب نکرد.</i>" : ""}`,
    )
    lines.push(`<i>${p.className} · «${p.flavorLine}»</i>`)
  })

  if (input.breakdown.length > 0) {
    const tail = input.hidden > 0 ? `\n<i>… و ${chip(input.hidden)} استایلِ دیگر — در دفترِ ثبتِ شهر موجود است.</i>` : ""
    lines.push("", SUB, "", "🎭 <b>کارتِ قضاوت</b> — دقیق، ولی خودت ببین:", "", spoiler(`${input.breakdown.join("\n")}${tail}`))
  }

  if (input.awards && input.podium.length > 0) {
    const a = [`${chip(input.awards.first)} سکه و ${chip(input.awards.firstXp)} XP به قهرمان`]
    if (input.podium.length > 1) a.push(`${chip(input.awards.second)} سکه به دوم`)
    if (input.podium.length > 2) a.push(`${chip(input.awards.third)} سکه به سوم`)
    a.push("XPِ هم‌نفَس برای همه‌ی فمبوی‌های روی صحنه")
    lines.push("", SUB, "", `🏅 ${a.join(" · ")}.`)
  }

  if (input.spectators > 0) {
    lines.push("", `🏺 ${chip(input.spectators)} شهروندِ دیگر تماشا کردند — فمبوی ندارند. هنوز.`)
  }

  lines.push("", quote(`صحنه جمع شد. ${chip(STYLE_SHOW.everyDays)} روزِ دیگر، داورها برمی‌گردند.`))
  return lines.join("\n")
}

/** کارتِ نمایشِ بی‌شرکت‌کننده — کلِ شهر تماشاچی بود.
 *  V24: نشانِ 💅 + روایتِ صحنه‌ی خالی زیرِ نقل‌قول. */
export function styleShowEmptyCardText(groupTitle: string): string {
  return [
    `${STYLE_SHOW.emoji} <b>نتیجه‌ی نمایشِ استایلِ ${esc(groupTitle)}</b>`,
    emblem(STYLE_SHOW.emoji),
    "",
    quote("هیچ‌کس روی صحنه نرفت. کلِ شهر تماشاچی بود — و گربه‌ی شهردار، خمیازه."),
    "",
    `<i>${STYLE_SHOW.spectatorTease}</i>`,
  ].join("\n")
}

// ─── تولدِ نمایش ──────────────────────────────────────────────────────────────

/** روشن‌کردنِ صحنه — فقط وقتی هیچ رویدادِ بازی در شهر نیست (قراردادِ spawnGroupEvent) */
export async function spawnStyleShow(group: GroupWorld): Promise<GroupEvent | null> {
  const open = await db.groupEvent.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return null
  const event = await db.groupEvent.create({
    data: {
      groupId: group.id,
      templateId: STYLE_SHOW.id,
      kind: "competition",
      // title در نوشتن HTML-safe می‌شود (قراردادِ لایه‌ی متن — domain.ts)؛ body متنیِ ثابت است
      title: `نمایشِ استایلِ ${esc(group.title)}`,
      body: STYLE_SHOW.openBody,
      emoji: STYLE_SHOW.emoji,
      choicesJson: "[]", // بدون گزینه — قضاوت با بیلد است، نه با رأی
      payloadJson: JSON.stringify({ styleShow: true }),
      expiresAt: new Date(Date.now() + STYLE_SHOW.windowMinutes * 60000),
    },
  })
  await pushOutbox(group, {
    kind: "event",
    text: styleShowOpenCardText(group.title),
    refType: "event",
    refId: event.id,
    priority: 7,
  })
  // نمایش هم یک اتفاقِ شهر است — دروازه‌ی رویدادِ خودجوش عقب می‌افتد
  await db.groupWorld.update({ where: { id: group.id }, data: { lastEventAt: new Date() } })
  return event
}

// ─── حلِ نمایش ────────────────────────────────────────────────────────────────

/** شمارِ کیهاناتِ پوشیده (اکسسوار/پالت/قاب) — انتخابِ آگاهانه‌ی استایل */
function countEquipped(appearanceJson: string): number {
  const eq = parseEquipped(appearanceJson)
  return (eq.accessory ? 1 : 0) + (eq.palette ? 1 : 0) + (eq.frame ? 1 : 0)
}

/** آمارِ بازیکن در سطحِ شهر — نمایِ نازک روی تک‌مرجعِ awards.ts (V13 §2.3؛
 *  کپیِ خوداعتراف‌شده‌ی پیشین حذف شد — حلقه‌ی import هم دیگر مطرح نیست) */
async function awardStyleStat(tx: Tx, player: Player, stat: "xp" | "fame", amount: number): Promise<void> {
  await awardPlayerStat(tx, player, stat, amount)
}

/** بستنِ نمایش — امتیازِ بیلدها، جوایز، تاریخ و کارتِ نتیجه؛ همه در یک تراکنشِ واقعی.
 *  فلیپِ شرطیِ status فقط یک‌بار اجازه‌ی حل می‌دهد (تیکِ ۴۵ثانیه‌ای ⊕ دوبله‌کاری). */
export async function resolveStyleShowEvent(event: GroupEvent, group: GroupWorld, now = new Date()): Promise<void> {
  if (event.status !== "open") return

  // جمع‌کردنِ صحنه: هر عضوِ فعال با فمبویِ روح‌بسته خودکار روی صحنه است
  const members = await activeMembers(group.id, 48)
  const players = members.map((m) => m.player)
  const chars = await db.soulCharacter.findMany({ where: { playerId: { in: players.map((p) => p.id) } } })
  const charBy = new Map(chars.map((c) => [c.playerId, c]))

  const scored: StyleShowScored[] = []
  const spectatorIds: string[] = []
  for (const p of players) {
    const char = charBy.get(p.id)
    const cls = char ? getClass(char.classKey) : null
    if (!char || !cls) {
      spectatorIds.push(p.id) // بی‌پیمان‌ها تماشا می‌کنند — خطای بازی نیست، انتخابِ زندگی‌شان است
      continue
    }
    scored.push(
      styleShowScore(
        {
          charId: char.id,
          playerId: p.id,
          playerName: p.name,
          femboyName: char.name,
          classKey: cls.key,
          classEmoji: cls.emoji,
          className: cls.name,
          level: char.level,
          evolution: char.evolution,
          masteryLevel: masteryLevelOf(char.masteryXp),
          spirit: char.spirit,
          equippedCount: countEquipped(char.appearanceJson),
          stats: deriveStats(char),
        },
        mulberry32(seedFrom("style", event.id, p.id)),
      ),
    )
  }

  // رتبه‌بندیِ قطعی: امتیاز → روحیه (حسِ صحنه) → سطح — تساوی بدون قرعه
  scored.sort((a, b) => b.score - a.score || b.spirit - a.spirit || b.level - a.level)
  const podium = scored.slice(0, 3)

  // جوایز — مبالغ خالص؛ اعمال فقط داخلِ تراکنش (الگوی resolveGame)
  const rng = mulberry32(seedFrom("styleres", event.id))
  const prize = [randInt(300, 500, rng), randInt(150, 250, rng), randInt(100, 180, rng)]
  const xpPodium = [randInt(15, 25, rng), randInt(8, 16, rng), randInt(6, 12, rng)]
  const xpRest = randInt(6, 12, rng)

  // ریزسنجش زیرِ اسپویلر — سقفِ متن با دُمِ شمارشی (قراردادِ کارت‌های بلند)
  const BUDGET = 2200
  const allLines = scored.map((e) => styleShowBreakdownLine(e))
  const shown: string[] = []
  let used = 0
  let hidden = 0
  for (const [i, l] of allLines.entries()) {
    if (i > 0 && used + l.length + 1 > BUDGET) {
      hidden = allLines.length - shown.length
      break
    }
    shown.push(l)
    used += l.length + 1
  }

  const resultText =
    podium.length === 0
      ? styleShowEmptyCardText(group.title)
      : styleShowResultCardText({
          groupTitle: group.title,
          podium: podium.map((p) => ({
            playerName: p.playerName,
            femboyName: p.femboyName,
            classEmoji: p.classEmoji,
            className: p.className,
            score: p.score,
            flavorLine: (STYLE_SHOW.flavors[p.classKey] ?? STYLE_SHOW.defaultFlavor).line,
          })),
          solo: scored.length === 1,
          breakdown: shown,
          hidden,
          awards: scored.length > 0 ? { first: prize[0]!, second: prize[1]!, third: prize[2]!, firstXp: xpPodium[0]! } : null,
          spectators: spectatorIds.length,
        })

  await db.$transaction(
    async (tx) => {
      // قفلِ حل: اولین فلیپِ status برنده است
      const flipped = await tx.groupEvent.updateMany({
        where: { id: event.id, status: "open" },
        data: {
          status: "resolved",
          resolvedAt: now,
          outcomeJson: JSON.stringify({
            styleShow: true,
            contestants: scored.length,
            spectators: spectatorIds.length,
            podium: podium.map((p) => ({ playerId: p.playerId, name: p.playerName, femboyName: p.femboyName, score: p.score })),
            scores: scored.map((p) => ({ playerId: p.playerId, score: p.score })),
          }),
        },
      })
      if (flipped.count === 0) return

      // جوایز — با ردیف‌های تازه‌ی همین تراکنش (الگوی دوئل: چکِ زنده در تراکنش)
      const freshPlayers = await tx.player.findMany({ where: { id: { in: scored.map((s) => s.playerId) } } })
      const playerById = new Map(freshPlayers.map((p) => [p.id, p]))
      const freshChars = await tx.soulCharacter.findMany({ where: { id: { in: scored.map((s) => s.charId) } } })
      const charById = new Map(freshChars.map((c) => [c.id, c]))

      for (const [i, entry] of scored.entries()) {
        const player = playerById.get(entry.playerId)
        const char = charById.get(entry.charId)
        if (!player || !char) continue
        const rank = i < 3 ? i : -1
        if (rank >= 0) {
          await applyMoney(tx, player, prize[rank]!, "reward", "بردِ نمایشِ استایل")
          await awardStyleStat(tx, player, "xp", xpPodium[rank]!)
          // V14 — سفرِ فمبوی از زندگیِ گروه: پودیوم +8 رویِ مسیرِ ثانویه‌ی کلاس
          // (سقفِ روزانه در awards.ts؛ داخلِ همان تراکنشِ فلیپ — دقیقاً-یک‌بار)
          if (player.telegramId) await awardSoulProgress(tx, player.telegramId, { soulXp: 8, reason: "نمایشِ استایلِ شهر" })
          if (rank === 0) {
            await awardStyleStat(tx, player, "fame", randInt(4, 7, rng))
            // XPِ فمبوی — هم‌نفَس + سوگیریِ کلاس (الگوی دوئل)
            const cls = getClass(entry.classKey)
            const tracks: Partial<Record<XpTrack, number>> = { spirit: 30 }
            if (cls) tracks[cls.xpBias.primary] = 20
            await awardXpTx(tx, char, { tracks })
            await addCharLog(tx, char.id, "victory", STYLE_SHOW.emoji, `نمایشِ استایلِ شهر را برد (${faNum(entry.score)} امتیاز).`, true)
            // عنوانِ شهر — فقط جایی که خالی است می‌نشیند؛ لقبِ دیگری را نمی‌بُرد
            await tx.groupMember.updateMany({
              where: { groupId: group.id, playerId: player.id, title: null },
              data: { title: "👑 ستاره‌ی استایلِ شهر" },
            })
            const member = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: player.id } } })
            if (member) await adjustMemberRep(tx, member, "fame", 5)
          } else {
            await awardXpTx(tx, char, { tracks: { spirit: rank === 1 ? 16 : 12 } })
          }
        } else {
          await awardStyleStat(tx, player, "xp", xpRest)
          await awardXpTx(tx, char, { tracks: { spirit: 10 } })
        }
      }

      // کارتِ نتیجه از همان outbox — ربات فقط پیام‌رسان است
      await pushOutboxTx(tx, group, { kind: "event", text: resultText, priority: 6, refType: "event", refId: event.id })

      // تاریخ (HTML-safe در نوشتن) + فرهنگ + دستاورد
      await addHistoryTx(
        tx,
        group.id,
        STYLE_SHOW.emoji,
        podium.length > 0
          ? `نمایشِ استایل — قهرمان: ${esc(podium[0]!.playerName)} با ${chip(podium[0]!.score)} امتیاز`
          : "نمایشِ استایل برگزار شد — هیچ‌کس روی صحنه نرفت",
        60,
      )
      await bumpCulture(tx, group.id, { competitions: 1, styleShows: 1, "tag:fashion": 1 })
      await checkAchievementsTx(tx, group)
    },
    { timeout: 15000 },
  )
}
