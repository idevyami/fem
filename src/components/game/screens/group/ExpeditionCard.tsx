"use client"

// V27 — کارتِ کاروانِ شهر در مینی‌اپ: مأموریتِ تعاونی (سهم‌گیری/کنش/تشویق).
// همان زبانِ بصریِ کارت‌های «همین حالا» (رویداد/بازی)؛ کنش‌ها همان پل‌هایِ
// expeditionJoin/Act/Cheerِ موتور‌اند (آینه‌ی gx: ربات رویِ سیمِ session).
// سهمِ بیننده از خودِ DTO می‌آید (myRole/myRoleActed/iCheered) — موتور
// مجوزها را جدا می‌کند؛ این‌جا فقط نمایشِ صادقانه‌ی جایگاهِ شخصی است.
import { motion } from "framer-motion"
import type { GroupExpeditionDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard } from "../../ui"
import { cn } from "@/lib/utils"
import { faCountdown, useNow } from "./time"

interface ExpeditionCardProps {
  ex: GroupExpeditionDTO
  /** کلیدِ کنشِ در جریان (null = بی‌کار) — الگویِ CurrentEventCard */
  acting: string | null
  onJoin: (key: string, expeditionId: string, roleKey: string) => void
  onAct: (key: string, expeditionId: string) => void
  onCheer: (key: string, expeditionId: string) => void
}

export function ExpeditionCard({ ex, acting, onJoin, onAct, onCheer }: ExpeditionCardProps) {
  const now = useNow()
  const recruit = ex.phase === "recruit"
  const until = recruit ? ex.recruitEndsAt : ex.closesAt
  const left = until ? faCountdown(until, now) : null
  const filled = ex.roles.filter((r) => r.holderName).length
  const actedCount = ex.roles.filter((r) => r.acted).length

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
      aria-label="کاروانِ شهر — مأموریتِ تعاونی"
    >
      <GlassCard className="border-emerald-400/25 bg-emerald-500/[0.04]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <span aria-hidden className="mt-0.5 text-3xl leading-none">
              🧭
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm font-extrabold leading-6">{ex.title}</h3>
                <Chip tone="emerald">{ex.phaseLabel}</Chip>
              </div>
              {ex.hook ? (
                <p className="mt-1 line-clamp-3 text-xs italic leading-5 text-foreground/75">{ex.hook}</p>
              ) : null}
            </div>
          </div>
          {left ? (
            <Chip tone="rose" className="shrink-0 tabular-nums">
              ⏳ {left}
            </Chip>
          ) : null}
        </div>

        {/* سهم‌ها — رosterِ زنده */}
        <div className="mt-2.5 flex flex-col gap-1.5">
          <p className="text-[11px] font-bold leading-4 text-muted-foreground">
            🧑‍🤝‍🧑 سهم‌ها — {faNum(filled)} از {faNum(ex.roles.length)} پر
            {!recruit ? ` · ${faNum(actedCount)} کنش انجام شد` : ""}
          </p>
          {ex.roles.map((r) => (
            <div
              key={r.key}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-xl border px-2.5 py-1 text-[12px] leading-5",
                r.holderName
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-dashed border-emerald-400/30 bg-emerald-500/[0.03]",
              )}
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="min-w-0 flex-1 font-semibold">{r.label}</span>
              {r.holderName ? (
                <span className="flex shrink-0 items-center gap-1 text-foreground/85">
                  {r.holderClassEmoji ? <span aria-hidden>{r.holderClassEmoji}</span> : null}
                  <span className="font-bold">{r.holderName}</span>
                  {!recruit ? <span aria-hidden className={r.acted ? "text-emerald-300" : "text-amber-300"}>{r.acted ? "✓" : "⏳"}</span> : null}
                </span>
              ) : (
                <span className="shrink-0 text-[11px] font-bold text-emerald-300">آزاد</span>
              )}
            </div>
          ))}
        </div>

        {/* کنشِ شخصی — همان جایگاهِ تو در کاروان */}
        <div className="mt-3 border-t border-white/10 pt-2.5">
          {recruit && !ex.myRole ? (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] leading-4 text-muted-foreground">سهمِ خودت را بردار — قطعی است و کلاسِ هم‌افزا شانس را بالا می‌برد.</p>
              <div className="grid grid-cols-2 gap-2">
                {ex.roles
                  .filter((r) => !r.holderName)
                  .map((r) => {
                    const key = `expjoin:${ex.id}:${r.key}`
                    const busy = acting === key
                    return (
                      <button
                        key={r.key}
                        type="button"
                        disabled={acting !== null}
                        onClick={() => onJoin(key, ex.id, r.key)}
                        className={cn(
                          "flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 text-[12px] font-bold text-emerald-200 transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 hover:bg-emerald-500/15",
                        )}
                      >
                        {busy ? (
                          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <span aria-hidden>{r.emoji}</span> {r.label}
                          </>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          ) : recruit && ex.myRole ? (
            <p className="text-center text-[11px] font-semibold leading-5 text-emerald-300">
              سهمِ تو ثبت شد — منتظرِ حرکتِ کاروان
            </p>
          ) : !recruit && ex.myRole ? (
            ex.myRoleActed ? (
              <p className="text-center text-[11px] font-semibold leading-5 text-emerald-300">
                ✓ کنشِ سهمِ تو انجام شد — نتیجه با رسیدنِ کاروان می‌آید
              </p>
            ) : (
              <ActionButton
                variant="success"
                size="sm"
                fullWidth
                loading={acting === `expact:${ex.id}`}
                onClick={() => onAct(`expact:${ex.id}`, ex.id)}
              >
                🎯 کنشِ سهمِ خودت
              </ActionButton>
            )
          ) : ex.iCheered ? (
            <p className="text-center text-[11px] font-semibold leading-5 text-emerald-300">
              📣 تشویقت رسید — کاروان قوت گرفت
            </p>
          ) : (
            <ActionButton
              variant="soft"
              size="sm"
              fullWidth
              loading={acting === `expcheer:${ex.id}`}
              onClick={() => onCheer(`expcheer:${ex.id}`, ex.id)}
            >
              📣 تشویقِ کاروان
            </ActionButton>
          )}
          <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground/80">
            کاروانِ کامل با هم می‌رود یا با هم می‌ماند — تشویقِ بقیه شانس را بالا می‌برد.
          </p>
        </div>
      </GlassCard>
    </motion.section>
  )
}
