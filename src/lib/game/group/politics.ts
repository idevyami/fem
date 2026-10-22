// FEMBOY WAR — V5: سیاستِ شهر — انتخابات، دادگاه، پروژه‌ها، صندوق، نقش‌ها.

import { db } from "@/lib/db"
import type { GroupWorld, GroupVote, Player } from "@prisma/client"
import { mulberry32, seedFrom, randInt, pickOne } from "../rng"
import { applyMoney } from "../economy"
import { GROUP_ROLE_MAP, GROUP_PROJECT_MAP, COURT_CHARGES } from "./content"
import type { OutboxButton } from "./types"
import { esc, parseJson, pushOutbox, pushOutboxTx, addHistoryTx, addNewsTx, activeMembers, bumpCulture, cultureOf, checkAchievementsTx, grantGroupAchievementTx, isGroupMember, NOT_CITIZEN_MSG, toLatinDigits, withSectionLock } from "./domain"
import { adjustMemberRep, adjustRelationship } from "./social"
import { awardSoulProgress } from "./awards"
import { faNum, chip, spoiler, quote, emblem, barRow } from "./text"

export type Tx = import("@prisma/client").Prisma.TransactionClient

// ─── انتخابات ──────────────────────────────────────────────────────────────────

export interface OpenVoteResult {
  ok: boolean
  message: string
}

/** شروعِ انتخابات برای یک نقش — کاندیدها از اعضای فعالِ خوش‌نام */
export async function openElection(group: GroupWorld, roleKey: string = "mayor"): Promise<OpenVoteResult> {
  const open = await db.groupVote.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return { ok: false, message: "یه رأی‌گیری در جریانه. شهر با یک سؤالِ باز درست کار نمی‌کنه." }

  const role = GROUP_ROLE_MAP[roleKey]
  if (!role) return { ok: false, message: "چنین منصبی در این شهر تعریف نشده." }

  const members = await activeMembers(group.id, 96)
  if (members.length < 3) return { ok: false, message: "برای انتخابات حداقل 3 شهروندِ فعال لازم است." }

  const rng = mulberry32(seedFrom("elect", group.id, Date.now()))
  const candidates = [...members]
    .sort(() => rng() - 0.5)
    .slice(0, 6)
    // برچسبِ دکمه = PLAIN (بدون تگ)؛ نامِ بازیکن فقط لاتین‌سازیِ رقم می‌خورد
    .map((m) => ({ key: `u:${m.playerId}`, label: toLatinDigits(m.player.name), style: null as string | null }))

  const vote = await db.groupVote.create({
    data: {
      groupId: group.id,
      kind: "election",
      subject: `انتخابِ ${role.name}`,
      optionsJson: JSON.stringify(candidates),
      closesAt: new Date(Date.now() + 3600000),
      payloadJson: JSON.stringify({ roleKey }),
    },
  })

  await pushOutbox(group, {
    kind: "vote",
    text: electionOpenCardText(group.title, role),
    // V20 (مأموریت §8.4/ممیتیز V20-۱۱): کارتِ انتخابات هم «↩ خانه» دارد — مثلِ
    // بقیه‌ی کارت‌های شهر؛ رأی‌دادن بن‌بست نیست و خانه همیشه یک لمس دورتر است.
    buttons: [
      ...candidates.map((c) => ({ label: c.label, style: null, cb: `gv:${vote.id}:${c.key}` })),
      { label: "↩ خانه", style: "primary", cb: "gm:game" },
    ],
    refType: "vote",
    refId: vote.id,
    priority: 8,
  })
  await bumpCulture(db, group.id, { votes: 1 })
  await db.groupWorld.update({ where: { id: group.id }, data: { state: "election" } })
  return { ok: true, message: "انتخابات اعلام شد." }
}

/** دادگاه — کلانتر یا هر ۳ شهروند می‌توانند بخواهند */
export async function openCourt(group: GroupWorld, accusedId: string, charge: string): Promise<OpenVoteResult> {
  const open = await db.groupVote.findFirst({ where: { groupId: group.id, status: "open" } })
  if (open) return { ok: false, message: "یه رأی‌گیری در جریانه." }
  const accused = await db.player.findUnique({ where: { id: accusedId } })
  if (!accused) return { ok: false, message: "متهم پیدا نشد." }
  const vote = await db.groupVote.create({
    data: {
      groupId: group.id,
      kind: "court",
      subject: `اتهام: ${charge}`,
      optionsJson: JSON.stringify([
        { key: "guilty", label: "مجرمه", style: "danger" },
        { key: "innocent", label: "بی‌گناهه", style: "success" },
        { key: "abstain", label: "بی‌خیال", style: null },
      ]),
      closesAt: new Date(Date.now() + 1800000),
      payloadJson: JSON.stringify({ accusedId, charge }),
    },
  })
  await pushOutbox(group, {
    kind: "vote",
    text: courtOpenCardText(group.title, accused.name, charge),
    buttons: [
      { label: "مجرمه", style: "danger", cb: `gv:${vote.id}:guilty` },
      { label: "بی‌گناهه", style: "success", cb: `gv:${vote.id}:innocent` },
      { label: "بی‌خیال", style: null, cb: `gv:${vote.id}:abstain` },
    ],
    refType: "vote",
    refId: vote.id,
    priority: 8,
  })
  await bumpCulture(db, group.id, { votes: 1 })
  return { ok: true, message: "دادگاه تشکیل شد." }
}

