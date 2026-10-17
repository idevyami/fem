"use client"

// شهروندان و افتخاراتِ شهر
// هر دو سکشن React.memo هستند با مقایسه‌ی امضای محتوا — تا رفرشِ snapshotِ گروه
// (که هویتِ جدیدِ آرایه‌ها می‌سازد) و تغییرِ acting، همه‌چیز را دوباره رندر نکند.
import * as React from "react"
import { motion } from "framer-motion"
import type { GroupAchievementDef, GroupMemberDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { Chip, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

interface MembersProps {
  members: GroupMemberDTO[]
  population: number
}

/** امضای محتوای اعضا — چیزی که واقعاً دیده می‌شود */
function membersSignature(members: GroupMemberDTO[]): string {
  return members
    .map((m) => `${m.playerId}:${m.name}:${m.avatar}:${m.messageCount}:${m.gameCount}:${m.winCount}:${m.onlineLabel}:${m.roleLabel ?? ""}:${m.title ?? ""}`)
    .join("|")
}

function membersEqual(prev: MembersProps, next: MembersProps): boolean {
  return (
    prev.population === next.population &&
    (prev.members === next.members || membersSignature(prev.members) === membersSignature(next.members))
  )
}

export const MembersSection = React.memo(function MembersSection({ members, population }: MembersProps) {
  if (members.length === 0) return null
  return (
    <section aria-label="شهروندانِ گروه">
      <SectionTitle icon="👥" title="شهروندان" action={<Chip>👥 {faNum(population)}</Chip>} />
      <GlassCard pad="sm">
        <ul className="scrollbar-thin flex max-h-[26rem] flex-col gap-2 overflow-y-auto pe-1">
          {members.map((m, i) => (
            <motion.li
              key={m.playerId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.05, ease: "easeOut" }}
              className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl leading-none"
              >
                {m.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-bold leading-5">{m.name}</span>
                  {m.roleLabel ? (
                    <Chip tone="amber">
                      {m.roleEmoji} {m.roleLabel}
                    </Chip>
                  ) : null}
                </div>
                {m.title ? (
                  <p className="mt-0.5 truncate text-[11px] italic leading-4 text-muted-foreground">«{m.title}»</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] leading-4 text-muted-foreground">
                  <span className="font-semibold text-foreground/60">{m.onlineLabel}</span>
                  <span className="tabular-nums" title="پیام‌ها">
                    💬 {faNum(m.messageCount)}
                  </span>
                  <span className="tabular-nums" title="بازی‌ها">
                    🎮 {faNum(m.gameCount)}
                  </span>
                  <span className="tabular-nums" title="بردها">
                    🏆 {faNum(m.winCount)}
                  </span>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </GlassCard>
    </section>
  )
}, membersEqual)

interface AchievementsProps {
  achievements: GroupAchievementDef[]
  unlocked: string[]
}

/** تعریف‌ها محتوای ثابتِ سرورند — امضای کلیدها + مجموعه‌ی باز‌شده‌ها */
function achievementsEqual(prev: AchievementsProps, next: AchievementsProps): boolean {
  if (prev.unlocked !== next.unlocked && prev.unlocked.join("|") !== next.unlocked.join("|")) return false
  if (prev.achievements === next.achievements) return true
  if (prev.achievements.length !== next.achievements.length) return false
  const sig = (list: GroupAchievementDef[]) => list.map((a) => `${a.key}:${a.emoji}:${a.name}`).join("|")
  return sig(prev.achievements) === sig(next.achievements)
}

export const AchievementsStrip = React.memo(function AchievementsStrip({
  achievements,
  unlocked,
}: AchievementsProps) {
  const unlockedSet = React.useMemo(() => new Set(unlocked), [unlocked])
  if (achievements.length === 0) return null
  return (
    <section aria-label="افتخاراتِ گروه">
      <SectionTitle
        icon="🏅"
        title="افتخاراتِ شهر"
        action={
          <Chip tone="amber">
            {faNum(unlocked.length)} از {faNum(achievements.length)}
          </Chip>
        }
      />
      <GlassCard pad="sm">
        <ul className="flex flex-wrap gap-1.5">
          {achievements.map((a) => {
            const got = unlockedSet.has(a.key)
            return (
              <li
                key={a.key}
                title={`${a.name} — ${a.description}`}
                className={cn(
                  "flex min-h-9 cursor-help items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold leading-4",
                  got
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    : "border-white/10 bg-white/[0.02] text-muted-foreground/50 grayscale",
                )}
              >
                <span aria-hidden className="text-sm leading-none">
                  {a.emoji}
                </span>
                <span className="sr-only">{got ? "باز شده:" : "باز نشده:"}</span>
                {a.name}
              </li>
            )
          })}
        </ul>
      </GlassCard>
    </section>
  )
}, achievementsEqual)
