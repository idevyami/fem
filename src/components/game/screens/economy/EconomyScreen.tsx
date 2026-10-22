"use client"

// V22 — «کیف و بازار»: یک تبِ اقتصادی با دو نما (کیفم/بازار).
// هدرِ واحد (پول + وضعیتِ اقتصاد) بالایِ هر دو نماست — embedded بازار دیگر
// هدرِ خودش را نمی‌کشد؛ سگمنت نمای را عوض می‌کند و deep-linkها با
// pendingEconomyView می‌آیند (الگوی pendingSoulSection).
import * as React from "react"
import { motion } from "framer-motion"
import { useGame, type EconomyView } from "../../store"
import { faPercent } from "../../fa"
import { haptic } from "../../telegram"
import { Chip, MoneyBadge } from "../../ui"
import { cn } from "@/lib/utils"
import { BagScreen } from "../BagScreen"
import { MarketScreen } from "../MarketScreen"

const VIEWS: { key: EconomyView; label: string }[] = [
  { key: "bag", label: "🎒 کیفم" },
  { key: "market", label: "💰 بازار" },
]

export function EconomyScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const activeTab = useGame((s) => s.activeTab)
  const economyView = useGame((s) => s.economyView)
  const setEconomyView = useGame((s) => s.setEconomyView)
  const pendingEconomyView = useGame((s) => s.pendingEconomyView)
  const setPendingEconomyView = useGame((s) => s.setPendingEconomyView)
  const setActionOutcome = useGame((s) => s.setActionOutcome)

  // V22 — مصرفِ deep-link: با ورودِ تبِ کیف، نمایِ گفته‌شده فعال می‌شود؛
  // null یعنی ورودِ عادی (نمایِ آخرِ خودِ جلسه)
  React.useEffect(() => {
    if (activeTab !== "bag" || pendingEconomyView === null) return
    setEconomyView(pendingEconomyView)
    setPendingEconomyView(null)
  }, [activeTab, pendingEconomyView, setEconomyView, setPendingEconomyView])

  // V22 — سوییچِ کیف↔بازار همان «ترکِ صفحه» است: کارتِ نتیجه‌ی نمایِ قبلی
  // جمع می‌شود تا کارتِ خرید، سرِ جیبِ داری‌ها دوباره ظاهر نشود (آینه‌ی
  // «هر صفحه با ترکِ تب کارتِ خودش را جمع می‌کند» — این‌جا ترکِ تب، ترکِ نماست)
  React.useEffect(() => {
    setActionOutcome(null)
  }, [economyView, setActionOutcome])

  if (!snapshot) return null

  const economy = snapshot.world.economyIndex

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-xl font-extrabold leading-8">🎒 کیف و بازار</h1>
          <p className="text-xs text-muted-foreground">چیزی که داری و چیزی که می‌خری — یک‌جا. سکه فرصتِ فرار نداره.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <MoneyBadge amount={snapshot.player.money} compact />
          <Chip tone={economy > 115 ? "rose" : economy < 85 ? "emerald" : "default"}>
            اقتصاد: {faPercent(economy)}
          </Chip>
        </div>
      </header>

      {/* سگمنتِ نما — همان زبانِ بصریِ سگمنتِ بازار (MarketScreen) */}
      <div className="glass flex gap-1 p-1" role="tablist" aria-label="نماهای کیف و بازار">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={economyView === v.key}
            type="button"
            onClick={() => {
              haptic("light")
              setEconomyView(v.key)
            }}
            className={cn(
              "relative min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
              economyView === v.key ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {economyView === v.key ? (
              <motion.span
                layoutId="economy-view"
                className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative">{v.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={economyView}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {economyView === "bag" ? <BagScreen embedded /> : <MarketScreen embedded />}
      </motion.div>
    </div>
  )
}