// ─── سازنده‌های خالصِ کارت (تست‌پذیر؛ V11) ─────────────────────────────────────

/** کارتِ افتتاحِ انتخابات — سازنده‌ی خالص (V24: نشانِ 🗳 + آیینِ رأی زیرِ quote) */
export function electionOpenCardText(groupTitle: string, role: { emoji: string; name: string; description: string }): string {
  return `🗳 <b>انتخاباتِ ${esc(groupTitle)}</b>\n${emblem("🗳")}\n\nمنصب: <b>${role.emoji} ${role.name}</b>\n${role.description}\n\n${quote("هر شهروند یک رأی. رأی‌ها مخفی‌اند تا شمارش — یعنی تا وقتی که بسه تقلب نکرد.")}`
}

/** کارتِ افتتاحِ دادگاه — سازنده‌ی خالص؛ اتهام زیرِ اسپویلرِ لمس‌و‌آشکا (V24: نشانِ ⚖️ + حاشیه‌ی دادگاه زیرِ quote) */
export function courtOpenCardText(groupTitle: string, accusedName: string, charge: string): string {
  return `⚖️ <b>دادگاهِ ${esc(groupTitle)}</b>\n${emblem("⚖️")}\n\nمتهم: <b>${esc(accusedName)}</b>\nاتهام: ${spoiler(esc(charge))}\n\n${quote("مدارک؟ مدارک همون‌جوری که همیشه، مشروط به رأی‌اند.")}`
}

/** دادگاهِ خودجوش — متهم از اعضای فعال (ترجیحاً سوگنده‌تر)، اتهام از حوضه‌ی COURT_CHARGES.
 *  موتورِ فرمانِ /court ربات همین را صدا می‌زند؛ کارت از طریق outbox با دکمه‌های gv: می‌رسد. */
export async function openCourtAuto(group: GroupWorld, instigator?: Player): Promise<OpenVoteResult> {
  const members = await activeMembers(group.id, 96)
  const eligible = members.filter((m) => m.playerId !== instigator?.id)
  const pool = eligible.length >= 2 ? eligible : members
  if (pool.length === 0) return { ok: false, message: "شهر خالی است. دادگاه بدون متهم برگزار نمی‌شود." }
  const rng = mulberry32(seedFrom("court", group.id, Date.now()))
  // متهم: اول کسی که سوءسابقه دارد (جرمِ شخصی یا سابقه‌ی اتفاق)، وگرنه تصادفی
  const suspects = pool.filter((m) => m.player.crime > 25 || m.eventCount > 0)
  const accused = pickOne(suspects.length > 0 ? suspects : pool, rng)
  const charge = pickOne(COURT_CHARGES, rng)
  return openCourt(group, accused.playerId, charge)
}

// ─── رأی ───────────────────────────────────────────────────────────────────────

export interface CastVoteResult {
  ok: boolean
  ackText: string
  /** V16-1 (مشکل ③ ممیزی) — کارتِ زنده‌ی پنلِ رأی: بعد از ثبت، همان پیام با شمارِ
   *  بی‌نام دوباره رندر می‌شود (editCard در router gv:)؛ خالی = ویرایشی نیست
   *  (خطا/بسته — همان رفتارِ دیروز). */
  cardText: string
  cardButtons: OutboxButton[]
}

