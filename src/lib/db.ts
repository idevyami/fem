import type { PrismaClient } from '@prisma/client'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// V13 موجِ ۲ — بارگیریِ زنده‌ی کلاینتِ Prisma از دیسک (بدونِ ری‌استارتِ سرور):
// بعد از `prisma generate`/`db:push` (تغییرِ اسکیما) سرورِ dev با hot-reload زنده
// می‌ماند، اما ماژولِ @prisma/client در کشِ باندلر کهنه است و مدل‌هایِ تازه را
// ندارد (رفتارِ دیده‌شده: db.groupChallenge === undefined). این‌جا کلاینت با
// require واقعیِ Node از دیسک ساخته می‌شود — پس از پاک‌کردنِ کشِ require تا
// تولیدِ دوباره هم دیده شود — و در globalThis می‌ماند تا هر hot-reload یک
// نمونه‌ی تازه نسازد. تایپ‌ها از import type می‌آیند (پاک‌شونده در کامپایل).
//
// V13.5 — مسیرِ دیتابیسِ قابل‌حمل: دیپلویِ standalone ممکن است از هر جایی
// اجرا شود (cwd متفاوت، بدونِ .env). مسیرِ نهایی این‌طور حل می‌شود:
//   ۱) env DATABASE_URL (نسبی → مطلق‌سازی نسبت به cwd)
//   ۲) اگر فایلش نبود: <dirname(argv[1])>/db/custom.db (کنارِ server.js باندل)
//   ۳) در بدترین حالت: <cwd>/db/custom.db (پوشه ساخته می‌شود؛ SQLite فایل می‌سازد)
// جدول‌ها را instrumentation.ts در بوت می‌سازد (schema-ddl) — پس حالتِ تازه هم سالم بالا می‌آید.
const globalForPrisma = globalThis as unknown as {
  prismaV13W2Disk: PrismaClient | undefined
  prismaV13W2: PrismaClient | undefined
  prisma: PrismaClient | undefined
}

/** مسیرِ فایلِ دیتابیس — مطلق، با پوشه‌ی تضمین‌شده */
function resolveDatabaseFile(): string {
  const fromEnv = process.env.DATABASE_URL?.trim()

  // ۱) env — مطلق یا نسبیِ حل‌شده به cwd (قولِ اپراتور همیشه محترم است؛ پوشه را می‌سازیم)
  if (fromEnv) {
    let p = fromEnv
    if (p.startsWith('file:')) p = p.slice('file:'.length)
    p = p.split('?')[0] // پرامترهای sqlite مثل ?socket
    if (!p.startsWith('/')) p = path.resolve(process.cwd(), p)
    try {
      mkdirSync(path.dirname(p), { recursive: true })
    } catch {
      /* فقط‌خواندنی — بعداً خطای واضح می‌آید */
    }
    return p
  }

  // ۲) کنارِ اسکریپتِ اجراشده (باندلِ standalone: server.js همان‌جاست که db/ هست)
  try {
    const scriptDir = path.dirname(path.resolve(process.argv[1] || ''))
    const beside = path.join(scriptDir, 'db', 'custom.db')
    if (existsSync(beside)) return beside
  } catch {
    /* argv غیرقابلِ حل — بی‌خیال */
  }

  // ۳) پیش‌فرضِ cwd — پوشه را می‌سازیم تا SQLite بتواند فایلِ تازه بسازد
  const fallback = path.join(process.cwd(), 'db', 'custom.db')
  try {
    mkdirSync(path.dirname(fallback), { recursive: true })
  } catch {
    /* فقط‌خواندنی — بعداً خطای واضح می‌آید */
  }
  return fallback
}

const DATABASE_URL = (() => {
  const file = resolveDatabaseFile()
  try {
    mkdirSync(path.dirname(file), { recursive: true })
  } catch {
    /* شاید قبلاً هست — Prisma خودش خطای واضح می‌دهد */
  }
  return `file:${file}`
})()

const nodeRequire = (() => {
  // چندپایه‌ای: اول cwd، بعدِ کنارِ اسکریپت (باندلِ standalone ممکن است از
  // پوشه‌ی والد اجرا شود — node_modules کنارِ server.js است، نه کنارِ cwd).
  // اگر هیچ‌کدام @prisma/client نداشتند، خطایِ واضحِ پایین می‌آید.
  const scriptDir = (() => {
    try {
      return path.dirname(path.resolve(process.argv[1] || ""))
    } catch {
      return ""
    }
  })()
  const bases = [process.cwd(), scriptDir].filter(
    (b, i, arr) => b && existsSync(path.join(b, "node_modules")) && arr.indexOf(b) === i,
  )
  return bases.map((b) => createRequire(path.join(b, "package.json")))
})()

function loadPrismaClient(): PrismaClient {
  if (globalForPrisma.prismaV13W2Disk) return globalForPrisma.prismaV13W2Disk
  // کشِ require ماژول‌هایِ prisma را بی‌خیال شو — همیشه از دیسک بخوان
  for (const req of nodeRequire) {
    for (const key of Object.keys(req.cache)) {
      if (key.includes("/.prisma/client/") || key.includes("/node_modules/@prisma/client/")) {
        delete req.cache[key]
      }
    }
  }
  let mod: { PrismaClient: new (opts: unknown) => PrismaClient } | undefined
  let lastReason = ""
  for (const req of nodeRequire) {
    try {
      const m = req("@prisma/client") as typeof mod
      if (m?.PrismaClient) {
        mod = m
        break
      }
    } catch (e) {
      // این پایه نداشت — پایه‌ی بعدی (مثلاً stubِ کشِ bun بدونِ .prisma)
      lastReason = e instanceof Error ? e.message.split("\n")[0] : String(e)
    }
  }
  if (!mod) {
    // کلاینتِ تولیدشده در هیچ پایه‌ای نبود (دیپلویِ ناقص) — خطایِ قابلِ فهم به‌جای
    // 500ِ خام: دقیقاً همین پیام در لاگِ دیپلوی معنا دارد.
    throw new Error(
      `[db] Prisma client unavailable (cwd: ${process.cwd()}) — run "prisma generate" (or ship node_modules/.prisma) before boot. ` +
        `Underlying: ${lastReason || "no node_modules base with @prisma/client"}`,
    )
  }
  const client = new mod.PrismaClient({
    log: process.env.LOG_QUERIES === "1" ? ["query"] : ["error"],
    datasourceUrl: DATABASE_URL,
  })
  globalForPrisma.prismaV13W2Disk = client
  return client
}

// لاگِ کوئری‌ها فقط وقتی LOG_QUERIES=1 — وگرنه dev.log را با نویز پر می‌کند.
export const db: PrismaClient = loadPrismaClient()

/** مسیرِ مطلقِ فایلِ دیتابیسِ فعال — برای لاگِ بوت و عیب‌یابی */
export const DATABASE_FILE: string = DATABASE_URL.replace(/^file:/, '')
