// FEMBOY WAR 🎀 — Bot API client.
// تمام منطق بازی در موتور Next.js (پورت 3000) زندگی می‌کند؛
// این فایل فقط یک کلاینت تایپ‌دار است. هیچ منطقی اینجا نیست.
//
// V6: همه‌ی فراخوانی‌ها سقفِ زمانی دارند (AbortSignal.timeout) — دیگر هیچ
// fetch بی‌پایانی نمی‌تواند هندلر یا تیکِ outbox را گیر بیندازد.
//
// V10: فمبویِ عمیق — کلاس-تسلط، درختِ مهارتِ سه‌شاخه، فرگشتِ دو‌شاخه‌ای،
// کیهاناتِ ظاهر و ۹ تعامل. میدان‌هایِ تازه اختیاری‌اند (?:) تا ربات با
// موتورِ نسخه‌ی قدیمی‌تر هم بی‌خطا رندر شود.

import { note, stats } from "./stats"

// ─── V13.6 — مغزِ واحد: مسیرِ دوتاییِ موتور ───────────────────────────────
// ربات و Mini App باید رویِ یک دیتابیس بنشینند. Mini App رویِ دیپلویِ عمومی
// زندگی می‌کند (r1bdq…-d.space-z.ai)؛ پس PRIMARY همانِ URL عمومی است تا هر دو
// سطح همان جهان را ببینند. FALLBACK موتورِ محلیِ سندباکس است — وقتی دیپلوی
// خواب/خراب است ربات به آن می‌رود تا بازی نمیرد، و با اولین سلامتِ دیپلوی
// (probe هر ۲۰ ثانیه) خودش برمی‌گردد. sticky + anti-flap: تعویض حداکثر هر ۳۰s.
export const API_PRIMARY = process.env.API_BASE || "http://localhost:3000"
export const API_FALLBACK =
  process.env.API_FALLBACK || (API_PRIMARY === "http://localhost:3000" ? "" : "http://localhost:3000")
/** نامِ قدیمی — همان PRIMARY؛ فقط برای لاگ‌های بوت (active را با apiBase() بگیر) */
export const API_BASE = API_PRIMARY
export const SERVICE_KEY = process.env.SERVICE_KEY || "femboy-war-service-dev"

let activeBase = API_PRIMARY
let lastSwitch = 0

/** بیسِ فعالِ لحظه‌ای — همه‌ی فراخوانی‌ها از این‌جا می‌روند */
export function apiBase(): string {
  return activeBase
}

/** وضعیتِ مسیر برای لاگ/سلامت */
export function engineRoutes(): { active: string; primary: string; fallback: string } {
  return { active: activeBase, primary: API_PRIMARY, fallback: API_FALLBACK || "-" }
}

async function probeBase(url: string, timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return false
    const j = (await res.json()) as { data?: { ok?: boolean } }
    return j.data?.ok === true
  } catch {
    return false
  }
}

/**
 * انتخابِ دوباره‌ی بیسِ فعال: اول PRIMARY، بعد FALLBACK. sticky — اگر PRIMARY
 * سالم باشد برمی‌گردیم (مغزِ واحد)، وگرنه تا سالم شدنش رویِ FALLBACK می‌مانیم.
 * force=true برای failoverِ وسطِ request (cooldown نادیده گرفته می‌شود).
 * خروجی: بیسِ فعالِ جدید، یا null اگر هیچ‌کدام جواب ندادند.
 */
export async function reselectBase(reason: string, force = false): Promise<string | null> {
  const now = Date.now()
  if (!force && now - lastSwitch < 30_000) return activeBase
  if (await probeBase(API_PRIMARY)) {
    if (activeBase !== API_PRIMARY) {
      activeBase = API_PRIMARY
      lastSwitch = now
      note(`api→primary (${reason})`)
    }
    return activeBase
  }
  if (API_FALLBACK && (await probeBase(API_FALLBACK))) {
    if (activeBase !== API_FALLBACK) {
      activeBase = API_FALLBACK
      lastSwitch = now
      note(`api→fallback (${reason})`)
    }
    return activeBase
  }
  return null
}

/** fetch با failoverِ خودکار: خطایِ شبکه یا 5xx → تعویضِ بیس و یک رتری */
async function engineFetch(path: string, init: RequestInit): Promise<Response> {
  const first = activeBase
  let res: Response
  try {
    res = await fetch(`${first}${path}`, init)
  } catch (err) {
    const alt = await reselectBase(`net:${first === API_PRIMARY ? "primary" : "local"}`, true)
    if (alt && alt !== first) {
      return await fetch(`${alt}${path}`, init) // اگر این هم انداخت، caller خودش هندل می‌کند
    }
    throw err
  }
  if (res.status >= 500) {
    const alt = await reselectBase(`http${res.status}`, true)
    if (alt && alt !== first) {
      try {
        return await fetch(`${alt}${path}`, init)
      } catch {
        /* جوابِ 500ِ اولی بهتر از هیچی است — همان برمی‌گردد */
      }
    }
  }
  return res
}

/** سقفِ زمانیِ فراخوانی‌های بازی — ۱۲ ثانیه */
const ENGINE_TIMEOUT_MS = 12_000
/** پیامِ فارسیِ مخصوصِ وقتی که موتور دیر جواب می‌دهد */
const ENGINE_TIMEOUT_ERROR = "شهر دیر جواب می‌دهد. کمی بعد دوباره امتحان کن."

// ─── DTO ها (نسخه‌ی محلی قرارداد مشترک با Mini App) ─────────────────────────

export type Tone = "good" | "bad" | "neutral"

export interface DeltaLine {
  icon: string
  label: string
  amount: number
  tone: Tone
}

export interface JobDTO {
  key: string
  name: string
  emoji: string
}

export interface VehicleDTO {
  key: string
  name: string
  emoji: string
}

export interface HouseDTO {
  key: string
  name: string
  emoji: string
}