export async function castVote(
  group: GroupWorld,
  player: Player,
  voteId: string,
  optionKey: string,
): Promise<CastVoteResult> {
  // دروازه‌ی شهروندی — رأیِ شهر فقط برای شهروندهای ثبت‌شده
  if (!(await isGroupMember(group.id, player.id)))
    return { ok: false, ackText: NOT_CITIZEN_MSG, cardText: "", cardButtons: [] }
  const vote = await db.groupVote.findFirst({ where: { id: voteId, groupId: group.id, status: "open" } })
  if (!vote) return { ok: false, ackText: "این رأی‌گیری بسته‌ست.", cardText: "", cardButtons: [] }
  if (vote.closesAt.getTime() < Date.now()) return { ok: false, ackText: "وقتش گذشته بود.", cardText: "", cardButtons: [] }
  // V21 — صداقتِ برگه: گزینه‌ی خارج از optionsJson ثبت نمی‌شود. دکمه‌های واقعی همیشه
  // از همین فهرست ساخته می‌شوند؛ کلیدِ ناشناس یعنی کارتِ کهنه/دست‌سازیِ API است.
  const optionKeys = parseJson<{ key: string }[]>(vote.optionsJson, []).map((o) => o.key)
  if (!optionKeys.includes(optionKey))
    return { ok: false, ackText: "چنین گزینه‌ای روی این رأی نیست.", cardText: "", cardButtons: [] }
  // ثبت/تغییرِ رأی داخلِ تراکنش — خواندن-نوشتنِ هم‌زمانِ JSONِ رأی‌ها گم نمی‌شود.
  // V15-3 — قفلِ بخشیِ «همان رأی»: کاوشِ تجربی نشان داد ۶ فشارِ هم‌زمانِ gv:
  // بدونِ این قفل، خطای busy (500) و رأیِ گم‌شده می‌دهد (مأموریت §3B).
  const r = await withSectionLock(`vote:${vote.id}`, async () => {
    const r = await db.$transaction(async (tx) => {
      const fresh = await tx.groupVote.findUnique({ where: { id: vote.id } })
      if (!fresh || fresh.status !== "open") return null
      const tally = parseJson<Record<string, string[]>>(fresh.tallyJson, {})
      for (const [k, ids] of Object.entries(tally)) {
        if (ids.includes(player.id)) {
          if (k === optionKey) return { ok: false, ackText: "همین رأی را داده‌ای." }
          // تغییر رأی — دموکراسیِ سست
          tally[k] = ids.filter((i) => i !== player.id)
          break
        }
      }
      tally[optionKey] = [...(tally[optionKey] ?? []), player.id]
      await tx.groupVote.update({ where: { id: fresh.id }, data: { tallyJson: JSON.stringify(tally) } })
      return { ok: true, ackText: "رأیت ثبت شد." }
    })
    return r ?? { ok: false, ackText: "این رأی‌گیری بسته‌ست." }
  })
  if (!r.ok) return { ...r, cardText: "", cardButtons: [] }
  // V16-1 — پنلِ اشتراکی زنده می‌ماند: شمارِ بی‌نامِ رأی‌ها رویِ همان پیام تازه
  // می‌شود و دکمه‌های gv: دوباره سِرو می‌شوند (الگویِ ge: — مأموریت §3B/§4).
  // شمارش دوباره از ردیفِ مرجع خوانده می‌شود تا رأی‌هایِ هم‌زمانِ دیگر هم دیده شوند.
  const fresh = await db.groupVote.findUnique({ where: { id: vote.id } })
  if (!fresh || fresh.status !== "open") return { ...r, cardText: "", cardButtons: [] }
  const live = await votePanelCard(group, fresh)
  return { ...r, cardText: live.text, cardButtons: live.buttons }
}

/** کارتِ زنده‌ی پنلِ رأی (V16-1) — همان کارتِ افتتاح + سطرِ مشارکتِ بی‌نام «N رأی تا الان».
 *  قواعدِ رازداریِ موجود محفوظ می‌مانند: انتخابات و دادگاه شمارشِ گزینه‌به‌گزینه را
 *  تا شمارشِ نهایی مخفی نگه می‌دارند («رأی‌ها مخفی‌اند تا شمارش») — پس فقط سطرِ
 *  مشارکت بازچینی می‌شود؛ رأیِ عمومیِ آینده شمارشِ عمومیِ گزینه‌ها را مثلِ کارتِ
 *  فرمانِ vote می‌گیرد (قاعده‌ی موجودِ آن مسیر). دکمه‌ها = همان gv: های افتتاح. */
export async function votePanelCard(
  group: GroupWorld,
  vote: GroupVote,
): Promise<{ text: string; buttons: OutboxButton[] }> {
  const options = parseJson<{ key: string; label: string; style: string | null }[]>(vote.optionsJson, [])
  const tally = parseJson<Record<string, string[]>>(vote.tallyJson, {})
  const total = Object.values(tally).reduce((s, ids) => s + ids.length, 0)
  const buttons: OutboxButton[] = options.map((o) => ({
    label: o.label,
    style: (o.style as "primary" | "success" | "danger" | null) ?? null,
    cb: `gv:${vote.id}:${o.key}`,
  }))
  const participation = `\n\n🗳 ${chip(total)} رأی تا الان.`
  if (vote.kind === "election") {
    const payload = parseJson<{ roleKey: string }>(vote.payloadJson, { roleKey: "mayor" })
    const role = GROUP_ROLE_MAP[payload.roleKey] ?? GROUP_ROLE_MAP.mayor!
    return { text: electionOpenCardText(group.title, role) + participation, buttons }
  }
  if (vote.kind === "court") {
    const payload = parseJson<{ accusedId: string; charge: string }>(vote.payloadJson, { accusedId: "", charge: "" })
    const accused = payload.accusedId ? await db.player.findUnique({ where: { id: payload.accusedId } }) : null
    return { text: courtOpenCardText(group.title, accused?.name ?? "؟", payload.charge) + participation, buttons }
  }
  // رأیِ عمومی — شمارشِ گزینه‌ها عمومی است (همان قاعده‌ی کارتِ فرمانِ /vote)
  // V24: نشانِ 🗳 + ردیف‌های ▪؛ سطرِ مشارکتِ بی‌نام همان لنگرِ متنِ قبلی است
  const lines = options.map((o) => `▪ ${esc(o.label)} — ${chip((tally[o.key] ?? []).length)} رأی`)
  const text = [
    `🗳 <b>${esc(vote.subject)}</b>`,
    emblem("🗳"),
    "",
    ...lines,
    `🗳 ${chip(total)} رأی تا الان.`,
    "",
    `<i>مهلت: تا ${vote.closesAt.toLocaleTimeString("fa-IR-u-nu-latn")}</i>`,
  ].join("\n")
  return { text, buttons }
}

