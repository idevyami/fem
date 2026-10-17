// FEMBOY WAR 🎀 — بارگذاری bot-secret.env (فایل tracked که ری‌استارت پلتفرم پاکش نمی‌کند).
// باید اولین import در index.ts باشد. کلیدهای موجود در process.env دست‌نخورده می‌مانند.

import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

const SECRET_FILE = path.join(import.meta.dir, "..", "bot-secret.env")

if (existsSync(SECRET_FILE)) {
  try {
    for (const line of readFileSync(SECRET_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
      if (!m || !m[1] || !m[2]) continue
      const key = m[1]
      const value = m[2]
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    /* خواندن نشد — با env فعلی ادامه می‌دهیم */
  }
}
