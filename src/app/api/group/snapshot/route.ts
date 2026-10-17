// POST /api/group/snapshot — صفحه‌ی «شهرِ گروه» در Mini App.
// session-auth (Mini App) یا service-key (ربات).

import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { db } from "@/lib/db"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { getSessionPlayer } from "@/lib/game/session"
import { groupSnapshot, playerGroups } from "@/lib/game/group/engine"
import { playableGames } from "@/lib/game/group/games"
import { ensureGroup } from "@/lib/game/group/domain"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    let chatId = typeof body.chatId === "string" ? body.chatId : ""
    let viewerId: string | undefined

    // ۱) ربات
    const serviceKey = req.headers.get("x-service-key")
    if (serviceKey && serviceKey === getServiceKey()) {
      const tg = typeof body.telegramId === "string" ? body.telegramId : ""
      if (tg) {
        const p = await db.player.findUnique({ where: { telegramId: tg } })
        viewerId = p?.id
      }
    } else {
      // ۲) Mini App — session
      const player = await getSessionPlayer()
      if (!player) return jsonErr("نشستت معتبر نیست.", 401, "unauthorized")
      viewerId = player.id
    }

    // بدون chatId → گروه‌هایِ من
    if (!chatId) {
      const groups = await playerGroups(viewerId ?? "")
      return jsonOk({ groups, snapshot: null, games: [] })
    }

    const snapshot = await groupSnapshot(chatId, viewerId)
    const groups = viewerId ? await playerGroups(viewerId) : []
    const group = await ensureGroup(chatId)
    const games = await playableGames(group)
    return jsonOk({ groups, snapshot, games })
  } catch (e) {
    return handleApiError(e)
  }
}