// ─── بستنِ رأی‌ها ──────────────────────────────────────────────────────────────

/** رأی‌هایِ سرآمده را می‌بندد. V13 موج  ۲: opts.force — بازیابیِ ادمین همه‌ی
 *  رأی‌هایِ باز را بی‌چکِ مهلت به همین مسیرِ حل می‌فرستد (فلیپِ شرطیِ resolveVote
 *  پاسدارِ دوباره‌شماری است). */
export async function closeVotes(group: GroupWorld, now = new Date(), opts: { force?: boolean } = {}): Promise<void> {
  const open = await db.groupVote.findMany({
    where: { groupId: group.id, status: "open", ...(opts.force ? {} : { closesAt: { lt: now } }) },
  })
  for (const vote of open) await resolveVote(vote, now)
}

async function resolveVote(vote: GroupVote, now: Date): Promise<void> {
  const group = await db.groupWorld.findUnique({ where: { id: vote.groupId } })
  if (!group) return

  // V15-3 — همان قفلِ castVote: شمارشِ نهایی و رأیِ تازه هرگز هم‌زمان نمی‌افتند
  await withSectionLock(`vote:${vote.id}`, () =>
    db.$transaction(
      async (tx) => {
      // قفلِ بستن: فلیپِ شرطی اول — دو تیکِ هم‌زمان فقط یک‌بار شمارش می‌کنند
      const flipped = await tx.groupVote.updateMany({ where: { id: vote.id, status: "open" }, data: { status: "closed", resolvedAt: now } })
      if (flipped.count === 0) return

      const fresh = await tx.groupVote.findUniqueOrThrow({ where: { id: vote.id } })
      const tally = parseJson<Record<string, string[]>>(fresh.tallyJson, {})
      const options = parseJson<{ key: string; label: string; style: string | null }[]>(fresh.optionsJson, [])
      const counts = Object.entries(tally).map(([k, ids]) => ({ key: k, n: ids.length }))
      const best = counts.sort((a, b) => b.n - a.n)[0]
      const label = options.find((o) => o.key === best?.key)?.label ?? "؟"
      const totalVotes = counts.reduce((s, c) => s + c.n, 0)

      if (fresh.kind === "election" && best && best.n > 0) {
        const payload = parseJson<{ roleKey: string }>(fresh.payloadJson, { roleKey: "mayor" })
        const winnerId = best.key.startsWith("u:") ? best.key.slice(2) : null
        if (winnerId) {
          // خلعِ دارنده‌ی قبلی
          await tx.groupMember.updateMany({ where: { groupId: group.id, role: payload.roleKey }, data: { role: null, roleSince: null } })
          await tx.groupMember.update({
            where: { groupId_playerId: { groupId: group.id, playerId: winnerId } },
            data: { role: payload.roleKey, roleSince: now },
          })
          const winner = await tx.player.findUnique({ where: { id: winnerId } })
          const role = GROUP_ROLE_MAP[payload.roleKey]!
          await pushOutboxTx(tx, group, {
            kind: "vote",
            text: electionResultCardText(role, winner?.name ?? "؟", best.n),
            priority: 8,
          })
          // history/news در نوشتن HTML-safe می‌شوند (نامِ پویا esc)
          await addHistoryTx(tx, group.id, role.emoji, `${esc(winner?.name ?? "؟")} با ${faNum(best.n)} رأی ${role.name} شد`, 85)
          await addNewsTx(tx, group.id, role.emoji, `${esc(winner?.name ?? "؟")} رسماً ${role.name} شد`)
          await grantGroupAchievementTx(tx, group, "first_election")
          const member = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: winnerId } } })
          if (member) await adjustMemberRep(tx, member, "respect", role.key === "mayor" ? 12 : 8)
          await tx.groupWorld.update({ where: { id: group.id }, data: { state: group.state === "election" ? "normal" : group.state } })
          return
        }
      }

      if (fresh.kind === "court" && best) {
        const payload = parseJson<{ accusedId: string; charge: string }>(fresh.payloadJson, { accusedId: "", charge: "" })
        const accused = payload.accusedId ? await tx.player.findUnique({ where: { id: payload.accusedId } }) : null
        const fine = best.key === "guilty" ? randInt(400, 2400, mulberry32(seedFrom("fine", fresh.id))) : 0
        if (accused && fine > 0) {
          await applyMoney(tx, accused, -fine, "misc", `جریمه‌ی دادگاه: ${payload.charge}`)
          await tx.groupWorld.update({ where: { id: group.id }, data: { treasury: { increment: fine } } })
          const member = await tx.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: accused.id } } })
          if (member) {
            await adjustMemberRep(tx, member, "danger", 8)
            await adjustMemberRep(tx, member, "trust", -6)
            if (!member.title || Math.random() < 0.5) {
              await tx.groupMember.update({ where: { id: member.id }, data: { title: "⚖️ محکومِ مشروط" } })
            }
          }
        }
        const verdictText =
          best.key === "guilty"
            ? `مجرم شناخته شد. جریمه: ${chip(fine)} سکه به صندوقِ شهر.`
            : best.key === "innocent"
              ? "بی‌گناه شناخته شد. شهر — به قولی — اشتباه می‌کرد. این‌بار."
              : "شهر بی‌خیال شد. عدالت صرفه‌جویی می‌کند."
        await pushOutboxTx(tx, group, {
          kind: "vote",
          text: courtVerdictCardText(accused?.name ?? "؟", payload.charge, verdictText, totalVotes),
          priority: 8,
        })
        // history در نوشتن HTML-safe (verdictText سازگارِ HTML است؛ charge استاتیک است)
        await addHistoryTx(tx, group.id, "⚖️", `دادگاه «${payload.charge}» — ${verdictText}`, 80)
        await grantGroupAchievementTx(tx, group, "first_court")
        return
      }

      // رأی‌گیریِ عمومی
      await pushOutboxTx(tx, group, {
        kind: "vote",
        text: genericVoteResultCardText(fresh.subject, label, best?.n ?? 0),
        priority: 6,
      })
      // history در نوشتن HTML-safe (label ممکن است نامِ بازیکن باشد)
      await addHistoryTx(tx, group.id, "🗳", `${esc(fresh.subject)} — نتیجه: «${esc(label)}»`, 60)
      },
      { timeout: 15000 },
    ),
  )
}

