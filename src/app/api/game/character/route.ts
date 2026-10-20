import { NextRequest } from "next/server"
import { resolveCaller, isServiceCall, readBody, jsonOk, jsonErr, handleApiError } from "@/lib/game/api"
import { rateLimit, clientIp } from "@/lib/game/rate-limit"
import {
  getSyncedCharacter,
  soulCardDTO,
  classCardsDTO,
  personaCardsDTO,
  createCharacter,
  interactWithCharacter,
  rechargeStamina,
  applySpiritPotion,
  renameCharacter,
  upgradeSkill,
  evolveCharacter,
  evolutionDecisionDTO,
  equipAppearance,
  getCharLogs,
  publicFemboyCard,
  storyRead,
  storyChoose,
  INTERACTIONS,
} from "@/lib/game/character"
import { getActiveEncounter, combatStateDTO, availableEnemies } from "@/lib/game/combat"

export const dynamic = "force-dynamic"

// ─── GET: کارتِ فمبوی (یا بسته‌ی کلاس‌ها اگر پیمان نبسته) ──────────────────────
// حالتِ V8: ?targetTelegramId=… → کارتِ عمومی فمبویِ بازیکنِ هدف (فقط سرویسِ ربات)
export async function GET(req: NextRequest) {
  try {
    const targetParam = req.nextUrl.searchParams.get("targetTelegramId")
    if (targetParam !== null) {
      // نمایِ عمومی — فقط ربات (Mini App → 403)
      if (!isServiceCall(req)) return jsonErr("این نما فقط برای سرویس ربات است.", 403, "forbidden")
      const targetTelegramId = targetParam.trim()
      if (!targetTelegramId) return jsonErr("شناسه‌ی هدف لازم است.", 400, "bad_target")
      // نرخِ سبک: ۶۰ در دقیقه برای هر فراخواننده (ربات از یک IP می‌آید)
      const rl = rateLimit(`public-card:${clientIp(req)}`, 60, 60000)
      if (!rl.allowed) return jsonErr("دیتای شهر دارد جفت می‌شود — چند لحظه دیگر امتحان کن.", 429, "rate_limited")
      return jsonOk(await publicFemboyCard(targetTelegramId))
    }
    const player = await resolveCaller(req)
    const char = await getSyncedCharacter(player.id)
    const encounter = char ? await getActiveEncounter(player) : null
    if (!char) {
      // پیمان نبسته — بسته‌ی کلاس‌ها + طبع‌ها برای صفحه‌ی ساخت (V19)
      return jsonOk({ exists: false, classes: classCardsDTO(), personas: personaCardsDTO(), interactions: INTERACTIONS })
    }
    const card = soulCardDTO(char)
    const logs = await getCharLogs(char.id, 25)
    // V19 — خاطره‌های داستان داخلِ کارت (همان لاگ‌هایِ موجود، فیلترِ story)
    if (card.story) card.story.memories = logs.filter((l) => l.type === "story").slice(0, 5)
    return jsonOk({
      exists: true,
      card,
      logs,
      encounter: encounter ? combatStateDTO(encounter, char) : null,
      enemies: availableEnemies(card.level),
      interactions: INTERACTIONS,
    })
  } catch (e) {
    return handleApiError(e)
  }
}

