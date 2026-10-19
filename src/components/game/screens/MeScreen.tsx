"use client"

// من — شناسنامه، آمار، دستاوردها، زندگی، گذشته، تنظیمات
//
// V16-2 (ممیزیِ ⑫): تک‌بلوکِ ۱۳-بخشی شکسته شد — سلسله‌مراتبِ روشن:
//   شناسنامه (فشرده) → آمار (۴ِ اصلی + «جزئیات بیشتر») → زندگی (خانه/وسیله/شغل/بدهی
//   زیر یک سقف — شیت‌های موجود دست‌نخورده) → دستاوردها → عنوان‌ها → داستان → گذشته
//   → تنظیمات (ویرایشِ نام و آواتار [تازه] + آموزش + کدکس + اشتراک).
// V16-2 (ممیزیِ ⑦): خطای پروفایل دیگر شوخیِ عمومی نیست — همان صدای واقعیِ ApiErr.
import * as React from "react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import type { HistoryItemDTO, PlayerDTO, ProfileResponse } from "@/lib/game/contract"
import type { CatalogResponse } from "@/lib/game/client"
// ایمپورتِ مستقیم از globals — باندلِ کلاینت را از کشیدنِ events.ts (1877 خط) و بقیه‌ی بشکه‌ی content بی‌خیال می‌کند
import { ACHIEVEMENTS } from "@/lib/game/content/globals"
import { api } from "@/lib/game/client"
import { useGame, persistGuestIdentity } from "../store"
import { haptic } from "../telegram"
import { copyText, faNum } from "../fa"
import { ActionOutcomeCard } from "../ActionOutcomeCard"
import { buildSnapshotNextStep, STAT_MEANING, type OutcomeNextStep } from "../ui/outcomeMeta"
import { ActionButton, Chip, EmptyState, GlassCard, GlassSheet, MoneyBadge, ProgressBar, SectionTitle } from "../ui"
import { CodexSheet } from "./codex/CodexSheet"
import { AVATARS } from "../IntroFlow"
import { cn } from "@/lib/utils"

// ─── آمار: ۴ِ اصلی همیشه پیدا؛ ۴ِ پیشرفته پشتِ «جزئیات بیشتر» (افشایِ تدریجی) ───

const PRIMARY_STATS: { key: keyof ProfileResponse["player"]; icon: string; label: string }[] = [
  { key: "health", icon: "❤️", label: "سلامتی" },
  { key: "energy", icon: "⚡", label: "انرژی" },
  { key: "luck", icon: "🍀", label: "شانس" },
  { key: "fame", icon: "⭐", label: "شهرت" },
]

const ADVANCED_STATS: { key: keyof ProfileResponse["player"]; icon: string; label: string }[] = [
  { key: "intelligence", icon: "🧠", label: "هوش" },
  { key: "chaos", icon: "🌀", label: "آشوب" },
  { key: "crime", icon: "🚨", label: "سابقه" },
  { key: "reputation", icon: "🕊", label: "اعتبار" },
]

const HISTORY_PAGE = 20

/** V17-W2 (F7) — نزدیکیِ زنده‌ی دستاوردهایِ آستانه‌ایِ پنهان از آمارِ واقعیِ بازیکن.
 *  فقط همین ۳ کلید (رجیستری: globals.ts — survivor «7 روز»، deep_debt «10,000»،
 *  chaos_agent «آشوب 50»)؛ بقیه‌ی دستاوردها رویدادی‌اند و همان «باید اتفاق بیفتد تا
 *  بدانی» می‌مانند. current == 0 → پیشرفتی نشان نمی‌دهیم (صادقانه). */
function achievementCloseness(
  key: string,
  player: PlayerDTO,
): { current: number; target: number; unit: string } | null {
  switch (key) {
    case "survivor":
      return { current: player.day, target: 7, unit: "روز" }
    case "deep_debt":
      return { current: player.debt, target: 10000, unit: "سکه" }
    case "chaos_agent":
      return { current: player.chaos, target: 50, unit: "آشوب" }
    default:
      return null
  }
}

