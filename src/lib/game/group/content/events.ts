// FEMBOY WAR — V5: قالب‌های رویداد گروهی (داده‌محور).
// جاگذاری‌ها: {p1} {p2} {p3} بازیکنان · {npc} شخصیت · {item} کالا · {amount} عدد · {group} اسم گروه
// هر قالب باید عواقب واقعی داشته باشد: پول/صندوق/رابطه/اعتبار/حافظه/شایعه/سرنخ/پیگیری.

import type { GroupEventTemplate } from "../types"

export const GROUP_EVENT_TEMPLATES: GroupEventTemplate[] = [
  {
    id: "frog_enters",
    kind: "chaos",
    emoji: "🐸",
    title: "قورباغه وارد شهر شد",
    body: "یه قورباغه‌ی جهش‌یافته وسط {group} نشسته. به همه نگاه می‌کنه. انگار منتظره.",
    tags: ["frog", "chaos", "absurd"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 10,
    choices: [
      {
        key: "feed",
        label: "🐸 بهش غذا بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "قورباغه غذا رو خورد و به {p1} نگاهی انداخت که تمام عمرش یادش می‌مونه. حالا دنبالت می‌کنه.",
            effects: {
              playerStats: [{stat: "fame", min: 2, max: 5, scope: "instigator"}],
              memory: { kind: "moment", text: "قورباغه {p1} را انتخاب کرد", importance: 70 },
              rumor: { text: "می‌گن {p1} با یه قورباغه قرار می‌ذاره", truth: false },
              followUp: { templateId: "frog_remembers", afterMinutesMin: 4320, afterMinutesMax: 10080, chance: 0.5 },
            },
          },
          {
            weight: 4,
            text: "قورباغه بوی دست {p1} را گرفت و رفت. فردا جایی شایعه می‌شه.",
            effects: { rumor: { text: "قورباغه‌ای که اومده بود از دست {p1} فرار کرد", truth: true } },
          },
        ],
      },
      {
        key: "study",
        label: "🧪 مطالعه‌اش کن",
        style: "primary",
        outcomes: [
          {
            weight: 7,
            text: "{p1} نتیجه گرفت که این قورباغه «کاملاً عادی» است. مقاله‌ش هنوز منتشر نشده.",
            effects: {
              playerStats: [{stat: "xp", min: 15, max: 40, scope: "instigator"}],
              clue: "قورباغه قبل از «بازنشانیِ» قبلی شهر هم اینجا بود.",
            },
          },
        ],
      },
      {
        key: "sell",
        label: "💰 بفروشش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} قورباغه رو فروخت به یه مرد عینکی. پولش واقعی بود. خوابش نه.",
            effects: {
              playerStats: [
                { stat: "money", min: 800, max: 2600, scope: "instigator" },
                { stat: "crime", min: 1, max: 3, scope: "instigator" },
              ],
              group: { crime: 3 },
              memory: { kind: "scandal", text: "{p1} قورباغه را فروخت", importance: 60 },
            },
          },
          {
            weight: 5,
            text: "خریدار معلوم نبود کیه. قورباغه رفت و {p1} هنوز منتظر واریزه. شناسنامه‌ش هم پیش قورباغه مونده.",
            effects: { playerStats: [{stat: "luck", min: -3, max: -1, scope: "instigator"}] },
          },
        ],
      },
      {
        key: "mayor",
        label: "👑 بکنش شهردار",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "کسی مخالف نبود. قورباغه شهردار {group} شد. اولین فرمانش: سکوت.",
            effects: {
              group: { chaos: 10, influence: 5 },
              memory: { kind: "legend", text: "روزی که قورباغه شهردار شد", importance: 95 },
              news: "قورباغه رسماً شهردار {group} شد. منتظر برنامه‌ی انتخاباتی هستیم.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "frog_remembers",
    kind: "chaos",
    emoji: "🐸",
    title: "قورباغه برگشته",
    body: "همون قورباغه. دوباره. این‌بار مستقیم سراغ {p1} اومده. یادش هست.",
    tags: ["frog", "chaos", "callback"],
    minMembers: 1,
    cooldownMinutes: 1440,
    weight: 8,
    choices: [
      {
        key: "talk",
        label: "🐸 باهاش حرف بزن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "قورباغه چیزی نگفت. ولی {p1} بعدش یه هفته خوش‌حال بود. علم توضیحش نمی‌ده.",
            effects: {
              playerStats: [{stat: "xp", min: 10, max: 25, scope: "instigator"}],
              relationships: [{dim: "friendship", min: 2, max: 5, scope: "all_pairs"}],
            },
          },
        ],
      },
      {
        key: "run",
        label: "🏃 فرار کن",
        style: "primary",
        outcomes: [
          {
            weight: 7,
            text: "{p1} دوید. قورباغه دنبالش نیامد. قورباغه هیچ‌وقت دنبال کسی نمیاد. همین ترسناک‌تره.",
            effects: {},
          },
        ],
      },
      {
        key: "bribe",
        label: "🎁 رشوه بده",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "قورباغه هدیه رو پذیرفت. حالا رسماً «مطمئن» نیستیم سمت کیه.",
            effects: {
              playerStats: [{stat: "money", min: -1200, max: -400, scope: "instigator"}],
              treasury: { min: 200, max: 600 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "legendary_spoon_missing",
    kind: "mystery",
    emoji: "🥄",
    title: "قاشقِ افسانه‌ای گم شده",
    body: "قاشقی که هیچ‌کس ندیده بود، حالا گم شده. همه مطمئنن قبلاً بوده. کی برداشته؟",
    tags: ["spoon", "mystery", "crime"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 9,
    choices: [
      {
        key: "accuse",
        label: "🫵 متهم کن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به {p2} اشاره کرد. {p2} تازه فهمید متهمه. دادگاه ممکن است برگزار شود.",
            effects: {
              relationships: [{ dim: "tension", min: 5, max: 12, scope: "pair" }],
              group: { socialTemp: 8 },
            },
          },
        ],
      },
      {
        key: "investigate",
        label: "🕵️ تحقیق کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ردپایی پیدا کرد که به... هیچ‌جا نمی‌رفت. سرنخ اما سرنخ است.",
            effects: {
              playerStats: [{stat: "xp", min: 10, max: 30, scope: "instigator"}],
              clue: "قاشق هیچ‌وقت وجود نداشته. قاشق «ایده‌ی» قاشق بوده.",
            },
          },
          {
            weight: 5,
            text: "تحقیقات {p1} فقط این را روشن کرد: همه در {group} یه چیزی قایم می‌کنن.",
            effects: { rumor: { text: "به نظر می‌رسه قاشق اصلاً وجود نداشته", truth: true } },
          },
        ],
      },
      {
        key: "ignore",
        label: "😌 بی‌خیال",
        style: "success",
        outcomes: [
          {
            weight: 8,
            text: "شهر تصمیم گرفت قاشق را جایی نگذاشته باشد. مسئله حل شد. تا دفعه‌ی بعد.",
            effects: { group: { socialTemp: -5 } },
          },
        ],
      },
    ],
  },
  {
    id: "street_economist",
    kind: "economic",
    emoji: "💸",
    title: "نبضِ شهر",
    body: "ظاهراً اقتصاد {group} دوباره دارد فرو می‌ریزد. {p1} همین الان {amount} سکه دارد و {p2} بدهکاره. سیستم ثبت کرد.",
    tags: ["money", "economy"],
    minMembers: 2,
    cooldownMinutes: 360,
    weight: 12,
    choices: [
      {
        key: "deal",
        label: "💰 بررسی پیشنهاد مشکوک",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "معامله شروع شد و درست هم جواب داد. این‌بار. {p1} سود کرد و حاضر نیست بگو چطور.",
            effects: {
              playerStats: [{stat: "money", min: 600, max: 2000, scope: "instigator"}],
              relationships: [{dim: "trust", min: -3, max: 3, scope: "pair"}],
            },
          },
          {
            weight: 5,
            text: "پیشنهاد مشکوک واقعاً مشکوک بود. {p1} بخشی از پولش بوع داد و رفت.",
            effects: {
              playerStats: [
                { stat: "money", min: -1500, max: -300, scope: "instigator" },
                { stat: "crime", min: 0, max: 2, scope: "instigator" },
              ],
            },
          },
        ],
      },
      {
        key: "help",
        label: "🤝 دست بده به بدهکار",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} به {p2} قرض داد. {p2} یادش می‌مونه. شهر هم یادش می‌مونه.",
            effects: {
              playerStats: [{ stat: "money", min: -800, max: -200, scope: "instigator" }],
              relationships: [
                { dim: "trust", min: 6, max: 14, scope: "pair" },
                { dim: "friendship", min: 3, max: 8, scope: "pair" },
              ],
              memory: { kind: "moment", text: "{p1} در روزِ بد به {p2} کمک کرد", importance: 65 },
            },
          },
        ],
      },
      {
        key: "laugh",
        label: "😂 بی‌خیال بابا",
        style: "primary",
        outcomes: [
          {
            weight: 8,
            text: "شهر به فقر {p2} خندید. {p2} هم خندید. تا حدی.",
            effects: { relationships: [{dim: "tension", min: 1, max: 4, scope: "pair"}] },
          },
        ],
      },
    ],
  },
  {
    id: "npc_visits_group",
    kind: "npc",
    emoji: "☕",
    title: "{npc} سر زده",
    body: "{npc} از {group} رد می‌شد. مکث کرد. گفت «جای قشنگیه» با اون لحنی که یعنی چیز دیگه.",
    tags: ["npc", "social"],
    minMembers: 2,
    cooldownMinutes: 240,
    weight: 11,
    choices: [
      {
        key: "welcome",
        label: "👋 خوش‌آمد بگو",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{npc} رفت ولی یه چیزی جا گذاشت. {p1} برداشتش. {item} بود.",
            effects: {
              playerStats: [{stat: "luck", min: 1, max: 3, scope: "instigator"}],
              relationships: [{dim: "cooperation", min: 1, max: 3, scope: "all_pairs"}],
            },
          },
        ],
      },
      {
        key: "interrogate",
        label: "❓ سؤال‌های زیاد بپرس",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} زیادی پرسید. {npc} جواب داد: «بعضی سؤال‌ها خودشون جواب می‌دن، بعداً.»",
            effects: {
              clue: "{npc} از قبل از اینترنت، این محله را می‌شناخت.",
              playerStats: [{stat: "xp", min: 8, max: 20, scope: "instigator"}],
            },
          },
        ],
      },
    ],
  },
  {
    id: "meteor_shower",
    kind: "world",
    emoji: "🌌",
    title: "بارش شهاب‌سنگ",
    body: "آسمون {group} پر از ریسه‌های نور شد. یکی‌شان پایین اومد. سر و ته نداره ولی گرمه.",
    tags: ["world", "weather", "mystery"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 7,
    choices: [
      {
        key: "hide",
        label: "🙈 قایم شو",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "عاقلانه بود. شهاب‌سنگ‌ها اومدن و رفتن. {group} سالم موند.",
            effects: { group: { socialTemp: -4 } },
          },
        ],
      },
      {
        key: "collect",
        label: "🪨 تکه‌ها رو جمع کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه تکه برداشت. دستش هنوز گرمه. فروشندش هم نمی‌دونه قیمتش چنده.",
            effects: {
              playerStats: [{stat: "money", min: 400, max: 1800, scope: "participants"}],
              rumor: { text: "تکه‌ی شهاب‌سنگِ {p1} وقتی کسی نگاه نمی‌کنه صدا می‌ده", truth: false },
            },
          },
        ],
      },
      {
        key: "worship",
        label: "🛐 فرقه بساز",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "تا غروب، {p1} سه پیرو داشت. تا فردا؟ نامعلوم. نامعلوم‌ها این‌جا معمولاً زیاد می‌شن.",
            effects: {
              playerStats: [{stat: "fame", min: 3, max: 8, scope: "instigator"}],
              group: { chaos: 8 },
              memory: { kind: "moment", text: "فرقه‌ی شهاب‌سنگ در {group} تاسیس شد", importance: 75 },
            },
          },
          {
            weight: 5,
            text: "کسی به فرقه‌ی {p1} نپیوست. یعنی هنوز. این جمله دقیقاً همین‌طور معکوس هم خوانده می‌شود.",
            effects: {},
          },
        ],
      },
    ],
  },

  // ═══ آشوب (قورباغه‌شناسی و پدیده‌های شهری) ═══
  {
    id: "frog_city_council",
    kind: "chaos",
    emoji: "🏛",
    title: "شورای شهرِ قورباغه‌ها",
    body: "سه قورباغه روی پله‌های {group} نشستن و جلسه می‌ذارن. صورت‌جلسه‌شون خیسه، ولی مهرش رسمیه.",
    tags: ["frog", "chaos", "election", "absurd"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 8,
    choices: [
      {
        key: "attend",
        label: "🏛 شرکت کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} رفت بالای تریبون و جلسه رو هدایت کرد. قورباغه‌ها با سر تایید کردن. کلمه‌ای نگفتن، ولی دبیرِ جلسه {p1} بود.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              title: { text: "🐸 دبیرِ شورای قورباغه‌ها", chance: 0.18 },
              followUp: { templateId: "frog_census", afterMinutesMin: 2880, afterMinutesMax: 5760, chance: 0.4 },
            },
          },
          {
            weight: 4,
            text: "قورباغه‌ها جلسه رو به احترام {p1} موکول کردن. کسی نمی‌دونه این تکریم بود یا تعطیلی.",
            effects: { group: { chaos: 5 } },
          },
        ],
      },
      {
        key: "protest",
        label: "✊ اعتراض کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گفت قورباغه‌ها حق رأی ندارن. قورباغه‌ها با هم رأی مخالف دادن — به {p1}. دموکراسی کارش اینه.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 8 },
              rumor: { text: "قورباغه‌ها {p1} را از شورای شهر اخراج کردن", truth: true },
            },
          },
          {
            weight: 5,
            text: "اعتراض {p1} جدی گرفته نشد. یکی از قورباغه‌ها هم‌زمان باهاش قیافه گرفت. شایع شد.",
            effects: { playerStats: [{ stat: "fame", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "minutes",
        label: "📝 صورت‌جلسه رو بردار",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} صورت‌جلسه‌ی خیس رو مو به مو رونویسی کرد. آرشیو {group} از این پس یه پوشه‌ی قورباغه داره.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 30, scope: "instigator" }],
              group: { reputation: 3 },
              clue: "در صورت‌جلسه‌ی قورباغه‌ها اسم یه شهروند آدم بود که هنوز به دنیا نیومده.",
            },
          },
        ],
      },
      {
        key: "wait",
        label: "🍵 فقط تماشا کن",
        style: null,
        outcomes: [
          {
            weight: 7,
            text: "جلسه تا غروب طول کشید. نتیجه‌اش: هیچ. همه‌ی این مدت {group} ساکت و خوش‌حال بود.",
            effects: { group: { socialTemp: -4, chaos: 3 } },
          },
        ],
      },
    ],
  },
  {
    id: "frog_census",
    kind: "chaos",
    emoji: "🐸",
    title: "سرشماری قورباغه‌ها",
    body: "یکی شمرد: قورباغه‌های {group} از شهروندهاش بیشتر شدن. دقیق شمرده. دو بار.",
    tags: ["frog", "chaos", "absurd", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "verify",
        label: "🔍 خودت بشمار",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شمرد. عددی که دراومد نه با قبلی می‌خونوند نه با جمعیت. عدد سومی بود. تازه‌ای.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 25, scope: "instigator" }],
              clue: "هر بار شمارش قورباغه‌ها، عدد یکی بیشتر از دفعه‌ی قبلِ قبل است — نه دفعه‌ی قبل.",
            },
          },
          {
            weight: 5,
            text: "{p1} شمرد و درست بود: قورباغه‌ها اکثریتن. قانوناً می‌تونن طرح ارائه بدن.",
            effects: { group: { chaos: 10 }, news: "سرشماری {group}: قورباغه‌ها اکثریت مطلق شدن." },
          },
        ],
      },
      {
        key: "represent",
        label: "🐸 نماینده‌ی قورباغه‌ها شو",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پذیرفت که در جلسات شهری «صدای قورباغه‌ها» باشه. قورباغه‌ها چیزی نگفتن. یعنی تایید.",
            effects: {
              playerStats: [{ stat: "fame", min: 3, max: 7, scope: "instigator" }],
              title: { text: "🐸 نماینده‌ی قورباغه‌ها", chance: 0.25 },
              memory: { kind: "moment", text: "{p1} نماینده‌ی قورباغه‌ها شد", importance: 72 },
            },
          },
        ],
      },
      {
        key: "quiet",
        label: "🤫 این خبر رو نگه دار",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} عدد رو برای خودش نگه داشت. بعضی آمارها آرام‌تر از وقتی که اعلام بشن، همون‌جا می‌مونن.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 2, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "duck_union",
    kind: "chaos",
    emoji: "🦆",
    title: "اردک‌ها تشکل زدن",
    body: "اردک‌های کانال آب کنار {group} تشکل اعلام کردن. مطالبه‌شون فقط یکی: نون باید درجه‌یک باشه، نه دیروز.",
    tags: ["duck", "chaos", "absurd"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 8,
    choices: [
      {
        key: "negotiate",
        label: "🤝 مذاکره",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پشت میز مذاکره نشست. اردک‌ها متحد، منظم، و درست. نونِ درجه‌یک تصویب شد.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 25, scope: "instigator" }],
              treasury: { min: -300, max: -100 },
              group: { reputation: 4 },
              followUp: { templateId: "ducks_relocate", afterMinutesMin: 4320, afterMinutesMax: 8640, chance: 0.35 },
            },
          },
          {
            weight: 4,
            text: "مذاکره شکست خورد چون {p1} پیشنهاد داد نون برشته باشه. اردک‌ها سکوتِ اعتراضی کردن.",
            effects: { group: { chaos: 6 } },
          },
        ],
      },
      {
        key: "scab",
        label: "🍞 نونِ دیروز بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} نون دیروزی ریخت تو کانال. اردک‌ها بالا و پایین نپریدن. فقط نگاه کردن. تا سه روز.",
            effects: {
              playerStats: [{ stat: "money", min: 100, max: 400, scope: "instigator" }],
              group: { chaos: 7 },
              memory: { kind: "scandal", text: "{p1} در اعتصاب اردک‌ها نونِ دیروز داد", importance: 55 },
            },
          },
        ],
      },
      {
        key: "join",
        label: "🦆 عضو شو",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} فرم عضویت رو پر کرد. بخش «نوع» رو دست‌خوش واروونه نوشت: تقریباً اردک.",
            effects: {
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
              title: { text: "🦆 اردکِ افتخاری", chance: 0.2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "upside_down_day",
    kind: "chaos",
    emoji: "🙃",
    title: "روزِ برعکس",
    body: "امروز تو {group} هر چی گفته بشه، معنای برعکسش منظوره. جمله‌ی قبلی هم شاید.",
    tags: ["chaos", "absurd", "callback"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "master",
        label: "🙃 استادش شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} کامل منطق روز رو درک کرد و ازش سوءاستفاده کرد. همه فکر کردن ازش متنفرن. یعنی عاشقشن.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 6, scope: "instigator" },
                { stat: "xp", min: 8, max: 20, scope: "instigator" },
              ],
              relationships: [{ dim: "tension", min: 2, max: 6, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "fight",
        label: "🔨 با منطق بجنگ",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه‌ی جمله‌هاش رو literal گرفت. تا آخر روز، فقط حقیقت گفته شد. شهر گیج و صادق موند.",
            effects: { group: { socialTemp: -5, chaos: 4 } },
          },
        ],
      },
      {
        key: "hug",
        label: "🤗 بگو «ازت متنفرم»",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به {p2} گفت «ازت متنفرم». یعنی دوستت دارم. {p2} گریه‌ی خوشحالی کرد. یا عصبانی شد. تفسیر با خواننده.",
            effects: {
              relationships: [
                { dim: "friendship", min: 3, max: 8, scope: "pair" },
                { dim: "tension", min: 0, max: 4, scope: "pair" },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "spoon_returns",
    kind: "chaos",
    emoji: "🥄",
    title: "قاشق برگشته",
    body: "روی میز وسط {group} یه قاشق هست که تا سه دقیقه پیش نبود. براق‌تر از هر چیزیه که شهر داره.",
    tags: ["spoon", "chaos", "mystery", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "guard",
        label: "🛡 نگهبونی بذار",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شیفت نگهبونی گذاشت. قاشق تا حالا هیچ‌جا نرفته. تا حالا.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              followUp: { templateId: "spoon_censorship", afterMinutesMin: 2880, afterMinutesMax: 7200, chance: 0.3 },
            },
          },
          {
            weight: 5,
            text: "نگهبان‌ها خوابشون برد. قاشق جاش موند. حالا همه از قاشقِ مؤدب ترسیدن.",
            effects: { group: { chaos: 5 } },
          },
        ],
      },
      {
        key: "stir",
        label: "🌀 باهاش هم بزن",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} با قاشق هم زد. چایی که درست شد، طعمِ خاطره‌ی یه باغچه رو می‌داد. باغچه‌ای که کسی یادش نمیاره.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              clue: "قاشق فقط در دست کسی که یادش هست چیه، طعم داره.",
            },
          },
          {
            weight: 6,
            text: "هم زدن به نتیجه‌ی عجیبی نرسید. چایی معمولی شد. قاشق بعدش نصف ساعت گرم بود.",
            effects: {},
          },
        ],
      },
      {
        key: "auction",
        label: "💰 بذارش مزایده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "مزایده‌ی قاشق به {amount} رسید و در لحظه‌ی پایانی، خودِ قاشق خریدار رو انصراف داد. یعنی غیب شد.",
            effects: {
              playerStats: [{ stat: "money", min: -300, max: 900, scope: "instigator" }],
              rumor: { text: "قاشق افسانه‌ای فقط دیده می‌شه تا وقتی کسی نخوادش بخره", truth: true },
            },
          },
        ],
      },
      {
        key: "ignore",
        label: "😌 قاشق هست، باشه",
        style: null,
        outcomes: [
          {
            weight: 7,
            text: "شهر تصمیم گرفت عادی رفتار کنه با شیئی که شاید وجود نداره. موفق نشد. ولی تلاشش ارزشمند بود.",
            effects: { group: { chaos: 3 } },
          },
        ],
      },
    ],
  },
  {
    id: "reality_glitch",
    kind: "chaos",
    emoji: "📺",
    title: "گلیچِ واقعیت",
    body: "برای سه ثانیه، اسم همه‌ی اعضای {group} تو فهرست گروه جابه‌جا شد. کسی که با خودش حرف می‌زد، حالا دوتا شد.",
    tags: ["chaos", "absurd", "world"],
    minMembers: 3,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "screenshot",
        label: "📸 اسکرین‌شات بگیر",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} اسکرین‌شات گرفت. تو عکس، همه چیز درسته. فقط خود {p1} تو عکس نیست.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              clue: "گلیچ‌های شهر همیشه سه ثانیه‌ان. به جز اونی که یادگیری.",
            },
          },
          {
            weight: 5,
            text: "اسکرین‌شات سالم دراومد و دست‌به‌دست چرخید. شهر یدکی از واقعیت داره حالا.",
            effects: { rumor: { text: "عکسِ {p1} از گلیچ، خودش گلیچ داره", truth: false } },
          },
        ],
      },
      {
        key: "reboot",
        label: "🔄 ری‌استارت کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} التماس کرد که واقعیت ری‌استارت بشه. نشد. ولی جاذبه‌ی زمین برای لحظه‌ای معذرت‌خواهی کرد.",
            effects: {
              playerStats: [{ stat: "chaos", min: 3, max: 6, scope: "participants" }],
              group: { chaos: 9 },
            },
          },
        ],
      },
      {
        key: "enjoy",
        label: "✨ لذت ببر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "شهر تصمیم گرفت گلیچ رو تفریح حساب کنه. اسم‌های جا‌به‌جا یه شب قابلِ خنده بودن.",
            effects: { group: { socialTemp: 5 }, relationships: [{ dim: "cooperation", min: 1, max: 3, scope: "all_pairs" }] },
          },
        ],
      },
    ],
  },
  {
    id: "gravity_optional",
    kind: "chaos",
    emoji: "🎈",
    title: "جاذبه اختیاری شد",
    body: "چیزهای سبک {group} شناور شدن. کاغذها، قاشق‌ها، و انگیزه‌ی {p2} — که از قبل شناور بود.",
    tags: ["chaos", "absurd", "world"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "jump",
        label: "🦘 بپر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پرید و سه دقیقه بالای موند. فرود اومد رو چیزی که پارچه‌ی فرش بود و رفاه بود و وقار بود.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
                { stat: "energy", min: -10, max: -4, scope: "instigator" },
              ],
              memory: { kind: "moment", text: "{p1} سه دقیقه پرواز کرد", importance: 68 },
            },
          },
          {
            weight: 5,
            text: "{p1} پرید. جاذبه همین‌جا برگشت. خوش‌شانس: فرود روی تشکِ لحظه‌ای بود که کسی دم در انداخته بود.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "nail",
        label: "🔨 همه چیز رو میخکوب کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تمام وسایل رو میخکوب کرد. وقتی جاذبه برگشت، شهر پر از میخ بود. امن ولی ناراحت.",
            effects: {
              treasury: { min: -250, max: -100 },
              group: { chaos: -5, reputation: 2 },
            },
          },
        ],
      },
      {
        key: "tickets",
        label: "🎟 بلیت بفروش",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} برای «تماشای شناوری» بلیت فروخت. جلسه‌ی اول کوپک بود. جاذبه هم صحنه‌ی دوم رو قطع کرد.",
            effects: {
              playerStats: [{ stat: "money", min: 300, max: 1200, scope: "instigator" }],
              treasury: { min: 100, max: 300 },
              rumor: { text: "جاذبه‌ی {group} به {p1} رشوه می‌ده", truth: false },
            },
          },
        ],
      },
    ],
  },
  {
    id: "frog_mayor_debate",
    kind: "chaos",
    emoji: "🎤",
    title: "مناظره‌ی قورباغه و شهردار",
    body: "امشب مناظره‌ی انتخاباتی {group}: شهردارِ فعلی در برابر یه قورباغه. قورباغه ساکتِ قاطع. نظرسنجی‌ها نزدیکه.",
    tags: ["frog", "election", "chaos"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "moderate",
        label: "🎤 مدیرِ مناظره شو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} مناظره رو مدیریت کرد. قورباغه به هر سؤال، سکوتِ متفاوتی داد. کارشناس‌ها سکوتش رو برنده دونستن.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              group: { influence: 4 },
            },
          },
        ],
      },
      {
        key: "frog_team",
        label: "🐸 کمپین قورباغه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} تراکت قورباغه چاپ کرد. فقط یه کلمه روش بود: «کواک». تأثیرگذارترین کمپین تاریخ محله.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 8 },
              memory: { kind: "moment", text: "{p1} رئیسِ ستاد انتخاباتی قورباغه شد", importance: 70 },
            },
          },
          {
            weight: 5,
            text: "شهردارِ فعلی {p1} را تذکر داد. تراکت‌ها مصادره شدن. قورباغه یه تراکت قایم کرده بود.",
            effects: { relationships: [{ dim: "tension", min: 3, max: 8, scope: "pair" }] },
          },
        ],
      },
      {
        key: "tough_q",
        label: "❓ سؤالِ واقعی بپرس",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پرسید: «بودجه‌ی کانال آب کو؟» سکوت قورباغه این‌بار معنادارتر از همیشه بود. شهردار عرق کرد.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              clue: "بودجه‌ی کانال آب سال 98 صرف چیزی شده که اسمش هنوز عمداً «چیز» است.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "pigeon_bureaucracy",
    kind: "chaos",
    emoji: "🕊",
    title: "اداره‌ی کبوترها",
    body: "کبوترهای میدون {group} صف‌بندی کردن و از رهگذران «مدارک» می‌خوان. چی‌جور مدارکی؟ مشخص نیست. پر هم هست.",
    tags: ["chaos", "absurd", "pet"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 6,
    choices: [
      {
        key: "queue",
        label: "📄 تو صف وایسا",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} دو ساعت تو صف ایستاد. نوبتش که شد، کبوترِ مسئول پرید رو دوشش و مدارک رو امضا کرد با پنجه.",
            effects: {
              playerStats: [
                { stat: "xp", min: 12, max: 28, scope: "instigator" },
                { stat: "energy", min: -8, max: -3, scope: "instigator" },
              ],
              rumor: { text: "مدارک {p1} کبوتریِ رسمی داره", truth: true },
            },
          },
          {
            weight: 5,
            text: "صف {p1} رو جلو نبرد. کبوترها فقط برای {p2} صف رو تند کردن. تبعیضِ پرَیشن.",
            effects: { relationships: [{ dim: "rivalry", min: 2, max: 6, scope: "pair" }] },
          },
        ],
      },
      {
        key: "bribe_seeds",
        label: "🌻 دونه رشوه بده",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} مشتی دونه داد. کل اداره تعطیل شد و دور {p1} چرخیدن. مدارکش رو هم خودش تأیید کردن.",
            effects: {
              playerStats: [
                { stat: "money", min: -250, max: -100, scope: "instigator" },
                { stat: "luck", min: 1, max: 3, scope: "instigator" },
              ],
              group: { chaos: 5 },

            },
          },
        ],
      },
      {
        key: "report",
        label: "🏛 شکایت کن",
        style: null,
        outcomes: [
          {
            weight: 7,
            text: "{p1} شکایت نوشت. کبوترها شکایت رو دریافت کردن، مهر کردن، و ساوه کردنش — با سوییکِ سفارشی.",
            effects: { playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "cat_mayor_decree",
    kind: "chaos",
    emoji: "🐈",
    title: "فرمانِ گربه‌ی شهردار",
    body: "گربه‌ی شهردار فرمان شماره‌ی یک صادر کرد: «همه‌ی پاها متعلق به عموم است.» فرمان با مُهرِ پنجه است. معتبر.",
    tags: ["cat", "pet", "chaos", "election"],
    minMembers: 2,
    cooldownMinutes: 2160,
    weight: 7,
    choices: [
      {
        key: "comply",
        label: "🧶 اطاعت کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پاش رو عمومی اعلام کرد. گربه‌ی شهردار رو پاهای {p1} استراحت کرد. شهر افتخار کرد.",
            effects: {
              playerStats: [{ stat: "reputation", min: 1, max: 4, scope: "instigator" }],
              group: { reputation: 3, socialTemp: 4 },
            },
          },
        ],
      },
      {
        key: "resist",
        label: "✊ پاهای من، ملیِ من",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} فرمان رو رد کرد. گربه‌ی شهردار فقط نگاه کرد. {p1} از فردا هرجا می‌شینه، یه گربه‌ی ناشناس کنارشه. منتظر.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 6 },
            },
          },
        ],
      },
      {
        key: "interpret",
        label: "📜 فرمان رو تفسیر کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تفسیر رسمی منتشر کرد: «پا» یعنی «قدم». پس همه باید راه برن، عمومی. شهر پیاده‌روی صبحی گرفت.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 20, scope: "instigator" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "stairs_elsewhere",
    kind: "chaos",
    emoji: "🪜",
    title: "پله‌ها جای دیگه می‌رسن",
    body: "پله‌های {group} که به بام می‌رفتن، حالا به یه نسخه‌ی «تمیزتر و آروم‌ترِ» همون بام می‌رسن. عین‌همه. فقط خورشید یه‌کم مؤدب‌تره.",
    tags: ["chaos", "absurd", "mystery"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "climb",
        label: "🪜 برو بالا",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بالا رفت و کلی وقت اونجا گذروند. برگشت، فقط گفت «آرام‌تره». دیگه هیچ‌وقت توضیح نداد.",
            effects: {
              playerStats: [{ stat: "xp", min: 15, max: 35, scope: "instigator" }],
              clue: "بامِ دوم یه پنجره داره که به کوچه‌ی اصلی برمی‌گرده — از بیرون.",
            },
          },
          {
            weight: 5,
            text: "{p1} بالا رفت. وقتی برگشت، کفش‌هاش تمیز بود. از جایی که خاک نداره.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 2, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "block",
        label: "⛔ قفل کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} درِ پله‌ها رو قفل کرد. کلیدش رو نگه داشت. بعضی شب‌ها صدای پایی از پشت در میاد که پای خودشه.",
            effects: {
              playerStats: [{ stat: "crime", min: 0, max: 1, scope: "instigator" }],
              group: { chaos: -4 },
            },
          },
        ],
      },
      {
        key: "tour",
        label: "🎫 تور برگزار کن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تورِ «بامِ مؤدب» راه انداخت. بازدیدکننده‌ها راضی بودن. یکی‌شون موند. هنوز مونده.",
            effects: {
              playerStats: [{ stat: "money", min: 200, max: 900, scope: "instigator" }],
              group: { chaos: 5, reputation: 2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "spoon_rain",
    kind: "chaos",
    emoji: "🌧",
    title: "بارونِ قاشق",
    body: "بارون گرفت. بعد سه دقیقه مشخص شد بارون قاشقه. همه جا قاشق. هیچ‌کدوم قاشقِ افسانه‌ای نیست. همه دارن چک می‌کنن.",
    tags: ["spoon", "chaos", "weather", "absurd"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 5,
    choices: [
      {
        key: "collect",
        label: "🥄 جمع کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} چهار قاشق جمع کرد. فروشی‌شن، براق‌شن، و رو دسته‌ی یکی‌شون حکاکی هست: «معلوم نیست».",
            effects: {
              playerStats: [{ stat: "money", min: 150, max: 700, scope: "instigator" }],
              clue: "قاشق‌های بارون‌زده همه «معلوم نیست» ان. به جز اونی که تو خواب دیدی.",
            },
          },
        ],
      },
      {
        key: "shelter",
        label: "☂ پناه بگیر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} زیر سقف ایستاد و تماشا کرد. یه قاشق وسط هوا یه لحظه مکث کرد و به {p1} نگاه کرد. بعد ادامه داد.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "insurance",
        label: "📄 خسارت بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ادعای خسارتِ «بارش فلزی» کرد. کارشناس بیمه اومد، قاشق‌ها رو دید، استعفا داد.",
            effects: { playerStats: [{ stat: "money", min: -100, max: 500, scope: "instigator" }] },
          },
          {
            weight: 5,
            text: "ادعای {p1} پذیرفته شد. مبلغ: یه قاشق. از جنس کاغذ.",
            effects: { playerStats: [{ stat: "luck", min: -2, max: 1, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "frog_oracle",
    kind: "chaos",
    emoji: "🔮",
    title: "قورباغه‌ی پیشگو",
    body: "قورباغه‌ای که با چشمک زدنش هوا رو پیش‌بینی می‌کنه، امروز اصلاً چشمک نزد. هوا هم فوق‌العاده‌ست. یعنی چی؟",
    tags: ["frog", "chaos", "mystery", "weather"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "consult",
        label: "🔮 مشورت بگیر",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} زیر لب سؤالش رو پرسید. قورباغه سرش رو کج کرد. جواب همین بود: کج.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 20, scope: "instigator" }],
              title: { text: "🔮 پیشگوِ قورباغه", chance: 0.12 },
            },
          },
          {
            weight: 5,
            text: "قورباغه به {p1} نگاه کرد، بعد به آسمون، بعد دوباره به {p1}. {p1} هفته‌ی خوبی داشت. دلیلش همین بود کافی بود.",
            effects: { playerStats: [{ stat: "luck", min: 2, max: 4, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "vet",
        label: "🩺 دکتر ببرش",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} قورباغه رو دم دکتر برد. دکتر گفت سالمه، فقط «فکر می‌کنه». تشخیص‌ش با شهر یکی بود.",
            effects: {
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "instigator" }],
              group: { reputation: 2 },
            },
          },
        ],
      },
      {
        key: "bet",
        label: "🎲 شرط ببند",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با {p2} شرط بست که فردا بارون میاد. نشد. قورباغه هم چیزی نگفته بود. گناه از {p1} بود و {p1} پرداخت.",
            effects: {
              playerStats: [{ stat: "money", min: -700, max: -200, scope: "instigator" }],
              relationships: [{ dim: "rivalry", min: 1, max: 4, scope: "pair" }],
            },
          },
          {
            weight: 5,
            text: "شرطِ {p1} درست از آب دراومد: فردا توی بارون، یه مِتری آفتاب اومد. فقط رو {p1}. {p2} پرداخت کرد و شمرد.",
            effects: {
              playerStats: [
                { stat: "money", min: 200, max: 800, scope: "instigator" },
                { stat: "luck", min: 1, max: 2, scope: "instigator" },
              ],

            },
          },
        ],
      },
    ],
  },
  {
    id: "time_slip",
    kind: "chaos",
    emoji: "🕰",
    title: "امروز، دیروزه",
    body: "تقویم {group} می‌گه امروز دیروزه. نصف خاطره‌ها جورِ دیگه‌ان. {p2} قسم می‌خوره یه چیزی که دیروز اتفاق افتاد، فردا میفته.",
    tags: ["chaos", "absurd", "mystery"],
    minMembers: 3,
    cooldownMinutes: 4320,
    weight: 5,
    choices: [
      {
        key: "embrace",
        label: "🔁 دیروز رو دوباره زندگی کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} قبول کرد که دیروزه و رفت دنبال کارهایی که دیروز کرده بود. امروز، فردا شد. هیچ‌کس متوجه نشد.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              group: { chaos: 6 },
            },
          },
        ],
      },
      {
        key: "fix",
        label: "🔧 تقویم رو درست کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تقویم رو تنظیم کرد. تاریخ درست شد، ولی {p2} هنوز مطمئنه سه روز آینده رو دیده. کارشناس‌ها: ممکنه.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              clue: "تقویم شهر بعد از هر «بازنشانی» سه روز جلو می‌افته — یا عقب. بستگی داره کی نگاه می‌کنه.",
            },
          },
        ],
      },
      {
        key: "ask_p2",
        label: "🔮 از {p2} بپرس فردا چیه",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p2} گفت: «فردا مثل امروزه، ولی بامید.» کل {group} ساکت شد. جمله روی دیوار نوشته شد.",
            effects: {
              relationships: [{ dim: "trust", min: 3, max: 7, scope: "pair" }],
              memory: { kind: "moment", text: "{p2} جمله‌ای گفت که روی دیوار مونده", importance: 66 },
            },
          },
        ],
      },
    ],
  },

  // ═══ شخصیت‌ها (۱) ═══
  {
    id: "npc_arash_deal",
    kind: "npc",
    emoji: "🤝",
    title: "آرش با یه معامله اومده",
    body: "آرش دلالِ بازار سر زده به {group} اومده. چمدونش رو باز کرد: سه‌تا {item}، «کیشِ قاچاق نه، ترانزیتِ محترمانه».",
    tags: ["npc", "money", "crime", "item"],
    minMembers: 2,
    cooldownMinutes: 360,
    weight: 10,
    choices: [
      {
        key: "buy",
        label: "💸 بخر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} خرید. {item}ها اصل بودن. منشأشون؟ آرش فقط پترکِ شونه رو بالا انداخت: «همه‌چیز از یه‌جایی میاد.»",
            effects: {
              playerStats: [
                { stat: "money", min: -900, max: -300, scope: "instigator" },
                { stat: "crime", min: 1, max: 3, scope: "instigator" },
              ],
              group: { crime: 3 },
            },
          },
          {
            weight: 5,
            text: "معامله انجام شد و {item} بعد از یه ساعت آب شد. آرش از قبل سه کوچه اون‌ورتر بود.",
            effects: {
              playerStats: [{ stat: "money", min: -700, max: -250, scope: "instigator" }],
              rumor: { text: "آرش آخرین بار یه {item} مذاب فروخته", truth: true },
            },
          },
        ],
      },
      {
        key: "report",
        label: "🚨 خبر بده به نعمتی",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به سرگرد نعمتی خبر داد. نعمتی اومد، به چمدون نگاه کرد، به آرش نگاه کرد، آه کشید: «آرش‌جان، دوباره؟» آرش رفت. بدون چمدون.",
            effects: {
              playerStats: [
                { stat: "reputation", min: 2, max: 5, scope: "instigator" },
                { stat: "money", min: 100, max: 350, scope: "instigator" },
              ],
              group: { crime: -4, reputation: 3 },
            },
          },
        ],
      },
      {
        key: "counter",
        label: "🧠 چانه بزن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} قیمت رو نصف کرد. آرش یه قدم عقب رفت — از احترام. «برای خودت می‌فروشم.» عبارتِ خطرناکیه.",
            effects: {
              playerStats: [
                { stat: "money", min: -450, max: -150, scope: "instigator" },
                { stat: "xp", min: 8, max: 16, scope: "instigator" },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_mahoor_closed",
    kind: "npc",
    emoji: "☕",
    title: "کافه ماهور تعطیله",
    body: "روی درِ کافه خانم ماهور Noteی زده: «امروز تعطیل. به دلایلی.» لحنِ «به دلایلی» همه‌ی {group} رو بی‌قرار کرده.",
    tags: ["npc", "mystery", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 9,
    choices: [
      {
        key: "respect",
        label: "🙏 احترام بذار و برعکس کار نکن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} فقط گل جلوی در گذاشت. فردا کافه باز بود و چایِ {p1} یه شاخه‌ی نعناع اضافه داشت. سؤال نپرسید.",
            effects: {
              playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }],
              group: { reputation: 2 },
            },
          },
        ],
      },
      {
        key: "peek",
        label: "👀 از پنجره نگاه کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} از پنجره نگاه کرد. ماهور داشت به یه صندلی خالی قهوه می‌ذاشت. دو تا فنجون. یکی بخار نداشت.",
            effects: {
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
              clue: "ماهور هر سال یک روز برای کسی که نیست تعطیل می‌کند. اسم او در هیچ اسنادی نیست.",
            },
          },
          {
            weight: 5,
            text: "قبل از {p1} چیزی ببینه، پرده کشیده شد. از پشت شیشه فقط سایه‌ای بود که اشاره کرد: برعکس کار نکن.",
            effects: { relationships: [{ dim: "tension", min: 1, max: 3, scope: "pair" }] },
          },
        ],
      },
      {
        key: "alternative",
        label: "☕ کافه جایگزین بساز",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با چای‌دانِ قرضی یه بساط موقت انداخت. «کافه‌ی {p1}» یه روزِ کامل رونق داشت. ماهور فردا لبخند زد. لبخندِ رقابتی.",
            effects: {
              playerStats: [
                { stat: "money", min: 150, max: 600, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],
              treasury: { min: 100, max: 250 },
            },
          },
          {
            weight: 5,
            text: "بساط {p1} ساعتی دوام آورد. چای پَره. دستمزدِ تجربه: کم. درس: زیاد.",
            effects: { playerStats: [{ stat: "xp", min: 6, max: 15, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "npc_nemati_investigates",
    kind: "npc",
    emoji: "🚔",
    title: "نعمتی «بازدید محترمانه»",
    body: "سرگرد نعمتی اومده تو {group}. دفترش رو باز کرد، هیچی ننوشت، گفت: «ادامه بدید. من فقط می‌شینم.» و نشست.",
    tags: ["npc", "crime", "mystery"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "normal",
        label: "🎭 عادی رفتار کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} قدری عادی رفتار کرد — یعنی چنان عادی که مشکوک شد. نعمتی یه خط نوشت. خطِ اولِ امروز.",
            effects: {
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
              followUp: { templateId: "npc_nemati_frog_file", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.35 },
            },
          },
          {
            weight: 5,
            text: "شهر کامل عادی رفتار کرد و نعمتی بعد یه ساعت خسته شد و رفت. بی‌تو. یه برگه جا گذاشت: «مرسی».",
            effects: { group: { crime: -3 } },
          },
        ],
      },
      {
        key: "coffee",
        label: "☕ براش قهوه ببر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} قهوه برداشت. نعمتی مکث کرد، بعد گفت: «سال 98 هم کسی همین کارو کرد.» با قهوه رو رفت. کاسه موند.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              clue: "نعمتی هر وقت «سال 98» می‌گه، بعدش یه چیزی از شهر برمی‌داره. هیچ‌وقت مهم نیست.",
            },
          },
        ],
      },
      {
        key: "confess",
        label: "🫠 بی‌دلیل اعتراف کن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اعتراف کرد به چیزی که یادش نیست. نعمتی با حوصله گفت: «این جوابِ 98 هم بود.» و ادامه داد به نوشتن.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              group: { socialTemp: 5 },
              rumor: { text: "{p1} به نعمتی اعتراف کرد. به هیچی.", truth: true },
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_roghieh_broadcast",
    kind: "npc",
    emoji: "📡",
    title: "رقیه داره پخش می‌کنه",
    body: "رقیه هکرِ ناشناس روی فرکانس رادیوییِ {group} یه گزارش پخش می‌کنه: «میانگینِ خلقِ امروزِ شما: 61% دل‌شوره. ادامه‌ی برنامه‌ها...»",
    tags: ["npc", "mystery", "chaos"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 8,
    choices: [
      {
        key: "listen",
        label: "📻 گوش بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کامل گوش داد. گزارش دقیق بود. جمله‌ی آخر: «61% رو می‌شه بالا برد. ابزارها: در اختیار خودتونه.»",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 25, scope: "instigator" }],
              group: { socialTemp: 4 },
            },
          },
          {
            weight: 4,
            text: "گزارش {p1} رو اسم‌برد: «ی نفر فقط گوش می‌ده. سلام {p1}.» {p1} هنوز رادیو رو نریخته زمین.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "reply",
        label: "📡 جواب بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} به فرکانس پیام داد. سه ثانیه سکوت. بعد: «ثبت شد.» {p1} الان تو یه لیسته. همه تو یه لیستن. فکرش رو نکن.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              clue: "رقیه فقط جواب کسایی رو می‌ده که پیام‌شون از ترس یا از کنجکاویه. از ادب نه.",
            },
          },
        ],
      },
      {
        key: "boost",
        label: "🎉 میانگین رو بالا ببر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شروع کرد به خندوندن {p2} و {p3}. تا آخر روز، فرکانس گزارشِ 61% رو عوض کرد: «74% شادی. عامل: نامشخص.»",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -4 },
              playerStats: [{ stat: "fame", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_ghambar_forgets",
    kind: "npc",
    emoji: "🧺",
    title: "عمو قنبر یادش رفته",
    body: "عمو قنبر مغازه‌دارِ قدیمی وسط {group} ایستاده. یه سبد پر از بیسکوییت داره و یه دلیل. دلیل یادش رفته.",
    tags: ["npc", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 480,
    weight: 9,
    choices: [
      {
        key: "cookies",
        label: "🍪 بیسکوییت بخر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از سبد بیسکوییت گرفت. قنبر خندید: «برای همین اومده بودم.» دلیل پیدا شد. یا ساخته شد. فرقی نمی‌کنه.",
            effects: {
              playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }],
              group: { socialTemp: -3 },
            },
          },
        ],
      },
      {
        key: "remind",
        label: "🧠 کمکش کن یادش بیاد",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شروع کرد به سؤال‌های قدیمی. قنبر یهو گفت: «نیمکت! برای نیمکت اومده بودم!» و رفت. سبد جا موند.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              followUp: { templateId: "build_bench", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.3 },
            },
          },
          {
            weight: 5,
            text: "هر چی {p1} پرسید، قنبر فقط یه چیز یادش اومد: «مغازه‌ام روزی یه پنجره‌ی آبی داشت.» مغازه‌ش پنجره نداره.",
            effects: { clue: "مغازه‌ی قنبر قبل از بازنشانیِ شهر، پنجره‌ی آبی داشته — رو به منطقه‌ی ممنوعه." },
          },
        ],
      },
      {
        key: "watch",
        label: "🪑 براش صندلی بیار",
        style: null,
        outcomes: [
          {
            weight: 7,
            text: "{p1} براش صندلی آورد. قنبر نشست، سبد رو بغل کرد، و به کوچه نگاه کرد که فقط او یادشه. همه به احترامش ساکت موندن.",
            effects: { group: { reputation: 3 }, relationships: [{ dim: "cooperation", min: 1, max: 3, scope: "all_pairs" }] },
          },
        ],
      },
    ],
  },

  // ═══ شخصیت‌ها (۲) ═══
  {
    id: "npc_kimo_sells",
    kind: "npc",
    emoji: "🧿",
    title: "کیمو یه چیزِ ریز می‌فروشه",
    body: "کیمو بچه‌ی خیابون دستش رو باز کرد جلوی {p1}: یه دکمه. «مالِ یه نفرِ مهمه. نمی‌گم کیه. {amount} سکه.»",
    tags: ["npc", "item", "money", "mystery"],
    minMembers: 1,
    cooldownMinutes: 480,
    weight: 10,
    choices: [
      {
        key: "buy",
        label: "🧿 بخرش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} دکمه رو خرید. دکمه به هیچ لباسی نمی‌خوره. ولی یه‌جایی، یه نفرِ مهم داره لباسش رو با دستِ باز نگه می‌داره.",
            effects: {
              playerStats: [
                { stat: "money", min: -400, max: -120, scope: "instigator" },
                { stat: "luck", min: 1, max: 3, scope: "instigator" },
              ],
              clue: "دکمه‌های گمشده‌ی شخصیت‌های مهم شهر، همیشه به کیمو برمی‌گردن.",
            },
          },
          {
            weight: 5,
            text: "معامله انجام شد. کیمو دو قدم رفت، برگشت، دکمه‌ی دوم رو هم داد: «قابله. این یکی مجانی.»",
            effects: {
              playerStats: [
                { stat: "money", min: -350, max: -100, scope: "instigator" },
                { stat: "luck", min: 2, max: 4, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "trade",
        label: "🍬 با خوراکی معامله کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه چیز شیرین داد. کیمو قبول کرد و دکمه رو نداد. گفت: «این یکی رو نگه می‌دارم. واسه روزِ خوب.»",
            effects: {
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "instigator" }],
              relationships: [{ dim: "friendship", min: 1, max: 3, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "ask",
        label: "❓ بپرس مالِ کیه",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "کیمو گفت: «مالِ کسیه که برمی‌گرده.» بعد یه نانِ نیمه‌خورده گرفت از {p1} و رفت سمت کانال.",
            effects: {
              playerStats: [{ stat: "xp", min: 6, max: 14, scope: "instigator" }],
              rumor: { text: "کیمو می‌گه یه نفرِ مهم داره برمی‌گرده", truth: false },
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_fahhad_smiles",
    kind: "npc",
    emoji: "💳",
    title: "دایی فرهاد به همه لبخند زد",
    body: "دایی فرهاد قرض‌دهنده از {group} رد شد و به تک‌تک اعضا لبخند زد. لبخندِ گرم. محاسبه‌شده. مهرِ تاریخ نداره.",
    tags: ["npc", "money", "crime"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 9,
    choices: [
      {
        key: "smile_back",
        label: "😀 لبخند جواب بده",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} لبخند برگردوند. فرهاد زیر لب گفت: «حسابت رو یه پله بالاتر بردم.» یعنی کدوم پله؟ پله‌ی خوب یا پله‌ی بعدیِ بعدی؟",
            effects: {
              playerStats: [{ stat: "luck", min: -1, max: 2, scope: "instigator" }],
              followUp: { templateId: "debt_collector", afterMinutesMin: 1440, afterMinutesMax: 5760, chance: 0.35 },
            },
          },
        ],
      },
      {
        key: "hide",
        label: "🫣 قایم شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پشت {p2} قایم شد. فرهاد فقط {p2} رو نگاه کرد و گفت: «ضامنِ خوبی داری.» {p2} هنوز می‌خنده. گاردِ پایین.",
            effects: {
              relationships: [{ dim: "tension", min: 3, max: 8, scope: "pair" }],
              playerStats: [{ stat: "chaos", min: 1, max: 2, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "settle",
        label: "💰 یه چیزی بده که بدهی نباشه",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه قسطِ نمادینی داد. فرهاد قبول کرد، مُهر زد، و برای اولین بار لبخندش یه ذره واقعی بود.",
            effects: {
              playerStats: [
                { stat: "money", min: -600, max: -200, scope: "instigator" },
                { stat: "reputation", min: 2, max: 4, scope: "instigator" },
              ],
              group: { crime: -2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_unknown_seen",
    kind: "npc",
    emoji: "❓",
    title: "«؟؟؟» دیده شد",
    body: "{p3} می‌گه گوشه‌ی {group} یه نفر ایستاده بود که اسمش رو کسی بلد نیست. به {p3} دست تکان داد. یا ساعتی رو داره بالا نگه داشته.",
    tags: ["npc", "mystery", "chaos"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "approach",
        label: "🚶 نزدیک شو",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} نزدیک شد. اون‌جا کسی نبود. فقط یه ریبونِ صورتی روی زمین، هنوز گرم از گرمایِ روز. و یه شماره: 98.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              clue: "«؟؟؟» همیشه قبل از یکی از «بازنشانی‌ها» دیده شده. همیشه با ریبون.",
            },
          },
          {
            weight: 6,
            text: "{p1} نزدیک شد. یه غریبه‌ی معمولی بود که اشتباهی اومده بود. معذرت‌خواهی کرد و رفت. روزِ بعد، از هیچ‌کس حرف نزد چون ساکت بود. این داستان‌ها زود تموم می‌شن.",
            effects: { playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "wave",
        label: "👋 دست تکان بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از دور دست تکان داد. جواب سلام رسید: پرِ گربه. سه تا. تازه. روی پنجره‌ی {p1}.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "log",
        label: "📓 ثبتش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} ساعت و شکل و جهت رو ثبت کرد. تو آرشیو {group}، این سومین «؟؟؟» است. دوتای قبلی هم هیچ‌وقت حل نشدن.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { influence: 2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_arash_auction",
    kind: "npc",
    emoji: "🔨",
    title: "مزایده‌ی آرش",
    body: "آرش میز گذاشته وسط {group}: «ترکه‌ی یه ملکه‌ی کهن. سند ندارم. ولی چه سندی از این قشنگ‌تر؟» جنس: یه {item} قدیمی.",
    tags: ["npc", "money", "item", "crime"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "bid",
        label: "🔨 پیشنهاد بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بالاترین پیشنهاد رو داد و برد. {item} مالِ {p1} شد. آرش موقع تحویل گفت: «مزایده بعدی، چیزِ بزرگ‌تره.» و پچ‌پچ خندید.",
            effects: {
              playerStats: [
                { stat: "money", min: -1200, max: -400, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],
              rumor: { text: "{p1} از مزایده‌ی آرش یه اثرِ تاریخی خریده", truth: false },
            },
          },
          {
            weight: 5,
            text: "پیشنهاد {p1} با یه غریبه‌ی پیرزن رقابت کرد و باخت. پیرزن {item} رو گرفت، آرش رو بغل کرد و رفت. آرش پریشون شد.",
            effects: { playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "appraise",
        label: "🔍 کارشناسیش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با ذره‌بین نگاه کرد: ساختِ امروزی، پاتینِ ساختگی، و یه حکاکی واقعی: «مالِ کافه‌ی ماهور». آرش چشم‌هاش رو بست.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              clue: "یه عالم جنسِ «ترکه»ی آرش اصلأ از کافه‌ی ماهور میاد — شب‌ها.",
            },
          },
        ],
      },
      {
        key: "boycott",
        label: "🙅 شرکت نکن",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "هیچ‌کس مزایده رو جدی نگرفت. آرش چمدونش رو بست: «شهر هنوز آماده‌ست برای بزرگ‌ترها.» جمله‌ش بعداً میم شد.",
            effects: { group: { socialTemp: 3 }, rumor: { text: "آرش دنبال «چیزِ بزرگ‌تر» است", truth: true } },
          },
        ],
      },
    ],
  },
  {
    id: "npc_mahoor_recipe",
    kind: "npc",
    emoji: "🥘",
    title: "دستورِ پختِ جدیدِ ماهور",
    body: "خانم ماهور یه برگه به {group} داد: دستورِ «حلیمِ شبِ قرمز». یه ماده‌ی آخرش عجیبه: «یک مشت از هوایِ شبِ که هرگز نبوده».",
    tags: ["npc", "wholesome", "mystery", "festival"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 8,
    choices: [
      {
        key: "cook_gather",
        label: "🍳 گروهی بپزید",
        style: "success",
        outcomes: [
          {
            weight: 5,
            text: "همه با هم پختن. برای ماده‌ی آخر، {p2} یه قوطی خالی باز کرد «هوای شب». حلیم معرکه شد. ماهور از راه رسید و تاییدش کرد با یه قاشق.",
            effects: {
              playerStats: [{ stat: "energy", min: 5, max: 12, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
              treasury: { min: -150, max: -50 },
              memory: { kind: "moment", text: "شبِ حلیمِ ماهور در {group}", importance: 70 },
            },
          },
          {
            weight: 5,
            text: "حلیم شد دیگه یه چیزی. نه حلو، نه سوپ، نه شام. شهر اسمش گذاشت «ماهوری». ماهور گفت پخته‌ش خوبه، ماده‌ی آخر کمی زیاد شده.",
            effects: { group: { socialTemp: 5, chaos: 3 } },
          },
        ],
      },
      {
        key: "substitute",
        label: "🔄 جایگزین پیدا کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به جای «هوای شبِ که نبوده» از تهویه‌ی کافه استفاده کرد. نتیجه: خوردنی. ماهور گفت: «تقلبِ قابل قبولی بود.»",
            effects: {
              playerStats: [
                { stat: "xp", min: 8, max: 20, scope: "instigator" },
                { stat: "money", min: 50, max: 250, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "secret",
        label: "🕵️ بپرس این ماده‌ی آخر چیه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پرسید. ماهور با مکث گفت: «ماهِ قرمزِ امسال رو دیدی؟ همون.» بعد برگشت سر کارش. هیچ‌کس دوباره نپرسید.",
            effects: {
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
              clue: "ماهور در راهنمای آشپزی‌اش از ماهِ قرمز به عنوان «ماده‌ی مصرفی» یاد می‌کند.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_nemati_frog_file",
    kind: "npc",
    emoji: "🗂",
    title: "پرونده‌ی قورباغه",
    body: "سرگرد نعمتی یه پرونده‌ی زرد روی میخ کرده جلوی {group}: «موضوع: قورباغه‌ها. وضعیت: در حال بررسی.» همه می‌دونن یعنی نعمتی هم گیجه.",
    tags: ["npc", "frog", "mystery", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "read",
        label: "📂 ورق بزن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ورق زد. داخلش فقط عکس‌های خال‌خالی بود. یکی از عکس‌ها از بامِ {group} بود. تاریخش: فردا.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              clue: "پرونده‌ی قورباغه‌ی نعمتی یه عکس از آینده داره. هیچ‌کس دوباره پیدا نکردهش.",
            },
          },
          {
            weight: 5,
            text: "پرونده خالی بود. یه برگه فقط: «اگر خالی است، پس کجاست؟» با خطِ نعمتی. نعمتی سوالم رو از شهر پرسیده بود.",
            effects: { playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "contribute",
        label: "🗂 گزارش بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گزارشِ قورباغه‌شناسی داد. نعمتی جدی گرفت، یادداشت کرد، و گفت: «شما هم باید وارد مذاکره با اون‌ها بشید.»",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              followUp: { templateId: "frog_city_council", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.4 },
            },
          },
        ],
      },
      {
        key: "help",
        label: "🐸 نامه‌ای به قورباغه‌ها بنویس",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} نامه نوشت به قورباغه‌ها و گذاشت کنار کانال. صبح، نامه جواب خورده بود: «کواک.» ترجمه‌ی رسمی منتشر شد: «دریافت شد.»",
            effects: {
              playerStats: [{ stat: "fame", min: 1, max: 4, scope: "instigator" }],
              group: { chaos: 4, reputation: 2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "npc_ghambar_key",
    kind: "npc",
    emoji: "🗝",
    title: "کلیدِ بی‌قفل",
    body: "عمو قنبر یه کلید قدیمی جا گذاشته رو یه طاقچه‌ی {group}. هیچ قفلی تو شهر باهاش باز نمی‌شه. {p2} امتحان کرده. دوبار.",
    tags: ["npc", "mystery", "item"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "try",
        label: "🗝 همه‌ی درها رو امتحان کن",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} صد در رو امتحان کرد. صد و یکمی باز شد: درِ یه اتاقکِ برقی که فکر می‌کردیم از دهه‌ی پیش از این خرابه. لامپش روشن بود.",
            effects: {
              playerStats: [
                { stat: "xp", min: 12, max: 28, scope: "instigator" },
                { stat: "chaos", min: 2, max: 4, scope: "instigator" },
              ],
              clue: "کلید قنبر درِ اتاقکِ برقیِ پشت کافه را باز می‌کند. لامپش هیچ‌وقت خاموش نیست.",
            },
          },
          {
            weight: 6,
            text: "کلید هیچ دری رو باز نکرد. ولی هر جا امتحان می‌شد، سگ‌های محله یه بار واق‌واق می‌کردن. دقیقاً یه بار.",
            effects: { playerStats: [{ stat: "luck", min: -1, max: 1, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "return",
        label: "🧺 پس بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کلید رو برگردوند. قنبر گریه‌ی ریز کرد: «این کلیدِ پنجره‌ی آبی‌ه.» بعد سبدش رو برداشت و رفت سمت مغازه، مسیرِ اشتباه.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              group: { reputation: 2 },
            },
          },
        ],
      },
      {
        key: "map",
        label: "🗺 نقشه‌ی قفل‌ها بکش",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} نقشه کشید از همه‌ی قفل‌های شهر و دندونه‌های کلید. چیزی بخور نبود. {p3} گوشه‌ی نقشه نوشت: «شاید قفلش تو شهرِ قبل بوده.»",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { influence: 2 },
            },
          },
        ],
      },
    ],
  },

  // ═══ اقتصاد ═══
  {
    id: "market_crash",
    kind: "economic",
    emoji: "📉",
    title: "سقوطِ بازار",
    body: "بازارِ محله {item} رو ول کرد. قیمت‌ها دارن سقوط می‌کنن. {p2} هنوز داره می‌خنده؛ نفهمیده سهمش هم داره می‌ره پایین.",
    tags: ["money", "chaos", "item"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 10,
    choices: [
      {
        key: "buy_dip",
        label: "📉 سقوط رو بخر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} تهِ بازار خرید. دو روز بعد قیمت برگشت. {p1} حالا «نابغه‌ی محله»ـه. تا سقوط بعدی.",
            effects: {
              playerStats: [
                { stat: "money", min: 300, max: 1600, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],
            },
          },
          {
            weight: 5,
            text: "{p1} خرید و بازار ادامه‌ی سقوط رو تایید کرد. {item}ها الان مبلغِ خاطره‌ان. یعنی هیچ.",
            effects: {
              playerStats: [{ stat: "money", min: -1000, max: -350, scope: "instigator" }],
              rumor: { text: "{p1} سرش رو یه سقوطِ بازار کوبید", truth: true },
            },
          },
        ],
      },
      {
        key: "stabilize",
        label: "🏛 صندوق رو بذار جلو",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{group} بخشی از صندوق رو گذاشت جلوی قیمت‌ها. بازار آروم شد. کسی نمی‌دونه از کجا اومد این قدرت. صندوق می‌دونه.",
            effects: {
              treasury: { min: -800, max: -300 },
              group: { reputation: 5, influence: 4 },
            },
          },
        ],
      },
      {
        key: "short",
        label: "🎭 شرطِ سقوط ببند",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} با {p3} شرط بست که بازار می‌ریزه. ریخت. {p3} گفت: «تو ریختیش.» تقصیر رو هیچ‌کس نپذیرفت، پول رو {p1} قبول کرد.",
            effects: {
              playerStats: [
                { stat: "money", min: 150, max: 700, scope: "instigator" },
                { stat: "crime", min: 0, max: 2, scope: "instigator" },
              ],
              relationships: [{ dim: "tension", min: 2, max: 6, scope: "pair" }],
            },
          },
          {
            weight: 6,
            text: "شرطِ {p1} خورد چون بازار برگشت. {p3} برد و تا یه هفته هر جا می‌رفت می‌گفت: «من گفتم.»",
            effects: {
              playerStats: [{ stat: "money", min: -600, max: -200, scope: "instigator" }],
              relationships: [{ dim: "rivalry", min: 1, max: 4, scope: "pair" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "item_price_explosion",
    kind: "economic",
    emoji: "🚀",
    title: "قیمتِ {item} منفجر شد",
    body: "یه غریبه‌ای خرید و قیمتِ {item} سقوط کرد — به سمت بالا. الان هر {item} یه ماه‌ه جوازِ داشتنش سخت‌تر از خودشه.",
    tags: ["money", "item"],
    minMembers: 2,
    cooldownMinutes: 360,
    weight: 11,
    choices: [
      {
        key: "sell_all",
        label: "💰 همه‌ت رو بفروش",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} هرچی {item} داشت فروخت و سود کرد. حالا {group} یه «تولنِ سابقِ {item}» داره با پولِ تازه.",
            effects: {
              playerStats: [{ stat: "money", min: 500, max: 2200, scope: "instigator" }],
              treasury: { min: 100, max: 400 },
            },
          },
          {
            weight: 4,
            text: "{p1} فروخت و دقیقاً فرداش قیمت دو برابر شد. {p1} به سقف نگاه کرد. سقف جوابی نداشت.",
            effects: {
              playerStats: [
                { stat: "money", min: 200, max: 600, scope: "instigator" },
                { stat: "luck", min: -3, max: -1, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "pool",
        label: "🤝 ذخیره‌ی گروهی بساز",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{group} انبارِ جمعیِ {item} راه انداخت. قیمت هم بالا موند، ولی کسی گرسنه از {item} نموند. سوسیالِ اقتصادی.",
            effects: {
              treasury: { min: -400, max: -150 },
              relationships: [{ dim: "cooperation", min: 3, max: 6, scope: "all_pairs" }],
              group: { reputation: 4 },
            },
          },
        ],
      },
      {
        key: "fake_shortage",
        label: "🎭 کمبود ساختگی شایعه کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شایعه کرد که {item} تموم می‌شه. قیمت بالا رفت. {p1} فروخت. نعمتی از راه رسید. قصه فلج شد.",
            effects: {
              playerStats: [
                { stat: "money", min: 400, max: 1500, scope: "instigator" },
                { stat: "crime", min: 2, max: 5, scope: "instigator" },
              ],
              group: { crime: 5 },
              rumor: { text: "کمبودِ {item} ساختگی بوده", truth: true },
            },
          },
          {
            weight: 5,
            text: "شایعه‌ی {p1} جواب نداد چون {p3} از صبح داره {item} می‌بخشه مجانی. شهر {p3} رو دوست داره. {p1} فقط خسته شد.",
            effects: { playerStats: [{ stat: "reputation", min: -3, max: -1, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "treasury_audit",
    kind: "economic",
    emoji: "🧾",
    title: "حسابرسیِ صندوق",
    body: "یه حسابرسِ بی‌کار از صندوقِ {group} رسیدگی کرد: «یه اختلافِ {amount} سکه‌ای هست. توضیح رسمی می‌خوایم.»",
    tags: ["money", "crime", "mystery"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "explain",
        label: "🧾 توضیحِ رسمی بده",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گزارش داد: «هزینه‌ی ناشناخته: مبلمانِ حوضِ قورباغه‌ها.» حسابرس پذیرفت. اعداد جور شد. تقریباً.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 20, scope: "instigator" }],
              group: { reputation: 3 },
            },
          },
          {
            weight: 5,
            text: "توضیح {p1} عدد جورتری دراورد. مشکل: یه رسیدِ مبهم به امضای «؟؟؟». حسابرس عکسش رو گرفت و رفت.",
            effects: {
              clue: "رسیدِ صندوق {group} یه‌بار به امضای «؟؟؟» صادر شده. مبلغش همیشه همون عددِ گم‌شده است.",
            },
          },
        ],
      },
      {
        key: "cover",
        label: "🌫 عددها رو پلکونی",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} عدد رو گرد کرد. حسابرس متوجه شد. نرفت گزارش بده — فقط از {p1} خواست یه فنجون چای. قرض. با بهره.",
            effects: {
              playerStats: [{ stat: "crime", min: 1, max: 3, scope: "instigator" }],
              relationships: [{ dim: "trust", min: -5, max: -2, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "donate",
        label: "🫴 اختلاف رو خودت بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از جیب خودش اختلاف رو پر کرد. کسی نفهمید. حسابرس زیر لب گفت: «این‌جوری‌ها کم می‌بینم.» و {p1} یه مقدار خوش‌حال‌تر شد.",
            effects: {
              playerStats: [
                { stat: "money", min: -600, max: -200, scope: "instigator" },
                { stat: "reputation", min: 2, max: 5, scope: "instigator" },
              ],
              group: { reputation: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "fake_coins",
    kind: "economic",
    emoji: "🪙",
    title: "سکه‌های تقلبی",
    body: "تو بازارِ {group} سکه‌های تقلبی پیدا شده. تشخیصشون سخت‌ه: فقط یه‌کم مؤدب‌تر از سکه‌های واقعی‌ان.",
    tags: ["money", "crime", "mystery"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "inspect",
        label: "🔍 سکه‌هات رو چک کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} همه‌ی سکه‌هاش رو چک کرد. چند تا تقلبی بود. آهنی، سرد، و یه‌کم خوش‌قول. دستِ کارِ یه متخصص.",
            effects: {
              playerStats: [
                { stat: "money", min: -400, max: -100, scope: "instigator" },
                { stat: "xp", min: 6, max: 15, scope: "instigator" },
              ],
              followUp: { templateId: "treasury_audit", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.3 },

            },
          },
          {
            weight: 5,
            text: "سکه‌های {p1} همه سالم بودن. متخصص‌ها می‌گن احتمالش کم بوده. یعنی {p1} یا خوش‌شانسه یا تازه رسیده.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 2, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "trace",
        label: "🕵️ ردِ قالب‌گیری رو بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رد رو گرفت تا یه کارگاهِ کوچیکِ فلزکاری. صاحبش قنبرِ جوان بود. یعنی قنبرِ الان؟ هیچ‌کس دیگه نپرسید.",
            effects: {
              playerStats: [{ stat: "crime", min: 0, max: 2, scope: "instigator" }],
              clue: "سکه‌های تقلبیِ {group} از قالبِ خیاطیِ قدیمی ساخته می‌شن — قالبی که مالِ مغازه‌ی قنبر بوده.",
            },
          },
        ],
      },
      {
        key: "alert",
        label: "📢 هشدار عمومی بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تو کل شهر خبر داد. معامله‌ها یه روز سخت گذروندن ولی سکه‌ی تقلبی جمع شد. اعتماد ماند.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              group: { crime: -5, reputation: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "bank_of_group",
    kind: "economic",
    emoji: "🏦",
    title: "بانکِ {group}",
    body: "{p2} یه میز و یه دفتر آورده: «بانکِ {group} باز شد. سودِ 5% روزانه، به شرطِ این‌که یادم نره چیه.»",
    tags: ["money", "wholesome", "absurd"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "deposit",
        label: "💰 سپرده بذار",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} سپرده گذاشت. سود واقعاً اومد. دفترِ {p2} پر شد از خط و خطوط. اقتصادِ کوچکِ بزرگ.",
            effects: {
              playerStats: [{ stat: "money", min: 100, max: 500, scope: "instigator" }],
              relationships: [{ dim: "trust", min: 3, max: 8, scope: "pair" }],
              treasury: { min: 100, max: 300 },
            },
          },
          {
            weight: 5,
            text: "{p1} پول گذاشت و {p2} یادش رفت چیه. حسابِ {p1} الان «یه چیزی» ثبت شده. برداشت با حوصله انجام شد.",
            effects: {
              playerStats: [{ stat: "money", min: -300, max: 100, scope: "instigator" }],
              relationships: [{ dim: "tension", min: 1, max: 4, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "invest",
        label: "📈 پروژه بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "بانکِ {p2} به پروژه‌های {group} وام داد. حوض درست شد، کوچه روشن شد. سود: اعتبار. سودِ واقعی همینه.",
            effects: {
              treasury: { min: 150, max: 500 },
              group: { reputation: 4, influence: 3 },
            },
          },
        ],
      },
      {
        key: "heist_joke",
        label: "🎭 شایعه‌ی سرقت بذار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شایعه کرد بانک دزدیده شده. {p2} سه دقیقه سکوت کرد، بعد لرزید و کل شهر جلوی بانک صف کشید. {p1} حسرت خورد: چرا خودم دزد نکردم.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              group: { chaos: 7 },
            },
          },
          {
            weight: 5,
            text: "شایعه‌ی {p1} جواب نداد. همه به {p2} اعتماد دارن. این یعنی ثروتِ واقعی {p2} رو کسی نمی‌دونه.",
            effects: { relationships: [{ dim: "trust", min: 2, max: 5, scope: "all_pairs" }] },
          },
        ],
      },
    ],
  },
  {
    id: "inflation_day",
    kind: "economic",
    emoji: "🎈",
    title: "روزِ تورم",
    body: "امروز همه‌چیز تو {group} گرون‌تره. حتی خمیازه‌ها. {p3} برای یه چای {amount} سکه خواسته و وجدانش آرومه.",
    tags: ["money", "absurd"],
    minMembers: 2,
    cooldownMinutes: 720,
    weight: 9,
    choices: [
      {
        key: "barter",
        label: "🔄 کالا‌به‌کالا",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} بازارِ مبادله راه انداخت. {item} در مقابل خنده، خنده در مقابل پارو. اقتصاددان‌ها گیج شدن. مردم راضی.",
            effects: {
              playerStats: [{ stat: "money", min: -50, max: 300, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "wait",
        label: "⏳ هیچی نخر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کل روز هیچی نخرید. آخرِ روز قیمت‌ها عقب‌نشینی کردن. {p1} با یه نان ساده جشن گرفت. نانِ گران.",
            effects: {
              playerStats: [
                { stat: "money", min: -100, max: -30, scope: "instigator" },
                { stat: "xp", min: 5, max: 12, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "price_gouge",
        label: "💰 خودت گرون بفروش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} مخزنِ {item}ها رو گرون فروخت. سود بالا، دوست کم. {p2} اسمِ {p1} رو تو دفترِ «بعداً ببینیمت» نوشت.",
            effects: {
              playerStats: [
                { stat: "money", min: 400, max: 1400, scope: "instigator" },
                { stat: "reputation", min: -4, max: -2, scope: "instigator" },
              ],
              relationships: [{ dim: "tension", min: 3, max: 7, scope: "pair" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "group_auction",
    kind: "economic",
    emoji: "🔨",
    title: "مزایده‌ی محلی",
    body: "شهرداریِ {group} یه {item} مصادره‌ای رو برای فروش گذاشته. سندش هم عجیبه: «مالِ هرکس ببرتش.»",
    tags: ["money", "item", "festival"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 8,
    choices: [
      {
        key: "bid_solo",
        label: "🔨 تنهایی پیشنهاد بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با همه رقابت کرد و برد. {item} مالشه. شهرداری مُهر زد و گفت: «تا هفته‌ی بعد یادت میاد چرا اینو خواستی.»",
            effects: {
              playerStats: [
                { stat: "money", min: -1400, max: -500, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],

            },
          },
          {
            weight: 5,
            text: "رقابت بالا رفت و {p1} تو لحظه‌ی آخر عقب کشید. {p3} برد و از فردا هر روز از جلوی خونه‌ی {p1} رد می‌شه. با {item}.",
            effects: {
              relationships: [{ dim: "rivalry", min: 2, max: 5, scope: "pair" }],
              playerStats: [{ stat: "money", min: -100, max: 100, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "pool",
        label: "🤝 پولِ گروهی جمع کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{group} پول جمع کرد و برد. {item} رو گذاشت تو انبارِ عمومی. اولین مالِ واقعیِ شهرِ واقعی.",
            effects: {
              treasury: { min: -900, max: -400 },
              group: { reputation: 5, influence: 4 },
              relationships: [{ dim: "cooperation", min: 3, max: 6, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "appraise",
        label: "🔍 اول قیمتِ واقعیش رو بفهم",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گشت و فهمید {item} تو شهرِ بغلی نصف قیمت ارزونه. مزایده فروپاشید. شهرداری ناراحت شد. بازار خوشحال.",
            effects: {
              playerStats: [
                { stat: "xp", min: 10, max: 24, scope: "instigator" },
                { stat: "money", min: 100, max: 400, scope: "participants" },
              ],

            },
          },
        ],
      },
    ],
  },
  {
    id: "lottery_ticket",
    kind: "economic",
    emoji: "🎟",
    title: "بلیتِ لاتاریِ سرگردان",
    body: "زیر درِ کافه یه بلیتِ لاتاری پیدا شده. شماره‌ش داره می‌بره. کسی نمی‌دونه مالِ کیه. همه می‌دونن مالِ کیه.",
    tags: ["money", "crime", "mystery"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 8,
    choices: [
      {
        key: "claim",
        label: "🎟 خودت ببرش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بلیت رو برد و جایزه رو گرفت. {amount} سکه. شب، روی درِ خونه‌ش یه Note: «بلیت من بود. صبح میام.» خطش خوش‌حال بود.",
            effects: {
              playerStats: [
                { stat: "money", min: 800, max: 3000, scope: "instigator" },
                { stat: "crime", min: 1, max: 3, scope: "instigator" },
              ],
              group: { crime: 4 },
              followUp: { templateId: "debt_collector", afterMinutesMin: 720, afterMinutesMax: 2880, chance: 0.3 },
            },
          },
        ],
      },
      {
        key: "ask_around",
        label: "🙋 صاحبش رو پیدا کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گشت و پیرزنی رو پیدا کرد که شماره رو یادش بود. جایزه نصف شد. نصفِ {p1} بیشتر از هیچ بود، نصفِ پیرزن هم. همه گریه کردن از خوشی.",
            effects: {
              playerStats: [
                { stat: "money", min: 400, max: 1500, scope: "instigator" },
                { stat: "reputation", min: 3, max: 6, scope: "instigator" },
              ],
              group: { reputation: 3 },
            },
          },
        ],
      },
      {
        key: "group_play",
        label: "🎲 بذار گروه بده",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "بلیت به {group} رسید و جایزه تقسیم شد. هرکس به اندازه‌ی سهمش خوشحال شد، یعنی هیچ‌کس کامل راضی نبود. دموکراسیِ اقتصادی.",
            effects: {
              treasury: { min: 400, max: 1200 },
              playerStats: [{ stat: "money", min: 50, max: 250, scope: "participants" }],
            },
          },
          {
            weight: 5,
            text: "بلیت گروهی بود ولی جایزه‌ش کوچیک از آب دراومد. با اون پول فقط یه پارو خریدن. اسم پارو رو گذاشتن «امید».",
            effects: { treasury: { min: 100, max: 300 } },
          },
        ],
      },
    ],
  },
  {
    id: "pawn_ticket",
    kind: "economic",
    emoji: "🎫",
    title: "مُرتهنِ خاطره‌ها",
    body: "یه سرواژه‌خونه‌ی سیار تو {group} باز شده: «هر چیزی گرو می‌گیریم. حتی خاطره‌ها. سودِ عاطفی: صفر.»",
    tags: ["money", "crime", "mystery"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 7,
    choices: [
      {
        key: "pawn_item",
        label: "🎟 یه {item} گرو بذار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} یه {item} گرو گذاشت و پول گرفت. برگشتی سخت بود: سرواژه‌خونه هر پنجشنبه جابه‌جا می‌شه. آدرس: «همون‌جا.»",
            effects: {
              playerStats: [
                { stat: "money", min: 300, max: 900, scope: "instigator" },
                { stat: "luck", min: -2, max: 0, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "pawn_memory",
        label: "💭 یه خاطره گرو بذار",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} «شبِ بارونِ پارسال» رو گرو گذاشت. پولش رو گرفت. حالا بارون رو یادشه، شب رو یادشه، ولی پارسال خالیه. سرواژه‌خونه: «مرهونه‌ی منه.»",
            effects: {
              playerStats: [
                { stat: "money", min: 500, max: 1800, scope: "instigator" },
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
              ],
              clue: "ویترینِ سرواژه‌خونه پر از خاطره‌های گرو‌گذاشته‌ی کسایی است که دیگه برنگشتند.",
            },
          },
          {
            weight: 6,
            text: "معامله‌ی عاطفی انجام نشد: خاطره‌ی {p1} رو سرواژه‌خونه «تقلبی» تشخیص داد. {p1} یه دقیقه به خودش شک کرد.",
            effects: { playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "window_shop",
        label: "🪟 فقط ویترین رو نگاه کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} فقط نگاه کرد. تو ویترین یه عکسِ قدیمی بود: {group}، سالِ 98، و همه‌ی اعضا — حتی کسایی که هنوز عضو نشده بودن.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              clue: "عکسِ سالِ 98 تو ویترینِ سرواژه‌خونه، اعضای آینده‌ی {group} را نشان می‌دهد.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "treasury_heist",
    kind: "economic",
    emoji: "🦝",
    title: "شبی که صندوق لرزید",
    body: "صبح صندوقِ {group} باز بود و ته کشیده. {amount} سکه کم بود. جای پول، یه قاشق گذاشته بودن. تمیز. حسابی.",
    tags: ["money", "crime", "spoon", "mystery"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "investigate",
        label: "🕵️ نابغه‌ی خواب نشو، تحقیق کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} دنبال رد رفت. رد به یه سوراخِ دیوار می‌رفت که فقط یه راکون جا می‌شه. راکون رو بازجویی کردن. راکون چیزی نگفت. حرفه‌ای بود.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "قاشقِ جاگذاشته‌شده کنار صندوق، از جنسِ بارونِ قاشقیه — اما دمه سرد بوده.",
            },
          },
          {
            weight: 5,
            text: "تحقیق {p1} به هیچ‌جا نرسید. نعمتی اومد، قاشق رو بغل کرد و رفت. پرونده بسته شد. واقعاً بسته شد یا فایلش گم شد؟",
            effects: { rumor: { text: "سرقتِ صندوق {group} کارِ راکون بوده", truth: false } },
          },
        ],
      },
      {
        key: "rebuild",
        label: "🧱 صندوق رو محکم‌تر بساز",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{group} صندوقِ جدید جوش داد: فولاد، قفلِ دوتایی، و یه تابلوی «لطفاً نکن». تا حالا کسی نکرده. تابلو مؤثره.",
            effects: {
              treasury: { min: -500, max: -200 },
              group: { crime: -6, influence: 3 },
            },
          },
        ],
      },
      {
        key: "suspect",
        label: "🫵 {p2} رو متهم کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} به {p2} شک کرد. {p2} خودش رو تبرئه کرد با یه آلیبیِ محکم: خواب بود. همه خواب بودن. پس کی بیدار بود؟",
            effects: {
              relationships: [
                { dim: "tension", min: 5, max: 12, scope: "pair" },
                { dim: "trust", min: -6, max: -2, scope: "all_pairs" },
              ],
              group: { socialTemp: 8 },
            },
          },
        ],
      },
      {
        key: "fund",
        label: "🫰 جبران جمعی",
        style: null,
        outcomes: [
          {
            weight: 6,
            text: "هرکس یه چیزی گذاشت و صندوق دوباره نفس کشید. کسی گله نکرد. شهر، موقعِ فاجعه، خودش رو نشون می‌ده.",
            effects: {
              treasury: { min: 300, max: 900 },
              relationships: [{ dim: "cooperation", min: 4, max: 8, scope: "all_pairs" }],
              playerStats: [{ stat: "money", min: -250, max: -80, scope: "participants" }],
            },
          },
        ],
      },
    ],
  },

  // ═══ سیاست ═══
  {
    id: "mayor_decree_absurd",
    kind: "political",
    emoji: "📜",
    title: "فرمانِ عجیبِ شهردار",
    body: "شهردارِ {group} فرمان شماره‌ی 42 صادر کرد: «از این پس، تمام دعواها باید قافیه‌دار باشه. مخالفت؟ چه شعری دارید؟»",
    tags: ["election", "absurd", "chaos"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "rhyme",
        label: "🖋 با شعر جواب بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با یه رباعیِ حرفه‌ای مخالفتش رو اعلام کرد. شهردار پذیرفت و فرمان رو لغو کرد — با یه مثنویِ معذرت‌خواهی.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
                { stat: "xp", min: 8, max: 18, scope: "instigator" },
              ],
              group: { reputation: 3 },
            },
          },
          {
            weight: 4,
            text: "شعرِ {p1} نصفه مُوترد: قافیه نداشت. شهردار از بالکن خوندش و کل شهر با سکوت قضاوت کرد.",
            effects: { playerStats: [{ stat: "reputation", min: -3, max: -1, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "obey",
        label: "🎭 فرمان رو اجرا کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شروع کرد به قافیه‌دار حرف زدن. {p2} جوابش رو با یه ترانه‌ی عاشقانه داد. دعوا به جشن موبدل شد.",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],
              group: { socialTemp: -4 },
            },
          },
        ],
      },
      {
        key: "petition",
        label: "✍️ لایحه‌ی لغو جمع کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} امضا جمع کرد: 12 امضا، همش بدون قافیه. شهردار لایحه رو «غیرقابل‌خوندن» رد کرد ولی غرغر کرد تا شب.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              group: { chaos: 6 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "snap_election",
    kind: "political",
    emoji: "🗳",
    title: "انتخاباتِ زودهنگام",
    body: "استیضاح کامل نشد ولی حال و هوا پرتنش‌تر از همیشه‌ست: انتخاباتِ زودهنگامِ {group} برگزار می‌شه. صندوق‌ها آماده‌ان. کاندیداها هم.",
    tags: ["election", "chaos"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 10,
    choices: [
      {
        key: "run",
        label: "🗳 کاندیدا شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ثبت‌نام کرد. شعارش: «وعده‌ای نمی‌دم، چون حافظه‌م خوبه.» نتیجه‌ی اولیه: جذابیتِ بالا، برنامه: خالی.",
            effects: {
              playerStats: [{ stat: "fame", min: 3, max: 7, scope: "instigator" }],
              group: { socialTemp: 6 },
              title: { text: "🗳 کاندیدای بی‌برنامه", chance: 0.15 },
            },
          },
          {
            weight: 5,
            text: "{p1} کاندیدا شد و با یه برنامه‌ی کامل رفت تو مناظره. یه گربه هم کاندیدا بود. گربه برد. برنامه‌ی {p1} آرشیو شد.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              rumor: { text: "{p1} از یه گربه باخت، با برنامه", truth: true },
            },
          },
        ],
      },
      {
        key: "campaign",
        label: "🎤 ستادِ کسی رو بچرخون",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} ستادِ {p2} رو راه انداخت: تراکت، چای، و یه ژینگل که بعد یه هفته تو خواب هم می‌خوندن. {p2} مدیونه.",
            effects: {
              playerStats: [
                { stat: "money", min: -350, max: -120, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],
              relationships: [
                { dim: "cooperation", min: 4, max: 9, scope: "pair" },
                { dim: "trust", min: 2, max: 5, scope: "pair" },
              ],
            },
          },
        ],
      },
      {
        key: "observe",
        label: "🧃 فقط با چای نگاه کن",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} پای کار ننشست، ولی از دور همه‌چیز رو دید: وعده‌ها، چای‌های رایگان، و لحظه‌ای که {p3} به گربه رأی داد. تاریخ ثبت شد.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 16, scope: "instigator" }],
              group: { socialTemp: -3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "laughing_tax",
    kind: "political",
    emoji: "😄",
    title: "مالیات بر خنده",
    body: "شورای {group} تصویب کرد: هر خنده‌ی بلند، 5 سکه مالیات. دلیل: «شادی عمومی نیازمندِ صندوقِ عمومی است.» منطقیه؟ بله. عاقلانه؟ خیر.",
    tags: ["election", "money", "absurd"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 8,
    choices: [
      {
        key: "pay",
        label: "😄 خنده‌هات رو اعلام کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} سه تا خنده رو صادقانه اعلام و پرداخت کرد. مأمورِ مالیات، یه پسرِ باوقار، تشکر کرد و یه رسیدِ خوشگل داد.",
            effects: {
              playerStats: [
                { stat: "money", min: -120, max: -40, scope: "instigator" },
                { stat: "reputation", min: 1, max: 3, scope: "instigator" },
              ],
              treasury: { min: 30, max: 120 },

            },
          },
        ],
      },
      {
        key: "smuggle",
        label: "🤭 خنده‌ی قاچاق کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} خنده‌هاش رو پشت دست قایم می‌کرد. مأمورِ مالیات متوجه شد و جریمه شد. {p1} هنوز داره می‌خنده. به خاطرِ خاطره‌ش.",
            effects: {
              playerStats: [
                { stat: "money", min: -250, max: -80, scope: "instigator" },
                { stat: "crime", min: 1, max: 2, scope: "instigator" },
              ],
              group: { crime: 3 },
            },
          },
          {
            weight: 5,
            text: "قاچاقِ خنده‌ی {p1} بی‌سروصدا انجام شد تا آخرِ روز. مأمورِ مالیات هم یه بار پوزخند زد. خودش جریمه‌ش رو پرداخت.",
            effects: { playerStats: [{ stat: "money", min: 50, max: 150, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "protest",
        label: "✊ راه‌پیماییِ خنده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} راه‌پیماییِ خنده ترتیب داد: صد نفر با صدا خندیدن. صندوق پر شد، قانون فروپاشید. مالیات بر غمگینی پیشنهاد شد.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              group: { chaos: 8, socialTemp: -5 },
              memory: { kind: "moment", text: "راه‌پیماییِ خنده در {group}", importance: 72 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "impeachment_vibes",
    kind: "political",
    emoji: "⚖️",
    title: "وایبرِ استیضاح",
    body: "یه صدا تو گوشِ همه‌ی {group}: «استیضاح، استیضاح...». منشأ صدا نامعلومه. احتمالاً یه اسپیکرِ بلوتوثیه. احتمالاً.",
    tags: ["election", "chaos", "mystery"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "trace",
        label: "🔊 منشأ صدا رو پیدا کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} دنبال صدا رفت. یه اسپیکرِ کوچیک بود زیر نیمکت، حلقه‌ی صوتیش از 98 تکرار می‌شد. آف. صدا رفت. هوا موند.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              clue: "حلقه‌ی صوتیِ «استیضاح» رو کسی نریخته — آف بود. یعنی یکی اینو از قبل تنظیم کرده بود.",
            },
          },
          {
            weight: 5,
            text: "منشأ پیدا نشد. صدا بعد سه ساعت خودش خوابید. {p1} فهمید وقتی صدا خودش آف می‌شه، جالب‌تر از هر اسپیکریه.",
            effects: { group: { chaos: 4 } },
          },
        ],
      },
      {
        key: "chant",
        label: "📣 همراهی کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با صدا هم‌خوان شد. شهردار از پنجره نگاه کرد، فقط {p1} رو دید که مشغولِ همراهیه. اسمش تو دفترِ شب یادداشت شد.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 7, socialTemp: 5 },
            },
          },
        ],
      },
      {
        key: "counter",
        label: "🎼 آهنگِ مثبت پخش کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه فلوتی بلند کرد و نتِ شادی داد. صدا باهاش هم‌خوان شد و از «استیضاح» شد «استپِ‌دانس». شهر تا شب خوب بود.",
            effects: {
              playerStats: [{ stat: "fame", min: 1, max: 4, scope: "instigator" }],
              group: { socialTemp: -6, chaos: -3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "spoon_censorship",
    kind: "political",
    emoji: "⛔",
    title: "سانسورِ ذکرِ قاشق",
    body: "شورای {group} مصوبه‌ی محرمانه‌ای پاس کرد: از این به بعد، اون وسیله‌ی فلزیِ معروف «وسیله» نامیده می‌شه. دلیل: «آرامشِ عمومی.»",
    tags: ["spoon", "election", "absurd", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "comply",
        label: "🥄 «وسیله» بگو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} رعایت کرد و همه‌جا گفت «وسیله». مقامات خوشحال. واژه‌نامه‌ی شهر یه صفحه کمتر کرد.",
            effects: { playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "rebel",
        label: "🗣 قاشق قاشق قاشق",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} سه بار بلند گفت «قاشق». مأمورِ آرامش اومد، {p1} رو نگاه کرد، بعد خودش هم بلند گفت. قانون فروپاشید.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 9 },
              memory: { kind: "moment", text: "شورشِ «قاشق» در {group}", importance: 80 },
            },
          },
          {
            weight: 5,
            text: "جریمه‌ی نقدی به قیمتِ یه وسیله‌ی فلزی به {p1} رسید. آهنی. غرغرو.",
            effects: { playerStats: [{ stat: "money", min: -300, max: -100, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "poetry",
        label: "📜 شعری با قافیه‌ی مبهم بنویس",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شعری نوشت که قافیه‌هاش همش «ـاشق» بود. سانسورچی یه ساعت دنبال معنایی گشت که نبود. شعر چسبید به دیوارِ شهر.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              rumor: { text: "شعرِ جدیدِ {p1} یه چیز رو توصیف می‌کنه که نمی‌تونیم اسمش رو بگیم", truth: true },
            },
          },
        ],
      },
    ],
  },
  {
    id: "frog_campaign",
    kind: "political",
    emoji: "🐸",
    title: "کمپینِ انتخاباتیِ قورباغه",
    body: "ستادِ انتخاباتیِ قورباغه‌ها باز شده — یه بشکه‌ی نیمه‌پر و یه پوستر. پوستر فقط یه قورباغه‌ست که نگاه می‌کنه. تأثیر: بالا.",
    tags: ["frog", "election", "absurd"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "join",
        label: "📋 عضوِ ستاد شو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تو ستاد ثبت‌نام کرد و مسئولِ «نظر‌سنجی از موجوداتِ غیرِ‌پرخاشگر» شد. اولین نظرسنجی: کفِ بشکه چه رنگی باشه؟",
            effects: {
              playerStats: [
                { stat: "fame", min: 1, max: 4, scope: "instigator" },
                { stat: "xp", min: 8, max: 18, scope: "instigator" },
              ],
              title: { text: "🐸 عضوِ ستادِ قورباغه", chance: 0.2 },
            },
          },
        ],
      },
      {
        key: "demand",
        label: "📊 برنامه‌ی انتخاباتی‌شون چیه؟",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پرسید. ستاد جواب داد: سکوتِ کاملِ 15 ثانیه‌ای. تحلیلگران: «بلدانه. هیچ‌کس این‌قدر بلد نیست.»",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 20, scope: "instigator" }],
              group: { chaos: 5 },
            },
          },
        ],
      },
      {
        key: "poster",
        label: "🎨 پوسترِ انسانی بکش",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} برای کاندیدای انسانی پوستر کشید. کاندیدای انسانی خودِ {p1} بود. پوسترِ قورباغه برنده شد: ساده‌تر بود.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 4, scope: "instigator" }],
              relationships: [{ dim: "rivalry", min: 1, max: 3, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "border_dispute",
    kind: "political",
    emoji: "🚧",
    title: "جنگِ مرزی با کوچه‌ی بغلی",
    body: "محله‌ی بغلی می‌گه درختِ سروِ وسط، مالِ اون‌هاست. {group} می‌گه درخت اصلاً متعلق به هیچ‌کس نیست. درخت نظرش رو نگفته. هنوز.",
    tags: ["election", "chaos", "crime"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "negotiate",
        label: "🤝 مذاکره‌ی دوستانه",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد داد: درخت «سوپرایزِ مشترک» باشه. محله‌ی بغلی قبول کرد. زیر درخت چایِ مشترک مستقر شد. درخت، خوشحال.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
              group: { reputation: 4 },
            },
          },
        ],
      },
      {
        key: "flag",
        label: "🏴 پرچم بذار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پرچمِ {group} رو بست به درخت. محله‌ی بغلی پرچمِ خودش رو 50 سانت بالاتر. جنگِ پرچم تا شب ادامه داشت. درخت خسته شد.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 8, socialTemp: 6 },
            },
          },
        ],
      },
      {
        key: "ask_tree",
        label: "🌳 از خودِ درخت بپرس",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} زیر درخت رفت و بلند پرسید: «مالِ کی هستی؟» باد وزید، برگ‌ها تکان خوردن و یه برگ افتاد دمِ پای {p1}. همه فهمیدن: درخت رأی داد.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              memory: { kind: "moment", text: "درختِ سرو رأی‌اش را به {p1} داد", importance: 68 },
              title: { text: "🌳 برگزیده‌ی درخت", chance: 0.15 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "curfew_absurd",
    kind: "political",
    emoji: "🌙",
    title: "حکومتِ نیمه‌شب",
    body: "فرمانِ جدید: ساعت 12 شب، همه‌ی {group} باید یه بار بلند آواز بخونن. هدف: «هماهنگیِ اجتماعی». نتیجه‌ی جانبی: خوابِ همسایه‌ها.",
    tags: ["election", "absurd", "chaos"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 7,
    choices: [
      {
        key: "sing",
        label: "🎤 سرِ ساعت بخون",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} سرِ 12 بلند خوند. {p2} و {p3} هم اومدن تو. صداها ناهماهنگ بود، ولی شهر یه چیزی احساس کرد که اسمشو نمی‌دونست.",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -5, reputation: 2 },
              memory: { kind: "moment", text: "آوازِ نیمه‌شبِ {group}", importance: 66 },
            },
          },
          {
            weight: 5,
            text: "{p1} خوند ولی نیم‌کاره رها کرد چون همسایه شیشه رو بست. قانون نیمه‌تموم اجرا شد. مثل همه‌ی قوانین.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "sleep",
        label: "😴 خوابت رو بخواب",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} نخوند و خوابش برد. فردا تو «لیستِ ساکت‌ها» اومد. تهدید نمی‌کنن؛ فقط یادداشت می‌کنن. ترسناک‌ترین حالتِ ممکن.",
            effects: {
              playerStats: [
                { stat: "energy", min: 8, max: 15, scope: "instigator" },
                { stat: "chaos", min: 1, max: 2, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "organize",
        label: "🎼 کنسرتِ نیمه‌شب بچین",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} برنامه‌ی کامل بست: سولو، گروهی، و یه رپِ نیمه‌شبی. فرمان به جشن موبدل شد. قانون‌گذارا هم اومدن. همخوانی کردن.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              treasury: { min: 100, max: 400 },
              group: { socialTemp: -6 },
            },
          },
        ],
      },
    ],
  },

  // ═══ اجتماعی ═══
  {
    id: "gift_chain",
    kind: "social",
    emoji: "🎁",
    title: "زنجیره‌ی هدیه",
    body: "{p3} به {p2} یه {item} هدیه داد. {p2} به {p1} یه چیزِ کوچیک‌تر. حالا نوبتِ {p1}ه. زنجیره باید ادامه پیدا کنه.",
    tags: ["wholesome", "item"],
    minMembers: 3,
    cooldownMinutes: 360,
    weight: 11,
    choices: [
      {
        key: "continue",
        label: "🎁 زنجیره رو ادامه بده",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} هدیه‌ای درست کرد و به یه غریبه داد. غریبه گریه کرد و زنجیره از {group} بیرون رفت. حالا کل محله داره هدیه می‌ده.",
            effects: {
              playerStats: [
                { stat: "money", min: -250, max: -80, scope: "instigator" },
                { stat: "reputation", min: 2, max: 5, scope: "instigator" },
              ],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -6, reputation: 4 },
              memory: { kind: "moment", text: "زنجیره‌ی هدیه از {group} شروع شد", importance: 70 },
            },
          },
          {
            weight: 3,
            text: "هدیه‌ی {p1} رسید به کسی که خودش رو دوست نداشت و یه‌کم روشن‌تر شد. زنجیره‌ها همیشه نمی‌رسن؛ وقتی می‌رسن، می‌شکنن.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "big",
        label: "💎 هدیه‌ی بزرگ بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} عمیق جیبش رو خالی کرد و هدیه‌ی بزرگ داد. زنجیره فشار رو تحمل نکرد و اون‌جا تموم شد. همه {p1} رو به‌عنوان «آخرین حلقه» یاد می‌کنن.",
            effects: {
              playerStats: [
                { stat: "money", min: -900, max: -300, scope: "instigator" },
                { stat: "fame", min: 2, max: 6, scope: "instigator" },
              ],
              title: { text: "💎 آخرین حلقه‌ی زنجیره", chance: 0.2 },
            },
          },
        ],
      },
      {
        key: "break",
        label: "✂️ زنجیره رو قطع کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} نگه داشت براش خودش. منطقی بود. {p3} فقط گفت: «بهم می‌رسید، نگهش داشتم.» {p1} تا یه هفته با اون جمله خوابش نبرد.",
            effects: {
              relationships: [
                { dim: "trust", min: -5, max: -2, scope: "all_pairs" },
                { dim: "tension", min: 2, max: 5, scope: "pair" },
              ],
            },
          },
          {
            weight: 5,
            text: "زنجیره بدون {p1} ادامه پیدا کرد و کسی متوجه نشد. {p1} با {item}ش موند و یه سؤال بزرگ: هدیه‌ای که نگه داشته شه، هنوز هدیه‌ست؟",
            effects: { playerStats: [{ stat: "luck", min: -2, max: 0, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "prank_on_p2",
    kind: "social",
    emoji: "🔩",
    title: "همه‌چیزِ {p2} فویلی شد",
    body: "{p2} از خواب بیدار شده و کشف کرده کل وسایلش با فویل پیچیده شده. حتی {item}. حتی سگِ پلاستیکی. حتی خاطره‌ی دور.",
    tags: ["absurd", "wholesome"],
    minMembers: 3,
    cooldownMinutes: 720,
    weight: 10,
    choices: [
      {
        key: "confess",
        label: "🫠 اعتراف کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اعتراف کرد: «من بودم.» {p2} یه دقیقه ساکت موند بعد گفت: «می‌دونستم. فویلا صبح خریدم بهت.» چرخه کامل شد.",
            effects: {
              relationships: [
                { dim: "friendship", min: 3, max: 7, scope: "pair" },
                { dim: "tension", min: 0, max: 3, scope: "pair" },
              ],
              playerStats: [{ stat: "money", min: -150, max: -40, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "blame_frog",
        label: "🐸 تقصیر رو بنداز رو قورباغه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گفت قورباغه‌ها کارش کردن. قورباغه‌ها انکار نکردن. تا امروز، یه قاشقِ فویلی هر از گاهی جایی پیدا می‌شه. همه می‌گن: کارِ قورباغه‌هاست.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              rumor: { text: "قورباغه‌ها فویل دارن", truth: false },
              group: { chaos: 5 },
            },
          },
        ],
      },
      {
        key: "unwrap",
        label: "🎁 کمکش کن باز کنه",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} و {p3} با هم شروع کردن به باز کردنِ فویل‌ها. وسطِ کار فهمیدن بعضی چیزا قبل از فویل هم فویل بودن. {p2} عکس گرفت برای آینده.",
            effects: {
              playerStats: [{ stat: "energy", min: -6, max: -2, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "public_apology",
    kind: "social",
    emoji: "🙇",
    title: "عذرخواهیِ عمومی",
    body: "{p1} بالاخره تصمیم گرفت: وسطِ {group} می‌ایسته و برای چیزی که به {p2} کرده — که هیچ‌کس دقیق نمی‌دونه چیه — عذرخواهی می‌کنه.",
    tags: ["wholesome"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "sincere",
        label: "🙇 از تهِ دل",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} عذرخواهی کرد، کامل، بی‌بهانه. {p2} پذیرفت و بغضش رو گذاشت. کل شهر یه نفس راحت کشید. یه بار در یه عمر کافیه.",
            effects: {
              relationships: [
                { dim: "trust", min: 8, max: 16, scope: "pair" },
                { dim: "tension", min: -8, max: -3, scope: "pair" },
                { dim: "friendship", min: 3, max: 8, scope: "pair" },
              ],
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              group: { socialTemp: -8 },
            },
          },
          {
            weight: 4,
            text: "عذرخواهیِ {p1} صادقانه بود ولی {p2} فقط گفت: «حله.» و بعد یه هفته کوچیک رفت. عذرخواهی درست بود، زمان‌بندیش نه.",
            effects: { relationships: [{ dim: "tension", min: -4, max: 0, scope: "pair" }] },
          },
        ],
      },
      {
        key: "flowers",
        label: "💐 با گل و شعر",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با یه دسته گل و یه شعرِ کوتاه اومد. {p2} خندید: «شعرت بد بود.» ولی گل رو گرفت و شعر رو نگه داشت.",
            effects: {
              playerStats: [{ stat: "money", min: -200, max: -60, scope: "instigator" }],
              relationships: [
                { dim: "friendship", min: 4, max: 9, scope: "pair" },
                { dim: "tension", min: -6, max: -2, scope: "pair" },
              ],
            },
          },
        ],
      },
      {
        key: "event",
        label: "🎪 جشنِ عذرخواهی بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} یه جشنِ کوچیک گرفت به مناسبتِ عذرخواهی. {p2} منو رفت. شهر خندید. قورباغه‌ها هم اومدن. کم‌کم داشت جشنِ خودشون می‌شد.",
            effects: {
              playerStats: [{ stat: "fame", min: 1, max: 4, scope: "instigator" }],
              treasury: { min: -250, max: -80 },
              relationships: [{ dim: "tension", min: -5, max: -1, scope: "pair" }],
              group: { socialTemp: -4, chaos: 4 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "betrayal_reveal",
    kind: "social",
    emoji: "🎭",
    title: "لو رفتنِ خیانتِ کوچیک",
    body: "معلوم شد {p1} یه بار — فقط یه بار — اون {item} رو که {p2} بهش امانت داده بود، به {p3} نشان داده. عکس هم گرفته. عکس الان داره می‌چرخه.",
    tags: ["crime", "item"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "confess",
        label: "🫠 بگو من بودم",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} جلوی همه گفت: «من بودم. فقط نشان دادم. نخواستم عکس بگیره.» {p2} نصفه بخشید. {p3} عکس رو پاک کرد، بغلِ چشمِ همه.",
            effects: {
              relationships: [
                { dim: "trust", min: -6, max: -2, scope: "pair" },
                { dim: "tension", min: 3, max: 8, scope: "pair" },
              ],
              playerStats: [{ stat: "reputation", min: -3, max: 0, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "counter",
        label: "🔍 رازِ {p3} رو hint بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} به نشونه گفت که {p3} خودش هم رازِ کوچیکی داره. {p3} عقب کشید و عکس حذف شد. جنگ سردِ سه‌نفره آغاز شد. شهر تماشا می‌کنه.",
            effects: {
              relationships: [
                { dim: "hostility", min: 4, max: 10, scope: "pair" },
                { dim: "tension", min: 5, max: 12, scope: "all_pairs" },
              ],
              group: { socialTemp: 10 },
            },
          },
        ],
      },
      {
        key: "repair",
        label: "🛠 جبران کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه {item} جدید و بهتر خرید و با یه نامه‌ی دست‌نویس به {p2} برگردوند. {p2} دوتاش رو نگه داشت و همه‌چیز آروم شد. تقریباً.",
            effects: {
              playerStats: [{ stat: "money", min: -500, max: -180, scope: "instigator" }],
              relationships: [
                { dim: "trust", min: 4, max: 10, scope: "pair" },
                { dim: "tension", min: -6, max: -2, scope: "pair" },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "alliance_formed",
    kind: "social",
    emoji: "🤝",
    title: "اتحادِ {p1} و {p2}",
    body: "{p1} و {p2} وسطِ {group} دست دادن و اعلام کردن: «از این به بعد، هر کاری، با هم.» دلیلش رو نگفتن. لازم هم نیست.",
    tags: ["wholesome"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "join",
        label: "🤝 منم بیام؟",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} و {p2} پذیرفتن. اتحاد سه‌نفره شد و اسم گرفت: «سه‌ضلعیِ آرام». {p3} مِهرِ گروه رو طراحی کرد. با {item} مُهر می‌زنن.",
            effects: {
              relationships: [
                { dim: "cooperation", min: 5, max: 12, scope: "all_pairs" },
                { dim: "trust", min: 3, max: 8, scope: "all_pairs" },
              ],
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "participants" }],
            },
          },
          {
            weight: 4,
            text: "پذیرفتن ولی {p3} با شرطِ مشخص: «فقط برای کارهای خوب.» همه قول دادن. همه انگشت‌هاشون رو درِ کافه زیرِ چشمِ ماهور بستن.",
            effects: {
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
              group: { reputation: 3 },
            },
          },
        ],
      },
      {
        key: "spy",
        label: "🕵️ ببین قرارتون چیه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} مخفیانه عضویت رو رد کرد ولی ناظر موند. اتحادها همیشه یه جایی آب می‌خورن. {p1} ترجیح داد عطش رو ببینه.",
            effects: {
              playerStats: [{ stat: "xp", min: 6, max: 15, scope: "instigator" }],
              relationships: [{ dim: "tension", min: 2, max: 5, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "rival",
        label: "⚔️ اتحادِ مقابل بساز",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با {p3} اتحاد جواب ساخت. اسمش: «جبهه‌ی مُرَکب». هیچ‌کس نمی‌دونه با هم می‌جنگن یا فقط با هم قهوه می‌خورن. خودشون هم نه.",
            effects: {
              relationships: [
                { dim: "rivalry", min: 4, max: 9, scope: "all_pairs" },
                { dim: "cooperation", min: 2, max: 5, scope: "pair" },
              ],
              group: { socialTemp: 6, chaos: 5 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "secret_handshake",
    kind: "social",
    emoji: "🤫",
    title: "رمزِ دستِ جدید",
    body: "{p2} یه رمزِ دستیِ جدید برای اعضای {group} طراحی کرده: پنج حرکت، یه چرخش، و یه وعده‌ی ابراز احساسات در انتها. هیچ‌کس درست یادش نمی‌گیره.",
    tags: ["wholesome", "absurd"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "learn",
        label: "🤝 یاد بگیر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کامل یادش گرفت و اجراش کرد. {p2} از خوشحالی گریه کرد. بعداً {p1} به تنهایی هم تمرین می‌کرد. یه‌ بار که یادش نمی‌رفت.",
            effects: {
              relationships: [
                { dim: "friendship", min: 3, max: 7, scope: "pair" },
                { dim: "cooperation", min: 2, max: 5, scope: "all_pairs" },
              ],
              playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }],
            },
          },
          {
            weight: 4,
            text: "{p1} یادش نگرفت و موقع اجرا، دستش گیر کرد تو دستِ {p2}. دو دقیقه همون‌جا مونن. حالا رمزِ جدیدِ رسمی همینه.",
            effects: { relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }] },
          },
        ],
      },
      {
        key: "simplify",
        label: "✂️ ساده‌ترش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد داد فقط «مشت به مشت» باشه. {p2} قبول کرد ولی برای احساسات، یه چشمک اضافه کرد. اجرای عمومی موفق.",
            effects: {
              relationships: [{ dim: "cooperation", min: 2, max: 4, scope: "all_pairs" }],
              group: { socialTemp: -3 },
            },
          },
        ],
      },
      {
        key: "refuse",
        label: "🙅 من رمزم رو دارم",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رمزِ خودش رو ساخت: فقط سر تکان دادن. شهر در دو دسته تقسیم شد: رمزدارها و سرتکان‌دهنده‌ها. جنگِ سردِ مهربان.",
            effects: {
              relationships: [{ dim: "rivalry", min: 1, max: 4, scope: "all_pairs" }],
              group: { socialTemp: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "friendship_anniversary",
    kind: "social",
    emoji: "🎂",
    title: "سالگردِ دوستی",
    body: "امروز دقیقاً یه سال از روزی می‌شه که {p1} و {p2} تو صفِ نون با هم دعوا کردن و از همون‌جا دوست شدن. سنتِ {group} شده.",
    tags: ["wholesome", "festival"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 9,
    choices: [
      {
        key: "celebrate",
        label: "🎂 جشن بگیرید",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "کیک خریدن و عکسِ اون روزِ قدیمی رو چسبوندن به دیوار. {p1} و {p2} دوباره اون دعوا رو اجرا کردن. برای عموم. دعوای نمایشی. عالی بود.",
            effects: {
              treasury: { min: -200, max: -80 },
              relationships: [{ dim: "friendship", min: 4, max: 9, scope: "all_pairs" }],
              playerStats: [{ stat: "energy", min: -4, max: 4, scope: "participants" }],
              memory: { kind: "moment", text: "سالگردِ دوستیِ {p1} و {p2}", importance: 62 },
            },
          },
        ],
      },
      {
        key: "gifts",
        label: "🎁 هدیه‌ی سنتی",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به رسمِ سنت یه نانِ تازه گرفت و همون‌جا در صف نون به {p2} داد. صف دست‌وپا زد. {p2} نان رو نصف کرد. سنتِ داخلِ سنت.",
            effects: {
              playerStats: [{ stat: "money", min: -120, max: -40, scope: "instigator" }],
              relationships: [{ dim: "friendship", min: 3, max: 8, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "re_enact",
        label: "🎭 دعوا رو دوباره اجرا کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "اجرای مجددِ دعوا واقعی شد. {p1} واقعاً عصبانی شد. بعد از سه دقیقه هر دو خندیدن. تاریخ تکرار می‌شه، ولی با پایانِ بهتر.",
            effects: {
              relationships: [
                { dim: "tension", min: 2, max: 5, scope: "pair" },
                { dim: "friendship", min: 2, max: 6, scope: "pair" },
              ],
              playerStats: [{ stat: "fame", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "insult_poetry",
    kind: "social",
    emoji: "🎭",
    title: "جشنِ شعرفروشی",
    body: "سنتِ فصلیِ {group}: شعرِهای دوستانه برای هم نوشتن. قافیه‌ها تیز، منظورها مهربان. امسال داور: یه قورباغه (بی‌طرف).",
    tags: ["wholesome", "frog", "festival"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "compete",
        label: "🖋 شعر بفرست",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "شعرِ {p1} درباره‌ی {p2} این بود: «قشنگه ولی دیر می‌کنه.» قورباغه دو بار بلرزید — یعنی دو امتیاز. مقام دوم.",
            effects: {
              playerStats: [
                { stat: "fame", min: 1, max: 4, scope: "instigator" },
                { stat: "xp", min: 8, max: 16, scope: "instigator" },
              ],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],

            },
          },
          {
            weight: 5,
            text: "شعرِ {p1} آن‌قدر خوب بود که قورباغه سکوت کرد. سکوتِ قورباغه یعنی امتیازِ کامل. مقام اول و یه جایزه‌ی مرموز: یه قاشقِ کوچیک.",
            effects: {
              playerStats: [
                { stat: "fame", min: 3, max: 7, scope: "instigator" },
                { stat: "money", min: 100, max: 400, scope: "instigator" },
              ],
              title: { text: "🎭 شاعرِ قورباغه‌پسند", chance: 0.18 },
            },
          },
        ],
      },
      {
        key: "kind_only",
        label: "🌸 فقط شعرِ مهربان",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} قافیه‌های تیز رو کنار گذاشت و فقط لطیف نوشت. جایزه‌ی ویژه‌ی «کم‌ترین اشک، بیشترین لبخند» به {p1} رسید.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              relationships: [{ dim: "friendship", min: 2, max: 4, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "sabotage",
        label: "✂️ قلمِ {p2} رو قایم کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} قلمِ {p2} رو قایم کرد. {p2} با چوبِ قاشق نوشت و برد. ماجرای قلم هم که لو رفت، شعرِ {p1} درباره‌ش هدر رفت: «نوشته شد، به قلمِ اجاره‌ای.»",
            effects: {
              relationships: [{ dim: "tension", min: 3, max: 7, scope: "pair" }],
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "group_photo",
    kind: "social",
    emoji: "📸",
    title: "عکسِ گروهیِ سال",
    body: "برای آرشیوِ {group} قرار شد عکسِ گروهی بگیرن. تایمر گذاشتن. همه آماده. فقط یه مشکل کوچیک: {p2} همیشه توی لحظه‌ی شاتر پلک می‌زنه.",
    tags: ["wholesome", "callback"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "retry",
        label: "📸 دوباره، بیست بار",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "بیست عکس گرفتن. تو نوزده تا {p2} پلک زده. تو یکی، همه خوب بودن ولی یه قورباغه از کنار رد شده. اون یکی شد عکسِ رسمیِ سال.",
            effects: {
              playerStats: [{ stat: "xp", min: 5, max: 12, scope: "participants" }],
              memory: { kind: "moment", text: "عکسِ سالِ {group} — با مهمانِ ناخوانده", importance: 64 },
              relationships: [{ dim: "friendship", min: 1, max: 3, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "blink_free",
        label: "😏 ترفندِ پلک",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به {p2} یاد داد قبل شاتر پلک بزنه و بعد باز نگه داره. جواب داد. عکسِ کامل: همه بیدار، همه با لبخند، یه قاشقِ رها تو گوشه‌ی کادر.",
            effects: {
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "pair" }],
              clue: "تو همه‌ی عکس‌های گروهیِ {group} از دهه‌ی قبل، یه قاشق گوشه‌ی کادر هست. کسی فایل عکس‌ها را کامل ندیده.",
            },
          },
        ],
      },
      {
        key: "candid",
        label: "🎬 عکسِ بدون اطلاع",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بدون اطلاع عکس گرفت. عکسِ طبیعی بود: {p2} داره قاشق رو از کادر برمی‌داره. عکس‌ها مُهرِ «آرشیوِ مخفی» خوردن و قفل شد.",
            effects: {
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
              rumor: { text: "{p2} به قاشق‌ها حساسه", truth: true },
            },
          },
        ],
      },
    ],
  },
  {
    id: "item_loan_triangle",
    kind: "social",
    emoji: "🔺",
    title: "مثلثِ امانت",
    body: "{p1} یه {item} رو از {p2} امانت گرفته، به {p3} داده که «نگاهش داره». {p3} هم امانت گرفته از {p1}: یه قول. زنجیره‌ی امانت داره پیچیده می‌شه.",
    tags: ["item", "crime", "mystery"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "untangle",
        label: "🧵 بازش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه رو دور یه میز جمع کرد و مثلث رو روی کاغذ کشید. {item} برگشت به {p2}، قول برگشت به {p1}. {p3} فقط یه چای خورد. عدالت.",
            effects: {
              relationships: [
                { dim: "trust", min: 3, max: 7, scope: "all_pairs" },
                { dim: "cooperation", min: 2, max: 5, scope: "all_pairs" },
              ],
              playerStats: [{ stat: "xp", min: 6, max: 14, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "insurance",
        label: "📜 سندِ امانت بنویس",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} فرمِ امانتِ سه‌جانبه طراحی کرد. همه امضا کردن. {item} حالا «رسمی» سرگردانه. شهر برای اولین بار ساختار به امانات داد. غرورِ جدی.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              group: { reputation: 4, influence: 2 },
            },
          },
        ],
      },
      {
        key: "sell_quietly",
        label: "💸 بی‌سروصدا بفروشش",
        style: "danger",
        outcomes: [
          {
            weight: 4,
            text: "{p1} {item} رو فروخت. پولش برگشت بهش. {p2} و {p3} هنوز منتظرن. هر روز که می‌گذره، {p1} یه‌کم کوچیک‌تر تو آینه می‌شه.",
            effects: {
              playerStats: [
                { stat: "money", min: 300, max: 1100, scope: "instigator" },
                { stat: "crime", min: 2, max: 5, scope: "instigator" },
              ],
              relationships: [{ dim: "trust", min: -10, max: -4, scope: "all_pairs" }],
              group: { crime: 5 },
            },
          },
          {
            weight: 6,
            text: "خریدار {item} رو شناخت: «این مالِ {p2}ـه.» و برگردوند پیش {p2}. {p2} حالا می‌دونه {p1} چی کار کرده. ساکتِ. منتظرِ جوابِ درست.",
            effects: {
              relationships: [{ dim: "trust", min: -8, max: -3, scope: "pair" }],
              playerStats: [{ stat: "reputation", min: -4, max: -1, scope: "instigator" }],
            },
          },
        ],
      },
    ],
  },

  // ═══ معما ═══
  {
    id: "old_records",
    kind: "mystery",
    emoji: "🗄",
    title: "اسنادِ قدیمی",
    body: "پشتِ کاشیِ شکسته‌ی کافه‌ی ماهور یه دسته اسنادِ زرد پیدا شده. همه‌ش فهرستِ شهروندهاست — با اسمِ کسایی که هنوز به {group} نیومدن.",
    tags: ["mystery", "npc", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "study",
        label: "🔍 بررسی کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اسناد رو خوند. تاریخِ سند: 98. اسمِ {p1} هم بود، با یه خطِ قرمز. کنارش نوشته: «برمی‌گرده.»",
            effects: {
              playerStats: [{ stat: "xp", min: 15, max: 35, scope: "instigator" }],
              clue: "فهرستِ سالِ 98 اسمِ شهروندانِ آینده را دارد. اسمِ خودت هم — با خطِ قرمز.",
            },
          },
          {
            weight: 4,
            text: "بررسیِ {p1} نصفه موند: اسناد بعد از یه دقیقه شروع کردن به کم‌رنگ شدن. کاغذ دووم نداشت. عکس هم نگرفتن که بسوزه.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "return",
        label: "🔐 به ماهور برگردون",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اسناد رو برگردوند. ماهور نگاهی انداخت، لبخند زد و اون‌ها رو گذاشت تو جعبه‌ی چای. با چای‌ها قایم می‌شن. انتخابِ امن.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              relationships: [{ dim: "trust", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "publish",
        label: "📢 پخشش کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} عکسِ اسناد رو پخش کرد. شهر یه روز کامل بحث کرد، بعد یهو همه یادشون رفت. همه‌ی نسخه‌ها پاک شد. جز یکی. پیشِ {p1}.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 6 },
              clue: "نسخه‌هایی از اسنادِ 98 که پخش می‌شوند، تا فردا حذف می‌شوند. فقط نسخه‌ی اول می‌ماند.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "torn_page",
    kind: "mystery",
    emoji: "📄",
    title: "صفحه‌ی پاره",
    body: "از دفترِ خاطراتِ عمومیِ {group} یه صفحه پاره شده. فقط یه تیکه موند: «...و اون‌وقت همه یادشون رفت که اتفاقاً...» جمله نصفه‌ست.",
    tags: ["mystery", "callback"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "reconstruct",
        label: "🧩 حدس بزن ادامه‌ش چیه",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} نوشت: «...اتفقاً ماه قرمز بود.» دفتر جواب داد: یه خطِ جدید ظاهر شد: «نه.» دفتر جواب می‌ده. حالا همه می‌دونن.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 25, scope: "instigator" }],
              clue: "دفترِ خاطراتِ عمومی جواب می‌دهد — فقط وقتی جوابِ غلط بنویسی.",
            },
          },
          {
            weight: 5,
            text: "حدسِ {p1} این بود: «...اتفقاً بارونِ قاشقی بَرِه.» دفتر ساکت موند. سکوتِ دفتر معنای خاصی داره: خیلی نزدیک بود.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 2, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "search",
        label: "🔎 دنبال بقیه‌ی صفحه بگرد",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گشت. تیکه‌ی دوم زیر درِ مغازه‌ی قنبر بود: «...خواب بودیم یا بیدار؟» دو تیکه کنار هم گذاشتن. سؤالِ سوم هنوز جایی پنهونه.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "تیکه‌ی سومِ صفحه‌ی پاره، زیر حوضِ قورباغه‌هاست. کسی جرأت نکرده باشد.",
            },
          },
        ],
      },
      {
        key: "let_go",
        label: "📖 بذار باشه",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} دفتر رو بست و گذاشت سر جاش. بعضی جملات نصفه، نصفه‌شون قشنگ‌تره. شهر با یه رازِ کوچیکِ جمع‌وجورتر زندگی می‌کنه.",
            effects: { group: { socialTemp: -4 }, playerStats: [{ stat: "luck", min: 1, max: 2, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "footsteps_night",
    kind: "mystery",
    emoji: "👣",
    title: "قدم‌های نیمه‌شب",
    body: "هر شب، ساعت 3:14، صدای قدم از کوچه‌ی {group} میاد. آهسته. دور می‌شه. برمی‌گرده. فقط {p2} میگه تا حالا صداش رو نشنیده.",
    tags: ["mystery", "crime"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "wait_up",
        label: "🌙 بیدار بمون",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بیدار موند. 3:14 دقیقه: قدم‌ها اومدن، توقف کردن، و یه کاغذ زیر در رفت: «مراقبِ {p2} باش.» امضا: هیچ. مهر: یه قاشقِ کوچیک.",
            effects: {
              playerStats: [
                { stat: "energy", min: -12, max: -5, scope: "instigator" },
                { stat: "xp", min: 10, max: 24, scope: "instigator" },
              ],
              clue: "قدم‌های 3:14 هر شب یه یادداشت می‌گذارند. همه‌شان درباره‌ی یک نفرند.",
            },
          },
          {
            weight: 5,
            text: "{p1} خوابش برد و دقیقاً 3:14 تو خواب بیدار شد. تو خواب، کوچه خالی بود ولی همه‌ی چراغ‌ها روشن بودن. صبح، کفش‌هاش تمیز بود.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "dust",
        label: "🧂 خاک‌ماکه بپاش",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} روی زمین خاک‌ماکه پاشید. صبح: ردِ پایِ کامل، انسانی، ولی قدم‌هاش... آخر هر قدم، یه ردِ کوچیکِ پرِ قورباغه. هر دو با هم راه می‌رن.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 26, scope: "instigator" }],
              group: { chaos: 4 },
            },
          },
        ],
      },
      {
        key: "ask_p2",
        label: "🫥 از {p2} بپرس چرا نمی‌شنوی",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p2} مکث کرد و گفت: «چون وقتی قدم‌ها میان، من تو خوابِ دیگری هستم.» توضیح نداد. کسی نپرسید. بعضی جواب‌ها پرده‌ان.",
            effects: {
              relationships: [{ dim: "trust", min: 2, max: 6, scope: "pair" }],
              clue: "{p2} در ساعتِ 3:14 خوابِ دیگری می‌بیند — و در آن خواب، قدم‌ها را می‌شنود.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "clock_tower",
    kind: "mystery",
    emoji: "🕰",
    title: "برجِ ساعتِ خلاف",
    body: "برجِ ساعتِ {group} از دیروز 43 دقیقه جلوئه. ساعت‌سازِ شهر گفته «ساعته، حرفه‌ایه، خودش می‌دونه چیکار می‌کنه.» و رفته.",
    tags: ["mystery", "world"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "sync",
        label: "⏱ هماهنگش کن",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ساعت رو تنظیم کرد. 43 دقیقه بعد، دوباره جلو بود. تنظیمِ دوباره، جلو شدنِ دوباره. ساعت یه چیزی می‌دونه که ما نمی‌دونیم.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              clue: "برجِ ساعت عمداً 43 دقیقه جلو می‌زند — دقیقاً به اندازه‌ای که هر «بازنشانی» طول می‌کشد.",
            },
          },
        ],
      },
      {
        key: "follow",
        label: "⏳ با ساعتِ برج زندگی کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بر اساس برج زندگی کرد: 43 دقیقه از بقیه جلوتر. یه روزِ عالی داشت. همه‌چیز قبل از بقیه اتفاق افتاد. حتی حوادثش. مخصوصاً حوادثش.",
            effects: {
              playerStats: [
                { stat: "luck", min: -2, max: 3, scope: "instigator" },
                { stat: "chaos", min: 2, max: 4, scope: "instigator" },
              ],
            },
          },
          {
            weight: 5,
            text: "زندگیِ جلوتر خسته‌کننده بود: جواب‌ها قبل از سؤال‌ها می‌رسیدن. {p1} برگشت به زمانِ عادی و از اون روز ساعتِ مچیش رو با برجِ ساعت هماهنگ نمی‌کنه.",
            effects: { playerStats: [{ stat: "xp", min: 6, max: 14, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "archive",
        label: "📊 ثبتِ دقیق کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه ماه ثبت کرد: ساعتِ برج فقط قبل از «شب‌های خاص» جلو می‌زنه. ماهِ قرمزِ بعدی رو هم پیش‌بینی کردن. منتظرِ نتیجه‌ان.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              group: { influence: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "missing_photos",
    kind: "mystery",
    emoji: "🖼",
    title: "عکس‌های گم‌شده",
    body: "از آلبومِ دیواریِ {group} سه تا عکس غایبه. جاهاشون خالیه ولی نوکِ نوک‌ها هنوز رو دیواره. کسی عکس‌ها رو برنداشته. عکس‌ها رفتن.",
    tags: ["mystery"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "recreate",
        label: "📷 دوباره بگیر",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} عکس‌های جایگزین گرفت و آویزون کرد. صبح، اونا هم غیب شدن. حالا 6 جا خالی. عکس‌ها عکسِ دیگه‌ای رو دعوت می‌کنن.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              group: { chaos: 5 },
              clue: "هر عکسی که جای عکس‌های گم‌شده آویزان شود، خودش هم می‌رود. با یک مهمان.",
            },
          },
        ],
      },
      {
        key: "empty_frames",
        label: "▢ قاب‌های خالی رو جشن بگیر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد داد قاب‌های خالی بمونن به‌عنوان «یادبودِ چیزی که یادمون رفته». شهر قاب‌ها رو دوست داشت. هر‌کسی رد می‌شد یه لحظه می‌ایستاد.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              group: { reputation: 4, socialTemp: -4 },
            },
          },
        ],
      },
      {
        key: "night_watch",
        label: "🌌 شب‌بیداری",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شب نشست و نگاه کرد. 2:50 دقیقه، عکسِ چهارم از دیوار بلند شد و راه افتاد. {p1} تعقیبش کرد تا منطقه‌ی ممنوعه ☢. عکس رفت تو. {p1} برنگشت تا صبح.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 3, max: 6, scope: "instigator" },
                { stat: "energy", min: -15, max: -8, scope: "instigator" },
              ],
              clue: "عکس‌های گم‌شده به منطقه‌ی ممنوعه می‌روند. شب‌ها. همه با هم.",
            },
          },
          {
            weight: 5,
            text: "شب‌بیداریِ {p1} نتیجه نداد — یه خوابِ سنگین یهو اومد رو چشم‌هاش. صبح، یه عکسِ جدید بود رو دیوار: خودِ {p1}، خوابیده رو صندلی. عکاس: نامعلوم.",
            effects: { playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "red_ribbon_found",
    kind: "mystery",
    emoji: "🎀",
    title: "ریبونِ صورتی",
    body: "یه ریبونِ صورتی 🎀 وسطِ {group} پیدا شده. نو. پرِ گرهِ مرتب. {p3} می‌گه مالِ مادربزرگشه. مادر بزرگِ {p3} فوت شده. سال‌ها پیش.",
    tags: ["mystery", "ribbon"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "return",
        label: "🎀 به {p3} برگردون",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} ریبون رو برگردوند. {p3} یه مدت تو دستش گرفت، بعد بستش رو مچِ {p1}: «مالِ شماست. این‌جوری همیشه با کسیه.» ریبون روی مچِ {p1} مونده. گرمه.",
            effects: {
              relationships: [
                { dim: "friendship", min: 4, max: 9, scope: "pair" },
                { dim: "trust", min: 3, max: 7, scope: "pair" },
              ],
              playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }],
              title: { text: "🎀 بندِ صورتی", chance: 0.15 },
            },
          },
        ],
      },
      {
        key: "examine",
        label: "🔍 معاینه‌ش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با دقت نگاه کرد: ریبون از جنسِ قدیمیه ولی بو می‌ده به صابونِ امروزی. یعنی کسی از «اون طرف» تازه گذاشته‌ش. سؤال فقط یه کلمه‌ست: کی؟",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "ریبون‌های صورتیِ شهر همیشه قدیمی‌اند و همیشه تازه شسته شده‌اند. همیشه.",
            },
          },
        ],
      },
      {
        key: "keep",
        label: "🤫 نگهش دار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ریبون رو نگه داشت. از اون شب، هر صبح یه ریبونِ دیگه کنار بالششه. حالا 12 تا داره. هیچ‌کدوم رو به کسی نشان نداده. ترسیده. نباید.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
                { stat: "luck", min: -2, max: 1, scope: "instigator" },
              ],
              rumor: { text: "{p1} یه کلکسیونِ مخفی داره که شب‌ها بزرگ‌تر می‌شه", truth: true },
            },
          },
        ],
      },
    ],
  },
  {
    id: "radio_signal",
    kind: "mystery",
    emoji: "📻",
    title: "سیگنالِ شبانه",
    body: "رادیویِ قدیمیِ {group} بعد از ساعت 10 فقط یه کانال پخش می‌کنه: موسیقیِ خاطره‌انگیزِ نامعلوم و یه صدایی که می‌گه: «فردا، ساعت 2، درِ زیرزمین.»",
    tags: ["mystery", "npc"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "record",
        label: "🎙 ضبطش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} ضبط کرد. صبح که گوش داد، صدایِ «فردا ساعت 2» جای خودش داشت: «دیروز، ساعت 2.» ضبط‌ها هم از زمانِ شهر پیروی نمی‌کنن.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              followUp: { templateId: "basement_door", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.35 },
            },
          },
        ],
      },
      {
        key: "go",
        label: "🚪 فردا ساعت 2 برو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رفت. درِ زیرزمینِ کافه، باز بود. داخل: نورِ شمع، دو فنجون، و یه Note: «کم‌تر از دو نفر نمی‌شه.» {p1} برگشت و {p2} رو برد. دفعه‌ی بعد با هم رفتن. معما خودش تکمیل شد.",
            effects: {
              playerStats: [{ stat: "xp", min: 15, max: 35, scope: "instigator" }],
              relationships: [{ dim: "trust", min: 5, max: 12, scope: "pair" }],
              clue: "سیگنالِ رادیویی دعوت است — اما فقط برای دو نفر. زیرِ زمینِ کافه.",
            },
          },
          {
            weight: 5,
            text: "{p1} ساعت 2 رفت. درِ زیرزمین قفل بود. یه Note چسبیده بود: «امروز تنها. فردا با یه نفر.» صدا از قبل می‌دونست {p1} تنها میاد.",
            effects: { playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "unplug",
        label: "🔌 رادیو رو بکَن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} دوش رادیو رو کشید. رادیو به پخش ادامه داد. {p1} رادیو رو برد خیابون و به یه غریبه داد. شب، رادیو برگشت — در دستِ یه ویولن‌نواز. ساز زد. شهر تا صبح بیدار بود.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 6, socialTemp: -4 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "basement_door",
    kind: "mystery",
    emoji: "🚪",
    title: "درِ زیرزمین",
    body: "زیرِ کافه‌ی ماهور یه درِ چوبی‌ه که ماهور می‌گه «انباری»ـه. امروز صدایِ پیانو از پشتش میاد. ماهور پیانو نداره. فکر می‌کنم.",
    tags: ["mystery", "npc"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "knock",
        label: "🚪 بکوب",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} سه بار کوبید. پیانو ایستاد. بعد، از پشتِ در، همون سه کوب، این‌بار مؤدبانه، برگشت. {p1} بلند کرد دستش. جواب اومد. این‌بار با ریتمِ جدید. تا صبح ادامه داشت.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
                { stat: "xp", min: 10, max: 22, scope: "instigator" },
              ],
              memory: { kind: "moment", text: "شبِ مکالمه‌ی کوبیدنیِ {p1} با زیرزمین", importance: 74 },
            },
          },
          {
            weight: 5,
            text: "{p1} کوبید. در یه‌کم باز شد. داخل تاریک بود و فقط یه صندلی و یه نور. یه صدا: «هنوز نه.» در بسته شد. ماهور از پشت سر {p1} گفت: «قهوه‌ت سرد شد.»",
            effects: {
              clue: "پشتِ درِ زیرزمین فقط یک صندلی و یک نور است. صدای پیانو از جایی نمی‌آید — از همان جا می‌آید.",
            },
          },
        ],
      },
      {
        key: "ask_mahoor",
        label: "☕ از ماهور بپرس",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پرسید. ماهور آب رو ریخت تو چای و گفت: «زیرزمینِ کافه صاحبِ خودش رو داره. من فقط اجاره‌ی طبقه‌ی بالایی رو می‌دم.» بعد لبخند زد. موضوع بسته شد.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              clue: "ماهور فقط مستأجرِ طبقه‌ی بالای کافه است. زیرزمین صاحب دیگری دارد.",
            },
          },
        ],
      },
      {
        key: "listen",
        label: "👂 فقط گوش بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گوش داد و نت‌ها رو یادداشت کرد. یه آهنگِ کامل دراومد. {group} اون رو «سوناتِ زیرزمین» اسم گذاشت و هر شب ساعت 10 با سکوت اجراش می‌کنن.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { reputation: 4 },
              memory: { kind: "moment", text: "سوناتِ زیرزمین کشف شد", importance: 70 },
            },
          },
        ],
      },
    ],
  },

  // ═══ میم ═══
  {
    id: "meme_materializes",
    kind: "meme",
    emoji: "🌀",
    title: "میمِ {p1} واقعی شد",
    body: "اون جمله‌ای که همیشه می‌گید — «{p1} دوباره کرده» — از دیوارِ کوچه سرایت کرده به شهر. حالا غریبه‌ها هم می‌گن و معنی‌ش رو نمی‌دونن.",
    tags: ["absurd", "wholesome", "callback"],
    minMembers: 2,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "embrace",
        label: "🌀 خودت رو با میم یکی کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} میم رو پذیرفت و خودش شروع کرد به گفتنش. «دوباره کردم.» فرم رسمی صادر شد. شهر یه قهرمانِ بامزه‌ی دائمی پیدا کرد.",
            effects: {
              playerStats: [{ stat: "fame", min: 3, max: 8, scope: "instigator" }],
              title: { text: "🌀 آدمِ دوباره‌کرده", chance: 0.25 },
              followUp: { templateId: "legend_of_p1", afterMinutesMin: 4320, afterMinutesMax: 10080, chance: 0.3 },
            },
          },
        ],
      },
      {
        key: "trademark",
        label: "©️ ثبتش کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رفت دفترِ ثبتِ اسناد و میم رو رو اسم خودش ثبت کرد. مأمور پرسید: «موضوع؟» {p1}: «یه جمله.» مأمور: «پذیرفته شد.» حالا هر کس بگه، مجازه — با اجازه.",
            effects: {
              playerStats: [
                { stat: "money", min: -150, max: -50, scope: "instigator" },
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
              ],
              rumor: { text: "گفتنِ «دوباره کرده» الان نیاز به اجازه‌ی {p1} داره", truth: true },
            },
          },
        ],
      },
      {
        key: "deny",
        label: "🚫 انکار کن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} انکار کرد: «من هیچ‌وقت نگفتم.» ویدیوها اومدن. عکس‌ها اومدن. یه نوارِ کاست هم اومد. {p1} فقط گفت: «باشه ولی معنی‌ش نیست.» میم قوی‌تر شد.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              relationships: [{ dim: "tension", min: 0, max: 3, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "frog_meme",
    kind: "meme",
    emoji: "🐸",
    title: "همه فکر می‌کنن {p1} قورباغه‌ست",
    body: "یه میمِ جدید: «{p1} در اصل قورباغه‌ست.» منشأ نامعلوم. شواهد: «همیشه اون‌جاییه که قورباغه‌ها هستن.» شواهدِ خلاف: هیچ‌کس پیدا نکرده. کسی هم نمی‌خواد.",
    tags: ["frog", "absurd", "mystery"],
    minMembers: 2,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "confirm",
        label: "🐸 تایید کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گفت: «باشه. باشه. منم.» شهر عاشقش شد. قورباغه‌های واقعی هم قبولش کردن — به این معنی که دیگه رو دماغش نمی‌پرن. محترمه.",
            effects: {
              playerStats: [{ stat: "fame", min: 4, max: 9, scope: "instigator" }],
              title: { text: "🐸 قورباغه‌ی افتخاری", chance: 0.3 },
              memory: { kind: "legend", text: "{p1} رسماً قورباغه شد", importance: 85 },
            },
          },
        ],
      },
      {
        key: "disprove",
        label: "🔬 اثبات کن که نیستی",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} آزمایش داد: پرواز، پوست، صدای «کواک». همه انسانی بودن. نتیجه‌ی رسمی: «انسانه.» شهر جواب داد: «نیمه‌قورباغه‌ست.» علم بازهم باخت.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              rumor: { text: "{p1} فقط نصفه قورباغه‌ست", truth: false },
            },
          },
        ],
      },
      {
        key: "silence",
        label: "🤐 سکوتِ رمزآلود",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} هیچ جوابی نداد. فقط لبخند. سکوتش میم رو تبدیل کرد به «واقعیتِ تأییدنشده». محبوبیتِ {p1} 2 برابر شد. سکوت گاهی بلندترین جوابه.",
            effects: { playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "spoon_meme",
    kind: "meme",
    emoji: "🥄",
    title: "قاشقِ آهنگ‌ها",
    body: "یه ترانه‌ی محلیِ جدید تو {group} پخش شده: «قاشقمو پس بده، قاشقمو پس بده...» هیچ‌کس قاشقی از کسی نبرده. ترانه باز مخالف خودشه.",
    tags: ["spoon", "absurd"],
    minMembers: 2,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "remix",
        label: "🎧 ریمیکس بزن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} ریمیکس ساخت: نسخه‌ی «قورباغه‌کُواک». قورباغه‌ها همخوانی کردن. ترانه تا شهرِ بغلی رفت. {p1} الان تهیه‌کننده‌ست. شهر غر می‌کنه و می‌خنده.",
            effects: {
              playerStats: [
                { stat: "fame", min: 3, max: 7, scope: "instigator" },
                { stat: "money", min: 100, max: 500, scope: "instigator" },
              ],
              group: { chaos: 5 },
            },
          },
        ],
      },
      {
        key: "ban",
        label: "🔇 بخواه حذفشه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} خواست ترانه قطع شه. ترانه پشت ترانه‌ی دیگه قایم شد و بعد یه هفته برگشت — با بیتِ اضافه: «به {p1} هم گوش بده...» سانسور، بخشی از آهنگ شد.",
            effects: {
              playerStats: [{ stat: "reputation", min: -3, max: -1, scope: "instigator" }],
              rumor: { text: "{p1} از قاشق بیزاره", truth: false },
            },
          },
        ],
      },
      {
        key: "choir",
        label: "🎶 کرال بخون",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کل {group} رو دور هم جمع کرد تا ترانه رو یه بار، درست و مؤدبانه بخونن. بعد از اون اجرا، ترانه آروم شد و رفت تو آرشیو. بعضی آهنگ‌ها فقط دیده می‌خوان.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
              memory: { kind: "moment", text: "اجرای کرالِ «قاشقمو پس بده»", importance: 68 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "slogan_meme",
    kind: "meme",
    emoji: "📣",
    title: "شعارِ تکرارشونده",
    body: "از صبح یه جمله تو {group} تکرار می‌شه: «بی‌خیالِ ماه، بذار بریم تو.» معنی: هیچ. تأثیر: کامل. منشأ: کسی نمی‌دونه. احتمالاً {p3} خوابیده بود.",
    tags: ["absurd"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "spread",
        label: "📣 خودت هم بگو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} هم گفت. حالا همه می‌گن. جملاتِ بی‌معنی وقتی تکرار شن، معنی می‌سازن. شهر داره یه زبانِ نو می‌سازه. ماه هم داره گوش می‌ده.",
            effects: {
              relationships: [{ dim: "cooperation", min: 1, max: 3, scope: "all_pairs" }],
              group: { socialTemp: -4, chaos: 3 },
            },
          },
        ],
      },
      {
        key: "analyze",
        label: "🧠 تحلیلِ جدی بده",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} یه مقاله‌ی سه‌صفحه‌ای نوشت: «بررسیِ ساختارِ شعارِ تکراری.» کسی تا ته نخوند ولی همه لینکش رو نگه داشتن. مقاله خودش شد شعارِ جدید: «تحلیلِ بی‌خیال...»",
            effects: {
              playerStats: [
                { stat: "xp", min: 10, max: 25, scope: "instigator" },
                { stat: "fame", min: 1, max: 3, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "counter_slogan",
        label: "⚔️ شعارِ رقیب بساز",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} شعارِ مقابل رو ساخت: «بی‌خیالِ تو، بذار بریم ماه.» دو اردو تا شب شکل گرفتن. ماه قرمز نبود ولی سرخ بود از خنده.",
            effects: {
              relationships: [{ dim: "rivalry", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: 5, chaos: 4 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "p2_runs_like",
    kind: "meme",
    emoji: "🏃",
    title: "{p2} مثلِ یه بوقلمون می‌دوه",
    body: "یه میمِ تصویری: {p2} در حال دونده، با کپشن: «مثلِ بوقلمون.» خودِ عکس معمولیه. کپشن همه‌چیزه. {p2} هنوز ندیده.",
    tags: ["absurd", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "show",
        label: "😈 به {p2} نشون بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} نشون داد. {p2} یه دقیقه ساکت بود بعد گفت: «آخه راسته دیگه.» و شروع کرد به تمرینِ دوندهِ بوقلمونی. حالا دونده‌ی بوقلمونیِ حرفه‌ایه. شهر میم رو آپدیت کرد: «حرفه‌ای.»",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],
              playerStats: [{ stat: "fame", min: 1, max: 3, scope: "random_member" }],
            },
          },
          {
            weight: 5,
            text: "{p1} نشون داد و {p2} ناراحت شد. یه روز سرد. {p1} با یه چای برگشت و عذرخواهی کرد. میم مُرده ولی دوستی زنده.",
            effects: {
              relationships: [
                { dim: "tension", min: 2, max: 5, scope: "pair" },
                { dim: "friendship", min: 1, max: 4, scope: "pair" },
              ],
              playerStats: [{ stat: "money", min: -80, max: -20, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "protect",
        label: "🛡 جلوی پخشش رو بگیر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از {p2} محافظت کرد: «این میم تا این‌جا تمومه.» شهر احترام گذاشت. {p2} بعداً فهمید و یه هدیه‌ی بی‌متن داد. فقط یه دست‌خط: «ممنون.»",
            effects: {
              relationships: [
                { dim: "trust", min: 4, max: 9, scope: "pair" },
                { dim: "friendship", min: 3, max: 7, scope: "pair" },
              ],
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "escalate",
        label: "🎨 خودت کپشنِ بذار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} نسخه‌ی خودش رو ساخت: «{p2} مثلِ بوقلمون، {p1} مثلِ جغد.» میم‌ها جفت شدن. شهر الان یه جانورشناسیِ کامل داره. هر نفر یه حیوونه. سؤال: کی عقربه؟",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 4, socialTemp: -3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "legend_of_p1",
    kind: "meme",
    emoji: "🗿",
    title: "افسانه‌ی {p1}",
    body: "میم‌ها درباره‌ی {p1} به حدی رسیده که تو قهوه‌خانه‌ها دارن «افسانه‌ی {p1}» تعریف می‌کنن: شب‌ها گشت می‌زنه، قاشق نگه می‌داره، به اردک‌ها نون می‌ده.",
    tags: ["absurd", "callback", "frog"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 8,
    choices: [
      {
        key: "accept",
        label: "🗿 افسانه شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پذیرفت. از فردا، غریبه‌ها جلوش راهش رو باز می‌کنن. بچه‌ها عکس می‌گیرن. یه دلال قاشقِ امضاشده فروخت. افسانه‌ها اقتصاد دارن.",
            effects: {
              playerStats: [
                { stat: "fame", min: 5, max: 12, scope: "instigator" },
                { stat: "money", min: 100, max: 600, scope: "instigator" },
              ],
              title: { text: "🗿 افسانه‌ی زنده", chance: 0.35 },
              memory: { kind: "legend", text: "افسانه‌ی {p1} رسمی شد", importance: 90 },
            },
          },
        ],
      },
      {
        key: "humble",
        label: "🙏 فروتن باش",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گفت: «من فقط یه شهروندم.» شهر این جمله رو هم به افسانه اضافه کرد: «...و فروتن است.» تو افسانه‌ها، حتی فروتنی هم داستانه.",
            effects: {
              playerStats: [{ stat: "reputation", min: 3, max: 7, scope: "instigator" }],
              group: { reputation: 4 },
            },
          },
        ],
      },
      {
        key: "cash_in",
        label: "🎟 تورِ افسانه بچین",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تورِ «خانه‌ی افسانه» راه انداخت: مسیرِ پیاده‌روی، سه تا نقطه‌ی عکس، و یه فروشگاهِ کوچیک. شهر عاشقش شد. افسانه‌شناسیِ اقتصادی متولد شد.",
            effects: {
              playerStats: [{ stat: "money", min: 400, max: 1600, scope: "instigator" }],
              treasury: { min: 100, max: 400 },
              group: { reputation: 3, influence: 3 },
            },
          },
        ],
      },
    ],
  },

  // ═══ همکاری ═══
  {
    id: "repair_fountain",
    kind: "cooperative",
    emoji: "⛲",
    title: "حوضِ مرکزی ترک خورده",
    body: "حوضِ وسطِ {group} ترک خورده و آبش داره می‌ره تو خاک. قورباغه‌ها منتظرن. یعنی واقعاً منتظرن. صف بستن.",
    tags: ["frog", "wholesome", "festival"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 9,
    choices: [
      {
        key: "fix",
        label: "🧱 همه با هم تعمیرش کنیم",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "کارِ گروهی: یکی سیمان، یکی بیل، یکی چای. حوض درست شد و آب برگشت. قورباغه‌ها یکی‌یکی تشکر کردن با سکوتِ مرتب. {group} یه چیزِ مشترکِ تازه داره.",
            effects: {
              treasury: { min: -600, max: -250 },
              group: { reputation: 6, influence: 4, socialTemp: -8 },
              relationships: [{ dim: "cooperation", min: 4, max: 9, scope: "all_pairs" }],
              playerStats: [{ stat: "energy", min: -8, max: -3, scope: "participants" }],
              memory: { kind: "victory", text: "{group} حوض مرکزی را بازسازی کرد", importance: 78 },
            },
          },
          {
            weight: 3,
            text: "تعمیر نصفه‌کاره موند: آب برگشت ولی ترکِ پایین مونده. قورباغه‌ها گفتن (با سکوت): «فعلاً خوبه.» شهر یاد گرفت که «فعلاً» هم یه دستاوردشه.",
            effects: {
              treasury: { min: -350, max: -120 },
              group: { reputation: 2 },
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "frog_fund",
        label: "🐸 کمکِ قورباغه‌ها رو بپذیر",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} جلوی صفِ قورباغه‌ها رفت و کمک‌ها رو پذیرفت: سه سنگِ ریز، یه برگِ بزرگ، و یه مُهرِ لاکی. سنگ‌ها دقیقاً جاشون بودن. ترک بسته شد. هیچ‌کس توضیحی نداره.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              group: { chaos: 5, reputation: 3 },
              rumor: { text: "قورباغه‌ها سیمان‌کاری بلدن", truth: true },
            },
          },
        ],
      },
      {
        key: "skatepark",
        label: "🛹 بکنش اسکیت‌پارک",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پیشنهاد داد حوضِ خالی بشه اسکیت‌پارک. رأی‌گیری 50-50 شد. قورباغه‌ها رأیِ تعیین‌کننده رو دادن: سنگ‌ریزه‌ها رو برداشتن. حوض موند. آب موند. همه راضی بودن، یه‌کم هم نه.",
            effects: {
              playerStats: [{ stat: "fame", min: 1, max: 3, scope: "instigator" }],
              group: { socialTemp: 5, chaos: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "group_cleanup",
    kind: "cooperative",
    emoji: "🧹",
    title: "روزِ پاکسازیِ {group}",
    body: "کوچه‌ها انبار شده. {p2} می‌گه بینِ خیلی از زباله‌ها چیزهای مفید قایمه. {p3} می‌گه زباله‌ها خودشون دارن ارگانیک می‌شن. دوتاش درست می‌گن.",
    tags: ["wholesome"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "all",
        label: "🧹 بسیجِ عمومی",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "همه اومدن. تا غروب، کوچه‌ها تمیز شد و یه تپه‌ی «چیزهای پیدا‌شده» ساختن: سه‌تا قاشق، یه ساعت‌ِ مچی، و یه عکسِ قدیمی که هیچ‌کس یادش نیست کجا گرفته شده.",
            effects: {
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "participants" }],
              treasury: { min: 50, max: 300 },
              group: { reputation: 5, socialTemp: -6 },
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
              clue: "تپه‌ی «چیزهای پیدا‌شده» هر سال یک عکسِ ناشناخته دارد. قاشق‌ها هیچ‌وقت دو تا شبیه هم نیستند.",
            },
          },
        ],
      },
      {
        key: "treasure",
        label: "💰 بازارچه‌ی چیزارِ پیدا‌شده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} چیزهای پیداشده رو بازارچه کرد. درآمد رفت تو صندوق. یه‌سری چیز خلاصه نشده: کیمو اومد و همه‌ی قاشق‌ها رو خرید. با سکه‌ی واقعی.",
            effects: {
              treasury: { min: 300, max: 900 },
              playerStats: [{ stat: "money", min: 50, max: 200, scope: "participants" }],
              group: { reputation: 3 },
            },
          },
        ],
      },
      {
        key: "lazy",
        label: "😌 فردا می‌کنیم",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گفت فردا. فردا {p2} گفت فردا. فرداش {p3} گفت پارسال هم گفتیم. زباله‌ها بالا آمدن و تا نیمه‌ی پا. کیمو ازشون یه آپارتمان ساخت.",
            effects: {
              group: { chaos: 5, reputation: -3 },
              relationships: [{ dim: "cooperation", min: -4, max: -1, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "save_the_cat",
    kind: "cooperative",
    emoji: "🐱",
    title: "گربه رو درخت بالا رفته",
    body: "یه بچه‌گربه رو درختِ سروِ بزرگ گیر کرده. بالا نمیاد، پایین نمیاد. نگاه می‌کنه. گربه‌ی شهردار هم اومده پایینِ درخت. مشغولِ نگاهِ نگاهِ گربه‌ست.",
    tags: ["cat", "pet", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "ladder",
        label: "🪜 نردبون و طناب",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با نردبون بالا رفت و گربه رو آورد پایین. {p2} طناب رو مهار می‌کرد، {p3} بالش گذاشته بود. گربه رو بالش نشست و شهر کف زد. گربه‌ی شهردار تاییدش کرد با یه میو.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 3, max: 6, scope: "all_pairs" }],
              group: { reputation: 4, socialTemp: -5 },
              title: { text: "🐱 نجات‌دهنده‌ی گربه‌ها", chance: 0.2 },
            },
          },
          {
            weight: 4,
            text: "نردبون کوتاه بود. {p1} روی شونه‌ی {p2} رفت، {p2} روی بشکه. برجِ انسانیِ نجات. گربه خودش پرید — رو دمِ {p3}. صفرِ خون، یه خراشِ افتخاری.",
            effects: {
              playerStats: [{ stat: "xp", min: 5, max: 12, scope: "participants" }],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "food",
        label: "🐟 با غذا بیانش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کاسه‌ی غذا رو گذاشت پایینِ درخت. گربه یه ربع نگاه کرد، بعد اومد پایین، غذا رو خورد و برگشت رو درخت. شهر درسِ صبر گرفت. غذا ول شد برای روزِ بد.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 16, scope: "instigator" }],
              group: { socialTemp: -4 },
            },
          },
        ],
      },
      {
        key: "mayor_cat",
        label: "🐈 از گربه‌ی شهردار کمک بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از گربه‌ی شهردار التماس کرد. گربه‌ی شهردار دو دقیقه به گربه‌ی درخت نگاه کرد و «میو» گفت. بچه‌گربه پایین اومد. تمام. قدرت واقعی همینه.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              group: { influence: 3, reputation: 2 },
              memory: { kind: "moment", text: "گربه‌ی شهردار گربه را نجات داد — با یک میو", importance: 76 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "festival_float",
    kind: "cooperative",
    emoji: "🎪",
    title: "گردونه‌ی جشنِ فصلی",
    body: "جشنِ فصلِ بعدی داره نزدیک می‌شه. {group} تصمیم گرفت یه گردونه‌ی خیلی خیلی بزرگ بسازه. طرحِ پیشنهادی: قورباغه‌ای که قاشق بلند کرده. کلاسیک.",
    tags: ["festival", "frog", "spoon", "wholesome"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 9,
    choices: [
      {
        key: "build",
        label: "🔨 بسازیمش",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "سه روز کار. سه شب بحثِ رنگ. گردونه‌ی قورباغه‌-قاشق‌دار کامل شد و تو جشن، جایزه‌ی اول رو برد. قورباغه‌های واقعی هم سوار شدن. کسی مجازشون نکرد. تقویمِ عکسِ فصل بعد هم اونا شدن.",
            effects: {
              treasury: { min: -900, max: -400 },
              group: { reputation: 8, influence: 6, socialTemp: -10 },
              relationships: [{ dim: "cooperation", min: 5, max: 12, scope: "all_pairs" }],
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "participants" }],
              memory: { kind: "victory", text: "گردونه‌ی قورباغه-قاشق جایزه‌ی اول جشن را برد", importance: 88 },
            },
          },
          {
            weight: 4,
            text: "گردونه نصفه‌ساخته تو جشن رفت. چرخِ سمتِ چپ نداشت. می‌لرزید و هر از گاهی به رهگذرا دمش رو می‌کشید. مقام: «محبوب‌ترین». جایزه‌ی اصلی نه، قلبِ مردم آره.",
            effects: {
              treasury: { min: -500, max: -200 },
              group: { reputation: 5, socialTemp: -6 },
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "minimal",
        label: "🎨 مینیمال: فقط ریبونِ صورتی",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} طرحِ مینیمال داد: یه گاری با یه ریبونِ صورتیِ بزرگ. داورها گیج شدن، عمیقاً. مقام دوم، و یه سؤالِ بی‌جواب: «معنیش چیه؟» {p1}: «هیچ.» داورها: «نابغه.»",
            effects: {
              treasury: { min: -250, max: -100 },
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              group: { reputation: 4 },
            },
          },
        ],
      },
      {
        key: "sabotage_rival",
        label: "😈 رنگِ گردونه‌ی رقیب رو قایم کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رنگِ گروهِ رقیب رو قایم کرد. جشن‌روز، اونا با گردونه‌ی سفید اومدن: «مفهوم: خلأ.» بردن. {p1} با دستِ خالی و یه درسِ بزرگ برگشت: سانسور، خلاقیتِ رقیب رو بیشتر می‌کنه.",
            effects: {
              playerStats: [
                { stat: "crime", min: 1, max: 3, scope: "instigator" },
                { stat: "reputation", min: -3, max: -1, scope: "instigator" },
              ],
              relationships: [{ dim: "tension", min: 3, max: 7, scope: "pair" }],
            },
          },
        ],
      },
    ],
  },

  // ═══ همکاری (۲) ═══
  {
    id: "community_garden",
    kind: "cooperative",
    emoji: "🌱",
    title: "باغچه‌ی محله",
    body: "زمینِ خالیِ کنارِ کافه ماهور یه قرن بی‌صاحب بوده. ماهور گفته: «بسازید چیزی که سبزه.» {group} پای کار اومده.",
    tags: ["wholesome", "festival"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 9,
    choices: [
      {
        key: "plant",
        label: "🌱 بکاریم",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "بذری که کاشتن، گلِ ناشناخته‌ای داد. ماهور گفت: «این گل تو کتاب‌ها نیست.» گل هر شب یه‌کم نور می‌ده. باغچه محلِ قرارِ شبانه شد.",
            effects: {
              treasury: { min: -300, max: -120 },
              group: { reputation: 5, socialTemp: -6 },
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
              clue: "گلِ باغچه‌ی محله در هیچ کتابی نیست — و شب‌ها نور می‌دهد. بذرةش از سالِ 98 مانده.",
            },
          },
          {
            weight: 4,
            text: "باغچه سبز شد با گوجه. گوجه‌ها حالا ابعادِ عجیبی دارن. یکی‌شون به اندازه‌ی یه بچه‌گربه است. کسی هنوز خوردهش نکرده. فقط نگاهش می‌کنن.",
            effects: {
              treasury: { min: 150, max: 500 },
              playerStats: [{ stat: "money", min: 30, max: 120, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "orchard",
        label: "🌳 درختِ بزرگ بکار",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد داد فقط یه درخت: نهالِ سرو. کاشتنش یه روز طول کشید، مراقبتش یه عمر. {p2} گفت: «برای بچه‌های آینده.» هیچ‌کس بچه نداشت. حالا همه یه دلیلِ مشترک دارن.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              group: { reputation: 4, influence: 3 },
              memory: { kind: "moment", text: "درختِ آینده در {group} کاشته شد", importance: 72 },
            },
          },
        ],
      },
      {
        key: "frog_pond",
        label: "🐸 یه حوضِ کوچیک هم بساز",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گوشه‌ی باغچه یه حوضِ کوچیک ساخت. سه روز بعد: یازده قورباغه. باغچه الان منطقه‌ی خودمختارِ قورباغه‌هاست و {p1} سفیرِ رسمیِ انسانه.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              treasury: { min: -200, max: -80 },
              group: { chaos: 4, reputation: 2 },
              title: { text: "🐸 سفیرِ باغچه", chance: 0.18 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "ducks_relocate",
    kind: "cooperative",
    emoji: "🦆",
    title: "اردک‌های بی‌خانمان",
    body: "کانالِ آبِ {group} داره خشک می‌شه. اردک‌ها — همون‌هایی که تشکل دارن — منتظرِ تصمیمِ شهران. این‌بار نون مسئله نیست. خانه‌ست.",
    tags: ["duck", "wholesome", "callback"],
    minMembers: 3,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "fountain",
        label: "⛲ اون‌ها رو به حوض ببر",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} و {p2} اردک‌ها رو با یه راهپیماییِ محترمانه بردن حوضِ مرکزی. قورباغه‌ها خونه‌های کناری رو خالی کردن. همزیستیِ رسمی برقرار شد. فشنِ محله عوض شد: همه رنگِ اردکی می‌پوشن.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 4, max: 8, scope: "all_pairs" }],
              group: { reputation: 6, socialTemp: -8 },
              memory: { kind: "victory", text: "اردک‌ها و قورباغه‌های {group} هم‌خانه شدند", importance: 80 },
            },
          },
        ],
      },
      {
        key: "negotiate_city",
        label: "🏛 با شهرداری مذاکره کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} رفت تو جلسه‌ی شهرداری با سه اردک. چهار ساعت بعد اومد بیرون: کانال تعمیر می‌شه، هزینه از صندوق، و یه امتیاز عجیب: شهردار اردک‌ها رو «ساکنینِ ممتاز» اعلام کرد.",
            effects: {
              treasury: { min: -800, max: -350 },
              group: { influence: 5, reputation: 3 },
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
            },
          },
          {
            weight: 4,
            text: "مذاکره طول کشید. اردک‌ها عصبانی نشدن — محترمانه منتظر موندن. طولِ مذاکره، خودش پیامزد. کانال نصفه پر شد. ادامه‌اش به آینده‌ست.",
            effects: { treasury: { min: -400, max: -150 }, group: { reputation: 2 } },
          },
        ],
      },
      {
        key: "houses",
        label: "🏠 خونه‌ی اردکی بساز",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} برای هر اردک یه خانه‌ی چوبی ساخت با شماره‌ی در. اردک‌ها قبول کردن. حالا کوچه به «اردک‌آباد» معروفه و پستچی از عصبیّت مرخصی گرفته.",
            effects: {
              playerStats: [
                { stat: "money", min: -450, max: -180, scope: "instigator" },
                { stat: "fame", min: 2, max: 6, scope: "instigator" },
              ],
              group: { chaos: 5, reputation: 3 },
              title: { text: "🏠 معمارِ اردک‌آباد", chance: 0.2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "power_outage_night",
    kind: "cooperative",
    emoji: "🕯",
    title: "شبی که چراغ‌ها خاموش شدن",
    body: "کل {group} خاموش شده. نه موبایل، نه فریزرِ کافه، نه چراغِ خیون. فقط ستاره‌ها. شهر یادش رفته بود ستاره‌ها این‌قدر زیادن.",
    tags: ["wholesome", "weather", "world"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "candles",
        label: "🕯 شمع‌ها رو بیار",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} شمع‌ها رو آورد، {p2} چای، {p3} قصه‌های قدیمی. شهر دورِ یه میزِ نورانی نشست و تا خوابِ برق، خوش بود. برق که برگشت، همه یه ثانیه دیرتر بلند شدن.",
            effects: {
              relationships: [{ dim: "friendship", min: 4, max: 9, scope: "all_pairs" }],
              group: { socialTemp: -10, reputation: 3 },
              playerStats: [{ stat: "energy", min: -5, max: 5, scope: "participants" }],
              memory: { kind: "moment", text: "شبِ شمعِ {group}", importance: 74 },
            },
          },
        ],
      },
      {
        key: "stargaze",
        label: "🌌 ستاره‌شماری",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شمارش رو شروع کرد. جمع: بیشتر از هر عددی که سرِ زبونه. {p2} یه صورتِ فلکیِ جدید کشید: «قاشقِ بزرگ». تا امروز آسمونِ {group} یه قاشق داره.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "participants" }],
              rumor: { text: "صورتِ فلکیِ قاشق فقط از {group} دیده می‌شه", truth: true },
            },
          },
        ],
      },
      {
        key: "generator",
        label: "🔌 ژنراتور راه بنداز",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ژنراتور پیدا کرد و فقط فریزرِ کافه رو وصل کرد. بستنی نجات پیدا کرد. شهر زیرِ نورِ فریزر جشن گرفت. اولویت‌ها: شفاف.",
            effects: {
              playerStats: [
                { stat: "money", min: -200, max: -80, scope: "instigator" },
                { stat: "reputation", min: 1, max: 3, scope: "instigator" },
              ],
              group: { socialTemp: -4 },

            },
          },
          {
            weight: 5,
            text: "ژنراتور {p1} صدای عجیبی داشت و بعد سه دقیقه خودش خاموش شد. سکوت برگشت. شهر تصمیم گرفت سکوت رو دوست داره. فقط برای امشب.",
            effects: { group: { socialTemp: -3 } },
          },
        ],
      },
    ],
  },
  {
    id: "build_bench",
    kind: "cooperative",
    emoji: "🪑",
    title: "نیمکتِ عمومی",
    body: "قنبر گفته بود «برای نیمکت اومده بودم». حالا {group} می‌تونه نیمکت رو بسازه. جاش مشخصه: زیرِ درختِ سرو. رو به کافه. رو به همه.",
    tags: ["wholesome", "callback", "npc"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "build",
        label: "🪑 بسازیم",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "نیمکت ساخته شد: چوبِ صیقلی، اسمِ {group} رو دسته‌ش. قنبر اومد، نشست، یه ساعت موند و رفت. از اون روز هر کسی که خسته‌ست یه جای مشخص داره.",
            effects: {
              treasury: { min: -400, max: -180 },
              group: { reputation: 6, socialTemp: -7 },
              relationships: [{ dim: "cooperation", min: 3, max: 7, scope: "all_pairs" }],
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "participants" }],
              memory: { kind: "victory", text: "نیمکتِ عمومیِ {group} ساخته شد", importance: 76 },
            },
          },
        ],
      },
      {
        key: "plaque",
        label: "🪧 یه پلاکِ کوچیک نصب کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} روی نیمکت یه پلاک کوچیک نصب کرد: «برای کسایی که منتظر موندن.» رهگذرا می‌خونن و می‌نشینن. یه‌کم بیشتر منتظر می‌مونن. عجیبه.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              group: { reputation: 3 },
              title: { text: "🪑 نیمکت‌سازِ محله", chance: 0.15 },
            },
          },
        ],
      },
      {
        key: "bench_fund",
        label: "💰 صندوقِ نیمکت",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} سیستم گذاشت: نشستن روی نیمکت، رایگان؛ ولی دِلت بخواد، سکه بنداز تو صندوقِ کنارش. تا شب، صندوق پر شد. مردم بلدن چی‌جوری خوب باشن. فقط باید جا بدی.",
            effects: {
              treasury: { min: 200, max: 700 },
              playerStats: [{ stat: "reputation", min: 1, max: 4, scope: "instigator" }],
              group: { reputation: 3 },
            },
          },
        ],
      },
    ],
  },

  // ═══ رقابت ═══
  {
    id: "style_duel",
    kind: "competition",
    emoji: "👔",
    title: "دوئلِ استایل",
    body: "امروزِ {group}: دوئلِ استایل. داورها: گربه‌ی شهردار (استعدادِ ذاتی)، ماهور (سخت‌گیر)، و کیمو (امتیازِ عاطفه). چالش: بهترین استایل با یه {item}.",
    tags: ["fashion", "item", "festival"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "compete",
        label: "👔 برو تو مسابقه",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با {item} یه استایلِ آینده‌نگر ساخت. کیمو 10 داد. ماهور 7: «جسورانه.» گربه‌ی شهردار خمیازه کشید و 9. مجموع: قهرمانیِ بحث‌برانگیز.",
            effects: {
              playerStats: [
                { stat: "fame", min: 3, max: 8, scope: "instigator" },
                { stat: "money", min: 100, max: 400, scope: "instigator" },
              ],
              title: { text: "👔 آیکنِ استایلِ {group}", chance: 0.22 },
              relationships: [{ dim: "rivalry", min: 1, max: 3, scope: "all_pairs" }],
            },
          },
          {
            weight: 5,
            text: "استایلِ {p1} قوی بود ولی {p2} با یه کارِ ساده برد: فقط {item} رو به زیبایی انداخته بود رو شونه. سادگی، داورِ داورهاست.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              relationships: [{ dim: "rivalry", min: 2, max: 4, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "referee",
        label: "⚖️ داورِ چهارم شو",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} داوری رو قبول کرد و منصفانه امتیاز داد. همه روحیه گرفتن. امتیازِ نهاییِ {p1} به {p3}: «10 — چون با اعتمادِ نفسِ قرضی اومد.» {p3} هنوز افتخار می‌کنه.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              relationships: [{ dim: "trust", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "sabotage",
        label: "✂️ لباسِ رقیب رو کوچیک کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} لباسِ {p2} رو یه سایز کوچیک کرد. {p2} پوشیدش و اتفاقاً بهتر شد: باریک‌تر، شیک‌تر. داورها عاشقشن. {p1} نگاه کرد به قیچی. قیچی جوابی نداشت.",
            effects: {
              playerStats: [{ stat: "crime", min: 1, max: 3, scope: "instigator" }],
              relationships: [
                { dim: "tension", min: 3, max: 6, scope: "pair" },
                { dim: "rivalry", min: 1, max: 3, scope: "pair" },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: "wealth_flex",
    kind: "competition",
    emoji: "💎",
    title: "مسابقه‌ی میلیاردهای محله",
    body: "سنتِ فصلیِ {group}: هرکس نشان می‌ده چی داره. نه برای غرور — برای... باشه، برای غرور. امسال داور: آرش. طبیعتاً.",
    tags: ["money", "fashion", "absurd"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "flex",
        label: "💎 نشونت بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} کل دارایی‌ش رو چید جلوی کافه. آرش نگاه کرد، بعد دستش رو گذاشت رو شونه‌ی {p1}: «قربونت. ولی ما از این‌ها زیاد دیدیم.» دستِ آرش روی شونه، امتیازِ واقعیه.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 6, scope: "instigator" },
                { stat: "money", min: -200, max: -50, scope: "instigator" },
              ],
              title: { text: "💎 گردن‌کلفتِ محترمِ {group}", chance: 0.2 },
            },
          },
          {
            weight: 5,
            text: "فِلکسِ {p1} سریع تمام شد چون {p3} فقط یه قاشق برداشت بالا. آرش بلافاصله اعلام کرد: «برنده.» قاشقِ افسانه‌ای، هرچی باشه، هنوز رکورد داره.",
            effects: {
              playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }],
              rumor: { text: "قاشق در مسابقه‌ی ثروتِ {group} برنده شد", truth: true },
            },
          },
        ],
      },
      {
        key: "anti_flex",
        label: "🧦 جیب‌های خالی رو بغل کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} روی صحنه دو تا جیبِ خالی رو برگردوند: «من چیزی ندارم که ازش بترسم.» آرش اشکش دراومد. جایزه‌ی ویژه‌ی «شکستِ سیستم» به {p1} رسید. جایزه: یه سکه. جدی.",
            effects: {
              playerStats: [
                { stat: "reputation", min: 3, max: 7, scope: "instigator" },
                { stat: "money", min: 1, max: 1, scope: "instigator" },
              ],
              memory: { kind: "moment", text: "{p1} با جیب‌های خالی برنده شد", importance: 72 },

            },
          },
        ],
      },
      {
        key: "invest",
        label: "🔄 ثروتت رو خرجِ شهر کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به جای فِلکس، پول رو داد به پروژه‌ها: نیمکت، چراغ، بادکنک برای بچه‌ها. آرش زیر لب گفت: «این دیگه معنیِ ثروته.» و برای اولین بار، حق با اون بود.",
            effects: {
              playerStats: [{ stat: "money", min: -1000, max: -400, scope: "instigator" }],
              treasury: { min: 400, max: 1000 },
              group: { reputation: 6 },
              title: { text: "💸 ثروتمندِ واقعی", chance: 0.2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "wits_contest",
    kind: "competition",
    emoji: "🧠",
    title: "مسابقه‌ی زرنگی",
    body: "کافه‌ی ماهور میزبانی می‌کنه: سه سؤال، سه فینال. سؤالِ آخر سنتیه: «قاشقِ افسانه‌ای چند تا سوراخ داره؟» هر جوابی قبوله، به شرطِ دفاع.",
    tags: ["spoon", "mystery"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "answer_zero",
        label: "🥄 صفر: قاشق سوراخ نداره",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} جواب داد: «صفر. قاشق که نداره سوراخ بذاره.» ماهور مکث کرد: «قابل دفاع.» نمره‌ی کامل. {p2} اعتراض کرد و اخراج شد. نیمه‌فینال بود.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 30, scope: "instigator" }],
              relationships: [{ dim: "rivalry", min: 2, max: 5, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "answer_meta",
        label: "🌀 هفت: چون باید معما بمونه",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} جواب داد: «هفت سوراخ. چون قاشقِ افسانه‌ای مثل لانه‌ای از معماهاست که سوراخ‌هاش به هم می‌رسن...» همه گیج شدن، ماهور خندید: «برنده.» منطقِ چرخشی، همیشه برنده‌ست.",
            effects: {
              playerStats: [
                { stat: "xp", min: 15, max: 35, scope: "instigator" },
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
              ],
              memory: { kind: "moment", text: "{p1} با «هفت سوراخ» مسابقه‌ی زرنگی را برد", importance: 68 },
            },
          },
        ],
      },
      {
        key: "protest",
        label: "🚫 سؤالِ آخر بی‌معنیه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} اعتراض کرد: «سؤالِ آخری حتی علامت سؤال نیست!» ماهور با آرومی چای ریخت و گفت: «دقیقاً.» اعتراض رد شد ولی {p1} رو همه یادشون موند. اعتراضِ درست هم امتیازه.",
            effects: {
              playerStats: [{ stat: "reputation", min: 1, max: 4, scope: "instigator" }],
              group: { socialTemp: 3 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "meme_off",
    kind: "competition",
    emoji: "⚡",
    title: "جنگِ میمِ {p1} و {p2}",
    body: "از صبح، {p1} و {p2} دارن میم رد و بدل می‌کنن. هر میم تیزتر از قبلی. بقیه‌ی {group} تماشاچی و قاضی. کیمو شرط‌بندی راه انداخته.",
    tags: ["absurd"],
    minMembers: 3,
    cooldownMinutes: 1440,
    weight: 10,
    choices: [
      {
        key: "join",
        label: "⚡ بپر وسطش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با یه میمِ سه‌لایه وارد شد. {p2} و {p3} هر دو جوابش رو با هم دادن — یعنی اتفاقاً با هم هم‌نظر شدن. جنگِ میم به صلحِ میم رسید. کیمو ورشکست شد.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -5 },
            },
          },
          {
            weight: 5,
            text: "میمِ {p1} جواب نداد — لحنش قدیمی بود. {p3} فقط «زشت بود» نوشت. {p1} از میم‌سازی مرخصی گرفت. سه روز. تازه اولِ دوره‌ست.",
            effects: { playerStats: [{ stat: "reputation", min: -3, max: 0, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "judge",
        label: "⚖️ قاضی شو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با یه جدولِ امتیازدهیِ رسمی وسط اومد: خلاقیت 40، زمان‌بندی 30، خطرِ جوک 30. دعوا به نظام دراومد. برنده: هر دو، به‌طور مساوی. عدالت گاهی خنده‌ست.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              relationships: [{ dim: "cooperation", min: 2, max: 4, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "archive",
        label: "📚 آرشیوِ میم بساز",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شروع کرد به آرشیو کردنِ هر میم با تاریخ و شواهد. «موزه‌ی میمِ {group}» متولد شد. ورودی: مجانی. خروجی: دلتنگیِ یه جوکِ قدیمی.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              group: { reputation: 3, influence: 2 },
              memory: { kind: "moment", text: "موزه‌ی میمِ {group} افتتاح شد", importance: 66 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "karaoke_battle",
    kind: "competition",
    emoji: "🎤",
    title: "نبردِ آوازِ شبانه",
    body: "میکروفونِ کافه (واقعیه، از 98 مونده) امشب مفتحه. شهر بالا-پایین. بخشِ ویژه: اجرای ترانه‌ی «قاشقمو پس بده» با سبکِ دلخواه.",
    tags: ["spoon", "festival", "absurd"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "sing_sad",
        label: "🎻 اجرای غمگین",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} «قاشقمو پس بده» رو آوازِ عاشقانه-غمگین خوند. سه نفر گریه کردن. یکی از گریه‌کننده‌ها قورباغه بود. کسی متوجه نشد کِی شروع کرد. اثرِ {p1}: ماندگار.",
            effects: {
              playerStats: [{ stat: "fame", min: 3, max: 7, scope: "instigator" }],
              group: { socialTemp: -6, reputation: 2 },
              memory: { kind: "moment", text: "اجرای غمگینِ {p1} از «قاشقمو پس بده»", importance: 72 },
            },
          },
        ],
      },
      {
        key: "sing_rap",
        label: "🎧 رپِ قاشقی",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} نسخه‌ی رپ ساخت: «قاشق/قاشق/چرا رفتی/برگردی...» بیت از {p3}، ویز از {p1}. کف زدن تا دیر. ماهور فقط گفت: «صدات بلنده.» یعنی برنده‌ای.",
            effects: {
              playerStats: [
                { stat: "fame", min: 4, max: 9, scope: "instigator" },
                { stat: "energy", min: -8, max: -3, scope: "instigator" },
              ],
              title: { text: "🎤 رپرِ قاشقی", chance: 0.25 },
            },
          },
        ],
      },
      {
        key: "duet",
        label: "🎭 دوخوانی با {p2}",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p1} و {p2} دوخوانی اجرا کردن. وسطِ آهنگ، هر دو کلمه رو فراموش کردن و ادامه دادن با «لا-لا». شهر همراهی کرد. بهترین لحظه‌ی امشب، همون جا بود.",
            effects: {
              relationships: [{ dim: "friendship", min: 4, max: 8, scope: "pair" }],
              playerStats: [{ stat: "fame", min: 2, max: 4, scope: "participants" }],
              group: { socialTemp: -8 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "staring_contest",
    kind: "competition",
    emoji: "👁",
    title: "مسابقه‌ی خیره‌شدن",
    body: "تورنمنتِ امشبِ {group}: خیره‌شدن. قوانین: بدون پلک، بدون خندیدن، بدون فکر کردن به قورباغه. اخطارِ آخر مهمه.",
    tags: ["absurd", "frog"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "compete",
        label: "👁 بزن تو",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با یه تمرکزِ مرگبار رقابت رو برد. چشم‌هاش بعدش یه ساعت قرمز موند. {p2} فقط گفت: «چشمات قشنگه ولی ترسناک.» مقام: اول. تاج: چشم‌قطره.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
                { stat: "energy", min: -5, max: -2, scope: "instigator" },
              ],
              title: { text: "👁 خیره‌شده‌ی مطلق", chance: 0.2 },
            },
          },
          {
            weight: 5,
            text: "{p1} باخت چون {p2} یه قورباغه رو انداخت رو شونه‌ش. {p1} پلک زد، خندید و داد زد هم‌زمان. سه اخطار یه‌جا. تاریخی.",
            effects: {
              relationships: [{ dim: "rivalry", min: 1, max: 4, scope: "pair" }],
              playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "referee",
        label: "🧑‍⚖️ داوری",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} داور شد و قوانین رو سخت‌گیرانه اجرا کرد: یه پلک، یه اخطار؛ یه فکرِ قورباغه‌ای، حذف. فینالِ تاریخی: {p2} و {p3}، نُه دقیقه. هیچ‌کس نبرد. هر دو قهرمان.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              group: { socialTemp: -4, chaos: 2 },
            },
          },
        ],
      },
      {
        key: "frog_final",
        label: "🐸 قورباغه رو بذار فینال",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد داد فینال با یه قورباغه برگزار شه. قورباغه هیچ‌وقت پلک نزد — چون پلک نداره به اون شکل. قهرمانِ مطلقِ همیشگیِ مسابقه اعلام شد. آدم‌ها فقط برای مقام دوم می‌جنگن.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 5, scope: "instigator" }],
              group: { chaos: 6 },
              memory: { kind: "legend", text: "قورباغه‌ی قهرمانِ خیره‌شدنِ همیشگی", importance: 82 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "cooking_contest",
    kind: "competition",
    emoji: "🍳",
    title: "مسابقه‌ی آشپزی: قاشقِ طلایی",
    body: "ماهور جامِ «قاشقِ طلایی» رو گذاشته وسط. چالش: بهترین غذای گرم با هر چیزی که تو {group} پیدا می‌شه. شرطِ ماهور: «باید یکی غذا رو با عشق بچشه.»",
    tags: ["spoon", "wholesome", "festival"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "compete",
        label: "🍳 بپز و ببرش",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با یه {item} و سه‌تا سیب‌زمینی معجزه کرد. ماهور چشید، چشم‌هاش بسته شد، و جایزه رو داد بی‌کلام. {p2} نفر دوم شد با «آبِ گرمِ خوش‌مزه» که هیچ‌کس توضیحش رو نمی‌دونه.",
            effects: {
              playerStats: [
                { stat: "fame", min: 3, max: 7, scope: "instigator" },
                { stat: "money", min: 100, max: 500, scope: "instigator" },
              ],
              title: { text: "🍳 صاحبِ قاشقِ طلایی", chance: 0.25 },
            },
          },
          {
            weight: 5,
            text: "غذای {p1} یه‌کم زیادی خلاقانه بود: شیرینیِ گرم با نمک. ماهور چشید، سکوت کرد و گفت: «جسورانه.» مقام: تقدیرِ ویژه. یعنی نه.",
            effects: { playerStats: [{ stat: "xp", min: 8, max: 16, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "team",
        label: "🤝 تیمی بپزیم",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تیم ساخت: {p2} آشپز، {p1} مِزه، {p3} خوش‌آهنگی. غذای تیمی جام رو برد. قاشقِ طلایی رو گذاشت تو کافه — برای همه. ماهور فقط لبخند زد.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "participants" }],
              relationships: [{ dim: "cooperation", min: 4, max: 9, scope: "all_pairs" }],
              group: { reputation: 4, socialTemp: -6 },
              memory: { kind: "victory", text: "تیمِ {group} قاشقِ طلایی را برد", importance: 75 },
            },
          },
        ],
      },
      {
        key: "secret_ingredient",
        label: "🌿 ماده‌ی مخفی بذار",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} ماده‌ی مخفی ریخت: عسلِ قنبر. داورها جن زدند. ماهور بعد از دو قاشق متوقف شد و گفت: «این چیه؟» {p1}: «عشقه.» پرونده بسته شد. برد.",
            effects: {
              playerStats: [
                { stat: "fame", min: 3, max: 6, scope: "instigator" },
                { stat: "xp", min: 8, max: 18, scope: "instigator" },
              ],
            },
          },
          {
            weight: 5,
            text: "ماده‌ی مخفیِ {p1} فلفل بود. زیاد. داورها غذای {p1} رو با احترام کنار گذاشتن. ماهور با آب‌نبات قاطی کرد. مقام: آخر. درس: مخفی، یعنی کم.",
            effects: { playerStats: [{ stat: "reputation", min: -2, max: 0, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "hide_and_seek_city",
    kind: "competition",
    emoji: "🕶",
    title: "قایم‌موشکِ شهری",
    body: "امشب: قایم‌موشکِ بزرگِ {group}. محدوده: کل محله. جایزه: «آدمِ موثوقِ» بودن برای یه هفته. دیوارها هم تیمی شدن: هیچ‌کس پشت دیوارِ کافه قایم نمی‌شه، چون ماهور می‌بینه.",
    tags: ["absurd", "crime"],
    minMembers: 3,
    cooldownMinutes: 2160,
    weight: 9,
    choices: [
      {
        key: "hide",
        label: "🕶 قایم شو",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "{p1} تو جعبه‌ی چایِ کافه قایم شد. کفِ شهر، فکر می‌کردیم. سه ساعت. وقتی دراومد، شهر بازی رو تموم کرده بود و بعدش «جعبه‌ی {p1}» اسم گرفت — دیگه هیچ‌کس اونجا رو چک نمی‌کنه. یک عمرِ امنیت.",
            effects: {
              playerStats: [
                { stat: "xp", min: 12, max: 28, scope: "instigator" },
                { stat: "energy", min: -8, max: -3, scope: "instigator" },
              ],
              title: { text: "🕶 آدمِ موثوقِ مشکوک", chance: 0.25 },
            },
          },
          {
            weight: 5,
            text: "{p1} پشتِ درِ زیرزمینِ کافه قایم شد. در از پشت قفل شد. کسی که در رو باز کرد: ماهور، با یه لیوان شیر. «همین‌جا خوبه؟» {p1} مونده. تا صبح. مقام: اول، با استثنا.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              clue: "درِ زیرزمینِ کافه از بیرون هم قفل می‌شود — و کلیدش پیشِ ماهور است، نه بنای کافه.",
            },
          },
        ],
      },
      {
        key: "seek",
        label: "🔍 بگرد و پیدا کن",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه رو پیدا کرد به جز {p3} — که خودش داور بود و پشتِ تابلوی «داور» قایم شده بود. {p1} عنوانِ «چشمِ تیزِ شهر» رو گرفت و یه وظیفه‌ی جدید: گم‌شده‌های رسمی.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              title: { text: "🔍 چشمِ تیزِ شهر", chance: 0.2 },
              relationships: [{ dim: "rivalry", min: 1, max: 3, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "home_base",
        label: "🏠 «خانه» رو تصرف کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} از قانون‌ها استفاده کرد: «هر کس به «خانه» برسه، امنه.» {p1} رفت و تو «خانه» موند و کل بازی رو فلج کرد. شهر قانون رو اصلاح کرد و {p1} رو «وکیلِ بازی» خطاب کردن. نه تلافی، نه محبت.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { chaos: 5, socialTemp: 3 },
              rumor: { text: "{p1} قوانین رو به نفع خودش می‌خونه", truth: true },
            },
          },
        ],
      },
    ],
  },

  // ═══ جهان ═══
  {
    id: "red_moon_rising",
    kind: "world",
    emoji: "🌑",
    title: "ماهِ قرمز دارد بالا می‌آید",
    body: "اولِ شب، ماه با رنگِ قرمزِ کامل اومده بالا. قورباغه‌ها همه با هم کواک گفتن — یه بار، هم‌زمان، مثل یه ارکستر. شهر ساکت شد. حالا سؤال: چه کسی جوابِ کواک رو شنیده؟",
    tags: ["world", "frog", "mystery"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 8,
    choices: [
      {
        key: "watch",
        label: "🌑 تماشا کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تمام شب رو با ماه گذروند. صبح، همه‌چیز عادی بود به جز یه چیز: {p1} دیگه از تاریکی نمی‌ترسه. ترسش جاش رو به کنجکاوی داده. معامله‌ی منصفانه.",
            effects: {
              playerStats: [
                { stat: "xp", min: 12, max: 30, scope: "instigator" },
                { stat: "luck", min: 1, max: 3, scope: "instigator" },
              ],
              followUp: { templateId: "red_moon_second", afterMinutesMin: 4320, afterMinutesMax: 8640, chance: 0.4 },
            },
          },
        ],
      },
      {
        key: "photos",
        label: "📸 مستند کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کل شب عکس گرفت. تو عکس‌ها ماه فقط یه بار قرمز نیست — یه بارِ دیگه خاکستریه. با تایم‌استمپِ همون دقیقه. توضیح‌ها فقط یکی شون منطقیه و اون هم قبول‌کردنی نیست.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              clue: "ماهِ قرمز در عکس‌ها دو رنگ است: قرمز و خاکستری — در یک لحظه. دوربین چیزهایی می‌بیند که چشم نمی‌بیند.",
            },
          },
        ],
      },
      {
        key: "gather",
        label: "🔥 دورِ آتش جمع شو",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} آتیش روشن کرد و شهر دورش جمع شد. قصه‌های ماهِ قرمز تعریف شد — و یکی‌شون درست بود: قصه‌ای که قنبر گفت و آخرش فقط گفت: «بقیه‌شو خودتون دیدین.»",
            effects: {
              relationships: [{ dim: "friendship", min: 3, max: 6, scope: "all_pairs" }],
              group: { socialTemp: -6 },
              playerStats: [{ stat: "energy", min: -6, max: -2, scope: "participants" }],
              memory: { kind: "moment", text: "شبِ آتشِ ماهِ قرمز", importance: 78 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "red_moon_second",
    kind: "world",
    emoji: "🌕",
    title: "ماهِ قرمزِ دوم",
    body: "ماهِ قرمز برگشته — این‌بار زودتر از چرخه. ماهور داره با عجله پذیرایی می‌کنه. نعمتی پرونده‌اش رو باز کرده. هیچ‌کس از {group} نمی‌پرسه چرا. می‌پرسیم: چه باید کرد؟",
    tags: ["world", "npc", "mystery", "callback"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 8,
    choices: [
      {
        key: "prep",
        label: "🧺 خودتون رو مهیا کنید",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شهر رو مهیا کرد: چراغ‌های اضافه، پتو، و یه جعبه‌ی کمکِ اولیه. ماهِ قرمز بدون اتفاق گذشت. شهر آماده‌تر مونده بود تا پیش. آمادگی همیشه به‌درد می‌خوره، حتی وقتی اتفاق نمی‌افته.",
            effects: {
              treasury: { min: -300, max: -120 },
              group: { reputation: 4, influence: 3 },
              relationships: [{ dim: "cooperation", min: 2, max: 5, scope: "all_pairs" }],
            },
          },
        ],
      },
      {
        key: "ask_mahoor",
        label: "☕ از ماهور بپرس این دفعه چیه",
        style: "primary",
        outcomes: [
          {
            weight: 5,
            text: "ماهور پشتِ پیشخوان مکث کرد: «دفعه‌ی قبلِ قبل هم دو بار پشتِ هم اومد. اون‌بار شهر تغییر کرد.» {p1} پرسید: «چطور؟» ماهور: «تو اون هستی.»",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "ماهِ قرمزِ دوبل، هر بار با یک «تغییر شهر» همراه بوده. تغییرِ آخر: همین الان.",
            },
          },
          {
            weight: 5,
            text: "ماهور فقط چای ریخت و گفت: «سؤال‌ت یادم باشه.» و رفت سمت آشپزخونه. {p1} شب تا دیر بیدار بود. جواب‌هایی که عقب می‌افتن، بلندتر از اونایی هستن که جواب می‌شن.",
            effects: { playerStats: [{ stat: "chaos", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "celebrate",
        label: "🎉 جشنِ غیرمنتظره بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} گفت: «ماهِ اضافه = جشنِ اضافه.» شهر پذیرفت. نصفه‌شب، بالای بام، با موسیقی و قاشق‌بازی. ماهِ قرمز عکس یادگاری گرفت. یعنی رنگش یه لحظه سفید شد. کسی فایلش رو نداره.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              treasury: { min: -200, max: -80 },
              group: { chaos: 6, socialTemp: -5 },
              memory: { kind: "moment", text: "جشنِ ماهِ قرمزِ دوم", importance: 74 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "fog_whispers",
    kind: "world",
    emoji: "🌫",
    title: "مهِ نجواکن",
    body: "امشب مه اومده پایین. یه‌کم زیادی پایین. و یه‌کم زیادی... حرف‌دار. هر کس گوش می‌کنه، یه جمله‌ی متفاوت می‌شنوه. جمله‌ها همه شبیه همدیگه‌ان.",
    tags: ["world", "weather", "mystery"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "listen",
        label: "👂 گوش بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} گوش داد. جمله‌ی {p1}: «سه‌شنبه، درِ آبی، نیم‌روز.» {p1} سه‌شنبه رفت، درِ آبی پیدا کرد، مُهرِ خودش رو زد. در که باز شد: اتاقِ چایِ ماهور. از درِ دیگه. مه آدرسِ میان‌بر می‌ده.",
            effects: {
              playerStats: [
                { stat: "xp", min: 15, max: 32, scope: "instigator" },
                { stat: "chaos", min: 2, max: 4, scope: "instigator" },
              ],
              clue: "مهِ شهر آدرس می‌دهد — اما همیشه میان‌بر، هرگز مقصد.",
            },
          },
          {
            weight: 5,
            text: "جمله‌ی {p1} فقط یه کلمه بود: «باشه.» {p1} تا صبح فکر کرد به چی. صبح که مه رفت، یه آرومی داشت که از خودش نبود. گفته بود «باشه» و رفت.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "record",
        label: "🎙 جمله‌ها رو جمع کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه‌ی جمله‌ها رو یادداشت کرد و کنار هم گذاشت. یه پازل شد. پازل یه جمله‌ی کامل: «شهر یادش میاد. کمکش کن.» {group} با هم تصمیم گرفت: بذار یاد بیاد.",
            effects: {
              playerStats: [{ stat: "xp", min: 15, max: 35, scope: "instigator" }],
              group: { influence: 4 },
              followUp: { templateId: "city_glitch", afterMinutesMin: 2880, afterMinutesMax: 7200, chance: 0.3 },
            },
          },
        ],
      },
      {
        key: "close_windows",
        label: "🪟 پنجره‌ها رو ببند",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه رو نصیحت کرد پنجره‌ها رو ببندن. جمله‌ها تا صبح بیرون موندن و صبح رفتن. بعضی شب‌ها باید فقط خوابید. شهر یاد گرفت و خوابش برد. کسی چیزی از دست نداد. شاید.",
            effects: { group: { socialTemp: -5 }, playerStats: [{ stat: "energy", min: 5, max: 12, scope: "participants" }] },
          },
        ],
      },
    ],
  },
  {
    id: "city_glitch",
    kind: "world",
    emoji: "🏙",
    title: "گلیچِ شهری",
    body: "کل {group} یه ثانیه فریز شد. عابرها، پرنده‌ها، حتی آبِ حوض. بعد ادامه دادن مثل هیچی. فقط {p2} قضاوت کرد که این «ثانیه‌ی طولانی» یه جای دیگه هم دیده شده.",
    tags: ["world", "mystery", "callback"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "verify",
        label: "🔬 هر کس یه چیزی می‌دونست",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} جمع کرد: قنبر ثانیه رو «چای» می‌گه، نعمتی «مکث»، ماهور «سی‌و‌یکمِ ماه». هر کدومشون یه بارِ دیگه هم دیدن. جمعِ شهادت‌ها: یه اتفاقه که اسم‌های مختلف داره.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "«چایِ» قنبر = «مکثِ» نعمتی = «سی‌و‌یکمِ ماه» ماهور. یک پدیده، سه اسم، سه ناظرِ قدیمی.",
            },
          },
        ],
      },
      {
        key: "embrace",
        label: "✨ صحنه‌ی دوم رو اجرا کنید",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پیشنهاد عجیبی داد: «اگه شهر می‌تونه فریز شه، ما هم می‌تونیم پاز.» همه یه ثانیه آزادانه ایستادن — بی‌حرکت، ارادی. گلیچ جواب داد: دو ثانیه‌ی بعدی، شهر خودش پاز کرد. احترامِ متقابل.",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "participants" }],
              group: { chaos: 5, socialTemp: -4 },
              memory: { kind: "moment", text: "روزِ مکثِ دست‌جمعیِ {group}", importance: 78 },
            },
          },
        ],
      },
      {
        key: "ignore",
        label: "😌 عادیِ جدید",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} رأی داد که گلیچ رو «عادیِ جدید» اعلام کنیم. شهر موافقت کرد. از فردا، هر فریزِ ثانیه‌ای فقط یه جمله‌ی جمعی می‌مونه: «مشکل نیست.» کارایی بالاتر رفت، وحشت پایین‌تر.",
            effects: { group: { chaos: -4, reputation: 2 } },
          },
        ],
      },
    ],
  },
  {
    id: "all_pets_stare",
    kind: "world",
    emoji: "🐾",
    title: "همه‌ی حیوانات به یه نقطه نگاه می‌کنن",
    body: "سگ‌ها، گربه‌ها، کبوترها، حتی ماهیِ حوض — همه به یه نقطه‌ی خالیِ وسطِ هوا خیره‌ان. نقطه‌ای که هیچ‌کس نمی‌تونه ببینتش. مختصاتش هم دقیقاً وسطِ {group}ـه.",
    tags: ["pet", "world", "mystery", "cat"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "stand",
        label: "📍 بایست همون نقطه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} رفت رو همون نقطه. حیوانات نگاهش کردن. بعد — یکی‌یکی — برش داشتن. آخرینشون گربه‌ی شهردار بود که قبل از رفتن یه بار میو گفت. {p1} از اون روز حیوانات بهش احترام می‌ذارن. جایِ خاصیه.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 6, scope: "instigator" },
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
              ],
              title: { text: "🐾 هم‌سایه‌ی حیوانات", chance: 0.2 },
            },
          },
          {
            weight: 5,
            text: "{p1} رو نقطه ایستاد و... هیچی. سکوت. حیوانات محو شدن به کارهاشون. {p1} فقط یه سرگیجه‌ی کوچیک گرفت و برای سه روز، خواب‌هاش رنگی بود.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "measure",
        label: "📐 اندازه‌ش کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با متر و قطب‌نما نقطه رو اندازه گرفت: 1.7 متر از زمین، دقیقاً بالای مرکزِ {group}. {p2} فهمید: ارتفاعِ چشمِ یه آدمِ قدبلندِ ایستاده. کسی نبود. ارتفاعِ کیه؟",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "نقطه‌ی خیرگیِ حیوانات، دقیقاً ارتفاع چشم یک ایستاده‌ی قدبلند است. هیچ‌کس آن‌جا نمی‌ایستد.",
            },
          },
        ],
      },
      {
        key: "wait",
        label: "⏳ صبورانه منتظر بمون",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کنار حیوانات نشست و منتظر موند. سه ساعت. هیچی نشد. ولی حیوانات از {p1} راحت‌تر شدن و یکی از کبوترها رو شونه‌ش نشست. صبر، زبانِ مشترکِ همه‌ی جانداراست.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 4, scope: "instigator" }],
              relationships: [{ dim: "friendship", min: 1, max: 3, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "aurora_tehran",
    kind: "world",
    emoji: "🌈",
    title: "شفقِ بالای شهر",
    body: "نوارهای نورِ سبز و بنفش دارن بالای آسمونِ {group} می‌رقصن. هواشناسی می‌گه «غیرممکن». هواشناسی خودش هم عکس گرفته. عکسش رو با کپشنِ «غیرممکن» پخش کرده.",
    tags: ["world", "weather"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "rooftop",
        label: "🌈 بریم بالای بام",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "کل {group} بالا رفت. شفق آهنگ نداشت ولی همه یه آهنگِ مشترک تو ذهنشون شنیدن. فردا سه نفر آهنگ ساختن. هر سه‌تاشون شبیه هم بود. اسمِ پدیده: «ریتمِ شفق».",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 20, scope: "participants" }],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -6 },
              memory: { kind: "moment", text: "شبِ شفقِ {group}", importance: 72 },
            },
          },
        ],
      },
      {
        key: "science",
        label: "🔬 توضیحِ علمی بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} توضیح داد: «ذراتِ باردار، میدانِ مغناطیسی،...» همه گوش دادن و بعد یکی پرسید: «پس چرا فقط این‌جا؟» {p1} ساکت شد. سؤالِ خوب، جوابِ خوب رو می‌خواد. فردا ادامه می‌دیم.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              clue: "شفقِ {group} با هیچ الگوی جوّی نمی‌خواند — اما با چرخه‌ی «بازنشانی» شهر قفل می‌شود.",
            },
          },
        ],
      },
      {
        key: "sell_tickets",
        label: "🎟 بلیتِ بام بفروش",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} برای «تماشای شفق از بام» بلیت فروخت. آسمون تعطیل شد یه ساعت بعد. پول‌ها برگشت. {p1} یه درسِ قدیمی یاد گرفت: طبیعت قرارداد امضا نمی‌کنه.",
            effects: {
              playerStats: [
                { stat: "money", min: -300, max: 100, scope: "instigator" },
                { stat: "xp", min: 5, max: 12, scope: "instigator" },
              ],

            },
          },
          {
            weight: 5,
            text: "بلیت‌فروشیِ {p1} در ساعتِ اول خوب بود. ساعت دوم شفق قوی‌تر شد و کل شهر بالا رفت. {p1} پول رو برگردوند و یه جمله‌ی درست: «این تعلق به همه داره.» احترام: رایگان نیست، قیمته.",
            effects: {
              playerStats: [{ stat: "reputation", min: 3, max: 6, scope: "instigator" }],
              group: { reputation: 3 },
            },
          },
        ],
      },
    ],
  },

  // ═══ جهان (۲) ═══
  {
    id: "warm_snow",
    kind: "world",
    emoji: "❄️",
    title: "برفِ گرم",
    body: "برف داره می‌باره ولی برف گرمه. مچال‌هاش مثل بخاریِ کوچیکه. شهر اول گیج شد، بعد شروع کرد به لباسِ تابستانی + کلاهِ برفی. ترندِ جدید همین شد.",
    tags: ["world", "weather", "fashion", "absurd"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "play",
        label: "❄️ برف‌بازیِ گرم",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اولین آدم‌برفِ گرم رو ساخت. اسمش: «گرم‌برف». تا عصر آب شد و یه جای خیسِ خوش‌بختی از خودش جا گذاشت. شهر عاشقش بود. {p2} برای یادبودش یه سنگ گذاشت.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "participants" }],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -5 },
            },
          },
        ],
      },
      {
        key: "harvest",
        label: "🧺 جمعش کن (بخاریم لازمه)",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} برفِ گرم رو تو ظرف جمع کرد و ازش انرژی گرفت: بخارِ رایگان. سودِ اقتصادی: قابل‌قبول. جالب‌ترین بخش: برفِ جمع‌شده دوباره از آسمون برمی‌گرده. چرخه‌ی کامل.",
            effects: {
              playerStats: [
                { stat: "money", min: 100, max: 400, scope: "instigator" },
                { stat: "energy", min: 5, max: 12, scope: "instigator" },
              ],
              rumor: { text: "برفِ گرمِ {group} اگه جمعش کنی، دوباره می‌باره", truth: true },

            },
          },
        ],
      },
      {
        key: "worry",
        label: "🌡 نگرانِ گرمایش جهانی شو",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p1} هشدار داد: «برفِ گرم یعنی یه جایی یه چیزی درست نیست!» شهرداری بررسی کرد. نتیجه: «فقط این‌جا برفِ گرمه. بغلی‌ها: برفِ سرد.» تشخیص: «محلیه.» یعنی: «نمی‌دونیم.»",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { chaos: 4 },
              clue: "برفِ گرم فقط روی محدوده‌ی {group} می‌بارد — دقیقاً هم‌اندازه‌ی مرزِ شهرِ قبلی.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "double_sunrise",
    kind: "world",
    emoji: "🌅",
    title: "دو تا طلوع",
    body: "امشب خورشید دو بار طلوع کرد. دومیش 40 دقیقه بعدِ اولی بود و یه‌کم به چپ. هیچ تقویمی اینو پیش‌بینی نکرده بود. هیچ کاهنی هم چیزی نگفته بود. شاید باید می‌گفتن.",
    tags: ["world", "weather", "mystery"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "witness",
        label: "🌅 هر دو رو تماشا کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از اولین تا آخرین لحظه‌ی دومی بود. بعدش گفت: «دومی خجالتی‌تر بود.» کسی نفهمید منظورشه، ولی همه تأیید کردن. بعضی حقیقت‌ها فقط با تأییدِ جمعی معنا می‌گیرن.",
            effects: {
              playerStats: [
                { stat: "xp", min: 10, max: 24, scope: "instigator" },
                { stat: "luck", min: 1, max: 2, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "photo_evidence",
        label: "📸 مدرک جمع کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} از هر دو طلوع عکس گرفت. عکسِ اولی: خورشید. عکسِ دومی: ماهِ شبِ قبل که جای خورشید قایم شده بود. ماه در نقشِ خورشید. استعدادِ مُخفی.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              clue: "«طلوعِ دوم» ماه است — ماهِ دیشب که هنوز راه نمی‌رود، فقط می‌رقصد.",
            },
          },
        ],
      },
      {
        key: "festival",
        label: "🎉 جشنِ دوتایی بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} جشنِ «دو صبحِ تو یه شب» گرفت. صبحانه‌ی دوباره، موسیقیِ دوباره، و خمیازه‌ی دوباره. شهر یه روزِ کاملِ دوبرابر داشت. خوش گذشت. همه شب دوتایی خوابیدن.",
            effects: {
              playerStats: [
                { stat: "fame", min: 2, max: 5, scope: "instigator" },
                { stat: "energy", min: -10, max: -4, scope: "participants" },
              ],
              treasury: { min: -250, max: -100 },
              group: { socialTemp: -6 },

            },
          },
          {
            weight: 5,
            text: "جشنِ {p1} با روزِ کاری تداخل پیدا کرد. همه برای جشن اومدن و همه به کار رفتن. تعادل برقرار شد: هیچ‌کس نه خوشحال بود نه ناراحت. فقط خسته. واقعی‌ترین حالتِ ممکن.",
            effects: { group: { socialTemp: 2 } },
          },
        ],
      },
    ],
  },
  {
    id: "forbidden_zone_hum",
    kind: "world",
    emoji: "☢",
    title: "منطقه‌ی ممنوعه وزوز می‌کنه",
    body: "پسِ تابلوهای ☢، یه وزوزِ بمِ پیوسته شروع شده. کسی که گوش چپش رو می‌گیره، وزوز رو می‌شنوه. کسی که راستش رو، یه آهنگ. کسی که هردو: سکوتِ کامل. منطق معکوس.",
    tags: ["world", "mystery"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 7,
    choices: [
      {
        key: "left",
        label: "👂 گوشِ چپ",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با گوشِ چپ وزوز رو دنبال کرد تا مرزِ سیم‌های خاردار. وزوز اون‌جا تموم شد و یه جمله شروع شد — مثل یه نوار که کسی صداش رو آروم کرده. {p1} برگشت و فقط گفت: «ادامه‌ش مالِ فرداست.»",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
                { stat: "xp", min: 12, max: 30, scope: "instigator" },
              ],
              clue: "وزوزِ منطقه‌ی ممنوعه یک نوارِ صوتی است که آهسته پخش می‌شود. طولِ کاملش: 98 روز.",
            },
          },
        ],
      },
      {
        key: "right",
        label: "🎵 گوشِ راست",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} با گوشِ راست آهنگ رو جدی گرفت: یه لالاییِ قدیمی. نت‌ها رو نوشت و به ماهور برد. ماهور نت‌ها رو دید، قهوه‌ش رو نصفه گذاشت و گفت: «این لالاییِ مادربه‌دوغا... یه‌وقتی.» و رفت تو آشپزخونه.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 24, scope: "instigator" }],
              clue: "لالاییِ منطقه‌ی ممنوعه را ماهور می‌شناسد — اما فقط وقتی قهوه‌اش نصفه مانده باشد.",
            },
          },
        ],
      },
      {
        key: "both",
        label: "🙈 هر دو گوش",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} هر دو گوشش رو بست. سکوتِ کاملِ وزوز. تو اون سکوت، {p1} یه صدای دیگه شنید: نفسِ شهر. شهر نفس می‌کشه. این دیگه هیچ‌وقت از ذهنش نمی‌ره. عالی‌ترین معلوماتی که کسی بهمون داده.",
            effects: {
              playerStats: [
                { stat: "xp", min: 15, max: 32, scope: "instigator" },
                { stat: "luck", min: 1, max: 3, scope: "instigator" },
              ],

            },
          },
        ],
      },
    ],
  },
  {
    id: "sky_text",
    kind: "world",
    emoji: "☁️",
    title: "متن روی آسمون",
    body: "ابرها خودشون رو مرتب کردن و یه جمله نوشتن: «امتحان تمام شد.» بعد چند دقیقه باد اومد و پاکش کرد. ولی همه دیدن. حالا بحث: امتحانِ چی؟ کی؟ ما؟",
    tags: ["world", "mystery", "absurd"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 6,
    choices: [
      {
        key: "celebrate",
        label: "🎓 جشنِ پایانِ امتحان",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} اعلام کرد: «امتحانِ تموم شده یعنی می‌شه جشن گرفت.» شهر قبول کرد و تا شب جشن بود. هیچ‌کس نمی‌دونست چی تمام شده بود ولی همه احساسِ سبکی داشتن. اسمِ جشن: «نمره‌ی آسمون».",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "all_pairs" }],
              group: { socialTemp: -8, reputation: 2 },
              memory: { kind: "moment", text: "جشنِ «امتحانِ آسمون» در {group}", importance: 74 },
            },
          },
        ],
      },
      {
        key: "reply",
        label: "📣 به آسمون پیام بده",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با یه آینه‌ی بزرگ و نورِ آفتاب، حروفِ بزرگ نوشت تو آسمون: «چه امتحانی؟» ابرها جواب ندادن. فقط یه ابرِ تک، حالتِ علامت سؤال گرفت. و مونده. تا حالا هم هست.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
                { stat: "fame", min: 2, max: 4, scope: "instigator" },
              ],
              rumor: { text: "ابرِ علامت‌سؤالیِ بالای {group} جوابِ {p1} است", truth: false },

            },
          },
        ],
      },
      {
        key: "archive",
        label: "🗄 سند بساز",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} شهادت‌نامه‌ی 12 نفرو جمع کرد: «جمله رو همه دیدن، همه‌شون با هم.» آرشیوِ {group} یه بخشِ «پیام‌های آسمون» باز کرد. خالی. منتظرِ بعدی.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { influence: 3 },
              clue: "پیام‌های ابریِ شهر همیشه جمع (نه منفرد) دیده می‌شوند. هیچ دوربینی آن‌ها را ثبت نکرده — فقط چشم.",
            },
          },
        ],
      },
    ],
  },

  // ═══ شخصی ═══
  {
    id: "shadow_twin",
    kind: "personal",
    emoji: "👥",
    title: "سایه‌ی {p1} دوتا شده",
    body: "از دیروز سایه‌ی {p1} دوتاست — یکی معمولی، یکی که یه‌کم دیرتر حرکت می‌کنه. {p1} هنوز به کسی نگفته. سایه‌ی دوم رو دیروز نداشت. امروز داره.",
    tags: ["mystery", "chaos"],
    minMembers: 1,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "observe",
        label: "🔭 سایه رو زیر نظر بگیر",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} سه ساعت سایه‌ی دوم رو زیر نظر گرفت. سایه‌ی دوم یه‌بار به {p1} تکان داد. {p1} جواب داد. حالا هر دو بلدن. مکاتبه‌ی سایلی برقراره.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "instigator" }],
              followUp: { templateId: "sleepwalks", afterMinutesMin: 1440, afterMinutesMax: 4320, chance: 0.4 },
            },
          },
        ],
      },
      {
        key: "introduce",
        label: "👋 سایه رو معرفی کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} سایه‌ی دوم رو به شهر معرفی کرد: «این سایه‌ی منِ آینده‌ست، ظاهراً.» شهر خوش‌آمد گفت. ماهور براش یه صندلی کشید. سایه‌ها به صندلی نیاز ندارن ولی تشکر کرد — با یه تکانِ آروم.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 6, scope: "instigator" }],
              group: { chaos: 4, reputation: 2 },
              title: { text: "👥 آدمِ دوسایه", chance: 0.2 },
            },
          },
        ],
      },
      {
        key: "lose",
        label: "🏃 تلاش کن ازش جدا شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} زیر نورِ مستقیم چراغ‌های خیابون ایستاد — جایی که سایه‌ها ذوب می‌شن. سایه‌ی معمولی محو شد. سایه‌ی دوم موند و فقط نزدیک‌تر شد. {p1} از اون شب، یه‌کم محتاط‌تر راه می‌ره.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 5, scope: "instigator" },
                { stat: "luck", min: -2, max: 0, scope: "instigator" },
              ],
              rumor: { text: "{p1} سایه‌ش رو گم کرده", truth: true },

            },
          },
          {
            weight: 5,
            text: "دوید، چرخید، زیر پتو رفت. وقتی دراومد، سایه‌ی دوم دقیقاً همون‌جا بود — با یه حالتِ «خب؟». {p1} قبول کرد: از بعضی همراهی‌ها نمی‌شه فرار کرد.",
            effects: { playerStats: [{ stat: "xp", min: 8, max: 16, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "debt_collector",
    kind: "personal",
    emoji: "👞",
    title: "وصول‌کننده‌ی بدهی",
    body: "یه آقای مؤدب با کلاهِ سیاه سراغِ {p1} اومده: «بدهیِ شما از یه وامِ قدیمی است. تاریخِ وام: سه روز قبل از تولدتون.» {p1} مطمئنه وامی نگرفته. آقا مطمئنه که گرفته.",
    tags: ["money", "crime", "npc"],
    minMembers: 1,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "pay",
        label: "💰 بده که سرِ کار نره",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} پرداخت کرد. آقا رسید داد، کلاه تکوند و رفت. پشتِ رسید نوشته بود: «حسابِ قبلی تسویه شد. حسابتون با شهر، نه.» {p1} هنوز داره به این جمله فکر می‌کنه.",
            effects: {
              playerStats: [{ stat: "money", min: -800, max: -300, scope: "instigator" }],
              clue: "وصول‌کنندگانِ شهر بدهی‌هایی را می‌گیرند که مالِ «قبلیِ» توست — یعنی نسخه‌ی قبلِ بازنشانی.",
            },
          },
        ],
      },
      {
        key: "dispute",
        label: "⚖️ برو دادگاه",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} به دادگاهِ محله رفت. قاضی (گربه‌ی شهردار) پرونده رو خوند، بازش کرد، بو کشید، و به سمتِ آقای مؤدب پچ‌پچ کرد. آقا عذرخواهی کرد و رفت. عدالت گاهی بی‌کلامه.",
            effects: {
              playerStats: [
                { stat: "xp", min: 10, max: 24, scope: "instigator" },
                { stat: "reputation", min: 1, max: 3, scope: "instigator" },
              ],
              group: { crime: -3 },
            },
          },
          {
            weight: 5,
            text: "دادگاه به نفعِ آقای مؤدب رأی داد. مدرکش یه عکس بود: {p1}، جلوی مغازه‌ی قنبر، سالِ 98. {p1} تو اون عکس همون سنِ الانشه. پرونده بسته شد. سؤال‌ها باز.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 3, max: 6, scope: "instigator" },
                { stat: "money", min: -1200, max: -500, scope: "instigator" },
              ],
              clue: "در عکسِ سالِ 98 همه هم‌سنِ امروزشان هستند. عکس‌ها دروغ نمی‌گویند — یا دروغِ هماهنگ می‌گویند.",

            },
          },
        ],
      },
      {
        key: "ask_fahhad",
        label: "💳 بریم پیش دایی فرهاد",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} مستقیم رفت پیشِ دایی فرهاد. فرهاد به آقای مؤدب نگاه کرد، بعد لبخند زد و گفت: «این یکی حسابِ منه.» مبلغ رو خودش داد و به {p1} فقط گفت: «حسابِ ما هنوز باز.» لبخندش گرم بود. حساب‌ها ترسناک.",
            effects: {
              playerStats: [
                { stat: "money", min: 0, max: 0, scope: "instigator" },
                { stat: "reputation", min: 2, max: 4, scope: "instigator" },
              ],
              title: { text: "💳 رهبرِ بدهکارها", chance: 0.2 },
            },
          },
        ],
      },
    ],
  },
  {
    id: "fan_club",
    kind: "personal",
    emoji: "🪭",
    title: "کلوپِ طرفدارای {p1}",
    body: "یه گروهِ ناشناس کلوپِ طرفداریِ {p1} ساختن. فعالیت‌ها: تحسین از راه دور، جمع‌آوریِ نقل‌قول‌ها (که {p1} هیچ‌وقت نگفته)، و یه خبرنامه‌ی هفتگی.",
    tags: ["wholesome", "absurd"],
    minMembers: 1,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "acknowledge",
        label: "🪭 کلوپ رو رسمی کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کلوپ رو به رسمیت شناخت و بهشون یه {item} لوگو داد. کلوپ عروس شد. عضوها: 14 نفر. سؤالِ اصلیِ جلسه‌ها: «چرا ما؟» جوابِ رسمی: «چرا که نه.»",
            effects: {
              playerStats: [{ stat: "fame", min: 4, max: 9, scope: "instigator" }],
              title: { text: "🪭 محبوبِ بی‌دلیل", chance: 0.25 },
              group: { reputation: 2, socialTemp: -3 },
            },
          },
        ],
      },
      {
        key: "quote_check",
        label: "📖 نقل‌قول‌ها رو تصحیح کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} همه‌ی نقل‌قول‌های جعلی رو تصحیح کرد. کلوپ ناامید نشد: «پس نقل‌قول‌های واقعیش رو نداریم؟» {p1} یه جمله گفت. یه جمله‌ی خوب. خبرنامه‌ی هفته‌ی بعد فقط همون بود. کلوپ: خوشحالِ حداکثری.",
            effects: {
              playerStats: [{ stat: "reputation", min: 2, max: 5, scope: "instigator" }],
              memory: { kind: "moment", text: "{p1} اولین جمله‌ی رسمی‌اش را به کلوپ طرفدارها داد", importance: 66 },
            },
          },
        ],
      },
      {
        key: "infiltrate",
        label: "🕶 مخفیانه عضو شو",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} با یه اسمِ مستعار تو کلوپ ثبت‌نام کرد. بعد دو هفته، مدیرِ کلوپ شد (سازمان‌دهیِ خوبی داشت). الان {p1} بزرگ‌ترین طرفدارِ خودشه و باید با این حقیقت زندگی کنه.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 4, scope: "instigator" },
                { stat: "xp", min: 8, max: 18, scope: "instigator" },
              ],

            },
          },
          {
            weight: 5,
            text: "{p1} لو رفت در جلسه‌ی اول — وقتی برای خودش کف زد. کلوپ فقط گفت: «عادیه. ما هم همین کارو می‌کنیم.» و ادامه دادن. تعلق، پیچیده‌ست.",
            effects: { playerStats: [{ stat: "fame", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
    ],
  },
  {
    id: "sleepwalks",
    kind: "personal",
    emoji: "😴",
    title: "{p1} راه می‌ره تو خواب",
    body: "دو شبِ دیگه دیده شدن {p1} در حالی که خوابه و راه می‌ره — هر بار به یه جهتِ متفاوت. مسیرها روی نقشه کشیده شدن: یه شکلِ عجیب. شبِ سومش رو همه منتظرن.",
    tags: ["mystery", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "follow",
        label: "🌙 دنبالش برو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p2} و {p3} دنبالِ {p1} رفتن. مسیرِ شبِ سوم، شکل رو کامل کرد: یه قورباغه. {p1} با چشمِ بسته وسطِ حوض ایستاد و بعد برگشت خونه. صبح که گفتن، فقط پوزخند زد: «خوب همون‌جا بودم که باید می‌بودم.»",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "participants" }],
              clue: "مسیرهای خوابگردیِ {p1} روی نقشه یک قورباغه رسم می‌کنند — قورباغه‌ای که به حوض مرکزی اشاره دارد.",
              group: { chaos: 5 },
            },
          },
        ],
      },
      {
        key: "wake",
        label: "🔔 بیدارش کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} رو آرام بیدار کردن وسطِ مسیر. چشم‌هاش رو باز کرد و قبل از هر چیز گفت: «چرا قطع کردین؟ داشتم یه جایی می‌رسیدم.» هیچ‌کس جواب نداشت. {p1} دوباره خوابید. اونجا. روی خیابون.",
            effects: {
              relationships: [{ dim: "trust", min: 2, max: 5, scope: "all_pairs" }],
              playerStats: [{ stat: "energy", min: -4, max: 4, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "record",
        label: "🎥 ثبت کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} پذیرفت فیلم گرفته شه — به شرطِ اینکه اول خودش ببینه. ویدیو رو دید و بعد از یه سکوتِ طولانی گفت: «این خوبه. ولی من خواب نبودم.» و ویدیو رو برای شهر آزاد کرد.",
            effects: {
              playerStats: [{ stat: "fame", min: 2, max: 5, scope: "instigator" }],
              rumor: { text: "{p1} می‌گه خواب نبوده؛ چشم‌هاش بسته بوده", truth: true },
            },
          },
          {
            weight: 5,
            text: "ویدیو ضبط شد ولی هر بار که کسی می‌خواست ببینش، فایل یه‌کم فرق داشت. مسیرِ ضبط‌شده، هر بار به یه جهتِ متفاوت تموم می‌شد. سانسورچی: باد. باد که ویدیو بلده؟",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              clue: "ویدیوی خوابگردیِ {p1} هر بار متفاوت است — انگار شب، خودش تصمیم می‌گیرد چه چیزی ضبط شود.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "p1_mayor_day",
    kind: "personal",
    emoji: "🎗",
    title: "روزِ {p1} شهرداره",
    body: "شهردار مرخصی گرفته (به قول خودش: «برای دیدنِ دریا»). برای یه روز، {p1} شهردارِ {group}ـه. اولین فرمان چیه؟",
    tags: ["election", "absurd", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 4320,
    weight: 8,
    choices: [
      {
        key: "kind",
        label: "🕊 فرمانِ مهربانی",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "فرمانِ {p1}: «امروز همه کارها نصفه. نصفه‌ها کامل حساب می‌شن.» شهر یه روزِ آروم داشت. بقیه‌ی نصفه‌ها برای فردا مونده — یعنی فردا هم یه جورایی نصفه‌ست. نبوغِ برنامه‌ریزی.",
            effects: {
              playerStats: [{ stat: "reputation", min: 3, max: 7, scope: "instigator" }],
              group: { socialTemp: -8, reputation: 4 },
              memory: { kind: "moment", text: "روزِ مهربانیِ شهردارِ {p1}", importance: 72 },
              title: { text: "🎗 شهردارِ یک‌روزه‌ی محبوب", chance: 0.2 },
            },
          },
        ],
      },
      {
        key: "chaos",
        label: "🌪 فرمانِ آشوب",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "فرمانِ {p1}: «قوانین امروز برعکسِ دیروزن.» شهر شروع کرد به انجامِ کارهای برعکس. قورباغه‌ها تو آب خشک کردن. آسمون برفِ گرم. شهردارِ واقعی از دریا برگشت و گفت: «من که گفتم دریا خطرناکه.»",
            effects: {
              playerStats: [{ stat: "chaos", min: 3, max: 6, scope: "instigator" }],
              group: { chaos: 10 },
              rumor: { text: "روزِ آشوبِ {p1} هماهنگی داشت با ماهِ قرمز", truth: false },
            },
          },
        ],
      },
      {
        key: "reform",
        label: "📋 اصلاحاتِ واقعی",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} به جای فرمان، رسیدگی کرد: درخواست‌ها، شکایت‌ها، و درِ قفلِ زیرزمین. عصر، لیستِ کاملی نوشت و رو میزِ شهردار گذاشت: «کارهایی که مالِ خودشه.» شهردار برگشت و فقط گفت: «ممنون.»",
            effects: {
              playerStats: [{ stat: "xp", min: 15, max: 35, scope: "instigator" }],
              group: { influence: 5, reputation: 3 },
              relationships: [{ dim: "cooperation", min: 2, max: 4, scope: "all_pairs" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "haircut_disaster",
    kind: "personal",
    emoji: "✂️",
    title: "مدلِ مویِ جدیدِ {p1}",
    body: "{p1} یه مدلِ مویِ تازه آورده. «جسورانه» بودن؛ این رو همه می‌گن. هیچ‌کس نمی‌گه «خوب» یا «نه». فقط «جسورانه». کلمه‌ی دومِ بعد از سکوت: «مهمه؟»",
    tags: ["fashion", "wholesome", "absurd"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "praise",
        label: "👏 صادقانه تحسین کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p2} به {p1} گفت: «واقعاً جسورانه‌ست و می‌خوره با چهره‌ت.» {p1} یه هفته با اعتمادِ نفس راه رفت. مدلِ مو به «سبکِ {group}» معروف شد. دو نفر دیگه هم گرفتنش. جهونه.",
            effects: {
              relationships: [{ dim: "friendship", min: 3, max: 7, scope: "pair" }],
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "random_member" }],
              group: { socialTemp: -3 },
            },
          },
        ],
      },
      {
        key: "copy",
        label: "💇 خودتم بگیر",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} هم همون مدل رو گرفت — از همون آرایشگاه (یعنی قنبر با یه قیچیِ قدیمی). نتیجه: {p1} و {p2} الان دوقلوهای مویی هستن. کلاسِ مجاور هم گفتن «ما هم». زنجیره‌ی مو متولد شد.",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],
              playerStats: [{ stat: "money", min: -200, max: -80, scope: "instigator" }],
              group: { chaos: 3 },
            },
          },
          {
            weight: 5,
            text: "مدلِ {p1} به {p3} نمی‌خورد — و {p1} صادقانه گفت: «به من می‌خوره، به تو نه.» {p3} قبول کرد و یه مدلِ خودش ساخت که اتفاقاً قشنگ‌تر شد. صادق بودن + کارِ خود: فرمول.",
            effects: {
              relationships: [{ dim: "trust", min: 2, max: 5, scope: "pair" }],
              playerStats: [{ stat: "xp", min: 5, max: 12, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "honest",
        label: "🪞 آینه بده",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p2} یه آینه به {p1} داد و سکوت کرد. {p1} سه دقیقه نگاه کرد و بعد خندید: «باشه. تریم لازمه.» بعدش با هم رفتن قنبر. قنبر هرچی بود، مدل‌شون رو «جسورانه‌تر» کرد. هیچ‌کدوم عقب‌نشینی نکرد.",
            effects: {
              relationships: [{ dim: "friendship", min: 2, max: 6, scope: "pair" }],
              playerStats: [{ stat: "money", min: -150, max: -60, scope: "random_member" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "lucky_streak",
    kind: "personal",
    emoji: "🍀",
    title: "روزِ شانسِ {p1}",
    body: "از صبح، هر چی {p1} لم می‌ده درست می‌شه: چراغ‌ها سبز، نان گرم، حتی آسانسورِ گیر‌کرده منتظرش بود. {p2} حسادت نمی‌کنه. فقط آمار می‌گیره.",
    tags: ["money", "wholesome"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "ride",
        label: "🍀 سوارِ شانس شو",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} کل روز رو روی شانس سوار بود: قرعه، معامله، و یه سکه‌ی پیداشده. آخرِ روز، شانس خداحافظی کرد با یه آجرِ پایِ برخورده. خفیف. ارزشش رو داشت.",
            effects: {
              playerStats: [
                { stat: "money", min: 300, max: 1200, scope: "instigator" },
                { stat: "luck", min: -1, max: 1, scope: "instigator" },
                { stat: "energy", min: -6, max: -2, scope: "instigator" },
              ],
            },
          },
          {
            weight: 4,
            text: "شانسِ {p1} تا غروب ادامه داشت و بعد یهو کلاً قطع شد — نه بد شد، فقط «عادی» شد. عادی بعد از شانس، خودش یه جورایی بده. {p1} با یه چای آروم شد.",
            effects: {
              playerStats: [
                { stat: "money", min: 150, max: 600, scope: "instigator" },
                { stat: "luck", min: -2, max: 0, scope: "instigator" },
              ],

            },
          },
        ],
      },
      {
        key: "share",
        label: "🤲 شانست رو قرض بده",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} سکه‌ی خوش‌شانسی‌ش رو به {p2} داد برای مذاکره‌ی مهم. {p2} برد. سکه برگشت — با یه خراشِ جدید که قبلاً نبود. خراش‌ها امضای ماجرانه.",
            effects: {
              relationships: [
                { dim: "trust", min: 4, max: 9, scope: "pair" },
                { dim: "friendship", min: 2, max: 6, scope: "pair" },
              ],
              playerStats: [{ stat: "reputation", min: 1, max: 3, scope: "instigator" }],
            },
          },
        ],
      },
      {
        key: "hedge",
        label: "🛡 خرجش نکن، ذخیره‌ش کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} هیچ‌جوری شانس رو خرج نکرد و همه‌ش رو برای «یادگیری» ذخیره کرد: هر شانسِ استفاده‌نشده رو تو یه دفتر نوشت. آخرِ روز: 17 شانسِ خالی. فردا: هفده‌تا اتفاقِ خوب برای بقیه. توزیع‌شده.",
            effects: {
              playerStats: [
                { stat: "luck", min: 2, max: 5, scope: "participants" },
                { stat: "xp", min: 5, max: 12, scope: "instigator" },
              ],
              group: { socialTemp: -4 },

            },
          },
        ],
      },
    ],
  },
  {
    id: "bad_day",
    kind: "personal",
    emoji: "🌧",
    title: "روزِ بدِ {p1}",
    body: "از صبح: چای ریخته، کفش پاره، و یه ابلاغیه‌ی رسمی با یه غلطِ املایی مسخره... مجموع: روزِ بدِ کامل. {p1} رو صندلیِ کنارِ حوض نشسته و به آب نگاه می‌کنه.",
    tags: ["wholesome", "weather"],
    minMembers: 2,
    cooldownMinutes: 1440,
    weight: 9,
    choices: [
      {
        key: "sit",
        label: "🪑 کنارش بشین",
        style: "success",
        outcomes: [
          {
            weight: 7,
            text: "{p2} بدون حرف رفت و کنارِ {p1} نشست. نه نصیحت، نه راه‌حل. بعد از ده دقیقه {p1} گفت: «مرسی که نیومدی چیزی بگی.» سکوتِ خوب، نایاب‌ترین چیزِ شهره.",
            effects: {
              relationships: [
                { dim: "friendship", min: 4, max: 9, scope: "pair" },
                { dim: "trust", min: 2, max: 6, scope: "pair" },
              ],
              playerStats: [{ stat: "energy", min: 3, max: 8, scope: "random_member" }],
              group: { socialTemp: -5 },
            },
          },
        ],
      },
      {
        key: "tea",
        label: "☕ چایِ تازه بیار",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p3} یه چایِ تازه آورد — با نعلبکی. نعلبکی مالِ ماهور بود. {p1} چای رو خورد، عمیقاً. بعدش ابلاغیه‌ی بد با غلطِ املایی رو قاب کرد و زد رو دیوار: «یادگارِ روزِ خوب‌تر شدن.»",
            effects: {
              playerStats: [
                { stat: "energy", min: 5, max: 12, scope: "random_member" },
                { stat: "money", min: -60, max: -20, scope: "instigator" },
              ],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],

            },
          },
        ],
      },
      {
        key: "fix_all",
        label: "🧵 همه‌چیز رو درست کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p2} کفش رو برد دوخت، ابلاغیه رو اصلاح کرد، و چایِ ریخته رو... نمیشه درست کرد. چای ریخته همیشه ریخته‌ست. سه‌تا از چهار. روزِ بد رو می‌شه کم کرد، نه کشت.",
            effects: {
              playerStats: [{ stat: "xp", min: 8, max: 18, scope: "instigator" }],
              relationships: [{ dim: "cooperation", min: 3, max: 6, scope: "pair" }],
            },
          },
          {
            weight: 5,
            text: "تلاشِ {p2} برای درست کردنِ همه‌چیز، خودش یه مشکلات کوچیک ساخت: کفش درست شد ولی رنگش عوض شد. ابلاغیه اصلاح شد ولی دوتا غلطِ جدید اومد. {p1} خندید — یه بار، صاف. روزِ بد، شکست.",
            effects: {
              relationships: [{ dim: "friendship", min: 3, max: 7, scope: "pair" }],
              playerStats: [{ stat: "luck", min: 1, max: 2, scope: "random_member" }],
            },
          },
        ],
      },
    ],
  },
  {
    id: "philosophy_phase",
    kind: "personal",
    emoji: "🏛",
    title: "{p1} فیلسوف شده",
    body: "از دیروز {p1} به همه‌چیز «چرا؟» می‌گه: چرا نان نانه؟ چرا پول پوله؟ چرا قاشق؟ — مخصوصاً چرا قاشق. شهر دو دسته‌ست: تحت‌تأثیر و کلافه.",
    tags: ["absurd", "spoon"],
    minMembers: 2,
    cooldownMinutes: 2880,
    weight: 8,
    choices: [
      {
        key: "engage",
        label: "🏛 بحث کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p2} با {p1} بحث کرد تا نیمه‌شب: «قاشق چون شکلی داره که آب رو نگه می‌داره.» {p1}: «آب هم چرا؟» تا صبح ادامه داشت. هیچ‌کس نبرد. هر دو فهمیدن: دانستن، حالِ خوبیه.",
            effects: {
              playerStats: [{ stat: "xp", min: 12, max: 28, scope: "participants" }],
              relationships: [{ dim: "friendship", min: 2, max: 5, scope: "pair" }],
            },
          },
        ],
      },
      {
        key: "counter",
        label: "🪞 فلسفه‌ی جوابی بده",
        style: "danger",
        outcomes: [
          {
            weight: 6,
            text: "{p3} یه فلسفه‌ی مقابل ساخت: «چرا نپرسیم.» شهر دو مکتب شد: پرسنده‌ها و نپرسنده‌ها. جنگی نشد. فقط جلسات جدا. قورباغه‌ها تو مکتبِ سوم: «هیچ‌کدوم، ولی هر دو رو گوش می‌دیم.»",
            effects: {
              playerStats: [{ stat: "chaos", min: 2, max: 4, scope: "instigator" }],
              group: { chaos: 5, socialTemp: -3 },
            },
          },
        ],
      },
      {
        key: "notebook",
        label: "📓 سؤال‌هاش رو جمع کن",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p2} همه‌ی سؤال‌های {p1} رو تو یه دفتر جمع کرد و اسمشو گذاشت «پرسش‌نامه‌ی {group}». هر شب یه سؤال. جواب‌ها صبح میاد — از طرفِ ناشناس. سؤال‌های خوب، جوابِ ناشناس دارن.",
            effects: {
              playerStats: [{ stat: "xp", min: 10, max: 22, scope: "instigator" }],
              group: { influence: 3, reputation: 2 },
              clue: "پرسش‌نامه‌ی {group} هر شب جواب می‌گیرد — خطِ جواب‌ها با خطِ نعمتی یکی است، اما نعمتی انکار می‌کند.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "old_letter",
    kind: "personal",
    emoji: "✉️",
    title: "نامه‌ای برای {p1}",
    body: "تو صندوقِ {p1} یه نامه‌ست بدون تمبر. تاریخش: 98. گیرنده: {p1}. متنِ روی پاکت: «برای وقتی که حاضر باشی.» {p1} از دیروز نگاهش می‌کنه.",
    tags: ["mystery", "wholesome"],
    minMembers: 1,
    cooldownMinutes: 4320,
    weight: 8,
    choices: [
      {
        key: "open",
        label: "✉️ بازش کن",
        style: "danger",
        outcomes: [
          {
            weight: 5,
            text: "{p1} بازش کرد. داخل یه برگه: «ما منتظرتیم. هر وقت آماده بودی، درِ آبی، سه‌شنبه.» و یه ریبونِ کوچیکِ صورتی تا شده. {p1} نامه رو بست، نبست، فقط نگهش داشت. برای وقتی که حاضر باشه.",
            effects: {
              playerStats: [
                { stat: "chaos", min: 2, max: 4, scope: "instigator" },
                { stat: "xp", min: 15, max: 32, scope: "instigator" },
              ],
              clue: "نامه‌های بدون تمبرِ شهر همیشه از سالِ 98 می‌رسند — همیشه به کسانی که تازه رسیده‌اند.",
            },
          },
          {
            weight: 5,
            text: "نامه باز شد: خالی. یه برگه‌ی سفید، فقط بوی صابونِ قدیمی. {p1} برگه رو مقابلِ نور گرفت: هیچ. بعضی نامه‌ها خودِ «هیچ» رو با احترام می‌فرستن.",
            effects: { playerStats: [{ stat: "luck", min: 1, max: 3, scope: "instigator" }] },
          },
        ],
      },
      {
        key: "wait",
        label: "🕰 هنوز حاضر نیستم",
        style: "success",
        outcomes: [
          {
            weight: 6,
            text: "{p1} تصمیم گرفت نامه رو باز نکنه. گذاشتش تو کشو، کنارِ چیزهایی که نگه می‌داره. هر از گاهی چک می‌کنه که هنوز اون‌جاست. عجیبه که یه نامه‌ی بسته، این‌قدر آرامش بده.",
            effects: {
              playerStats: [
                { stat: "xp", min: 8, max: 18, scope: "instigator" },
                { stat: "luck", min: 1, max: 2, scope: "instigator" },
              ],
            },
          },
        ],
      },
      {
        key: "share",
        label: "🤝 با {p2} مشورت کن",
        style: "primary",
        outcomes: [
          {
            weight: 6,
            text: "{p1} نامه رو به {p2} نشان داد. {p2} نگاه کرد و یه جمله گفت: «هر چیزی که منتظرته، صبرش داره.» بعد برگردوندن نامه رو. تصمیم نگرفتن. ولی سبک‌تر شد. دوستی همین‌جوری کار می‌کنه.",
            effects: {
              relationships: [
                { dim: "trust", min: 4, max: 9, scope: "pair" },
                { dim: "friendship", min: 3, max: 7, scope: "pair" },
              ],
              playerStats: [{ stat: "xp", min: 6, max: 14, scope: "instigator" }],
            },
          },
        ],
      },
    ],
  },
]