// ─── POST: اکشن‌های فمبوی ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    const action = typeof body.action === "string" ? body.action : ""
    const payload = (body.payload as Record<string, unknown>) ?? {}

    switch (action) {
      case "create": {
        // نرخ‌گذاری: پیمانِ فمبوی، حداکثر ۵ تلاش در ۱۰ دقیقه — کلید = بازیکن (نه IP؛
        // ربات همه‌ی بازیکن‌ها را از یک IP می‌فرستد)
        const rl = rateLimit(`char-create:${player.telegramId ?? player.id}`, 5, 10 * 60000)
        if (!rl.allowed) return jsonErr("شهر این‌قدر فمبویِ تازه تحمل نمی‌کند — کمی بعد بیا.", 429, "rate_limited")
        const name = typeof payload.name === "string" ? payload.name : ""
        const classKey = typeof payload.classKey === "string" ? payload.classKey : ""
        const personaKey = typeof payload.personaKey === "string" ? payload.personaKey : undefined
        const res = await createCharacter(player, { name, classKey, personaKey })
        if (res.error || !res.char) return jsonErr(res.error ?? "پیمان بسته نشد.", 409, "create_failed")
        // V10 — کارت را از ردیفِ پس از اعطای کیهاناتِ پیمان بساز (نه از ردیفِ خام)
        const fresh = await getSyncedCharacter(player.id)
        const card = soulCardDTO(fresh ?? res.char)
        const personaLine = card.persona ? ` طبعِ ${card.persona.emoji} «${card.persona.name}» — ${card.persona.tagline}.` : ""
        return jsonOk({ message: `🎀 پیمان بسته شد — «${res.char.name}» از این‌به بعد فمبویِ اختصاصی توست. کلاسِ همیشگی‌اش: ${card.className}.${personaLine}`, card })
      }
      case "rename": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده — اسمی هم برای تغییر نیست.", 404, "no_character")
        const name = typeof payload.name === "string" ? payload.name : ""
        const res = await renameCharacter(player, char, name)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "rename_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "interact": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده — کسی نیست که با او وقت بگذرانی.", 404, "no_character")
        const kind = typeof payload.kind === "string" ? payload.kind : ""
        const res = await interactWithCharacter(player, char, kind)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "interact_failed")
        const fresh = await getSyncedCharacter(player.id)
        // V14 — فیلدهایِ عمقِ تعامل (variant/reaction/unlock/memory) به‌صورتِ
        // اختیاری به پاسخ می‌چسبند؛ مصرف‌کننده‌هایِ قدیمی فقط message/card می‌خوانند
        return jsonOk({
          message: res.ok.message,
          card: fresh ? soulCardDTO(fresh) : null,
          ...(res.ok.variant ? { variant: res.ok.variant } : {}),
          ...(res.ok.reaction ? { reaction: res.ok.reaction } : {}),
          ...(res.ok.unlock ? { unlock: res.ok.unlock } : {}),
          ...(res.ok.memory ? { memory: res.ok.memory } : {}),
        })
      }
      case "recharge": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        const units = typeof payload.units === "number" ? payload.units : 1
        const res = await rechargeStamina(player, char, units)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "recharge_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "potion": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        const res = await applySpiritPotion(player, char)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "potion_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "skillup": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        const skillId = typeof payload.skillId === "string" ? payload.skillId : ""
        const res = await upgradeSkill(player, char, skillId)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "skillup_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "evolve": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        // V10 — انتخابِ شاخه: payload.choice = 0 (الف/موروثی) یا 1 (ب)
        const rawChoice = typeof payload.choice === "number" ? payload.choice : 0
        const choice: 0 | 1 = rawChoice === 1 ? 1 : 0
        const res = await evolveCharacter(player, char, choice)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "evolve_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "evolutionChoice": {
        // V10 — پیش‌نمایشِ تصمیمِ فرگشت (هر دو شاخه + هشدارِ برگشت‌ناپذیری) — بدونِ تغییرِ وضعیت
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        return jsonOk({ decision: evolutionDecisionDTO(char) })
      }
      case "appearance": {
        // V10 — پوشیدن/درآوردنِ کیهنات: payload.slot ∈ accessory|palette|frame · payload.key (null = درآوردن)
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        const slotRaw = typeof payload.slot === "string" ? payload.slot : ""
        if (slotRaw !== "accessory" && slotRaw !== "palette" && slotRaw !== "frame")
          return jsonErr("جای ظاهر باید accessory یا palette یا frame باشد.", 400, "bad_slot")
        const key = payload.key === null ? null : typeof payload.key === "string" ? payload.key : undefined
        if (key === undefined) return jsonErr("کلیدِ کیهنات را بفرست (یا null برای درآوردن).", 400, "bad_key")
        const res = await equipAppearance(player, char, slotRaw, key)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "appearance_failed")
        const fresh = await getSyncedCharacter(player.id)
        return jsonOk({ message: res.ok.message, card: fresh ? soulCardDTO(fresh) : null })
      }
      case "logs": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده.", 404, "no_character")
        const logs = await getCharLogs(char.id, 30)
        return jsonOk({ logs })
      }
      // ── V19: داستانِ شخصی — خواندنِ فصل / انتخابِ پیامد ──
      case "story": {
        const char = await getSyncedCharacter(player.id)
        if (!char) return jsonErr("فمبوی اختصاصی تو هنوز آماده‌ی نبرده — قصه‌ای هم نیست.", 404, "no_character")
        const op = typeof payload.op === "string" ? payload.op : "read"
        if (op === "choose") {
          const choiceIdx = typeof payload.choice === "number" ? Math.max(0, Math.floor(payload.choice)) : -1
          const res = await storyChoose(player, char, choiceIdx)
          if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "story_failed")
          const fresh = await getSyncedCharacter(player.id)
          return jsonOk({ message: res.ok.message, story: res.ok.story, card: fresh ? soulCardDTO(fresh) : null })
        }
        const res = await storyRead(player, char)
        if (res.error || !res.ok) return jsonErr(res.error ?? "انجام نشد.", 409, "story_failed")
        return jsonOk({ message: res.ok.message, story: res.ok.story })
      }
      default:
        return jsonErr("چنین کاری برای فمبوی وجود ندارد.")
    }
  } catch (e) {
    return handleApiError(e)
  }
}
