"use client"

// V10 فمبوی — سکشنِ پروفایل: کارتِ کاملِ فمبوی (+ تسلط/ظاهر/سلوکِ بعدی)
import * as React from "react"
import { motion } from "framer-motion"
import type { FemboySummaryDTO, SoulCardDTO } from "@/lib/game/contract"
import { faNum } from "../../fa"
import { Chip, GlassCard, ProgressBar, SectionTitle, ArtImage } from "../../ui"
import { cn } from "@/lib/utils"
import { STAT_DISPLAY, dmgModLabel, masteryProgress, spiritBarClass } from "./classMeta"

interface OverviewSectionProps {
  card: SoulCardDTO
  /** خلاصه‌ی فمبوی از snapshot — برای خطِ سلوکِ بعدی (🎯) */
  femboy?: FemboySummaryDTO | null
  /** V19 — CTAهای طبع/داستان روی نمایِ سریع */
  onGoPersona?: () => void
  onGoStory?: () => void
}

export function OverviewSection({ card, femboy, onGoPersona, onGoStory }: OverviewSectionProps) {
  const dmg = dmgModLabel(card.condition.dmgMod)
  const mProg = masteryProgress(card.mastery.xp, card.mastery.level, card.mastery.nextTierXp)
  const accessory = card.appearance.equipped.accessory
  const persona = card.persona
  const story = card.story
  const storyOpen = story?.status === "available"
  return (
    <div className="flex flex-col gap-4">
      {/* ── کارتِ بزرگ: آرت + هویت ── */}
      <GlassCard pad="none" className="overflow-hidden">
        <div className="relative">
          <ArtImage
            src={card.art}
            alt={`پرتره‌ی ${card.name}، ${card.className}`}
            fallbackEmoji={card.classEmoji}
            className="h-64 w-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ boxShadow: `inset 0 -60px 80px -30px ${card.palette.primary}33` }}
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="pink" className="font-bold">
                {card.classEmoji} {card.className}
              </Chip>
              {persona ? (
                <Chip tone="amber" className="font-bold">
                  {persona.emoji} {persona.name}
                </Chip>
              ) : null}
              <Chip tone="violet" className="font-bold">
                {card.rank.emoji} {card.rank.name}
              </Chip>
              <Chip tone="teal">
                {card.evolutionEmoji} {card.evolutionName}
              </Chip>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="text-2xl font-black leading-9 text-white drop-shadow-lg"
            >
              {card.name}
            </motion.h1>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {/* V19 — خطِ طبع + اقدامِ پیشنهادیِ داستان (نمایِ سریع: یک اقدامِ روشن) */}
          {persona ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.03] px-3 py-2">
              <button
                type="button"
                onClick={onGoPersona}
                className="flex min-w-0 flex-1 items-center gap-2 text-right"
                aria-label={`طبعِ ${persona.name} — ${persona.tagline}`}
              >
                <span aria-hidden className="text-lg">{persona.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-[11px] text-muted-foreground">طبعش:</span>
                  <span className="block truncate text-[13px] font-bold">{persona.tagline}</span>
                </span>
              </button>
              {story ? (
                <button
                  type="button"
                  onClick={onGoStory}
                  aria-label="ادامه‌ی داستانِ شخصی"
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-bold transition-colors",
                    storyOpen
                      ? "border-primary/30 bg-primary/15 text-primary"
                      : "border-white/10 bg-white/[0.03] text-muted-foreground",
                  )}
                >
                  <span aria-hidden>📖</span>
                  {story.status === "complete"
                    ? "قصه کامل شد"
                    : storyOpen
                      ? `فصلِ ${faNum(Math.min(story.chaptersDone + 1, story.chaptersTotal))} — ادامه بده`
                      : femboy?.storyChip
                        ? femboy.storyChip.replace("📖 ", "")
                        : "داستان"}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* سطح + XP */}
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-bold">سطح {faNum(card.level)}</span>
              <span className="text-muted-foreground tabular-nums">
                {faNum(card.xpIntoLevel)} / {faNum(card.xpForNext)} ✨
              </span>
            </div>
            <ProgressBar
              value={card.xpIntoLevel}
              max={card.xpForNext || 1}
              barClassName="bg-primary"
              label="پیشرفتِ سطحِ فمبوی"
            />
          </div>

          {/* روحیه */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1 font-bold">
                <span aria-hidden>{card.condition.emoji}</span>
                روحیه: {card.condition.label}
              </span>
              {dmg ? (
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    card.condition.dmgMod > 0 ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {dmg}
                </span>
              ) : null}
            </div>
            <ProgressBar value={card.spirit} max={100} barClassName={spiritBarClass(card.condition.dmgMod)} label="روحیه‌ی فمبوی" />
            {!card.condition.canFight ? (
              <p className="mt-1.5 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-[11px] leading-5 text-rose-300">
                روحیه‌ش تهی است — تا جان دوباره بگیرد نمی‌تواند بجنگد. شربت یا هم‌نفَسی.
              </p>
            ) : null}
          </div>

          {/* استقامت + پیوند */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold">استقامت</p>
              <div className="mt-1 flex flex-wrap items-center gap-1" aria-label={`استقامت ${faNum(card.stamina)} از ${faNum(card.staminaMax)}`}>
                {Array.from({ length: card.staminaMax }, (_, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className={cn(
                      "h-2.5 w-1.5 rounded-full transition-colors",
                      i < card.stamina ? "bg-amber-300" : "bg-white/10",
                    )}
                  />
                ))}
                <span className="ms-1 text-[11px] text-muted-foreground tabular-nums">
                  {faNum(card.stamina)}/{faNum(card.staminaMax)}
                </span>
              </div>
              {card.staminaMinutesToNext !== null && card.stamina < card.staminaMax ? (
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  {faNum(card.staminaMinutesToNext)} دقیقه تا واحدِ بعدی
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-center">
              <p className="text-[11px] font-bold">پیوند</p>
              <p className="mt-0.5 text-sm font-extrabold text-primary tabular-nums">💞 {faNum(card.bond)}</p>
            </div>
          </div>

          {/* V10 — هویتِ عمیق: تسلط + ظاهر + سلوکِ بعدی */}
          <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] leading-4">
                <span className="min-w-0 truncate font-bold">
                  <span aria-hidden>{card.mastery.emoji}</span> {card.mastery.label} · سطحِ تسلط {faNum(card.mastery.level)}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {card.mastery.nextTierXp === null ? "سقف" : `${faNum(Math.max(0, card.mastery.nextTierXp - card.mastery.xp))} تا تیرِ بعد`}
                </span>
              </div>
              <ProgressBar
                value={mProg.value}
                max={mProg.max}
                barClassName="bg-amber-300"
                label={`پیشرفتِ تسلطِ ${card.name}`}
              />
            </div>
            {accessory ? (
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-5 text-foreground/80">
                <span aria-hidden className="shrink-0 text-sm">{accessory.emoji}</span>
                <span className="truncate">
                  {accessory.name}
                  <span className="ms-1.5 text-[11px] text-muted-foreground">اکسسوارِ پوشیده</span>
                </span>
              </p>
            ) : null}
            {femboy?.nextMilestone ? (
              <p className="flex min-w-0 items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
                <span aria-hidden className="shrink-0">🎯</span>
                <span className="truncate">{femboy.nextMilestone}</span>
              </p>
            ) : null}
          </div>

          {/* رزم‌نامه */}
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="emerald">🏆 {faNum(card.wins)} برد</Chip>
            <Chip tone="rose">💀 {faNum(card.losses)} باخت</Chip>
            {card.winRate !== null ? <Chip tone="amber">🎖 {faNum(card.winRate)}% برد</Chip> : null}
            <Chip>💥 {faNum(card.crits)} بحرانی</Chip>
            <Chip>⚔️ {faNum(card.fights)} نبرد</Chip>
          </div>
        </div>
      </GlassCard>

      {/* ── آمار ── */}
      <GlassCard>
        <SectionTitle icon="📊" title="آمارِ رزمی" />
        <div className="grid grid-cols-3 gap-2">
          {STAT_DISPLAY.map((s) => (
            <div key={s.key} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
              <p className="text-[11px] leading-4 text-muted-foreground">
                <span aria-hidden className="me-0.5">
                  {s.icon}
                </span>
                {s.label}
              </p>
              <p className="mt-0.5 text-sm font-extrabold tabular-nums">
                {faNum(card.stats[s.key])}
                {s.pct ? "%" : ""}
              </p>
            </div>
          ))}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
            <p className="text-[11px] leading-4 text-muted-foreground">
              <span aria-hidden className="me-0.5">
                ❤️
              </span>
              خون
            </p>
            <p className="mt-0.5 text-sm font-extrabold tabular-nums">{faNum(card.stats.hp)}</p>
          </div>
        </div>
      </GlassCard>

      {/* ── پاسیوشِ امضا ── */}
      <GlassCard>
        <SectionTitle icon={card.passive.icon} title={`پاسیوش: ${card.passive.name}`} />
        <p className="text-xs leading-6 text-foreground/80">{card.passive.desc}</p>
      </GlassCard>

      {/* ── مسیرهای XP ── */}
      {card.xpTracks.length > 0 ? (
        <GlassCard pad="sm">
          <SectionTitle icon="✨" title="مسیرهای تجربه" />
          <div className="flex flex-wrap gap-1.5">
            {card.xpTracks.map((t) => (
              <Chip key={t.key}>
                <span aria-hidden>{t.icon}</span> {t.label}: {faNum(t.xp)}
              </Chip>
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  )
}
