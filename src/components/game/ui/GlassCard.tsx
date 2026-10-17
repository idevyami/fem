"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** پدینگ داخلی */
  pad?: "none" | "sm" | "md"
}

/** پنل شیشه‌ای پایه‌ی بازی */
export function GlassCard({ children, className, pad = "md", ...rest }: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass",
        pad === "sm" && "p-3",
        pad === "md" && "p-4",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode
  tone?: "default" | "pink" | "violet" | "amber" | "emerald" | "rose" | "teal"
}

const CHIP_TONES: Record<NonNullable<ChipProps["tone"]>, string> = {
  default: "bg-white/5 text-foreground/80 border-white/10",
  pink: "bg-primary/10 text-primary border-primary/25",
  violet: "bg-violet-500/10 text-violet-300 border-violet-400/25",
  amber: "bg-amber-500/10 text-amber-300 border-amber-400/25",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-400/25",
  rose: "bg-rose-500/10 text-rose-300 border-rose-400/25",
  teal: "bg-teal-500/10 text-teal-300 border-teal-400/25",
}

/** چیپ کوچک شیشه‌ای — برای وضعیت‌ها و برچسب‌ها */
export function Chip({ children, tone = "default", className, ...rest }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] leading-5",
        CHIP_TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
