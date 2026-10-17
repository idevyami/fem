"use client"

// کدکسِ راهنما — مرورگرِ سه‌سطحیِ راهنمای بازی در مینی‌اپ (V14 موجِ 16b).
// سطحِ ۱: دسته‌ها + جست‌وجو · سطحِ ۲: موضوع‌های دسته · سطحِ ۳: محتوای موضوعِ
// صفحه‌بندی‌شده در سمتِ سرور. همه‌ی داده‌ها از /api/game/help می‌آیند (رجیستریِ
// مرکزیِ موتور) — این‌جا فقط آینه است، نه منبعِ حقیقت. صفحه‌ها و فهرست‌های
// دیده‌شده در state کش می‌شوند تا پیمایشِ کدکس هیچ طوفانِ درخواستی نسازد.
import * as React from "react"
import { motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  api,
  type HelpCategoryDTO,
  type HelpSearchResultDTO,
  type HelpTopicPageDTO,
  type HelpTopicStubDTO,
} from "@/lib/game/client"
import { faNum } from "../../fa"
import { haptic } from "../../telegram"
import { ActionButton, Chip, EmptyState, GlassSheet } from "../../ui"
import { cn } from "@/lib/utils"

interface CodexSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** داده‌ی سطحِ ۲ — دسته + موضوع‌هایش */
interface TopicListData {
  category: { id: string; icon: string; titleFa: string; descFa: string }
  topics: HelpTopicStubDTO[]
}

type CodexLevel = "cats" | "topics" | "topic"

