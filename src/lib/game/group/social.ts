// FEMBOY WAR — V5: گرافِ اجتماعی — رابطه‌های دونفره‌ی چندبُعدی + اعتبارِ اعضا.

import type { GroupMember, Player, Prisma } from "@prisma/client"
import type { RelationshipDim, MemberRepDim } from "./types"
import { clamp } from "../rng"
import { parseJson } from "./domain"

export type Tx = Prisma.TransactionClient

// ─── رابطه‌ی دونفره ────────────────────────────────────────────────────────────

function pairKey(aId: string, bId: string): [string, string] {
  return aId < bId ? [aId, bId] : [bId, aId]
}

export interface RelationshipRow {
  friendship: number
  rivalry: number
  trust: number
  hostility: number
  cooperation: number
  tension: number
  sharedMemories: number
}

const EMPTY: RelationshipRow = {
  friendship: 0, rivalry: 0, trust: 0, hostility: 0, cooperation: 0, tension: 0, sharedMemories: 0,
}

/** تغییر رابطه‌ی دونفره — همیشه تقارنی ذخیره می‌شود (aId<bId) */
export async function adjustRelationship(
  tx: Tx,
  groupId: string,
  aId: string,
  bId: string,
  dim: RelationshipDim,
  amount: number,
): Promise<void> {
  if (aId === bId || !aId || !bId) return
  const [x, y] = pairKey(aId, bId)
  const existing = await tx.playerRelationship.findUnique({ where: { groupId_aId_bId: { groupId, aId: x, bId: y } } })
  const cur = existing ?? { ...EMPTY, id: "", groupId, aId: x, bId: y, updatedAt: new Date() }
  const next = { ...EMPTY, ...cur }
  next[dim] = clamp((cur[dim] ?? 0) + amount, -100, 100)
  if (existing) {
    await tx.playerRelationship.update({
      where: { groupId_aId_bId: { groupId, aId: x, bId: y } },
      data: { ...next, updatedAt: new Date() },
    })
  } else {
    await tx.playerRelationship.create({
      data: { groupId, aId: x, bId: y, friendship: next.friendship, rivalry: next.rivalry, trust: next.trust, hostility: next.hostility, cooperation: next.cooperation, tension: next.tension, sharedMemories: next.sharedMemories, updatedAt: new Date() },
    })
  }
}

/** ثبت تعامل — sharedMemories گاهی بالا می‌رود */
export async function noteInteraction(tx: Tx, groupId: string, aId: string, bId: string, cooperative = true): Promise<void> {
  if (aId === bId) return
  await adjustRelationship(tx, groupId, aId, bId, cooperative ? "cooperation" : "tension", cooperative ? 1 : 2)
  if (Math.random() < 0.25) {
    const [x, y] = pairKey(aId, bId)
    await tx.playerRelationship
      .update({ where: { groupId_aId_bId: { groupId, aId: x, bId: y } }, data: { sharedMemories: { increment: 1 } } })
      .catch(() => undefined)
  }
}

export async function getRelationship(tx: Tx, groupId: string, aId: string, bId: string): Promise<RelationshipRow> {
  const [x, y] = pairKey(aId, bId)
  const row = await tx.playerRelationship.findUnique({ where: { groupId_aId_bId: { groupId, aId: x, bId: y } } })
  if (!row) return { ...EMPTY }
  return {
    friendship: row.friendship, rivalry: row.rivalry, trust: row.trust,
    hostility: row.hostility, cooperation: row.cooperation, tension: row.tension,
    sharedMemories: row.sharedMemories,
  }
}

/** بهترین رقیب/دوستِ بازیکن از روی گراف — برای رویدادهای دو نفره */
export async function topRelatee(
  prisma: Tx,
  groupId: string,
  playerId: string,
  favor: "tension" | "friendship" | "cooperation",
): Promise<string | null> {
  const rows = await prisma.playerRelationship.findMany({ where: { groupId, OR: [{ aId: playerId }, { bId: playerId }] } })
  let best: string | null = null
  let bestScore = 0
  for (const r of rows) {
    const other = r.aId === playerId ? r.bId : r.aId
    const score =
      favor === "tension" ? r.tension + r.hostility + r.rivalry * 0.5
      : favor === "friendship" ? r.friendship + r.trust
      : r.cooperation
    if (score > bestScore) {
      bestScore = score
      best = other
    }
  }
  return best
}

// ─── اعتبارِ چندبُعدیِ عضو ─────────────────────────────────────────────────────

export type MemberRep = Record<MemberRepDim, number>

const REP_EMPTY: MemberRep = { trust: 50, fame: 5, fear: 5, respect: 10, chaos: 10, humor: 10, danger: 5 }

export function memberRep(member: GroupMember): MemberRep {
  return { ...REP_EMPTY, ...parseJson<Partial<MemberRep>>(member.reputationJson, {}) }
}

export async function adjustMemberRep(
  tx: Tx,
  member: { id: string; reputationJson: string },
  dim: MemberRepDim,
  amount: number,
): Promise<MemberRep> {
  const cur = { ...REP_EMPTY, ...parseJson<Partial<MemberRep>>(member.reputationJson, {}) }
  cur[dim] = clamp(cur[dim] + amount, 0, 100)
  await tx.groupMember.update({ where: { id: member.id }, data: { reputationJson: JSON.stringify(cur) } })
  return cur
}

/** عنوانِ فرگت — از ابعاد اعتبار، نه از انتخاب دستی */
export function emergentTitle(member: GroupMember): string | null {
  if (member.title) return member.title
  const r = memberRep(member)
  if (r.danger >= 60) return "🕶 شخصیتِ مشکوک"
  if (r.chaos >= 65) return "🌀 عنصرِ غیرقابل‌پیش‌بینی"
  if (r.fame >= 70) return "⭐ ستاره‌ی محلی"
  if (r.trust >= 75 && r.respect >= 50) return "🕊 شهروندِ نمونه"
  if (r.fear >= 55) return "💀 آدمِ ترسناکِ قشنگ"
  if (r.respect >= 70) return "🫡 محترم"
  if (r.fame <= 10 && member.messageCount > 50) return "👁 ناظرِ ساکت"
  return null
}

/** «آدم‌های مهمِ شهر» برای کارت خانه/لیدربرد گروهی */
export function memberHighlight(member: GroupMember & { player: Player }): string {
  const r = memberRep(member)
  const dims: [string, number][] = [
    ["مشهور", r.fame], ["مطمئن", r.trust], ["خنده‌دار", r.humor],
    ["خطرناک", r.danger], ["محترم", r.respect], ["آشوبگر", r.chaos],
  ]
  dims.sort((a, b) => b[1] - a[1])
  return dims[0]![1] >= 40 ? `${dims[0]![0]}ترین` : "هیچ‌کس"
}
