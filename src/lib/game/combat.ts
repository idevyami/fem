// FEMBOY WAR — V7: موتورِ نبرد (server-authoritative combat)
// نبردِ روند-محور: هر اکشن/کال‌بک یک راند را «داخلِ تراکنش» با فلگِ شرطیِ
// راند حل می‌کند — کال‌بکِ تکراری/هم‌زمان فقط یک‌بار جواب می‌گیرد.
// دوئلِ PvP: شبیه‌سازیِ کاملِ سرور-طرف + روایت؛ بدونِ دخالتِ کلاینت.

import { db } from "@/lib/db"
import type { Player, SoulCharacter, CombatEncounter } from "@prisma/client"
import { masteryLevelOf,  getClass, spiritCondition, type ClassDef } from "./content/classes"
import { type EnemyDef } from "./content/enemies"
import { getEnemy, availableEnemies } from "./content/enemies"
import {
  deriveStats,
  effectivePassiveParams,
  skillRanks,
  syncCharacter,
  awardXpTx,
  awardMasteryTx,
  masteryRewardBonus,
  resolveEvolution,
  evolutionPathOf,
  addCharLog,
  SOUL,
  soulCardDTO,
  grantPlayerAchievementTx,
  grantPlayerTitleTx,
} from "./character"
import { faDigits } from "./helpers"
import { applyMoney } from "./economy"
import { clamp, mulberry32, seedFrom, randInt, chance } from "./rng"
import type { CombatStateDTO } from "./contract"

// ─── حالتِ درونیِ نبرد ────────────────────────────────────────────────────────

interface CombatState {
  hp: number
  hpMax: number
  foeHp: number
  foeHpMax: number
  // منابعِ کلاسی
  marks: number // شینوبی — نشانِ سایه
  focus: number // رنجر — تمرکز
  tempo: number // دوئل‌کار — تمپو
  resolve: boolean // پالادین — همّت آماده
  wolfCount: number // احضارکننده — شمارِ راندها (هر دومین راند گرگ)
  wolfPend: number // احضارکننده — گرگِ معلقِ راندِ بعد (% قدرت)
  burstUsed: boolean // جادوگر — انفجار یک‌بار
  bees: number // ملکه‌ی نئون — زنبورهای انباشته
  // وضعیتِ اکشن
  cd: number // راندهای مانده تا مهارتِ فعال
  guard: boolean // این راند گارد کرده (اکشنِ فعلی)
  foeAccDebuff: number // راندهای گیجیِ حریف
  myAccDebuff: number // راندهای دقتِ کمِ ما (ساحرِ پل)
  hasGuardedOnce: boolean // گاوِ نر — تا گارد نکنی بیشتر می‌خوری
  purseStolen: number // حواله‌دار — درصدِ وصول‌شده از پاداش
  burstMoney: boolean // جادوگر — جایزه‌ی انفجار
  critsThisFight: number
  usedSkill: boolean // V10 — مهارتِ امضا در این نبرد اجرا شد (برای کلاس-تسلط)
  log: string[] // همه‌ی خطوط
}

function freshState(hp: number, foeHp: number): CombatState {
  return {
    hp, hpMax: hp, foeHp, foeHpMax: foeHp,
    marks: 0, focus: 0, tempo: 0, resolve: false, wolfCount: 0, wolfPend: 0, burstUsed: false, bees: 0,
    cd: 0, guard: false, foeAccDebuff: 0, myAccDebuff: 0, hasGuardedOnce: false, purseStolen: 0, burstMoney: false, critsThisFight: 0, usedSkill: false,
    log: [],
  }
}

function parseState(enc: CombatEncounter): CombatState {
  try {
    const s = JSON.parse(enc.stateJson) as Partial<CombatState>
    return { ...freshState(s.hp ?? 1, s.foeHp ?? 1), ...s, log: Array.isArray(s.log) ? s.log : [] }
  } catch {
    return freshState(1, 1)
  }
}

// ─── DTO ──────────────────────────────────────────────────────────────────────

export function combatStateDTO(enc: CombatEncounter, char: SoulCharacter, extraLog: string[] = []): CombatStateDTO {
  const st = parseState(enc)
  const cls = getClass(char.classKey)
  const enemy = enc.kind === "pve" && enc.enemyKey ? getEnemy(enc.enemyKey) : null
  let result: CombatStateDTO["result"] = null
  if (enc.status !== "active" && enc.resultJson) {
    try {
      result = JSON.parse(enc.resultJson)
    } catch {
      result = null
    }
  }
  const expires = enc.expiresAt && enc.status === "active" ? Math.max(0, Math.round((enc.expiresAt.getTime() - Date.now()) / 1000)) : null
  return {
    id: enc.id,
    kind: enc.kind === "duel" ? "duel" : "pve",
    status: enc.status as CombatStateDTO["status"],
    round: enc.round,
    enemy: enemy
      ? { key: enemy.key, emoji: enemy.emoji, name: enemy.name, hp: Math.max(0, Math.round(st.foeHp)), hpMax: st.foeHpMax, special: enemy.special ?? null, flavor: enemy.flavor }
      : null,
    you: { name: char.name, emoji: cls?.emoji ?? "🎀", hp: Math.max(0, Math.round(st.hp)), hpMax: st.hpMax },
    foe: null,
    log: [...st.log, ...extraLog].slice(-14),
    cooldown: st.cd,
    expiresInSeconds: expires,
    result,
  }
}

/** نبردِ فعالِ بازیکن (با جاروبِ نبردِ رهاشده) */
export async function getActiveEncounter(player: Player): Promise<CombatEncounter | null> {
  await sweepExpired(player.id)
  return db.combatEncounter.findFirst({
    where: { playerId: player.id, status: "active" },
    orderBy: { createdAt: "desc" },
  })
}

export async function sweepExpired(playerId?: string) {
  await db.combatEncounter.updateMany({
    where: {
      status: "active",
      expiresAt: { lt: new Date() },
      ...(playerId ? { playerId } : {}),
    },
    data: { status: "fled", resolvedAt: new Date(), resultJson: JSON.stringify({ outcome: "fled", money: 0, xp: [], spiritDelta: -3, lines: ["شهر منتظر نماند — نبرد رها شد و فمبویت با خجالت برگشت."] }) },
  })
}

// ─── ریاضیاتِ نبرد ────────────────────────────────────────────────────────────

interface Sheet {
  name: string
  emoji: string
  atk: number
  def: number
  crit: number
  critDmg: number
  dodge: number
  acc: number
  speed: number
  hp: number
  hpMax: number
  spiritMod: number
  passive: Record<string, number>
  clsKey: string
}

function charSheet(char: SoulCharacter): Sheet {
  const cls = getClass(char.classKey)
  if (!cls) throw new Error("کلاسِ ناشناخته")
  const st = deriveStats(char)
  const cond = spiritCondition(char.spirit)
  return {
    name: char.name,
    emoji: cls.emoji,
    atk: st.atk,
    def: st.def,
    crit: st.crit,
    critDmg: st.critDmg,
    dodge: st.dodge,
    acc: st.acc,
    speed: st.speed,
    hp: st.hp,
    hpMax: st.hp,
    spiritMod: cond.dmgMod,
    passive: effectivePassiveParams(cls, skillRanks(char), resolveEvolution(cls, char.evolution, evolutionPathOf(char))) as unknown as Record<string, number>,
    clsKey: cls.key,
  }
}

