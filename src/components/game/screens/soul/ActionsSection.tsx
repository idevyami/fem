"use client"

// V10 فمبوی — سکشنِ اقدامات: تعامل (9 نوعِ پویا از داده)، شارژِ استقامت، شربتِ روحیه، تغییرِ اسم
import * as React from "react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import type { InteractDTO, SoulCardDTO } from "@/lib/game/contract"
import { haptic } from "../../telegram"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, GlassSheet, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"
import { GLASS_BLUE, NAME_MAX, validateNameClient } from "./classMeta"

interface ActionsSectionProps {
  card: SoulCardDTO
  interactions: InteractDTO[]
  money: number
  /** تعداد کیکِ کیف — شربتِ روحیه اول همین را می‌خورَد (از snapshot.inventory) */
  cakes: number
  /** اکشنِ فمبوی — true یعنی موفق (توست را والد می‌دهد) */
  act: (action: string, payload?: Record<string, unknown>) => Promise<boolean>
}

/** کول‌داونِ تغییرِ اسم به فارسی: دقیقه → ساعت/روز */
function renameCooldownLabel(min: number): string {
  if (min >= 48 * 60) return `${faNum(Math.ceil(min / 1440))} روز دیگر می‌توانی عوضش کنی`
  if (min >= 60) return `${faNum(Math.ceil(min / 60))} ساعت دیگر می‌توانی عوضش کنی`
  return `${faNum(Math.ceil(min))} دقیقه دیگر می‌توانی عوضش کنی`
}

