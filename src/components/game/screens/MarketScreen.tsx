"use client"

// بازار — آگهی‌ها و مغازه‌ی محله.
// V22: این صفحه حالا نمایِ «بازار»ی تبِ «کیف و بازار» است (EconomyScreen) — در
// حالتِ embedded هدر (پول/اقتصاد) مالِ همان صفحه‌ی بالاست. سگمنتِ «قیمت‌ها»
// حذف شد؛ DTOی api.market همچنان prices دارد (فقط رندر نمی‌شود).
import * as React from "react"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import type { MarketEntryDTO, PriceInfoDTO, ShopItemDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { faNum, faPercent } from "../fa"
import { ActionOutcomeCard } from "../ActionOutcomeCard"
import { buildSnapshotNextStep } from "../ui/outcomeMeta"
import { ActionButton, Chip, EmptyState, GlassCard, MoneyBadge, RarityChip } from "../ui"
import { cn } from "@/lib/utils"

type MarketTab = "listings" | "shop"

const TABS: { key: MarketTab; label: string }[] = [
  { key: "listings", label: "آگهی‌ها" },
  { key: "shop", label: "مغازه‌ی محله" },
]

export function MarketScreen({ embedded = false }: { embedded?: boolean }) {
  const snapshot = useGame((s) => s.snapshot)
  // V22 — واکشی فقط وقتی نمایِ بازار فعال است (تبِ «کیف» + نمایِ بازار)
  const active = useGame((s) => s.activeTab === "bag" && s.economyView === "market")
  // V17-W3 (F1): خرید از بازار نتیجه‌اش را در کارتِ نتیجه می‌گیرد، نه توستِ ۳.۵ ثانیه‌ای
  const runActionReveal = useGame((s) => s.runActionReveal)
  const actionOutcome = useGame((s) => s.actionOutcome)
  const setActionOutcome = useGame((s) => s.setActionOutcome)
  // پس گرفتنِ آگهی (بدونِ دلتا) همان توستِ همیشگی را دارد
  const runAction = useGame((s) => s.runAction)
  // V17-W2 (F4): دکمه‌ی «قدمِ بعدی» حالت‌های خالی — مقصدِ موجود، نه صفحه‌ی تازه
  const setActiveTab = useGame((s) => s.setActiveTab)
  // V17-W3 (F5) — قدمِ «نقطه‌مهارت» مستقیم به سکشنِ مهارت‌ها deep-link می‌شود
  const setPendingSoulSection = useGame((s) => s.setPendingSoulSection)

  const [tab, setTab] = React.useState<MarketTab>("listings")
  const [data, setData] = React.useState<{
    listings: MarketEntryDTO[]
    shop: ShopItemDTO[]
    prices: PriceInfoDTO[]
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  /** صدای واقعیِ خطا — از ApiErr (V16-2، ممیزیِ ⑦)؛ null یعنی خطا نیست */
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  // بعد از بازیابیِ نشست (V16-2) همین صفحه بی‌درنگ تازه می‌شود
  const reloadSeq = useGame((s) => s.reloadSeq)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await api.market()
    if (res.ok) setData({ listings: res.data.listings, shop: res.data.shop, prices: res.data.prices })
    else setError(res.error)
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (!active) return
    void load()
  }, [active, load, reloadSeq])

  // V17-W3 (F1) — کارتِ نتیجه مثلِ توست رفتار می‌کند: با ترکِ نمایِ بازار جمع می‌شود
  React.useEffect(() => {
    if (!active) setActionOutcome(null)
  }, [active, setActionOutcome])

  if (!snapshot) return null
  const money = snapshot.player.money
  const economy = snapshot.world.economyIndex

  async function buyListing(listingId: string) {
    if (busyId) return
    setBusyId(listingId)
    // V17-W3 (F1): موتور پیام/طعم/دلتای خرید را برمی‌گرداند — کارتِ نتیجه در
    // جایگاهِ خودِ بازار می‌نشیند (تا بسته شود می‌ماند) و بازار هم تازه می‌شود
    const res = await runActionReveal("buyItem", { listingId })
    if (res) await load()
    setBusyId(null)
  }

  async function cancelListing(listingId: string) {
    if (busyId) return
    setBusyId(listingId)
    const ok = await runAction("cancelListing", { listingId })
    if (ok) await load()
    setBusyId(null)
  }

  // مغازه‌ی محله = آگهی‌های NPC؛ برای خرید، آی‌دی آگهی پیدا می‌کنیم
  const npcListingId = (itemKey: string) =>
    data?.listings.find((l) => l.itemKey === itemKey && l.sellerName === null && !l.mine)?.listingId ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* V22 — در حالتِ embedded هدر مالِ EconomyScreen است (پول/اقتصاد/عنوان) */}
      {embedded ? null : (
        <header className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-xl font-extrabold leading-8">💰 بازار</h1>
            <p className="text-xs text-muted-foreground">قیمت‌ها مثل شایعه‌اند؛ هر روز عوض می‌شوند.</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MoneyBadge amount={money} compact />
            <Chip tone={economy > 115 ? "rose" : economy < 85 ? "emerald" : "default"}>
              اقتصاد: {faPercent(economy)}
            </Chip>
          </div>
        </header>
      )}

      {/* V17-W3 (F1) — جایگاهِ کارتِ نتیجه‌ی خرید: بالایِ محتوای بازار، تا بسته شود می‌ماند */}
      {actionOutcome ? (
        <ActionOutcomeCard
          data={actionOutcome}
          nextStep={buildSnapshotNextStep(snapshot, {
            goSoul: () => setActiveTab("soul"),
            goSkills: () => {
              setPendingSoulSection("skills")
              setActiveTab("soul")
            },
            // کار/استراحت/کشیدنِ اتفاق روی پیشخوان زندگی می‌کنند — قدم به همان‌جا
            work: () => setActiveTab("home"),
            rest: () => setActiveTab("home"),
            draw: () => setActiveTab("home"),
          })}
          onDismiss={() => setActionOutcome(null)}
        />
      ) : null}

      {/* سگمنت */}
      <div className="glass flex gap-1 p-1" role="tablist" aria-label="بخش‌های بازار">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative min-h-10 flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors",
              tab === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === t.key ? (
              <motion.span
                layoutId="market-tab"
                className="absolute inset-0 rounded-xl border border-primary/25 bg-primary/10"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {loading && !data ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
        ) : error ? (
          <GlassCard>
            <EmptyState
              emoji="🫥"
              text="بازار جواب نمی‌ده."
              hint={error}
              action={
                <ActionButton variant="soft" size="sm" onClick={() => void load()}>
                  دوباره
                </ActionButton>
              }
            />
          </GlassCard>
        ) : tab === "listings" ? (
          <ListingsTab
            listings={data?.listings ?? []}
            money={money}
            busyId={busyId}
            onBuy={buyListing}
            onCancel={cancelListing}
            onGoShop={() => setTab("shop")}
          />
        ) : tab === "shop" ? (
          <ShopTab
            shop={data?.shop ?? []}
            money={money}
            busyId={busyId}
            listingFor={npcListingId}
            onBuy={buyListing}
            onSeeCity={() => setActiveTab("city")}
          />
        ) : null}
      </motion.div>
    </div>
  )
}