function enemySheet(e: EnemyDef, rng: () => number): Sheet {
  // دشمن کمی تنوع دارد (±7%) تا هر نبردِ تکراری یکسان نباشد
  const v = () => 0.93 + rng() * 0.14
  return {
    name: e.name,
    emoji: e.emoji,
    atk: e.atk * v(),
    def: e.def * v(),
    crit: e.crit,
    critDmg: 160,
    dodge: e.dodge,
    acc: e.acc,
    speed: e.speed,
    hp: Math.round(e.hp * v()),
    hpMax: Math.round(e.hp * v()),
    spiritMod: 0,
    passive: {},
    clsKey: e.key,
  }
}

interface StrikeOpts {
  power?: number // ضریبِ 100%
  guaranteedCrit?: boolean
  ignoreDefPct?: number // درصدِ نادیده‌گرفتنِ دفاع
  accBonus?: number
  pierceGuardPct?: number // درصدِ عبور از گارد (اژدها/آشپز)
  tag?: string
}

interface StrikeResult {
  hit: boolean
  crit: boolean
  dmg: number
  line: string
}

/** یک ضربه‌ی مهاجم به مدافع — خطِ روایت برمی‌گرداند */
function strike(attacker: Sheet, defender: Sheet, defending: boolean, rng: () => number, opts: StrikeOpts = {}): StrikeResult {
  const power = (opts.power ?? 100) / 100
  const accBonus = opts.accBonus ?? 0
  const hitChance = clamp(85 + (attacker.acc - 85) - defender.dodge + accBonus, 40, 98)
  if (!chance(hitChance / 100, rng)) {
    return { hit: false, crit: false, dmg: 0, line: `${attacker.emoji} ${attacker.name} خطا زد — ${defender.name} جا خالی داد.` }
  }
  const isCrit = opts.guaranteedCrit || chance(attacker.crit / 100, rng)
  let raw = attacker.atk * power * (0.9 + rng() * 0.2)
  raw *= 1 + attacker.spiritMod
  if (isCrit) raw *= attacker.critDmg / 100
  // دفاعِ مؤثر
  const effDef = defender.def * (1 - (opts.ignoreDefPct ?? 0) / 100)
  let dmg = raw - effDef * 0.55
  if (defending) {
    const pierce = (opts.pierceGuardPct ?? 0) / 100
    dmg = dmg * (0.5 + 0.5 * pierce)
  }
  dmg = Math.max(1, Math.round(dmg))
  const critTxt = isCrit ? " 💥بحرانی!" : ""
  return { hit: true, crit: isCrit, dmg, line: `${attacker.emoji} ${attacker.name} زد — ${faDigits(dmg)} آسیب${critTxt}` }
}

// ─── شروعِ PvE ────────────────────────────────────────────────────────────────

export async function startPve(player: Player, enemyKey: string): Promise<{ enc?: CombatEncounter; char?: SoulCharacter; error?: string }> {
  const char = await getForCombat(player)
  if (!char) return { error: "فمبوی اختصاصی تو هنوز آماده‌ی نبرده. اول پیمانِ فمبوی را ببند." }
  const enemy = getEnemy(enemyKey)
  if (!enemy) return { error: "چنین هیولایی در این شهر قدم نمی‌زند." }
  if (char.level < enemy.minLevel) return { error: `برای این نبرد سطح ${faDigits(enemy.minLevel)} لازم است.` }
  const cond = spiritCondition(char.spirit)
  if (!cond.canFight) return { error: "روحیه‌ی فمبویت تهی است — اول آرامشش کن یا شربت بده." }
  const existing = await getActiveEncounter(player)
  if (existing) return { error: "فمبویت وسطِ نبردِ دیگری است — اول همان را تمام کن." }

  const rng = mulberry32(seedFrom("pve-start", char.id, Date.now()))
  const foe = enemySheet(enemy, rng)
  const me = charSheet(char)
  const st = freshState(me.hp, foe.hp)
  st.log.push(`⚔️ نبرد آغاز شد: ${me.emoji} ${char.name} در برابر ${enemy.emoji} ${enemy.name}`)
  st.log.push(enemy.flavor)
  if (enemy.key === "night_bull") st.log.push("🐂 تا گارد نکنی، هر ضربه 25% سخت‌تر می‌نشیند!")

  return db.$transaction(async (tx) => {
    // کسرِ استقامت داخلِ تراکنش با دوباره‌چک
    const fresh = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
    if (fresh.stamina < SOUL.PVE_COST) return { error: `استقامتِ کافی نداری (${faDigits(SOUL.PVE_COST)} لازم است). صبر کن یا شارژ کن.` }
    const anyActive = await tx.combatEncounter.findFirst({ where: { playerId: player.id, status: "active" } })
    if (anyActive) return { error: "فمبویت وسطِ نبردِ دیگری است." }
    await tx.soulCharacter.update({ where: { id: fresh.id }, data: { stamina: fresh.stamina - SOUL.PVE_COST, staminaAt: new Date() } })
    const enc = await tx.combatEncounter.create({
      data: {
        playerId: player.id,
        kind: "pve",
        enemyKey: enemy.key,
        stateJson: JSON.stringify(st),
        expiresAt: new Date(Date.now() + SOUL.ENCOUNTER_TTL_MIN * 60000),
      },
    })
    return { enc, char: fresh }
  })
}

async function getForCombat(player: Player): Promise<SoulCharacter | null> {
  const char = await db.soulCharacter.findUnique({ where: { playerId: player.id } })
  if (!char) return null
  return syncCharacter(char)
}

// ─── اکشنِ راند ───────────────────────────────────────────────────────────────

export type CombatAct = "strike" | "skill" | "guard" | "flee"

