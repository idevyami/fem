// FEMBOY WAR — V13: safety — دروازه‌های عضویت و انقضای دارایی‌های زمان‌دارِ شهر.
//
// محتوای موجِ ۱ (رفتارحافظ):
//   requireGroupMember — دروازه‌ی شهروندیِ tx-پسند؛ همان سبک/متنِ دروازه‌هایِ موجود
//     (games.joinGame / politics.castVote / engine.groupAction). امروز به
//     events.chooseEventOption و world.rumorAction وصل می‌شود — دو کنشی که
//     تا حالا بی‌دروازه بودند (یافته‌ی بازرسیِ 2-a).
//   expireRumors — شایعه‌هایِ سرآمده (expiresAt < now) از «active» به «dead»
//     می‌روند؛ همه‌ی خوانده‌ها status:"active" فیلتر می‌کنند → از دیدِ شهر
//     «پیدا نشد» است و همان پیامِ دوستانه‌ی موجود برمی‌گردد. چون GroupRumor
//     فیلدِ status دارد (برخلافِ پیش‌فرضِ طرح)، فلیپِ وضعیت با GCِ هفتگیِ
//     world.ts (حذفِ مُرده‌هایِ +۷روز) هم‌خوان است و داده‌ی واقعی نابود نمی‌شود.
//   در rumorAction خودِ کنش هم expiresAt چک می‌شود (expired ≡ not found) — کمربند+حمّال.
//   expireOpenEvents → status:'expired': منطقش در events.ts است (کنارِ ماشینِ حالتِ خودش).

import type { Prisma } from "@prisma/client"

export type SafetyDb = Prisma.TransactionClient

/** پیامِ ردِ عضویت — تک‌منبع برای همه‌ی دروازه‌ها (متنِ domain.ts، بی‌تغییر) */
export { NOT_CITIZEN_MSG } from "./domain"

/** آیا بازیکن شهروندِ این شهر است؟ — همان کوئریِ domain.isGroupMember،
 *  با دستگیره‌ی tx تا در تراکنش‌هایِ آینده (Wave 2: چالش/پذیرش) هم کار کند. */
export async function requireGroupMember(db: SafetyDb, groupId: string, playerId: string): Promise<boolean> {
  const m = await db.groupMember.findUnique({ where: { groupId_playerId: { groupId, playerId } } })
  return m !== null
}

/** انقضای شایعه‌ها — شایعه‌ی سرآمده دیگر «active» نیست: تحقیق/پخش/تکذیبش
 *  به مسیرِ «پیدا نشد» می‌افتد (همان پیامِ دوستانه‌ی موجود). بدونِ groupId
 *  = کلِ جهان (برایِ عملیاتِ آینده)؛ با groupId = همان شهر (تیکِ ۴۵ثانیه‌ای).
 *  ردیف‌ها حذف نمی‌شوند — GCِ هفتگیِ world.ts مُرده‌ها را پس از ۷ روز برمی‌دارد. */
export async function expireRumors(db: SafetyDb, groupId?: string, now = new Date()): Promise<number> {
  const r = await db.groupRumor.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: now },
      ...(groupId ? { groupId } : {}),
    },
    data: { status: "dead" },
  })
  return r.count
}
