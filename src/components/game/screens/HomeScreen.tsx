"use client"

// خانه — «الان چه باید بکنم؟» (جهت، نه دفترچه‌ی راهنما)
// V22: از بالا به پایین — سلام → هویتِ فمبوی → قدمِ بعدی → اتفاق/فرصتِ الان →
// فعل‌های امروز → سه‌تاییِ وضعیت (سکه/انرژی/بدهی). چیزی که این‌جا نیست، همان لحظه
// در جای خودش زنده است: آب‌وهوا/مود/آشوب در چیپ‌های هدر، شانس داخلِ شیتِ بینگو،
// شهرت در تبِ «من»، خبرها و نبضِ شهر در تبِ «شهر».
// V17-2 (ممیزیِ ②): جلسه‌ی اولِ متمرکز — تا وقتی پیمان بسته نشده (journey.stage
// «new»/«awakened» — قراردادِ server-authoritativeِ V17-1) خودِ صفحه یکی حرف
// می‌زند: پیمانِ فمبوی، درشت و تنها؛ بقیه‌ی پیشخوان پشتِ «بقیه‌ی شهر» جمع می‌شود.
// تب‌ها دست‌نخورده‌اند — استیجینگ فقط روی تمرکزِ خودِ خانه است (§۲۱).
import * as React from "react"
import { motion } from "framer-motion"
import { ChevronDown, X } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import type { FemboySummaryDTO, OutcomeDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { haptic } from "../telegram"
import { faNum, faPercent } from "../fa"
import { ActionOutcomeCard } from "../ActionOutcomeCard"
import { EventCard, OutcomeReveal } from "../EventCard"
import { buildSnapshotNextStep, type OutcomeNextStep } from "../ui/outcomeMeta"
import { DirectionCard, OpportunitiesStrip } from "./guide/DirectionCard"
import { ActionButton, Chip, GlassCard, GlassSheet, ProgressBar, SectionTitle, StatPill } from "../ui"
import { spiritBarClass } from "./soul/classMeta"
import { cn } from "@/lib/utils"

// ─── اسکرین ──────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const setSnapshot = useGame((s) => s.setSnapshot)
  const refresh = useGame((s) => s.refresh)
  // V17-W2 (F1): اکشن‌های پیشخوان با کارتِ نتیجه — نتیجه‌ی آخرین اکشن + بستنش
  const runActionReveal = useGame((s) => s.runActionReveal)
  const actionOutcome = useGame((s) => s.actionOutcome)
  const setActionOutcome = useGame((s) => s.setActionOutcome)
  const setActiveTab = useGame((s) => s.setActiveTab)
  // V17-W3 (F5) — deep-linkِ سکشنِ فمبوی: قدمِ «نقطه‌مهارت» مستقیم به مهارت‌ها می‌رود
  const setPendingSoulSection = useGame((s) => s.setPendingSoulSection)
  const toast = useGame((s) => s.toast)
  const activeTab = useGame((s) => s.activeTab)
  const returningWelcome = useGame((s) => s.returningWelcome)
  const dismissReturningWelcome = useGame((s) => s.dismissReturningWelcome)
  const bumpWorld = useGame((s) => s.bumpWorld)

  const [drawing, setDrawing] = React.useState(false)
  const [choosing, setChoosing] = React.useState<number | null>(null)
  const [outcome, setOutcome] = React.useState<OutcomeDTO | null>(null)
  const [working, setWorking] = React.useState(false)
  const [restingAct, setRestingAct] = React.useState(false)
  const [bingoOpen, setBingoOpen] = React.useState(false)
  const [stake, setStake] = React.useState(50)
  const [gambling, setGambling] = React.useState(false)

  // V17-W2 (F1): کارتِ نتیجه‌ی اکشن مثلِ توست رفتار می‌کند — با ترکِ خانه جمع می‌شود
  React.useEffect(() => {
    if (activeTab !== "home") setActionOutcome(null)
  }, [activeTab, setActionOutcome])

  if (!snapshot) return null
  const { player, activeEvent } = snapshot

  // V17-2 — جلسه‌ی اولِ متمرکز: پیمان بسته نشده. مرحله از خودِ موتور می‌آید
  // (journey.stage)؛ نبودِ فمبوی هم همان شرط است — هیچ state جدی‌ای این‌جا ساخته نمی‌شود.
  const journeyStage = snapshot.journey?.stage
  const femboy = snapshot.femboy
  const focusMode = !femboy || journeyStage === "new" || journeyStage === "awakened"

  async function draw() {
    if (drawing) return
    setDrawing(true)
    haptic("medium")
    const res = await api.drawEvent()
    if (res.ok) {
      setSnapshot(res.data.snapshot)
      // رویدادِ تازه کشیده شد — دنیا نسخه می‌گیرد (راهنما/آخرین خبر تازه شود) و
      // کارتِ نتیجه‌ی اکشنِ قبلی جایش را به اتفاق می‌دهد (V17-W2 · F1)
      setActionOutcome(null)
      bumpWorld()
      haptic("heavy")
    } else {
      toast("voice", res.error)
    }
    setDrawing(false)
  }

  async function choose(index: number) {
    if (!activeEvent || choosing !== null || outcome) return
    haptic("medium")
    setChoosing(index)
    const res = await api.choose(activeEvent.id, index)
    if (res.ok) {
      setSnapshot(res.data.snapshot)
      setOutcome(res.data.outcome)
      // انتخاب تمام شد — تاریخچه و راهنما باید تازه شوند؛ کارتِ نتیجه‌ی اکشنِ
      // قبلی هم جمع می‌شود تا نتیجه‌ی اتفاقِ تازه تنها صدای ناحیه باشد (V17-W2 · F1)
      setActionOutcome(null)
      bumpWorld()
      haptic("heavy")
    } else {
      toast("error", res.error)
      // شاید اتفاق از رده خارج شده — تازه‌سازی
      void refresh()
    }
    setChoosing(null)
  }

  const bingoMax = Math.max(50, Math.min(5000, Math.floor(player.money * 0.3)))
  const winChance = Math.round((0.42 + (player.luck - 10) / 200) * 100)

  async function gamble() {
    if (gambling) return
    setGambling(true)
    // V17-W2 (F1): بینگو هم نتیجه‌اش را در کارت می‌گوید — نه در توستِ ۳.۵ ثانیه‌ای
    const res = await runActionReveal("gamble", { stake })
    setGambling(false)
    if (res) setBingoOpen(false)
  }

  const restBlocked = player.resting

  // ─── V17-2: قدمِ بعدیِ نتیجه — فقط از فیلدهای واقعیِ snapshotِ تازه مشتق می‌شود ───
  // (پاسخِ اکشن، خودش snapshot را عوض کرده). هیچ پیشنهادِ ساختگی‌ای در کار نیست؛
  // اولویت: پیمان → نقطه‌مهارت → کار → اتفاقِ بعدی → استراحت.
  // V17-W2 (F1): همان تابعِ واحد، کارتِ نتیجه‌ی اکشن‌ها را هم خدمت می‌کند؛
  // proceed هر دو کارت را می‌بندد و اکشن‌های کار/استراحت از مسیرِ انکشاف می‌روند.
  // V17-W3 (F1): زنجیره‌ی اولویت به سازنده‌ی مشترکِ outcomeMeta رفت (buildSnapshotNextStep)
  // تا بازار/کیف/من هم همان قدمِ صادق را بگیرند؛ رفتارِ خانه بی‌تغییر است.
  function buildOutcomeNextStep(): OutcomeNextStep | null {
    const proceed = (fn: () => void) => () => {
      setOutcome(null)
      setActionOutcome(null)
      fn()
    }
    return buildSnapshotNextStep(snapshot, {
      goSoul: proceed(() => setActiveTab("soul")),
      goSkills: proceed(() => {
        setPendingSoulSection("skills")
        setActiveTab("soul")
      }),
      work: proceed(() => void runActionReveal("work")),
      draw: proceed(() => void draw()),
      rest: proceed(() => void runActionReveal("rest")),
    })
  }

  // ─── تکه‌های مشترکِ دو چیدمان (عادی/متمرکز) — همان JSXِ همیشگی ───

  // V22 — سه‌تاییِ تصمیم‌گیر: سکه/انرژی/بدهی (بدهی فقط وقتی هست). آشوب در چیپِ هدرِ
  // پوسته است، شانس داخلِ شیتِ بینگو دیده می‌شود (همان‌جا که شرط بسته می‌شود)،
  // شهرت و بقیه‌ی شناسنامه در تبِ «من».
  const statPills = (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
      <StatPill icon="💰" label="سکه" value={faNum(player.money)} />
      <StatPill icon="⚡" label="انرژی" value={`${faNum(player.energy)}%`} tone={player.energy < 20 ? "danger" : "default"} />
      {player.debt > 0 ? <StatPill icon="⛓" label="بدهی" value={faNum(player.debt)} tone="danger" /> : null}
    </div>
  )

  const quickActions = (
    <div className="flex gap-2">
      {player.job ? (
        <button
          type="button"
          disabled={!player.canWork || working}
          onClick={async () => {
            setWorking(true)
            // V17-W2 (F1): نتیجه‌ی شیفت در کارتِ نتیجه می‌نشیند، نه در توست
            await runActionReveal("work")
            setWorking(false)
          }}
          className={cn(
            "glass flex min-h-[72px] flex-1 select-none flex-col items-center justify-center gap-0.5 px-2 py-2.5 transition-all active:scale-[0.97] disabled:opacity-50",
            player.canWork && "border-primary/20",
          )}
        >
          <span aria-hidden className="text-xl leading-6">
            ☕
          </span>
          <span className="text-xs font-bold">{working ? "در شیفت..." : "کار کن"}</span>
          <span className="text-[11px] leading-4 text-muted-foreground">
            {player.resting
              ? `خوابی — ${faNum(player.restMinutesLeft)} دقیقه`
              : player.canWork
                ? `${faNum(player.job.incomeMin)} تا ${faNum(player.job.incomeMax)} سکه`
                : `${faNum(player.workCooldownMinutes)} دقیقه تا شیفت`}
          </span>
        </button>
      ) : null}

      <button
        type="button"
        disabled={restBlocked || restingAct}
        onClick={async () => {
          setRestingAct(true)
          // V17-W2 (F1): نتیجه‌ی استراحت در کارتِ نتیجه می‌نشیند، نه در توست
          await runActionReveal("rest")
          setRestingAct(false)
        }}
        className="glass flex min-h-[72px] flex-1 select-none flex-col items-center justify-center gap-0.5 px-2 py-2.5 transition-all active:scale-[0.97] disabled:opacity-50"
      >
        <span aria-hidden className="text-xl leading-6">
          😴
        </span>
        <span className="text-xs font-bold">{restingAct ? "پتو رو کشیدی..." : "استراحت"}</span>
        <span className="text-[11px] leading-4 text-muted-foreground">
          {player.resting ? `${faNum(player.restMinutesLeft)} دقیقه تا صبحِ بعد` : "90 دقیقه خواب واقعی"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => {
          setStake(bingoMax)
          setBingoOpen(true)
        }}
        className="glass flex min-h-[72px] flex-1 select-none flex-col items-center justify-center gap-0.5 px-2 py-2.5 transition-all active:scale-[0.97]"
      >
        <span aria-hidden className="text-xl leading-6">
          🎲
        </span>
        <span className="text-xs font-bold">بینگو</span>
        <span className="text-[11px] leading-4 text-muted-foreground">مخربش</span>
      </button>
    </div>
  )

  // V17-W3 (F4) — پیوستگیِ شیفت‌های موفق: پاداشِ واقعیِ موتور (تا +۳۰٪) صادقانه
  // دیده می‌شود — همان جمله‌ای که flavorِ نتیجه‌ی شیفت می‌گوید (§16 یک زبان).
  // فقط وقتی workStreak > 0؛ X = min(30, streak×3) — همه از snapshot.
  const workStreakPct = player.workStreak > 0 ? Math.min(30, player.workStreak * 3) : 0
  const workStreakLine =
    player.job && player.workStreak > 0 ? (
      <p
        className="rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-1.5 text-[11px] font-semibold leading-5 text-amber-200"
        aria-label={`پیوستگیِ ${faNum(player.workStreak)} شیفت — پاداشِ دستمزدِ ${faNum(workStreakPct)} درصد`}
      >
        {workStreakPct >= 30
          ? `🔥 پیوستگیِ ${faNum(player.workStreak)} شیفت — پاداشِ کاملِ دستمزد (+${faNum(30)}٪)`
          : `🔥 پیوستگیِ ${faNum(player.workStreak)} شیفت — شیفتِ بعد ${faNum(workStreakPct)}٪ دستمزدِ بیشتر می‌دهد`}
      </p>
    ) : null

  // ناحیه‌ی اتفاق — در حالتِ متمرکز، دکمه‌ی کشیدن کارتِ فرعیِ جمع‌وجور است (ممیزیِ ②:
  // دیگر دو CTAی هم‌وزن ندارد) و در حالتِ عادی همان دکمه‌ی درشتِ انیمیشنیِ همیشگی.
  // V17-W2 (F1): نتیجه‌ی اکشن‌های پیشخوان (کار/استراحت/بینگو/فرصت) هم همین‌جا می‌نشیند —
  // آخرینِ صدای شهر مقدم است؛ با بستنش، نتیجه‌ی اتفاقِ در انتظار (اگر هست) برمی‌گردد.
  const eventArea = actionOutcome ? (
    <ActionOutcomeCard
      data={actionOutcome}
      nextStep={buildOutcomeNextStep()}
      onDismiss={() => setActionOutcome(null)}
    />
  ) : outcome ? (
    <OutcomeReveal outcome={outcome} onContinue={() => setOutcome(null)} nextStep={buildOutcomeNextStep()} />
  ) : activeEvent ? (
    <EventCard event={activeEvent} choosing={choosing} onChoose={(i) => void choose(i)} />
  ) : focusMode ? (
    <SecondaryDrawCard drawing={drawing} onDraw={() => void draw()} />
  ) : (
    <motion.button
      type="button"
      onClick={() => void draw()}
      disabled={drawing}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "glass relative flex min-h-44 w-full flex-col items-center justify-center gap-2 overflow-hidden border-primary/25 bg-primary/[0.05] p-6 transition-colors hover:bg-primary/[0.08] disabled:opacity-70",
      )}
      aria-label="کشیدن اتفاق امروز"
    >
      <motion.span
        aria-hidden
        className="text-5xl"
        animate={drawing ? undefined : { y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
      >
        🎲
      </motion.span>
      <span className="text-lg font-extrabold">
        {drawing ? "داریم می‌بینیم..." : "اتفاق امروز"}
      </span>
      <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">
        8⚡ انرژی می‌بره · هیچ‌کس نمی‌داند بعدش چه می‌شود.
      </span>
      {drawing ? (
        <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : null}
    </motion.button>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* کارتِ «برگشتی» — یک بار در هر جلسه */}
      {returningWelcome ? (
        <motion.section
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          aria-label="خوش‌آمدیِ برگشتی"
        >
          <GlassCard pad="sm" className="border-primary/25 bg-primary/[0.04]">
            <div className="flex items-start gap-2.5">
              <span aria-hidden className="mt-0.5 text-lg leading-6">
                💛
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-5">برگشتی؟</p>
                <p className="mt-1 text-[11px] leading-5 text-foreground/75">
                  شهر تو را یادش نرفته. {faNum(player.day)} روز است این‌جایی و هنوز اسمت را زیرِ لب می‌گیرد.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptic("light")
                  dismissReturningWelcome()
                }}
                aria-label="بستنِ کارتِ برگشتی"
                className="-mt-1 -me-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </GlassCard>
        </motion.section>
      ) : null}

      {/* سلام — وضعیتِ شهر در چیپ‌های هدر و تبِ شهر زنده است؛ این‌جا فقط سلام (ممیزیِ ⑧) */}
      <header className="px-1">
        <h1 className="text-xl font-extrabold leading-8">
          سلام، {player.name}{" "}
          <span aria-hidden className="text-2xl align-middle">
            {player.avatar}
          </span>
        </h1>
      </header>

      {focusMode ? (
        // ─── جلسه‌ی اولِ متمرکز (V17-2) — یک صدای اصلی: پیمان ───
        <>
          <FirstSessionPanel onPact={() => setActiveTab("soul")} />
          {eventArea}
          {/* V17-2 — کارتِ قدمِ بعدی می‌ماند (خوب است) — اما چیپِ پیمان را دیگر تکرار نمی‌کند */}
          <DirectionCard focusMode onDrawEvent={() => void draw()} />
          {/* بقیه‌ی پیشخوان — جمع‌شونده؛ پیشرفته‌ها پنهانِ همیشگی نیستند */}
          <FocusCityCollapse>
            <div className="flex flex-col gap-4">
              {statPills}
              {quickActions}
              {/* V17-W3 (F4) — پیوستگیِ شیفت‌ها زیرِ اکشنِ کار */}
              {workStreakLine}
              <OpportunitiesStrip />
            </div>
          </FocusCityCollapse>
        </>
      ) : (
        // ─── داشبوردِ کاملِ همیشگی (bound/rooted) ───
        <>
          {/* V9 — هویتِ مرکزی: کارتِ «فمبویِ من» */}
          <FemboyHomeCard femboy={snapshot.femboy} />

          {/* قدمِ بعدی — مقطع، جهت، هدف‌ها + فرصت‌ها */}
          <DirectionCard onDrawEvent={() => void draw()} />
          <OpportunitiesStrip />

          {/* ناحیه‌ی اتفاق */}
          {eventArea}

          {/* فعل‌های امروز — کار/استراحت/بینگو با هزینه‌های صادقانه */}
          {quickActions}

          {/* V17-W3 (F4) — پیوستگیِ شیفت‌ها زیرِ اکشنِ کار */}
          {workStreakLine}

          {/* V22 — سه‌تاییِ وضعیت، آخرِ صفحه: بعد از فعل‌ها */}
          {statPills}
        </>
      )}

      {/* شیت بینگوی مخرب */}
      <BingoSheet
        open={bingoOpen}
        onOpenChange={setBingoOpen}
        stake={stake}
        setStake={setStake}
        min={50}
        max={bingoMax}
        money={player.money}
        winChance={winChance}
        gambling={gambling}
        onGamble={() => void gamble()}
      />
    </div>
  )
}

