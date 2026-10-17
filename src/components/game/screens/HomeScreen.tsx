"use client"

// پیشخوان — «الان چه خبر است؟»
import * as React from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import type { FemboySummaryDTO, HistoryItemDTO, OutcomeDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { haptic } from "../telegram"
import { faNum, faPercent } from "../fa"
import { EventCard, OutcomeReveal } from "../EventCard"
import { DirectionCard } from "./guide/DirectionCard"
import { ActionButton, Chip, GlassCard, GlassSheet, ProgressBar, SectionTitle, StatPill } from "../ui"
import { spiritBarClass } from "./soul/classMeta"
import { cn } from "@/lib/utils"

// ─── اسکرین ──────────────────────────────────────────────────────────────────
// V16-2 (ممیزیِ ⑧): نمایشِ سه‌گانه‌یِ دنیا یکی کم شد — وضعیتِ شهر (آب‌وهوا/مود/آشوب/رویدادِ
// جهانی) در چیپ‌های هدر و «نبض شهر» زنده است؛ زیرِ سلام دیگر تکرار نمی‌شود.

export function HomeScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const setSnapshot = useGame((s) => s.setSnapshot)
  const refresh = useGame((s) => s.refresh)
  const runAction = useGame((s) => s.runAction)
  const toast = useGame((s) => s.toast)
  const activeTab = useGame((s) => s.activeTab)
  const returningWelcome = useGame((s) => s.returningWelcome)
  const dismissReturningWelcome = useGame((s) => s.dismissReturningWelcome)
  // V16-2 (ممیزیِ ⑧): نسخه‌ی دنیا — با اکشن/رویدادِ موفق بالا می‌رود، نه با هر تیکِ serverTime
  const worldVersion = useGame((s) => s.worldVersion)
  const bumpWorld = useGame((s) => s.bumpWorld)

  const [drawing, setDrawing] = React.useState(false)
  const [choosing, setChoosing] = React.useState<number | null>(null)
  const [outcome, setOutcome] = React.useState<OutcomeDTO | null>(null)
  const [working, setWorking] = React.useState(false)
  const [restingAct, setRestingAct] = React.useState(false)
  const [bingoOpen, setBingoOpen] = React.useState(false)
  const [stake, setStake] = React.useState(50)
  const [gambling, setGambling] = React.useState(false)
  const [lastHistory, setLastHistory] = React.useState<HistoryItemDTO | null>(null)

  // آخرین خط تاریخچه — فقط وقتی خودِ پیشخوان فعال است؛ فقط با اکشن/رویدادِ موفق
  // (worldVersion)، عوض‌شدنِ روز، یا برگشتن به تب — نه با هر تیکِ serverTime (ممیزیِ ⑧)
  const dayCount = snapshot?.world.dayCount
  React.useEffect(() => {
    if (activeTab !== "home") return
    let alive = true
    void api.history(0, 1).then((res) => {
      if (res.ok && alive) setLastHistory(res.data.items[0] ?? null)
    })
    return () => {
      alive = false
    }
  }, [activeTab, worldVersion, dayCount])

  if (!snapshot) return null
  const { player, world, activeEvent } = snapshot

  async function draw() {
    if (drawing) return
    setDrawing(true)
    haptic("medium")
    const res = await api.drawEvent()
    if (res.ok) {
      setSnapshot(res.data.snapshot)
      // رویدادِ تازه کشیده شد — دنیا نسخه می‌گیرد (راهنما/آخرین خبر تازه شود)
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
      // انتخاب تمام شد — تاریخچه و راهنما باید تازه شوند
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
    const ok = await runAction("gamble", { stake })
    setGambling(false)
    if (ok) setBingoOpen(false)
  }

  const restBlocked = player.resting

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

      {/* سلام — فضا در هدر و «نبض شهر» زنده است؛ این‌جا فقط سلام (ممیزیِ ⑧) */}
      <header className="px-1">
        <h1 className="text-xl font-extrabold leading-8">
          سلام، {player.name}{" "}
          <span aria-hidden className="text-2xl align-middle">
            {player.avatar}
          </span>
        </h1>
      </header>

      {/* V9 — هویتِ مرکزی: کارتِ «فمبویِ من» (یا دعوت به پیمان) — اولین کارتِ صفحه */}
      <FemboyHomeCard femboy={snapshot.femboy} />

      {/* مسیرِ زندگی — مقطع، جهت، هدف‌ها، قدمِ بعدی + فرصت‌ها */}
      <DirectionCard onDrawEvent={() => void draw()} />

      {/* نوار آمار */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <StatPill icon="💰" label="سکه" value={faNum(player.money)} />
        <StatPill icon="⚡" label="انرژی" value={`${faNum(player.energy)}%`} tone={player.energy < 20 ? "danger" : "default"} />
        <StatPill icon="🍀" label="شانس" value={faNum(player.luck)} />
        <StatPill icon="🔥" label="آشوب" value={faNum(player.chaos)} tone={player.chaos > 60 ? "warning" : "default"} />
        <StatPill icon="⭐" label="شهرت" value={faNum(player.fame)} />
        {player.debt > 0 ? <StatPill icon="⛓" label="بدهی" value={faNum(player.debt)} tone="danger" /> : null}
      </div>

      {/* ناحیه‌ی اتفاق */}
      {outcome ? (
        <OutcomeReveal outcome={outcome} onContinue={() => setOutcome(null)} />
      ) : activeEvent ? (
        <EventCard event={activeEvent} choosing={choosing} onChoose={(i) => void choose(i)} />
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
      )}

      {/* اکشن‌های سریع */}
      <div className="flex gap-2">
        {player.job ? (
          <button
            type="button"
            disabled={!player.canWork || working}
            onClick={async () => {
              setWorking(true)
              await runAction("work")
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
            await runAction("rest")
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

      {/* آخرین خبر */}
      {lastHistory ? (
        <GlassCard pad="sm" className="flex items-center gap-2.5">
          <span aria-hidden className="text-lg leading-none">
            {lastHistory.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">آخرین چیزی که سرت اومد</p>
            <p className="truncate text-xs font-semibold leading-5">{lastHistory.text}</p>
          </div>
        </GlassCard>
      ) : null}

      {/* نبض شهر */}
      {world.feed.length > 0 ? (
        <GlassCard>
          <SectionTitle icon="📻" title="نبض شهر" />
          <ul className="flex flex-col gap-2">
            {world.feed.slice(0, 4).map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-xs leading-5 text-foreground/75">
                <span aria-hidden className="mt-0.5 shrink-0">
                  {f.icon}
                </span>
                <span className="min-w-0">{f.text}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

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

// ─── کارتِ «فمبویِ من» (V9) ───────────────────────────────────────────────────

/** برچسبِ شکلِ پایه در femboySummaryDTO — موتور تا پیش از فرگشتِ اول همین را می‌فرستد */
const BASE_EVOLUTION_NAME = "شکلِ آغازین"

/** هویتِ مرکزیِ پیشخوان: فمبویِ روح‌بسته — یا دعوت به بستنِ پیمان */
function FemboyHomeCard({ femboy }: { femboy: FemboySummaryDTO | null }) {
  const setActiveTab = useGame((s) => s.setActiveTab)

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

  // ── فمبویِ روح‌بسته — کارتِ هویت (V10: تسلط + اکسسوار + سلوکِ بعدی) ──
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
          {femboy.skillPoints > 0 ? (
            <Chip tone="amber" className="font-bold">
              ✨ {faNum(femboy.skillPoints)} نقطه‌مهارت
            </Chip>
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
