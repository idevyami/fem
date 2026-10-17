import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { actionSchema } from "@/lib/game/types"
import { runAction } from "@/lib/game/actions"
import { buildSnapshot } from "@/lib/game/engine"
import { jsonOk, jsonErr, handleApiError, resolveCaller, readBody } from "@/lib/game/api"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const parsed = actionSchema.safeParse({ action: body.action, payload: body.payload })
    if (!parsed.success) return jsonErr("چنین کاری وجود ندارد.")
    const result = await runAction(player, parsed.data.action, (parsed.data.payload as Record<string, unknown>) ?? {})
    if (result.error || !result.ok) {
      return jsonErr(result.error ?? "انجام نشد.", 409, "action_failed")
    }
    const fresh = await db.player.findUniqueOrThrow({ where: { id: player.id } })
    const snapshot = await buildSnapshot(fresh)
    return jsonOk({
      message: result.ok.message,
      flavor: result.ok.flavor ?? null,
      deltas: result.ok.deltas,
      snapshot,
      extra: result.ok.extra ?? null,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
