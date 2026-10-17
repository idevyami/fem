"use client"

// دعوت‌های دوئل — بخشِ فوریِ تبِ گروه (V14 موجِ 16b).
// داده از challenges در اسنپ‌شات می‌آید (GroupChallengeDTO)؛ کنش‌ها با اکشنِ
// «challenge» رویِ /api/group/action می‌روند — همانِ gc: ربات، رویِ سیمِ session.
// نقش‌آگاه: هدف دکمه‌ی قبول/رد دارد، مهاجم لغو، تماشاچی فقط تماشا.
import * as React from "react"
import { motion } from "framer-motion"
import type { GroupChallengeDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { ActionButton, Chip, EmptyState, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { faCountdown, useNow } from "./time"

interface ChallengesSectionProps {
  challenges: GroupChallengeDTO[]
  /** کلیدِ کنشِ در جریان (null = بی‌کار) */
  acting: string | null
  onAct: (key: string, challengeId: string, verb: "accept" | "decline" | "cancel") => void
}

/** برچسبِ فارسیِ وضعیت — برای ردیف‌های تاریخچه */
const STATUS_LABEL: Record<string, string> = {
  accepted: "پذیرفته شد",
  declined: "رد شد",
  cancelled: "لغو شد",
  expired: "منقضی شد",
  resolved: "تمام شد",
}

function statusTone(status: string): "emerald" | "rose" | "amber" | "default" {
  if (status === "resolved" || status === "accepted") return "emerald"
  if (status === "declined" || status === "cancelled") return "rose"
  if (status === "expired") return "amber"
  return "default"
}

export function ChallengesSection({ challenges, acting, onAct }: ChallengesSectionProps) {
  const now = useNow()
  const pending = challenges.filter((c) => c.status === "pending")
  const history = challenges.filter((c) => c.status !== "pending").slice(0, 8)
  const trimmed = challenges.filter((c) => c.status !== "pending").length - history.length

  return (
    <section aria-label="دعوت‌های دوئل">
      <SectionTitle
        icon="⚔️"
        title="دوئل‌ها"
        action={<Chip tone={pending.length > 0 ? "rose" : "default"}>{faNum(pending.length)}</Chip>}
      />

      {pending.length === 0 && history.length === 0 ? (
        <GlassCard pad="sm">
          <EmptyState
            emoji="🕊"
            text="هیچ دوئلی در انتظار نیست — آرام است… فعلاً."
            hint="دوئل از توی خودِ گروه شروع می‌شه: روی پیامِ حریف reply بزن و «جنگ فمبوی» بگو."
          />
        </GlassCard>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {pending.map((c, i) => {
          const left = faCountdown(c.expiresAt, now)
          const key = (verb: string) => `challenge:${c.id}:${verb}`
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07, ease: "easeOut" }}
            >
              <GlassCard className={cn(c.myRole === "target" && "border-primary/30")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-6">⚔️ دعوتِ دوئل</h3>
                    <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">
                      <span className="font-semibold text-foreground/85">{c.challengerName}</span>
                      {" در برابرِ "}
                      <span className="font-semibold text-foreground/85">{c.targetName}</span>
                    </p>
                  </div>
                  {left ? (
                    <Chip className="shrink-0 tabular-nums">⏳ {left}</Chip>
                  ) : (
                    <Chip tone="amber" className="shrink-0">
                      در حالِ انقضا
                    </Chip>
                  )}
                </div>

                {c.myRole === "target" ? (
                  <>
                    <p className="mt-2 text-[11px] leading-5 text-primary">تو را به نبرد خوانده‌اند — جواب با توست.</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      <ActionButton
                        size="sm"
                        variant="success"
                        className="h-11"
                        loading={acting === key("accept")}
                        disabled={acting !== null}
                        onClick={() => onAct(key("accept"), c.id, "accept")}
                      >
                        قبول می‌کنم
                      </ActionButton>
                      <ActionButton
                        size="sm"
                        variant="danger"
                        className="h-11"
                        loading={acting === key("decline")}
                        disabled={acting !== null}
                        onClick={() => onAct(key("decline"), c.id, "decline")}
                      >
                        رد می‌کنم
                      </ActionButton>
                    </div>
                  </>
                ) : c.myRole === "challenger" ? (
                  <>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      دعوتِ توست — تا جواب نرسد شهر نفسش را حبس کرده.
                    </p>
                    <ActionButton
                      size="sm"
                      variant="danger"
                      className="mt-2.5 h-11"
                      fullWidth
                      loading={acting === key("cancel")}
                      disabled={acting !== null}
                      onClick={() => onAct(key("cancel"), c.id, "cancel")}
                    >
                      پس می‌گیرم
                    </ActionButton>
                  </>
                ) : (
                  <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                    این دوئل هنوز منتظرِ جواب است — تو تماشاچی‌ای.
                  </p>
                )}
              </GlassCard>
            </motion.div>
          )
        })}
      </div>

      {/* تاریخچه‌ی فشرده — برنده با 🏆 */}
      {history.length > 0 ? (
        <div className="mt-2.5">
          <ul className="flex flex-col gap-1.5" aria-label="دوئل‌های گذشته">
            {history.map((c) => (
              <li
                key={c.id}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[11px]"
              >
                <span className="min-w-0 truncate leading-5 text-foreground/80">
                  <span className="font-semibold">{c.challengerName}</span> × <span className="font-semibold">{c.targetName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {c.winnerName ? (
                    <Chip tone="amber" className="tabular-nums">
                      🏆 {c.winnerName}
                    </Chip>
                  ) : null}
                  <Chip tone={statusTone(c.status)}>{STATUS_LABEL[c.status] ?? c.status}</Chip>
                </span>
              </li>
            ))}
          </ul>
          {trimmed > 0 ? (
            <p className="mt-1.5 text-end text-[10px] leading-4 text-muted-foreground/70 tabular-nums">
              و {faNum(trimmed)} دوئلِ قدیمی‌تر در دفترِ شهر.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
