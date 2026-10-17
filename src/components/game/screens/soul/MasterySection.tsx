"use client"

// V10 فمبوی — سکشنِ کلاس-تسلط: تیرِ فعلی، نوارِ XP، کارهای واجدشرطِ اخیر
import * as React from "react"
import { motion } from "framer-motion"
import type { SoulCardDTO } from "@/lib/game/contract"
import { faNum } from "../../fa"
import { Chip, EmptyState, GlassCard, ProgressBar, SectionTitle } from "../../ui"
import { masteryProgress } from "./classMeta"

const MASTERY_EXPLAINER =
  "تسلط از استفاده‌ی واقعیِ مکانیک‌های کلاس می‌آید — پیروزی، مهارتِ امضا، اتفاقاتِ هم‌مسیر، فرگشت. سقفِ روزانه دارد."

export function MasterySection({ card }: { card: SoulCardDTO }) {
  const m = card.mastery
  const prog = masteryProgress(m.xp, m.level, m.nextTierXp)

  return (
    <div className="flex flex-col gap-4">
      {/* ── تیرِ فعلی ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <GlassCard className="border-amber-400/20">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid size-14 shrink-0 place-items-center rounded-2xl border border-amber-400/25 bg-amber-500/10 text-3xl leading-none"
            >
              {m.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-extrabold leading-7">{m.label}</p>
              <p className="mt-0.5 text-[11px] font-bold leading-5 text-amber-200/90">🎓 سطحِ تسلط {faNum(m.level)}</p>
            </div>
            <Chip tone="amber" className="shrink-0 font-bold">
              {faNum(m.xp)} XP
            </Chip>
          </div>

          {/* نوارِ XP تا تیرِ بعد */}
          <div className="mt-3">
            {m.nextTierXp === null ? (
              <p className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-center text-[11px] font-bold leading-5 text-amber-200">
                👑 سقفِ تسلط — افسانه‌ی کلاسِ خودت هستی.
              </p>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between gap-2 text-[11px] leading-4">
                  <span className="shrink-0 font-bold">تا تیرِ بعد</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {faNum(Math.max(0, m.nextTierXp - m.xp))} تسلط دیگر
                  </span>
                </div>
                <ProgressBar
                  value={prog.value}
                  max={prog.max}
                  barClassName="bg-amber-300"
                  label={`پیشرفتِ تسلط تا سطحِ ${faNum(m.level + 1)}`}
                />
              </>
            )}
          </div>

          {/* پَرکِ تیر */}
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <p className="text-[11px] font-bold leading-4 text-muted-foreground">پاداشِ این تیر</p>
            <p className="mt-1 text-xs leading-5 text-foreground/85">{m.perk === "—" ? "هنوز پاداشی در این تیر نیست — راه دراز است." : m.perk}</p>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── کارهای واجدشرطِ اخیر ── */}
      <GlassCard>
        <SectionTitle icon="📆" title="کارهای واجدشرطِ اخیر" />
        {m.recentProofs.length === 0 ? (
          <EmptyState emoji="🌱" text="امروز هنوز کاری واجدشرط نکرده" hint="برد با کلاس، مهارتِ امضا، اتفاقاتِ هم‌مسیر — شهر همه را می‌شمارد." />
        ) : (
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto scrollbar-thin pe-1">
            {m.recentProofs.map((p, i) => (
              <motion.li
                key={`${i}-${p}`}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.22 }}
                className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-foreground/80"
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-amber-300">
                  ·
                </span>
                <span className="min-w-0">{p}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </GlassCard>

      {/* ── توضیحِ ثابت ── */}
      <GlassCard pad="sm">
        <div className="flex items-start gap-2.5">
          <span aria-hidden className="mt-0.5 shrink-0 text-base leading-6">
            🎓
          </span>
          <p className="text-[11px] leading-5 text-muted-foreground">{MASTERY_EXPLAINER}</p>
        </div>
      </GlassCard>
    </div>
  )
}
