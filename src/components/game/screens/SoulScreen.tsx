"use client"

// V8 فمبوی — تبِ «🎀 فمبوی»: پیمانِ فمبوی (ساخت) یا ویترینِ فمبویِ روح‌بسته
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { CharacterData } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { haptic } from "../telegram"
import { faNum } from "../fa"
import { ActionButton, Chip, EmptyState, GlassCard } from "../ui"
import { cn } from "@/lib/utils"
import { CreateFlow } from "./soul/CreateFlow"
import { OverviewSection } from "./soul/OverviewSection"
import { ActionsSection } from "./soul/ActionsSection"
import { SkillsSection } from "./soul/SkillsSection"
import { EvolutionSection } from "./soul/EvolutionSection"
import { AppearanceSection } from "./soul/AppearanceSection"
import { MasterySection } from "./soul/MasterySection"
import { HistorySection } from "./soul/HistorySection"
import { CombatSection } from "./soul/CombatSection"
import { HallSection } from "./soul/HallSection"

type Section =
  | "profile"
  | "actions"
  | "skills"
  | "evolution"
  | "appearance"
  | "mastery"
  | "history"
  | "combat"
  | "hall"

const SECTIONS: { key: Section; emoji: string; label: string }[] = [
  { key: "profile", emoji: "👤", label: "پروفایل" },
  { key: "actions", emoji: "💗", label: "اقدامات" },
  { key: "skills", emoji: "🌟", label: "مهارت‌ها" },
  { key: "evolution", emoji: "🧬", label: "فرگشت" },
  { key: "appearance", emoji: "🎨", label: "استایل" },
  { key: "mastery", emoji: "🎓", label: "تسلط" },
  { key: "history", emoji: "🕰", label: "سابقه" },
  { key: "combat", emoji: "⚔️", label: "نبرد" },
  { key: "hall", emoji: "🏆", label: "تالار" },
]

