// FEMBOY WAR — V13 موجِ ۲ (§3.1/§3.2): onboarding گروهی — کارتِ خوش‌آمدِ آگاه از کاراکتر.
//
// این گروه یک شهرِ بازی‌پذیر است، نه دفترچه‌ی فرمان. خوش‌آمدِ شهروندِ تازه دو چهره دارد:
//   a) بدونِ فمبویِ روح‌بسته — شهر را توضیح می‌دهد، اهمیتِ فمبوی را می‌گوید
//      («بدونِ فمبویِ روح‌بسته فقط تماشاگری») و دکمه‌ی url پی‌وی را می‌دهد.
//      ساختِ کاراکتر هرگز در گروه اتفاق نمی‌افتد (§4.3) — گروه فقط پل است.
//   b) با فمبوی — هویت (نامِ فمبوی/کلاس/سطح) + «خوش اومدی» + تیزرِ فعالیتِ جاری.
// در هر دو، ردیفِ دکمه‌های cit: (آبروی شروع) پایینِ کارت می‌ماند — بازیکن‌ها خوشش داشتند.
//
// عدمِ تکرار (§3.2): خوش‌آمد فقط وقتی صدا می‌شود که ردیفِ عضویت تازه ساخته شده باشد
// (همان پرچمِ presence.welcomeNewCitizen دیروز — isNew در registerMember).
//
// لایه‌ی متن (V11 «شیشه»): HTML — نام‌های پویا esc()، اعداد chip()؛ عنوانِ رویدادِ
// باز از render() ذخیره شده (HTML-safe) → بدونِ esc دوباره.

import { db } from "@/lib/db"
import type { GroupWorld, Player, Prisma } from "@prisma/client"
import { getClass } from "../content/classes"
import { esc, pushOutbox, bumpCulture } from "./domain"
import { SEP, chip } from "./text"
import { FEMBOY_START_URL } from "./challenges"

export type OnbDb = Prisma.TransactionClient

// ─── تیزرِ فعالیتِ جاری (یک خط) ────────────────────────────────────────────────

/** «الان چی می‌گذره؟» — یک خطِ HTML-safe از مهم‌ترین چیزِ بازِ شهر */
export async function currentActivityLine(dbx: OnbDb, groupId: string): Promise<string> {
  const [challenge, event, game, vote] = await Promise.all([
    dbx.groupChallenge.findFirst({ where: { groupId, status: "pending" }, include: { challenger: true, target: true } }),
    dbx.groupEvent.findFirst({ where: { groupId, status: "open" } }),
    dbx.gameSession.findFirst({ where: { groupId, status: "open" } }),
    dbx.groupVote.findFirst({ where: { groupId, status: "open" } }),
  ])
  if (challenge) {
    return `⚔️ دعوتِ دوئلِ ${esc(challenge.challenger.name)} به ${esc(challenge.target.name)} بی‌جواب مانده.`
  }
  if (event) return `💥 «${event.title}» منتظرِ انتخاب‌هاست.` // title ذخیره‌شده HTML-safe است
  if (game) return `🎲 یه بازیِ گروهی وسطِ میدان است.`
  if (vote) return `🗳 ${esc(vote.subject)} باز است.`
  return "شهر نفس می‌کشد. مخصوصاً اگر کسی کاری بکند."
}

// ─── کارت‌سازهای خالص (تست‌پذیر) ───────────────────────────────────────────────

/** هویتِ فمبوی برای کارت‌ها */
export interface FemboyIdentity {
  femboyName: string
  classEmoji: string
  className: string
  level: number
}

