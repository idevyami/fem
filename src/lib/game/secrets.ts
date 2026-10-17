// FEMBOY WAR 🎀 — رازهایِ پایدار (restart-proof).
//
// چرا این فایل وجود دارد؟ `.env` اصلیِ پروژه gitignore است و ری‌استارتِ پلتفرم
// گاهی پاکش می‌کند. آن‌روز بدون BOT_TOKEN اعتبارسنجیِ initData تلگرام fail-closed
// می‌شود («اعتبارسنجی تلگرام انجام نشد») و Mini App روی صفحه‌ی خطا گیر می‌کند —
// دقیقاً باگِ گزارش‌شده. اما `mini-services/bot/bot-secret.env` tracked است و
// زنده می‌ماند و همین رازها را دارد.
//
// اولویتِ هر راز: متغیر محیطی → فایلِ tracked → حالتِ fail-closed (بدون مقدار).
// خواندنِ فایل با mtime کش می‌شود و env در هر فراخوانی اول چک می‌شود تا
// hot-reloadِ Next بر فایل برتری داشته باشد.

import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const SECRET_FILE = path.join(process.cwd(), "mini-services", "bot", "bot-secret.env")

interface SecretCache {
  mtimeMs: number
  values: Record<string, string>
}

const g = globalThis as typeof globalThis & { __femwarSecretCache?: SecretCache }
g.__femwarSecretCache ??= { mtimeMs: -1, values: {} }

/** خواندنِ bot-secret.env — کش‌شده با mtime؛ خطا/نبودنِ فایل = {} */
function readSecretFile(): Record<string, string> {
  try {
    const st = statSync(SECRET_FILE)
    const cache = g.__femwarSecretCache!
    if (cache.mtimeMs === st.mtimeMs) return cache.values
    const values: Record<string, string> = {}
    if (existsSync(SECRET_FILE)) {
      for (const line of readFileSync(SECRET_FILE, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
        if (m?.[1] && m[2]) values[m[1]] = m[2]
      }
    }
    cache.mtimeMs = st.mtimeMs
    cache.values = values
    return values
  } catch {
    // فایل نیست یا خوانا نیست — بدونِ رازِ فایلی ادامه می‌دهیم
    return {}
  }
}

function resolve(key: string): string | null {
  const fromEnv = process.env[key]
  if (typeof fromEnv === "string" && fromEnv.trim()) return fromEnv.trim()
  const fromFile = readSecretFile()[key]
  if (typeof fromFile === "string" && fromFile.trim()) return fromFile.trim()
  return null
}

/** توکنِ ربات — برای اعتبارسنجیِ initData تلگرام. خالی = درِ بسته. */
export function getBotToken(): string {
  return resolve("BOT_TOKEN") ?? ""
}

/** رازِ امضایِ کوکی نشست — پایدار بین ری‌استارت‌ها (نشست‌ها زنده می‌مانند). */
export function getGameSecret(): string {
  return resolve("GAME_SECRET") ?? ""
}

/** کلیدِ سرویسِ ربات↔موتور. خالی = fail-closed (ربات وارد نمی‌شود). */
export function getServiceKey(): string {
  return resolve("SERVICE_KEY") ?? ""
}