export function SoulScreen() {
  const active = useGame((s) => s.activeTab === "soul")
  const snapshot = useGame((s) => s.snapshot)
  const toast = useGame((s) => s.toast)
  const refresh = useGame((s) => s.refresh)

  const [data, setData] = React.useState<CharacterData | null>(null)
  const [booting, setBooting] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [section, setSection] = React.useState<Section>("profile")

  // واکشی فقط وقتی تبِ فمبوی فعال است — با هر فعال‌شدن تازه می‌شود (استقامت/کول‌داون زنده)
  // reloadSeq: بعد از بازیابیِ نشست (V16-2) همین صفحه بی‌درنگ تازه می‌شود
  const reloadSeq = useGame((s) => s.reloadSeq)
  React.useEffect(() => {
    if (!active) return
    let alive = true
    setBooting(data === null)
    setError(null)
    void api.character().then((res) => {
      if (!alive) return
      if (res.ok) setData(res.data)
      else setError(res.error)
      setBooting(false)
    })
    return () => {
      alive = false
    }
  }, [active, reloadSeq])

  /** تازه‌سازیِ بی‌صدا بعد از اکشن‌ها — بدون اسکلتون */
  const reload = React.useCallback(async () => {
    const res = await api.character()
    if (res.ok) setData(res.data)
    return res.ok
  }, [])

  /** اکشنِ فمبوی: توست + کارتِ تازه از خودِ پاسخ + پالسِ شهر (ممیزیِ ⑧ — V16-2).
   *  مسیرِ قبلی سه رفت‌وبرگشت داشت (اکشن + character + state)؛ اکشن‌های فمبوی کارتِ
   *  تازه را در پاسخ برمی‌گردانند — همان را می‌نشانیم و فقط snapshot یکی بار تازه می‌شود. */
  const runCharAction = React.useCallback(
    async (action: string, payload?: Record<string, unknown>): Promise<boolean> => {
      const res = await api.characterAction(action, payload)
      if (!res.ok) {
        toast("error", res.error)
        return false
      }
      if (res.data.message) toast("success", res.data.message)
      // کارتِ تازه از خودِ پاسخ — بدونِ رفت‌وبرگشتِ دوباره؛ اکشنِ بدونِ کارت → واکشیِ کامل
      if (res.data.card) {
        setData((d) => (d && d.exists ? { ...d, card: res.data.card ?? d.card } : d))
      } else {
        await reload()
      }
      // سکه‌ی بازیکن ممکن است خرج/آمده باشد — پالسِ شهر را تازه کن (تنها فراخوانیِ دیگر)
      void refresh()
      return true
    },
    [toast, reload, refresh],
  )

  /** شکار: شروعِ نبرد — کارت/نبرد همان‌جا به‌روز می‌شوند */
  const startHunt = React.useCallback(
    async (enemyKey: string): Promise<boolean> => {
      const res = await api.combatAction("start", { enemyKey })
      if (!res.ok) {
        toast("error", res.error)
        return false
      }
      setData((d) =>
        d && d.exists && res.data.encounter !== undefined && res.data.card
          ? { ...d, encounter: res.data.encounter ?? null, card: res.data.card }
          : d,
      )
      // V9 — استقامتِ فمبوی خرج شد؛ کارتِ هویتِ پیشخوان هم باید بداند
      void refresh()
      return true
    },
    [toast, refresh],
  )

  /** حرکتِ راند: strike/skill/guard/flee */
  const combatAct = React.useCallback(
    async (act: "strike" | "skill" | "guard" | "flee"): Promise<boolean> => {
      const enc = data && data.exists ? data.encounter : null
      if (!enc) return false
      const res = await api.combatAction("act", { encounterId: enc.id, act })
      if (!res.ok) {
        toast("error", res.error)
        // شاید راند/نبرد از رده خارج شده — تازه کن
        void reload()
        return false
      }
      const next = res.data.encounter ?? null
      setData((d) =>
        d && d.exists && res.data.card ? { ...d, encounter: next, card: res.data.card } : d,
      )
      if (next && next.status !== "active") {
        haptic("heavy")
        if (next.status === "won") toast("success", "🏆 شکارِ فمبویِ تو آب شد — نتیجه را ببین.")
        else if (next.status === "lost") toast("error", "💀 فمبویِ تو زمین خورد — ولی زنده است. همیشه.")
        else toast("voice", "🏃 فرار شجاعانه‌ی امروز، زندگیِ فردا.")
        void refresh()
      }
      return true
    },
    [data, toast, reload, refresh],
  )

  /** پایانِ نتیجه — برگشت به لیستِ شکار با کارتِ تازه */
  const nextHunt = React.useCallback(() => {
    haptic("light")
    setData((d) => (d && d.exists ? { ...d, encounter: null } : d))
    void reload()
  }, [reload])

  /** ساختِ فمبوی — true یعنی عهد بسته شد */
  const handleCreate = React.useCallback(
    async (name: string, classKey: string): Promise<{ ok: boolean; error?: string }> => {
      const res = await api.characterAction("create", { name, classKey })
      if (!res.ok) return { ok: false, error: res.error }
      if (res.data.message) toast("success", res.data.message)
      setSection("profile")
      await reload()
      // V9 — snapshot باید فوراً فمبوی را حمل کند تا کارتِ هویتِ پیشخوان (و راهنما) عوض شود
      await refresh()
      return { ok: true }
    },
    [toast, reload, refresh],
  )

  // ─── رندر ─────────────────────────────────────────────────────────────
  if (!snapshot) return null

  if (booting && !data) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="در حالِ خواندنِ پیمان">
        <Skeleton className="h-40 rounded-3xl bg-white/[0.05]" />
        <Skeleton className="h-24 rounded-3xl bg-white/[0.05]" />
        <Skeleton className="h-24 rounded-3xl bg-white/[0.05]" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <GlassCard>
        <EmptyState
          emoji="🫥"
          text="پیمان پیدا نشد."
          hint={error}
          action={
            <ActionButton
              variant="soft"
              size="sm"
              onClick={() => {
                setBooting(true)
                void api.character().then((res) => {
                  if (res.ok) setData(res.data)
                  else setError(res.error)
                  setBooting(false)
                })
              }}
            >
              دوباره
            </ActionButton>
          }
        />
      </GlassCard>
    )
  }

  if (!data) return null

  // ── عهد هنوز بسته نشده: جریانِ ساخت ──
  if (!data.exists) {
    return (
      <div className="flex flex-col gap-4">
        <CreateFlow classes={data.classes} onCreate={handleCreate} />
        <p className="px-2 text-center text-[11px] leading-4 text-muted-foreground">
          🎀 فمبویِ روح‌بسته — یک بار انتخاب، همیشه همراه. نبرد او را نمی‌کشد.
        </p>
      </div>
    )
  }

  // ── ویترینِ فمبوی ──
  const { card } = data
  return (
    <div className="flex flex-col gap-4">
      {/* سرِ صفحه: نام + پالس */}
      <header className="flex items-center justify-between gap-2 px-1">
        <h1 className="flex min-w-0 items-center gap-1.5 text-xl font-extrabold leading-8">
          <span aria-hidden className="text-lg">
            🎀
          </span>
          <span className="truncate">{card.name}</span>
          <span aria-hidden className="text-sm opacity-80">
            {card.evolutionEmoji}
          </span>
        </h1>
        <div className="flex shrink-0 items-center gap-1.5">
          <Chip tone={card.condition.canFight ? (card.stamina >= 3 ? "amber" : "rose") : "rose"} className="font-bold">
            ⚡ {faNum(card.stamina)}
          </Chip>
          <Chip
            tone={card.condition.dmgMod > 0 ? "emerald" : card.condition.dmgMod < 0 ? "rose" : "default"}
            className="font-bold"
          >
            {card.condition.emoji} {faNum(card.spirit)}
          </Chip>
        </div>
      </header>

      {/* قرص‌های سکشن — شکستنِ ردیف به‌جای اسکرولِ پنهان؛ همه با یک نگاه پیدا می‌شوند */}
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1 py-0.5" role="tablist" aria-label="بخش‌های فمبوی">
        {SECTIONS.map((s) => {
          const isOn = s.key === section
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={isOn}
              onClick={() => {
                haptic("light")
                setSection(s.key)
              }}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors",
                isOn
                  ? "border-primary/30 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground",
              )}
            >
              <span aria-hidden>{s.emoji}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* بدنه‌ی سکشن */}
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {section === "profile" ? <OverviewSection card={card} femboy={snapshot.femboy} /> : null}
          {section === "actions" ? (
            <ActionsSection
              card={card}
              interactions={data.interactions}
              money={snapshot.player.money}
              cakes={snapshot.inventory.find((i) => i.itemKey === "cake")?.quantity ?? 0}
              act={runCharAction}
            />
          ) : null}
          {section === "skills" ? <SkillsSection card={card} onUpgrade={(id) => runCharAction("skillup", { skillId: id })} /> : null}
          {section === "evolution" ? (
            <EvolutionSection card={card} onEvolve={(choice) => runCharAction("evolve", { choice })} />
          ) : null}
          {section === "appearance" ? <AppearanceSection card={card} act={runCharAction} /> : null}
          {section === "mastery" ? <MasterySection card={card} /> : null}
          {section === "history" ? <HistorySection logs={data.logs} /> : null}
          {section === "combat" ? (
            <CombatSection
              card={card}
              enemies={data.enemies}
              encounter={data.encounter}
              onStart={startHunt}
              onAct={combatAct}
              onNextHunt={nextHunt}
            />
          ) : null}
          {section === "hall" ? <HallSection active={active && section === "hall"} /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
