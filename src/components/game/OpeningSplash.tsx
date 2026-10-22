"use client"

// V8 — صفحه‌ی ورود: هر بازیکنِ برگشته یک برخوردِ کوتاهِ برند می‌بیند، بعد شهر.
// اسپلشِ تمام‌صفحه با وردمارک + روزِ شهر + هویتِ بازیکن — اتو-ادوانس ~2.6 ثانیه یا یک لمس.
// V22: چیپ‌های هوا/مود/آشوب حذف شدند — همان لحظه در هدرِ پوسته می‌آیند؛ این‌جا تکرار نیست.
import * as React from "react"
import { motion } from "framer-motion"
import type { GameSnapshot } from "@/lib/game/contract"
import { haptic } from "./telegram"
import { faNum } from "./fa"
import { ActionButton, Chip } from "./ui"

const AUTO_ADVANCE_MS = 2600

interface OpeningSplashProps {
  snapshot: GameSnapshot
  /** پایانِ اسپلش — ورود به داشبورد */
  onDone: () => void
}

export function OpeningSplash({ snapshot, onDone }: OpeningSplashProps) {
  const { player, world, femboy } = snapshot

  // دوباره‌صدا شدنِ پایان (لمس + اتو-ادوانس هم‌زمان) بی‌اثر می‌شود
  const doneRef = React.useRef(false)
  const finish = React.useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    haptic("medium")
    onDone()
  }, [onDone])

  // اتو-ادوانس — بدترین حالت یک لمس؛ مسیرِ خودکار ~2.6 ثانیه
  React.useEffect(() => {
    const t = window.setTimeout(finish, AUTO_ADVANCE_MS)
    return () => window.clearTimeout(t)
  }, [finish])

  return (
    <motion.div
      role="region"
      aria-label="صفحه‌ی ورود"
      onClick={finish}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative flex min-h-app cursor-pointer touch-manipulation select-none flex-col items-center justify-center gap-6 px-6 py-8 text-center"
    >
      {/* زمینه‌ی برای خوانا-mاندنِ محتوا روی هر پس‌زمینه‌ای */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(244,114,182,0.08),transparent_65%)]"
      />

      <p className="sr-only">
        FEMBOY WAR — روز {faNum(world.dayCount)} از زندگیِ {player.name}.
      </p>

      {/* وردمارک + روبانِ شناور */}
      <div className="flex flex-col items-center gap-3">
        <motion.span
          aria-hidden
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
          className="text-6xl leading-none"
        >
          🎀
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.45, ease: "easeOut" }}
          className="text-2xl font-black tracking-wide text-glow"
        >
          FEMBOY WAR
        </motion.h1>
      </div>

      {/* روز — هوا/مود/آشوب همان لحظه در هدرِ پوسته می‌آیند؛ این‌جا فقط روز (V22) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4, ease: "easeOut" }}
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        <Chip tone="pink" className="font-bold">
          🎀 روز {faNum(world.dayCount)}
        </Chip>
      </motion.div>

      {/* هویتِ بازیکن — و فمبویِ روح‌بسته‌اش اگر پیمان بسته باشد (V9) */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.45, ease: "easeOut" }}
        className="glass-strong flex w-full max-w-sm flex-col items-center gap-1.5 p-5"
      >
        <span aria-hidden className="text-4xl leading-none">
          {player.avatar}
        </span>
        <p className="text-base font-extrabold leading-7">{player.name}</p>
        <p className="text-[11px] leading-5 text-muted-foreground">شهر منتظرت بود.</p>
        {femboy ? (
          <p className="mt-0.5 text-[11px] font-bold leading-5 text-primary/90">
            <span aria-hidden className="me-1">
              {femboy.classEmoji}
            </span>
            {femboy.name} منتظرت بود.
          </p>
        ) : null}
      </motion.div>

      {/* دعوت به داخل */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.35 }}
        className="w-full max-w-xs"
      >
        <ActionButton variant="primary" size="lg" fullWidth onClick={finish}>
          بریم داخل
        </ActionButton>
        <p className="mt-2 text-center text-[11px] leading-4 text-muted-foreground">
          اگر لمس نکنی، خودش باز می‌شود.
        </p>
      </motion.div>
    </motion.div>
  )
}
