"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  /** کلاس نوار پرشونده — مثلاً bg-emerald-400 */
  barClassName?: string
  label?: string
}

/** نوار پیشرفت نازک — در RTL از راست پر می‌شود */
export function ProgressBar({ value, max = 100, className, barClassName, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/10", className)}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width] duration-500 ease-out", barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