export interface PlayerDTO {
  id: string
  name: string
  /** V16-3 — آواتارِ بازیکن (مینی‌اپ/تنظیماتِ حساب)؛ موتورهای قدیمی نمی‌فرستند */
  avatar?: string
  level: number
  day: number
  /** V17-W2 — پیشرفتِ سطح (آینه‌ی PlayerDTO موتور؛ برای نوارِ «تا سطحِ بعد» در پروفایل) */
  xp?: number
  xpToNext?: number
  /** V17-W3 (W3-F4) — پیوستگیِ شیفت‌های موفق (پاداشِ تا +۳۰٪ دستمزد) — آینه‌یِ
   *  PlayerDTO موتور؛ موتورهای قدیمی نمی‌فرستند (اختیاری) */
  workStreak?: number
  money: number
  debt: number
  energy: number
  chaos: number
  fame: number
  district: string
  districtName: string
  districtEmoji: string
  job: JobDTO | null
  vehicle: VehicleDTO | null
  house: HouseDTO | null
  /** عنوانِ فعال (کلید) — null یعنی بدون عنوان */
  activeTitle: string | null
  /** V6 — عنوان‌های مالکیت‌شده (برای /titles) */
  titles: { key: string; name: string; emoji: string; description: string }[]
  /** V6 — افتخارات (نمایش در پروفایل/عنوان‌ها) · V16-4 — unlockedAt (اختیاری/
   *  افزایشی): مرتب‌سازیِ «آخرینِ دستاوردها»؛ موتورهای قدیمی نمی‌فرستند */
  achievements: { key: string; name: string; emoji: string; description: string; unlockedAt?: string }[]
  /** V4 — نشان جایگاه (اختیاری؛ موتورِ قدیمی نمی‌فرستد) */
  stageBadge?: { key: string; name: string; emoji: string } | null
}

export interface WorldDTO {
  dayCount: number
  weatherLabel: string
  weatherEmoji: string
  chaosLevel: number
  globalEvent: { name: string; emoji: string } | null
}

export interface ChoiceDTO {
  label: string
  hint: string | null
  locked: boolean
  lockedReason: string | null
}

export interface ActiveEventDTO {
  id: string
  key: string
  title: string
  emoji: string
  categoryLabel: string
  rarityLabel: string
  text: string
  isChainStep: boolean
  chainStep: number
  choices: ChoiceDTO[]
}

// ─── V9 — هویتِ مرکزیِ فمبوی (آینه‌ی محلیِ موتور؛ contract.ts) ────────────────

/** خلاصه‌ی سبکِ فمبوی — در هر GameSnapshot (پیشخوانِ ربات، راهنما، هر اکشن).
 *  null یعنی بازیکن هنوز پیمانِ فمبوی را نبسته است. */
export interface FemboySummaryDTO {
  name: string
  classKey: string
  classEmoji: string
  className: string
  evolutionName: string
  evolutionEmoji: string
  level: number
  rank: { key: string; emoji: string; name: string }
  spirit: number
  spiritPct: number
  condition: { label: string; emoji: string; dmgMod: number; canFight: boolean }
  stamina: number
  staminaMax: number
  skillPoints: number
  wins: number
  losses: number
  // ── V10: هویتِ عمیقِ فمبوی (اختیاری — موتورِ V10 همیشه می‌فرستد) ──
  /** کلاس-تسلط (خلاصه) */
  mastery?: { level: number; emoji: string; label: string; xp: number; nextTierXp: number | null }
  /** ایموجیِ اکسسوارِ پوشیده (null = بی‌اکسسوار) */
  accessoryEmoji?: string | null
  /** نامِ مسیرِ فرگشتیِ انتخاب‌شده (null = هنوز شاخه‌ای انتخاب نشده) */
  evolutionPathName?: string | null
  /** نزدیک‌ترین سنگِ میلِ فمبوی (روایتِ فارسی از موتور) */
  nextMilestone?: string
}

/** XPِ اعطاشده به فمبوی از یک تجربه‌ی شهری (اتفاق/کار) — همراهِ OutcomeDTO */
export interface FemboyXpDTO {
  name: string
  trackKey: string
  trackLabel: string
  trackIcon: string
  amount: number
  levelUps: string[] // شماره‌ی سطح‌های تازه (فارسی‌سازی در نمایش)
}

export interface OutcomeDTO {
  text: string
  deltas: DeltaLine[]
  grantedItems: { name: string; emoji: string; rarityLabel: string }[]
  grantedPet: { name: string; emoji: string; rarityLabel: string } | null
  grantedTitles: string[]
  grantedAchievements: string[]
  npcNotes: string[]
  worldFeed: string | null
  /** V9 — جایزه‌ی XPِ فمبوی از این تجربه (اگر فمبویِ حاضر باشد) */
  femboyXp?: FemboyXpDTO | null
}

export interface PetDTO {
  id: string
  name: string
  emoji: string
  rarityLabel: string
  hunger: number
  loyalty: number
  moodLabel: string
}

export interface InventoryEntryDTO {
  itemKey: string
  name: string
  emoji: string
  rarityLabel: string
  category: string
  quantity: number
  equipped: boolean
  favorite: boolean
  locked: boolean
  usable: boolean
  tradable: boolean
  effectLabel: string | null
}

export interface HistoryItemDTO {
  id: string
  icon: string
  text: string
  category: string
  day: number
}

export interface OfflineRecapDTO {
  elapsedHours: number
  lines: { icon: string; text: string }[]
}

export interface NotificationDTO {
  id: string
  icon: string
  title: string
  body: string
  kind: string
  read: boolean
  at: string
}

export interface GameSnapshot {
  player: PlayerDTO
  world: WorldDTO
  activeEvent: ActiveEventDTO | null
  pets: PetDTO[]
  inventory: InventoryEntryDTO[]
  notifications: NotificationDTO[]
  unreadNotifications: number
  offlineRecap: OfflineRecapDTO | null
  /** V9 — هویتِ مرکزی: خلاصه‌ی فمبویِ بازیکن (null = پیمان نبسته) */
  femboy: FemboySummaryDTO | null
  /** V17 — مرحله‌ی سفرِ بازیکن (آینه‌ی قراردادِ موتور) */
  journey?: { stage: "new" | "awakened" | "bound" | "rooted" }
}

export interface AuthResponse {
  playerId: string
  created: boolean
  onboarded: boolean
  snapshot: GameSnapshot
}

