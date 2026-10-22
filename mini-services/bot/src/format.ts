// FEMBOY WAR 🎀 — قالب‌بندی پیام‌ها (V11 — زبانِ بصریِ «شیشه»).
// فقط نمایش؛ هیچ منطق بازی اینجا نیست.
//
// قواعدِ زبانِ بصری:
//   • ارقام همه‌جا انگلیسی‌اند (faNum ← en-US؛ esc رقم‌های فارسی/عربیِ متنِ موتور را
//     هم به لاتین نرمال می‌کند تا هیچ ۱۲۳ فارسی به کاربر نرسد).
//   • اعدادِ کلیدی داخلِ <code> تراش می‌خورند (chip) — تلگرام کد را LTR و مونو
//     رندر می‌کند؛ یعنی 4,000 · 45% · 3W/1L · 60/100 همه‌جا ثابت و خوانا‌اند.
//   • فرمان‌ها با cmd() مونو می‌شوند: <code>/guide</code>.
//   • رازها و جایزه‌ها با spoiler() زیرِ پرده‌ی لمس‌و‌آشکا می‌روند (tg-spoiler).
//   • متن‌های بلندِ روایی با expand() جمع می‌شوند (blockquote expandable).
//   • سطرِ هدرِ هر کارت (V24 — زبانِ بصریِ ۲٫۰): «emoji عنوانِ بولد» + زیرعنوانِ
//     ایتالیک + نشانِ کارت emblem(«ایموجیِ خودِ کارت») ━━━ 🎀 ━━━؛ سطرهایِ وضعیتِ
//     دارایِ سقفِ واقعی نوار می‌گیرند (barRow)؛ زیربخش‌ها با SUB ─── یا DOTS · · ·
//     جدا می‌شوند؛ بینِ بلوک‌ها همیشه یک سطرِ خالی برای نفس‌کشیدن.
//   • علامتِ دلتا بعد از عدد داخلِ تراش می‌نشیند: <code>3,000+</code> — قاعده‌ی
//     مالیِ فارسی که در RTL هم درست دیده می‌شود.
//
// هر رشته‌ی پویا از esc() رد می‌شود تا HTML نشکند.

import type {
  ActionResponse,
  ActiveEventDTO,
  CatalogHouseDTO,
  CatalogResponse,
  CatalogVehicleDTO,
  CityNewsResponse,
  DeltaLine,
  GameSnapshot,
  GoalDTO,
  GuideResponse,
  MarketSnapshot,
  OpportunityDTO,
  OutcomeDTO,
  PlayerDTO,
  ProfileResponse,
} from "./api"

const en = new Intl.NumberFormat("en-US")

/** جداساز ثابتِ بخش‌های اصلی */
export const SEP = "━━━━━━━━━━━━━━━━━━━━━━"

/** جداساز نازکِ زیربخش‌ها */
export const SUB = "──────────────────"

/** جداسازِ هواییِ نقطه‌ای — بینِ آیتم‌های هم‌ردیف */
export const DOTS = "· · · · · · · · · ·"

// ─── V24 — زبانِ بصریِ ۲٫۰: نشانِ مرکز‌دار و نوارهایِ زنده ────────────────────

/** نشانِ کارت — تقسیم‌کننده با ایموجیِ خودِ کارت در مرکز:
 *  `━━━━━━━━━ 🎀 ━━━━━━━━━` — هر کارت هویتِ بصریِ خودش را می‌گیرد. */
export function emblem(emoji: string, width = 11): string {
  return `${"━".repeat(width)} ${emoji} ${"━".repeat(width)}`
}

/** سطرِ وضعیتِ نوارِدار — «❤️ روحیه ▓▓▓▓▓▓▓▓░░ <code>80%</code>»
 *  نوار همیشه ۱۰ سلول؛ chipText متنِ دلخواهِ تراش را می‌گیرد (۵/۹ برای مخزنی‌ها). */
export function barRow(
  emoji: string,
  label: string,
  value: number,
  max: number,
  chipText?: string,
): string {
  const p = max > 0 ? Math.round((value / max) * 100) : 0
  return `${emoji} ${label} ${bar(p)} ${chip(chipText ?? `${p}%`)}`
}

// ─── V16-3 — بینگو: آینهِ قواعدِ هزینه‌ی موتور (actions.ts gamble) ─────────────
// فقط برای صداقتِ نمایش: کدام شرط‌ها دکمه شوند و کارت چه چیزی را «نمی‌کشد»
// بگوید. قاعده‌ی واقعی همان‌جاست — clamp(stake, 50, min(5000, floor(money*0.3)))؛
// یعنی شرطِ ≤ سقف، عینِ عددِ روی دکمه اجرا می‌شود (پایین‌تر clamp نمی‌شود).

/** پله‌هایِ شرطِ بینگو — همان سه پله‌ی همیشگی */
export const BINGO_STAKES = [100, 500, 5000] as const
/** آستانه‌ی «گران» — واخواهی (تأییدِ دومرحله‌ای) می‌خواهد (مأموریت §6C) */
export const BINGO_CONFIRM_STAKE = 5000

/** سقفِ شرطِ الان — همان قاعده‌ی موتور: min(5000, 30% جیب) با کفِ 50 */
export function bingoCap(money: number): number {
  return Math.min(5000, Math.max(50, Math.floor(money * 0.3)))
}

/** شرط‌هایی که جیب واقعاً می‌کشد — عددِ دکمه = عددِ اجرا (بدون clampِ پنهان) */
export function affordableStakes(money: number): number[] {
  const cap = bingoCap(money)
  return BINGO_STAKES.filter((s) => s <= cap)
}

// ─── نرمال‌سازی رقم‌ها ────────────────────────────────────────────────────────

/** رقم‌های فارسی/عربی و جداکننده‌های عربیِ یک رشته → لاتینِ انگلیسی */
export function toLatinDigits(s: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹"
  const ar = "٠١٢٣٤٥٦٧٨٩"
  let out = ""
  for (const ch of s) {
    const f = fa.indexOf(ch)
    const a = ar.indexOf(ch)
    out += f >= 0 ? String(f) : a >= 0 ? String(a) : ch === "٬" ? "," : ch === "٫" ? "." : ch
  }
  return out
}

/** فرار از & < > برای متن‌های پویا (Telegram HTML) + نرمال‌سازی رقم‌ها به انگلیسی.
 *  هر متنی که از موتور می‌آید (حتی اسمِ بازیکن یا برچسبِ آرزو) از این‌جا رد می‌شود —
 *  یعنی هیچ رقمِ فارسی هرگز به کاربر نمی‌رسد. */
export function esc(s: string): string {
  return toLatinDigits(s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
}

/** عدد با جداکننده‌ی هزارگانِ انگلیسی: 4000 → 4,000
 *  (نامِ تاریخی faNum حفظ شده تا صدها محلِ فراخوانی دست‌نخورده بماند) */
export function faNum(n: number): string {
  return en.format(n)
}

// ─── تراش‌ها و موجوداتِ تلگرام ────────────────────────────────────────────────

/** تراشِ عددی/متنی مونو — تلگرام کد را LTR رندر می‌کند: <code>4,000</code> */
export function chip(v: number | string): string {
  return `<code>${typeof v === "number" ? faNum(v) : toLatinDigits(v)}</code>`
}

/** فرمانِ مونو — <code>/guide</code> · V13 §VI: فقط برای شناسه‌های فنی، نه تبلیغِ اسلش */
export function cmd(s: string): string {
  return `<code>${toLatinDigits(s)}</code>`
}

/** درصدِ تراش‌خورده — <code>45%</code> */
export function pct(n: number): string {
  return `<code>${Math.max(0, Math.min(100, Math.round(n)))}%</code>`
}

/** سِتِ هدرِ صفحه: ["", "emoji <b>عنوان</b>", "زیرعنوانِ ایتالیک؟", SEP] */
export function head(emoji: string, title: string, subtitle?: string): string[] {
  const out = ["", `${emoji} <b>${title}</b>`]
  if (subtitle) out.push(`<i>${subtitle}</i>`)
  out.push(SEP)
  return out
}

/** اسپویلر — دیده نمی‌شود تا کاربر لمسش کند (راز، جایزه، شانس…) */
export function spoiler(s: string): string {
  return `<tg-spoiler>${s}</tg-spoiler>`
}

/** نقل‌قولِ بازشدنی — متنِ بلند جمع می‌شود و با یک لمس باز می‌شود */
export function expand(s: string): string {
  return `<blockquote expandable>${s}</blockquote>`
}

/** نقل‌قولِ معمولی — حاشیه‌ی عمودیِ تلگرام */
export function quote(s: string): string {
  return `<blockquote>${s}</blockquote>`
}

/** نوار پیشرفت از بلوک‌های ▓ و ░ — ۴۵٪ → ▓▓▓▓▓░░░░░ */
export function bar(pct: number, width = 10): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  const filled = Math.round((p / 100) * width)
  return "▓".repeat(filled) + "░".repeat(width - filled)
}

