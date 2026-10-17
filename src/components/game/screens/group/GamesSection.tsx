"use client"

// بازی‌های گروهی — 20 بازیِ جهانِ گروه، با دلیلِ قفل
// React.memo با امضای محتوا: رفرشِ snapshot که هویتِ جدیدِ آرایه می‌دهد ولی محتوا همان است → بدون رندرِ دوباره
import { memo } from "react"
import { motion } from "framer-motion"
import type { GroupGameInfo } from "@/lib/game/client"
import { faNum } from "../../fa"
import { Chip, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

interface GamesSectionProps {
  games: GroupGameInfo[]
  acting: string | null
  onStart: (key: string, gameKey: string) => void
}

/** امضای محتوای بازی‌ها — کلید + وضعیت + دلیلِ قفل (چیزهایی که رندر می‌شوند) */
function gamesSignature(games: GroupGameInfo[]): string {
  return games.map((g) => `${g.key}:${g.ok ? 1 : 0}:${g.why}`).join("|")
}

function gamesEqual(prev: GamesSectionProps, next: GamesSectionProps): boolean {
  if (prev.acting !== next.acting) return false
  if (prev.onStart !== next.onStart) return false
  if (prev.games === next.games) return true
  if (prev.games.length !== next.games.length) return false
  return gamesSignature(prev.games) === gamesSignature(next.games)
}

export const GamesSection = memo(function GamesSection({ games, acting, onStart }: GamesSectionProps) {
  if (games.length === 0) return null
  const playable = games.filter((g) => g.ok).length
  return (
    <section aria-label="بازی‌های گروهی">
      <SectionTitle
        icon="🎲"
        title="بازی‌های گروهی"
        action={<Chip>{faNum(playable)} از {faNum(games.length)} آماده</Chip>}
      />
      <div className="grid grid-cols-2 gap-2">
        {games.map((g, i) => {
          const key = `game:${g.key}`
          const busy = acting === key
          return (
            <motion.button
              key={g.key}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 9) * 0.035, ease: "easeOut" }}
              disabled={!g.ok || acting !== null}
              onClick={() => onStart(key, g.key)}
              title={g.ok ? g.tagline : g.why}
              aria-label={`شروعِ بازیِ ${g.name}${g.ok ? "" : ` — ${g.why}`}`}
              className={cn(
                "glass flex min-h-[4.75rem] flex-col items-start gap-1 rounded-2xl p-3 text-start transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none",
                g.ok ? "hover:bg-white/[0.07]" : "opacity-45",
              )}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span aria-hidden className="text-xl leading-none">
                  {g.emoji}
                </span>
                {busy ? (
                  <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : g.ok ? null : (
                  <span aria-hidden className="text-[11px] leading-none">
                    🔒
                  </span>
                )}
              </span>
              <span className="text-xs font-bold leading-4">{g.name}</span>
              <span className="text-[11px] leading-4 text-muted-foreground">
                {g.ok ? g.tagline : g.why}
              </span>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}, gamesEqual)
