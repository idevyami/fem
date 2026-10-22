"use client"

// اینترو — سینماییِ «این بازی چیه؟» + فرمِ هویت
// گام 1: دو اسلاید که قولِ بازی را روشن می‌کنند (سوایپ/اتو-ادوانس/رد کردن)
// گام 2 (فقط حالتِ «first»): اسم + آواتار — برای مهمانِ تازه بازیکن می‌سازد، برای تلگرامی setIdentity می‌زند
// حالت‌های «returning»/«replay»: فقط اسلایدها — بدون فرم؛ پایان → onDone («بریم داخل»)
import * as React from "react"
import { AnimatePresence, motion, type PanInfo } from "framer-motion"
import { useGame } from "./store"
import { haptic } from "./telegram"
import { ActionButton } from "./ui"
import { cn } from "@/lib/utils"

/** حالتِ اینترو: تازه‌وارد (اسلاید+فرم) · برگشته (فقط اسلاید، بارِ اول روی این دستگاه) · پخشِ دوباره */
export type IntroMode = "first" | "returning" | "replay"

/** ۱۲ شکلِ بازیکن — همین فهرست در فرمِ اینترو و شیتِ ویرایشِ هویت (تبِ «من») استفاده می‌شود */
export const AVATARS = ["🎀", "🧶", "🐈", "🦊", "🖤", "🧸", "🕶", "🦆", "🌙", "🌸", "🍡", "🃏"]

/** اسلایدهای سینمایی — قوسِ ورود: شهرِ معمولی → رازِ میثاق و فمبویِ منتظر در یک نفس (V22: دو اسلاید — خودِ پیمان
 *  بعدش در FirstSessionPanel و مراسمِ CreateFlow کامل توضیح می‌شود؛ این‌جا فقط زمزمه‌ست، نه بارِ دومِ توضیح). */
const SLIDES: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "🚪",
    title: "یه شهرِ زنده. با تقریباً هیچی واردش می‌شی.",
    body: "سه هزار سکه، یه اتاقِ زیرشیبی، یه شغلِ ساده. زندگیِ معمولیه — فعلاً.",
  },
  {
    emoji: "🌙🎀",
    title: "شهر یه راز داره. فمبویِ تو منتظرته.",
    body: "اسمِ رازش میثاقه — یه هویتِ انتخابی، نه لباسی که بپوشی و درش بیاری. فمبویِ کنارت اسمش رو از تو می‌گیره و مسیرش رو از شهر؛ میثاقی که می‌بندی، دیگه باز نمی‌شه.",
  },
]

const SLIDE_MS = 8000

const slideVariants = {
  container: {
    hidden: {},
    show: { transition: { staggerChildren: 0.22, delayChildren: 0.15 } },
  },
  item: {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
  },
}

