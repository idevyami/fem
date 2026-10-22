// FEMBOY WAR — V15-1: هابِ ۱۲-بخشیِ ناوبریِ گروه (سمتِ موتور).
//
// مأموریتِ V15 §2/§5: منویِ گروه باید ۱۲ بخشِ سطح‌بالا با زیرمنوهایِ واقعی و
// ≥۳۰ مقصد/کنشِ فرزندِ متمایز داشته باشد — نه یک فهرستِ عمودیِ بلند، نه دکمه‌ی
// بی‌عمل. این ماژول جدولِ بخش‌ها + کارت‌های بخش + سه فرمانِ تازه‌ی داده‌محور
// (duels / economy / fame) + کارتِ «برترین‌های شهر» را می‌سازد؛ router.ts فقط
// dispatch می‌ماند و presentation.ts کارتِ خانه را با گریدِ ۱۲تایی می‌بندد.
//
// ── جدولِ فرزندانِ ۱۲ بخش (مقصدهای واقعی؛ شمارشِ مأموریت §2) ──────────────────
//   مقصدهای تکراری فقط یک‌بار شمرده می‌شوند. «خانه» (gm:game) پیمایشِ بازگشت است
//   و در شمارشِ فرزند نمی‌آید (خودش مقصدِ موجودِ دیروز است).
//
//   ۱ world    → gm:city · gm:history · gm:projects · gh:c:rules            (+4)
//   ۲ events   → gm:event · gh:c:events                                    (+2 → 6)
//   ۳ votes    → gm:vote · gm:elect · gm:court · gh:t:social-roles         (+4 → 10)
//   ۴ battle   → gm:duels · gh:t:combat-duels · gm:fame                    (+3 → 13)
//   ۵ players  → gm:members · gm:top                                      (+2 → 15)
//   ۶ femboy   → url ?start=femboy · gh:c:femboy                          (+2 → 17)
//   ۷ items    → url t.me/femwarbot (کیف — خصوصی) · gh:c:items            (+2 → 19)
//   ۸ economy  → gm:economy · gh:c:economy                                (+2 → 21)
//   ۹ fame     → gh:t:fame-group · gh:c:progression · url (اهداف — خصوصی)  (+3 → 24)
//   ۱۰ games   → gm:play · gg:{id}:j (بازیِ باز)                           (+2 → 26)
//   ۱۱ help    → gh:m · gm:help · gh:c:phrases · gh:c:faq                 (+4 → 30)
//   ۱۲ settings→ gm:gadmin (+ دکمه‌های gs: فقط برای ادمین)                 (+1 → 31)
//
//   + کارتِ تالار (fame): gm:fame:{level|wins|winrate|crits|evolution|mastery} (+6 → 37)
//   + کارتِ دوئل‌ها (duels): gc:{id}:accept · gc:{id}:decline · gc:{id}:cancel (+3 → 40)
//
//   کدکس: شناسه‌ها از src/lib/game/help/content/*.ts (rules/events/social/combat/
//   femboy/items/economy/fame/progression/phrases/faq + موضوع‌های social-roles،
//   combat-duels، fame-group) — همه موجود و زنده‌اند.
//   لینک‌های خصوصی: https://t.me/femwarbot?start=femboy (پیمانِ فمبوی)،
//   ?start=items (کیف) · ?start=market (بازار) · ?start=goals (اهداف) — لینک‌های
//   عمیقِ بافتاری (V16-1، مشکل ⑥ ممیزی): مقصد همان کارتی است که intentِ همان
//   نام در خصوصی می‌دهد؛ handleStart پیلود را می‌شناسد.
//
// صداقت (§9): هیچ شمارنده‌ی ساختگی، هیچ دکمه‌ی «به‌زودی»، هیچ کال‌بکِ الکی.
// هر دکمه یا به handlerِ موجود می‌رود یا به لینکِ خصوصیِ واقعی.

import type { GroupCallCtx, GroupCommandResult, CallbackResult } from "./router"
import type { OutboxButton } from "./types"
import { esc, parseJson } from "./domain"
import { SUB, chip, pct, remainChip, emblem, quote, barRow, faNum } from "./text"
import { buildGroupSnapshot, buildHomeViewer } from "./snapshot"
import { GROUP_ACHIEVEMENTS, SOCIAL_GAMES } from "./content"
import { memberRep } from "./social"
import { hallOfFame } from "../character"
import { getWorld } from "../world"
import { ITEM_MAP } from "../content"
import { HELP_CATEGORIES } from "../help/registry"
// V16-4 — واژه‌نامه‌ی قاعده‌مند (تمینیولوژی): موتور گروه‌محور است و می‌تواند
// مستقیم از رجیستری بخواند — برچسب‌هایِ ناوبری/عنوانِ بخش‌ها دیگر رشته‌ی خام نیستند
import { TERM } from "../terminology"