/** کارتِ خوش‌آمدِ بدونِ فمبوی — ۳-۴ خطِ شیشه‌ای + پلِ پی‌وی */
export function welcomeNoCharCardText(playerName: string, groupTitle: string, activityHtml: string): string {
  return [
    `🎀 <b>شهروندِ جدیدِ شناسایی شد</b>`,
    SEP,
    "",
    `<b>${esc(playerName)}</b> واردِ «${esc(groupTitle)}» شد.`,
    "",
    "این گروه خودش یک شهر است: اتفاق می‌افتد، رأی گرفته می‌شود، پروژه ساخته می‌شود، دوئل می‌شود — و همه‌اش عاقبتِ واقعی دارد.",
    "بدونِ فمبویِ روح‌بسته فقط تماشاگری؛ تماشاچی هم عزیز است، ولی شمشیر نمی‌گیرد.",
    "",
    `الان: ${activityHtml}`,
    "",
    "<i>ساختنِ فمبوی در پی‌ویِ ربات است — گروه صدایش را خواهد شنید.</i>",
  ].join("\n")
}

/** کارتِ خوش‌آمدِ دارایِ فمبوی — هویت + خوش‌آمد + تیزر */
export function welcomeHasCharCardText(playerName: string, groupTitle: string, id: FemboyIdentity, activityHtml: string): string {
  return [
    `🎀 <b>شهروندِ جدیدِ شناسایی شد</b>`,
    SEP,
    "",
    `<b>${esc(playerName)}</b> واردِ «${esc(groupTitle)}» شد.`,
    "",
    `${id.classEmoji} <b>${esc(id.femboyName)}</b> · ${esc(id.className)} · سطح ${chip(id.level)} — همراهِ اوست.`,
    "خوش اومدی به شهر. فمبویت این‌جا خانه دارد.",
    "",
    `الان: ${activityHtml}`,
  ].join("\n")
}

// ─── خوش‌آمد (delegate از presence.welcomeNewCitizen) ──────────────────────────

/** خوش‌آمدِ شهروندِ تازه — دو گونه بر اساسِ وجودِ فمبویِ روح‌بسته.
 *  dedup همانِ دیروز است: فقط از registerMemberِ عضوِ تازه صدا می‌شود. */
export async function welcome(group: GroupWorld, player: Player): Promise<void> {
  const char = await db.soulCharacter.findUnique({ where: { playerId: player.id } })
  const activity = await currentActivityLine(db, group.id)

  let text: string
  let buttons: { label: string; style: "primary" | "success" | "danger"; cb?: string; url?: string }[]
  if (char) {
    const cls = getClass(char.classKey)
    const id: FemboyIdentity = {
      femboyName: char.name,
      classEmoji: cls?.emoji ?? "✨",
      className: cls?.name ?? char.classKey,
      level: char.level,
    }
    text = welcomeHasCharCardText(player.name, group.title, id, activity)
    buttons = [
      { label: "💥 اتفاق‌ها", style: "danger", cb: "gm:event" },
      { label: "🏠 خانه‌ی شهر", style: "primary", cb: "gm:game" },
    ]
  } else {
    text = welcomeNoCharCardText(player.name, group.title, activity)
    buttons = [
      { label: "🎀 ساختنِ فمبوی", style: "success", url: FEMBOY_START_URL },
      { label: "🏠 خانه‌ی شهر", style: "primary", cb: "gm:game" },
    ]
  }

  // ردیفِ آبروی شروع — همان دکمه‌های cit: دیروز، پایینِ کارت (بازیکن‌ها خوششان آمد)
  buttons = [
    ...buttons,
    { label: "😇 بی‌گناه", style: "success", cb: `cit:${player.id}:innocent` },
    { label: "😈 مشکوک", style: "danger", cb: `cit:${player.id}:suspicious` },
    { label: "🤡 آشوبگر", style: "danger", cb: `cit:${player.id}:chaotic` },
    { label: "🕵️ مرموز", style: "primary", cb: `cit:${player.id}:mysterious` },
  ]

  await pushOutbox(group, { kind: "system", text, buttons, priority: 8 })
  await bumpCulture(db, group.id, { socialMsgs: 2 })
}