export function IntroFlow(props: {
  /** حالتِ جریان — پیش‌فرض همان جریانِ کاملِ تازه‌وارد است */
  mode?: IntroMode
  /** بازیکنِ ازپیش-ساخته (تلگرام یا جلسه‌ی مهمان) → ثبت از طریق setIdentity */
  playerExists: boolean
  /** اسمِ پیش‌پر فقط وقتی «از تلگرام» است که واقعاً initData داشتیم */
  fromTelegram: boolean
  prefillName: string
  prefillAvatar: string
  /** false یعنی ثبت ناموفق بود — همین‌جا می‌مانیم (فقط حالتِ first) */
  onSubmit: (name: string, avatar: string) => Promise<boolean>
  /** پایانِ حالتِ برگشته/پخشِ دوباره — بدون فرم، فقط اسلایدها */
  onDone?: () => void
}) {
  const { mode = "first", onDone } = props
  const { playerExists, fromTelegram, prefillName, prefillAvatar, onSubmit } = props
  const toast = useGame((s) => s.toast)

  /** فقط اسلایدها — بازیکن هست، فرم لازم نیست */
  const slidesOnly = mode !== "first"

  const [step, setStep] = React.useState<"cinematic" | "form">("cinematic")
  const [slide, setSlide] = React.useState(0)

  const [name, setName] = React.useState(prefillName)
  const [avatar, setAvatar] = React.useState(prefillAvatar || "🎀")
  const [busy, setBusy] = React.useState(false)

  // اگر آواتارِ فعلیِ بازیکن جزوِ 12 تا نیست (مثل 🧑‍🦰ِ تلگرام)، به‌عنوان گزینه‌ی اول می‌نشیند
  const avatarOptions = React.useMemo(
    () => (prefillAvatar && !AVATARS.includes(prefillAvatar) ? [prefillAvatar, ...AVATARS] : AVATARS),
    [prefillAvatar],
  )

  // ─── ناوبریِ اسلایدها ───
  const goSlide = React.useCallback((next: number) => {
    setSlide(Math.max(0, Math.min(SLIDES.length - 1, next)))
  }, [])

  // اتو-ادوانسِ آرام — فقط تا وقتی سینماتیک است و اسلایدِ آخر نیست
  React.useEffect(() => {
    if (step !== "cinematic" || slide >= SLIDES.length - 1) return
    const t = window.setTimeout(() => goSlide(slide + 1), SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [step, slide, goSlide])

  function onSwipe(_: unknown, info: PanInfo) {
    const dx = info.offset.x
    if (dx < -70) {
      haptic("light")
      if (slide < SLIDES.length - 1) goSlide(slide + 1)
    } else if (dx > 70) {
      haptic("light")
      if (slide > 0) goSlide(slide - 1)
    }
  }

  function enterForm() {
    haptic("medium")
    setStep("form")
  }

  /** پایانِ حالتِ برگشته/پخشِ دوباره — مستقیم برمی‌گردیم، بدون فرم */
  function finishSlides() {
    haptic("medium")
    onDone?.()
  }

  async function submit() {
    if (busy) return
    const clean = name.trim()
    if (clean.length < 2) {
      toast("voice", "اسم حداقل 2 حرفه. شهر با اسم‌های یک‌حرفی کاری ندارد.")
      return
    }
    setBusy(true)
    const ok = await onSubmit(clean, avatar)
    setBusy(false)
    if (ok) haptic("heavy")
  }

  const current = SLIDES[slide] ?? SLIDES[0]

  return (
    <div className="relative flex min-h-app flex-col px-5 py-6">
      {/* ورد‌مارک + معرفیِ ژانر */}
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-black tracking-wide text-glow">FEMBOY WAR</h1>
          <p className="text-[11px] leading-4 text-muted-foreground">
            شبیه‌سازِ زندگیِ شهری · دنیایی که یادش می‌مونه
          </p>
        </div>
        {step === "cinematic" ? (
          <button
            type="button"
            onClick={() => {
              haptic("light")
              if (slidesOnly) finishSlides()
              else enterForm()
            }}
            className="min-h-11 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            رد کن
          </button>
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {step === "cinematic" ? (
          <motion.section
            key={`cinematic-${slide}`}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onSwipe}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="flex flex-1 touch-pan-y select-none flex-col items-center justify-center gap-6 py-8"
            aria-label={`اسلاید ${slide + 1} از ${SLIDES.length}`}
          >
            <motion.div
              key={`s${slide}`}
              variants={slideVariants.container}
              initial="hidden"
              animate="show"
              className="glass-strong w-full max-w-sm p-6 text-center"
            >
              <motion.div
                aria-hidden
                variants={slideVariants.item}
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                className="text-6xl leading-none"
              >
                {current.emoji}
              </motion.div>
              <motion.h2 variants={slideVariants.item} className="mt-5 text-xl font-extrabold leading-9">
                {current.title}
              </motion.h2>
              <motion.p variants={slideVariants.item} className="mt-3 text-[13px] leading-7 text-muted-foreground">
                {current.body}
              </motion.p>
            </motion.div>

            <motion.div variants={slideVariants.container} initial="hidden" animate="show" className="w-full max-w-sm">
              <motion.div variants={slideVariants.item} className="flex items-center justify-center gap-2" aria-hidden>
                {SLIDES.map((s, i) => (
                  <button
                    key={s.emoji}
                    type="button"
                    aria-label={`اسلاید ${i + 1}`}
                    onClick={() => {
                      haptic("light")
                      goSlide(i)
                    }}
                    className={cn(
                      "h-2.5 min-w-11 rounded-full transition-all",
                      i === slide ? "bg-primary/80" : "bg-white/15 hover:bg-white/25",
                    )}
                  />
                ))}
              </motion.div>

              <motion.div variants={slideVariants.item} className="mt-5">
                {slide < SLIDES.length - 1 ? (
                  <ActionButton variant="glass" size="lg" fullWidth onClick={() => goSlide(slide + 1)}>
                    بعدی
                  </ActionButton>
                ) : slidesOnly ? (
                  <ActionButton variant="primary" size="lg" fullWidth onClick={finishSlides}>
                    بریم داخل
                  </ActionButton>
                ) : (
                  <ActionButton variant="primary" size="lg" fullWidth onClick={enterForm}>
                    وارد شو
                  </ActionButton>
                )}
              </motion.div>
              {slidesOnly && slide === SLIDES.length - 1 ? (
                <motion.p
                  variants={slideVariants.item}
                  className="mt-3 text-center text-[11px] leading-5 text-muted-foreground"
                >
                  حسابت همان‌جاست که ولش کردی. فقط یادت می‌آوریم این شهر چه بود.
                </motion.p>
              ) : null}
            </motion.div>
          </motion.section>
        ) : (
          <motion.section
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-1 flex-col justify-center gap-5 py-8"
            aria-label="فرم هویت"
          >
            <div className="text-center">
              <motion.div
                aria-hidden
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="text-5xl"
              >
                🎀
              </motion.div>
              <h2 className="mt-3 text-2xl font-extrabold leading-9">شهر باید بتونه صدات صدا بزنه.</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                اسم و شکلِ تو همان چیزی است که آدم‌های شهر یادشان می‌ماند.
              </p>
            </div>

            <div className="glass-strong w-full max-w-sm self-center p-5">
              <label htmlFor="fw-name" className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-foreground/80">
                <span>اسمت چیه؟ (شهر یادش می‌گیره)</span>
                {fromTelegram && prefillName ? (
                  <span className="text-[11px] font-medium text-muted-foreground">از تلگرام</span>
                ) : playerExists && prefillName ? (
                  <span className="text-[11px] font-medium text-muted-foreground">اسمِ فعلیت</span>
                ) : null}
              </label>
              <input
                id="fw-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="مثلاً: آفتابه"
                maxLength={24}
                autoComplete="off"
                dir="auto"
                className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/40"
              />

              <p className="mb-2 mt-4 text-xs font-semibold text-foreground/80">چی باشی تو چشم‌ها؟</p>
              <div className="grid grid-cols-6 gap-2">
                {avatarOptions.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      haptic("light")
                      setAvatar(a)
                    }}
                    aria-pressed={avatar === a}
                    aria-label={`آواتار ${a}`}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-2xl border text-2xl transition-all active:scale-90",
                      avatar === a
                        ? "border-primary/50 bg-primary/10 glow-pink"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                    )}
                  >
                    <span aria-hidden>{a}</span>
                  </button>
                ))}
              </div>

              <ActionButton
                variant="primary"
                size="lg"
                fullWidth
                className="mt-5"
                loading={busy}
                disabled={name.trim().length < 2}
                onClick={() => void submit()}
              >
                {name.trim().length < 2 ? "اسم حداقل 2 حرفه..." : "شروعِ زندگی"}
              </ActionButton>
            </div>

            <p className="max-w-sm self-center text-center text-[11px] leading-5 text-muted-foreground">
              قوانین ساده‌ست: هیچ‌کس کمکت نمی‌کند. بدهی‌ات به دایی فرهاد از همین‌جا شروع می‌شه.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
