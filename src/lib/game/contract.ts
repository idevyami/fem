// FEMBOY WAR — client/server DTO contract.
// Pure types. Safe to import from client components and from the bot service.
// This is the single source of truth for what both interfaces render.

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "unknown"

// ─── Player ───────────────────────────────────────────────────────────────────

export interface PlayerDTO {
  id: string
  name: string
  avatar: string
  level: number
  xp: number
  xpToNext: number
  day: number
  money: number
  debt: number
  health: number
  energy: number
  luck: number
  intelligence: number
  chaos: number
  fame: number
  crime: number
  reputation: number
  district: string
  districtName: string
  districtEmoji: string
  job: JobDTO | null
  vehicle: VehicleDTO | null
  house: HouseDTO | null
  canWork: boolean
  workCooldownMinutes: number
  /** V17-W3 (W3-F4) — پیوستگیِ شیفت‌های موفقِ پیاپی (پاداشِ تا +۳۰٪ دستمزد —
   *  actions.ts) — حالا دیده می‌شود تا بازیکن بتواند به‌سمتش برود (§13-C/H) */
  workStreak: number
  resting: boolean
  restMinutesLeft: number
  activeTitle: string | null
  titles: { key: string; name: string; emoji: string; description: string }[]
  /** V16-4 — دستاوردهای بازیکن (فقطِ باز‌شده‌ها)؛ unlockedAt اختیاری است تا
   *  DTOهای قدیمی بی‌خطا رندر شوند (مرتب‌سازیِ «آخرین» بدونش به ترتیبِ ردیف بس است) */
  achievements: { key: string; name: string; emoji: string; description: string; unlockedAt?: string }[]
  statsSummary: string[] // «player story» lines
  stageBadge?: { key: string; name: string; emoji: string } | null // V4: مقطعِ فعلی بازیکن
}

export interface JobDTO {
  key: string
  name: string
  emoji: string
  description: string
  incomeMin: number
  incomeMax: number
  energyCost: number
  risk: string // فارسی
  quirks: string
}

export interface VehicleDTO {
  key: string
  name: string
  emoji: string
  quirk: string
}

export interface HouseDTO {
  key: string
  name: string
  emoji: string
  rent: number
  rentDueInHours: number
  comfort: number
  security: number
}

// ─── World ────────────────────────────────────────────────────────────────────

export interface WorldDTO {
  dayCount: number
  weather: string
  weatherLabel: string
  weatherEmoji: string
  mood: string
  moodLabel: string
  chaosLevel: number
  economyIndex: number
  globalEvent: {
    key: string
    name: string
    emoji: string
    description: string
    endsInMinutes: number
  } | null
  feed: { id: string; icon: string; text: string; at: string }[]
}

// ─── Events ───────────────────────────────────────────────────────────────────

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
  category: string
  categoryLabel: string
  rarity: Rarity
  rarityLabel: string
  text: string
  isChainStep: boolean
  chainStep: number
  expiresAt: string | null
  choices: ChoiceDTO[]
}

export interface DeltaLineDTO {
  icon: string
  label: string
  amount: number
  tone: "good" | "bad" | "neutral"
}

export interface OutcomeDTO {
  text: string
  deltas: DeltaLineDTO[]
  grantedItems: { name: string; emoji: string; rarity: Rarity }[]
  grantedPet: { name: string; emoji: string; rarity: Rarity } | null
  grantedTitles: string[]
  grantedAchievements: string[]
  npcNotes: string[]
  worldFeed: string | null
  /** V9 — جایزه‌ی XPِ فمبوی از تجربه‌ی این اتفاق (اگر بازیکن فمبوی داشته باشد) */
  femboyXp?: FemboyXpDTO | null
}

// ─── V9: هویتِ مرکزی — فمبوی در snapshot و جایزه‌های XP ─────────────────────