export interface EventResponse {
  event: ActiveEventDTO
  snapshot: GameSnapshot
}

export interface ChooseResponse {
  outcome: OutcomeDTO
  snapshot: GameSnapshot
}

export interface ActionResponse {
  message: string
  flavor: string | null
  deltas: DeltaLine[]
  snapshot: GameSnapshot
}

export interface ProfileResponse {
  player: PlayerDTO
  pets: PetDTO[]
  inventory: InventoryEntryDTO[]
  story: string[]
  history: HistoryItemDTO[]
  totals: {
    eventsResolved: number
    moneyEarned: number
    moneySpent: number
    petsAdopted: number
    rareFinds: number
  }
  /** V16-4 — شمارِ کلِ دستاوردهای رجیستری (اختیاری/افزایشی): «N از M» در کارتِ دستاوردها */
  achievementsTotal?: number
}

// ─── V6 — بازار و کاتالوگ (آینه‌ی محلیِ موتور) ────────────────────────────────

/** آگهیِ بازار — NPC (sellerName=null) یا بازیکن */
export interface MarketEntryDTO {
  listingId: string
  itemKey: string
  name: string
  emoji: string
  rarity: string
  price: number
  quantity: number
  sellerName: string | null
  mine: boolean
}

export interface PriceInfoDTO {
  itemKey: string
  name: string
  emoji: string
  base: number
  current: number
  trend: number
}

export interface MarketSnapshot {
  listings: MarketEntryDTO[]
  prices: PriceInfoDTO[]
  shop: { itemKey: string; name: string; emoji: string; rarity: string; price: number; description: string }[]
  playerMoney: number
}

/** شغل‌های کاتالوگ — POST /api/game/catalog */
export interface CatalogJobDTO {
  key: string
  name: string
  emoji: string
  description: string
  incomeMin: number
  incomeMax: number
  energyCost: number
  risk: string
  cooldownMinutes: number
  minLevel: number
  quirks: string
}

/** V17-3 — خانه‌های کاتالوگ (همان DTO موتور: route /api/game/catalog) */
export interface CatalogHouseDTO {
  key: string
  name: string
  emoji: string
  price: number
  rent: number
  comfort: number
  security: number
  description: string
}

/** V17-3 — وسایل نقلیه‌ی کاتالوگ (basePrice × شاخصِ اقتصاد = قیمتِ واقعی) */
export interface CatalogVehicleDTO {
  key: string
  name: string
  emoji: string
  rarity: string
  basePrice: number
  speed: number
  description: string
  quirk: string
}

export interface CatalogResponse {
  jobs: CatalogJobDTO[]
  /** V17-3 — خانه‌ها/وسایل (اختیاری/افزایشی: موتورهای قدیمی نمی‌فرستند) */
  houses?: CatalogHouseDTO[]
  vehicles?: CatalogVehicleDTO[]
  economyIndex: number
}

// ─── V4 — قرارداد قفل‌شده (worklog Task V4-0) ────────────────────────────────
// این‌ها آینه‌ی محلیِ همان DTO های موتورند؛ ربات فقط نمایش می‌دهد.

export interface GuideStageDTO {
  key: string
  name: string
  emoji: string
  description: string
  nextName: string | null
  progressPct: number
}

export interface GuideStatusDTO {
  wealthLabel: string
  fameLabel: string
  chaosLabel: string
  riskLabel: string
}

export interface GuideDirectionDTO {
  key: string
  name: string
  emoji: string
  description: string
}

export interface GoalDTO {
  id: string
  title: string
  icon: string
  category: "immediate" | "short" | "medium" | "long"
  progressPct: number
  progressLabel: string
  hint: string
  rewardLabel: string | null
}

export interface OpportunityDTO {
  id: string
  title: string
  icon: string
  description: string
  sourceLabel: string
  minutesLeft: number
  kind: "deal" | "job" | "social" | "mystery" | "city"
  rewardPreview: string
  claimStyle: "safe" | "risky" | "wild"
}

export interface NextActionDTO {
  id: string
  icon: string
  title: string
  reason: string
  actionLabel: string
  tone: "good" | "info" | "warn"
}

export interface AspirationDTO {
  key: string
  name: string
  emoji: string
  description: string
  progressPct: number
  milestoneLabel: string
  milestonesDone: number
  milestonesTotal: number
  titleReward: string | null
}

export interface GuideResponse {
  stage: GuideStageDTO
  status: GuideStatusDTO
  direction: GuideDirectionDTO | null
  goals: GoalDTO[]
  opportunities: OpportunityDTO[]
  nextActions: NextActionDTO[]
  aspirations: AspirationDTO[]
  headline: string
  whatsHappening: string
}

export interface CityNewsResponse {
  dayCount: number
  weatherLabel: string
  weatherEmoji: string
  moodLabel: string
  chaosLevel: number
  economyIndex: number
  globalEvent: { name: string; emoji: string; description: string; endsInMinutes: number } | null
  headlines: { icon: string; text: string; at: number | string }[]
  rumors: string[]
  topPlayers: { name: string; avatar: string; level: number; highlight: string }[]
  population: number
}

// ─── V5 — شهرِ زنده‌ی گروه (قراردادِ لایه‌ی گروه؛ آینه‌ی محلیِ موتور) ──────────
// ربات فقط پیام‌رسان است: تصمیم/متن/دکمه‌ها همه از موتور می‌آیند.

/** استایلِ دکمه‌ی شیشه‌ای (Bot API 9.4) — موتور انتخابش می‌کند */
export type OutboxStyle = "primary" | "success" | "danger" | null

/** دکمه‌ی تولیدیِ موتور: cb (کال‌بک گروهی) یا url.
 *  V15-2 — sameRow: قصدِ چیدمانِ موتور (جفت‌هایِ گریدِ دوتایی)؛ ربات در
 *  outboxKeyboard اجرایش می‌کند. اختیاری است — موتورِ دیروز نمی‌فرستاد. */
export interface OutboxButton {
  label: string
  style: OutboxStyle
  cb?: string
  url?: string
  sameRow?: boolean
}

