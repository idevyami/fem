// FEMBOY WAR — V13: presentation — سازنده‌های خالصِ کارت‌هایِ فرمانِ شهر.
//
// قراردادِ جای‌گذاری (موجِ ۱، از سندِ طراحی): کارت‌builder هایی که به state-machineِ
// یک دامنه‌ی خاص تعلق دارند کنارِ همان دامنه می‌مانند (events.eventCardText،
// world.rumorCardText، tick.morningCardText، ...) — رسمِ تازه‌تأسیسِ «رندر خالص
// beside its state machine، با primitiveهای text.ts». آنچه به «فرمانِ شهر»
// عمومی تعلق دارد (کارتِ خانه/وضع/راهنما/… که facade می‌سازد) این‌جا زندگی
// می‌کند تا router.ts فقط dispatch بماند.
//
// موجِ ۲ (V13 §3.3/§6.3): کارتِ خانه state-aware بازنویسی شد — بخشِ «الان چی
// می‌گذره؟» فعالیت‌هایِ باز را با اولویت (دعوتِ دوئل > اتفاق > بازی > رأی >
// پروژه) یک‌خطی نشان می‌دهد و بینندهٔ کارت، وضعیتِ حضورِ خودش را می‌بیند
// (§6.3: شرکت‌کننده دکمه‌ی گمراه‌کننده‌ی «join» نمی‌بیند؛ متنِ وضعیت می‌بیند).
// راهنما هم حلقه‌ی واقعیِ بازی را توضیح می‌دهد، نه فهرستِ فرمان.

import type { GroupSnapshotDTO } from "./types"
import type { HomeViewer } from "./snapshot"
import type { OutboxButton } from "./types"
import { esc } from "./domain"
import { SUB, DOTS, chip, pct, remainChip, emblem, quote, barRow, bar } from "./text"
// V16-4 — واژه‌نامه‌ی قاعده‌مند: عنوانِ کارتِ راهنما «شهرِ گروه» (TERM.groupWorld)
import { TERM } from "../terminology"

// آدرسِ عمومیِ مینی‌اپ — فقط https واقعی معتبر است (برای دکمه‌های "مینی‌اپ شهر" در کارت‌های گروه)
export const MINIAPP_URL = /^https:\/\//.test(process.env.MINIAPP_URL || "")
  ? (process.env.MINIAPP_URL as string)
  : ""


// ─── سازنده‌های خالصِ کارت‌های فرمان (تست‌پذیر؛ V11 — درِ ورودیِ شهر) ───────────

/** کارتِ /game — خانه‌ی شهر؛ state-aware (V13 §3.3): «الان چی می‌گذره؟» + «تو».
 *  هر فعالیت یک خط: ایموجی + عنوان + چیپِ مهلت + شمارِ همراهان؛ وضعیتِ حضورِ
 *  بیننده به‌جای دکمه‌ی گمراه‌کننده (§6.3). دکمه‌های contextuی را gameHomeButtons می‌سازد.
 *  V24 «ظاهرِ شهر»: نشانِ 🎀 در مرکزِ جداکننده + ردیف‌های ▪ برای فعالیت‌هایِ باز. */
