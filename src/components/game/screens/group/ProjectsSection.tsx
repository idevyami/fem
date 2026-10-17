"use client"

// پروژه‌های شهری — در ساخت / ساخته‌شده / دفترِ شهر
import * as React from "react"
import { motion } from "framer-motion"
import type { GroupProjectDTO } from "@/lib/game/group/types"
// نکته‌ی باندل: GROUP_PROJECT_MAP داخلِ misc.ts زندگی می‌کند (کنارِ 52 میم/32 شایعه و…)، فایلِ خودش را ندارد؛
// این ایمپورت عمداً مستقیم از misc است — نه از بشکه‌ی group/content که events.tsِ 7389 خطی را هم می‌کشد.
// جداسازیِ نقشه به فایلِ خودش کارِ موتورِ محتواست (مرزِ عاملِ دیگر)؛ فعلاً همین مسیرِ نازک‌ترِ ممکن است.
import { GROUP_PROJECT_MAP } from "@/lib/game/group/content/misc"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, ProgressBar, SectionTitle } from "../../ui"

/** سکه‌های کمک — همان چیپ‌های ربات */
const CONTRIBUTE_AMOUNTS = [1000, 5000, 20000]

interface ProjectsSectionProps {
  projects: GroupProjectDTO[]
  acting: string | null
  onContribute: (key: string, projectKey: string, amount: number) => void
  onStartProject: (key: string, projectKey: string) => void
}

export function ProjectsSection({ projects, acting, onContribute, onStartProject }: ProjectsSectionProps) {
  const existingKeys = React.useMemo(() => new Set(projects.map((p) => p.key)), [projects])
  const building = projects.filter((p) => p.status === "building")
  const done = projects.filter((p) => p.status === "done")
  const available = React.useMemo(
    () => Object.values(GROUP_PROJECT_MAP).filter((t) => !existingKeys.has(t.key)),
    [existingKeys],
  )
  if (projects.length === 0 && available.length === 0) return null

  return (
    <section aria-label="پروژه‌های شهری">
      <SectionTitle icon="🏗" title="پروژه‌های شهری" />
      <div className="flex flex-col gap-3">
        {building.map((p, i) => (
          <ProjectCard key={p.id} p={p} index={i} acting={acting} onContribute={onContribute} />
        ))}

        {done.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-1" aria-label="پروژه‌های ساخته‌شده">
            {done.map((p) => (
              <Chip key={p.id} tone="emerald">
                ✅ {p.emoji} {p.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {available.length > 0 ? (
          <GlassCard pad="sm">
            <p className="mb-2 text-[11px] leading-4 text-muted-foreground">دفترِ شهر — قابلِ افتتاح:</p>
            <ul className="flex flex-col gap-1.5">
              {available.map((t) => {
                const key = `startp:${t.key}`
                return (
                  <li
                    key={t.key}
                    className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2"
                  >
                    <span aria-hidden className="text-xl leading-none">
                      {t.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold leading-4">{t.name}</p>
                      <p className="truncate text-[11px] leading-4 text-muted-foreground">
                        💰 {faNum(t.cost)} · {t.benefit}
                      </p>
                    </div>
                    <ActionButton
                      size="sm"
                      variant="glass"
                      className="h-11"
                      loading={acting === key}
                      disabled={acting !== null}
                      onClick={() => onStartProject(key, t.key)}
                    >
                      افتتاح
                    </ActionButton>
                  </li>
                )
              })}
            </ul>
          </GlassCard>
        ) : null}
      </div>
    </section>
  )
}

function ProjectCard({
  p,
  index,
  acting,
  onContribute,
}: {
  p: GroupProjectDTO
  index: number
  acting: string | null
  onContribute: (key: string, projectKey: string, amount: number) => void
}) {
  const pct = p.goal > 0 ? Math.min(100, Math.floor((p.contributed / p.goal) * 100)) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
    >
      <GlassCard>
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-2xl leading-none">
            {p.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="text-sm font-bold leading-6">{p.name}</h3>
              <Chip tone="amber">در ساخت</Chip>
            </div>
            {p.description ? (
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{p.description}</p>
            ) : null}
            {p.benefit ? (
              <p className="mt-0.5 text-[11px] leading-4 text-emerald-300/85">🎁 {p.benefit}</p>
            ) : null}

            <div className="mt-2.5">
              <ProgressBar value={p.contributed} max={p.goal} barClassName="bg-amber-400" label={`پیشرفتِ ${p.name}`} />
              <div className="mt-1 flex items-center justify-between text-[11px] leading-4 text-muted-foreground">
                <span className="tabular-nums">
                  💰 {faNum(p.contributed)} از {faNum(p.goal)}
                </span>
                <span className="font-bold tabular-nums text-amber-300">{faNum(pct)}%</span>
              </div>
              {p.myContribution > 0 ? (
                <p className="mt-0.5 text-[11px] leading-4 text-primary">
                  سهمِ تو تا این‌جا: {faNum(p.myContribution)} سکه
                </p>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {CONTRIBUTE_AMOUNTS.map((amount) => {
                const key = `contrib:${p.id}:${amount}`
                return (
                  <ActionButton
                    key={amount}
                    size="sm"
                    variant="success"
                    className="h-11 min-w-[5.5rem] flex-1"
                    loading={acting === key}
                    disabled={acting !== null}
                    onClick={() => onContribute(key, p.key, amount)}
                  >
                    {faNum(amount)} کمک
                  </ActionButton>
                )
              })}
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}