/** تصمیمِ خط لوله‌ی حضور روی یک پیام گروه */
export interface ObserveResponse {
  action: "none" | "reply" | "react"
  text?: string
  buttons?: OutboxButton[]
  /** V23 — واکنشِ ایموجی (Bot API 7.0): پیام نمی‌فرستد؛ ربات setMessageReaction می‌زند.
   *  واژگان = ایموجی‌های مجازِ تلگرام (آینه‌ی محلیِ ReactionTypeEmoji). */
  reaction?: "❤" | "🤣"
}

/** پاسخِ فرمان گروهی — کارتِ تازه (HTML + دکمه‌ها)
 *  V13 (موجِ ۵): kind:"home" یعنی کارتِ خانه‌ی شهر است — ربات به‌جای پیامِ تازه،
 *  کارتِ خانه‌ی ذخیره‌شده‌ی همان چت را در جایش ویرایش می‌کند (§6.4 ضدِ سیلیِ /game). */
export interface GroupCommandResponse {
  text: string
  buttons: OutboxButton[]
  kind?: "home"
}

/** پاسخِ کال‌بک گروهی — توست + کارتِ قابلِ ویرایش */
export interface GroupCallbackResponse {
  ok: boolean
  ackText: string
  editCard?: { text: string; buttons: OutboxButton[] }
}

/** پاسخِ ثبتِ عضو (خوش‌آمد از طریقِ outbox می‌رود) */
export interface GroupMemberResponse {
  welcomed: boolean
}

/** پیامِ آماده‌ی تحویل از تیکِ موتور — chatId ممکن است خصوصی باشد (سرنخ‌های نامتقارن) */
export interface TickMessage {
  outboxId: string
  chatId: string
  text: string
  kind: string
  buttons: OutboxButton[]
  editMessageId?: string | null
}

export interface GroupTickResponse {
  messages: TickMessage[]
  groupsTicked: number
}

/** درخواستِ مشاهده — ربات پیامِ گروه را عیناً برای موتور می‌برد
 *  V23: silent = شمارشِ خاموش (پیامِ مصرف‌شده توسط مسیریابِ نیت) — شمارنده‌ها
 *  می‌مانند، جواب/واکنش نمی‌آید. */
export interface GroupObserveRequest {
  chatId: string
  chatTitle?: string
  chatType?: string
  telegramId: string
  playerName?: string
  text: string
  addressedToBot: boolean
  replyToTelegramId?: string
  silent?: boolean
}

/** گزارشِ تحویل — تا موتور بتواند بعداً همان کارت را ویرایش کند */
export interface DeliveryReport {
  outboxId: string
  messageId: number | string
}

/** action های مسیرِ واحدِ /api/group/command */
export type GroupCommandAction = "command" | "callback" | "member" | "member_left" | "tick" | "delivered"

// ─── V7 — فمبویِ روح‌بسته (آینه‌ی محلیِ موتور؛ قرارداد در agent-ctx/V8-api-contract.md) ──

/** کارتِ کلاس برای صفحه‌ی ساخت */
export interface SoulClassDTO {
  key: string
  emoji: string
  name: string
  roleName: string
  fantasy: string
  difficulty: number // ۱..۳
  difficultyLabel: string
  strengths: string[]
  weaknesses: string[]
  playStyle: string
  passive: { name: string; icon: string; desc: string }
  activeSkill: { name: string; icon: string; desc: string; cooldown: number }
  art: string
  palette: { primary: string; soft: string }
  loreIntro: string
}

export interface SoulSkillDTO {
  id: string
  name: string
  icon: string
  desc: string
  type: "passive" | "active"
  unlockLevel: number
  maxRank: number
  rank: number
  spCost: number
  locked: boolean
  lockedReason: string | null
  canUpgrade: boolean
  upgradeReason: string | null
  effectPreview: string
  // ── V10: درختِ مهارت ──
  branch?: "core" | "life" | "art"
  branchLabel?: string
  requiresSkillId?: string | null
  requiresSkillName?: string | null
  evolutionReq?: number | null
}

export interface SoulEvolutionDTO {
  name: string
  emoji: string
  reqLevel: number
  reqWins: number
  lore: string
  reached: boolean
  isCurrent: boolean
  requirements: { label: string; done: boolean }[]
  // ── V10: شاخه‌ها ──
  pathLabel?: string
  /** این گزینه انتخاب و طی شده است */
  isChosen?: boolean
  /** پیش‌نمایشِ مکانیکیِ سوگیریِ شاخه («دفاع +۴ · بحرانی +۳») */
  preview?: string
}

/** V10 — تصمیمِ فرگشتِ بعدی: هر دو شاخه + واجد‌شرط‌بودن */
export interface EvolutionChoiceDTO {
  stage: number // ۱..۳
  options: SoulEvolutionDTO[]
  eligible: boolean
  /** مرحله‌ی آخر عبور شده — دیگر فرگشتی نیست */
  isFinal: boolean
}

/** V10 — کیهاناتِ ظاهر (فقط رندرشدنی‌ها: ایموجی/پالت/قاب) */
export interface CosmeticDTO {
  key: string
  kind: "accessory" | "palette" | "frame"
  emoji: string
  name: string
  desc: string
  sourceLabel: string
  owned: boolean
  equipped: boolean
  colors?: { primary: string; soft: string } | null
}

/** V10 — ظاهرِ فمبوی: پوشیده‌ها + کلکسیونِ مالکیت‌شده */
export interface AppearanceDTO {
  equipped: { accessory: CosmeticDTO | null; palette: CosmeticDTO | null; frame: CosmeticDTO | null }
  owned: CosmeticDTO[]
}

/** V10 — کلاس-تسلط (کارتِ کامل) */
export interface MasteryDTO {
  level: number
  emoji: string
  label: string
  perk: string
  xp: number
  nextTierXp: number | null
  /** آخرین کارهای واجدشرط (روایت‌وار، فارسی) */
  recentProofs: string[]
}

