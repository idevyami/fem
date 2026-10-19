"use client"

// V8 فمبوی — جریانِ ساختِ فمبوی: مقدمه → کلاس → اسم → قفلِ پیمان
// V17-2 (ممیزیِ ⑤): قدمِ کلاس راهنما دارد — انتخابِ همیشگیِ هشت‌گانه دیگر
// بی‌راهنما نیست؛ نامِ واقعیِ کلاسِ آسانِ شروع از خودِ محتوا می‌آید (ranger/آسان).
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import type { ClassCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, ArtImage } from "../../ui"
import { cn } from "@/lib/utils"
import { GLASS_BLUE, NAME_MAX, validateNameClient } from "./classMeta"

type Step = "intro" | "class" | "name" | "confirm"

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: "intro", label: "پیمان" },
  { key: "class", label: "کلاس" },
  { key: "name", label: "اسم" },
  { key: "confirm", label: "قفل" },
]

interface CreateFlowProps {
  classes: ClassCardDTO[]
  /** ساختِ فمبوی — true یعنی بسته شد و والد به ویترین می‌رود */
  onCreate: (name: string, classKey: string) => Promise<{ ok: boolean; error?: string }>
}

export function CreateFlow({ classes, onCreate }: CreateFlowProps) {
  const [step, setStep] = React.useState<Step>("intro")
  const [classKey, setClassKey] = React.useState<string | null>(null)
  const [name, setName] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const chosen = classes.find((c) => c.key === classKey) ?? null
  const nameCheck = name.trim() ? validateNameClient(name) : null
  const stepIdx = STEP_LABELS.findIndex((s) => s.key === step)

  function go(next: Step) {
    haptic("light")
    setServerError(null)
    setStep(next)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function lockPact() {
    if (!chosen || submitting) return
    const check = validateNameClient(name)
    if (!check.ok) {
      setServerError(check.error ?? "اسم معتبر نیست.")
      return
    }
    haptic("heavy")
    setSubmitting(true)
    setServerError(null)
    const res = await onCreate(name.trim().replace(/\s+/g, " "), chosen.key)
    setSubmitting(false)
    if (!res.ok) setServerError(res.error ?? "پیمان بسته نشد.")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* نشانگرِ مرحله */}
      <div className="flex items-center justify-center gap-1.5 px-2" aria-label="مرحله‌ی ساختِ فمبوی">
        {STEP_LABELS.map((s, i) => (
          <React.Fragment key={s.key}>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                i === stepIdx
                  ? "border border-primary/30 bg-primary/10 text-primary"
                  : i < stepIdx
                    ? "border border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                    : "border border-white/10 bg-white/[0.03] text-muted-foreground/60",
              )}
            >
              {s.label}
            </span>
            {i < STEP_LABELS.length - 1 ? (
              <span aria-hidden className="h-px w-3 bg-white/10" />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── 1) مقدمه‌ی شاعرانه ── */}
        {step === "intro" ? (
          <motion.section
            key="intro"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            aria-label="پیمانِ فمبوی"
          >
            <GlassCard className="border-primary/25 bg-primary/[0.04]">
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <motion.span
                  aria-hidden
                  className="text-6xl"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                >
                  🎀
                </motion.span>
                <h1 className="text-xl font-extrabold leading-8">پیمانِ فمبوی</h1>
                <p className="max-w-xs text-xs leading-6 text-foreground/75">
                  هر شهروندِ این جهان یک فمبوی دارد.
                  <br />
                  اسمش را تو انتخاب می‌کنی، مسیرش را شهر می‌نویسد.
                  <br />
                  کلاسش همیشگی است — با دقت انتخاب کن.
                </p>
                <p className="max-w-xs text-[11px] leading-5 text-muted-foreground">
                  فمبوی تو می‌جنگد، می‌بازد، فرگشت می‌یابد — ولی هرگز نمی‌میرد. پیروزی‌اش سکه می‌آورد، شکستش فقط ردّ حرف.
                </p>
                <ActionButton
                  variant="glass"
                  fullWidth
                  className={cn(GLASS_BLUE, "mt-2 min-h-12")}
                  emoji="✨"
                  onClick={() => go("class")}
                >
                  شروعِ پیمان
                </ActionButton>
              </div>
            </GlassCard>
          </motion.section>
        ) : null}

        {/* ── 2) انتخابِ کلاس ── */}
        {step === "class" ? (
          <motion.section
            key="class"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            aria-label="انتخابِ کلاسِ فمبوی"
          >
            <header className="px-1">
              <h1 className="text-lg font-extrabold leading-7">هشت راهِ ایستادن</h1>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                کلاس، امضای همیشگیِ فمبویِ توست — سبکِ نبردش، پاسیوش و مهارتِ امضایش از همین‌جا می‌آید.
              </p>
              {/* V17-2 — راهنمای انتخاب: نامِ کلاسِ واقعیِ «آسان» از محتوای موتور (ranger) */}
              <p className="mt-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-[11px] leading-5 text-foreground/80">
                <span aria-hidden>💡</span>{" "}
                <span className="font-bold text-primary">راهنمای انتخاب: </span>
                اولین‌بار است؟ «کمانگیرِ تاکتیکی» (آسان) برایِ شروعِ آزاد خوب است — هر کلاس راهِ خودش را دارد؛ بعداً با کدکس مقایسه کن.
              </p>
            </header>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {classes.map((c) => (
                <ClassPickCard
                  key={c.key}
                  cls={c}
                  selected={c.key === classKey}
                  onSelect={() => {
                    haptic("light")
                    setClassKey(c.key)
                  }}
                />
              ))}
            </div>

            {/* جزئیاتِ کلاسِ انتخاب‌شده */}
            {chosen ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-3"
              >
                <GlassCard
                  pad="sm"
                  className="border-white/15"
                  style={{ borderColor: `${chosen.palette.primary}55`, background: `${chosen.palette.soft}66` }}
                >
                  <div className="flex items-center gap-2">
                    <span aria-hidden className="text-xl leading-none">
                      {chosen.emoji}
                    </span>
                    <h2 className="text-sm font-extrabold">{chosen.name}</h2>
                    <span className="ms-auto">
                      <Chip>{chosen.roleName}</Chip>
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-foreground/75">{chosen.fantasy}</p>
                  <div className="mt-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                    <p className="text-[11px] font-bold">
                      <span aria-hidden className="me-1">
                        {chosen.activeSkill.icon}
                      </span>
                      مهارتِ امضا: {chosen.activeSkill.name}
                      <span className="ms-1.5 font-medium text-muted-foreground">
                        (خنک‌شدن {faNum(chosen.activeSkill.cooldown)} راند)
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-foreground/70">{chosen.activeSkill.desc}</p>
                  </div>
                  <p className="mt-2.5 text-[11px] leading-5 text-foreground/75">
                    <span className="font-bold">سبکِ بازی: </span>
                    {chosen.playStyle}
                  </p>
                  <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-5 text-muted-foreground">
                    {chosen.loreIntro}
                  </p>
                  <ActionButton
                    variant="primary"
                    fullWidth
                    className="mt-3"
                    emoji="➡️"
                    onClick={() => go("name")}
                  >
                    انتخابِ این کلاس
                  </ActionButton>
                </GlassCard>
              </motion.div>
            ) : (
              <GlassCard pad="sm" className="mt-3">
                <p className="py-2 text-center text-xs leading-6 text-muted-foreground">
                  یکی از هشت کارت را لمس کن تا حرفش را بشنوی.
                </p>
              </GlassCard>
            )}

            <button
              type="button"
              onClick={() => go("intro")}
              className="mx-auto mt-3 block px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              ↩️ برگرد به مقدمه
            </button>
          </motion.section>
        ) : null}

        {/* ── 3) اسم ── */}
        {step === "name" && chosen ? (
          <motion.section
            key="name"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            aria-label="اسمِ فمبوی"
          >
            <GlassCard>
              <header className="flex items-center gap-2">
                <span aria-hidden className="text-2xl leading-none">
                  {chosen.emoji}
                </span>
                <div className="min-w-0">
                  <h1 className="text-base font-extrabold leading-6">{chosen.name}</h1>
                  <p className="text-[11px] text-muted-foreground">{chosen.roleName}</p>
                </div>
              </header>

              <label htmlFor="soul-name" className="mt-4 block text-xs font-bold">
                اسمِ فمبویِ اختصاصی‌ات چی باشد؟
              </label>
              <Input
                id="soul-name"
                dir="rtl"
                value={name}
                maxLength={NAME_MAX}
                placeholder="اسمِ فمبویِ اختصاصی‌ات…"
                autoComplete="off"
                enterKeyHint="done"
                onChange={(e) => {
                  setName(e.target.value)
                  setServerError(null)
                }}
                className="mt-1.5 h-12 bg-white/[0.04] text-sm"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>فقط حرف، عدد و فاصله</span>
                <span className="tabular-nums">
                  {faNum(name.trim().length)} / {faNum(NAME_MAX)}
                </span>
              </div>

              {/* پیش‌نمایشِ زنده */}
              {name.trim() ? (
                <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-xs font-semibold leading-6">
                  👤 {name.trim()} — {chosen.emoji} {chosen.name}
                </p>
              ) : null}

              {nameCheck && !nameCheck.ok ? (
                <p className="mt-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-300" role="alert">
                  {nameCheck.error}
                </p>
              ) : null}
              {serverError ? (
                <p className="mt-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-300" role="alert">
                  {serverError}
                </p>
              ) : null}

              <div className="mt-4 flex gap-2">
                <ActionButton
                  variant="glass"
                  fullWidth
                  className={cn(GLASS_BLUE, "min-h-12")}
                  onClick={() => go("class")}
                >
                  ↩️ کلاس‌ها
                </ActionButton>
                <ActionButton
                  variant="primary"
                  fullWidth
                  className="min-h-12"
                  emoji="➡️"
                  disabled={!nameCheck?.ok}
                  onClick={() => go("confirm")}
                >
                  ادامه
                </ActionButton>
              </div>
            </GlassCard>
          </motion.section>
        ) : null}

        {/* ── 4) قفلِ پیمان ── */}
        {step === "confirm" && chosen ? (
          <motion.section
            key="confirm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
            aria-label="تأییدِ نهاییِ پیمان"
          >
            <GlassCard pad="none" className="overflow-hidden">
              <div className="relative">
                <ArtImage
                  src={chosen.art}
                  alt={`پرتره‌ی کلاسِ ${chosen.name}`}
                  fallbackEmoji={chosen.emoji}
                  className="h-56 w-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-lg font-black leading-8 text-white drop-shadow">
                    👤 {name.trim()} <span aria-hidden>—</span> {chosen.emoji} {chosen.name}
                  </p>
                  <p className="text-[11px] text-white/70">{chosen.roleName} · {chosen.difficultyLabel}</p>
                </div>
              </div>

              <div className="p-4">
                <p
                  className="rounded-xl border px-3 py-2.5 text-[11px] leading-6"
                  style={{
                    borderColor: `${chosen.palette.primary}44`,
                    background: `${chosen.palette.soft}88`,
                  }}
                  role="alert"
                >
                  🔒 کلاسِ همیشگی‌ات بعد از تأیید عوض نمی‌شود. فمبویِ تو همیشگی می‌ماند — نبرد او را نمی‌کشد.
                </p>

                {serverError ? (
                  <p className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-300" role="alert">
                    {serverError}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2">
                  <ActionButton
                    variant="success"
                    fullWidth
                    size="lg"
                    emoji="🔒"
                    loading={submitting}
                    onClick={() => void lockPact()}
                  >
                    قفلِ پیمان
                  </ActionButton>
                  <ActionButton
                    variant="glass"
                    fullWidth
                    className={cn(GLASS_BLUE, "min-h-12")}
                    disabled={submitting}
                    onClick={() => go("class")}
                  >
                    ↩️ بازگشت به کلاس‌ها
                  </ActionButton>
                </div>
              </div>
            </GlassCard>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

// ─── کارتِ انتخابِ کلاس ─────────────────────────────────────────────────────

interface ClassPickCardProps {
  cls: ClassCardDTO
  selected: boolean
  onSelect: () => void
}

const ClassPickCard = React.memo(
  function ClassPickCard({ cls, selected, onSelect }: ClassPickCardProps) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`کلاسِ ${cls.name}`}
        className={cn(
          "glass flex select-none flex-col overflow-hidden text-start transition-all active:scale-[0.97]",
          selected ? "ring-2" : "hover:bg-white/[0.06]",
        )}
        style={
          selected
            ? {
                borderColor: `${cls.palette.primary}88`,
                background: `${cls.palette.soft}aa`,
                // رنگِ پالتِ کلاس — حلقه‌ی انتخاب
                ...({ "--tw-ring-color": `${cls.palette.primary}cc` } as React.CSSProperties),
              }
            : { borderColor: `${cls.palette.primary}33`, background: `${cls.palette.soft}55` }
        }
      >
        {/* آرتِ کلاس */}
        <div className="relative h-28 w-full overflow-hidden">
          <ArtImage
            src={cls.art}
            alt=""
            loading="lazy"
            fallbackEmoji={cls.emoji}
            className={cn("size-full object-cover object-top transition-transform", selected && "scale-105")}
          />
          <span
            aria-hidden
            className="absolute top-1.5 end-1.5 grid size-7 place-items-center rounded-full border border-white/15 bg-black/45 text-sm backdrop-blur-sm"
          >
            {cls.emoji}
          </span>
          {selected ? (
            <span
              aria-hidden
              className="absolute bottom-1.5 start-1.5 grid size-6 place-items-center rounded-full text-xs font-black"
              style={{ background: cls.palette.primary, color: "var(--background)" }}
            >
              ✓
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-2.5">
          <p className="truncate text-xs font-extrabold leading-5">{cls.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{cls.roleName}</p>
          <span
            className="inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4"
            style={{ borderColor: `${cls.palette.primary}44`, color: cls.palette.primary }}
          >
            {cls.difficultyLabel}
          </span>
          <p className="text-[11px] leading-4 text-foreground/70">
            <span aria-hidden className="me-0.5">
              {cls.passive.icon}
            </span>
            <span className="font-bold">{cls.passive.name}:</span>{" "}
            <span className="line-clamp-2">{cls.passive.desc}</span>
          </p>
          <div className="mt-auto flex flex-wrap gap-1 pt-0.5">
            {cls.strengths.slice(0, 2).map((s) => (
              <span key={s} className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] leading-4 text-emerald-300/90">
                + {s}
              </span>
            ))}
            {cls.weaknesses.slice(0, 1).map((w) => (
              <span key={w} className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[11px] leading-4 text-rose-300/90">
                − {w}
              </span>
            ))}
          </div>
        </div>
      </button>
    )
  },
  (a, b) => a.cls.key === b.cls.key && a.selected === b.selected,
)
