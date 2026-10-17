import { cookies } from "next/headers"
import { createHmac } from "crypto"
import { db } from "@/lib/db"
import type { Player } from "@prisma/client"
import { grantStarterKit, STARTER_DEFAULTS } from "./starter-kit"
import { getBotToken, getGameSecret } from "./secrets"

const COOKIE_NAME = "fw_session"

// رازِ کوکی: env → bot-secret.env (tracked، از ری‌استارت زنده می‌ماند) → رازِ
// تصادفیِ مخصوصِ این بوتِ پردازش. حالتِ تصادفی در globalThis مِمویز می‌شود تا
// hot-reload نشست‌ها را نابود نکند. هیچ‌وقت قابلِ جعل نیست — فقط ناپایدار.
const g = globalThis as typeof globalThis & { __femwarCookieSecret?: string }
const randomSecret = (): string =>
  (g.__femwarCookieSecret ??= Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))

function cookieSecret(): string {
  return getGameSecret() || randomSecret()
}

// ─── Cookie signing ───────────────────────────────────────────────────────────

function sign(value: string): string {
  return createHmac("sha256", cookieSecret()).update(value).digest("hex").slice(0, 32)
}

function makeToken(playerId: string): string {
  return `${playerId}.${sign(playerId)}`
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf(".")
  if (idx <= 0) return null
  const id = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  if (sign(id) !== sig) return null
  return id
}

// ─── Telegram initData validation ─────────────────────────────────────────────

export interface TgUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

/**
 * علتِ ردشدن را در لاگِ سرور می‌نویسد (بدون لیکِ هیچ رازی) تا دفعه‌ی بعد
 * که تلگرام «تأیید نشد» گفت، پاسخ در dev.log باشد.
 */
function logReject(reason: string, initData: string): void {
  try {
    const keys = [...new URLSearchParams(initData).keys()].sort().join(",") || "-"
    console.warn(`[auth] initData رد شد: reason=${reason} keys=[${keys}] len=${initData.length}`)
  } catch {
    /* خودِ لاگ هرگز نباید مسیرِ رد را بشکند */
  }
}

export function verifyInitData(initData: string): TgUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) {
    logReject("no_hash", initData)
    return null
  }
  params.delete("hash")
  params.delete("signature")
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n")

  const botToken = getBotToken()
  if (!botToken) {
    // بدون BOT_TOKEN، اعتبارسنجی HMAC ممکن نیست — به‌جای اعتماد به داده‌ی خام،
    // درِ بسته می‌ماند (fail-closed). initData جعلی نمی‌تواند هویت بسازد.
    logReject("no_token", initData)
    return null
  }
  // اعتبارسنجی واقعی HMAC — تنها راه قابل اعتماد
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  if (computed !== hash) {
    logReject("hash_mismatch", initData)
    return null
  }

  try {
    const userJson = params.get("user")
    if (!userJson) {
      logReject("no_user", initData)
      return null
    }
    const user = JSON.parse(userJson) as TgUser
    if (!user?.id) {
      logReject("bad_user", initData)
      return null
    }
    return user
  } catch {
    logReject("user_json", initData)
    return null
  }
}

// ─── Player bootstrap ─────────────────────────────────────────────────────────

export async function createPlayer(name: string, avatar: string, telegramId?: string): Promise<Player> {
  return db.$transaction(async (tx) => {
    const player = await tx.player.create({
      data: {
        name,
        avatar,
        telegramId: telegramId ?? null,
        money: STARTER_DEFAULTS.money,
        houseKey: STARTER_DEFAULTS.houseKey,
        jobKey: STARTER_DEFAULTS.jobKey,
        currentDistrict: STARTER_DEFAULTS.currentDistrict,
        houseRentDue: new Date(Date.now() + 24 * 3600000),
      },
    })
    // کیتِ آغازینِ مشترک — همان چیزی که شهروندِ گروهی هم می‌گیرد
    await grantStarterKit(tx, player.id, name)
    return player
  })
}

// ─── Session API ──────────────────────────────────────────────────────────────

export async function setSession(playerId: string) {
  const store = await cookies()
  store.set(COOKIE_NAME, makeToken(playerId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // ۶ ماه
  })
}

export async function clearSession() {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function getSessionPlayer(): Promise<Player | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  const id = verifyToken(token)
  if (!id) return null
  return db.player.findUnique({ where: { id } })
}

/** ورود: initData تلگرام یا guest با اسم */
export async function login(opts: { initData?: string; name?: string; avatar?: string }): Promise<{ player: Player; created: boolean } | { error: string }> {
  // ۱) تلگرام
  if (opts.initData) {
    const user = verifyInitData(opts.initData)
    if (!user) return { error: "اعتبارسنجی تلگرام انجام نشد." }
    const tgId = String(user.id)
    const existing = await db.player.findUnique({ where: { telegramId: tgId } })
    if (existing) {
      await setSession(existing.id)
      return { player: existing, created: false }
    }
    const name = (user.first_name || user.username || `مسافر ${user.id}`).slice(0, 24)
    const player = await createPlayer(name, "🧑‍🦰", tgId)
    await setSession(player.id)
    return { player, created: true }
  }

  // ۲) مهمان (مرورگر / preview)
  if (opts.name) {
    const clean = opts.name.trim().slice(0, 24)
    if (clean.length < 2) return { error: "اسم باید حداقل 2 حرف باشد. شهر اسم‌های کوتاه را جدی نمی‌گیرد." }
    const avatar = opts.avatar || "🧶"
    const player = await createPlayer(clean, avatar)
    await setSession(player.id)
    return { player, created: true }
  }

  // ۳) session موجود
  const existing = await getSessionPlayer()
  if (existing) return { player: existing, created: false }
  return { error: "ورودی کافی نیست." }
}
