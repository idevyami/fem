"use client"

// V19 فمبوی — سکشنِ «🎭 شخصیت»: طبع + استعداد + ضعف + ماتریسِ دامنه‌ها.
// همه‌چیز از SoulCardDTO می‌آید (تک‌منبع) — هیچ محاسبه‌ی موازی این‌جا نیست.
// اصلِ طراحی (مأموریت §3.2): مدلِ عمیق پشتِ صحنه؛ بازیکن تفسیرِ خوانا می‌بیند.

import * as React from "react"
import type { SoulCardDTO } from "@/lib/game/contract"
import { faNum } from "../../fa"
import { Chip, GlassCard, SectionTitle } from "../../ui"
import { cn } from "@/lib/utils"

export function PersonaSection({ card }: { card: SoulCardDTO }) {
  const persona = card.persona
  const talent = card.talent
  const flaw = card.flaw

  if (!persona) {
    return (
      <GlassCard>
        <p className="p-4 text-center text-sm text-muted-foreground">شخصیتِ این فمبوی هنوز ثبت نشده.</p>
      </GlassCard>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* کارتِ طبع */}
      <GlassCard>
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
            style={{ background: `linear-gradient(135deg, ${card.palette.primary}33, ${card.palette.soft}22)` }}
          >
            {persona.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-extrabold">{persona.name}</h2>
              <Chip tone="violet" className="shrink-0">🎭 طبع</Chip>
            </div>
            <p className="mt-0.5 text-[13px] leading-5 text-foreground/80">{persona.tagline}</p>
          </div>
        </div>
        {/* صفت‌ها */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {persona.traits.map((t) => (
            <Chip key={t} tone="pink">
              {t}
            </Chip>
          ))}
        </div>
      </GlassCard>

      {/* صدای طبع — نمونه‌ی واقعی از خودِ موتور */}
      {persona.voiceSample ? (
        <GlassCard>
          <SectionTitle icon="🗣️" title="این‌جوری حرف می‌زنه" />
          <blockquote className="mt-2 rounded-xl border-r-2 border-primary/40 bg-white/[0.03] px-3 py-2 text-[13px] leading-6 text-foreground/85">
            {persona.voiceSample}
          </blockquote>
          <p className="mt-2 px-1 text-[11px] leading-4 text-muted-foreground">
            هر تعامل با همین لهجه جواب می‌گیرد — صدای طبع، خطِ پایه‌ی هر واکنش است.
          </p>
        </GlassCard>
      ) : null}

      {/* استعداد و ضعف */}
      <div className="grid gap-3 sm:grid-cols-2">
        {talent ? (
          <TalentFlawCard
            emoji={talent.emoji}
            name={talent.name}
            desc={talent.desc}
            domainLabel={talent.domainLabel}
            pct={talent.pct}
            kind="talent"
          />
        ) : null}
        {flaw ? (
          <TalentFlawCard
            emoji={flaw.emoji}
            name={flaw.name}
            desc={flaw.desc}
            domainLabel={flaw.domainLabel}
            pct={flaw.pct}
            kind="flaw"
          />
        ) : null}
      </div>

      {/* ماتریسِ دامنه‌ها */}
      <GlassCard>
        <SectionTitle icon="🧭" title="برای چه کاری مناسبه؟" />
        <ul className="mt-2 flex flex-col gap-2">
          {card.affinityRows.map((row) => (
            <li
              key={`${row.kind}-${row.domain}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="text-base">{row.icon}</span>
                <span className="truncate text-[13px] font-bold">{row.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Chip tone={row.kind === "talent" ? "violet" : "default"}>{row.kind === "talent" ? "استعداد" : "ضعف"}</Chip>
                <span
                  className={cn(
                    "text-[12px] font-extrabold tabular-nums",
                    row.pct > 0 ? "text-emerald-400" : row.pct < 0 ? "text-rose-400" : "text-muted-foreground",
                  )}
                >
                  {row.pct > 0 ? "+" : row.pct < 0 ? "−" : ""}
                  {faNum(Math.abs(row.pct))}%
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11px] leading-4 text-muted-foreground">
          این اعداد واقعی‌اند: هر سطر دقیقاً همان جایی از بازی اعمال می‌شود که برچسبش می‌گوید.
        </p>
      </GlassCard>

      <p className="px-2 pb-1 text-center text-[11px] leading-4 text-muted-foreground">
        🎭 طبع از روزِ پیمان ثابت است — شخصیتش عوض نمی‌شود؛ فقط شناخته‌تر می‌شود.
      </p>
    </div>
  )
}

/** کارتِ استعداد/ضعف — همان شکل، رنگِ متفاوت */
function TalentFlawCard({
  emoji,
  name,
  desc,
  domainLabel,
  pct,
  kind,
}: {
  emoji: string
  name: string
  desc: string
  domainLabel: string
  pct: number
  kind: "talent" | "flaw"
}) {
  const good = kind === "talent"
  return (
    <GlassCard>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="text-2xl">{emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[15px] font-extrabold">{name}</h3>
            <Chip tone={good ? "emerald" : "rose"} className="shrink-0">
              {good ? "✨ استعداد" : "🌧️ ضعف"}
            </Chip>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{domainLabel}</p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-extrabold tabular-nums",
            pct > 0 ? "text-emerald-400" : "text-rose-400",
          )}
        >
          {pct > 0 ? "+" : "−"}
          {faNum(Math.abs(pct))}%
        </span>
      </div>
      <p className="mt-2 text-[12.5px] leading-5 text-foreground/80">{desc}</p>
    </GlassCard>
  )
}
