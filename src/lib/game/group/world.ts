// FEMBOY WAR — V5: میم‌ها، شایعه‌ها، خبرها، معماها — حافظه‌ی زنده‌ی شهر.

import { db } from "@/lib/db"
import type { GroupWorld, Player } from "@prisma/client"
import { mulberry32, seedFrom, randInt, pickOne, chance } from "../rng"
import { MEME_TEMPLATES, RUMOR_TEMPLATES, MYSTERY_THREADS } from "./content"
import type { OutboxButton } from "./types"
import type { Tx } from "./domain"
import { esc, parseJson, pushOutbox, pushOutboxTx, addHistoryTx, addNewsTx, bumpCulture, checkAchievementsTx, grantGroupAchievementTx, cultureOf } from "./domain"
import { adjustMemberRep } from "./social"
import { requireGroupMember, NOT_CITIZEN_MSG } from "./safety"
import { awardPlayerStat } from "./awards"
import { SUB, DOTS, faNum, chip, spoiler, expand, quote, emblem } from "./text"

// ─── میم‌ها ────────────────────────────────────────────────────────────────────

/** سیگنالِ تکرارشونده — هر بار که واژه/ایموجیِ میم‌دار دیده شود صدا می‌شود */
export async function noteMemeSignal(group: GroupWorld, signal: string, playerId?: string): Promise<void> {
  const tpl = MEME_TEMPLATES.find((m) => m.signal === signal)
  if (!tpl) return
  const existing = await db.groupMemory.findFirst({ where: { groupId: group.id, kind: "signal", memeKey: tpl.key } })
  if (existing) {
    const confidence = Math.min(100, existing.confidence + 14)
    await db.groupMemory.update({
      where: { id: existing.id },
      data: { confidence, usageCount: { increment: 1 }, lastUsedAt: new Date(), originPlayerId: playerId ?? existing.originPlayerId },
    })
    if (confidence >= 80 && existing.usageCount + 1 >= 3) {
      await materializeMeme(group, tpl.key, playerId ?? existing.originPlayerId ?? undefined)
    }
    return
  }
  await db.groupMemory.create({
    data: {
      groupId: group.id,
      kind: "signal",
      memeKey: tpl.key,
      text: tpl.lines[0] ?? tpl.key,
      originPlayerId: playerId ?? null,
      confidence: 34,
      usageCount: 1,
      importance: 30,
    },
  })
}

/** میم «رسید» — از حافظه‌ی سیگنالی به هویتِ شهر تبدیل می‌شود */
async function materializeMeme(group: GroupWorld, memeKey: string, originPlayerId?: string): Promise<void> {
  const tpl = MEME_TEMPLATES.find((m) => m.key === memeKey)
  if (!tpl) return
  const already = await db.groupMemory.findFirst({ where: { groupId: group.id, kind: "meme", memeKey } })
  if (already) {
    await db.groupMemory.update({ where: { id: already.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } })
    return
  }
  const origin = originPlayerId ? await db.player.findUnique({ where: { id: originPlayerId } }) : null
  const line = tpl.lines[Math.floor(Math.random() * tpl.lines.length)]!.replace(/\{p\}/g, origin?.name ?? "یکی")
  // متنِ میم حاوی نامِ خامِ بازیکن است — در ذخیره/نمایش هر دو طرف esc می‌خورد
  // (لایه‌ی امنیت: history در نوشتن HTML-safe می‌شود؛ کارت در رندر)
  const safeLine = esc(line)
  await db.groupMemory.create({
    data: {
      groupId: group.id,
      kind: "meme",
      memeKey,
      text: line,
      originPlayerId: originPlayerId ?? null,
      confidence: 82,
      usageCount: 3,
      importance: 55,
    },
  })
  if (originPlayerId) {
    await db.groupMember.updateMany({ where: { groupId: group.id, playerId: originPlayerId }, data: { memeCount: { increment: 1 } } })
    const member = await db.groupMember.findUnique({ where: { groupId_playerId: { groupId: group.id, playerId: originPlayerId } } })
    if (member) await adjustMemberRep(db, member, "humor", 5)
    if (tpl.materialize.kind === "title") {
      // عنوانِ ذخیره‌شده = متنِ HTML-safe در نوشتن (نام esc) — رندر بدون esc
      const text = tpl.materialize.text.replace(/\{p\}/g, esc(origin?.name ?? ""))
      await db.groupMember.updateMany({ where: { groupId: group.id, playerId: originPlayerId }, data: { title: text } })
    }
  }
  await pushOutbox(group, {
    kind: "rumor",
    text: memeCardText(tpl.emoji, safeLine, origin?.name ?? "هیچ‌کس"),
    priority: 6,
  })
  await addHistoryTx(db, group.id, tpl.emoji, `میمِ «${esc(line.slice(0, 40))}…» به هویتِ شهر پیوست`, 70)
  await bumpCulture(db, group.id, { memes: 1 })
  await grantGroupAchievementTx(db, group, "first_meme")
}