export interface SoulCardDTO {
  name: string
  classKey: string
  classEmoji: string
  className: string
  evolution: number
  evolutionName: string
  evolutionEmoji: string
  rank: { emoji: string; name: string }
  level: number
  xpTotal: number
  xpIntoLevel: number
  xpForNext: number
  spirit: number
  spiritPct: number
  condition: { label: string; emoji: string; dmgMod: number; canFight: boolean }
  stamina: number
  staminaMax: number
  staminaMinutesToNext: number | null
  skillPoints: number
  bond: number
  wins: number
  losses: number
  crits: number
  fights: number
  winRate: number | null
  stats: {
    atk: number
    def: number
    crit: number
    critDmg: number
    dodge: number
    acc: number
    speed: number
    luck: number
    loot: number
    hp: number
  }
  passive: { name: string; icon: string; desc: string }
  passiveParams: Record<string, number>
  skills: SoulSkillDTO[]
  evolutions: SoulEvolutionDTO[]
  // ── V10: شاخه‌ی فرگشتِ بعدی + کیهانات + کلاس-تسلط ──
  nextEvolution?: EvolutionChoiceDTO | null
  appearance?: AppearanceDTO
  mastery?: MasteryDTO
  masteryBoardAvailable?: boolean
  lore: { intro: string; deep: string[] }
  art: string
  palette: { primary: string; soft: string }
  xpTracks: { key: string; label: string; icon: string; xp: number }[]
  createdAt: string
  interactCooldownMin: number
  renameCooldownMin: number
  // ── V19: شخصیتِ عمیق — طبع/استعداد/ضعف/داستان/ماتریس/هزینه‌ی شارژ ──
  persona?: BotPersonaCardDTO | null
  talent?: BotTalentCardDTO | null
  flaw?: BotTalentCardDTO | null
  story?: BotStoryCardDTO | null
  affinityRows?: BotAffinityRowDTO[]
  rechargeCostPer?: number
}

// ─── V19: آینه‌هایِ شخصیتِ عمیق (contract موتور — تک‌منبع) ─────────────────────

export interface BotPersonaCardDTO {
  key: string
  emoji: string
  name: string
  tagline: string
  traits: string[]
  voiceSample: string | null
}

export interface BotTalentCardDTO {
  key: string
  emoji: string
  name: string
  desc: string
  domain: string
  domainLabel: string
  pct: number
}

export interface BotAffinityRowDTO {
  domain: string
  label: string
  icon: string
  pct: number
  kind: "talent" | "flaw"
}

export interface BotStoryChoiceDTO {
  idx: number
  label: string
  hint: string
}

export interface BotStoryCardDTO {
  arcKey: string
  arcTitle: string
  arcEmoji: string
  chaptersTotal: number
  chaptersDone: number
  status: "available" | "locked" | "complete"
  requirement: string | null
  current: { index: number; title: string; icon: string; text: string[]; choices: BotStoryChoiceDTO[] } | null
  trust: number
  trustPct: number
  trustTier: { label: string; emoji: string }
  nextTrustTier: { label: string; emoji: string; at: number } | null
  memories: SoulLogDTO[]
}

export interface SoulLogDTO {
  id: string
  type: string
  icon: string
  text: string
  at: string
}

export interface SoulEnemyDTO {
  key: string
  emoji: string
  name: string
  tier: number
  minLevel: number
  hp: number
  atk: number
  def: number
  dodge: number
  acc: number
  crit: number
  speed: number
  xp: number
  money: [number, number]
  special: string | null
  flavor: string
}

export type SoulInteractKind =
  | "comfort"
  | "praise"
  | "talk"
  | "treat"
  | "restTogether"
  | "practice"
  | "celebrate"
  | "gift"
  | "memory"

export interface SoulInteractDTO {
  key: SoulInteractKind
  icon: string
  label: string
  moneyCost: number
  spiritGain: [number, number]
  bondGain: number
  /** V10 — فقط طعم: روحیه/پیوند نمی‌دهد و کول‌داون ندارد (مرورِ خاطره) */
  flavorOnly?: boolean
}

/** حالتِ زنده‌ی نبرد */
export interface SoulCombatDTO {
  id: string
  kind: "pve" | "duel"
  status: "active" | "won" | "lost" | "fled"
  round: number
  enemy: { key: string; emoji: string; name: string; hp: number; hpMax: number; special: string | null; flavor: string } | null
  you: { name: string; emoji: string; hp: number; hpMax: number }
  foe: { name: string; emoji: string; hp: number; hpMax: number } | null
  log: string[]
  cooldown: number
  expiresInSeconds: number | null
  result: {
    outcome: "won" | "lost" | "fled"
    money: number
    xp: { track: string; label: string; icon: string; amount: number }[]
    spiritDelta: number
    lines: string[]
  } | null
}

/** نتیجه‌ی دوئلِ PvP (حلِ خودکار) */
export interface SoulDuelDTO {
  log: string[]
  winnerName: string
  loserName: string
  winnerIsInitiator: boolean
  rounds: number
  initiatorCard: SoulCardDTO
  foeCard: SoulCardDTO
}

/** GET /api/game/character — عهد نبسته یا کارتِ کامل */
export interface SoulGetData {
  exists: boolean
  classes?: SoulClassDTO[]
  /** V19 — بسته‌ی طبع‌ها برای مرحله‌ی پیمان */
  personas?: BotPersonaCardDTO[]
  interactions: SoulInteractDTO[]
  card?: SoulCardDTO
  logs?: SoulLogDTO[]
  encounter?: SoulCombatDTO | null
  enemies?: SoulEnemyDTO[]
}

/** POST /api/game/character — پاسخِ اکشن‌های فمبوی (create/rename/interact/recharge/
 *  potion/skillup/evolve{choice}/appearance/logs) · V17-W2: فیلدهایِ عمقِ تعاملِ V14
 *  (اختیاری — فقط interact برمی‌گرداند؛ مصرف‌کننده‌های قدیمی بی‌تغییر می‌مانند) */
export interface SoulActionData {
  message: string
  card: SoulCardDTO | null
  /** واریانتِ امروزِ تعامل (نوارِ روحیه × پله‌ی فرگشت) */
  variant?: {
    variantId: string
    spiritBand: string
    spiritBandIndex: number
    evolutionTier: number
    moodLine: string
    evoTail: string | null
  }
  /** واکنشِ پیوندِ تازه (V14) */
  reaction?: { tier: number; threshold: number; text: string; justUnlocked: boolean }
  /** پله‌ی واکنشِ همین‌جا باز شد */
  unlock?: { threshold: number; text: string }
  /** شمارِ خاطره‌های ذخیره‌شده */
  memory?: { count: number }
  /** V19 — داستانِ شخصی: مسیرِ story فصل/انتخاب را برمی‌گرداند */
  story?: BotStoryCardDTO
}

