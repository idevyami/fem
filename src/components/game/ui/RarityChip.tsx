"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import type { Rarity } from "@/lib/game/contract"

export const RARITY_UI: Record<Rarity, { chip: string; text: string; dot: string; border: string }> = {
  common: {
    chip: "bg-zinc-500/10 text-zinc-300 border-zinc-400/20",
    text: "text-zinc-300",
    dot: "bg-zinc-400",
    border: "border-zinc-400/25",
  },
  uncommon: {
    chip: "bg-emerald-500/10 text-emerald-300 border-emerald-400/25",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    border: "border-emerald-400/30",
  },
  rare: {
    chip: "bg-pink-500/10 text-pink-300 border-pink-400/25",
    text: "text-pink-300",
    dot: "bg-pink-400",
    border: "border-pink-400/30",
  },
  epic: {
    chip: "bg-violet-500/10 text-violet-300 border-violet-400/25",
    text: "text-violet-300",
    dot: "bg-violet-400",
    border: "border-violet-400/30",
  },
  legendary: {
    chip: "bg-amber-500/10 text-amber-300 border-amber-400/25",
    text: "text-amber-300",
    dot: "bg-amber-400",
    border: "border-amber-400/30",
  },
  unknown: {
    chip: "bg-slate-500/10 text-slate-300 border-slate-400/20",
    text: "text-slate-400",
    dot: "bg-slate-400",
    border: "border-slate-400/25",
  },
}

/** برای سورت بر اساس کمیابی — بالاتر = کمیاب‌تر */
export const RARITY_ORDER: Record<Rarity, number> = {
  unknown: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
}

interface RarityChipProps {
  rarity: Rarity
  label?: string
  className?: string
}

/** چیپ کمیابی با رنگ اختصاصی */
export function RarityChip({ rarity, label, className }: RarityChipProps) {
  const ui = RARITY_UI[rarity]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        ui.chip,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", ui.dot)} />
      {label ?? (rarity === "unknown" ? "؟؟؟" : rarity)}
    </span>
  )
}
