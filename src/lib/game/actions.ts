import { db } from "@/lib/db"
import type { Player } from "@prisma/client"
import { ITEM_MAP, PET_MAP, getJob, getVehicle, getHouse, getDistrict, TITLE_MAP, ACHIEVEMENT_MAP } from "./content"
import { faDigits,  parseFlags, clampStat, STAT_META } from "./helpers"
import { applyMoney, currentPrice, sellPriceFor } from "./economy"
import type { Tx } from "./economy"
import { getWorld } from "./world"
import { mulberry32, seedFrom, weightedPick, clamp, chance, randInt, pickOne } from "./rng"
import type { ActionResponse, DeltaLineDTO } from "./contract"
import { claimOpportunity } from "./opportunities"
import { awardXpTx, masteryPayoutBonus, workPayoutBonus, restGainBonus, marketBargainBonus } from "./character"
import { masteryLevelOf as _mlo } from "./content/classes"

/** V10 — درصدِ چانه‌زنیِ فمبوی بازیکن (فروش به دلال) */
async function femboyBargainPct(playerId: string): Promise<number> {
  const soul = await db.soulCharacter.findUnique({ where: { playerId } })
  if (!soul) return 0
  return marketBargainBonus(soul) + masteryPayoutBonus(_mlo(soul.masteryXp))
}
import { masteryLevelOf } from "./content/classes"

function delta(stat: keyof typeof STAT_META, amount: number): DeltaLineDTO {
  const meta = STAT_META[stat]
  const inverted = stat === "debt" || stat === "crime"
  const tone: DeltaLineDTO["tone"] = amount === 0 ? "neutral" : inverted ? (amount > 0 ? "bad" : "good") : amount > 0 ? "good" : "bad"
  return { icon: meta.icon, label: meta.label, amount, tone }
}

async function history(tx: Tx, playerId: string, icon: string, text: string, category: string, day: number) {
  await tx.historyEntry.create({ data: { playerId, icon, text, category, day } })
}

export interface ActionOk {
  message: string
  flavor?: string
  deltas: DeltaLineDTO[]
  extra?: Record<string, unknown>
}

export type ActionReturn = { error?: string; ok?: ActionOk }