export function CodexSheet({ open, onOpenChange }: CodexSheetProps) {
  // ─── ناوبری ───
  const [level, setLevel] = React.useState<CodexLevel>("cats")
  const [catId, setCatId] = React.useState<string | null>(null)
  const [topicId, setTopicId] = React.useState<string | null>(null)
  const [topicPageWanted, setTopicPageWanted] = React.useState(0)

  // ─── داده‌ها + کش (ref) — تا هر برگه فقط یک بار از سرور بخواهیم ───
  const [cats, setCats] = React.useState<HelpCategoryDTO[] | null>(null)
  const [catList, setCatList] = React.useState<TopicListData | null>(null)
  const [topicData, setTopicData] = React.useState<HelpTopicPageDTO | null>(null)
  const catsRef = React.useRef<HelpCategoryDTO[] | null>(null)
  const topicsCache = React.useRef<Record<string, TopicListData>>({})
  const pagesCache = React.useRef<Record<string, HelpTopicPageDTO>>({})
  /** شمارنده‌ی ناوبری — جوابِ واکشیِ کهنه دور انداخته می‌شود */
  const navSeq = React.useRef(0)

  // ─── حالتِ بارگذاری/خطا (تک-باره؛ کلید = کجای کدکس) ───
  const [busy, setBusy] = React.useState<"cats" | "topics" | "topic" | null>(null)
  const [error, setError] = React.useState<{ where: "cats" | "topics" | "topic"; msg: string } | null>(null)

  // ─── جست‌وجو (با تأخیرِ 300ms) ───
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<HelpSearchResultDTO[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const searchSeq = React.useRef(0)

  // ─── دسته‌ها — یک بار در هر باز شدن ───
  const fetchCats = React.useCallback(async (force = false) => {
    if (!force && catsRef.current) return
    setBusy("cats")
    setError(null)
    const res = await api.helpCategories()
    if (res.ok) {
      catsRef.current = res.data.categories
      setCats(res.data.categories)
      setBusy(null)
    } else {
      setBusy(null)
      setError({ where: "cats", msg: res.error })
    }
  }, [])

  React.useEffect(() => {
    if (!open) {
      // جست‌وجو برای جلسه‌ی بعد پاک می‌شود؛ سطح و کش‌ها می‌مانند (پیمایشِ سریع)
      setQuery("")
      setResults(null)
      setSearching(false)
      searchSeq.current++
      return
    }
    if (!catsRef.current) void fetchCats()
  }, [open, fetchCats])

  // ─── سطحِ ۲: موضوع‌های یک دسته ───
  async function openCategory(id: string, force = false) {
    haptic("light")
    const seq = ++navSeq.current
    setLevel("topics")
    setCatId(id)
    setError(null)
    if (!force) {
      const cached = topicsCache.current[id]
      if (cached) {
        setCatList(cached)
        return
      }
    }
    setCatList(null)
    setBusy("topics")
    const res = await api.helpTopics(id)
    if (seq !== navSeq.current) return
    setBusy(null)
    if (res.ok) {
      topicsCache.current[id] = res.data
      setCatList(res.data)
    } else {
      setError({ where: "topics", msg: res.error })
    }
  }

  // ─── سطحِ ۳: صفحه‌ی یک موضوع ───
  async function openTopic(id: string, page = 0, force = false) {
    haptic("light")
    const seq = ++navSeq.current
    setLevel("topic")
    setTopicId(id)
    setTopicPageWanted(page)
    setError(null)
    const key = `${id}:${page}`
    if (!force) {
      const cached = pagesCache.current[key]
      if (cached) {
        setTopicData(cached)
        return
      }
    }
    setTopicData(null)
    setBusy("topic")
    const res = await api.helpTopic(id, page)
    if (seq !== navSeq.current) return
    setBusy(null)
    if (res.ok) {
      pagesCache.current[key] = res.data
      setTopicData(res.data)
    } else {
      setError({ where: "topic", msg: res.error })
    }
  }

  // ─── جست‌وجوی کدکس — 300ms تأخیر، جوابِ کهنه دور ───
  React.useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setSearching(false)
      searchSeq.current++
      return
    }
    setSearching(true)
    const seq = ++searchSeq.current
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await api.helpSearch(q)
        if (seq !== searchSeq.current) return
        setSearching(false)
        setResults(res.ok ? res.data.results : [])
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [query, open])

  // ─── بازگشت: موضوع → فهرستِ دسته‌اش · دسته → خانه‌ی کدکس ───
  function goBack() {
    haptic("light")
    if (level === "topic") {
      const cat = topicData?.topic.cat
      if (cat) {
        void openCategory(cat)
        return
      }
      setLevel("cats")
      return
    }
    if (level === "topics") setLevel("cats")
  }

  // ─── عنوانِ سطحِ فعلی ───
  const levelTitle =
    level === "topics" && catList
      ? `${catList.category.icon} ${catList.category.titleFa}`
      : level === "topic" && topicData
        ? `${topicData.topic.icon} ${topicData.topic.titleFa}`
        : "📚 کدکسِ راهنما"

  return (
    <GlassSheet
      open={open}
      onOpenChange={onOpenChange}
      title={levelTitle}
      leading={level !== "cats" ? <BackButton onClick={goBack} /> : undefined}
      footer={
        level === "topic" && topicData ? (
          <div className="flex items-center gap-2">
            <ActionButton
              variant="soft"
              size="sm"
              className="h-11 flex-1"
              disabled={topicData.page <= 0}
              onClick={() => void openTopic(topicData.topic.id, topicData.page - 1)}
            >
              قبلی
            </ActionButton>
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tabular-nums" aria-live="polite">
              صفحه‌ی {faNum(topicData.page + 1)} از {faNum(topicData.pageCount)}
            </span>
            <ActionButton
              variant="soft"
              size="sm"
              className="h-11 flex-1"
              disabled={topicData.page >= topicData.pageCount - 1}
              onClick={() => void openTopic(topicData.topic.id, topicData.page + 1)}
            >
              ادامه
            </ActionButton>
          </div>
        ) : (
          <ActionButton variant="ghost" fullWidth onClick={() => onOpenChange(false)}>
            بستن
          </ActionButton>
        )
      }
    >
      {level === "cats" ? (
        <CatsLevel
          cats={cats}
          busy={busy === "cats"}
          error={error?.where === "cats" ? error.msg : null}
          query={query}
          onQuery={setQuery}
          searching={searching}
          results={results}
          onRetry={() => void fetchCats(true)}
          onOpenCategory={(id) => void openCategory(id)}
          onOpenTopic={(id) => void openTopic(id, 0)}
        />
      ) : null}
      {level === "topics" ? (
        <TopicsLevel
          data={catList}
          busy={busy === "topics"}
          error={error?.where === "topics" ? error.msg : null}
          onRetry={() => void openCategory(catId ?? "", true)}
          onOpenTopic={(id) => void openTopic(id, 0)}
        />
      ) : null}
      {level === "topic" ? (
        <TopicLevel
          data={topicData}
          busy={busy === "topic"}
          error={error?.where === "topic" ? error.msg : null}
          onRetry={() => void openTopic(topicId ?? "", topicPageWanted, true)}
          onJump={(id) => void openTopic(id, 0)}
        />
      ) : null}
    </GlassSheet>
  )
}

// ─── دکمه‌ی بازگشت (سمتِ راستِ عنوان — در RTL فلشِ راست یعنی عقب) ─────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="بازگشت"
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-foreground/80 transition-colors hover:text-primary active:scale-95"
    >
      <ChevronRight className="size-5" aria-hidden />
    </button>
  )
}

// ─── سطحِ ۱: دسته‌ها + جست‌وجو ─────────────────────────────────────────────────

