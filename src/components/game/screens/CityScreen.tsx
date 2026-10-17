"use client"

// شهر — محله‌ها، ساکنان، مردمداری
import * as React from "react"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { CityNewsResponse, DistrictDTO, LeaderRowDTO, NpcDTO } from "@/lib/game/contract"
import type { CatalogResponse } from "@/lib/game/client"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { faNum } from "../fa"
import { ActionButton, Chip, EmptyState, GlassCard, GlassSheet, ProgressBar, SectionTitle } from "../ui"
import { cn } from "@/lib/utils"

export function CityScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const active = useGame((s) => s.activeTab === "city")
  const runAction = useGame((s) => s.runAction)

  const [catalog, setCatalog] = React.useState<CatalogResponse | null>(null)
  const [catLoading, setCatLoading] = React.useState(true)
  /** صدای واقعیِ خطا — از ApiErr (V16-2، ممیزیِ ⑦)؛ null یعنی خطا نیست */
  const [catError, setCatError] = React.useState<string | null>(null)
  const [leaders, setLeaders] = React.useState<LeaderRowDTO[] | null>(null)
  const [lbLoading, setLbLoading] = React.useState(true)

  const [travelTarget, setTravelTarget] = React.useState<DistrictDTO | null>(null)
  const [traveling, setTraveling] = React.useState(false)
  const [npcSheet, setNpcSheet] = React.useState<NpcDTO | null>(null)
  const [news, setNews] = React.useState<CityNewsResponse | null>(null)
  // بعد از بازیابیِ نشست (V16-2) همین صفحه بی‌درنگ تازه می‌شود
  const reloadSeq = useGame((s) => s.reloadSeq)

  // اخبار و شایعه‌های شهر — با هر فعال‌شدنِ تب تازه‌سازی می‌شود (شهر ساکن نمی‌ماند)؛ خطا → بی‌صدا قایم می‌شود
  React.useEffect(() => {
    if (!active) return
    let alive = true
    void api.citynews().then((res) => {
      if (res.ok && alive) setNews(res.data)
    })
    return () => {
      alive = false
    }
  }, [active])

  const loadCatalog = React.useCallback(async () => {
    setCatLoading(true)
    setCatError(null)
    const res = await api.catalog()
    if (res.ok) setCatalog(res.data)
    else setCatError(res.error)
    setCatLoading(false)
  }, [])

  const loadLeaders = React.useCallback(async () => {
    setLbLoading(true)
    const res = await api.leaderboard()
    if (res.ok) setLeaders(res.data.rows)
    setLbLoading(false)
  }, [])

  React.useEffect(() => {
    if (!active) return
    void loadCatalog()
    void loadLeaders()
  }, [active, loadCatalog, loadLeaders, reloadSeq])

  if (!snapshot) return null
  const { player, npcs } = snapshot

  const vehicleSpeed = catalog?.vehicles.find((v) => v.key === player.vehicle?.key)?.speed ?? 0
  const travelEnergy = Math.max(2, 6 - vehicleSpeed)
  const districtNpcs = npcs.filter((n) => n.district === player.district)

  async function confirmTravel() {
    if (!travelTarget || traveling) return
    setTraveling(true)
    const ok = await runAction("travel", { district: travelTarget.key })
    setTraveling(false)
    if (ok) setTravelTarget(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold leading-8">
          {player.districtEmoji} {player.districtName}
        </h1>
        <p className="text-xs text-muted-foreground">شهر از هر محله‌ای یه شناسنامه دارد. بعضی‌شان جعلی‌اند.</p>
      </header>

      {/* تیترِ امروز — چیزهایی که همه درباره‌ش حرف می‌زنند */}
      {news && news.headlines.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          aria-label="تیترِ امروز"
        >
          <SectionTitle icon="📰" title="تیترِ امروز" />
          <ul className="flex flex-col gap-1.5">
            {news.headlines.slice(0, 3).map((h, i) => (
              <motion.li
                key={`${h.at}-${i}`}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 + i * 0.1, duration: 0.28 }}
                className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-foreground/80"
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-sm leading-5">
                  {h.icon}
                </span>
                <span className="min-w-0">{h.text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.section>
      ) : null}

      {/* شایعه‌های شهر — دنیای مشترک با گروه */}
      {news && news.rumors.length > 0 ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          aria-label="شایعه‌های شهر"
        >
          <GlassCard>
            <SectionTitle icon="🗣" title="شایعه‌های شهر" />
            <ul className="flex flex-col gap-1.5">
              {news.rumors.slice(0, 3).map((r, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.14, duration: 0.3 }}
                  className="text-xs italic leading-6 text-muted-foreground"
                >
                  «{r}»
                </motion.li>
              ))}
            </ul>
            <p className="mt-2.5 border-t border-white/10 pt-2.5 text-[11px] leading-5 text-muted-foreground/80">
              شایعه‌ها گاهی درست‌اند.
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              <span className="font-semibold text-foreground/75">
                👥 {faNum(news.population)} نفر این‌جا زندگی می‌کنند
              </span>
            </p>
          </GlassCard>
        </motion.section>
      ) : null}

      {/* محله‌ها */}
      <section aria-label="محله‌های شهر">
        <SectionTitle icon="🌆" title="محله‌ها" />
        {catLoading && !catalog ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-3xl bg-white/[0.05]" />
            ))}
          </div>
        ) : catError ? (
          <GlassCard>
            <EmptyState
              emoji="🫥"
              text="نقشه‌ی شهر گم شد."
              hint={catError}
              action={
                <ActionButton variant="soft" size="sm" onClick={() => void loadCatalog()}>
                  دوباره
                </ActionButton>
              }
            />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {(catalog?.districts ?? []).map((d) => {
              const here = d.key === player.district
              return (
                <motion.button
                  key={d.key}
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  onClick={() => {
                    if (here) return
                    setTravelTarget(d)
                  }}
                  className={cn(
                    "glass w-full p-4 text-start transition-colors",
                    here ? "border-primary/50 bg-primary/[0.06] glow-pink" : "hover:bg-white/[0.06]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="mt-0.5 text-3xl leading-none">
                      {d.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold">{d.name}</h3>
                        {here ? <Chip tone="pink">اینجایی</Chip> : null}
                      </div>
                      <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">{d.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/60">
                        <span>حال‌وهوا: {d.mood}</span>
                        <span className="flex items-center gap-1" title={`خطر: ${faNum(d.risk)} از 4`}>
                          خطر:
                          <span aria-hidden className="flex items-center gap-0.5">
                            {[1, 2, 3, 4].map((i) => (
                              <span
                                key={i}
                                className={cn(
                                  "inline-block size-1.5 rounded-full",
                                  i <= d.risk ? "bg-rose-400" : "bg-white/15",
                                )}
                              />
                            ))}
                          </span>
                        </span>
                        <span>{faNum(d.playerCount)} بازیکن</span>
                      </div>
                      {d.activeFlavor ? (
                        <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium leading-4 text-amber-300">
                          ✨ {d.activeFlavor}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </section>

      {/* ساکنان مشهور محله‌ی فعلی */}
      <section aria-label="ساکنان مشهور">
        <SectionTitle icon="🎭" title={`ساکنان مشهور ${player.districtName}`} />
        {districtNpcs.length === 0 ? (
          <GlassCard>
            <EmptyState emoji="🚪" text="این محله‌ی خاص، ساکن مشهور ندارد. یا دارد و نشان نمی‌دهد." />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-2">
            {districtNpcs.map((n) => (
              <motion.button
                key={n.key}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => setNpcSheet(n)}
                className="glass flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-white/[0.06]"
              >
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
                  {n.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-bold">{n.name}</h3>
                    {n.hasSecret ? <Chip tone="violet">? دارد رازی</Chip> : null}
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {n.occupation} · {n.statusLabel}
                  </p>
                </div>
                {n.lastMemory ? <span aria-hidden className="shrink-0 text-[11px] text-muted-foreground">💬</span> : null}
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* مردم شهر */}
      <section aria-label="مردم شهر">
        <SectionTitle
          icon="📊"
          title="مردم شهر"
          action={<Chip>روز {faNum(snapshot.world.dayCount)}</Chip>}
        />
        <GlassCard pad="sm">
          {lbLoading && !leaders ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl bg-white/[0.05]" />
              ))}
            </div>
          ) : !leaders || leaders.length === 0 ? (
            <EmptyState emoji="🕯" text="فعلاً کسی جز تو این‌جا نیست. شهر برای دو نفر هم قشنگه." />
          ) : (
            <ul className="scrollbar-thin max-h-96 overflow-y-auto pe-1">
              {leaders.map((r, i) => {
                const me = r.id === player.id
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-2.5 py-2",
                      me ? "border-primary/40 bg-primary/[0.07]" : "border-transparent",
                    )}
                  >
                    <span className="w-7 shrink-0 text-center text-xs font-bold text-muted-foreground tabular-nums">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : faNum(i + 1)}
                    </span>
                    <span aria-hidden className="text-xl leading-none">
                      {r.avatar}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("truncate text-xs font-bold", me && "text-primary")}>{r.name}</span>
                        {me ? <Chip tone="pink">تو</Chip> : null}
                      </div>
                      <p className="truncate text-[11px] leading-4 text-muted-foreground">{r.highlight}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="text-[11px] font-bold text-foreground/70">سطح {faNum(r.level)}</div>
                      {r.title ? <div className="text-[11px] text-muted-foreground">{r.title}</div> : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </GlassCard>
      </section>

      {/* شیت تایید سفر */}
      <GlassSheet
        open={travelTarget !== null}
        onOpenChange={(v) => {
          if (!v) setTravelTarget(null)
        }}
        title={
          travelTarget ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-xl">
                {travelTarget.emoji}
              </span>
              بریم {travelTarget.name}؟
            </span>
          ) : null
        }
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth onClick={() => setTravelTarget(null)}>
              ولش کن
            </ActionButton>
            <ActionButton variant="primary" fullWidth loading={traveling} onClick={() => void confirmTravel()}>
              برو
            </ActionButton>
          </div>
        }
      >
        {travelTarget ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-6 text-muted-foreground">{travelTarget.description}</p>
            <div className="flex flex-wrap gap-1.5">
              <Chip>حال‌وهوا: {travelTarget.mood}</Chip>
              <Chip tone="rose">خطر {faNum(travelTarget.risk)} از 4</Chip>
              <Chip tone="teal">حدود {faNum(travelEnergy)}⚡ انرژی</Chip>
              <Chip>{faNum(travelTarget.playerCount)} بازیکن</Chip>
            </div>
            <p className="text-[11px] leading-5 text-muted-foreground">
              {player.vehicle ? `${player.vehicle.emoji} ${player.vehicle.name} جلوترت می‌رود.` : "پیاده‌ای. شهر لطف می‌کند."}
            </p>
          </div>
        ) : null}
      </GlassSheet>

      {/* شیت NPC */}
      <GlassSheet
        open={npcSheet !== null}
        onOpenChange={(v) => {
          if (!v) setNpcSheet(null)
        }}
        title={
          npcSheet ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-xl">
                {npcSheet.emoji}
              </span>
              {npcSheet.name}
            </span>
          ) : null
        }
      >
        {npcSheet ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip>{npcSheet.occupation}</Chip>
              <Chip tone="teal">{npcSheet.statusLabel}</Chip>
              {npcSheet.hasSecret ? <Chip tone="violet">? دارد رازی</Chip> : null}
            </div>
            <p className="text-xs leading-6 text-foreground/80">{npcSheet.description}</p>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <p className="mb-2.5 text-[11px] font-semibold text-muted-foreground">رابطه‌ی شما با هم:</p>
              <div className="flex flex-col gap-2.5">
                <RelBar label="اعتماد" value={npcSheet.relationship.trust} barClassName="bg-emerald-400" />
                <RelBar label="محبت" value={npcSheet.relationship.affection} barClassName="bg-pink-400" />
                <RelBar label="احترام" value={npcSheet.relationship.respect} barClassName="bg-violet-400" />
                <RelBar label="ترس" value={npcSheet.relationship.fear} barClassName="bg-rose-400" />
              </div>
            </div>

            {npcSheet.lastMemory ? (
              <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                💭 یادش می‌ماند: {npcSheet.lastMemory}
              </p>
            ) : (
              <p className="text-[11px] leading-5 text-muted-foreground">هنوز چیزی از تو یادش نمانده. عجله نکن.</p>
            )}
          </div>
        ) : null}
      </GlassSheet>
    </div>
  )
}

function RelBar({ label, value, barClassName }: { label: string; value: number; barClassName?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-11 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <ProgressBar value={value} barClassName={barClassName} label={label} className="flex-1" />
      <span className="w-7 shrink-0 text-end text-[11px] font-bold tabular-nums text-foreground/70">{faNum(value)}</span>
    </div>
  )
}