// ─── جدولِ ۱۲ بخش (برچسب‌ها از مأموریت؛ کوتاه برای گریدِ خانه) ──────────────────

export interface NavSectionDef {
  key: string
  emoji: string
  /** برچسبِ کوتاهِ دکمه‌ی گریدِ خانه */
  short: string
  /** عنوانِ کاملِ کارتِ بخش — همان ۱۲ برچسبِ مأموریت */
  title: string
  /** یک خطِ توصیف — بالای کارتِ بخش */
  line: string
}

export const NAV_SECTIONS: NavSectionDef[] = [
  { key: "world", emoji: "🏙", short: "🏙 شهر", title: "شهر و جهان", line: "وضعِ محیط، تاریخ، ساخت‌وساز و قوانینِ جهان." },
  { key: "events", emoji: "🎭", short: "🎭 رویدادها", title: "رویدادهای شهر", line: "اتفاقِ بازِ شهر و قوانینِ وقوعِشان." },
  { key: "votes", emoji: "🗳", short: "🗳 رأی‌گیری", title: "رأی‌گیری و تصمیم‌ها", line: "رأیِ باز، انتخابات، دادگاه — شهر خودش را اداره می‌کند." },
  { key: "battle", emoji: "⚔", short: "⚔ نبردها", title: "نبردها و رقابت‌ها", line: "دوئل‌هایِ رضایتیِ فمبوی‌ها و تالارِ قهرمانان." },
  { key: "players", emoji: "🧑‍🤝‍🧑", short: "🧑‍🤝‍🧑 بازیکن‌ها", title: "بازیکن‌ها", line: "شهروندها، برترین‌ها و آبروی شهر." },
  { key: "femboy", emoji: "🖤", short: "🖤 فمبوی‌ها", title: "فمبوی‌ها", line: "هویتِ فمبوی‌هایِ شهر، پیمانِ تازه و تالارِشان." },
  { key: "items", emoji: TERM.inventory.emoji, short: `${TERM.inventory.emoji} ${TERM.inventory.short}`, title: TERM.inventory.groupSectionTitle, line: "کیف و تجهیزات شخصی‌اند — قوانین‌شان این‌جا خوانده می‌شود." },
  { key: "economy", emoji: "💰", short: "💰 اقتصاد", title: "اقتصاد و بازار", line: "صندوقِ شهر، شاخصِ بازارِ جهان و پروژه‌ها." },
  { key: "fame", emoji: "🏆", short: "🏆 افتخارات", title: "مأموریت‌ها و دستاوردها", line: "دستاوردهایِ شهر، تالارِ افتخارات و اهدافِ شخصی." },
  { key: "games", emoji: "🎉", short: "🎉 بازی‌ها", title: "بازی‌ها و فعالیت‌های جمعی", line: "بازی‌های گروهی با جایزه و عواقبِ واقعی." },
  { key: "help", emoji: "📖", short: "📖 راهنما", title: "راهنمای جامع", line: "کدکسِ کاملِ شهر — دسته‌ها، عبارت‌ها و رفعِ اشکال." },
  { key: "settings", emoji: "⚙", short: "⚙ تنظیمات", title: "اطلاعات و تنظیمات گروه", line: "هویتِ گروه و کارتِ تنظیمات (تنظیم فقط با ادمین)." },
]

const NAV_KEYS = new Set(NAV_SECTIONS.map((s) => s.key))

/** دکمه‌ی بازگشت به خانه — پایینِ هر کارتِ بخش/فرزند */
const HOME: OutboxButton = { label: "↩ خانه", style: "primary", cb: "gm:game" }

/** گریدِ ۱۲تاییِ منویِ خانه — جفت‌جفت در یک ردیف (sameRow روی دومیِ هر جفت). */
export function navGridButtons(): OutboxButton[] {
  const out: OutboxButton[] = []
  NAV_SECTIONS.forEach((s, i) => {
    out.push({ label: s.short, style: "primary", cb: `gm:nav:${s.key}`, ...(i % 2 === 1 ? { sameRow: true } : {}) })
  })
  // تازه‌سازیِ کارتِ خانه — همان «🔄 خانه»ی دیروز، تهِ گرید
  out.push({ label: "🔄 خانه", style: "primary", cb: "gm:game" })
  return out
}