// ─── حقوق‌ها و صندوق ───────────────────────────────────────────────────────────

/** حقوقِ هفتگیِ نقش‌ها از صندوق — یک‌بار در هر هفته، داخلِ تراکنش */
export async function paySalaries(group: GroupWorld, week: number): Promise<void> {
  const c = cultureOf(group)
  if (c.lastSalaryWeek === week) return
  await db.$transaction(async (tx) => {
    // هفته و صندوق داخلِ تراکنش دوباره چک می‌شوند — دو تیکِ هم‌زمان فقط یک‌بار حقوق می‌دهند
    const fresh = await tx.groupWorld.findUnique({ where: { id: group.id } })
    if (!fresh || cultureOf(fresh).lastSalaryWeek === week) return
    const holders = await tx.groupMember.findMany({ where: { groupId: group.id, role: { not: null } }, include: { player: true } })
    let paid = 0
    for (const m of holders) {
      const role = m.role ? GROUP_ROLE_MAP[m.role] : null
      if (!role) continue
      // صندوقِ تازه (منهایِ پرداختیِ همین دور) دوباره چک می‌شود
      if (fresh.treasury - paid >= role.salary) {
        await applyMoney(tx, m.player, role.salary, "reward", `حقوقِ ${role.name}`)
        paid += role.salary
      }
    }
    if (paid > 0) {
      await tx.groupWorld.update({ where: { id: group.id }, data: { treasury: { decrement: paid } } })
      await addNewsTx(tx, group.id, "💰", `حقوق‌های هفتگی پرداخت شد (${faNum(paid)} سکه)`)
    }
    await bumpCulture(tx, group.id, { lastSalaryWeek: week })
  })
}

/** درآمدِ روزانه‌ی پروژه‌ها برای صندوق */
export async function collectProjectIncome(group: GroupWorld, dayKey: string): Promise<void> {
  const c = cultureOf(group)
  if (c.treasuryDay === dayKey) return
  const done = await db.groupProject.findMany({ where: { groupId: group.id, status: "done" } })
  let income = 0
  for (const p of done) {
    const tpl = GROUP_PROJECT_MAP[p.templateId]
    if (tpl) income += tpl.treasuryPerDay
  }
  if (income > 0) {
    await db.groupWorld.update({ where: { id: group.id }, data: { treasury: { increment: income } } })
  }
  await bumpCulture(db, group.id, { treasuryDay: dayKey })
}

// ─── پروژه‌ها ──────────────────────────────────────────────────────────────────

