// POST /api/group/action — کنش‌های Mini App روی جهانِ گروه (session-auth).

import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { db } from "@/lib/db"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { getSessionPlayer } from "@/lib/game/session"
import { groupAction } from "@/lib/game/group/engine"
import type { Player } from "@prisma/client"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const chatId = typeof body.chatId === "string" ? body.chatId : ""
    if (!chatId) return jsonErr("chatId لازم است.", 400, "bad_request")

    let player: Player | null = null
    const serviceKey = req.headers.get("x-service-key")
    if (serviceKey && serviceKey === getServiceKey() && typeof body.telegramId === "string") {
      player = await db.player.findUnique({ where: { telegramId: body.telegramId } })
    } else {
      player = await getSessionPlayer()
    }
    if (!player) return jsonErr("نشستت معتبر نیست. دوباره وارد شو.", 401, "unauthorized")

    const action = String(body.action ?? "")
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>
    const r = await groupAction(chatId, player, action, payload)
    return jsonOk(r)
  } catch (e) {
    return handleApiError(e)
  }
}
