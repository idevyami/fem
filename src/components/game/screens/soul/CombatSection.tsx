"use client"

// V8 فمبوی — سکشنِ نبرد: نبردِ فعال / نتیجه / لیستِ شکار
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { CombatStateDTO, EnemyDTO, SoulCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum, faSigned } from "../../fa"
import { ActionButton, Chip, GlassCard, ProgressBar, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { GLASS_BLUE, activeSkillOf } from "./classMeta"

type CombatAct = "strike" | "skill" | "guard" | "flee"

interface CombatSectionProps {
  card: SoulCardDTO
  enemies: EnemyDTO[]
  encounter: CombatStateDTO | null
  /** شروعِ شکار — والد کارت/نبرد را به‌روز می‌کند */
  onStart: (enemyKey: string) => Promise<boolean>
  /** حرکتِ راند — والد کارت/نبرد را به‌روز می‌کند */
  onAct: (act: CombatAct) => Promise<boolean>
  /** پایانِ نتیجه — برگشت به لیستِ شکار */
  onNextHunt: () => void
}

/** رنگِ رده‌ی دشمن */
function tierTone(tier: number): "emerald" | "amber" | "rose" | "violet" | "default" {
  if (tier <= 1) return "emerald"
  if (tier === 2) return "amber"
  if (tier === 3) return "rose"
  return "violet"
}

export function CombatSection({ card, enemies, encounter, onStart, onAct, onNextHunt }: CombatSectionProps) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const logRef = React.useRef<HTMLDivElement>(null)

  const activeSkill = activeSkillOf(card.classKey)
  const inBattle = encounter?.status === "active"

  // اسکرولِ خودکارِ آخرِ لاگِ نبرد — جدیدترین خط همیشه پایین است
  React.useEffect(() => {
    if (!inBattle) return
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [inBattle, encounter?.log?.length])

  async function start(enemyKey: string) {
    if (busy) return
    haptic("heavy")
    setBusy(`st:${enemyKey}`)
    await onStart(enemyKey)
    setBusy(null)
  }

  async function act(a: CombatAct) {
    if (busy || !inBattle) return
    haptic(a === "flee" ? "light" : "medium")
    setBusy(`act:${a}`)
    await onAct(a)
    setBusy(null)
  }

  // ─── نبردِ فعال ───────────────────────────────────────────────────────
  if (inBattle && encounter) {
    const skillCd = encounter.cooldown > 0
    return (
      <div className="flex flex-col gap-4">
        {/* کارتِ دشمن */}
        <GlassCard className="border-rose-400/25 bg-rose-500/[0.05]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="text-2xl leading-none">
                {encounter.enemy?.emoji}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-6">{encounter.enemy?.name}</p>
                {encounter.enemy?.special ? (
                  <p className="truncate text-[11px] leading-4 text-rose-200/80">⚠️ {encounter.enemy.special}</p>
                ) : null}
              </div>
            </div>
            <Chip tone="rose">راند {faNum(encounter.round)}</Chip>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums">
              <span className="text-rose-200/80">خونِ دشمن</span>
              <span>
                {faNum(encounter.enemy?.hp ?? 0)} / {faNum(encounter.enemy?.hpMax ?? 1)}
              </span>
            </div>
            <ProgressBar value={encounter.enemy?.hp ?? 0} max={encounter.enemy?.hpMax ?? 1} barClassName="bg-rose-400" label="خونِ دشمن" />
          </div>
          <div className="mt-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px] tabular-nums">
              <span className="text-emerald-200/80">
                خونِ {encounter.you.name} {encounter.you.emoji}
              </span>
              <span>
                {faNum(encounter.you.hp)} / {faNum(encounter.you.hpMax)}
              </span>
            </div>
            <ProgressBar value={encounter.you.hp} max={encounter.you.hpMax} barClassName="bg-emerald-400" label="خونِ فمبوی" />
          </div>
          {encounter.enemy?.flavor ? (
            <p className="mt-2.5 text-[11px] italic leading-5 text-muted-foreground">{encounter.enemy.flavor}</p>
          ) : null}
        </GlassCard>

        {/* لاگِ نبرد */}
        <GlassCard pad="sm">
          <SectionTitle icon="⚔️" title="روایتِ نبرد" />
          <div
            ref={logRef}
            className="scrollbar-thin flex max-h-56 flex-col gap-1 overflow-y-auto rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
            aria-live="polite"
            role="log"
          >
            {encounter.log.map((line, i) => (
              <p
                key={`${i}-${line.slice(0, 12)}`}
                className={cn(
                  "text-[11px] leading-5",
                  i === encounter.log.length - 1 ? "font-semibold text-foreground" : "text-foreground/65",
                )}
              >
                {line}
              </p>
            ))}
          </div>
          {skillCd ? (
            <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
              🕰 امضا: {faNum(encounter.cooldown)} راند مانده
            </p>
          ) : null}
        </GlassCard>

        {/* کنش‌های راند */}
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            variant="glass"
            size="lg"
            className={GLASS_BLUE}
            emoji="⚔️"
            loading={busy === "act:strike"}
            disabled={busy !== null}
            onClick={() => void act("strike")}
          >
            ضربه
          </ActionButton>
          <ActionButton
            variant="glass"
            size="lg"
            className={GLASS_BLUE}
            emoji={activeSkill?.icon ?? "✨"}
            loading={busy === "act:skill"}
            disabled={busy !== null || skillCd}
            onClick={() => void act("skill")}
          >
            {skillCd ? `امضا (${faNum(encounter.cooldown)})` : "مهارتِ امضا"}
          </ActionButton>
          <ActionButton
            variant="glass"
            size="lg"
            className={GLASS_BLUE}
            emoji="🛡️"
            loading={busy === "act:guard"}
            disabled={busy !== null}
            onClick={() => void act("guard")}
          >
            گارد
          </ActionButton>
          <ActionButton
            variant="danger"
            size="lg"
            emoji="🏃"
            loading={busy === "act:flee"}
            disabled={busy !== null}
            onClick={() => void act("flee")}
          >
            فرار
          </ActionButton>
        </div>
        <p className="text-center text-[11px] leading-4 text-muted-foreground">
          {skillCd ? "امضای کلاست هنوز خنک نشده — با ضربه و گارد راند را بگذران." : "امضای کلاس آماده است."}
        </p>
      </div>
    )
  }

  // ─── نتیجه‌ی نبرد ─────────────────────────────────────────────────────
  if (encounter && encounter.result) {
    const r = encounter.result
    const OUTCOME: Record<string, { emoji: string; title: string; cls: string }> = {
      won: { emoji: "🏆", title: "شکار موفق", cls: "border-amber-400/25 bg-amber-500/[0.06]" },
      lost: { emoji: "💀", title: "شکست", cls: "border-rose-400/25 bg-rose-500/[0.06]" },
      fled: { emoji: "🏃", title: "فرار", cls: "border-white/15 bg-white/[0.04]" },
    }
    const out = OUTCOME[r.outcome] ?? OUTCOME.fled
    return (
      <div className="flex flex-col gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
          <GlassCard className={cn("text-center", out.cls)}>
            <motion.span
              aria-hidden
              className="block text-5xl"
              animate={{ scale: [0.8, 1.1, 1] }}
              transition={{ duration: 0.5 }}
            >
              {out.emoji}
            </motion.span>
            <h2 className="mt-2 text-lg font-black leading-8">{out.title}</h2>
            {encounter.enemy ? (
              <p className="text-[11px] leading-5 text-muted-foreground">
                با {encounter.enemy.emoji} {encounter.enemy.name} · راند {faNum(encounter.round)}
              </p>
            ) : null}

            {/* غنیمت‌ها */}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {r.money > 0 ? <Chip tone="amber">💰 +{faNum(r.money)} سکه</Chip> : null}
              {r.xp.map((x) => (
                <Chip key={x.track} tone="violet">
                  {x.icon} +{faNum(x.amount)} {x.label}
                </Chip>
              ))}
              {r.spiritDelta !== 0 ? (
                <Chip tone={r.spiritDelta > 0 ? "emerald" : "rose"}>💗 {faSigned(r.spiritDelta)} روحیه</Chip>
              ) : null}
            </div>

            {/* خطوطِ روایت */}
            {r.lines.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-white/10 pt-3">
                {r.lines.map((line, i) => (
                  <li key={i} className="text-[11px] leading-5 text-foreground/75">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </GlassCard>
        </motion.div>

        <ActionButton variant="glass" size="lg" className={GLASS_BLUE} emoji="🎯" onClick={onNextHunt}>
          شکارِ بعدی
        </ActionButton>
      </div>
    )
  }

  // ─── لیستِ شکار ───────────────────────────────────────────────────────
  const canFight = card.condition.canFight
  const staminaEnough = card.stamina >= 3

  return (
    <div className="flex flex-col gap-4">
      <GlassCard pad="sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold leading-5">حالتِ فمبوی</p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              {canFight
                ? `${card.condition.emoji} ${card.condition.label} — آماده‌ی نبرد`
                : `${card.condition.emoji} ${card.condition.label} — روحیه‌ش برای نبرد تهی است`}
            </p>
          </div>
          <Chip tone={canFight ? (staminaEnough ? "amber" : "rose") : "rose"} className="font-bold">
            ⚡ {faNum(card.stamina)}/{faNum(card.staminaMax)}
          </Chip>
        </div>
        {!canFight ? (
          <p className="mt-2.5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-300">
            تا روحیه‌ش دوباره جان بگیرد نمی‌تواند بجنگد — شربتِ روحیه یا وقت‌گذرانی از تبِ اقدامات.
          </p>
        ) : !staminaEnough ? (
          <p className="mt-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-200">
            هر نبرد 3 واحد استقامت می‌برد و همین‌قدر داری کم — از تبِ اقدامات شارژ کن یا {card.staminaMinutesToNext !== null ? `${faNum(card.staminaMinutesToNext)} دقیقه صبر کن` : "کمی صبر کن"}.
          </p>
        ) : null}
      </GlassCard>

      <GlassCard>
        <SectionTitle icon="🎯" title="شکارِ امشب" action={<Chip>{faNum(enemies.length)} دشمن</Chip>} />
        {enemies.length === 0 ? (
          <p className="py-6 text-center text-xs italic leading-6 text-muted-foreground">
            هنوز دشمنی در تیررسِ تو نیست.
            <br />
            کمی رشد کن؛ شهر چشم‌انتظار است.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {enemies.map((e) => (
              <EnemyRow
                key={e.key}
                enemy={e}
                disabled={!canFight || !staminaEnough || busy !== null}
                loading={busy === `st:${e.key}`}
                onStart={(key) => void start(key)}
              />
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  )
}

// ─── ردیفِ دشمن (سنگین — memo با امضای محتوا) ────────────────────────────

interface EnemyRowProps {
  enemy: EnemyDTO
  disabled: boolean
  loading: boolean
  onStart: (enemyKey: string) => void
}

const EnemyRow = React.memo(
  function EnemyRow({ enemy, disabled, loading, onStart }: EnemyRowProps) {
    return (
      <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25 text-xl">
            {enemy.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xs font-bold leading-5">{enemy.name}</p>
              <Chip tone={tierTone(enemy.tier)}>رده {faNum(enemy.tier)}</Chip>
            </div>
            {enemy.special ? (
              <p className="mt-0.5 truncate text-[11px] leading-4 text-amber-200/70">⚠️ {enemy.special}</p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
              <span>❤️ {faNum(enemy.hp)}</span>
              <span>⚔️ {faNum(enemy.atk)}</span>
              <span>💨 {faNum(enemy.dodge)}%</span>
              <span>
                ✨ {faNum(enemy.xp)} · 💰 {faNum(enemy.money[0])}–{faNum(enemy.money[1])} سکه
              </span>
            </div>
            {enemy.flavor ? (
              <p className="mt-1 text-[11px] italic leading-4 text-muted-foreground/70">{enemy.flavor}</p>
            ) : null}
          </div>
          <ActionButton
            variant="danger"
            size="sm"
            className="shrink-0"
            emoji="⚔️"
            disabled={disabled}
            loading={loading}
            onClick={() => onStart(enemy.key)}
          >
            نبرد
          </ActionButton>
        </div>
      </li>
    )
  },
  (a, b) =>
    a.enemy.key === b.enemy.key &&
    a.disabled === b.disabled &&
    a.loading === b.loading,
)
