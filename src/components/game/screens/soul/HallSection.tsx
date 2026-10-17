"use client"

// V8 فمبوی — تالارِ افتخارات: پنج تابلو، مدال‌ها، افسانه‌ها
import * as React from "react"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { HallDTO, HallEntryDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

/** مدالِ رتبه — سه‌تای اول طلا/نقره/برنز، بقیتی عدد */
function medalOf(rank: number): string {
  if (rank === 1) return "🥇"
  if (rank === 2) return "🥈"
  if (rank === 3) return "🥉"
  return faNum(rank)
}

export function HallSection({ active }: { active: boolean }) {
  const [board, setBoard] = React.useState("level")
  const [hall, setHall] = React.useState<HallDTO | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [tick, setTick] = React.useState(0)

  // واکشی فقط وقتی خودِ سکشنِ تالار باز است — مثلِ الگویِ راهنما
  React.useEffect(() => {
    if (!active) return
    let alive = true
    setLoading(true)
    setError(null)
    void api.hall(board).then((res) => {
      if (!alive) return
      if (res.ok) setHall(res.data)
      else setError(res.error)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [active, board, tick])

  return (
    <GlassCard>
      <SectionTitle icon="🏆" title="تالارِ افتخارات" action={hall ? <Chip tone="amber">{hall.boardLabel}</Chip> : undefined} />

      {/* تابلوی‌ها */}
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="تابلوهای تالار">
        {(hall?.boards ?? [{ key: "level", label: "سطح", icon: "⭐" }]).map((b) => {
          const isOn = b.key === board
          return (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => setBoard(b.key)}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors",
                isOn
                  ? "border-amber-400/30 bg-amber-500/15 text-amber-200"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden>{b.icon}</span>
              {b.label}
            </button>
          )
        })}
      </div>

      {loading && !hall ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-xs leading-6 text-muted-foreground">{error}</p>
          <ActionButton variant="soft" size="sm" onClick={() => setTick((t) => t + 1)}>
            دوباره
          </ActionButton>
        </div>
      ) : hall ? (
        hall.entries.length === 0 ? (
          <p className="py-6 text-center text-xs leading-6 text-muted-foreground">
            {hall.note || "هنوز کسی اسمش را روی تابلو ننوشته — اولین باش."}
          </p>
        ) : (
          <>
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto scrollbar-thin pe-1">
              {hall.entries.map((e, i) => (
                <HallEntryRow key={`${e.rank}-${e.characterName}`} entry={e} idx={i} />
              ))}
            </ul>
            {hall.note ? (
              <p className="mt-2.5 text-center text-[11px] leading-4 text-muted-foreground">{hall.note}</p>
            ) : null}
          </>
        )
      ) : null}
    </GlassCard>
  )
}

// ─── ردیفِ تالار (سنگین — memo با امضای محتوا) ───────────────────────────

const HallEntryRow = React.memo(
  function HallEntryRow({ entry, idx }: { entry: HallEntryDTO; idx: number }) {
    const top = entry.rank <= 3
    return (
      <motion.li
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.25 }}
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5",
          top ? "border-amber-400/25 bg-amber-500/[0.06]" : "border-white/10 bg-white/[0.03]",
        )}
      >
        <span
          aria-hidden
          className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-black tabular-nums", top && "bg-amber-500/15")}
        >
          {medalOf(entry.rank)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold leading-5">
            <span aria-hidden className="me-1">
              {entry.classEmoji}
            </span>
            {entry.characterName}
            <span aria-hidden className="ms-1">
              {entry.evolutionEmoji}
            </span>
          </p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {entry.playerAvatar} {entry.playerName} · {entry.className}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-bold tabular-nums">
          {entry.valueLabel}
        </span>
      </motion.li>
    )
  },
  (a, b) =>
    a.entry.rank === b.entry.rank &&
    a.entry.characterName === b.entry.characterName &&
    a.entry.valueLabel === b.entry.valueLabel &&
    a.entry.playerName === b.entry.playerName &&
    a.idx === b.idx,
)
