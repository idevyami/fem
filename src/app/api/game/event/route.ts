import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { drawEvent, buildSnapshot, tickAndSnapshot } from "@/lib/game/engine"
import { jsonOk, jsonErr, handleApiError, resolveCaller, readBody } from "@/lib/game/api"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    // tick اول تا جهان و بازیکن تازه باشند
    await tickAndSnapshot(player)
    // بازیکن ممکن است در tick تغییر کرده باشد — دوباره می‌خوانیم
    const fresh = await db.player.findUniqueOrThrow({ where: { id: player.id } })
    const result = await drawEvent(fresh)
    if (result.error || !result.event) {
      return jsonErr(result.error ?? "الان اتفاقی نیست.", 409, "no_event")
    }
    const after = await db.player.findUniqueOrThrow({ where: { id: player.id } })
    const snapshot = await buildSnapshot(after)
    return jsonOk({ event: snapshot.activeEvent, snapshot })
  } catch (e) {
    return handleApiError(e)
  }
}
