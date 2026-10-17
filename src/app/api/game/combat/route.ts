import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { resolveCaller, readBody, jsonOk, jsonErr, handleApiError } from "@/lib/game/api"
import { rateLimit, clientIp } from "@/lib/game/rate-limit"
import { getSyncedCharacter, soulCardDTO } from "@/lib/game/character"
import { startPve, actOnEncounter, duelCharacters, getActiveEncounter, combatStateDTO, availableEnemies, sweepExpired, type CombatAct } from "@/lib/game/combat"

export const dynamic = "force-dynamic"

// ─── GET: نبردِ فعال + لیستِ شکار ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const player = await resolveCaller(req)
    const char = await getSyncedCharacter(player.id)
    if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده — اول پیمانِ فمبوی را ببند.", 404, "no_character")
    const encounter = await getActiveEncounter(player)
    return jsonOk({
      encounter: encounter ? combatStateDTO(encounter, char) : null,
      card: soulCardDTO(char),
      enemies: availableEnemies(char.level),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

// ─── POST: start | act | duel ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const action = typeof body.action === "string" ? body.action : ""
    const payload = (body.payload as Record<string, unknown>) ?? {}

    // نرخِ اکشنِ نبرد: ۴۰ در دقیقه برای هر IP (ضربه‌زنیِ انسانی)
    const rl = rateLimit(`combat:${clientIp(req)}`, 40, 60000)
    if (!rl.allowed) return jsonErr("دست‌هایت استراحت می‌خواهد — یک لحظه نفس بکش.", 429, "rate_limited")

    switch (action) {
      case "start": {
        const enemyKey = typeof payload.enemyKey === "string" ? payload.enemyKey : ""
        const res = await startPve(player, enemyKey)
        if (res.error || !res.enc) return jsonErr(res.error ?? "نبرد شروع نشد.", 409, "start_failed")
        const char = res.char ?? (await getSyncedCharacter(player.id))
        return jsonOk({ encounter: combatStateDTO(res.enc, char!), card: soulCardDTO(char!) })
      }
      case "act": {
        const encounterId = typeof payload.encounterId === "string" ? payload.encounterId : ""
        const act = typeof payload.act === "string" ? payload.act : ""
        if (!encounterId) return jsonErr("کدام نبرد؟")
        if (!["strike", "skill", "guard", "flee"].includes(act)) return jsonErr("چنین حرکتی بلد نیست.")
        const res = await actOnEncounter(player, encounterId, act as CombatAct)
        if (res.error || !res.enc) return jsonErr(res.error ?? "راند انجام نشد.", 409, "act_failed")
        const char = res.char ?? (await getSyncedCharacter(player.id))
        return jsonOk({ encounter: combatStateDTO(res.enc, char!), card: soulCardDTO(char!) })
      }
      case "duel": {
        // حریف با telegramId (ربات) یا playerId (Mini App)
        const foeTelegramId = typeof payload.foeTelegramId === "string" ? payload.foeTelegramId : null
        const foePlayerId = typeof payload.foePlayerId === "string" ? payload.foePlayerId : null
        const groupId = typeof payload.groupId === "string" ? payload.groupId : null
        const foe = foeTelegramId
          ? await db.player.findUnique({ where: { telegramId: foeTelegramId } })
          : foePlayerId
            ? await db.player.findUnique({ where: { id: foePlayerId } })
            : null
        if (!foe) return jsonErr("چنین حریفی در این شهر ثبت نشده.", 404, "no_foe")
        const res = await duelCharacters(player, foe, groupId ?? undefined)
        if (res.error || !res.duel) return jsonErr(res.error ?? "دوئل انجام نشد.", 409, "duel_failed")
        return jsonOk({ duel: res.duel })
      }
      case "sweep": {
        await sweepExpired(player.id)
        const char = await getSyncedCharacter(player.id)
        const encounter = char ? await getActiveEncounter(player) : null
        return jsonOk({ encounter: encounter && char ? combatStateDTO(encounter, char) : null })
      }
      default:
        return jsonErr("چنین کاری در نبرد وجود ندارد.")
    }
  } catch (e) {
    return handleApiError(e)
  }
}
