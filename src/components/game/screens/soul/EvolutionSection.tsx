"use client"

// V10 فمبوی — سکشنِ فرگشت: فُرمِ فعلی + نردبانِ گذشته + انتخابِ شاخه (دو گزینه)
import * as React from "react"
import { motion } from "framer-motion"
import type { EvolutionStateDTO, SoulCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, ArtImage, Chip, GlassCard, GlassSheet, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

interface EvolutionSectionProps {
  card: SoulCardDTO
  /** فرگشت با شاخه‌ی انتخابی — true یعنی موفق */
  onEvolve: (choice: 0 | 1) => Promise<boolean>
}

export function EvolutionSection({ card, onEvolve }: EvolutionSectionProps) {
  const [busy, setBusy] = React.useState(false)
  /** گزینه‌ی در انتظارِ تأیید — ایندکسِ شاخه (0=الف، 1=ب) */
  const [pending, setPending] = React.useState<0 | 1 | null>(null)

  const next = card.nextEvolution
  const eligible = next?.eligible ?? false
  const pendingOption = next && pending !== null ? next.options[pending] : null

  async function evolve(choice: 0 | 1) {
    if (busy || !eligible) return
    haptic("heavy")
    setBusy(true)
    const ok = await onEvolve(choice)
    setBusy(false)
    if (ok) setPending(null)
  }

  // فرمِ فعلی — pathLabel وقتی مرحله‌ای انتخاب شده باشد
  const currentStage = card.evolutions.find((e) => e.isCurrent) ?? null
  const pathLabel = card.evolution > 0 && currentStage?.isChosen ? currentStage.pathLabel : null

  return (
    <div className="flex flex-col gap-4">
      {/* ── فُرمِ فعلی ── */}
      <GlassCard
        className="border-white/15"
        style={{ borderColor: `${card.palette.primary}55`, background: `${card.palette.soft}66` }}
      >
        {/* V8 §24 — پرتره‌ی فُرمِ فعلی (فرگشتِ ≥۲ = آرتِ اختصاصیِ فُرم؛ وگرنه آرتِ کلاس) */}
        <div className="mb-3 overflow-hidden rounded-2xl border border-white/10">
          <ArtImage
            src={card.art}
            alt={`پرتره‌ی ${card.evolutionName}`}
            fallbackEmoji={card.evolutionEmoji}
            className="h-40 w-full object-cover object-top"
          />
        </div>
        <SectionTitle icon={card.evolutionEmoji} title={card.evolutionName} action={<Chip tone="teal">فُرمِ فعلی</Chip>} />
        <p className="text-xs leading-6 text-foreground/80">
          {card.evolution > 0 ? (
            <>
              {card.name} در فرگشتِ {faNum(card.evolution)} ایستاده
              {pathLabel ? (
                <>
                  {" — "}
                  <span className="font-bold text-foreground">{pathLabel}</span>
                </>
              ) : null}
              . هر فرگشت آمارش را چند‌برابر می‌کند و ظاهرش را عوض.
            </>
          ) : (
            <>
              {card.name} تازه متولد شده — {faNum(card.evolution)} فرگشت پشتِ سر گذاشته. هر فرگشت آمارش را چند‌برابر می‌کند و ظاهرش را عوض.
            </>
          )}
        </p>
      </GlassCard>

      {/* ── نردبانِ مراحل ── */}
      <GlassCard>
        <SectionTitle icon="🪜" title="نردبانِ فرگشت" />
        <ul className="flex flex-col gap-1.5">
          {card.evolutions.map((e, i) => {
            const stage = i + 1
            const done = stage <= card.evolution
            return (
              <li
                key={`${e.name}-${e.reqLevel}`}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2",
                  e.isCurrent
                    ? "border-emerald-400/30 bg-emerald-500/[0.07]"
                    : done
                      ? "border-white/15 bg-white/[0.04]"
                      : "border-white/[0.07] bg-white/[0.02] opacity-55",
                )}
              >
                <span aria-hidden className="shrink-0 text-base leading-6">
                  {done ? "✅" : "⬜"}
                </span>
                {e.art ? (
                  <ArtImage
                    src={e.art}
                    alt=""
                    loading="lazy"
                    fallbackEmoji={e.emoji}
                    className="size-11 shrink-0 rounded-xl border border-white/10 object-cover"
                  />
                ) : (
                  <span aria-hidden className="shrink-0 text-base leading-6">
                    {e.emoji}
                  </span>
                )}
                <p className="min-w-0 flex-1 truncate text-xs font-bold leading-5">
                  {e.name}
                  {done && e.isChosen ? (
                    <span className="ms-1.5 text-[11px] font-medium text-muted-foreground">{e.pathLabel}</span>
                  ) : null}
                </p>
                {e.isCurrent ? (
                  <Chip tone="emerald" className="shrink-0">اینجاست</Chip>
                ) : done ? null : (
                  <span className="shrink-0 text-[11px] leading-4 text-muted-foreground tabular-nums">
                    سطح {faNum(e.reqLevel)} · {faNum(e.reqWins)} برد
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </GlassCard>

      {/* ── مرحله‌ی بعد: انتخابِ شاخه ── */}
      {next && !next.isFinal ? (
        <GlassCard>
          <SectionTitle
            icon="🧬"
            title={`انتخابِ شاخه — مرحله‌ی ${faNum(next.stage)}`}
            action={eligible ? <Chip tone="emerald" className="font-bold">آماده</Chip> : <Chip tone="rose" className="font-bold">شرط‌ها ناقص</Chip>}
          />
          <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
            دو شاخه، دو سرنوشت — سوگیریِ آماری‌شان فرق دارد. این انتخاب برگشت‌ناپذیر است.
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {next.options.map((opt, idx) => (
              <EvolutionOptionCard
                key={`${opt.name}-${idx}`}
                option={opt}
                palette={card.palette.primary}
                eligible={eligible}
                busy={busy}
                onPick={() => {
                  haptic("light")
                  setPending(idx === 1 ? 1 : 0)
                }}
              />
            ))}
          </div>
          {!eligible ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center text-[11px] leading-5 text-muted-foreground">
              شرط‌های این مرحله هنوز کامل نشده — سطح بگیر و شکار کن؛ شهر خبر می‌دهد.
            </p>
          ) : null}
        </GlassCard>
      ) : (
        <GlassCard>
          <SectionTitle icon="🧬" title="مسیرِ فرگشت" />
          <p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-center text-[11px] leading-5 text-amber-200">
            ♾️ {card.name} تا آخرِ مسیرِ فرگشت رفته — افسانه‌ی زنده‌ی شهر.
          </p>
        </GlassCard>
      )}

      {/* ── شیتِ تأییدِ برگشت‌ناپذیر ── */}
      <GlassSheet
        open={pending !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setPending(null)
        }}
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>🧬</span>
            {pendingOption ? `فرگشت به «${pendingOption.name}»` : "تثبیتِ فرگشت"}
          </span>
        }
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth disabled={busy} onClick={() => setPending(null)}>
              بی‌خیال
            </ActionButton>
            <ActionButton
              variant="danger"
              fullWidth
              loading={busy}
              onClick={() => {
                if (pending !== null) void evolve(pending)
              }}
            >
              تثبیتِ فرگشت
            </ActionButton>
          </div>
        }
      >
        {pendingOption ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              {pendingOption.art ? (
                <ArtImage
                  src={pendingOption.art}
                  alt={`پرتره‌ی ${pendingOption.name}`}
                  fallbackEmoji={pendingOption.emoji}
                  className="size-16 shrink-0 rounded-2xl border border-white/10 object-cover"
                />
              ) : (
                <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                  {pendingOption.emoji}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold leading-6">{pendingOption.name}</p>
                <Chip tone="violet" className="mt-1">{pendingOption.pathLabel}</Chip>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">⚙️ {pendingOption.preview}</p>
          </>
        ) : null}
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-5 text-amber-200" role="alert">
          ⚠️ این انتخاب برای همیشه می‌ماند. کلاسِ همیشگی‌ات می‌ماند، اما فرم و مسیرِ این مرحله دیگر عوض نمی‌شود.
        </p>
      </GlassSheet>
    </div>
  )
}

// ─── کارتِ گزینه‌ی شاخه ────────────────────────────────────────────────────

interface OptionCardProps {
  option: EvolutionStateDTO
  palette: string
  eligible: boolean
  busy: boolean
  onPick: () => void
}

function EvolutionOptionCard({ option, palette, eligible, busy, onPick }: OptionCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "flex flex-col rounded-2xl border p-3",
        eligible ? "border-white/15 bg-white/[0.04]" : "border-white/[0.08] bg-white/[0.02] opacity-80",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl border text-lg"
          style={{ borderColor: `${palette}44`, background: `${palette}18` }}
        >
          {option.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold leading-5">{option.name}</p>
          <Chip tone="violet" className="mt-0.5">{option.pathLabel}</Chip>
        </div>
      </div>
      <p className="mt-2 min-h-[40px] text-[11px] italic leading-5 text-muted-foreground" style={{ borderInlineStart: `2px solid ${palette}44`, paddingInlineStart: 8 }}>
        {option.lore}
      </p>
      <p className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] leading-4 text-foreground/75">
        ⚙️ {option.preview}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {option.requirements.map((r) => (
          <span
            key={r.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4",
              r.done
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                : "border-rose-400/20 bg-rose-500/10 text-rose-300/90",
            )}
          >
            {r.done ? "✓" : "✗"} {r.label}
          </span>
        ))}
      </div>
      <ActionButton
        variant={eligible ? "success" : "glass"}
        size="sm"
        fullWidth
        className="mt-2.5 min-h-11"
        disabled={!eligible || busy}
        loading={busy}
        onClick={onPick}
        aria-label={`فرگشت به ${option.name} — ${option.pathLabel}`}
      >
        {eligible ? `فرگشت به «${option.name}»` : "شرط‌ها ناقص"}
      </ActionButton>
    </motion.div>
  )
}