// ─── جلسه‌ی اول (V17-2) — پنلِ پیمان: تنها CTAی اصلیِ صفحه ─────────────────────

/** پیمانِ فمبوی — درشت، روشن، با «چیستی و چرایی». صدای شهر کارتِ فرعیِ کنارش است. */
function FirstSessionPanel({ onPact }: { onPact: () => void }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      aria-label="اولین قدم — پیمانِ فمبوی"
    >
      <GlassCard className="relative overflow-hidden border-primary/40 bg-primary/[0.07]">
        {/* هاله‌ی محیطی — فقط حس */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-12 size-48 rounded-full bg-primary/[0.12] blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-3 py-4 text-center">
          <motion.span
            aria-hidden
            className="text-6xl leading-none drop-shadow-[0_0_16px_rgba(244,114,182,0.35)]"
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
          >
            🎀
          </motion.span>
          <div>
            <h2 className="text-xl font-extrabold leading-8">پیمانِ فمبوی ببند</h2>
            <p className="mt-1 text-[13px] font-bold leading-6 text-primary">رفیقِ اختصاصیِ تو در این شهر</p>
          </div>
          <p className="max-w-[32ch] text-[11px] leading-5 text-foreground/75">
            هر بازیکنِ این جهان یک فمبوی دارد — با اسم، کلاس و مسیرِ خودش. او کنار تو می‌جنگد و رشد می‌کند؛ نبرد او را نمی‌کشد.
          </p>
          <ActionButton
            variant="primary"
            size="lg"
            fullWidth
            emoji="✨"
            className="mt-1 min-h-18 text-base"
            onClick={onPact}
          >
            پیمانِ فمبوی ببند
          </ActionButton>
          <p className="text-[10px] leading-4 text-muted-foreground">کلاس · اسم · قفل — همین.</p>
        </div>
      </GlassCard>
    </motion.section>
  )
}

