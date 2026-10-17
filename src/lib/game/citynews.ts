// FEMBOY WAR V4 — اخبارِ شهر: بدون بازیکن، برای گروه‌ها و ربات.
import { db } from "@/lib/db"
import { NPCS, TITLE_MAP, getGlobalEvent } from "./content"
import { getWorld, worldTick, getFeed } from "./world"
import { WEATHER_LABEL, MOOD_LABEL, faNum } from "./helpers"
import { seedFrom, mulberry32 } from "./rng"
import type { CityNewsResponse } from "./contract"

const RUMOR_MAX = 110

// ─── سرِخاله‌ها (شایعاتِ بی‌منبع) ─────────────────────────────────────────────

const RED_HERRINGS: string[] = [
  "می‌گویند گربه‌ای در منطقه‌ی ممنوعه ساعت‌هاست حرف می‌زند. با لهجه‌ی محلی.",
  "کسی ساعتِ بزرگِ میدان را سه دقیقه جلو برده. یا شاید همیشه این‌طور بوده.",
  "پلاکِ روی درِ مغازه‌ی عمو قنبر عوض شده. هیچ‌کس یادش نیست قبلاً چه نوشته بود.",
  "شب‌ها از پارک صدای کوهورِ فواره می‌آید. پارک کوهور ندارد.",
  "یکی از نورهای منطقه‌ی لوکس چشمک می‌زند. فقط وقتی کسی نگاه نمی‌کند.",
  "آسانسورِ برجِ قدیمی به طبقه‌ی منفی یک می‌رود. ساختمان طبقه‌ی منفی ندارد.",
  "گل‌های پارک دیروز رو به شمال بودند. امروز نه. باغبان استخدام نشده.",
  "صندوق‌های منطقه‌ی صنعتی شب‌ها سبک‌ترند. نگهبان‌ها کوتاه‌تر از سکوتشان حرف می‌زنند.",
]

// ─── ساختِ شایعه از رازِ واقعیِ NPC (کمی رومالی) ────────────────────────────

function disguiseSecret(npcName: string, secret: string): string {
  return `حرف‌هایی هست که می‌گویند ${npcName} ${secret}. کسی جرئتِ پرسیدن ندارد.`
}

function worldFacts(chaos: number, economy: number): string[] {
  const facts: string[] = []
  if (chaos >= 45)
    facts.push(`آشوبِ شهر ${faNum(chaos)} از ${faNum(100)} است. کوچه‌های خلوت را جدی بگیر.`)
  else if (chaos <= 15)
    facts.push(`شهر این روزها آرام است — آشوب فقط ${faNum(chaos)}. آرامِ این شهر همیشه یعنی چیزی.`)
  else facts.push(`آشوبِ شهر وسطِ راه است: ${faNum(chaos)} از ${faNum(100)}. نه خبر، نه آرامش.`)

  if (economy >= 120) facts.push(`شاخصِ بازار ${faNum(economy)} است. مغازه‌دارها بی‌دلیل لبخند می‌زنند.`)
  else if (economy <= 85) facts.push(`شاخصِ بازار به ${faNum(economy)} رسیده. دایی فرهاد «فرصت» می‌گوید.`)
  else facts.push(`شاخصِ بازار ${faNum(economy)} است. مثلِ حرف‌های مردم: نه بالا، نه پایین.`)
  return facts
}

// ─── خبرنامه‌ی شهر ────────────────────────────────────────────────────────────

export async function buildCityNews(): Promise<CityNewsResponse> {
  const world = await worldTick()
  const w = await getWorld()

  const [feed, players, population] = await Promise.all([
    getFeed(6),
    db.player.findMany({
      where: { onboarded: true },
      select: {
        id: true,
        name: true,
        avatar: true,
        level: true,
        money: true,
        fame: true,
        chaos: true,
        debt: true,
        day: true,
        titles: { where: { active: true }, select: { titleKey: true } },
        pets: { select: { speciesKey: true } },
        achievements: { select: { achievementKey: true } },
      },
      take: 50,
    }),
    db.player.count(),
  ])

  // ── برترین‌ها (همان منطقِ لیدربورد)
  const topPlayers = players
    .sort((a, b) => b.level * 1000 + b.money + b.fame * 50 - (a.level * 1000 + a.money + a.fame * 50))
    .slice(0, 5)
    .map((p) => {
      const titleDef = p.titles[0] ? TITLE_MAP[p.titles[0].titleKey] : null
      const highlight = titleDef
        ? `${titleDef.emoji} ${titleDef.name}`
        : p.pets.length >= 2
          ? `${faNum(p.pets.length)} حیوان دارد`
          : p.debt > 5000
            ? "غرق در بدهی دایی فرهاد"
            : p.chaos > 45
              ? "آشوب با اسمش صدا می‌زند"
              : p.achievements.length >= 5
                ? `${faNum(p.achievements.length)} دستاورد`
                : `روز ${faNum(p.day)} در شهر`
      return { name: p.name, avatar: p.avatar, level: p.level, highlight }
    })

  // ── شایعات: چرخشِ روزانه‌ی seed-دار (1 رازِ واقعی + 1 واقعیتِ جهان + 1 سرِخاله)
  const rng = mulberry32(seedFrom("citynews", w.dayCount))
  const hints = NPCS.filter((n) => n.secret)
  const facts = worldFacts(w.chaosLevel, w.economyIndex)
  const rumors: string[] = []
  if (hints.length > 0) {
    const hint = hints[Math.floor(rng() * hints.length)]
    if (hint?.secret) rumors.push(disguiseSecret(hint.name, hint.secret))
  }
  if (facts.length > 0) rumors.push(facts[Math.floor(rng() * facts.length)] as string)
  const herring = RED_HERRINGS[(w.dayCount * 3 + Math.floor(rng() * 3)) % RED_HERRINGS.length]
  if (herring) rumors.push(herring)

  const globalDef = w.activeGlobalEvent ? getGlobalEvent(w.activeGlobalEvent) : null

  return {
    dayCount: w.dayCount,
    weatherLabel: WEATHER_LABEL[w.weather]?.label ?? w.weather,
    weatherEmoji: WEATHER_LABEL[w.weather]?.emoji ?? "🌤",
    moodLabel: MOOD_LABEL[w.mood] ?? w.mood,
    chaosLevel: w.chaosLevel,
    economyIndex: w.economyIndex,
    globalEvent: globalDef
      ? {
          name: globalDef.name,
          emoji: globalDef.emoji,
          description: globalDef.description,
          endsInMinutes: w.globalEventEndsAt
            ? Math.max(0, Math.ceil((w.globalEventEndsAt.getTime() - Date.now()) / 60000))
            : 0,
        }
      : null,
    headlines: feed.map((f) => ({ icon: f.icon, text: f.text, at: f.createdAt.toISOString() })),
    rumors: rumors.map((r) => (r.length > RUMOR_MAX ? `${r.slice(0, RUMOR_MAX - 1)}…` : r)),
    topPlayers,
    population,
  }
}
