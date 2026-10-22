// FEMBOY WAR — V27: محتوای همه‌پرسی — رأیِ جمعیِ شهر با اثرِ واقعی بر جهان.
//
// هر گزینه حکمش را همان لحظه‌ی شمارش اجرا می‌کند: تغییرِ فوریِ شاخص‌ها
// (آشوب/دمای اجتماعی/جرم/صندوق) یا سوگیریِ موقتِ رویدادها (tagBoost — وزنِ
// رویدادهای آن جنس برای N ساعت ×1.35) یا آبروی جمعی. نتیجه در کارتِ حکم
// صادقانه گفته می‌شود: «چه شد»، نه فقط «چه کسی برد».
//
// تولید: تیکِ شهر هر ~۷۲ ساعت (culture: lastPollDay) یا شهردار (gm:poll) —
// قدرتِ واقعیِ اولِ شهردار که تا حالا فقط متن بود.

import type { ReferendumTemplate } from "../types"

export const REFERENDUM_TEMPLATES: ReferendumTemplate[] = [
  {
    id: "city_mood",
    question: "شهر چه حسی می‌خواهد؟",
    emoji: "🌡",
    options: [
      {
        key: "calm",
        label: "آرامش",
        style: "success",
        line: "آسمون یک دقیقه ساکت ماند. بعضی‌ها از سکوت شکایت کردند — عادت دارند.",
        effects: { chaos: -8, socialTemp: 4 },
      },
      {
        key: "thrill",
        label: "هیجان",
        style: "danger",
        line: "همه دوباره سرِ کوچه آمدند. کسی نپرسید چرا.",
        effects: { chaos: 8, socialTemp: 5 },
      },
      {
        key: "whatever",
        label: "بی‌خیال",
        style: null,
        line: "شهر تصمیم گرفت تصمیم نگیرد. تصمیمِ محکمی بود.",
        effects: {},
      },
    ],
  },
  {
    id: "night_gate",
    question: "دروازه‌ی شبانه چه شود؟",
    emoji: "🌃",
    options: [
      {
        key: "open",
        label: "باز بماند",
        style: "danger",
        line: "دروازه باز ماند؛ پولِ شبانه آمد و خوابِ نیمه‌شب نرفت.",
        effects: { crime: 4, treasury: 500, socialTemp: 3 },
      },
      {
        key: "closed",
        label: "بسته شود",
        style: "success",
        line: "شب ساکت‌تر شد. یکی دو نفر از سکوت شکایت کردند — دوباره.",
        effects: { crime: -5, chaos: -3 },
      },
    ],
  },
  {
    id: "city_spirit",
    question: "روحِ شهر به کدام سو؟",
    emoji: "🧭",
    options: [
      {
        key: "mystery",
        label: "معما",
        style: "primary",
        line: "شهر شروع کرد به سؤال‌های عجیب‌تر. جواب‌ها هنوز در راه‌اند.",
        effects: { tagBoost: { tag: "mystery", hours: 48 } },
      },
      {
        key: "trade",
        label: "تجارت",
        style: "primary",
        line: "حساب‌ها جور شد و دست‌ها باز. سکه صدا کرد.",
        effects: { tagBoost: { tag: "economic", hours: 48 } },
      },
      {
        key: "art",
        label: "هنر",
        style: "primary",
        line: "دیوارها رنگ گرفتند. بعضی‌ها نوشتند چرا، بعضی‌ها فقط خندیدند.",
        effects: { tagBoost: { tag: "meme", hours: 48 } },
      },
    ],
  },
  {
    id: "festival_fund",
    question: "بودجه‌ی جشن چه شود؟",
    emoji: "🎪",
    options: [
      {
        key: "party",
        label: "جشنِ واقعی",
        style: "danger",
        line: "جشن برگزار شد. شهر رقصید و صندوق لاغر شد — ارزشش را داشت، اکثراً.",
        effects: { treasury: -600, socialTemp: 10 },
      },
      {
        key: "save",
        label: "پس‌انداز",
        style: "success",
        line: "صندوق نفس راحت کشید. جشن به پاییز موکول شد — شاید.",
        effects: { treasury: 400, socialTemp: -3 },
      },
    ],
  },
  {
    id: "alley_law",
    question: "قانونِ کوچه کدام باشد؟",
    emoji: "⚖",
    options: [
      {
        key: "trust",
        label: "اعتمادِ عمومی",
        style: "success",
        line: "دست‌ها به هم رسید. موقتاً. ولی رسید.",
        effects: { repAll: { dim: "trust", delta: 2 } },
      },
      {
        key: "fear",
        label: "ترسِ سالم",
        style: "danger",
        line: "کوچه ساکت‌تر شد — از احتیاط. یا از چیزِ دیگری.",
        effects: { repAll: { dim: "fear", delta: 2 }, chaos: 3 },
      },
    ],
  },
]

export const REFERENDUM_MAP: Record<string, ReferendumTemplate> = Object.fromEntries(
  REFERENDUM_TEMPLATES.map((t) => [t.id, t]),
)

/** پرسشِ همه‌پرسی با کوچک‌ترینِ تکرار — یکی غیر ازِ دفعه‌ی قبل */
export function pickReferendum(lastId: string, rng: () => number): ReferendumTemplate {
  const pool = REFERENDUM_TEMPLATES.filter((t) => t.id !== lastId)
  const list = pool.length > 0 ? pool : REFERENDUM_TEMPLATES
  return list[Math.floor(rng() * list.length)]!
}
