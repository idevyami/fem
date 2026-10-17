import type { EventDef } from "../types"

// ─── رویدادهای FEMBOY WAR ────────────────────────────────────────────────────
// زنجیره‌ها با chain مشخص می‌شوند. موتور بازی زنجیره‌ی در انتظار را
// از روی flags.pendingChain دنبال می‌کند — نه به‌صورت هاردکد.

export const EVENTS: EventDef[] = [
  // ═══ زنجیره‌ی کیف پول ═══
  {
    key: "wallet_found",
    title: "کیفی که نباید اینجا می‌بود",
    emoji: "👛",
    category: "story",
    rarity: "common",
    weight: 10,
    text: "داشتی از کوچه رد می‌شدی که پات به چیزی خورد.\n\nیه کیف چرمی، تازه، پر از پول. وسط کوچه. وسط هیچ.\n\nهیچ‌کس اطراف نیست. یکی از پنجره‌ها پرده‌ش گوشه داره.",
    choices: [
      {
        label: "💰 پول رو بردار و بریز رو",
        hint: "سریع، بی‌صدای خشک",
        outcomes: [
          {
            weight: 7,
            text: "4000 سکه جیب زدی و راه افتادی. قلبت بلند می‌زنه. کسی ندیدت. فکر می‌کنی.",
            effects: [
              { stat: "money", amount: 4000 },
              { stat: "crime", amount: 8 },
              { stat: "chaos", amount: 3 },
            ],
            continueChain: { nextStep: 1, afterMinutes: 2880 }, // ~2 روز بعد
            historyText: "4,000 سکه از کیفی که پیدا کردی برداشتی",
            worldFeed: "کسی تو بازار پول بیشتری از حسابش داره",
          },
          {
            weight: 2,
            text: "دستی رو دادی جیبت... کیف خالی بود. فقط یه برگه توش بود با نوشته‌ی سبز: «تماشا شدی.»",
            effects: [{ stat: "chaos", amount: 5 }],
            setFlag: "watched",
            continueChain: { nextStep: 2, afterMinutes: 1440 },
            historyText: "کیف پول یه تله بود",
          },
          {
            weight: 1,
            text: "همون لحظه سراغت اومدند. برداشتی و رفتی، ولی پشت سرت صدای چکمه بود. تا خونه دویدی.",
            effects: [
              { stat: "money", amount: 4000 },
              { stat: "crime", amount: 10 },
              { stat: "energy", amount: -15 },
            ],
            notification: {
              icon: "🚨",
              title: "صدای چکمه",
              body: "دیشب صدای پایی رو پشت سرت بود. امروز هم از صبح داری صداش رو می‌شنوی.",
              delayMinutes: 120,
            },
            continueChain: { nextStep: 1, afterMinutes: 2880 },
            historyText: "4,000 سکه برداشتی و چیزی دنبالت اومد",
          },
        ],
      },
      {
        label: "🕵️ بذار سراغ صاحبش باشی",
        hint: "درستکاری که... انگیزه داره",
        outcomes: [
          {
            weight: 6,
            text: "دو ساعت گشتی. کیف مال یه خانم مسن بود که تازه دکتر رفته بود و پول درمانش توش بود.\nگریه‌ش گرفتی. 1,500 سکه پاداش گرفتی و یه دعای که هنوز ازش چیزی نفهمیدی.",
            effects: [
              { stat: "money", amount: 1500 },
              { stat: "reputation", amount: 15 },
              { stat: "luck", amount: 2 },
            ],
            npc: [{ npcKey: "mahoor", trust: 10, memory: "کیف آن خانم را برگرداند" }],
            grantAchievement: "good_samaritan",
            historyText: "کیف پول یه خانم مسن رو برگردوندی",
          },
          {
            weight: 3,
            text: "صاحبش یه دلال بی‌حوصله بود. تعریف نکردی که دو ساعت دنبالش گشتی. فقط گرفت و رفت. حتی تشکر نکرد.\nیه جای شهر، آرش این ماجرا رو شنید.",
            effects: [{ stat: "reputation", amount: 5 }],
            npc: [
              { npcKey: "arash", trust: 8, memory: "کیف دلال را تحویل داد. آدم درستی است" },
            ],
            historyText: "کیف یه دلال رو برگردوندی. تشکر نکرد.",
          },
          {
            weight: 1,
            text: "کیف بعد از یه ساعت غیب شد. کاش رفتی. یه چیزی درباره‌ی این شهر یاد گرفتی.",
            effects: [{ stat: "intelligence", amount: 2 }],
            historyText: "کیفی که پیدا کردی، خودش غیب شد",
          },
        ],
      },
      {
        label: "🚔 ببری پیش سرگرد نعمتی",
        hint: "شاید به دردت بخوره. شاید برعکس.",
        outcomes: [
          {
            weight: 5,
            text: "نعمتی کیف رو گرفت، یه نگاه انداخت، بعد نگاهش یه بار دیگه روی تو مکث کرد.\n«مرسی. بچه‌ی کمی هستن که این کارو می‌کنن.یا اصلاً هیچی.»\nیه اسم تو دفترش ثبت شد. نمی‌دونی کدوم ستون.",
            effects: [{ stat: "reputation", amount: 10 }],
            npc: [{ npcKey: "sargord_nemati", trust: 12, respect: 8, memory: "کیف را آورده. اسمش را علامت زدم — ستون سبز" }],
            setFlag: "nemati_green_mark",
            historyText: "کیف رو به سرگرد نعمتی سپردی",
          },
          {
            weight: 2,
            text: "کل راه تا مرکز، نعمتی درباره‌ی «سال 98» حرف زد. هیچ‌وقت نگفت سال 98 چی.\nکیف رو تحویل گرفتن. تو یه نصف روز و یه کل صبر از دست دادی.",
            effects: [{ stat: "energy", amount: -10 }, { stat: "reputation", amount: 6 }],
            historyText: "تحویل کیف به پلیس، با یه قصه‌ی طولانی",
          },
        ],
      },
      {
        label: "🙈 کیف رو همون‌جا بذار و برو",
        outcomes: [
          {
            weight: 6,
            text: "رفتی. شب یه دینگ شنیدی: «امروز یه انتخاب کردی. انتخاب‌ها ثبت می‌شن.»\nاز خونه که اومدی بیرون، کیف اونجا نبود. ولی یه سکه روی همون نقطه بود.",
            effects: [{ stat: "money", amount: 200 }, { stat: "intelligence", amount: 1 }],
            historyText: "کیف رو نخوندی. یه سکه ماند روی زمین",
          },
        ],
      },
    ],
  },
  {
    key: "wallet_aftermath",
    title: "دنبال‌کنندگان کیف",
    emoji: "🕴",
    category: "dark",
    rarity: "uncommon",
    weight: 0,
    chain: { key: "wallet", step: 1 },
    text: "سه روز گذشته. فردا صبح، دو نفر جلوی در خونه‌ات ایستاده‌اند.\nکت‌وشلوار. عینک. صورت‌هایی که یادت نمی‌مونه چون هیچ ویژگی ندارن.\n\n«کیف. پولش. حالا.»",
    choices: [
      {
        label: "💸 برگردون پول رو",
        outcomes: [
          {
            weight: 6,
            text: "پول رو پس دادی. یکی‌شون پول رو شمرد، نصفش رو بهت برگردوند.\n«هزینه‌ی رفتار خوب. یه بار دیگه پیش نمیاد.»\nخوشحال نباش. منظورش دقیقاً همینه که می‌گه.",
            effects: [
              { stat: "money", amount: -2000 },
              { stat: "crime", amount: -4 },
              { stat: "chaos", amount: 2 },
            ],
            historyText: "پول کیف رو به مردهای بی‌صورت پس دادی",
          },
        ],
      },
      {
        label: "🏃 فریاد بزن «دادمی! یه لیوان آب!»",
        hint: "همسایه‌ها صدای داد می‌شنون. اکثراً.",
        outcomes: [
          {
            weight: 4,
            text: "یه پنجره بالا باز شد، بعد یکی دیگه. مردها ناپدید شدن مثل اینکه کلاً نبودن.\nهمسایه‌هات از فردا بهت سلام می‌کنن. حس خوبیه.",
            effects: [
              { stat: "reputation", amount: 8 },
              { stat: "fame", amount: 3 },
            ],
            historyText: "با فریاد، مردهای بی‌صورت رو فراری دادی",
          },
          {
            weight: 3,
            text: "هیچ پنجره‌ای باز نشد. مردها آروم اومدن جلو. فقط گاز گرفتن و بریدن.\nسربه‌سر شدی، یه دندان کم شد، 3000 سکه رفت.",
            effects: [
              { stat: "money", amount: -3000 },
              { stat: "health", amount: -20 },
              { stat: "crime", amount: -2 },
            ],
            historyText: "کتک بخوردی سر ماجرای کیف",
          },
        ],
      },
      {
        label: "🤝 پیشنهاد بده: نصفِ کارهای بعدی",
        hint: "سقفی باز میشه که شاید نتونی ببندی",
        outcomes: [
          {
            weight: 5,
            text: "یکی‌شون برای اولین بار لبخند زد. بعد از یه سکوت طولانی گفت: «آدمِ جواب قابل اعتمادی.»\nیه کارت داد بهت. روی کارت فقط یه شماره بود.\nحسابی با گروه تو رفتی.",
            effects: [
              { stat: "money", amount: 3000 },
              { stat: "crime", amount: 12 },
              { stat: "chaos", amount: 6 },
              { stat: "fame", amount: 2 },
            ],
            setFlag: "syndicate_contact",
            grantTitle: "آشنا‌ی آشنایان",
            historyText: "با گروه بی‌صورت‌ها هم‌کار شدی",
            worldFeed: "تو زیرزمین بازار، یکی به یکی لبخند زد",
          },
        ],
      },
    ],
  },
  {
    key: "watched",
    title: "تماشا شدی",
    emoji: "👁",
    category: "dark",
    rarity: "rare",
    weight: 0,
    chain: { key: "wallet", step: 2 },
    text: "از وقتی اون کیف رو برداشتی، یه حس مزاحم داری.\nامروز مطمئن شدی: هر جا می‌ری، یه نفر آنجاست. نه دنبالت نمی‌کنه، فقط «هست».\n\nتو پارک، روی نیمکت، کنار سنگ‌ها، یه کارت سبز افتاده.\nرو کارت نوشته: «همکاری؟»",
    choices: [
      {
        label: "🟢 کارت رو بردار",
        outcomes: [
          {
            weight: 1,
            text: "کارتی که برداشتی یه شب بعد از دستت غیب شد. ولی فرداش 5000 سکه تو جیبت بود که یادت نمیاد از کجا.\nیه جای این شهر، چیزی درباره‌ت تصمیم گرفته شده.",
            effects: [
              { stat: "money", amount: 5000 },
              { stat: "chaos", amount: 8 },
              { stat: "luck", amount: 2 },
            ],
            setFlag: "chosen_one",
            grantTitle: "منتخبِ کسی، برای چیزی",
            historyText: "کارت سبز رو برداشتی و جواب در جیبت اومد",
            worldFeed: "یه کارت سبز در شهر دست‌به‌دست شد",
          },
        ],
      },
      {
        label: "🔥 کارت رو بسوزون",
        outcomes: [
          {
            weight: 1,
            text: "کارت با یه شعله‌ی سبز سوخت. خاکسترش سفید نبود.\nاز فردا اون «حس مزاحم» رفت. خواب راحت‌تری داری. شاید ارزشش رو داشت.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "chaos", amount: -4 },
              { stat: "health", amount: 5 },
            ],
            clearFlag: "watched",
            grantAchievement: "burned_the_card",
            historyText: "کارت سبز رو سوزوندی",
          },
        ],
      },
    ],
  },

  // ═══ زنجیره‌ی گربه با پلاک طلایی ═══
  {
    key: "cat_collar_1",
    title: "گربه‌ای که خیره میشه",
    emoji: "🐈",
    category: "story",
    rarity: "uncommon",
    weight: 8,
    text: "داشتی از کوچه رد می‌شدی که یه گربه از پشت سطل زباله بیرون پرید.\n\nروی گردنش یه پلاک طلایی آویزونه.\nگربه به تو خیره شده.\nبه نظر می‌رسه چیزی می‌خواد...",
    choices: [
      {
        label: "🐈 دنبالش برو",
        hint: "گربه‌ها مسیر رو بلدن",
        outcomes: [
          {
            weight: 5,
            text: "دنبالش رفتی، از سه کوچه، یه درِ آهنی، یه حیاط.\nاون ایستاد. تو ایستادی. بعد گربه دستش رو — آره دستش رو — در کرد و رفت.\nجایی که بود، یه پلاک طلایی دیگه بود.",
            effects: [
              { stat: "energy", amount: -10 },
              { stat: "luck", amount: 2 },
            ],
            grantItem: { itemKey: "cat_collar" },
            setFlag: "collar_found",
            continueChain: { nextStep: 1, afterMinutes: 4320 },
            historyText: "یه گربه تو رو به یه پلاک طلایی رسوند",
          },
          {
            weight: 2,
            text: "دنبالش رفتی. گاله رو بردت سمت منطقه‌ی ممنوعه. آخرین لحظه ایستادی.\nگربه برگشت و یه بار دیگه خیره شدت. این بار معلوم بود: «نه امروز».",
            effects: [
              { stat: "energy", amount: -8 },
              { stat: "intelligence", amount: 2 },
            ],
            historyText: "گربه تو رو سمت منطقه‌ی ممنوعه کشوندی. برگشتی",
          },
        ],
      },
      {
        label: "🍖 بهش غذا بده",
        hint: "غذای حیوانات لازمه",
        requires: { hasItem: "pet_food" },
        outcomes: [
          {
            weight: 6,
            text: "غذا رو زمین گذاشتی. گربه اومد، خورد، بعد برگشت و کنارت نشست.\nوقتی بلند شدی، دنبالت راه افتاد.\nانگار مال تو بوده از اول.",
            grantPet: { speciesKey: "street_cat", suggestedName: "ماهو" },
            effects: [{ stat: "luck", amount: 1 }],
            grantAchievement: "cat_person",
            historyText: "یه گربه‌ی خیابانی رو غذا دادی. دیگه رفت",
          },
          {
            weight: 2,
            text: "غذا رو خورد، بعد پلاکش رو درآورد و جلوت انداخت و رفت.\nچه معنایی داشت این؟ معلوم نیست. ولی پلاک مال توئه.",
            effects: [{ stat: "chaos", amount: 2 }],
            grantItem: { itemKey: "cat_collar" },
            setFlag: "collar_found",
            continueChain: { nextStep: 1, afterMinutes: 4320 },
            historyText: "گربه پلاکش رو جلوت انداخت",
          },
        ],
      },
      {
        label: "🔍 پلاکش رو بررسی کن",
        outcomes: [
          {
            weight: 5,
            text: "خم شدی. روی پلاک نوشته:\n«اگر پیدا کردی، منتظرت هستم.»\nزیرش هم یه آدرس. تو پارک. کنار سنگ‌ها.\nگربه از دیوار بالا رفت و رفت.",
            effects: [{ stat: "intelligence", amount: 2 }],
            grantItem: { itemKey: "cat_collar" },
            setFlag: "collar_found",
            continueChain: { nextStep: 1, afterMinutes: 2880 },
            historyText: "پلاک گربه یه پیام داشت: «منتظرت هستم»",
          },
          {
            weight: 2,
            text: "پلاک طلایی نبود. برنجی بود. خیلی براق. تازه هم پرداخت شده بود.\nیعنی کسی این گربه رو امروز اینجا گذاشته. برای تو؟ برای کسی؟\nگربه رفت. تو هم برگشتی. ولی یه سؤال هم دنبالت اومد.",
            effects: [{ stat: "intelligence", amount: 3 }],
            historyText: "پلاک گربه خیلی تازه بود. خیلی.",
          },
        ],
      },
      {
        label: "🏃 بی‌خیالش شو",
        outcomes: [
          {
            weight: 1,
            text: "رفتی. تا آخر کوچه، پشت سرت صدای میو شنیدی.\nیکی نبود. سه تا بود. یا فقط باد. تو این شهر، فرقش زحمت داره.",
            effects: [{ stat: "chaos", amount: 1 }],
            historyText: "یه گربه رو بی‌خیال شدی. شهر یادش مونه",
          },
        ],
      },
    ],
  },
  {
    key: "cat_collar_2",
    title: "منتظرت هستم",
    emoji: "🪦",
    category: "mystery",
    rarity: "rare",
    weight: 0,
    chain: { key: "cat_collar", step: 1 },
    conditions: { requiresFlag: "collar_found" },
    text: "آدرس پلاک رو رفتی. پارک، کنار سنگ‌ها.\nیه نیمکت هست که هیچ‌وقت کسی روش نمی‌شینه. امروز هم کسی نبود.\n\nولی روی نیمکت، یه عکس قدیمی افتاده:\nیه نفر با همون گربه. صورتش با ماژیک خط‌خورده.\nپشت عکس نوشته: «دیر رسیدی. ولی رسیدی. کافیه.»",
    choices: [
      {
        label: "🪑 روی نیمکت بشین",
        hint: "کسی که تا حالا روی این نیمکت ننشسته",
        outcomes: [
          {
            weight: 1,
            text: "نشستی. هوا آروم بود. با یه چیزی که شبیه آروم‌بودن بود، یکی نشست کنارت.\nقیافه‌ش رو ندیدی. حرف نزد. بعد از یه ساعت، یه کاست جلوت گذاشت و رفت.\nروی کاست نوشته: «برای وقتی که تنهایی.»",
            grantItem: { itemKey: "cassette" },
            effects: [
              { stat: "luck", amount: 3 },
              { stat: "intelligence", amount: 2 },
              { stat: "chaos", amount: 4 },
            ],
            grantTitle: "نشنسته‌ای که می‌شنود",
            grantAchievement: "the_bench",
            clearFlag: "collar_found",
            historyText: "کنار کسی روی نیمکت خالی نشستی. یه کاست گرفتی",
            worldFeed: "نیمکت خالیِ پارک امروز یکی رو پذیرفت",
          },
        ],
      },
      {
        label: "📸 عکس رو بردار و برو",
        outcomes: [
          {
            weight: 1,
            text: "عکس رو برداشتی. بعد از دو کوچه نگاهش کردی.\nخط‌خوردگی روی صورت، وقتی از زور نور، کمی باز شد.\nیه چیز دیدی که اسم‌شه. اسمِ خودت؟ نه. شبیهش بود.\nعکس رو تا حالا خونه داری. هنوز بهش نگاه نکردی.",
            grantItem: { itemKey: "cursed_card" },
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "chaos", amount: 6 },
            ],
            clearFlag: "collar_found",
            setFlag: "saw_almost_self",
            historyText: "تو عکسی که پیدا کردی، چیزی شبیه خودت بود",
          },
        ],
      },
    ],
  },

  // ═══ زنجیره‌ی اردک ═══
  {
    key: "duck_1",
    title: "اردک وارد خانه‌ات شد",
    emoji: "🦆",
    category: "absurd",
    rarity: "uncommon",
    weight: 6,
    text: "در رو باز کردی، یه اردک داخل خونه‌ات بود.\n\nدلیلش مشخص نیست.\nچطور اومده داخل هم مشخص نیست.\n\nاردک بهت نگاه کرد. نگاهش گزینه‌ای نیست. یه «حالا چی؟»ـِ پردار.",
    choices: [
      {
        label: "🍞 بهش نون بده",
        outcomes: [
          {
            weight: 4,
            text: "نون رو خورد. بعد از یه مدت بهت نگاه کرد، مثل اینکه تصمیم گرفت.\nموند. الان کنار در می‌خوابه. اسم روش گذاشتی «قاضی».",
            grantPet: { speciesKey: "hostile_duck", suggestedName: "قاضی" },
            effects: [{ stat: "chaos", amount: 4 }],
            grantAchievement: "duck_lord",
            historyText: "یه اردک به خونه‌ات اومد. مونده",
          },
          {
            weight: 2,
            text: "نون رو نصفه خورد، نصفه دیگه رو بهت پس داد و رفت.\nاردک‌ها غذا رو پس نمی‌دن. این یکی داد.\nشبی که اردک غذا پس می‌ده، یه چیزی تو شهره.",
            effects: [{ stat: "chaos", amount: 6 }],
            setFlag: "duck_pending",
            continueChain: { nextStep: 1, afterMinutes: 1440 },
            historyText: "اردک نون رو نصفه خورد و نصفه‌ش رو پس داد",
          },
        ],
      },
      {
        label: "🦆 باهاش حرف بزن",
        hint: "این شهر تو خودته. جواب می‌گیرم.",
        outcomes: [
          {
            weight: 3,
            text: "گفتی: «تو چی کار می‌کنی اینجا؟»\nاردک سرش رو کج کرد. بعد یه بار دست زد و رفت.\nچند تا اردک دیگه از آسمون گذشتن. یه دونه شون چیزی انداخت.\nیه سکه‌ی شانس.",
            grantItem: { itemKey: "coin" },
            effects: [{ stat: "luck", amount: 2 }, { stat: "chaos", amount: 3 }],
            historyText: "با اردک حرف زدی. جواب گرفتی",
          },
          {
            weight: 2,
            text: "حرف زدی. اردک ول کن نیست. بعد از دقیقه‌ها سکوت، اردک پارس کرد.\nاردک‌ها پارس نمی‌کنن.\nتو رفتی اتاق. اردک اومد. مشکل رو فهمیدی: این خونه دیگه مال تو نیست. مشترکه.",
            grantPet: { speciesKey: "hostile_duck", suggestedName: "قاضی" },
            effects: [{ stat: "chaos", amount: 5 }],
            historyText: "اردک پارس کرد. خونه مشترک شد",
          },
        ],
      },
      {
        label: "🚪 بذار بره",
        outcomes: [
          {
            weight: 1,
            text: "در رو باز کردی. اردک یه نگاه — یه بار دیگه — انداخت و رفت.\nشب یه صدای شنا شنیدی از جایی که آب نیست.\nقضیه بسته نشده. تو این شهر هیچی نمی‌بنده.",
            effects: [{ stat: "chaos", amount: 2 }],
            setFlag: "duck_pending",
            continueChain: { nextStep: 1, afterMinutes: 2880 },
            historyText: "اردک رو ول کردی. ول نکردت",
          },
        ],
      },
    ],
  },
  {
    key: "duck_2",
    title: "بازگشت اردک",
    emoji: "🦆",
    category: "absurd",
    rarity: "rare",
    weight: 0,
    chain: { key: "duck", step: 1 },
    conditions: { requiresFlag: "duck_pending" },
    text: "امروز صبح، جلوی در خونه‌ات، ردیفی از چیزها چیده شده:\n\nسه تا شاخه‌ی درخت. یه پیچ. یه عینک. و یه اردک لاستیکی که انگار ماه‌ها اون پات بوده.\n\nاردک واقعی رو جایی نمی‌بینی. ولی این هدیه‌ست. از اردک. برای تو.",
    choices: [
      {
        label: "🎁 هدیه رو قبول کن",
        outcomes: [
          {
            weight: 1,
            text: "برداشتی. اردک لاستیکی رو که گرفتی، یه لحظه برق زد.\nمدت‌ها بعد فهمیدی: این همون «اردک لاستیکی مقدس»ـه که تو افسانه‌های بازار ازش می‌گن.\nافسانه‌ها درست می‌گن. معمولاً دیر، ولی درست.",
            grantItem: { itemKey: "duck" },
            effects: [
              { stat: "luck", amount: 4 },
              { stat: "fame", amount: 5 },
              { stat: "chaos", amount: 8 },
            ],
            grantTitle: "دارنده‌ی اردک",
            grantAchievement: "the_duck",
            clearFlag: "duck_pending",
            historyText: "اردک واقعی بهت اردک لاستیکی مقدس رو هدیه داد",
            worldFeed: "افسانه‌ی اردک لاستیکی مقدس واقعی شد",
          },
        ],
      },
      {
        label: "🧹 جمعش کن بریز دور",
        outcomes: [
          {
            weight: 1,
            text: "همه رو انداختی دور. شب، صدای اردک شنیدی. یه بار. کوتاه.\nاز اون روز، هر چیزی تو خونه یه بار در جاش نیست. فقط یه بار. هر روز.",
            effects: [{ stat: "chaos", amount: 6 }, { stat: "luck", amount: -3 }],
            clearFlag: "duck_pending",
            setFlag: "duck_curse",
            historyText: "هدیه‌ی اردک رو ریختی دور. اشتباه بود",
          },
        ],
      },
    ],
  },

  // ═══ زنجیره‌ی آدم بی‌نام ═══
  {
    key: "stranger_1",
    title: "کسی که نبود",
    emoji: "👤",
    category: "mystery",
    rarity: "rare",
    weight: 4,
    text: "تو راه برگشت، از کنار کسی رد شدی.\n\nبعد یه لحظه ایستادی: یادت نمیاد صورتش.\n نه که یادت رفته باشه. اینکه «یادپذیر نبود».\n\nپشت سرت برگشتی. اونجا نبود. جاده خلوت بود.\nتو جیبت یه برگه بود که قبلاً نبود.\nنوشته: «هزار روز تا دیدار بعدی. نه، شوخی کردم. پنج دقیقه دیگه.»",
    choices: [
      {
        label: "⏱ پنج دقیقه همون‌جا بمون",
        outcomes: [
          {
            weight: 4,
            text: "پنج دقیقه ایستادی. هیچ‌کس نیامد.\nشش دقیقه. هیچ‌کس.\nهفت دقیقه... یه نفر از پشت سرت گفت: «حساب‌ترسی داری. خوبه.»\nبرگشتی. اون بود. صورتش رو، برای یک ثانیه، دیدی. بعد یادش رفت. فقط جمله موند.\nو یه نظرقربونی تو جیبت.",
            grantItem: { itemKey: "nazar" },
            effects: [
              { stat: "luck", amount: 3 },
              { stat: "intelligence", amount: 2 },
            ],
            setFlag: "stranger_met",
            continueChain: { nextStep: 1, afterMinutes: 10080 },
            historyText: "با کسی که صورت نداشت ملاقات داشتی",
          },
          {
            weight: 2,
            text: "منتظر موندی. بارون گرفت. هیچ‌کس نیامد.\nبرگشتی خونه. کل شب به اون جمله فکر کردی: «پنج دقیقه دیگه.»\nشاید اومد. تو نبودی. شاید بهتره.",
            effects: [{ stat: "intelligence", amount: 2 }],
            setFlag: "stranger_met",
            continueChain: { nextStep: 1, afterMinutes: 4320 },
            historyText: "منتظر کسی که صورت نداشت موندی. نیامد",
          },
        ],
      },
      {
        label: "🔥 برگه رو پاره کن",
        outcomes: [
          {
            weight: 1,
            text: "برگه رو پاره کردی. تیکه‌ها سه بار افتادند روی زمین، هر بار شکل یه چیز دیگه.\nآخریش شکل یه کلید بود.\nترکوندی. رفت. خواب راحت‌تری داری. ولی یه چیزی تو این شهر از دستت رد شد و برنمی‌گرده.",
            effects: [
              { stat: "chaos", amount: -5 },
              { stat: "health", amount: 5 },
              { stat: "luck", amount: -2 },
            ],
            historyText: "دعوت آدم بی‌نام رو پاره کردی",
          },
        ],
      },
    ],
  },
  {
    key: "stranger_2",
    title: "دیدار بعدی",
    emoji: "👤",
    category: "mystery",
    rarity: "epic",
    weight: 0,
    chain: { key: "stranger", step: 1 },
    conditions: { requiresFlag: "stranger_met" },
    text: "امشب، ساعت دقیقاً 03:33، از خواب پریدی.\n\nیه نفر تو اتاقه. ترس نداری. این عجیب‌ترین قسمتشه.\n\nمی‌گه: «وقتشه انتخاب کنی. من نگهبان یه چیزی‌ام که این شهر فراموش کرده. یکی باید یادش بیاره. تو شماره‌ی بعدی هستی.»\n\nیه کلید قدیمی و یه کارت لعنتی می‌ذاره رو میز. فقط یه دونه‌ش می‌تونی برداری.",
    choices: [
      {
        label: "🗝 کلید رو بردار",
        outcomes: [
          {
            weight: 1,
            text: "کلید رو گرفتی. آدم — چیز — رفتی. با یه صدای بسته‌شدن که از هیچ دری نیامد.\nکلید تو دستت گرمه. همیشه گرمه.\nیه روز یه در پیدا می‌کنه. تو این شهر، درها کسانی رو که صبور باشن پیدا می‌کنن.",
            grantItem: { itemKey: "old_key" },
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "luck", amount: 2 },
            ],
            grantTitle: "نگهبانِ بعدی",
            clearFlag: "stranger_met",
            setFlag: "keeper_key",
            historyText: "کلیدِ نگهبانی رو پذیرفتی",
            worldFeed: "ساعت 03:33 چیزی در شهر جابه‌جا شد",
          },
        ],
      },
      {
        label: "🃏 کارت رو بردار",
        outcomes: [
          {
            weight: 1,
            text: "کارت رو گرفتی. روی کارت، نقشه‌ی شهرت بود — با خیابون‌هایی که هنوز ساخته نشده.\nیه خونه رو با ربان قرمز علامت زده بودن.\nکارت اینو قول میده: «جایی که هنوز نیستی، همیشه یه جای دیگه‌ست.»",
            grantItem: { itemKey: "cursed_card" },
            effects: [
              { stat: "chaos", amount: 10 },
              { stat: "fame", amount: 3 },
            ],
            grantTitle: "تماشاگرِ نقشه‌ها",
            clearFlag: "stranger_met",
            setFlag: "keeper_card",
            historyText: "کارتِ نقشه‌ی شهرِ آینده رو برداشتی",
          },
        ],
      },
      {
        label: "🙅 هیچ‌کدوم. من بخوابم.",
        outcomes: [
          {
            weight: 1,
            text: "گفتی: «نه. من فقط می‌خوام بخوابم.»\nچند ثانیه سکوت. بعد صدای خنده‌ای که شبیه بارون بود.\n«آدمِ درست. بمان. شهر به آدم‌های درست نیاز داره. متأسفانه هرگز بهشون نمی‌رسه.»\nصبح هیچ‌کس نبود. فقط یه شبدر چهاربرگ روی بالش.",
            grantItem: { itemKey: "lucky_charm" },
            effects: [
              { stat: "health", amount: 10 },
              { stat: "luck", amount: 1 },
            ],
            grantAchievement: "slept_through_it",
            clearFlag: "stranger_met",
            historyText: "به پیشنهاد مرموز گفتی نه و خوابیدی",
          },
        ],
      },
    ],
  },

  // ═══ رویدادهای مستقل ═══
  {
    key: "first_day",
    title: "روز اول",
    emoji: "🌅",
    category: "story",
    rarity: "common",
    weight: 0,
    once: true,
    text: "چمدونت رو گذاشتی گوشه‌ی اتاق زیر شیروانی.\n\nشهری که بهش اومدی از بیرون عادی به نظر میاد. از داخل... نه.\n\nاز پنجره صدای شهر میاد. یه جایی، یه چیزی، یه بار می‌خنده.\n\nزندگی از این‌جا شروع میشه. با چی شروعش کنی؟",
    choices: [
      {
        label: "🚶 برم بازار رو ببینم",
        outcomes: [
          {
            weight: 1,
            text: "بازار نفس می‌کشید. قیمت‌ها بالا پایین می‌شدند. آرش از راه دور نگاهت کرد و لبخند زد.\nیه «ربان صورتی» خریدی برای شروع. تو این شهر، ربان یعنی من هستم.\nاولین خرید انجام شد. اولین اشتباه هم پیش روئه.",
            effects: [
              { stat: "money", amount: -140 },
              { stat: "fame", amount: 2 },
              { stat: "energy", amount: -5 },
            ],
            grantItem: { itemKey: "ribbon" },
            historyText: "روز اول: با یه ربان صورتی وارد شهر شدی",
          },
        ],
      },
      {
        label: "☕ برم کافه‌ی ماهور",
        outcomes: [
          {
            weight: 1,
            text: "کافه گرم بود. ماهور یه قهوه داد که «حسابی» بود.\nگفت: «تازه اومدی؟ این شهر سؤال زیاد داره، جواب کم. قهوه‌ت مهمون من.»\nاز فردا باریستا می‌تونی باشی. اگه بخوای.",
            effects: [
              { stat: "energy", amount: 15 },
              { stat: "luck", amount: 1 },
            ],
            npc: [{ npcKey: "mahoor", trust: 15, affection: 10, memory: "روز اولش آمد. قهوه مهمون من" }],
            historyText: "روز اول: ماهور قهوه‌ی مهمون داد",
          },
        ],
      },
      {
        label: "🌳 برم پارک",
        outcomes: [
          {
            weight: 1,
            text: "پارک سبز و ساکت بود. روی سنگ‌ها نشستی و به شهر نگاه کردی.\nیه گربه از راه اومد، کنارت نشست، هیچی نگفت و رفت.\nحس خوبی بود. انگار شهر گفته بود: «سلام، قبول شدی.»",
            effects: [
              { stat: "health", amount: 10 },
              { stat: "luck", amount: 1 },
            ],
            historyText: "روز اول: پارک و سکوت و یه گربه‌ی بی‌حرف",
          },
        ],
      },
    ],
  },
  {
    key: "street_musician",
    title: "نوازنده‌ی گوشه‌ی خیابون",
    emoji: "🎻",
    category: "wholesome",
    rarity: "common",
    weight: 7,
    text: "یه آقا با ویولن گوشه‌ی مرکز شهر می‌زنه.\n\nقطعه‌ش رو هیچ‌جا نشنیدی. تو هیچ فیلمی، هیچ قصه‌ای، هیچ‌جا.\n\nجعبه‌ش جلوشه. توش چند تا سکه و یه برگه:\n«برای ادامه‌ی قطعه، لازمه.»",
    choices: [
      {
        label: "🪙 سکه بنداز",
        outcomes: [
          {
            weight: 5,
            text: "سکه انداختی. نوازنده بدون اینکه قطع کنه، سر تکان داد.\nقطعه تموم شد. بعد بهت گفت: «این قطعه اسم داره. اسمش رو تو یه جای دیگه شنیدی. یادت میاد کجا؟»\nیادت نمیاد. ولی از فردا، یه تیکه‌ش گاهی تو خوابت پخش می‌شه.",
            effects: [
              { stat: "money", amount: -100 },
              { stat: "luck", amount: 2 },
              { stat: "reputation", amount: 4 },
            ],
            historyText: "به نوازنده‌ی ویولن سکه دادی",
          },
          {
            weight: 2,
            text: "سکه انداختی. نوازنده وسط قطعه ایستاد، نگاهت کرد، و یه قطعه‌ی جدید زد.\nاین یکی... آهنگ قصه‌های کودکیت بود. اونی که یادت رفته بود.\nیه لایه از خستگی‌ت رفت. عمیقاً رفت.",
            effects: [
              { stat: "money", amount: -100 },
              { stat: "health", amount: 15 },
              { stat: "energy", amount: 10 },
            ],
            historyText: "نوازنده یه قطعه از کودکی‌ات زد",
          },
        ],
      },
      {
        label: "🎧 فقط گوش بده",
        outcomes: [
          {
            weight: 1,
            text: "نشستی گوش دادی. جمعیت رفت، اومد، رفت.\nنوازنده آخرش گفت: «گوش‌دادن هم پول می‌کشه. شاید از پول باارزش‌تر.»\nخوب شد. ولی جعبه‌ش رو نگاه کردی. جعبه هم نگاه کردی. خجالت کشیدی، یه سکه انداختی.",
            effects: [
              { stat: "money", amount: -50 },
              { stat: "energy", amount: 10 },
              { stat: "reputation", amount: 2 },
            ],
            historyText: "به نوازنده فقط گوش دادی. سکه آخرش رفت تو جعبه",
          },
        ],
      },
    ],
  },
  {
    key: "police_stop",
    title: "سرگرد نعمتی می‌خواد باهات حرف بزنه",
    emoji: "🚔",
    category: "dark",
    rarity: "uncommon",
    weight: 6,
    conditions: { stats: { crime: 5 } },
    text: "ماشین پلیس کنارت ترمز زد. پنجره پایین اومد.\n\nسرگرد نعمتی. 27 ساله تو این شهر. چشم‌هاش مثل دو تا پرونده‌ی بسته‌ست.\n\n«یه شب خوب برای قدم زدنه، نه؟ مخصوصاً برای کسی با... سرگرمی‌های تو.»\nنگاهش دقیقاً می‌دونه چی می‌خواد.",
    choices: [
      {
        label: "😶 حرف نزن، فقط نگاهش کن",
        requires: { stats: { intelligence: 12 } },
        outcomes: [
          {
            weight: 3,
            text: "سکوت کردی. سکوت طولانی شد. نعمتی بعد یه ساعت — یه ساعت واقعی — لبخند زد:\n«قدرت سکوت رو بلدی. بیشترِ کسایی که می‌گیریم بلد نیستن. برو. تو لیست نیستی. هنوز.»\nنه. یه اتفاقاً. یادت می‌مونه.",
            effects: [{ stat: "reputation", amount: 5 }, { stat: "intelligence", amount: 1 }],
            npc: [{ npcKey: "sargord_nemati", respect: 10, memory: "سکوت بلد است. علامت زدم — ستون نارنجی" }],
            historyText: "در برابر نعمتی سکوت کردی. قبولش کرد",
          },
        ],
      },
      {
        label: "😅 بخند و بگو «سرگرد، اشتباهی شده»",
        outcomes: [
          {
            weight: 4,
            text: "خندیدی. نعمتی با خنده جواب نداد. فقط گفت: «اگه بود، الان می‌دونستم.»\nرهای کردی. ولی چراغ قرمز بعدی، ماشینش پشت سرت بود. و بعدی. و بعدی.\nپیام روشنه: داره یادش می‌مونه.",
            effects: [{ stat: "crime", amount: -2 }, { stat: "chaos", amount: 1 }],
            npc: [{ npcKey: "sargord_nemati", fear: 5, memory: "از دستش خندید. علامت زدم — دوباره" }],
            historyText: "به نعمتی خندیدی. سوار نبود",
          },
          {
            weight: 3,
            text: "خندیدی. اشتباه بود. سوارت کرد کلانتری.\nدو ساعت پشت میز فلزی. آخرش یکی اومد گفت «برو. این بار.»\nاز کیف پولت 1000 سکه «هزینه‌ی پرونده» رفت.",
            effects: [
              { stat: "money", amount: -1000 },
              { stat: "crime", amount: -5 },
              { stat: "reputation", amount: -3 },
            ],
            historyText: "یه شب کلانتری بودی. هزینه‌ش سنگین نبود، سنگین‌کننده بود",
          },
        ],
      },
      {
        label: "🍫 کافه براش بخر",
        requires: { minMoney: 300 },
        outcomes: [
          {
            weight: 5,
            text: "رفتی یه قهوه‌ی دوغ prendable برای نعمتی خریدی.\nگرفتش. یه لحظه چشم‌هاش انسانی شد. گفت: «27 ساله یکی بهم قهوه نخریده.»\nاز فردا، یه بار که گیر افتادی، اسم نعمتی میاد تو ذهنیت. و اسم تو تو ذهنش.",
            effects: [
              { stat: "money", amount: -300 },
              { stat: "reputation", amount: 6 },
              { stat: "crime", amount: -3 },
            ],
            npc: [{ npcKey: "sargord_nemati", trust: 15, affection: 8, memory: "قهوه خرید. اولین نفر بعد 27 سال" }],
            historyText: "برای نعمتی قهوه خریدی",
          },
        ],
      },
    ],
  },
  {
    key: "fortune_teller",
    title: "فالگیر پشت بازار",
    emoji: "🔮",
    category: "mystery",
    rarity: "uncommon",
    weight: 5,
    text: "پشت بازار، یه میز کوچیک با رومالی بنفش.\n\nپشتش زنی با عینک آفتابی — تو سایه.\n\n«بشین. فال رایگانه. تعبیرش نه.»\nکارت‌ها رو می‌کشه. یکی‌شون رو به تو نشان می‌ده:\nیه برج. برجی که در این شهر نیست. هنوز.",
    choices: [
      {
        label: "🃏 بپرس «یعنی چی؟»",
        outcomes: [
          {
            weight: 3,
            text: "گفت: «یعنی چیزی که دنبالشی هنوز ساخته نشده. پس هرچی پیدا می‌کنی، اون نیست.»\nسردرد گرفتی. دستت رومال رو لمس کرد. یه چیزی زیرش بود:\nیه کارت لعنتی. فالگیر غیب شده بود. میز و رومال موندن.",
            effects: [{ stat: "intelligence", amount: 2 }, { stat: "money", amount: -200 }],
            grantItem: { itemKey: "cursed_card" },
            historyText: "فالگیر یه کارت لعنتی جا گذاشت و غیب شد",
          },
          {
            weight: 3,
            text: "گفت: «یعنی آینده‌ت تو یه جای دیگه‌ست. ولی مواظب باش: آینده هم جا می‌زنه. مثل همه.»\n500 سکه داد که «برای بلیت». کجا رو نمی‌گه. ولی از اون روز، شانست واقعاً بالاتر اومد.",
            effects: [
              { stat: "money", amount: 500 },
              { stat: "luck", amount: 3 },
            ],
            historyText: "فالگیر پول داد و گفت شانست برمی‌گرده",
          },
        ],
      },
      {
        label: "🚶 لا اقل، کاری به کارت نداشته باش",
        outcomes: [
          {
            weight: 1,
            text: "رد شدی. از فالگیرها نباید بترسی. باید از اونایی بترسی که فال می‌گیرند و عینک آفتابی دارن.\nهمون شب خواب دیدی رومال بنفش رو بسته بودن. تو هم بستی.",
            effects: [{ stat: "chaos", amount: 2 }],
            historyText: "از فالگیر رد شدی. فال از تو رد نشد",
          },
        ],
      },
    ],
  },
  {
    key: "singing_drain",
    title: "صدای کانال",
    emoji: "🎵",
    category: "absurd",
    rarity: "uncommon",
    weight: 5,
    text: "کنار خیابون، سرِ کانالِ فاضلاب بازه.\n\nاز داخلش، صدای خوانندگی میاد.\nخوب می‌خونه. یه ترانه‌ی قدیمی درباره‌ی «شهر که خواب شد».\n\nچاه آواز می‌خونه. تو این شهر، این خبر نیست. خبر اینه که بقیه هم صداش رو می‌شنون و انگار عادیه.",
    choices: [
      {
        label: "🎤 همراهی کن",
        outcomes: [
          {
            weight: 4,
            text: "همخوان کردی. از چاه، یه صدای دوم جواب داد. بعد سومی. بعد یه گروه کر کامل از زیر شهر.\nربع ساعت ترانه خوندید. عابرها فیلم گرفتن. یه ویدیو وایرال شد: «آدم و فاضلاب، دوئت در خیابان».\nشهرت اومد. شهرِ زیرین هم ازت راضیه.",
            effects: [
              { stat: "fame", amount: 8 },
              { stat: "chaos", amount: 3 },
              { stat: "money", amount: 300 },
            ],
            grantTitle: "همخوانِ فاضلاب",
            historyText: "با کانال فاضلاب دوئت خوندی. وایرال شد",
            worldFeed: "دوئت آدم و چاه وایرال شد",
          },
        ],
      },
      {
        label: "🪙 سکه انداخته گوش کن",
        outcomes: [
          {
            weight: 3,
            text: "سکه انداختی تو چاه. آواز قطع شد.\nصدایی گفت: «این خدمات پولی نیست. اشتباه از ما بود که خوش صدا بودیم.»\nسکه‌ت رو پس دادند. پرتاب بود از عمق. تو گرفتیش. چاپ موند.",
            effects: [{ stat: "money", amount: 100 }, { stat: "chaos", amount: 4 }],
            historyText: "به چاه آوازه‌خوان سکه دادی. پسش داد",
          },
        ],
      },
    ],
  },
  {
    key: "lost_kitten",
    title: "گربه روی درخت",
    emoji: "🐈",
    category: "wholesome",
    rarity: "common",
    weight: 6,
    districts: ["park", "old_town", "suburbs"],
    text: "یه بچه‌گربه بالای درخت گیر کرده.\n\nیه جمعیت کوچیک زیرش ایستاده‌اند و آره می‌کنند. یکی ازش فیلم می‌گیره. گربه دلتنگ.\n\nنگاه می‌کنی بالا. گربه نگاه می‌کنه پایین. فقط تو رو.",
    choices: [
      {
        label: "🧗 بالا برو",
        outcomes: [
          {
            weight: 5,
            text: "بالا رفتی. گربه اومد تو بغلت. پایین اومدی، جمعیت کف زد، یکی گریه‌ش گرفت.\nگربه رفت. بعد از یه ساعت برگشت، با دو تا بچه‌گربه دیگه. مشکل حل نشد. بزرگ‌تر شد.",
            effects: [
              { stat: "energy", amount: -10 },
              { stat: "reputation", amount: 10 },
              { stat: "fame", amount: 3 },
            ],
            grantAchievement: "tree_climber",
            historyText: "بچه‌گربه رو از درخت پایین آوردی",
          },
          {
            weight: 2,
            text: "بالا رفتی. شاخه شکست. افتادی روی... چیزی نرم. جمعیت نفهمید چی بود.\nگربه خودش پایین پرید و رفت. تو با کمرِ درد و یه داستان خوب برگشتی.",
            effects: [
              { stat: "health", amount: -15 },
              { stat: "fame", amount: 5 },
              { stat: "reputation", amount: 5 },
            ],
            historyText: "برای بچه‌گربه از درخت افتادی. روی چیزی نرم",
          },
        ],
      },
      {
        label: "🍖 با غذا بکشش پایین",
        requires: { hasItem: "pet_food" },
        outcomes: [
          {
            weight: 6,
            text: "غذا رو گذاشتی پایین درخت و کمی دور شدی.\nگربه اومد پایین. غذا رو خورد. بعد دنبالت اومد. انگار کل ماجرا تست بود.\nقبول شدی.",
            grantPet: { speciesKey: "street_cat", suggestedName: "دوده" },
            effects: [{ stat: "luck", amount: 1 }],
            historyText: "بچه‌گربه رو با غذا پایین کشوندی و مونده",
          },
        ],
      },
      {
        label: "📱 زنگ بزن آتش‌نشانی",
        outcomes: [
          {
            weight: 1,
            text: "آتش‌نشانی اومد. با نردبان. گربه رو گرفت.\nیکی از آتش‌نشون‌ها گفت: «این گربه رو این هفته سه بار از همین درخت گرفتیم. خودش می‌ره بالا. توجه می‌خواد.\"\nحالا می‌دونی: گربه‌ها بازیگرن. شهر هم همینطور.",
            effects: [{ stat: "intelligence", amount: 2 }],
            historyText: "آتش‌نشانی اومد. فهمیدی گربه بازیگره",
          },
        ],
      },
    ],
  },
  {
    key: "market_crash",
    title: "ریزش بازار",
    emoji: "📉",
    category: "story",
    rarity: "uncommon",
    weight: 5,
    districts: ["bazaar"],
    text: "امروز بازار بوی ترس می‌ده.\n\nیه خبر واگذار شده — هیچ‌کس منبعش رو نمی‌دونه — و قیمت‌ها دارن میریزن.\n\nآرش دونه‌ی وسط بازار با دست‌های تو جیب نگاه می‌کنه. چیزی می‌دونه که بقیه نمی‌دونن. همیشه همینطوره.",
    choices: [
      {
        label: "📉 اجناس بخر (خرید در کف)",
        requires: { minMoney: 1000 },
        outcomes: [
          {
            weight: 5,
            text: "وقتی همه می‌فروختند، تو خریدی. چیزهای خوب، ارزون.\nفردا خبر تکذیب شد و قیمت‌ها برگشت. خریدِ تو حالا دو برابر می‌ارزه.\nآرش از راه دور نگاهت کرد و — انگار — احترام گذاشت.",
            effects: [
              { stat: "money", amount: 2500 },
              { stat: "reputation", amount: 5 },
            ],
            grantItem: { itemKey: "phone" },
            historyText: "وقتی بازار ریخت خریدی. درست بود",
              worldFeed: "بازار ریخت. یکی خرید کرد. یکی‌ها فروختند",
          },
          {
            weight: 3,
            text: "خریدی. خبر تکذیب نشد. تقویت شد.\nچیزهایی که خریدی الان نصف می‌ارزن. ولی از آرش یاد گرفتی: خبرِ بد، خبرِ نیمه‌کاره‌ست.\nیادگیری هم ارزش داره.",
            effects: [
              { stat: "money", amount: -800 },
              { stat: "intelligence", amount: 3 },
            ],
            historyText: "خرید در کفِ کف. درس ارزشمند",
          },
        ],
      },
      {
        label: "🗣 برو پیش آرش بپرس چیه خبر",
        outcomes: [
          {
            weight: 4,
            text: "آرش نگاهت کرد. گفت: «چه ربطی به تو داره؟»\nسکوت. بعد: «چای بخور.»\nنوشیدی. بعد یه چیز بهت گفت که فردا کل بازار رو تغییر داد. دوتا کلمه. درست بود.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "luck", amount: 1 },
            ],
            npc: [{ npcKey: "arash", trust: 10, respect: 5, memory: "وقتی همه فرار کردند، او آمد پرسید. شجاع یا بی‌احتیاط؟" }],
            historyText: "چای آرش رو نوشیدی و یه تیک دو کلمه‌ای گرفتی",
          },
          {
            weight: 2,
            text: "آرش گفت: «معلومه، دارن کسی رو تست می‌کنن.»\n«کی رو؟»\n«تو رو، داداش. تو رو.»\nبرگشتی. مطمئن نبودی شوخی کرد یا نه. آرش شوخی نمی‌کنه. آرش «آزمایش» می‌کنه.",
            effects: [{ stat: "chaos", amount: 3 }],
            historyText: "آرش گفت «داره تو رو تست می‌کنن». معلوم نشد چه‌کسی",
          },
        ],
      },
    ],
  },
  {
    key: "power_outage",
    title: "قطعی برق",
    emoji: "🔌",
    category: "dark",
    rarity: "common",
    weight: 6,
    text: "برق کل محله رفت.\n\nتاریکی اینجا تاریکیِ معمولی نیست. چیزهایی که روز جلوت نبودند، الان هستن. صداها تنظیم می‌شن.\n\nیه چراغ‌قوه دستی کسی از پنجره‌ش چشمک می‌زنه. سه بار کوتاه، یه بار بلند. رمزه؟",
    choices: [
      {
        label: "🔦 برو با چراغ ببین چی هست",
        requires: { hasItem: "flashlight" },
        outcomes: [
          {
            weight: 4,
            text: "چراغ رو بردی سمت چشمک. یه پنجره، یه آدم، یه دست که اشاره می‌کرد: «بیا.»\nرفتی نزدیک‌تر. هیچ‌کس نبود. ولی یه جعبه پشت پنجره بود.\nجعبه رو گرفتی. توش: چیزهایی که مهم نیست چی بودن. مهم اینه که کسی جا گذاشته بود. برای کسی. شاید تو.",
            effects: [
              { stat: "energy", amount: -8 },
              { stat: "chaos", amount: 3 },
              { stat: "luck", amount: 2 },
            ],
            grantItem: { itemKey: "plush_bunny" },
            historyText: "در قطعی برق یه جعبه پیدا کردی",
          },
          {
            weight: 2,
            text: "چراغ رو بردی بالا. جوابی که اومد، رمز نبود.\nچراغِ اون طرف یه لحظه قطع شد. بعد آمد. قطع. آمد.\nبه ریتم قلبت. دقیقاً به ریتم قلبت.\nبرگشتی خونه. چراغ رو دیگه روشن نکردی.",
            effects: [{ stat: "chaos", amount: 6 }, { stat: "health", amount: -5 }],
            historyText: "چراغ اون طرف به ریتم قلبت چشمک زد",
          },
        ],
      },
      {
        label: "🕯 شمع روشن کن تو خونه",
        outcomes: [
          {
            weight: 5,
            text: "شمع روشنی کردی. سایه‌هات بزرگ شدن. یکی‌شون دیر آمد.\nهمیشه یه سایه دیر میاد. امشب هم اومد.\nیه شبدر چهاربرگ زیر در بود. صبح برق اومد. سایه‌ها معمولی شدند. تقریباً.",
            effects: [{ stat: "health", amount: 5 }, { stat: "luck", amount: 1 }],
            grantItem: { itemKey: "lucky_charm" },
            historyText: "شب قطعی رو با شمع و یه سایه‌ی دیرهنگام گذروندی",
          },
        ],
      },
    ],
  },
  {
    key: "fashion_emergency",
    title: "بحران مد",
    emoji: "👗",
    category: "funny",
    rarity: "common",
    weight: 6,
    districts: ["luxury", "center", "bazaar"],
    text: "یه زن با کتِ غلط‌جور و عینک آفتابیِ شبانه جلوت ترمز زد:\n\n«ببخشید. عجله دارم. گالا افتتاحیه‌ست. مدلِ من نیومده. تو دقیقاً سایزِ سرنوشتی. این ربان رو بزن، این عینک رو، بایست اون‌جا و به هیچ‌کس جواب نده. پنج دقیقه. 5000 سکه.»",
    choices: [
      {
        label: "🎭 قبول کن، مدل شو",
        outcomes: [
          {
            weight: 5,
            text: "پنج دقیقه شد چهل دقیقه. بی‌حرف موندی. عکس‌ها گرفتن.\nفردا تو مجله‌ی محلی: «استایلیسم مرموزِ گالای فصل.»\nچهره‌ات معلوم نیست. ربان و عینکت معلومه. شهرت اومد.",
            effects: [
              { stat: "money", amount: 5000 },
              { stat: "fame", amount: 6 },
              { stat: "energy", amount: -10 },
            ],
            grantTitle: "استایلیسم مرموز",
            historyText: "یه شب مدل گالا بودی. صورت نداری، شهرت داری",
          },
          {
            weight: 2,
            text: "وسط گالا، یه زن دیگه اومد و گفت: «مدلِ من اینه!» و ربان تو رو درآورد.\nهر دو رفتند دعوا. تو وسط گالا با یه ربانِ درآورده موندی.\n5000 سکه رو قبلش گرفتی. زود رفتی.",
            effects: [
              { stat: "money", amount: 5000 },
              { stat: "chaos", amount: 3 },
            ],
            historyText: "وسط گالا مدلِ رقیب شدی",
          },
        ],
      },
      {
        label: "🙅 «من مدل نیستم، من آدمم»",
        outcomes: [
          {
            weight: 1,
            text: "گفتی نه. زن با یه نگاه — نگاهی که 3000 ساله — گفت: «حیفه.»\nرفت.\nکل راه برگشت به این فکر کردی که حیفه. حیفه بود؟ ملاک‌های حیفی‌بودن رو کی نوشته؟\nیه ربان خریدی برای خودت. مال خودت.",
            effects: [
              { stat: "money", amount: -140 },
              { stat: "fame", amount: 1 },
            ],
            grantItem: { itemKey: "ribbon" },
            historyText: "به گالا نه گفتی و یه ربان مالِ خودت خریدی",
          },
        ],
      },
    ],
  },
  {
    key: "debt_collector",
    title: "وصول",
    emoji: "💼",
    category: "dark",
    rarity: "uncommon",
    weight: 7,
    conditions: { minDebt: 2000 },
    text: "دایی فرهاد پشت در خونه‌اتست.\n\nبوی آفتاب‌کرم می‌ده. لبخند می‌زنه. آستین‌هاش مرتب چین خورده.\n\n«سلام. بدهیت رو که می‌دونی. امروز اومدم فقط یادآوری کنم. آروم. بعدی میام با بقیه‌مون.»\n«بقیه‌مون» یعنی چی؟",
    choices: [
      {
        label: "💰 قسط بده",
        requires: { minMoney: 1000 },
        outcomes: [
          {
            weight: 1,
            text: "1000 سکه دادی. فرهاد شمرد — با همان لبخند — و گفت: «آدمِ حساب. خوشحالم بذارم باهات کار کنم. یه روز.»\nاون «یه روز» مثل یه سنگ تو جیب ذخیره‌ست.",
            effects: [
              { stat: "money", amount: -1000 },
              { stat: "debt", amount: -1500 },
            ],
            npc: [{ npcKey: "daii_farhad", trust: 10, respect: 5, memory: "قسط داد. به موقع. آدمِ حساب" }],
            historyText: "به دایی فرهاد قسط دادی. بدهی سبک‌تر شد",
          },
        ],
      },
      {
        label: "🙈 «هفته‌ی بعد میارم» بگو",
        outcomes: [
          {
            weight: 4,
            text: "فرهاد سر تکان داد. «حتماً.»\nرفت. از پشت پنجره دیدی سه تا نفر دیگه بهش ملحق شدند. یکی‌شون به خونه‌ات نگاه کرد.\nهفته‌ی بعد واقعاً باید بیاری.",
            effects: [{ stat: "debt", amount: 400 }, { stat: "chaos", amount: 2 }],
            historyText: "فرهاد رو به هفته‌ی بعد انداختی. بدهی سنگین‌تر شد",
          },
          {
            weight: 2,
            text: "فرهاد نگاهت کرد. لبخندش رفت. یه بار تو کل عمرش.\n«آقای ما. پول من نیست. پولِ کساییه که تو نمی‌خوای بشناسی.»\nبرگشت. تو فهمیدی بدهی فقط پول نیست. یه دعوته.",
            effects: [{ stat: "debt", amount: 800 }, { stat: "chaos", amount: 2 }],
            historyText: "فرهاد لبخندش رو برداشت. فهمیدی بدهی یه دعوته",
          },
        ],
      },
    ],
  },
  {
    key: "shop_that_wasnt",
    title: "مغازه‌ای که نبود",
    emoji: "🏪",
    category: "mystery",
    rarity: "rare",
    weight: 3,
    districts: ["old_town", "center", "bazaar"],
    text: "یه مغازه بین دو تا مغازه‌ی دیگه قایم شده بود. دیشب نبود.\n\nتابلوش خالیه. داخلش تاریک نیست — «بی‌نور»ـه. یه جور دیگه.\n\nدرش بازه. یه صدایی از داخل می‌گه:\n«اومدی. خوبه. امروخت نیست. فردا هم نیست. ولی یه روزِ — به‌خصوصی — هست.»",
    choices: [
      {
        label: "🚪 وارد شو",
        outcomes: [
          {
            weight: 3,
            text: "داخل قفسه‌های خالی بود. فقط یه قفسه پر: با یه نظرقربونی.\nصدایی که حالا از همه‌جا می‌ومد: «پرداخت. یه قول. مضمون نیست. ولی ثبت میشه.»\nبرداشتی و گفتی: «قول.»\nبیرون اومدی. مغازه نبود. بین دو تا مغازه، یه دیوار. قول ثبت شده.",
            grantItem: { itemKey: "nazar" },
            effects: [
              { stat: "luck", amount: 4 },
              { stat: "chaos", amount: 5 },
            ],
            setFlag: "made_a_promise",
            historyText: "از مغازه‌ای که نبود، یه نظرقربونی با یه قول گرفتی",
            worldFeed: "مغازه‌ای که دیروز نبود، امروز هم نبود. یکی قول داد",
          },
          {
            weight: 2,
            text: "داخل، همه‌چیز برعکس بود. کف سقف بود. پله‌ها از پایین شروع می‌شدند.\nیه ساعت که عقربه‌هاش همشون رو یه عدد بودن.\nسرگیجه گرفتی. صدایی گفت: «امروزت نیست. گفتم که.»\nبیرون پرتاب شدی. 3000 سکه تو جیبت بود که مال تو نبود. بود؟ الان هست.",
            effects: [
              { stat: "money", amount: 3000 },
              { stat: "chaos", amount: 8 },
              { stat: "health", amount: -10 },
            ],
            historyText: "مغازه‌ای که نبود بهت پول داد. عجیبه",
          },
        ],
      },
      {
        label: "📍 آدرسش رو ثبت کن",
        requires: { stats: { intelligence: 14 } },
        outcomes: [
          {
            weight: 1,
            text: "به‌جای ورود، گوشه‌ی مغازه‌ی کناری رفتی و از داخلِ قهوه‌خانه‌ی روبه‌رو زنگ زدی به رقیه.\nرقیه سه ثانیه جواب داد: «اون مغازه رو می‌شناسم. تا حالا فقط 7 نفر گزارشش کردن. 6 تاشون تو شکایت‌ها مشترکِ کلمه‌ای دارن: «فردا». تو هفتمی. هنوز وقته.»\nدیشب هیچ‌کس نبود. فردا هم هیچ‌کس نیست. ولی تو مپِ خودت علامت زدی. علامت‌زنی یه قدرته.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "reputation", amount: 5 },
            ],
            npc: [{ npcKey: "roghayeh", trust: 20, respect: 10, memory: "فروشگاه هیچ‌کجا را گزارش کرد. هفتمین نفر. دقیق است" }],
            grantTitle: "نقشه‌کشِ هیچ‌کجا",
            historyText: "مغازه‌ی هیچ‌کجا رو به رقیه گزارش دادی",
          },
        ],
      },
    ],
  },
  {
    key: "red_moon_stroll",
    title: "قدم‌زنی زیر ماه قرمز",
    emoji: "🌕",
    category: "legendary",
    rarity: "epic",
    weight: 4,
    conditions: { weathers: ["red_moon"] },
    text: "امشب ماه قرمزه.\n\nشهر عوض شده. نه ترسناک‌تر — «صادق‌تر». چیزها اون چیزی هستن که همیشه بودن.\n\nخیابون خالیه. فقط تو هستی، ماه، و یه صدای پای‌قدم که باهات هم‌قدمه.\nپشت سرت رو نگاه نکن. برعکسش رو تو خیابون‌های دیگه دیدی. امشب همه دارند راه می‌رن و رو به عقب نگاه نمی‌کنن. یه معامله‌ی شبانه.",
    choices: [
      {
        label: "🚶 تا آخر خیابون برو و برگرد",
        outcomes: [
          {
            weight: 4,
            text: "رفتی. برگشتی. صدای پا هم رفت و برگشت.\nخونه که رسیدی، رفتی برگشتی. فقط یه بار. انگار می‌خواست مطمئن شه تو مطمئنی.\nیه گل شب‌تاب روی پنجره‌ات بود. صبح هم ماند.",
            grantItem: { itemKey: "blue_flower" },
            effects: [
              { stat: "luck", amount: 3 },
              { stat: "chaos", amount: 5 },
            ],
            historyText: "زیر ماه قرمز راه رفتی. چیزی باهات اومد",
          },
          {
            weight: 2,
            text: "وسط راه، شهر یه لحظه نفسش رو نگه داشت. مکث. بعد ادامه.\nتو هم ادامه دادی. ولی از اون شب، حواست به صدای پاهاست. همیشه یکی اضافه‌ست. تا حالا مشکل درست نکرده. «تا حالا» در این شهر یه واحد زمانیه.",
            effects: [{ stat: "chaos", amount: 8 }, { stat: "intelligence", amount: 2 }],
            setFlag: "extra_footsteps",
            historyText: "زیر ماه قرمز فهمیدی یکی همیشه اضافه راه می‌ره",
          },
        ],
      },
      {
        label: "🌕 به ماه نگاه کن. فقط نگاه.",
        outcomes: [
          {
            weight: 1,
            text: "نگاه کردی. ماه نگاه کرد.\nیه جمله تو ذهنت form شد که تو زبان فارسی نبود و مال تو بود و از پشتِ چشم‌هات اومد:\n«همه‌چیز که نباشه، شهر می‌مونه. شهر که نباشه، همه‌چیز.»\nیادت مونه. همیشه. مثل یه خالکوبی ذهنی.",
            effects: [
              { stat: "intelligence", amount: 5 },
              { stat: "chaos", amount: 3 },
            ],
            grantTitle: "دیده‌ی ماه",
            historyText: "به ماه قرمز نگاه کردی و ماه جواب داد",
          },
        ],
      },
    ],
  },
  {
    key: "duck_procession",
    title: "رژه‌ی اردک‌ها",
    emoji: "🦆",
    category: "legendary",
    rarity: "legendary",
    weight: 2,
    districts: ["park"],
    conditions: { minWorldChaos: 25 },
    text: "پارک. ساعت دقیقاً 4:45 بعدازظهر.\n\nاز دریاچه، یه ردیف اردک بیرون اومد. نه، ردیف نیست — «صف»ـه. منظم.\n\nجلو صف، یه اردک با یه کلاه کوچیک.\nمردم ایستادن. کسی چیزی نمی‌گه. موبایل‌ها بالا نمی‌رن. همه فقط نگاه می‌کنن.\nاردک‌ها از جلوت رد می‌شن. اردکِ کلاه‌دار می‌ایسته. نگاهت می‌کنه.",
    choices: [
      {
        label: "🫡 احترام بذار",
        outcomes: [
          {
            weight: 1,
            text: "سر خم کردی. اردکِ کلاه‌دار سر خم کرد.\nصف رد شد. همه برگشتن دریاچه. فقط اردکِ کلاه‌دار موند. یه لحظه. بعد چیزی رو زمین گذاشت و رفت.\nیه جام قهرمانی محلی. کوچیک. قدیمی. قهرمانِ چی؟\nشهر می‌دونه. تو هم الان جزو شهرِ که می‌دونه.",
            grantItem: { itemKey: "trophy" },
            effects: [
              { stat: "fame", amount: 10 },
              { stat: "luck", amount: 3 },
              { stat: "chaos", amount: 5 },
            ],
            grantTitle: "محترم‌شده‌ی اردک‌ها",
            grantAchievement: "duck_procession",
            historyText: "به رژه‌ی اردک‌ها احترام گذاشتی. جام گرفتی",
            worldFeed: "رژه برگزار شد. یکی احترام گذاشت. قوانین کار می‌کنند",
          },
        ],
      },
      {
        label: "📱 فیلم بگیر",
        outcomes: [
          {
            weight: 1,
            text: "موبایل رو بردی بالا. صفحه سیاه شد. روشن شد. سیاه.\nاردک‌ها ایستاده بودن. همه‌شون. به تو نگاه می‌کردن.\nموبایل رو زمین انداختی — خودش افتاد — و رفتی عقب.\nصف ادامه پیدا کرد. تو جزو «آن‌ها که فیلم نگرفتند» شدی. تو این شهر، اینا زودتر می‌فهمن چی داره اتفاق می‌افته.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "chaos", amount: 4 },
            ],
            setFlag: "duck_witness",
            historyText: "از رژه فیلم گرفتی. موبایلت فیلم نگرفت",
          },
        ],
      },
    ],
  },
  {
    key: "empty_bench",
    title: "نیمکت خالی",
    emoji: "🪑",
    category: "mystery",
    rarity: "rare",
    weight: 3,
    districts: ["park"],
    text: "پارک یه نیمکت داره که همیشه خالیه.\n\nنه که کسی نشینه و بعد بره. کلاً هیچ‌کس روش نمی‌شینه. انگار مالِ یکی هست که «می‌آد».\n\nامروز روی نیمکت یه چیزیه: یه کتاب باز، برگ‌خورده. عنوانش: «شهرهایی که صبر کردند».\nصفحه‌ی 41 علامت خورده.",
    choices: [
      {
        label: "📖 صفحه‌ی 41 رو بخون",
        outcomes: [
          {
            weight: 3,
            text: "خوندی. یه جمله بود که زیرش خط کشیده بودن:\n«مردم شهر صبر کردند تا چیزی اتفاق بیفتد. اتفاق افتاد. صبر کردند تا دوباره اتفاق بیفتد. این‌بار خودشان بودند که اتفاق افتادند.»\nکتاب رو بستی. عنوانش عوض شده بود: «شهرهایی که اتفاق افتادند.» تو می‌دونی چه خبره. شهر نیمکت رو براش گذاشته بود.",
            effects: [
              { stat: "intelligence", amount: 4 },
              { stat: "reputation", amount: 5 },
            ],
            grantTitle: "خواننده‌ی صفحه‌ی 41",
            historyText: "صفحه‌ی 41 رو خوندی. کتاب عنوانش رو عوض کرد",
          },
          {
            weight: 2,
            text: "خوندی. صفحه‌ی 41 خالی بود. تمامش. فقط یه علامت.\nرفتی صفحه‌ی 42. اونم خالی. کل کتاب خالی بود.\nبه جز یه صفحه — آخرین — که نوشته بود: «برگرد 41.»\nرفتی. علامت جابه‌جا شده بود. قبلاً اینجا نبود. شانس اومدی دوباره. کلاً 4 بار میاد. تو 2 بار مصرف کردی.",
            effects: [
              { stat: "luck", amount: 4 },
              { stat: "chaos", amount: 4 },
            ],
            historyText: "کتاب خالی بود. به جز «برگرد 41». علامت جابه‌جا شد",
          },
        ],
      },
      {
        label: "🪑 روی نیمکت بشین",
        outcomes: [
          {
            weight: 2,
            text: "نشستی. هوا آروم شد. یه دفعه «درست» شد. مثل اینکه یه تصویر مستقیم شد.\nیه ساعت نشستی. هیچ‌کس نیامد. هیچ اتفاقی نیفتاد. کامل نبود.\nبرفتی، یه حلزون روی شانه‌ات بود. کوچیک. سنگین. «سنگین» به معنای واقعی.\nحلزونِ خلأ. یکی از نادرترین چیزای این شهر. و حالا مالِ توئه.",
            grantPet: { speciesKey: "void_snail", suggestedName: "خلأ" },
            effects: [
              { stat: "chaos", amount: 6 },
              { stat: "luck", amount: 2 },
            ],
            grantAchievement: "bench_sitter",
            historyText: "روی نیمکتِ همیشه‌خالی نشستی. یه حلزونِ خلأ اومد",
            worldFeed: "نیمکتِ خالی امروز یکی رو پذیرفت",
          },
          {
            weight: 3,
            text: "نشستی. یه نفر اومد. پیرمردی با یه قوطی.\n«تو چرا اینجا نشستی؟» — «چرا هیچ‌کس نمی‌شینه؟» — «چون مال منه. 40 ساله هر روز میام. امروز دیر کردم. تو جا من نشستی.»\nیه ساعت با هم نشستیم. هیچ‌کی حرف نزد. رفت. یه «مرسی» گفت. سنگین‌ترین مرسی زندگیتم بود.",
            effects: [
              { stat: "reputation", amount: 8 },
              { stat: "luck", amount: 1 },
            ],
            historyText: "جا پیرمردِ نیمکت نشستی. مرسی‌ش سنگین بود",
          },
        ],
      },
    ],
  },
  {
    key: "roghayeh_job",
    title: "پیام از شماره‌ی ناشناس",
    emoji: "💻",
    category: "story",
    rarity: "uncommon",
    weight: 4,
    conditions: { minLevel: 3 },
    text: "موبایلتی زنگ خورد. شماره: «—».\n\nمتن پیام:\n«سلام. رقیه‌ام. اهل خیر نیستم، اهل کارم. یه فایل هست که باید از یه جا به یه جای دیگه بره. فیزیکی. یه آدم لازمه که سؤال نپرسه. تو آدمِ سؤال‌نپرس‌ها هستی؟ 2000 سکه. امشب.»",
    choices: [
      {
        label: "✅ «می‌آم.»",
        outcomes: [
          {
            weight: 5,
            text: "امشب یه فایل رو از یه کمد به کمدِ دیگه منتقل کردی.\nهر دو کمد تو دو تا خونه‌ی متفاوت بودن. هیچ‌کس تو خونه‌ها نبود.\nفایل رو باز نکردی. پول رو گرفتی. رقیه پیام داد: «درست. سه‌تا کارِ دیگه هم دارم. بعداً.»\n«بعداً» تو کارنامه‌ی رقیه یعنی «قراردادِ باز».",
            effects: [
              { stat: "money", amount: 2000 },
              { stat: "crime", amount: 6 },
              { stat: "intelligence", amount: 2 },
            ],
            npc: [{ npcKey: "roghayeh", trust: 15, respect: 10, memory: "فایل را جابه‌جا کرد. سؤال نپرسید. لیست A" }],
            setFlag: "roghayeh_contractor",
            historyText: "برای رقیه یه فایل جابه‌جا کردی. سؤال نپرسی",
          },
          {
            weight: 2,
            text: "امشب برفتی. خونه‌ی مقصد، پلیس بود. یه لحظه تغییر مسیر دادی، فایل رو انداختی تو باغِ همسایه، رفتی.\nصبح: خبری که می‌گفت «پرونده‌ی بزرگِ قاچاق اطلاعات ناکام ماند».\nرقیه پیام داد فقط: «:)»\nیه شکلک. از رقیه. این نزدیک‌ترین چیز به «ممنونم زنده‌ای»ـه.",
            effects: [
              { stat: "money", amount: 1000 },
              { stat: "crime", amount: 3 },
              { stat: "chaos", amount: 3 },
            ],
            npc: [{ npcKey: "roghayeh", trust: 5, memory: "پلیس بود. جا نزد. زنده است. لیست B — احتیاط" }],
            historyText: "برای رقیه رفتی، پلیس بود، زنده برگشتی",
          },
        ],
      },
      {
        label: "❌ «آدمِ سؤال‌نپرس‌ها نیستم.»",
        outcomes: [
          {
            weight: 1,
            text: "پیام ندادی. رد شدی.\nسه روز بعد، یه بسته پشت در بود: یه چراغ‌قوه‌ی نو و یه کارت:\n«چراغ برای وقتی که جواب \"نه\" می‌گی. رقیه. آدم‌های نه، لیستِ خودشون رو دارن.»\nچراغ کار می‌کنه. همیشه. تو این شهر این خودش معجزه‌ست.",
            effects: [{ stat: "reputation", amount: 5 }, { stat: "intelligence", amount: 1 }],
            npc: [{ npcKey: "roghayeh", trust: 10, memory: "نه گفت. لیست N — قابل اعتماد اما نه همکار" }],
            historyText: "به پیشنهاد رقیه نه گفتی. یه چراغ گرفتی",
          },
        ],
      },
    ],
  },
  {
    key: "rain_gem",
    title: "بعد از بارون",
    emoji: "🌧",
    category: "wholesome",
    rarity: "common",
    weight: 5,
    conditions: { weathers: ["rain", "storm"] },
    text: "بارون تازه بند اومده. آسمون هنوز شرمنده‌ست.\n\nآب‌ها به سمت کانال‌ها می‌رن. گوشه‌ی خیابون، یه چیزی برق می‌زنه — و برق زدنش «موقته».\n\nیه سکه‌ی طلایی تو جاده. تازه. نم‌خورده. انگار همین الان از آسمون اومده.",
    choices: [
      {
        label: "🪙 بردارش",
        outcomes: [
          {
            weight: 5,
            text: "گرفتیش. سکه‌ی شانس بود — اون سکه‌ای که توی بازار افسانه‌ست.\nدورت نگاه کردی. هیچ‌کس نبود. بارون دوباره شروع کرد، انگار کارش تموم شده بود.",
            grantItem: { itemKey: "coin" },
            effects: [{ stat: "luck", amount: 3 }],
            historyText: "بعد بارون، سکه‌ی شانس پیدا کردی",
          },
          {
            weight: 2,
            text: "گرفتیش. سکه نبود. یه دکمه بود. طلاییِ طلایی. قدیمی.\nیه دکمه‌ی طلایی از یه لباسِ کسی. کسی که اینجا بود.\nبرق زدن بین سکه و دکمه، فقط با «دقت» فرق داره. تو دقت داری. این یادگاری مال توئه.",
            effects: [{ stat: "intelligence", amount: 2 }, { stat: "luck", amount: 1 }],
            grantItem: { itemKey: "phone" },
            historyText: "بعد بارون، یه دکمه‌ی طلایی پیدا کردی. مال کسی",
          },
        ],
      },
      {
        label: "💧 بذار باشه برای کسی که نیازش داره",
        outcomes: [
          {
            weight: 1,
            text: "رد شدی. دو کوچه بعد، یه بچه‌گربه با یه سکه‌ی طلایی بازی می‌کرد.\nکار درست رو کردی. هیچ‌کس ندید. هیچ‌کس نمی‌دیده.\nولی شب، خوابت عمیق‌تر از همیشه بود. یه جای این شهر، یه چیزی «عالی» گذاشت.",
            effects: [
              { stat: "luck", amount: 2 },
              { stat: "reputation", amount: 3 },
              { stat: "health", amount: 5 },
            ],
            grantAchievement: "quiet_kindness",
            historyText: "سکه‌ی بعدِ بارون رو نذاشتی برای خودت",
          },
        ],
      },
    ],
  },
  {
    key: "vintage_sale",
    title: "حراج خانه‌ی خالی",
    emoji: "🪑",
    category: "story",
    rarity: "common",
    weight: 5,
    districts: ["old_town", "suburbs"],
    text: "یه خونه دار تخلیه می‌کنن. وسایلش روی پیاده‌رو.\n\nمردی که می‌فروشه عجله داره. قیمت‌ها عجیبِ پایین. یه چیزی این وسط «واقعاً» ارزشمند هست و مالک نمی‌دونه.\n\nچشمک: یه گوشه‌ی رومال، یه چیزی برق می‌زنه.",
    choices: [
      {
        label: "🔍 دقیق بگرد",
        requires: { stats: { intelligence: 12 } },
        outcomes: [
          {
            weight: 4,
            text: "دقیق گشتی. زیر یه پتوی قدیمی، یه کاست بی‌برچسب بود.\nمرد گفت: «اوه اون؟ مال خونه نبود. خودش اومد بود. بردارش، از خودش می‌ترسم.»\nبرداشتی. تو این شهر، وقتی یه چیزی «خودش اومده باشه»، نگه‌داریش یه مسئولیته.",
            grantItem: { itemKey: "cassette" },
            effects: [{ stat: "money", amount: -200 }, { stat: "intelligence", amount: 2 }],
            historyText: "تو حراج خونه‌ی خالی، یه کاستِ خودامده پیدا کردی",
          },
          {
            weight: 3,
            text: "گشتی. یه عینک آفتابی پیدا کردی که قیمتش 4000 سکه بود — 400 فروختنت.\nمرد بعد از معامله گفت: «اینا مال عمه‌ی من بود. خوشحال میشه یکی مثل تو داشته باشه‌شون.»\nحس خوب. عینک هم خوب.",
            grantItem: { itemKey: "sunglasses" },
            effects: [{ stat: "money", amount: -400 }, { stat: "fame", amount: 4 }],
            historyText: "عینک عمه رو از حراج خریدی",
          },
        ],
      },
      {
        label: "🛒 یه چیزِ عادی بخر و برو",
        outcomes: [
          {
            weight: 1,
            text: "یه چراغ‌قوه‌ی شکسته خریدی 130 سکه. مرد گفت: «شکسته ولی کار می‌کنه.»\nکار نمی‌کنه. ولی شب، یکی‌شون — یه لحظه — روشن شد. تو لحظه‌ای که هیچ‌کس نبود.\nچراغ‌قوه‌ی شکسته تو این شهر یه ابزارِ اضطراریه برای آدم‌های خاص. تو یکی‌شون هستی. هنوز خبر نداری.",
            grantItem: { itemKey: "flashlight" },
            effects: [{ stat: "money", amount: -130 }],
            historyText: "یه چراغ‌قوه‌ی شکسته خریدی که گاهی کار می‌کنه",
          },
        ],
      },
    ],
  },
  {
    key: "butterfly_swarm",
    title: "دسته‌ی پروانه‌ها",
    emoji: "🦋",
    category: "absurd",
    rarity: "rare",
    weight: 4,
    districts: ["park", "suburbs"],
    text: "یه دسته‌پروانه از میان درخت‌ها اومدن.\n\nنه ده‌تا، نه صدتا. یه «دسته». مثل ماهی‌ها حرکت می‌کنن. مثل یه فکرِ مشترک.\n\nدورت گرفتنت. صدای بال‌هاشون شبیه زمزمه‌ست. یه کلمه‌ست. نمی‌تونی بشناسیش.",
    choices: [
      {
        label: "🤲 دستت رو دراز کن",
        outcomes: [
          {
            weight: 4,
            text: "یکی روی انگشتت نشست. بقیه ایستادند — هوا ایستاد.\nپروانه‌ی روی دستت یه لحظه سنگین شد. بعد پرواز کرد و همه رفتند.\nجایی که نشسته بود، هنوز سبزه. یه نقطه‌ی سبز روی پوستت که سال‌ها می‌مونه. علامتِ انتخاب‌شدن. توسط چیزی.",
            effects: [
              { stat: "luck", amount: 3 },
              { stat: "chaos", amount: 4 },
              { stat: "fame", amount: 2 },
            ],
            grantTitle: "دارنده‌ی نقطه‌ی سبز",
            historyText: "پروانه‌ها انتخابت کردن. نقطه‌ی سبز موندی",
            worldFeed: "دسته‌ی پروانه‌ها یکی رو انتخاب کرد",
          },
        ],
      },
      {
        label: "📸 عکس بگیر",
        outcomes: [
          {
            weight: 3,
            text: "عکس گرفتی. توی عکس، پروانه‌ها نشون‌شون نمی‌ده. فقط یه «تار» — مثل وقت‌هایی که چیزی سریع رد می‌شه.\nولی دورت، همه چی سبز شده بود. عکس سبز نیست.\nپروانه‌ها فقط برای دوربین مخفی‌ان. حالا داری یه مدرک که مدرک نیست. این‌ها در این شهر «مدارک واقعی» حساب می‌شن.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "chaos", amount: 2 },
            ],
            historyText: "از پروانه‌ها عکس گرفتی. عکس خالی بود — تقریباً",
          },
        ],
      },
    ],
  },
  {
    key: "free_samples",
    title: "نمونه‌ی رایگان",
    emoji: "🍬",
    category: "funny",
    rarity: "common",
    weight: 6,
    districts: ["bazaar", "center"],
    text: "یه غرفه‌ی جدید تو بازار. تابلوش:\n\n«نمونه رایگان. یک‌نفره. یک‌بار. غیرقابل انتخاب.»\n\nیه قوطی بزرگ با یه سوراخ. دستت رو می‌بری تو سوراخ. هر چی بیرون بکشی، مالِ توئه. نمی‌تونی ببینی چی هست. هیچ‌کس نمی‌تونه.",
    choices: [
      {
        label: "🤞 دستت رو ببر تو قوطی",
        outcomes: [
          {
            weight: 3,
            text: "دستت رو بردی. یه چیزی گرفتی: یه رامن داغ. تازه. گرم.\nصاحب غرفه لبخند زد: «مبارک. کم‌تر کسی غذا می‌کشه بیرون.»\nچیزی درباره‌ی این جمله درست نیست. ولی رامن خوبه.",
            grantItem: { itemKey: "ramen" },
            effects: [{ stat: "luck", amount: 1 }],
            historyText: "از قوطی جادویی رامن کشیدی بیرون",
          },
          {
            weight: 2,
            text: "دستت رو بردی. یه نظرقربونی!\nصاحب غرفه سرش رو تکان داد: «چشمِ کسی به تو خورده. این ضدشه.»\nپرسیدی: «کی بهم چشم زده؟» — «قانون اینه که نمی‌گیم.»",
            grantItem: { itemKey: "nazar" },
            effects: [{ stat: "luck", amount: 2 }],
            historyText: "از قوطی جادویی نظرقربونی کشیدی",
          },
          {
            weight: 2,
            text: "دستت رو بردی. یه کارتِ پلاستیکی ساده. روی‌ش نوشته: «دوباره.»\nصاحب غرفه: «اوه. اون. برگردونش بذار تو قوطی، لطفاً. اون مالِ خود قوطیه.»\nبرگشتی. قوطی صدای پس‌دادن داد. مثل «مرسی».",
            effects: [{ stat: "chaos", amount: 3 }, { stat: "money", amount: 500 }],
            historyText: "کارتی کشیدی بیرون که مالِ خود قوطی بود. پسش دادی. پول گرفتی",
          },
        ],
      },
      {
        label: "🚶 بی‌خیال، نمونه‌ی رایگان یعنی تله",
        outcomes: [
          {
            weight: 1,
            text: "رد شدی. سه قدم بعد، پشتم صدا اومد: «جوابش رو می‌خوای بدون که چی بود؟»\nنگرفتی. صدا گفت: «آدمِ محتاط. اون قوطی دو تا جواب بیشتر نداره: یا می‌خوری یا می‌خوری.»\nکل روز به این جمله فکر کردی. به هیچ نتیجه‌ای نرسیدی. هنوز فکر می‌کنی.",
            effects: [{ stat: "intelligence", amount: 2 }],
            historyText: "از قوطی رد شدی. جمله‌ش دنبالت اومد",
          },
        ],
      },
    ],
  },
  {
    key: "underground_radio",
    title: "رادیوی زیرزمین",
    emoji: "📻",
    category: "mystery",
    rarity: "rare",
    weight: 3,
    districts: ["industrial", "old_town"],
    text: "از یه پنجره‌ی شکسته‌ی منطقه‌ی صنعتی، صدای رادیو میاد.\n\nایستگاهی که تو هیچ لیستی نیست. یه صدای آرام داره می‌خونه:\n«...و برای شنونده‌ی پنجاهم — که الان داره از پنجره گوش می‌ده — سلام. بقیه‌ش رو از دست دادی. ولی این قسمت مالِ توئه: امشب، سه چیز تو این شهر جابه‌جا میشه. یکی‌شون طلاییه. یکی‌شون خطرناکه. یکی‌شون توئه.»",
    choices: [
      {
        label: "📻 تا آخر گوش بده",
        outcomes: [
          {
            weight: 4,
            text: "گوش دادی: «...طلایی‌ئه همونیه که بعدِ بارون پیدا میشه. خطرناکه همونیه که لبخند می‌زنه و دوتا کتف داره. و توئه — توئی که داری اینو می‌شنوی. تو که امشب از خونه بیرون نمیای، امن نیستی، امن‌ترینی.»\nبرگشتی خونه. از پنجره دیدی یکی با دو تا کتف — واقعاً دوتا جفت — داشخت لبخند می‌زد.\nرفتی تو. رادیو درست می‌گفت.",
            effects: [
              { stat: "intelligence", amount: 3 },
              { stat: "luck", amount: 2 },
              { stat: "chaos", amount: 2 },
            ],
            setFlag: "radio_listener",
            historyText: "رادیوی زیرزمین بهت گفت امشب امن‌ترینی. درست بود",
          },
        ],
      },
      {
        label: "🔎 گزارشش کن به رقیه",
        requires: { stats: { intelligence: 10 } },
        outcomes: [
          {
            weight: 1,
            text: "به رقیه زنگ زدی: «ایستگاهِ بی‌فرکانس، پنجره‌ی شکسته، شنونده‌ی پنجاهم.»\nسه ثانیه سکوت. بعد: «تو پنجمین کسی هستی که گزارشش می‌ده. چهار تای دیگه؟ الان تو لیستِ من هستن. تو هم هستی. فرق اینه: تو گزارش دادی، اونا گوش دادند. گوش‌دادن یه قرارداده. گزارش‌دادن یه درخواست.»\n«درخواست چی؟» — «ادامه بده. می‌فهمی.»",
            effects: [
              { stat: "intelligence", amount: 2 },
              { stat: "reputation", amount: 6 },
            ],
            npc: [{ npcKey: "roghayeh", trust: 25, respect: 10, memory: "رادیو را گزارش کرد. پنجمین. درخواست‌گر، نه قراردادی" }],
            grantTitle: "گزارشگرِ پنجم",
            historyText: "رادیوی زیرزمین رو به رقیه گزارش دادی. «درخواست» شدی",
          },
        ],
      },
    ],
  },
  {
    key: "kimo_tip",
    title: "کیمو یه چیزی می‌دونه",
    emoji: "🧢",
    category: "story",
    rarity: "common",
    weight: 5,
    districts: ["old_town", "bazaar"],
    text: "کیمو — بچه‌ی خیابون، 13 ساله، دانای کل — گوشه‌ی کوچه به دیوار چسبیده.\n\nدیدت، اومد نزدیک، آروم گفت:\n«یه چیزی می‌دمت که فردا صبح به دردت می‌خوره. 500 سکه. جوابش رو جایی نمی‌شنوی. گارانتیِ شخصی.»\nبسته‌ی زیر بازوش کمی تکان می‌خوره.",
    choices: [
      {
        label: "💸 پول بده",
        requires: { minMoney: 500 },
        outcomes: [
          {
            weight: 4,
            text: "پول دادی. کیمو یه تیکه کاغذ داد: «فردا صبح، کسی درت رو می‌زنه. مهم نیست کیه. فقط یادت باشه: چیزی که می‌خواد رو «از چپ» بگیر.»\nفردا صبح، پستچی اومد. بسته‌ای داد که از چپ گرفتیش. توش: یه گل لاله‌گیاه شب‌تاب. اگر از راست می‌گرفتی؟ نمی‌دونی. هیچ‌کس نمی‌دونه.",
            effects: [
              { stat: "money", amount: -500 },
              { stat: "luck", amount: 3 },
            ],
            grantItem: { itemKey: "blue_flower" },
            npc: [{ npcKey: "kimo", trust: 10, memory: "پول داد. مشتریِ خوب. لیستِ سبز" }],
            historyText: "از کیمو یه اطلاعات خریدی که جواب داد",
          },
          {
            weight: 2,
            text: "پول دادی. کیمو گفت: «امشب خونه بمون. هر چی شنیدی، نرو ببین.»\nموندی. نصفه‌شب صدای بطلی افتاد تو حیاط. صدای خنده‌ای بود. بعد سکوت.\nصبح رفتی ببینی: یه بطل شیشه‌ای، تمیز، درش باز، و یه تکّه ربان صورتی.\nکیمو جانِ آدمه. عجیبه ولی درست می‌گه.",
            effects: [
              { stat: "money", amount: -500 },
              { stat: "chaos", amount: 2 },
            ],
            grantItem: { itemKey: "ribbon" },
            npc: [{ npcKey: "kimo", trust: 15, memory: "گفتم بمونه. ماند. آدمِ حرف‌شنو — یا ترسو. وقتش می‌گم" }],
            historyText: "کیمو گفت خونه بمونی. ماندی. کارساز بود",
          },
        ],
      },
      {
        label: "🧢 بپرس «سوخت اصلی‌ت چیه؟»",
        outcomes: [
          {
            weight: 1,
            text: "کیمو خندید. «سؤالِ خوب. اکثراً می‌پرسن «از کجا می‌دونی؟» — تو پرسیدی «چرا؟»»\n«چون یه روزی یکی به من هم یه چیزی فروخت. حالا منم می‌فروشم. زنجیره همینجوری ادامه پیدا می‌کنه. تا به یکی برسه که دیگه نفروشه.»\n«اون کیه؟» — «هنوز نیومده. شاید تو باشی.»\nندادی. ولی کل روز به «زنجیره» فکر کردی.",
            effects: [{ stat: "intelligence", amount: 3 }],
            npc: [{ npcKey: "kimo", respect: 10, memory: "سؤالِ «چرا» پرسید. اولین نفر بعد از خودم" }],
            historyText: "از کیمو «چرا» پرسیدی. جوابش زنجیره بود",
          },
        ],
      },
    ],
  },
  {
    key: "mahoor_late_night",
    title: "کافه، بعد از بسته‌شدن",
    emoji: "☕",
    category: "wholesome",
    rarity: "uncommon",
    weight: 4,
    districts: ["center"],
    conditions: { moods: ["calm", "weird"] },
    text: "دیر وقت از جلوی کافه‌ی ماهور رد می‌شدی. تابلو خاموشه. ولی از داخل نور میاد.\n\nماهور پشت پیشخوان نیست. پشت «یک» میز نشسته — چیزهایی که پیشخوان‌ها دیدن و میزها نمی‌بینن.\n\nدیدت. دستش رو تکان داد. یعنی «بیا بشین».",
    choices: [
      {
        label: "☕ بشین",
        outcomes: [
          {
            weight: 5,
            text: "نشستی. ماهور بدون اینکه چیزی بپرسی، یه قهوه گذاشت جلووت.\nبعد گفت: «این شهر رو هر کسی یه بار «دیده». من 20 سال پیش دیدمش. از اون روز این کافه رو باز نگه می‌دارم. یه پنجره به شهر لازمه. بعضی وقتا پنجره باید چراغ روشن داشته باشه.»\nقهوه‌ت تا آخر موند. حرفا هم. شبِ خوبی بود.",
            effects: [
              { stat: "health", amount: 10 },
              { stat: "energy", amount: 10 },
              { stat: "luck", amount: 1 },
            ],
            npc: [{ npcKey: "mahoor", trust: 20, affection: 15, memory: "شبِ پای میز نشست. حالا یکی از «میزها»ست" }],
            grantAchievement: "mahoor_table",
            historyText: "بعد از بسته‌شدن کافه، پای میز ماهور نشستی",
          },
          {
            weight: 2,
            text: "نشستی. ماهور آروم گفت: «یه گربه سفید این هفته سه بار پشت پنجره‌ی تو رد شده. صبر نکن تا چهار بار.»\nگفتی: «چرا؟» — «چون بار چهارمش نمیاد. همیشه سه بار میاد. بعدش میره سراغ کسی دیگه. تو تا حالا مشتریِ خوبی بودی.»\nفردا صبح، گربه‌ی سفید رو دیدی که داشت از کوچه‌ت می‌رفت. سه بار برگشت. بعد رفت. ماهور درست می‌گفت. همیشه می‌گه.",
            effects: [
              { stat: "intelligence", amount: 2 },
              { stat: "luck", amount: 2 },
            ],
            npc: [{ npcKey: "mahoor", trust: 15, memory: "درباره گربه سفید گفتم. گوش داد. گوش‌دادنِ واقعی" }],
            historyText: "ماهور درباره‌ی گربه‌ی سفید هشدار داد. درست بود",
          },
        ],
      },
      {
        label: "🚶 مزاحم نشو، رد شو",
        outcomes: [
          {
            weight: 1,
            text: "رد شدی. از سرت رو برگردوندی — ماهور هنوز به همون نقطه‌ای نگاه می‌کرد که بودی.\nفردا کافه باز بود، همه‌چیز عادی. فقط قهوه‌ت کمی شیرین‌تر از همیشه بود.\nشاید یه حرف از دست رفته. شاید فقط شکر. تو این شهر فرقش زحمت داره.",
            effects: [{ stat: "reputation", amount: 2 }],
            historyText: "شبِ کافه رو رد شدی. قهوه‌ی فردا شیرین‌تر بود",
          },
        ],
      },
    ],
  },
  {
    key: "gang_offer",
    title: "پیشنهاد گروه",
    emoji: "🕴",
    category: "dark",
    rarity: "rare",
    weight: 3,
    conditions: { stats: { crime: 15 } },
    text: "یه ماشین سیاه کنار پیاده‌رو ترمز زد. شیشه پایین اومد.\n\nآقایی با کتِ خاکستری: «باید یه چیزی رو بپرسم و فقط با «بله» یا «نه» جواب بگیری. آماده‌ای؟»\nهوا یه دفعه سنگین شد. جاده خلوت شد — نه اینکه کسی رفت. «توقف» کردند.",
    choices: [
      {
        label: "✅ «بله»",
        outcomes: [
          {
            weight: 4,
            text: "گفتی «بله».\nآقا سر تکان داد. «خوبه. اولِ ماه یه بسته میاد دم خونه‌ت. توش هرچی هست رو می‌بری به همون جایی که می‌گیم. 8000 سکه در ماه. سؤال ممنوع.»\nماشین رفت. جاده دوباره راه افتاد. اولِ ماهه که. یه در باز میشه که شاید نتونی ببندی.",
            effects: [
              { stat: "money", amount: 8000 },
              { stat: "crime", amount: 15 },
              { stat: "chaos", amount: 5 },
            ],
            setFlag: "gang_courier",
            grantTitle: "پیکِ خاکستری",
            historyText: "به گروه خاکستری «بله» گفتی. پیک شدی",
            worldFeed: "یه ماشین خاکستری امروز یکی رو استخدام کرد",
          },
        ],
      },
      {
        label: "❌ «نه»",
        outcomes: [
          {
            weight: 4,
            text: "گفتی «نه».\nسکوت. آقا نگاهت کرد — نگاهی که وزن داشت. بعد: «آدمِ «نه»-گو. تو این شهر نادرن. نگه‌داشتنت بهتره.»\nماشین رفت.\nاز اون روز، هر وقت تو کوچه‌ی تاریکی هستی، یه چراغ از یه پنجره روشنه. همیشه یکی. این شهر «نه»-گوها رو روشن نگه می‌داره.",
            effects: [
              { stat: "crime", amount: -5 },
              { stat: "reputation", amount: 8 },
              { stat: "luck", amount: 2 },
            ],
            grantAchievement: "said_no",
            historyText: "به ماشین خاکستری «نه» گفتی. شهر چراغ روشن نگه داشت",
          },
        ],
      },
    ],
  },
  {
    key: "old_well",
    title: "چاهِ پارک",
    emoji: "🕳",
    category: "mystery",
    rarity: "uncommon",
    weight: 4,
    districts: ["park"],
    text: "پارک یه چاهِ قدیمی داره. بسته‌ست با یه درِ آهنی.\n\nامروز در نیمه‌بازه. از داخل، باد میاد بالا — بادِ خنک، تو تابستون.\n\nیه صدای آروم از پایین: «...کمک نمی‌خوام. فقط یکی باشه که می‌دونه من هستم. اون کافیه.»",
    choices: [
      {
        label: "🗣 «من می‌دونم هستی.»",
        outcomes: [
          {
            weight: 5,
            text: "گفتی. از پایین، سکوت. بعد یه صدایی که شبیه «مرسی» بود ولی نه.\nدر آهنی خودش بسته شد. محکم. قفل شد.\nیه لای کلیدِ کوچیک روش نقش بسته.\nبرفتی. فکر کردی. کلیدِ کوچیک، روی درِ بسته. برای چی؟\nبرگشتی. نبود. تو جیبت بود. همون لحظه که در بسته شد، بود. شانسته. بزرگه.",
            grantItem: { itemKey: "old_key" },
            effects: [
              { stat: "luck", amount: 3 },
              { stat: "intelligence", amount: 2 },
              { stat: "chaos", amount: 3 },
            ],
            grantAchievement: "witness_of_the_well",
            historyText: "به چاه گفتی «می‌دونم هستی». یه کلید گرفت",
          },
        ],
      },
      {
        label: "🕳 سنگی بنداز تو چاه",
        outcomes: [
          {
            weight: 3,
            text: "سنگ انداختی. صدای برخورد نیامد. هیچ صدایی نیامد.\nسنگ هنوز داره می‌افته. جایی، خیلی پایین، همون سنگ هنوز داره می‌افته.\nصدای آروم: «...این هم یه جور «می‌دونستی» بود. ممنون.»\nحالا هم سنگ داری که می‌افته، هم یه تشکر. تو این شهر حساب‌ها اینجوری بسته می‌شن.",
            effects: [{ stat: "chaos", amount: 5 }, { stat: "luck", amount: 1 }],
            historyText: "سنگی انداختی تو چاه که هنوز داره می‌افته",
          },
        ],
      },
    ],
  },
  {
    key: "hero_moment",
    title: "زیر چراغ قرمز",
    emoji: "🚦",
    category: "wholesome",
    rarity: "common",
    weight: 5,
    text: "سر چهارراه، یه پیرمرد وسط جاده ایستاده. چراغ سبز شد.\n\nهیچ راننده‌ای بوق نمی‌زنه. فقط «می‌ایستند». انگار همه یه چیزی می‌دونن که تو نمی‌دونی.\n\nپیرمرد حرکت نمی‌کنه. به چیزی روبرو نگاه می‌کنه که نیست.",
    choices: [
      {
        label: "🤝 دستش رو بگیر و ردش کن",
        outcomes: [
          {
            weight: 5,
            text: "دستش رو گرفتی. سرد نبود. گرم بود، مثل دستِ کسی که تازه از یه جای گرم اومده.\nردش کردی. گفت: «من 19 ساله هر روز رو همین چهارراه می‌ایستم. تو اولین کسی هستی که دستم رو گرفت.»\n«بقیه چیکار می‌کنن؟» — «صبر می‌کنن تا خودم برم. امروز رفتم. دیگه نمیام. ممنون.\"\nبرگشتی. چهارراه خالی بود. راننده‌ها یه لحظه سکوت کردن. یه جای تو شاد شد.",
            effects: [
              { stat: "reputation", amount: 12 },
              { stat: "fame", amount: 4 },
              { stat: "luck", amount: 2 },
            ],
            grantAchievement: "crossing_guard",
            historyText: "دستِ پیرمردِ چهارراه رو گرفتی. 19 سال بعد، اولین نفر",
            worldFeed: "پیرمردِ چهارراه امروز به آن‌سو رفت",
          },
        ],
      },
      {
        label: "🚗 صبر کن مثل بقیه",
        outcomes: [
          {
            weight: 2,
            text: "منتظر موندی. چراغ سه بار عوض شد. پیرمرد بعد از سومی آروم راه افتاد و رفت.\nیه راننده بهت نگاه کرد: «تازه‌اومدی؟ نگران نباش. اون آقا هر روزه. شهر باهاش کنار اومده.»\n«چرا کسی کمکش نمی‌کنه؟» — «چون کمک نمی‌خواد. اون فقط ایستادن رو تمرین می‌کنه. 19 ساله. نمی‌دونیم چرا. فکر کنم خودشم یادش رفته.»",
            effects: [{ stat: "intelligence", amount: 2 }],
            historyText: "از پیرمردِ چهارراه رد شدی. شهر گفته او کمک نمی‌خواد",
          },
        ],
      },
    ],
  },
]

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.key, e]))

export function getEvent(key: string): EventDef | undefined {
  return EVENT_MAP[key]
}

// رویدادهای زنجیره‌ای: پیدا کردن تعریف مرحله‌ی بعد
export function findChainEvent(chainKey: string, step: number): EventDef | undefined {
  return EVENTS.find((e) => e.chain?.key === chainKey && e.chain.step === step)
}