export async function actOnEncounter(player: Player, encounterId: string, act: CombatAct): Promise<{ enc?: CombatEncounter; char?: SoulCharacter; error?: string }> {
  const enc = await db.combatEncounter.findUnique({ where: { id: encounterId } })
  if (!enc || enc.playerId !== player.id) return { error: "چنین نبردی برای تو باز نیست." }
  if (enc.status !== "active") return { error: "این نبرد تمام شده — شهر ادامه داده." }
  if (enc.expiresAt && enc.expiresAt.getTime() < Date.now()) {
    await sweepExpired(player.id)
    return { error: "از زمانش گذشته — نبرد رها شد." }
  }
  const char = await db.soulCharacter.findUnique({ where: { playerId: player.id } })
  if (!char) return { error: "فمبویت گم شده؟!" }
  if (!["strike", "skill", "guard", "flee"].includes(act)) return { error: "چنین حرکتی بلد نیست." }

  const cls = getClass(char.classKey)
  const enemy = enc.enemyKey ? getEnemy(enc.enemyKey) : null
  if (!cls || !enemy) return { error: "نبردِ خراب — قابل ادامه نیست." }

  const st = parseState(enc)
  if (act === "skill" && st.cd > 0) return { error: `مهارتِ امضا هنوز نفس نمی‌آورد — ${faDigits(st.cd)} راند دیگر.` }
  const me = charSheet(char)
  me.hp = st.hp
  const foe = enemySheet(enemy, mulberry32(seedFrom("foe", enc.id)))
  foe.hp = st.foeHp
  const rng = mulberry32(seedFrom("act", enc.id, enc.round))
  const round = enc.round
  const lines: string[] = [`— راند ${faDigits(round)} —`]
  let outcome: "won" | "lost" | "fled" | null = null

  // منابعِ ورودی از state
  me.passive = { ...me.passive }

  const playerFirst = me.speed >= foe.speed

  const doPlayerAction = () => {
    st.guard = false
    if (act === "guard") {
      st.guard = true
      st.hasGuardedOnce = true
      st.tempo = 0 // گارد ریتم را می‌شکند
      lines.push(`🛡️ ${char.name} گارد گرفت و نفس رد کرد.`)
      // پالادین: گاردِ همراه با مهارتِ فعال درمان دارد — اینجا گاردِ ساده
      return
    }
    if (act === "flee") {
      outcome = "fled"
      lines.push(`🏃 ${char.name} راه را کج کرد و رفت — ${pick(enemy.taunts)}`)
      return
    }
    // ضربه‌ی عادی یا مهارتِ فعال
    let opts: StrikeOpts = {}
    let label = "ضربه"
    let isSkill = false
    if (act === "skill") {
      // cd قبلاً ولید شده (st.cd === 0)
      const a = cls.activeSkill
      isSkill = true
      label = a.name
      st.cd = a.cooldown
      st.usedSkill = true // V10 — اجرای مهارتِ امضا: کارِ واجدشرطِ کلاس
      switch (cls.key) {
        case "shinobi":
          opts = { power: a.power, guaranteedCrit: true }
          break
        case "ranger":
          opts = { power: a.power, ignoreDefPct: 50, accBonus: 30 }
          break
        case "wizard":
          opts = { power: a.power }
          break
        case "trickster":
          opts = { power: a.power } // ضریب در پایین رول می‌شود
          break
        case "paladin": {
          // سپرِ عهد: گاردِ کامل + درمان
          st.guard = true
          st.hasGuardedOnce = true
          const heal = Math.round(st.hpMax * 0.08)
          st.hp = Math.min(st.hpMax, st.hp + heal)
          lines.push(`✝️ ${a.name}: ${char.name} پشتِ سپر ایستاد و ${faDigits(heal)} خون برگرداند.`)
          return
        }
        case "duelist":
          // دو ضربه — این‌جا اولی، دومی بعد
          break
        case "summoner":
          opts = { power: a.power }
          st.wolfPend = 70
          break
        case "reaper":
          opts = { power: a.power }
          break
      }
    }

    const strikes = cls.key === "duelist" && isSkill ? 2 : 1
    for (let i = 0; i < strikes; i++) {
      if (outcome) return
      let power = opts.power ?? 100
      // شیاد: کارتِ سلطنتی — رولِ 0.5/1/2
      if (cls.key === "trickster" && isSkill) {
        const roll = rng()
        const mult = roll < 0.35 ? 0.7 : roll < 0.85 ? 1.1 : 2.2
        power *= mult
        lines.push(mult === 2.2 ? "🃏 کارتِ برگردانِ سلطنتی — حریف باخ! (×2.2)" : mult === 0.7 ? "🃏 کارتِ خورد — نصفه‌په (×0.7)" : "🃏 کارتِ ساده (×1.1)")
        if (mult === 2.2) st.foeAccDebuff = 2
      }
      // ضریب‌های کلاسی
      const marksBonus = cls.key === "shinobi" ? st.marks * (me.passive.shadowMarkDmg ?? 12) : 0
      const focusBonus = cls.key === "ranger" ? st.focus * (me.passive.focusDmg ?? 8) : 0
      const tempoBonus = cls.key === "duelist" ? st.tempo * (me.passive.tempoDmg ?? 10) : 0
      const crimson = cls.key === "reaper"
      const crimsonBonus = crimson && st.hp > st.hpMax * 0.5 ? (me.passive.crimsonDmg ?? 18) : 0
      const totalPct = 100 + marksBonus + focusBonus + tempoBonus + crimsonBonus
      const r = strike(me, foe, false, rng, { ...opts, power: (power * totalPct) / 100 })
      if (isSkill) lines.push(`${cls.activeSkill.icon} ${label}!`)
      lines.push(r.line)
      if (r.hit) {
        if (r.crit) st.critsThisFight++
        // مصرفِ منابع
        if (marksBonus > 0 && st.marks > 0) {
          lines.push(`🌑 ${faDigits(st.marks)} نشانِ سایه در ضربه محو شد (+${faDigits(marksBonus)}%).`)
          st.marks = 0
        }
        if (cls.key === "ranger") st.focus = Math.min(3, st.focus + 1)
        if (cls.key === "duelist") st.tempo = Math.min(3, st.tempo + 1)
        // جادوگر: انفجارِ کهکشانی روی بحرانی — یک‌بار
        if (cls.key === "wizard" && r.crit && !st.burstUsed && chance((me.passive.burstChance ?? 35) / 100, rng)) {
          st.burstUsed = true
          st.critsThisFight++
          st.burstMoney = true
          const burstDmg = Math.max(1, Math.round(r.dmg * ((me.passive.burstBonus ?? 25) / 100)))
          st.foeHp = Math.max(0, st.foeHp - burstDmg)
          lines.push(`✨ انفجارِ کهکشانی! +${faDigits(burstDmg)} آسیبِ اسرار — سکه‌ای هم در تابش پیدا شد.`)
        }
        st.foeHp = Math.max(0, st.foeHp - r.dmg)
        // دروگر: خونِ هر ضربه
        if (crimson) {
          const cost = Math.max(1, Math.round((st.hp * (me.passive.crimsonCost ?? 3)) / 100))
          if (st.hp > cost) st.hp -= cost
        }
        // جادوگرِ مهارت: عذرخواهیِ خون
        if (cls.key === "wizard" && isSkill && cls.activeSkill.selfCost) {
          const cost = Math.max(1, Math.round((st.hp * cls.activeSkill.selfCost) / 100))
          if (st.hp > cost) st.hp -= cost
          lines.push(`🌙 فشارِ اسرار ${faDigits(cost)} خون گرفت.`)
        }
        if (cls.key === "reaper" && isSkill && cls.activeSkill.selfCost) {
          const cost = Math.max(1, Math.round((st.hp * cls.activeSkill.selfCost) / 100))
          if (st.hp > cost) st.hp -= cost
          lines.push(`🩸 بهایِ دَرَو: ${faDigits(cost)} خون.`)
        }
      } else {
        if (cls.key === "ranger") st.focus = 0
        if (cls.key === "duelist") st.tempo = 0
      }
    }
    // احضارکننده: گرگِ معلق
    if (st.wolfPend > 0 && st.foeHp > 0) {
      const w = strike({ ...me, atk: me.atk * (st.wolfPend / 100), crit: me.crit, name: "گرگِ روح", emoji: "🐺" }, foe, false, rng, {})
      lines.push(w.line)
      if (w.hit) st.foeHp = Math.max(0, st.foeHp - w.dmg)
      st.wolfPend = 0
    }
  }

  const doFoeAction = () => {
    if (outcome) return
    if (st.foeHp <= 0) return
    // فریبِ سلطنتی — قبل از حرکتِ حریف
    if (cls.key === "trickster" && chance((me.passive.deceptionChance ?? 18) / 100, rng)) {
      const rip = strike({ ...me, atk: me.atk * 0.75, name: `تلمبه‌ی ${char.name}`, emoji: "🃏" }, foe, false, rng, {})
      lines.push(`🎭 ${foe.name} مهره‌اش را پایین انداخت — حرکتش فروپاشید!`)
      lines.push(rip.line)
      if (rip.hit) st.foeHp = Math.max(0, st.foeHp - rip.dmg)
      return
    }
    let power = 100
    let pierceGuard = 0
    // مکانیک‌های ویژه‌ی دشمن
    switch (enemy.key) {
      case "chain_cat":
        if (round % 3 === 0) power = 190 // دو ضربه ≈ 95% هرکدام
        break
      case "ribbon_smuggler":
        if (round % 3 === 0) power = 150
        break
      case "angry_chef":
        pierceGuard = 25
        break
      case "bridge_hexer":
        if (round % 4 === 0) {
          st.myAccDebuff = 2
          lines.push("🌀 طلسمِ نیمه‌کاره گرفت — چشم‌هایت مو را شمارَد (دقت −15).")
        }
        break
      case "subway_warden":
        if (st.foeHp < st.foeHpMax * 0.3) power = 130
        break
      case "cinema_ghost":
        if (round % 5 === 0) power = 160
        break
      case "night_bull":
        if (!st.hasGuardedOnce) power = 125
        break
      case "hawala_enforcer":
        // وصولِ قسط: 5% از کیفِ نبرد (سقفِ موجودیِ پاداشِ نهایی)
        st.purseStolen += 5
        break
      case "fallen_diamond":
        if (round % 3 === 0) power = 150
        break
      case "vault_dragon":
        pierceGuard = 50
        break
      case "neon_queen":
        // زنبورها روی بحراییِ موفق جمع می‌شوند
        break
    }
    const accPenalty = st.foeAccDebuff > 0 ? 20 : 0
    if (st.foeAccDebuff > 0) st.foeAccDebuff--
    const r = strike({ ...foe, acc: foe.acc - accPenalty }, me, st.guard, rng, { power, pierceGuardPct: pierceGuard })
    if (round % 3 === 0 && enemy.key === "chain_cat" && r.hit) {
      // خطِ دومِ گربه — همان ضربه دو خط شد؛ فقط روایت
      lines.push(`🐈‍⬛ ${foe.name} خشمی گرفت و دوباره زد!`)
    }
    lines.push(r.line)
    if (r.hit) {
      let dmg = r.dmg
      // گاوِ نر: تا گارد نکنی +25% — در power اعمال شد؛ این‌جا فقط پالادین
      // پالادین: عهدِ تایتان — زیرِ 40% خون، ضربه‌ی خوردن = همّت
      if (cls.key === "paladin" && st.hp < st.hpMax * 0.4 && !st.resolve) {
        st.resolve = true
        lines.push("🛡️ عهدِ تایتان بیدار شد — همّت آماده است.")
      }
      if (cls.key === "paladin" && st.resolve) {
        dmg = Math.round(dmg * (1 - (me.passive.resolveMitg ?? 30) / 100))
        const heal = Math.round(st.hpMax * 0.06)
        st.hp = Math.min(st.hpMax, st.hp + heal)
        st.resolve = false
        lines.push(`⚜️ با همّتِ عهد، ${faDigits(dmg)} نرم نشست و ${faDigits(heal)} خون برگشت.`)
      }
      // زنبورهای نئون
      if (enemy.key === "neon_queen" && r.crit && st.bees < 5) {
        st.bees++
        lines.push(`🐝 یک زنبورِ نئون اضافه شد (${faDigits(st.bees)}/5) — هرکدام 15% آسیبِ بیشتر.`)
      }
      if (st.bees > 0) {
        const extra = Math.round(dmg * 0.15 * st.bees)
        if (extra > 0) {
          dmg += extra
          lines.push(`🐝 دسته‌ی زنبورها +${faDigits(extra)}.`)
        }
      }
      st.hp = Math.max(0, st.hp - dmg)
      // گریزِ موفق → نشانِ سایه (شینوبی) / ضربه‌خوردن → ریتم صفر
      if (cls.key === "shinobi" && st.marks < 3) {
        st.marks++
        lines.push(`🌑 سایه‌ها فشرده شدند — نشانِ ${faDigits(st.marks)}/3.`)
      }
      if (cls.key === "duelist") st.tempo = 0
      if (cls.key === "ranger") st.focus = 0
    } else {
      // خطا زدنِ حریف = گریزِ ما → نشانِ سایه
      if (cls.key === "shinobi" && st.marks < 3) {
        st.marks++
        lines.push(`🌑 ${char.name} جا خالی داد — سایه‌ها فشرده شدند (${faDigits(st.marks)}/3).`)
      }
    }
  }

  // ترتیبِ عمل بر اساسِ سرعت
  if (playerFirst) {
    doPlayerAction()
    doFoeAction()
  } else {
    doFoeAction()
    if (!outcome && st.hp > 0) doPlayerAction()
  }

  // احضارکننده: شمارِ راندها + گرگِ پیمانیِ هر دومین راند (بعد از اکشن‌ها)
  if (cls.key === "summoner" && !outcome && st.foeHp > 0) {
    st.wolfCount++
    if (st.wolfCount % 2 === 0) {
      const w = strike({ ...me, atk: me.atk * ((me.passive.wolfPower ?? 45) / 100), name: "گرگِ روح", emoji: "🐺" }, foe, false, rng, {})
      lines.push(w.line)
      if (w.hit) st.foeHp = Math.max(0, st.foeHp - w.dmg)
    }
  }

  // دقتِ ما — کاهشِ ساحرِ پل
  if (st.myAccDebuff > 0) st.myAccDebuff--
  if (st.cd > 0) st.cd--
  st.guard = false // گارد فقط برای همان راند

  // پایان؟
  if (!outcome) {
    if (st.foeHp <= 0) outcome = "won"
    else if (st.hp <= 0) outcome = "lost"
  }

  st.log = [...st.log, ...lines].slice(-60)

  // ─── تعیینِ نتیجه و پاداش‌ها — یک‌بار، اتمیک ───
  return db.$transaction(async (tx) => {
    // ادعای اتمیکِ راند: فقط اگر راند هنوز همان است
    const claim = await tx.combatEncounter.updateMany({
      where: { id: enc.id, round: enc.round, status: "active" },
      data: {
        round: enc.round + 1,
        stateJson: JSON.stringify(st),
        ...(outcome ? { status: outcome, resolvedAt: new Date() } : {}),
      },
    })
    if (claim.count === 0) return { error: "این راند دیگر مالِ گذشته است." }

    let freshChar = char
    let resultPayload: CombatStateDTO["result"] = null
    if (outcome === "won" || outcome === "lost" || outcome === "fled") {
      const xpList: NonNullable<CombatStateDTO["result"]>["xp"] = []
      let money = 0
      let spiritDelta = 0
      const rlines: string[] = []
      if (outcome === "won") {
        const lootMult = 1 + deriveStats(char).loot / 100
        let base = randInt(enemy.money[0], enemy.money[1], rng)
        // جادوگر: جایزه‌ی انفجارِ کهکشانی (یک‌بار)
        if (cls.key === "wizard" && st.burstMoney) {
          base = Math.round(base * (1 + (me.passive.burstBonus ?? 25) / 100))
        }
        // حواله‌دار: 5% به‌ازای هر ضربه‌ی خورده
        if (enemy.key === "hawala_enforcer") {
          const stolenPct = Math.min(40, st.purseStolen)
          base = Math.round(base * (1 - stolenPct / 100))
          if (stolenPct > 0) rlines.push(`🕴️ ${faDigits(stolenPct)}% از کیفِ نبرد وصول شد.`)
        }
        // V10 — پاداشِ جایزه‌ی نبرد از کلاس-تسلط (M7: 3% · M10: 5%)
        const mBonus = masteryRewardBonus(masteryLevelOf(char.masteryXp))
        money = Math.max(10, Math.round(base * lootMult * (1 + mBonus / 100)))
        if (mBonus > 0) rlines.push(`🎓 تسلطِ کلاس ${faDigits(mBonus)}% جایزه را سنگین‌تر کرد.`)
        const p = await tx.player.findUniqueOrThrow({ where: { id: player.id } })
        await applyMoney(tx, p, money, "reward", `نبرد: ${enemy.name}`)
        spiritDelta = 4
        const battleXp = enemy.xp
        xpList.push({ track: "battle", label: "نبرد", icon: "⚔️", amount: battleXp })
        xpList.push({ track: cls.xpBias.primary, label: trackLabel(cls.xpBias.primary), icon: trackIcon(cls.xpBias.primary), amount: Math.round(battleXp * 0.6) })
        rlines.push(`💰 ${faDigits(money)} سکه غنیمت شد.`)
        rlines.push(`⚔️ ${faDigits(battleXp)} XP نبرد + ${faDigits(Math.round(battleXp * 0.6))} XP ${trackLabel(cls.xpBias.primary)}.`)
        // افتِ آیتم (12% + شانس)
        if (chance((12 + deriveStats(char).luck / 4) / 100, rng)) {
          const drops = ["potion", "cake", "ribbon", "blue_flower", "lucky_charm"]
          const dropKey = drops[Math.floor(rng() * drops.length)]
          await tx.inventoryItem.upsert({
            where: { playerId_itemKey: { playerId: player.id, itemKey: dropKey } },
            create: { playerId: player.id, itemKey: dropKey },
            update: { quantity: { increment: 1 } },
          })
          rlines.push(`🎁 چیزی هم افتاد تو کیفش: غنیمتِ میدان.`)
        }
      } else if (outcome === "lost") {
        spiritDelta = -12
        rlines.push(`💔 ${char.name} زمین خورد. شهر ترجیح داد نگاهش نکند. روحیه‌ش −12.`)
      } else {
        spiritDelta = -3
        rlines.push(`🏃 گریز به‌موقع، آبروی نصفه. روحیه‌ش −3.`)
      }
      // به‌روزرسانیِ فمبوی
      const cur = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
      const updated = await tx.soulCharacter.update({
        where: { id: char.id },
        data: {
          spirit: clamp(cur.spirit + spiritDelta, 0, 100),
          wins: outcome === "won" ? cur.wins + 1 : cur.wins,
          losses: outcome === "lost" ? cur.losses + 1 : cur.losses,
          crits: cur.crits + st.critsThisFight,
        },
      })
      const tracks: Record<string, number> = {}
      for (const x of xpList) tracks[x.track] = (tracks[x.track] ?? 0) + x.amount
      let base = updated
      if (Object.keys(tracks).length > 0) {
        const { char: afterXp } = await awardXpTx(tx, updated, { tracks })
        base = afterXp
        for (const l of [afterXp.level - updated.level > 0 ? "⭐ سطح بالا رفت!" : null]) if (l) rlines.push(l)
      }
      // V10 — کلاس-تسلط: برد/باختِ واقعی با این کلاس — بعد از XP تا ردیفِ تازه را ببیند (سقفِ روزانه داخلش)
      let masteryChar = base
      if (st.usedSkill) {
        // اجرای موفقِ مهارتِ امضای کلاس — یک‌بار در هر نبردِ حل‌شده
        const r = await awardMasteryTx(tx, base, "skillUse", 1, `اجرای «${cls.activeSkill.name}» در میدان`)
        masteryChar = r.char
      }
      if (outcome === "won") {
        const r = await awardMasteryTx(tx, masteryChar, "victory", 4, `پیروزی بر «${enemy.name}»`)
        masteryChar = r.char
      } else if (outcome === "lost") {
        const r = await awardMasteryTx(tx, masteryChar, "defeat", 1, `درسِ شکست برابرِ «${enemy.name}»`)
        masteryChar = r.char
      }
      freshChar = masteryChar
      // لاگِ سابقه برای نبردهای مهم
      if (outcome === "won" && enemy.tier >= 3) {
        await addCharLog(tx, char.id, "victory", enemy.emoji, `${char.name} هیولای «${enemy.name}» را شکست داد.`, true)
      }
      if (outcome === "lost" && enemy.tier >= 3) {
        await addCharLog(tx, char.id, "defeat", enemy.emoji, `${char.name} در برابرِ «${enemy.name}» شکست خورد.`, false)
      }
      resultPayload = { outcome, money, xp: xpList, spiritDelta, lines: rlines }
      await tx.combatEncounter.update({
        where: { id: enc.id },
        data: { resultJson: JSON.stringify(resultPayload) },
      })
    }
    const finalEnc = await tx.combatEncounter.findUniqueOrThrow({ where: { id: enc.id } })
    return { enc: finalEnc, char: freshChar }
  })
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function trackLabel(t: string): string {
  const m: Record<string, string> = { battle: "نبرد", arcane: "اسرار", agility: "چابکی", fortune: "شانس", guard: "ایستادگی", trickery: "نیرنگ", spirit: "هم‌نفَس" }
  return m[t] ?? t
}
function trackIcon(t: string): string {
  const m: Record<string, string> = { battle: "⚔️", arcane: "🔮", agility: "⚡", fortune: "🍀", guard: "🛡️", trickery: "🎭", spirit: "🌿" }
  return m[t] ?? "✨"
}


// ─── دوئلِ PvP (حلِ خودکارِ سرور) — V14: امضای کلاس‌ها زنده‌اند ─────────────────
//
// موجِ V14 (مأموریتِ III.2): دوئل دیگر فقط «آمار + مهارتِ فعال» نیست —
// همه‌ی passiveهای کلاس با همان مکانیک و همان اعدادِ PvE (actOnEncounter)
// کار می‌کنند: نشانِ سایه، تمرکزِ شکارچی، انفجارِ کهکشانی (+ سکه‌ی انفجار)،
// فریبِ سلطنتی، عهدِ تایتان، ریتمِ توفان، گرگِ روحِ پیمانی، مومنتومِ سرخ.
// حلِ قطعی باقی می‌ماند: حداکثر 14 راند، تساوی → طرفِ سریع‌تر، پاکتِ نتیجه دست‌نخورده.

export interface DuelResult {
  log: string[]
  winnerName: string
  loserName: string
  winnerIsInitiator: boolean
  rounds: number
  initiatorCard: ReturnType<typeof soulCardDTO>
  foeCard: ReturnType<typeof soulCardDTO>
  /** V14 — 1..3 خطِ برجسته‌ی امضای کلاس (برای کارت/تاریخ) */
  passiveHighlights: string[]
}

/** کارتِ رزمیِ هر طرفِ دوئل — ساختارِ Sheet، برای شبیه‌سازیِ خالص (تست‌پذیر) */
export type DuelSheet = Sheet

/** حالتِ درونیِ هر طرف در شبیه‌سازیِ دوئل — منابعِ کلاسی، همانِ PvE */
interface DuelSideState {
  hp: number
  cd: number
  guard: boolean // این راند گارد گرفته
  marks: number // شینوبی — نشانِ سایه
  focus: number // رنجر — تمرکز
  tempo: number // دوئل‌کار — تمپو
  resolve: boolean // پالادین — همّت
  wolfCount: number // احضارکننده — شمارِ راندها
  wolfPend: number // احضارکننده — گرگِ معلق
  burstUsed: boolean // جادوگر — انفجارِ یک‌بار
  burstMoney: boolean // جادوگر — جایزه‌ی انفجار (سکه)
  accDebuff: number // راندهای گیجی (کارتِ سلطنتی ×2.2)
  crits: number
}

function freshDuelState(hp: number): DuelSideState {
  return { hp, cd: 0, guard: false, marks: 0, focus: 0, tempo: 0, resolve: false, wolfCount: 0, wolfPend: 0, burstUsed: false, burstMoney: false, accDebuff: 0, crits: 0 }
}

export interface DuelSimResult {
  winnerIsA: boolean
  rounds: number
  hpA: number
  hpB: number
  log: string[]
  passiveHighlights: string[]
  /** جادوگر — جایزه‌ی انفجار رویِ پرونده‌ی هر طرف (آینه‌ی PvE: یک‌بار در نبرد) */
  burstMoneyA: boolean
  burstMoneyB: boolean
}

/** شبیه‌سازیِ خالصِ دوئل — قطعی روی rngِ داده‌شده؛ بدونِ دی‌بی (تستِ تعیّن) */
export function simulateDuel(sa: DuelSheet, sb: DuelSheet, rng: () => number): DuelSimResult {
  const log: string[] = [`⚔️ دوئل! ${sa.emoji} ${sa.name} در برابر ${sb.emoji} ${sb.name}`]
  const highlights: string[] = []
  const stA = freshDuelState(sa.hp)
  const stB = freshDuelState(sb.hp)
  let round = 0
  const aFirst = sa.speed >= sb.speed

  /** عواقبِ ضربه‌ی واردشده به مدافع — همانِ PvE (عهد/نشان/ریتم) */
  const applyHit = (dmg: number, defenderIsA: boolean): void => {
    const dfSheet = defenderIsA ? sa : sb
    const df = defenderIsA ? stA : stB
    const dcls = getClass(dfSheet.clsKey)
    let final = dmg
    if (dcls?.key === "paladin" && df.hp < dfSheet.hpMax * 0.4 && !df.resolve) {
      df.resolve = true
      log.push(`🛡️ عهدِ تایتانِ ${dfSheet.name} بیدار شد — همّت آماده است.`)
    }
    if (dcls?.key === "paladin" && df.resolve) {
      const mitg = dfSheet.passive.resolveMitg ?? 30
      final = Math.round(final * (1 - mitg / 100))
      const heal = Math.round(dfSheet.hpMax * 0.06)
      df.hp = Math.min(dfSheet.hpMax, df.hp + heal)
      df.resolve = false
      log.push(`⚜️ با همّتِ عهد، ${faDigits(final)} نرم نشست و ${faDigits(heal)} خون برگشت.`)
      highlights.push(`🛡️ ${dfSheet.name}: عهدِ تایتان ضربه را ${faDigits(mitg)}% نرم کرد.`)
    }
    df.hp = Math.max(0, df.hp - final)
    // ضربه‌خوردن → نشانِ سایه / ریتم و تمرکز صفر (آینه‌ی PvE)
    if (dcls?.key === "shinobi" && df.marks < 3) {
      df.marks++
      log.push(`🌑 سایه‌هایِ ${dfSheet.name} فشرده شدند — نشانِ ${faDigits(df.marks)}/3.`)
    }
    if (dcls?.key === "duelist") df.tempo = 0
    if (dcls?.key === "ranger") df.focus = 0
  }

  /** خطای مهاجم = جاخالیِ مدافع → نشانِ سایه (آینه‌ی PvE) */
  const applyMiss = (defenderIsA: boolean): void => {
    const dfSheet = defenderIsA ? sa : sb
    const df = defenderIsA ? stA : stB
    if (getClass(dfSheet.clsKey)?.key === "shinobi" && df.marks < 3) {
      df.marks++
      log.push(`🌑 ${dfSheet.name} جا خالی داد — سایه‌ها فشرده شدند (${faDigits(df.marks)}/3).`)
    }
  }

  /** فریبِ سلطنتیِ مدافعِ شیاد — قبل از حرکتِ حریف؛ حرکت فرو می‌پاشد (همانِ PvE) */
  const tryDeception = (attackerIsA: boolean): boolean => {
    const defSheet = attackerIsA ? sb : sa
    const def = attackerIsA ? stB : stA
    const atkSheet = attackerIsA ? sa : sb
    const atk = attackerIsA ? stA : stB
    if (getClass(defSheet.clsKey)?.key !== "trickster") return false
    if (atk.hp <= 0 || def.hp <= 0) return false
    if (!chance((defSheet.passive.deceptionChance ?? 18) / 100, rng)) return false
    log.push(`🎭 ${defSheet.name} مهره‌اش را پایین انداخت — حرکتِ ${atkSheet.name} فروپاشید!`)
    const rip = strike({ ...defSheet, atk: defSheet.atk * 0.75, name: `تلمبه‌ی ${defSheet.name}`, emoji: "🃏" }, atkSheet, atk.guard, rng, {})
    log.push(rip.line)
    if (rip.hit) {
      highlights.push(`🎭 ${defSheet.name}: فریبِ سلطنتی — تلمبه ${faDigits(rip.dmg)} آسیب.`)
      applyHit(rip.dmg, attackerIsA)
    } else {
      applyMiss(attackerIsA)
    }
    return true
  }

  /** کنشِ یک طرف — AI ساده (خونِ کم → گارد؛ مهارتِ آماده → امضا) + passiveهای حمله */
  const actSide = (attackerIsA: boolean): void => {
    const me = attackerIsA ? sa : sb
    const my = attackerIsA ? stA : stB
    const foeSheet = attackerIsA ? sb : sa
    const foe = attackerIsA ? stB : stA
    const cls = getClass(me.clsKey)
    my.guard = false
    if (my.hp <= 0 || foe.hp <= 0) return

    const wantGuard = my.hp < me.hpMax * 0.25
    const wantSkill = !wantGuard && my.cd === 0 && cls !== null
    if (wantGuard) {
      my.guard = true
      my.tempo = 0 // گارد ریتم را می‌شکند (PvE)
      log.push(`🛡️ ${me.name} گارد گرفت.`)
      return
    }

    let opts: StrikeOpts = {}
    let power = 100
    let isSkill = false
    if (wantSkill && cls) {
      const k = cls.activeSkill
      isSkill = true
      my.cd = k.cooldown
      log.push(`${k.icon} ${me.name}: ${k.name}!`)
      power = k.power
      switch (cls.key) {
        case "shinobi":
          opts = { power, guaranteedCrit: true }
          break
        case "ranger":
          opts = { power, ignoreDefPct: 50, accBonus: 30 }
          break
        case "trickster":
          opts = { power } // ضریب در حلقه‌ی ضربه رول می‌شود
          break
        case "paladin": {
          // سپرِ عهد — PvE-هم‌ارز: گارد + 8% خونِ کل؛ در PvP با کوبشِ سپر (60%) هم همراه است
          my.guard = true
          my.tempo = 0
          const heal = Math.round(me.hpMax * 0.08)
          my.hp = Math.min(me.hpMax, my.hp + heal)
          log.push(`✝️ ${me.name} پشتِ سپر ایستاد و ${faDigits(heal)} خون برگرداند و با سپر کوبید!`)
          const bash = strike({ ...me, atk: me.atk * 0.6, name: `سپرِ ${me.name}`, emoji: "✝️" }, foeSheet, foe.guard, rng, {})
          log.push(bash.line)
          if (bash.hit) applyHit(bash.dmg, !attackerIsA)
          else applyMiss(!attackerIsA)
          return
        }
        case "summoner":
          opts = { power }
          my.wolfPend = 70
          break
        default:
          opts = { power }
          break
      }
    }

    // گیجیِ کارتِ سلطنتی — یک‌بار در هر کنش (آینه‌ی PvE)
    const accPenalty = my.accDebuff > 0 ? 20 : 0
    if (my.accDebuff > 0) my.accDebuff--

    const strikes = cls?.key === "duelist" && isSkill ? 2 : 1
    for (let i = 0; i < strikes; i++) {
      if (foe.hp <= 0) break
      let p = power
      // شیاد: کارتِ برگردان — رولِ 0.5/1/2 (همانِ PvE)
      if (cls?.key === "trickster" && isSkill) {
        const roll = rng()
        const mult = roll < 0.35 ? 0.7 : roll < 0.85 ? 1.1 : 2.2
        p *= mult
        log.push(mult === 2.2 ? "🃏 کارتِ برگردانِ سلطنتی — حریف باخ! (×2.2)" : mult === 0.7 ? "🃏 کارتِ خورد — نصفه‌په (×0.7)" : "🃏 کارتِ ساده (×1.1)")
        if (mult === 2.2) foe.accDebuff = 2
      }
      // ضریب‌های کلاسی — همانِ PvE با همانِ اعداد
      const marksBonus = cls?.key === "shinobi" ? my.marks * (me.passive.shadowMarkDmg ?? 12) : 0
      const focusBonus = cls?.key === "ranger" ? my.focus * (me.passive.focusDmg ?? 8) : 0
      const tempoBonus = cls?.key === "duelist" ? my.tempo * (me.passive.tempoDmg ?? 10) : 0
      const crimsonBonus = cls?.key === "reaper" && my.hp > me.hpMax * 0.5 ? (me.passive.crimsonDmg ?? 18) : 0
      const totalPct = 100 + marksBonus + focusBonus + tempoBonus + crimsonBonus
      const r = strike({ ...me, acc: me.acc - accPenalty }, foeSheet, foe.guard, rng, { ...opts, power: (p * totalPct) / 100 })
      log.push(r.line)
      if (r.hit) {
        if (r.crit) my.crits++
        // مصرفِ منابع — نشان‌ها در ضربه محو می‌شوند
        if (marksBonus > 0 && my.marks > 0) {
          log.push(`🥷 ${faDigits(my.marks)} نشانِ سایه در ضربه محو شد (+${faDigits(marksBonus)}%).`)
          highlights.push(`🥷 ${me.name}: ${faDigits(my.marks)} نشانِ سایه بلعیده شد (+${faDigits(marksBonus)}% آسیب).`)
          my.marks = 0
        }
        if (cls?.key === "ranger") {
          my.focus = Math.min(3, my.focus + 1)
          if (my.focus === 3) {
            log.push(`🎯 تمرکزِ شکارچی کامل شد (3/3).`)
            highlights.push(`🎯 ${me.name}: تمرکزِ کامل — +${faDigits(3 * (me.passive.focusDmg ?? 8))}% آسیب.`)
          }
        }
        if (cls?.key === "duelist") {
          my.tempo = Math.min(3, my.tempo + 1)
          if (my.tempo === 3) {
            log.push(`⚡ ریتمِ توفان کامل شد (3/3).`)
            highlights.push(`⚡ ${me.name}: تمپوی کامل — +${faDigits(3 * (me.passive.tempoDmg ?? 10))}% آسیب.`)
          }
        }
        // جادوگر: انفجارِ کهکشانی روی بحرانی — یک‌بار در نبرد
        let burstDmg = 0
        if (cls?.key === "wizard" && r.crit && !my.burstUsed && chance((me.passive.burstChance ?? 35) / 100, rng)) {
          my.burstUsed = true
          my.burstMoney = true
          burstDmg = Math.max(1, Math.round(r.dmg * ((me.passive.burstBonus ?? 25) / 100)))
          log.push(`✨ انفجارِ کهکشانی! +${faDigits(burstDmg)} آسیبِ اسرار — سکه‌ای هم در تابش پیدا شد.`)
          highlights.push(`✨ ${me.name}: انفجارِ کهکشانی +${faDigits(burstDmg)} آسیب.`)
        }
        // ضربه‌ی اصلی (و بعدِ آن آسیبِ اضافیِ انفجار — همانِ ترتیبِ PvE)
        applyHit(r.dmg, !attackerIsA)
        if (burstDmg > 0) applyHit(burstDmg, !attackerIsA)
        // دروگر: خونِ هر ضربه (مومنتومِ سرخ)
        if (cls?.key === "reaper") {
          const cost = Math.max(1, Math.round((my.hp * (me.passive.crimsonCost ?? 3)) / 100))
          if (my.hp > cost) my.hp -= cost
        }
        // بهایِ خونِ مهارتِ امضا (جادوگر/دروگر) — همانِ PvE
        if (isSkill && cls?.activeSkill.selfCost) {
          const cost = Math.max(1, Math.round((my.hp * cls.activeSkill.selfCost) / 100))
          if (my.hp > cost) my.hp -= cost
          log.push(`${cls.key === "reaper" ? "🩸 بهایِ دَرَو" : "🌙 فشارِ اسرار"}: ${faDigits(cost)} خون.`)
        }
      } else {
        if (cls?.key === "ranger") my.focus = 0
        if (cls?.key === "duelist") my.tempo = 0
        applyMiss(!attackerIsA)
      }
    }

    // احضارکننده: گرگِ معلق — بلافاصله بعد از کنش (همانِ PvE)
    if (my.wolfPend > 0 && foe.hp > 0) {
      const w = strike({ ...me, atk: me.atk * (my.wolfPend / 100), name: "گرگِ روح", emoji: "🐺" }, foeSheet, foe.guard, rng, {})
      log.push(w.line)
      if (w.hit) applyHit(w.dmg, !attackerIsA)
      else applyMiss(!attackerIsA)
      my.wolfPend = 0
    }
  }

  /** احضارکننده: گرگِ پیمانیِ هر دومین راند — بعد از کنش‌های راند (همانِ PvE) */
  const wolfPactTick = (sideIsA: boolean): void => {
    const me = sideIsA ? sa : sb
    const my = sideIsA ? stA : stB
    const foe = sideIsA ? stB : stA
    if (getClass(me.clsKey)?.key !== "summoner") return
    if (my.hp <= 0 || foe.hp <= 0) return
    my.wolfCount++
    if (my.wolfCount % 2 !== 0) return
    const foeSheet = sideIsA ? sb : sa
    const w = strike({ ...me, atk: me.atk * ((me.passive.wolfPower ?? 45) / 100), name: "گرگِ روح", emoji: "🐺" }, foeSheet, foe.guard, rng, {})
    log.push(w.line)
    if (w.hit) {
      highlights.push(`🐺 گرگِ روحِ ${me.name}: ${faDigits(w.dmg)} آسیب.`)
      applyHit(w.dmg, !sideIsA)
    } else {
      applyMiss(!sideIsA)
    }
  }

  while (stA.hp > 0 && stB.hp > 0 && round < 14) {
    round++
    log.push(`— راند ${faDigits(round)} —`)
    const cdStartA = stA.cd
    const cdStartB = stB.cd
    const order: ("a" | "b")[] = aFirst ? ["a", "b"] : ["b", "a"]
    for (const side of order) {
      if (stA.hp <= 0 || stB.hp <= 0) break
      const attackerIsA = side === "a"
      // فریبِ سلطنتیِ مدافع ممکن است حرکت را قورت بدهد — قبل از کنش
      if (!tryDeception(attackerIsA)) actSide(attackerIsA)
    }
    wolfPactTick(true)
    wolfPactTick(false)
    // نفس‌گیری: فقط اگر این راند مهارت خرج نشد، cd را کم کن (رفتارِ حفظ‌شده)
    if (stA.cd === cdStartA) stA.cd = Math.max(0, stA.cd - 1)
    if (stB.cd === cdStartB) stB.cd = Math.max(0, stB.cd - 1)
    stA.guard = false
    stB.guard = false
  }

  const aWon = stB.hp <= 0 && stA.hp > 0
  const bWon = stA.hp <= 0 && stB.hp > 0
  const winnerIsA = aWon || (!aWon && !bWon) // مساوی → سرعتِ بیشتر برد (a اول بود)

  return { winnerIsA, rounds: round, hpA: stA.hp, hpB: stB.hp, log, passiveHighlights: highlights, burstMoneyA: stA.burstMoney, burstMoneyB: stB.burstMoney }
}

export async function duelCharacters(initiator: Player, foePlayer: Player, groupId?: string): Promise<{ duel?: DuelResult; error?: string }> {
  if (initiator.id === foePlayer.id) return { error: "با خودت دوئل؟ شهر این‌قدر هم خسته نیست." }
  const [a, b] = await Promise.all([getForCombat(initiator), getForCombat(foePlayer)])
  if (!a) return { error: "فمبوی اختصاصی تو هنوز آماده‌ی نبرده — اول پیمانِ فمبوی را ببند." }
  if (!b) return { error: `«${foePlayer.name}» هنوز فمبوی ندارد.` }
  const condA = spiritCondition(a.spirit)
  const condB = spiritCondition(b.spirit)
  if (!condA.canFight) return { error: "روحیه‌ی فمبویت تهی است — اول آرامشش کن." }
  if (!condB.canFight) return { error: `روحیه‌ی فمبویِ «${foePlayer.name}» تهی است.` }
  if (a.stamina < SOUL.DUEL_COST) return { error: `استقامتت کم است (${faDigits(SOUL.DUEL_COST)} لازم).` }
  if (b.stamina < SOUL.DUEL_COST) return { error: `استقامتِ فمبویِ «${foePlayer.name}» کافی نیست.` }

  return db.$transaction(async (tx) => {
    // کسرِ استقامتِ دوطرفه با دوباره‌چک
    const fa = await tx.soulCharacter.findUniqueOrThrow({ where: { id: a.id } })
    const fb = await tx.soulCharacter.findUniqueOrThrow({ where: { id: b.id } })
    if (fa.stamina < SOUL.DUEL_COST || fb.stamina < SOUL.DUEL_COST) return { error: "استقامتِ یکی از دو طرف کم بود." }

    const clsA = getClass(a.classKey)
    const clsB = getClass(b.classKey)
    if (!clsA || !clsB) return { error: "کلاسِ خراب." }
    const rng = mulberry32(seedFrom("duel", a.id, b.id, Date.now()))
    const sa = charSheet(a)
    const sb = charSheet(b)
    // V14 — شبیه‌سازیِ خالص با passiveهای کلاس (همانِ PvE)؛ قطعی روی بذر
    const sim = simulateDuel(sa, sb, rng)
    const log = [
      `⚔️ دوئل! ${sa.emoji} ${a.name} (${clsA.name}) در برابر ${sb.emoji} ${b.name} (${clsB.name})`,
      ...sim.log.slice(1),
    ]
    const hpA = sim.hpA
    const hpB = sim.hpB
    const round = sim.rounds
    const winnerIsA = sim.winnerIsA
    const winner = winnerIsA ? a : b
    const winnerSheet = winnerIsA ? sa : sb

    log.push(`🏆 ${winnerSheet.emoji} ${winner.name} دوئل را برد!`)

    // پاداش‌ها — کوچک و سکه‌ی جدید (انتقالِ پول بین بازیکن‌ها نیست)
    let prize = randInt(250, 420, rng)
    const winnerBurst = winnerIsA ? sim.burstMoneyA : sim.burstMoneyB
    if (winnerBurst) {
      // جادوگرِ برنده: جایزه‌ی انفجارِ کهکشانی (آینه‌ی PvE — یک‌بار در نبرد)
      prize = Math.round(prize * (1 + (winnerSheet.passive.burstBonus ?? 25) / 100))
      log.push(`✨ تابشِ انفجار، کیفِ جایزه را هم سنگین‌تر کرد.`)
    }
    const pWinner = winnerIsA ? initiator : foePlayer
    await applyMoney(tx, pWinner, prize, "reward", "برنده‌ی دوئل")

    const applyAfter = async (char: SoulCharacter, won: boolean) => {
      const cur = await tx.soulCharacter.findUniqueOrThrow({ where: { id: char.id } })
      const updated = await tx.soulCharacter.update({
        where: { id: char.id },
        data: {
          stamina: Math.max(0, cur.stamina - SOUL.DUEL_COST),
          staminaAt: new Date(),
          spirit: clamp(cur.spirit + (won ? 6 : -10), 0, 100),
          wins: won ? cur.wins + 1 : cur.wins,
          losses: won ? cur.losses : cur.losses + 1,
        },
      })
      const cls = getClass(char.classKey)
      const xp = won ? { battle: 30, ...(cls ? { [cls.xpBias.primary]: 20 } : {}) } : { battle: 14 }
      const { char: after } = await awardXpTx(tx, updated, { tracks: xp as Record<string, number> })
      return after
    }

    const afterA = await applyAfter(a, winnerIsA)
    const afterB = await applyAfter(b, !winnerIsA)
    await addCharLog(tx, a.id, "duel", "⚔️", `${a.name} با ${b.name} دوئل کرد و ${winnerIsA ? "برد" : "باخت"}.`, true)
    await addCharLog(tx, b.id, "duel", "⚔️", `${b.name} با ${a.name} دوئل کرد و ${winnerIsA ? "باخت" : "برد"}.`, true)

    // V8 — نقاطِ عطفِ دوئل (فقط بردِ PvP): شمارش از سابقه‌ی «… دوئل کرد و برد.»
    const duelWins = await tx.characterLog.count({
      where: { characterId: winner.id, type: "duel", text: { endsWith: "و برد." } },
    })
    await grantPlayerAchievementTx(tx, pWinner.id, "first_duel_win")
    if (duelWins >= 10) {
      await grantPlayerAchievementTx(tx, pWinner.id, "duel_veteran")
      await grantPlayerTitleTx(tx, pWinner.id, "duel_champion")
    }

    // ثبتِ نبرد برای تاریخِ گروه — V14: هویتِ کلاس + خونِ پایانی + لحظه‌های امضا
    await tx.combatEncounter.create({
      data: {
        playerId: initiator.id,
        kind: "duel",
        foeId: foePlayer.id,
        groupId: groupId ?? null,
        status: "won",
        round,
        stateJson: JSON.stringify({ hp: hpA, foeHp: hpB, log: log.slice(-30) }),
        resultJson: JSON.stringify({
          outcome: "won",
          money: winnerIsA ? prize : 0,
          xp: [{ track: "battle", label: "نبرد", icon: "⚔️", amount: winnerIsA ? 30 : 14 }],
          spiritDelta: winnerIsA ? 6 : -10,
          lines: [`دوئلِ ${a.name} و ${b.name} — برنده: ${winner.name}`],
          // V14 — عمقِ هویتِ کلاس (free-form؛ بدونِ تغییرِ اسکیما)
          classes: { a: clsA.key, b: clsB.key },
          finalHp: { a: Math.max(0, Math.round(hpA)), b: Math.max(0, Math.round(hpB)) },
          rounds: round,
          passiveHighlights: sim.passiveHighlights.slice(0, 3),
        }),
        resolvedAt: new Date(),
      },
    })

    return {
      duel: {
        log: log.slice(-16),
        winnerName: winner.name,
        loserName: (winnerIsA ? b : a).name,
        winnerIsInitiator: winnerIsA,
        rounds: round,
        initiatorCard: soulCardDTO(afterA),
        foeCard: soulCardDTO(afterB),
        passiveHighlights: sim.passiveHighlights.slice(0, 3),
      },
    }
  })
}

// بوردهای شکار برای UI
export { availableEnemies }
