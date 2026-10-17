// FEMBOY WAR 🎀 — نگهبانِ ربات تلگرام.
// داخل فرایندِ next-server زندگی می‌کند (که پلتفرم آن را زنده نگه می‌دارد) و
// هر ۲۰ ثانیه سلامتِ mini-services/bot را چک می‌کند؛ اگر مرده یا خواب باشد،
// دوباره بالا می‌آوردش. سندباکس فرایندهای پس‌زمینه را می‌کُشد — این نگهبان
// خودش را شفا می‌دهد و ربات حداکثر ~۲۰ ثانیه خامین می‌ماند.
//
// نکته: import با side-effect است و فقط یک‌بار در هر عمرِ فرایند اجرا می‌شود
// (گارد globalThis برای جلوگیری از اینتروال تکراری هنگام hot-reload).
// خاموش‌کردن اختیاری: BOT_KEEPER=0

import { spawn } from "node:child_process"
import { closeSync, existsSync, openSync, readFileSync } from "node:fs"
import path from "node:path"

const g = globalThis as typeof globalThis & { __femboyWarBotKeeperV2?: true }
if (!g.__femboyWarBotKeeperV2 && process.env.BOT_KEEPER !== "0") {
  // ─── درِ دیپلوی بسته می‌ماند ────────────────────────────────────────────
  // این نگهبان فقط در سندباکس معنا دارد (جایی که ربات همین‌جا زندگی می‌کند و
  // سندباکس فرایندهایش را می‌کُشد). در باندلِ دیپلویِ standalone این ماژول
  // نباید رباتِ دومی روی سرورِ دیپلوی spawn کند — دو ربات = تداخلِ getUpdates
  // = مرگِ هر دو. سه سیگنالِ مستقل:
  //   ۱) فایلِ نشانِ .fw-deploy (اسکریپتِ build می‌سازدش)
  //   ۲) bunِ مخصوصِ سندباکس وجود ندارد و production است → قطعاً دیپلوی است
  //   ۳) BOT_KEEPER=0 — خاموش‌کردنِ دستی (از قبل هم بود)
  const IS_DEPLOY_BUNDLE =
    existsSync(path.join(process.cwd(), ".fw-deploy")) ||
    (process.env.NODE_ENV === "production" && !existsSync("/home/z/.bun/bin/bun"))
  if (!IS_DEPLOY_BUNDLE) {
  g.__femboyWarBotKeeperV2 = true

  const BOT_DIR = path.join(process.cwd(), "mini-services", "bot")
  const BOT_ENV = path.join(BOT_DIR, ".env")
  const BOT_SECRET_ENV = path.join(BOT_DIR, "bot-secret.env") // tracked — از ری‌استارت زنده می‌ماند
  const BOT_LOG = path.join(BOT_DIR, "bot.log")
  const HEALTH_URL = process.env.BOT_HEALTH_URL || "http://localhost:3021"

  // توکن هر بار از فایل‌ها خوانده می‌شود تا تغییرات بدون ری‌استارت next-server اعمال شوند.
  // پایه: bot-secret.env (که پلتفرم پاکش نمی‌کند)؛ روتینه: .env (فایلِ زنده).
  // ری‌استارتِ پلتفرم .env* را پاک می‌کند — بدون این fallback، نگهبان دیگر
  // هیچ‌وقت ربات را respawn نمی‌کرد.
  function readEnv(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const f of [BOT_SECRET_ENV, BOT_ENV]) {
      try {
        if (!existsSync(f)) continue
        for (const line of readFileSync(f, "utf8").split("\n")) {
          const m = line.match(/^([A-Z_]+)=(.*)$/)
          if (m?.[1] && m[2].trim()) out[m[1]] = m[2].trim()
        }
      } catch {
        /* این فایل موقتاً خوانا نیست — فایل بعدی/مقادیر قبلی می‌مانند */
      }
    }
    return out
  }

  function bunBin(): string {
    return existsSync("/home/z/.bun/bin/bun") ? "/home/z/.bun/bin/bun" : "bun"
  }

  let lastSpawn = 0

  const spawnBot = (reason: string): void => {
    const now = Date.now()
    if (now - lastSpawn < 20_000) return // حداقل ۲۰ ثانیه بین دو spawn
    const env = readEnv()
    const token = env.BOT_TOKEN
    if (!token || !existsSync(BOT_DIR)) return // هنوز توکنی نیست — بی‌صدا صبر می‌کنیم
    lastSpawn = now
    try {
      const fd = openSync(BOT_LOG, "a")
      const child = spawn(bunBin(), ["run", "dev"], {
        cwd: BOT_DIR,
        env: { ...process.env, ...env },
        detached: true,
        stdio: ["ignore", fd, fd],
      })
      child.unref()
      closeSync(fd) // فرزند نسخه‌ی خودش را دارد
      child.on("error", (e) => console.log(`[bot-keeper] spawn error: ${e.message}`))
      console.log(`[bot-keeper] spawn (${reason}) pid=${child.pid}`)
    } catch (e) {
      console.log(`[bot-keeper] spawn failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const check = (): void => {
    void (async () => {
      try {
        const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) })
        const j = (await res.json()) as { ok?: boolean; awake?: boolean }
        if (j?.ok && j?.awake) return // سالم و بیدار — کاری نیست
        spawnBot(j?.ok ? "sleeping" : "unhealthy")
      } catch {
        spawnBot("unreachable")
      }
    })()
  }

  check() // بلافاصله
  const timer = setInterval(check, 20_000)
  timer.unref?.()
  console.log(`[bot-keeper] started — نگهبان فعال؛ ربات با .env هماهنگ می‌شود (${HEALTH_URL}).`)
  } else {
    // باندلِ دیپلوی — ربات در سندباکس زندگی می‌کند، نه این‌جا
    console.log(`[bot-keeper] skipped — deploy bundle (bot lives in the sandbox).`)
  }
}
