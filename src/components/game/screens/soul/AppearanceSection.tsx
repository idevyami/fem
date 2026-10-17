"use client"

// V10 فمبوی — سکشنِ استایل: سه جای ظاهر + کیهناتِ من + قابلِ کسب
import * as React from "react"
import { motion } from "framer-motion"
import type { CosmeticDTO, SoulCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, Chip, EmptyState, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { COSMETIC_SLOTS, lockedCosmetics, type CosmeticSlot } from "./cosmeticsMeta"

interface AppearanceSectionProps {
  card: SoulCardDTO
  /** اکشنِ فمبوی — true یعنی موفق (توست/تازه‌سازی را والد می‌دهد) */
  act: (action: string, payload?: Record<string, unknown>) => Promise<boolean>
}

const KIND_LABELS: Record<CosmeticSlot, string> = { accessory: "اکسسوار", palette: "پالت", frame: "قاب" }

export function AppearanceSection({ card, act }: AppearanceSectionProps) {
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  const appearance = card.appearance
  const owned = appearance.owned
  const locked = React.useMemo(() => lockedCosmetics(owned), [owned])

  async function equip(slot: CosmeticSlot, key: string | null) {
    if (busyKey) return
    haptic("light")
    setBusyKey(key ?? `${slot}:none`)
    await act("appearance", { slot, key })
    setBusyKey(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── سه جای ظاهر ── */}
      <GlassCard>
        <SectionTitle icon="🎨" title="استایلِ فمبوی" action={<Chip tone="pink">{card.evolutionEmoji} {card.evolutionName}</Chip>} />
        <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
          کیهنات‌ها خریده نمی‌شوند — با زندگیِ واقعی باز می‌شوند: پیمان، پیوند، فرگشت، تسلط. هر جای ظاهر یکی را می‌پذیرد.
        </p>
        <ul className="flex flex-col gap-2">
          {COSMETIC_SLOTS.map((s, i) => {
            const item = appearance.equipped[s.slot]
            return (
              <motion.li
                key={s.slot}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.06, 0.25), duration: 0.22 }}
                className="flex min-h-[60px] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg"
                >
                  {item ? item.emoji : s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-4 text-muted-foreground">
                    {s.label}
                    <span aria-hidden className="ms-1 opacity-70">
                      ·
                    </span>
                    <span className="ms-1">{s.hint}</span>
                  </p>
                  {item ? (
                    <p className="mt-0.5 truncate text-xs font-bold leading-5">
                      {item.name}
                      <span className="ms-1.5 text-[11px] font-medium text-muted-foreground">{item.sourceLabel}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-xs font-bold leading-5 text-muted-foreground">—</p>
                  )}
                </div>
                {item ? (
                  <ActionButton
                    variant="glass"
                    size="sm"
                    className="min-h-11"
                    disabled={busyKey !== null}
                    loading={busyKey === `${s.slot}:none`}
                    onClick={() => void equip(s.slot, null)}
                    aria-label={`درآوردنِ ${item.name}`}
                  >
                    درآوردن
                  </ActionButton>
                ) : null}
              </motion.li>
            )
          })}
        </ul>
      </GlassCard>

      {/* ── کیهناتِ من ── */}
      <GlassCard>
        <SectionTitle
          icon="👗"
          title="کیهناتِ من"
          action={<Chip tone={owned.length > 0 ? "emerald" : "default"} className="font-bold">{faNum(owned.length)} کیهنات</Chip>}
        />
        {owned.length === 0 ? (
          <EmptyState
            emoji="🫧"
            text="هنوز کیهناتی مالِ فمبویت نشده."
            hint="اولین کیهنات روزِ پیمان خودش می‌آید."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(Object.keys(KIND_LABELS) as CosmeticSlot[]).map((slot) => {
              const items = owned.filter((c) => c.kind === slot)
              if (items.length === 0) return null
              return (
                <div key={slot}>
                  <p className="mb-1.5 text-[11px] font-bold leading-4 text-muted-foreground">
                    {KIND_LABELS[slot]}ها ({faNum(items.length)})
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((c) => (
                      <OwnedRow
                        key={c.key}
                        item={c}
                        busy={busyKey !== null}
                        loading={busyKey === c.key}
                        onEquip={(key) => void equip(slot, key)}
                      />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      {/* ── قابلِ کسب — کاتالوگِ قفل (فقط نمایش) ── */}
      {locked.length > 0 ? (
        <GlassCard>
          <SectionTitle icon="🔒" title="قابلِ کسب" action={<Chip>{faNum(locked.length)} کیهنات</Chip>} />
          <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
            این‌ها با سلوک‌های واقعیِ فمبویت باز می‌شوند — پوشیدنی نیستند تا مالِ او شوند.
          </p>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {locked.map((c) => (
              <li
                key={c.key}
                aria-label={`${c.name} — ${c.sourceLabel}`}
                className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 opacity-60"
              >
                <span aria-hidden className="text-sm leading-5 opacity-70">
                  🔒
                </span>
                <span aria-hidden className="shrink-0 text-base leading-6 grayscale-[0.3]">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold leading-4">{c.name}</p>
                  <p className="truncate text-[11px] leading-4 text-muted-foreground">{c.sourceLabel}</p>
                </div>
                {c.colors ? (
                  <span aria-hidden className="flex shrink-0 items-center">
                    <span className="size-3 rounded-full border border-white/20" style={{ background: c.colors.primary }} />
                    <span className="-ms-1.5 size-3 rounded-full border border-white/20" style={{ background: c.colors.soft }} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </div>
  )
}

// ─── ردیفِ کیهناتِ مال‌شده ──────────────────────────────────────────────────

interface OwnedRowProps {
  item: CosmeticDTO
  busy: boolean
  loading: boolean
  onEquip: (key: string | null) => void
}

function OwnedRow({ item, busy, loading, onEquip }: OwnedRowProps) {
  return (
    <motion.li
      layout
      className={cn(
        "flex min-h-[52px] items-center gap-2.5 rounded-2xl border px-3 py-2",
        item.equipped ? "border-emerald-400/30 bg-emerald-500/[0.07]" : "border-white/10 bg-white/[0.03]",
      )}
    >
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-base">
        {item.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold leading-5">{item.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="truncate text-[11px] leading-4 text-muted-foreground">{item.sourceLabel}</span>
          {item.colors ? (
            <span aria-hidden className="flex shrink-0 items-center">
              <span className="size-2.5 rounded-full border border-white/20" style={{ background: item.colors.primary }} />
              <span className="-ms-1 size-2.5 rounded-full border border-white/20" style={{ background: item.colors.soft }} />
            </span>
          ) : null}
        </div>
      </div>
      {item.equipped ? (
        <Chip tone="emerald" className="shrink-0 font-bold">
          پوشیده
        </Chip>
      ) : (
        <ActionButton
          variant="soft"
          size="sm"
          className="min-h-11 shrink-0"
          disabled={busy}
          loading={loading}
          onClick={() => onEquip(item.key)}
          aria-label={`پوشیدنِ ${item.name}`}
        >
          پوشیدن
        </ActionButton>
      )}
    </motion.li>
  )
}