function CatsLevel({
  cats,
  busy,
  error,
  query,
  onQuery,
  searching,
  results,
  onRetry,
  onOpenCategory,
  onOpenTopic,
}: {
  cats: HelpCategoryDTO[] | null
  busy: boolean
  error: string | null
  query: string
  onQuery: (q: string) => void
  searching: boolean
  results: HelpSearchResultDTO[] | null
  onRetry: () => void
  onOpenCategory: (id: string) => void
  onOpenTopic: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div>
        <label htmlFor="codex-search" className="sr-only">
          جست‌وجو در کدکس
        </label>
        <Input
          id="codex-search"
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="جست‌وجو در کدکس… مثلاً «دوئل»"
          className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-xs"
          autoComplete="off"
        />
      </div>

      {/* در حالِ جست‌وجو */}
      {searching ? (
        <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground" aria-live="polite">
          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          داریم در برگه‌های کدکس می‌گردیم…
        </p>
      ) : null}

      {/* نتایجِ جست‌وجو — تا وقتی پرس‌وجو پاک نشود، جای grid را می‌گیرند */}
      {results !== null ? (
        <div role="region" aria-label="نتایجِ جست‌وجو" className="flex flex-col gap-2">
          {results.length === 0 ? (
            <p className="py-2 text-center text-xs leading-6 text-muted-foreground">
              چیزی پیدا نشد — با کلمه‌ی دیگری امتحان کن. کدکس بزرگ است.
            </p>
          ) : (
            results.map((r, i) => (
              <motion.button
                key={r.id}
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.05, ease: "easeOut" }}
                onClick={() => onOpenTopic(r.id)}
                className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.05] px-3 text-start transition-all duration-150 hover:bg-primary/[0.09] active:scale-[0.98]"
              >
                <span aria-hidden className="shrink-0 text-lg leading-6">
                  {r.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold leading-5">{r.titleFa}</span>
                  <span className="block truncate text-[11px] leading-4 text-muted-foreground">{r.summaryFa}</span>
                </span>
              </motion.button>
            ))
          )}
          <ActionButton variant="ghost" size="sm" className="h-11" onClick={() => onQuery("")}>
            بازگشت به دسته‌ها
          </ActionButton>
        </div>
      ) : null}

      {/* خطا */}
      {error ? (
        <EmptyState
          emoji="🫥"
          text="کدکس پشتِ مه گم شد."
          hint={error}
          action={
            <ActionButton variant="soft" size="sm" onClick={onRetry}>
              دوباره
            </ActionButton>
          }
        />
      ) : null}

      {/* اسکلتون */}
      {busy && !cats ? <CodexSkeleton rows={4} /> : null}

      {/* شبکه‌ی دسته‌ها */}
      {cats && results === null ? (
        <div>
          <p className="mb-2.5 text-[11px] leading-5 text-muted-foreground">
            هر دسته یک راهنمایِ واقعی است — عددها از خودِ بازی، نه شایعه.
          </p>
          <div role="list" aria-label="دسته‌های کدکس" className="grid grid-cols-2 gap-2">
            {cats.map((c, i) => (
              <motion.div
                key={c.id}
                role="listitem"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => onOpenCategory(c.id)}
                  aria-label={`${c.titleFa} — ${faNum(c.topicCount)} موضوع`}
                  className="flex h-full w-full flex-col items-start gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-start transition-all duration-150 hover:border-primary/25 hover:bg-white/[0.06] active:scale-[0.98]"
                >
                  <span aria-hidden className="text-2xl leading-8">
                    {c.icon}
                  </span>
                  <span className="text-[13px] font-bold leading-5">{c.titleFa}</span>
                  <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{c.descFa}</span>
                  <Chip tone="pink" className="mt-1 tabular-nums">
                    {faNum(c.topicCount)} موضوع
                  </Chip>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── سطحِ ۲: موضوع‌های یک دسته ────────────────────────────────────────────────

function TopicsLevel({
  data,
  busy,
  error,
  onRetry,
  onOpenTopic,
}: {
  data: TopicListData | null
  busy: boolean
  error: string | null
  onRetry: () => void
  onOpenTopic: (id: string) => void
}) {
  if (error) {
    return (
      <EmptyState
        emoji="🫥"
        text="این قفسه‌ی کتاب‌خانه خالی موند."
        hint={error}
        action={
          <ActionButton variant="soft" size="sm" onClick={onRetry}>
            دوباره
          </ActionButton>
        }
      />
    )
  }
  if (busy && !data) return <CodexSkeleton rows={5} />
  if (!data) return null
  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <p className="text-[11px] leading-5 text-muted-foreground">{data.category.descFa}</p>
      <ul className="flex flex-col gap-2" aria-label="موضوع‌های این دسته">
        {data.topics.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.04, ease: "easeOut" }}
          >
            <button
              type="button"
              onClick={() => onOpenTopic(t.id)}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-start transition-all duration-150 hover:border-primary/25 hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <span aria-hidden className="shrink-0 text-lg leading-6">
                {t.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold leading-5">{t.titleFa}</span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">{t.summaryFa}</span>
              </span>
            </button>
          </motion.li>
        ))}
      </ul>
      <p className="text-[11px] leading-4 text-muted-foreground/70 tabular-nums">
        {faNum(data.topics.length)} موضوع در این دسته
      </p>
    </div>
  )
}