/** V26 — نقشه‌ی شهر (gm:more): لایه‌ی دومِ ناوبریِ گروه. کارتِ خانه فقط ششِ
 *  اصلی را دارد؛ این کارت همه‌ی ۱۲ بخش را با گریدِ جفتی باز می‌کند. بازگشت
 *  به خانه تهِ کارت. pure — فقط از جدولِ NAV_SECTIONS می‌خواند. */
export function cityMapCard(): CallbackResult {
  const lines: string[] = [
    "",
    "🗺 <b>نقشه‌ی شهر</b>",
    emblem("🗺"),
    "",
    quote(`همه‌ی ${chip(NAV_SECTIONS.length)} بخشِ شهر — هر کدام مقصد و کارتِ خودشان را دارند.`),
    "",
  ]
  return {
    ok: true,
    ackText: "نقشه‌ی شهر",
    editCard: { text: lines.join("\n"), buttons: navGridButtons() },
  }
}

// ─── helperهای رندر ────────────────────────────────────────────────────────────

/** رقم‌های یک برچسبِ آماده (بدونِ تگ) را esc+chip می‌کند — «سطح 12» → «سطح <code>12</code>» */
function chipDigits(label: string): string {
  return esc(label).replace(/\d[\d,]*(?:\.\d+)?[%٪]?/g, (m) => `<code>${m.replace(/٪/g, "%")}</code>`)
}

const MEDALS = ["🥇", "🥈", "🥉"]

/** کارتِ بخش — عنوان + یک خط + خلاصه‌ی واقعی + فرزندان. همه‌ی داده‌ها از snapshot.
 *  V24 «ظاهرِ شهر»: نشانِ خودِ بخش در مرکزِ جداکننده؛ حالت‌هایِ خالی و خط‌هایِ راهنما
 *  زیرِ نقل‌قول (هم‌زبانِ بقیه‌ی کارت‌های شهر). */
