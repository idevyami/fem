// FEMBOY WAR 🎀 — instrumentation: خودترمیمیِ بوتِ سرور.
//
// چرا این فایل وجود دارد: دیپلویِ standalone ممکن است بدونِ فایلِ دیتابیس بالا
// بیاید (SQLite فایلِ خالی می‌سازد → بدونِ جدول → همه‌ی مسیرها خطا). این‌جا در
// بوتِ سرور — قبل از اولین request — اسکیما را تضمین می‌کنیم:
//   • جدول‌ها هستند؟ هیچ کاری نمی‌شود (no-op، یک SELECT سبک).
//   • جدول نیست؟ DDLِ idempotent (CREATE ... IF NOT EXISTS) اجرا می‌شود.
// دیتابیسِ موجود هرگز دست‌نخورده می‌ماند؛ فقط دیتابیسِ تازه خودش را می‌سازد.
//
// فقط runtimeِ nodejs — edge نداریم و نباید داشته باشیم (SQLite هم نیست).

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const [{ db, DATABASE_FILE }, { SCHEMA_DDL }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/game/schema-ddl'),
  ])

  const t0 = Date.now()
  try {
    const row = await db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'Player'
    `
    const hasSchema = (row[0]?.n ?? 0) > 0
    if (hasSchema) {
      console.log(`[instrumentation] schema ok — ${DATABASE_FILE}`)
      return
    }

    // باندلِ تازه بدونِ دیتابیس — بسازش (هر statement جدا تا خطا قابلِ شناسایی باشد)
    let applied = 0
    for (const stmt of SCHEMA_DDL) {
      await db.$executeRawUnsafe(stmt)
      applied++
    }
    console.log(
      `[instrumentation] schema bootstrapped — ${applied}/${SCHEMA_DDL.length} statements ` +
        `in ${Date.now() - t0}ms → ${DATABASE_FILE}`,
    )
  } catch (e) {
    // بوت نباید به‌خاطرِ این بیفتد؛ مسیرها خطایِ خودشان را می‌دهند. اما لاگِ واضح
    // برای عیب‌یابیِ دیپلوی حیاتی است.
    const reason = e instanceof Error ? e.message.split('\n')[0] : String(e)
    console.error(`[instrumentation] schema check FAILED (${reason}) — db=${DATABASE_FILE}`)
  }
}
