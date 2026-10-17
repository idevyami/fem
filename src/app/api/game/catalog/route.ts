import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { DISTRICTS, JOBS, VEHICLES, HOUSES, getDistrict } from "@/lib/game/content"
import { resolveCaller, readBody, jsonOk, handleApiError } from "@/lib/game/api"
import { worldTick, getWorld } from "@/lib/game/world"
import type { DistrictDTO } from "@/lib/game/contract"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req)
    const player = await resolveCaller(req, body)
    await worldTick()
    const world = await getWorld()

    const playerCounts = await db.player.groupBy({ by: ["currentDistrict"], _count: true })
    const countMap = new Map(playerCounts.map((c) => [c.currentDistrict, c._count]))

    const districts: DistrictDTO[] = DISTRICTS.map((d) => {
      let flavor: string | null = null
      if (world.activeGlobalEvent === "duck_day" && d.key === "park") flavor = "🦆 اردک‌ها صاحب پارکند"
      if (world.activeGlobalEvent === "harvest_fest" && d.key === "suburbs") flavor = "🎃 جشنواره در جریان است"
      if (world.activeGlobalEvent === "black_friday" && d.key === "bazaar") flavor = "🏷 تخفیف‌ها فعال است"
      if (world.weather === "red_moon" && d.key === "forbidden") flavor = "🌕 بهتر است امشب اینجا نباشی"
      if (world.chaosLevel > 60 && d.risk >= 3) flavor = "⚠️ آشوب بالا — ریسک بیشتر، پاداش بیشتر"
      return {
        key: d.key,
        name: d.name,
        emoji: d.emoji,
        description: d.description,
        mood: d.mood,
        risk: d.risk,
        playerCount: countMap.get(d.key) ?? 0,
        activeFlavor: flavor,
      }
    })

    return jsonOk({
      districts,
      currentDistrict: player.currentDistrict,
      jobs: JOBS.map((j) => ({
        key: j.key,
        name: j.name,
        emoji: j.emoji,
        description: j.description,
        incomeMin: j.income[0],
        incomeMax: j.income[1],
        energyCost: j.energyCost,
        risk: j.risk > 0.4 ? "بالا" : j.risk > 0.15 ? "متوسط" : "کم",
        cooldownMinutes: j.cooldownMinutes,
        minLevel: j.minLevel,
        quirks: j.quirks,
      })),
      vehicles: VEHICLES.map((v) => ({
        key: v.key,
        name: v.name,
        emoji: v.emoji,
        rarity: v.rarity,
        basePrice: v.basePrice,
        speed: v.speed,
        description: v.description,
        quirk: v.quirk,
      })),
      houses: HOUSES.map((h) => ({
        key: h.key,
        name: h.name,
        emoji: h.emoji,
        price: h.price,
        rent: h.rent,
        comfort: h.comfort,
        security: h.security,
        description: h.description,
      })),
      economyIndex: world.economyIndex,
    })
  } catch (e) {
    return handleApiError(e)
  }
}
