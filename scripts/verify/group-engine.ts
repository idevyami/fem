// FEMBOY WAR 🎀 — V13 Wave 4 (Task 8): PERSISTENT VERIFICATION HARNESS — engine side.
//
// Runs against the LIVE engine over real HTTP (http://localhost:3000) exactly as the
// bot does (X-Service-Key header) + direct DB reads for state assertions. Never
// restarts anything; works while the real bot polls the same engine.
//
// V13 Part 10 mapping (see scripts/verify/README.md):
//   §0  health + transport auth                     → 10.2 service contracts
//   §R  router determinism + unknown grammar        → 10.1 routing/callback validation
//   §A  new player (welcome → pact → recognized)    → 10.3 Scenario A
//   §B  existing player (activity + valid action)   → 10.3 Scenario B
//   §C  multiplayer duel challenge + exactly-once   → 10.3 Scenario C
//   §D  cross-group isolation                       → 10.3 Scenario D
//   §E  failure & recovery (expiry/pause/recover)   → 10.3 Scenario E
//   §F  regression (private bot/Mini App contracts) → 10.3 Scenario F
//   §U  unit-ish extras (gates/dupe/awards math)    → 10.1
//   §V  V14 Wave 1 (15a): class desc/data truth, group→soul XP (+caps),
//       duel class passives (resultJson + determinism), state-aware
//       interactions, soulCardDTO Layer B explanations → V14 mission II/III
//
// Throwaway discipline (NEVER touches real rows destructively):
//   • players   telegramId = "99" + last-9-of-Date.now() + n  (≥ 99000000, unique/run)
//   • groups    chatId     = "-10099" + rand + n
//   • direct-DB writes are fixtures on THROWAWAY rows only (expiresAt fast-forward,
//     lastTickAt rewind, settingsJson corruption) — the pattern the waves established.
//   • cleanup in finally; real counts (players/groups) verified unchanged start+end.
//   • the LIVE bot may tick/drain throwaway groups concurrently — every state flip in
//     the engine is conditional (replay-safe), so concurrent tickers converge on the
//     same end-state; assertions read rows, never wait for delivery.
//
// Run: bun scripts/verify/group-engine.ts   (from repo root; needs the dev engine up)

import { db } from "../../src/lib/db"
import { getServiceKey } from "../../src/lib/game/secrets"
import { mulberry32, seedFrom, randInt, weightedPick, clamp } from "../../src/lib/game/rng"
import { getEventTemplate, eventCardText } from "../../src/lib/game/group/events"
import { eventPacingInfo, eventWindowMinutes, EVENT_GAP_MINUTES, EVENT_MSG_QUOTA } from "../../src/lib/game/group/pacing"
import { playableGames } from "../../src/lib/game/group/games"
import type { GroupEventTemplate } from "../../src/lib/game/group/types"
import { CLASSES, validateClasses } from "../../src/lib/game/content/classes"
import { awardSoulProgress, SOUL_GROUP_XP_DAY_CAP } from "../../src/lib/game/group/awards"
import { duelCharacters, simulateDuel, type DuelSheet } from "../../src/lib/game/combat"
import { interactWithCharacter, soulCardDTO } from "../../src/lib/game/character"

const API = process.env.API_BASE || "http://localhost:3000"
const KEY = getServiceKey()

// ─── HTTP (exactly the bot's transport) ────────────────────────────────────────

interface Envelope<T> { ok: boolean; data?: T; error?: string; code?: string }
interface Btn { label: string; style: string | null; cb?: string; url?: string; sameRow?: boolean }
interface CmdData { text: string; buttons: Btn[]; kind?: string }
interface CbData { ok: boolean; ackText: string; editCard?: { text: string; buttons: Btn[] } }

async function call<T>(path: string, method: "GET" | "POST", body: unknown, withKey: boolean): Promise<{ status: number; body: Envelope<T> }> {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(withKey && KEY ? { "x-service-key": KEY } : {}) },
    ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
  })
  let parsed: Envelope<T>
  try { parsed = (await res.json()) as Envelope<T> } catch { parsed = { ok: false, error: `unparseable:${res.status}` } }
  return { status: res.status, body: parsed }
}
const post = <T>(path: string, body: unknown, withKey = true) => call<T>(path, "POST", body, withKey)
const get = <T>(path: string, withKey = true) => call<T>(path, "GET", undefined, withKey)

// engine group-transport verbs — mirror of mini-services/bot/src/api.ts
const groupCommand = <T>(action: string, payload: Record<string, unknown>) =>
  post<T>("/api/group/command", { action, ...payload })
const member = (chatId: string, title: string, telegramId: string, playerName: string) =>
  groupCommand<{ welcomed: boolean }>("member", { chatId, chatTitle: title, telegramId, playerName })
const command = (chatId: string, telegramId: string, cmd: string, isAdmin = false) =>
  groupCommand<CmdData>("command", { chatId, chatTitle: "شهرِ آزمونِ موج ۴", telegramId, command: cmd, ...(isAdmin ? { isAdmin: true } : {}) })
const callback = (chatId: string, telegramId: string, data: string, isAdmin = false) =>
  groupCommand<CbData>("callback", { chatId, chatTitle: "شهرِ آزمونِ موج ۴", telegramId, data, ...(isAdmin ? { isAdmin: true } : {}) })
const tick = () => groupCommand<{ messages: unknown[]; groupsTicked: number }>("tick", { chatId: "__global__" })

// ─── assertions ────────────────────────────────────────────────────────────────

