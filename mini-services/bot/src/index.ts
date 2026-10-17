// FEMBOY WAR 🎀 — نقطه‌ی ورود ربات (V13 موجِ ۵ — ترنسپورتِ بازساخته‌ی شهرِ زنده).
// health server همیشه روشن است (پورت 3021)؛ خودِ ربات فقط وقتی BOT_TOKEN باشد بیدار می‌شود.
//
// بهینه‌سازی‌ها:
//  • auto-retry روی ۴۲۹/۵xx تلگرام (@grammyjs/auto-retry)
//  • allowed_updates — message و callback_query و my_chat_member (V13:
//    چرخه‌ی حیاتِ ربات در گروه — افزودن/اخراج؛ dedup/ضدسیل در handlers.ts)
//  • همگام‌سازی پروفایل: setMyCommands در سه scope (default / خصوصی / گروه) + description
//  • V6: health فقط با یک GET /api/health سبک از موتور سلامت می‌گیرد — دیگر هیچ
//    مسیرِ بازی‌ای POST نمی‌شود (نویزِ ۴۰۰ و tickِ ناخواسته‌ی هر ۲۰ ثانیه حذف شد)
//  • V6: توکنِ نامعتبر → خروجِ فوری با پیامِ روشن (بدون حلقه‌ی ۱۰تلاش/ری‌اسپاون)
//  • V5: اسکِیپ‌بانِ ۴۵ثانیه‌ایِ گروه — زهکشیِ outbox موتور و تحویل به تلگرام

// V10 — این باید اولین import باشد: bot-secret.env (فایلِ tracked) را قبل از
// هر خواندنِ process.env لود می‌کند. پلتفرمِ سندباکس موقعِ بوت، mini-services
// را با «bun run dev» و بدون هیچ env فایلی بالا می‌آورد (.zscripts/dev.sh) —
// بدون این import، رباتِ بوتِ پلتفرم «خفته» بالا می‌آید (بدونِ BOT_TOKEN)،
// پورتِ سلامت را قفل می‌کند و هر respawn بعدی را EADDRINUSE می‌کُشد.
import "./env"
import { Bot } from "grammy"
import { autoRetry } from "@grammyjs/auto-retry"
import { spawn } from "node:child_process"
import { existsSync, openSync, closeSync, readdirSync, readFileSync, readlinkSync } from "node:fs"
import path from "node:path"
import { API_FALLBACK, API_PRIMARY, SERVICE_KEY, apiBase, engineRoutes, fetchEngineHealth, reselectBase } from "./api"
import { registerBot } from "./handlers"
import { startGroupTicker } from "./group"
import { bumpError, log, stats } from "./stats"

const BOT_TOKEN = process.env.BOT_TOKEN
const HEALTH_PORT = Number(process.env.HEALTH_PORT || 3021)
const MINIAPP_URL = process.env.MINIAPP_URL || ""

