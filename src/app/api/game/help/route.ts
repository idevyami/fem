// POST /api/game/help — کدکسِ تعاملی (V14 Task 15b، Task C).
// action: "categories" → فهرستِ دسته‌ها · "topics" → فهرستِ موضوع‌های یک دسته
// (V14 موجِ 16b — سطحِ ۲ مرورگرِ مینی‌اپ) · "topic" → یک موضوع (صفحه‌بندیِ سمتِ سرور)
// · "search" → 5 نتیجه‌ی برتر.
// احرازِ هویت مثلِ routeهای هم‌سن‌وسال (guide/combat): نشستِ Mini App یا
// service-key ربات (resolveCaller). بدونِ هیچ نوشتنِ DB — راهنما خواندنی است.
// نرخِ ملایم: 120 خواندن در دقیقه برای هر IP (پیمایشِ کدکس نباید قفل شود).

import { NextRequest } from "next/server"
import { resolveCaller, readBody, jsonOk, jsonErr, handleApiError } from "@/lib/game/api"
import { rateLimit, clientIp } from "@/lib/game/rate-limit"
import {
  HELP_CATEGORIES, HELP_BLOCKS_PER_PAGE, getHelpCategory, getHelpTopic, helpTopicsOf, helpTopicPage, searchHelpTopics, helpTopicStub,
} from "@/lib/game/help/registry"
import type { HelpTopic } from "@/lib/game/help/registry"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    await resolveCaller(req, body) // نشستِ Mini App یا service-key ربات — مثل guide
    const rl = rateLimit(`help:${clientIp(req)}`, 120, 60000)
    if (!rl.allowed) return jsonErr("کدکس نفس می‌خواهد — یک لحظه صبر کن.", 429, "rate_limited")

    const action = typeof body.action === "string" ? body.action : ""

    // ─── دسته‌ها — منویِ سطحِ یک ──
    if (action === "categories") {
      const cats = HELP_CATEGORIES.map((c) => ({
        id: c.id,
        icon: c.icon,
        titleFa: c.titleFa,
        titleEn: c.titleEn,
        descFa: c.descFa,
        topicCount: helpTopicsOf(c.id).length,
      }))
      return jsonOk({ categories: cats })
    }

    // ─── موضوع‌های یک دسته — سطحِ دو (مینی‌اپ) ──
    if (action === "topics") {
      const catId = typeof body.categoryId === "string" ? body.categoryId : ""
      const cat = getHelpCategory(catId)
      if (!cat) return jsonErr("چنین دسته‌ای در کدکس نیست — شاید نسخه‌ی کهنه.", 404, "no_category")
      const topics = helpTopicsOf(catId).map(helpTopicStub)
      return jsonOk({ category: { id: cat.id, icon: cat.icon, titleFa: cat.titleFa, descFa: cat.descFa }, topics })
    }

    // ─── یک موضوع با صفحه‌بندیِ سمتِ سرور ──
    if (action === "topic") {
      const id = typeof body.id === "string" ? body.id : ""
      const page = Number.isFinite(Number(body.page)) ? Math.max(0, Math.floor(Number(body.page))) : 0
      const topic = getHelpTopic(id)
      if (!topic) return jsonErr("چنین موضوعی در کدکس نیست — شاید نسخه‌ی کهنه.", 404, "no_topic")
      const perPage = typeof body.perPage === "number" && body.perPage >= 1 && body.perPage <= 10 ? Math.floor(body.perPage) : HELP_BLOCKS_PER_PAGE
      const { blocks, page: safePage, pageCount } = helpTopicPage(topic, page, perPage)
      // related به‌صورتِ stub حل می‌شود تا مینی‌اپ بتواند چیپِ پرش بسازد (موجِ 16b)
      const related = (topic.related ?? [])
        .map((rid) => getHelpTopic(rid))
        .filter((r): r is HelpTopic => r !== null)
        .map((r) => ({ id: r.id, icon: r.icon, titleFa: r.titleFa, summaryFa: r.summaryFa }))
      return jsonOk({
        topic: { ...helpTopicStub(topic), related, phrases: topic.phrases ?? [], examples: topic.examples ?? [] },
        blocks,
        page: safePage,
        pageCount,
      })
    }

    // ─── جست‌وجو ──
    if (action === "search") {
      const q = typeof body.q === "string" ? body.q.trim().slice(0, 80) : ""
      if (!q) return jsonOk({ results: [] })
      const results = searchHelpTopics(q, 5).map((m) => ({
        id: m.topic.id,
        icon: m.topic.icon,
        titleFa: m.topic.titleFa,
        summaryFa: m.topic.summaryFa,
        matchedOn: m.matchedOn,
      }))
      return jsonOk({ results })
    }

    return jsonErr("چنین کاری در کدکس نیست.", 400, "bad_action")
  } catch (e) {
    return handleApiError(e)
  }
}