// ═══ نمایشِ استایل — رویدادِ جهانیِ شخصیت‌محور (اولین رویدادِ بیلدخوان) ════════
// برخلافِ قالب‌های بالا، این رویداد گزینه و رأی ندارد: داورهای NPC بیلدِ واقعیِ
// فمبویِ روح‌بسته‌ی هر شهروند را قضاوت می‌کنند (کلاس · فرگشت · تسلط · کیهاناتِ
// پوشیده — موتورش در group/style.ts). صحنه‌ی شهر هر 3 روز در شب‌ها روشن می‌شود؛
// داورها همان هیئتِ «دوئلِ استایل»‌اند — شهر حافظه‌ی داورهایش را دارد.

/** محورهای سنجشِ استایل — از آمارِ مشتق‌شده‌ی فمبوی (deriveStats) */
export type StyleComponent = "move" | "presence" | "shine"

/** هویتِ کلاس روی صحنه: محورِ محبوب (×1.35) + خطِ امضا */
export interface StyleFlavorDef {
  /** محورِ آماری که شخصیتِ این کلاس روی آن می‌درخشد */
  favor: StyleComponent
  /** خطِ هویتِ کلاس — برگِ امضای روی صحنه، در کارتِ نتیجه */
  line: string
}

export const STYLE_SHOW = {
  /** شناسه‌ی templateId رویدادِ ذخیره‌شده — رزروِ نام در گروهِ قالب‌ها */
  id: "style_show",
  emoji: "💅",
  /** پنجره‌ی صحنه: از اعلام تا قضاوت (دقیقه) — V18: ۴۵ دقیقه (قبلاً ۱۵؛ کسی عقب نمی‌ماند) */
  windowMinutes: 45,
  /** فاصله‌ی اجرا تا اجرا (روز) — نگه‌داری در cultureJson: lastStyleShowDay */
  everyDays: 3,
  judges: "🐈 گربه‌ی شهردار (بی‌رحم) · خانم ماهور (سخت‌گیر) · کیمو (احساساتی)",
  openBody: "صحنه روشن شد. هر فمبویِ روح‌بسته‌ی این شهر خودکار روی صحنه می‌رود — کلاس و فرگشت و تسلط و کمدش سنجیده می‌شود. کارِ تو فقط تشویق است.",
  criteriaSpoiler: "سنجشِ داورها: حرکت و حضور و درخششِ آماری · هویتِ کلاس · مرحله‌ی فرگشت · سطحِ تسلط · کمدِ پوشیده — و کمی تاسِ شهر.",
  spectatorTease: "فمبوی نداری؟ تماشاچیِ خوب هم هنر است. پیمان در گفت‌وگوی خصوصیِ ربات بسته می‌شود.",
  /** برچسبِ فارسیِ محورهای سنجش — ترتیبِ نمایشِ ریزسنجش */
  componentLabels: { move: "حرکت", presence: "حضور", shine: "درخشش" } as Record<StyleComponent, string>,
  /** خطِ امضای هر کلاس روی صحنه — کلاسِ ناشناختهْ سطرِ پیش‌فرض می‌گیرد */
  flavors: {
    shinobi: { favor: "move", line: "ورود از پنجره؛ خروج از حافظه" },
    ranger: { favor: "presence", line: "ایستادن، انگار که همیشه همان‌جا بوده" },
    wizard: { favor: "shine", line: "درخششی عجیب و — البته — عمدی" },
    trickster: { favor: "shine", line: "وسطِ راه عوضش کرد؛ همه دیدند، هیچ‌کس ثابت نکرد" },
    paladin: { favor: "presence", line: "وقاری که درباره‌اش مذاکره نمی‌شود" },
    duelist: { favor: "move", line: "تمپو. تمپو. تمپو." },
    summoner: { favor: "shine", line: "چیزی که همراهش می‌آید، خودش تاج است" },
    reaper: { favor: "presence", line: "حضوری سرد — صحنه را برای خودش خالی می‌کند" },
  } as Record<string, StyleFlavorDef>,
  defaultFlavor: { favor: "shine", line: "چیزی در نگاهش هست که فهرست نمی‌شود" } as StyleFlavorDef,
} as const
