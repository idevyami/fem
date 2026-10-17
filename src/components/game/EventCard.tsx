"use client"

// کارت اتفاق + انکشاف نتیجه — کامپوننت‌های نمایشی؛ منطق در HomeScreen است
import * as React from "react"
import { motion } from "framer-motion"
import { Lock } from "lucide-react"
import type { ActiveEventDTO, DeltaLineDTO, FemboyXpDTO, OutcomeDTO, Rarity } from "@/lib/game/contract"
import { faNum, faSigned } from "./fa"
import { Chip, RarityChip } from "./ui"
import { cn } from "@/lib/utils"

const RARITY_HEX: Record<Rarity, string> = {
  common: "#a1a1aa",
  uncommon: "#34d399",
  rare: "#f472b6",
  epic: "#a78bfa",
  legendary: "#fbbf24",
  unknown: "#94a3b8",
}

const TONE_TEXT: Record<DeltaLineDTO["tone"], string> = {
  good: "text-emerald-300",
  bad: "text-rose-300",
  neutral: "text-zinc-400",
}

interface EventCardProps {
  event: ActiveEventDTO
  /** ایندکس گزینه‌ای که در حال resolve شدن است (null = هیچ‌کدام) */
  choosing: number | null
  onChoose: (index: number) => void
}

