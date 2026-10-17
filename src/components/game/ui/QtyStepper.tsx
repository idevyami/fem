"use client"

// استپر تعداد — دکمه‌های + / − با حداقل و حداکثر
import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "../telegram"
import { faNum } from "../fa"

interface QtyStepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: "sm" | "md"
  label?: string
  className?: string
}

export function QtyStepper({ value, onChange, min = 0, max = 99, size = "sm", label, className }: QtyStepperProps) {
  const btn =
    size === "sm"
      ? "flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-sm font-bold text-foreground/80 transition-all active:scale-90 hover:bg-white/[0.09] disabled:opacity-40 disabled:pointer-events-none"
      : "flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-base font-bold text-foreground/80 transition-all active:scale-90 hover:bg-white/[0.09] disabled:opacity-40 disabled:pointer-events-none"
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} role="group" aria-label={label ?? "تعداد"}>
      <button
        type="button"
        aria-label="کمتر"
        disabled={value <= min}
        onClick={() => {
          haptic("light")
          onChange(Math.max(min, value - 1))
        }}
        className={btn}
      >
        −
      </button>
      <span className="min-w-7 text-center text-sm font-bold tabular-nums" aria-live="polite">
        {faNum(value)}
      </span>
      <button
        type="button"
        aria-label="بیشتر"
        disabled={value >= max}
        onClick={() => {
          haptic("light")
          onChange(Math.min(max, value + 1))
        }}
        className={btn}
      >
        +
      </button>
    </div>
  )
}
