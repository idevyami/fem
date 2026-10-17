"use client"

// شایعه‌ها و میم‌های گروه — حرف‌هایی که خودِ شهر می‌سازد
import { motion } from "framer-motion"
import type { GroupMemeDTO, GroupRumorDTO } from "@/lib/game/group/types"
import { faNum } from "../../fa"
import { ActionButton, Chip, GlassCard, ProgressBar, SectionTitle } from "../../ui"

interface RumorsSectionProps {
  rumors: GroupRumorDTO[]
  acting: string | null
  onRumor: (key: string, rumorId: string, rumorAction: "inv" | "spr" | "deny") => void
}

function truthTone(label: string): "emerald" | "rose" | "default" {
  if (label.includes("درست")) return "emerald"
  if (label.includes("دروغ")) return "rose"
  return "default"
}

export function RumorsSection({ rumors, acting, onRumor }: RumorsSectionProps) {
  if (rumors.length === 0) return null
  return (
    <section aria-label="شایعه‌های گروه">
      <SectionTitle icon="🗣" title="شایعه‌ها" action={<Chip>{faNum(rumors.length)}</Chip>} />
      <div className="flex flex-col gap-2.5">
        {rumors.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08, ease: "easeOut" }}
          >
            <GlassCard pad="sm">
              <p className="text-xs italic leading-6 text-foreground/85">«{r.text}»</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Chip tone={truthTone(r.truthOddsLabel)}>{r.truthOddsLabel}</Chip>
                {r.spreadCount > 0 ? (
                  <Chip>🗣 {faNum(r.spreadCount)} بار پخش شده</Chip>
                ) : null}
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                <ActionButton
                  size="sm"
                  variant="soft"
                  className="h-11"
                  loading={acting === `rumor:${r.id}:inv`}
                  disabled={acting !== null}
                  onClick={() => onRumor(`rumor:${r.id}:inv`, r.id, "inv")}
                >
                  🕵️ تحقیق
                </ActionButton>
                <ActionButton
                  size="sm"
                  variant="danger"
                  className="h-11"
                  loading={acting === `rumor:${r.id}:spr`}
                  disabled={acting !== null}
                  onClick={() => onRumor(`rumor:${r.id}:spr`, r.id, "spr")}
                >
                  🗣 پخش
                </ActionButton>
                <ActionButton
                  size="sm"
                  variant="success"
                  className="h-11"
                  loading={acting === `rumor:${r.id}:deny`}
                  disabled={acting !== null}
                  onClick={() => onRumor(`rumor:${r.id}:deny`, r.id, "deny")}
                >
                  🚫 تکذیب
                </ActionButton>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function MemesStrip({ memes }: { memes: GroupMemeDTO[] }) {
  if (memes.length === 0) return null
  return (
    <section aria-label="میم‌های گروه">
      <SectionTitle icon="😂" title="میم‌های شهر" />
      <GlassCard pad="sm">
        <ul className="flex flex-col gap-3">
          {memes.map((m, i) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.07, ease: "easeOut" }}
            >
              <p className="text-xs italic leading-6 text-foreground/85">
                {m.emoji} «{m.text}»
              </p>
              <div className="mt-1 flex items-center gap-2">
                <ProgressBar value={m.confidence} barClassName="bg-violet-400" className="h-1" label="محبوبیتِ میم" />
                <span className="shrink-0 text-[11px] leading-4 text-muted-foreground tabular-nums">
                  🔥 {faNum(m.usageCount)}
                </span>
              </div>
            </motion.li>
          ))}
        </ul>
      </GlassCard>
    </section>
  )
}
