// FEMBOY WAR — کیتِ آغازینِ شهروند: هر بازیکنِ تازه (مهمان یا تلگرامی)
// همان چیزها را می‌گیرد — اینونتوری، عنوانِ تازه‌وارد، ردِّ تاریخ.
// نقطه‌ی مشترکِ createPlayer (Mini App) و ensurePlayerTx (گروه/ربات).

import type { Tx } from "./economy"

/** موجودیِ شروع — با مزه‌ی بقا: رامن، انرژی، ربان، غذای حیوان */
const STARTER_INVENTORY: { itemKey: string; quantity: number }[] = [
  { itemKey: "ramen", quantity: 2 },
  { itemKey: "energy_drink", quantity: 1 },
  { itemKey: "ribbon", quantity: 1 },
  { itemKey: "pet_food", quantity: 1 },
]

/** داده‌های ثابتِ آغازِ زندگی — مشترک بین موتورِ تنهایی و شهرِ گروهی */
export const STARTER_DEFAULTS = {
  money: 3000,
  houseKey: "attic",
  jobKey: "barista",
  currentDistrict: "old_town",
} as const

/** اعطای کیتِ آغازین به بازیکنِ تازه — داخل تراکنشِ ساختِ همان بازیکن صدا شود */
export async function grantStarterKit(tx: Tx, playerId: string, name: string): Promise<void> {
  for (const item of STARTER_INVENTORY) {
    await tx.inventoryItem.create({ data: { playerId, ...item } })
  }
  await tx.playerTitle.create({ data: { playerId, titleKey: "newcomer", active: true } })
  await tx.historyEntry.create({
    data: {
      playerId,
      icon: "🚪",
      text: `${name} وارد شهر شد. کسی متوجه نشد. یا همه متوجه شدند و ساکت ماندند.`,
      category: "world",
    },
  })
  await tx.worldFeed.create({
    data: { worldId: "world", icon: "🚪", text: `${name} امروز وارد شهر شد. هنوز نمی‌داند چه چیزی در انتظارش است.` },
  })
}
