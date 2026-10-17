import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { ITEM_MAP, getDistrict } from "@/lib/game/content"
import { getWorld, worldTick } from "@/lib/game/world"
import { currentPrice } from "@/lib/game/economy"
import { RARITY_LABEL } from "@/lib/game/types"
import { jsonOk, handleApiError, resolveCaller, readBody } from "@/lib/game/api"
import type { MarketSnapshot, MarketEntryDTO, PriceInfoDTO, ShopItemDTO } from "@/lib/game/contract"
import type { Rarity } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    await worldTick()
    const world = await getWorld()

    const [listings, prices] = await Promise.all([
      db.marketListing.findMany({
        where: { status: "active", quantity: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      db.marketPrice.findMany(),
    ])

    const sellerIds = [...new Set(listings.map((l) => l.sellerId).filter(Boolean))] as string[]
    const sellers = sellerIds.length
      ? await db.player.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
      : []
    const sellerMap = new Map(sellers.map((s) => [s.id, s.name]))

    const listingDtos: MarketEntryDTO[] = []
    for (const l of listings) {
      const def = ITEM_MAP[l.itemKey]
      if (!def) continue
      listingDtos.push({
        listingId: l.id,
        itemKey: l.itemKey,
        name: def.name,
        emoji: def.emoji,
        rarity: def.rarity,
        price: l.price,
        quantity: l.quantity,
        sellerName: l.sellerId ? sellerMap.get(l.sellerId) ?? "؟" : null,
        mine: l.sellerId === player.id,
      })
    }

    // مغازه‌ی محله‌ی فعلی بازیکن
    const district = getDistrict(player.currentDistrict)
    const shop: ShopItemDTO[] = []
    for (const itemKey of district.shops) {
      const def = ITEM_MAP[itemKey]
      if (!def) continue
      const listing = listings.find((l) => l.itemKey === itemKey && !l.sellerId)
      if (listing) {
        shop.push({
          itemKey,
          name: def.name,
          emoji: def.emoji,
          rarity: def.rarity,
          price: listing.price,
          description: def.description,
        })
      }
    }

    const priceDtos: PriceInfoDTO[] = prices
      .filter((p) => ITEM_MAP[p.itemKey]?.tradable)
      .map((p) => ({
        itemKey: p.itemKey,
        name: ITEM_MAP[p.itemKey].name,
        emoji: ITEM_MAP[p.itemKey].emoji,
        base: p.base,
        current: Math.round(p.current * (world.economyIndex / 100)),
        trend: p.trend,
      }))
      .sort((a, b) => b.current - a.current)

    const snapshot: MarketSnapshot = {
      listings: listingDtos,
      prices: priceDtos,
      shop,
      playerMoney: player.money,
    }
    return jsonOk(snapshot)
  } catch (e) {
    return handleApiError(e)
  }
}