export function gameHomeCardText(snap: GroupSnapshotDTO, groupTitle: string, viewer?: HomeViewer | null): string {
  const lines: string[] = [
    `🎀 <b>شهرِ ${esc(groupTitle)}</b>`,
    `${snap.districtEmoji} ${snap.districtName} · ${snap.weatherEmoji} ${snap.weatherLabel} · ${snap.cultureEmoji} ${snap.cultureLabel}`,
    emblem("🎀"),
    "",
    "🟢 <b>الان چی می‌گذره؟</b>",
  ]

  // فعالیت‌هایِ باز — اولویت: دعوتِ دوئل > اتفاق > بازی > رأی (حداکثر ۴ خطِ فشرده)
  const acts: string[] = []
  for (const c of snap.challenges ?? []) {
    if (c.status !== "pending") continue
    const mine = viewer && c.myRole === "target" ? " · منتظرِ جوابِ توست" : viewer && c.myRole === "challenger" ? " · دعوت از توست" : ""
    acts.push(`▪ ⚔️ <b>${esc(c.challengerName)}</b> ↔ <b>${esc(c.targetName)}</b> — ⏳ ${remainChip(c.expiresAt)}${mine}`)
  }
  if (snap.currentEvent) {
    const ev = snap.currentEvent
    const mine = viewer?.joinedEvent ? " · انتخابت ثبت است" : ""
    acts.push(`▪ 💥 ${ev.emoji} ${ev.title} — ${chip(ev.participantsCount)} انتخاب · ⏳ ${remainChip(ev.expiresAt)}${mine}`)
  }
  if (snap.activeGame) {
    const g = snap.activeGame
    const mine = viewer?.joinedGame ? " · تو داخلی" : ""
    acts.push(`▪ 🎲 ${g.emoji} ${g.name} — ${chip(g.participants.length)} نفر${mine}`)
  }
  if (snap.openVotes.length > 0) {
    const v = snap.openVotes[0]!
    const total = v.options.reduce((s, o) => s + o.count, 0)
    const mine = viewer?.voted ? " · رأیت ثبت است" : ""
    acts.push(`▪ 🗳 ${esc(v.subject)} — ${chip(total)} رأی${mine}`)
  }
  lines.push(...(acts.length > 0 ? acts.slice(0, 4) : [quote("😴 شهر نفس می‌کشد. مخصوصاً اگر کسی کاری بکند.")]))

  // «تو» — هویتِ فمبوی یا پلِ پی‌وی (یک خط؛ دیروز دو خط)
  lines.push("", SUB, "", "👤 <b>تو</b>")
  if (!viewer || !viewer.isMember) {
    lines.push("هنوز شهروندِ این شهر نیستی — تو گروه حرف بزن تا شهرت ثبت کند.")
  } else if (viewer.character) {
    const c = viewer.character
    const badge = [viewer.roleLabel ? `${viewer.roleEmoji ?? "🏛"} ${esc(viewer.roleLabel)}` : null, viewer.title ? esc(viewer.title) : null]
      .filter(Boolean)
      .join(" · ")
    const standing = [
      viewer.wins && viewer.wins > 0 ? `🏅 ${chip(viewer.wins)} برد` : null,
      viewer.fame && viewer.fame > 0 ? `✨ ${chip(viewer.fame)} آبرو` : null,
    ]
      .filter(Boolean)
      .join(" · ")
    lines.push(`${c.classEmoji} <b>${esc(c.femboyName)}</b> · ${esc(c.className)} · سطح ${chip(c.level)}${badge ? ` · ${badge}` : ""}${standing ? ` · ${standing}` : ""}`)
  } else {
    lines.push("بدونِ فمبوی فقط تماشاگری — ساختنش در پی‌ویِ ربات است.")
  }

  // V26 — فهرستِ متنیِ ۱۲ بخش از کارت رفت: ناوبری حالا دو‌سطحی است
  // (۶ مقصدِ اصلی روی کارت + «⋯ همه‌ی بخش‌ها» برای نقشه‌ی کامل)
  if (snap.whyComeBack) lines.push("", `<i>${snap.whyComeBack}</i>`)
  return lines.join("\n")
}

/** دکمه‌هایِ کارتِ خانه — contextual اول (§6.3)، بعد گریدِ ۱۲-بخشیِ منوی شهر
 *  (V15-1: هر بخش gm:nav:{key}؛ جفت‌ها با sameRow در یک ردیف می‌نشینند)، و در
 *  پایان دکمه‌ی url مینی‌اپ. مجموع ≤ ۲۰ می‌ماند: حداکثر ۶ contextual + ۱۳ ناوبری + ۱ لینک. */
