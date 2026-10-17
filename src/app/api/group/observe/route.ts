// POST /api/group/observe — ربات پیام‌های گروه را برای موتورِ حضور می‌فرستد.
// فقط با service key (ربات). منطقِ تصمیم server-side است.

import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { observe } from "@/lib/game/group/engine"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const serviceKey = req.headers.get("x-service-key")
    if (!serviceKey || serviceKey !== getServiceKey()) {
      return jsonErr("فقط ربات اجازه‌ی دیدن دارد.", 401, "unauthorized")
    }
    const body = await readBody(req)
    const chatId = typeof body.chatId === "string" ? body.chatId : ""
    const telegramId = typeof body.telegramId === "string" ? body.telegramId : ""
    const text = typeof body.text === "string" ? body.text.slice(0, 500) : ""
    if (!chatId || !telegramId) return jsonErr("chatId و telegramId لازم‌اند.", 400, "bad_request")
    if (!text.trim()) return jsonOk({ action: "none" })

    const result = await observe({
      chatId,
      chatTitle: typeof body.chatTitle === "string" ? body.chatTitle.slice(0, 60) : "",
      chatType: typeof body.chatType === "string" ? body.chatType : "group",
      telegramId,
      playerName: typeof body.playerName === "string" ? body.playerName.slice(0, 24) : undefined,
      text,
      addressedToBot: body.addressedToBot === true,
      replyToTelegramId: typeof body.replyToTelegramId === "string" && body.replyToTelegramId ? body.replyToTelegramId : null,
    })
    return jsonOk(result)
  } catch (e) {
    return handleApiError(e)
  }
}
