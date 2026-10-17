"use client"

// رأی‌گیری‌های باز — دکمه‌های زنده با شمارشِ لحظه‌ای
import { motion } from "framer-motion"
import type { GroupVoteDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { Chip, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { faCountdown, useNow } from "./time"

interface VotesSectionProps {
  votes: GroupVoteDTO[]
  /** کلیدِ کنشِ در جریان (null = بی‌کار) */
  acting: string | null
  onVote: (key: string, voteId: string, optionKey: string) => void
}

function voteOptionClass(style: string | null, mine: boolean): string {
  switch (style) {
    case "success":
      return cn("border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15", mine && "ring-1 ring-emerald-300/60")
    case "danger":
      return cn("border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15", mine && "ring-1 ring-rose-300/60")
    default:
      return cn("border-primary/30 bg-primary/10 text-primary hover:bg-primary/15", mine && "ring-1 ring-primary/70")
  }
}

export function VotesSection({ votes, acting, onVote }: VotesSectionProps) {
  const now = useNow()
  if (votes.length === 0) return null
  return (
    <section aria-label="رأی‌گیری‌های باز">
      <SectionTitle icon="🗳" title="رأی‌گیری‌های باز" action={<Chip tone="pink">{faNum(votes.length)}</Chip>} />
      <div className="flex flex-col gap-3">
        {votes.map((v, i) => {
          const left = faCountdown(v.closesAt, now)
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07, ease: "easeOut" }}
            >
              <GlassCard>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 text-sm font-bold leading-6">{v.subject}</h3>
                  {left ? (
                    <Chip className="shrink-0 tabular-nums">⏳ {left}</Chip>
                  ) : (
                    <Chip tone="rose" className="shrink-0">
                      بسته شد
                    </Chip>
                  )}
                </div>
                <div className="mt-2.5 flex flex-col gap-2">
                  {v.options.map((o) => {
                    const mine = v.myVote === o.key
                    const key = `vote:${v.id}:${o.key}`
                    const busy = acting === key
                    return (
                      <button
                        key={o.key}
                        type="button"
                        disabled={acting !== null}
                        onClick={() => onVote(key, v.id, o.key)}
                        className={cn(
                          "flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-start text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
                          voteOptionClass(o.style, mine),
                        )}
                      >
                        <span className="min-w-0 flex-1 leading-5">{o.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {mine ? (
                            <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[11px] font-bold leading-4">رأیِ تو</span>
                          ) : null}
                          {busy ? (
                            <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold leading-4 tabular-nums">
                              {faNum(o.count)}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-2 text-[11px] leading-4 text-muted-foreground/80">
                  رأیت قابلِ تغییر است تا وقتِ بسته‌شدن.
                </p>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
