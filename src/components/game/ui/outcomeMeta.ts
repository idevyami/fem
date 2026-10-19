"use client"

// V17-W2 (F3) — ماژولِ مشترکِ «معنای نتیجه»: بالابردنِ کمک‌کننده‌هایِ آموزشِ نتیجه‌ی
// موجِ ۱ (که محلی در EventCard بودند) به یک‌جایِ واحد، تا کارتِ نتیجه‌ی اکشن‌های
// پیشخوان (F1) و بلوکِ نتیجه‌ی تعاملِ فمبوی (F2) همان زبان را بگویند.
// V17-W3 (F1) — سازنده‌ی «قدمِ بعدی» هم مشترک شد: زنجیره‌ی اولویتِ موجِ ۲
// (پیمان → نقطه‌مهارت → کار → اتفاق → استراحت) از HomeScreen بیرون آمد تا
// کارت‌های نتیجه‌ی بازار/کیف/من هم همان قدمِ صادقِ snapshot-محور را بگیرند.
// فقط واقعیت‌های موتور — نه ادعا (قاعده‌ی NEVER fake).

import type { GameSnapshot } from "@/lib/game/contract"
import { faNum } from "../fa"

/** V17-2 — «یعنیِ این عدد»: معنای یک‌خطیِ هر آمارِ موجود در نتیجه.
 * کلید = برچسبِ STAT_META که موتور در DeltaLineDTO می‌فرستد؛ V17-W2 دو کلیدِ
 * سمتِ فمبوی (F19) هم نشسته‌اند — هر دو واقعیتِ موتورند:
 * روحیه اثرِ مستقیم روی آسیبِ نبرد دارد (از +10% تا −15%) و پیوند در پله‌هایش
 * واکنش/خاطره‌ی تازه باز می‌کند. */
export const STAT_MEANING: Record<string, string> = {
  "سکه": "پولِ تو — برای خانه، بازار و رفعِ دَین",
  "انرژی": "سوختِ کار، سفر و کشیدنِ اتفاق",
  "تجربه": "جمعش کن تا سطح بگیری — هر سطح چیزِ تازه‌ای باز می‌کند",
  "شانس": "شانسِ بردِ بینگو و اتفاق‌های خوب را بالا می‌برد",
  "شهرت": "چقدر شهر تو را می‌شناسد و اسمت می‌پیچد",
  "آشوب": "بی‌قانونیِ تو — بالا برود، حواسِ شهر به تو هست",
  "بدهی": "طلبِ دایی فرهاد — هر روز سودش را می‌گیردت",
  "سلامتی": "حالِ بدنِ تو — پایین بیاید، جدی‌اش بگیر",
  "هوش": "ذهنِ تیز — بعضی فرصت‌ها فقط با هوشِ بالا پیشت می‌آید",
  "سابقه": "کارنامه‌ات نزدِ قانون — بیشتر شود، دردسر بیشتر",
  "اعتبار": "آبروی تو نزدِ مردمِ شهر",
  // ── V17-W2 (F19) — سمتِ فمبوی؛ فقط واقعیت‌های موتور ──
  "روحیه": "حالِ فمبوی‌ات — پایین بیاید، خراب می‌شود و نبرد سخت می‌شود",
  "پیوند": "اعتمادِ بینِ شما — بالا برود، واکنش‌ها و خاطره‌های تازه باز می‌شود",
  // یادداشتِ صداقت (F3): خط‌های XPِ فمبوی («XPِ بخت» و هم‌ردیف‌هایش) عمداً
  // این‌جا نیستند — مسیرهای XPِ فمبوی هرگز به‌صورتِ برچسبِ DeltaLineDTO نمی‌آیند
  // (بلوکِ FemboyXp خودشان را کامل می‌گویند)؛ تطبیقِ عمومیِ صادقانه ممکن نیست.
}

/** حداکثر خطِ معنا که با هم نشان می‌دهیم — نتیجه باید کوتاه بماند (ممیزیِ ⑦) */
export const MAX_MEANING_LINES = 3

/** V17-2 — قدمِ بعدیِ نتیجه: از فیلدهای واقعیِ snapshotِ تازه ساخته می‌شود (در صفحه) */
export interface OutcomeNextStep {
  icon: string
  label: string
  hint?: string
  onClick?: () => void
}

/** یک خطِ معنا با هویتش (آیکن + برچسب + متن) — برای رندرِ مشترکِ «چی یعنی؟» */
export interface OutcomeMeaningEntry {
  icon: string
  label: string
  text: string
}