export function MeScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const active = useGame((s) => s.activeTab === "me")
  const runAction = useGame((s) => s.runAction)
  const toast = useGame((s) => s.toast)
  // V17-W3 (F1): خریدِ خانه/وسیله و پس‌دادنِ بدهی نتیجه‌شان را در کارتِ نتیجه می‌گیرد
  const runActionReveal = useGame((s) => s.runActionReveal)
  const actionOutcome = useGame((s) => s.actionOutcome)
  const setActionOutcome = useGame((s) => s.setActionOutcome)
  // V17-W2 (F4): دکمه‌ی «قدمِ بعدی» حالت‌های خالی — مقصدِ موجود (خانه)، نه صفحه‌ی تازه
  const setActiveTab = useGame((s) => s.setActiveTab)
  // V17-W3 (F5) — قدمِ «نقطه‌مهارت» مستقیم به سکشنِ مهارت‌ها deep-link می‌شود
  const setPendingSoulSection = useGame((s) => s.setPendingSoulSection)
  // V17-W3 (hotfixِ runNext) — «بدهی‌ات را پس بده» از مسیرِ زندگی به شیتِ مبلغ می‌آید
  const pendingMeSheet = useGame((s) => s.pendingMeSheet)
  const setPendingMeSheet = useGame((s) => s.setPendingMeSheet)
  const requestIntroReplay = useGame((s) => s.requestIntroReplay)
  // بعد از بازیابیِ نشست (V16-2) همین صفحه بی‌درنگ تازه می‌شود
  const reloadSeq = useGame((s) => s.reloadSeq)

  const [profile, setProfile] = React.useState<ProfileResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  /** صدای واقعیِ خطا — از ApiErr؛ دیگر «حتی ما هم نمی‌دونیم» نیست (ممیزیِ ⑦) */
  const [error, setError] = React.useState<string | null>(null)
  const [catalog, setCatalog] = React.useState<CatalogResponse | null>(null)

  const [history, setHistory] = React.useState<HistoryItemDTO[]>([])
  const [cursor, setCursor] = React.useState(0)
  const [hasMore, setHasMore] = React.useState(true)
  const [histLoading, setHistLoading] = React.useState(false)

  const [houseSheet, setHouseSheet] = React.useState(false)
  const [vehicleSheet, setVehicleSheet] = React.useState(false)
  const [jobSheet, setJobSheet] = React.useState(false)
  const [debtSheet, setDebtSheet] = React.useState(false)
  // V17-W3 (hotfixِ runNext): «پس بده» از مسیرِ زندگی → شیتِ بدهی همین‌جا باز می‌شود؛
  // انتخابِ مبلغ جزئی از خودِ کنش است — دیگر شلیکِ بی‌مبلغ (۱ سکه‌ایِ موتور) نداریم
  React.useEffect(() => {
    if (!active || pendingMeSheet === null) return
    if (pendingMeSheet === "debt" && (profile?.player.debt ?? snapshot?.player.debt ?? 0) > 0) setDebtSheet(true)
    setPendingMeSheet(null)
  }, [active, pendingMeSheet, setPendingMeSheet, profile, snapshot])
  const [payAmount, setPayAmount] = React.useState("")
  const [paying, setPaying] = React.useState(false)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)
  /** کدکسِ راهنما — مرورگرِ سه‌سطحی (V14 موجِ 16b) */
  const [codexOpen, setCodexOpen] = React.useState(false)
  /** ویرایشِ نام و آواتار (V16-2 — ممیزیِ ⑫) */
  const [identitySheet, setIdentitySheet] = React.useState(false)
  /** جزئیاتِ آمار — افشایِ تدریجی (۴ِ اصلی همیشه پیدا) */
  const [statsOpen, setStatsOpen] = React.useState(false)
  /** خریدِ گرانِ در انتظارِ تأیید — خانه/وسیله: اول شیتِ تأیید، بعد اکشنِ همیشگی */
  const [confirmBuy, setConfirmBuy] = React.useState<
    { kind: "house" | "vehicle"; key: string; name: string; emoji: string; price: number } | null
  >(null)
  /** V17-W3 (F1) — نامِ اکشنی که کارتِ نتیجه‌ی فعلی را ساخت (پس‌دادن/خانه/وسیله)؛
   *  برای قدمِ بعدیِ خاصِ همان کنش. با بسته‌شدنِ کارت/ترکِ تب پاک می‌شود */
  const [outcomeAction, setOutcomeAction] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const [pr, cat, hist] = await Promise.all([api.profile(), api.catalog(), api.history(0, HISTORY_PAGE)])
    if (pr.ok && pr.data) setProfile(pr.data)
    else if (!pr.ok) setError(pr.error)
    else setError("پرونده‌ات خالی آمد.")
    if (cat.ok) setCatalog(cat.data)
    if (hist.ok) {
      setHistory(hist.data.items)
      setCursor(hist.data.nextCursor)
      setHasMore(hist.data.hasMore)
    } else {
      setHistory([])
      setHasMore(false)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!active) return
    void load()
  }, [active, load, reloadSeq])

  // V17-W3 (F1) — کارتِ نتیجه مثلِ توست رفتار می‌کند: با ترکِ تبِ من جمع می‌شود
  React.useEffect(() => {
    if (!active) {
      setActionOutcome(null)
      setOutcomeAction(null)
    }
  }, [active, setActionOutcome])

  async function loadMoreHistory() {
    if (histLoading || !hasMore) return
    setHistLoading(true)
    const res = await api.history(cursor, HISTORY_PAGE)
    if (res.ok) {
      setHistory((prev) => [...prev, ...res.data.items])
      setCursor(res.data.nextCursor)
      setHasMore(res.data.hasMore)
    }
    setHistLoading(false)
  }

  if (!snapshot) return null

  const player = profile?.player ?? snapshot.player
  const economy = snapshot.world.economyIndex

  async function afterAction() {
    await load()
  }

  // ─── V17-W3 (F1): قدمِ بعدیِ کارتِ نتیجه‌ی «من» ───
  // اولویت: درسِ مخصوصِ همان کنش (از snapshotِ تازه — بدهی/خانه/...)، بعد همان
  // زنجیره‌ی مشترکِ پیشخوان (پیمان → نقطه‌مهارت → کار → ...). هیچ hint ساختگی نیست.
  function buildMeNextStep(): OutcomeNextStep | null {
    if (!snapshot) return null
    const p = snapshot.player
    // پس‌دادنِ بدهی — خودِ زندگی جواب می‌دهد: تسویه شد یا هنوز مانده؟
    if (outcomeAction === "payDebt") {
      if (p.debt <= 0) {
        return { icon: "⛓", label: "بدونِ بدهی", hint: "فرهاد هنوز اسمت را نشنیده. همین‌طوری بمون." }
      }
      return {
        icon: "⛓",
        label: "باقی‌مانده‌اش را هم پس بده",
        hint: `${faNum(p.debt)} سکه مونده`,
        onClick: () => {
          setActionOutcome(null)
          setOutcomeAction(null)
          setPayAmount(String(p.debt))
          setDebtSheet(true)
        },
      }
    }
    // خریدِ خانه — اولین اجاره‌ی سقفِ تازه، همان لحظه یادآوری می‌شود (آموزشِ §15)
    if (outcomeAction === "buyHouse" && p.house) {
      return {
        icon: "🏠",
        label: "اجاره‌ی سقفِ تازه‌ات را یادت باشد",
        hint: `${faNum(p.house.rent)} سکه · ${faNum(p.house.rentDueInHours)} ساعت دیگه`,
      }
    }
    return buildSnapshotNextStep(snapshot, {
      goSoul: () => setActiveTab("soul"),
      goSkills: () => {
        setPendingSoulSection("skills")
        setActiveTab("soul")
      },
      // کار/استراحت/کشیدنِ اتفاق روی پیشخوان زندگی می‌کنند — قدم به همان‌جا
      work: () => setActiveTab("home"),
      rest: () => setActiveTab("home"),
      draw: () => setActiveTab("home"),
    })
  }

  async function payDebt() {
    if (paying) return
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount < 1) {
      toast("error", "مبلغ معتبر بده.")
      return
    }
    setPaying(true)
    // V17-W3 (F1): پیام/طعم/دلتای پس‌دادن در کارتِ نتیجه می‌نشیند، نه توستِ ۳.۵ ثانیه‌ای
    const res = await runActionReveal("payDebt", { amount: Math.round(amount) })
    setPaying(false)
    if (res) {
      setDebtSheet(false)
      setPayAmount("")
      setOutcomeAction("payDebt")
      void afterAction()
    }
  }

  /** تأییدِ خرید — همان اکشنِ همیشگی با همان busyKey؛ فقط یک قدمِ UI قبلش نشسته است */
  async function executeBuy() {
    if (!confirmBuy || busyKey) return
    const { kind, key } = confirmBuy
    setBusyKey(key)
    if (kind === "house") {
      // V17-W3 (F1): خریدِ خانه هم کارتِ نتیجه می‌گیرد (دلتا + «چی یعنی؟» + قدمِ بعدی)
      const res = await runActionReveal("buyHouse", { houseKey: key })
      setBusyKey(null)
      if (res) {
        setHouseSheet(false)
        setConfirmBuy(null)
        setOutcomeAction("buyHouse")
        void afterAction()
      }
      return
    }
    const res = await runActionReveal("buyVehicle", { vehicleKey: key })
    setBusyKey(null)
    if (res) {
      setVehicleSheet(false)
      setConfirmBuy(null)
      setOutcomeAction("buyVehicle")
      void afterAction()
    }
  }

  const ownedAchievements = new Set(player.achievements.map((a) => a.key))
  const activeTitleStr = player.activeTitle

  // گروه‌بندی تاریخچه بر اساس روز
  const dayGroups: { day: number; items: HistoryItemDTO[] }[] = []
  for (const h of history) {
    const last = dayGroups[dayGroups.length - 1]
    if (last && last.day === h.day) last.items.push(h)
    else dayGroups.push({ day: h.day, items: [h] })
  }

  const shareText = `🎀 FEMBOY WAR — ${player.name}: ${profile?.story[0] ?? "این شهر هنوز درباره‌ش ساکت است."}`

  return (
    <div className="flex flex-col gap-4">
      {/* V17-W3 (F1) — جایگاهِ کارتِ نتیجه‌ی کنش‌های «من» (پس‌دادنِ بدهی/خریدِ خانه/وسیله):
          بالایِ محتوای صفحه، تا بسته شود می‌ماند */}
      {actionOutcome ? (
        <ActionOutcomeCard
          data={actionOutcome}
          nextStep={buildMeNextStep()}
          onDismiss={() => {
            setActionOutcome(null)
            setOutcomeAction(null)
          }}
        />
      ) : null}

      {/* ── ۱. شناسنامه — فشرده ── */}
      {loading && !profile ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-36 rounded-3xl bg-white/[0.05]" />
          <Skeleton className="h-24 rounded-3xl bg-white/[0.05]" />
          <Skeleton className="h-24 rounded-3xl bg-white/[0.05]" />
        </div>
      ) : error ? (
        <GlassCard>
          <EmptyState
            emoji="🫥"
            text="پرونده‌ت گم شد."
            hint={error}
            action={
              <ActionButton variant="soft" size="sm" onClick={() => void load()}>
                دوباره
              </ActionButton>
            }
          />
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <div className="flex items-center gap-3">
              <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-3xl border border-primary/25 bg-primary/[0.08] text-4xl glow-pink">
                {player.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-extrabold leading-8">{player.name}</h1>
                {activeTitleStr ? (
                  <Chip tone="pink" className="mt-1">
                    {activeTitleStr}
                  </Chip>
                ) : null}
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {player.districtEmoji} {player.districtName} · روز {faNum(player.day)} از زندگی‌ات
                </p>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground/80">سطح {faNum(player.level)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {faNum(player.xp)} / {faNum(player.xpToNext)} ✨
                </span>
              </div>
              <ProgressBar value={player.xp} max={player.xpToNext || 1} label="پیشرفت سطح" />
            </div>
          </GlassCard>

          {/* ── ۲. آمار — ۴ِ اصلی + «جزئیات بیشتر» (افشایِ تدریجی، ممیزیِ ⑫) ── */}
          <section aria-label="آمار">
            <SectionTitle icon="📊" title="آمار" />
            <GlassCard pad="sm">
              <div className="grid grid-cols-4 gap-2">
                {PRIMARY_STATS.map((st) => (
                  <div
                    key={st.key}
                    // V17-W3 (F11) — معنای یک‌خطیِ هر کاشی از STAT_MEANING (ابزارکِ راهنما)
                    title={STAT_MEANING[st.label]}
                    className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] py-2.5"
                  >
                    <span aria-hidden className="text-lg leading-6">
                      {st.icon}
                    </span>
                    <span className="text-sm font-bold leading-5 tabular-nums">{faNum(player[st.key] as number)}</span>
                    <span className="text-[11px] leading-4 text-muted-foreground">{st.label}</span>
                  </div>
                ))}
              </div>
              {statsOpen ? (
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {ADVANCED_STATS.map((st) => (
                    <div
                      key={st.key}
                      title={STAT_MEANING[st.label]}
                      className="flex flex-col items-center gap-0.5 rounded-xl bg-white/[0.03] py-2.5"
                    >
                      <span aria-hidden className="text-lg leading-6">
                        {st.icon}
                      </span>
                      <span className="text-sm font-bold leading-5 tabular-nums">{faNum(player[st.key] as number)}</span>
                      <span className="text-[11px] leading-4 text-muted-foreground">{st.label}</span>
                    </div>
                  ))}
                  {/* V17-W3 (F11) — یک خطِ کم‌سر‌و‌صدا: معنا روی خودِ کاشی‌ها است */}
                  <p className="col-span-4 text-center text-[11px] leading-4 text-muted-foreground">
                    برای معنای هر کاشی، انگشتت را رویش نگه دار.
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  haptic("light")
                  setStatsOpen((v) => !v)
                }}
                aria-expanded={statsOpen}
                className="mt-2.5 min-h-11 w-full rounded-full text-[11px] font-bold text-primary transition-colors hover:text-primary/80"
              >
                {statsOpen ? "بستنِ جزئیات" : "جزئیات بیشتر"}
              </button>
            </GlassCard>
          </section>

          {/* ── ۳. زندگی — خانه/وسیله/شغل/بدهی زیر یک سقف (ممیزیِ ⑫) ── */}
          <section aria-label="زندگی">
            <SectionTitle icon="🏚" title="زندگی" />
            <GlassCard pad="sm">
              <ul className="flex flex-col gap-2">
                {/* خانه */}
                <li className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                    {player.house?.emoji ?? "🏠"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{player.house ? player.house.name : "بدون سقف"}</p>
                    <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                      {player.house
                        ? `اجاره ${faNum(player.house.rent)} سکه · ${faNum(player.house.rentDueInHours)} ساعت دیگه`
                        : "سقفِ آسمون رایگانه، ولی امانت نیست."}
                    </p>
                  </div>
                  <ActionButton size="sm" variant="soft" className="shrink-0" onClick={() => setHouseSheet(true)}>
                    {player.house ? "ارتقا" : "پیدا کن"}
                  </ActionButton>
                </li>
                {/* وسیله */}
                <li className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                    {player.vehicle?.emoji ?? "🛵"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{player.vehicle ? player.vehicle.name : "پیاده"}</p>
                    <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                      {player.vehicle ? player.vehicle.quirk : "شهر تا حدی لطف می‌کنه."}
                    </p>
                  </div>
                  <ActionButton size="sm" variant="soft" className="shrink-0" onClick={() => setVehicleSheet(true)}>
                    خرید وسیله
                  </ActionButton>
                </li>
                {/* شغل */}
                <li className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                    {player.job?.emoji ?? "💼"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold">{player.job ? player.job.name : "بی‌کاری"}</p>
                    <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                      {player.job
                        ? `${faNum(player.job.incomeMin)} تا ${faNum(player.job.incomeMax)} سکه در شیفت`
                        : "فقط حقوق نمی‌ده."}
                      {player.job && player.workCooldownMinutes > 0 ? (
                        <span className="font-semibold text-amber-300"> · ⏳ {faNum(player.workCooldownMinutes)} دقیقه تا شیفت</span>
                      ) : null}
                    </p>
                  </div>
                  <ActionButton size="sm" variant="soft" className="shrink-0" onClick={() => setJobSheet(true)}>
                    شغل‌ها
                  </ActionButton>
                </li>
                {/* بدهی */}
                <li
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    player.debt > 0 ? "border border-rose-400/20 bg-rose-500/[0.06]" : "bg-white/[0.03]",
                  )}
                >
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl">
                    ⛓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-bold", player.debt > 0 && "text-rose-300")}>
                      {player.debt > 0 ? `${faNum(player.debt)} سکه به دایی فرهاد` : "بدون بدهی"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                      {player.debt > 0 ? "دیر بدهی، بیشتر می‌شه. لبخندش کم نمی‌شه." : "فرهاد هنوز اسمت را نشنیده. همین‌طوری بمون."}
                    </p>
                  </div>
                  {player.debt > 0 ? (
                    <ActionButton size="sm" variant="danger" className="shrink-0" onClick={() => setDebtSheet(true)}>
                      پس بده
                    </ActionButton>
                  ) : null}
                </li>
              </ul>
            </GlassCard>
          </section>

          {/* ── ۴. دستاوردها ── */}
          <section aria-label="دستاوردها">
            <SectionTitle
              icon="🏆"
              title="دستاوردها"
              action={
                <Chip>
                  {faNum(ownedAchievements.size)} از {faNum(ACHIEVEMENTS.length)}
                </Chip>
              }
            />
            <GlassCard pad="sm">
              <div className="grid grid-cols-2 gap-2">
                {ACHIEVEMENTS.map((a) => {
                  const owned = ownedAchievements.has(a.key)
                  const hidden = a.hidden && !owned
                  // V17-W2 (F7) — نزدیکیِ صادقِ دستاوردِ آستانه‌ایِ پنهان (فقط همین ۳ کلید)
                  const closeness = hidden ? achievementCloseness(a.key, player) : null
                  const showCloseness = closeness !== null && closeness.current > 0
                  return (
                    <div
                      key={a.key}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-2.5",
                        owned ? "border-amber-400/25 bg-amber-500/[0.07]" : "border-white/8 bg-white/[0.02] opacity-55",
                      )}
                    >
                      <span aria-hidden className={cn("text-xl leading-6", !owned && "grayscale")}>
                        {hidden ? "❔" : a.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold">{hidden ? "؟؟؟" : a.name}</p>
                        {showCloseness && closeness ? (
                          <>
                            <p className="truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
                              {faNum(closeness.current)}/{faNum(closeness.target)} {closeness.unit}
                            </p>
                            <ProgressBar
                              value={Math.min(closeness.current, closeness.target)}
                              max={closeness.target}
                              className="mt-1"
                              barClassName="bg-amber-300"
                              label={`نزدیکیِ دستاوردِ پنهانِ ${a.key}`}
                            />
                          </>
                        ) : (
                          <p className="truncate text-[11px] leading-4 text-muted-foreground">
                            {hidden ? "باید اتفاق بیفتد تا بدانی." : a.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </GlassCard>
          </section>

          {/* ── ۵. عنوان‌ها ── */}
          <section aria-label="عنوان‌ها">
            <SectionTitle icon="🎖" title="عنوان‌ها" />
            <GlassCard pad="sm">
              {player.titles.length === 0 ? (
                <EmptyState
                  emoji="🎖"
                  text="هنوز هیچ عنوانی نداری. «تازه‌وارد» هم یه شروعه."
                  action={
                    <ActionButton variant="soft" size="sm" onClick={() => setActiveTab("home")}>
                      قدمِ بعدی را ببین
                    </ActionButton>
                  }
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {player.titles.map((t) => {
                    const isActive = `${t.emoji} ${t.name}` === activeTitleStr
                    return (
                      <button
                        key={t.key}
                        type="button"
                        title={t.description}
                        disabled={busyKey === t.key}
                        onClick={async () => {
                          setBusyKey(t.key)
                          await runAction("setTitle", { titleKey: t.key })
                          setBusyKey(null)
                          void afterAction()
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-95",
                          isActive
                            ? "border-primary/40 bg-primary/10 text-primary glow-pink"
                            : "border-white/10 bg-white/[0.03] text-foreground/75 hover:border-primary/25",
                        )}
                      >
                        {t.emoji} {t.name}
                        {isActive ? " ✓" : ""}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">روی هرکدام بزن تا عنوان فعلی‌ت بشه.</p>
            </GlassCard>
          </section>

          {/* ── ۶. داستان ── */}
          <section aria-label="داستان بازیکن">
            <SectionTitle icon="📖" title="این بازیکن..." />
            <GlassCard>
              <ul className="flex flex-col gap-1.5">
                {(profile?.story ?? []).map((line, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-6 text-foreground/80">
                    <span aria-hidden className="mt-1.5 block size-1 shrink-0 rounded-full bg-primary/70" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {profile ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
                  <Chip tone="violet">🎭 {faNum(profile.totals.eventsResolved)} اتفاق تمام‌شده</Chip>
                  <Chip tone="emerald">🐾 {faNum(profile.totals.petsAdopted)} حیوان</Chip>
                  <Chip tone="amber">💎 {faNum(profile.totals.rareFinds)} چیزِ کمیاب</Chip>
                </div>
              ) : null}
            </GlassCard>
          </section>

          {/* ── ۷. گذشته ── */}
          <section aria-label="گذشته">
            <SectionTitle icon="📜" title="گذشته" />
            <GlassCard pad="sm">
              {history.length === 0 ? (
                <EmptyState
                  emoji="📜"
                  text="هنوز چیزی سرت نیومده. برو اول یه اتفاق بساز."
                  action={
                    <ActionButton variant="soft" size="sm" onClick={() => setActiveTab("home")}>
                      اولین اتفاق را بکش
                    </ActionButton>
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {dayGroups.map((g) => (
                    <div key={g.day}>
                      <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">روز {faNum(g.day)}</p>
                      <ul className="flex flex-col gap-1.5">
                        {g.items.map((h) => (
                          <li key={h.id} className="flex items-start gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                            <span aria-hidden className="mt-0.5 text-sm leading-5">
                              {h.icon}
                            </span>
                            <span className="min-w-0 flex-1 text-[11px] leading-5 text-foreground/80">{h.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {hasMore ? (
                    <ActionButton variant="glass" size="sm" fullWidth loading={histLoading} onClick={() => void loadMoreHistory()}>
                      بیشتر
                    </ActionButton>
                  ) : (
                    <p className="pt-1 text-center text-[11px] text-muted-foreground">تا اینجا. قبل از این‌ها هیچ‌چیز نبوده. ظاهراً.</p>
                  )}
                </div>
              )}
            </GlassCard>
          </section>

          {/* ── ۸. تنظیمات (V16-2 — ممیزیِ ⑫): هویت + آموزش + کدکس + اشتراک ── */}
          <section aria-label="تنظیمات">
            <SectionTitle icon="⚙️" title="تنظیمات" />
            <GlassCard pad="sm">
              <div className="flex flex-col gap-2">
                {/* ویرایش نام و آواتار — تازه */}
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    setIdentitySheet(true)
                  }}
                  className="glass flex min-h-12 w-full items-center gap-2.5 rounded-2xl px-3 text-start transition-colors hover:bg-white/[0.06]"
                  aria-label="ویرایش نام و آواتار"
                >
                  <span aria-hidden className="text-lg leading-6">
                    ✏️
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold leading-5">ویرایش نام و آواتار</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">همان چیزی که شهر از تو یادش می‌مونه.</span>
                  </span>
                </button>

                {/* آموزش را دوباره ببین — پخشِ دوباره‌ی قولِ بازی */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    haptic("light")
                    requestIntroReplay()
                  }}
                  className="glass flex min-h-12 w-full items-center gap-2.5 rounded-2xl px-3 text-start transition-colors hover:bg-white/[0.06]"
                  aria-label="پخشِ دوباره‌ی آموزش"
                >
                  <span aria-hidden className="text-lg leading-6">
                    🎬
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold leading-5">آموزش را دوباره ببین</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      همون قولِ بازی — که یادت باشه این شهر چه بود.
                    </span>
                  </span>
                </motion.button>

                {/* کدکسِ راهنما */}
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    setCodexOpen(true)
                  }}
                  className="glass flex min-h-12 w-full items-center gap-2.5 rounded-2xl px-3 text-start transition-colors hover:bg-white/[0.06]"
                  aria-label="باز کردن کدکسِ راهنما"
                >
                  <span aria-hidden className="text-lg leading-6">
                    📖
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold leading-5">راهنمای بازی (کدکس)</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      قوانینِ شهر، فمبوی‌ها، دوئل‌ها و عبارت‌هایی که بازی می‌فهمد.
                    </span>
                  </span>
                </button>
              </div>
            </GlassCard>

            {/* اشتراک — کارتِ معرفی */}
            <GlassCard className="mt-2 border-primary/20">
              <p className="text-xs leading-6 text-foreground/80">{shareText}</p>
              <ActionButton
                variant="soft"
                emoji="📎"
                className="mt-3"
                fullWidth
                onClick={async () => {
                  const ok = await copyText(shareText)
                  toast(ok ? "success" : "error", ok ? "کپی شد. حالا بفرستش برای رفیقت." : "کپی نشد. دستی کپی کن، عزیزِ قدیمی.")
                }}
              >
                کپی کن و بفرست برای رفیقت
              </ActionButton>
            </GlassCard>
          </section>
        </>
      )}

      {/* ═══ شیت‌ها ═══ */}

      {/* ویرایشِ هویت — نام + آواتار (V16-2) */}
      <IdentitySheet
        open={identitySheet}
        onOpenChange={setIdentitySheet}
        currentName={snapshot.player.name}
        currentAvatar={snapshot.player.avatar}
        onSaved={() => {
          setIdentitySheet(false)
          void load()
        }}
      />

      {/* کدکسِ راهنما — مرورگرِ سه‌سطحی (دسته‌ها → موضوع‌ها → محتوا) */}
      <CodexSheet open={codexOpen} onOpenChange={setCodexOpen} />

      {/* تأییدِ خرید — خانه/وسیله (گران‌ترین خریدها): اسم، قیمت، جیبِ الان و بعدِ خرید */}
      <GlassSheet
        open={confirmBuy !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmBuy(null)
        }}
        title={
          confirmBuy ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-xl">
                {confirmBuy.emoji}
              </span>
              خریدِ {confirmBuy.name}
            </span>
          ) : null
        }
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth disabled={busyKey !== null} onClick={() => setConfirmBuy(null)}>
              بی‌خیال
            </ActionButton>
            <ActionButton
              variant="primary"
              fullWidth
              loading={confirmBuy !== null && busyKey === confirmBuy.key}
              disabled={busyKey !== null}
              onClick={() => void executeBuy()}
            >
              می‌خرمش
            </ActionButton>
          </div>
        }
      >
        {confirmBuy ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <span className="min-w-0 truncate text-sm font-bold">{confirmBuy.name}</span>
              <MoneyBadge amount={confirmBuy.price} compact />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">جیبِ الان:</span>
              <span className="font-extrabold text-amber-200 tabular-nums">{faNum(snapshot.player.money)} سکه</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">بعدِ خرید:</span>
              <span className="font-extrabold tabular-nums text-foreground/80">
                {faNum(Math.max(0, snapshot.player.money - confirmBuy.price))} سکه
              </span>
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {confirmBuy.kind === "house"
                ? "سقفِ تازه، اجاره‌ی تازه — شهر سهمش را می‌داند."
                : "چرخ‌های تازه، خیابان همان است — فقط سریع‌تر."}
            </p>
          </div>
        ) : null}
      </GlassSheet>

      {/* خانه‌ها */}
      <GlassSheet open={houseSheet} onOpenChange={setHouseSheet} title="🏠 بازار خانه">
        {catalog ? (
          <div className="flex flex-col gap-2">
            {catalog.houses.map((h) => {
              const current = player.house?.key === h.key
              const price = h.price
              const affordable = snapshot.player.money >= price
              return (
                <div key={h.key} className={cn("glass p-3", current && "border-primary/40")}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {h.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold">{h.name}</p>
                        {current ? <Chip tone="pink">خانه‌ی فعلی</Chip> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{h.description}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-foreground/60">
                        <span>اجاره {faNum(h.rent)} سکه</span>
                        <span>آرامش {dots(h.comfort)}</span>
                        <span>امنیت {dots(h.security)}</span>
                      </div>
                    </div>
                  </div>
                  {!current ? (
                    <ActionButton
                      size="sm"
                      variant={affordable ? "primary" : "glass"}
                      disabled={!affordable}
                      className="mt-2.5"
                      fullWidth
                      onClick={() => {
                        haptic("light")
                        setConfirmBuy({ kind: "house", key: h.key, name: h.name, emoji: h.emoji, price })
                      }}
                    >
                      {affordable ? `بخر (${faNum(price)} سکه)` : `${faNum(price)} سکه لازم داری`}
                    </ActionButton>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        )}
      </GlassSheet>

      {/* وسایل نقلیه */}
      <GlassSheet open={vehicleSheet} onOpenChange={setVehicleSheet} title="🛵 فروشگاه وسایل">
        {catalog ? (
          <div className="flex flex-col gap-2">
            {catalog.vehicles.map((v) => {
              const current = player.vehicle?.key === v.key
              const price = Math.round(v.basePrice * (economy / 100))
              const affordable = snapshot.player.money >= price
              return (
                <div key={v.key} className={cn("glass p-3", current && "border-primary/40")}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {v.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold">{v.name}</p>
                        {current ? <Chip tone="pink">مالِ تو</Chip> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{v.description}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">خاصیت: {v.quirk}</p>
                    </div>
                  </div>
                  {!current ? (
                    <ActionButton
                      size="sm"
                      variant={affordable ? "primary" : "glass"}
                      disabled={!affordable}
                      className="mt-2.5"
                      fullWidth
                      onClick={() => {
                        haptic("light")
                        setConfirmBuy({ kind: "vehicle", key: v.key, name: v.name, emoji: v.emoji, price })
                      }}
                    >
                      {affordable ? `بخر (${faNum(price)} سکه)` : `${faNum(price)} سکه لازم داری`}
                    </ActionButton>
                  ) : null}
                </div>
              )
            })}
            <p className="text-[11px] leading-4 text-muted-foreground">
              قیمت‌ها با شاخص اقتصاد ({faNum(economy)}%) بالا پایین می‌شن.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        )}
      </GlassSheet>

      {/* شغل‌ها */}
      <GlassSheet open={jobSheet} onOpenChange={setJobSheet} title="💼 آگهی‌های استخدام">
        {catalog ? (
          <div className="flex flex-col gap-2">
            {catalog.jobs.map((j) => {
              const current = player.job?.key === j.key
              const locked = player.level < j.minLevel
              return (
                <div key={j.key} className={cn("glass p-3", current && "border-primary/40")}>
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="text-2xl">
                      {j.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-xs font-bold">{j.name}</p>
                        {current ? <Chip tone="pink">شغل فعلی</Chip> : null}
                        {locked ? <Chip tone="amber">سطح {faNum(j.minLevel)} لازمه</Chip> : null}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{j.description}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-foreground/60">
                        <span>
                          {faNum(j.incomeMin)} تا {faNum(j.incomeMax)} سکه
                        </span>
                        <span>{faNum(j.energyCost)}⚡ در شیفت</span>
                        <span>ریسک: {j.risk}</span>
                        <span>هر {faNum(j.cooldownMinutes)} دقیقه</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{j.quirks}</p>
                    </div>
                  </div>
                  {!current ? (
                    <ActionButton
                      size="sm"
                      variant={locked ? "glass" : "primary"}
                      disabled={locked}
                      loading={busyKey === j.key}
                      className="mt-2.5"
                      fullWidth
                      onClick={async () => {
                        setBusyKey(j.key)
                        const ok = await runAction("setJob", { jobKey: j.key })
                        setBusyKey(null)
                        if (ok) {
                          setJobSheet(false)
                          void afterAction()
                        }
                      }}
                    >
                      {locked ? `شهر هنوز به تو اعتماد نکرده (سطح ${faNum(j.minLevel)})` : "این کار رو می‌خوام"}
                    </ActionButton>
                  ) : null}
                </div>
              )
            })}
            {player.job ? (
              <ActionButton
                variant="danger"
                size="sm"
                loading={busyKey === "quit"}
                fullWidth
                onClick={async () => {
                  setBusyKey("quit")
                  const ok = await runAction("quitJob")
                  setBusyKey(null)
                  if (ok) {
                    setJobSheet(false)
                    void afterAction()
                  }
                }}
              >
                ولش کن (آزادی حس خوبیه؛ به غذا خوردن ربطی نداره)
              </ActionButton>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        )}
      </GlassSheet>

      {/* پس دادن بدهی */}
      <GlassSheet
        open={debtSheet}
        onOpenChange={(v) => {
          setDebtSheet(v)
          if (v) setPayAmount(String(player.debt))
        }}
        title="⛓ پس دادن به فرهاد"
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth onClick={() => setDebtSheet(false)}>
              بعداً (زود نیست)
            </ActionButton>
            <ActionButton variant="primary" fullWidth loading={paying} onClick={() => void payDebt()}>
              پس بده
            </ActionButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-6 text-muted-foreground">
            بدهی فعلی: <span className="font-bold text-rose-300">{faNum(player.debt)} سکه</span> · جیب:{" "}
            <span className="font-bold text-amber-200">{faNum(snapshot.player.money)} سکه</span>
          </p>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">چند سکه پس بدی؟</p>
            <Input
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="مثلاً 500"
              className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center text-base font-bold tabular-nums"
              aria-label="مبلغ پس دادن"
            />
          </div>
          <div className="flex gap-2">
            <ActionButton
              size="sm"
              variant="glass"
              onClick={() => setPayAmount(String(Math.min(player.debt, snapshot.player.money)))}
            >
              همه‌ش
            </ActionButton>
            <ActionButton
              size="sm"
              variant="glass"
              onClick={() => setPayAmount(String(Math.max(1, Math.min(player.debt, Math.floor(snapshot.player.money / 2)))))}
            >
              نصفِ جیبم
            </ActionButton>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            هرچه زودتر پس بدی، فرهاد مهربان‌تر می‌شه. کسانی که تا آخر بدهی نگه دارن... خب، خودشان می‌دانند.
          </p>
        </div>
      </GlassSheet>
    </div>
  )
}

// ─── شیتِ ویرایشِ هویت (V16-2 — ممیزیِ ⑫) ──────────────────────────────────
// همان قواعدِ فرمِ اینترو: اسم ۲ تا ۲۴ حرف، ۱۲ آواتار (+ آواتارِ فعلی اگر جزوِ
// فهرست نیست). تغییرِ اسم یک قدمِ تأیید دارد — شهر اسمِ قبلی را یادش می‌ماند.

function IdentitySheet(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentName: string
  currentAvatar: string
  /** بعد از ذخیره‌ی موفق: بستنِ شیت + تازه‌سازیِ پروفایل */
  onSaved: () => void
}) {
  const { open, onOpenChange, currentName, currentAvatar, onSaved } = props
  const setSnapshot = useGame((s) => s.setSnapshot)
  const toast = useGame((s) => s.toast)

  const [name, setName] = React.useState(currentName)
  const [avatar, setAvatar] = React.useState(currentAvatar)
  const [busy, setBusy] = React.useState(false)
  /** تغییرِ اسم → قدمِ تأیید (ادراکِ برگشت‌ناپذیر) */
  const [confirming, setConfirming] = React.useState(false)

  // با هر باز‌شدن، از هویتِ فعلی شروع می‌کنیم
  React.useEffect(() => {
    if (open) {
      setName(currentName)
      setAvatar(currentAvatar)
      setConfirming(false)
    }
  }, [open, currentName, currentAvatar])

  // اگر آواتارِ فعلی جزوِ ۱۲ تا نیست (مثل 🧑‍🦰ِ تلگرام)، به‌عنوان گزینه‌ی اول می‌نشیند
  const avatarOptions = React.useMemo(
    () => (currentAvatar && !AVATARS.includes(currentAvatar) ? [currentAvatar, ...AVATARS] : AVATARS),
    [currentAvatar],
  )

  const cleanName = name.trim()
  const nameChanged = cleanName !== currentName
  const nameValid = cleanName.length >= 2 && cleanName.length <= 24

  async function save() {
    if (busy || !nameValid) return
    // تغییرِ اسم = قدمِ تأیید؛ تغییرِ آواتار بی‌تأیید
    if (nameChanged && !confirming) {
      haptic("light")
      setConfirming(true)
      return
    }
    setBusy(true)
    const res = await api.action("setIdentity", { name: cleanName, avatar })
    setBusy(false)
    if (!res.ok) {
      toast("error", res.error)
      return
    }
    setSnapshot(res.data.snapshot)
    // هویتِ بازیابیِ نشست هم تازه بماند (ممیزیِ ⑦)
    persistGuestIdentity(cleanName, avatar)
    toast("success", "هویتت به‌روز شد", res.data.message)
    setConfirming(false)
    onSaved()
  }

  return (
    <GlassSheet
      open={open}
      onOpenChange={(v) => {
        if (v) onOpenChange(true)
        else if (!busy) onOpenChange(false)
      }}
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>✏️</span> ویرایش نام و آواتار
        </span>
      }
      footer={
        <ActionButton variant="primary" fullWidth loading={busy} disabled={!nameValid} onClick={() => void save()}>
          {confirming ? "مطمئنم، عوضش کن" : "ذخیره"}
        </ActionButton>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="fw-identity-name" className="mb-1.5 block text-xs font-semibold text-foreground/80">
            اسمت چیه؟ (شهر یادش می‌گیره)
          </label>
          <input
            id="fw-identity-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 24))
              setConfirming(false)
            }}
            placeholder="مثلاً: آفتابه"
            maxLength={24}
            autoComplete="off"
            dir="auto"
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/40"
          />
          <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
            {nameValid ? "بین 2 تا 24 حرف." : "اسم باید بین 2 تا 24 حرف باشد."}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-foreground/80">چی باشی تو چشم‌ها؟</p>
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
        </div>

        {confirming ? (
          <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2.5 text-[11px] font-semibold leading-5 text-amber-200">
            شهر اسمِ قبلی‌ات را یادش می‌ماند. اسمِ تازه، صورتِ تازه‌ی همانِ توست — یک بار دیگر
            «مطمئنم، عوضش کن» را بزن.
          </p>
        ) : (
          <p className="text-[11px] leading-5 text-muted-foreground">
            اسم و شکل، همان چیزی است که آدم‌های شهر موقعِ صدا زدنت می‌بینند.
          </p>
        )}
      </div>
    </GlassSheet>
  )
}

function dots(n: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(n / 20)))
  return "●".repeat(filled) + "○".repeat(5 - filled)
}
