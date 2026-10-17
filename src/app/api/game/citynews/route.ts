import { NextRequest } from "next/server"
import { readBody, jsonOk, jsonErr, handleApiError, getServiceKey } from "@/lib/game/api"
import { getSessionPlayer } from "@/lib/game/session"
import { buildCityNews } from "@/lib/game/citynews"

export const dynamic = "force-dynamic"

// اخبارِ شهر — بدون بازیکن هم کار می‌کند (برای گروه‌ها).
// احراز: یا کلیدِ سرویس (telegramId اختیاری)، یا session بازیکن.
export async function POST(req: NextRequest) {
  try {
    await readBody(req)
    const serviceKey = req.headers.get("x-service-key")
    if (!serviceKey || serviceKey !== getServiceKey()) {
      const player = await getSessionPlayer()
      if (!player) return jsonErr("نشستت معتبر نیست. دوباره وارد شو.", 401, "unauthorized")
    }
    const news = await buildCityNews()
    return jsonOk(news)
  } catch (e) {
    return handleApiError(e)
  }
}
