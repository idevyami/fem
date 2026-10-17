"use client"

// کارت‌های «همین حالا» — رویدادِ جاری و بازیِ در جریان
import { motion } from "framer-motion"
import type { GameSessionDTO, GroupEventDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard } from "../../ui"
import { cn } from "@/lib/utils"
import { faCountdown, useNow } from "./time"

/** رنگِ خنثیِ گزینه‌ها بر اساسِ استایلِ موتور */
const CHOICE_TONE: Record<string, string> = {
  success: "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-200",
  danger: "border-rose-400/25 bg-rose-500/[0.07] text-rose-200",
  primary: "border-primary/30 bg-primary/[0.08] text-primary",
}

/** رویدادِ جاری — انتخاب‌ها فقط نمایشی‌اند؛ انتخاب از دکمه‌های ربات در گروه */
export function CurrentEventCard({ ev }: { ev: GroupEventDTO }) {
  const now = useNow()
  const left = faCountdown(ev.expiresAt, now)
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06, ease: "easeOut" }}
      aria-label="رویدادِ جاریِ گروه"
    >
      <GlassCard className="border-amber-400/25 bg-amber-500/[0.04]">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-3xl leading-none">
            {ev.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-extrabold leading-6">{ev.title}</h3>
              <Chip tone="amber">{ev.kindLabel}</Chip>
            </div>
            <p className="mt-1 text-xs leading-6 text-foreground/80">{ev.body}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>👥 {faNum(ev.participantsCount)} در ماجرا</span>
              {left ? (
                <span className="tabular-nums">⏳ {left} مونده</span>
              ) : (
                <span>⌛ وقتش تمام شد — منتظرِ محاسبه</span>
              )}
            </div>
            {/* گزینه‌ها — فقط نمایش */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ev.choices.map((c) => (
                <span
                  key={c.key}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold",
                    CHOICE_TONE[c.style ?? ""] ?? "border-white/10 bg-white/[0.04] text-foreground/75",
                  )}
                >
                  {c.label}
                  {c.voters > 0 ? (
                    <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-foreground/70">
                      {faNum(c.voters)}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground/80">
              برای انتخاب، دکمه‌های ربات را در گروه بزن.
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.section>
  )
}

interface ActiveGameCardProps {
  game: GameSessionDTO
  myPlayerId: string | null
  joining: boolean
  onJoin: (sessionId: string) => void
}

/** بازیِ در جریان — ثبت‌نام تا وقتی لابی باز است */
export function ActiveGameCard({ game, myPlayerId, joining, onJoin }: ActiveGameCardProps) {
  const now = useNow()
  const left = faCountdown(game.closesAt, now)
  const joined = myPlayerId ? game.participants.some((p) => p.playerId === myPlayerId) : false
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
      aria-label="بازیِ در جریان"
    >
      <GlassCard className="border-violet-400/25 bg-violet-500/[0.04]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden className="mt-0.5 text-3xl leading-none">
              {game.emoji}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-extrabold leading-6">{game.name}</h3>
                <Chip tone="violet">{game.phaseLabel}</Chip>
              </div>
              {game.subject ? (
                <p className="mt-1 text-xs italic leading-5 text-foreground/80">موضوع: {game.subject}</p>
              ) : null}
            </div>
          </div>
          {left ? (
            <Chip tone="rose" className="shrink-0 tabular-nums">
              ⏳ {left}
            </Chip>
          ) : null}
        </div>

        {/* شرکت‌کنندگان */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {game.participants.length === 0 ? (
            <span className="text-[11px] leading-5 text-muted-foreground">هنوز کسی ثبت‌نام نکرده. اولین باش.</span>
          ) : (
            game.participants.map((p) => (
              <span
                key={p.playerId}
                className={cn(
                  "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                  p.playerId === myPlayerId
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-white/10 bg-white/[0.04] text-foreground/75",
                )}
              >
                <span aria-hidden>{p.avatar}</span> {p.name}
              </span>
            ))
          )}
        </div>

        {game.phase === "lobby" ? (
          <div className="mt-3 border-t border-white/10 pt-2.5">
            {joined ? (
              <p className="text-center text-[11px] font-semibold leading-5 text-emerald-300">
                ✋ اسمت ثبت شده — منتظرِ بقیه
              </p>
            ) : (
              <ActionButton variant="success" size="sm" fullWidth loading={joining} onClick={() => onJoin(game.id)}>
                ✋ ثبت‌نام در بازی
              </ActionButton>
            )}
          </div>
        ) : (
          <p className="mt-2.5 border-t border-white/10 pt-2.5 text-[11px] leading-4 text-muted-foreground/80">
            بازی شروع شده — ادامه‌اش در خودِ گروه.
          </p>
        )}
      </GlassCard>
    </motion.section>
  )
}
