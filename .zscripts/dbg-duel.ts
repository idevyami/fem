import { db } from "../src/lib/db"
import { getServiceKey } from "../src/lib/game/secrets"
const API = "http://localhost:3000"
const KEY = getServiceKey()
const RUN = Date.now()
const chatId = `-10099${RUN % 100000}77`
const u1 = `99${String(RUN).slice(-9)}77`, u2 = `99${String(RUN).slice(-9)}78`
const post = async (path: string, body: unknown) => {
  const res = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json", "x-service-key": KEY }, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json().catch(() => null) }
}
await post("/api/auth", { telegramId: u1, name: "دیباگ ۱" })
await post("/api/auth", { telegramId: u2, name: "دیباگ ۲" })
const m1 = await post("/api/group/command", { action: "member", chatId, chatTitle: "شهرِ دیباگ", telegramId: u1, playerName: "دیباگ ۱" })
const m2 = await post("/api/group/command", { action: "member", chatId, chatTitle: "شهرِ دیباگ", telegramId: u2, playerName: "دیباگ ۲" })
console.log("members:", m1.body?.data?.welcomed, m2.body?.data?.welcomed)
const c1 = await post("/api/game/character", { telegramId: u1, action: "create", payload: { name: "دیباگیکا", classKey: "shinobi" } })
const c2 = await post("/api/game/character", { telegramId: u2, action: "create", payload: { name: "دیباگلا", classKey: "wizard" } })
console.log("chars:", c1.status, c2.status, c1.body?.error ?? "ok", c2.body?.error ?? "ok")
const duel = await post("/api/group/command", { action: "command", chatId, chatTitle: "شهرِ دیباگ", telegramId: u1, command: `duel ${u2}` })
console.log("duel status:", duel.status)
console.log("duel text:", (duel.body?.data?.text ?? "").slice(0, 300))
const ch = await db.groupChallenge.findFirst({ where: { groupId: (await db.groupWorld.findUniqueOrThrow({ where: { chatId } })).id }, orderBy: { createdAt: "desc" } })
console.log("challenge row:", ch ? `${ch.status} ${ch.id}` : "NONE")
// cleanup
const g = await db.groupWorld.findUniqueOrThrow({ where: { chatId } })
if (ch) await db.groupChallenge.deleteMany({ where: { groupId: g.id } })
await db.groupOutbox.deleteMany({ where: { groupId: g.id } })
await db.groupMember.deleteMany({ where: { groupId: g.id } })
await db.groupHistory.deleteMany({ where: { groupId: g.id } })
await db.groupNews.deleteMany({ where: { groupId: g.id } })
await db.groupWorld.deleteMany({ where: { id: g.id } })
for (const t of [u1, u2]) { const p = await db.player.findUnique({ where: { telegramId: t } }); if (p) { await db.soulCharacter.deleteMany({ where: { playerId: p.id } }); await db.player.deleteMany({ where: { id: p.id } }) } }
console.log("cleaned")
process.exit(0)