// ─── سطحِ ۳: محتوای موضوع — بلوک‌ها/عبارت‌ها/مثال‌ها/مرتبط‌ها ────────────────

function TopicLevel({
  data,
  busy,
  error,
  onRetry,
  onJump,
}: {
  data: HelpTopicPageDTO | null
  busy: boolean
  error: string | null
  onRetry: () => void
  onJump: (id: string) => void
}) {
  if (error) {
    return (
      <EmptyState
        emoji="🫥"
        text="این برگه از کدکس پیدا نشد."
        hint={error}
        action={
          <ActionButton variant="soft" size="sm" onClick={onRetry}>
            دوباره
          </ActionButton>
        }
      />
    )
  }
  if (busy && !data) return <CodexSkeleton rows={4} />
  if (!data) return null
  const t = data.topic
  const last = data.page >= data.pageCount - 1
  return (
    <article className="flex flex-col gap-3.5 pt-1" aria-label={`موضوعِ ${t.titleFa}`}>
      {data.page === 0 ? <p className="text-xs italic leading-6 text-muted-foreground">{t.summaryFa}</p> : null}

      {/* بلوک‌های متن */}
      {data.blocks.map((b, i) => (
        <section key={i} className="flex flex-col gap-1.5">
          {b.h ? <h3 className="text-sm font-bold leading-6 text-foreground/90">{b.h}</h3> : null}
          {b.lines.map((l, j) => (
            <p key={j} className="text-xs leading-6 text-foreground/85">
              {l}
            </p>
          ))}
        </section>
      ))}

      {/* عبارت‌های پشتیبانی‌شده — همان چیپِ مونوی کارت‌های شهر (فقط صفحه‌ی آخر) */}
      {last && t.phrases.length > 0 ? (
        <section
          className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          aria-label="عبارت‌های پشتیبانی‌شده"
        >
          <h3 className="text-[11px] font-bold leading-4 text-muted-foreground">عبارت‌هایی که بازی می‌فهمد</h3>
          <ul className="flex flex-col gap-1.5">
            {t.phrases.map((p, i) => (
              <li key={i} className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg border border-primary/20 bg-primary/[0.07] px-2 py-1 font-mono text-[11px] leading-4 text-primary">
                  «{p.fa}»{p.en ? ` · ${p.en}` : ""}
                </span>
                <span className="text-[10px] leading-4 text-muted-foreground">
                  {p.where === "private" ? "خصوصی" : p.where === "group" ? "گروه" : "خصوصی و گروه"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* مثال‌ها — نقل‌قولِ مستقیم */}
      {last && t.examples.length > 0 ? (
        <section className="flex flex-col gap-1.5" aria-label="مثال‌ها">
          <h3 className="text-[11px] font-bold leading-4 text-muted-foreground">مثال</h3>
          <ul className="flex flex-col gap-1">
            {t.examples.map((e, i) => (
              <li key={i} className="border-e-2 border-primary/30 pe-2 text-xs italic leading-6 text-foreground/80">
                «{e}»
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* موضوع‌های مرتبط — چیپِ پرش */}
      {last && t.related.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="موضوع‌های مرتبط">
          <h3 className="text-[11px] font-bold leading-4 text-muted-foreground">ادامه‌ی خواندن</h3>
          <div className="flex flex-wrap gap-1.5">
            {t.related.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onJump(r.id)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/[0.07] px-3.5 text-[11px] font-semibold leading-5 text-primary transition-all duration-150 hover:bg-primary/[0.12] active:scale-[0.97]"
              >
                <span aria-hidden>{r.icon}</span>
                {r.titleFa}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}

// ─── اسکلتون ─────────────────────────────────────────────────────────────────

function CodexSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="در حال آوردنِ کدکس">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={cn("h-14 rounded-2xl bg-white/[0.05]", i % 3 === 2 && "h-10")} />
      ))}
    </div>
  )
}
