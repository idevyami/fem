"use client"

// V19 فمبوی — سکشنِ «📖 داستان»: قوسِ رواییِ شخصی + اعتماد + خاطره‌ها.
// فصل/انتخاب از card.story می‌آید (تک‌منبع)؛ نتیجه‌ی انتخاب در بلوکِ درون‌صفحه‌ای
// بالا می‌نشیند (همان الگویِ بلوکِ نتیجه‌ی تعاملِ V17-W2) — نه فقط توست.

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { SoulCardDTO } from "@/lib/game/contract"
import { faNum } from "../../fa"
import { ActionButton, Chip, EmptyState, GlassCard, ProgressBar, SectionTitle } from "../../ui"
import { haptic } from "../../telegram"
import { faTimeAgo } from "../../fa"

export function StorySection({
  card,
  outcome,
  onChoose,
  onBuildTrust,
  choosing,
  onDismissOutcome,
}: {
  card: SoulCardDTO
  outcome: string | null
  onChoose: (idx: number) => void
  /** «برای اعتماد چه کنم؟» — می‌رود به سکشنِ اقدامات */
  onBuildTrust: () => void
  choosing: boolean
  onDismissOutcome: () => void
}) {
  const story = card.story
  if (!story) {
    return (
      <GlassCard>
        <EmptyState emoji="📕" text="قصه‌ای برای این فمبوی ثبت نشده." />
      </GlassCard>
    )
  }

  const trust = story.trust
  const nextTier = story.nextTrustTier

  return (
    <div className="flex flex-col gap-3">
      {/* نتیجه‌ی آخرین انتخاب — بلوکِ درون‌صفحه‌ای */}
      <AnimatePresence>
        {outcome ? (
          <motion.div
            key="story-outcome"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <GlassCard className="border-primary/25">
              <div className="flex items-start justify-between gap-2">
                <SectionTitle icon="✍️" title="پیامدِ انتخابت" />
                <button
                  type="button"
                  onClick={onDismissOutcome}
                  aria-label="بستن"
                  className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  بستن
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] leading-6 text-foreground/90">{outcome}</p>
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* اعتماد — ارزِ داستان */}
      <GlassCard>
        <div className="flex items-center justify-between gap-2">
          <SectionTitle icon="🤝" title="اعتماد" />
          <Chip tone={trust >= 70 ? "violet" : trust >= 30 ? "pink" : "default"} className="font-bold">
            {story.trustTier.emoji} {story.trustTier.label}
          </Chip>
        </div>
        <div className="mt-2.5">
          <ProgressBar value={trust} max={100} barClassName="bg-gradient-to-l from-violet-400 to-pink-400" label={`اعتماد: ${faNum(trust)} از 100`} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{faNum(trust)} / 100</span>
          {nextTier ? (
            <span>
              {faNum(Math.max(0, nextTier.at - trust))} اعتماد دیگر تا «{nextTier.label}»
            </span>
          ) : (
            <span>به سقف رسیده — جانِ جان 🤝</span>
          )}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-4 text-muted-foreground">
          اعتماد از انتخاب‌های داستان، اولینِ تعاملِ هر روز و پیروزی‌ها می‌آید — اسپم چیزی نمی‌سازد.
        </p>
      </GlassCard>

      {/* قوسِ روایی */}
      <GlassCard>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="text-2xl">{story.arcEmoji}</span>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-extrabold">{story.arcTitle}</h2>
              <p className="text-[11px] text-muted-foreground">
                فصلِ {faNum(Math.min(story.chaptersDone + 1, story.chaptersTotal))} از {faNum(story.chaptersTotal)}
              </p>
            </div>
          </div>
          {story.status === "complete" ? <Chip tone="violet">کامل شد</Chip> : null}
        </div>

        {/* بدنه‌ی وضعیت */}
        {story.status === "available" && story.current ? (
          <div className="mt-3 flex flex-col gap-3">
            <div className="rounded-2xl bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-xl">{story.current.icon}</span>
                <h3 className="text-[14px] font-extrabold">{story.current.title}</h3>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {story.current.text.map((p, i) => (
                  <p key={i} className="text-[13px] leading-7 text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="px-1 text-[11px] font-bold text-muted-foreground">انتخابت چیست؟</p>
              {story.current.choices.map((c) => (
                <button
                  key={c.idx}
                  type="button"
                  disabled={choosing}
                  onClick={() => {
                    haptic("light")
                    onChoose(c.idx)
                  }}
                  className="flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-right transition-colors hover:border-primary/30 hover:bg-primary/10 disabled:opacity-50"
                >
                  <span className="text-[13.5px] font-bold leading-5">{c.label}</span>
                  <span className="shrink-0 text-[10.5px] text-muted-foreground">{c.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : story.status === "locked" ? (
          <div className="mt-3">
            <EmptyState
              emoji="🔒"
              text="فصلِ بعدی هنوز قفل است"
              hint={story.requirement ? `نیاز: ${story.requirement}` : undefined}
              action={
                <ActionButton variant="soft" size="sm" onClick={onBuildTrust}>
                  💗 ساختنِ اعتماد
                </ActionButton>
              }
            />
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              emoji="👑"
              text="قصه‌ش کامل شد"
              hint="عنوانِ «راویِ پیمان» مالِ توست — فصل‌های بعدی را خودتان با هم می‌نویسید."
            />
          </div>
        )}
      </GlassCard>

      {/* خاطره‌های داستان */}
      {story.memories.length > 0 ? (
        <GlassCard>
          <SectionTitle icon="🕰" title="خاطره‌های این قصه" />
          <ul className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto pl-1">
            {story.memories.map((m) => (
              <li key={m.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
                <p className="text-[12.5px] leading-6 text-foreground/85">
                  <span aria-hidden className="ml-1">{m.icon}</span>
                  {m.text}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">{faTimeAgo(m.at)}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
    </div>
  )
}