/** کارت اتفاق — موقعیت + گزینه‌ها */
export function EventCard({ event, choosing, onChoose }: EventCardProps) {
  const stripColor = RARITY_HEX[event.rarity]
  return (
    <motion.section
      aria-label={`اتفاق: ${event.title}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="glass relative overflow-hidden"
    >
      {/* نوار کمیابی — نازک و در حد تزئین */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(to left, transparent, ${stripColor}cc, transparent)` }}
      />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
            <span aria-hidden>{event.emoji}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-6">{event.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip>{event.categoryLabel}</Chip>
              <RarityChip rarity={event.rarity} label={event.rarityLabel} />
              {event.isChainStep ? (
                <Chip tone="violet">زنجیره {faNum(event.chainStep)}</Chip>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-3 whitespace-pre-line text-[13.5px] leading-7 text-foreground/85">{event.text}</p>

        <div className="mt-4 flex flex-col gap-2">
          {event.choices.map((choice, i) => {
            const busy = choosing === i
            const disabled = choice.locked || choosing !== null
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => onChoose(i)}
                className={cn(
                  "flex min-h-14 w-full select-none items-center gap-2.5 rounded-2xl border px-4 py-3 text-start transition-all duration-150 active:scale-[0.98]",
                  choice.locked
                    ? "border-white/5 bg-white/[0.02] opacity-50"
                    : "border-white/10 bg-white/[0.05] hover:border-primary/30 hover:bg-white/[0.07]",
                  busy && "border-primary/40 bg-primary/10",
                )}
              >
                {choice.locked ? (
                  <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : busy ? (
                  <span aria-hidden className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <span aria-hidden className="text-lg leading-none">
                    ⚡
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-6">{choice.label}</span>
                  {choice.hint ? (
                    <span className="block text-[11px] leading-4 text-muted-foreground">{choice.hint}</span>
                  ) : null}
                  {choice.locked && choice.lockedReason ? (
                    <span className="mt-0.5 block text-[11px] leading-4 text-amber-300/90">🔒 {choice.lockedReason}</span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}

/** انکشاف نتیجه — خط‌به‌خط و با وقفت‌های کوچک */
export function OutcomeReveal({ outcome, onContinue }: { outcome: OutcomeDTO; onContinue: () => void }) {
  // V9 — جایزه‌ی XPِ فمبوی بعد از خط‌های تغییرات، با همان وقفتِ پله‌ای
  const femboyXpDelay = 0.3 + outcome.deltas.length * 0.09
  return (
    <motion.section
      aria-label="نتیجه"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="glass-strong relative overflow-hidden"
    >
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{ background: "linear-gradient(to left, transparent, #f472b6cc, transparent)" }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            🪄
          </span>
          <h3 className="text-sm font-bold text-primary">نتیجه</h3>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-2 whitespace-pre-line text-[14.5px] font-medium leading-8 text-foreground"
        >
          {outcome.text}
        </motion.p>

        {outcome.deltas.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-3">
            {outcome.deltas.map((d, i) => (
              <motion.div
                key={`${d.label}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.25 }}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <span aria-hidden>{d.icon}</span>
                  {d.label}
                </span>
                <span className={cn("font-bold tabular-nums", TONE_TEXT[d.tone])}>{faSigned(d.amount)}</span>
              </motion.div>
            ))}
          </div>
        ) : null}

        {/* V9 — تجربه‌ی شهر، فمبوی را تربیت می‌کند */}
        {outcome.femboyXp ? <FemboyXpBlock xp={outcome.femboyXp} baseDelay={femboyXpDelay} /> : null}

        {outcome.grantedItems.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.25 }}
            className="mt-3"
          >
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">چیزهایی که مال تو شد:</p>
            <div className="flex flex-wrap gap-1.5">
              {outcome.grantedItems.map((it, i) => (
                <Chip key={i} tone="emerald">
                  <span aria-hidden>{it.emoji}</span> {it.name}
                </Chip>
              ))}
            </div>
          </motion.div>
        ) : null}

        {outcome.grantedPet ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, duration: 0.25 }}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-3"
          >
            <span aria-hidden className="text-3xl">
              {outcome.grantedPet.emoji}
            </span>
            <div>
              <p className="text-sm font-bold text-violet-200">یکی دنبالت راه افتاد.</p>
              <p className="text-xs text-violet-300/80">{outcome.grantedPet.name} — از این‌جا به بعد باهاته.</p>
            </div>
          </motion.div>
        ) : null}

        {outcome.grantedTitles.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.25 }}
            className="mt-3 flex flex-wrap gap-1.5"
          >
            {outcome.grantedTitles.map((t, i) => (
              <Chip key={i} tone="pink">
                🎖 {t}
              </Chip>
            ))}
          </motion.div>
        ) : null}

        {outcome.grantedAchievements.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.25 }}
            className="mt-3 flex flex-wrap gap-1.5"
          >
            {outcome.grantedAchievements.map((a, i) => (
              <Chip key={i} tone="amber">
                🏆 {a}
              </Chip>
            ))}
          </motion.div>
        ) : null}

        {outcome.npcNotes.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
            className="mt-3 flex flex-col gap-1.5"
          >
            {outcome.npcNotes.map((n, i) => (
              <p key={i} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-foreground/70">
                💬 {n}
              </p>
            ))}
          </motion.div>
        ) : null}

        {outcome.worldFeed ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.75, duration: 0.3 }}
            className="mt-3 text-[11px] italic leading-5 text-muted-foreground"
          >
            📻 نبض شهر: {outcome.worldFeed}
          </motion.p>
        ) : null}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.3 }}
          className="mt-4"
        >
          <button
            type="button"
            onClick={onContinue}
            className="glow-pink inline-flex min-h-14 w-full select-none items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary px-5 text-base font-bold text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.97]"
          >
            ادامه
          </button>
        </motion.div>
      </div>
    </motion.section>
  )
}

/** V9 — ردیفِ XPِ فمبوی + خط‌های سطحِ تازه؛ هم‌رنگِ جایزه‌های مثبت (زمردی) */
function FemboyXpBlock({ xp, baseDelay }: { xp: FemboyXpDTO; baseDelay: number }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: baseDelay, duration: 0.25 }}
        className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5"
        aria-label={`تجربه‌ی فمبوی: ${faNum(xp.amount)} در مسیرِ ${xp.trackLabel}`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-emerald-200">
          <span aria-hidden className="leading-none">
            {xp.trackIcon}
          </span>
          <span className="truncate">{xp.name}</span>
        </span>
        <span className="shrink-0 text-sm font-bold text-emerald-300 tabular-nums">
          +{faNum(xp.amount)} XPِ {xp.trackLabel}
        </span>
      </motion.div>
      {xp.levelUps.map((lv, i) => (
        <motion.p
          key={`${lv}-${i}`}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: baseDelay + 0.12 * (i + 1), duration: 0.25 }}
          className="mt-1.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs font-bold leading-5 text-amber-200"
        >
          ⭐ فمبویِ تو قوی‌تر شد — سطح {faNum(Number(lv))}
        </motion.p>
      ))}
    </>
  )
}
