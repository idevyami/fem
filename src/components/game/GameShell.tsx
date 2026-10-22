"use client"

// پوسته‌ی بازی — بوت، هدر، تب‌ها، ناو پایین، توست‌ها + بازیابیِ نشست (V16-2)
import * as React from "react"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { Bell, BookOpen } from "lucide-react"
import { api, onSessionExpired } from "@/lib/game/client"
import type { OfflineRecapDTO } from "@/lib/game/contract"
import {
  useGame,
  hasSeenIntro,
  markIntroSeen,
  persistGuestIdentity,
  readPersistedGuestIdentity,
  type TabKey,
} from "./store"
import { ensureTelegramScript, getWebApp, haptic, initTelegram } from "./telegram"
import { faNum, faTimeAgo } from "./fa"
import { ActionButton, Chip, GlassSheet } from "./ui"
import { IntroFlow, type IntroMode } from "./IntroFlow"
import { OpeningSplash } from "./OpeningSplash"
import { HomeScreen } from "./screens/HomeScreen"
import { SoulScreen } from "./screens/SoulScreen"
import { CityTabs } from "./screens/city/CityTabs"
import { EconomyScreen } from "./screens/economy/EconomyScreen"
import { MeScreen } from "./screens/MeScreen"
import { CodexSheet } from "./screens/codex/CodexSheet"
import { cn } from "@/lib/utils"

type Phase = "booting" | "opening" | "intro" | "ready" | "error"

/** زمینه‌ی اینترو: بازیکنِ موجود (تلگرام/جلسه) یا مهمانِ تازه */
interface IntroCtx {
  /** first = اسلاید+فرم · returning = اسلاید (بارِ اول روی این دستگاه) · replay = پخشِ دوباره از تبِ من */
  mode: IntroMode
  playerExists: boolean
  fromTelegram: boolean
  name: string
  avatar: string
}

const TABS: { key: TabKey; emoji: string; label: string }[] = [
  // V22 (معماریِ اطلاعات): هفت تب پنج شد — بازار در «کیف» (دو نما) و شهرِ گروه
  // در «شهر» (دو لنز) ادغام شدند؛ برچسبِ رسمی با هابِ رباتِ V20 یکی است («خانه»).
  { key: "home", emoji: "🏠", label: "خانه" },
  { key: "soul", emoji: "🎀", label: "فمبوی" },
  { key: "city", emoji: "🌆", label: "شهر" },
  { key: "bag", emoji: "🎒", label: "کیف" },
  { key: "me", emoji: "👤", label: "من" },
]