/** بریدن متن بلند (برای دکمه/خط‌های کوتاه) — امن برای ایموجی */
export function clampText(s: string, max: number): string {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`
}

/** علامت ریسک فرصت بر اساس claimStyle */
export function riskMark(style: OpportunityDTO["claimStyle"]): string {
  if (style === "risky") return " · ⚠"
  if (style === "wild") return " · ⚠⚠"
  return ""
}

/** حالِ شکمِ حیوانِ کیف — سیر 😊 · در حدّ تأمین 😕 · گرسنه 🍽 */
export function hungerEmoji(hunger: number): string {
  if (hunger < 30) return "🍽"
  if (hunger < 60) return "😕"
  return "😊"
}

// ─── دلتاها ──────────────────────────────────────────────────────────────────

/** خطوط دلتا: «💰 <code>4,000+</code> سکه» — علامت بعد از عدد، قاعده‌ی فارسیِ مالی */
export function deltaLines(deltas: DeltaLine[]): string[] {
  return deltas
    .filter((d) => d.amount !== 0)
    .map((d) => {
      const sign = d.amount > 0 ? "+" : "−"
      return `${d.icon} <code>${faNum(Math.abs(d.amount))}${sign}</code> ${esc(d.label)}`
    })
}

// ─── پیشخوان / «زندگیِ من» ─────────────────────────────────────────────────────

/** پیام پیشخوانِ V11 — فمبوی اول، بعد بازیکن/جهان، بعد راهنما.
 *  خطِ هویتِ فمبوی از snapshot.femboy می‌آید و در /start و /menu و 🔙 پیشخوان یکسان است. */
export function homeText(opts: {
  name: string
  snapshot: GameSnapshot | null
  guide: GuideResponse | null
}): string {
  const { snapshot, guide } = opts
  const p = snapshot?.player ?? null
  const w = snapshot?.world ?? null
  const f = snapshot?.femboy ?? null
  const name = p?.name ?? opts.name

  const lines: string[] = ["🎀 <b>FEMBOY WAR</b>", "<i>خانه‌ی زندگی</i>", emblem("🎀"), ""]

  // V17-W2 (§4/§6، آینه‌ی پنلِ متمرکزِ مینی‌اپ): بازیکنِ پیش از پیمان یک صدایِ اصلی
  // می‌خواهد، نه یازده دکمه‌ی هم‌وزن. یک خطِ «قدمِ بعدی» بالای کارت — همان الگویِ
  // بنرِ هابِ فمبوی (V17-3) — فقط دکمه‌ای را تبلیغ می‌کند که همین کارت دارد (§16).
  const journeyStage = snapshot?.journey?.stage
  const preBound = journeyStage ? journeyStage === "new" || journeyStage === "awakened" : !f
  if (preBound) {
    lines.push(`🌱 <b>قدمِ بعدیِ تو:</b> پیمانِ فمبوی را ببند — دکمه‌ی «🎀 فمبویِ من» همین کارت است.`)
    lines.push("")
  }

  // فمبوی — هویتِ مرکزیِ بازیکن، اول از همه
  if (f) {
    const accPart = f.accessoryEmoji ? ` ${f.accessoryEmoji}` : ""
    lines.push(`👑 <b>فمبویِ تو: ${esc(f.name)}${accPart}</b>`)
    lines.push(
      `${f.classEmoji} ${esc(f.className)} · ${f.rank.emoji} ${esc(f.rank.name)} · سطح ${chip(f.level)}`,
    )
    if (f.mastery) {
      lines.push(`🎓 ${f.mastery.emoji} ${esc(f.mastery.label)} — تسلطِ سطحِ ${chip(f.mastery.level)}`)
    }
    lines.push("")
    lines.push(`${barRow("❤️", "روحیه", f.spirit, 100)} · ${f.condition.emoji} ${esc(f.condition.label)}`)
    lines.push(barRow("⚡", "استقامت", f.stamina, f.staminaMax, `${faNum(f.stamina)}/${faNum(f.staminaMax)}`))
    lines.push(`🤝 جنگ ${chip(`${faNum(f.wins)}W/${faNum(f.losses)}L`)}`)
    if (f.nextMilestone) {
      lines.push(`🎯 ${esc(clampText(f.nextMilestone, 90))}`)
    }
    if (f.skillPoints > 0) {
      lines.push(`✨ ${chip(f.skillPoints)} نقطه‌مهارتِ بی‌استفاده — با ${chip("پیمان فمبوی")} خرجشان کن`)
    }
  } else if (p) {
    lines.push(`👑 فمبوی نداری — ${chip("پیمان فمبوی")} را بگو و ببندش.`)
    lines.push("<i>شهر بدونِ او زندگی‌ات را جدی نمی‌گیرد.</i>")
  }

  lines.push("", DOTS, "")

  // بازیکن و جهان — V24: انرژی نوارِ خودش را می‌گیرد (تصمیمِ روزانه دیده می‌شود)
  const stage = guide?.stage ?? p?.stageBadge ?? null
  lines.push(`👤 <b>${esc(name)}</b>${stage ? ` · ${stage.emoji} ${esc(stage.name)}` : ""}`)
  if (p) {
    lines.push(
      `📍 ${p.districtEmoji} ${esc(p.districtName)} · روز ${chip(p.day)}${w ? ` · ${w.weatherEmoji} ${esc(w.weatherLabel)}` : ""}`,
    )
    lines.push(
      `💰 ${chip(p.money)} سکه${p.debt > 0 ? ` · 💳 ${chip(p.debt)} بدهی` : ""}`,
    )
    lines.push(`${barRow("⚡", "انرژی", p.energy, 100)} · 🌀 ${chip(p.chaos)} · ⭐ ${chip(p.fame)}`)
  }

  // راهنما — «الان چه کنم؟» زیرِ پرده‌ی نقل‌قول: صدایِ شهر با حاشیه‌ی خودش (V24)
  lines.push("", emblem("📌"), "")
  const guideLines: string[] = []
  if (guide) {
    guideLines.push(`📌 <b>الان:</b> ${esc(clampText(guide.headline, 120))}`)
    const dir = guide.direction
    if (dir) {
      guideLines.push(`🎯 <b>مسیرِ فعلی:</b> ${dir.emoji} ${esc(dir.name)}`)
      guideLines.push(`<i>${esc(clampText(dir.description, 80))}</i>`)
    } else {
      const g0 = guide.goals.find((g) => g.category === "immediate") ?? guide.goals[0]
      guideLines.push(
        g0
          ? `🎯 <b>مسیرِ فعلی:</b> ${g0.icon} ${esc(clampText(g0.title, 48))}`
          : `🎯 <b>مسیرِ فعلی:</b> هنوز مسیر نساخته‌ای — ${chip("قدمِ بعدی")}`,
      )
    }
    const top = guide.opportunities[0]
    guideLines.push(
      top
        ? `⚡ <b>فرصت:</b> ${top.icon} ${esc(clampText(top.title, 48))} · ⏳ ${chip(top.minutesLeft)} دقیقه${riskMark(top.claimStyle)}`
        : `⚡ <b>فرصت:</b> فعلاً ساکت است…`,
    )
  } else if (p && w) {
    // موتور V4 هنوز guide ندارد — نمای ساده‌تر از snapshot
    const now = snapshot?.activeEvent
      ? `${snapshot.activeEvent.emoji} ${esc(clampText(snapshot.activeEvent.title, 60))}`
      : w.globalEvent
        ? `${w.globalEvent.emoji} ${esc(w.globalEvent.name)}`
        : "شهر نفس تازه می‌کند…"
    guideLines.push(`📌 <b>الان:</b> ${now}`)
    guideLines.push(`🎯 <b>مسیرِ فعلی:</b> هنوز مسیر نساخته‌ای — ${chip("قدمِ بعدی")} را بپرس.`)
    guideLines.push(`⚡ <b>فرصت:</b> فعلاً ساکت است…`)
  }
  if (guideLines.length > 0) lines.push(quote(guideLines.join("\n")))
  return lines.join("\n")
}

// ─── ⚡ فعالیت‌ها (V20 — مقصدِ «انجامِ کارِ مفید»: کار/استراحت/سفر/شغل) ───────────

/** کارتِ فعالیت‌ها — مأموریت §4.2: قبل از کنش، هزینه‌ها روشن است؛ بعد از کنش،
 *  نتیجه از outcomeShow می‌آید. این‌جا فقط «چه چیزی، چه هزینه‌ای» را می‌گوییم:
 *  انرژی/شغل/جیب وضعیتِ فعلی و هر کنش یک خطِ صادقانه دارد. */
export function activitiesText(snapshot: GameSnapshot): string {
  const p = snapshot.player
  // V24 — نشانِ کارت: ⚡ خودِ کارت؛ انرژی نوارِ زنده می‌گیرد (قیدِ موتور: 0..100)
  const lines: string[] = [
    "⚡ <b>فعالیت‌ها</b>",
    "<i>کار، استراحت، سفر و شغل — با هزینه‌ی روشنِ هر کدام</i>",
    emblem("⚡"),
    "",
  ]
  // وضعیتِ فعلی — همان چیزی که برای انتخاب لازم است (§3.1: «کجایم؟»)
  lines.push(`👤 ${esc(p.name)} · 💰 ${chip(p.money)} سکه`)
  lines.push(barRow("⚡", "انرژی", p.energy, 100))
  if (p.debt > 0) {
    lines.push(`💳 بدهی: ${chip(p.debt)} سکه — شیفتِ کار پول می‌آورد`)
  }
  if (p.job) {
    lines.push(`💼 شغلِ فعلی: ${p.job.emoji} ${esc(p.job.name)}`)
  } else {
    lines.push(`💼 شغلی نداری — «شغل‌ها» را ببین یا شیفتِ بی‌شغلی بزن`)
  }
  lines.push("", SUB, "", "هر کدام را همین‌جا انجام بده:", "")
  lines.push(`💼 <b>شیفتِ کار</b> — پول می‌آورد؛ انرژی می‌برد`)
  lines.push(`😴 <b>استراحت</b> — انرژی را پر می‌کند؛ وقت می‌برد`)
  lines.push(`🗺 <b>سفرِ بین محله‌ها</b> — هر محله اتفاقاتِ خودش را دارد`)
  lines.push(`💼 <b>شغل‌ها</b> — عوضش کن (شرطِ سطح دارد)؛ بی‌کاری هم انتخاب است`)
  return lines.join("\n")
}

// ─── 🎯 قدمِ بعدی (برچسبِ قاعده‌مند — قبلاً «راهنمای من») ───────────────────────

/** نمای قدمِ بعدی: چه خبر شده / الان چه کنم / در حال ساختنِ چی / فرصت‌ها / آرزوها
 *  (V16-3: فرصت‌ها و آرزوها بخشِ همین کارت‌اند — دکمه‌ی سطحِ خانه نیستند). */
export function guideText(g: GuideResponse): string {
  const lines: string[] = ["🎯 <b>قدمِ بعدی</b>", "<i>شهر چه می‌گوید و تو الان چه می‌کنی</i>", emblem("🎯"), ""]

  lines.push("📰 <b>چه خبر شده؟</b>")
  // V24 — صدایِ شهر با حاشیه‌ی نقل‌قولِ خودش (همان زبانِ هاب)
  lines.push(quote(esc(clampText(g.headline, 140))))
  if (g.whatsHappening.trim()) {
    lines.push(expand(`<i>${esc(clampText(g.whatsHappening, 320))}</i>`))
  }

  lines.push("", "🎯 <b>الان چه کنم؟</b>", "")
  if (g.nextActions.length === 0) {
    lines.push(quote("<i>راهنما فعلاً ساکت است… خودت انتخاب کن؛ این هم زندگی است.</i>"))
  } else {
    for (const [i, na] of g.nextActions.slice(0, 5).entries()) {
      lines.push(`${chip(i + 1)}. ${na.icon} <b>${esc(clampText(na.title, 48))}</b>`)
      lines.push(`<i>${esc(clampText(na.reason, 100))}</i>`)
      lines.push("")
    }
    if (g.nextActions.length > 5) {
      lines.push(`<i>… و ${chip(g.nextActions.length - 5)} پیشنهادِ دیگر</i>`)
    }
  }

  lines.push("🏗 <b>در حال ساختنِ چی؟</b>", "")
  if (g.goals.length === 0) {
    lines.push(quote("<i>هنوز هدفی انتخاب نکرده‌ای. قدم بزن؛ شهر هدف می‌سازد.</i>"))
  } else {
    for (const goal of g.goals.slice(0, 4)) {
      lines.push(`${goal.icon} <b>${esc(clampText(goal.title, 44))}</b>`)
      lines.push(`${bar(goal.progressPct)} ${pct(goal.progressPct)} · ${esc(clampText(goal.progressLabel, 60))}`)
      if (goal.rewardLabel) {
        lines.push(`🎁 ${spoiler(esc(clampText(goal.rewardLabel, 60)))}`)
      }
      lines.push("")
    }
    if (g.goals.length > 4) {
      lines.push(`<i>… و ${chip(g.goals.length - 4)} هدفِ دیگر</i>`)
    }
  }

  lines.push("⚡ <b>فرصت‌ها</b>", "")
  if (g.opportunities.length === 0) {
    lines.push(quote("<i>فعلاً ساکت است…</i>"))
  } else {
    for (const o of g.opportunities.slice(0, 4)) {
      lines.push(`${o.icon} <b>${esc(clampText(o.title, 44))}</b> · ⏳ ${chip(o.minutesLeft)} دقیقه`)
      lines.push(`<i>${spoiler(esc(clampText(o.rewardPreview, 70)))}${riskMark(o.claimStyle)}</i>`)
      lines.push("")
    }
    if (g.opportunities.length > 4) {
      lines.push(`<i>… و ${chip(g.opportunities.length - 4)} فرصتِ دیگر</i>`)
    }
  }

  // V16-3 — آرزوها هم بخشِ کارتِ «قدمِ بعدی» است (ممیزی ⑨: از هویِ خانه آمد بیرون)
  lines.push("✨ <b>آرزوها</b>", "")
  if (g.aspirations.length === 0) {
    lines.push(quote("<i>آرزوهایت هنوز خواب‌اند…</i>"))
  } else {
    for (const a of g.aspirations.slice(0, 3)) {
      lines.push(`${a.emoji} <b>${esc(clampText(a.name, 40))}</b> — ${pct(a.progressPct)} ${bar(a.progressPct, 8)}`)
    }
    if (g.aspirations.length > 3) {
      lines.push("", `<i>… و ${chip(g.aspirations.length - 3)} آرزوی دیگر — دکمه‌ی «✨ آرزوها» پایین کارت است</i>`)
    }
  }
  return lines.join("\n").trim()
}

// ─── 🎯 اهداف ────────────────────────────────────────────────────────────────

const GOAL_CAT: Record<GoalDTO["category"], string> = {
  immediate: "همین حالا",
  short: "کوتاه‌مدت",
  medium: "میان‌مدت",
  long: "درازمدت",
}

/** فهرست کامل اهداف با نوار پیشرفت */
export function goalsText(g: GuideResponse): string {
  const lines: string[] = ["🎯 <b>اهداف</b>", "<i>آنچه شهر برایت ساخته — تا آخرین قدم</i>", emblem("🎯"), ""]
  if (g.goals.length === 0) {
    lines.push("هنوز هدفی نداری.")
    lines.push("", quote("<i>یک قدم بزن؛ شهر برایت هدف می‌سازد.</i>"))
    return lines.join("\n")
  }
  const order: GoalDTO["category"][] = ["immediate", "short", "medium", "long"]
  for (const cat of order) {
    const items = g.goals.filter((x) => x.category === cat)
    if (items.length === 0) continue
    lines.push(`— <b>${GOAL_CAT[cat]}</b>`, "")
    for (const goal of items) {
      lines.push(`${goal.icon} <b>${esc(clampText(goal.title, 48))}</b>`)
      lines.push(`${bar(goal.progressPct)} ${pct(goal.progressPct)}`)
      lines.push(`<i>${esc(clampText(goal.progressLabel, 64))}</i>`)
      if (goal.rewardLabel) lines.push(`🎁 ${spoiler(esc(clampText(goal.rewardLabel, 64)))}`)
      lines.push("")
    }
  }
  return lines.join("\n").trim()
}

// ─── ⚡ فرصت‌ها ───────────────────────────────────────────────────────────────

/** فهرست فرصت‌ها با پیش‌نمایشِ پاداشِ زیرِ پرده و نشانه‌ی ریسک */
export function opsText(g: GuideResponse): string {
  const lines: string[] = ["⚡ <b>فرصت‌ها</b>", "<i>شهر همین حالا حرف می‌زند — هر کدام ضرب‌الاجل دارد</i>", emblem("⚡"), ""]
  if (g.opportunities.length === 0) {
    lines.push("فعلاً هیچ فرصتی نیست.")
    lines.push("", quote("<i>شهر ساکت است — ولی نه برای همیشه…</i>"))
    return lines.join("\n")
  }
  g.opportunities.slice(0, 6).forEach((o, i) => {
    if (i > 0) lines.push("", DOTS, "")
    lines.push(`${o.icon} <b>${esc(clampText(o.title, 52))}</b>${riskMark(o.claimStyle)}`)
    // V24 — شرحِ فرصت، صدایِ شهر است: با حاشیه‌ی نقل‌قول
    lines.push(quote(`<i>${esc(clampText(o.description, 160))}</i>`))
    lines.push(`🪙 ${esc(o.sourceLabel)} · ⏳ ${chip(o.minutesLeft)} دقیقه`)
    lines.push(`🎁 ${spoiler(esc(clampText(o.rewardPreview, 90)))}`)
  })
  if (g.opportunities.length > 6) {
    lines.push("", `<i>… و ${chip(g.opportunities.length - 6)} فرصتِ دیگر</i>`)
  }
  return lines.join("\n")
}

// ─── ✨ آرزوها ───────────────────────────────────────────────────────────────

/** هر ۱۰ آرزو: ایموجی، نوار، مرحله‌ی فعلی و لقبِ پایان راه */
export function dreamsText(g: GuideResponse): string {
  const lines: string[] = ["✨ <b>آرزوها</b>", "<i>مسیرهای بلندِ زندگی‌ات — قدم‌به‌قدم</i>", emblem("✨"), ""]
  if (g.aspirations.length === 0) {
    lines.push("<i>آرزوهایت هنوز خواب‌اند…</i>")
    lines.push("", quote(`<i>با ${chip("قدمِ بعدی")} بیدارشان کن.</i>`))
    return lines.join("\n")
  }
  for (const a of g.aspirations) {
    lines.push(`${a.emoji} <b>${esc(clampText(a.name, 44))}</b> — ${pct(a.progressPct)}`)
    lines.push(bar(a.progressPct))
    lines.push(`🏁 ${esc(clampText(a.milestoneLabel, 64))} ${chip(`${faNum(a.milestonesDone)}/${faNum(a.milestonesTotal)}`)}`)
    if (a.titleReward) lines.push(`🏷 لقبِ پایانِ راه: ${spoiler(esc(clampText(a.titleReward, 64)))}`)
    lines.push("")
  }
  return lines.join("\n").trim()
}

// ─── 👤 من ۲.۰ ───────────────────────────────────────────────────────────────

/** پروفایل ۲.۰ — ترکیبِ ProfileResponse موتور + زمینه‌های V4 از guide */
export function profileText(p: ProfileResponse, g: GuideResponse | null): string {
  const pl = p.player
  const lines: string[] = [`👤 <b>${esc(pl.name)}</b> — سطح ${chip(pl.level)}`, "<i>کارنامه‌ی تو در این شهر</i>"]
  // V17-W2 (§12): سیمِ XP که V17-1 وصل کرد حالا دیده هم می‌شود — «چقدر تا سطحِ بعد».
  // همین نوار در مینی‌اپ (MeScreen) هست؛ §11: یک حقیقت، یک زبان، همه‌ی سطح‌ها.
  // V24 — نوارِ زنده‌ی XP: مقدار/سقف در تراشِ خودش، نوار در میانِ سطر
  if (pl.xp !== undefined && pl.xpToNext !== undefined && pl.xpToNext > 0) {
    lines.push(
      barRow("✨", `تا سطحِ ${chip(faNum(pl.level + 1))}`, pl.xp, pl.xpToNext, `${faNum(pl.xp)}/${faNum(pl.xpToNext)}`),
    )
  }
  lines.push(emblem("👤"), "")

  if (g) {
    const st = g.stage
    const nextPart = st.nextName
      ? ` — بعدی: ${esc(st.nextName)} ${pct(st.progressPct)} ${bar(st.progressPct, 6)}`
      : ""
    lines.push(`🎩 جایگاه: ${st.emoji} <b>${esc(st.name)}</b>${nextPart}`)
    lines.push(`💎 ${esc(g.status.wealthLabel)} · ⭐ ${esc(g.status.fameLabel)}`)
    lines.push(`🌀 ${esc(g.status.chaosLabel)} · ⚠ ${esc(g.status.riskLabel)}`)
    if (g.direction) {
      lines.push(`🧭 مسیر: ${g.direction.emoji} ${esc(g.direction.name)}`)
      lines.push(`<i>${esc(clampText(g.direction.description, 80))}</i>`)
    }
  } else if (pl.stageBadge) {
    lines.push(`🎩 جایگاه: ${pl.stageBadge.emoji} ${esc(pl.stageBadge.name)}`)
  }

  if (g && g.aspirations.length > 0) {
    const top3 = [...g.aspirations].sort((a, b) => b.progressPct - a.progressPct).slice(0, 3)
    lines.push("", SUB, "", "✨ <b>آرزوهای نزدیک:</b>", "")
    for (const a of top3) {
      lines.push(`${a.emoji} ${esc(clampText(a.name, 32))} — ${bar(a.progressPct, 8)} ${pct(a.progressPct)}`)
    }
  }

  lines.push("", SEP, "")
  const assets = [
    pl.house ? `${pl.house.emoji} ${esc(pl.house.name)}` : "🏠 بی‌خانمان",
    pl.job ? `${pl.job.emoji} ${esc(pl.job.name)}` : "💼 بیکار",
    pl.vehicle ? `${pl.vehicle.emoji} ${esc(pl.vehicle.name)}` : "🚶 پیاده",
  ]
  lines.push(assets.join(" · "))
  // V24 — انرژی نوارِ خودش را می‌گیرد (قیدِ موتور: 0..100)؛ جیب و محله چیپ می‌مانند
  lines.push(`📍 ${pl.districtEmoji} ${esc(pl.districtName)} · 💰 ${chip(pl.money)} سکه`)
  lines.push(barRow("⚡", "انرژی", pl.energy, 100))
  // V17-W3 (W3-F4) — پیوستگیِ کار (پاداشِ تا +۳۰٪ دستمزد) — همان چیزی که نتیجه‌ی
  // شیفت می‌گوید حالا در پروفایل هم دیده می‌شود؛ §11: یک حقیقت، یک زبان، همه‌ی سطح‌ها.
  if (pl.workStreak !== undefined && pl.workStreak > 0 && pl.job) {
    const pct = Math.min(30, pl.workStreak * 3)
    lines.push(
      pct >= 30
        ? `🔥 پیوستگیِ کار: ${chip(faNum(pl.workStreak))} شیفت — پاداشِ کاملِ دستمزد (+${chip(30)}٪)`
        : `🔥 پیوستگیِ کار: ${chip(faNum(pl.workStreak))} شیفت — شیفتِ بعد ${chip(faNum(pct))}٪ دستمزدِ بیشتر`,
    )
  }
  if (pl.debt > 0) {
    lines.push(`💳 <b>بدهی:</b> ${chip(pl.debt)} سکه — به دایی فرهاد. <i>سودش جمع می‌شود.</i>`)
  }

  // V16-4 (ممیزی ⑪) — نوارِ دستاوردها: N از M + آخرین‌ها — دستاورد دیگر فقطِ
  // مینی‌اپ نیست؛ همین کارت دکمه‌ی «🏆 دستاوردها» دارد، قوانین‌شان در کدکسِ راهنماست.
  if (pl.achievements.length > 0 || p.achievementsTotal) {
    const n = pl.achievements.length
    const m = p.achievementsTotal
    const head = m ? `${chip(faNum(n))} از ${chip(faNum(m))}` : chip(faNum(n))
    lines.push("", `🏆 <b>دستاوردها:</b> ${head}`)
    const latest = latestAchievements(pl.achievements, 4)
    if (latest.length > 0) {
      lines.push(`آخرین: ${latest.map((a) => `${a.emoji} ${esc(clampText(a.name, 24))}`).join(" · ")}`)
    }
  }

  if (p.story.length > 0) {
    lines.push("", expand(p.story.slice(0, 2).map((s) => esc(clampText(s, 130))).join("\n")))
    if (p.story.length > 2) {
      lines.push(`<i>… و ${chip(p.story.length - 2)} فصلِ دیگر</i>`)
    }
  }
  return lines.join("\n")
}

// ─── 🏆 دستاوردها (V16-4 — ممیزی ⑪: فقطِ مینی‌اپ نبودنِ دستاوردها) ────────────

/** آخرینِ دستاوردها — با unlockedAt (فیلدِ افزایشیِ V16-4) newest-first؛
 *  موتورِ قدیمی که timestamp نمی‌فرستد → همان ترتیبِ ردیف‌های DTO */
export function latestAchievements(
  achievements: { key: string; name: string; emoji: string; description: string; unlockedAt?: string }[],
  take: number,
): typeof achievements {
  const sorted = [...achievements].sort((a, b) => {
    const ta = a.unlockedAt ? Date.parse(a.unlockedAt) : 0
    const tb = b.unlockedAt ? Date.parse(b.unlockedAt) : 0
    return tb - ta
  })
  return sorted.slice(0, take)
}

/** کارتِ «🏆 دستاوردها» — شمارِ باز‌شده از کل + آخرین‌ها + خطِ قفل‌مانده‌ها.
 *  DTO فقطِ باز‌شده‌ها را دارد (رشته‌ی قفل‌مانده‌ی تک‌تک مالِ مینی‌اپ است که
 *  رجیستری را باندل دارد؛ این‌جا شمارشِ صادقانه کافی است — قواعد در کدکسِ راهنما). */
export function achievementsText(p: ProfileResponse): string {
  const pl = p.player
  const n = pl.achievements.length
  const m = p.achievementsTotal
  const lines: string[] = [
    "🏆 <b>دستاوردها</b>",
    "<i>افتخارهایی که شهر برایت نگه داشته</i>",
    emblem("🏆"),
    "",
    m ? `${chip(faNum(n))} از ${chip(faNum(m))} باز شده` : `${chip(faNum(n))} دستاوردِ باز شده`,
  ]
  // V24 — نوارِ کامل‌شدنِ تالار: N از M حالا دیده می‌شود، نه فقط خوانده
  if (m && m > 0) {
    lines.push(`${bar((n / m) * 100)} ${pct((n / m) * 100)}`)
  }
  lines.push("")
  if (n === 0) {
    lines.push("<i>هنوز هیچ افتخاری نگرفته‌ای.</i>")
    lines.push("", quote("<i>شهر کسی را فراموش نمی‌کند که چیزی انجام داده باشد.</i>"))
  } else {
    lines.push("آخرین‌ها:", "")
    for (const a of latestAchievements(pl.achievements, 8)) {
      lines.push(`${a.emoji} <b>${esc(clampText(a.name, 36))}</b>`)
      lines.push(`<i>${esc(clampText(a.description, 90))}</i>`)
    }
    if (n > 8) {
      lines.push("", `<i>… و ${chip(n - 8)} دستاوردِ دیگر</i>`)
    }
    if (m && m > n) {
      lines.push("", SUB, "", `${chip(m - n)} قفل مانده — با زندگیِ شهر باز می‌شوند.`)
    }
  }
  lines.push("", SUB, "", `قواعد و 5 مخفی‌شان: ${chip("راهنما")} ← دسته‌ی ${chip("مأموریت‌ها و دستاوردها")}`)
  return lines.join("\n")
}

// ─── اتفاق / نتیجه / عملیات ──────────────────────────────────────────────────

/** پیام اتفاق — متنِ اتفاق داخلِ نقل‌قول؛ بلند بود، زیرِ پرده‌ی بازشدن جمع می‌شود */
export function eventText(e: ActiveEventDTO): string {
  const body = e.text.length > 800 ? `${e.text.slice(0, 797)}…` : e.text
  const chain = e.isChainStep ? ` · قسمت ${chip(e.chainStep)}` : ""
  const q = e.text.length > 380 ? expand(esc(body)) : quote(esc(body))
  return [
    `${e.emoji} <b>${esc(e.title)}</b>`,
    `<i>${esc(e.rarityLabel)} · ${esc(e.categoryLabel)}${chain}</i>`,
    emblem(e.emoji),
    "",
    q,
  ].join("\n")
}

/** پیام نتیجه‌ی انتخاب — دلتاها با تراشِ عددی؛ یادداشت‌های NPC داخلِ نقل‌قول */
export function outcomeText(o: OutcomeDTO): string {
  const bad = o.deltas.filter((d) => d.tone === "bad").length
  const good = o.deltas.filter((d) => d.tone === "good").length
  const head = bad > good ? "💫" : "✅"

  const lines: string[] = [`${head} <b>${esc(o.text)}</b>`, emblem(head), ""]
  lines.push(...deltaLines(o.deltas))

  // فمبوی — XPِ این تجربه‌ی شهری (اگر پیمان بسته باشد)
  if (o.femboyXp) {
    const fx = o.femboyXp
    lines.push("", `🎀 ${esc(fx.name)} ${fx.trackIcon} <code>${faNum(fx.amount)}+</code> XPِ ${esc(fx.trackLabel)}`)
    for (const l of fx.levelUps) {
      const n = Number(l)
      lines.push(`⭐ فمبویِ تو قوی‌تر شد — سطح ${Number.isFinite(n) ? chip(n) : chip(esc(l))}`)
    }
  }

  if (o.grantedItems.length > 0) {
    lines.push("", `🎁 گرفتی: ${o.grantedItems.map((i) => `${i.emoji} <b>${esc(i.name)}</b>`).join(" · ")}`)
  }
  if (o.grantedPet) {
    lines.push("", `🐾 یه حیوانِ دست‌آموز پیدا شد: ${o.grantedPet.emoji} <b>${esc(o.grantedPet.name)}</b> <i>(${esc(o.grantedPet.rarityLabel)})</i>`)
  }
  if (o.grantedTitles.length > 0) {
    lines.push("", ...o.grantedTitles.map((t) => `🏷 لقبِ تازه: <b>${esc(t)}</b>`))
  }
  if (o.grantedAchievements.length > 0) {
    lines.push("", ...o.grantedAchievements.map((a) => `🏆 افتخارِ تازه: <b>${esc(a)}</b>`))
  }
  if (o.npcNotes.length > 0) {
    lines.push("", ...o.npcNotes.map((n) => quote(`💬 ${esc(clampText(n, 160))}`)))
  }
  return lines.join("\n")
}

/** پیام کار/سفر/استراحت/فرصت: «✅ {message}\n{flavor}\n{deltas}» */
export function actionText(res: ActionResponse): string {
  // V24 — کارتِ لحظه هم نشانِ خودش را دارد؛ طعمِ کار در نقل‌قول
  const lines: string[] = [`✅ <b>${esc(res.message)}</b>`, emblem("✅")]
  if (res.flavor) lines.push("", quote(`<i>${esc(clampText(res.flavor, 200))}</i>`))
  if (res.deltas.some((d) => d.amount !== 0)) lines.push("", ...deltaLines(res.deltas))
  return lines.join("\n")
}

// ─── شهر (خصوصی) ─────────────────────────────────────────────────────────────

/** «🏙 شهر» — محله‌ی فعلی + هوا (نمای خصوصی با دکمه‌های سفر) */
export function cityText(s: GameSnapshot): string {
  const p = s.player
  // V24 — نشانِ 🏙؛ آشوبِ شهر نوارِ زنده می‌گیرد (قیدِ موتور: 0..100)
  return [
    "🏙 <b>شهر</b>",
    "<i>محله‌ی تو، هوای امروز و راه‌های رفتن</i>",
    emblem("🏙"),
    "",
    `📍 الان اینجایی: ${p.districtEmoji} <b>${esc(p.districtName)}</b>`,
    `${s.world.weatherEmoji} ${esc(s.world.weatherLabel)}`,
    barRow("🌀", "آشوبِ شهر", s.world.chaosLevel, 100),
    "",
    SUB,
    "",
    quote("<i>برای سفر، محله‌ی مقصد را از دکمه‌های پایین انتخاب کن.</i>"),
  ].join("\n")
}

// ─── شهرِ ما (گروه) ──────────────────────────────────────────────────────────

/** خبرنامه‌ی شهر — دیجست کامل برای /news (بدون بازیکن هم کار می‌کند).
 *  شایعه‌ها زیرِ اسپویلرند: لمس کن تا لو بروند. */
export function cityNewsText(cn: CityNewsResponse): string {
  const lines: string[] = [
    `🏙 <b>شهرِ ما</b> — روز ${chip(cn.dayCount)}`,
    "<i>نبضِ جمعیِ شهرِ گروه</i>",
    emblem("🏙"),
    "",
  ]
  lines.push(`${cn.weatherEmoji} ${esc(cn.weatherLabel)} · ${esc(cn.moodLabel)}`)
  // V24 — آشوب نوارِ زنده می‌گیرد (قیدِ موتور: 0..100)؛ اقتصاد شاخص است نه مخزن
  lines.push(barRow("🌀", "آشوب", cn.chaosLevel, 100))
  lines.push(`💹 اقتصادِ شهر: ${chip(cn.economyIndex)}`)
  if (cn.globalEvent) {
    lines.push(
      "",
      `${cn.globalEvent.emoji} <b>${esc(clampText(cn.globalEvent.name, 60))}</b>`,
      quote(`<i>${esc(clampText(cn.globalEvent.description, 160))}</i>`),
      `⏳ ${chip(cn.globalEvent.endsInMinutes)} دقیقه دیگر…`,
    )
  }
  if (cn.headlines.length > 0) {
    lines.push("", "📰 <b>خبرهای شهر:</b>", "")
    for (const h of cn.headlines.slice(0, 3)) {
      lines.push(quote(`${h.icon} ${esc(clampText(h.text, 170))}`))
    }
    if (cn.headlines.length > 3) {
      lines.push("", `<i>… و ${chip(cn.headlines.length - 3)} خبرِ دیگر</i>`)
    }
  }
  if (cn.rumors.length > 0) {
    lines.push("", `🗣 <b>شایعه‌ها</b> <i>— لمس کن تا لو بروند</i>`, "")
    for (const r of cn.rumors.slice(0, 3)) {
      lines.push(spoiler(`🗣 ${esc(clampText(r, 130))}`))
    }
    if (cn.rumors.length > 3) {
      lines.push("", `<i>… و ${chip(cn.rumors.length - 3)} شایعه‌ی دیگر</i>`)
    }
  }
  lines.push("", SEP, "")
  lines.push(`👥 ${chip(cn.population)} نفر این‌جا زندگی می‌کنند`)
  return lines.join("\n")
}

const MEDALS = ["🥇", "🥈", "🥉"] as const

/** برترین‌های شهر — /top */
export function topText(cn: CityNewsResponse): string {
  const lines: string[] = ["🏆 <b>مردمِ شهر — برترین‌ها</b>", "<i>اسم‌هایی که شهر حفظ کرده</i>", emblem("🏆"), ""]
  if (cn.topPlayers.length === 0) {
    lines.push("<i>هنوز کسی اسمی از خودش نگذاشته…</i>")
    lines.push("", quote("<i>اولین افسانه تو باش.</i>"))
    return lines.join("\n")
  }
  cn.topPlayers.slice(0, 5).forEach((p, i) => {
    const rank = i < 3 ? (MEDALS[i] ?? `${chip(i + 1)}.`) : `${chip(i + 1)}.`
    lines.push(`${rank} <b>${esc(clampText(p.name, 34))}</b> — سطح ${chip(p.level)}`)
    if (p.highlight) lines.push(`<i>${esc(clampText(p.highlight, 84))}</i>`)
    lines.push("")
  })
  if (cn.topPlayers.length > 5) {
    lines.push(`<i>… و ${chip(cn.topPlayers.length - 5)} نامِ دیگر</i>`)
  }
  return lines.join("\n").trim()
}

/** نوار فشرده‌ی وضعیت شهر — /status (کارت‌های قدیمی)
 *  V24 — نشانِ 🏙 در میانِ دو سطر: همان هویتِ بصری، بدونِ سنگینیِ کارت */
export function cityStatusText(cn: CityNewsResponse): string {
  const lines = [
    `🏙 روز ${chip(cn.dayCount)} · ${cn.weatherEmoji} ${esc(cn.weatherLabel)} · ${esc(cn.moodLabel)}`,
    emblem("🏙"),
    `🌀 ${chip(cn.chaosLevel)} · 💹 ${chip(cn.economyIndex)}`,
  ]
  if (cn.globalEvent) {
    lines.push(`${cn.globalEvent.emoji} ${esc(cn.globalEvent.name)} — ⏳ ${chip(cn.globalEvent.endsInMinutes)} دقیقه`)
  }
  return lines.join("\n")
}

// ─── کیف / تاریخچه ────────────────────────────────────────────────────────

/** شمارِ آیتم‌های هر صفحه‌ی کیف (V16-4، ممیزی ⑬: برشِ ۸تاییِ بالا فقط بود) */
export const BAG_PER_PAGE = 8

/** شمارِ صفحاتِ کیف از رویِ ردیف‌هایِ دارایِ موجودی */
export function bagPageCount(items: { quantity: number }[]): number {
  const live = items.filter((i) => i.quantity > 0).length
  return Math.max(1, Math.ceil(live / BAG_PER_PAGE))
}

/** «🎒 کیف» — آیتم‌های صفحه‌ی فعلی (V16-4: صفحه‌بندی، ممیزی ⑬) + حیوان‌ها.
 *  ترتیبِ آیتم‌ها همان ترتیبِ دکمه‌های عملیات زیر پیام است. */
export function bagText(p: ProfileResponse, prices: Map<string, number>, page = 0): string {
  const pl = p.player
  const live = [...p.inventory].filter((i) => i.quantity > 0).sort((a, b) => b.quantity - a.quantity)
  const pageCount = Math.max(1, Math.ceil(live.length / BAG_PER_PAGE))
  const safePage = Math.max(0, Math.min(page, pageCount - 1))
  const top = live.slice(safePage * BAG_PER_PAGE, safePage * BAG_PER_PAGE + BAG_PER_PAGE)
  const lines: string[] = [
    `🎒 <b>کیف</b>`,
    "<i>هرچه داری، همین‌جاست</i>",
    emblem("🎒"),
    "",
    `${chip(live.length)} آیتم · 💰 ${chip(pl.money)} سکه`,
    "",
  ]
  if (live.length === 0) {
    lines.push(quote("<i>کیفت خالیه. هنوز.</i>"))
    // V17-W3 (W3-F9) — بن‌بستِ شاعرانه حذف نشد، اما یک خطِ صادق هم آمد: چیزها از
    // کجا می‌آیند + دکمه‌ی «🎲 اتفاق امروز» زیر کارت — همان الگوی CTAی مینی‌اپ (§14/§15)
    lines.push("", "چیزها از <b>اتفاق‌ها</b>، <b>فرصت‌ها</b> و <b>بازار</b> می‌آیند — «🎲 اتفاق امروز» اولین‌شان است.")
  } else {
    for (const i of top) {
      const marks = [i.equipped ? "✅ تنِ توست" : null, i.favorite ? "⭐ علاقه‌مندی" : null].filter(Boolean).join(" · ")
      const price = prices.get(i.itemKey)
      const sellPart = i.tradable && !i.favorite && !i.locked && price ? ` · 💰 ${chip(price)}` : ""
      lines.push(`${i.emoji} <b>${esc(i.name)}</b> ${chip(`x${faNum(i.quantity)}`)}${marks ? ` · ${marks}` : ""}${sellPart}`)
    }
    if (pageCount > 1) {
      // چیپِ صفحه — رقمِ انگلیسی (قاعده‌ی V11)؛ جایگزینِ خطِ «… و N آیتمِ دیگر»
      lines.push("", `📖 صفحه‌ی ${chip(`${faNum(safePage + 1)}/${faNum(pageCount)}`)} · دکمه‌ی زیر پیام می‌چرخاند`)
    }
    lines.push("", `<i>عملیاتِ هر آیتم — به‌ترتیبِ همین فهرست — زیر پیام است.</i>`)
  }
  if (p.pets.length > 0) {
    lines.push("", SUB, "", "🐾 <b>حیوان‌هایت</b>", "")
    for (const pet of p.pets) {
      const warn = pet.hunger < 30 ? " — <b>گرسنه!</b>" : ""
      lines.push(`${pet.emoji} <b>${esc(pet.name)}</b> ${hungerEmoji(pet.hunger)} · ${esc(pet.moodLabel)}${warn}`)
    }
  }
  return lines.join("\n")
}

/** «📜 تاریخچه» — ۵ ردیفِ آخر + دنباله‌ی شمارشی */
export function historyText(p: ProfileResponse): string {
  const lines: string[] = ["📜 <b>تاریخچه</b>", "<i>چیزهایی که شهر درباره‌ات نوشته</i>", emblem("📜"), ""]
  if (p.history.length === 0) {
    lines.push("<i>هنوز چیزی ننوشته.</i>")
    lines.push("", quote("<i>این شهر درباره‌ات ساکت است.</i>"))
    return lines.join("\n")
  }
  // V24 — هر رویداد، ورودیِ دفترِ شهر است: با حاشیه‌ی نقل‌قولِ خودش
  for (const h of p.history.slice(0, 5)) {
    lines.push(quote(`${h.icon} ${esc(h.text)} · روز ${chip(h.day)}`))
  }
  if (p.history.length > 5) {
    lines.push("", `<i>… و ${chip(p.history.length - 5)} رویدادِ دیگر</i>`)
  }
  return lines.join("\n")
}

// ─── بدهی / عنوان‌ها / شغل‌ها / بازار / خبرها / بینگو ───────────────────────

/** 💳 بدهی — مبلغ + وضعیتِ جیب + بهای تعلل (نشانِ کارت: ⛓ زنجیرِ فرهاد) */
export function debtText(s: GameSnapshot): string {
  const p = s.player
  return [
    "💳 <b>بدهی</b>",
    "<i>حسابِ تو با دایی فرهاد</i>",
    emblem("⛓"),
    "",
    `دایی فرهاد صبور است: <b>${chip(p.debt)} سکه</b>`,
    `💰 کیفِ تو: ${chip(p.money)} سکه`,
    "",
    SUB,
    "",
    quote("<i>بدهی سود جمع می‌کند. فرهاد لبخند می‌زند؛ خیلی.</i>"),
  ].join("\n")
}

/** 🏷 عنوان‌ها — مالکیت‌ها + فعال ✅ */
export function titlesText(p: { activeTitle: string | null; titles: { key: string; name: string; emoji: string; description: string }[] }): string {
  const lines: string[] = ["🏷 <b>عنوان‌ها</b>", "<i>اسم‌هایی که کنارِ اسمت می‌نشینند</i>", emblem("🏷"), ""]
  if (p.titles.length === 0) {
    lines.push("هنوز هیچ عنوانی نگرفته‌ای.")
    lines.push("", quote("<i>شهر هنوز اسمی برای تو ندارد.</i>"))
    return lines.join("\n")
  }
  for (const t of p.titles.slice(0, 8)) {
    const active = t.key === p.activeTitle
    lines.push(`${t.emoji} <b>${esc(t.name)}</b>${active ? " ✅" : ""}`)
    lines.push(`<i>${esc(clampText(t.description, 80))}</i>`)
    lines.push("")
  }
  if (p.titles.length > 8) {
    lines.push(`<i>… و ${chip(p.titles.length - 8)} عنوانِ دیگر</i>`)
    lines.push("")
  }
  lines.push("<i>عنوانِ فعال کنار اسمت در شهر دیده می‌شود.</i>")
  return lines.join("\n")
}

/** 💼 شغل‌ها — کاتالوگ + شرایط + شغلِ فعلی */
export function jobsText(cat: CatalogResponse, p: { level: number; job: { key: string; name: string; emoji: string } | null }): string {
  const lines: string[] = ["💼 <b>شغل‌های شهر</b>", "<i>هر کدام شرط و دستمزدِ خودش را دارد</i>", emblem("💼"), ""]
  if (p.job) {
    lines.push(`الان: ${p.job.emoji} <b>${esc(p.job.name)}</b> · سطح ${chip(p.level)}`)
  } else {
    lines.push(`الان: <i>بی‌کاری</i> · سطح ${chip(p.level)}`)
  }
  lines.push("")
  for (const j of cat.jobs.slice(0, 9)) {
    const mine = p.job?.key === j.key
    const locked = p.level < j.minLevel
    const mark = mine ? " ✅" : locked ? " 🔒" : ""
    lines.push(`${j.emoji} <b>${esc(j.name)}</b>${mark}`)
    lines.push(`💰 ${chip(`${faNum(j.incomeMin)}-${faNum(j.incomeMax)}`)} سکه · ⚡ ${chip(j.energyCost)} · سطح ${chip(`${faNum(j.minLevel)}+`)}`)
    lines.push("")
  }
  if (cat.jobs.length > 9) {
    lines.push(`<i>… و ${chip(cat.jobs.length - 9)} شغلِ دیگر</i>`)
    lines.push("")
  }
  lines.push(quote("<i>🔒 یعنی سطحش را نداری؛ شهر هنوز به تو اعتماد نکرده.</i>"))
  return lines.join("\n")
}

// ─── 🏠 خانه و وسیله (V17-3 — ممیزی ⑨: هدفِ آموزش‌داده‌ی پروفایل سرانجام از
// خودِ ربات هم قابلِ خرید است؛ همان اکشن‌های buyHouse/buyVehicle موتور) ────────

/** آینه‌ی صداقتِ نمایشِ قیمتِ وسیله — همان قاعده‌ی موتور (actions.ts buyVehicle):
 *  round(basePrice × economyIndex / 100). خانه‌ها قیمتِ ثابت دارند. */
export function vehiclePriceOf(basePrice: number, economyIndex: number): number {
  return Math.max(0, Math.round(basePrice * (economyIndex / 100)))
}

/** کدام بخشِ لیست — خانه یا وسیله */
export type LivingWhich = "house" | "vehicle"

/** کارتِ «🏠 خانه و وسیله» — مالِ فعلی + فهرستِ قابلِ‌خرید با قیمتِ واقعی و
 *  یک‌خطِ شخصیت. قیمتِ وسیله با شاخصِ اقتصادِ همین لحظه زده می‌شود (آینه‌ی
 *  موتور)؛ کارتِ تأیید عددِ نهایی را دوباره صادقانه می‌گوید. */
export function livingText(opts: {
  which: LivingWhich
  player: PlayerDTO
  houses: CatalogHouseDTO[]
  vehicles: CatalogVehicleDTO[]
  economyIndex: number
}): string {
  const { which, player } = opts
  const lines: string[] = ["🏠 <b>خانه و وسیله</b>", "<i>سقفِ تو و راهِ رفتنت</i>", emblem("🏠"), ""]

  // مالِ فعلی — همان دو خطی که کارتِ «من» جمع‌وجور نشان می‌دهد
  const house = opts.houses.find((h) => h.key === (player.house?.key ?? "attic")) ?? null
  lines.push(
    `🛏 خانه: ${player.house ? `${player.house.emoji} <b>${esc(player.house.name)}</b>` : "بی‌خانمان"}` +
      (house ? ` · اجاره‌ی روزانه ${chip(house.rent)} سکه` : ""),
  )
  lines.push(
    `🚗 وسیله: ${player.vehicle ? `${player.vehicle.emoji} <b>${esc(player.vehicle.name)}</b>` : "🚶 پیاده"}`,
  )
  lines.push(`💰 جیبِ تو: ${chip(player.money)} سکه`)

  if (which === "house") {
    lines.push("", SUB, "", "🏠 <b>خانه‌های شهر</b> — قیمت‌ها واقعی‌اند:", "")
    const rest = opts.houses.filter((h) => h.key !== (player.house?.key ?? "attic"))
    if (rest.length === 0) {
      lines.push("<i>همه‌ی خانه‌های شهر را داری. شهر به تو تعظیم می‌کند.</i>")
    }
    for (const h of rest) {
      lines.push(`${h.emoji} <b>${esc(h.name)}</b> — ${chip(h.price)} سکه`)
      // V24 — شخصیتِ هر خانه، با حاشیه‌ی نقل‌قول
      lines.push(quote(`<i>${esc(clampText(h.description, 70))}</i>`))
      lines.push(`· اجاره‌ی روزانه ${chip(h.rent)} · آسایش ${chip(h.comfort)} · امنیت ${chip(h.security)}`)
      lines.push("")
    }
  } else {
    lines.push("", SUB, "", `🚗 <b>وسایل نقلیه‌ی شهر</b> — با شاخصِ اقتصادِ امروز (${chip(opts.economyIndex)}):`, "")
    const rest = opts.vehicles.filter((v) => v.key !== player.vehicle?.key)
    if (rest.length === 0) {
      lines.push("<i>وسیله‌ی بهتری از این در شهر نیست.</i>")
    }
    for (const v of rest) {
      lines.push(`${v.emoji} <b>${esc(v.name)}</b> — ${chip(vehiclePriceOf(v.basePrice, opts.economyIndex))} سکه`)
      // V24 — عادتِ هر وسیله، با حاشیه‌ی نقل‌قول
      lines.push(quote(`<i>${esc(clampText(v.quirk || v.description, 70))}</i>`))
      lines.push("")
    }
  }
  lines.push(quote("<i>خریدِ بزرگ است — قبل از ثبت، کارتِ تأیید قیمتِ نهایی را نشان می‌دهد.</i>"))
  return lines.join("\n")
}

/** کارتِ تأییدِ خرید (الگوی واخواهیِ بینگو): قیمتِ واقعی + جیب + هزینه‌ی پیوسته.
 *  جیبِ تازه‌خوانده‌شده — اگر در این فاصله کم آمد، دکمه‌ی خرید نمی‌آید (صادقانه). */
export function livingConfirmText(opts: {
  which: LivingWhich
  item: { name: string; emoji: string }
  price: number
  money: number
  /** هزینه/شخصیتِ پیوسته: اجاره‌ی روزانه‌ی خانه یا عادتِ وسیله */
  tail: string
}): string {
  const title = opts.which === "house" ? "خریدِ خانه" : "خریدِ وسیله"
  // V24 — کارتِ واخواهی هم نشانِ خودش را دارد؛ جمله‌ی پیوسته در نقل‌قول
  const lines = [
    `🏠 <b>${title}</b>`,
    "<i>واخواهیِ آخر قبل از امضای خرید</i>",
    emblem("🏠"),
    "",
    `${opts.item.emoji} <b>${esc(opts.item.name)}</b>`,
    `💵 قیمتِ واقعی: <b>${chip(opts.price)} سکه</b>`,
    `💰 جیبِ تو: ${chip(opts.money)} سکه`,
  ]
  if (opts.tail) lines.push(quote(`<i>${esc(opts.tail)}</i>`))
  lines.push("", SUB)
  return lines.join("\n")
}

/** 🏪 بازار — مغازه‌ی محله + آگهی‌های مردم + آگهی‌های خودِ تو (V16-4) + جیب */
export function marketText(m: MarketSnapshot): string {
  const shopAll = m.listings.filter((l) => l.sellerName === null && !l.mine && l.quantity > 0)
  const playersAll = m.listings.filter((l) => l.sellerName !== null && !l.mine && l.quantity > 0)
  const mine = m.listings.filter((l) => l.mine && l.quantity > 0)
  const shop = shopAll.slice(0, 6)
  const players = playersAll.slice(0, 6)
  // V24 — نشانِ کارت: 💰 (نقشِ بازار)؛ جیب بالای کارت، بعد از نشان
  const lines: string[] = [
    "🏪 <b>بازارِ شهر</b>",
    "<i>مغازه‌ی محله و آگهی‌های مردم — کنارِ هم</i>",
    emblem("💰"),
    "",
    `💰 کیفِ تو: ${chip(m.playerMoney)} سکه`,
  ]
  lines.push("", "🏬 <b>مغازه‌ی محله:</b>", "")
  if (shop.length === 0) {
    lines.push("<i>قفسه‌ها فعلاً خالی‌اند. بعداً بیا.</i>")
  } else {
    for (const l of shop) {
      lines.push(`${l.emoji} <b>${esc(l.name)}</b>${l.quantity > 1 ? ` ${chip(`x${faNum(l.quantity)}`)}` : ""} — ${chip(l.price)} سکه`)
    }
    if (shopAll.length > shop.length) {
      lines.push("", `<i>… و ${chip(shopAll.length - shop.length)} کالای دیگر</i>`)
    }
  }
  if (players.length > 0) {
    lines.push("", "📢 <b>آگهی‌های مردم:</b>", "")
    for (const l of players) {
      lines.push(`${l.emoji} <b>${esc(l.name)}</b> ${chip(`x${faNum(l.quantity)}`)} — ${chip(l.price)} سکه`)
      lines.push(`<i>فروشنده: ${esc(l.sellerName ?? "؟")}</i>`)
    }
    if (playersAll.length > players.length) {
      lines.push("", `<i>… و ${chip(playersAll.length - players.length)} آگهیِ دیگر</i>`)
    }
  }
  // V16-4 (ممیزی ⑪) — آگهی‌های خودم: فروش در بازار دیگر فقطِ مینی‌اپ نیست
  if (mine.length > 0) {
    lines.push("", "🛍 <b>آگهی‌های تو:</b>", "")
    for (const l of mine.slice(0, 3)) {
      lines.push(`${l.emoji} <b>${esc(l.name)}</b> ${chip(`x${faNum(l.quantity)}`)} — ${chip(l.price)} سکه`)
    }
    if (mine.length > 3) {
      lines.push(`<i>… و ${chip(mine.length - 3)} آگهیِ دیگرت</i>`)
    }
    lines.push(`<i>پس‌گرفتن: دکمه‌ی ${chip("برداشتن")} زیر همین پیام.</i>`)
  }
  lines.push("", SUB, "", quote("<i>قیمت‌ها مثلِ حرفِ مردم، مدام عوض می‌شوند.</i>"))
  return lines.join("\n")
}

// ─── 🛍 فروش در بازار (V16-4؛ V20: «فهرست‌کردن» → «به فروش بگذار» — فعلِ روشن) ──

/** قیمت‌های پیشنهادیِ آگهی — ۰.۹/۱.۰/۱.۱ برابرِ قیمتِ روزِ بازار (کفِ ۱) */
export function suggestedPrices(reference: number): number[] {
  const r = Math.max(1, Math.round(reference))
  return [0.9, 1, 1.1].map((f) => Math.max(1, Math.floor(r * f)))
}

/** گامِ ۱ — انتخابِ جنسِ قابلِ‌فروش از کیف (تا ۸ دکمه). */
export function marketSellText(
  sellable: { emoji: string; name: string; quantity: number; reference: number | null }[],
): string {
  // V24 — نشانِ 🛍؛ جمله‌ی راهنما ایتالیک و بالای نشان نشست
  const lines: string[] = [
    "🛍 <b>چه چیزی را به فروش بگذاری؟</b>",
    "<i>چیزی از کیفت را برای فروش بگذار — آگهی‌ات بینِ آگهی‌های مردم می‌نشیند.</i>",
    emblem("🛍"),
    "",
  ]
  if (sellable.length === 0) {
    lines.push("<i>چیزِ قابلِ‌فروشی در کیف نداری.</i>")
    lines.push("", quote(`<i>قفل/علاقه‌مندی‌ها و غیرقابلِ‌معامله‌ها آگهی نمی‌شوند. ${chip("کیف")} را ببین.</i>`))
    return lines.join("\n")
  }
  lines.push(...sellable.map((i) => `${i.emoji} <b>${esc(i.name)}</b> ${chip(`x${faNum(i.quantity)}`)}${i.reference ? ` · روز: ${chip(i.reference)}` : ""}`))
  lines.push(
    "",
    SUB,
    "",
    "هر آگهی 1 عدد · کارمزدی ندارد · جنس تا فروش/پس‌گرفتن از کیف بیرون می‌رود · 3 روز اعتبار.",
  )
  return lines.join("\n")
}

/** گامِ ۲ — کارتِ قیمت/تأیید: جنس + مرجعِ روز + پیشنهادها + هزینه‌های صادقانه.
 *  خودِ قیمت‌ها روی دکمه‌های زیر پیام‌اند؛ متن، مرجع و هزینه را می‌گوید. */
export function marketPriceText(
  item: { emoji: string; name: string; quantity: number },
  reference: number | null,
  suggestions: number[],
): string {
  // V24 — نشانِ 🏷 (برچسبِ قیمت)؛ همان اعدادِ صادقانه، چیدمانِ تازه
  const lines: string[] = [
    "🏷 <b>قیمتِ آگهی</b>",
    "<i>قیمتِ خودت را انتخاب کن — یا پیشنهادِ شهر را</i>",
    emblem("🏷"),
    "",
    `${item.emoji} <b>${esc(item.name)}</b> ${chip(`x${faNum(1)}`)} — از ${chip(faNum(item.quantity))} عددِ کیفت`,
    reference ? `📊 قیمتِ روزِ بازار: ${chip(reference)} سکه` : "📊 قیمتِ روزِ بازار در دسترس نیست.",
    `💡 سه پیشنهادِ شهر: ${suggestions.map((p) => chip(faNum(p))).join(" · ")} سکه`,
    "",
    SUB,
    "",
    "کارمزدی نیست — هرچه بفروشی، همه‌اش مالِ توئه.",
    "جنس تا فروش یا پس‌گرفتن از کیفت بیرون می‌رود؛ آگهی 3 روز اعتبار دارد.",
    `<i>قیمتِ دلخواه و شمارِ بیشتر در ${chip("مینی‌اپ")} است.</i>`,
  ]
  return lines.join("\n")
}

/** 🔔 خبرها — خوانده‌نشده‌ها + دعوت به خواندن */
export function notifyText(s: GameSnapshot): string {
  const unread = s.notifications.filter((n) => !n.read).slice(0, 5)
  const lines: string[] = [
    `🔔 <b>خبرها</b> — ${chip(s.unreadNotifications)} خوانده‌نشده`,
    "<i>زنگی که شهر برای تو به صدا درآورده</i>",
    emblem("🔔"),
    "",
  ]
  if (unread.length === 0) {
    lines.push("همه را خوانده‌ای.")
    lines.push("", quote("<i>بعضی‌ها را بهتر بود نمی‌خواندی.</i>"))
    return lines.join("\n")
  }
  for (const n of unread) {
    lines.push(`${n.icon} <b>${esc(clampText(n.title, 60))}</b>`)
    lines.push(`<i>${esc(clampText(n.body, 150))}</i>`)
    lines.push("")
  }
  const totalUnread = s.notifications.filter((n) => !n.read).length
  if (totalUnread > unread.length) {
    lines.push(`<i>… و ${chip(totalUnread - unread.length)} خبرِ دیگر</i>`)
  }
  return lines.join("\n").trim()
}

/** 🎲 بینگوی مخرب — شرط‌هایِ جیب‌ساز + خطِ صادقانه‌ی بی‌جیب‌ها + شانسِ زیرِ پرده
 *  (V16-3، ممیزی ⑩: دکمه فقط برای شرطی می‌آید که عددِ رویش عیناً اجرا شود). */
export function bingoText(s: GameSnapshot): string {
  const p = s.player
  const cap = bingoCap(p.money)
  const affordable = affordableStakes(p.money)
  const unavailable = BINGO_STAKES.filter((st) => !affordable.includes(st))
  // V24 — نشانِ 🎲؛ سقف و جیب بالای کارت، شانس همچنان زیرِ پرده
  const lines = [
    "🎲 <b>بینگوی مخرب</b>",
    "<i>شرط‌بندیِ شهر، با سقفِ جیبِ تو</i>",
    emblem("🎲"),
    "",
    `💰 کیفِ تو: ${chip(p.money)} سکه`,
    `📊 سقفِ شرطِ الان: ${chip(cap)} سکه`,
  ]
  if (affordable.length === 0) {
    lines.push("", `🚫 جیبت هنوز هیچ‌کدام را نمی‌کشد — سقفِ الان ${chip(cap)} سکه است. اول ${chip("کار")} کن.`)
  } else if (unavailable.length > 0) {
    lines.push(
      "",
      `🚫 جیب این‌ها را نمی‌کشد: ${unavailable.map((n) => chip(faNum(n))).join(" · ")} — سقفِ الان ${chip(cap)} سکه است.`,
    )
  }
  lines.push(
    "",
    SUB,
    "",
    `🎰 شانسِ برد: ${spoiler("حدود 42%")}`,
    `💸 برد: ${spoiler("1.8 برابرِ شرط")} · باخت: ${spoiler("هیچ")}`,
    "⏱ هر نیم‌ساعت فقط یک‌بار.",
    "",
    "⚠️ <b>ریسکِ واقعی است.</b> <i>دانه‌ها همیشه به نفعِ کسی نیستند.</i>",
  )
  return lines.join("\n")
}