/** کارتِ میمِ رسیده — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ safeLine از قبل HTML-safe است.
 *  V24 «ظاهرِ شهر»: نشانِ خودِ میم در مرکزِ جداکننده. */
export function memeCardText(emoji: string, safeLine: string, originName: string): string {
  return `${emoji} <b>میمِ رسمیِ شهر</b>\n${emblem(emoji)}\n\n${quote(`«${safeLine}»`)}\n\n<i>از این‌جا به بعد این جمله بخشی از شهر است. مقصر: ${esc(originName)}.</i>`
}

/** واکنشِ میمی — وقتی حضور می‌خواهد به میمِ موجود اشاره کند */
export async function memeCallbackLine(group: GroupWorld): Promise<string | null> {
  const memes = await db.groupMemory.findMany({
    where: { groupId: group.id, kind: "meme", confidence: { gte: 60 } },
    orderBy: { lastUsedAt: "desc" },
    take: 3,
  })
  if (memes.length === 0) return null
  const m = pickOne(memes, Math.random)
  await db.groupMemory.update({ where: { id: m.id }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } })
  return m.text
}

/** اسکنِ متن پیام برای سیگنال‌های میمی — فقط واژه‌های فهرست‌شده؛ بدون ذخیره‌ی پیام */
export function scanMemeSignals(text: string): string[] {
  const found: string[] = []
  for (const tpl of MEME_TEMPLATES) {
    if (text.includes(tpl.signal)) found.push(tpl.signal)
  }
  return found
}

// ─── شایعه‌ها ──────────────────────────────────────────────────────────────────

export async function spawnRumor(group: GroupWorld, originPlayerId?: string): Promise<void> {
  const members = await db.groupMember.findMany({ where: { groupId: group.id }, include: { player: true }, take: 20 })
  if (members.length === 0) return
  const active = members.filter((m) => Date.now() - m.lastSeenAt.getTime() < 96 * 3600000)
  const pool = active.length >= 2 ? active : members
  const rng = mulberry32(seedFrom("rumor", group.id, Date.now()))
  const target = pickOne(pool, rng)
  const tpl = pickOne(RUMOR_TEMPLATES, rng)
  const truth = chance(0.5, rng)
  const p = target.player
  const text = (truth ? tpl.truth : tpl.lie)
    .replace(/\{p\}/g, p.name)
    .replace(/\{amount\}/g, faNum(p.money))
    .replace(/\{npc\}/g, "آرش")

  const rumor = await db.groupRumor.create({
    data: {
      groupId: group.id,
      text,
      truth,
      confidence: randInt(35, 65, rng),
      originPlayerId: originPlayerId ?? null,
      expiresAt: new Date(Date.now() + 3 * 86400000),
    },
  })
  await pushOutbox(group, {
    kind: "rumor",
    text: rumorCardText(text),
    buttons: [
      { label: "🕵️ تحقیق کن", style: "primary", cb: `ru:${rumor.id}:inv` },
      { label: "🗣 پخشش کن", style: "danger", cb: `ru:${rumor.id}:spr` },
      { label: "🚫 تکذیب کن", style: "success", cb: `ru:${rumor.id}:deny` },
    ],
    priority: 5,
  })
}