/** خلاصه‌ی سبکِ فمبوی برای همه‌ی سطح‌ها (پیشخوانِ ربات، خانه‌ی مینی‌اپ، راهنما) */
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
  // ── V10: تسلط، ظاهر، سلوکِ بعدی ──
  mastery: MasterySummaryDTO
  accessoryEmoji: string | null
  evolutionPathName: string | null
  nextMilestone: string
  // ── V19: طبع + تراشه‌ی داستان برای کارت‌های سبک ──
  persona: { key: string; emoji: string; name: string } | null
  storyChip: string | null
}

/** خلاصه‌ی کلاس-تسلط برای کارت‌های سبک */
export interface MasterySummaryDTO {
  level: number
  emoji: string
  label: string
  xp: number
  nextTierXp: number | null
}

/** XPِ اعطاشده به فمبوی از یک تجربه‌ی شهری (اتفاق/کار) */
export interface FemboyXpDTO {
  name: string
  trackKey: string
  trackLabel: string
  trackIcon: string
  amount: number
  levelUps: string[] // شماره‌ی سطح‌های تازه (فارسی‌سازی در نمایش)
  /** V10 — تسلطِ تازه (اگر همین تجربه سطحِ تسلط را برد) */
  masteryLevel?: number
}

// ─── Pets / Inventory / Market ────────────────────────────────────────────────

export interface PetDTO {
  id: string
  speciesKey: string
  species: string
  name: string
  emoji: string
  rarity: Rarity
  rarityLabel: string
  personality: string
  traits: string[]
  hunger: number
  energy: number
  loyalty: number
  mood: string
  moodLabel: string
  statusNote: string | null
}

export interface InventoryEntryDTO {
  itemKey: string
  name: string
  emoji: string
  rarity: Rarity
  rarityLabel: string
  category: string
  quantity: number
  equipped: boolean
  favorite: boolean
  locked: boolean
  usable: boolean
  tradable: boolean
  description: string
  effectLabel: string | null
  unitPrice: number
}