export default function GameShell() {
  const snapshot = useGame((s) => s.snapshot)
  const setSnapshot = useGame((s) => s.setSnapshot)
  const clearOfflineRecap = useGame((s) => s.clearOfflineRecap)
  const activeTab = useGame((s) => s.activeTab)
  const setActiveTab = useGame((s) => s.setActiveTab)
  const toasts = useGame((s) => s.toasts)
  const dismissToast = useGame((s) => s.dismissToast)
  const toast = useGame((s) => s.toast)

  const [phase, setPhase] = React.useState<Phase>("booting")
  const [bootError, setBootError] = React.useState<string | null>(null)
  const [intro, setIntro] = React.useState<IntroCtx | null>(null)
  /** بازیکنِ جلسه‌ی فعلی — کلیدِ per-player برای «قولِ بازی دیده شد» */
  const [playerId, setPlayerId] = React.useState<string | null>(null)
  /** شمارشِ تلاش‌های بوت — یک رتریِ خودکار برای پنجره‌ی گذارِ سرور بعد از ری‌استارت */
  const bootAttemptsRef = React.useRef(0)
  /** غیرمستقیمِ امن برای رتریِ خودکار بدون رفرنسِ خودی (react-hooks/immutability) */
  const bootRef = React.useRef<(() => Promise<void>) | undefined>(undefined)

  // V21 — شیتِ خبرها در استور است (ردیفِ «خبرها»ی پروفایل همان شیت را باز می‌کند)؛
  // unreadIds محلی می‌ماند — فقط خودِ شیت لازمش دارد
  const notifOpen = useGame((s) => s.notifOpen)
  const setNotifOpen = useGame((s) => s.setNotifOpen)
  const [unreadIds, setUnreadIds] = React.useState<Set<string>>(new Set())
  // V21 — راهنما مقصدِ سطحِ خانه شد: نمونه‌ی واحدِ CodexSheet همین‌جا، باز/بسته از استور
  const codexOpen = useGame((s) => s.codexOpen)
  const setCodexOpen = useGame((s) => s.setCodexOpen)

  // ─── V16-2 (ممیزیِ ⑦): شیتِ بازیابیِ نشست — 401 وسطِ بازی ───
  const [sessionSheetOpen, setSessionSheetOpen] = React.useState(false)
  const [sessionRecovering, setSessionRecovering] = React.useState(false)
  const requestReload = useGame((s) => s.requestReload)
  /** فازِ جاری برای گوش‌دادنِ رویداد — فقط در «ready» شیت معنا دارد */
  const phaseRef = React.useRef<Phase>("booting")
  React.useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  React.useEffect(() => {
    // خطای 401ِ خودِ بوت/اینترو مسیرِ خودش را دارد (صفحه‌ی خطا/فرم) — شیت فقط وسطِ بازی می‌آید
    const off = onSessionExpired(() => {
      if (phaseRef.current !== "ready") return
      setSessionSheetOpen(true)
    })
    return off
  }, [])

  const recoverSession = React.useCallback(async () => {
    if (sessionRecovering) return
    setSessionRecovering(true)
    try {
      const initData = getWebApp()?.initData ?? ""
      // ۱) تلگرامی → همان initData (حسابِ واقعی، همان‌جایی که بود)
      let res = await api.login(initData ? { initData } : {})
      // ۲) مهمان → اول کوکیِ زنده، بعد اسمِ ذخیره‌شده‌ی همین جلسه
      if (!res.ok && !initData) {
        const saved = readPersistedGuestIdentity()
        if (saved) res = await api.login({ name: saved.name, avatar: saved.avatar })
      }
      if (res.ok) {
        setSnapshot(res.data.snapshot)
        setPlayerId(res.data.playerId)
        setSessionSheetOpen(false)
        // صفحه‌ی فعلی تازه شود — اسکرین‌های دارایِ لودر به reloadSeq گوش می‌دهند
        requestReload()
        toast("success", "نشست تازه شد — همان‌جایی که بودی.")
        return
      }
      // نجات ممکن نشد — مسیرِ کاملِ بوت/اینترو (فرمِ مهمان یا صفحه‌ی خطا)
      setSessionSheetOpen(false)
      await bootRef.current?.()
    } finally {
      setSessionRecovering(false)
    }
  }, [sessionRecovering, setSnapshot, requestReload, toast])

  const markReturningWelcome = useGame((s) => s.markReturningWelcome)
  const replayIntro = useGame((s) => s.replayIntro)
  const consumeIntroReplay = useGame((s) => s.consumeIntroReplay)

  // ─── V14 موجِ 16b: نشانِ تبِ گروه — دعوت‌های دوئلِ در انتظارِ من ───
  const groupData = useGame((s) => s.groupData)
  const loadGroup = useGame((s) => s.loadGroup)
  const duelBadge = React.useMemo(
    () => (groupData?.snapshot?.challenges ?? []).filter((c) => c.status === "pending" && c.myRole).length,
    [groupData],
  )
  // بارِ اولِ نشست، بی‌صدا دنیای گروه را می‌آوریم تا نشان، پیش از باز‌کردنِ تب، زنده باشد؛
  // باز‌شدنِ خودِ تب همان‌طور همیشه تازه‌سازی می‌کند (اثکتِ GroupScreen)
  React.useEffect(() => {
    if (phase === "ready" && groupData === null) void loadGroup()
  }, [phase, groupData, loadGroup])

  // ─── بوت ────────────────────────────────────────────────────────────────
  const boot = React.useCallback(async () => {
    setPhase("booting")
    setBootError(null)
    const hadWebApp = !!getWebApp()
    if (hadWebApp) initTelegram()
    // اسکریپت WebApp باید با beforeInteractive آمده باشد؛ اگر نیامده، این‌جا می‌آوریمش
    const wa = await ensureTelegramScript()
    if (wa && !hadWebApp) initTelegram()
    const initData = getWebApp()?.initData ?? ""
    const res = await api.login({ initData })
    if (res.ok) {
      setSnapshot(res.data.snapshot)
      setPlayerId(res.data.playerId)
      // فمبویِ بسته‌شده = از اینترو عبور کرده — حتی اگر رویدادِ first_day هنوز ندیده
      // باشیم (onboarded فقط با آن رویداد true می‌شود؛ نباید فرمِ هویت را تکرار کند)
      const firstTime = res.data.created || (!res.data.onboarded && !res.data.snapshot.femboy)
      if (firstTime) {
        // تازه‌وارد یا حسابِ ساخته‌شده از ربات — قولِ بازی + فرمِ هویت
        setIntro({
          mode: "first",
          playerExists: true,
          fromTelegram: !!initData,
          name: res.data.snapshot.player.name,
          avatar: res.data.snapshot.player.avatar,
        })
        setPhase("intro")
      } else if (!hasSeenIntro(res.data.playerId)) {
        // برگشته‌ای که قولِ بازی را روی این دستگاه ندیده — یک بار نشانش می‌دهیم، بدون فرم
        setIntro({
          mode: "returning",
          playerExists: true,
          fromTelegram: !!initData,
          name: res.data.snapshot.player.name,
          avatar: res.data.snapshot.player.avatar,
        })
        setPhase("intro")
      } else {
        // برگشته‌ی همیشگی — صفحه‌ی ورود: برند + نبضِ شهر + دعوت (اتو-ادوانس/یک لمس)
        setPhase("opening")
      }
      if (!res.data.created && res.data.onboarded) {
        // کارتِ «برگشتی» — یک بار در هر جلسه روی پیشخوان
        markReturningWelcome()
      }
    } else if (initData) {
      // تلگرامی هستیم ولی ورود نشد — یک تلاشِ خودکار (پنجره‌ی گذارِ سرور)، بعد صفحه‌ی خطا
      bootAttemptsRef.current += 1
      if (bootAttemptsRef.current === 1) {
        window.setTimeout(() => void bootRef.current?.(), 1200)
        return
      }
      setBootError(res.error)
      setPhase("error")
    } else {
      // مرورگر بدون جلسه — سینماتیک + فرم که خودش بازیکن می‌سازد.
      // V16-2: اگر همین جلسه مهمان بوده (نشست با ری‌استارتِ سرور مُرده)، اسم/آواتارِ
      // ذخیره‌شده را پیش‌پر می‌کنیم — بازیابیِ نرم به‌جای فرمِ سرد.
      const saved = readPersistedGuestIdentity()
      setIntro({
        mode: "first",
        playerExists: false,
        fromTelegram: false,
        name: saved?.name ?? "",
        avatar: saved?.avatar ?? "🎀",
      })
      setPhase("intro")
    }
  }, [setSnapshot, markReturningWelcome])

  // bootRef بعد از تعریفِ boot سینک می‌شود — رتریِ خودکار از این‌جا عبور می‌کند
  React.useEffect(() => {
    bootRef.current = boot
  }, [boot])

  React.useEffect(() => {
    void boot()
  }, [boot])

  // ─── پخشِ دوباره‌ی اینترو (از تبِ «من») ────────────────────────────────────
  // تبِ فعال دست‌نخورده می‌ماند — بعد از اسلایدها همان‌جا برمی‌گردی
  React.useEffect(() => {
    if (!replayIntro || phase !== "ready" || !snapshot) return
    consumeIntroReplay()
    setIntro({
      mode: "replay",
      playerExists: true,
      fromTelegram: !!getWebApp()?.initData,
      name: snapshot.player.name,
      avatar: snapshot.player.avatar,
    })
    setPhase("intro")
  }, [replayIntro, phase, snapshot, consumeIntroReplay])

  // ─── دکمه‌ی برگشتِ تلگرام ─────────────────────────────────────────────────
  // V16-2 (ممیزیِ ⑮): به‌جای «همیشه خانه»، تاریخِ تب‌ها را دنبال می‌کند — یک قدم
  // عقب؛ پشته‌ی خالی → خانه. دکمه‌ی سخت‌افزاریِ اندروید دیگر اپ را نمی‌بندد.
  // V22: برگشتِ سخت‌افزاری اول بالاترین شیتِ باز را می‌بندد (پشته‌ی شیت‌های
  // GlassSheet)، بعد تاریخِ تب‌ها را دنبال می‌کند — شیتِ باز هرگز پشتِ دکمه‌ی
  // برگشت گم نمی‌شود و بعدش همان مسیرِ همیشگی ادامه می‌یابد.
  const tabStack = useGame((s) => s.tabStack)
  const goBackTab = useGame((s) => s.goBackTab)
  const sheetClosers = useGame((s) => s.sheetClosers)
  const closeTopSheet = useGame((s) => s.closeTopSheet)
  React.useEffect(() => {
    const bb = getWebApp()?.BackButton
    if (!bb) return
    const handler = () => {
      haptic("light")
      // اول بالاترین شیتِ باز بسته شود؛ اگر شیتی نبود، یک قدم در تاریخِ تب‌ها
      if (closeTopSheet()) return
      goBackTab()
    }
    try {
      // جایی برای برگشتن هست: یا شیتِ بازی باز است، یا تبِ فعلی خانه نیست، یا از جایی آمده‌ایم
      if (phase === "ready" && (sheetClosers.length > 0 || activeTab !== "home" || tabStack.length > 0)) {
        bb.onClick(handler)
        bb.show()
      } else {
        bb.hide()
      }
    } catch {
      // نسخه‌های قدیمیِ WebApp — بی‌خیال
    }
    return () => {
      try {
        bb.offClick(handler)
      } catch {
        // بعضی نسخه‌ها offClick ندارند
      }
    }
  }, [activeTab, phase, tabStack.length, goBackTab, sheetClosers.length, closeTopSheet])

  /** ثبتِ هویت از اینترو — تلگرامی/جلسه‌دار: setIdentity · مهمانِ تازه: ساختِ بازیکن */
  async function submitIdentity(name: string, avatar: string): Promise<boolean> {
    if (intro?.playerExists) {
      const res = await api.action("setIdentity", { name, avatar })
      if (res.ok) {
        setSnapshot(res.data.snapshot)
        if (playerId) markIntroSeen(playerId)
        setIntro(null)
        setPhase("ready")
        return true
      }
      toast("error", res.error)
      return false
    }
    const res = await api.login({ name, avatar })
    if (res.ok) {
      setSnapshot(res.data.snapshot)
      setPlayerId(res.data.playerId)
      markIntroSeen(res.data.playerId)
      // V16-2: هویتِ مهمان ذخیره می‌شود تا بازیابیِ نشست (شیتِ «ادامه بده») بی‌صدا کار کند
      persistGuestIdentity(name, avatar)
      setIntro(null)
      setPhase("ready")
      return true
    }
    toast("error", res.error)
    return false
  }

  /** پایانِ حالتِ برگشته/پخشِ دوباره — فقط اسلایدها تمام شد */
  function finishIntro() {
    if (playerId) markIntroSeen(playerId)
    setIntro(null)
    setPhase("ready")
  }

  /** آخرین راهِ نجات: اگر اعتبارسنجیِ تلگرام حتی بعد از رتری نشد، حداقل مینی‌اپ
   *  بالا بیاید — فرمِ هویتِ مهمان (همان مسیرِ مرورگر). حسابِ تلگرامی‌ات بعداً
   *  که سرور جواب بدهد همان‌جاست که بود. */
  function enterAsGuest() {
    haptic("medium")
    setBootError(null)
    setIntro({ mode: "first", playerExists: false, fromTelegram: false, name: "", avatar: "🎀" })
    setPhase("intro")
  }

  /** پایانِ صفحه‌ی ورود — ورود به داشبورد (بدون ثبتِ دوباره؛ قولِ بازی از قبل دیده شده) */
  function finishOpening() {
    setPhase("ready")
  }

  function openNotifications() {
    if (snapshot) {
      setUnreadIds(new Set(snapshot.notifications.filter((n) => !n.read).map((n) => n.id)))
      if (snapshot.unreadNotifications > 0) {
        // بی‌صدا خوانده‌شده کن
        void api.action("readNotifications").then((res) => {
          if (res.ok) setSnapshot(res.data.snapshot)
        })
      }
    }
    setNotifOpen(true)
  }

  // ─── رندر ───────────────────────────────────────────────────────────────
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-app">
        {/* هاله‌های محیطی — خیلی کم، فقط حس */}
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-28 -right-28 size-96 rounded-full bg-pink-500/[0.07] blur-3xl" />
          <div className="absolute -bottom-32 -left-28 size-96 rounded-full bg-violet-500/[0.07] blur-3xl" />
        </div>

        {phase === "booting" ? <SplashScreen /> : null}
        {phase === "error" ? (
          <BootErrorScreen error={bootError} onRetry={() => void boot()} onGuest={enterAsGuest} />
        ) : null}
        <AnimatePresence>
          {phase === "opening" && snapshot ? (
            <OpeningSplash key="opening" snapshot={snapshot} onDone={finishOpening} />
          ) : null}
        </AnimatePresence>
        {phase === "intro" && intro ? (
          <IntroFlow
            mode={intro.mode}
            playerExists={intro.playerExists}
            fromTelegram={intro.fromTelegram}
            prefillName={intro.name}
            prefillAvatar={intro.avatar}
            onSubmit={(n, a) => submitIdentity(n, a)}
            onDone={finishIntro}
          />
        ) : null}

        {phase === "ready" && snapshot ? (
          <div className="flex min-h-screen flex-col">
            {/* ─── هدر چسبان ─── */}
            <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-xl">
              <div className="mx-auto flex w-full max-w-md items-center gap-2 px-3 py-2">
                <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
                  <Chip tone="pink" className="shrink-0 font-bold">
                    🎀 روز {faNum(snapshot.world.dayCount)}
                  </Chip>
                  {snapshot.player.stageBadge ? (
                    <Chip tone="violet" className="shrink-0 font-bold">
                      {snapshot.player.stageBadge.emoji} {snapshot.player.stageBadge.name}
                    </Chip>
                  ) : null}
                  <Chip className="shrink-0">
                    {snapshot.world.weatherEmoji} {snapshot.world.weatherLabel}
                  </Chip>
                  <Chip className="shrink-0">{snapshot.world.moodLabel}</Chip>
                  <Chip className="shrink-0" tone="rose">
                    🔥 {faNum(snapshot.world.chaosLevel)}
                  </Chip>
                  {snapshot.world.globalEvent ? (
                    <Chip tone="violet" className="shrink-0">
                      {snapshot.world.globalEvent.emoji} {snapshot.world.globalEvent.name} ·{" "}
                      {faNum(snapshot.world.globalEvent.endsInMinutes)} دقیقه
                    </Chip>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    setCodexOpen(true)
                  }}
                  aria-label="راهنما"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-foreground/80 transition-colors hover:text-primary"
                >
                  <BookOpen className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    openNotifications()
                  }}
                  aria-label="اعلان‌ها"
                  className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-foreground/80 transition-colors hover:text-primary"
                >
                  <Bell className="size-5" />
                  {snapshot.unreadNotifications > 0 ? (
                    <span className="absolute top-0.5 end-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 py-0.5 text-[11px] font-black text-primary-foreground tabular-nums">
                      {faNum(snapshot.unreadNotifications)}
                    </span>
                  ) : null}
                </button>
              </div>
            </header>

            {/* ─── محتوای تب‌ها ─── */}
            <main className="mx-auto w-full max-w-md flex-1 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+5.75rem)]">
              {TABS.map((t) => {
                const isActive = t.key === activeTab
                return (
                  <div key={t.key} className={isActive ? "block" : "hidden"} aria-hidden={!isActive}>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 6 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {t.key === "home" ? <HomeScreen /> : null}
                      {t.key === "soul" ? <SoulScreen /> : null}
                      {t.key === "city" ? <CityTabs /> : null}
                      {t.key === "bag" ? <EconomyScreen /> : null}
                      {t.key === "me" ? <MeScreen /> : null}
                    </motion.div>
                  </div>
                )
              })}
            </main>

            {/* ─── ناو پایین ─── */}
            <nav
              aria-label="ناوبری اصلی"
              className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
            >
              <div className="mx-auto grid w-full max-w-md grid-cols-5">
                {TABS.map((t) => {
                  const isActive = t.key === activeTab
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-label={`${t.emoji} ${t.label}`}
                      onClick={() => {
                        if (!isActive) haptic("light")
                        setActiveTab(t.key)
                      }}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-[3.75rem] w-full select-none flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "text-lg leading-5 transition-transform",
                          isActive && "drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]",
                        )}
                      >
                        {t.emoji}
                      </span>
                      <span
                        className={cn(
                          // V22: پنج ستون در 320px یعنی ~64px — برچسب‌ها کامل جا
                          // می‌شوند؛ ellipsis فقط برای خیلی بلندی‌ها می‌ماند و
                          // full label همیشه در aria-label است.
                          "w-full max-w-full truncate text-[11px] leading-4",
                          isActive ? "font-bold" : "font-medium",
                        )}
                      >
                        {t.label}
                      </span>
                      {/* نشانِ دوئل‌های در انتظار — همان زبانِ بصریِ زنگِ اعلان‌ها؛
                          V22: نشان با خودِ شهرِ گروه به تبِ «شهر» آمد */}
                      {t.key === "city" && duelBadge > 0 ? (
                        <span className="absolute top-0.5 end-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-black leading-4 text-primary-foreground tabular-nums">
                          <span aria-hidden>{faNum(duelBadge)}</span>
                          <span className="sr-only">دعوتِ دوئلِ در انتظار</span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </nav>

            {/* ─── رکاپ آفلاین ─── */}
            {snapshot.offlineRecap ? (
              <OfflineRecapModal recap={snapshot.offlineRecap} onDismiss={clearOfflineRecap} />
            ) : null}

            {/* ─── شیت اعلان‌ها ─── */}
            <GlassSheet open={notifOpen} onOpenChange={setNotifOpen} title="🔔 چه خبرا شده">
              {snapshot.notifications.length === 0 ? (
                <p className="py-8 text-center text-xs leading-6 text-muted-foreground">
                  هنوز خبری نیست. بی‌خبری هم خودش یه خبر است.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {snapshot.notifications.map((n) => {
                    const fresh = unreadIds.has(n.id)
                    return (
                      <li
                        key={n.id}
                        className={cn(
                          "flex items-start gap-2.5 rounded-2xl border p-3",
                          fresh ? "border-primary/30 bg-primary/[0.06]" : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <span aria-hidden className="mt-0.5 text-lg leading-6">
                          {n.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold">{n.title}</p>
                            <time className="shrink-0 text-[11px] text-muted-foreground">{faTimeAgo(n.at)}</time>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-5 text-foreground/75">{n.body}</p>
                        </div>
                        {fresh ? <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-primary" /> : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </GlassSheet>

            {/* ─── V21: شیتِ راهنما — نمونه‌ی واحد؛ مقصدها: ردیفِ راهنمای خانه + ردیفِ راهنمای پروفایل ─── */}
            <CodexSheet open={codexOpen} onOpenChange={setCodexOpen} />

            {/* ─── V16-2: بازیابیِ نشست — 401 وسطِ بازی (ممیزیِ ⑦) ─── */}
            <SessionExpiredSheet
              open={sessionSheetOpen}
              recovering={sessionRecovering}
              onContinue={() => void recoverSession()}
              onDismiss={() => setSessionSheetOpen(false)}
            />
          </div>
        ) : null}

        {/* ─── توست‌ها ─── */}
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[70]">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-4">
            <AnimatePresence>
              {toasts.map((t) => (
                <ToastCard key={t.id} id={t.id} kind={t.kind} title={t.title} description={t.description} onDismiss={dismissToast} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}

// ─── اسپلش ──────────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-3 px-6">
      <motion.div
        aria-hidden
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
        className="text-6xl"
      >
        🎀
      </motion.div>
      <h1 className="text-2xl font-black tracking-wide text-glow">FEMBOY WAR</h1>
      <p className="text-xs leading-6 text-muted-foreground">داریم می‌بینیم چه بلایی سرت اومده...</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-primary/70"
            animate={{ opacity: [0.25, 1, 0.25] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── خطای بوت ───────────────────────────────────────────────────────────────

function BootErrorScreen({ error, onRetry, onGuest }: { error: string | null; onRetry: () => void; onGuest?: () => void }) {
  return (
    <div className="flex min-h-app flex-col items-center justify-center gap-3 px-6 text-center">
      <span aria-hidden className="text-5xl">
        🫥
      </span>
      <h1 className="text-lg font-extrabold">یه چیزی خراب شد.</h1>
      <p className="max-w-xs text-xs leading-6 text-muted-foreground">
        حتی ما هم نمی‌دونیم چرا. {error ? `شهرداری می‌گه: «${error}»` : ""}
      </p>
      <ActionButton variant="primary" className="mt-2" onClick={onRetry}>
        دوباره تلاش کن
      </ActionButton>
      {onGuest ? (
        <>
          <p className="mt-4 max-w-xs text-[11px] leading-5 text-muted-foreground/70">
            اگر دوباره هم نشد، فعلاً به‌عنوان مهمان بیا داخل — حسابِ تلگرامی‌ات جای خودش محفوظ است.
          </p>
          <ActionButton variant="ghost" onClick={onGuest}>
            ورود به‌عنوان مهمان
          </ActionButton>
        </>
      ) : null}
    </div>
  )
}

// ─── V16-2: شیتِ «نشستت منقضی شد» (ممیزیِ ⑦) ────────────────────────────────
// بازیابیِ درجا — نه ریستِ کامل: «ادامه بده» بی‌صدا دوباره وارد می‌شود (initData یا
// اسمِ ذخیره‌شده‌ی همین جلسه) و همان صفحه تازه می‌شود؛ اگر نشد، مسیرِ کاملِ بوت.

function SessionExpiredSheet(props: {
  open: boolean
  recovering: boolean
  onContinue: () => void
  onDismiss: () => void
}) {
  const { open, recovering, onContinue, onDismiss } = props
  return (
    <GlassSheet
      open={open}
      onOpenChange={(v) => {
        // در حالِ بازیابی بسته نمی‌شود؛ بستنِ دستی آزاد است — 401ِ بعدی دوباره می‌آورد
        if (!v && !recovering) onDismiss()
      }}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>🗝</span> نشستت منقضی شد
        </span>
      }
      footer={
        <ActionButton variant="primary" fullWidth loading={recovering} onClick={onContinue}>
          ادامه بده
        </ActionButton>
      }
    >
      <p className="text-xs leading-6 text-foreground/80">
        شهر چند لحظه پشتت را برگرداند و تو بیرون ماندی. با «ادامه بده» بی‌صدا برمی‌گردی —
        همان صفحه، همان بازی.
      </p>
      <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-muted-foreground">
        اگر جواب نداد، خودمان دوباره از درِ اصلی می‌آییمت.
      </p>
    </GlassSheet>
  )
}

// ─── رکاپ آفلاین ────────────────────────────────────────────────────────────

function OfflineRecapModal({ recap, onDismiss }: { recap: OfflineRecapDTO; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="در نبودت">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-[6px]"
        onClick={onDismiss}
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="glass-strong relative w-full max-w-sm p-5"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">در نبودت...</h2>
          <Chip tone="violet">حدود {faNum(recap.elapsedHours)} ساعت</Chip>
        </div>
        <ul className="scrollbar-thin mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pe-0.5">
          {recap.lines.map((l, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <span aria-hidden className="mt-0.5 text-base leading-6">
                {l.icon}
              </span>
              <span className="min-w-0 text-xs leading-6 text-foreground/85">{l.text}</span>
            </motion.li>
          ))}
        </ul>
        <ActionButton variant="primary" fullWidth className="mt-4" onClick={onDismiss}>
          دیدم
        </ActionButton>
      </motion.div>
    </div>
  )
}

// ─── توست ───────────────────────────────────────────────────────────────────

const TOAST_STYLE: Record<string, { border: string; icon: string; iconColor: string }> = {
  success: { border: "border-emerald-400/30", icon: "✅", iconColor: "text-emerald-300" },
  error: { border: "border-rose-400/30", icon: "⚠️", iconColor: "text-rose-300" },
  voice: { border: "border-violet-400/30", icon: "💬", iconColor: "text-violet-300" },
}

function ToastCard(props: { id: number; kind: string; title: string; description?: string; onDismiss: (id: number) => void }) {
  const { id, kind, title, description, onDismiss } = props
  const style = TOAST_STYLE[kind] ?? TOAST_STYLE.voice
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={() => onDismiss(id)}
      className={cn(
        "glass-strong pointer-events-auto flex w-full items-start gap-2.5 rounded-2xl border p-3 text-start",
        style.border,
      )}
      aria-live="polite"
    >
      <span aria-hidden className={cn("mt-0.5 text-sm leading-5", style.iconColor)}>
        {style.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold leading-5">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </motion.button>
  )
}