export function ActionsSection({ card, interactions, money, cakes, act }: ActionsSectionProps) {
  const [busy, setBusy] = React.useState<string | null>(null)
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [newName, setNewName] = React.useState("")
  const [renameError, setRenameError] = React.useState<string | null>(null)

  // V10 — تعامل‌های مکانیکی و تعاملِ روایی (مرورِ خاطره) جدا رندر می‌شوند
  const solid = interactions.filter((it) => !it.flavorOnly)
  const flavor = interactions.filter((it) => it.flavorOnly)

  const interactCd = card.interactCooldownMin > 0
  const renameCd = card.renameCooldownMin > 0
  /** شربتِ روحیه: نه کیکی در کیف، نه 200 سکه — دکمه با دلیل قفل می‌شود */
  const potionPoor = money < 200 && cakes === 0

  async function run(key: string, action: string, payload?: Record<string, unknown>): Promise<boolean> {
    if (busy) return false
    setBusy(key)
    const ok = await act(action, payload)
    setBusy(null)
    return ok
  }

  async function interact(kind: string, key: string, flavor = false) {
    if (!flavor && interactCd) return
    haptic("light")
    await run(key, "interact", { kind })
  }

  async function submitRename() {
    const check = validateNameClient(newName)
    if (!check.ok) {
      setRenameError(check.error ?? "اسم معتبر نیست.")
      return
    }
    const ok = await run("rename", "rename", { name: newName.trim().replace(/\s+/g, " ") })
    if (ok) {
      setRenameOpen(false)
      setNewName("")
      setRenameError(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── تعامل ── */}
      <GlassCard>
        <SectionTitle
          icon="💗"
          title="تعامل"
          action={
            interactCd ? (
              <Chip tone="rose">⏳ {faNum(card.interactCooldownMin)} دقیقه مانده</Chip>
            ) : (
              <Chip tone="emerald">آماده</Chip>
            )
          }
        />
        <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
          هر ده دقیقه یک‌بار می‌توانی با فمبویِ اختصاصی‌ات تعامل کنی — روحیه‌ش را آب می‌دهد و پیوندتان را محکم‌تر می‌کند.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {solid.map((it) => {
            const cost = it.moneyCost > 0
            const poor = cost && money < it.moneyCost
            const disabled = interactCd || poor || busy !== null
            return (
              <button
                key={it.key}
                type="button"
                disabled={disabled}
                onClick={() => void interact(it.key, `it:${it.key}`)}
                aria-label={`${it.label}${cost ? ` — ${faNum(it.moneyCost)} سکه` : ""}`}
                className={cn(
                  "glass flex min-h-[76px] select-none flex-col items-center justify-center gap-0.5 px-1.5 py-2 transition-all active:scale-[0.96] disabled:pointer-events-none",
                  disabled ? "opacity-40" : "hover:bg-white/[0.07]",
                  busy === `it:${it.key}` && "opacity-60",
                )}
              >
                <span aria-hidden className="text-lg leading-6">
                  {it.icon}
                </span>
                <span className="text-[11px] font-bold leading-4">{it.label}</span>
                {cost ? (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-1.5 text-[11px] font-bold leading-4 text-amber-200 tabular-nums"
                  >
                    💰 {faNum(it.moneyCost)}
                  </span>
                ) : (
                  <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
                    +{faNum(it.spiritGain[0])}–{faNum(it.spiritGain[1])} روحیه
                  </span>
                )}
                {cost ? (
                  <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
                    +{faNum(it.spiritGain[0])}–{faNum(it.spiritGain[1])} روحیه
                  </span>
                ) : null}
                {busy === `it:${it.key}` ? (
                  <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : null}
              </button>
            )
          })}
        </div>
        {interactCd ? (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-[11px] leading-5 text-muted-foreground">
            فمبویِ تو هم نفس می‌خواهد — {faNum(card.interactCooldownMin)} دقیقه دیگر برگرد.
          </p>
        ) : null}
      </GlassCard>

      {/* ── مرورِ خاطره — اکشنِ رواییِ متمایز (V10) ── */}
      {flavor.length > 0 ? (
        <GlassCard pad="sm" className="border-violet-400/20">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-xl">
              📖
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold leading-5">مرورِ خاطره</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                خاطره‌های مشترک را از سابقه‌ی واقعیِ خودتان ورق بزنید — بی‌هزینه، بی‌کول‌داون.
              </p>
            </div>
            <ActionButton
              variant="glass"
              size="sm"
              className="min-h-11 shrink-0 border-violet-400/25 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:border-violet-400/40"
              disabled={busy !== null}
              loading={busy === "it:memory"}
              onClick={() => {
                haptic("light")
                void interact("memory", "it:memory", true)
              }}
            >
              خاطره‌ها را ورق بزن
            </ActionButton>
          </div>
        </GlassCard>
      ) : null}

      {/* ── شارژِ استقامت ── */}
      <GlassCard>
        <SectionTitle icon="⚡" title="شارژِ استقامت" action={<Chip tone="amber">{faNum(card.stamina)}/{faNum(card.staminaMax)}</Chip>} />
        <p className="mb-3 text-[11px] leading-5 text-muted-foreground">
          هر واحد {faNum(card.rechargeCostPer)} سکه — نبردِ هر دشمن 3 واحد می‌برد. (شکارِ بعدی: {faNum(Math.floor(card.stamina / 3))})
        </p>
        <div className="grid grid-cols-3 gap-2">
          {[3, 6, 9].map((units) => {
            const price = card.rechargeCostPer * units
            const poor = money < price
            return (
              <ActionButton
                key={units}
                variant="danger"
                size="sm"
                className="flex-col !h-auto min-h-[64px] py-2"
                disabled={poor || busy !== null}
                loading={busy === `rc:${units}`}
                onClick={() => {
                  haptic("medium")
                  void run(`rc:${units}`, "recharge", { units })
                }}
              >
                <span className="text-xs font-extrabold tabular-nums">+{faNum(units)} ⚡</span>
                <span className="text-[11px] font-medium text-rose-200/80 tabular-nums">{faNum(price)} سکه</span>
              </ActionButton>
            )
          })}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          💰 در جیبت: {faNum(money)} سکه
        </p>
      </GlassCard>

      {/* ── شربتِ روحیه ── */}
      <GlassCard pad="sm">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-400/25 bg-emerald-500/10 text-xl">
            🧪
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-5">شربتِ روحیه</p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              +22 روحیه · کیکِ کیف یا 200 سکه
              <span className="ms-1.5 font-bold text-emerald-300/80 tabular-nums">· 🍰 {faNum(cakes)}</span>
            </p>
          </div>
          <ActionButton
            variant="success"
            size="sm"
            disabled={busy !== null || potionPoor || (money < 200 && card.spirit >= 100)}
            loading={busy === "potion"}
            onClick={() => {
              haptic("light")
              void run("potion", "potion")
            }}
          >
            بخور
          </ActionButton>
        </div>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          {potionPoor
            ? "کیک نداری و 200 سکه هم نه — اول یکی‌شان را حل کن."
            : "اول کیکِ کیف را می‌خورَد؛ اگر نبود از سکه‌ات 200 تا می‌گیرد."}
        </p>
      </GlassCard>

      {/* ── تغییرِ اسم ── */}
      <GlassCard pad="sm">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
            ✏️
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold leading-5">اسمِ فمبوی</p>
            <p className="text-[11px] leading-4 text-muted-foreground">
              {renameCd ? renameCooldownLabel(card.renameCooldownMin) : "هر 3 روز یک‌بار می‌توانی عوضش کنی"}
            </p>
          </div>
          <ActionButton
            variant="glass"
            size="sm"
            className={GLASS_BLUE}
            disabled={renameCd || busy !== null}
            onClick={() => {
              haptic("light")
              setNewName("")
              setRenameError(null)
              setRenameOpen(true)
            }}
          >
            عوضش کن
          </ActionButton>
        </div>
      </GlassCard>

      {/* شیتِ تغییرِ اسم */}
      <GlassSheet
        open={renameOpen}
        onOpenChange={(v) => {
          setRenameOpen(v)
          if (!v) setRenameError(null)
        }}
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>✏️</span> اسمِ تازه
          </span>
        }
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth onClick={() => setRenameOpen(false)}>
              همین خوبه
            </ActionButton>
            <ActionButton
              variant="primary"
              fullWidth
              loading={busy === "rename"}
              disabled={!newName.trim()}
              onClick={() => void submitRename()}
            >
              ثبت
            </ActionButton>
          </div>
        }
      >
        <p className="text-xs leading-6 text-muted-foreground">
          اسمِ فعلی «{card.name}» است. اسمِ تازه همان‌قدر ماندگار می‌شود که صدازدنش.
        </p>
        <motion.div layout className="mt-4">
          <label htmlFor="soul-rename" className="block text-xs font-bold">
            اسمِ تازه
          </label>
          <Input
            id="soul-rename"
            dir="rtl"
            value={newName}
            maxLength={NAME_MAX}
            placeholder="اسمِ فمبوی…"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(e) => {
              setNewName(e.target.value)
              setRenameError(null)
            }}
            className="mt-1.5 h-12 bg-white/[0.04] text-sm"
          />
          <div className="mt-1 text-end text-[11px] text-muted-foreground tabular-nums">
            {faNum(newName.trim().length)} / {faNum(NAME_MAX)}
          </div>
        </motion.div>
        {renameError ? (
          <p className="mt-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-5 text-rose-300" role="alert">
            {renameError}
          </p>
        ) : null}
      </GlassSheet>
    </div>
  )
}