export interface MarketEntryDTO {
  listingId: string
  itemKey: string
  name: string
  emoji: string
  rarity: Rarity
  price: number
  quantity: number
  sellerName: string | null // null → NPC
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

// ─── NPCs / Social ────────────────────────────────────────────────────────────

export interface NpcDTO {
  key: string
  name: string
  emoji: string
  occupation: string
  district: string
  districtName: string
  description: string
  relationship: { trust: number; affection: number; respect: number; fear: number }
  statusLabel: string
  lastMemory: string | null
  hasSecret: boolean
}

export interface LeaderRowDTO {
  id: string
  name: string
  avatar: string
  level: number
  money: number
  fame: number
  chaos: number
  title: string | null
  highlight: string
}

// ─── History / Notifications / Offline ────────────────────────────────────────

export interface HistoryItemDTO {
  id: string
  icon: string
  text: string
  category: string
  day: number
  at: string
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

export interface OfflineRecapDTO {
  elapsedHours: number
  lines: { icon: string; text: string }[]
}

// ─── Static catalogs (for UI pickers) ─────────────────────────────────────────

export interface DistrictDTO {
  key: string
  name: string
  emoji: string
  description: string
  mood: string
  risk: number
  playerCount: number
  activeFlavor: string | null
}

export interface ShopItemDTO {
  itemKey: string
  name: string
  emoji: string
  rarity: Rarity
  price: number
  description: string
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export interface GameSnapshot {
  player: PlayerDTO
  world: WorldDTO
  activeEvent: ActiveEventDTO | null
  pets: PetDTO[]
  inventory: InventoryEntryDTO[]
  notifications: NotificationDTO[]
  unreadNotifications: number
  npcs: NpcDTO[]
  offlineRecap: OfflineRecapDTO | null
  serverTime: string
  /** V9 — هویتِ مرکزی: خلاصه‌ی فمبویِ روح‌بسته‌ی بازیکن (null = هنوز پیمان نبسته) */
  femboy: FemboySummaryDTO | null
  /** V17 — مرحله‌ی سفر: افشایشِ تدریجیِ یک‌صدا در مینی‌اپ/ربات/گروه (server-authoritative) */
  journey: { stage: "new" | "awakened" | "bound" | "rooted" }
}

export interface MarketSnapshot {
  listings: MarketEntryDTO[]
  prices: PriceInfoDTO[]
  shop: ShopItemDTO[] // NPC shop of player's current district
  playerMoney: number
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiErr {
  ok: false
  error: string
  code?: string
  /** V16-2 (Mini App · ممیزیِ ⑦): وضعیتِ HTTP وقتی سرور جواب داد — برای رده‌بندیِ خطا */
  status?: number
  /** V16-2: ثانیه‌های انتظارِ نرخ‌گذاری، اگر معلوم بود (۴۲۹) */
  retryAfterSec?: number
}

export type ApiResult<T> = ApiOk<T> | ApiErr

export interface AuthResponse {
  playerId: string
  created: boolean
  onboarded: boolean
}

export interface ChooseResponse {
  outcome: OutcomeDTO
  snapshot: GameSnapshot
}

export interface EventResponse {
  event: ActiveEventDTO
  snapshot: GameSnapshot
}

export interface ActionResponse {
  message: string
  flavor?: string
  deltas: DeltaLineDTO[]
  snapshot: GameSnapshot
  extra?: Record<string, unknown>
}

export interface HistoryResponse {
  items: HistoryItemDTO[]
  hasMore: boolean
}

export interface ProfileResponse {
  player: PlayerDTO
  pets: PetDTO[]
  inventory: InventoryEntryDTO[]
  story: string[]
  history: HistoryItemDTO[]
  totals: { eventsResolved: number; moneyEarned: number; moneySpent: number; petsAdopted: number; rareFinds: number }
  /** V16-4 — شمارِ کلِ دستاوردهای رجیستری (N از M؛ اختیاری/افزایشی) — رباتِ
   *  خصوصی نوارِ دستاوردها را با همین عدد می‌بندد؛ مینی‌اپ رجیستری را باندل دارد */
  achievementsTotal?: number
}

export interface LeaderboardResponse {
  rows: LeaderRowDTO[]
  worldDay: number
}

// ─── V4: direction / progression / guide / city news ─────────────────────────

export interface StageDTO {
  key: string // nobody | resident | established | known | influential | powerful | legendary
  name: string
  emoji: string
  description: string
  nextName: string | null // null در مقطع افسانه‌ای
  progressPct: number // 0..100 پیشرفت تا مقطع بعد
}

export interface StatusDescriptorsDTO {
  wealthLabel: string
  fameLabel: string
  chaosLabel: string
  riskLabel: string
}

export interface DirectionDTO {
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
  milestoneLabel: string // اولین سنگ‌میلمه‌ی نرسیده یا «کامل»
  milestonesDone: number
  milestonesTotal: number
  titleReward: string | null
}

export interface GuideResponse {
  stage: StageDTO
  status: StatusDescriptorsDTO
  direction: DirectionDTO | null
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
  headlines: { icon: string; text: string; at: string }[]
  rumors: string[]
  topPlayers: { name: string; avatar: string; level: number; highlight: string }[]
  population: number
}

// ─── V7/V8: فمبویِ روح‌بسته (Soulbound Femboy — کدنامِ V7: Soulbound Character) ──

export interface ClassCardDTO {
  key: string
  emoji: string
  name: string
  roleName: string
  fantasy: string
  difficulty: number // 1..3
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

export interface SkillStateDTO {
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
  // پیش‌نمایشِ اثرِ رتبه‌ی بعد
  effectPreview: string
  // ── V10: درختِ مهارت ──
  branch: "core" | "life" | "art"
  branchLabel: string
  requiresSkillId: string | null
  requiresSkillName: string | null
  evolutionReq: number | null
}

export interface EvolutionStateDTO {
  name: string
  emoji: string
  reqLevel: number
  reqWins: number
  lore: string
  reached: boolean
  isCurrent: boolean
  requirements: { label: string; done: boolean }[]
  // ── V10: شاخه‌ها ──
  pathLabel: string
  isChosen: boolean // این گزینه انتخاب شده است
  preview: string // پیش‌نمایشِ مکانیکیِ سوگیریِ شاخه
  // ── V8 §24: آرتِ اختصاصیِ فُرم (مرحله‌ی ۲/۳) — null = آرتِ کلاس ──
  art?: string | null
}

/** V10 — مرحله‌ی فرگشتِ بعدی با انتخابِ شاخه */
export interface EvolutionChoiceDTO {
  stage: number // 1..3
  options: EvolutionStateDTO[]
  eligible: boolean
  isFinal: boolean // مرحله‌ی آخر عبور شده
}

/** V10 — کیهانات */
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

export interface AppearanceDTO {
  equipped: { accessory: CosmeticDTO | null; palette: CosmeticDTO | null; frame: CosmeticDTO | null }
  owned: CosmeticDTO[]
}

// ─── V19: شخصیتِ عمیق — طبع/استعداد/ضعف/داستانِ شخصی/اعتماد ──────────────────

/** کارتِ طبع — لایه‌ی «چطور رفتار می‌کند و حرف می‌زند» */
export interface PersonaCardDTO {
  key: string
  emoji: string
  name: string
  /** تفسیرِ خوانا (یک خط) — مدلِ عمیق پشتِ صحنه می‌ماند */
  tagline: string
  traits: string[]
  /** نمونه‌ی صدای امروز (خطِ talk) — «این‌جوری حرف می‌زنه» */
  voiceSample: string | null
}

/** کارتِ استعداد/ضعف — دامنه‌ی واقعیِ gameplay، توضیحِ صادقانه */
export interface TalentCardDTO {
  key: string
  emoji: string
  name: string
  desc: string
  domain: string
  domainLabel: string
  /** درصدِ امضا (برای drop: نقطه‌ی درصدی) — مثبت=بونوس، منفی=مالوس */
  pct: number
}

/** سطرِ ماتریسِ دامنه‌ها — کدام فعالیت‌ها از شخصیت اثر می‌گیرند */
export interface AffinityRowDTO {
  domain: string
  label: string
  icon: string
  pct: number
  kind: "talent" | "flaw"
}

/** پله‌های اعتماد */
export interface TrustTierDTO {
  label: string
  emoji: string
  min: number
}

/** فصلِ درِ دسترس — متن + انتخاب‌ها */
export interface StoryCurrentChapterDTO {
  index: number
  title: string
  icon: string
  text: string[]
  choices: { idx: number; label: string; hint: string }[]
}

/** داستانِ شخصی — وضعیت/اعتماد/فصلِ جاری (memories فقط در مسیرهایِ لاگ‌دار پر می‌شود) */
export interface StoryCardDTO {
  arcKey: string
  arcTitle: string
  arcEmoji: string
  chaptersTotal: number
  chaptersDone: number
  status: "available" | "locked" | "complete"
  /** چرا قفل است (فاصله تا سدها) — فقط وقتی locked */
  requirement: string | null
  current: StoryCurrentChapterDTO | null
  trust: number
  trustPct: number
  trustTier: { label: string; emoji: string }
  nextTrustTier: { label: string; emoji: string; at: number } | null
  memories: CharacterLogDTO[]
}

/** V10 — کلاس-تسلط (کارتِ کامل) */
export interface MasteryDTO {
  level: number
  emoji: string
  label: string
  perk: string
  xp: number
  nextTierXp: number | null
  recentProofs: string[] // آخرین کارهای واجدشرط (روایت‌وار)
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
  // ── V14 (مأموریتِ II لایه‌ی B): دیوارِ عددِ بی‌توضیح ممنوع — اختیاری؛
  // سازنده‌هایِ قدیمیِ DTO بی‌تغییر می‌مانند، سطوحِ تازه همین‌ها را رندر می‌کنند ──
  /** توضیحِ یک‌خطیِ هر آمارِ رزمی (9 کلید: atk/def/crit/critDmg/dodge/acc/speed/luck/loot) */
  statExplanations?: { key: string; labelFa: string; textFa: string }[]
  /** امضای کلاس با مقادیرِ زنده‌ی interpolate‌شده + معنای هر-استک/هر-راند */
  passiveDetail?: { name: string; descFa: string; paramsLive: Record<string, number> }
  /** هویتِ رزمیِ کلاس — قوت/ضعف/سبکِ بازی (از ClassDef) */
  combatIdentity?: { strengths: string[]; weaknesses: string[]; playStyle: string }
  skills: SkillStateDTO[]
  evolutions: EvolutionStateDTO[]
  // ── V10: شاخه‌ی فرگشتِ بعدی + کیهانات + تسلط ──
  nextEvolution: EvolutionChoiceDTO | null
  appearance: AppearanceDTO
  mastery: MasteryDTO
  masteryBoardAvailable: boolean
  lore: { intro: string; deep: string[] }
  art: string
  palette: { primary: string; soft: string }
  xpTracks: { key: string; label: string; icon: string; xp: number }[]
  createdAt: string
  interactCooldownMin: number // دقایق مانده تا تعاملِ بعدی (0 = آماده)
  renameCooldownMin: number // دقایق مانده تا تغییرِ اسمِ بعدی
  // ── V19: شخصیتِ عمیق — طبع/استعداد/ضعف/داستان/ماتریسِ دامنه‌ها ──
  /** طبع — لایه‌ی رفتار/گفتار (null فقط اگر رکورد بی‌طبع باشد — عملاً نمی‌افتد) */
  persona: PersonaCardDTO | null
  /** استعدادِ شخصی — بونوسِ واقعی روی یک دامنه‌ی gameplay */
  talent: TalentCardDTO | null
  /** ضعفِ شخصی — مالوسِ کوچک، منصفانه و روی کارت دیده‌شونده */
  flaw: TalentCardDTO | null
  /** داستانِ شخصی — وضعیت/اعتماد/فصلِ جاری */
  story: StoryCardDTO | null
  /** ماتریسِ دامنه‌ها — کدام فعالیت‌ها از استعداد/ضعف اثر می‌گیرند */
  affinityRows: AffinityRowDTO[]
  /** هزینه‌ی هر واحدِ شارژِ استقامت برای «این» فمبوی (استعدادِ صرفه‌جو) */
  rechargeCostPer: number
}

export interface CharacterLogDTO {
  id: string
  type: string
  icon: string
  text: string
  at: string
}

/** حالتِ زنده‌ی نبرد — هر دو کلاینت (Mini App و Bot) همین را رندر می‌کنند */
export interface CombatStateDTO {
  id: string
  kind: "pve" | "duel"
  status: "active" | "won" | "lost" | "fled"
  round: number
  enemy: { key: string; emoji: string; name: string; hp: number; hpMax: number; special: string | null; flavor: string } | null
  you: { name: string; emoji: string; hp: number; hpMax: number }
  foe: { name: string; emoji: string; hp: number; hpMax: number } | null // PvP
  log: string[] // خطوطِ روایتِ نبرد (متنِ خالص با ایموجی)
  cooldown: number // راندهای مانده تا مهارتِ فعال
  expiresInSeconds: number | null
  result: {
    outcome: "won" | "lost" | "fled"
    money: number
    xp: { track: string; label: string; icon: string; amount: number }[]
    spiritDelta: number
    lines: string[]
  } | null
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

// ─── V7/V8: پاسخ‌های فمبوی — ترکیبِ DTOها برای کلاینت‌ها ─────────────────────

/** دشمنِ در دسترسِ شکار — از GET character/combat (enemies) */
export interface EnemyDTO {
  key: string
  emoji: string
  name: string
  tier: number // 1..4
  minLevel: number
  hp: number
  atk: number
  def: number
  dodge: number
  acc: number
  crit: number
  speed: number
  xp: number
  money: [number, number] // بازه‌ی سکه
  special: string | null
  flavor: string
}

/** نوعِ تعامل با فمبوی — از payload interactions (V10: 9 نوع) */
export interface InteractDTO {
  key: "comfort" | "praise" | "talk" | "treat" | "restTogether" | "practice" | "celebrate" | "gift" | "memory"
  icon: string
  label: string
  moneyCost: number
  spiritGain: [number, number]
  bondGain: number
  /** V10 — مرورِ خاطره: بی‌کول‌داونِ بی‌اثرِ مکانیکی، فقط روایت */
  flavorOnly?: boolean
}

/** GET /api/game/character — پیمان نبسته: بسته‌ی کلاس‌ها + طبع‌ها · بسته: کارتِ کامل */
export type CharacterData =
  | { exists: false; classes: ClassCardDTO[]; personas: PersonaCardDTO[]; interactions: InteractDTO[] }
  | {
      exists: true
      card: SoulCardDTO
      logs: CharacterLogDTO[]
      encounter: CombatStateDTO | null
      enemies: EnemyDTO[]
      interactions: InteractDTO[]
    }

/** POST /api/game/character — { message, card } یا { logs } برای اکشنِ logs */
export interface CharacterActionData {
  message?: string
  card?: SoulCardDTO | null
  logs?: CharacterLogDTO[]
  // ── V17-W2: فیلدهایِ عمقِ تعامل که مسیرِ interact از V14 برمی‌گرداند — اختیاری؛
  // مصرف‌کننده‌هایِ قدیمی فقط message/card می‌خوانند و بی‌تغییر می‌مانند ──
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
  /** شمارِ خاطره‌هایِ ذخیره‌شده */
  memory?: { count: number }
  // ── V19: داستانِ شخصی — مسیرِ story فصل/انتخاب را برمی‌گرداند ──
  story?: StoryCardDTO
}

// ─── V8: کارتِ عمومیِ فمبوی (نمایِ ربات؛ فقط با X-Service-Key) ────────────────

/** عنوانِ فعالِ بازیکنِ هدف در کارتِ عمومی */
export interface PublicCardTitleDTO {
  key: string
  name: string
  emoji: string
}

/**
 * GET /api/game/character?targetTelegramId={tgId} — فقط سرویسِ ربات (Mini App: 403).
 * فقط زیرمجموعه‌ی عمومی: هرگز استقامت/روحیه/پیوند/مهارت‌ها/کیف/مسیرهای XP را ندارد.
 * target = null → بازیکنِ هدف هر وارد بازی نشده؛ exists=false → آمده ولی هنوز پیمان نبسته.
 */
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
    /** پایدار: rank_{آستانه‌ی سطح} — مثل rank_1 / rank_5 / rank_10 … */
    rankKey: string
    rankName: string
    rankEmoji: string
    evolution: number
    evolutionName: string
    wins: number
    losses: number
    crits: number
    activeTitle: PublicCardTitleDTO | null
    // ── V10 — هویتِ عمومیِ عمیق: تسلط و ظاهر ──
    mastery: { level: number; emoji: string; label: string }
    accessoryEmoji: string | null
    evolutionPathName: string | null
    /** V8 §24 — آرتِ فُرمِ فعلی (فرگشتِ ≥۲ = پرتره‌ی اختصاصی؛ وگرنه آرتِ کلاس) */
    art?: string | null
    // ── V19: هویتِ عمومیِ طبع/استعداد (عمومی‌اند — شخصیت، راز نیست) ──
    persona: { key: string; emoji: string; name: string; tagline: string } | null
    talent: { key: string; emoji: string; name: string } | null
  } | null
}

/** GET /api/game/combat */
export interface CombatData {
  encounter: CombatStateDTO | null
  card: SoulCardDTO
  enemies: EnemyDTO[]
}

/** POST /api/game/combat — start/act/sweep: { encounter, card } · duel: { duel } */
export interface CombatActionData {
  encounter?: CombatStateDTO | null
  card?: SoulCardDTO
  duel?: DuelResultDTO
}

/** نتیجه‌ی دوئلِ خودکار (PvP — فعلاً فقط ربات) */
export interface DuelResultDTO {
  log: string[]
  winnerName: string
  loserName: string
  winnerIsInitiator: boolean
  rounds: number
  initiatorCard: SoulCardDTO
  foeCard: SoulCardDTO
}