export async function startProject(group: GroupWorld, projectKey: string): Promise<OpenVoteResult> {
  const tpl = GROUP_PROJECT_MAP[projectKey]
  if (!tpl) return { ok: false, message: "چنین پروژه‌ای در دفترِ شهر ثبت نشده." }
  const existing = await db.groupProject.findFirst({ where: { groupId: group.id, templateId: projectKey, status: "building" } })
  if (existing) return { ok: false, message: "این پروژه در حال ساخت است." }
  const done = await db.groupProject.findFirst({ where: { groupId: group.id, templateId: projectKey, status: "done" } })
  if (done) return { ok: false, message: "این پروژه ساخته شده. شهر حافظه دارد." }
  const p = await db.groupProject.create({
    data: { groupId: group.id, templateId: projectKey, name: tpl.name, emoji: tpl.emoji, goal: tpl.cost },
  })
  await pushOutbox(group, {
    kind: "system",
    text: projectOpenCardText(tpl),
    // V16-1 — ثبتِ پنلِ اشتراکی طبقِ قراردادِ router.ts (refType/refId)؛
    // markDelivered برای «project» مُهرِ messageId نمی‌زند (ویرایشِ زنده ندارد)
    refType: "project",
    refId: p.id,
    // برچسبِ دکمه = PLAIN (بدون تگ) — رقمِ انگلیسی؛ cb دست‌نخورده
    buttons: [
      { label: `${faNum(1000)} کمک`, style: "success", cb: `gp:${p.id}:1000` },
      { label: `${faNum(5000)} کمک`, style: "success", cb: `gp:${p.id}:5000` },
      { label: `${faNum(20000)} کمک`, style: "primary", cb: `gp:${p.id}:20000` },
      // V16-1 (مشکل ⑩ ممیزی) — مبلغِ دلخواه از جیبِ واقعی: انتخابگرِ مبلغِ
      // politics (gm:contribute:{key}) مبلغ‌ها را از پولِ خودِ بازیکن می‌سازد.
      { label: "🤝 مبلغِ دلخواه", style: "primary", cb: `gm:contribute:${projectKey}` },
    ],
    priority: 7,
  })
  return { ok: true, message: "پروژه افتتاح شد." }
}

/** کارتِ افتتاحِ پروژه — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ سودِ پروژه زیرِ اسپویلر.
 *  V24: نشانِ خودِ پروژه + شرحِ پروژه زیرِ quote (روایتِ شهر). */
export function projectOpenCardText(tpl: { emoji: string; name: string; description: string; benefit: string; cost: number }): string {
  return `🏗 <b>پروژه‌ی جدید: ${tpl.emoji} ${tpl.name}</b>\n${emblem("🏗")}\n\n${quote(tpl.description)}\n\n💰 هزینه: ${chip(tpl.cost)} سکه — از کمکِ داوطلبانه‌ی شهروندها.\n🎁 باز می‌کند: ${spoiler(tpl.benefit)}`
}