// ─── نگهبانِ موتورِ بازی (dev-keeper) ────────────────────────────────────────
// سندباکس فرایندهایِ جدا‌شده از Bash را می‌کُشد، ولی فرزندهایِ سرورِهایِ زنده را
// زنده نگه می‌دارد. خودِ ربات یتیمِ next-server است و زنده مانده — پس بهترین
// جایِ «بالا آوردنِ دوباره‌ی موتور» همین‌جاست: هر ۲۰ ثانیه /api/health را چک
// می‌کنیم؛ اگر مرده بود، next dev را detached بالا می‌آوریم (خروجی → dev.log).
// موتور هم ازطرف خودش bot-keeper دارد که ربات را نگه می‌دارد — رستورانِ متقابل.
const dk = globalThis as typeof globalThis & { __femwarDevKeeper?: NodeJS.Timeout }
if (process.env.DEV_KEEPER !== "0") {
  // hot-reload: تایمرِ نسلِ قبلی را خاموش کن و تازه ثبت کن — نسلِ کهنه بعدِ
  // چندبار ری‌لود بی‌جواب می‌شود (بستری که در V10 کشف شد).
  if (dk.__femwarDevKeeper) {
    clearInterval(dk.__femwarDevKeeper)
    dk.__femwarDevKeeper = undefined
  }
  let lastSpawn = 0
  const PROJECT_DIR = "/home/z/my-project"
  const spawnEngine = (reason: string): void => {
    const now = Date.now()
    if (now - lastSpawn < 30_000) return
    lastSpawn = now
    try {
      const fd = openSync(`${PROJECT_DIR}/dev.log`, "a")
      const bunBin = existsSync("/home/z/.bun/bin/bun") ? "/home/z/.bun/bin/bun" : "bun"
      const child = spawn(bunBin, ["run", "dev"], {
        cwd: PROJECT_DIR,
        env: { ...process.env },
        detached: true,
        stdio: ["ignore", fd, fd],
      })
      child.unref()
      closeSync(fd)
      log(`[dev-keeper] spawn (${reason}) pid=${child.pid}`)
    } catch (e) {
      log(`[dev-keeper] spawn failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const checkEngine = (): void => {
    void (async () => {
      // V13.6 — sticky base را تازه کن: primary سالم؟ برگرد (مغزِ واحد).
      // خودِ موتورِ محلی را جداگانه چک می‌کنیم — نقشِ نگهبانِ sandbox همین است.
      await reselectBase("dev-keeper-cycle")
      try {
        const res = await fetch("http://localhost:3000/api/health", { signal: AbortSignal.timeout(4000) })
        if (res.ok) return // موتورِ محلی زنده است (fallback آماده)
        spawnEngine("unhealthy")
      } catch {
        spawnEngine("unreachable")
      }
    })()
  }
  checkEngine()
  const t = setInterval(checkEngine, 20_000)
  t.unref?.()
  dk.__femwarDevKeeper = t
  log(
    `[dev-keeper] نگهبانِ موتور فعال — هر ۲۰ ثانیه /api/health چک می‌شود ` +
      `(primary: ${API_PRIMARY} · fallback: ${API_FALLBACK || "-"} · local keeper: localhost:3000).`,
  )
}

// ─── Health server — با یا بدون توکن ────────────────────────────────────────

function fmtUptime(): string {
  const s = Math.floor((Date.now() - stats.startedAt.getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

/** پینگِ سبکِ موتور — V6: فقط GET /api/health (بدون لمسِ هیچ مسیرِ بازی؛ بدون worldTick).
 *  ok = HTTP 200 && body.data.ok && body.data.db */
async function enginePing(): Promise<{ ok: boolean; db: boolean; latencyMs: number }> {
  const t0 = Date.now()
  const r = await fetchEngineHealth(4000)
  return { ok: r?.ok === true, db: r?.db === true, latencyMs: Date.now() - t0 }
}

// ─── Health server — با یا بدون توکن (V10: takeover) ──────────────────────
// اگر پورت در دستِ کسِ دیگری باشد:
//  • دارندهٔ بیدارِ سالم (دوقلویِ دیگر) → این نمونه بی‌صدا خارج می‌شود (exit 0)
//    تا دو فرایند با هم polling نکنند و ۴۰۹ رد و بدل نشود.
//  • دارندهٔ نسلِ قبلیِ همین فرایند (hot-reload) → فقط serve رد می‌شود؛ سرورِ
//    نسلِ قبل زنده است و همان جواب می‌دهد (رفتارِ پیشین حفظ شده).
//  • دارندهٔ خفته/بی‌پاسخ (نمونهٔ بدونِ BOT_TOKEN از بوتِ پلتفرم) → خلع می‌کنیم،
//    پورت را تصرف می‌کنیم و ادامه می‌دهیم — خودترمیمی بدونِ دخالتِ انسانی.
//  • تصرف نشد → exit(1): دیگر فرایندِ زامبیِ بی‌پایان جمع نمی‌شود (با bun --hot
//    خطایِ serve فرایند را زنده نگه می‌داشت — ریشهٔ هجومِ EADDRINUSE ها).
const gServe = globalThis as typeof globalThis & { __femwarServeOwnerPid?: number }

const healthHandler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  if (url.pathname !== "/" && url.pathname !== "/health") {
    return new Response("not found", { status: 404 })
  }
  // یک GET ارزان — دیگر guide/citynews/group با بدنه‌ی خالی POST نمی‌شوند
  const engine = await enginePing()
  return Response.json(
    {
      ok: true,
      bot: "femboy-war-bot",
      version: stats.version,
      awake: Boolean(BOT_TOKEN),
      username: stats.username,
      polling: stats.polling,
      uptime: fmtUptime(),
      counters: {
        updates: stats.updates,
        commands: stats.commands,
        callbacks: stats.callbacks,
        hears: stats.hears,
        errors: stats.errors,
      },
      commandBreakdown: stats.commandCounts,
      lastUpdateAt: stats.lastUpdateAt?.toISOString() ?? null,
      lastEngineOk: stats.lastEngineOk?.toISOString() ?? null,
      lastError: stats.lastError,
      engine: { ok: engine.ok, db: engine.db, latencyMs: engine.latencyMs },
      // V13.6 — مسیرِ دوتایی: کدام موتور فعال است و چه تعویض‌هایی شده
      routes: engineRoutes(),
      notes: stats.notes,
      group: {
        lastTickAt: stats.lastGroupTickAt?.toISOString() ?? null,
        observedMessages: stats.observed,
        commands: stats.groupCommands,
        callbacks: stats.groupCallbacks,
        outboxDelivered: stats.outboxDelivered,
      },
      miniapp: { configured: /^https:\/\//.test(MINIAPP_URL) },
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

async function probeHolder(): Promise<{ reachable: boolean; awake?: boolean }> {
  try {
    const res = await fetch(`http://localhost:${HEALTH_PORT}/health`, { signal: AbortSignal.timeout(6000) })
    const j = (await res.json()) as { awake?: boolean }
    return { reachable: true, awake: j?.awake }
  } catch {
    return { reachable: false }
  }
}

/** فرایندهای bunِ همین سرویس (cwd داخل mini-services/bot) — خود و والد مستثنی‌اند. */
function killSiblingBots(): number {
  const selfPid = process.pid
  const parentPid = process.ppid ?? 0
  const botRoot = path.resolve(import.meta.dir, "..")
  let killed = 0
  try {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue
      const pid = Number(entry)
      if (pid === selfPid || pid === parentPid) continue
      try {
        const cwd = readlinkSync(`/proc/${pid}/cwd`)
        if (!cwd.startsWith(botRoot)) continue
        const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8")
        if (!cmd.includes("bun")) continue
        process.kill(pid, "SIGTERM")
        killed++
      } catch {
        /* فرایندِ ما نیست یا همین حالا رفت */
      }
    }
  } catch {
    /* اسکنِ /proc ممکن نشد */
  }
  return killed
}

const isAddrInUse = (e: unknown): boolean => {
  // Bun پیامِ خطا را «Failed to start server. Is port 3021 in use?» می‌دهد و
  // کدِ واقعی (EADDRINUSE) فقط در e.code است — هر دو را چک می‌کنیم.
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code
    if (code === "EADDRINUSE") return true
  }
  const s = e instanceof Error ? e.message : String(e)
  return /EADDRINUSE|address (is )?in use|in use\?|failed to start server|listen/i.test(s)
}

