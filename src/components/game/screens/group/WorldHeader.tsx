"use client"

// سرِ جهان — نامِ گروه، محله، فرهنگ، آمارِ زنده و «چه خبر»
import { motion } from "framer-motion"
import type { GroupSnapshotDTO } from "@/lib/game/group/types"
import { faNum, faPercent } from "../../fa"
import { ActionButton, Chip, GlassCard } from "../../ui"

interface WorldHeaderProps {
  snap: GroupSnapshotDTO
  /** دکمه‌ی «یه اتفاق بیفکن» در حالِ اجراست */
  triggering: boolean
  onTriggerEvent: () => void
}

export function WorldHeader({ snap, triggering, onTriggerEvent }: WorldHeaderProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label="وضعیتِ دنیای گروه"
    >
      <GlassCard className="relative overflow-hidden">
        {/* هاله‌ی فرهنگ — فقط حس */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -left-12 size-44 rounded-full bg-primary/[0.06] blur-3xl" />
        </div>

        <div className="relative flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-4xl leading-none drop-shadow-[0_0_12px_rgba(244,114,182,0.35)]">
            {snap.cultureEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold leading-7">{snap.title}</h2>
            <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground">
              {snap.districtEmoji} {snap.districtName}
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              {snap.weatherEmoji} {snap.weatherLabel}
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              {snap.moodEmoji} {snap.moodLabel}
            </p>
            <p className="mt-1.5 text-xs italic leading-6 text-muted-foreground">
              {snap.cultureEmoji} «{snap.cultureLine}»
            </p>
          </div>
        </div>

        {/* نوارِ آمارِ زنده */}
        <div className="relative mt-3 grid grid-cols-4 gap-1.5">
          <WorldStat emoji="👥" value={faNum(snap.population)} sub={`${faNum(snap.activePlayers)} فعلی`} label={`${faNum(snap.population)} شهروند، ${faNum(snap.activePlayers)} فعال`} />
          <WorldStat emoji="💰" value={faNum(snap.treasury)} sub="صندوق" label={`صندوقِ شهر: ${faNum(snap.treasury)} سکه`} />
          <WorldStat emoji="🌀" value={faPercent(snap.chaos)} sub="آشوب" label={`سطحِ آشوب: ${faPercent(snap.chaos)}`} />
          <WorldStat emoji="🌡" value={snap.socialTempLabel} sub="دمای جمع" aria-live="off" />
        </div>

        <div className="relative mt-2.5 flex flex-wrap items-center gap-1.5">
          {snap.mayor ? (
            <Chip tone="amber">
              👑 {snap.mayor.name}
            </Chip>
          ) : null}
          <Chip tone="violet">{snap.stateLabel}</Chip>
          <Chip tone="teal">🏛 {snap.reputationLabel}</Chip>
        </div>

        {/* چه خبر / چرا برگردی */}
        <div className="relative mt-3 space-y-1 border-t border-white/10 pt-2.5">
          <p className="text-[11px] leading-5 text-foreground/85">
            <span className="font-bold text-primary">⚡ چه خبر:</span> {snap.whatsHappening}
          </p>
          <p className="text-[11px] leading-5 text-muted-foreground">
            <span className="font-bold text-foreground/70">↩️ چرا برگردی:</span> {snap.whyComeBack}
          </p>
        </div>

        {/* تکون بده */}
        <div className="relative mt-2.5 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <p className="text-[11px] leading-4 text-muted-foreground/80">می‌خواهی شهر تکون بخوره؟</p>
          <ActionButton
            size="sm"
            variant="soft"
            className="h-11"
            loading={triggering}
            onClick={onTriggerEvent}
          >
            🎬 یه اتفاق بیفکن
          </ActionButton>
        </div>
      </GlassCard>
    </motion.section>
  )
}

function WorldStat({
  emoji,
  value,
  sub,
  label,
}: {
  emoji: string
  value: string
  sub: string
  label?: string
}) {
  return (
    <div
      className="flex min-w-0 flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] px-1 py-2"
      title={label}
    >
      <span aria-hidden className="text-sm leading-5">
        {emoji}
      </span>
      <span className="w-full truncate text-center text-xs font-bold leading-4 tabular-nums">{value}</span>
      <span className="w-full truncate text-center text-[11px] leading-4 text-muted-foreground">{sub}</span>
    </div>
  )
}
