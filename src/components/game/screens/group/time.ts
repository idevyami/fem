"use client"

// زمانِ زنده‌ی جهانِ گروه — تیکِ مشترک برای معکوس‌ها (رأی/رویداد/بازی)
import * as React from "react"
import { faNum } from "../../fa"

const TICK_MS = 30_000

const listeners = new Set<() => void>()
let timer: number | null = null

function ensureTimer(): void {
  if (timer !== null || typeof window === "undefined") return
  timer = window.setInterval(() => {
    for (const l of listeners) l()
  }, TICK_MS)
}

function stopTimerIfIdle(): void {
  if (listeners.size === 0 && timer !== null) {
    window.clearInterval(timer)
    timer = null
  }
}

/** «الان» — هر 30 ثانیه تازه می‌شود تا شمارش‌های معکوس نفس بکشند */
export function useNow(): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const fn = () => setNow(Date.now())
    listeners.add(fn)
    ensureTimer()
    return () => {
      listeners.delete(fn)
      stopTimerIfIdle()
    }
  }, [])
  return now
}

/** «3 دقیقه» تا زمانِ هدف — null یعنی گذشته */
export function faCountdown(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null
  const diff = (new Date(iso).getTime() - now) / 1000
  if (!Number.isFinite(diff) || diff <= 0) return null
  if (diff < 60) return `${faNum(Math.ceil(diff))} ثانیه`
  if (diff < 3600) return `${faNum(Math.ceil(diff / 60))} دقیقه`
  if (diff < 86400) return `${faNum(Math.ceil(diff / 3600))} ساعت`
  return `${faNum(Math.ceil(diff / 86400))} روز`
}
