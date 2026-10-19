"use client"

// V8 فمبوی — سکشنِ سابقه: سرگذشتِ فمبوی
// V17-W2 (F4): حالتِ خالی بن‌بست نیست — «اولین تعامل را انجام بده» به سکشنِ اقدامات می‌رود.
import * as React from "react"
import { motion } from "framer-motion"
import type { CharacterLogDTO } from "@/lib/game/contract"
import { faTimeAgo, faNum } from "../../fa"
import { ActionButton, EmptyState, GlassCard, SectionTitle } from "../../ui"

export function HistorySection({ logs, onGoActions }: { logs: CharacterLogDTO[]; onGoActions?: () => void }) {
  return (
    <GlassCard>
      <SectionTitle icon="🕰" title={`سابقه‌ی فمبوی${logs.length ? ` · ${faNum(logs.length)} خط` : ""}`} />
      {logs.length === 0 ? (
        <EmptyState
          emoji="🌙"
          text="هنوز چیزی ننوشته شده."
          hint="فمبوی که متولد شود، شهر شروع می‌کند به نوشتن."
          action={
            onGoActions ? (
              <ActionButton variant="soft" size="sm" onClick={onGoActions}>
                اولین تعامل را انجام بده
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto scrollbar-thin pe-1">
          {logs.map((l, i) => (
            <motion.li
              key={l.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.25 }}
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <span aria-hidden className="mt-0.5 text-base leading-6">
                {l.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-6 text-foreground/85">{l.text}</p>
                <time className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{faTimeAgo(l.at)}</time>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </GlassCard>
  )
}
