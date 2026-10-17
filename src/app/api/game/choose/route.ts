import { NextRequest } from "next/server"
import { chooseSchema } from "@/lib/game/types"
import { resolveChoice } from "@/lib/game/engine"
import { jsonOk, jsonErr, handleApiError, resolveCaller, readBody } from "@/lib/game/api"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const parsed = chooseSchema.safeParse({ eventId: body.eventId, optionIndex: body.optionIndex })
    if (!parsed.success) return jsonErr("انتخاب معتبر نیست.")
    const result = await resolveChoice(player.id, parsed.data.eventId, parsed.data.optionIndex)
    if (result.error || !result.result) {
      return jsonErr(result.error ?? "نتیجه‌ای در کار نبود.", 409, "resolve_failed")
    }
    return jsonOk(result.result)
  } catch (e) {
    return handleApiError(e)
  }
}