export function gameHomeButtons(snap: GroupSnapshotDTO, viewer?: HomeViewer | null): OutboxButton[] {
  const buttons: OutboxButton[] = []

  // ۱) contextual — کنشِ زنده‌ی «همین حالا» (سقف ۳؛ فقط واقعی‌ها)
  const pendingMine = (snap.challenges ?? []).find((c) => c.status === "pending" && c.myRole === "target")
  if (pendingMine) {
    buttons.push({ label: "⚔️ قبول می‌کنم", style: "success", cb: `gc:${pendingMine.id}:accept` })
    buttons.push({ label: "✖️ رد می‌کنم", style: "danger", cb: `gc:${pendingMine.id}:decline` })
  }
  if (snap.currentEvent && !(viewer?.joinedEvent)) {
    buttons.push({ label: "💥 شرکت در اتفاق", style: "danger", cb: "gm:event" })
  }
  if (snap.activeGame && !(viewer?.joinedGame)) {
    buttons.push({ label: "✋ ثبت‌نامِ بازی", style: "success", cb: `gg:${snap.activeGame.id}:j` })
  } else if (snap.openVotes.length > 0 && !(viewer?.voted)) {
    buttons.push({ label: "🗳 رأی بده", style: "primary", cb: "gm:vote" })
  }
  if (viewer && !viewer.isMember) {
    buttons.push({ label: "🏘 پیوستن به شهر", style: "primary", cb: "gm:game" })
  }
  if (viewer?.isMember && !viewer.character) {
    buttons.push({ label: "🎀 ساختنِ فمبوی", style: "success", url: "https://t.me/femwarbot?start=femboy" })
  }

  // ۲) V26 — ناوبریِ دو‌سطحی: شش مقصدِ اصلیِ شهر (سه ردیفِ جفتی)؛
  //    دیروز گریدِ ۱۲تاییِ یک‌سطحی همه‌ی بخش‌ها را هم‌زمان روی کارت می‌آورد —
  //    شلوغیِ دکمه در چتِ پرحرف. ششِ اصلیِ امروز همان‌هایی‌اند که ۸۰٪ کنش‌ها
  //    از آن‌ها می‌گذرد؛ «⋯ همه‌ی بخش‌ها» نقشه‌ی کامل (gm:more) را باز می‌کند.
  const MAIN_NAV: { label: string; cb: string; row?: boolean }[] = [
    { label: "🏙 شهر", cb: "gm:nav:world" },
    { label: "🎭 رویدادها", cb: "gm:nav:events", row: true },
    { label: "🗳 رأی‌گیری", cb: "gm:nav:votes" },
    { label: "⚔ نبردها", cb: "gm:nav:battle", row: true },
    { label: "🧑‍🤝‍🧑 بازیکن‌ها", cb: "gm:nav:players" },
    { label: "📖 راهنما", cb: "gm:nav:help", row: true },
  ]
  for (const n of MAIN_NAV) {
    buttons.push({ label: n.label, style: "primary", cb: n.cb, ...(n.row ? { sameRow: true } : {}) })
  }

  // ۳) نقشه‌ی کامل + تازه‌سازی — ردیفِ آخرِ ناوبری
  buttons.push({ label: "⋯ همه‌ی بخش‌ها", style: "primary", cb: "gm:more" })
  buttons.push({ label: "🔄 تازه", style: "primary", cb: "gm:game", sameRow: true })

  // ۴) مینی‌اپ — با /game تازه می‌رسد (در گروه web_app مجاز نیست)
  if (MINIAPP_URL) buttons.push({ label: "📱 مینی‌اپ شهر", style: "success", url: MINIAPP_URL })
  return buttons
}

/** کارتِ /city — وضعیتِ محیط. V24: نشانِ 🏙. */
export function cityCardText(snap: GroupSnapshotDTO, groupTitle: string): string {
  return [
    `🏙 <b>شهرِ ${esc(groupTitle)}</b>`,
    emblem("🏙"),
    "",
    `${snap.weatherEmoji} ${snap.weatherLabel} · ${snap.moodEmoji} ${snap.moodLabel} · ${snap.stateLabel}`,
    `🌀 آشوب: ${pct(snap.chaos)} · ${snap.socialTempLabel}`,
    `💰 صندوق: ${chip(snap.treasury)} · 🏛 اعتبار: ${snap.reputationLabel}`,
  ].join("\n")
}