export async function navSection(ctx: GroupCallCtx, key: string): Promise<CallbackResult> {
  if (!NAV_KEYS.has(key)) {
    return { ok: false, ackText: "چنین بخشی در شهر نیست." }
  }
  const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
  const viewer = ctx.player ? await buildHomeViewer(ctx.db, ctx.group, ctx.player, snap) : null
  const def = NAV_SECTIONS.find((s) => s.key === key)!
  const lines: string[] = ["", `${def.emoji} <b>${def.title}</b>`, emblem(def.emoji), "", def.line, ""]

  const children: OutboxButton[] = []

  switch (key) {
    case "world": {
      lines.push(
        `${snap.weatherEmoji} ${snap.weatherLabel} · ${snap.moodEmoji} ${snap.moodLabel} · ${snap.stateLabel}`,
        `🌀 آشوب: ${pct(snap.chaos)} · ${snap.socialTempLabel}`,
        `💰 صندوق: ${chip(snap.treasury)} · 🏛 اعتبار: ${snap.reputationLabel}`,
      )
      children.push(
        { label: "🌤 وضعیت شهر", style: "primary", cb: "gm:city" },
        { label: "📜 تاریخچه", style: "primary", cb: "gm:history", sameRow: true },
        { label: "🏗 پروژه‌ها", style: "primary", cb: "gm:projects" },
        { label: "📖 قوانینِ جهان", style: "primary", cb: "gh:c:rules", sameRow: true },
      )
      break
    }
    case "events": {
      if (snap.currentEvent) {
        const ev = snap.currentEvent
        lines.push(`${ev.emoji} <b>${esc(ev.title)}</b> — ${chip(ev.participantsCount)} انتخاب · ⏳ ${remainChip(ev.expiresAt)}`)
      } else {
        lines.push(quote("اتفاقی باز نیست — شهر منتظرِ کسی است که یکی بسازد."))
      }
      children.push(
        { label: "💥 اتفاقِ شهر", style: "danger", cb: "gm:event" },
        { label: "📜 تاریخچه", style: "primary", cb: "gm:history", sameRow: true },
        { label: "📖 قوانینِ رویدادها", style: "primary", cb: "gh:c:events" },
      )
      break
    }
    case "votes": {
      if (snap.openVotes.length > 0) {
        const v = snap.openVotes[0]!
        const total = v.options.reduce((s, o) => s + o.count, 0)
        lines.push(`🗳 <b>${esc(v.subject)}</b> — ${chip(total)} رأی · ⏳ ${remainChip(v.closesAt)}`)
      } else {
        lines.push(quote("رأیِ بازی در جریان نیست — انتخاباتِ شهردار هر هفته خودکار برگزار می‌شود."))
      }
      children.push(
        { label: "🗳 رأیِ باز", style: "primary", cb: "gm:vote" },
        { label: "🏛 انتخاباتِ فوری", style: "danger", cb: "gm:elect", sameRow: true },
        { label: "⚖️ دادگاه بساز", style: "primary", cb: "gm:court" },
        { label: "📖 نقش‌ها و انتخابات", style: "primary", cb: "gh:t:social-roles:0", sameRow: true },
      )
      break
    }
    case "battle": {
      const pend = (snap.challenges ?? []).filter((c) => c.status === "pending")
      if (pend.length === 0) {
        lines.push(quote("هیچ دوئلی در انتظار نیست — آرام است… فعلاً."))
      } else {
        for (const c of pend) {
          const mine = c.myRole === "target" ? " · منتظرِ جوابِ توست" : c.myRole === "challenger" ? " · دعوت از توست" : ""
          lines.push(`⚔️ <b>${esc(c.challengerName)}</b> در برابرِ <b>${esc(c.targetName)}</b> — ⏳ ${remainChip(c.expiresAt)}${mine}`)
        }
      }
      lines.push("", SUB, "", quote(`دعوتِ تازه: روی پیامِ رقیب reply بزن و ${chip("جنگ فمبوی")} بگو.`))
      // دعوتِ خودِ بیننده — همان دکمه‌های contextuیِ خانه (§6.3)
      const mine = pend.find((c) => c.myRole === "target")
      if (mine) {
        children.push(
          { label: "⚔️ قبول می‌کنم", style: "success", cb: `gc:${mine.id}:accept` },
          { label: "✖️ رد می‌کنم", style: "danger", cb: `gc:${mine.id}:decline`, sameRow: true },
        )
      }
      children.push(
        { label: "⚔️ دعوت‌های دوئل", style: "primary", cb: "gm:duels" },
        { label: "📖 راهنمای دوئل", style: "primary", cb: "gh:t:combat-duels:0", sameRow: true },
        { label: "🏆 تالارِ قهرمانان", style: "primary", cb: "gm:fame" },
      )
      break
    }
    case "players": {
      lines.push(
        `👥 ${chip(snap.population)} شهروند · ⚡ ${chip(snap.activePlayers)} فعالِ امروز`,
        snap.mayor ? `👑 شهردار: <b>${esc(snap.mayor.name)}</b>` : "👑 شهرداری خالی است — انتخابات در راه است.",
      )
      children.push(
        { label: "🏘 شهروندها", style: "primary", cb: "gm:members" },
        { label: "🏆 برترین‌های شهر", style: "primary", cb: "gm:top", sameRow: true },
      )
      break
    }
    case "femboy": {
      if (viewer?.character) {
        const c = viewer.character
        lines.push(`${c.classEmoji} <b>${esc(c.femboyName)}</b> · ${esc(c.className)} · سطح ${chip(c.level)}`)
      } else if (viewer?.isMember) {
        lines.push("بدونِ فمبوی فقط تماشاگری — ساختنش در پی‌ویِ ربات است.")
      } else {
        lines.push("هنوز شهروندِ این شهر نیستی — تو گروه حرف بزن تا شهرت ثبت کند.")
      }
      lines.push("هویتِ فمبوی‌هایِ شهر در کارتِ «شهروندها» دیده می‌شود — ایموجیِ کلاس و ✨هایِ فرگشت.")
      children.push(
        viewer?.character
          ? { label: "🎀 فمبویِ من — در خصوصی", style: "primary", url: "https://t.me/femwarbot?start=femboy" }
          : { label: "🎀 ساختنِ فمبوی", style: "success", url: "https://t.me/femwarbot?start=femboy" },
        { label: "🏘 هویتِ فمبوی‌ها", style: "primary", cb: "gm:members", sameRow: true },
        { label: "🏆 تالارِ فمبوی‌ها", style: "primary", cb: "gm:fame" },
        { label: "📖 قوانینِ فمبوی", style: "primary", cb: "gh:c:femboy", sameRow: true },
      )
      break
    }
    case "items": {
      lines.push(
        "کیف و تجهیزات شخصی‌اند — زندگیِ خصوصی، در پی‌ویِ ربات.",
        quote(`در خصوصی ${chip("کیف")} را بگو تا کیفت باز شود؛ این‌جا فقط قوانینش خوانده می‌شود.`),
      )
      children.push(
        { label: "🎒 کیف من — در خصوصیِ ربات", style: "primary", url: "https://t.me/femwarbot?start=items" },
        { label: "📖 قوانینِ آیتم‌ها", style: "primary", cb: "gh:c:items", sameRow: true },
      )
      break
    }
    case "economy": {
      const building = snap.projects.find((p) => p.status === "building")
      lines.push(
        `💰 صندوق: ${chip(snap.treasury)} · 🏛 اعتبار: ${snap.reputationLabel}`,
        ...(building ? [barRow(building.emoji, building.name, building.contributed, building.goal)] : []),
        `🛒 شاخصِ بازارِ جهان و آگهی‌ها روی کارتِ «بازار و شاخص» است.`,
      )
      children.push(
        { label: "🛒 بازار و شاخص", style: "primary", cb: "gm:economy" },
        { label: "🏛 صندوق و وضعیت", style: "primary", cb: "gm:city", sameRow: true },
        { label: "🏗 پروژه‌ها / کمک", style: "primary", cb: "gm:projects" },
        { label: "🛍 بازارِ شخصی — در خصوصیِ ربات", style: "primary", url: "https://t.me/femwarbot?start=market", sameRow: true },
        { label: "📖 قوانینِ اقتصاد", style: "primary", cb: "gh:c:economy" },
      )
      break
    }
    case "fame": {
      const unlocked = snap.achievementsUnlockedCount ?? snap.achievementsUnlocked.length
      const total = GROUP_ACHIEVEMENTS.length
      // V24: N-of-M با سقفِ واقعیِ دستاوردهای شهر — نوارِ زنده + چیپِ کسر
      lines.push(barRow("🏘", "دستاوردهایِ شهر", unlocked, total, `${faNum(unlocked)}/${faNum(total)}`))
      const recent = snap.achievementsUnlocked
        .map((k) => GROUP_ACHIEVEMENTS.find((a) => a.key === k))
        .filter((a): a is (typeof GROUP_ACHIEVEMENTS)[number] => Boolean(a))
        .slice(0, 3)
      if (recent.length > 0) {
        lines.push(...recent.map((a) => `${a.emoji} ${esc(a.name)}`))
      }
      lines.push("تالارِ افتخارات، برترینِ فمبوی‌هایِ جهان را رتبه‌بندی می‌کند.")
      children.push(
        { label: "🏆 تالارِ افتخارات", style: "primary", cb: "gm:fame" },
        { label: "🏘 دستاوردهای شهر", style: "primary", cb: "gh:t:fame-group:0", sameRow: true },
        { label: "🎯 اهداف من — در خصوصیِ ربات", style: "primary", url: "https://t.me/femwarbot?start=goals" },
        { label: "📖 قوانینِ پیشرفت", style: "primary", cb: "gh:c:progression", sameRow: true },
      )
      break
    }
    case "games": {
      if (snap.activeGame) {
        const g = snap.activeGame
        const mine = ctx.player ? g.participants.some((p) => p.playerId === ctx.player!.id) : false
        lines.push(`🎲 ${g.emoji} <b>${esc(g.name)}</b> — ${chip(g.participants.length)} ثبت‌نام · ⏳ ${remainChip(g.closesAt)}`)
        if (!mine) {
          children.push({ label: "✋ ثبت‌نامِ بازیِ باز", style: "success", cb: `gg:${g.id}:j` })
        }
      } else {
        lines.push(quote("بازیِ بازی در جریان نیست — یکی از فهرست باز کن."))
      }
      lines.push(`🎲 ${chip(SOCIAL_GAMES.length)} بازی در شهر است — با جایزه و عواقبِ واقعی.`)
      children.push(
        { label: "🎲 بازی‌های گروهی", style: "primary", cb: "gm:play" },
        { label: "💥 اتفاقِ شهر", style: "danger", cb: "gm:event", sameRow: true },
      )
      break
    }
    case "help": {
      lines.push(`کدکسِ شهر: ${chip(HELP_CATEGORIES.length)} دسته‌ی واقعی — از پیمانِ فمبوی تا اقتصاد و عبارت‌ها.`)
      children.push(
        { label: "📚 کدکسِ کامل", style: "primary", cb: "gh:m" },
        { label: "🎀 راهنمای سریعِ گروه", style: "primary", cb: "gm:help", sameRow: true },
        { label: "✨ عبارت‌های جادویی", style: "primary", cb: "gh:c:phrases" },
        { label: "🩹 رفعِ اشکال", style: "primary", cb: "gh:c:faq", sameRow: true },
      )
      break
    }
    case "settings": {
      lines.push(
        `🏘 ${esc(ctx.group.title)} · 👥 ${chip(snap.population)} شهروند · ${snap.cultureEmoji} ${snap.cultureLabel}`,
        "تنظیم فقط با ادمین‌های گروه — کارتِ تنظیمات برای بقیه گزارش است.",
      )
      children.push(
        { label: "🛠 تنظیماتِ شهر", style: "primary", cb: "gm:gadmin" },
        { label: "🏘 اطلاعاتِ گروه", style: "primary", cb: "gm:members", sameRow: true },
        { label: "📖 قوانینِ شهر", style: "primary", cb: "gh:c:rules" },
      )
      break
    }
  }

  children.push(HOME)
  return { ok: true, ackText: def.title, editCard: { text: lines.join("\n"), buttons: children } }
}

