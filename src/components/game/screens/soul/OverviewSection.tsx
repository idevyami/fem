"use client"

// V10 فمبوی — سکشنِ پروفایل: کارتِ کاملِ فمبوی (+ تسلط/ظاهر/سلوکِ بعدی)
// V22 — «آمار»: هویت و وضعِ فعلی به کارتِ قهرمانِ صفحه رفت (SoulScreen) و
// شخصیت به سکشنِ خودش — این سکشن دفترچه‌ی آمار است: یک خطِ خلاصه همیشه پیدا،
// سنگین‌ها پشتِ «جزئیات بیشتر» (همان الگویِ افشایِ تدریجیِ سکشنِ «من»).
import * as React from "react"
import type { SoulCardDTO } from "@/lib/game/contract"
import { faNum } from "../../fa"
import { haptic } from "../../telegram"
import { Chip, GlassCard, SectionTitle } from "../../ui"
import { STAT_DISPLAY } from "./classMeta"

export function OverviewSection({ card }: { card: SoulCardDTO }) {
  // افشایِ تدریجی — پیش‌فرضِ بسته: خلاصه جلو، جزئیات با لمس (الگویِ MeScreen)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  return (
    <section aria-label="آمارِ فمبوی">
      <GlassCard>
        <SectionTitle icon="📊" title="آمار" />

        {/* خلاصه — یک خط: امضای کلاس · رزم‌نامه · حالِ امروز */}
        <p className="text-xs leading-6 text-foreground/85">
          <span className="font-bold">
            <span aria-hidden className="me-0.5">
              {card.passive.icon}
            </span>
            {card.passive.name}
          </span>
          <span className="text-muted-foreground"> · </span>
          <span dir="ltr" className="font-bold tabular-nums">
            ⚔️ {faNum(card.wins)}W/{faNum(card.losses)}L
          </span>
          <span className="text-muted-foreground"> · </span>
          <span aria-hidden className="me-0.5">
            {card.condition.emoji}
          </span>
          {card.condition.label}
        </p>

        {detailsOpen ? (
          <div className="mt-3 flex flex-col gap-3.5">
            {/* رزم‌نامه */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold leading-4 text-muted-foreground">رزم‌نامه</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="emerald">🏆 {faNum(card.wins)} برد</Chip>
                <Chip tone="rose">💀 {faNum(card.losses)} باخت</Chip>
                {card.winRate !== null ? <Chip tone="amber">🎖 {faNum(card.winRate)}% برد</Chip> : null}
                <Chip>💥 {faNum(card.crits)} بحرانی</Chip>
                <Chip>⚔️ {faNum(card.fights)} نبرد</Chip>
              </div>
            </div>

            {/* آمارِ رزمی — ۳×۳ + خون */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold leading-4 text-muted-foreground">آمارِ رزمی</p>
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
            </div>

            {/* پاسیوشِ امضا */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold leading-4 text-muted-foreground">
                پاسیوش: {card.passive.name}
              </p>
              <p className="text-xs leading-6 text-foreground/80">{card.passive.desc}</p>
            </div>

            {/* مسیرهای تجربه */}
            {card.xpTracks.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[11px] font-bold leading-4 text-muted-foreground">✨ مسیرهای تجربه</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.xpTracks.map((t) => (
                    <Chip key={t.key}>
                      <span aria-hidden>{t.icon}</span> {t.label}: {faNum(t.xp)}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* افشایِ تدریجی — همان دکمه‌ی همیشگیِ سکشنِ «من» (ممیزیِ ⑫) */}
        <button
          type="button"
          onClick={() => {
            haptic("light")
            setDetailsOpen((v) => !v)
          }}
          aria-expanded={detailsOpen}
          className="mt-3 min-h-11 w-full rounded-full text-[11px] font-bold text-primary transition-colors hover:text-primary/80"
        >
          {detailsOpen ? "بستنِ جزئیات" : "جزئیات بیشتر"}
        </button>
      </GlassCard>
    </section>
  )
}