/** V19 — POST /api/game/character action=story {op:read|choose} — نتیجه‌ی داستان */
export interface SoulStoryActionData {
  message: string
  story?: BotStoryCardDTO
  card?: SoulCardDTO | null
}

/** POST /api/game/character action=evolutionChoice — پیش‌نمایشِ بی‌حالتِ هر دو شاخه */
export interface EvolutionChoiceActionData {
  decision: EvolutionChoiceDTO | null
}

/** POST /api/game/combat — start/act */
export interface CombatActionData {
  encounter: SoulCombatDTO
  card: SoulCardDTO
}

/** POST /api/game/combat — duel */
export interface DuelActionData {
  duel: SoulDuelDTO
}

export interface HallEntryDTO {
  rank: number
  characterName: string
  classEmoji: string
  className: string
  evolutionEmoji: string
  playerName: string
  playerAvatar: string
  value: number
  valueLabel: string
}

export interface HallDTO {
  board: string
  boardLabel: string
  boards: { key: string; label: string; icon: string }[]
  entries: HallEntryDTO[]
  note: string
}

// ─── V15-2 — کدکسِ راهنما (مرورگرِ تعاملیِ خصوصی؛ POST /api/game/help) ─────────
// آینه‌ی محلیِ DTOهای /api/game/help — همان قراردادی که کدکسِ گروهی (gh:) و
// مینی‌اپ (موجِ 16b) می‌خوانند. محتوا از رجیستریِ مرکزی موتور می‌آید؛ ربات
// فقط رندر و ناوبری است.

/** دسته‌ی کدکس — منویِ سطحِ یک (کارتِ خانه‌ی راهنما) */
export interface HelpCategoryDTO {
  id: string
  icon: string
  titleFa: string
  titleEn: string
  descFa: string
  topicCount: number
}

/** موضوع در یک نگاه — برای فهرست‌های دسته */
export interface HelpTopicStubDTO {
  id: string
  cat: string
  icon: string
  titleFa: string
  titleEn: string
  summaryFa: string
}

/** موضوعِ مرتبط — چیپِ پرش (تا ۲ دکمه) */
export interface HelpRelatedDTO {
  id: string
  icon: string
  titleFa: string
  summaryFa: string
}

/** عبارتِ طبیعیِ پشتیبانی‌شده برای همین موضوع */
export interface HelpPhraseDTO {
  fa: string
  en?: string
  where: "private" | "group" | "both"
}

/** بلوکِ متنِ موضوع — h = عنوانِ اختیاری، lines = سطرهای فارسی */
export interface HelpBlockDTO {
  h?: string
  lines: string[]
}

/** موضوعِ کامل + صفحه‌ی بلوک‌ها (صفحه‌بندیِ سمتِ سرور) */
export interface HelpTopicResponse {
  topic: HelpTopicStubDTO & {
    related: HelpRelatedDTO[]
    phrases: HelpPhraseDTO[]
    examples: string[]
  }
  blocks: HelpBlockDTO[]
  page: number
  pageCount: number
}

/** فهرستِ موضوع‌های یک دسته */
export interface HelpTopicsResponse {
  category: { id: string; icon: string; titleFa: string; descFa: string }
  topics: HelpTopicStubDTO[]
}

/** فهرستِ دسته‌ها */
export interface HelpCategoriesResponse {
  categories: HelpCategoryDTO[]
}

// ─── V8 — کارتِ عمومیِ فمبوی (نمایِ گروه؛ فقط با X-Service-Key) ────────────────

/** عنوانِ فعالِ بازیکنِ هدف در کارتِ عمومی */
export interface PublicCardTitleDTO {
  key: string
  name: string
  emoji: string
}

/** GET /api/game/character?targetTelegramId={tgId} — فقط زیرمجموعه‌ی عمومی:
 *  هرگز استقامت/روحیه/پیوند/مهارت‌ها/کیف/مسیرهای XP را ندارد.
 *  target=null → بازیکنِ هدف هر واردِ بازی نشده؛ exists=false → آمده ولی هنوز پیمان نبسته. */
export interface PublicFemboyCardDTO {
  target: { telegramId: string; playerName: string; playerAvatar: string } | null
  exists: boolean
  card: {
    name: string
    classKey: string
    className: string
    classEmoji: string
    classRole: string
    level: number
    rankKey: string
    rankName: string
    rankEmoji: string
    evolution: number
    evolutionName: string
    wins: number
    losses: number
    crits: number
    activeTitle: PublicCardTitleDTO | null
    // ── V10: هویتِ عمومیِ عمیق ──
    mastery?: { level: number; emoji: string; label: string }
    accessoryEmoji?: string | null
    evolutionPathName?: string | null
    // ── V19: هویتِ عمومیِ طبع/استعداد ──
    persona?: { key: string; emoji: string; name: string; tagline: string } | null
    talent?: { key: string; emoji: string; name: string } | null
  } | null
}

// ─── خطای فارسیِ بازی (از خود موتور می‌آید؛ همان را نشانت می‌دهیم) ────────────

export class GameApiError extends Error {
  code: string
  status: number
  constructor(message: string, code = "error", status = 0) {
    super(message)
    this.name = "GameApiError"
    this.code = code
    this.status = status
  }
}

// صدای واحدِ خطایِ ناشناخته — منبعِ یگانه؛ ui.GENERIC نسخه‌ی استایل‌دارِ همین دو تکه است.
// متنِ GameApiError باید خالی از HTML باشد (در نمایش esc می‌شود) — تگ‌ها فقط در ui اضافه می‌شوند.
const GENERIC_HEAD = "چیزی خراب شد."
const GENERIC_TAIL = "حتی ما هم نمی‌دانیم چرا."
const GENERIC_ERROR = `${GENERIC_HEAD} ${GENERIC_TAIL}`