async function serveHealth(): Promise<void> {
  try {
    Bun.serve({ port: HEALTH_PORT, fetch: healthHandler })
    gServe.__femwarServeOwnerPid = process.pid
    return
  } catch (e) {
    if (!isAddrInUse(e)) throw e
  }
  const holder = await probeHolder()
  if (holder.reachable && holder.awake) {
    if (gServe.__femwarServeOwnerPid === process.pid) {
      log("health: نسلِ پیشینِ همین فرایند پورت را دارد — serve رد شد (hot-reload).")
      return
    }
    log("health: دوقلویِ بیدارِ سالم روی پورت است — این نمونه کنار می‌کشد (exit 0).")
    process.exit(0)
  }
  log("health: پورت در دستِ نمونهٔ خفته/بی‌پاسخ است — takeover…")
  const killed = killSiblingBots()
  if (killed > 0) await new Promise((r) => setTimeout(r, 1500))
  try {
    Bun.serve({ port: HEALTH_PORT, fetch: healthHandler })
    gServe.__femwarServeOwnerPid = process.pid
    log(`health: پورت تصرف شد${killed > 0 ? ` — ${killed} فرایندِ قدیمی خاتمه یافت` : ""}.`)
    return
  } catch (e) {
    log(`health: تصرفِ پورت شکست خورد: ${e instanceof Error ? e.message : String(e)} — exit(1).`)
    process.exit(1)
  }
}

await serveHealth()

log(
  `mode: ${BOT_TOKEN ? "awake" : "sleeping"} · health: http://localhost:${HEALTH_PORT} · api: ${apiBase()} (primary ${API_PRIMARY}) · service key: ${SERVICE_KEY ? "configured" : "missing"}`,
)

