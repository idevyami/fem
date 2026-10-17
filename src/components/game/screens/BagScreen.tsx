"use client"

// کیف — حیوان‌ها و وسایل
import * as React from "react"
import { motion } from "framer-motion"
import { Minus, Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { InventoryEntryDTO, PetDTO, PriceInfoDTO } from "@/lib/game/contract"
import { api } from "@/lib/game/client"
import { useGame } from "../store"
import { haptic } from "../telegram"
import { faNum } from "../fa"
import { RARITY_ORDER, RARITY_UI } from "../ui/RarityChip"
import { ActionButton, Chip, EmptyState, GlassCard, GlassSheet, ProgressBar, RarityChip, SectionTitle } from "../ui"
import { cn } from "@/lib/utils"

const CAT_LABELS: Record<string, string> = {
  consumable: "مصرفی",
  gear: "امکان‌پوش",
  collectible: "کلکسیونی",
  mystery: "عجیب",
  junk: "بی‌ارزش",
}
const CAT_KEYS = ["consumable", "gear", "collectible", "mystery", "junk"]

export function BagScreen() {
  const snapshot = useGame((s) => s.snapshot)
  const active = useGame((s) => s.activeTab === "bag")
  const runAction = useGame((s) => s.runAction)

  const [prices, setPrices] = React.useState<PriceInfoDTO[] | null>(null)
  /** قیمت‌ها نیامد — خطا را خاموش قورت نمی‌دهیم؛ چیپِ «دوباره» همان واکشی را دوباره می‌زند */
  const [pricesError, setPricesError] = React.useState(false)
  const [pricesTick, setPricesTick] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [cat, setCat] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<"qty" | "rarity">("qty")

  const [itemKey, setItemKey] = React.useState<string | null>(null)
  const [listingFor, setListingFor] = React.useState<string | null>(null)
  const [listQty, setListQty] = React.useState(1)
  const [listPrice, setListPrice] = React.useState("")
  const [listing, setListing] = React.useState(false)

  const [renamePet, setRenamePet] = React.useState<PetDTO | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [renaming, setRenaming] = React.useState(false)
  const [busyPet, setBusyPet] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!active) return
    let alive = true
    setPricesError(false)
    void api.market().then((res) => {
      if (!alive) return
      if (res.ok) setPrices(res.data.prices)
      else setPricesError(true)
    })
    return () => {
      alive = false
    }
  }, [active, pricesTick])

  const inventory = snapshot?.inventory ?? []
  const pets = snapshot?.pets ?? []

  const filtered = React.useMemo(() => {
    let list = [...inventory]
    if (cat !== "all") list = list.filter((i) => i.category === cat)
    const q = query.trim()
    if (q) list = list.filter((i) => i.name.includes(q))
    list.sort((a, b) =>
      sortBy === "qty" ? b.quantity - a.quantity : (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0),
    )
    return list
  }, [inventory, cat, query, sortBy])

  if (!snapshot) return null

  const entry = itemKey ? inventory.find((i) => i.itemKey === itemKey) ?? null : null
  const petFoodCount = inventory.find((i) => i.itemKey === "pet_food")?.quantity ?? 0

  const currentPrice = (key: string) => prices?.find((p) => p.itemKey === key)?.current
  const quickSell = (key: string) => {
    const cur = currentPrice(key)
    return cur ? Math.max(1, Math.round(cur * 0.6)) : null
  }

  async function createListing() {
    if (!listingFor || listing) return
    const price = Number(listPrice)
    if (!Number.isFinite(price) || price < 1) return
    setListing(true)
    const ok = await runAction("createListing", { itemKey: listingFor, quantity: listQty, price: Math.round(price) })
    setListing(false)
    if (ok) {
      setListingFor(null)
      setItemKey(null)
    }
  }

  async function doRename() {
    if (!renamePet || renaming) return
    setRenaming(true)
    const ok = await runAction("renamePet", { petId: renamePet.id, name: renameValue })
    setRenaming(false)
    if (ok) setRenamePet(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1">
        <h1 className="text-xl font-extrabold leading-8">🎒 کیف</h1>
        <p className="text-xs text-muted-foreground">هر چیزی که داری و چندتا چیز که نداری ولی هست.</p>
      </header>

      {/* ── حیوان‌ها ── */}
      <section aria-label="حیوان‌های من">
        <SectionTitle
          icon="🐾"
          title="دنبال‌کنندگان"
          action={petFoodCount > 0 ? <Chip tone="emerald">🥫 غذا: {faNum(petFoodCount)}</Chip> : undefined}
        />
        {pets.length === 0 ? (
          <GlassCard>
            <EmptyState emoji="🐾" text="هنوز هیچ‌کس دنبالت راه نمی‌افتد." hint="شهر پر از حیوان‌هایی است که منتظر یه تصمیم بد هستند." />
          </GlassCard>
        ) : (
          <div className="flex flex-col gap-3">
            {pets.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                busy={busyPet === pet.id}
                onFeed={async () => {
                  setBusyPet(pet.id)
                  await runAction("feedPet", { petId: pet.id })
                  setBusyPet(null)
                }}
                onPlay={async () => {
                  setBusyPet(pet.id)
                  await runAction("playPet", { petId: pet.id })
                  setBusyPet(null)
                }}
                onRename={() => {
                  setRenameValue(pet.name)
                  setRenamePet(pet)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── وسایل ── */}
      <section aria-label="وسایل">
        <SectionTitle
          icon="🎒"
          title="کیف"
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSortBy("qty")}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  sortBy === "qty" ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground",
                )}
              >
                تعداد
              </button>
              <button
                type="button"
                onClick={() => setSortBy("rarity")}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  sortBy === "rarity" ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground",
                )}
              >
                کمیابی
              </button>
            </div>
          }
        />

        <div className="relative mb-2.5">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="دنبال چی می‌گردی؟"
            className="h-11 rounded-2xl border-white/10 bg-white/[0.04] ps-9 text-sm placeholder:text-muted-foreground/60"
            aria-label="جست‌وجوی وسایل"
          />
        </div>

        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          <CatChip label="همه" activeKey={cat} cat="all" setCat={setCat} />
          {CAT_KEYS.map((k) => (
            <CatChip key={k} label={CAT_LABELS[k] ?? k} activeKey={cat} cat={k} setCat={setCat} />
          ))}
        </div>

        {inventory.length === 0 ? (
          <GlassCard>
            <EmptyState emoji="🕳" text="کیفت خالیه. فعلاً چیزی برای دزدیدن نداری." />
          </GlassCard>
        ) : filtered.length === 0 ? (
          <GlassCard>
            <EmptyState emoji="🔎" text="با این فیلترها هیچی پیدا نشد." hint="شاید توی جیب‌های دیگه باشه." />
          </GlassCard>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filtered.map((it) => (
              <motion.button
                key={it.itemKey}
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setItemKey(it.itemKey)}
                className={cn(
                  "glass relative flex aspect-square flex-col items-center justify-center gap-1 p-2 transition-colors hover:bg-white/[0.07]",
                  it.equipped && "border-primary/40",
                )}
                aria-label={`${it.name}${it.quantity > 1 ? ` — ${faNum(it.quantity)} عدد` : ""}`}
              >
                {it.quantity > 1 ? (
                  <span className="absolute top-1.5 end-1.5 rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">
                    ×{faNum(it.quantity)}
                  </span>
                ) : null}
                {it.favorite ? (
                  <span aria-hidden className="absolute top-1 start-1.5 text-[11px]">
                    ⭐
                  </span>
                ) : null}
                <span aria-hidden className={cn("text-3xl leading-none", it.quantity <= 0 && "opacity-30 grayscale")}>
                  {it.emoji}
                </span>
                <span className="w-full truncate text-center text-[11px] font-semibold leading-4">{it.name}</span>
                <span className={cn("text-[11px] leading-4", RARITY_UI[it.rarity].text)}>{it.rarityLabel}</span>
                {it.equipped ? (
                  <span className="absolute bottom-1 end-1.5 text-[11px] font-bold text-primary">✓ تنِ توست</span>
                ) : null}
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* ── شیت آیتم ── */}
      <GlassSheet
        open={entry !== null}
        onOpenChange={(v) => {
          if (!v) setItemKey(null)
        }}
        title={
          entry ? (
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-xl">
                {entry.emoji}
              </span>
              {entry.name}
            </span>
          ) : null
        }
      >
        {entry ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <RarityChip rarity={entry.rarity} label={entry.rarityLabel} />
              <Chip>{CAT_LABELS[entry.category] ?? entry.category}</Chip>
              <Chip>×{faNum(entry.quantity)}</Chip>
              {entry.effectLabel ? <Chip tone="emerald">{entry.effectLabel}</Chip> : null}
              {entry.locked ? <Chip tone="amber">🔒 قفل</Chip> : null}
            </div>

            <p className="text-xs leading-6 text-foreground/80">{entry.description}</p>

            {pricesError ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                <span>قیمت‌ها نیامد</span>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light")
                    setPricesError(false)
                    setPricesTick((t) => t + 1)
                  }}
                  className="shrink-0 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  دوباره
                </button>
              </div>
            ) : quickSell(entry.itemKey) !== null ? (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                💰 قیمت امروز بازار: {faNum(currentPrice(entry.itemKey) ?? 0)} سکه · فروش سریع می‌گیره:{" "}
                {faNum(quickSell(entry.itemKey) ?? 0)}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {entry.usable && entry.quantity > 0 ? (
                <ActionButton
                  variant="soft"
                  emoji="✨"
                  onClick={async () => {
                    const ok = await runAction("useItem", { itemKey: entry.itemKey })
                    if (ok) setItemKey(null)
                  }}
                >
                  استفاده
                </ActionButton>
              ) : null}
              {entry.category === "gear" && entry.quantity > 0 ? (
                <ActionButton
                  variant="soft"
                  emoji="🧥"
                  disabled={entry.equipped}
                  onClick={async () => {
                    const ok = await runAction("equipItem", { itemKey: entry.itemKey })
                    if (ok) setItemKey(null)
                  }}
                >
                  {entry.equipped ? "تنِ توست ✓" : "پوشیدن"}
                </ActionButton>
              ) : null}
              <ActionButton
                variant="ghost"
                emoji={entry.favorite ? "☆" : "⭐"}
                onClick={() => void runAction("favoriteItem", { itemKey: entry.itemKey })}
              >
                {entry.favorite ? "از علاقه‌مندی‌ها دربیار" : "علاقه‌مندی کن"}
              </ActionButton>
              {entry.tradable && !entry.locked && !entry.favorite && entry.quantity > 0 && quickSell(entry.itemKey) !== null ? (
                <ActionButton
                  variant="danger"
                  emoji="💰"
                  onClick={async () => {
                    const ok = await runAction("sellItem", { itemKey: entry.itemKey, quantity: 1 })
                    if (ok) setItemKey(null)
                  }}
                >
                  فروش سریع ({faNum(quickSell(entry.itemKey) ?? 0)})
                </ActionButton>
              ) : null}
            </div>

            {entry.tradable && !entry.locked && !entry.favorite && entry.quantity > 0 ? (
              <ActionButton
                variant="glass"
                emoji="🏷"
                fullWidth
                onClick={() => {
                  setListQty(1)
                  setListPrice(String(currentPrice(entry.itemKey) ?? 100))
                  setListingFor(entry.itemKey)
                }}
              >
                فروش در بازار
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </GlassSheet>

      {/* ── شیت آگهی ── */}
      <GlassSheet
        open={listingFor !== null}
        onOpenChange={(v) => {
          if (!v) setListingFor(null)
        }}
        title="🏷 آگهی بذار"
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth onClick={() => setListingFor(null)}>
              بی‌خیال
            </ActionButton>
            <ActionButton variant="primary" fullWidth loading={listing} onClick={() => void createListing()}>
              آگهی بگذار
            </ActionButton>
          </div>
        }
      >
        {listingFor && entry ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-2xl">
                {entry.emoji}
              </span>
              <div>
                <p className="text-sm font-bold">{entry.name}</p>
                <p className="text-[11px] text-muted-foreground">{faNum(entry.quantity)} عدد داری</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">چندتا بفروشی؟</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="کمتر"
                  onClick={() => setListQty((q) => Math.max(1, q - 1))}
                  className="glass flex size-11 items-center justify-center rounded-2xl active:scale-95"
                >
                  <Minus className="size-4" />
                </button>
                <span className="min-w-12 text-center text-xl font-extrabold tabular-nums">{faNum(listQty)}</span>
                <button
                  type="button"
                  aria-label="بیشتر"
                  onClick={() => setListQty((q) => Math.min(entry.quantity, q + 1))}
                  className="glass flex size-11 items-center justify-center rounded-2xl active:scale-95"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">قیمت هر عدد (سکه)</p>
              <Input
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="مثلاً 250"
                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-center text-base font-bold tabular-nums"
                aria-label="قیمت هر عدد به سکه"
              />
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                {(() => {
                  const p = Number(listPrice)
                  if (!Number.isFinite(p) || p < 1) return "قیمت معتبر بده. شهر با شوخی قیمت نمی‌خندد."
                  return `جمع آگهی: ${faNum(p * listQty)} سکه · اگه کسی بخرد، همه‌ش مالِ توئه.`
                })()}
              </p>
            </div>

            <p className="text-[11px] leading-5 text-muted-foreground">
              💡 فروش سریع 60% نرخ روز می‌گیره؛ آگهی شاید بیشتر بشه — اگه کسی ببینتش.
            </p>
          </div>
        ) : null}
      </GlassSheet>

      {/* ── شیت اسم حیوان ── */}
      <GlassSheet
        open={renamePet !== null}
        onOpenChange={(v) => {
          if (!v) setRenamePet(null)
        }}
        title={renamePet ? `✏️ اسم ${renamePet.name}` : null}
        footer={
          <div className="flex gap-2">
            <ActionButton variant="ghost" fullWidth onClick={() => setRenamePet(null)}>
              همون بمونه
            </ActionButton>
            <ActionButton variant="primary" fullWidth loading={renaming} onClick={() => void doRename()}>
              اسمش اینه
            </ActionButton>
          </div>
        }
      >
        {renamePet ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-3xl">
                {renamePet.emoji}
              </span>
              <p className="text-xs leading-6 text-muted-foreground">
                {renamePet.species} · {renamePet.personality}
              </p>
            </div>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 24))}
              placeholder="اسم جدید..."
              className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-sm"
              aria-label="اسم جدید حیوان"
            />
            <p className="text-[11px] text-muted-foreground">حداقل 2 حرف. حیوانات اسم‌های توهین‌آمیز را هم می‌پذیرند، ولی تو بی‌رحم نباش.</p>
          </div>
        ) : null}
      </GlassSheet>
    </div>
  )
}

