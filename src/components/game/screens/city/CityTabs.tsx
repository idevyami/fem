"use client"

// V22 — تبِ «شهر» با دو لنز: محله‌های تنهایی و شهرِ گروهِ مشترک.
// شهر همچنان یک مفهوم است (هم‌زبانِ IAی رباتِ V20): سگمنتِ بالا فقط لنز را
// عوض می‌کند، نه تب را؛ deep-linkها با pendingCityMode می‌آیند (الگوی
// pendingSoulSection) و با ورودِ تب مصرف می‌شوند.
import * as React from "react"
import { motion } from "framer-motion"
import { useGame, type CityMode } from "../../store"
import { haptic } from "../../telegram"
import { cn } from "@/lib/utils"
import { CityScreen } from "../CityScreen"
import { GroupScreen } from "../GroupScreen"

const MODES: { key: CityMode; label: string }[] = [
  { key: "districts", label: "🏙 محله‌ها" },
  { key: "group", label: "🌍 شهرِ گروه" },
]

export function CityTabs() {
  const activeTab = useGame((s) => s.activeTab)
  const cityMode = useGame((s) => s.cityMode)
  const setCityMode = useGame((s) => s.setCityMode)
  const pendingCityMode = useGame((s) => s.pendingCityMode)
  const setPendingCityMode = useGame((s) => s.setPendingCityMode)

  // V22 — مصرفِ deep-link: با ورودِ تبِ شهر، لنزِ گفته‌شده فعال می‌شود؛
  // null یعنی ورودِ عادی (لنزِ آخرِ خودِ جلسه)
  React.useEffect(() => {
    if (activeTab !== "city" || pendingCityMode === null) return
    setCityMode(pendingCityMode)
    setPendingCityMode(null)
  }, [activeTab, pendingCityMode, setCityMode, setPendingCityMode])

  return (
    <div className="flex flex-col gap-4">
      {/* سگمنتِ لنز — همان زبانِ بصریِ سگمنتِ بازار (MarketScreen) */}
      <div className="glass flex gap-1 p-1" role="tablist" aria-label="نماهای تبِ شهر">
        {MODES.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={cityMode === m.key}
            type="button"
            onClick={() => {
              haptic("light")
              setCityMode(m.key)
            }}
            className={cn(
              "relative min-h-11 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
              cityMode === m.key ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cityMode === m.key ? (
              <motion.span
                layoutId="city-mode"
                className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative">{m.label}</span>
          </button>
        ))}
      </div>

      <motion.div
        key={cityMode}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {cityMode === "districts" ? <CityScreen /> : <GroupScreen />}
      </motion.div>
    </div>
  )
}