/** همان صدا با استایلِ HTML — ui.GENERIC این را نشان می‌دهد (⚠️ را فراخوان‌کننده می‌گذارد) */
export const GENERIC_STYLED = `${GENERIC_HEAD} <i>${GENERIC_TAIL}</i>`

/** GET با کلیدِ سرویس — همان قراردادِ post (سقفِ زمانی + خطای فارسی) */
async function get<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await engineFetch(path, {
      method: "GET",
      headers: { "X-Service-Key": SERVICE_KEY },
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    throw new GameApiError(timedOut ? ENGINE_TIMEOUT_ERROR : GENERIC_ERROR, "network", 0)
  }

  let json: { ok?: boolean; data?: T; error?: string; code?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new GameApiError(GENERIC_ERROR, "bad_response", res.status)
  }

  if (json.ok && json.data !== undefined) {
    stats.lastEngineOk = new Date()
    return json.data
  }
  throw new GameApiError(
    typeof json.error === "string" && json.error.trim() ? json.error : GENERIC_ERROR,
    typeof json.code === "string" ? json.code : "error",
    res.status,
  )
}

// ─── V17-W2 (§17): کشِ راهنما با TTL ─────────────────────────────────────────
// فراخوانیِ guide بعد از هر اکشنِ روتین (~۱۵ پرس‌وجویِ موتور) فقط برای چیدنِ یک خطِ
// «🧭 بعدی» می‌سوزد. ۶۰ ثانیه کشِ هر-بازیکن + ابطالِ خودکار: هر POSTِ تغییردهنده‌ی
// حالت (اکشن/انتخاب/تعامل/بازار/گروه) کشِ همان بازیکن را بی‌درنگ می‌اندازد تا
// پیشنهادِ بعدی هرگز از حالتِ کهنه نیاید (صحتِ > صرفه‌جویی).
const GUIDE_TTL_MS = 60_000
const GUIDE_CACHE_MAX = 500
const guideCache = new Map<string, { g: GuideResponse; at: number }>()

