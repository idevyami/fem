// FEMBOY WAR 🎀 — شمارنده‌های درون‌حافظه‌ای برای health endpoint.
// هیچ چیزی ذخیره نمی‌شود؛ فقط برای مشاهده‌پذیریِ فرایند ربات است.

/** لاگ کوتاه با مهر زمانی (مشترکِ همه‌ی لایه‌ها — بدون چرخه‌ی import) */
export function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

export const stats = {
  /** لحظه‌ی بالا آمدن فرایند */
  startedAt: new Date(),
  /** آیا long polling فعال است */
  polling: false,
  /** @username ربات (بعد از init) */
  username: null as string | null,
  /** کل آپدیت‌های دریافتی */
  updates: 0,
  /** فرمان‌های دریافتی (/start و…) */
  commands: 0,
  /** V6 — تفکیکِ فرمان‌ها (فقط مشاهده‌پذیری؛ برای health) */
  commandCounts: {} as Record<string, number>,
  /** دکمه‌های inline زده‌شده */
  callbacks: 0,
  /** دکمه‌های کیبوردِ ثابتِ خصوصی (hears) */
  hears: 0,
  /** خطاهای هندلر/فرایند */
  errors: 0,
  /** آخرین خطا */
  lastError: null as string | null,
  /** زمان آخرین آپدیت */
  lastUpdateAt: null as Date | null,
  /** آخرین باری که موتور بازی جواب داد */
  lastEngineOk: null as Date | null,
  /** نسخه‌ی دیپلوی (V16-3 — بازسازیِ UXِ خصوصی: منویِ خانه‌ی گروه‌بندی‌شده،
   *  سفرِ کاملِ محله‌ها، واخواهیِ بینگو، راهنمایِ بافتاری، صداقتِ حساب،
   *  بازکاربردِ لنگرِ نتیجه) */
  version: "8.5.0",

  // ─── V5 — لایه‌ی گروه (شهرِ زنده) ──────────────────────────────────────────
  /** پیام‌های گروهیِ ردشده از خط لوله‌ی حضور (observe) */
  observed: 0,
  /** فرمان‌های گروهیِ ارسال‌شده به موتور */
  groupCommands: 0,
  /** کال‌بک‌های گروهیِ (ge:/gg:/gv:/ru:/gp:/cit:/gm:/gc:/gs:) ردشده به موتور */
  groupCallbacks: 0,
  /** پیام‌های outbox که با موفقیت تحویلِ تلگرام رسیدند */
  outboxDelivered: 0,
  /** زمان آخرین تیکِ موفقِ گروه */
  lastGroupTickAt: null as Date | null,

  // ─── V13.6 — مسیرِ دوتاییِ موتور ─────────────────────────────────────────
  /** دفترِ کوچکِ تعویض‌های primary/fallback (آخرین ۱۰ مورد؛ برای health) */
  notes: [] as string[],
}

/** یادداشتِ قابل‌مشاهده در health — حداکثر ۱۰ خط نگه می‌داریم */
export function note(msg: string): void {
  stats.notes.push(msg)
  if (stats.notes.length > 10) stats.notes.splice(0, stats.notes.length - 10)
}

export function bumpError(msg: string): void {
  stats.errors++
  stats.lastError = msg
}

/** شمارشِ تفکیکیِ فرمان‌ها — /start@femwarbot → «start» */
export function bumpCommand(text: string): void {
  const name = text.slice(1).split(/[\s@]/)[0]?.toLowerCase()
  if (!name) return
  stats.commandCounts[name] = (stats.commandCounts[name] ?? 0) + 1
}
