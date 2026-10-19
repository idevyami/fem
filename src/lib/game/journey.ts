// FEMBOY WAR V17 — مرحله‌ی سفرِ بازیکن (قراردادِ مشترکِ سه سطحِ بازی).
// مشکلِ مستندِ ممیز: «همه‌چیز یک‌جا باز می‌شود» — بازیکنِ روزِ اول با ۷ تب و ۱۹ اکشنِ
// هم‌زمان روبه‌رو می‌شود، در حالی‌که ۸۵٪ بازیکنانِ واقعی قبل از اولین اتفاق رها می‌کنند.
// این ماژول از فیلدهای «موجودِ» سرور یک مرحله‌ی واحد استخراج می‌کند تا مینی‌اپ، رباتِ
// خصوصی و رباتِ گروهی بتوانند بدونِ state جدی، افشایشِ تدریجی را یک‌صدا اجرا کنند.
// هیچ چیزی در DB ذخیره نمی‌شود — استخراجِ خالص (server-authoritative در هر snapshot).
import type { Player } from "@prisma/client"

export type JourneyStage = "new" | "awakened" | "bound" | "rooted"

export interface JourneyInfo {
  stage: JourneyStage
}

/**
 * new      — تازه‌وارد: نه پیمان بسته، نه اولین اتفاق را دیده (جلسه‌ی اول فعال است).
 * awakened — اولین اتفاق را حل کرده (onboarded) ولی هنوز فمبوی ندارد؛ شهر می‌شناسدش.
 * bound    — پیمان بسته؛ دورانِ فمبوی (تعلیم/شکار/فرگشت).
 * rooted   — شهروندِ ریشه‌دار: فمبوی دارد و سطحِ بازیکن ≥ ۵ — همه‌ی شهر باز است.
 */
export function journeyStageOf(player: Pick<Player, "onboarded" | "level">, hasFemboy: boolean): JourneyStage {
  if (hasFemboy) return player.level >= 5 ? "rooted" : "bound"
  return player.onboarded ? "awakened" : "new"
}

export function journeyInfoOf(player: Pick<Player, "onboarded" | "level">, hasFemboy: boolean): JourneyInfo {
  return { stage: journeyStageOf(player, hasFemboy) }
}
