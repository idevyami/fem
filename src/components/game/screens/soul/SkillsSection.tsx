"use client"

// V10 فمبوی — سکشنِ مهارت‌ها: امضای کلاس + درختِ سه‌شاخه (هسته/زندگی/هنر)
import * as React from "react"
import { motion } from "framer-motion"
import type { SkillStateDTO, SoulCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { activeSkillOf } from "./classMeta"

interface SkillsSectionProps {
  card: SoulCardDTO
  /** ارتقای مهارت — true یعنی موفق */
  onUpgrade: (skillId: string) => Promise<boolean>
}

/** شاخه‌های درخت — ترتیبِ ثابتِ نمایش */
const BRANCHES: { key: SkillStateDTO["branch"]; icon: string; label: string; hint: string }[] = [
  { key: "core", icon: "⚔️", label: "هسته‌ی رزمی", hint: "استخوانِ نبرد — آمار و پاسیوش" },
  { key: "life", icon: "🌿", label: "مسیرِ زندگی", hint: "شهر و هم‌نفَسی — تعامل، کار، استراحت" },
  { key: "art", icon: "🌌", label: "قله‌ی هنر", hint: "قله‌ی کلاس — درِ آن با فرگشت باز می‌شود" },
]

export function SkillsSection({ card, onUpgrade }: SkillsSectionProps) {
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const active = activeSkillOf(card.classKey)

  async function upgrade(skillId: string) {
    if (busyId) return
    haptic("medium")
    setBusyId(skillId)
    await onUpgrade(skillId)
    setBusyId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── مهارتِ امضای کلاس ── */}
      {active ? (
        <GlassCard
          className="border-white/15"
          style={{ borderColor: `${card.palette.primary}55`, background: `${card.palette.soft}66` }}
        >
          <SectionTitle
            icon={active.icon}
            title={active.name}
            action={<Chip tone="pink">امضای {card.classEmoji} کلاس</Chip>}
          />
          <p className="text-xs leading-6 text-foreground/80">{active.desc}</p>
          <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
            🕰 خنک‌شدن: {faNum(active.cooldown)} راند · در نبرد با «✨ مهارتِ امضا» می‌زند
          </p>
        </GlassCard>
      ) : null}

      {/* ── درختِ مهارت — سه شاخه ── */}
      <GlassCard>
        <SectionTitle
          icon="🌟"
          title="درختِ مهارت"
          action={
            <Chip tone={card.skillPoints > 0 ? "amber" : "default"} className="font-bold">
              {faNum(card.skillPoints)} نقطه‌ی مهارت
            </Chip>
          }
        />
        <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
          هر 2 سطح یک نقطه می‌گیری — رتبه‌ی مهارت‌ها را با همان نقطه‌ها بالا ببر. بعضی مهارت‌ها پیش‌نیاز و درِ قله با فرگشت باز می‌شود.
        </p>
        <div className="flex flex-col gap-3.5">
          {BRANCHES.map((br, bi) => {
            const skills = card.skills.filter((s) => s.branch === br.key)
            if (skills.length === 0) return null
            return (
              <section key={br.key} aria-label={br.label}>
                <motion.header
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(bi * 0.08, 0.3), duration: 0.25 }}
                  className="mb-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <span aria-hidden className="text-base leading-none">
                    {br.icon}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate text-xs font-extrabold leading-5">{br.label}</h3>
                  <span className="shrink-0 text-[11px] leading-4 text-muted-foreground">{br.hint}</span>
                </motion.header>
                <ul className="flex flex-col gap-2">
                  {skills.map((s) => (
                    <SkillRow
                      key={s.id}
                      skill={s}
                      palette={card.palette.primary}
                      busy={busyId === s.id}
                      disabled={busyId !== null}
                      onUpgrade={(id) => void upgrade(id)}
                    />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      </GlassCard>
    </div>
  )
}

// ─── ردیفِ مهارت (سنگین — memo با امضای محتوا) ─────────────────────────────

interface SkillRowProps {
  skill: SkillStateDTO
  palette: string
  busy: boolean
  disabled: boolean
  onUpgrade: (skillId: string) => void
}

const SkillRow = React.memo(
  function SkillRow({ skill, palette, busy, disabled, onUpgrade }: SkillRowProps) {
    const reason = skill.locked ? skill.lockedReason : skill.upgradeReason
    return (
      <motion.li
        layout
        className={cn(
          "rounded-2xl border border-white/10 bg-white/[0.03] p-3",
          skill.locked && "opacity-55",
          skill.canUpgrade && "border-white/15",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-xl border text-base"
            style={{ borderColor: `${palette}44`, background: `${palette}18` }}
          >
            {skill.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold leading-5">
                <span className="truncate">{skill.name}</span>
                {skill.evolutionReq !== null ? (
                  <Chip tone="violet" className="shrink-0 !px-1.5">
                    🧬 فرگشتِ {faNum(skill.evolutionReq)}
                  </Chip>
                ) : null}
              </p>
              {/* رتبه‌ها: ●●○ */}
              <span className="flex shrink-0 items-center gap-1" aria-label={`رتبه‌ی ${faNum(skill.rank)} از ${faNum(skill.maxRank)}`}>
                {Array.from({ length: skill.maxRank }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="text-[11px] leading-4"
                    style={{ color: i < skill.rank ? palette : "rgba(255,255,255,0.18)" }}
                  >
                    ●
                  </span>
                ))}
                <span className="ms-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {faNum(skill.rank)}/{faNum(skill.maxRank)}
                </span>
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-foreground/70">{skill.desc}</p>
            {skill.effectPreview ? (
              <p className="mt-1.5 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] leading-4 text-foreground/75">
                رتبه‌ی بعد: {skill.effectPreview}
              </p>
            ) : null}
            {skill.requiresSkillName ? (
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground/90">
                ↳ نیاز به: <span className="font-semibold text-muted-foreground">{skill.requiresSkillName}</span>
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
                {skill.locked ? `🔒 ${skill.lockedReason ?? `سطح ${faNum(skill.unlockLevel)}`}` : reason ?? ""}
              </span>
              <ActionButton
                variant={skill.canUpgrade ? "primary" : "glass"}
                size="sm"
                className={cn("min-h-11 shrink-0", skill.canUpgrade ? "" : "opacity-60")}
                disabled={disabled || !skill.canUpgrade}
                loading={busy}
                onClick={() => onUpgrade(skill.id)}
              >
                {skill.locked
                  ? "قفل"
                  : skill.rank >= skill.maxRank
                    ? "کامل"
                    : `ارتقا · ${faNum(skill.spCost)} نقطه‌مهارت`}
              </ActionButton>
            </div>
          </div>
        </div>
      </motion.li>
    )
  },
  (a, b) =>
    a.skill.id === b.skill.id &&
    a.skill.rank === b.skill.rank &&
    a.skill.maxRank === b.skill.maxRank &&
    a.skill.canUpgrade === b.skill.canUpgrade &&
    a.skill.spCost === b.skill.spCost &&
    a.skill.locked === b.skill.locked &&
    a.skill.lockedReason === b.skill.lockedReason &&
    a.skill.upgradeReason === b.skill.upgradeReason &&
    a.skill.effectPreview === b.skill.effectPreview &&
    a.skill.desc === b.skill.desc &&
    a.skill.evolutionReq === b.skill.evolutionReq &&
    a.skill.requiresSkillName === b.skill.requiresSkillName &&
    a.palette === b.palette &&
    a.busy === b.busy &&
    a.disabled === b.disabled,
)