// ─── آگهی‌ها ─────────────────────────────────────────────────────────────────

function ListingsTab(props: {
  listings: MarketEntryDTO[]
  money: number
  busyId: string | null
  onBuy: (id: string) => void
  onCancel: (id: string) => void
  /** V17-W2 (F4) — حالتِ خالی: برو سراغِ مغازه‌ی محله (همان سگمنتِ داخلِ صفحه) */
  onGoShop: () => void
}) {
  const { listings, money, busyId, onBuy, onCancel, onGoShop } = props
  if (listings.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          emoji="🕸"
          text="الان کسی چیزی نمی‌فروشه."
          hint="یا همه چی دارن، یا همه چی ندارن."
          action={
            <ActionButton variant="soft" size="sm" onClick={onGoShop}>
              برو مغازه‌ی محله
            </ActionButton>
          }
        />
      </GlassCard>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {listings.map((l) => {
        const affordable = money >= l.price
        return (
          <li key={l.listingId} className={cn("glass flex items-center gap-3 p-3", l.mine && "border-primary/30")}>
            <span aria-hidden className="text-2xl leading-none">
              {l.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-bold">{l.name}</span>
                {l.quantity > 1 ? <Chip>×{faNum(l.quantity)}</Chip> : null}
                {l.mine ? <Chip tone="pink">مالِ من</Chip> : null}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {l.mine ? "منتظر خریدار..." : l.sellerName ? `فروشنده: ${l.sellerName}` : "مغازه"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs font-extrabold text-amber-200 tabular-nums">{faNum(l.price)}</span>
              {l.mine ? (
                <ActionButton
                  size="sm"
                  variant="ghost"
                  loading={busyId === l.listingId}
                  onClick={() => onCancel(l.listingId)}
                  className="h-7 px-2 text-[11px]"
                >
                  پس گرفتن
                </ActionButton>
              ) : (
                <ActionButton
                  size="sm"
                  variant={affordable ? "primary" : "glass"}
                  disabled={!affordable}
                  loading={busyId === l.listingId}
                  onClick={() => onBuy(l.listingId)}
                  className="h-7 px-3 text-[11px]"
                >
                  {affordable ? "می‌خوام" : "سکه کم داری"}
                </ActionButton>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ─── مغازه‌ی محله ────────────────────────────────────────────────────────────

function ShopTab(props: {
  shop: ShopItemDTO[]
  money: number
  busyId: string | null
  listingFor: (itemKey: string) => string | null
  onBuy: (id: string) => void
  /** V17-W2 (F4) — حالتِ تعطیلی: برو ببین شهر چه خبر است (تبِ شهر) */
  onSeeCity: () => void
}) {
  const { shop, money, busyId, listingFor, onBuy, onSeeCity } = props
  if (shop.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          emoji="🚪"
          text="مغازه‌ی این محله امروز تعطیل شده."
          hint="یا شغلِ دیگه‌ای پیدا کرده. مغازه‌ها هم دل دارند."
          action={
            <ActionButton variant="soft" size="sm" onClick={onSeeCity}>
              ببین چه خبر است
            </ActionButton>
          }
        />
      </GlassCard>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {shop.map((s) => {
        const listingId = listingFor(s.itemKey)
        const affordable = money >= s.price
        return (
          <li key={s.itemKey} className="glass flex items-center gap-3 p-3">
            <span aria-hidden className="text-2xl leading-none">
              {s.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold">{s.name}</span>
                <RarityChip rarity={s.rarity} />
              </div>
              <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">{s.description}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xs font-extrabold text-amber-200 tabular-nums">{faNum(s.price)}</span>
              <ActionButton
                size="sm"
                variant={affordable && listingId ? "primary" : "glass"}
                disabled={!affordable || !listingId}
                loading={!!listingId && busyId === listingId}
                onClick={() => listingId && onBuy(listingId)}
                className="h-7 px-3 text-[11px]"
              >
                {!listingId ? "ناموجود" : affordable ? "می‌خوام" : "سکه کم داری"}
              </ActionButton>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
