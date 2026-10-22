// FEMBOY WAR — V27: محتوای کاروانِ شهر — مأموریت‌های تعاونیِ چندنفره.
//
// هر قالب ۴ سهمِ مکمل دارد (پیشقراول/دیده‌بان/…)؛ هر کلاسِ سازگار شانسِ کنشِ
// دارنده‌اش را بالا می‌برد — پیشرفتِ شخصی (کلاس/سطح/شانس) داخلِ بازیِ گروهی
// معنا پیدا می‌کند. حداقلِ minRoles سهمِ متفاوت کاروان را راه می‌اندازد؛
// تماشاگرها هم «تشویق» می‌کنند — همه نقشی دارند، هیچ‌کس تماشاچیِ محض نیست.
//
// قواعدِ پاداش از اقتصادِ موجود می‌گویند: سهمِ شهر (صندوق) + سهمِ هر کنشگر
// + XPِ فمبوی (با سقفِ روزانه‌ی awards.ts). پاداشِ شکست کوچک ولی واقعی است —
// کسی برای باخت تنبیه نمی‌شود، تجربه می‌گیرد.

import type { ExpeditionTemplate } from "../types"

export const EXPEDITION_TEMPLATES: ExpeditionTemplate[] = [
  {
    id: "graveyard_gate",
    title: "شبِ دروازه‌ی گورستان",
    emoji: "🕯",
    hook: "دروازه‌ی گورستان تا سپیده باز است. چیزی پشتِ آن قفل شده و کلیدش — طبق عادتِ همیشگیِ این شهر — لابه‌لای چند دستِ مختلف پراکنده است.",
    minRoles: 3,
    recruitMinutes: 25,
    actMinutes: 20,
    cooldownMinutes: 300,
    minMembers: 3,
    reward: {
      treasury: [1800, 4200],
      eachPlayer: [450, 950],
      soulXp: 10,
      failPlayer: [80, 220],
      failSoulXp: 4,
    },
    successLine: "کاروان برگشت — چراغ‌های شهر تا صبح روشن ماند و هیچ‌کس نگفت چرا.",
    failLine: "کاروان برگشت. نه همه‌اش، نه هیچ‌اش. شهر سکوت کرد و جمع شد.",
    perfectLine: "بی‌نقص. هیچ سهمی لنگ نماند — اسمِ این شب در دفترِ شهر می‌ماند.",
    roles: [
      {
        key: "vanguard",
        label: "پیشقراول",
        emoji: "🗡",
        duty: "راهِ تاریک را باز می‌کند و جلو می‌ایستد.",
        favoredClasses: ["shinobi", "duelist", "reaper"],
        act: {
          label: "🗡 راهِ تاریک را باز کن",
          successText: "راهِ سنگ‌فرش تا قبرستانِ قدیم باز شد — بی‌صدا.",
          failText: "دروازه قفل بود. صدای چیزی از پشتش آمد و جلو نرفت.",
        },
      },
      {
        key: "scout",
        label: "دیده‌بان",
        emoji: "🕵️",
        duty: "مسیر و جای چشم‌های ناظر را می‌شمارد.",
        favoredClasses: ["ranger", "trickster"],
        act: {
          label: "🕵️ مسیر را رصد کن",
          successText: "نقشه‌ی کاملِ کوچه‌های مرده پیدا شد — حتی جاهایی که نباید.",
          failText: "مه همه‌چیز را بلعید. نقشه همان‌جا ماند، کجا — معلوم نیست.",
        },
      },
      {
        key: "rite",
        label: "پاسدارِ آیین",
        emoji: "🕯",
        duty: "آیینِ دروازه را سرِ وقت و درست نگه می‌دارد.",
        favoredClasses: ["wizard", "summoner"],
        act: {
          label: "🕯 آیین را کامل کن",
          successText: "شمش‌های پارچه‌ی قرمز درست بسته شد. هوای دروازه عوض شد.",
          failText: "شمع‌ها وسطِ آیین خاموش شدند. کسی قبلاً این را دیده بود.",
        },
      },
      {
        key: "medic",
        label: "مداوگر",
        emoji: "🧪",
        duty: "زخمِ راه را می‌بندد و ترس را کوچک می‌کند.",
        favoredClasses: ["paladin", "summoner"],
        act: {
          label: "🧪 کیفِ درمان را آماده کن",
          successText: "دوای درست آماده شد و هیچ‌کس نترسید. تقریباً هیچ‌کس.",
          failText: "شیشه‌ی آخر شکست. بقیه‌ی راه باید بی‌دوا رفت.",
        },
      },
    ],
  },
  {
    id: "silk_caravan",
    title: "کاروانِ ابریشم",
    emoji: "🚚",
    hook: "سه صندوقِ ابریشم باید فردا صبح سرِ بازار باشد. جاده‌ی بیابان، شبِ تنگ، و آن شایعه‌ی همیشگی درباره‌ی راهزن‌هایی که فقط کاروانِ بی‌نظم را می‌بینند.",
    minRoles: 3,
    recruitMinutes: 25,
    actMinutes: 20,
    cooldownMinutes: 300,
    minMembers: 3,
    reward: {
      treasury: [2200, 5000],
      eachPlayer: [500, 1000],
      soulXp: 10,
      failPlayer: [100, 250],
      failSoulXp: 4,
    },
    successLine: "صبح که بازار باز شد، ابریشم سرِ جای خودش بود — و کمی گران‌تر.",
    failLine: "کاروان دیر رسید. ابریشم آمد، اعتبار نیمه‌ماند.",
    perfectLine: "نه یک تار ابریشم لنگ ماند. بازرگان‌ها هنوز حرفش را می‌زنند.",
    roles: [
      {
        key: "guard",
        label: "محافظ",
        emoji: "🛡",
        duty: "جانِ کاروان را نگه می‌دارد — با هر چیزی که لازم شد.",
        favoredClasses: ["paladin", "duelist", "shinobi"],
        act: {
          label: "🛡 محافظت کن",
          successText: "شبِ بی‌حادثه گذشت — دفعِ حادثه هم کار است.",
          failText: "غبار از راه آمد. جنگ بود یا باد، معلوم نشد؛ هزینه‌اش شد.",
        },
      },
      {
        key: "guide",
        label: "راهنمای راه",
        emoji: "🐫",
        duty: "مسیرِ امنِ شب را از حافظه و شن می‌خواند.",
        favoredClasses: ["ranger", "trickster"],
        act: {
          label: "🐫 مسیرِ امن را بیاب",
          successText: "مسیرِ خشک و کوتاه پیدا شد — کاروان نفس کشید.",
          failText: "مسیر بسته بود. راهِ دور یعنی خوابِ کم.",
        },
      },
      {
        key: "negotiator",
        label: "چانه‌زن",
        emoji: "🤝",
        duty: "قیمتِ عبور و قیمتِ ابریشم را همان‌جا می‌بندد.",
        favoredClasses: ["trickster", "wizard"],
        act: {
          label: "🤝 قیمت را ببند",
          successText: "معامله بالا رفت — حتی راهزن‌ها دست‌شان باز ماند.",
          failText: "چانه خیلی طولانی شد. طرفِ دیگر خسته شد و رفت.",
        },
      },
      {
        key: "quartermaster",
        label: "تدارک‌چی",
        emoji: "📦",
        duty: "خوراک، آب و جای هر صندوق را سرِ وقت می‌رساند.",
        favoredClasses: ["summoner", "reaper"],
        act: {
          label: "📦 تدارک را سرِ وقت برسان",
          successText: "همه‌چیز سرِ جای خودش بود. حتی چایِ نیمه‌شب.",
          failText: "یک صندوق جا ماند — همان که لازم شد.",
        },
      },
    ],
  },
  {
    id: "ash_alley",
    title: "گنجِ کوچه‌ی خاکستر",
    emoji: "🗝",
    hook: "نقشه‌ای نصفه زیرِ کفِ خانه‌ی قدیمی پیدا شده. نیمه‌ی دیگرش، طبق شایعه‌ی روز، هنوز نفس می‌کشد و دست‌به‌دست می‌شود.",
    minRoles: 3,
    recruitMinutes: 25,
    actMinutes: 20,
    cooldownMinutes: 300,
    minMembers: 3,
    reward: {
      treasury: [1500, 3800],
      eachPlayer: [400, 900],
      soulXp: 12,
      failPlayer: [70, 200],
      failSoulXp: 4,
    },
    successLine: "نیمه‌های نقشه به هم رسید. آنچه پیدا شد، همان‌قدر عجیب بود که باید.",
    failLine: "نقشه کامل نشد. کسی خواهد گفت بهتر هم همین بود.",
    perfectLine: "هر تکه سرِ وقت سرِ جای خودش نشست. کوچه دیگر همان کوچه نیست.",
    roles: [
      {
        key: "digger",
        label: "کندوکاو",
        emoji: "⛏",
        duty: "زیرِ خاکستر را مؤدبانه ولی قاطع باز می‌کند.",
        favoredClasses: ["reaper", "duelist", "shinobi"],
        act: {
          label: "⛏ خاکستر را بکَن",
          successText: "کفِ کوچه باز شد — آجرِ قدیمی، درست همان‌جا که نقشه گفت.",
          failText: "بیل خورد. خاکستر بود و خاکستر ماند.",
        },
      },
      {
        key: "lookout",
        label: "نیگهبان",
        emoji: "🧿",
        duty: "چشم و گوشِ کوچه — کوچه حرف زیاد دارد.",
        favoredClasses: ["ranger", "trickster"],
        act: {
          label: "🧿 کوچه را نگه دار",
          successText: "کوچه تمامِ شب ساکت ماند — یعنی خبر نداد، یعنی امن بود.",
          failText: "پرچمِ قرمزِ دیده‌بان بالا رفت. باید رفتند، زود.",
        },
      },
      {
        key: "reader",
        label: "ترجمانِ نقشه",
        emoji: "🔮",
        duty: "نیمه‌های ناتمام را به هم می‌دوزد.",
        favoredClasses: ["wizard", "summoner"],
        act: {
          label: "🔮 نقشه را ترجمه کن",
          successText: "خط‌های نیمه‌پز به هم رسید. مسیر روشن شد.",
          failText: "ترجمه دو پهلو از آب درآمد. نصفِ شب تلف شد.",
        },
      },
      {
        key: "keeper",
        label: "امینِ گنج",
        emoji: "🏺",
        duty: "هر چه بیرون می‌آید، شمرده و امانت می‌ماند.",
        favoredClasses: ["paladin", "trickster"],
        act: {
          label: "🏺 گنج را بشمار و نگه دار",
          successText: "همه‌چیز شمرده شد و رسید — حتی آن چیزِ عجیبِ آخر.",
          failText: "شمارش جور درنیامد. یک چیزی، یک‌جایی، گم شد.",
        },
      },
    ],
  },
  {
    id: "red_moon_fog",
    title: "مهِ ماهِ قرمز",
    emoji: "🌀",
    hook: "ماه قرمز است و مه از رودخانه بالا آمده — تا زانویِ خیابان. کسی باید برود ببیند مه امشب چه می‌گوید؛ چون فردا یادش می‌رود.",
    minRoles: 3,
    recruitMinutes: 25,
    actMinutes: 20,
    cooldownMinutes: 300,
    minMembers: 3,
    reward: {
      treasury: [1200, 3200],
      eachPlayer: [350, 850],
      soulXp: 12,
      failPlayer: [60, 180],
      failSoulXp: 4,
    },
    successLine: "مه آن‌چه داشت گفت و بعدُ عقب نشست. شهر قدم‌هایش را پس گرفت.",
    failLine: "مه عقب نشست، ولی حرفش نیمه ماند. فردا کسی یادش نمی‌آورد.",
    perfectLine: "مه کامل حرف زد و شنیده شد. در این شهر، این کارِ کسی نیست — کارِ همه بود.",
    roles: [
      {
        key: "frontline",
        label: "سنگرِ مه",
        emoji: "🌪",
        duty: "اول از همه قدم داخلِ مه می‌گذارد — جای دیگران را هم نگه می‌دارد.",
        favoredClasses: ["duelist", "paladin"],
        act: {
          label: "🌪 جلوتر از مه بایست",
          successText: "قدم‌ها جا باز کرد. مه از سرِ راه کنار رفت — احتراماً.",
          failText: "مه دودست شد. عقب‌نشینی، ولی با کمالِ وقار.",
        },
      },
      {
        key: "whisperer",
        label: "شنوای زمزمه‌ها",
        emoji: "🎭",
        duty: "مه حرف می‌زند — کسی باید گوش بدهد.",
        favoredClasses: ["summoner", "wizard"],
        act: {
          label: "🎭 به مه گوش بده",
          successText: "زمزمه شنیده شد و یاداشته شد. مه خوشش آمد.",
          failText: "زمزمه گم شد وسطِ صدای قدم‌ها. مه دم برنیاورد.",
        },
      },
      {
        key: "runner",
        label: "پیکِ شب",
        emoji: "🏃",
        duty: "بینِ مه و شهر دویده و خبر می‌برد.",
        favoredClasses: ["shinobi", "ranger"],
        act: {
          label: "🏃 خبر را برسان",
          successText: "خبر سرِ وقت به شهر رسید — دو بار، برای اطمینان.",
          failText: "راهِ برگشت درِ مه گم شد. خبر دیر آمد.",
        },
      },
      {
        key: "jester",
        label: "آشوب‌گر",
        emoji: "🃏",
        duty: "مه را می‌خنداند تا اسرارش بیفتد — ترفندِ قدیمی.",
        favoredClasses: ["trickster", "reaper"],
        act: {
          label: "🃏 مه را بخندان",
          successText: "مه خندید و لپّش افتاد — دو سه راز هم با لپّش افتاد.",
          failText: "شوخی سرد بود. مه ساکت ماند و شهر هم.",
        },
      },
    ],
  },
]

export const EXPEDITION_MAP: Record<string, ExpeditionTemplate> = Object.fromEntries(
  EXPEDITION_TEMPLATES.map((t) => [t.id, t]),
)
