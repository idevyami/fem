"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { haptic } from "../telegram"
import { faNum } from "../fa"

interface EmptyStateProps {
  emoji: string
  text: string
  hint?: string
  className?: string
  /** اکشن اختیاری مثل دکمه‌ی تلاش دوباره */
  action?: React.ReactNode
}

/** حالت خالی با لحن بازی */
export function EmptyState({ emoji, text, hint, className, action }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <span aria-hidden className="text-4xl opacity-80">
        {emoji}
      </span>
      <p className="text-sm font-medium leading-6 text-foreground/80">{text}</p>
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

interface SectionTitleProps {
  icon?: string
  title: string
  action?: React.ReactNode
  className?: string
}

/** تیتر بخش با اکشن اختیاری سمت چپ (انتهای ردیف در RTL) — از بدنه‌ی کارت درشت‌تر */
export function SectionTitle({ icon, title, action, className }: SectionTitleProps) {
  return (
    <div className={cn("mb-2 flex items-center justify-between gap-2", className)}>
      <h2 className="flex items-center gap-1.5 text-base font-extrabold text-foreground/90">
        {icon ? (
          <span aria-hidden className="text-base leading-none">
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {action}
    </div>
  )
}

interface MoneyBadgeProps {
  amount: number
  className?: string
  /** حالت فشرده برای هدرها */
  compact?: boolean
}

/** نشان سکه — تمام پول‌های UI از این‌جا نمایش داده می‌شوند */
export function MoneyBadge({ amount, className, compact }: MoneyBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-200 tabular-nums",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <span aria-hidden className="leading-none">
        💰
      </span>
      {faNum(amount)}
      <span className="sr-only">سکه</span>
    </span>
  )
}

type ActionVariant = "primary" | "glass" | "soft" | "danger" | "success" | "ghost"
type ActionSize = "sm" | "md" | "lg"

const VARIANT_CLASS: Record<ActionVariant, string> = {
  primary:
    "bg-primary text-primary-foreground border border-primary/40 glow-pink hover:bg-primary/90 font-bold",
  glass:
    "glass bg-white/[0.05] text-foreground border-white/10 hover:bg-white/[0.08] font-semibold",
  soft: "bg-primary/10 text-primary border border-primary/25 hover:bg-primary/15 font-semibold",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-400/25 hover:bg-rose-500/20 font-semibold",
  success: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 hover:bg-emerald-500/20 font-semibold",
  ghost: "text-foreground/70 hover:text-foreground hover:bg-white/5 font-medium",
}

const SIZE_CLASS: Record<ActionSize, string> = {
  sm: "h-10 px-3 text-[13px] rounded-xl gap-1.5",
  md: "h-12 px-4 text-sm rounded-2xl gap-2",
  lg: "min-h-14 px-5 text-base rounded-2xl gap-2",
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  emoji?: string
  loading?: boolean
  variant?: ActionVariant
  size?: ActionSize
  fullWidth?: boolean
}

/** دکمه‌ی استاندارد بازی — هپتیک + اسکیل لمسی + حالت لودینگ */
export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  function ActionButton(
    { emoji, loading = false, variant = "glass", size = "md", fullWidth, className, children, onClick, disabled, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        onClick={(e) => {
          if (!loading && !disabled) haptic("light")
          onClick?.(e)
        }}
        className={cn(
          "inline-flex select-none items-center justify-center whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
          VARIANT_CLASS[variant],
          SIZE_CLASS[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <span
            aria-hidden
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : emoji ? (
          <span aria-hidden className="text-base leading-none">
            {emoji}
          </span>
        ) : null}
        {children}
      </button>
    )
  },
)
