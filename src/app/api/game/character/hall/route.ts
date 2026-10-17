import { NextRequest } from "next/server"
import { resolveCaller, jsonOk, jsonErr, handleApiError } from "@/lib/game/api"
import { hallOfFame } from "@/lib/game/character"

export const dynamic = "force-dynamic"

// ─── GET: تالارِ افتخارات ─────────────────────────────────────────────────────
// ?board=level|wins|winrate|crits|evolution
export async function GET(req: NextRequest) {
  try {
    // احرازِ هویت: هر دو کلاینت؛ ولی داده‌ی عمومی است (فقط کاراکتر/بازیکنِ عمومی)
    await resolveCaller(req)
    const board = req.nextUrl.searchParams.get("board") ?? "level"
    const hall = await hallOfFame(board)
    return jsonOk(hall)
  } catch (e) {
    return handleApiError(e)
  }
}
