"use client"

// «مسیرِ زندگی» — مقطع، جهت، هدف‌ها و قدمِ بعدی از راهنمای V4
// + نوارِ «فرصت‌ها» با شیتِ جزئیات و گرفتنِ واقعی
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { NextActionDTO, OpportunityDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../../store"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, GlassSheet, ProgressBar, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

/** ایموجیِ محله → کلیدِ محله (برای سفرِ مستقیم از قدمِ بعدی) */
const DISTRICT_BY_EMOJI: Record<string, string> = {
  "🏛": "center",
  "🏚": "old_town",
  "🏪": "bazaar",
  "🏭": "industrial",
  "💎": "luxury",
  "🌳": "park",
  "🌾": "suburbs",
  "☢": "forbidden",
}

const OPP_RISK: Record<OpportunityDTO["claimStyle"], { marks: string; label: string; hint: string }> = {
  safe: { marks: "", label: "بی‌خطر", hint: "شهر تضمینش کرده. به قدر کافی." },
  risky: { marks: "⚠", label: "پرخطر", hint: "نصفِ شانس، نصفِ سرنوشت." },
  wild: { marks: "⚠⚠", label: "وحشی", hint: "هیچ‌کس جوابش را نمی‌داند. حتی ما." },
}

const NEXT_TONE_VARIANT: Record<NextActionDTO["tone"], "soft" | "glass" | "danger"> = {
  good: "soft",
  info: "glass",
  warn: "danger",
}

export function DirectionCard({ onDrawEvent }: { onDrawEvent: () => void }) {
  const snapshot = useGame((s) => s.snapshot)
  const guide = useGame((s) => s.guide)
  const setGuide = useGame((s) => s.setGuide)
  const runAction = useGame((s) => s.runAction)
  const setActiveTab = useGame((s) => s.setActiveTab)
  const activeTab = useGame((s) => s.activeTab)
  // V16-2 (ممیزیِ ⑧): راهنما فقط با اکشن/رویدادِ موفق (worldVersion) یا عوض‌شدنِ روز
  // دوباره خوانده می‌شود — نه با هر تیکِ serverTime که با هر snapshot عوض می‌شود
  const worldVersion = useGame((s) => s.worldVersion)
  const dayCount = snapshot?.world.dayCount

  const [goalsOpen, setGoalsOpen] = React.useState(false)
  const [oppSheet, setOppSheet] = React.useState<OpportunityDTO | null>(null)
  const [claiming, setClaiming] = React.useState(false)
  const [acting, setActing] = React.useState<string | null>(null)

  // واکشی راهنما (≈15 کوئری سنگین) — فقط وقتی خودِ پیشخوان فعال است:
  // اولِ کار، بعد از هر اکشن/رویدادِ موفق (نسخه‌ی دنیا)، با عوض‌شدنِ روز، و دوباره با
  // برگشتن به تبِ خانه. در بقیه‌ی تب‌ها هیچ درخواستی نمی‌رود.
  // خطا → همان اسکلتون می‌ماند؛ با برگشتن به تب یا نسخه‌ی تازه‌ی دنیا دوباره تلاش می‌شود
  React.useEffect(() => {
    if (activeTab !== "home") return
    let alive = true
    void api.guide().then((res) => {
      if (res.ok && alive) setGuide(res.data)
    })
    return () => {
      alive = false
    }
  }, [setGuide, activeTab, worldVersion, dayCount])

  // راهنما هنوز نیامده — اسکلتونِ هم‌قدِ کارتِ مسیر، نه ناپدیدشدگیِ خاموش
  if (!guide) {
    return (
      <GlassCard aria-busy="true" aria-label="در حالِ خواندنِ مسیرِ زندگی">
        <SectionTitle icon="🧭" title="مسیرِ زندگی" />
        <div className="flex flex-col gap-2.5">
          <div className="h-5 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/10" />
        </div>
      </GlassCard>
    )
  }

  const visibleGoals = goalsOpen ? guide.goals : guide.goals.slice(0, 3)
  const hiddenGoalCount = guide.goals.length - 3

  /** گرفتنِ فرصت — از شیت یا از قدمِ بعدی */
  async function claimOpp(opportunityId: string) {
    if (claiming || acting) return
    setClaiming(true)
    const ok = await runAction("claimOpportunity", { opportunityId })
    setClaiming(false)
    if (ok) {
      setOppSheet(null)
      // راهنما با اکشنِ موفق (نسخه‌ی دنیا) از همان افکتِ بالا تازه می‌شود — واکشیِ دوباره‌یِ دستی ممنوع
    }
  }

  /** اجرای قدمِ بعدی — همه‌ی شناسه‌هایی که موتور پیشنهاد می‌دهد */
  async function runNext(a: NextActionDTO) {
    if (acting) return
    const finish = () => setActing(null)

    // کار و استراحت — مستقیم
    if (a.id === "work" || a.id === "rest" || a.id === "payDebt") {
      setActing(a.id)
      await runAction(a.id)
      finish()
      return
    }

    // رویداد — هم فعال (انتخاب را نهایی کن) هم تازه (یک اتفاق بکش)
    if (a.id === "event" || a.id === "draw-event") {
      onDrawEvent()
      return
    }

    // حیوانِ گرسنه → کیف (توصیه‌گر فقط «feedPet» می‌فرستد)
    if (a.id === "feedPet") {
      setActiveTab("bag")
      return
    }

    // فمبوی (V9) — پیمان/نقطه‌مهارت/وقت‌گذرانی/شکار → تبِ فمبوی
    if (
      a.id === "femboy" ||
      a.id === "femboySkills" ||
      a.id === "femboyInteract" ||
      a.id === "femboyHunt"
    ) {
      setActiveTab("soul")
      return
    }

    // بازار → تبِ بازار
    if (a.id === "market") {
      setActiveTab("market")
      return
    }

    // فرصتِ فوری — مستقیم بگیر (توصیه‌گر «claim-{id}» می‌فرستد)
    if (a.id.startsWith("claim-")) {
      void claimOpp(a.id.slice("claim-".length))
      return
    }

    // سفر — «travel» یا «travel:{district}»؛ کلید از ایموجیِ برچسب درمی‌آید
    if (a.id === "travel" || a.id.startsWith("travel:")) {
      const inline = a.id.startsWith("travel:") ? a.id.slice("travel:".length) : null
      const fromEmoji = DISTRICT_BY_EMOJI[a.actionLabel.trim().split(/\s+/)[0] ?? ""]
      const district = inline ?? fromEmoji
      if (district) {
        setActing(a.id)
        await runAction("travel", { district })
        finish()
      } else {
        setActiveTab("city")
      }
      return
    }

    // ناشناخته — حداقل بگذار شهر را ببیند
    setActiveTab("city")
  }

  return (
    <>
      {/* ─── کارتِ مسیرِ زندگی ─── */}
      <GlassCard>
        <SectionTitle icon="🧭" title="مسیرِ زندگی" />

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="violet" className="font-bold">
            {guide.stage.emoji} {guide.stage.name}
          </Chip>
          {guide.direction ? (
            <Chip tone="pink" className="font-bold">
              {guide.direction.emoji} {guide.direction.name}
            </Chip>
          ) : (
            <span className="text-[11px] leading-5 text-muted-foreground">هنوز مسیری انتخاب نکرده‌ای</span>
          )}
        </div>

        <p className="mt-2.5 text-xs leading-6">
          <span aria-hidden className="font-bold text-primary">
            📌 الان:{" "}
          </span>
          <span className="font-extrabold text-foreground">{guide.headline}</span>
        </p>

        {guide.goals.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {visibleGoals.map((g) => (
                <motion.li
                  key={g.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-bold">
                      <span aria-hidden className="me-1">
                        {g.icon}
                      </span>
                      {g.title}
                    </p>
                    <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {g.progressLabel}
                    </span>
                  </div>
                  <ProgressBar
                    value={g.progressPct}
                    label={`پیشرفتِ ${g.title}`}
                    className="mt-1.5"
                    barClassName={g.progressPct >= 80 ? "bg-emerald-400" : undefined}
                  />
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{g.hint}</p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}

        {hiddenGoalCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              haptic("light")
              setGoalsOpen((v) => !v)
            }}
            className="mt-2.5 min-h-11 rounded-full text-[11px] font-bold text-primary transition-colors hover:text-primary/80"
          >
            {goalsOpen ? "بستن" : `+${faNum(hiddenGoalCount)} دیگر`}
          </button>
        ) : null}

        {guide.nextActions.length > 0 ? (
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {guide.nextActions.slice(0, 3).map((a) => (
              <ActionButton
                key={a.id}
                emoji={a.icon}
                size="sm"
                variant={NEXT_TONE_VARIANT[a.tone]}
                loading={acting === a.id}
                onClick={() => void runNext(a)}
                className="shrink-0"
                aria-label={`${a.title} — ${a.reason}`}
              >
                {a.title}
              </ActionButton>
            ))}
          </div>
        ) : null}
      </GlassCard>

      {/* ─── نوارِ فرصت‌ها ─── */}
      {guide.opportunities.length > 0 ? (
        <GlassCard pad="sm">
          <SectionTitle icon="⚡" title="فرصت‌ها" />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {guide.opportunities.map((o) => {
              const risk = OPP_RISK[o.claimStyle]
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    haptic("light")
                    setOppSheet(o)
                  }}
                  className={cn(
                    "glass flex w-40 shrink-0 select-none flex-col gap-1 p-3 text-start transition-colors hover:bg-white/[0.06]",
                    o.claimStyle === "wild"
                      ? "border-rose-400/25"
                      : o.claimStyle === "risky"
                        ? "border-amber-400/25"
                        : "border-emerald-400/20",
                  )}
                  aria-label={`فرصت ${o.title}`}
                >
                  <p className="flex w-full items-center gap-1.5 text-xs font-bold">
                    <span aria-hidden className="text-base leading-none">
                      {o.icon}
                    </span>
                    <span className="min-w-0 truncate">{o.title}</span>
                  </p>
                  <p className="flex w-full items-center gap-2 text-[11px] leading-4 text-muted-foreground">
                    <span className="tabular-nums">⏳ {faNum(o.minutesLeft)} دقیقه</span>
                    {risk.marks ? (
                      <span className="shrink-0 font-bold text-amber-300" aria-label={`سطحِ خطر: ${risk.label}`}>
                        {risk.marks}
                      </span>
                    ) : null}
                  </p>
                </motion.button>
              )
            })}
          </div>
        </GlassCard>
      ) : null}

      {/* ─── شیتِ جزئیاتِ فرصت ─── */}
      <GlassSheet
        open={oppSheet !== null}
        onOpenChange={(v) => {
          if (!v) setOppSheet(null)
        }}
        title={
          oppSheet ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-xl">
                {oppSheet.icon}
              </span>
              {oppSheet.title}
            </span>
          ) : null
        }
        footer={
          oppSheet ? (
            <ActionButton
              variant={oppSheet.claimStyle === "wild" ? "danger" : oppSheet.claimStyle === "risky" ? "primary" : "soft"}
              fullWidth
              loading={claiming}
              onClick={() => void claimOpp(oppSheet.id)}
            >
              {oppSheet.claimStyle === "safe" ? "بگیرش" : "به هرچه شد، بگیرش"}
            </ActionButton>
          ) : null
        }
      >
        {oppSheet ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="violet">{oppSheet.sourceLabel}</Chip>
              <Chip>⏳ {faNum(oppSheet.minutesLeft)} دقیقه دیگر</Chip>
              {OPP_RISK[oppSheet.claimStyle].marks ? (
                <Chip tone="rose">
                  {OPP_RISK[oppSheet.claimStyle].marks} {OPP_RISK[oppSheet.claimStyle].label}
                </Chip>
              ) : (
                <Chip tone="emerald">بی‌خطر</Chip>
              )}
            </div>
            <p className="text-xs leading-6 text-foreground/85">{oppSheet.description}</p>
            <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-[11px] font-bold leading-5 text-amber-200">
              🎁 {oppSheet.rewardPreview}
            </p>
            <p className="text-[11px] leading-5 text-muted-foreground">{OPP_RISK[oppSheet.claimStyle].hint}</p>
          </div>
        ) : null}
      </GlassSheet>
    </>
  )
}