function guideCacheTrim(): void {
  while (guideCache.size >= GUIDE_CACHE_MAX) {
    const oldest = guideCache.keys().next().value
    if (oldest === undefined) break
    guideCache.delete(oldest)
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  // V17-W2 — POSTِ بازیکن‌محور = حالت عوض شده؛ کشِ راهنمایِ همان بازیکن باطل
  if (path !== "/api/game/guide" && typeof body.telegramId === "string" && body.telegramId) {
    guideCache.delete(body.telegramId)
  }
  let res: Response
  try {
    res = await engineFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Key": SERVICE_KEY },
      body: JSON.stringify(body),
      // V6 — سقفِ زمانی: هیچ فراخوانیِ بی‌پایانی هندلر یا تیکِ outbox را گیر نمی‌اندازد
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
    throw new GameApiError(timedOut ? ENGINE_TIMEOUT_ERROR : GENERIC_ERROR, "network", 0)
  }

  let json: { ok?: boolean; data?: T; error?: string; code?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new GameApiError(GENERIC_ERROR, "bad_response", res.status)
  }

  if (json.ok && json.data !== undefined) {
    stats.lastEngineOk = new Date()
    return json.data
  }
  throw new GameApiError(
    typeof json.error === "string" && json.error.trim() ? json.error : GENERIC_ERROR,
    typeof json.code === "string" ? json.code : "error",
    res.status,
  )
}

// ─── کلاینت ──────────────────────────────────────────────────────────────────

/** V6 — پینگِ سلامتِ موتور: GET /api/health (سبک؛ هیچ وضعیتِ بازی‌ای را لمس نمی‌کند).
 *  ok = HTTP 200 && body.data.ok && body.data.db */
export async function fetchEngineHealth(timeoutMs = 4000): Promise<{ ok: boolean; db: boolean } | null> {
  try {
    const res = await fetch(`${apiBase()}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { data?: { ok?: boolean; db?: boolean } }
    if (j.data?.ok !== true) return null
    return { ok: true, db: j.data.db === true }
  } catch {
    return null
  }
}

export const api = {
  /** ورود/ثبت بازیکن با telegramId (upsert) */
  auth: (telegramId: string, name?: string, avatar?: string) =>
    post<AuthResponse>("/api/auth", { telegramId, name, avatar }),

  /** snapshot تازه‌ی جهان و بازیکن */
  state: (telegramId: string) => post<{ snapshot: GameSnapshot }>("/api/game/state", { telegramId }),

  /** کشیدن اتفاق امروز — 409 یعنی الان اتفاقی نیست یا انرژی نداری */
  event: (telegramId: string) => post<EventResponse>("/api/game/event", { telegramId }),

  /** انتخاب یکی از گزینه‌های اتفاق */
  choose: (telegramId: string, eventId: string, optionIndex: number) =>
    post<ChooseResponse>("/api/game/choose", { telegramId, eventId, optionIndex }),

  /** کارهای عمومی: work / rest / travel / feedPet / playPet / payDebt / readNotifications */
  action: (telegramId: string, action: string, payload: Record<string, unknown> = {}) =>
    post<ActionResponse>("/api/game/action", { telegramId, action, payload }),

  /** پروفایل کامل: story + history + totals */
  profile: (telegramId: string) => post<ProfileResponse>("/api/game/profile", { telegramId }),

  /** V6 — بازار: آگهی‌ها + قیمت‌ها + مغازه‌ی محله‌ی فعلی (فروشِ فوری = ۶۰٪ قیمتِ current) */
  market: (telegramId: string) => post<MarketSnapshot>("/api/game/market", { telegramId }),

  /** V6 — کاتالوگ: شغل‌ها (برای /jobs) + شاخصِ اقتصاد · V17-3: خانه‌ها و وسایل نقلیه */
  catalog: (telegramId: string) => post<CatalogResponse>("/api/game/catalog", { telegramId }),

  /** V4 — راهنمای زنده‌ی زندگی بازیکن (اگر موتورِ V4 آماده نباشد خطا می‌دهد؛ هندلرها fallback دارند)
   *  V17-W2 — ۶۰ ثانیه کشِ هر-بازیکن؛ هر POSTِ تغییردهنده‌ی حالت بی‌درنگ باطلش می‌کند */
  guide: async (telegramId: string): Promise<GuideResponse> => {
    const hit = guideCache.get(telegramId)
    if (hit && Date.now() - hit.at <= GUIDE_TTL_MS) return hit.g
    const g = await post<GuideResponse>("/api/game/guide", { telegramId })
    guideCache.set(telegramId, { g, at: Date.now() })
    guideCacheTrim()
    return g
  },

  /** V4 — خبرنامه‌ی شهر؛ بدون بازیکن هم کار می‌کند (برای گروه‌ها) */
  citynews: (telegramId?: string) =>
    post<CityNewsResponse>("/api/game/citynews", telegramId ? { telegramId } : {}),

  // ─── V5 — لایه‌ی گروه (شهرِ زنده) ──────────────────────────────────────────

  /** V5 — خط لوله‌ی حضور: پیامِ گروه برای موتور؛ تصمیمِ جواب با اوست */
  groupObserve: (req: GroupObserveRequest) => post<ObserveResponse>("/api/group/observe", { ...req }),

  /** V5 — مسیرِ واحدِ گروه: command | callback | member | tick | delivered
   *  (tick/delivered به chatId نیاز ندارند ولی مسیرِ موتور رشته‌ی غیرخالی می‌خواهد) */
  groupCommand: <T = unknown>(action: GroupCommandAction, payload: Record<string, unknown> = {}) =>
    post<T>("/api/group/command", {
      chatId: action === "tick" || action === "delivered" ? "__global__" : "",
      action,
      ...payload,
    }),

  /** V5 — تیکِ جهانِ گروه‌ها؛ پیام‌های آماده‌ی outbox را برمی‌گرداند */
  groupTick: () => post<GroupTickResponse>("/api/group/command", { action: "tick", chatId: "__global__" }),

  /** V5 — گزارشِ تحویل (messageId) تا ویرایش‌های بعدیِ کارت‌ها ممکن شود؛
   *  + چت‌های بی‌دسترسی (ربات حذف شده) تا موتور آن شهرها را تا بازگشتِ ربات خاموش کند */
  groupDelivered: (reports: DeliveryReport[], unreachable: string[] = []) =>
    post<{ ok: boolean }>("/api/group/command", {
      action: "delivered",
      chatId: "__global__",
      delivered: reports,
      ...(unreachable.length > 0 ? { unreachable } : {}),
    }),

  // ─── V7 — فمبویِ روح‌بسته (سول‌باند) ────────────────────────────────────────

  /** کارتِ فمبوی (یا بسته‌ی کلاس‌ها اگر عهد نبسته) + دشمن‌ها + نبردِ فعال */
  soulGet: (telegramId: string) =>
    get<SoulGetData>(`/api/game/character?telegramId=${encodeURIComponent(telegramId)}`),

  /** V8 — کارتِ عمومیِ فمبویِ بازیکنِ هدف (برای /myfemboy و /femboy در گروه) */
  publicCard: (targetTelegramId: string) =>
    get<PublicFemboyCardDTO>(
      `/api/game/character?targetTelegramId=${encodeURIComponent(targetTelegramId)}`,
    ),

  /** اکشن‌های فمبوی: create | rename | interact | recharge | potion | skillup |
   *  evolve (payload.choice = 0|1) | appearance (payload.slot+key) | logs | story (V19) */
  soulAction: (telegramId: string, action: string, payload: Record<string, unknown> = {}) =>
    post<SoulActionData>("/api/game/character", { telegramId, action, payload }),

  /** V19 — داستانِ شخصی: خواندنِ فصلِ جاری یا انتخابِ پیامد (op: read|choose) */
  soulStory: (telegramId: string, op: "read" | "choose", choice?: number) =>
    post<SoulStoryActionData>("/api/game/character", {
      telegramId,
      action: "story",
      payload: op === "choose" ? { op, choice } : { op },
    }),

  /** V10 — پیش‌نمایشِ تصمیمِ فرگشت: هر دو شاخه + شرط‌ها + پیش‌نمایش‌ها (بی‌حالت) */
  soulEvolutionChoice: (telegramId: string) =>
    post<EvolutionChoiceActionData>("/api/game/character", { telegramId, action: "evolutionChoice", payload: {} }),

  /** نبردِ فعال + لیستِ شکار (GET) */
  combatGet: (telegramId: string) =>
    get<{ encounter: SoulCombatDTO | null; card: SoulCardDTO; enemies: SoulEnemyDTO[] }>(
      `/api/game/combat?telegramId=${encodeURIComponent(telegramId)}`,
    ),

  /** اکشن‌های نبرد: start | act | duel | sweep */
  combatAction: (telegramId: string, action: string, payload: Record<string, unknown> = {}) =>
    post<CombatActionData | DuelActionData>("/api/game/combat", { telegramId, action, payload }),

  /** تالارِ افتخارات — board: level|wins|winrate|crits|evolution */
  hall: (telegramId: string, board: string) =>
    get<HallDTO>(
      `/api/game/character/hall?board=${encodeURIComponent(board)}&telegramId=${encodeURIComponent(telegramId)}`,
    ),

  // ─── V15-2 — کدکسِ راهنما (خصوصی؛ service-key + telegramId → resolveCaller) ──

  /** دسته‌های کدکس — کارتِ خانه‌ی راهنما (فراخوانی‌یِ کش‌شونده در help.ts) */
  helpCategories: (telegramId: string) =>
    post<HelpCategoriesResponse>("/api/game/help", { telegramId, action: "categories" }),

  /** موضوع‌های یک دسته — همیشه تازه (بدون کش) */
  helpTopics: (telegramId: string, categoryId: string) =>
    post<HelpTopicsResponse>("/api/game/help", { telegramId, action: "topics", categoryId }),

  /** یک موضوع با صفحه‌بندیِ سمتِ سرور (perPage پیش‌فرضِ موتور = 4 بلوک) */
  helpTopic: (telegramId: string, id: string, page = 0) =>
    post<HelpTopicResponse>("/api/game/help", { telegramId, action: "topic", id, page }),
}
