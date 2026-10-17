"use client"

// شهرِ گروه — تبِ V5: گروهِ تلگرامی‌ات به‌عنوانِ یک دنیایِ زنده
import * as React from "react"
import { motion } from "framer-motion"
import { RefreshCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useGame } from "../store"
import { haptic, openTgLink } from "../telegram"
import { ActionButton, Chip, EmptyState, GlassCard } from "../ui"
import { cn } from "@/lib/utils"
import { WorldHeader } from "./group/WorldHeader"
import { ChallengesSection } from "./group/ChallengesSection"
import { ActiveGameCard, CurrentEventCard } from "./group/EventAndGameCards"
import { VotesSection } from "./group/VotesSection"
import { GamesSection } from "./group/GamesSection"
import { ProjectsSection } from "./group/ProjectsSection"
import { MemesStrip, RumorsSection } from "./group/RumorsSection"
import { AchievementsStrip, MembersSection } from "./group/MembersSection"
import { HistoryTimeline, MysteriesSection } from "./group/HistorySection"

const BOT_URL = "https://t.me/femwarbot"
const BOT_ADD_URL = "https://t.me/femwarbot?startgroup=game"

export function GroupScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const active = useGame((s) => s.activeTab === "group")
  const groupData = useGame((s) => s.groupData)
  const groupLoading = useGame((s) => s.groupLoading)
  const groupError = useGame((s) => s.groupError)
  const selectedChatId = useGame((s) => s.selectedChatId)
  const setSelectedChatId = useGame((s) => s.setSelectedChatId)
  const loadGroup = useGame((s) => s.loadGroup)
  const runGroupAction = useGame((s) => s.runGroupAction)

  const [acting, setActing] = React.useState<string | null>(null)

  // با فعال‌شدنِ تب، دنیا تازه می‌شود — هر بار (شهر نفس می‌کشد)
  React.useEffect(() => {
    if (!active) return
    void loadGroup()
  }, [active, loadGroup])

  /** کنش روی جهان + قفلِ دکمه‌ها تا پایان — هندلرِ پایدار تا memoِ سکشن‌ها کار کند */
  const actingRef = React.useRef<string | null>(null)
  const act = React.useCallback(
    async (key: string, action: string, payload: Record<string, unknown>) => {
      if (actingRef.current) return
      actingRef.current = key
      setActing(key)
      await runGroupAction(action, payload)
      actingRef.current = null
      setActing(null)
    },
    [runGroupAction],
  )

  const handleTriggerEvent = React.useCallback(() => void act("event", "triggerEvent", {}), [act])
  const handleJoin = React.useCallback(
    (sessionId: string) => void act("joingame", "joinGame", { sessionId }),
    [act],
  )
  const handleVote = React.useCallback(
    (key: string, voteId: string, optionKey: string) => void act(key, "vote", { voteId, optionKey }),
    [act],
  )
  const handleStart = React.useCallback(
    (key: string, gameKey: string) => void act(key, "startGame", { gameKey }),
    [act],
  )
  const handleContribute = React.useCallback(
    (key: string, projectKey: string, amount: number) => void act(key, "contribute", { projectKey, amount }),
    [act],
  )
  const handleStartProject = React.useCallback(
    (key: string, projectKey: string) => void act(key, "startProject", { projectKey }),
    [act],
  )
  const handleRumor = React.useCallback(
    (key: string, rumorId: string, rumorAction: string) => void act(key, "rumor", { rumorId, rumorAction }),
    [act],
  )
  /** کنش رویِ دعوتِ دوئل — همانِ gc: ربات رویِ سیمِ session (V14 موجِ 16b) */
  const handleChallenge = React.useCallback(
    (key: string, challengeId: string, verb: "accept" | "decline" | "cancel") =>
      void act(key, "challenge", { challengeId, verb }),
    [act],
  )

  function pickGroup(chatId: string) {
    if (chatId === selectedChatId || acting) return
    haptic("light")
    setSelectedChatId(chatId)
    void loadGroup(chatId)
  }

  const snap = groupData?.snapshot?.exists ? groupData.snapshot : null
  const groups = groupData?.groups ?? []
  const games = groupData?.games ?? []
  const myPlayerId = snapshot?.player.id ?? null
  const firstLoad = !groupData && groupLoading

  return (
    <div className="flex flex-col gap-4">
      {/* سرِ صفحه */}
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-8">🌍 شهرِ گروه</h1>
          <p className="text-xs leading-5 text-muted-foreground">گروهِ تلگرامی‌ات این‌جا یک شهرِ زنده است.</p>
        </div>
        <button
          type="button"
          aria-label="تازه‌سازیِ دنیای گروه"
          onClick={() => {
            haptic("light")
            void loadGroup()
          }}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-foreground/80 transition-colors hover:text-primary",
            groupLoading && "text-primary",
          )}
        >
          <RefreshCw className={cn("size-5", groupLoading && "animate-spin")} />
        </button>
      </header>

      {/* انتخابِ گروه — فقط وقتی بیشتر از یکی داری */}
      {groups.length > 1 ? (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5" role="tablist" aria-label="گروه‌های تو">
          {groups.map((g) => {
            const sel = g.chatId === selectedChatId
            return (
              <button
                key={g.chatId}
                type="button"
                role="tab"
                aria-selected={sel}
                onClick={() => pickGroup(g.chatId)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold transition-all duration-150 active:scale-[0.97]",
                  sel
                    ? "border-primary/50 bg-primary/10 text-primary glow-pink"
                    : "border-white/10 bg-white/[0.04] text-foreground/75 hover:bg-white/[0.07]",
                )}
              >
                <span aria-hidden className="text-sm leading-none">
                  {g.cultureEmoji}
                </span>
                {g.title}
                {g.moodEmoji ? (
                  <span aria-hidden className="text-[11px] leading-none opacity-70">
                    {g.moodEmoji}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {/* لودینگِ اولیه */}
      {firstLoad ? <GroupSkeleton /> : null}

      {/* خطا */}
      {!firstLoad && groupError ? (
        <GlassCard>
          <EmptyState
            emoji="🫥"
            text="شهرِ گروه پشتِ مه گم شد."
            hint={groupError}
            action={
              <ActionButton variant="soft" size="sm" onClick={() => void loadGroup()}>
                دوباره
              </ActionButton>
            }
          />
        </GlassCard>
      ) : null}

      {/* خالی — هنوز شهری نداری */}
      {!firstLoad && !groupError && groups.length === 0 ? <NoGroupsCard /> : null}

      {/* دنیایِ زنده */}
      {snap ? (
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <WorldHeader snap={snap} triggering={acting === "event"} onTriggerEvent={handleTriggerEvent} />
          <ChallengesSection challenges={snap.challenges ?? []} acting={acting} onAct={handleChallenge} />
          {snap.currentEvent ? <CurrentEventCard ev={snap.currentEvent} /> : null}
          {snap.activeGame ? (
            <ActiveGameCard game={snap.activeGame} myPlayerId={myPlayerId} joining={acting === "joingame"} onJoin={handleJoin} />
          ) : null}
          <VotesSection votes={snap.openVotes} acting={acting} onVote={handleVote} />
          <GamesSection games={games} acting={acting} onStart={handleStart} />
          <ProjectsSection
            projects={snap.projects}
            acting={acting}
            onContribute={handleContribute}
            onStartProject={handleStartProject}
          />
          <RumorsSection rumors={snap.rumors} acting={acting} onRumor={handleRumor} />
          <MemesStrip memes={snap.memes} />
          <MysteriesSection mysteries={snap.mysteries} />
          <MembersSection members={snap.members} population={snap.population} />
          <HistoryTimeline history={snap.history} />
          <AchievementsStrip achievements={snap.achievements} unlocked={snap.achievementsUnlocked} />
        </motion.div>
      ) : null}

      {/* گروهی انتخاب شده ولی هنوز شهری متولد نشده */}
      {!firstLoad && !groupError && groups.length > 0 && !snap ? (
        <GlassCard>
          <EmptyState
            emoji="🌫"
            text="این شهر هنوز متولد نشده."
            hint="در گروه بنویس: منو — تا ربات بیدارش کند."
          />
        </GlassCard>
      ) : null}
    </div>
  )
}

// ─── حالتِ خالی ─────────────────────────────────────────────────────────────

function NoGroupsCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <GlassCard className="relative overflow-hidden text-center">
        {/* هاله‌های محیطی */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-16 -right-10 size-44 rounded-full bg-emerald-500/[0.07] blur-3xl" />
          <div className="absolute -bottom-20 -left-10 size-44 rounded-full bg-sky-500/[0.07] blur-3xl" />
        </div>

        <motion.span
          aria-hidden
          className="relative mt-2 block text-6xl leading-none"
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
        >
          🌍
        </motion.span>
        <h2 className="relative mt-4 text-lg font-extrabold leading-7">شهرِ گروهت این‌جاست</h2>
        <p className="relative mx-auto mt-2 max-w-[32ch] text-xs leading-6 text-muted-foreground">
          گروهِ تلگرامی‌ات می‌تواند یک شهرِ زنده باشد: رویدادها، رأی‌گیری‌ها، بازی‌های گروهی، شایعه‌ها و
          معماها — همه از دلِ گفت‌وگوی خودِ گروه.
        </p>

        <ol className="relative mx-auto mt-4 flex max-w-[32ch] flex-col gap-2 text-start">
          {[
            "ربات را به گروهِ تلگرامی‌ات اضافه کن",
            "در گروه بنویس: منو",
            "برگرد این‌جا — شهر نفس می‌کشد",
          ].map((t, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, duration: 0.3 }}
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[11.5px] leading-5 text-foreground/85"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-black text-primary">
                {["1", "2", "3"][i]}
              </span>
              {t}
            </motion.li>
          ))}
        </ol>

        <div className="relative mt-4 flex flex-col gap-2">
          {/* داخلِ تلگرام باید از openTelegramLink رد شود — a/target=_blank در WebView اغلب باز نمی‌شود */}
          <button
            type="button"
            onClick={() => {
              haptic("light")
              openTgLink(BOT_ADD_URL)
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-primary/40 bg-primary px-4 text-sm font-bold text-primary-foreground glow-pink transition-all duration-150 hover:bg-primary/90 active:scale-[0.97]"
          >
            <span aria-hidden className="text-base leading-none">
              ➕
            </span>
            افزودن ربات به یه گروه
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light")
              openTgLink(BOT_URL)
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 text-[13px] font-semibold text-foreground/80 transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.97]"
          >
            💬 گفت‌وگو با ربات (@femwarbot)
          </button>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ─── اسکلتون ────────────────────────────────────────────────────────────────

function GroupSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="در حال آوردنِ دنیای گروه">
      <Skeleton className="h-44 rounded-3xl bg-white/[0.05]" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.05]" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-3xl bg-white/[0.05]" />
      <Skeleton className="h-28 rounded-3xl bg-white/[0.05]" />
    </div>
  )
}
