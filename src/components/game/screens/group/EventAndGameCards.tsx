"use client"

// کارت‌های «همین حالا» — رویدادِ جاری و بازیِ در جریان
// V17-W3 (F2): گزینه‌های رویدادِ جاری دیگر چیپِ نمایشی نیستند — دکمه‌های زنده‌ی
// انتخاب با همان زبانِ بصریِ رأی‌گیری‌های باز (VotesSection)؛ همان chooseEventِ
// موتور که پلِ ge: ربات هم می‌زند (دروازه‌ی شهروندی داخلِ خودش است).
import { motion } from "framer-motion"
import type { GameSessionDTO, GroupEventDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard } from "../../ui"
import { cn } from "@/lib/utils"
import { faCountdown, useNow } from "./time"

/** کلاسِ دکمه‌ی گزینه — همان الگویِ دکمه‌های زنده‌ی رأی (VotesSection.voteOptionClass) */
function choiceOptionClass(style: string | null, mine: boolean): string {
  switch (style) {
    case "success":
      return cn("border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15", mine && "ring-1 ring-emerald-300/60")
    case "danger":
      return cn("border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15", mine && "ring-1 ring-rose-300/60")
    default:
      return cn("border-primary/30 bg-primary/10 text-primary hover:bg-primary/15", mine && "ring-1 ring-primary/70")
  }
}

interface CurrentEventCardProps {
  ev: GroupEventDTO
  /** کلیدِ کنشِ در جریان (null = بی‌کار) — الگویِ VotesSection */
  acting: string | null
  /** V17-W3 (F2) — انتخابِ همین‌جا: همان chooseEventِ موتور (پلِ ge: ربات) */
  onChoose: (key: string, eventId: string, choiceKey: string) => void
}

/** رویدادِ جاری — انتخاب‌ها دکمه‌های زنده‌اند (V17-W3 · F2)؛ انتخاب‌شده «انتخابِ تو»
 *  می‌گیرد و قفل می‌شود (انتخابِ دوباره موتور رد می‌کند — ackِ همان را توست می‌گیرد). */
export function CurrentEventCard({ ev, acting, onChoose }: CurrentEventCardProps) {
  const now = useNow()
  const left = faCountdown(ev.expiresAt, now)
  const expired = ev.expiresAt !== null && left === null
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
            {/* گزینه‌ها — دکمه‌های زنده‌ی انتخاب (V17-W3 · F2): همان زبانِ رأی‌گیری‌های باز */}
            <div className="mt-2.5 flex flex-col gap-2">
              {ev.choices.map((c) => {
                const mine = ev.myChoice === c.key
                const key = `choose:${ev.id}:${c.key}`
                const busy = acting === key
                return (
                  <button
                    key={c.key}
                    type="button"
                    disabled={acting !== null || mine || expired}
                    onClick={() => onChoose(key, ev.id, c.key)}
                    aria-pressed={mine}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-start text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none",
                      choiceOptionClass(c.style, mine),
                      // انتخابِ تو پررنگ می‌ماند (فقط قفل است)؛ بقیه در حالتِ کار/پایان کم‌رنگ
                      mine ? "cursor-default" : "disabled:opacity-50",
                    )}
                  >
                    <span className="min-w-0 flex-1 leading-5">{c.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {mine ? (
                        <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[11px] font-bold leading-4">انتخابِ تو</span>
                      ) : null}
                      {busy ? (
                        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : c.voters > 0 ? (
                        <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-bold leading-4 tabular-nums">
                          {faNum(c.voters)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )}
              )}
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground/80">
              {ev.myChoice
                ? "انتخابت ثبت شد. عاقبتش را در پایانِ کارت ببین."
                : expired
                  ? "وقتش تمام شد — انتخابِ تازه ثبت نمی‌شود."
                  : "انتخابت همین‌جا ثبت می‌شود — یا با دکمه‌های ربات در گروه."}
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