/** کارتِ /play — فهرستِ بازی‌ها (V14 Task 15b: صفحه‌بندی — 10 بازی در هر صفحه).
 *  V24: نشانِ 🎲 + مقدمه زیرِ نقل‌قول + ردیف‌های ▪. */
export function playCardText(games: { emoji: string; name: string; tagline: string; ok: boolean; why: string }[], page = 0): string {
  const perPage = 10
  const pageCount = Math.max(1, Math.ceil(games.length / perPage))
  const p = Math.max(0, Math.min(page, pageCount - 1))
  const slice = games.slice(p * perPage, p * perPage + perPage)
  return [
    "🎲 <b>بازی‌هایِ گروهی</b>",
    emblem("🎲"),
    "",
    quote("هر بازی داخلِ همین جهان اجرا می‌شود — با جایزه و عواقبِ واقعی."),
    "",
    ...slice.map((g) => `▪ ${g.emoji} <b>${g.name}</b> — ${g.tagline}${g.ok ? "" : ` <i>(${g.why})</i>`}`),
    ...(pageCount > 1 ? ["", `<i>صفحه‌ی ${p + 1} از ${pageCount} — ${chip(games.length)} بازی در شهرِ شماست.</i>`] : []),
  ].join("\n")
}

/** کارتِ /vote — رأیِ باز (fa-IR-u-nu-latn: ترتیبِ فارسی، رقمِ انگلیسی).
 *  V20 (مأموریت §8.1/ممیتیز V20-۱۴): مهلت دیگر ساعتِ خام نیست — همان خطِ زنده‌ی
 *  «⏳ N دقیقه»ی ماجراهای V18 روی کارتِ رأی هم هست؛ بازیکن یک زبانِ واحد می‌بیند.
 *  V24: نشانِ 🗳 + ردیف‌های ▪ + خطِ مهلتِ زنده زیرِ بلوکِ نقل‌قولی (هم‌زبانِ events). */
export function voteCardText(v: { subject: string; options: { label: string; count: number }[]; closesAt: string }): string {
  const total = v.options.reduce((s, o) => s + o.count, 0)
  const mins = Math.ceil((new Date(v.closesAt).getTime() - Date.now()) / 60000)
  const windowBlock = mins > 0 ? `\n${quote(`⏳ ${chip(mins)} دقیقه وقت داری.`)}` : ""
  // V26 — هر گزینه نوارِ سهمِ خودش را دارد: رأیِ باز دیگر فقط عدد نیست؛
  // وزنِ نسبی‌اش هم‌زمان با لمس دیده می‌شود (آینه‌ی barRowِ بقیه‌ی کارت‌های شهر)
  const rows = v.options
    .map((o) => {
      const share = total > 0 ? (o.count / total) * 100 : 0
      return `▪ ${esc(o.label)} ${bar(share)} ${pct(share)} · ${chip(o.count)} رأی`
    })
    .join("\n")
  return `🗳 <b>${esc(v.subject)}</b>\n${emblem("🗳")}\n\n${rows}\n👥 مجموع: ${chip(total)} رأی${windowBlock}\n\n<i>مهلت: تا ${new Date(v.closesAt).toLocaleTimeString("fa-IR-u-nu-latn")}</i>`
}

/** کارتِ /projects — پروژه‌های عمرانی؛ پیشرفتِ در حالِ ساخت با pct.
 *  V24: نشانِ 🏗 + مقدمه زیرِ نقل‌قول + ردیف‌های ▪. */
export function projectsCardText(menu: { status: string; emoji: string; name: string; pct: number }[]): string {
  return [
    "🏗 <b>پروژه‌هایِ عمرانیِ شهر</b>",
    emblem("🏗"),
    "",
    quote("هر پروژه با کمکِ داوطلبانه ساخته می‌شود و چیزِ تازه‌ای باز می‌کند."),
    "",
    ...menu.slice(0, 8).map((p) => {
      const status = p.status === "done" ? "✅" : p.status === "building" ? `🏗 ${pct(p.pct)}` : "▫️"
      return `▪ ${status} ${p.emoji} <b>${p.name}</b>`
    }),
  ].join("\n")
}