if (!MINIAPP_URL.startsWith("https://")) {
  log("MINIAPP_URL تنظیم نشده — دکمه‌ی Mini App پنهان است. برای فعال‌شدنش، URL عمومی https را در MINIAPP_URL بگذار.")
}

// ─── ربات — فقط با توکن ─────────────────────────────────────────────────────

if (!BOT_TOKEN) {
  log("BOT_TOKEN نیست — ربات در حالت خواب | BOT_TOKEN missing — bot is sleeping (health server only).")
} else {
  const bot = new Bot(BOT_TOKEN)
  bot.api.config.use(autoRetry()) // ۴۲۹/۵xx تلگرام → تلاش مجدد با backoff
  registerBot(bot)

  // V5 — اسکِیپ‌بانِ شهرِ زنده: هر ۴۵ ثانیه outbox موتور را زهکشی و تحویل می‌کنیم
  startGroupTicker(bot)

  bot.catch((err) => {
    bumpError(err.error instanceof Error ? err.error.message : String(err.error))
    log(`bot error: ${stats.lastError}`)
  })

  try {
    await bot.init()
    stats.username = bot.botInfo.username ?? null

    // ─── همگام‌سازی پروفایل با تلگرام ──────────────────────────────────────
    // V13 §VI/4 — منوی «/» خالی است: بازی با زبانِ طبیعی، دکمه‌های شیشه‌ای و
    // کیبوردِ پاسخ زندگی می‌کند؛ اسلش دیگر معرفی/تبلیغ نمی‌شود. فرمان‌های اسلش
    // همچنان کار می‌کنند (هم‌سازگاریِ پشتیبان برای بازیکنانِ قدیمی) ولی بخشی از
    // تجربه‌ی بازیکن نیستند — هیچ رابطی آن‌ها را نمی‌بیند.
    const noCommands: { command: string; description: string }[] = []
    await bot.api.setMyCommands(noCommands) // scope پیش‌فرض
    await bot.api.setMyCommands(noCommands, { scope: { type: "all_private_chats" } })
    await bot.api.setMyCommands(noCommands, { scope: { type: "all_group_chats" } })
    // V13 — توضیحِ ربات با زبانِ طبیعی؛ بدونِ هیچ اشاره‌ای به فرمانِ اسلش
    await bot.api.setMyDescription(
      "🎀 هر بازیکن یک فمبویِ اختصاصی دارد — اسم بده، کلاس را برای همیشه انتخاب کن، و مسیرش را شهر بساز.\n\nشهر زندگی می‌کند، تو تصمیم می‌گیری، فمبویت رشد می‌کند. هر روز یک اتفاق، هر اتفاق یک انتخاب.\n\nدر گروه‌ها فمبوی‌ها زنده‌اند — «بازیکن‌ها» را بگو تا ببینی چه کسی اینجاست؛ روی پیامِ کسی ریپلای کن و «جنگ فمبوی» بگو تا با فمبویش مسابقه بدهی. برای زندگیِ شخصی، در خصوصی «شروع» را بگو.",
    )
    await bot.api.setMyShortDescription(
      "فمبویِ اختصاصی‌ات را بساز و در شهرِ عجیب پرورشش بده 🎀 خصوصی «شروع» · گروه «منو»",
    )

    // دکمه‌ی شیشه‌ایِ منوی چت — مینی‌اپ با یک لمس، کنارِ نوارِ تایپِ همه‌ی چت‌های خصوصی.
    // idempotent است و هر بالا آمدنِ ربات دوباره قفلش می‌کند.
    if (MINIAPP_URL.startsWith("https://")) {
      await bot.api.setChatMenuButton({
        menu_button: { type: "web_app", text: "🎀 Femboy War", web_app: { url: MINIAPP_URL } },
      })
      log("chat menu button: دکمه‌ی 🎀 مینی‌اپ برای همه‌ی چت‌های خصوصی فعال شد.")
    }

    log(
      `bot: @${stats.username} — profile synced (slash menu cleared · V13 no-slash) — long polling…`,
    )
  } catch (e) {
    bumpError(e instanceof Error ? e.message : String(e))
    log(`bot init failed: ${stats.lastError}`)
    // V6 — توکنِ نامعتبر (۴۰۱/۴۰۴ از تلگرام): خروجِ فوری و بی‌حلقه.
    // چرخشِ بی‌پایانِ «۱۰ تلاش ← exit ← ری‌اسپاونِ نگهبان ← …» برای توکنِ خراب
    // بی‌معناست؛ پیامِ روشن می‌ماند و فرایند خاموش می‌شود تا BOT_TOKEN درست شود.
    if (isAuthFailure(e)) {
      log("توکن ربات نامعتبر است — BOT_TOKEN را بررسی کن. | Invalid BOT_TOKEN — fix it. فرایند خاموش می‌شود.")
      process.exit(1)
    }
    log("خطایِ گذرا — health server می‌ماند و polling بعداً دوباره تلاش می‌کند.")
  }

  // ─── polling مقاوم ──────────────────────────────────────────────────────
  // خطاهای گذرا (مثل 409 وقتی یک getUpdates دیگری موقتاً قطعتش می‌کند) نباید
  // ربات را کرکن کند؛ با backoff دوباره بالا می‌آید. اگر پشت‌سرهم شکست خورد،
  // فرایند خارج می‌شود تا نگهبانِ داخل next-server نسخه‌ی تازه بالا بیاورد.
  //
  // «نسل» (generation): با هر hot-reload، ماژول دوباره اجرا می‌شود ولی حلقه‌ی
  // pollingِ ماژولِ قبل ممکن است زنده بماند و با حلقه‌ی تازه ۴۰۹ رد و بدل کند
  // (و بدتر: آپدیت‌ها به کدِ قدیمی برسند). هر اجرا نسل را زیاد می‌کند؛ حلقه‌ی
  // قدیمی به محضِ دیدنِ نسلِ تازه‌تر خاموش می‌شود — فقط آخرین نسل poll می‌گیرد.
  const g = globalThis as typeof globalThis & { __femwarPollingGen?: number }
  const gen = (g.__femwarPollingGen ?? 0) + 1
  g.__femwarPollingGen = gen

  const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  /** خطایِ «توکنِ نامعتبر» از تلگرام — ۴۰۱ Unauthorized (توکنِ باطل/چرخیده)
   *  یا ۴۰۴ Not Found (توکنِ بدشکل). فقط برای خطاهایِ تلگرام معتبر است؛
   *  خطاهای موتورِ بازی از مسیرِ دیگری می‌آیند و این‌جا نمی‌رسند. */
  function isAuthFailure(e: unknown): boolean {
    const s = e instanceof Error ? e.message : String(e)
    return /\b401\b|unauthorized|\b404\b.*not\s*found|not\s*found.*\b404\b/i.test(s)
  }

  async function runPolling(): Promise<void> {
    let failures = 0
    for (;;) {
      if ((g.__femwarPollingGen ?? 0) > gen) {
        log("long polling: نسلِ تازه‌تر روی کار آمده — این حلقه‌ی قدیمی خاموش می‌شود.")
        return
      }
      stats.polling = false
      try {
        await bot.start({
          allowed_updates: ["message", "callback_query", "my_chat_member"], // V13 — چرخه‌ی حیاتِ ربات هم می‌رسد
          onStart: () => {
            stats.polling = true
            if (failures > 0) log("long polling: recovered ✓")
            failures = 0
            log("long polling: started")
          },
        })
        return // توقف تمیز
      } catch (e) {
        // V6 — توکنِ نامعتبر/باطل‌شده در میانه‌ی کار: خروجِ فوری، بدون ۱۰ تلاشِ بی‌فایده
        if (isAuthFailure(e)) {
          bumpError(e instanceof Error ? e.message : String(e))
          log("توکن ربات نامعتبر/باطل شده است — BOT_TOKEN را بررسی کن. | BOT_TOKEN invalid — exiting.")
          process.exit(1)
        }
        bumpError(e instanceof Error ? e.message : String(e))
        stats.polling = false
        log(`long polling stopped: ${stats.lastError}`)
        failures++
        if (failures >= 10) {
          log("long polling: شکست‌های پیاپی — فرایند خارج می‌شود تا نگهبان دوباره بالا بیاوردش.")
          process.exit(1)
        }
        try {
          bot.stop()
        } catch {
          /* از قبل متوقف بوده */
        }
        const wait = Math.min(3000 * failures, 30000)
        log(`long polling: تلاش دوباره #${failures} تا ${wait / 1000} ثانیه دیگر…`)
        await sleep(wait)
      }
    }
  }

  void runPolling()
}
