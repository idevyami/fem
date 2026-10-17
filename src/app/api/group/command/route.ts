// POST /api/group/command (موجِ ۲) — فرمان‌ها و callback های گروهیِ ربات (service key).
// action: "command" | "callback" | "member" (new_chat_members) | "member_left" (left_chat_member)
// V13 موج ۱: chatTitle حالا برای همه‌ی کنش‌ها پاس می‌شود (شفادهیِ «شهرِ بی‌نام»).
// V13 موج ۲: آرگومانِ فرمان (قراردادِ /duel {targetTelegramId}) + پرچمِ isAdmin
// (ادمینِ تاییدشده‌ی زنده توسطِ ربات — فقط با service key؛ قراردادِ اعتماد در router.ts).

import { NextRequest } from "next/server"
import "@/lib/bot-keeper"
import { db } from "@/lib/db"
import { jsonOk, jsonErr, readBody, handleApiError, getServiceKey } from "@/lib/game/api"
import { groupCommand, groupCallback, registerMember, groupTick, reportDelivered, markGroupUnreachable, memberLeft } from "@/lib/game/group/engine"
import type { Player } from "@prisma/client"

export const dynamic = "force-dynamic"

async function playerByTelegram(telegramId: string): Promise<Player | null> {
  return db.player.findUnique({ where: { telegramId } })
}

export async function POST(req: NextRequest) {
  try {
    const serviceKey = req.headers.get("x-service-key")
    if (!serviceKey || serviceKey !== getServiceKey()) {
      return jsonErr("فقط ربات.", 401, "unauthorized")
    }
    const body = await readBody(req)
    const chatId = typeof body.chatId === "string" ? body.chatId : ""
    const telegramId = typeof body.telegramId === "string" ? body.telegramId : ""
    if (!chatId) return jsonErr("chatId لازم است.", 400, "bad_request")

    const action = String(body.action ?? "command")

    // ─── ثبتِ عضو (new_chat_members / اولین پیام) ──
    if (action === "member") {
      if (!telegramId) return jsonErr("telegramId لازم است.", 400, "bad_request")
      const r = await registerMember(chatId, String(body.chatTitle ?? ""), telegramId, String(body.playerName ?? ""))
      return jsonOk({ welcomed: r.member.isNew })
    }

    // ─── رفتنِ عضو (left_chat_member؛ V13 موج ۱) ──
    // کشِ جمعیت یکی کم می‌شود؛ ردیفِ عضویت برای بازگشت می‌ماند؛ عضوِ نبودِه = no-op.
    if (action === "member_left") {
      if (!telegramId) return jsonErr("telegramId لازم است.", 400, "bad_request")
      const r = await memberLeft(chatId, telegramId)
      return jsonOk({ left: r.left })
    }

    // ─── گزارشِ تحویل (messageId برای ویرایش‌های بعدی) + چت‌های بی‌دسترسی ──
    if (action === "delivered") {
      const reports = Array.isArray(body.delivered) ? body.delivered : []
      for (const r of reports) {
        if (r && typeof r === "object" && typeof (r as Record<string, unknown>).outboxId === "string") {
          const mid = (r as Record<string, unknown>).messageId
          await reportDelivered((r as Record<string, string>).outboxId, typeof mid === "number" || typeof mid === "string" ? mid : "")
        }
      }
      // چت‌هایی که تلگرام پیام‌شان را برای همیشه رد کرد (ربات حذف شده) —
      // آن شهرها تا بازگشتِ ربات خاموش می‌مانند تا خطا و پیام انبار نشود.
      const unreachable = Array.isArray(body.unreachable) ? body.unreachable : []
      const paused: string[] = []
      for (const c of unreachable) {
        if (typeof c === "string" && c.trim()) {
          if (await markGroupUnreachable(c.trim())) paused.push(c.trim())
        }
      }
      return jsonOk({ ok: true, ...(paused.length > 0 ? { paused } : {}) })
    }

    // ─── فرمان ──
    if (action === "command") {
      if (!telegramId) return jsonErr("telegramId لازم است.", 400, "bad_request")
      const player = await playerByTelegram(telegramId)
      if (!player) return jsonErr("اول در خصوصیِ ربات «شروع بازی» را بگو تا شهروند شوی.", 404, "no_player")
      // موجِ ۲: آرگومانِ فرمان حفظ می‌شود — قراردادِ /duel {targetTelegramId}
      // (رباتِ موجِ ۵ شناسه‌ی هدف را همراهِ فرمان می‌فرستد؛ فرمان‌هایِ دیگر آرگومان ندارند)
      const raw = String(body.command ?? "game").replace(/^\//, "")
      const spaceAt = raw.indexOf(" ")
      const command = (spaceAt === -1 ? raw : raw.slice(0, spaceAt)).trim() || "game"
      const arg = spaceAt === -1 ? undefined : raw.slice(spaceAt + 1).trim() || undefined
      const chatTitle = typeof body.chatTitle === "string" ? body.chatTitle.slice(0, 60) : ""
      // isAdmin — پرچمِ ادمینِ تاییدشده‌ی زنده توسطِ ربات (getChatMember)؛ فقط با
      // service key قابلِ فرستادن است (قراردادِ اعتماد در router.ts)
      const isAdmin = body.isAdmin === true
      const r = await groupCommand(chatId, command, player, arg, { chatTitle, isAdmin })
      // kind (موجِ ۲) — فقط /game آن را «home» می‌فرستد؛ رباتِ موجِ ۵ با آن کارت را
      // در جایش ویرایش می‌کند (به‌جای پیامِ تازه). افزودنی — رباتِ امروز نادیده می‌گیرد.
      return jsonOk({ text: r.text, buttons: r.buttons, ...(r.kind ? { kind: r.kind } : {}) })
    }

    // ─── callback ──
    if (action === "callback") {
      if (!telegramId) return jsonErr("telegramId لازم است.", 400, "bad_request")
      const data = String(body.data ?? "")
      if (!data) return jsonErr("data لازم است.", 400, "bad_request")
      const player = await playerByTelegram(telegramId)
      if (!player) return jsonErr("اول در خصوصیِ ربات «شروع بازی» را بگو.", 404, "no_player")
      const chatTitle = typeof body.chatTitle === "string" ? body.chatTitle.slice(0, 60) : ""
      const isAdmin = body.isAdmin === true
      const r = await groupCallback(chatId, player, data, { chatTitle, isAdmin })
      return jsonOk(r)
    }

    // ─── تیک (شبیک‌بانِ ربات) ──
    if (action === "tick") {
      const r = await groupTick(2)
      return jsonOk(r)
    }

    return jsonErr("action نامعتبر.", 400, "bad_action")
  } catch (e) {
    return handleApiError(e)
  }
}