/** کارتِ /members — شهروندهای مهم؛ badge ذخیره‌شده HTML-safe بدون esc دوباره.
 *  V14 Task 15b: چیپِ هویتِ فمبوی (ایموجیِ کلاس + ✨×مرحله‌ی فرگشت + اکسسوار)
 *  کنارِ هر عضوی که فمبوی دارد — chips = playerId → چیپِ آماده.
 *  V24: نشانِ 🏘 + ردیف‌های ▪. */
export function membersCardText(members: { playerId?: string; avatar: string; name: string; roleLabel: string | null; roleEmoji: string | null; title: string | null; onlineLabel: string }[], chips: Record<string, string> = {}): string {
  return [
    "🏘 <b>شهروندهایِ مهم</b>",
    emblem("🏘"),
    "",
    ...members.map((m) => {
      const badge = [m.roleLabel ? `${m.roleEmoji} ${m.roleLabel}` : null, m.title]
        .filter(Boolean)
        .join(" · ")
      const chip = (m.playerId && chips[m.playerId]) ? ` ${chips[m.playerId]}` : ""
      return `▪ ${m.avatar}${chip} <b>${esc(m.name)}</b>${badge ? ` — ${badge}` : ""} · ${m.onlineLabel}`
    }),
  ].join("\n")
}

/** کارتِ /history — ردیف‌های ذخیره‌شده HTML-safe بدون esc.
 *  V24: نشانِ 📜؛ هر ردیفِ روایت زیرِ نقل‌قول (هم‌زبانِ خبرنامه‌ی world.ts). */
export function historyCardText(history: { icon: string; text: string }[]): string {
  return [
    "📜 <b>تاریخچه‌ی شهر</b>",
    emblem("📜"),
    "",
    ...history.map((h) => quote(`${h.icon} ${h.text}`)),
  ].join("\n")
}

/** کارتِ /help (موجِ ۲) — حلقه‌ی واقعیِ بازی در ۵ گام، نه فهرستِ فرمان (§3.1).
 *  هر گام یک خط با فرمان‌های مونو؛ دکمه‌ها: راهنمای کامل + پی‌وی + خانه (router می‌سازد).
 *  V14 Task 15b: دکمه‌ی «📚 راهنمای کامل» (gh:m) از router.ts به کارت می‌چسبد —
 *  متنِ کارت همانِ فشرده می‌ماند (پروفایلِ اسپم تغییری نکرده).
 *  V16-4 — عنوان: «شهرِ گروه» (TERM.groupWorld؛ قبلاً «شهرِ گروهی»). */
export function helpCardText(): string {
  return [
    `🎀 <b>${TERM.groupWorld.label} FEMBOY WAR</b>`,
    emblem("🎀"),
    "",
    "این گروه خودش یک شهر است. حلقه‌ی بازی:",
    "",
    `1️⃣ فمبوی‌ات را در پی‌ویِ ربات بساز — بدونِ او فقط تماشاگری.`,
    `2️⃣ ${chip("رویدادها")} — اتفاقِ شهر را باز کن؛ انتخابِ خودت را روی کارتش بزن.`,
    `3️⃣ ${chip("رأی‌گیری")} · ${chip("پروژه‌ها")} — رأی بده، کمک کن، شهر را بساز.`,
    `4️⃣ ${chip("جنگ فمبوی")} — روی پیامِ رقیب reply بزن و دعوتش کن؛ جواب با دکمه‌های دعوت‌نامه.`,
    `5️⃣ شب‌ها استایل‌شو — فمبوی‌هایِ شهر روی صحنه؛ قضاوت با بیلدِ واقعی است.`,
    "",
    `بدونِ فرمان هم کار می‌کند: ${chip("منو")} · ${chip("وضعیت شهر")} · ${chip("بازیکن‌ها")} · ${chip("رویدادها")}`,
    "",
    DOTS,
    "",
    "<i>هر کنش عاقبتِ واقعی دارد: سکه، روحیه، آبرو. زندگیِ شخصی‌ات در پی‌ویِ ربات است.</i>",
  ].join("\n")
}
