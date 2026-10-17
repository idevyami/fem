import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { tickAndSnapshot, buildSnapshot } from "@/lib/game/engine"
import { jsonOk, handleApiError, resolveCaller, readBody } from "@/lib/game/api"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const { snapshot } = await tickAndSnapshot(player)
    return jsonOk({ snapshot })
  } catch (e) {
    return handleApiError(e)
  }
}