/** کارتِ شایعه‌ی تازه — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ شانسِ راستی زیرِ اسپویلر.
 *  V24: نشانِ 🗣 + متنِ شایعه زیرِ نقل‌قول. */
export function rumorCardText(rumorText: string): string {
  return `🗣 <b>شایعه</b>\n${emblem("🗣")}\n\n${quote(`«${esc(rumorText)}»`)}\n\n${spoiler("🎲 احتمالِ درستی: نامعلوم. مثل همیشه.")}`
}

/** کارتِ تحقیق — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ حکم زیرِ اسپویلر.
 *  V24: نشانِ 🕵️. */
export function investigatedCardText(playerName: string, rumorText: string, truth: boolean, revealed: boolean): string {
  return revealed
    ? `🕵️ <b>${esc(playerName)} تحقیق کرد</b>\n${emblem("🕵️")}\n\n${quote(`«${esc(rumorText)}»`)}\n\nحکم: ${spoiler(`<b>${truth ? "درست است" : "دروغ است"}</b>. شواهد: شخصی.`)}`
    : `🕵️ <b>${esc(playerName)} تحقیق کرد و به هیچ‌کاری نرسید.</b>\n${emblem("🕵️")}\n\n<i>شواهد: مشروط به حالِ روح.</i>`
}

export async function rumorAction(
  group: GroupWorld,
  player: Player,
  rumorId: string,
  action: "inv" | "spr" | "deny",
): Promise<string> {
  // دروازه‌ی شهروندی (V13 موج ۱ / safety.ts) — شایعه‌ی شهر فقط با دستِ شهروندها جابه‌جا می‌شود؛
  // همان سبک/متنِ دروازه‌های joinGame/castVote
  if (!(await requireGroupMember(db, group.id, player.id))) return NOT_CITIZEN_MSG
  const rumor = await db.groupRumor.findFirst({ where: { id: rumorId, groupId: group.id, status: "active" } })
  // شایعه‌ی سرآمده ≡ پیدا‌نشده (کمربند+حمّال روی انقضای تیک — safety.expireRumors)
  if (!rumor) return "این شایعه از آبجوه. یا نفس."
  if (rumor.expiresAt && rumor.expiresAt.getTime() < Date.now()) return "این شایعه از آبجوه. یا نفس."
  switch (action) {
    case "inv": {
      // هر شهروند فقط یک‌بار XPِ تحقیق می‌گیرد — گشتنِ تکراری شواهدِ تکراری می‌دهد
      const investigated = parseJson<string[]>(rumor.investigatedJson, [])
      if (investigated.includes(player.id)) return "قبلاً این‌جا را گشتادی. شواهدِ تکراری برای شهر ارزش ندارد."
      const roll = mulberry32(seedFrom("inv", rumor.id, player.id))()
      const revealed = roll < 0.55 || rumor.confidence > 70
      await db.groupRumor.update({ where: { id: rumor.id }, data: { investigatedJson: JSON.stringify([...investigated, player.id]) } })
      // XPِ تحقیق — از این پس از تک‌مرجعِ awards.ts (V13 §2.3؛ پیش‌تر increment خام)
      await awardPlayerStat(db, player, "xp", 8)
      const text = investigatedCardText(player.name, rumor.text, rumor.truth, revealed)
      await pushOutbox(group, { kind: "rumor", text, priority: 4 })
      // تحقیقِ موفق گاهی سرنخِ معمای فعالِ شهر را هم باز می‌کند
      if (revealed && mulberry32(seedFrom("invclue", rumor.id, player.id))() < 0.2) {
        await revealMysteryClue(group, player)
      }
      return "تحقیقت ثبت شد."
    }
    case "spr": {
      const flipped = await db.groupRumor.updateMany({
        where: { id: rumor.id, status: "active" },
        data: { spreadCount: { increment: 1 }, confidence: { increment: 5 } },
      })
      if (flipped.count > 0 && rumor.spreadCount + 1 >= 3) {
        await db.groupRumor.updateMany({ where: { id: rumor.id, status: "active" }, data: { status: "dead" } })
        // news در نوشتن HTML-safe می‌شود (متنِ شایعه نامِ خام دارد)
        await addNewsTx(db, group.id, "📰", rumor.truth ? `شایعه‌ی «${esc(rumor.text.slice(0, 40))}…» درست از آب درآمد` : `شایعه‌ی «${esc(rumor.text.slice(0, 40))}…» لو رفت`)
      }
      return "پخش شد. شهر تشکر می‌کند. یا نه."
    }
    case "deny": {
      await db.groupRumor.update({ where: { id: rumor.id }, data: { confidence: { decrement: 10 } } })
      return "تکذیب ثبت شد. کسی که منکر است معمولاً درست می‌گوید. معمولاً."
    }
  }
}

