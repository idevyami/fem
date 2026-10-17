import { db } from "@/lib/db"
import type { Player, Prisma } from "@prisma/client"

import { ITEM_MAP, getDistrict } from "./content"
import { clampStat, xpProgress } from "./helpers"
import { mulberry32, seedFrom, weightedPick, clamp } from "./rng"

export type Tx = import("@prisma/client").Prisma.TransactionClient

// ─── Money + Ledger (قابل حسابرسی) ────────────────────────────────────────────

export interface MoneyResult {
  player: Player
  delta: number
}

/** تغییر پول با ثبت Ledger. داخل تراکنش Prisma صدا زده شود. */
export async function applyMoney(
  tx: Tx,
  player: Player,
  amount: number,
  source: string,
  note = "",
): Promise<MoneyResult> {
  if (amount === 0) return { player, delta: 0 }
  let money = player.money + amount
  let extraDebt = 0
  if (money < 0) {
    // پول کافی نیست — باقیمانده بدهی می‌شود
    extraDebt = -money
    money = 0
  }
  const updated = await tx.player.update({
    where: { id: player.id },
    data: { money, debt: player.debt + extraDebt },
  })
  await tx.currencyLedger.create({
    data: {
      playerId: player.id,
      amount,
      balanceAfter: money,
      source,
      note,
    },
  })
  // آپدیت آبجکت ورودی تا فراخواننده state تازه ببیند
  player.money = updated.money
  player.debt = updated.debt
  return { player: updated, delta: amount }
}

// ─── Stats + XP (با سطح‌بندی) ─────────────────────────────────────────────────

export interface StatDelta {
  stat: "health" | "energy" | "luck" | "intelligence" | "chaos" | "fame" | "crime" | "reputation" | "xp" | "money" | "debt"
  amount: number
}

export function applyStatDeltas(data: Record<string, number>, deltas: StatDelta[]): Record<string, number> {
  const out = { ...data }
  for (const d of deltas) {
    if (d.stat === "money" || d.stat === "debt") {
      out[d.stat] = Math.max(0, (out[d.stat] ?? 0) + d.amount)
    } else {
      out[d.stat] = clampStat(d.stat, (out[d.stat] ?? 0) + d.amount)
    }
  }
  return out
}

// ─── Market prices ────────────────────────────────────────────────────────────

export interface PriceRow {
  itemKey: string
  base: number
  current: number
  trend: number
}

/** قیمت فعلی آیتم با احتساب اقتصاد جهانی و ترند آیتم */
export async function currentPrice(tx: Tx, itemKey: string, economyIndex: number): Promise<number> {
  const def = ITEM_MAP[itemKey]
  if (!def) return 0
  const row = await tx.marketPrice.findUnique({ where: { itemKey } })
  const base = row?.base ?? def.basePrice
  const trendMult = row ? row.current / (row.base || 1) : 1
  return Math.max(1, Math.round(base * trendMult * (economyIndex / 100)))
}

export async function ensureMarketPrices(tx: Tx): Promise<void> {
  const items = Object.values(ITEM_MAP).filter((i) => i.basePrice > 0)
  for (const item of items) {
    await tx.marketPrice.upsert({
      where: { itemKey: item.key },
      update: {},
      create: { itemKey: item.key, base: item.basePrice, current: item.basePrice },
    })
  }
}

/** رانش قیمت بازار — با هر تیک جهان صدا زده می‌شود */
export async function driftMarketPrices(tx: Tx, economyIndex: number, steps: number): Promise<void> {
  const rows = await tx.marketPrice.findMany()
  for (const row of rows) {
    const rng = mulberry32(seedFrom("drift", row.itemKey, Math.floor(Date.now() / 60000)))
    // برگشت آرام به قیمت پایه + نوسان
    const pull = (row.base - row.current) * 0.15
    const noise = (rng() - 0.5) * row.base * 0.18 * steps
    const next = Math.max(1, Math.round(row.current + pull + noise))
    const prevTrend = row.trend
    const newTrend = Math.round(((next - row.current) / (row.current || 1)) * 100)
    const history = JSON.parse(row.history || "[]") as number[]
    history.push(next)
    while (history.length > 20) history.shift()
    await tx.marketPrice.update({
      where: { itemKey: row.itemKey },
      data: { current: next, trend: newTrend !== 0 ? newTrend : prevTrend, history: JSON.stringify(history) },
    })
  }
}

// ─── NPC Shops (استوک محله) ───────────────────────────────────────────────────

const SHOP_STOCK_QUANTITY = 5
const MAX_ACTIVE_LISTINGS_PER_ITEM = 3

/** اطمینان از اینکه مغازه‌ی هر محله آیتم‌هایش را دارد */
export async function restockNpcShops(tx: Tx): Promise<void> {
  const all = await tx.marketListing.findMany({ where: { status: "active", sellerId: null } })
  const activeCounts = new Map<string, number>()
  for (const l of all) {
    activeCounts.set(l.itemKey, (activeCounts.get(l.itemKey) ?? 0) + 1)
  }
  const { DISTRICTS } = await import("./content")
  for (const d of DISTRICTS) {
    for (const itemKey of d.shops) {
      const def = ITEM_MAP[itemKey]
      if (!def) continue
      const count = activeCounts.get(itemKey) ?? 0
      if (count < MAX_ACTIVE_LISTINGS_PER_ITEM) {
        const price = Math.max(1, Math.round(def.basePrice * 1.25)) // مغازه کمی گران‌تر از بازار
        await tx.marketListing.create({
          data: { itemKey, quantity: SHOP_STOCK_QUANTITY, price, status: "active" },
        })
      }
    }
  }
}

// ─── Escrow helpers برای لیستینگ بازیکن ───────────────────────────────────────

export function sellPriceFor(current: number): number {
  return Math.max(1, Math.round(current * 0.6))
}

export function xpSummary(xp: number) {
  const p = xpProgress(xp)
  return { level: p.level, xpInto: p.into, xpNeed: p.need }
}

export { weightedPick, clamp, mulberry32, seedFrom }
