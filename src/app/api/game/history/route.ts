import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { resolveCaller, readBody, jsonOk, handleApiError } from "@/lib/game/api"
import type { HistoryItemDTO } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const cursor = typeof body.cursor === "number" ? (body.cursor as number) : 0
    const take = Math.min(50, Math.max(5, typeof body.limit === "number" ? (body.limit as number) : 25))

    const rows = await db.historyEntry.findMany({
      where: { playerId: player.id },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { skip: cursor } : {}),
    })
    const hasMore = rows.length > take
    const page = rows.slice(0, take)
    const items: HistoryItemDTO[] = page.map((h) => ({
      id: h.id,
      icon: h.icon,
      text: h.text,
      category: h.category,
      day: h.day,
      at: h.createdAt.toISOString(),
    }))
    return jsonOk({ items, hasMore, nextCursor: cursor + page.length })
  } catch (e) {
    return handleApiError(e)
  }
}
