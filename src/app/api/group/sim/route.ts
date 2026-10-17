// POST /api/group/sim — شبیه‌سازیِ توسعه‌ای (فقط service key، فقط dev).
// «سه گروه، سه دنیای متفاوت» — آزمونِ نهاییِ V5.

import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { simulate } from "@/lib/game/group/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const serviceKey = req.headers.get("x-service-key")
    if (!serviceKey || serviceKey !== getServiceKey()) {
      return jsonErr("فقط سرویسِ داخلی.", 401, "unauthorized")
    }
    // V13 موج ۱: گاردِ dev-only — شبیه‌سازیِ چند-بازیکنه در تولید بسته است
    // (دیتای واقعی کنارش هست؛ حتی با service key هم باز نمی‌شود).
    if (process.env.NODE_ENV !== "development") {
      return jsonErr("dev_only", 403, "dev_only")
    }
    const body = await readBody(req)
    const report = await simulate({
      groups: Number(body.groups ?? 3),
      playersPerGroup: Number(body.playersPerGroup ?? 5),
      minutes: Number(body.minutes ?? 20),
    })
    return jsonOk(report)
  } catch (e) {
    return handleApiError(e)
  }
}
