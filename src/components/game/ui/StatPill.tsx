"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type StatTone = "default" | "danger" | "success" | "warning"

const TONE_VALUE: Record<StatTone, string> = {
  default: "text-foreground",
  danger: "text-rose-300",
  success: "text-emerald-300",
  warning: "text-amber-300",
}

interface StatPillProps {
  icon: string
  label: string
  value: string
  tone?: StatTone
  className?: string
}

/** قرص شیشه‌ای آمار — برای ردیف اسکرول‌شونده‌ی پیشخوان */
export function StatPill({ icon, label, value, tone = "default", className }: StatPillProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-xl",
        className,
      )}
      title={label}
    >
      <span aria-hidden className="text-sm leading-none">
        {icon}
      </span>
      <span className={cn("text-sm font-bold leading-none tabular-nums", TONE_VALUE[tone])}>{value}</span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