export async function contribute(
  group: GroupWorld,
  player: Player,
  projectId: string,
  amount: number,
): Promise<{ ok: boolean; ackText: string; done: boolean }> {
  // دروازه‌ی شهروندی — آجرِ شهر فقط از دستِ شهروندها
  if (!(await isGroupMember(group.id, player.id)))
    return { ok: false, ackText: NOT_CITIZEN_MSG, done: false }
  if (amount <= 0 || amount > 500000) return { ok: false, ackText: "مبلغ معتبر نیست.", done: false }

  // کمک در تراکنشِ واحد: موجودی و جمعِ کمک‌ها دوباره چک می‌شوند؛ اضافه‌پرداخت به سقفِ باقی‌مانده کپ می‌شود
  // V15-3 — قفلِ بخشیِ «همان پروژه»: کمک‌هایِ هم‌زمانِ شهروندها سریال می‌شوند
  // (همان کلاسِ خطایِ رأی؛ موجودی و جمعِ کمک داخلِ نوبتِ خودشان دوباره چک می‌شوند)
  const r = await withSectionLock(`project:${projectId}`, () =>
    db.$transaction(
      async (tx): Promise<{ ok: boolean; ackText: string; done: boolean } | null> => {
      const project = await tx.groupProject.findFirst({ where: { id: projectId, groupId: group.id, status: "building" } })
      if (!project) return null
      const contributed = parseJson<Record<string, number>>(project.contributedJson, {})
      const totalSoFar = Object.values(contributed).reduce((s, v) => s + v, 0)
      const remaining = Math.max(0, project.goal - totalSoFar)
      if (remaining === 0) return null // دیگر جایی برای آجر نیست
      const pay = Math.min(amount, remaining)
      const pl = await tx.player.findUnique({ where: { id: player.id } })
      if (!pl || pl.money < pay) return { ok: false, ackText: "این‌قدر سکه نداری. شهر با حسنِ نیت ساخته نمی‌شود.", done: false }

      await applyMoney(tx, pl, -pay, "misc", `کمک به پروژه‌ی ${project.name}`)
      contributed[player.id] = (contributed[player.id] ?? 0) + pay
      const total = totalSoFar + pay

      if (total >= project.goal) {
        await tx.groupProject.update({
          where: { id: project.id },
          data: { contributedJson: JSON.stringify(contributed), status: "done", completedAt: new Date() },
        })
        const tpl = GROUP_PROJECT_MAP[project.templateId]
        // اثرِ واقعی: وزنِ رویدادها و بازی‌ها
        const patches: Record<string, number | string> = {}
        for (const b of tpl?.eventBoost ?? []) patches[`projBoost:${b.tag}`] = b.mult
        for (const g of tpl?.gameUnlocks ?? []) patches[`gameUnlock:${g}`] = 1
        await bumpCulture(tx, group.id, patches)

        // V14 — سازنده‌هایِ شهر: +8 XP به فمبوی‌شان (سقفِ روزانه در awards.ts؛
        // داخلِ همان تراکنشِ تکمیل — دقیقاً-یک‌بار). جراحیِ موجِ 15a — کارت از politics می‌ماند.
        const builderIds = Object.keys(contributed)
        if (builderIds.length > 0) {
          const builders = await tx.player.findMany({ where: { id: { in: builderIds } } })
          for (const bp of builders) {
            if (!bp.telegramId) continue
            await awardSoulProgress(tx, bp.telegramId, { soulXp: 8, reason: `ساختِ ${project.name}` })
          }
        }

        const topId = topContributorId(contributed)
        const topPlayer = topId ? await tx.player.findUnique({ where: { id: topId } }) : null

        await pushOutboxTx(tx, group, {
          kind: "system",
          text: projectDoneCardText(project.emoji, project.name, total, topPlayer?.name ?? "؟", tpl?.benefit ?? ""),
          priority: 9,
        })
        // history در نوشتن HTML-safe (نامِ پروژه استاتیک است)
        await addHistoryTx(tx, group.id, project.emoji, `پروژه‌ی ${project.name} با ${faNum(total)} سکه ساخته شد`, 90)
        await addNewsTx(tx, group.id, project.emoji, `${project.name} افتتاح شد`)
        await grantGroupAchievementTx(tx, group, "first_project")
        await checkAchievementsTx(tx, group)
        return { ok: true, ackText: `پروژه‌ی ${project.name} تکمیل شد!`, done: true }
      }

      await tx.groupProject.update({ where: { id: project.id }, data: { contributedJson: JSON.stringify(contributed) } })
      const pctDone = Math.floor((total / project.goal) * 100)
      // ackText = PLAIN (توستِ کال‌بک parse_mode ندارد) — رقمِ انگلیسی، بدونِ تگ
      return { ok: true, ackText: `کمکت ثبت شد — ${faNum(total)}/${faNum(project.goal)} (${pctDone}%)`, done: false }
      },
      { timeout: 15000 },
    ),
  )

  if (r === null) return { ok: false, ackText: "این پروژه باز نیست.", done: false }
  return r
}

function topContributorId(contributed: Record<string, number>): string | null {
  let best: string | null = null
  let bestV = 0
  for (const [id, v] of Object.entries(contributed)) if (v > bestV) { bestV = v; best = id }
  return best
}

// ─── انتخابگرِ مبلغِ کمک (V16-1 — مشکل ⑩ ممیزی) ───────────────────────────────

/** سطوحِ مبلغ از جیبِ واقعیِ بازیکن — قواعدِ contribute حاکم‌اند: مبلغ باید > 0 و
 *  ≤ 500,000 باشد و پولِ بازیکن بس باشد (پرداختِ بیش از باقی‌مانده‌ی پروژه به
 *  همان باقی‌مانده کپ می‌شود — contribute خودش این کار را می‌کند). گرد‌کردن به
 *  پایینِ ۱۰۰ تا مبالغِ خوانا بمانند؛ سقف‌ها: min(پول, 500,000). */
export function contributeTiers(money: number): number[] {
  const cap = Math.min(Math.max(0, Math.floor(money)), 500000)
  const floor100 = (n: number) => Math.floor(n / 100) * 100
  const tiers = [floor100(cap * 0.25), floor100(cap * 0.5), cap]
    .map((t) => Math.min(t, cap))
    .filter((t) => t > 0)
  return [...new Set(tiers)].slice(0, 3)
}

/** کارتِ انتخابگرِ مبلغ — سازنده‌ی خالص: پیشرفتِ واقعیِ پروژه + جیبِ واقعیِ بازیکن +
 *  دکمه‌های gp:{projectId}:{amount} (همان گرامرِ موجود) + بازگشت به پروژه‌ها.
 *  صادقانه: اگر جیب حتی کوچک‌ترین آجر را نمی‌دهد، همان را می‌گوید و دکمه‌ی مبلغ
 *  نمی‌سازد. برچسبِ دکمه = PLAIN (رقمِ انگلیسی).
 *  V24: نشانِ خودِ پروژه + نوارِ زنده‌ی درصد (barRow) برای پیشرفت. */