// ─── خبر ──────────────────────────────────────────────────────────────────────

/** خبرنامه‌ی محلی — از تاریخچه‌ی واقعیِ همین گروه ساخته می‌شود (V11: آینه‌ی /news ربات) */
export async function pushCityNews(group: GroupWorld): Promise<void> {
  const since = new Date(Date.now() - 86400000)
  const hist = await db.groupHistory.findMany({
    where: { groupId: group.id, createdAt: { gte: since }, importance: { gte: 60 } },
    orderBy: { importance: "desc" },
    take: 5,
  })
  const news = await db.groupNews.findMany({ where: { groupId: group.id }, orderBy: { createdAt: "desc" }, take: 3 })
  const members = await db.groupMember.findMany({ where: { groupId: group.id }, include: { player: true } })
  const richest = [...members].sort((a, b) => b.player.money - a.player.money)[0]
  await pushOutbox(group, {
    kind: "news",
    text: cityNewsCardText(
      group.title,
      hist.map((h) => ({ icon: h.icon, text: h.text })),
      news.map((n) => ({ icon: n.icon, text: n.text })),
      richest ? { name: richest.player.name, money: richest.player.money } : null,
      members.length,
    ),
    priority: 5,
  })
}

/** کارتِ خبرنامه — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ ردیف‌های ذخیره‌شده HTML-safe بدون esc رندر می‌شوند.
 *  V24: نشانِ 📰. */
export function cityNewsCardText(
  title: string,
  hist: { icon: string; text: string }[],
  news: { icon: string; text: string }[],
  richest: { name: string; money: number } | null,
  population: number,
): string {
  const lines: string[] = [`📰 <b>خبرنامه‌ی ${esc(title)}</b>`, emblem("📰"), ""]

  // تاریخچه — سه خبرِ مهمِ روز، هر کدام نقل‌قول؛ بقیه با دُمِ شمارشی
  if (hist.length > 0) {
    lines.push("🗞 <b>خبرهای امروز:</b>", "")
    for (const h of hist.slice(0, 3)) lines.push(quote(`${h.icon} ${h.text}`)) // متنِ ذخیره‌شده HTML-safe است — بدون esc
    if (hist.length > 3) lines.push("", `<i>… و ${chip(hist.length - 3)} خبرِ دیگر</i>`)
  }

  // خبرهای دائمیِ شهر
  if (news.length > 0) {
    if (lines.length > 3) lines.push("", SUB, "")
    lines.push("📋 <b>دفترِ شهر:</b>")
    for (const n of news.slice(0, 3)) lines.push(quote(`${n.icon} ${n.text}`)) // HTML-safe در نوشتن
  }

  if (richest) {
    if (lines.length > 3) lines.push("")
    lines.push(`💎 <b>${esc(richest.name)}</b> الان ثروتمندترینِ شهره — ${chip(richest.money)} سکه.`)
  }

  if (lines.length === 3) lines.push("🗓 <i>امروز هنوز هیچ‌چیز مهمی رخ نداده. این هم خودش یک خبر است.</i>")
  else lines.push("", DOTS, "", `👥 ${chip(population)} نفر این‌جا زندگی می‌کنند`)

  return lines.join("\n")
}

