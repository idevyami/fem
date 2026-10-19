"use client"

// V17-W2 (F1) — کارتِ نتیجه‌ی اکشنِ پیشخوان (کار / استراحت / بینگو / گرفتنِ فرصت / …):
// همان زبانِ بصریِ OutcomeReveal اتفاق‌ها — پیام + خطِ طعم + دلتاها با رنگِ لحنِ موتور +
// «چی یعنی؟» + «قدمِ بعدی» — اما جمع‌وجور و با دکمه‌ی بستن (X) به‌جایِ «ادامه».
// نه مودال — کارتِ درون‌صفحه‌ای، هم‌قدِ کارتِ اتفاق (جایگزینِ توستِ ۳.۵ ثانیه‌ای).
import { motion } from "framer-motion"
import { X } from "lucide-react"
import type { ActionResponse } from "@/lib/game/contract"
import { faSigned } from "./fa"
import { OutcomeMeaningsCollapsible, OutcomeNextStepRow, TONE_TEXT } from "./EventCard"
import type { OutcomeNextStep } from "./ui/outcomeMeta"
import { cn } from "@/lib/utils"

interface ActionOutcomeCardProps {
  /** پاسخِ کاملِ اکشن از موتور — message/flavor/deltas */
  data: ActionResponse
  /** قدمِ بعدی از snapshotِ تازه (HomeScreen می‌سازدش؛ null = ردیف نمی‌نشیند) */
  nextStep?: OutcomeNextStep | null
  /** بستنِ کارت (دکمه‌ی X) */
  onDismiss: () => void
}

export function ActionOutcomeCard({ data, nextStep, onDismiss }: ActionOutcomeCardProps) {
  return (
    <motion.section
      aria-label="نتیجه"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="glass-strong relative overflow-hidden"
    >
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{ background: "linear-gradient(to left, transparent, #f472b6cc, transparent)" }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-lg">
            🪄
          </span>
          <h3 className="text-sm font-bold text-primary">نتیجه</h3>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="بستنِ نتیجه"
            className="-mt-1 -me-1 ms-auto flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-2 whitespace-pre-line text-[14.5px] font-medium leading-8 text-foreground"
        >
          {data.message}
        </motion.p>

        {data.flavor ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="mt-1 text-[11px] italic leading-5 text-muted-foreground"
          >
            {data.flavor}
          </motion.p>
        ) : null}

        {data.deltas.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-3">
            {data.deltas.map((d, i) => (
              <motion.div
                key={`${d.label}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.25 }}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="flex items-center gap-1.5 text-foreground/80">
                  <span aria-hidden>{d.icon}</span>
                  {d.label}
                </span>
                <span className={cn("font-bold tabular-nums", TONE_TEXT[d.tone])}>{faSigned(d.amount)}</span>
              </motion.div>
            ))}

            {/* «یعنیِ این عدد» — همان کامپوننتِ مشترکِ کارتِ اتفاق (F3) */}
            <OutcomeMeaningsCollapsible deltas={data.deltas} delay={0.45} />
          </div>
        ) : null}

        {nextStep ? <OutcomeNextStepRow nextStep={nextStep} delay={0.7} /> : null}
      </div>
    </motion.section>
  )
}