let pass = 0
let fail = 0
const failures: string[] = []
function ok(cond: boolean, label: string, detail = ""): void {
  if (cond) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; failures.push(label); console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`) }
}
function section(name: string): void { console.log(`\n══ ${name} ══`) }

// ─── throwaway registry + fixtures ─────────────────────────────────────────────

const RUN = Date.now()
const STAMP = String(RUN).slice(-9)
const tids: string[] = []     // throwaway telegram ids (players) — unique values
const chats: string[] = []    // throwaway group chat ids
const tidSeen = new Map<number, string>()
const tid = (n: number) => {
  const seen = tidSeen.get(n)
  if (seen) return seen
  const t = `99${STAMP}${n}`
  tidSeen.set(n, t)
  tids.push(t)
  return t
}
const chat = (n: number) => { const c = `-10099${String(RUN % 100000)}${n}`; chats.push(c); return c }

async function gidOf(chatId: string): Promise<string> {
  const g = await db.groupWorld.findUnique({ where: { chatId }, select: { id: true } })
  if (!g) throw new Error(`group ${chatId} not found`)
  return g.id
}
async function pidOf(t: string): Promise<string> {
  const p = await db.player.findUnique({ where: { telegramId: t }, select: { id: true } })
  if (!p) throw new Error(`player ${t} not found`)
  return p.id
}

/** V18 — مسلح‌کردنِ ریتمِ هوشمندِ شهرِ آزمونی: ۳ ساعت از آخرین ماجرا + ۱۵۰ پیام
 *  (دروازه‌ی ۲ ساعت + ۱۰۰ پیام را باز می‌کند؛ fixture روی ردیفِ آزمونی — الگویِ موج‌ها). */
async function armEventPacing(chatId: string): Promise<void> {
  const gid = await gidOf(chatId)
  const g = await db.groupWorld.findUniqueOrThrow({ where: { id: gid } })
  const culture = JSON.parse(g.cultureJson ?? "{}") as Record<string, unknown>
  culture.msgsSinceEvent = 150
  await fixture(async () => {
    await db.groupWorld.update({
      where: { id: gid },
      data: { cultureJson: JSON.stringify(culture), lastEventAt: new Date(Date.now() - 3 * 3600 * 1000) },
    })
  })
}
/** SQLite can be briefly busy while the dev engine writes — retry small fixtures. */
async function fixture<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= 4 || !String(e).includes("locked")) throw e
      await new Promise((r) => setTimeout(r, 250 * (i + 1)))
    }
  }
}

const outboxButtons = (text: string): Btn[] => { try { return JSON.parse(text) as Btn[] } catch { return [] } }

// awards-math oracle — replicates resolveGroupEvent's deterministic seeding
// (same pure fns: rng.ts + the template catalog) to predict exact stat deltas.
function expectedOutcomeStats(template: GroupEventTemplate, eventId: string, playerId: string, choiceKey: string):
  { stat: string; amount: number }[] | null {
  const choice = template.choices.find((c) => c.key === choiceKey)
  if (!choice) return null
  const outcome = weightedPick(choice.outcomes, mulberry32(seedFrom("geo", eventId, playerId))) ?? choice.outcomes[0]
  if (!outcome) return null
  const rng = mulberry32(seedFrom("eff", eventId, playerId, outcome.text.length))
  return (outcome.effects?.playerStats ?? []).map((ps) => ({ stat: ps.stat, amount: randInt(ps.min, ps.max, rng) }))
}

// ─── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // §0 — baseline (real data guard) + transport health/auth ─────────────────────
  section("§0 baseline + health + auth (10.2)")
  {
    const health = await get<{ ok: boolean; db: boolean }>("/api/health", false)
    ok(health.status === 200 && health.body.ok === true && (health.body.data?.db ?? false) === true, "GET /api/health → ok + db true")

    const noKey = await post<unknown>("/api/group/command", { action: "command", chatId: "-1", telegramId: "1", command: "game" }, false)
    ok(noKey.status === 401 && noKey.body.ok === false && noKey.body.code === "unauthorized" && noKey.body.error === "فقط ربات.", "no service key → 401 «فقط ربات.»")
  }

  // §R — router determinism (10.1) on a fresh quiet throwaway group ─────────────
  section("§R router determinism + unknown grammar (10.1)")
  {
    const cR = chat(1), uR = tid(1)
    const m = await member(cR, "شهرِ قطعیت", uR, "قطعی")
    ok(m.status === 200 && m.body.ok === true && m.body.data?.welcomed === true, "member registration → welcomed:true")
    const g1 = await command(cR, uR, "game")
    const g2 = await command(cR, uR, "game")
    ok(g1.status === 200 && g1.body.ok === true && g1.body.data?.kind === "home", "/game → 200 + kind:'home'")
    ok(g1.body.data?.text === g2.body.data?.text && JSON.stringify(g1.body.data?.buttons) === JSON.stringify(g2.body.data?.buttons) && g1.body.data?.kind === g2.body.data?.kind, "same /game payload twice → byte-identical card (text+buttons+kind)")
    const h1 = await command(cR, uR, "help")
    const h2 = await command(cR, uR, "help")
    ok(h1.body.data?.text === h2.body.data?.text && JSON.stringify(h1.body.data?.buttons) === JSON.stringify(h2.body.data?.buttons), "same /help payload twice → byte-identical card")
    // V13 §VI — کارتِ راهنمای موتور: بدونِ هیچ فرمانِ اسلش در متنِ قابل‌مشاهده
    ok(!/\/[a-z]+/i.test(String(h1.body.data?.text ?? "").replace(/<[^>]+>/g, "")), "/help card visible text carries zero slash tokens (V13 §VI)")
    const dU = await command(cR, uR, "duel") // بدونِ هدف → کارتِ راهنمای دوئل
    ok(!/\/[a-z]+/i.test(String(dU.body.data?.text ?? "").replace(/<[^>]+>/g, "")), "duel usage card visible text carries zero slash tokens (V13 §VI)")
    const cb1 = await callback(cR, uR, "gm:game")
    const cb2 = await callback(cR, uR, "gm:game")
    ok(cb1.body.data?.ok === true && cb1.body.data?.editCard?.text === cb2.body.data?.editCard?.text, "same gm:game callback twice → identical editCard")
    const unk = await command(cR, uR, "frobnicate")
    ok(unk.body.data?.text === "چنین فرمانی در دفترِ شهر نیست.", "unknown command → «چنین فرمانی در دفترِ شهر نیست.»")
    const unkCb = await callback(cR, uR, "zz:1:x")
    ok(unkCb.body.data?.ok === false && unkCb.body.data?.ackText === "دکمه‌ی ناشناخته.", "unknown callback prefix → «دکمه‌ی ناشناخته.»")
  }

  // §A — Scenario A: new player (10.3A) ─────────────────────────────────────────
  section("§A Scenario A — new player (10.3A)")
  {
    const cA = chat(2), uA = tid(2), uB = tid(3)
    // 1-2: enters the test group; bot explains the game (welcome outbox card)
    const m = await member(cA, "شهرِ الف", uA, "تازه‌واردِ الف")
    ok(m.body.data?.welcomed === true, "A: new member registered (welcomed:true)")
    const gA = await gidOf(cA)
    const welcome = await db.groupOutbox.findFirst({ where: { groupId: gA, text: { contains: "شهروندِ جدیدِ شناسایی شد" } }, orderBy: { createdAt: "desc" } })
    ok(Boolean(welcome), "A: welcome card queued in outbox")
    ok((welcome?.text ?? "").includes("این گروه خودش یک شهر است"), "A: welcome explains the group game")
    ok((welcome?.text ?? "").includes("بدونِ فمبوی فقط تماشاگری"), "A: welcome flags missing character")
    const wbtns = outboxButtons(welcome?.buttonsJson ?? "[]")
    ok(wbtns.some((b) => b.url === "https://t.me/femwarbot?start=femboy" && b.cb === undefined), "A: welcome carries the private deep-link (t.me/femwarbot?start=femboy)")

    // 3: home card shows the no-character «تو» line + creation bridge
    const home0 = await command(cA, uA, "game")
    ok((home0.body.data?.text ?? "").includes("بدونِ فمبوی فقط تماشاگری — ساختنش در پی‌ویِ ربات است."), "A: home «تو» section recognizes missing character")
    ok((home0.body.data?.buttons ?? []).some((b) => b.url === "https://t.me/femwarbot?start=femboy"), "A: home offers the established creation route (url button)")

    // 4: player creates a SoulCharacter through the REAL private-bot path
    //    (POST /api/game/character, service-key + telegramId — the same route the
    //    bot's soul flow uses; the group never creates characters §4.3)
    const create = await post<{ message: string; card: { name: string; className: string } }>("/api/game/character", {
      telegramId: uA, action: "create", payload: { name: "شیشه‌ی الف", classKey: "wizard" },
    })
    ok(create.status === 200 && create.body.ok === true && (create.body.data?.message ?? "").includes("پیمان بسته شد"), "A: character created via real POST /api/game/character («پیمان بسته شد»)")
    const aFemboy = create.body.data?.card.name ?? ""
    const aClass = create.body.data?.card.className ?? ""
    ok(aFemboy === "شیشه‌ی الف" && aClass.length > 0, "A: creation returns the soul card DTO")

    // 5: the group now recognizes the character
    const home1 = await command(cA, uA, "game")
    ok((home1.body.data?.text ?? "").includes(aFemboy) && (home1.body.data?.text ?? "").includes(aClass), "A: home «تو» section shows the femboy identity after creation")
    const pub = await get<{ exists: boolean; card: { name: string } }>(`/api/game/character?targetTelegramId=${uA}`)
    ok(pub.status === 200 && pub.body.ok === true && pub.body.data?.exists === true && pub.body.data?.card?.name === aFemboy, "A: /femboy target card (publicFemboyCard) resolves the new identity")

    // welcome-variant for a player that ARRIVES with a character
    // (player row must exist first — the real path is the private bot's POST /api/auth
    //  service-key upsert, exactly like a user who /started the bot privately
    //  before ever joining a group; V13 §4.3 — the group never creates characters)
    await post("/api/auth", { telegramId: uB, name: "همراهِ ب" })
    const createB = await post<{ card: { name: string } }>("/api/game/character", {
      telegramId: uB, action: "create", payload: { name: "مه بانگ", classKey: "duelist" },
    })
    const bFemboy = createB.body.data?.card.name ?? ""
    ok(createB.body.ok === true && bFemboy.length > 0, "A: second member's character created (pre-made arrival)")
    const mB = await member(cA, "شهرِ الف", uB, "همراهِ ب")
    ok(mB.body.data?.welcomed === true, "A: second member (pre-made character) registered")
    const welcomeB = await db.groupOutbox.findFirst({ where: { groupId: gA, text: { contains: "خوش اومدی به شهر" } }, orderBy: { createdAt: "desc" } })
    ok((welcomeB?.text ?? "").includes(bFemboy) && (welcomeB?.text ?? "").includes("خوش اومدی به شهر. فمبویت این‌جا خانه دارد."), "A: welcome variant shows the arriving femboy identity")

    // 6: the new player joins a real eligible group activity (event + ge: choice)
    // V18 — ریتمِ هوشمند: شهرِ تازه دروازه‌ی ماجرا را بسته نگه می‌دارد؛ مسلح می‌کنیم
    await armEventPacing(cA)
    const evCmd = await command(cA, uA, "event")
    ok(evCmd.body.data?.text === "", "A: /event defers the card to outbox (empty command text)")
    const ev = await db.groupEvent.findFirst({ where: { groupId: gA, status: "open" } })
    ok(Boolean(ev), "A: open GroupEvent spawned")
    const evBtns = ev ? outboxButtons((await db.groupOutbox.findFirst({ where: { groupId: gA, refType: "event", refId: ev.id } }))?.buttonsJson ?? "[]") : []
    const geCb = evBtns.find((b) => (b.cb ?? "").startsWith("ge:"))
    ok(Boolean(geCb), "A: event card carries ge: choice buttons")
    if (ev && geCb) {
      const choose = await callback(cA, uA, geCb.cb!)
      ok(choose.body.data?.ok === true && choose.body.data?.ackText === "ثبت شد. عاقبتش را در پایانِ کارت ببین.", "A: new player joins the event (ge: accepted)")
      const part = await db.groupEventParticipant.findUnique({ where: { eventId_playerId: { eventId: ev.id, playerId: await pidOf(uA) } } })
      ok(part?.choiceKey === geCb.cb!.split(":").slice(2).join(":"), "A: participant row persisted with the chosen key")
      ok((choose.body.data?.editCard?.text ?? "").includes("تازه‌واردِ الف"), "A: updated event card lists the new participant")
    }
  }

  // §B — Scenario B: existing player (10.3B) + awards math (10.1) ───────────────
  section("§B Scenario B — existing player (10.3B)")
  {
    const cB = chat(3), uC = tid(4), uV1 = tid(5), uV2 = tid(6)
    // existing player = known to the bot privately BEFORE the group: auth-upsert,
    // then the soul pact, then group entry (so the identity welcome is the latest)
    await post("/api/auth", { telegramId: uC, name: "بازیکنِ ب" })
    const createC = await post<{ card: { name: string; className: string } }>("/api/game/character", {
      telegramId: uC, action: "create", payload: { name: "رصد ب", classKey: "ranger" },
    })
    const cFemboy = createC.body.data?.card.name ?? ""
    const cClass = createC.body.data?.card.className ?? ""
    ok(createC.body.ok === true && cFemboy.length > 0 && cClass.length > 0, "B: existing player's character created (non-vacuous identity)")
    await member(cB, "شهرِ ب", uV1, "هم‌شهردارِ ۱")
    await member(cB, "شهرِ ب", uV2, "هم‌شهردارِ ۲")
    await member(cB, "شهرِ ب", uC, "بازیکنِ ب")
    const gB = await gidOf(cB)

    // 1-2: player with a character enters; the bot displays the correct identity
    const welcomeC = await db.groupOutbox.findFirst({ where: { groupId: gB, text: { contains: "خوش اومدی به شهر" } }, orderBy: { createdAt: "desc" } })
    ok(cFemboy.length > 0 && (welcomeC?.text ?? "").includes(cFemboy) && (welcomeC?.text ?? "").includes(cClass), "B: welcome shows the existing player's identity")

    // 3: opens a supported activity (/game home)
    const home = await command(cB, uC, "game")
    ok(home.body.data?.kind === "home" && (home.body.data?.text ?? "").includes(cFemboy), "B: /game home opens with the player's identity")

    // 4: performs a valid action — joins the open event via ge:
    //    (if a live-tick spawned a style show or busy event is open, force-close it
    //    through the admin recover path first so the flow is hour-of-day proof)
    let ev = await db.groupEvent.findFirst({ where: { groupId: gB, status: "open" } })
    if (!ev || ev.templateId === "style_show") {
      if (ev) await callback(cB, uC, "gs:recover", true)
      await armEventPacing(cB)
      await command(cB, uC, "event")
      ev = await db.groupEvent.findFirst({ where: { groupId: gB, status: "open" } })
    }
    ok(Boolean(ev) && ev!.templateId !== "style_show", "B: regular open event spawned (not a style show)")
    const evBtns = ev ? outboxButtons((await db.groupOutbox.findFirst({ where: { groupId: gB, refType: "event", refId: ev.id } }))?.buttonsJson ?? "[]") : []
    const geCb = evBtns.find((b) => (b.cb ?? "").startsWith("ge:"))
    const choiceKey = geCb?.cb?.split(":").slice(2).join(":") ?? ""
    const choose = ev && geCb ? await callback(cB, uC, geCb.cb!) : null
    ok(choose?.body.data?.ok === true, "B: valid action — event choice accepted")
    const part = ev ? await db.groupEventParticipant.findUnique({ where: { eventId_playerId: { eventId: ev.id, playerId: await pidOf(uC) } } }) : null
    ok(part?.choiceKey === choiceKey, "B: backend confirms participation (GroupEventParticipant row)")

    // 5: the group displays updated state (home marks the choice)
    const home2 = await command(cB, uC, "game")
    ok((home2.body.data?.text ?? "").includes("انتخابت ثبت است"), "B: home card reflects joined state («انتخابت ثبت است»)")

    // 6: awards math — resolve via the admin recover path (force) and verify the
    //    exact awardPlayerStat semantics against the deterministic engine seeding.
    const pcId = await pidOf(uC)
    const before = await db.player.findUniqueOrThrow({ where: { id: pcId } })
    const recover = await callback(cB, uC, "gs:recover", true)
    ok(recover.body.data?.ok === true && (recover.body.data?.editCard?.text ?? "").includes("بازیابیِ شهر"), "B: gs:recover (admin) resolves open activity")
    const evAfter = ev ? await db.groupEvent.findUnique({ where: { id: ev.id } }) : null
    ok(evAfter?.status === "expired", "B: event force-closed (status 'expired')")
    const outcomeJson = evAfter ? JSON.parse(evAfter.outcomeJson ?? "{}") as { resolved?: { playerId: string }[]; reason?: string } : {}
    ok(outcomeJson.reason === "recovered" && (outcomeJson.resolved?.[0]?.playerId ?? "") === pcId, "B: outcomeJson records the participant + recover reason")

    const after = await db.player.findUniqueOrThrow({ where: { id: pcId } })
    const tpl = ev ? getEventTemplate(ev.templateId) : undefined
    const expected = ev && tpl ? expectedOutcomeStats(tpl, ev.id, pcId, choiceKey) : null
    ok(expected !== null, "B: awards oracle resolved (template + deterministic seeding)")
    if (expected) {
      if (expected.length === 0) {
        ok(before.money === after.money && before.xp === after.xp && before.fame === after.fame && before.energy === after.energy && before.luck === after.luck && before.chaos === after.chaos && before.crime === after.crime && before.reputation === after.reputation, "B: outcome had no playerStats → zero stat drift (no spurious writes)")
        console.log("    (note: picked outcome carries no playerStats — structural check only)")
      } else {
        let mMoney = before.money, mXp = before.xp
        const mStats: Record<string, number> = { fame: before.fame, energy: before.energy, luck: before.luck, chaos: before.chaos, crime: before.crime, reputation: before.reputation }
        let moneyEntries = 0
        for (const s of expected) {
          if (s.stat === "money") { mMoney += s.amount; moneyEntries++ }
          else if (s.stat === "xp") mXp = Math.max(0, mXp + s.amount)
          else if (s.stat in mStats) mStats[s.stat] = clamp(mStats[s.stat] + s.amount, 0, 100)
        }
        const details = expected.map((s) => `${s.stat}:${s.amount}`).join(", ")
        ok(after.money === mMoney && after.xp === mXp && after.fame === mStats.fame && after.energy === mStats.energy && after.luck === mStats.luck && after.chaos === mStats.chaos && after.crime === mStats.crime && after.reputation === mStats.reputation, `B: awardPlayerStat semantics exact (expected ${details})`, `money ${before.money}→${after.money} (exp ${mMoney}) xp ${before.xp}→${after.xp} (exp ${mXp}) fame ${before.fame}→${after.fame} (exp ${mStats.fame})`)
        if (moneyEntries > 0) {
          const ledger = await db.currencyLedger.findMany({ where: { playerId: pcId, source: "event" } })
          ok(ledger.length === moneyEntries && ledger.reduce((s, r) => s + r.amount, 0) === mMoney - before.money, "B: money awards flow through the currency ledger (source 'event')")
        }
      }
    }

    // cooperative project (feeds the Mini App contract test in §F and §U)
    const proj = await callback(cB, uC, "gm:newproject:night_market")
    ok(proj.body.data?.ok === true && proj.body.data?.ackText === "پروژه افتتاح شد.", "B: cooperative project started (gm:newproject)")
    const projRow = await db.groupProject.findFirst({ where: { groupId: gB, templateId: "night_market", status: "building" } })
    ok(Boolean(projRow) && projRow!.goal === 100000, "B: GroupProject row persisted (building, goal 100000)")
    const contribute = await callback(cB, uC, `gp:${projRow!.id}:1000`)
    ok(contribute.body.data?.ok === true && (contribute.body.data?.ackText ?? "").startsWith("کمکت ثبت شد"), "B: valid action — contribute 1000 via gp: button")
    const contributed = JSON.parse((await db.groupProject.findUniqueOrThrow({ where: { id: projRow!.id } })).contributedJson) as Record<string, number>
    ok((contributed[pcId] ?? 0) === 1000, "B: backend confirms contribution (contributedJson)")
  }

  // §C — Scenario C: multiplayer duel challenge (10.3C) ─────────────────────────
  section("§C Scenario C — multiplayer challenge + exactly-once (10.3C)")
  {
    const cC = chat(4), uD = tid(7), uE = tid(8)
    // both duelists must be known players first (private-bot auth path), THEN pact,
    // THEN group entry — resolveCaller for /api/game/character requires the Player row
    await post("/api/auth", { telegramId: uD, name: "بازیکنِ ج۱" })
    await post("/api/auth", { telegramId: uE, name: "بازیکنِ ج۲" })
    for (const [u, nm, cls] of [[uD, "سپر ج", "paladin"], [uE, "خنجر ج", "shinobi"]] as const) {
      const r = await post<{ card: { name: string } }>("/api/game/character", { telegramId: u, action: "create", payload: { name: nm, classKey: cls } })
      ok(r.body.ok === true && (r.body.data?.card.name ?? "").length > 0, `C: character created for ${nm}`)
    }
    await member(cC, "شهرِ ج", uD, "بازیکنِ ج۱")
    await member(cC, "شهرِ ج", uE, "بازیکنِ ج۲")
    const pD = await pidOf(uD), pE = await pidOf(uE)
    const gC = await gidOf(cC)

    // 1-2: challenge creation (consent transport — no instant combat)
    const duel = await command(cC, uD, `duel ${uE}`)
    ok(duel.body.data?.text.includes("دعوت‌نامه فرستاده شد") ?? false, "C: /duel {target} → invitation-ack card (no instant combat)", JSON.stringify(duel.body).slice(0, 180))
    const ch = await db.groupChallenge.findFirst({ where: { groupId: gC }, orderBy: { createdAt: "desc" } })
    ok(ch?.status === "pending" && ch!.challengerId === pD && ch!.targetId === pE, "C: GroupChallenge row pending (challenger/target persisted)")
    if (!ch) { console.log("    §C aborted (no challenge row — cascade guard)"); return }
    const inv = ch ? await db.groupOutbox.findFirst({ where: { groupId: gC, refType: "challenge", refId: ch.id, kind: "challenge" } }) : null
    ok((inv?.text ?? "").includes("دعوتِ دوئل"), "C: invitation card queued in outbox")
    const invBtns = outboxButtons(inv?.buttonsJson ?? "[]")
    ok(invBtns.filter((b) => (b.cb ?? "").startsWith("gc:")).length === 3, "C: invitation carries accept/decline/cancel gc: buttons")
    const encounters0 = await db.combatEncounter.count({ where: { groupId: gC, kind: "duel" } })
    ok(encounters0 === 0, "C: no CombatEncounter before consent")

    // ownership: accept is target-only
    const wrongActor = await callback(cC, uD, `gc:${ch!.id}:accept`)
    ok(wrongActor.body.data?.ok === false && wrongActor.body.data?.ackText === "این دعوت برای تو نیست.", "C: accept by non-target rejected (ownership)")
    const stillPending = await db.groupChallenge.findUniqueOrThrow({ where: { id: ch!.id } })
    ok(stillPending.status === "pending", "C: rejected attempt does not mutate state")

    // 3-4: target accepts → ONE authoritative duel
    const beforeD = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pD } })
    const beforeE = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pE } })
    const ledger0 = await db.currencyLedger.count({ where: { playerId: { in: [pD, pE] }, source: "reward", note: "برنده‌ی دوئل" } })
    const accept = await callback(cC, uE, `gc:${ch!.id}:accept`)
    ok(accept.body.data?.ok === true && accept.body.data?.ackText === "شمشیرها خلوت کردند — نتیجه روی کارت.", "C: target accepts → duel resolved")
    ok((accept.body.data?.editCard?.text ?? "").includes("نتیجه‌ی دوئلِ شهر"), "C: result card returned for edit-in-place")

    const resolved = await db.groupChallenge.findUniqueOrThrow({ where: { id: ch!.id } })
    ok(resolved.status === "resolved", "C: challenge resolved")
    const outcome = JSON.parse(resolved.outcomeJson ?? "{}") as { winnerTelegramId: string | null; winnerIsChallenger: boolean; rounds: number; prize: number; winnerName: string }
    ok(typeof outcome.winnerIsChallenger === "boolean" && outcome.rounds >= 1 && outcome.prize >= 250 && outcome.prize <= 420, "C: outcomeJson carries the authoritative result")
    ok(outcome.winnerTelegramId === (outcome.winnerIsChallenger ? uD : uE), "C: winner telegram id matches the flip")

    // exactly ONE CombatEncounter; both players' state changed per the result
    const encounters = await db.combatEncounter.findMany({ where: { groupId: gC, kind: "duel" } })
    ok(encounters.length === 1 && encounters[0]!.playerId === pD && encounters[0]!.foeId === pE && encounters[0]!.resolvedAt !== null, "C: exactly ONE duel CombatEncounter (initiator/foe/resolved)")
    const afterD = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pD } })
    const afterE = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pE } })
    const winD = outcome.winnerIsChallenger
    ok(afterD.wins === beforeD.wins + (winD ? 1 : 0) && afterD.losses === beforeD.losses + (winD ? 0 : 1), "C: challenger wins/losses per authoritative result")
    ok(afterE.wins === beforeE.wins + (winD ? 0 : 1) && afterE.losses === beforeE.losses + (winD ? 1 : 0), "C: target wins/losses per authoritative result")
    ok(afterD.spirit === clamp(beforeD.spirit + (winD ? 6 : -10), 0, 100) && afterE.spirit === clamp(beforeE.spirit + (winD ? -10 : 6), 0, 100), "C: spirit deltas authoritative (+6 winner / −10 loser, clamped)")
    ok(afterD.stamina === beforeD.stamina - 4 && afterE.stamina === beforeE.stamina - 4, "C: stamina cost 4 on both sides")
    const logs = await db.characterLog.count({ where: { type: "duel", characterId: { in: [beforeD.id, beforeE.id] } } })
    ok(logs === 2, "C: duel logged on both femboys (2 CharacterLog rows)")

    // 5-6: replay is stale; rewards exactly-once
    const replay = await callback(cC, uE, `gc:${ch!.id}:accept`)
    ok(replay.body.data?.ok === false && replay.body.data?.ackText === "این اتفاق دیگه باز نیست.", "C: replayed accept → STALE_ACK")
    const cancelLate = await callback(cC, uD, `gc:${ch!.id}:cancel`)
    ok(cancelLate.body.data?.ok === false && cancelLate.body.data?.ackText === "این اتفاق دیگه باز نیست.", "C: late cancel → STALE_ACK")
    const ledger1 = await db.currencyLedger.count({ where: { playerId: { in: [pD, pE] }, source: "reward", note: "برنده‌ی دوئل" } })
    ok(ledger1 === ledger0 + 1, "C: prize paid exactly once (ledger +1)")
    const prizeRow = await db.currencyLedger.findFirst({ where: { playerId: { in: [pD, pE] }, source: "reward", note: "برنده‌ی دوئل" }, orderBy: { createdAt: "desc" } })
    ok((prizeRow?.amount ?? 0) === outcome.prize, "C: ledger prize matches outcomeJson")
    const encounters2 = await db.combatEncounter.count({ where: { groupId: gC, kind: "duel" } })
    ok(encounters2 === 1, "C: replay created no second CombatEncounter")
    const logs2 = await db.characterLog.count({ where: { type: "duel", characterId: { in: [beforeD.id, beforeE.id] } } })
    ok(logs2 === 2, "C: replay added no duplicate duel logs")

    // group displays updated state: history row + home no longer lists the pending invite
    const hist = await db.groupHistory.findFirst({ where: { groupId: gC, text: { contains: "— برنده:" } } })
    ok((hist?.text ?? "").includes("دوئلِ") && (hist?.text ?? "").includes(outcome.winnerName), "C: duel recorded in group history")
    const homeAfter = await command(cC, uD, "game")
    ok(!(homeAfter.body.data?.text ?? "").includes("دعوتِ دوئل"), "C: home card no longer shows the resolved challenge")
  }

  // §D — Scenario D: cross-group isolation (10.3D) ──────────────────────────────
  section("§D Scenario D — cross-group isolation (10.3D)")
  {
    const cD1 = chat(5), cD2 = chat(6)
    const uD = tid(7), uE = tid(8), uF = tid(9) // uD/uE already exist from §C; uF is new
    await member(cD1, "شهرِ د۱", uD, "بازیکنِ د۱")
    await member(cD1, "شهرِ د۱", uE, "بازیکنِ د۲")
    await member(cD2, "شهرِ د۲", uF, "بازیکنِ د۳")
    const gD1 = await gidOf(cD1), gD2 = await gidOf(cD2)

    // activity in group 1: challenge + project
    const duel = await command(cD1, uD, `duel ${uE}`)
    ok(duel.body.data?.text.includes("دعوت‌نامه فرستاده شد") ?? false, "D: challenge created in group 1")
    const ch = await db.groupChallenge.findFirst({ where: { groupId: gD1 }, orderBy: { createdAt: "desc" } })
    ok(ch?.status === "pending", "D: group 1 challenge pending")
    const proj = await callback(cD1, uD, "gm:newproject:arcade")
    ok(proj.body.data?.ok === true, "D: project started in group 1")

    // group 2 state untouched
    ok(await db.groupChallenge.count({ where: { groupId: gD2 } }) === 0, "D: group 2 has ZERO challenge rows")
    ok(await db.groupProject.count({ where: { groupId: gD2 } }) === 0, "D: group 2 has ZERO project rows")
    const leak = await db.groupOutbox.count({ where: { groupId: gD2, refId: ch?.id ?? "none" } })
    ok(leak === 0, "D: group 2 outbox has none of group 1's challenge messages")
    const leak2 = await db.groupOutbox.count({ where: { groupId: gD2, kind: "challenge" } })
    ok(leak2 === 0, "D: group 2 outbox has no challenge-kind rows at all")

    // a gc: callback routed with group 2's chatId on group 1's challenge → friendly rejection
    const foreign = await callback(cD2, uE, `gc:${ch!.id}:accept`)
    ok(foreign.body.data?.ok === false && foreign.body.data?.ackText === "این دعوت در دفترِ این شهر ثبت نشده.", "D: foreign-group gc: → «این دعوت در دفترِ این شهر ثبت نشده.»")
    const stillPending = await db.groupChallenge.findUniqueOrThrow({ where: { id: ch!.id } })
    ok(stillPending.status === "pending" && stillPending.groupId === gD1, "D: foreign attempt left group 1's challenge untouched")
  }

  // §E — Scenario E: failure & recovery (10.3E) ─────────────────────────────────
  section("§E Scenario E — failure & recovery (10.3E)")
  {
    const cE = chat(7), uG = tid(10), uH = tid(11), uI = tid(12)
    // players must exist first (private-bot auth upsert) — same fix as §A/§B/§C
    await post("/api/auth", { telegramId: uG, name: "بازیکنِ ه۱" })
    await post("/api/auth", { telegramId: uH, name: "بازیکنِ ه۲" })
    await post("/api/auth", { telegramId: uI, name: "بازیکنِ ه۳" })
    for (const [u, nm, cls] of [[uG, "تاج ه", "wizard"], [uH, "داس ه", "reaper"], [uI, "کارت ه", "trickster"]] as const) {
      const r = await post<{ card: { name: string } }>("/api/game/character", { telegramId: u, action: "create", payload: { name: nm, classKey: cls } })
      ok(r.body.ok === true && (r.body.data?.card.name ?? "").length > 0, `E: character created for ${nm}`)
    }
    await member(cE, "شهرِ ه", uG, "بازیکنِ ه۱")
    await member(cE, "شهرِ ه", uH, "بازیکنِ ه۲")
    await member(cE, "شهرِ ه", uI, "بازیکنِ ه۳")
    const gE = await gidOf(cE)

    // E1: challenge → invitation
    const duel = await command(cE, uG, `duel ${uH}`)
    ok(duel.body.data?.text.includes("دعوت‌نامه فرستاده شد") ?? false, "E: challenge created", JSON.stringify(duel.body).slice(0, 180))
    const c1 = await db.groupChallenge.findFirst({ where: { groupId: gE }, orderBy: { createdAt: "desc" } })
    if (!c1) { console.log("    §E aborted (no challenge row — cascade guard)"); return }

    // E2: fast-forward expiry → tick flips + dead card
    await fixture(async () => {
      await db.groupChallenge.update({ where: { id: c1!.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
      await db.groupWorld.update({ where: { id: gE }, data: { lastTickAt: new Date(Date.now() - 90_000) } })
    })
    await command(cE, uG, "help") // wake: lifts any live-ticker botMissingAt pause
    const tk = await tick()
    ok(tk.status === 200 && tk.body.ok === true, "E: global tick 200")
    const c1After = await db.groupChallenge.findUniqueOrThrow({ where: { id: c1!.id } })
    ok(c1After.status === "expired", "E: expired challenge flipped by tick (pending → expired)")
    const dead = await db.groupOutbox.findFirst({ where: { groupId: gE, refType: "challenge", refId: c1!.id, kind: "challenge", text: { contains: "مهلت گذشت" } } })
    ok(Boolean(dead), "E: dead card queued («مهلت گذشت»)")
    const deadHist = await db.groupHistory.findFirst({ where: { groupId: gE, text: { contains: "مُرد — جوابی نیامد" } } })
    ok(Boolean(deadHist), "E: expiry recorded in group history")

    // E3: act-after-expiry = stale ack
    const late = await callback(cE, uH, `gc:${c1!.id}:accept`)
    ok(late.body.data?.ok === false && late.body.data?.ackText === "این اتفاق دیگه باز نیست.", "E: accept after expiry → STALE_ACK")

    // E3b: close whatever the tick may have spawned (hour-of-day durability)
    const rec0 = await callback(cE, uG, "gs:recover", true)
    ok(rec0.body.data?.ok === true, "E: recover cleans post-tick spawns")

    // E3c: gs: without isAdmin → rejected (transport-trust gate)
    const nonAdmin = await callback(cE, uI, "gs:toggle:enabled")
    ok(nonAdmin.body.data?.ok === false && nonAdmin.body.data?.ackText === "فقط ادمین‌های گروه.", "E: non-admin gs: → «فقط ادمین‌های گروه.»")
    const settingsAfterNonAdmin = await db.groupWorld.findUniqueOrThrow({ where: { id: gE } })
    ok((JSON.parse(settingsAfterNonAdmin.settingsJson ?? "{}") as { enabled?: boolean }).enabled !== false, "E: rejected gs: wrote no pause")

    // E5: open an event + a second challenge (both BEFORE pausing)
    await armEventPacing(cE)
    const evCmd = await command(cE, uG, "event")
    ok(evCmd.body.data?.text === "", "E: event spawned for the pause test")
    const ev1 = await db.groupEvent.findFirst({ where: { groupId: gE, status: "open" } })
    ok(Boolean(ev1) && ev1!.templateId !== "style_show", "E: open event exists")
    const duel2 = await command(cE, uI, `duel ${uH}`)
    ok(duel2.body.data?.text.includes("دعوت‌نامه فرستاده شد") ?? false, "E: second challenge created (pause test)")
    const c2 = await db.groupChallenge.findFirst({ where: { groupId: gE, status: "pending" }, orderBy: { createdAt: "desc" } })
    ok(c2?.status === "pending", "E: second challenge pending")

    // E6: admin pause → game commands paused card, help/gadmin exempt, tick skips
    const pause = await callback(cE, uG, "gs:toggle:enabled", true)
    ok(pause.body.data?.ok === true && pause.body.data?.ackText === "بازیِ شهر بسته شد.", "E: admin gs:toggle:enabled → paused")
    const pausedRow = await db.groupWorld.findUniqueOrThrow({ where: { id: gE } })
    ok((JSON.parse(pausedRow.settingsJson ?? "{}") as { enabled?: boolean }).enabled === false, "E: settingsJson persisted enabled:false")

    const pausedCmd = await command(cE, uG, "game")
    ok(pausedCmd.body.data?.text === "بازیِ شهر در این گروه فعلاً بسته‌است.", "E: game command while paused → paused card")
    const pausedCb = await callback(cE, uG, "gm:game")
    ok(pausedCb.body.data?.ok === false && pausedCb.body.data?.ackText === "بازیِ شهر فعلاً بسته‌است — فقط ادمینِ گروه می‌تواند بازش کند.", "E: game callback while paused → paused ack")
    const helpExempt = await command(cE, uG, "help")
    // V16-4 — عنوانِ کارتِ راهنما قاعده‌مند شد: «شهرِ گروه» (TERM.groupWorld؛ قبلاً «شهرِ گروهی»)
    ok((helpExempt.body.data?.text ?? "").includes("شهرِ گروه FEMBOY WAR") && !(helpExempt.body.data?.text ?? "").includes("شهرِ گروهی"), "E: /help exempt from pause (loop-explaining card, canonical title)")
    const gadminExempt = await command(cE, uG, "gadmin", true)
    ok((gadminExempt.body.data?.text ?? "").includes("تنظیماتِ شهر"), "E: /gadmin exempt from pause (settings card)")

    // tick skips: a past-expiry challenge stays pending across a REAL tick execution
    const tickMark = new Date(Date.now() - 90_000)
    await fixture(async () => {
      await db.groupChallenge.update({ where: { id: c2!.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
      await db.groupWorld.update({ where: { id: gE }, data: { lastTickAt: tickMark } })
    })
    await command(cE, uG, "help") // wake (lifts botMissingAt so the skip is attributable to enabled:false)
    // snapshot the challenge's outbox rows BEFORE the paused tick (the invitation
    // itself was queued at creation time — it must not be counted against the tick)
    const prePauseOutbox = await db.groupOutbox.count({ where: { groupId: gE, refId: c2!.id } })
    const pausedTick = await tick()
    ok(pausedTick.status === 200, "E: tick while paused → 200")
    const gRow = await db.groupWorld.findUniqueOrThrow({ where: { id: gE } })
    const c2Row = await db.groupChallenge.findUniqueOrThrow({ where: { id: c2!.id } })
    ok(gRow.lastTickAt.getTime() > tickMark.getTime(), "E: paused group WAS ticked (lastTickAt advanced)")
    ok(c2Row.status === "pending", "E: paused tick skipped closures (past-expiry challenge still pending)")
    ok(await db.groupOutbox.count({ where: { groupId: gE, refId: c2!.id } }) === prePauseOutbox, "E: paused tick queued nothing for the challenge")

    // E8: gs:recover force-closes open activity (challenge + event)
    const recover = await callback(cE, uG, "gs:recover", true)
    ok(recover.body.data?.ok === true && (recover.body.data?.editCard?.text ?? "").includes("بازیابیِ شهر"), "E: gs:recover (admin) → recovery report card")
    const c2After = await db.groupChallenge.findUniqueOrThrow({ where: { id: c2!.id } })
    const ev1After = await db.groupEvent.findUniqueOrThrow({ where: { id: ev1!.id } })
    ok(c2After.status === "expired", "E: recover force-closed the pending challenge")
    ok(ev1After.status !== "open", "E: recover force-closed the open event")
    const unpause = await callback(cE, uG, "gs:toggle:enabled", true)
    ok(unpause.body.data?.ok === true && unpause.body.data?.ackText === "بازیِ شهر باز شد.", "E: admin re-opens the city")

    // E9: corrupt settingsJson → fail-safe defaults
    await fixture(async () => {
      await db.groupWorld.update({ where: { id: gE }, data: { settingsJson: '{"enabled":' } })
    })
    const gadminCorrupt = await command(cE, uG, "gadmin", true)
    ok((gadminCorrupt.body.data?.text ?? "").includes("وضعیتِ بازی: ✅ باز") && (gadminCorrupt.body.data?.text ?? "").includes("سروصدایِ شهر: 🔊 عادی"), "E: corrupt settingsJson → defaults (fail-safe, no crash)")
    const gameAfterCorrupt = await command(cE, uG, "game")
    ok(gameAfterCorrupt.body.data?.kind === "home", "E: after corruption the game runs (enabled default true)")

    // E10: unknown player voice (no_player 404) — V14: متنِ بدونِ اسلش (۱۵b، شکافِ ⑨)
    const ghost = await command(cE, `99${STAMP}999`, "game")
    ok(ghost.status === 404 && ghost.body.ok === false && ghost.body.code === "no_player" && ghost.body.error === "اول در خصوصیِ ربات «شروع بازی» را بگو تا شهروند شوی.", "E: unknown telegramId → 404 no_player «اول در خصوصیِ ربات «شروع بازی»…»")
  }

  // §F — Scenario F: regression (10.3F) ─────────────────────────────────────────
  section("§F Scenario F — regression sweep (10.3F)")
  {
    // private-bot endpoints (the exact routes mini-services/bot/src/api.ts calls).
    // NOTE: /api/game/state is POST in the live contract (bot api.ts:927); the
    // route defines no GET — asserted here over POST with a REAL player, the same
    // read-refresh call the bot itself makes (time-based regen only, never destructive).
    const realPlayer = (await db.player.findFirst({ where: { telegramId: { not: { startsWith: "99" } } }, orderBy: { createdAt: "asc" } }))
    ok(Boolean(realPlayer?.telegramId), "F: a real player selected for the private-bot check")
    if (realPlayer?.telegramId) {
      const state = await post<{ snapshot: { player: { name: string } } }>("/api/game/state", { telegramId: realPlayer.telegramId })
      ok(state.status === 200 && state.body.ok === true && typeof state.body.data?.snapshot?.player?.name === "string", "F: POST /api/game/state (real player) → 200 + snapshot.player")
    }
    const uA = tids[1] ?? ""
    const pubCard = await get<{ exists: boolean; card: { name: string } }>(`/api/game/character?targetTelegramId=${uA}`)
    ok(pubCard.status === 200 && pubCard.body.ok === true && pubCard.body.data?.exists === true, "F: GET /api/game/character?targetTelegramId → public card")
    const hall = await get<{ entries?: unknown[]; board?: string }>(`/api/game/character/hall?board=level&telegramId=${realPlayer?.telegramId ?? ""}`)
    ok(hall.status === 200 && hall.body.ok === true && Array.isArray(hall.body.data?.entries), "F: GET /api/game/character/hall → 200 + entries")

    // Mini App contracts (service-key path)
    const cB = chats[2] ?? ""
    const snap = await post<{ groups: unknown[]; snapshot: { challenges?: unknown[] } | null; games: unknown[] }>("/api/group/snapshot", { chatId: cB, telegramId: tids[3] ?? "" })
    ok(snap.status === 200 && snap.body.ok === true && Array.isArray(snap.body.data?.snapshot?.challenges), "F: POST /api/group/snapshot → 200 + snapshot.challenges present")
    ok(Array.isArray(snap.body.data?.games) && (snap.body.data?.games.length ?? 0) > 0, "F: snapshot response carries playableGames")
    ok(Array.isArray(snap.body.data?.groups), "F: snapshot response carries my-groups list")

    // MA action path still accepts a benign action (contribute on the throwaway project)
    const projRow = await db.groupProject.findFirst({ where: { groupId: await gidOf(cB), templateId: "night_market", status: "building" } })
    const maAction = await post<{ ok: boolean; message: string }>("/api/group/action", {
      chatId: cB, telegramId: tids[3] ?? "", action: "contribute", payload: { projectKey: "night_market", amount: 500 },
    })
    ok(maAction.status === 200 && maAction.body.ok === true && typeof maAction.body.data?.message === "string", "F: POST /api/group/action (service-key) → benign contribute accepted")
    if (projRow) {
      const contributed = JSON.parse((await db.groupProject.findUniqueOrThrow({ where: { id: projRow.id } })).contributedJson) as Record<string, number>
      ok((contributed[await pidOf(tids[3] ?? "")] ?? 0) === 1500, "F: MA contribute + bot contribute accumulate exactly (1000 + 500)")
    }

    // combat consistency: the private duel route still rejects a no-character duelist
    const noChar = tids[8] ?? "" // registered in §D group 2, never made a character
    const badDuel = await post<{ duel?: unknown }>("/api/game/combat", {
      telegramId: noChar, action: "duel", payload: { foeTelegramId: tids[6] ?? "" },
    })
    ok(badDuel.status === 409 && badDuel.body.ok === false && badDuel.body.code === "duel_failed" && (badDuel.body.error ?? "").includes("فمبوی"), "F: /api/game/combat duel without character → 409 duel_failed (private path regression)")

    // duplicate character creation guard (private path idempotency)
    const dupCreate = await post<unknown>("/api/game/character", { telegramId: tids[1] ?? "", action: "create", payload: { name: "دوباره", classKey: "wizard" } })
    ok(dupCreate.status === 409 && dupCreate.body.code === "create_failed" && dupCreate.body.error === "فمبوی تو همین‌جاست. عهد، عهد است.", "F: duplicate pact → 409 «فمبوی تو همین‌جاست. عهد، عهد است.»")
  }

  // §U — unit-ish extras (10.1) ──────────────────────────────────────────────────
  section("§U safety gates + duplicate handling (10.1)")
  {
    const cB = chats[2] ?? "", gB = await gidOf(cB)
    const uC = tids[3] ?? "", uX = tids[8] ?? ""
    const pcId = await pidOf(uC)

    // non-member ge: choice rejected (citizenship gate — foreign player exists but
    // is not a citizen of this city)
    await armEventPacing(cB)
    await command(cB, uC, "event")
    let ev = await db.groupEvent.findFirst({ where: { groupId: gB, status: "open" }, orderBy: { createdAt: "desc" } })
    if (!ev || ev.templateId === "style_show") {
      if (ev) await callback(cB, uC, "gs:recover", true)
      await armEventPacing(cB)
      await command(cB, uC, "event")
      ev = await db.groupEvent.findFirst({ where: { groupId: gB, status: "open" }, orderBy: { createdAt: "desc" } })
    }
    ok(Boolean(ev) && ev!.templateId !== "style_show", "U: open event available for the gate test")
    if (ev) {
      const choices = JSON.parse(ev.choicesJson) as { key: string }[]
      if (choices.length === 0) {
        console.log("    (note: open event carries no choices — gate test skipped)")
      } else {
        const foreign = await callback(cB, uX, `ge:${ev.id}:${choices[0]!.key}`)
        ok(foreign.body.data?.ok === false && foreign.body.data?.ackText === "تو هنوز شهروندِ این شهر نیستی — اول تو گروه حرف بزن یا «منو» را بگو.", "U: non-member ge: → NOT_CITIZEN_MSG")
        ok(await db.groupEventParticipant.count({ where: { eventId: ev.id, playerId: await pidOf(uX) } }) === 0, "U: rejected choice wrote no participant row")

        // duplicate event choice by the same citizen → friendly no-op
        const choose1 = await callback(cB, uC, `ge:${ev.id}:${choices[0]!.key}`)
        const choose2 = await callback(cB, uC, `ge:${ev.id}:${choices[0]!.key}`)
        ok(choose1.body.data?.ok === true && choose2.body.data?.ok === false && choose2.body.data?.ackText === "انتخابت ثبت شده. شهر عجله ندارد.", "U: duplicate ge: choice → friendly no-op («انتخابت ثبت شده…»)")
        ok(await db.groupEventParticipant.count({ where: { eventId: ev.id, playerId: pcId } }) === 1, "U: participant recorded exactly once (unique constraint)")
      }
    }

    // duplicate contribute: repeat-contribute is an accumulative mechanic — the
    // dupe-safety contract here is EXACT accounting (no accidental double-application)
    const projRow = await db.groupProject.findFirst({ where: { groupId: gB, templateId: "night_market", status: "building" } })
    if (projRow) {
      // fixture: throwaway player balance is top-upped to a known value so the
      // accumulative-contribute contract below is independent of the random
      // event/auction money outcomes earlier in the run (direct prisma on a
      // throwaway row — same fixture pattern as expiresAt/settingsJson below)
      await db.player.update({ where: { id: pcId }, data: { money: 4000 } })
      const again = await callback(cB, uC, `gp:${projRow.id}:1000`)
      ok(again.body.data?.ok === true, "U: second gp: contribute accepted (accumulative by design)", `ackText: ${again.body.data?.ackText ?? "none"}`)
      const contributed = JSON.parse((await db.groupProject.findUniqueOrThrow({ where: { id: projRow.id } })).contributedJson) as Record<string, number>
      ok((contributed[pcId] ?? 0) === 2500, "U: contributions not doubled — exact accounting 1000+500+1000 = 2500")
      const ledger = await db.currencyLedger.findMany({ where: { playerId: pcId, source: "misc", note: { startsWith: "کمک به پروژه‌ی" } } })
      ok(ledger.reduce((s, r) => s + r.amount, 0) === -2500, "U: ledger mirrors the contributions exactly (−2500)")
      const malformed = await callback(cB, uC, `gp:${projRow.id}`)
      ok(malformed.body.data?.ok === false && malformed.body.data?.ackText === "مبلغ نامفهوم.", "U: malformed gp: (no amount) → «مبلغ نامفهوم.»")
      const ghostProj = await callback(cB, uC, "gp:nonexistent:100")
      ok(ghostProj.body.data?.ok === false && ghostProj.body.data?.ackText === "پروژه پیدا نشد.", "U: gp: on unknown project → «پروژه پیدا نشد.»")
    }

    // vote double-cast: same option rejected, tally counts the voter exactly once
    const elect = await callback(cB, uC, "gm:elect")
    const vote = await db.groupVote.findFirst({ where: { groupId: gB, status: "open" }, orderBy: { createdAt: "desc" } })
    ok(Boolean(vote) && (elect.body.data?.ok === true || (elect.body.data?.ackText ?? "").includes("در جریان")), "U: election open (or already open)")
    if (vote) {
      const options = JSON.parse(vote.optionsJson) as { key: string }[]
      const own = options.find((o) => o.key === `u:${pcId}`) ?? options[0]!
      const v1 = await callback(cB, uC, `gv:${vote.id}:${own.key}`)
      ok(v1.body.data?.ok === true && v1.body.data?.ackText === "رأیت ثبت شد.", "U: first vote accepted")
      const v2 = await callback(cB, uC, `gv:${vote.id}:${own.key}`)
      ok(v2.body.data?.ok === false && v2.body.data?.ackText === "همین رأی را داده‌ای.", "U: same-option double-cast → «همین رأی را داده‌ای.»")
      const tally = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
      const times = Object.values(tally).filter((ids) => ids.includes(pcId)).length
      ok(times === 1, "U: voter counted exactly once in tallyJson")
    }
  }

  // §V — V14 Wave 1 (Task 15a): engine femboy depth ────────────────────────────
  section("§V V14 femboy depth (15a: class truth + group→soul + duel passives + interactions)")
  {
    // V1 — class desc/param consistency (mirrors the validateClasses guard)
    {
      const errs = validateClasses()
      ok(errs.length === 0, "V1: validateClasses() clean at load")
      ok(CLASSES.length === 8, "V1: 8 classes present")
      const drift: string[] = []
      for (const c of CLASSES) {
        for (const [k, v] of Object.entries(c.passive.base)) {
          if (!c.passive.desc.includes(String(v))) drift.push(`${c.key}.${k}=${v}`)
        }
      }
      ok(drift.length === 0, "V1: all 8 passive descs carry their base param digits (no desc/data drift)", drift.join(", "))
    }

    // V2 — group life feeds the Femboy (game resolution + caps + null path)
    {
      const cV = chat(8), uW = tid(20), uXp = tid(21)
      await post("/api/auth", { telegramId: uW, name: "روح‌بندِ ۱" })
      await post("/api/auth", { telegramId: uXp, name: "روح‌بندِ ۲" })
      await post<{ card: { name: string } }>("/api/game/character", { telegramId: uW, action: "create", payload: { name: "فمبوی دوبل", classKey: "shinobi" } })
      await post<{ card: { name: string } }>("/api/game/character", { telegramId: uXp, action: "create", payload: { name: "فمبوی سکه", classKey: "wizard" } })
      // V19 — شخصیتِ قطعی برای اعدادِ ثابتِ این سناریو: طبع/استعداد/ضعفِ بی‌اثرِ
      // روی XP/گروه (duel/market) — وگرنه طبعِ قطعیِ بازیکن XP را ±می‌کند
      await member(cV, "شهرِ روح", uW, "روح‌بندِ ۱")
      await member(cV, "شهرِ روح", uXp, "روح‌بندِ ۲")
      const gV = await gidOf(cV)
      const pW = await pidOf(uW)
      const pX = await pidOf(uXp)
      // V19 — شخصیتِ قطعی برای اعدادِ ثابتِ این سناریو: طبع/استعداد/ضعفِ بی‌اثرِ
      // روی XP/گروه (duel/market) — وگرنه طبعِ قطعیِ بازیکن XP را ±می‌کند
      await fixture(async () => {
        await db.soulCharacter.updateMany({
          where: { playerId: { in: [pW, pX] } },
          data: { personaKey: "noble", talentKey: "duelist_heart", flawKey: "big_spender" },
        })
      })
      const soulW0 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pW } })
      const soulX0 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pX } })

      // pet_show: minPlayers 2 · candidatesFrom members → رأیِ کامل = حلِ فوری
      const start = await callback(cV, uW, "gm:game:pet_show")
      ok(start.body.data?.ok === true, "V2: pet_show started (gm:game)")
      const session = await db.gameSession.findFirst({ where: { groupId: gV, status: "open" } })
      ok(Boolean(session) && session!.phase === "lobby", "V2: lobby open (instigator auto-joined)")
      if (session) {
        await callback(cV, uXp, `gg:${session.id}:j`)
        const begin = await callback(cV, uW, `gg:${session.id}:b`)
        ok(begin.body.data?.ok === true, "V2: game begun by participant (gg:b)")
        const v1 = await callback(cV, uW, `gg:${session.id}:v:u:${pX}`)
        const v2 = await callback(cV, uXp, `gg:${session.id}:v:u:${pX}`)
        ok(v1.body.data?.ok === true && v2.body.data?.ok === true, "V2: both votes accepted (gg:v)")
        const done = await db.gameSession.findUniqueOrThrow({ where: { id: session.id } })
        ok(done.status === "done", "V2: game resolved by full vote (resolveGame ran)")

        const soulW = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pW } })
        const soulX = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pX } })
        ok(soulW.totalXp === soulW0.totalXp + 4, "V2: participant femboy totalXp +4 (group → soul)")
        ok(soulX.totalXp === soulX0.totalXp + 12, "V2: winner femboy totalXp +12")
        const xpW = JSON.parse(soulW.xpJson) as Record<string, number>
        ok((xpW.battle ?? 0) >= 4, "V2: XP landed on the class's secondary track (shinobi → battle)")
        const masteryX = JSON.parse(soulX.masteryDaily) as { day?: string; events?: number }
        ok((masteryX.events ?? 0) >= 1, "V2: winner's masteryDaily.events incremented (event mastery)")
        const flagW = JSON.parse((await db.player.findUniqueOrThrow({ where: { id: pW } })).flags) as { soulGroupXp?: { day: string; xp: number } }
        ok(flagW.soulGroupXp?.xp === 4, "V2: participant flags.soulGroupXp = 4 (anti-farm counter)")
        const card = await db.groupOutbox.findFirst({ where: { groupId: gV, refType: "game", refId: session.id, kind: "game" }, orderBy: { createdAt: "desc" } })
        ok((card?.text ?? "").includes("+12 XP"), "V2: game result card carries the soul line («+12 XP»)")
      }

      // daily cap — direct pump on a fresh throwaway femboy
      {
        const uCap = tid(22)
        await post("/api/auth", { telegramId: uCap, name: "سقف‌سنج" })
        await post("/api/game/character", { telegramId: uCap, action: "create", payload: { name: "سقف‌سنج", classKey: "ranger" } })
        let appliedTotal = 0
        let lastApplied = -1
        for (let i = 0; i < 5; i++) {
          const r = await awardSoulProgress(db, uCap, { soulXp: 12, reason: "pump" })
          appliedTotal += r?.appliedXp ?? 0
          lastApplied = r?.appliedXp ?? -1
        }
        ok(appliedTotal === SOUL_GROUP_XP_DAY_CAP, `V2: daily cap holds (${appliedTotal} = ${SOUL_GROUP_XP_DAY_CAP}; partial grants allowed)`, `applied=${appliedTotal}`)
        ok(lastApplied === 0, "V2: beyond-cap grant → appliedXp 0 (no error, no write)")
      }

      // no femboy → null award (graceful)
      {
        const uNo = tid(23)
        await post("/api/auth", { telegramId: uNo, name: "بی‌پیمان" })
        const r = await awardSoulProgress(db, uNo, { soulXp: 8, reason: "no femboy" })
        ok(r === null, "V2: player without femboy → null award (no error)")
      }
    }

    // V3 — duel consumes class passives (e2e + pure determinism)
    {
      const uD1 = tid(24), uD2 = tid(25)
      await post("/api/auth", { telegramId: uD1, name: "دوئل‌سنجِ ۱" })
      await post("/api/auth", { telegramId: uD2, name: "دوئل‌سنجِ ۲" })
      await post("/api/game/character", { telegramId: uD1, action: "create", payload: { name: "سایه‌سنج", classKey: "shinobi" } })
      await post("/api/game/character", { telegramId: uD2, action: "create", payload: { name: "سپرسنج", classKey: "paladin" } })
      const pD1 = await pidOf(uD1), pD2 = await pidOf(uD2)
      const pl1 = await db.player.findUniqueOrThrow({ where: { id: pD1 } })
      const pl2 = await db.player.findUniqueOrThrow({ where: { id: pD2 } })
      const duel = await duelCharacters(pl1, pl2)
      ok(duel.duel !== undefined && !duel.error, "V3: duelCharacters resolved (shinobi vs paladin)")
      if (duel.duel) {
        ok(duel.duel.rounds >= 1 && duel.duel.rounds <= 14, "V3: rounds within 1..14 (envelope intact)")
        ok(duel.duel.passiveHighlights.length >= 1, "V3: duel result carries ≥1 passive highlight")
        // V16-1 — پایدارسازیِ صادقانه: DTO فقط ۱۶ خطِ آخرِ log را می‌فرستد
        // (کاتِ ضداسپمِ combat.ts:1146) — در دوئل‌های بلند، خطِ passive اوایل می‌افتد؛
        // passiveHighlights (بی‌برش) همان لحظه‌ها را دارد. قصدِ اصلیِ تست حفظ می‌شود:
        // «محتوای passiveِ کلاس‌دار به بازیکن می‌رسد». بذرِ دوئل Date.now() دارد (flaky).
        const hasPassiveLog = duel.duel.log.some((l) => l.includes("نشانِ سایه") || l.includes("عهدِ تایتان"))
          || duel.duel.passiveHighlights.some((l) => l.includes("نشانِ سایه") || l.includes("عهدِ تایتان"))
        ok(hasPassiveLog, "V3: per-round log/highlights carry class-flavored passive lines")
      }
      const enc = await db.combatEncounter.findFirst({ where: { playerId: pD1, kind: "duel" }, orderBy: { createdAt: "desc" } })
      const res = enc
        ? (JSON.parse(enc.resultJson ?? "{}") as { classes?: { a?: string; b?: string }; finalHp?: { a?: number; b?: number }; rounds?: number; passiveHighlights?: string[] })
        : null
      ok(res?.classes?.a === "shinobi" && res?.classes?.b === "paladin", "V3: resultJson carries both class keys")
      ok(typeof res?.rounds === "number" && (res?.rounds ?? 0) >= 1, "V3: resultJson carries rounds")
      ok(typeof res?.finalHp?.a === "number" && typeof res?.finalHp?.b === "number", "V3: resultJson carries final HP of both sides")
      ok((res?.passiveHighlights?.length ?? 0) >= 1, "V3: resultJson carries ≥1 passive highlight line")

      // pure determinism — fixed-stat sheets, same seed → same winner across 2 runs
      const sheetA: DuelSheet = { name: "سایه‌ی قطعی", emoji: "🥷", atk: 12, def: 5, crit: 13, critDmg: 165, dodge: 14, acc: 86, speed: 11, hp: 46, hpMax: 46, spiritMod: 0, passive: { shadowMarkDmg: 10 }, clsKey: "shinobi" }
      const sheetB: DuelSheet = { name: "سپرِ قطعی", emoji: "🛡️", atk: 11, def: 9, crit: 10, critDmg: 155, dodge: 6, acc: 88, speed: 8, hp: 62, hpMax: 62, spiritMod: 0, passive: { resolveMitg: 30 }, clsKey: "paladin" }
      const run1 = simulateDuel(sheetA, sheetB, mulberry32(seedFrom("vduel", "fixed")))
      const run2 = simulateDuel(sheetA, sheetB, mulberry32(seedFrom("vduel", "fixed")))
      ok(run1.winnerIsA === run2.winnerIsA && run1.rounds === run2.rounds, "V3: same fixed-stat inputs + seed → same winner/rounds (determinism)")
      ok(run1.passiveHighlights.length >= 1, "V3: pure sim yields passive highlights (marks guaranteed vs paladin)")
    }

    // V4 — interaction depth: state-aware variants + memory window + bond reaction
    {
      const uT1 = tid(26), uT2 = tid(27), uT3 = tid(28)
      await post("/api/auth", { telegramId: uT1, name: "تعاملِ ۱" })
      await post("/api/auth", { telegramId: uT2, name: "تعاملِ ۲" })
      await post("/api/auth", { telegramId: uT3, name: "خاطره‌سنج" })
      await post("/api/game/character", { telegramId: uT1, action: "create", payload: { name: "شوریده", classKey: "wizard" } })
      await post("/api/game/character", { telegramId: uT2, action: "create", payload: { name: "دل‌شکسته", classKey: "ranger" } })
      await post("/api/game/character", { telegramId: uT3, action: "create", payload: { name: "خاطره‌انگیز", classKey: "summoner" } })
      const pT1 = await pidOf(uT1), pT2 = await pidOf(uT2), pT3 = await pidOf(uT3)
      const plT1 = await db.player.findUniqueOrThrow({ where: { id: pT1 } })
      const plT2 = await db.player.findUniqueOrThrow({ where: { id: pT2 } })
      const plT3 = await db.player.findUniqueOrThrow({ where: { id: pT3 } })
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pT1 }, data: { spirit: 90 } })
        await db.soulCharacter.update({ where: { playerId: pT2 }, data: { spirit: 20 } })
      })
      const ch1 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pT1 } })
      const ch2 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pT2 } })
      const r1 = await interactWithCharacter(plT1, ch1, "talk")
      const r2 = await interactWithCharacter(plT2, ch2, "talk")
      ok(r1.ok?.variant != null && r2.ok?.variant != null, "V4: interact DTO carries the variant block")
      ok(r1.ok?.variant?.variantId !== r2.ok?.variant?.variantId, "V4: spirit band changes the selected variant (different ids)")
      ok(r1.ok?.variant?.spiritBandIndex === 0 && r2.ok?.variant?.spiritBandIndex === 3, "V4: band indices correct (90 → شوریده, 20 → دل‌شکسته)")
      ok(r1.ok?.variant?.moodLine !== r2.ok?.variant?.moodLine, "V4: flavor text differs across spirit bands")

      // memory window — 7 seeded milestones → at most 5 returned
      const ch3 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pT3 } })
      for (let i = 0; i < 7; i++) {
        await db.characterLog.create({ data: { characterId: ch3.id, type: "victory", icon: "⚔️", text: `بردِ شماره‌ی ${i + 1}`, isPublic: true } })
      }
      const mem = await interactWithCharacter(plT3, ch3, "memory")
      ok(mem.ok?.memory != null && (mem.ok?.memory?.count ?? 0) <= 5, "V4: memory returns ≤5 entries (7 seeded)")
      ok((mem.ok?.message ?? "").includes("بردِ شماره‌ی 7"), "V4: newest milestone is in the window")

      // bond reaction — praise (+1 bond) crosses 25 → first unlock fires
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pT2 }, data: { bond: 24, lastInteractAt: null } })
      })
      const ch2b = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pT2 } })
      const r3 = await interactWithCharacter(plT2, ch2b, "praise")
      ok(r3.ok?.reaction != null && r3.ok?.reaction?.threshold === 25, "V4: bond ≥25 → reaction line (threshold 25)")
      ok(r3.ok?.unlock != null && r3.ok?.unlock?.threshold === 25, "V4: first crossing exposes unlock info")
      ok((r3.ok?.message ?? "").includes("واکنش تازه"), "V4: message carries «واکنش تازه» on first unlock")
    }

    // V5 — soulCardDTO Layer B: stat explanations + live passive detail + combat identity
    {
      const uCard = tid(29)
      await post("/api/auth", { telegramId: uCard, name: "کارت‌سنج" })
      await post("/api/game/character", { telegramId: uCard, action: "create", payload: { name: "کارت‌سنج", classKey: "shinobi" } })
      const pCard = await pidOf(uCard)
      const char = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pCard } })
      const card = soulCardDTO(char)
      const statKeys = (card.statExplanations ?? []).map((s) => s.key)
      const expectedKeys = ["atk", "def", "crit", "critDmg", "dodge", "acc", "speed", "luck", "loot"]
      ok(statKeys.length === 9 && expectedKeys.every((k) => statKeys.includes(k)), "V5: statExplanations present with all 9 stat keys", statKeys.join(","))
      ok((card.statExplanations ?? []).every((s) => s.textFa.length > 5 && s.labelFa.length > 0), "V5: every stat explanation carries label + text")
      ok(card.passiveDetail?.paramsLive?.shadowMarkDmg === 10, "V5: passiveDetail.paramsLive matches the live params (shadowMarkDmg 10)")
      ok((card.passiveDetail?.descFa ?? "").includes("10"), "V5: passiveDetail.descFa interpolates the live value")
      ok((card.combatIdentity?.strengths?.length ?? 0) >= 1 && (card.combatIdentity?.weaknesses?.length ?? 0) >= 1 && (card.combatIdentity?.playStyle?.length ?? 0) > 0, "V5: combatIdentity surfaces strengths/weaknesses/playStyle")
      // English digits only in the new player-facing texts
      const faRe = /[۰-۹٠-٩]/
      ok(!faRe.test((card.statExplanations ?? []).map((s) => s.textFa).join(" ")) && !faRe.test(card.passiveDetail?.descFa ?? ""), "V5: new Layer-B texts carry English digits only")
    }
  }

  // §H — V15-1 (Task V15-1): هابِ ۱۲-بخشیِ ناوبریِ گروه + فرمان‌هایِ duels/economy/fame
  //   — رویِ HTTPِ واقعی، مثلِ ربات: ۱۲ دکمه‌ی gm:nav:* رویِ کارتِ خانه، کارتِ
  //   هر بخش با فرزند و بازگشت، شمارشِ برنامه‌پذیرِ مقصدهای متمایز ≥ 30.
  section("§H V15 navigation hub — 12 sections, ≥30 real child destinations")
  {
    const cH = chat(9), uH1 = tid(31), uH2 = tid(32)
    const NAV_KEYS = ["world", "events", "votes", "battle", "players", "femboy", "items", "economy", "fame", "games", "help", "settings"]
    const faReH = /[۰-۹٠-٩]/

    // دو شهروندِ با فمبویِ روح‌بسته — برای دوئلِ واقعیِ کارتِ «نبردها»
    await member(cH, "شهرِ هاب", uH1, "هاب‌سنجِ ۱")
    await member(cH, "شهرِ هاب", uH2, "هاب‌سنجِ ۲")
    await post("/api/game/character", { telegramId: uH1, action: "create", payload: { name: "هابیکا", classKey: "shinobi" } })
    await post("/api/game/character", { telegramId: uH2, action: "create", payload: { name: "هابلا", classKey: "wizard" } })

    // ── کارتِ خانه = هاب ──
    const home = await command(cH, uH1, "game")
    const homeBtns = home.body.data?.buttons ?? []
    const navCbs = homeBtns.map((b) => b.cb ?? "").filter((cb) => cb.startsWith("gm:nav:"))
    ok(home.status === 200 && home.body.ok === true, "H: /game home card renders (hub)")
    ok(NAV_KEYS.length === 12 && NAV_KEYS.every((k) => navCbs.includes(`gm:nav:${k}`)), `H: home carries all 12 gm:nav:{key} buttons (found ${navCbs.length})`)
    ok((home.body.data?.text ?? "").includes("منوی شهر"), "H: home text carries the «منوی شهر» hub section")
    ok(homeBtns.some((b) => b.cb === "gm:game") && homeBtns.length <= 20, `H: home keeps back/refresh and ≤20 buttons (found ${homeBtns.length})`)
    // گریدِ ۲ستونه — نشانه‌ی چیدمانِ فشرده روی دکمه‌های فردِ گرید
    const grid = homeBtns.filter((b) => (b.cb ?? "").startsWith("gm:nav:"))
    ok(grid.length === 12 && grid.filter((b) => b.sameRow === true).length === 6, "H: nav grid emitted as 6 sameRow pairs (compact 2-column intent)")
    ok(homeBtns.every((b) => !faReH.test(b.label)), "H: home button labels carry English digits only")

    // ── آرامشِ اولیه — قطعیتِ رندر (بدون شمارشِ معکوسِ زنده) ──
    const w1 = await callback(cH, uH1, "gm:nav:world")
    const w2 = await callback(cH, uH1, "gm:nav:world")
    ok(w1.body.data?.ok === true && JSON.stringify(w1.body.data?.editCard) === JSON.stringify(w2.body.data?.editCard), "H: same gm:nav:world twice → identical editCard (determinism)")

    // ── هر ۱۲ بخش: کارتِ معتبر + فرزند + بازگشت ──
    const sectionChildDestinations = new Map<string, string>() // key = cb یا url
    const destOf = (b: Btn): string => b.cb ?? b.url ?? ""
    const sectionTexts: string[] = []
    let sectionsWithBack = 0
    let sectionsWithChildren = 0
    for (const k of NAV_KEYS) {
      const r = await callback(cH, uH1, `gm:nav:${k}`)
      const card = r.body.data?.editCard
      const btns = card?.buttons ?? []
      if (r.body.data?.ok === true && (card?.text ?? "").length > 0 && btns.some((b) => b.cb === "gm:game")) sectionsWithBack++
      const children = btns.filter((b) => b.cb !== "gm:game")
      if (children.length >= 2) sectionsWithChildren++
      for (const b of children) {
        const d = destOf(b)
        if (d) sectionChildDestinations.set(d, k)
      }
      if (card?.text) sectionTexts.push(card.text)
      ok(r.body.data?.ok === true && Boolean(card) && btns.length >= 3, `H: gm:nav:${k} → section card with ≥3 buttons`)
      ok(btns.some((b) => b.cb === "gm:game"), `H: gm:nav:${k} carries «↩ خانه» back navigation`)
      ok(children.filter((b) => destOf(b)).length >= 2, `H: gm:nav:${k} has ≥2 real children beyond back`)
    }
    ok(sectionsWithBack === 12 && sectionsWithChildren === 12, "H: all 12 sections have back + ≥2 children")
    ok(sectionTexts.every((t) => !faReH.test(t)), "H: section card texts carry English digits only")

    // مقصدهای نامعتبر ممنوع — هیچ دکمه‌ای بدونِ cb/url نیست
    const allSectionBtns: Btn[] = []
    for (const k of NAV_KEYS) {
      const r = await callback(cH, uH1, `gm:nav:${k}`)
      allSectionBtns.push(...(r.body.data?.editCard?.buttons ?? []))
    }
    ok(allSectionBtns.every((b) => Boolean(b.cb) || Boolean(b.url)), "H: every section button carries a real cb or url (no dead buttons)")
    ok(sectionChildDestinations.size >= 28, `H: 12 sections expose ≥28 distinct child destinations (found ${sectionChildDestinations.size})`)

    // ── بازیِ باز: دکمه‌ی ثبت‌نامِ contextual در بخشِ «بازی‌ها» ──
    const hubGroup = await db.groupWorld.findUniqueOrThrow({ where: { chatId: cH } })
    const startableGame = (await playableGames(hubGroup)).find((g) => g.ok)
    if (startableGame) {
      const started = await callback(cH, uH1, `gm:game:${startableGame.key}`)
      ok(started.body.data?.ok === true, `H: a real group game started via gm:game:{key} (${startableGame.key})`)
      const games2 = await callback(cH, uH2, "gm:nav:games")
      const join = (games2.body.data?.editCard?.buttons ?? []).find((b) => (b.cb ?? "").startsWith("gg:") && (b.cb ?? "").endsWith(":j"))
      ok(Boolean(join), "H: nav:games shows the live join button (gg:{id}:j) for a non-participant")
      if (join?.cb) sectionChildDestinations.set(join.cb, "games")
    } else {
      ok(false, "H: playableGames offered a startable game for 2 active citizens")
    }

    // ── دوئلِ واقعی: کارتِ بخشِ «نبردها» + کارتِ duels با فعل‌های gc: ──
    const duelCreate = await command(cH, uH1, `duel ${uH2}`)
    ok(duelCreate.body.data?.text.includes("دعوت‌نامه فرستاده شد") === true, "H: real duel invitation created (/duel {target})")
    const duelsCmd = await command(cH, uH2, "duels")
    const duelsBtns = duelsCmd.body.data?.buttons ?? []
    const accept = duelsBtns.find((b) => (b.cb ?? "").endsWith(":accept"))
    const decline = duelsBtns.find((b) => (b.cb ?? "").endsWith(":decline"))
    ok(duelsCmd.status === 200 && (duelsCmd.body.data?.text ?? "").includes("دعوت‌های دوئل"), "H: /duels renders the pending-challenges card")
    ok(Boolean(accept) && Boolean(decline), "H: duels card shows gc: accept/decline for the TARGET viewer")
    const duelsChallenger = await command(cH, uH1, "duels")
    const cancel = (duelsChallenger.body.data?.buttons ?? []).find((b) => (b.cb ?? "").endsWith(":cancel"))
    ok(Boolean(cancel), "H: duels card shows gc: cancel for the CHALLENGER viewer")
    for (const b of [...duelsBtns, ...(duelsChallenger.body.data?.buttons ?? [])]) {
      const d = destOf(b)
      if (d && d !== "gm:game") sectionChildDestinations.set(d, "duels")
    }
    // فعلِ واقعی: هدف دعوت را می‌پذیرد → دوئل حل می‌شود (همان مسیرِ gc: موجود)
    if (accept?.cb) {
      const acc = await callback(cH, uH2, accept.cb)
      ok(acc.body.data?.ok === true, "H: target accepts from the duels card (gc:accept → real duel)")
    }

    // ── سه فرمانِ تازه: کارت‌های داده‌محور ──
    const eco = await command(cH, uH1, "economy")
    const ecoBtns = eco.body.data?.buttons ?? []
    ok(eco.status === 200 && (eco.body.data?.text ?? "").includes("اقتصاد و بازار") && (eco.body.data?.text ?? "").includes("صندوقِ شهر"), "H: /economy renders treasury + market card")
    ok((eco.body.data?.text ?? "").includes("شاخصِ بازارِ جهان") && ecoBtns.some((b) => b.cb === "gm:city") && ecoBtns.some((b) => (b.cb ?? "").startsWith("gh:c:economy")), "H: /economy carries world index + city/codex children")
    const fame1 = await command(cH, uH1, "fame")
    const fameBtns = fame1.body.data?.buttons ?? []
    const boards = fameBtns.map((b) => b.cb ?? "").filter((cb) => cb.startsWith("gm:fame:"))
    ok(fame1.status === 200 && (fame1.body.data?.text ?? "").includes("تالارِ افتخارات"), "H: /fame renders the hall of fame card")
    ok(boards.length === 6, `H: /fame carries 6 board-switch buttons (found ${boards.length})`)
    const fameWins = await callback(cH, uH1, "gm:fame:wins")
    ok(fameWins.body.data?.ok === true && (fameWins.body.data?.editCard?.text ?? "").includes("تالارِ افتخارات"), "H: gm:fame:wins switches the board (editCard)")
    for (const b of [...ecoBtns, ...fameBtns]) {
      const d = destOf(b)
      if (d && d !== "gm:game") sectionChildDestinations.set(d, "drill")
    }
    const top = await callback(cH, uH1, "gm:top")
    ok(top.body.data?.ok === true && (top.body.data?.editCard?.text ?? "").includes("برترین‌های شهر"), "H: gm:top renders the group leaderboard card")
    ok((top.body.data?.editCard?.text ?? "").includes("برد") && (top.body.data?.editCard?.buttons ?? []).some((b) => b.cb === "gm:members"), "H: gm:top shows real member stats + members child")
    const gh = await callback(cH, uH1, "gm:help")
    ok(gh.body.data?.ok === true && (gh.body.data?.editCard?.text ?? "").includes("حلقه‌ی بازی"), "H: gm:help renders the quick group guide (help command card)")
    const gad = await callback(cH, uH1, "gm:gadmin")
    ok(gad.body.data?.ok === true && (gad.body.data?.editCard?.text ?? "").includes("تنظیماتِ شهر"), "H: gm:gadmin renders the settings card (report-only for non-admin)")
    const cityH = await callback(cH, uH1, "gm:city")
    ok(cityH.body.data?.ok === true && (cityH.body.data?.editCard?.text ?? "").includes("شهرِ"), "H: gm:city renders the city card")
    const badNav = await callback(cH, uH1, "gm:nav:nonsense")
    ok(badNav.body.data?.ok === false && badNav.body.data?.ackText === "چنین بخشی در شهر نیست.", "H: unknown nav key → honest rejection")

    // ── شمارشِ نهاییِ مأموریت §2: ≥۳۰ مقصد/کنشِ فرزندِ متمایز ──
    ok(sectionChildDestinations.size >= 35, `H: MISSION COUNT — ≥35 distinct child destinations/actions (found ${sectionChildDestinations.size})`)
    console.log(`     ℹ child destinations: ${sectionChildDestinations.size} distinct — ${[...sectionChildDestinations.keys()].slice(0, 12).join(" · ")} …`)
  }

  // §P — V15-3 (مأموریت §10): تست‌های E–J — پنل‌های اشتراکیِ شهر رویِ HTTPِ واقعی.
  //   E چند شرکت‌کننده روی همان پنل · F ارسالِ تکراری · G رأیِ هم‌زمان (قفلِ بخشیِ
  //   V15-3) · H بستنِ رویداد · I جداییِ گروه‌ها · J مجوزها (ادمین/نقشِ دوئل).
  section("§P V15-3 mission tests E–J (shared city/group panels)")
  {
    const cP1 = chat(10), cP2 = chat(11)
    const u1 = tid(40), u2 = tid(41), u3 = tid(42), u4 = tid(43), u5 = tid(44), u6 = tid(45)
    const uI1 = tid(46), uI2 = tid(47), uI3 = tid(48)
    for (const [t, n] of [[u1, "پنل ۱"], [u2, "پنل ۲"], [u3, "پنل ۳"], [u4, "پنل ۴"], [u5, "پنل ۵"], [u6, "پنل ۶"], [uI1, "جزیره ۱"], [uI2, "جزیره ۲"], [uI3, "جزیره ۳"]] as [string, string][]) {
      await post("/api/auth", { telegramId: t, name: n })
    }
    for (const t of [u1, u2, u3, u4, u5, u6]) await member(cP1, "شهرِ پنلِ اشتراکی", t, "پنلی")
    for (const t of [uI1, uI2, uI3]) await member(cP2, "شهرِ جزیره", t, "جزیره‌ای")
    // فمبوی برای دوئلِ نقش‌محورِ Test J — u1 (رأی‌دهنده) ↔ u4 (رأی‌دهنده؛ هر دو
    // غیرشرکت‌کننده در رویدادِ H تا روحیه/استقامتِشان دست‌نخورده بماند).
    // نام‌ها ساده‌اند — علامت‌های اِعراب (مثلِ کسره) در اعتبارسنجیِ پیمان رد می‌شوند.
    const chU1 = await post<{ card: { name: string } }>("/api/game/character", { telegramId: u1, action: "create", payload: { name: "پنل یک", classKey: "shinobi" } })
    const chU4 = await post<{ card: { name: string } }>("/api/game/character", { telegramId: u4, action: "create", payload: { name: "پنل چهار", classKey: "wizard" } })
    ok(chU1.body.ok === true, "J-fixture: challenger soul character created", chU1.body.error ?? "")
    ok(chU4.body.ok === true, "J-fixture: target soul character created", chU4.body.error ?? "")
    const gP1 = await gidOf(cP1), gP2 = await gidOf(cP2)
    const p1 = await pidOf(u1), p2 = await pidOf(u2), p3 = await pidOf(u3)

    // ── Test E: چند شرکت‌کننده روی همان پنلِ اشتراکی — ثبت، باز‌ماندن، جمع ──
    const elect = await callback(cP1, u1, "gm:elect")
    const vote = await db.groupVote.findFirst({ where: { groupId: gP1, status: "open" }, orderBy: { createdAt: "desc" } })
    ok(elect.body.data?.ok === true && Boolean(vote), "E: shared vote panel created (gm:elect → open vote row)")
    if (vote) {
      const options = JSON.parse(vote.optionsJson) as { key: string }[]
      const k0 = options[0]!.key
      const k1 = options[1]?.key ?? options[0]!.key
      const vE1 = await callback(cP1, u1, `gv:${vote.id}:${k0}`)
      ok(vE1.body.data?.ok === true && vE1.body.data?.ackText === "رأیت ثبت شد.", "E: P1 submission recorded on the shared panel")
      // پنل برای بقیه باز می‌ماند — کارتِ رأی هنوز دکمه‌های gv: را می‌دهد
      const stillOpen = await command(cP1, u2, "vote")
      ok((stillOpen.body.data?.buttons ?? []).some((b) => b.cb === `gv:${vote.id}:${k1}`), "E: shared panel still serves buttons to other players (re-render)")
      const vE2 = await callback(cP1, u2, `gv:${vote.id}:${k1}`)
      ok(vE2.body.data?.ok === true, "E: P2 could still use the same shared panel after P1's vote")
      const tally = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
      const total = Object.values(tally).reduce((s, ids) => s + ids.length, 0)
      ok(total === 2, "E: both responses preserved in authoritative state (total = 2)")
      ok((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).status === "open", "E: panel lifecycle still 'open' — one player's vote did NOT close it")

      // ── Test F: ارسالِ تکراری — قانونِ واقعی + بدونِ رکوردِ دوبله ──
      const dup = await callback(cP1, u1, `gv:${vote.id}:${k0}`)
      ok(dup.body.data?.ok === false && dup.body.data?.ackText === "همین رأی را داده‌ای.", "F: duplicate same-option press → «همین رأی را داده‌ای.»")
      const k2 = options[2]?.key ?? k1
      const change = await callback(cP1, u1, `gv:${vote.id}:${k2}`)
      ok(change.body.data?.ok === true, "F: vote CHANGE allowed (loose democracy — the engine's real rule)")
      const tallyF = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
      const timesP1 = Object.values(tallyF).filter((ids) => ids.includes(p1)).length
      const totalF = Object.values(tallyF).reduce((s, ids) => s + ids.length, 0)
      ok(timesP1 === 1 && totalF === 2, "F: voter counted exactly once after duplicate + change (no duplicate records)")

      // ── Test G: رأی‌گیریِ هم‌زمان — ۴ فشارِ موازی، هیچ رأیی گم نمی‌شود ──
      const gKeys = [3, 4, 5, 5].map((i) => options[Math.min(i, options.length - 1)]!.key)
      const results = await Promise.all([u3, u4, u5, u6].map((u, i) => callback(cP1, u, `gv:${vote.id}:${gKeys[i]}`)))
      ok(results.every((r) => r.body.data?.ok === true), "G: 4 concurrent submissions all accepted (section lock — no busy/lost votes)")
      const tallyG = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
      const totalG = Object.values(tallyG).reduce((s, ids) => s + ids.length, 0)
      ok(totalG === 6, `G: correct totals under concurrency (expected 6, got ${totalG})`)

      // ── Test I: جداییِ گروه‌ها — مشارکت/نتیجه‌ی هر شهر جدا ──
      const elect2 = await callback(cP2, uI1, "gm:elect")
      const vote2 = await db.groupVote.findFirst({ where: { groupId: gP2, status: "open" }, orderBy: { createdAt: "desc" } })
      ok(elect2.body.data?.ok === true && Boolean(vote2), "I: second group opened its own vote (same event kind)")
      if (vote2) {
        const opts2 = JSON.parse(vote2.optionsJson) as { key: string }[]
        const vI1 = await callback(cP2, uI1, `gv:${vote2.id}:${opts2[0]!.key}`)
        ok(vI1.body.data?.ok === true, "I: islander voted in their own group")
        const t1 = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
        const t2 = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote2.id } })).tallyJson) as Record<string, string[]>
        const pI1 = await pidOf(uI1)
        ok(!Object.values(t1).some((ids) => ids.includes(pI1)), "I: group 1 tally does NOT contain group 2's voter")
        ok(!Object.values(t2).some((ids) => ids.includes(p3)), "I: group 2 tally does NOT contain group 1's voter")
        const total2 = Object.values(t2).reduce((s, ids) => s + ids.length, 0)
        ok(total2 === 1, "I: group 2 totals isolated (1 vote, not 7)")
      }

      // ── Test H: بستنِ رویداد — ارسالِ تازه رد؛ نتیجه‌ی نهایی حفظ ──
      await armEventPacing(cP1)
      await command(cP1, u1, "event") // اتفاقِ تازه (کارت از outbox می‌رسد)
      let ev = await db.groupEvent.findFirst({ where: { groupId: gP1, status: "open" }, orderBy: { createdAt: "desc" } })
      if (!ev || ev.templateId === "style_show") {
        if (ev) await callback(cP1, u1, "gs:recover", true) // ادمین: بستنِ زودهنگامِ رویدادِ بی‌گزینه
        await armEventPacing(cP1)
        await command(cP1, u1, "event")
        ev = await db.groupEvent.findFirst({ where: { groupId: gP1, status: "open" }, orderBy: { createdAt: "desc" } })
      }
      ok(Boolean(ev) && ev!.templateId !== "style_show", "H: open choice-event available")
      if (ev) {
        const choices = JSON.parse(ev.choicesJson) as { key: string }[]
        if (choices.length > 0) {
          const hChoice = await callback(cP1, u2, `ge:${ev.id}:${choices[0]!.key}`)
          ok(hChoice.body.data?.ok === true, "H: choice recorded while event open")
          ok((await db.groupEventParticipant.count({ where: { eventId: ev.id, playerId: p2 } })) === 1, "H: participant row exists (exactly one)")
        }
        // مهلت جلوتر + تیکِ شهر → حل
        await fixture(async () => {
          await db.groupEvent.update({ where: { id: ev!.id }, data: { expiresAt: new Date(Date.now() - 60_000) } })
          await db.groupWorld.update({ where: { id: gP1 }, data: { lastTickAt: new Date(Date.now() - 90_000) } })
        })
        await command(cP1, u1, "help") // بیداریِ شهر (رفعِ هر مکثِ تحویل)
        await tick()
        const evAfter = await db.groupEvent.findUniqueOrThrow({ where: { id: ev.id } })
        ok(evAfter.status === "expired" || evAfter.status === "resolved", `H: event closed by lifecycle (${evAfter.status})`)
        if (choices.length > 0) {
          const late = await callback(cP1, u3, `ge:${ev.id}:${choices[0]!.key}`)
          ok(late.body.data?.ok === false && late.body.data?.ackText === "این اتفاق دیگه باز نیست.", "H: NEW submission after closure → rejected")
          ok((await db.groupEventParticipant.count({ where: { eventId: ev.id } })) === 1, "H: final state preserved — no new participant rows after closure")
        }
      }

      // ── Test J: مجوزها — شرکت‌کننده‌ی معمولی ≠ ادمینِ تاییدشده؛ نقشِ دوئل ──
      const jNo = await callback(cP1, u3, "gs:toggle:enabled") // بدونِ isAdmin — ترنسپورتِ غیرادمین
      ok(jNo.body.data?.ok === false && jNo.body.data?.ackText === "فقط ادمین‌های گروه.", "J: ordinary participant CANNOT toggle city settings (admin gate)")
      const jYes = await callback(cP1, u3, "gs:toggle:enabled", true) // ادمینِ تاییدشده‌ی زنده (مسیرِ ربات)
      ok(jYes.body.data?.ok === true, "J: verified admin CAN toggle (isAdmin via service-key transport)")
      const jBack = await callback(cP1, u3, "gs:toggle:enabled", true)
      ok(jBack.body.data?.ok === true, "J: admin toggles back (city re-enabled — state restored)")
      // نقش‌ها در پنلِ اشتراکیِ دوئل: ناظر دعوتِ دیگری را قبول نمی‌کند
      const duelJ = await command(cP1, u1, `duel ${u4}`)
      ok((duelJ.body.data?.text ?? "").includes("دعوت‌نامه فرستاده شد"), "J: challenge created for the role test", (duelJ.body.data?.text ?? "").slice(0, 120))
      const chJ = await db.groupChallenge.findFirst({ where: { groupId: gP1, status: "pending" }, orderBy: { createdAt: "desc" } })
      if (chJ) {
        const bystander = await callback(cP1, u3, `gc:${chJ.id}:accept`)
        ok(bystander.body.data?.ok === false && bystander.body.data?.ackText === "این دعوت برای تو نیست.", "J: bystander cannot accept someone else's duel (role check)")
        ok((await db.groupChallenge.findUniqueOrThrow({ where: { id: chJ.id } })).status === "pending", "J: unauthorized press left the challenge untouched")
      } else {
        ok(false, "J: challenge row missing — role test could not run", `duel ack: ${(duelJ.body.data?.text ?? "").slice(0, 160)}`)
      }
    }
  }

  // §Q — V16-1 (مشکل ③ ممیزی): شمارِ زنده‌ی پنلِ رأی — gv: بعد از ثبت، همان
  //   پیام با سطرِ بی‌نامِ «N رأی تا الان» بازچینی می‌شود (editCard مثلِ ge:)،
  //   دکمه‌های gv: می‌مانند، رأیِ مخفیِ گزینه‌به‌گزینه لو نمی‌رود، و فشارِ
  //   تکراری ویرایشِ تازه نمی‌سازد. دادگاه همان قرارداد را می‌گیرد.
  section("§Q V16-1 vote panel live counts (audit problem ③)")
  {
    const cQ = chat(12)
    const uQ1 = tid(50), uQ2 = tid(51), uQ3 = tid(52)
    // انتخابات حداقل ۳ شهروندِ فعال می‌خواهد (openElection) — uQ3 فقط جمعیت است
    for (const [t, n] of [[uQ1, "رای سنج یک"], [uQ2, "رای سنج دو"], [uQ3, "رای سنج سه"]] as [string, string][]) {
      await post("/api/auth", { telegramId: t, name: n })
      await member(cQ, "شهر رای زنده", t, "رای سنج")
    }
    const gQ = await gidOf(cQ)
    const strip = (t: unknown) => String(t ?? "").replace(/<[^>]+>/g, "")

    const elect = await callback(cQ, uQ1, "gm:elect")
    const vote = await db.groupVote.findFirst({ where: { groupId: gQ, status: "open" }, orderBy: { createdAt: "desc" } })
    ok(elect.body.data?.ok === true && Boolean(vote) && vote!.kind === "election", "Q: election panel opened (gm:elect)")
    if (vote) {
      const options = JSON.parse(vote.optionsJson) as { key: string; label: string }[]
      const k0 = options[0]!.key
      const k1 = options[1]?.key ?? options[0]!.key

      // ۱) اولین رأی → editCard با «1 رأی تا الان» + همه‌ی دکمه‌ها
      const v1 = await callback(cQ, uQ1, `gv:${vote.id}:${k0}`)
      ok(v1.body.data?.ok === true && v1.body.data?.ackText === "رأیت ثبت شد.", "Q: first vote recorded")
      const card1 = v1.body.data?.editCard
      ok(Boolean(card1) && (card1?.text ?? "").length > 0, "Q: response carries editCard (panel refreshes in place — ge: pattern)")
      ok(strip(card1?.text).includes("1 رأی تا الان"), "Q: card shows the anonymized public count «1 رأی تا الان»")
      ok(!/—\s*<code>\d+<\/code>\s*رأی/.test(card1?.text ?? ""), "Q: election card leaks NO per-option counts (ballot secrecy preserved)")
      const cbs1 = (card1?.buttons ?? []).map((b) => b.cb ?? "")
      ok(options.every((o) => cbs1.includes(`gv:${vote.id}:${o.key}`)), "Q: panel re-serves ALL option buttons (stays interactive)")

      // ۲) دومین رأی‌دهنده → «2 رأی تا الان»
      const v2 = await callback(cQ, uQ2, `gv:${vote.id}:${k1}`)
      ok(v2.body.data?.ok === true, "Q: second voter recorded on the same panel")
      ok(strip(v2.body.data?.editCard?.text).includes("2 رأی تا الان"), "Q: count line now reads «2 رأی تا الان»")
      ok((v2.body.data?.editCard?.buttons ?? []).some((b) => b.cb === `gv:${vote.id}:${k0}`), "Q: second voter's card still serves the other options")
      ok(!/—\s*<code>\d+<\/code>\s*رأی/.test(v2.body.data?.editCard?.text ?? ""), "Q: second card leaks NO per-option counts either")

      // ۳) فشارِ تکراریِ همان گزینه → بدونِ editCard (رفتارِ دیروز)؛ جمعِ مرجع ۲ می‌ماند
      const dup = await callback(cQ, uQ1, `gv:${vote.id}:${k0}`)
      ok(dup.body.data?.ok === false && dup.body.data?.ackText === "همین رأی را داده‌ای.", "Q: duplicate same-option press → «همین رأی را داده‌ای.»")
      ok(dup.body.data?.editCard === undefined, "Q: duplicate press produces NO editCard (no counts changed beyond actual state)")
      const tallyQ = JSON.parse((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).tallyJson) as Record<string, string[]>
      ok(Object.values(tallyQ).reduce((s, ids) => s + ids.length, 0) === 2, "Q: authoritative tally stays at 2 (editCard is view-only)")

      // ۴) بستنِ انتخابات → دادگاه همان قراردادِ زنده را می‌گیرد
      await fixture(async () => {
        await db.groupVote.update({ where: { id: vote.id }, data: { closesAt: new Date(Date.now() - 60_000) } })
        await db.groupWorld.update({ where: { id: gQ }, data: { lastTickAt: new Date(Date.now() - 90_000) } })
      })
      await command(cQ, uQ1, "help") // بیداریِ شهر
      await tick()
      ok((await db.groupVote.findUniqueOrThrow({ where: { id: vote.id } })).status === "closed", "Q: election closed by lifecycle (closesAt + tick)")
      const court = await callback(cQ, uQ2, "gm:court")
      const courtVote = await db.groupVote.findFirst({ where: { groupId: gQ, status: "open" }, orderBy: { createdAt: "desc" } })
      ok(court.body.data?.ok === true && Boolean(courtVote) && courtVote!.kind === "court", "Q: court panel opened after election closed")
      if (courtVote) {
        const cv1 = await callback(cQ, uQ1, `gv:${courtVote.id}:guilty`)
        ok(cv1.body.data?.ok === true, "Q: court vote recorded (guilty)")
        ok(strip(cv1.body.data?.editCard?.text).includes("1 رأی تا الان"), "Q: court panel also shows the live anonymized count")
        const courtCbs = (cv1.body.data?.editCard?.buttons ?? []).map((b) => b.cb ?? "")
        ok(courtCbs.includes(`gv:${courtVote.id}:innocent`) && courtCbs.includes(`gv:${courtVote.id}:abstain`), "Q: court panel re-serves guilty/innocent/abstain buttons")
        ok(!/—\s*<code>\d+<\/code>\s*رأی/.test(cv1.body.data?.editCard?.text ?? ""), "Q: court card leaks NO per-option counts")
      }
    }
  }

  // §Q2 — V16-1 (مشکل ⑩ ممیزی): پارتیتِ مبلغِ کمک — gm:contribute دیگر 2000ِ
  //   ثابت نیست؛ انتخابگرِ مبلغ از جیبِ واقعیِ بازیکن می‌سازد (gp:{id}:{amount})؛
  //   مسیرِ قدیمیِ مستقیمِ gp: کار می‌کند (سازگاریِ عقبی)؛ ثبتِ دقیق در
  //   contributedJson؛ جیبِ خالی صادقانه رد می‌شود.
  section("§Q2 V16-1 contribute amount parity (audit problem ⑩)")
  {
    const cQ2 = chat(13)
    const uR1 = tid(53), uR2 = tid(54), uR3 = tid(55)
    for (const [t, n] of [[uR1, "آجرگذار یک"], [uR2, "آجرگذار دو"], [uR3, "بی‌جیب"]] as [string, string][]) {
      await post("/api/auth", { telegramId: t, name: n })
      await member(cQ2, "شهر آجر", t, "آجرگذار")
    }
    const gQ2 = await gidOf(cQ2)
    const pR1 = await pidOf(uR1), pR2 = await pidOf(uR2), pR3 = await pidOf(uR3)
    // جیب‌های معلوم: 3,000 / 5,000 / 0 — انتخابگر باید از همین‌ها بسازد
    await fixture(async () => {
      await db.player.update({ where: { id: pR1 }, data: { money: 3000 } })
      await db.player.update({ where: { id: pR2 }, data: { money: 5000 } })
      await db.player.update({ where: { id: pR3 }, data: { money: 0 } })
    })

    const np = await callback(cQ2, uR1, "gm:newproject:night_market")
    ok(np.body.data?.ok === true && np.body.data?.ackText === "پروژه افتتاح شد.", "Q2: project started (gm:newproject:night_market)")
    const proj = await db.groupProject.findFirst({ where: { groupId: gQ2, templateId: "night_market", status: "building" } })
    ok(Boolean(proj) && proj!.goal === 100000, "Q2: building project row exists (goal 100000)")
    if (proj) {
      const strip2 = (t: unknown) => String(t ?? "").replace(/<[^>]+>/g, "")

      // انتخابگرِ مبلغ — از جیبِ واقعیِ بازیکن
      const pick = await callback(cQ2, uR1, "gm:contribute:night_market")
      ok(pick.body.data?.ok === true && Boolean(pick.body.data?.editCard), "Q2: gm:contribute serves the amount-picker card (no silent fixed charge)")
      ok(strip2(pick.body.data?.editCard?.text).includes("3,000"), "Q2: picker shows the player's REAL money (3,000)")
      const pickBtns = pick.body.data?.editCard?.buttons ?? []
      const amountBtns = pickBtns.filter((b) => (b.cb ?? "").startsWith(`gp:${proj.id}:`))
      ok(amountBtns.length >= 2 && amountBtns.length <= 3, `Q2: picker derives ${amountBtns.length} money-backed tiers (25%/50%/all)`)
      const amounts = amountBtns.map((b) => Number((b.cb ?? "").split(":").at(-1)))
      ok(amounts.every((a) => Number.isFinite(a) && a > 0 && a <= 3000), `Q2: every tier amount is > 0 and ≤ real money (${amounts.join("/")})`)
      ok(pickBtns.some((b) => b.cb === "gm:projects"), "Q2: picker carries the back button (↩ پروژه‌ها)")

      // مبلغِ انتخابگر در DB می‌نشیند — همان گرامرِ gp:{projectId}:{amount}
      const chosenCb = amountBtns.at(-1)?.cb ?? `gp:${proj.id}:3000`
      const amount = Number(chosenCb.split(":").at(-1))
      const contrib1 = await callback(cQ2, uR1, chosenCb)
      ok(contrib1.body.data?.ok === true && (contrib1.body.data?.ackText ?? "").startsWith("کمکت ثبت شد"), `Q2: picker amount (${amount}) contributed via gp:{id}:{amount}`)
      const contributed1 = JSON.parse((await db.groupProject.findUniqueOrThrow({ where: { id: proj.id } })).contributedJson) as Record<string, number>
      ok((contributed1[pR1] ?? 0) === amount, `Q2: contributedJson records exactly the picked amount (${amount})`)

      // مسیرِ قدیمیِ مستقیم (دکمه‌های ثابتِ کارت‌های کهنه) — همچنان بی‌تغییر
      const fixed = await callback(cQ2, uR2, `gp:${proj.id}:1000`)
      ok(fixed.body.data?.ok === true && (fixed.body.data?.ackText ?? "").startsWith("کمکت ثبت شد"), "Q2: OLD fixed-amount gp: button still contributes directly (backward compat)")
      const contributed2 = JSON.parse((await db.groupProject.findUniqueOrThrow({ where: { id: proj.id } })).contributedJson) as Record<string, number>
      ok((contributed2[pR2] ?? 0) === 1000, "Q2: old path lands exactly 1000 in contributedJson")

      // جیبِ خالی — صادقانه: بدونِ دکمه‌ی مبلغ
      const broke = await callback(cQ2, uR3, "gm:contribute:night_market")
      const brokeBtns = (broke.body.data?.editCard?.buttons ?? []).filter((b) => (b.cb ?? "").startsWith(`gp:${proj.id}:`))
      ok((broke.body.data?.editCard?.text ?? "").includes("با این جیب"), "Q2: broke player gets the honest «can't afford» line")
      ok(brokeBtns.length === 0, "Q2: broke player gets ZERO amount buttons (no unaffordable offers)")
      ok((broke.body.data?.editCard?.buttons ?? []).some((b) => b.cb === "gm:projects"), "Q2: broke player still gets the back button")

      // کارتِ افتتاحِ پروژه: دکمه‌ی «مبلغِ دلخواه» به همین انتخابگر می‌رسد
      const openCard = await db.groupOutbox.findFirst({ where: { groupId: gQ2, refType: "project", refId: proj.id } })
      const openBtns = outboxButtons(openCard?.buttonsJson ?? "[]")
      ok(openBtns.some((b) => (b.cb ?? "") === `gm:contribute:night_market`), "Q2: project open card carries the «مبلغِ دلخواه» picker bridge")
      ok(openBtns.filter((b) => (b.cb ?? "").startsWith(`gp:${proj.id}:`)).length === 3, "Q2: project open card keeps its 3 fixed-amount buttons (legacy grammar)")
    }
  }

  // §X — V17 (مأموریتِ قابلیتِ بازی): ① سیمِ XP→سطح برای مسیرهای غیرِرویداد
  //   (work/gamble/house/vehicle قبلاً XP می‌دادند ولی سطح را بازمحاسبه نمی‌کردند —
  //   باگِ مستندِ ممیزی: کلِ بازیکنانِ واقعی سطح ۱ ماندند) + اعلانِ level-up با
  //   اسمِ واقعیِ بازشدنی‌ها. ② قراردادِ journey.stage در snapshot (پایه‌ی
  //   افشایشِ تدریجیِ یک‌صدا در هر سه سطحِ بازی).
  section("§X V17 XP→level wire + journey stage contract")
  {
    const uX = tid(60)
    const login1 = await post<{ snapshot: { journey?: { stage?: string } } }>("/api/auth", { telegramId: uX, name: "سیم‌کشِ ایکس" })
    ok(login1.body.ok === true, "X: throwaway player authed")
    ok(login1.body.data?.snapshot?.journey?.stage === "new", "X: fresh player → journey.stage 'new' (not onboarded, no femboy)")

    const pX = await pidOf(uX)
    await fixture(async () => {
      await db.player.update({ where: { id: pX }, data: { onboarded: true } })
    })
    const login2 = await post<{ snapshot: { journey?: { stage?: string } } }>("/api/auth", { telegramId: uX })
    ok(login2.body.data?.snapshot?.journey?.stage === "awakened", "X: onboarded + no femboy → journey.stage 'awakened'")

    const createX = await post<{ card: { name: string } }>("/api/game/character", {
      telegramId: uX, action: "create", payload: { name: "سیم‌ایکس", classKey: "ranger" },
    })
    ok(createX.body.ok === true, "X: femboy created via real pact API")
    const login3 = await post<{ snapshot: { journey?: { stage?: string } } }>("/api/auth", { telegramId: uX })
    ok(login3.body.data?.snapshot?.journey?.stage === "bound", "X: femboy exists + level<5 → journey.stage 'bound'")
    await fixture(async () => {
      await db.player.update({ where: { id: pX }, data: { level: 5 } })
    })
    const login4 = await post<{ snapshot: { journey?: { stage?: string } } }>("/api/auth", { telegramId: uX })
    ok(login4.body.data?.snapshot?.journey?.stage === "rooted", "X: femboy + level≥5 → journey.stage 'rooted'")

    // ① سیمِ XP→سطح — کارِ واقعی از طریقِ همان API که ربات/مینی‌اپ صدا می‌زنند
    await fixture(async () => {
      await db.player.update({
        where: { id: pX },
        data: { xp: 95, level: 1, jobKey: "barista", lastWorkedAt: new Date(Date.now() - 60 * 60000), energy: 100, restUntil: null },
      })
      await db.notification.deleteMany({ where: { playerId: pX } })
    })
    const workRes = await post<{ snapshot: { player: { level: number } } }>("/api/game/action", { telegramId: uX, action: "work", payload: {} })
    ok(workRes.body.ok === true, "X: work action succeeds over the real API")
    const afterWork = await db.player.findUniqueOrThrow({ where: { id: pX } })
    ok(afterWork.level === 2, `X: XP wire — work at 95 XP + ~8-11 XP → level 2 (got ${afterWork.level})`)
    const lvlNote = await db.notification.findFirst({ where: { playerId: pX, title: "سطح 2" }, orderBy: { createdAt: "desc" } })
    ok(Boolean(lvlNote) && (lvlNote?.body ?? "").includes("باز شد") && (lvlNote?.body ?? "").includes("جعبه‌ی بدون برچسب"), "X: level-up notification names the real L2 unlock («فرصتِ جعبه‌ی بدون برچسب»)")
  }

  // §V18 — V18: ریتمِ هوشمندِ رویدادها (دروازه + پنجره + شمارنده + پیگیری) ────────
  section("§V18 smart event pacing + windows (V18)")
  {
    // ① خالص — لاین‌های دروازه
    const t0 = new Date("2026-01-01T12:00:00Z")
    ok(eventPacingInfo(new Date(t0.getTime() - 119 * 60000), 100, t0).gateOpen === false, "V18: 119min + 100msgs → closed (2h floor)")
    ok(eventPacingInfo(new Date(t0.getTime() - 120 * 60000), 99, t0).gateOpen === false, "V18: 120min + 99msgs → closed (100-msg quota)")
    const fast = eventPacingInfo(new Date(t0.getTime() - 120 * 60000), 100, t0)
    ok(fast.gateOpen === true && fast.lane === "fast", "V18: 120min + 100msgs → fast lane open")
    const slow = eventPacingInfo(new Date(t0.getTime() - 360 * 60000), 30, t0)
    ok(slow.gateOpen === true && slow.lane === "slow", "V18: 6h + 30msgs → slow lane open (quiet-city mercy)")
    ok(eventPacingInfo(new Date(t0.getTime() - 359 * 60000), 30, t0).gateOpen === false, "V18: 359min + 30msgs → still closed")
    ok(eventPacingInfo(new Date(t0.getTime() - 400 * 60000), 5, t0).gateOpen === false, "V18: dead city (6h40m + 5msgs) → closed")
    ok(EVENT_GAP_MINUTES === 120 && EVENT_MSG_QUOTA === 100, "V18: constants as briefed (2h + 100 msgs)")

    // ② خالص — پنجره‌ی جنس‌به‌جنس
    ok(eventWindowMinutes("chaos") === 45 && eventWindowMinutes("meme") === 45, "V18: chaos/meme window 45min (quick fun)")
    ok(eventWindowMinutes("mystery") === 120 && eventWindowMinutes("world") === 120, "V18: mystery/world window 120min (deep thought)")
    ok(eventWindowMinutes("social") === 75 && eventWindowMinutes("economic") === 75 && eventWindowMinutes("npc") === 75, "V18: default window 75min")

    // ③ خالص — خطِ مهلت روی کارت
    const fakeEv = {
      emoji: "💥", title: "آزمونِ پنجره", body: "بدنه", choicesJson: "[]",
      expiresAt: new Date(Date.now() + 60 * 60000),
    } as unknown as import("@prisma/client").GroupEvent
    ok(eventCardText(fakeEv, []).includes("دقیقه وقت داری"), "V18: event card carries the window line (⏳ N دقیقه وقت داری)")
    const deadEv = { ...fakeEv, expiresAt: new Date(Date.now() - 60_000) } as unknown as import("@prisma/client").GroupEvent
    ok(!eventCardText(deadEv, []).includes("دقیقه وقت داری"), "V18: expired card renders no window line")

    // ④ یکپارچه — شهرِ تازه: فرمانِ «رویدادها» کارتِ «شهر نفس تازه می‌کشد» می‌گیرد
    const cV = chat(90), uV = tid(90)
    await member(cV, "شهرِ وی۱۸", uV, "پیسِ الف")
    const gV = await gidOf(cV)
    const refused = await command(cV, uV, "event")
    ok((refused.body.data?.text ?? "").includes("شهر نفس تازه می‌کشد"), "V18: fresh city /event → pacing refusal card")
    ok((refused.body.data?.text ?? "").includes("120") && (refused.body.data?.text ?? "").includes("100"), "V18: refusal card teaches the rule (2h + 100 msgs)")
    ok((await db.groupEvent.count({ where: { groupId: gV } })) === 0, "V18: refusal created no event row")

    // ⑤ یکپارچه — مسلح: ماجرا متولد می‌شود؛ پنجره رعایت؛ شمارنده صفر
    await armEventPacing(cV)
    const evCmd = await command(cV, uV, "event")
    ok(evCmd.body.data?.text === "", "V18: armed city /event defers card to outbox")
    const evV = await db.groupEvent.findFirst({ where: { groupId: gV, status: "open" } })
    ok(Boolean(evV), "V18: armed city spawned the event")
    if (evV) {
      const winMin = Math.round(((evV.expiresAt?.getTime() ?? 0) - evV.createdAt.getTime()) / 60000)
      ok(winMin === eventWindowMinutes(evV.kind), "V18: window honored by kind", `kind=${evV.kind} win=${winMin}`)
      ok(winMin >= 45, "V18: window at least 45 minutes (user floor: 30)")
      const cardRow = await db.groupOutbox.findFirst({ where: { groupId: gV, refType: "event", refId: evV.id } })
      ok((cardRow?.text ?? "").includes("دقیقه وقت داری"), "V18: spawn card shows the window line")
    }
    const gAfter = await db.groupWorld.findUniqueOrThrow({ where: { id: gV } })
    ok((JSON.parse(gAfter.cultureJson ?? "{}") as { msgsSinceEvent?: number }).msgsSinceEvent === 0, "V18: msgsSinceEvent reset to 0 after spawn")

    // ⑥ یکپارچه — observe شمارنده را بالا می‌برد (همان مسیرِ ربات)
    const obs = await post("/api/group/observe", { chatId: cV, chatTitle: "شهرِ وی۱۸", chatType: "group", telegramId: uV, text: "سلام شهر، چطورید؟", addressedToBot: false })
    ok(obs.body.ok === true, "V18: observe accepted over the bot transport")
    const gObs = await db.groupWorld.findUniqueOrThrow({ where: { id: gV } })
    ok((JSON.parse(gObs.cultureJson ?? "{}") as { msgsSinceEvent?: number }).msgsSinceEvent === 1, "V18: observe bumps msgsSinceEvent to 1")

    // ⑦ یکپارچه — پیگیریِ زمان‌بندی‌شده: دروازه‌ی بسته → defer نه مصرف
    // (اولویتِ ۹: درینِ هر گروه سقفِ ۲ ردیف با ترتیبِ اولویت می‌برد — ردیفِ آزمون
    // باید بالایِ کارت‌هایِ اعلام‌نشده‌ی همین شهرِ آزمونی بنشیند تا در همان تیک دیده شود)
    const fuRow = await fixture(() => db.groupOutbox.create({
      data: { groupId: gV, targetChatId: cV, kind: "spawn_event", text: "frog_remembers", priority: 9, deliverAfter: new Date(Date.now() - 60_000) },
    }))
    await tick()
    const fuAfter = await db.groupOutbox.findUnique({ where: { id: fuRow.id } })
    ok(fuAfter?.deliveredAt === null && (fuAfter?.deliverAfter?.getTime() ?? 0) > Date.now(), "V18: gated follow-up deferred (+30min), not consumed")
    ok((await db.groupEvent.count({ where: { groupId: gV, status: "open" } })) === 1, "V18: follow-up did NOT spawn behind the open event")

    // ⑧ یکپارچه — مسلح + بسته‌شدنِ رویدادِ باز: پیگیری آزاد می‌شود (مصرف؛ رول ۷۵٪)
    await callback(cV, uV, "gs:recover", true)
    await armEventPacing(cV)
    // fixture: ردیفِ پیگیری دوباره «آماده» + رویدادِ خودجوشِ فازِ ۶ خاموش (ایزوله‌کردنِ
    // درینِ پیگیری از رولِ ambientِ همان تیک — eventFreq فقط فازِ ۶ را می‌بندد)
    await fixture(async () => {
      await db.groupOutbox.update({ where: { id: fuRow.id }, data: { deliverAfter: new Date(Date.now() - 60_000) } })
      await db.groupWorld.update({ where: { id: gV }, data: { settingsJson: JSON.stringify({ eventFreq: "off" }) } })
    })
    await tick()
    const fuFinal = await db.groupOutbox.findUnique({ where: { id: fuRow.id } })
    ok(fuFinal?.deliveredAt !== null, "V18: armed follow-up consumed by the drain (roll decides spawn)")
    const fuEv = await db.groupEvent.findFirst({ where: { groupId: gV, status: "open" } })
    if (fuEv) ok(fuEv.templateId === "frog_remembers", "V18: follow-up (when rolled) spawned the chained template", `templateId=${fuEv.templateId}`)
  }

  // ══════════════════════════════════════════════════════════════════════════
  section("§V19 persona + talents + personal story (V19 characters reborn)")
  {
    // V19-1 — محتوای شخصیت: بارگذاریِ سالم (validatorها در import می‌پرند)، تناسبِ ارجاع‌ها
    {
      const { PERSONAS, getPersona } = await import("../../src/lib/game/content/personas")
      const { TALENTS, FLAWS, getTalent, getFlaw, DOMAIN_LABELS } = await import("../../src/lib/game/content/talents")
      const { STORIES, getStory, STORY_TOTAL_CHAPTERS, trustTierOf, nextTrustTier } = await import("../../src/lib/game/content/stories")
      ok(PERSONAS.length === 8, "V19-1: 8 personas loaded (validators passed)")
      ok(TALENTS.length === 10 && FLAWS.length === 8, "V19-1: 10 talents + 8 flaws loaded")
      ok(STORIES.length === 8 && STORIES.every((st) => st.chapters.length === STORY_TOTAL_CHAPTERS), "V19-1: 8 story arcs x 5 chapters")
      let refErr = 0
      for (const p of PERSONAS) {
        for (const t of p.talents) if (!getTalent(t)) refErr++
        for (const f of p.flaws) if (!getFlaw(f)) refErr++
        if (!getStory(p.key)) refErr++
      }
      ok(refErr === 0, "V19-1: every persona talent/flaw/story reference resolves (cross-validated)")
      ok(Boolean(getPersona("sunny")?.voice.talk.includes("{name}")) && getTalent("night_owl")?.domain === "work" && DOMAIN_LABELS.recharge.label.length > 0, "V19-1: persona voice templates + domain registry sane")
      ok(trustTierOf(0).label === "غریبه" && trustTierOf(70).label === "جانِ جان" && nextTrustTier(29)?.min === 30, "V19-1: trust tiers 0/70 + next-at-30")
    }

    // V19-2 — حلِ قطعیِ میراث: بدونِ personaKey، همان نتیجه هر بار (no re-roll)
    {
      const { personaOf, resolvePersonaChain, affinityOf } = await import("../../src/lib/game/character")
      const ghost = { id: "ghost-char-id-v19", personaKey: "", talentKey: "", flawKey: "" }
      const p1 = personaOf(ghost)
      const p2 = personaOf(ghost)
      ok(p1.key === p2.key, "V19-2: legacy persona resolve is deterministic across calls", `${p1.key} vs ${p2.key}`)
      const chain = resolvePersonaChain(ghost)
      ok(chain.persona.key === p1.key && Boolean(chain.talent) && Boolean(chain.flaw), "V19-2: full chain resolves (persona+talent+flaw)")
      ok(chain.flaw.domain !== chain.talent.domain, "V19-2: flaw domain never overlaps talent domain")
      const aff = affinityOf(ghost)
      const vals = Object.values(aff)
      ok(vals.every((v) => v >= -12 && v <= 12), "V19-2: affinity clamped to [-12,+12] on every domain")
      ok(vals.filter((v) => v !== 0).length >= 1, "V19-2: affinity has at least one non-zero domain (talent applies)")
    }

    // V19-3 — ساخت با طبعِ انتخابی: رکورد + DTO کامل + دامنه‌های هم‌خانواده
    {
      const uP = tid(70)
      await post("/api/auth", { telegramId: uP, name: "شخصیت‌سنج" })
      const created = await post<{ message: string; card: { persona: { key: string } | null; talent: { key: string; pct: number } | null; flaw: { key: string } | null; story: { status: string; chaptersTotal: number } | null; affinityRows: unknown[]; rechargeCostPer: number } }>(
        "/api/game/character",
        { telegramId: uP, action: "create", payload: { name: "فمبوی طبع", classKey: "ranger", personaKey: "sunny" } },
      )
      ok(created.body.ok === true, "V19-3: create with personaKey accepted")
      const pidP = await pidOf(uP)
      const row = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidP } })
      ok(row.personaKey === "sunny" && row.talentKey !== "" && row.flawKey !== "", "V19-3: record carries persona/talent/flaw keys", `p=${row.personaKey} t=${row.talentKey} f=${row.flawKey}`)
      const { getPersona } = await import("../../src/lib/game/content/personas")
      const sunny = getPersona("sunny")!
      ok(sunny.talents.includes(row.talentKey) && sunny.flaws.includes(row.flawKey), "V19-3: talent/flaw rolled from the sunny pools")
      const card = created.body.data?.card
      ok(card?.persona?.key === "sunny" && (card?.affinityRows?.length ?? 0) === 2, "V19-3: SoulCardDTO carries persona + 2 affinity rows")
      ok(card?.story?.status === "available" && card?.story?.chaptersTotal === 5, "V19-3: story slot available at birth (ch1, 5 chapters)")
      ok(typeof card?.rechargeCostPer === "number" && card.rechargeCostPer >= 60, "V19-3: rechargeCostPer surfaced (>=60 floor)")
      ok((created.body.data?.message ?? "").includes("طبعِ"), "V19-3: create message announces the persona")

      // طبعِ نامعتبر → خطای فارسیِ صریح
      const uBad = tid(71)
      await post("/api/auth", { telegramId: uBad, name: "طبع‌بطل" })
      const bad = await post("/api/game/character", { telegramId: uBad, action: "create", payload: { name: "فمبوی بطل", classKey: "ranger", personaKey: "grumpy" } })
      ok(bad.body.ok === false && (bad.body.error ?? "").includes("طبع"), "V19-3: invalid personaKey rejected in Persian")
    }

    // V19-4 — چرخه‌ی داستان: خواندن → انتخاب → ایدمپوتنت → قفلِ صادق → گشایش با اعتماد
    {
      const uS = tid(72)
      await post("/api/auth", { telegramId: uS, name: "قصه‌خوان" })
      const createS = await post<{ card: { persona: { key: string } | null } | null }>("/api/game/character", { telegramId: uS, action: "create", payload: { name: "فمبوی قصه", classKey: "wizard", personaKey: "shadow" } })
      const pidS = await pidOf(uS)
      {
        const rowC = await db.soulCharacter.findUnique({ where: { playerId: pidS } })
        ok(rowC?.personaKey === "shadow" && createS.body.data?.card?.persona?.key === "shadow", "V19-4diag: create persisted personaKey shadow", `row=${rowC?.personaKey} card=${createS.body.data?.card?.persona?.key} err=${createS.body.error ?? "-"}`)
      }
      const read1 = await post<{ message: string; story: { status: string; current: { title: string; text: string[]; choices: { idx: number }[] } | null } }>(
        "/api/game/character", { telegramId: uS, action: "story", payload: { op: "read" } },
      )
      ok(read1.body.ok === true && read1.body.data?.story.status === "available", "V19-4: story read → ch1 available")
      ok((read1.body.data?.story.current?.text?.length ?? 0) >= 2 && (read1.body.data?.story.current?.choices?.length ?? 0) >= 2, "V19-4: chapter text (2+ paras) + choices (2+) delivered")
      {
        const rowS0 = await db.soulCharacter.findUnique({ where: { playerId: pidS } })
        const msg1 = read1.body.data?.message ?? ""
        ok(
          msg1.includes("پرونده‌های کهنه"),
          "V19-4: read message opens with the persona's memory voice",
          `personaKey=${rowS0?.personaKey ?? "?"} msg=${JSON.stringify(msg1.slice(0, 60))}`,
        )
      }

      const choose1 = await post<{ message: string; story: { chaptersDone: number; status: string; trust: number; memories: unknown[]; requirement: string | null }; card: { story: { trust: number } | null } }>(
        "/api/game/character", { telegramId: uS, action: "story", payload: { op: "choose", choice: 0 } },
      )
      const ch = choose1.body.data
      ok(choose1.body.ok === true && (ch?.story.chaptersDone ?? 0) === 1, "V19-4: choose → chaptersDone = 1")
      ok((ch?.story.trust ?? 0) >= 3, "V19-4: choice granted trust (>=3)", `trust=${ch?.story.trust}`)
      ok((ch?.story.memories?.length ?? 0) >= 1, "V19-4: outcome persisted as a story memory")
      const rowS = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidS } })
      const stJ = JSON.parse(rowS.storyJson) as { ch: number; choices: Record<string, number> }
      ok(stJ.ch === 1 && Object.keys(stJ.choices).length === 1, "V19-4: storyJson advanced (ch=1, choice recorded)")
      const logRow = await db.characterLog.findFirst({ where: { characterId: rowS.id, type: "story" } })
      ok(Boolean(logRow) && (logRow?.text ?? "").length > 10, "V19-4: CharacterLog(type=story) written")

      const repeat = await post("/api/game/character", { telegramId: uS, action: "story", payload: { op: "choose", choice: 0 } })
      ok(repeat.body.ok === false, "V19-4: re-choosing the same chapter is refused (idempotent)")
      const read2 = await post<{ story: { status: string; requirement: string | null } }>("/api/game/character", { telegramId: uS, action: "story", payload: { op: "read" } })
      ok(read2.body.ok === false && (read2.body.error ?? "").includes("قفل") && (read2.body.error ?? "").includes("اعتماد"), "V19-4: ch2 honestly locked with trust requirement", read2.body.error ?? "-")

      // fixture: اعتماد تا ۲۵ + سطح تا ۴ → فصلِ ۳... نه — فصلِ ۲ باز می‌شود (req 10/2)
      await fixture(async () => {
        await db.soulCharacter.update({ where: { id: rowS.id }, data: { trust: 25, level: 4 } })
      })
      const read3 = await post<{ story: { status: string; current: { index: number } | null } }>("/api/game/character", { telegramId: uS, action: "story", payload: { op: "read" } })
      ok(read3.body.data?.story.status === "available" && read3.body.data?.story.current?.index === 1, "V19-4: after trust/level fixture → ch2 (index 1) available")
    }

    // V19-5 — اعتماد از زندگی: اولینِ تعاملِ روز +۱، دومی نه
    {
      const uT = tid(73)
      await post("/api/auth", { telegramId: uT, name: "اعتمادسنج" })
      await post("/api/game/character", { telegramId: uT, action: "create", payload: { name: "فمبوی اعتماد", classKey: "paladin", personaKey: "gentle" } })
      const pidT = await pidOf(uT)
      const r1 = await interactWithCharacter((await db.player.findUniqueOrThrow({ where: { id: pidT } })), await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidT } }), "talk")
      ok(r1.ok !== undefined, "V19-5: first interact of day succeeds")
      const row1 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidT } })
      ok(row1.trust === 1, "V19-5: first interact of day → trust +1", `trust=${row1.trust}`)
      // کول‌داونِ ۱۰ دقیقه — fixture: lastInteractAt را عقب ببر تا دومی بگذرد
      await fixture(async () => {
        await db.soulCharacter.update({ where: { id: row1.id }, data: { lastInteractAt: new Date(Date.now() - 11 * 60_000) } })
      })
      await interactWithCharacter((await db.player.findUniqueOrThrow({ where: { id: pidT } })), await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidT } }), "talk")
      const row2 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidT } })
      ok(row2.trust === 1, "V19-5: second interact same day → NO extra trust (anti-spam)", `trust=${row2.trust}`)
    }

    // V19-6 — صدای طبع: دو فمبویِ هم‌کلاس، دو لهجه (goleshe diabetic = قابل‌تمایز)
    {
      const uV1 = tid(74), uV2 = tid(75)
      await post("/api/auth", { telegramId: uV1, name: "صداسنج ۱" })
      await post("/api/auth", { telegramId: uV2, name: "صداسنج ۲" })
      await post("/api/game/character", { telegramId: uV1, action: "create", payload: { name: "خورشیدی", classKey: "duelist", personaKey: "sunny" } })
      await post("/api/game/character", { telegramId: uV2, action: "create", payload: { name: "مهتابی", classKey: "duelist", personaKey: "shadow" } })
      const pidV1 = await pidOf(uV1), pidV2 = await pidOf(uV2)
      const rSun = await interactWithCharacter((await db.player.findUniqueOrThrow({ where: { id: pidV1 } })), await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidV1 } }), "talk")
      await fixture(async () => {
        await db.soulCharacter.updateMany({ where: { playerId: { in: [pidV1, pidV2] } }, data: { lastInteractAt: new Date(Date.now() - 11 * 60_000) } })
      })
      const rShd = await interactWithCharacter((await db.player.findUniqueOrThrow({ where: { id: pidV2 } })), await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidV2 } }), "talk")
      const sunLine = rSun.ok?.message ?? ""
      const shdLine = rShd.ok?.message ?? ""
      ok(sunLine.includes("از هر سه جمله‌اش"), "V19-6: sunny talk line uses the sunny voice", sunLine.slice(0, 60))
      ok(shdLine.includes("جواب‌های کوتاه"), "V19-6: shadow talk line uses the shadow voice", shdLine.slice(0, 60))
      ok(sunLine !== shdLine, "V19-6: same class + same kind → two distinguishable voices")
    }

    // V19-7 — قلاب‌های واقعیِ استعداد: xp/group (awardSoulProgress) + duel + recharge + هر ۱۰ دامنه
    {
      // 7a — دامنه‌ها: هر ۱۰ استعداد روی دامنه‌ی خودش در affinityOf دیده می‌شود
      const { affinityOf, rechargeCostPer } = await import("../../src/lib/game/character")
      const { TALENTS } = await import("../../src/lib/game/content/talents")
      const uAff = tid(76)
      await post("/api/auth", { telegramId: uAff, name: "دامنه‌سنج" })
      await post("/api/game/character", { telegramId: uAff, action: "create", payload: { name: "فمبوی دامنه", classKey: "ranger", personaKey: "mind" } })
      const pidAff = await pidOf(uAff)
      // استعدادِ خارج از استخرِ طبع، ری‌رول می‌شود (by design) — برای هر استعداد، طبعِ
      // سازگار می‌گذاریم تا قلابِ دامنه را مستقیم بسنجیم
      const TALENT_PERSONA: Record<string, string> = {
        night_owl: "shadow", silver_tongue: "noble", morning_breeze: "sunny", deep_sleeper: "gentle",
        iron_will: "noble", sharp_eye: "shadow", quick_study: "mind", duelist_heart: "prickly",
        thrifty: "sly", crowd_charmer: "sunny",
      }
      let domainErr = 0
      for (const t of TALENTS) {
        const personaKey = TALENT_PERSONA[t.key] ?? "mind"
        await fixture(async () => {
          await db.soulCharacter.update({ where: { playerId: pidAff }, data: { personaKey, talentKey: t.key, flawKey: "" } })
        })
        const aff = affinityOf(await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidAff } }))
        if (aff[t.domain] !== t.pct) domainErr++
      }
      ok(domainErr === 0, "V19-7a: every talent's pct lands on its own domain via affinityOf (10/10)")

      // 7b — قلابِ XP (quick_study +6%) و گروه (crowd_charmer +10%): awardSoulProgress از affinityOf می‌گذرد
      // fixture تمیز: طبعِ shadow (استخرش quick_study دارد) + ضعفِ بی‌اثر (butterfingers)
      const total0 = (await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidAff } })).totalXp
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pidAff }, data: { personaKey: "shadow", talentKey: "quick_study", flawKey: "restless" } })
      })
      const rXp = await awardSoulProgress(db, uAff, { soulXp: 20, reason: "probe" })
      const total1 = (await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidAff } })).totalXp
      ok(rXp?.appliedXp === 20 && total1 - total0 === 21, "V19-7b: quick_study +6% → applied 20, track +21 (xp hook live)", `applied=${rXp?.appliedXp} delta=${total1 - total0}`)
      // crowd_charmer روی فمبویِ تازه‌ی sunny (استخرِ سازگار) — زیرِ سقف
      const uGrp = tid(82)
      await post("/api/auth", { telegramId: uGrp, name: "جمع‌سنج" })
      await post("/api/game/character", { telegramId: uGrp, action: "create", payload: { name: "فمبوی جمع", classKey: "ranger", personaKey: "sunny" } })
      const pidGrp = await pidOf(uGrp)
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pidGrp }, data: { talentKey: "crowd_charmer", flawKey: "" } })
      })
      const rGrp = await awardSoulProgress(db, uGrp, { soulXp: 20, reason: "probe" })
      ok(rGrp?.appliedXp === 22, "V19-7b: crowd_charmer +10% → 20 group XP applied as 22 (group hook live)", `applied=${rGrp?.appliedXp}`)
      ok((rGrp?.talentLine ?? "").includes("عشقه‌ی جمع"), "V19-7b: crowd_charmer surfaces its talent line on the result")
      // سقفِ روزانه مرجع می‌ماند: پمپِ پنجم روی همان بازیکن → کلمپ
      let capped = 0
      for (let i = 0; i < 4; i++) {
        const rP = await awardSoulProgress(db, uGrp, { soulXp: 20, reason: "pump" })
        capped += rP?.appliedXp ?? 0
      }
      ok(22 + capped === 40, "V19-7b: daily cap still authoritative after talent bonus (no cap bypass)", `22+${capped}`)

      // 7c — قلابِ دوئل (duelist_heart +8%): جایزه با خطِ استعداد
      const uD1 = tid(77), uD2 = tid(78)
      await post("/api/auth", { telegramId: uD1, name: "دوئل‌سنج ۱" })
      await post("/api/auth", { telegramId: uD2, name: "دوئل‌سنج ۲" })
      const cD1res = await post("/api/game/character", { telegramId: uD1, action: "create", payload: { name: "قلب دوئل", classKey: "reaper", personaKey: "storm" } })
      const cD2res = await post("/api/game/character", { telegramId: uD2, action: "create", payload: { name: "حریف دوئل", classKey: "wizard", personaKey: "sly" } })
      ok(cD1res.body.ok === true, "V19-7c: duel char A created", cD1res.body.error ?? "-")
      ok(cD2res.body.ok === true, "V19-7c: duel char B created", cD2res.body.error ?? "-")
      const pidD1 = await pidOf(uD1), pidD2 = await pidOf(uD2)
      // برنده را قطعی کنیم: حریف را ضعیف (سطح ۱، بدون اسکیل) و قلبِ دوئل را قوی
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pidD1 }, data: { level: 12, talentKey: "duelist_heart", flawKey: "" } })
        await db.soulCharacter.update({ where: { playerId: pidD2 }, data: { level: 1 } })
      })
      const pD1 = await db.player.findUniqueOrThrow({ where: { id: pidD1 } })
      const pD2 = await db.player.findUniqueOrThrow({ where: { id: pidD2 } })
      const cD1 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidD1 } })
      const cD2 = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidD2 } })
      const duelRes = await duelCharacters(pD1, pD2)
      const duelLog = (duelRes.duel?.log ?? []).join("\n")
      const winnerIsD1 = duelRes.duel?.winnerName === "قلب دوئل"
      if (winnerIsD1) {
        ok(duelLog.includes("قلبِ دوئل‌باز") && duelLog.includes("سنگین‌تر"), "V19-7c: duelist_heart +8% surfaced on the duel prize line", duelLog.slice(-160))
      } else {
        // سطح ۱۲ باید تقریباً همیشه ببرد؛ اگر شانس خلاف کرد، فقط حلِ تمیز را ثابت کن
        ok(duelRes.duel !== undefined, "V19-7c: duel resolved cleanly (underdog won — reroll-safety)")
      }

      // 7d — قلابِ شارژ (thrifty −10%): هزینه‌ی هر واحد ۱۰۸ (کف ۶۰)
      const uR = tid(79)
      await post("/api/auth", { telegramId: uR, name: "شارژسنج" })
      await post("/api/game/character", { telegramId: uR, action: "create", payload: { name: "فمبوی صرفه", classKey: "shinobi", personaKey: "mind" } })
      const pidR = await pidOf(uR)
      await fixture(async () => {
        await db.soulCharacter.update({ where: { playerId: pidR }, data: { talentKey: "thrifty", flawKey: "", stamina: 1 } })
      })
      const charR = await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidR } })
      ok(rechargeCostPer(charR) === 108, "V19-7d: thrifty → per-unit cost 108 (120 × 0.9)")
      const money0 = (await db.player.findUniqueOrThrow({ where: { id: pidR } })).money
      const { rechargeStamina } = await import("../../src/lib/game/character")
      const pR = await db.player.findUniqueOrThrow({ where: { id: pidR } })
      const rc = await rechargeStamina(pR, charR, 1)
      const money1 = (await db.player.findUniqueOrThrow({ where: { id: pidR } })).money
      ok(rc.ok !== undefined && money0 - money1 === 108, "V19-7d: recharge actually charged 108 (hook live)", `delta=${money0 - money1}`)
    }

    // V19-8 — خلاصه‌ی سبک + کارتِ عمومی: طبع و تراشه‌ی داستان همه‌جا
    {
      const uPub = tid(80)
      await post("/api/auth", { telegramId: uPub, name: "عمومی‌سنج" })
      await post("/api/game/character", { telegramId: uPub, action: "create", payload: { name: "فمبوی عمومی", classKey: "summoner", personaKey: "prickly" } })
      const pidPub = await pidOf(uPub)
      const { femboySummaryDTO } = await import("../../src/lib/game/character")
      const sum = femboySummaryDTO(await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidPub } }))
      ok(sum.persona?.key === "prickly" && (sum.storyChip ?? "").includes("فصلِ"), "V19-8: FemboySummaryDTO carries persona + storyChip", sum.storyChip ?? "-")
      const pubCard = await get<{ card: { persona: { key: string } | null; talent: { key: string } | null } | null }>(`/api/game/character?targetTelegramId=${uPub}`)
      ok(pubCard.body.data?.card?.persona?.key === "prickly" && Boolean(pubCard.body.data?.card?.talent), "V19-8: public card exposes persona + talent (identity is public)")
    }

    // V19-9 — «مرورِ خاطره» داستان را زنده نگه می‌دارد
    {
      const uM = tid(81)
      await post("/api/auth", { telegramId: uM, name: "خاطره‌سنج" })
      await post("/api/game/character", { telegramId: uM, action: "create", payload: { name: "فمبوی خاطره", classKey: "trickster", personaKey: "noble" } })
      await post("/api/game/character", { telegramId: uM, action: "story", payload: { op: "choose", choice: 0 } })
      const mem = await post<{ message: string }>("/api/game/character", { telegramId: uM, action: "interact", payload: { kind: "memory" } })
      ok((mem.body.data?.message ?? "").length > 40, "V19-9: memory interact returns narrative")
      // خاطره‌ی story در پنجره‌ی ۵تایی ظاهر می‌شود (outcome واقعی)
      const pidM = await pidOf(uM)
      const logsM = await db.characterLog.findMany({ where: { characterId: (await db.soulCharacter.findUniqueOrThrow({ where: { playerId: pidM } })).id }, orderBy: { createdAt: "desc" }, take: 5 })
      ok(logsM.some((l) => l.type === "story"), "V19-9: story memory lands inside the 5-slot memory window")
    }
  }
}

// ─── cleanup + final guards ────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  const groups = await db.groupWorld.findMany({ where: { chatId: { in: chats } }, select: { id: true } })
  const gids = groups.map((g) => g.id)
  const players = await db.player.findMany({ where: { telegramId: { in: tids } }, select: { id: true } })
  const pids = players.map((p) => p.id)
  const chars = pids.length ? await db.soulCharacter.findMany({ where: { playerId: { in: pids } }, select: { id: true } }) : []
  const cids = chars.map((c) => c.id)
  const events = gids.length ? await db.groupEvent.findMany({ where: { groupId: { in: gids } }, select: { id: true } }) : []
  const eids = events.map((e) => e.id)

  await fixture(async () => {
    if (eids.length) await db.groupEventParticipant.deleteMany({ where: { eventId: { in: eids } } })
    if (gids.length) {
      await db.groupOutbox.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupChallenge.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupEvent.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupVote.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupProject.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupRumor.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupMemory.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupMystery.deleteMany({ where: { groupId: { in: gids } } })
      await db.playerRelationship.deleteMany({ where: { groupId: { in: gids } } })
      await db.gameSession.deleteMany({ where: { groupId: { in: gids } } })
      await db.botDecision.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupHistory.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupNews.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupMember.deleteMany({ where: { groupId: { in: gids } } })
      await db.groupWorld.deleteMany({ where: { id: { in: gids } } })
    }
    if (pids.length) {
      if (cids.length) await db.characterLog.deleteMany({ where: { characterId: { in: cids } } })
      await db.combatEncounter.deleteMany({ where: { OR: [{ playerId: { in: pids } }, { foeId: { in: pids } }] } })
      await db.currencyLedger.deleteMany({ where: { playerId: { in: pids } } })
      await db.historyEntry.deleteMany({ where: { playerId: { in: pids } } })
      await db.notification.deleteMany({ where: { playerId: { in: pids } } })
      await db.playerAchievement.deleteMany({ where: { playerId: { in: pids } } })
      await db.playerTitle.deleteMany({ where: { playerId: { in: pids } } })
      await db.inventoryItem.deleteMany({ where: { playerId: { in: pids } } })
      await db.pet.deleteMany({ where: { playerId: { in: pids } } })
      await db.opportunity.deleteMany({ where: { playerId: { in: pids } } })
      await db.relationship.deleteMany({ where: { playerId: { in: pids } } })
      await db.npcMemory.deleteMany({ where: { playerId: { in: pids } } })
      await db.soulCharacter.deleteMany({ where: { playerId: { in: pids } } })
      await db.player.deleteMany({ where: { id: { in: pids } } })
    }
  })
}

async function finalGuards(basePlayerIds: Set<string>, baseGroupIds: Set<string>): Promise<void> {
  section("§Z real-data guard + residue (start==end)")
  const playersNow = await db.player.findMany({ select: { id: true, telegramId: true } })
  const groupsNow = await db.groupWorld.findMany({ select: { id: true, chatId: true } })
  const leftoverPlayers = playersNow.filter((p) => tids.includes(p.telegramId ?? ""))
  const leftoverGroups = groupsNow.filter((g) => chats.includes(g.chatId))
  ok(leftoverPlayers.length === 0, `all ${tids.length} throwaway players removed`)
  ok(leftoverGroups.length === 0, `all ${chats.length} throwaway groups removed`)
  const missingReal = [...basePlayerIds].filter((id) => !playersNow.some((p) => p.id === id))
  ok(missingReal.length === 0, "every real player still present")
  const missingGroups = [...baseGroupIds].filter((id) => !groupsNow.some((g) => g.id === id))
  ok(missingGroups.length === 0, "every real group still present")
  const extra = playersNow.filter((p) => !basePlayerIds.has(p.id) && !tids.includes(p.telegramId ?? ""))
  ok(extra.length === 0, `no unexpected new players (found ${extra.length}${extra.length ? ": " + extra.map((p) => p.telegramId).join(",") : ""})`)
  ok(playersNow.length === basePlayerIds.size, `real player count preserved (start ${basePlayerIds.size}; got ${playersNow.length})`)
  ok(groupsNow.length === baseGroupIds.size, `real group count preserved (start ${baseGroupIds.size}; got ${groupsNow.length})`)

  // belt+braces: challenge/encounter tables back to their start-of-run baseline
  // (a REAL user duel mid-run could legitimately trip this — re-run in that case)
  const resChal = await db.groupChallenge.count()
  const resEnc = await db.combatEncounter.count()
  ok(resChal === baseChallengeCount && resEnc === baseEncounterCount, `challenge/encounter tables back to baseline (${baseChallengeCount}/${baseEncounterCount}; got ${resChal}/${resEnc})`)
}

// ─── entry ─────────────────────────────────────────────────────────────────────

const basePlayers = await db.player.findMany({ select: { id: true, telegramId: true } })
const baseGroups = await db.groupWorld.findMany({ select: { id: true, chatId: true } })
const basePlayerIds = new Set(basePlayers.map((p) => p.id))
const baseGroupIds = new Set(baseGroups.map((p) => p.id))
// dynamic baselines — never pinned to constants (real players/groups can grow
// between runs organically; the invariant is start==end per run, see finalGuards)
const baseChallengeCount = await db.groupChallenge.count()
const baseEncounterCount = await db.combatEncounter.count()
console.log(`baseline: ${basePlayerIds.size} players / ${baseGroupIds.size} groups / ${baseChallengeCount} challenges / ${baseEncounterCount} encounters`)
try {
  await main()
} catch (e) {
  fail++
  failures.push(`SUITE CRASH: ${e instanceof Error ? e.message : String(e)}`)
  console.error("SUITE CRASH:", e)
} finally {
  try { await cleanup() } catch (e) { fail++; failures.push(`CLEANUP FAILED: ${String(e)}`); console.error("CLEANUP FAILED:", e) }
  try { await finalGuards(basePlayerIds, baseGroupIds) } catch (e) { fail++; failures.push(`FINAL GUARD FAILED: ${String(e)}`); console.error("FINAL GUARD FAILED:", e) }
  await db.$disconnect().catch(() => undefined)
}

console.log(`\n══ RESULT: ${pass} PASS / ${fail} FAIL ══`)
if (failures.length > 0) {
  console.log("Failures:")
  for (const f of failures) console.log(`  ✗ ${f}`)
}
process.exit(fail === 0 ? 0 : 1)