// ─── معماها ────────────────────────────────────────────────────────────────────

export async function ensureMysteryActive(group: GroupWorld): Promise<void> {
  const active = await db.groupMystery.findFirst({ where: { groupId: group.id, status: "active" } })
  if (active) return
  const c = cultureOf(group)
  const boost = typeof c["projBoost:mystery"] === "number" ? (c["projBoost:mystery"] as number) : 1
  const rng = mulberry32(seedFrom("mys", group.id, Date.now()))
  if (!chance(0.25 * boost, rng)) return
  const existing = await db.groupMystery.findMany({ where: { groupId: group.id }, select: { threadId: true, status: true } })
  const solved = new Set(existing.filter((m) => m.status === "solved").map((m) => m.threadId))
  const candidates = MYSTERY_THREADS.filter((t) => !solved.has(t.key))
  if (candidates.length === 0) return
  const thread = pickOne(candidates, rng)
  await db.groupMystery.create({
    data: {
      groupId: group.id,
      threadId: thread.key,
      title: thread.title,
      cluesJson: JSON.stringify(thread.clues.map(() => ({ text: "", revealed: false }))),
      status: "active",
      payloadJson: JSON.stringify({ key: thread.key }),
    },
  })
  await pushOutbox(group, {
    kind: "rumor",
    text: mysterySpawnCardText(thread.emoji, thread.title, thread.hook),
    priority: 6,
  })
  await bumpCulture(db, group.id, { mystery: 1 })
  await grantGroupAchievementTx(db, group, "first_mystery")
}

/** کارتِ تولدِ معما — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ قلابِ روایی زیرِ expand.
 *  V24: نشانِ خودِ معما + تیترِ آن زیرِ نقل‌قول. */
export function mysterySpawnCardText(emoji: string, title: string, hook: string): string {
  return `${emoji} <b>معمایی در هواست…</b>\n${emblem(emoji)}\n\n${quote(`«${title}»`)}\n\n${expand(hook)}\n\n<i>سرنخ‌ها، آن‌ها که دنبالش بگردند، پیدا می‌کنند. کسانی که پیدایشان کنند، فقط برای خودشان پیدا می‌کنند.</i>`
}

/** آشکار کردنِ سرنخِ بعدی — داخلِ تراکنشِ حلِ رویداد/تحقیقِ شایعه صدا می‌شود.
 *  این تنها راهِ جلو رفتنِ معماست: سرنخ → پی‌وی → ۵/۵ → حل + دستاورد. */
