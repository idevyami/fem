// FEMBOY WAR 🎀 — V14 (Task 15b): دسته‌ی «عبارت‌های طبیعی» — موضوع‌های تولیدشده.
// جدولِ عبارت‌ها (phrase-table.generated.json) از scripts/export-help.ts می‌آید که
// نام‌های مستعار را مستقیم از mini-services/bot/src/intent.ts می‌کشد — پس این
// موضوع‌ها هرگز ازresolverِ واقعی جدا نمی‌افتند. عبارتی که این‌جا هست، پشتیبانی
// شده؛ عبارتی که پشتیبانی شده است این‌جا هست (اعتبارسنجی در همان اسکریپت).

import phraseTableJson from "../phrase-table.generated.json"
import type { HelpTopic, HelpCategory, HelpPhrase } from "../types"
import { INTENT_SUMMARIES } from "../phrases"

export interface PhraseTableRow {
  id: string
  faSummary: string
  expectFa: string
  where: "private" | "group" | "both"
  open: boolean
  aliasesFa: string[]
  aliasesEn: string[]
}

interface PhraseTableFile {
  generatedAt: string
  intents: PhraseTableRow[]
}

const phraseTable = phraseTableJson as PhraseTableFile

const INTENT_ICONS: Record<string, string> = {
  menu: "🃏", start: "🚀", help: "📚", guide: "🧭", femboy: "🎀", myfemboy: "🪞",
  profile: "👤", city: "🏙", status: "📊", events: "🎲", players: "👥",
  leaderboard: "🏅", inventory: "🎒", work: "💼", rest: "😴", champ: "🏆",
  news: "📰", games: "🎲", cancel: "✖️", back: "↩️", duel: "⚔️", goals: "🎯",
  ops: "⚡", dreams: "✨", market: "🏪", jobs: "🧰", debt: "⛓", titles: "🏷",
  notify: "🔔", bingo: "🎰", vote: "🗳", court: "⚖️", projects: "🏗",
  history: "📜", gadmin: "⚙️",
}

const WHERE_FA: Record<string, string> = {
  private: "فقط در خصوصیِ ربات (در گروه به خصوصی دعوت می‌شوی)",
  group: "در گروه",
  both: "هم در خصوصی، هم در گروه",
}

function phraseTopic(row: PhraseTableRow): HelpTopic {
  const icon = INTENT_ICONS[row.id] ?? "💬"
  const phrases: HelpPhrase[] = [
    ...row.aliasesFa.map((fa) => ({ fa, where: row.where }) as HelpPhrase),
    ...row.aliasesEn.filter((en) => en && /[a-z]/i.test(en)).map((en) => ({ fa: row.aliasesFa[0] ?? en, en, where: row.where }) as HelpPhrase),
  ]
  return {
    id: `phrase-${row.id}`,
    cat: "phrases",
    icon,
    titleFa: `«${row.aliasesFa[0] ?? row.id}»`,
    titleEn: row.id,
    summaryFa: row.faSummary,
    keywords: [row.id, ...row.aliasesEn, ...row.aliasesFa],
    blocks: [
      {
        h: "چه می‌کند",
        lines: [row.faSummary, `بعدش: ${row.expectFa}`],
      },
      {
        h: "عبارت‌های پذیرفته‌شده",
        lines: [
          `فارسی: ${row.aliasesFa.map((a) => `«${a}»`).join(" · ")}`,
          row.aliasesEn.length > 0 ? `انگلیسی: ${row.aliasesEn.map((a) => `«${a}»`).join(" · ")}` : "انگلیسی: —",
        ],
      },
      {
        h: "کجا کار می‌کند",
        lines: [
          WHERE_FA[row.where] ?? row.where,
          row.where !== "private" && !row.open
            ? "در گروه فقط با آدرس‌دادنِ ربات (منشن یا reply) جواب می‌گیرد."
            : row.where !== "private" && row.open
              ? "در گروه بدونِ آدرس‌دادن هم جواب می‌گیرد."
              : "",
        ].filter((l) => l !== ""),
      },
    ],
    related: ["phrase-menu", "faq-what-next"],
  }
}

/** موضوع‌های عبارت‌ها — به‌ازایِ هر نیتِ 36گانه‌ی ربات */
export function buildPhraseTopics(): HelpTopic[] {
  return phraseTable.intents.map(phraseTopic)
}

export const PHRASES_CATEGORY: HelpCategory = {
  id: "phrases",
  icon: "💬",
  titleFa: "زبانِ طبیعی و عبارت‌های قابلِ استفاده",
  titleEn: "Natural Language & Phrases",
  descFa: "همه‌ی 36 کارِ ربات با عبارت‌های دقیقِ فارسی و انگلیسی — تولیدشده از resolverِ واقعی.",
  topics: phraseTable.intents.map((r) => `phrase-${r.id}`),
}
