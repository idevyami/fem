import { NextRequest } from "next/server"
import { timingSafeEqual } from "crypto"
import type { Player } from "@prisma/client"
import { db } from "@/lib/db"
import { getSessionPlayer } from "./session"
import { getServiceKey } from "./secrets"

// مسیرها این را از همین ماژول می‌گیرند — re-export برای راحتی‌شان
export { getServiceKey } from "./secrets"

// کلید سرویس: env → bot-secret.env (tracked) → خالی = «درِ بسته» (fail-closed).
// هر بار در لحظه‌ی درخواست خوانده می‌شود تا ری‌استارتِ پلتفرم (که .env را
// پاک می‌کند) کانالِ ربات↔موتور را نکُشد. هیچ مقدارِ پیش‌فرضِ شناخته‌شده‌ای نیست.

function keysMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = "bad_request", status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true as const, data }, { status })
}

export function jsonErr(message: string, status = 400, code = "bad_request") {
  return Response.json({ ok: false as const, error: message, code }, { status })
}

/**
 * شناسایی فراخواننده:
 * ۱) Mini App → session cookie
 * ۲) Bot service → هدر X-Service-Key + telegramId در body/query
 */
export async function resolveCaller(req: NextRequest, body?: Record<string, unknown>): Promise<Player> {
  const serviceKey = req.headers.get("x-service-key")
  const trustedKey = getServiceKey()
  if (serviceKey && trustedKey && keysMatch(serviceKey, trustedKey)) {
    const tgId = (body?.telegramId ?? req.nextUrl.searchParams.get("telegramId")) as string | undefined
    if (tgId) {
      const player = await db.player.findUnique({ where: { telegramId: String(tgId) } })
      if (player) return player
      throw new ApiError("این کاربر هنوز وارد بازی نشده. اول به ربات بنویس: شروع بازی.", "no_player", 404)
    }
    throw new ApiError("telegramId لازم است.", "no_telegram_id", 400)
  }
  const player = await getSessionPlayer()
  if (!player) throw new ApiError("نشستت معتبر نیست. دوباره وارد شو.", "unauthorized", 401)
  return player
}

/** آیا این درخواست با کلیدِ سرویسِ ربات آمده؟ (برای نماهای فقط-ربات مثل کارتِ عمومیِ فمبوی) */
export function isServiceCall(req: NextRequest): boolean {
  const serviceKey = req.headers.get("x-service-key")
  const trustedKey = getServiceKey()
  return !!serviceKey && !!trustedKey && keysMatch(serviceKey, trustedKey)
}

export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    if (body && typeof body === "object") return body as Record<string, unknown>
  } catch {
    /* body خالی */
  }
  return {}
}

export function handleApiError(e: unknown) {
  if (e instanceof ApiError) return jsonErr(e.message, e.status, e.code)
  console.error("[api]", e)
  return jsonErr("یه چیزی خراب شد. حتی ما هم نمی‌دونیم چرا.", 500, "internal")
}