export async function runAction(player: Player, action: string, payload: Record<string, unknown>): Promise<ActionReturn> {
  const world = await getWorld()
  const flags = parseFlags(player)
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : undefined)
  const num = (k: string) => (typeof payload[k] === "number" ? (payload[k] as number) : undefined)

  switch (action) {
    // ─────────────────────────── کار ───────────────────────────
    case "work": {
      const job = getJob(player.jobKey)
      if (!job) return { error: "کاری نداری. بیکاری هم یه شغله، ولی حقوق نمی‌ده." }
      if (player.restUntil && player.restUntil.getTime() > Date.now())
        return { error: "داری استراحت می‌کنی. شهر صبر می‌کند." }
      const lastMin = player.lastWorkedAt ? (Date.now() - player.lastWorkedAt.getTime()) / 60000 : Infinity
      if (lastMin < job.cooldownMinutes)
        return { error: `هنوز نفس تازه نکردی. ${Math.ceil(job.cooldownMinutes - lastMin)} دقیقه دیگه.` }
      if (player.energy < job.energyCost) return { error: "انرژی‌ات برای شیفت بعدی کافی نیست." }

      const rng = mulberry32(seedFrom("work", player.id, Date.now()))
      const streakBonus = 1 + Math.min(0.3, player.workStreak * 0.03)
      let income = randInt(job.income[0], job.income[1], rng)
      // پیک و استریمر: آشوب یعنی پول
      if (["courier", "streamer"].includes(job.key)) income = Math.round(income * (1 + player.chaos / 200))
      income = Math.round(income * streakBonus)
      const fail = chance(job.risk, rng)
      const deltas: DeltaLineDTO[] = []

      let message: { message: string; flavor: string; income: number }
      try {
        message = await db.$transaction(async (tx) => {
          // قفلِ دوباره‌چک داخل تراکنش — دو شیفتِ هم‌زمان فقط یک‌بار حقوق می‌گیرند
          let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
          const freshMin = p.lastWorkedAt ? (Date.now() - p.lastWorkedAt.getTime()) / 60000 : Infinity
          if (freshMin < job.cooldownMinutes) throw new Error("COOLDOWN")
          if (p.energy < job.energyCost) throw new Error("NO_ENERGY")
          if (p.restUntil && p.restUntil.getTime() > Date.now()) throw new Error("RESTING")
          if (fail) {
            income = Math.round(income * 0.35)
            const failLine = pickOne(job.failLines, rng)
            await applyMoney(tx, p, income, "job", job.name)
            p = await tx.player.update({
              where: { id: p.id },
              data: { energy: clamp(p.energy - job.energyCost, 0, 100), health: clamp(p.health - 5, 0, 100), workStreak: 0, lastWorkedAt: new Date() },
            })
            deltas.push(delta("money", income), delta("energy", -job.energyCost), delta("health", -5))
            await history(tx, player.id, job.emoji, `شیفت خراب شد: ${job.name}`, "job", p.day)
            return { message: "شیفت خوب پیش نرفت.", flavor: failLine, income }
          } else {
            const workLine = pickOne(job.workLines, rng)
            let femboyWorkLine = "" // V10 — خطِ پاداشِ دستمزد (اگر مهارت/تسلط اثر کرد)
            // V10 — هویتِ کلاس در زندگی: مهارتِ «% حقوقِ شیفت» (شاخه‌ی زندگی) + پاداشِ کلاس-تسلط
            const soulForWork = await tx.soulCharacter.findUnique({ where: { playerId: player.id } })
            let payoutPct = 0
            if (soulForWork) {
              payoutPct = workPayoutBonus(soulForWork) + masteryPayoutBonus(masteryLevelOf(soulForWork.masteryXp))
            }
            if (payoutPct > 0) {
              const before = income
              income = Math.round(income * (1 + payoutPct / 100))
              femboyWorkLine = `${soulForWork?.name ?? "فمبویت"} دستِ کار را رساند — ${faDigits(payoutPct)}% دستمزدِ بیشتر (+${faDigits(income - before)} سکه)`
            }
            const xpGain = 8 + Math.floor(income / 120)
            await applyMoney(tx, p, income, "job", job.name)
            p = await tx.player.update({
              where: { id: p.id },
              data: {
                energy: clamp(p.energy - job.energyCost, 0, 100),
                xp: p.xp + xpGain,
                workStreak: p.workStreak + 1,
                lastWorkedAt: new Date(),
              },
            })
            deltas.push(delta("money", income), delta("energy", -job.energyCost), delta("xp", xpGain))
            await history(tx, player.id, job.emoji, `شیفت ${job.name} انجام شد: +${income} سکه`, "job", p.day)
            // پیمانکار مرموز: سابقه می‌سازد
            if (job.key === "mystery_contractor") {
              await tx.player.update({ where: { id: p.id }, data: { crime: clamp(p.crime + 3, 0, 100) } })
              deltas.push(delta("crime", 3))
            }
            // V9 — تربیتِ فمبوی: شیفتِ موفق، +3 XPِ بخت (شمارشِ سکه‌ها هنری است)
            let femboyLine = ""
            const soul = await tx.soulCharacter.findUnique({ where: { playerId: player.id } })
            if (soul) {
              const { char: updated } = await awardXpTx(tx, soul, { tracks: { fortune: 3 } })
              femboyLine = `${updated.name} شمارشِ سکه‌ها را از تو یاد گرفت (+3 XPِ بخت)`
            }
            const femboyBits = [femboyWorkLine, femboyLine].filter(Boolean).join("\n")
            return { message: "شیفت تمام شد.", flavor: femboyBits ? `${workLine}\n${femboyBits}` : workLine, income }
          }
        })
      } catch (e) {
        if (e instanceof Error && e.message === "COOLDOWN") return { error: "شیفتت تازه تمام شده. نفس تازه نکردی." }
        if (e instanceof Error && e.message === "NO_ENERGY") return { error: "انرژی‌ات برای شیفت بعدی کافی نیست." }
        if (e instanceof Error && e.message === "RESTING") return { error: "داری استراحت می‌کنی. شهر صبر می‌کند." }
        throw e
      }
      return { ok: { message: message.message, flavor: message.flavor, deltas } }
    }

    // ─────────────────────────── سفر ───────────────────────────
    case "travel": {
      const target = str("district")
      if (!target) return { error: "مقصد را نگفتی." }
      const district = getDistrict(target)
      if (district.key === player.currentDistrict) return { error: "همین‌جایی." }
      const vehicle = getVehicle(player.vehicleKey)
      const energyCost = Math.max(2, 6 - (vehicle?.speed ?? 0))
      if (player.energy < energyCost) return { error: "برای این مسیر انرژی نداری." }
      const f = parseFlags(player)
      const visited = new Set([...(f.visitedDistricts ?? []), district.key])
      f.visitedDistricts = [...visited]
      await db.$transaction(async (tx) => {
        await tx.player.update({
          where: { id: player.id },
          data: { currentDistrict: district.key, energy: clamp(player.energy - energyCost, 0, 100), flags: JSON.stringify(f) },
        })
        await history(tx, player.id, district.emoji, `رفتی به ${district.name}`, "world", player.day)
      })
      return {
        ok: {
          message: `رسیدی به ${district.name}.`,
          flavor: district.mood,
          deltas: [delta("energy", -energyCost)],
        },
      }
    }

    // ─────────────────────────── استراحت ───────────────────────────
    case "rest": {
      if (player.restUntil && player.restUntil.getTime() > Date.now())
        return { error: "داری خوابی. بذار تمام شه." }
      const deltas: DeltaLineDTO[] = [delta("energy", 100 - player.energy), delta("health", 15)]
      // V9 — خوابِ عمیق، فمبوی را هم آروم می‌کند: +6 روحیه (سقف‌دار)
      let femboyLine = ""
      await db.$transaction(async (tx) => {
        await tx.player.update({
          where: { id: player.id },
          data: { energy: 100, health: clamp(player.health + 15, 0, 100), restUntil: new Date(Date.now() + 90 * 60000) },
        })
        const soul = await tx.soulCharacter.findUnique({ where: { playerId: player.id } })
        if (soul && soul.spirit < 100) {
          // V10 — مهارتِ «% جلای استراحتِ توأمان» (شاخه‌ی زندگی): خوابِ عمیق‌تر
          const restPct = restGainBonus(soul)
          const gain = Math.min(Math.round(6 * (1 + restPct / 100)), 100 - soul.spirit)
          const updated = await tx.soulCharacter.update({
            where: { id: soul.id },
            data: { spirit: clamp(soul.spirit + gain, 0, 100) },
          })
          femboyLine = `${updated.name} هم کنارِ تو خوابید — روحیه‌اش ${restPct > 0 ? `عمیق‌ (${faDigits(gain)}+) ` : ""}جلا افتاد.`
        }
        await history(tx, player.id, "😴", "خوابیدی. شهر هم یه لحظه ساکت شد.", "world", player.day)
      })
      return {
        ok: {
          message: "خوابیدی. صبحِ شهرت در ساعت و نیم دیگر می‌رسد.",
          flavor: femboyLine || "خواب عمیقی بود. خوابیدی بدون اینکه بدونی شهر چیکار کرد.",
          deltas,
        },
      }
    }

    // ─────────────────────────── حیوانات ───────────────────────────
    case "feedPet": {
      const petId = str("petId")
      if (!petId) return { error: "کدوم حیوان؟" }
      const pet = await db.pet.findFirst({ where: { id: petId, playerId: player.id } })
      if (!pet) return { error: "چنین حیوانی مال تو نیست." }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey: "pet_food" } })
      const world2 = await getWorld()
      const price = Math.max(60, Math.round((await currentPrice(db, "pet_food", world2.economyIndex)) * 1.2))
      if (!inv || inv.quantity < 1) {
        if (player.money < price) return { error: `نه غذای حیوان داری نه ${price} سکه برای خریدش.` }
        await db.$transaction(async (tx) => {
          await applyMoney(tx, player, -price, "pet", "غذای حیوان")
          await tx.pet.update({
            where: { id: pet.id },
            data: { hunger: clamp(pet.hunger + 35, 0, 100), loyalty: clamp(pet.loyalty + 4, 0, 100), mood: "راضی" },
          })
        })
        return { ok: { message: `${pet.name} غذایش را خورد. راضی به نظر می‌رسد.`, deltas: [delta("money", -price)] } }
      }
      await db.$transaction(async (tx) => {
        await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: inv.quantity - 1 } })
        await tx.pet.update({
          where: { id: pet.id },
          data: { hunger: clamp(pet.hunger + 35, 0, 100), loyalty: clamp(pet.loyalty + 4, 0, 100), mood: "راضی" },
        })
      })
      return { ok: { message: `${pet.name} غذایش را خورد. راضی به نظر می‌رسد.`, deltas: [] } }
    }

    case "playPet": {
      const petId = str("petId")
      if (!petId) return { error: "کدوم حیوان؟" }
      const pet = await db.pet.findFirst({ where: { id: petId, playerId: player.id } })
      if (!pet) return { error: "چنین حیوانی مال تو نیست." }
      if (player.energy < 8) return { error: "خودت انرژی نداری که باهاش بازی کنی." }
      const rng = mulberry32(seedFrom("playpet", pet.id, Date.now()))
      const deltas: DeltaLineDTO[] = [delta("energy", -8)]
      // حیوانات با شانس بالا گاهی چیزی پیدا می‌کنند
      let foundText: string | null = null
      const findChance = 0.15 + (player.luck / 400) + (pet.loyalty / 300)
      const foundDef = chance(findChance, rng) ? ITEM_MAP[pickOne(["coin", "nazar", "ribbon", "phone"], rng)] : undefined
      await db.$transaction(async (tx) => {
        await tx.player.update({ where: { id: player.id }, data: { energy: clamp(player.energy - 8, 0, 100) } })
        await tx.pet.update({
          where: { id: pet.id },
          data: { loyalty: clamp(pet.loyalty + 6, 0, 100), energy: clamp(pet.energy - 10, 0, 100), mood: "شاد" },
        })
        // غنیمتِ حیوان — همان‌جا داخل تراکنش، نه بیرونش
        if (foundDef) {
          await tx.inventoryItem.upsert({
            where: { playerId_itemKey: { playerId: player.id, itemKey: foundDef.key } },
            update: { quantity: { increment: 1 } },
            create: { playerId: player.id, itemKey: foundDef.key, quantity: 1 },
          })
          foundText = `${pet.name} یه چیز گم‌شده پیدا کرد: ${foundDef.emoji} ${foundDef.name}`
          await tx.historyEntry.create({
            data: { playerId: player.id, icon: foundDef.emoji, text: `${pet.name} موقع بازی ${foundDef.name} پیدا کرد`, category: "pet", day: player.day },
          })
        }
      })
      return {
        ok: {
          message: `با ${pet.name} بازی کردی. وفاداری‌ش رفت بالا.`,
          flavor: foundText ?? "یه بازی معمولی. برای هر دوتون خوب بود.",
          deltas,
        },
      }
    }

    case "renamePet": {
      const petId = str("petId")
      const name = str("name")
      if (!petId || !name) return { error: "اسم را نگو که چه نامت بگذارم... اسم را بده." }
      const clean = name.trim().slice(0, 20)
      if (clean.length < 2) return { error: "اسم باید حداقل 2 حرف باشد." }
      const pet = await db.pet.findFirst({ where: { id: petId, playerId: player.id } })
      if (!pet) return { error: "چنین حیوانی مال تو نیست." }
      await db.pet.update({ where: { id: pet.id }, data: { name: clean } })
      return { ok: { message: `حالا اسمش «${clean}» است. حیوانات اسم‌های جدید را سریع قبول می‌کنند.`, deltas: [] } }
    }

    case "buyPetFood": {
      const price = Math.max(60, Math.round((await currentPrice(db, "pet_food", world.economyIndex)) * 1.2))
      const qty = clamp(num("quantity") ?? 1, 1, 10)
      const total = price * qty
      if (player.money < total) return { error: `${total} سکه لازم داری.` }
      await db.$transaction(async (tx) => {
        await applyMoney(tx, player, -total, "market", "غذای حیوان")
        await tx.inventoryItem.upsert({
          where: { playerId_itemKey: { playerId: player.id, itemKey: "pet_food" } },
          update: { quantity: { increment: qty } },
          create: { playerId: player.id, itemKey: "pet_food", quantity: qty },
        })
      })
      return { ok: { message: `${qty} واحد غذای حیوان خریدی.`, deltas: [delta("money", -total)] } }
    }

    // ─────────────────────────── آیتم‌ها ───────────────────────────
    case "useItem": {
      const itemKey = str("itemKey")
      if (!itemKey) return { error: "چه چیزی؟" }
      const def = ITEM_MAP[itemKey]
      if (!def) return { error: "چنین چیزی در جهان وجود ندارد." }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey } })
      if (!inv || inv.quantity < 1) return { error: "نداریش." }
      if (!def.usable) return { error: `${def.name} خوراکی/مصرفی نیست.` }
      const deltas: DeltaLineDTO[] = []
      let flavor: string | undefined
      await db.$transaction(async (tx) => {
        let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
        if (def.effect) {
          const stat = def.effect.stat
          if (stat === "money") {
            await applyMoney(tx, p, def.effect.amount, "misc", def.name)
          } else if (stat === "debt") {
            p = await tx.player.update({ where: { id: p.id }, data: { debt: Math.max(0, p.debt + def.effect.amount) } })
          } else {
            const data: Record<string, number> = { [stat]: (p as unknown as Record<string, number>)[stat] + def.effect.amount }
            p = await tx.player.update({
              where: { id: p.id },
              data: { [stat]: clampStat(stat as never, data[stat]) },
            })
          }
          deltas.push(delta(def.effect.stat, def.effect.amount))
        }
        // افکت‌های خاص آیتم‌های مرموز
        if (itemKey === "cassette") flavor = "کاست را گذاشتی. آهنگی پخش شد که یادت نمی‌ماند ولی حالت بهتر شد."
        if (itemKey === "old_key") flavor = "کلید را دستت گرفتی. گرم است. هنوز درِ خودش را پیدا نکرده."
        if (itemKey === "duck") flavor = "اردک را نگاه کردی. اردک نگاه کرد. هیچ‌کدام چیزی نگفتید. یه اتفاق بزرگ بود."
        if (itemKey === "cursed_card") flavor = "کارت را باز کردی. نقشه عوض شده بود. یه خونه‌ی جدید با ربان قرمز."
        if (itemKey === "cat_collar") flavor = "پلاک را برگرداندی. روی آن نوشته: «همیشه دیر می‌رسی. ولی می‌رسی.»"
        await tx.inventoryItem.update({ where: { id: inv.id }, data: { quantity: inv.quantity - 1 } })
        await history(tx, player.id, def.emoji, `${def.name} استفاده شد`, "misc", p.day)
      })
      return { ok: { message: `${def.emoji} ${def.name} مصرف شد.`, flavor, deltas } }
    }

    case "equipItem": {
      const itemKey = str("itemKey")
      if (!itemKey) return { error: "چه چیزی؟" }
      const def = ITEM_MAP[itemKey]
      if (!def || def.category !== "gear") return { error: "این قابل equip شدن نیست." }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey } })
      if (!inv || inv.quantity < 1) return { error: "نداریش." }
      await db.$transaction(async (tx) => {
        // فقط یک وسیله‌ی gear در هر لحظه
        await tx.inventoryItem.updateMany({ where: { playerId: player.id, equipped: true }, data: { equipped: false } })
        await tx.inventoryItem.update({ where: { id: inv.id }, data: { equipped: true } })
      })
      return {
        ok: {
          message: `${def.emoji} ${def.name} الان تن توست.`,
          flavor: def.effect ? `اثرش همیشه باهاته: ${STAT_META[def.effect.stat].label} ${def.effect.amount > 0 ? "+" : ""}${def.effect.amount}` : undefined,
          deltas: [],
        },
      }
    }

    case "favoriteItem": {
      const itemKey = str("itemKey")
      if (!itemKey) return { error: "چه چیزی؟" }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey } })
      if (!inv) return { error: "نداریش." }
      await db.inventoryItem.update({ where: { id: inv.id }, data: { favorite: !inv.favorite } })
      return { ok: { message: inv.favorite ? "از علاقه‌مندی‌ها درآمد." : "به علاقه‌مندی‌ها اضافه شد.", deltas: [] } }
    }

    // ─────────────────────────── بازار ───────────────────────────
    case "buyItem": {
      const listingId = str("listingId")
      if (!listingId) return { error: "کدوم آگهی؟" }
      const listing = await db.marketListing.findUnique({ where: { id: listingId } })
      if (!listing || listing.status !== "active" || listing.quantity < 1) return { error: "این آگهی دیگر معتبر نیست." }
      if (listing.sellerId === player.id) return { error: "این مال خودته. از خودت نخر." }
      if (listing.expiresAt && listing.expiresAt.getTime() <= Date.now())
        return { error: "این آگهی از زمانش گذشته. جنسش برگشته پیشِ فروشنده." }
      const def = ITEM_MAP[listing.itemKey]
      if (!def) return { error: "چنین چیزی در جهان نیست." }
      if (player.money < listing.price) return { error: `${listing.price} سکه لازم داری. داری؟ نه.` }
      const deltas: DeltaLineDTO[] = [delta("money", -listing.price)]
      try {
        await db.$transaction(async (tx) => {
          // قفلِ خرید: فلیپِ شرطی — خریدارِ هم‌زمانِ دیگر با شرطِ status جا می‌ماند
          const flipped = await tx.marketListing.updateMany({
            where: {
              id: listing.id,
              status: "active",
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            data: { status: "sold", soldAt: new Date(), quantity: 0 },
          })
          if (flipped.count === 0) throw new Error("TAKEN")
          let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
          // موجودیِ خریدار داخل تراکنش دوباره چک می‌شود
          if (p.money < listing.price) throw new Error("NO_MONEY")
          // برداشت پول خریدار
          await applyMoney(tx, p, -listing.price, "market", `خرید ${def.name}`)
          // واریز به فروشنده اگر بازیکن است
          if (listing.sellerId) {
            const seller = await tx.player.findUniqueOrThrow({ where: { id: listing.sellerId } })
            await applyMoney(tx, seller, listing.price, "market", `فروش ${def.name}`)
          }
          await tx.inventoryItem.upsert({
            where: { playerId_itemKey: { playerId: player.id, itemKey: listing.itemKey } },
            update: { quantity: { increment: listing.quantity } },
            create: { playerId: player.id, itemKey: listing.itemKey, quantity: listing.quantity },
          })
          p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
          await history(tx, player.id, def.emoji, `${def.name} خریدی (${listing.price} سکه)`, "money", p.day)
          const f = parseFlags(p)
          if (!f.discovered?.includes(listing.itemKey)) {
            f.discovered = [...(f.discovered ?? []), listing.itemKey]
            await tx.player.update({ where: { id: p.id }, data: { flags: JSON.stringify(f) } })
          }
        })
      } catch (e) {
        if (e instanceof Error && e.message === "TAKEN") return { error: "کسی زودتر تو را زد — آگهی فروخته شد." }
        if (e instanceof Error && e.message === "NO_MONEY") return { error: "پولت کافی نبود. بازار منتظر نمی‌ماند." }
        throw e
      }
      return {
        ok: {
          message: `${def.emoji} ${def.name} مال تو شد.`,
          flavor: listing.sellerId ? "فروشنده آدم بود. به سلامت." : "مغازه‌دار بسته‌بندی کرد و گفت «مبارک».",
          deltas,
        },
      }
    }

    case "sellItem": {
      const itemKey = str("itemKey")
      const quantity = clamp(num("quantity") ?? 1, 1, 999)
      if (!itemKey) return { error: "چه چیزی؟" }
      const def = ITEM_MAP[itemKey]
      if (!def) return { error: "چنین چیزی نیست." }
      if (!def.tradable) return { error: "این قابل فروش نیست. بعضی چیزها فقط مالِ تو می‌مانند." }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey } })
      if (!inv || inv.quantity < quantity) return { error: "به این تعداد نداریش." }
      if (inv.locked || inv.favorite) return { error: "این را قفل کرده‌ای/دوستش داری. اول از علاقه‌مندی‌ها دربیاورش." }
      // V10 — مهارتِ «% فروشِ گران‌تر» (شاخه‌ی زندگی: چانه‌زنی) — فروشِ تیزتر از بازار
      const bargainPct = await femboyBargainPct(player.id)
      const price = Math.round(sellPriceFor(await currentPrice(db, itemKey, world.economyIndex)) * quantity * (1 + bargainPct / 100))
      const deltas: DeltaLineDTO[] = [delta("money", price)]
      try {
        await db.$transaction(async (tx) => {
          // کم‌کردنِ شرطی — فروشِ هم‌زمانِ دو جنسِ آخر فقط یکی را می‌برد
          const decremented = await tx.inventoryItem.updateMany({
            where: { id: inv.id, quantity: { gte: quantity } },
            data: { quantity: { decrement: quantity } },
          })
          if (decremented.count === 0) throw new Error("GONE")
          const p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
          await applyMoney(tx, p, price, "market", `فروش ${def.name}`)
          await history(tx, player.id, def.emoji, `${quantity}× ${def.name} فروختی (+${price} سکه)`, "money", p.day)
        })
      } catch (e) {
        if (e instanceof Error && e.message === "GONE") return { error: "به این تعداد نداریش. شهر حسابِ کیف‌ها را دقیق نگه می‌دارد." }
        throw e
      }
      return {
        ok: {
          message: `فروختی. ${faDigits(price)} سکه اومد تو جیبت.`,
          flavor: bargainPct > 0 ? `فمبویت چانه را تا ${faDigits(bargainPct)}% بالا برد — بازار سخت گیر کرد، ولی نشد.` : "بازار امروز منصف بود. تقریباً.",
          deltas,
        },
      }
    }

    case "createListing": {
      const itemKey = str("itemKey")
      const quantity = clamp(num("quantity") ?? 1, 1, 99)
      const price = clamp(num("price") ?? 0, 1, 999999)
      if (!itemKey) return { error: "چه چیزی؟" }
      const def = ITEM_MAP[itemKey]
      if (!def) return { error: "چنین چیزی نیست." }
      if (!def.tradable) return { error: "این قابل معامله نیست." }
      const inv = await db.inventoryItem.findFirst({ where: { playerId: player.id, itemKey } })
      if (!inv || inv.quantity < quantity) return { error: "به این تعداد نداریش." }
      if (inv.locked || inv.favorite) return { error: "این آیتم قفل/علاقه‌مندی است." }
      try {
        await db.$transaction(async (tx) => {
          // کم‌کردنِ شرطی — دو آگهیِ هم‌زمان از موجودیِ کهنه رد نمی‌شوند
          const decremented = await tx.inventoryItem.updateMany({
            where: { id: inv.id, quantity: { gte: quantity } },
            data: { quantity: { decrement: quantity } },
          })
          if (decremented.count === 0) throw new Error("GONE")
          // آگهیِ بازیکن 3 روز فرصت دارد — بعدش شهر جنسش را پس می‌فرستد
          await tx.marketListing.create({
            data: { sellerId: player.id, itemKey, quantity, price, status: "active", expiresAt: new Date(Date.now() + 3 * 86400000) },
          })
        })
      } catch (e) {
        if (e instanceof Error && e.message === "GONE") return { error: "به این تعداد نداریش. شهر حسابِ کیف‌ها را دقیق نگه می‌دارد." }
        throw e
      }
      return { ok: { message: `آگهیت زده شد: ${quantity}× ${def.name} — ${price} سکه. سه‌روزه اعتبار دارد.`, deltas: [] } }
    }

    case "cancelListing": {
      const listingId = str("listingId")
      if (!listingId) return { error: "کدوم آگهی؟" }
      const listing = await db.marketListing.findUnique({ where: { id: listingId } })
      if (!listing || listing.sellerId !== player.id || listing.status !== "active")
        return { error: "این آگهی مالِ تو نیست یا دیگر فعال نیست." }
      try {
        await db.$transaction(async (tx) => {
          // فلیپِ شرطی — اگر خریدار لحظه‌ای قبل زده، پس‌گرفتن ممکن نیست
          const flipped = await tx.marketListing.updateMany({
            where: { id: listing.id, sellerId: player.id, status: "active" },
            data: { status: "cancelled" },
          })
          if (flipped.count === 0) throw new Error("TAKEN")
          await tx.inventoryItem.upsert({
            where: { playerId_itemKey: { playerId: player.id, itemKey: listing.itemKey } },
            update: { quantity: { increment: listing.quantity } },
            create: { playerId: player.id, itemKey: listing.itemKey, quantity: listing.quantity },
          })
        })
      } catch (e) {
        if (e instanceof Error && e.message === "TAKEN") return { error: "دیر شد — همین الان فروخته شد." }
        throw e
      }
      return { ok: { message: "آگهی پس گرفته شد. جنس برگشت تو کیف.", deltas: [] } }
    }

    // ─────────────────────────── بدهی ───────────────────────────
    case "payDebt": {
      const amount = clamp(num("amount") ?? 0, 1, player.money)
      if (player.debt <= 0) return { error: "بدهی نداری. این هم یه اتفاق است." }
      if (player.money < 1) return { error: "پولی برای پس دادن نداری." }
      const pay = Math.min(amount, player.money, player.debt)
      await db.$transaction(async (tx) => {
        let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
        await applyMoney(tx, p, -pay, "debt", "پس دادن قرض")
        p = await tx.player.update({ where: { id: p.id }, data: { debt: Math.max(0, p.debt - pay) } })
        await history(tx, player.id, "💼", `${pay} سکه از بدهی پس دادی`, "money", p.day)
        // رابطه با فرهاد
        const rel = await tx.relationship.upsert({
          where: { playerId_npcKey: { playerId: p.id, npcKey: "daii_farhad" } },
          update: { trust: { increment: 5 }, fear: { decrement: 3 } },
          create: { playerId: p.id, npcKey: "daii_farhad", trust: 5, respect: 25, fear: 42 },
        })
        if (p.debt === 0) {
          await tx.notification.create({
            data: {
              playerId: p.id,
              icon: "🕊",
              title: "بی‌بدهی",
              body: "دایی فرهاد پیام داد: «حساب تسویه. حالا می‌تونی نفس بکشی. تا دفعه‌ی بعد.»",
              kind: "reward",
            },
          })
          const has = await tx.playerAchievement.findUnique({
            where: { playerId_achievementKey: { playerId: p.id, achievementKey: "redeemed" } },
          })
          if (!has) {
            await tx.playerAchievement.create({ data: { playerId: p.id, achievementKey: "redeemed" } })
          }
        }
      })
      return { ok: { message: `${pay} سکه پس دادی. فرهاد یه جایی لبخند زد.`, deltas: [delta("money", -pay), delta("debt", -pay)] } }
    }

    // ─────────────────────────── خرید بزرگ ───────────────────────────
    case "buyVehicle": {
      const vehicleKey = str("vehicleKey")
      if (!vehicleKey) return { error: "کدوم وسیله؟" }
      const vehicle = getVehicle(vehicleKey)
      if (!vehicle) return { error: "چنین وسیله‌ای نیست." }
      const price = Math.round(vehicle.basePrice * (world.economyIndex / 100))
      if (player.money < price) return { error: `${price} سکه لازم داری. فروشنده سرش را تکان داد.` }
      await db.$transaction(async (tx) => {
        let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
        await applyMoney(tx, p, -price, "market", `خرید ${vehicle.name}`)
        p = await tx.player.update({ where: { id: p.id }, data: { vehicleKey: vehicle.key, xp: p.xp + 15 } })
        await history(tx, player.id, vehicle.emoji, `${vehicle.name} خریدی`, "money", p.day)
      })
      return {
        ok: {
          message: `${vehicle.emoji} ${vehicle.name} مالِ تو شد.`,
          flavor: vehicle.quirk,
          deltas: [delta("money", -price)],
        },
      }
    }

    case "buyHouse": {
      const houseKey = str("houseKey")
      if (!houseKey) return { error: "کدوم خانه؟" }
      const house = getHouse(houseKey)
      if (!house) return { error: "چنین خانه‌ای نیست." }
      if (player.houseKey === house.key) return { error: "همین خانه را داری." }
      if (player.money < house.price) return { error: `${house.price} سکه لازم داری. صاحبخانه محترمانه خندید.` }
      await db.$transaction(async (tx) => {
        let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
        await applyMoney(tx, p, -house.price, "house", `خرید ${house.name}`)
        p = await tx.player.update({
          where: { id: p.id },
          data: { houseKey: house.key, houseRentDue: new Date(Date.now() + 24 * 3600000), xp: p.xp + 25 },
        })
        await history(tx, player.id, house.emoji, `به ${house.name} اسبی کشیدی`, "house", p.day)
      })
      return {
        ok: { message: `${house.emoji} حالا خانه‌ات ${house.name} است.`, flavor: house.description, deltas: [delta("money", -house.price)] },
      }
    }

    // ─────────────────────────── شغل ───────────────────────────
    case "setJob": {
      const jobKey = str("jobKey")
      if (!jobKey) return { error: "کدوم شغل؟" }
      const job = getJob(jobKey)
      if (!job) return { error: "چنین شغلی در این شهر نیست." }
      if (player.level < job.minLevel) return { error: `برای این کار سطح ${job.minLevel} لازم است. شهر هنوز به تو اعتماد نکرده.` }
      if (player.jobKey === job.key) return { error: "همین کار را داری." }
      await db.$transaction(async (tx) => {
        await tx.player.update({ where: { id: player.id }, data: { jobKey: job.key, workStreak: 0 } })
        await history(tx, player.id, job.emoji, `شغل تازه: ${job.name}`, "job", player.day)
      })
      return { ok: { message: `${job.emoji} از امروز ${job.name} هستی.`, flavor: job.quirks, deltas: [] } }
    }

    case "quitJob": {
      if (!player.jobKey) return { error: "کاری نداری که ول کنی." }
      const job = getJob(player.jobKey)
      await db.$transaction(async (tx) => {
        await tx.player.update({ where: { id: player.id }, data: { jobKey: null, workStreak: 0 } })
        if (job) await history(tx, player.id, "📄", `${job.name} را ول کردی`, "job", player.day)
      })
      return { ok: { message: job ? `${job.name} را ول کردی. آزادی حس خوبی است؛ به غذا خوردن ربطی ندارد.` : "بی‌کار شدی.", deltas: [] } }
    }

    // ─────────────────────────── عنوان ───────────────────────────
    case "setTitle": {
      const titleKey = str("titleKey")
      if (!titleKey) return { error: "کدوم عنوان؟" }
      const owned = await db.playerTitle.findFirst({ where: { playerId: player.id, titleKey } })
      if (!owned) return { error: "این عنوان را نگیری. هنوز." }
      await db.$transaction(async (tx) => {
        await tx.playerTitle.updateMany({ where: { playerId: player.id }, data: { active: false } })
        await tx.playerTitle.update({ where: { id: owned.id }, data: { active: true } })
      })
      const t = TITLE_MAP[titleKey]
      return { ok: { message: t ? `عنوانت شد: ${t.emoji} ${t.name}` : "عنوان عوض شد.", deltas: [] } }
    }

    // ─────────────────────────── نوتیفیکیشن ───────────────────────────
    case "readNotifications": {
      await db.notification.updateMany({ where: { playerId: player.id, read: false }, data: { read: true } })
      return { ok: { message: "همه را خواندی. بعضی‌ها را بهتر بود نمی‌خواندی.", deltas: [] } }
    }

    // ─────────────────────────── قمار (بینگوی مخرب) ───────────────────────────
    case "gamble": {
      const stake = clamp(num("stake") ?? 0, 50, Math.min(5000, Math.floor(player.money * 0.3)))
      if (player.money < stake) return { error: "این‌قدر سکه نداری. قانونش جدی است." }
      const lastGamble = flags.counters?.gambleAt ?? 0
      if (Date.now() - lastGamble < 30 * 60000) {
        const wait = Math.ceil((30 * 60000 - (Date.now() - lastGamble)) / 60000)
        return { error: `بینگوی مخرب هر نیم ساعت یه بار. ${wait} دقیقه صبر کن.` }
      }
      const rng = mulberry32(seedFrom("gamble", player.id, Date.now()))
      const winChance = 0.42 + (player.luck - 10) / 200
      const win = chance(winChance, rng)
      const deltas: DeltaLineDTO[] = []
      const flavor = win
        ? "دانه‌ها چیدند. کسی پشت سرت زمزمه کرد: «اون وارد شده.»"
        : "دانه‌ها ریختند. کسی پشت سرت خندید. زمزمه کرد: «این فقط تمرینه.»"
      try {
        await db.$transaction(async (tx) => {
          let p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
          // کول‌داون داخل تراکنش دوباره چک می‌شود — دو دستِ هم‌زمان فقط یکی حساب می‌شود
          const f = parseFlags(p)
          const lastAt = f.counters?.gambleAt ?? 0
          if (Date.now() - lastAt < 30 * 60000) throw new Error("COOLDOWN")
          if (p.money < stake) throw new Error("NO_MONEY")
          const amount = win ? Math.round(stake * 1.8) : -stake
          await applyMoney(tx, p, amount, "gamble", win ? "برد" : "باخت")
          p = await tx.player.update({
            where: { id: p.id },
            data: {
              chaos: clamp(p.chaos + (win ? 2 : 4), 0, 100),
              xp: p.xp + 5,
            },
          })
          f.counters = { ...(f.counters ?? {}), gambleAt: Date.now() }
          await tx.player.update({ where: { id: p.id }, data: { flags: JSON.stringify(f) } })
          await history(tx, player.id, "🎲", win ? `بینگو: +${Math.round(stake * 1.8)} سکه` : `بینگو: -${stake} سکه`, "money", p.day)
        })
      } catch (e) {
        if (e instanceof Error && e.message === "COOLDOWN") return { error: "بینگوی مخرب هر نیم ساعت یه بار. دستِ اول حساب شد." }
        if (e instanceof Error && e.message === "NO_MONEY") return { error: "این‌قدر سکه نداری. قانونش جدی است." }
        throw e
      }
      deltas.push(delta("money", win ? Math.round(stake * 1.8) : -stake))
      return {
        ok: {
          message: win ? `بردی! ${Math.round(stake * 1.8)} سکه مالِ تو شد.` : `باختی. ${stake} سکه رفت. شهر نگه داشت.`,
          flavor,
          deltas,
        },
      }
    }

    // ─────────────────────────── هویت (Mini App intro) ───────────────────────────
    case "setIdentity": {
      const name = str("name")
      const avatar = str("avatar")
      if (!name) return { error: "اسم را نگو که چه نامت بگذارم... اسم را بده." }
      const cleanName = name.trim().slice(0, 24)
      if (cleanName.length < 2) return { error: "اسم باید بین 2 تا 24 حرف باشد. شهر با اسم‌های یک‌حرفی کاری ندارد." }
      const cleanAvatar = (avatar ?? "").trim().slice(0, 8)
      const finalAvatar = cleanAvatar.length >= 1 ? cleanAvatar : player.avatar
      await db.$transaction(async (tx) => {
        await tx.player.update({ where: { id: player.id }, data: { name: cleanName, avatar: finalAvatar } })
        await history(tx, player.id, "🎭", "اسمش را عوض کرد. شهر شبیهِ همانِ قبلی نبود.", "world", player.day)
      })
      return {
        ok: {
          message: `از این پس اسمت «${cleanName}» است.`,
          flavor: "اسم‌ها مثلِ کلیدند؛ بعضی درها فقط با اسمِ تازه باز می‌شوند.",
          deltas: [],
        },
      }
    }

    // ─────────────────────────── فرصت‌ها (V4) ───────────────────────────
    case "claimOpportunity": {
      const opportunityId = str("opportunityId")
      if (!opportunityId) return { error: "کدوم فرصت؟" }
      const result = await claimOpportunity(player, opportunityId)
      if (result.error || !result.ok) return { error: result.error ?? "این فرصت دستِ تو نیست." }
      return {
        ok: {
          message: result.ok.message,
          flavor: result.ok.flavor,
          deltas: result.ok.deltas,
          extra: result.ok.extra,
        },
      }
    }

    default:
      return { error: "چنین کاری در این جهان تعریف نشده." }
  }
}

export type { ActionResponse }
