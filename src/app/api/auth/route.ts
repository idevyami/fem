import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { loginSchema } from "@/lib/game/types"
import { login, getSessionPlayer, createPlayer } from "@/lib/game/session"
import { tickAndSnapshot } from "@/lib/game/engine"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { worldTick } from "@/lib/game/world"
import { rateLimit, clientIp } from "@/lib/game/rate-limit"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)

    // حالت سرویس (ربات تلگرام): upsert بازیکن با telegramId
    const serviceKey = req.headers.get("x-service-key")
    if (serviceKey && serviceKey === getServiceKey() && typeof body.telegramId === "string") {
      const tgId = String(body.telegramId)
      const name = typeof body.name === "string" ? body.name.slice(0, 24) : `مسافر ${tgId.slice(-4)}`
      const avatar = typeof body.avatar === "string" ? body.avatar.slice(0, 8) : "🧑‍🦰"
      let player = await db.player.findUnique({ where: { telegramId: tgId } })
      let created = false
      if (!player) {
        player = await createPlayer(name, avatar, tgId)
        created = true
      }
      const { snapshot } = await tickAndSnapshot(player)
      return jsonOk({ playerId: player.id, created, onboarded: player.onboarded, snapshot })
    }

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) return jsonErr("ورودی معتبر نیست.")

    // محدودسازی نرخ: لاگین عمومی ۱۲ بار در دقیقه برای هر IP (ضد brute-force)
    const ip = clientIp(req)
    const loginLimit = rateLimit(`login:${ip}`, 12, 60_000)
    if (!loginLimit.allowed) {
      return jsonErr(`خیلی تلاش کردی. ${loginLimit.retryAfterSec} ثانیه صبر کن.`, 429, "rate_limited")
    }
    // ساخت بازیکن مهمان: حداکثر ۳ بازیکن جدید در ۱۰ دقیقه برای هر IP (ضد دام‌سازی)
    if (parsed.data.name && !parsed.data.initData) {
      const guestLimit = rateLimit(`guest:${ip}`, 3, 600_000)
      if (!guestLimit.allowed) {
        return jsonErr(
          `شهر به همین اندازه مهمان می‌پذیرد. ${Math.ceil(guestLimit.retryAfterSec / 60)} دقیقه دیگر برگرد.`,
          429,
          "rate_limited",
        )
      }
    }

    const result = await login(parsed.data)
    if ("error" in result) return jsonErr(result.error, 401, "login_failed")

    // اولین snapshot با tick — شامل خلاصه‌ی «در نبودت» اگر برگشته باشد
    const { snapshot } = await tickAndSnapshot(result.player)
    return jsonOk({
      playerId: result.player.id,
      created: result.created,
      onboarded: result.player.onboarded,
      snapshot,
    })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function GET(req: NextRequest) {
  try {
    const player = await getSessionPlayer()
    if (!player) return jsonErr("نشستت معتبر نیست. دوباره وارد شو.", 401, "unauthorized")
    await worldTick()
    const { snapshot } = await tickAndSnapshot(player)
    return jsonOk({ playerId: player.id, created: false, onboarded: player.onboarded, snapshot })
  } catch (e) {
    return handleApiError(e)
  }
}