export function contributePickerCard(
  project: { id: string; name: string; emoji: string; goal: number },
  contributed: number,
  money: number,
): { text: string; buttons: OutboxButton[] } {
  const remaining = Math.max(0, project.goal - contributed)
  const tiers = contributeTiers(money)
  const lines = [
    `🏗 <b>کمک به ${project.emoji} ${esc(project.name)}</b>`,
    emblem("🏗"),
    "",
    barRow("🧱", "پیشرفت", contributed, project.goal, `${faNum(contributed)}/${faNum(project.goal)}`),
    `باقی‌مانده: ${chip(remaining)} سکه · 💰 جیبِ تو: ${chip(money)} سکه`,
    "",
  ]
  if (tiers.length === 0) {
    lines.push("با این جیب حتی کوچک‌ترین آجر ممکن نیست — اول پول جمع کن، بعد شهر را بساز.")
  } else {
    lines.push("چند آجر می‌گذاری؟ مبلغ‌ها از جیبِ خودت درآمده‌اند.")
    if (remaining > 0 && tiers.some((t) => t > remaining)) {
      lines.push("<i>اگر مبلغ از باقی‌مانده بیشتر شود، فقط همان‌قدر که مانده برداشته می‌شود.</i>")
    }
  }
  const buttons: OutboxButton[] = tiers.map((t) => ({
    label: `🧱 ${faNum(t)} سکه`,
    style: "success" as const,
    cb: `gp:${project.id}:${t}`,
  }))
  buttons.push({ label: "↩ پروژه‌ها", style: "primary", cb: "gm:projects" })
  return { text: lines.join("\n"), buttons }
}

/** کارتِ تکمیلِ پروژه — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ سود زیرِ اسپویلر (V24: نشانِ خودِ پروژه) */
export function projectDoneCardText(emoji: string, name: string, total: number, topPlayerName: string, benefit: string): string {
  return `🎉 <b>«${emoji} ${name}» افتتاح شد!</b>\n${emblem(emoji)}\n\nمجموع کمک‌ها: ${chip(total)} سکه.\nبزرگ‌ترین حامی: <b>${esc(topPlayerName)}</b>\n\n${benefit ? spoiler(benefit) : ""}\n\n${quote("شهر یکی بخشش را از یاد نمی‌برد.")}`
}

/** کارتِ نتیجه‌ی انتخابات — سازنده‌ی خالص (V24: نشانِ 🗳) */
export function electionResultCardText(role: { emoji: string; name: string; powers: string[] }, winnerName: string, votes: number): string {
  return `🗳 <b>نتیجه‌ی انتخابات</b>\n${emblem("🗳")}\n\n${role.emoji} <b>${esc(winnerName)}</b> با ${chip(votes)} رأی ${role.name} شد.\n\n${quote(`${role.powers[0]} — قدرتِ واقعی، همین‌قدرِ بی‌سروصدا شروع می‌شود.`)}`
}

/** کارتِ حکمِ دادگاه — سازنده‌ی خالص؛ حکم زیرِ اسپویلر (verdictText خودش HTML-safe است؛ V24: نشانِ ⚖️) */
export function courtVerdictCardText(accusedName: string, charge: string, verdictText: string, totalVotes: number): string {
  return `⚖️ <b>رأیِ دادگاه</b>\n${emblem("⚖️")}\n\nمتهم: <b>${esc(accusedName)}</b>\nاتهام: <i>${esc(charge)}</i>\nحکم: ${spoiler(verdictText)}\n\n${chip(totalVotes)} رأی ثبت شد.`
}

/** کارتِ نتیجه‌ی رأیِ عمومی — سازنده‌ی خالص (V24: نشانِ 🗳 + قانونِ تازه زیرِ quote) */
export function genericVoteResultCardText(subject: string, label: string, votes: number): string {
  return `🗳 <b>نتیجه: ${esc(subject)}</b>\n${emblem("🗳")}\n\n«${esc(label)}» با ${chip(votes)} رأی.\n${quote("از این‌جا به بعد، قانون — تا وقتی کسی یادش نره.")}`
}

/** فهرستِ پروژه‌های موجود برای منو */
export async function projectMenu(group: GroupWorld): Promise<{ key: string; name: string; emoji: string; status: string; pct: number }[]> {
  const rows = await db.groupProject.findMany({ where: { groupId: group.id }, orderBy: { createdAt: "desc" } })
  const byKey = new Map(rows.map((r) => [r.templateId, r]))
  return Object.values(GROUP_PROJECT_MAP).map((tpl) => {
    const row = byKey.get(tpl.key)
    const contributed = row ? Object.values(parseJson<Record<string, number>>(row.contributedJson, {})).reduce((s, v) => s + v, 0) : 0
    return {
      key: tpl.key,
      name: tpl.name,
      emoji: tpl.emoji,
      status: row?.status ?? "none",
      pct: row ? Math.min(100, Math.floor((contributed / row.goal) * 100)) : 0,
    }
  })
}