/** معناهای همین نتیجه: فقط برچسب‌های حاضر در دلتاها، بدونِ تکرار، حداکثر N خط.
 * V17-W2 (F3) — پیاده‌سازیِ واحدِ همان فیلتری که OutcomeReveal موجِ ۱ داشت. */
export function outcomeMeaningEntries(
  deltas: { icon?: string; label: string }[],
  max = MAX_MEANING_LINES,
): OutcomeMeaningEntry[] {
  const out: OutcomeMeaningEntry[] = []
  const seen = new Set<string>()
  for (const d of deltas) {
    if (seen.has(d.label)) continue
    const text: string | undefined = STAT_MEANING[d.label]
    if (text === undefined) continue
    seen.add(d.label)
    out.push({ icon: d.icon ?? "", label: d.label, text })
    if (out.length >= max) break
  }
  return out
}

/** V17-W2 (F3) — فیلترِ سبکِ مشترکِ معناها روی برچسب‌های دلتاها (متنِ خام، بدونِ تکرار، حداکثر N) */
export function outcomeMeanings(deltas: { label: string }[], max = MAX_MEANING_LINES): string[] {
  return outcomeMeaningEntries(deltas, max).map((e) => e.text)
}

// ─── V17-W3 (F1): سازنده‌ی مشترکِ «قدمِ بعدی» ──────────────────────────────

/** کنش‌های «قدمِ بعدی» — هر صفحه رفتارِ خودش را می‌دهد (خانه: اجرای مستقیم،
 *  بازار/کیف/من: ناوبری به جایی که آن کنش واقعاً زندگی می‌کند). نبودنِ کنش →
 *  ردیفِ ایستای همان متنِ صادق. */
export interface NextStepActions {
  /** پیمانِ فمبوی — تبِ فمبوی */
  goSoul?: () => void
  /** خرجِ نقطه‌مهارت — تبِ فمبوی + سکشنِ مهارت‌ها (deep-linkِ V17-W3 · F5) */
  goSkills?: () => void
  /** شیفتِ بعدی */
  work?: () => void
  /** استراحت */
  rest?: () => void
  /** کشیدنِ اتفاق */
  draw?: () => void
}

/** قدمِ بعدی از snapshotِ تازه — همان زنجیره‌ی اولویتِ موجِ ۲، بدونِ هیچ hintِ
 *  ساختگی: پیمان → نقطه‌مهارت → کار → اتفاقِ بعدی → استراحت → خواب تا صبح.
 *  همان تابعی که HomeScreen می‌ساخت؛ حالا همه‌ی کارت‌های نتیجه از آن تغذیه می‌کنند.
 *  snapshot = null (هنگامِ بوت) → قدمی نیست (null). */
export function buildSnapshotNextStep(
  snapshot: GameSnapshot | null,
  actions: NextStepActions,
): OutcomeNextStep | null {
  if (!snapshot) return null
  const { player, femboy, activeEvent } = snapshot
  if (!femboy) {
    return {
      icon: "🎀",
      label: "پیمانِ فمبوی ببند",
      hint: "رفیقِ اختصاصیِ تو در این شهر",
      ...(actions.goSoul ? { onClick: actions.goSoul } : {}),
    }
  }
  if (femboy.skillPoints > 0) {
    return {
      icon: "✨",
      label: "نقطه‌مهارتِ فمبوی‌ات را خرج کن",
      hint: `${faNum(femboy.skillPoints)} نقطه‌مهارتِ استفاده‌نشده داری`,
      ...(actions.goSkills ? { onClick: actions.goSkills } : {}),
    }
  }
  if (player.canWork) {
    return {
      icon: "💼",
      label: "برو سرِ کار",
      hint: player.job
        ? `شیفتِ ${player.job.name} — ${faNum(player.job.incomeMin)} تا ${faNum(player.job.incomeMax)} سکه`
        : "شیفتِ بعدی",
      ...(actions.work ? { onClick: actions.work } : {}),
    }
  }
  if (!activeEvent && player.energy >= 8) {
    return {
      icon: "🎲",
      label: "یک اتفاقِ دیگر بکش",
      hint: "شهر هنوز حرفی برای گفتن دارد",
      ...(actions.draw ? { onClick: actions.draw } : {}),
    }
  }
  if (!player.resting) {
    return {
      icon: "😴",
      label: "یه نفسی تازه کن",
      hint: "انرژی‌ات دارد تمام می‌شود",
      ...(actions.rest ? { onClick: actions.rest } : {}),
    }
  }
  return {
    icon: "🌙",
    label: "تا صبحِ بعد بخواب",
    hint: `${faNum(player.restMinutesLeft)} دقیقه تا صبحِ بعد`,
  }
}
