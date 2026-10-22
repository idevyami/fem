"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "../telegram"
import { useGame } from "../store"

interface GlassSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** کلاس اضافه برای بدنه‌ی شیت */
  bodyClassName?: string
  /** دکمه‌ی سمتِ راستِ عنوان (مثلاً «بازگشت» در کدکس) — اختیاری و سازگارِ عقب‌مانده */
  leading?: React.ReactNode
}

/** بات‌شیت شیشه‌ای با فریمر-موشن و بک‌دراپ — همه‌ی شیت‌های بازی از همین‌جا */
export function GlassSheet({ open, onOpenChange, title, children, footer, bodyClassName, leading }: GlassSheetProps) {
  // V22 — شیتِ باز خودش را در پشته‌ی برگشتِ سخت‌افزاری ثبت می‌کند؛ دکمه‌ی
  // برگشتِ تلگرام/اندروید اول بالاترین شیت را می‌بندد، بعد تاریخِ تب‌ها را دنبال
  // می‌کند. رفرنسِ تازه‌ی onOpenChange بدونِ ثبتِ دوباره جایگزین می‌شود.
  const registerSheetCloser = useGame((s) => s.registerSheetCloser)
  const unregisterSheetCloser = useGame((s) => s.unregisterSheetCloser)
  const onOpenChangeRef = React.useRef(onOpenChange)
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange
  }, [onOpenChange])
  React.useEffect(() => {
    if (!open) return
    const closer = () => onOpenChangeRef.current(false)
    registerSheetCloser(closer)
    return () => unregisterSheetCloser(closer)
  }, [open, registerSheetCloser, unregisterSheetCloser])

  // قفل اسکرول بدنه هنگام باز بودن
  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // ESC برای بستن
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.div
            initial={{ y: "102%" }}
            animate={{ y: 0 }}
            exit={{ y: "102%" }}
            transition={{ type: "tween", duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
          >
            <div className="glass-strong overflow-hidden rounded-3xl border-white/10 shadow-[0_-8px_40px_rgba(0,0,0,0.5)]">
              {/* دستگیره */}
              <div className="flex justify-center pt-2.5 pb-1">
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={() => {
                    haptic("light")
                    onOpenChange(false)
                  }}
                  className="h-1.5 w-10 rounded-full bg-white/20 transition-colors hover:bg-white/30"
                />
              </div>
              {title ? (
                <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {leading ? <div className="shrink-0">{leading}</div> : null}
                    <div className="min-w-0 truncate text-base font-bold text-foreground">{title}</div>
                  </div>
                  <button
                    type="button"
                    aria-label="بستن"
                    onClick={() => onOpenChange(false)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : null}
              <div className={cn("scrollbar-thin max-h-[68vh] overflow-y-auto px-4 pb-4", bodyClassName)}>
                {children}
              </div>
              {footer ? <div className="border-t border-white/10 bg-black/20 px-4 py-3">{footer}</div> : null}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