/** صدای شهر — کارتِ فرعیِ جمع‌وجور: هست، ولی با پیمان رقابت نمی‌کند (ممیزیِ ②) */
function SecondaryDrawCard({ drawing, onDraw }: { drawing: boolean; onDraw: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onDraw}
      disabled={drawing}
      whileTap={{ scale: 0.98 }}
      className="glass flex min-h-14 w-full select-none items-center justify-center gap-2.5 px-4 py-3 transition-colors hover:bg-white/[0.06] disabled:opacity-70"
      aria-label="یا اول صدای شهر را بشنو — کشیدنِ اتفاقِ امروز، 8 انرژی"
    >
      <span aria-hidden className="text-lg leading-none">
        🎲
      </span>
      <span className="text-[13px] font-semibold leading-5 text-foreground/85">یا اول صدای شهر را بشنو</span>
      <span className="text-[11px] leading-4 text-muted-foreground tabular-nums">· 8⚡</span>
      {drawing ? (
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : null}
    </motion.button>
  )
}

/** «بقیه‌ی شهر» — بقیه‌ی پیشخوان پشتِ یک درِ جمع‌شونده. پیش‌فرضِ بسته. */
function FocusCityCollapse({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <GlassCard pad="sm">
      <button
        type="button"
        onClick={() => {
          haptic("light")
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-1 py-1 text-start transition-colors hover:bg-white/[0.04]"
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          <span aria-hidden>🏙</span>
          بقیه‌ی شهر
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
          {open ? "بستن" : "آمار، اکشن‌ها، فرصت‌ها"}
          <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
        </span>
      </button>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mt-3"
        >
          {children}
        </motion.div>
      ) : null}
    </GlassCard>
  )
}

