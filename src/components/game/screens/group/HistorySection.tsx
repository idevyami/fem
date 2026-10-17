"use client"

// تاریخِ شهر (تایم‌لاینِ عمودی) و معماها
import { motion } from "framer-motion"
import type { GroupHistoryDTO, GroupMysteryDTO } from "@/lib/game/group/types"
import { faNum, faTimeAgo } from "../../fa"
import { Chip, GlassCard, ProgressBar, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

export function HistoryTimeline({ history }: { history: GroupHistoryDTO[] }) {
  if (history.length === 0) return null
  return (
    <section aria-label="تاریخِ شهر">
      <SectionTitle icon="📜" title="تاریخِ شهر" />
      <GlassCard>
        <ol className="flex flex-col gap-4 border-s border-white/10 ps-4">
          {history.map((h, i) => (
            <motion.li
              key={h.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.05, ease: "easeOut" }}
              className="relative"
            >
              {/* نقطه روی خط */}
              <span
                aria-hidden
                className="absolute top-1.5 start-[-21px] size-2.5 rounded-full bg-primary/70 ring-4 ring-background"
              />
              <div className="flex items-start gap-2">
                <span aria-hidden className="text-base leading-6">
                  {h.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] leading-5 text-foreground/85">{h.text}</p>
                  <time className="text-[11px] leading-4 text-muted-foreground">{faTimeAgo(h.createdAt)}</time>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      </GlassCard>
    </section>
  )
}

const MYSTERY_UI: Record<string, { label: string; tone: "default" | "violet" | "emerald" }> = {
  dormant: { label: "خواب", tone: "default" },
  active: { label: "فعال", tone: "violet" },
  solved: { label: "حل‌شده", tone: "emerald" },
}

export function MysteriesSection({ mysteries }: { mysteries: GroupMysteryDTO[] }) {
  if (mysteries.length === 0) return null
  return (
    <section aria-label="معماها">
      <SectionTitle icon="🕯" title="معماها" />
      <div className="flex flex-col gap-2.5">
        {mysteries.map((m, i) => {
          const ui = MYSTERY_UI[m.status] ?? { label: m.status, tone: "default" as const }
          const solved = m.status === "solved"
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
            >
              <GlassCard pad="sm" className={cn(solved && "opacity-75")}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="mt-0.5 text-2xl leading-none">
                    {m.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm font-bold leading-6">{m.title}</h3>
                      <Chip tone={ui.tone}>{ui.label}</Chip>
                    </div>
                    {m.hook ? (
                      <p className="mt-1 text-[11px] italic leading-5 text-muted-foreground">{m.hook}</p>
                    ) : null}
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar
                        value={m.progress}
                        max={m.cluesTotal}
                        barClassName={solved ? "bg-emerald-400" : "bg-violet-400"}
                        label={`سرنخ‌های ${m.title}`}
                        className="h-1"
                      />
                      <span className="shrink-0 text-[11px] leading-4 text-muted-foreground tabular-nums">
                        {faNum(m.progress)}/{faNum(m.cluesTotal)} سرنخ
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