// ─── کارت حیوان ──────────────────────────────────────────────────────────────

function PetCard(props: {
  pet: PetDTO
  busy: boolean
  onFeed: () => void
  onPlay: () => void
  onRename: () => void
}) {
  const { pet, busy, onFeed, onPlay, onRename } = props
  return (
    <GlassCard>
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-2xl">
          {pet.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-bold">{pet.name}</h3>
            <RarityChip rarity={pet.rarity} label={pet.rarityLabel} />
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {pet.species} · {pet.personality} · {pet.moodLabel}
          </p>
        </div>
      </div>

      {pet.traits.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {pet.traits.map((t, i) => (
            <Chip key={i}>{t}</Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        <MiniBar label="سیری" value={pet.hunger} barClassName={pet.hunger < 25 ? "bg-rose-400" : "bg-amber-400"} />
        <MiniBar label="انرژی" value={pet.energy} barClassName="bg-teal-400" />
        <MiniBar label="وفاداری" value={pet.loyalty} barClassName="bg-pink-400" />
      </div>

      {pet.statusNote ? (
        <p className="mt-2.5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-[11px] leading-5 text-amber-300">
          ⚠️ {pet.statusNote}
        </p>
      ) : null}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ActionButton size="sm" variant="soft" emoji="🍖" loading={busy} onClick={onFeed}>
          غذا
        </ActionButton>
        <ActionButton size="sm" variant="soft" emoji="🎾" loading={busy} onClick={onPlay}>
          بازی
        </ActionButton>
        <ActionButton size="sm" variant="glass" emoji="✏️" onClick={onRename}>
          اسم
        </ActionButton>
      </div>
    </GlassCard>
  )
}

function MiniBar({ label, value, barClassName }: { label: string; value: number; barClassName?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <ProgressBar value={value} barClassName={barClassName} label={label} className="flex-1" />
      <span className="w-6 shrink-0 text-end text-[11px] font-bold tabular-nums text-foreground/60">{faNum(value)}</span>
    </div>
  )
}

function CatChip(props: { label: string; activeKey: string; cat: string; setCat: (c: string) => void }) {
  const { label, activeKey, cat, setCat } = props
  const on = activeKey === cat
  return (
    <button
      type="button"
      onClick={() => setCat(cat)}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors",
        on ? "border-primary/30 bg-primary/10 font-bold text-primary" : "border-white/10 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  )
}