// ─── فرمانِ duels — دعوت‌های دوئلِ این شهر (V15-1) ─────────────────────────────

/** کارتِ دعوت‌های دوئل — بازها با دکمه‌های نقشی (gc:)، تاریخچه‌ی نزدیک، راهنمای reply.
 *  V24 «ظاهرِ شهر»: نشانِ ⚔️ + حالتِ خالی و راهنمای reply زیرِ نقل‌قول. */
export async function duelsCommandCard(ctx: GroupCallCtx): Promise<GroupCommandResult> {
  const groupId = ctx.group.id
  const [pend, recent] = await Promise.all([
    ctx.db.groupChallenge.findMany({
      where: { groupId, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 4,
      include: { challenger: { select: { name: true } }, target: { select: { name: true } } },
    }),
    ctx.db.groupChallenge.findMany({
      where: { groupId, status: "resolved" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { challenger: { select: { name: true } }, target: { select: { name: true } } },
    }),
  ])

  const lines: string[] = ["", "⚔️ <b>دعوت‌های دوئل</b>", emblem("⚔️"), ""]
  const buttons: OutboxButton[] = []

  if (pend.length === 0) {
    lines.push(quote("هیچ دوئلی در انتظار نیست — آرام است… فعلاً."))
  }
  for (const c of pend) {
    const myRole = ctx.player?.id === c.challengerId ? "challenger" : ctx.player?.id === c.targetId ? "target" : null
    const note = myRole === "target" ? " · منتظرِ جوابِ توست" : myRole === "challenger" ? " · دعوت از توست" : ""
    lines.push(`⚔️ <b>${esc(c.challenger.name)}</b> در برابرِ <b>${esc(c.target.name)}</b> — ⏳ ${remainChip(c.expiresAt.toISOString())}${note}`)
    if (myRole === "target") {
      buttons.push(
        { label: "⚔️ قبول می‌کنم", style: "success", cb: `gc:${c.id}:accept` },
        { label: "✖️ رد می‌کنم", style: "danger", cb: `gc:${c.id}:decline`, sameRow: true },
      )
    } else if (myRole === "challenger") {
      buttons.push({ label: "↩ پس می‌گیرم", style: "danger", cb: `gc:${c.id}:cancel` })
    }
  }

  const resolvedRows = recent
  if (resolvedRows.length > 0) {
    lines.push("", SUB, "", "آخرین نتیجه‌ها:")
    for (const r of resolvedRows) {
      const winner = parseJson<{ winnerName?: string }>(r.outcomeJson, {}).winnerName
      lines.push(`🏆 ${esc(winner ?? "؟")} — ${esc(r.challenger.name)} در برابرِ ${esc(r.target.name)}`)
    }
  }

  lines.push("", SUB, "", quote(`دعوتِ تازه: روی پیامِ رقیب reply بزن و ${chip("جنگ فمبوی")} بگو.`))

  buttons.push(
    { label: "📖 راهنمای دوئل", style: "primary", cb: "gh:t:combat-duels:0" },
    { label: "🏆 تالارِ قهرمانان", style: "primary", cb: "gm:fame", sameRow: true },
    { label: "↩ خانه", style: "primary", cb: "gm:game" },
  )
  return { text: lines.join("\n"), buttons }
}

// ─── فرمانِ economy — اقتصاد و بازار (V15-1) ──────────────────────────────────

/** کارتِ اقتصاد — صندوق/اعتبار/پروژه از شهر + شاخصِ جهان و آگهی‌هایِ فعالِ بازار
 *  (بازارِ آیتم‌ها جهانی است — همان داده‌ای که مینی‌اپ و رباتِ خصوصی می‌بینند).
 *  V24 «ظاهرِ شهر»: نشانِ 💰 + راهنمایِ بازارِ شخصی زیرِ نقل‌قول. */
export async function economyCommandCard(ctx: GroupCallCtx): Promise<GroupCommandResult> {
  const snap = await buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group)
  const [world, listings, prices] = await Promise.all([
    getWorld(),
    ctx.db.marketListing.count({ where: { status: "active", quantity: { gt: 0 } } }),
    ctx.db.marketPrice.findMany(),
  ])

  const lines: string[] = [
    "",
    "💰 <b>اقتصاد و بازار</b>",
    emblem("💰"),
    "",
    `🏛 صندوقِ شهر: ${chip(snap.treasury)} · اعتبار: ${snap.reputationLabel}`,
  ]
  const building = snap.projects.find((p) => p.status === "building")
  if (building) {
    // V24: پیشرفتِ پروژه با سقفِ واقعیِ goal — نوارِ زنده به‌جای چیپِ درصد
    lines.push(barRow(building.emoji, building.name, building.contributed, building.goal))
  }
  lines.push(`🛒 شاخصِ بازارِ جهان: ${chip(world.economyIndex)} · ${chip(listings)} آگهیِ فعال`)

  // پرخروش‌ترین قیمت‌ها — همان فرمولِ /api/game/market (current × economyIndex)
  const movers = prices
    .filter((p) => ITEM_MAP[p.itemKey]?.tradable)
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
    .slice(0, 3)
  for (const m of movers) {
    const def = ITEM_MAP[m.itemKey]!
    const current = Math.round(m.current * (world.economyIndex / 100))
    const arrow = m.trend > 0 ? "📈" : m.trend < 0 ? "📉" : "➖"
    lines.push(`${def.emoji} ${esc(def.name)} — ${chip(current)} سکه · ${arrow} ${chip(`${m.trend > 0 ? "+" : m.trend < 0 ? "−" : ""}${Math.abs(m.trend)}%`)}`)
  }

  lines.push(
    "",
    SUB,
    "",
    quote(`خرید و فروش و کیف شخصی‌اند — در پی‌ویِ ربات ${chip("بازار")} را بگو.`),
  )

  return {
    text: lines.join("\n"),
    buttons: [
      { label: "🏛 وضعیتِ صندوق", style: "primary", cb: "gm:city" },
      { label: "🏗 پروژه‌ها", style: "primary", cb: "gm:projects", sameRow: true },
      { label: "🛍 بازارِ شخصی — در خصوصیِ ربات", style: "primary", url: "https://t.me/femwarbot?start=market" },
      { label: "📖 قوانینِ اقتصاد", style: "primary", cb: "gh:c:economy", sameRow: true },
      { label: "↩ خانه", style: "primary", cb: "gm:game" },
    ],
  }
}

// ─── فرمانِ fame — تالارِ افتخارات (V15-1) ────────────────────────────────────

/** کارتِ تالار — همان hallOfFameِ موتور (منبعِ /champ ربات و مینی‌اپ): ۶ تابلو
 *  از soulCharacterهایِ واقعی + شمارِ دستاوردهایِ همین شهر.
 *  V24 «ظاهرِ شهر»: نشانِ 🏆 + حالتِ خالی زیرِ نقل‌قول. */
export async function fameCommandCard(ctx: GroupCallCtx, board = "level"): Promise<GroupCommandResult> {
  const [hall, snap] = await Promise.all([
    hallOfFame(board),
    buildGroupSnapshot(ctx.chatId, ctx.player?.id, ctx.group),
  ])

  const lines: string[] = ["", `🏆 <b>تالارِ افتخارات — ${esc(hall.boardLabel)}</b>`, emblem("🏆"), ""]
  if (hall.entries.length === 0) {
    lines.push(quote("هنوز کسی اسمی از خودش نگذاشته…"), "", "<i>اولین افسانه تو باش.</i>")
  } else {
    hall.entries.slice(0, 10).forEach((e, i) => {
      const rank = i < 3 ? (MEDALS[i] ?? `${chip(e.rank)}.`) : `${chip(e.rank)}.`
      lines.push(`${rank} ${esc(e.characterName)} ${e.classEmoji} — ${chipDigits(e.valueLabel)} <i>(بازیکن: ${esc(e.playerName)})</i>`)
    })
    if (hall.entries.length > 10) {
      lines.push("", `<i>… و ${chip(hall.entries.length - 10)} افسانه‌ی دیگر</i>`)
    }
  }
  const unlocked = snap.achievementsUnlockedCount ?? snap.achievementsUnlocked.length
  // V24: N-of-M با سقفِ واقعی — نوارِ زنده + چیپِ کسر (هم‌زبانِ نوارِ دستاوردهای ربات)
  lines.push("", SUB, "", barRow("🏘", "دستاوردهایِ این شهر", unlocked, GROUP_ACHIEVEMENTS.length, `${faNum(unlocked)}/${faNum(GROUP_ACHIEVEMENTS.length)}`))

  // تخته‌ها — همان کلیدهایی که موتور برمی‌گرداند (ربات hardcode نمی‌کند)
  const buttons: OutboxButton[] = hall.boards.map((b, i) => ({
    label: `${b.icon} ${b.label}${b.key === hall.board ? " ✓" : ""}`,
    style: (b.key === hall.board ? "success" : "primary") as "success" | "primary",
    cb: `gm:fame:${b.key}`,
    ...(i % 2 === 1 ? { sameRow: true } : {}),
  }))
  buttons.push(
    { label: "📖 قوانینِ دستاوردها", style: "primary", cb: "gh:c:fame" },
    { label: "↩ خانه", style: "primary", cb: "gm:game", sameRow: true },
  )
  return { text: lines.join("\n"), buttons }
}

// ─── gm:top — برترین‌های همین شهر (V15-1) ─────────────────────────────────────

/** کارتِ برترین‌های شهر — از آمارِ واقعیِ اعضایِ همین گروه (برد/بازی/آبرو).
 *  V17-W2 (§12): بیننده رتبه‌ی خودش را هم همان‌جا می‌بیند — «تو کجایی؟» دیگر
 *  به سفرِ پی‌وی نیاز ندارد؛ سطرِ ردیفِ خودش در فهرست هم «← تو» می‌گیرد.
 *  V24 «ظاهرِ شهر»: نشانِ 🏆 + حالتِ خالی زیرِ نقل‌قول. */
export async function topCommandCard(ctx: GroupCallCtx): Promise<GroupCommandResult> {
  // کلِ اعضا (شهرها کوچک‌اند؛ سقفِ دفاعی ۵۰۰) — تا رتبه‌ی بیننده فراتر از ۱۰ هم درست بماند
  const all = await ctx.db.groupMember.findMany({
    where: { groupId: ctx.group.id },
    include: { player: { select: { name: true, avatar: true } } },
    orderBy: [{ winCount: "desc" }, { gameCount: "desc" }, { messageCount: "desc" }],
    take: 500,
  })
  const rows = all.slice(0, 10)
  const viewerId = ctx.player?.id
  const viewerIdx = viewerId ? all.findIndex((m) => m.playerId === viewerId) : -1
  const viewerRow = viewerIdx >= 0 ? all[viewerIdx] : undefined

  const lines: string[] = ["", "🏆 <b>برترین‌های شهر</b>", emblem("🏆"), "", "رتبه از آمارِ واقعیِ همین شهر می‌آید — برد، بازی و آبرو.", ""]
  if (rows.length === 0) {
    lines.push(quote("هنوز هیچ‌کس در این شهر قهرمان نشده — تابلو خالی است."), "", "<i>اولین نامش می‌تواند نامِ تو باشد.</i>")
  } else {
    for (const [i, m] of rows.entries()) {
      const rep = memberRep(m)
      const rank = i < 3 ? (MEDALS[i] ?? `${chip(i + 1)}.`) : `${chip(i + 1)}.`
      const mine = viewerIdx === i ? " <b>← تو</b>" : ""
      lines.push(`${rank} ${m.player.avatar} <b>${esc(m.player.name)}</b>${mine} — 🏅 ${chip(m.winCount)} برد از ${chip(m.gameCount)} بازی · ✨ ${chip(rep.fame)} آبرو`)
    }
  }
  // «تو» — جایگاهِ شخصیِ بیننده (حتی بیرونِ ۱۰ نفرِ اول)
  if (viewerRow && viewerIdx >= 0) {
    const rep = memberRep(viewerRow)
    lines.push("", `👤 <b>تو:</b> رتبه‌ی ${chip(viewerIdx + 1)} از ${chip(all.length)} · 🏅 ${chip(viewerRow.winCount)} برد از ${chip(viewerRow.gameCount)} بازی · ✨ ${chip(rep.fame)} آبرو`)
  }

  return {
    text: lines.join("\n"),
    buttons: [
      { label: "🏘 شهروندها", style: "primary", cb: "gm:members" },
      { label: "🏆 تالارِ جهان", style: "primary", cb: "gm:fame", sameRow: true },
      { label: "↩ خانه", style: "primary", cb: "gm:game" },
    ],
  }
}