// ─── کارتِ «فمبویِ من» (V9) ───────────────────────────────────────────────────

/** برچسبِ شکلِ پایه در femboySummaryDTO — موتور تا پیش از فرگشتِ اول همین را می‌فرستد */
const BASE_EVOLUTION_NAME = "شکلِ آغازین"

/** هویتِ مرکزیِ خانه: فمبوی — یا دعوت به بستنِ پیمان (fallbackِ دفاعی؛ حالتِ
 *  اصلیِ «پیمان نبسته» حالا FirstSessionPanel است — ممیزیِ ②) */
function FemboyHomeCard({ femboy }: { femboy: FemboySummaryDTO | null }) {
  const setActiveTab = useGame((s) => s.setActiveTab)
  // V17-W3 (F12) — چیپِ نقطه‌مهارت دیگر کور نیست: با همان تمرکزِ ربات
  // («خرجشان کن») مستقیم به سکشنِ مهارت‌ها deep-link می‌شود
  const setPendingSoulSection = useGame((s) => s.setPendingSoulSection)

  // ── پیمان هنوز بسته نشده — مهم‌ترین قدمِ زندگی در این جهان ──
  if (!femboy) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        aria-label="پیمانِ فمبوی بسته نشده"
      >
        <GlassCard className="border-primary/30 bg-primary/[0.05]">
          <div className="flex items-start gap-3">
            <span aria-hidden className="shrink-0 text-3xl leading-none">
              🎀
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold leading-6">فمبوی نداری</p>
              <p className="mt-1 text-[11px] leading-5 text-foreground/75">
                هر بازیکنِ این جهان یک فمبویِ اختصاصی دارد — با اسم، کلاسِ همیشگی و مسیری که شهر برایش می‌نویسد. تو هنوز پیمان نبسته‌ای.
              </p>
            </div>
          </div>
          <ActionButton variant="primary" fullWidth className="mt-3" onClick={() => setActiveTab("soul")}>
            بستنِ پیمانِ فمبوی
          </ActionButton>
        </GlassCard>
      </motion.section>
    )
  }

  // ── فمبوی — کارتِ هویت (V10: تسلط + اکسسوار + سلوکِ بعدی) ──
  const evolved = femboy.evolutionName !== BASE_EVOLUTION_NAME
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-label={`فمبویِ من: ${femboy.name}`}
    >
      <GlassCard className="border-primary/25">
        <SectionTitle icon="🎀" title="فمبویِ من" />

        {/* هویت: ایموجیِ کلاس + اسم (+ اکسسوار) + کلاس (+ فرگشت) */}
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-3xl leading-none"
          >
            {femboy.classEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold leading-7">
              {femboy.name}
              {femboy.accessoryEmoji ? (
                <span aria-hidden className="ms-1 align-middle text-base">
                  {femboy.accessoryEmoji}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-5 text-muted-foreground">
              {femboy.classEmoji} {femboy.className}
              {evolved ? (
                <>
                  {" · "}
                  {femboy.evolutionEmoji} {femboy.evolutionName}
                </>
              ) : null}
            </p>
          </div>
        </div>

        {/* رتبه · سطح · کلاس-تسلط · رزم‌نامه · نقطه‌مهارتِ بی‌استفاده */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Chip tone="violet" className="font-bold">
            {femboy.rank.emoji} {femboy.rank.name} · سطح {faNum(femboy.level)}
          </Chip>
          <Chip tone="teal" className="font-bold">
            {femboy.mastery.emoji} {femboy.mastery.label} · <span dir="ltr" className="tabular-nums">M{faNum(femboy.mastery.level)}</span>
          </Chip>
          <Chip tone="emerald" className="font-bold">
            <span dir="ltr" className="tabular-nums">
              ⚔️ {faNum(femboy.wins)}W/{faNum(femboy.losses)}L
            </span>
          </Chip>
          {/* V17-W3 (F12) — نقطه‌مهارتِ بی‌استفاده: چیپِ قابل‌کلیک (همان تمرکزِ ربات: «خرجشان کن») */}
          {femboy.skillPoints > 0 ? (
            <button
              type="button"
              onClick={() => {
                haptic("light")
                setPendingSoulSection("skills")
                setActiveTab("soul")
              }}
              aria-label={`${faNum(femboy.skillPoints)} نقطه‌مهارتِ استفاده‌نشده — خرجِشان در مهارت‌های فمبوی`}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold leading-5 text-amber-300 transition-all duration-150 hover:bg-amber-500/20 active:scale-95"
            >
              ✨ {faNum(femboy.skillPoints)} نقطه‌مهارت — خرجشان کن
            </button>
          ) : null}
        </div>

        {/* سلوکِ بعدی — خطِ راهنمای ظریف */}
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
          <span aria-hidden className="shrink-0">🎯</span>
          <span className="truncate">{femboy.nextMilestone}</span>
        </p>

        {/* روحیه + استقامت — دو نوارِ فشرده */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-1 text-[11px] leading-4">
              <span className="shrink-0 font-bold">❤️ روحیه {faNum(femboy.spirit)}%</span>
              <span className="shrink-0 text-muted-foreground">
                <span aria-hidden>{femboy.condition.emoji}</span> {femboy.condition.label}
              </span>
            </div>
            <ProgressBar
              value={femboy.spirit}
              max={100}
              barClassName={spiritBarClass(femboy.condition.dmgMod)}
              label={`روحیه‌ی ${femboy.name}`}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-1 text-[11px] leading-4">
              <span className="shrink-0 font-bold">⚡ استقامت</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {faNum(femboy.stamina)}/{faNum(femboy.staminaMax)}
              </span>
            </div>
            <ProgressBar
              value={femboy.stamina}
              max={femboy.staminaMax}
              barClassName="bg-amber-300"
              label={`استقامتِ ${femboy.name}`}
            />
          </div>
        </div>

        {/* ورودِ واحد به تبِ فمبوی */}
        <ActionButton variant="soft" fullWidth className="mt-3.5" onClick={() => setActiveTab("soul")}>
          مدیریتِ فمبوی
        </ActionButton>
      </GlassCard>
    </motion.section>
  )
}

// ─── بینگوی مخرب ─────────────────────────────────────────────────────────────

function BingoSheet(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  stake: number
  setStake: (v: number) => void
  min: number
  max: number
  money: number
  winChance: number
  gambling: boolean
  onGamble: () => void
}) {
  const { open, onOpenChange, stake, setStake, min, max, money, winChance, gambling, onGamble } = props
  return (
    <GlassSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>🎲</span> بینگوی مخرب
        </span>
      }
      footer={
        <div className="flex gap-2">
          <ActionButton variant="ghost" fullWidth onClick={() => onOpenChange(false)}>
            بگذار بمونه
          </ActionButton>
          <ActionButton variant="primary" fullWidth loading={gambling} disabled={money < 50} onClick={onGamble}>
            بریزش
          </ActionButton>
        </div>
      }
    >
      <p className="text-xs leading-6 text-muted-foreground">
        قانونش ساده‌ست: دانه‌ها می‌ریزن یا چیدن. با شانسی که داری، حدود{" "}
        <span className="font-bold tabular-nums text-primary">{faPercent(winChance)}</span> شانس برد داری.
      </p>

      {money < 50 ? (
        <p className="mt-4 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-xs leading-5 text-rose-300">
          برای شرط‌بندی حداقل 50 سکه لازمه. این‌قدر هم نداری. اول برو کار کن.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">شرط:</span>
            <span className="font-extrabold text-amber-200 tabular-nums">{faNum(stake)} سکه</span>
          </div>
          <div className="mt-3 px-1">
            <Slider
              dir="rtl"
              min={min}
              max={max}
              step={10}
              value={[Math.min(Math.max(stake, min), max)]}
              onValueChange={(v) => setStake(v[0] ?? min)}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>حداکثر {faNum(max)}</span>
            <span>حداقل {faNum(min)}</span>
          </div>
          <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
            اگه بردی: <span className="font-bold tabular-nums text-emerald-300">{faNum(Math.round(stake * 1.8))} سکه</span> · اگه باختی،
            خدا باشه.
          </p>
        </>
      )}

      <div className="mt-3">
        <Chip tone="violet">هر نیم ساعت یه بار</Chip>
      </div>
    </GlassSheet>
  )
}