export async function revealMysteryClueTx(tx: Tx, group: GroupWorld, player: Player): Promise<boolean> {
  const active = await tx.groupMystery.findFirst({ where: { groupId: group.id, status: "active" } })
  if (!active) return false
  const thread = MYSTERY_THREADS.find((t) => t.key === active.threadId)
  if (!thread) return false
  const clues = parseJson<{ revealed: boolean; byPlayerId?: string | null }[]>(active.cluesJson, [])
  const idx = clues.findIndex((c) => !c.revealed)
  if (idx === -1) return false
  clues[idx] = { revealed: true, byPlayerId: player.id }
  // متنِ سرنخ HTML-safe ساخته می‌شود (نامِ بازیکن esc — مثل render رویدادها)؛
  // clueDmText آن را بدون esc دوباره زیرِ اسپویلر می‌برد
  const text = thread.clues[idx]!.replace(/\{p1\}/g, esc(player.name)).replace(/\{p2\}/g, esc(player.name))
  const progress = clues.filter((c) => c.revealed).length
  await tx.groupMystery.update({
    where: { id: active.id },
    data: { cluesJson: JSON.stringify(clues), progress, status: progress >= thread.clues.length ? "solved" : "active" },
  })

  // سرنخِ نامتقارن — فقط برای یابنده در پی‌وی (V11: سرنخ زیرِ اسپویلر)
  if (player.telegramId) {
    await pushOutboxTx(tx, group, {
      kind: "clue",
      text: clueDmText(progress, thread.clues.length, thread.title, text),
      targetChatId: player.telegramId,
      priority: 8,
    })
  }
  await pushOutboxTx(tx, group, {
    kind: "rumor",
    text: clueFoundCardText(player.name, thread.title, progress, thread.clues.length),
    priority: 5,
  })

  if (progress >= thread.clues.length) {
    await pushOutboxTx(tx, group, {
      kind: "news",
      text: mysterySolvedCardText(thread.emoji, thread.title, thread.resolution, player.name),
      priority: 8,
    })
    await addHistoryTx(tx, group.id, thread.emoji, `معمای «${thread.title}» حل شد — توسط ${esc(player.name)}`, 95)
    await grantGroupAchievementTx(tx, group, "mystery_solved")
  }
  return true
}

/** پی‌ویِ سرنخ — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ سرنخ زیرِ اسپویلر.
 *  V24: نشانِ 🕯 (هم‌زبانِ کارتِ سرنخِ events). */
export function clueDmText(progress: number, total: number, title: string, clueText: string): string {
  return `🕯 <b>سرنخِ ${chip(`${faNum(progress)}/${faNum(total)}`)} از «${title}»</b>\n${emblem("🕯")}\n\n${spoiler(clueText)}\n\n<i>بقیه فقط می‌دونن یه چیزی پیدا کردی. چیستی‌ش را نه.</i>`
}

/** کارتِ سرنخِ پیدا‌شده در گروه — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ V24: نشانِ 🕵️. */
export function clueFoundCardText(playerName: string, title: string, progress: number, total: number): string {
  return `🕵️ <b>${esc(playerName)}</b> سرنخی درباره‌ی «${title}» پیدا کرد — ${chip(`${faNum(progress)}/${faNum(total)}`)}.\n${emblem("🕵️")}\n${spoiler("چی بوده؟ خودش می‌داند. شما فقط حسش می‌کنید.")}`
}

/** کارتِ حلِ معما — سازنده‌ی خالص (تست‌پذیر؛ V11)؛ عاقبت زیرِ expand.
 *  V24: نشانِ خودِ معما. */
export function mysterySolvedCardText(emoji: string, title: string, resolution: string, solverName: string): string {
  return `${emoji} <b>معمای «${title}» حل شد</b>\n${emblem(emoji)}\n\n${expand(resolution)}\n\n<i>حل‌کننده‌ی نهایی: ${esc(solverName)}.</i>`
}

/** پوششِ بدونِ تراکنش — برای تحقیقِ شایعه */
export async function revealMysteryClue(group: GroupWorld, player: Player): Promise<boolean> {
  return revealMysteryClueTx(db, group, player)
}

/** زوالِ حافظه — میم‌های بی‌استفاده محو می‌شوند؛ اتفاقاتِ مهم می‌مانند */
export async function decayMemories(group: GroupWorld): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 3600000)
  const signals = await db.groupMemory.findMany({ where: { groupId: group.id, kind: "signal" } })
  for (const s of signals) {
    if (s.lastUsedAt < cutoff) {
      const confidence = s.confidence - 8
      if (confidence <= 10) {
        await db.groupMemory.delete({ where: { id: s.id } })
      } else {
        await db.groupMemory.update({ where: { id: s.id }, data: { confidence } })
      }
    }
  }
  // پاک‌سازیِ شایعه‌های مُرده‌ی قدیمی
  await db.groupRumor.deleteMany({ where: { groupId: group.id, status: "dead", createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } })
}
