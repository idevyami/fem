// FEMBOY WAR — V5: The Group as a Living World.
// قرارداد مشترکِ لایه‌ی گروه: انواع محتوا (قالب‌ها) + DTO های API.
// این فایل فقط «نوع» است — برای کلاینت و ربات امن است.

// ─── انواع پایه ────────────────────────────────────────────────────────────────

export type ButtonStyle = "primary" | "success" | "danger"

export type GroupEventKind =
  | "personal" | "social" | "group" | "npc" | "economic" | "political"
  | "meme" | "competition" | "cooperative" | "mystery" | "chaos" | "world"

export type CultureTag =
  | "unset" | "peaceful" | "chaotic" | "competitive" | "social" | "criminal" | "comedic" | "mysterious"

export type RelationshipDim = "friendship" | "rivalry" | "trust" | "hostility" | "cooperation" | "tension"

export type MemberRepDim = "trust" | "fame" | "fear" | "respect" | "chaos" | "humor" | "danger"

/** آمار بازیکن که رویدادهای گروه می‌توانند تغییرشان دهند */
export type GroupPlayerStat =
  | "money" | "xp" | "fame" | "chaos" | "crime" | "reputation" | "luck" | "energy"

// ─── قالب رویداد گروهی ─────────────────────────────────────────────────────────

export interface GroupOutcomeEffects {
  /** روی «محرک» (نخستین انتخاب‌کننده) یا «همه‌ی شرکت‌کنندگان» — آرایه‌ای از تغییرات */
  playerStats?: { stat: GroupPlayerStat; min: number; max: number; scope: "instigator" | "participants" | "random_member" }[]
  treasury?: { min: number; max: number } // تغییر صندوق گروه
  group?: { chaos?: number; socialTemp?: number; reputation?: number; crime?: number; influence?: number }
  relationships?: { dim: RelationshipDim; min: number; max: number; scope: "pair" | "all_pairs" }[]
  memory?: { kind: "moment" | "scandal" | "victory" | "legend"; text: string; importance: number }
  news?: string | null
  rumor?: { text: string; truth: boolean } | null
  clue?: string | null // سرنخ معما — فقط برای یابنده در پی‌وی
  title?: { text: string; chance: number } | null // عنوان فرگت برای محرک
  followUp?: { templateId: string; afterMinutesMin: number; afterMinutesMax: number; chance: number } | null
}

export interface GroupOutcomeTemplate {
  weight: number
  text: string // {p1} {p2} {p3} {npc} {item} {amount} {group} {day} {title}
  effects?: GroupOutcomeEffects
}

export interface GroupEventChoiceTemplate {
  key: string
  label: string // {npc} {item} مجاز
  style: ButtonStyle | null
  outcomes: GroupOutcomeTemplate[] // وزن‌دار
}

export interface GroupEventTemplate {
  id: string
  kind: GroupEventKind
  emoji: string
  title: string // {p1} {p2} {npc} {item} {group}
  body: string // {p1} {p2} {npc} {item} {amount} {group}
  tags: string[]
  minMembers: number
  cooldownMinutes: number // حداقل فاصله تا اجرای دوباره‌ی همین قالب در همین گروه
  weight: number
  requiresRole?: string // مثل mayor (فقط شهردار می‌تواند)
  choices: GroupEventChoiceTemplate[]
}

// ─── قالب بازی اجتماعی ─────────────────────────────────────────────────────────

export type GamePhaseKind = "lobby" | "quiz" | "vote" | "bidding" | "brief" | "done"

export interface QuizQuestion {
  text: string
  answers: string[] // برچسب‌ها (بدون کلید — index کلید است)
  weights?: number[] // وزن هر جواب برای امتیاز (اختیاری؛ پیش‌فرض مساوی)
}

export interface GameRoleDef {
  key: string
  label: string // نقش در بازی (مثل نقش‌های سرقت)
  brief: string // بریف مخفیانه‌ای که در پی‌وی می‌رود
}

export interface GameDef {
  key: string
  name: string
  emoji: string
  tagline: string
  tags: string[]
  minPlayers: number
  maxPlayers: number | null
  joinWindowMinutes: number
  actionWindowMinutes: number // مهلت رأی/پاسخ/پیشنهاد
  cooldownMinutes: number
  /** چه کسانی گزینه‌ی رأی‌اند: اعضای بازی / همه‌ی اعضای گروه / گزینه‌های ثابت */
  candidatesFrom: "players" | "members" | "options"
  /** سؤالات کوییز (femboy_test, guess_player, truth_or_lie...) */
  quiz?: { pickCount: number; questions: QuizQuestion[] }
  /** گزینه‌های ثابت رأی (وقتی candidatesFrom=options) */
  options?: { key: string; label: string; style: ButtonStyle | null }[]
  /** نقش‌های نامتقارن (heist, social_deduction, treasure_hunt) */
  roles?: GameRoleDef[]
  /** پاداش: [min,max] برای برنده / همه‌ی شرکت‌کنندگان */
  rewardWinner?: [number, number]
  rewardAll?: [number, number]
  /** نتایج باید رابطه/اعتبار اجتماعی تغییر دهند */
  social: {
    winnerRep?: { dim: MemberRepDim; amount: number }
    loserRep?: { dim: MemberRepDim; amount: number }
    relationship?: { dim: RelationshipDim; amount: number; scope: "all_pairs" | "pairs" }
  }
  /** متن کارت شروع/نتیجه — {game} {n} {players} {winner} {amount} {group} */
  introText: string
  resultText: string
  /** وزن انتخاب وقتی گروه بازی می‌خواهد */
  weight: number
}

// ─── نقش‌های سیاسی گروه ────────────────────────────────────────────────────────

export interface GroupRoleDef {
  key: string
  name: string
  emoji: string
  description: string
  powers: string[] // توضیح فارسیِ قدرت‌ها
  salary: number // حقوق هفتگی از صندوق
  electionWeight: number // شانس کاندید شدن در رویدادها
}

// ─── پروژه‌های گروهی ───────────────────────────────────────────────────────────

export interface GroupProjectTemplate {
  key: string
  name: string
  emoji: string
  description: string
  benefit: string // چه چیزی باز می‌کند
  cost: number
  /** اثر واقعی روی وزن رویدادها/بازی‌ها */
  eventBoost?: { tag: string; mult: number }[]
  gameUnlocks?: string[]
  treasuryPerDay: number // درآمد روزانه برای صندوق
}

// ─── میم / شایعه / معما / دستاورد ─────────────────────────────────────────────

export interface MemeTemplate {
  key: string
  signal: string // واژه/ایموجی محرک (مثل "قورباغه" یا "🐸")
  emoji: string
  /** قالب جمله — {p} بازیکن مرتبط، {n} تکرار */
  lines: string[]
  /** وقتی میم «رسید» (confidence بالا) چه می‌شود */
  materialize: { kind: "title" | "event" | "npc" | "item"; text: string }
}

export interface RumorTemplate {
  key: string
  /** قالبِ درست — {p} بازیکن، {item}، {amount}، {npc} */
  truth: string
  /** قالبِ نادرست */
  lie: string
  tags: string[]
}

export interface MysteryThread {
  key: string
  title: string
  emoji: string
  hook: string
  /** ۵ سرنخ — متن‌های {p1}-دار */
  clues: string[]
  resolution: string
}

export interface GroupAchievementDef {
  key: string
  name: string
  emoji: string
  description: string
}

// ─── DTO های API گروه (Mini App + ربات) ───────────────────────────────────────

export interface OutboxButtonDTO {
  label: string
  style: ButtonStyle | null
  cb?: string // callback data
  url?: string
  /** V15-1 — نشانه‌ی چیدمانِ فشرده: true یعنی «این دکمه در ردیفِ قبلی بنشین»
   *  (شبکه‌ی ۲ستونه‌ی منوی ۱۲-بخشیِ شهر). افزودنیِ اختیاری است: ترنسپورتِ امروزِ
   *  ربات فیلدهای ناشناخته را بی‌صدا رد می‌کند (هر دکمه ردیفِ خودش) و دکمه‌ها
   *  همان‌قدر کار می‌کنند؛ موجِ V15-2 ربات این نشانه را در outboxKeyboard اجرا
   *  می‌کند تا گریدِ موبایلی واقعی شود. موتور «قصدِ چیدمان» را اعلام می‌کند. */
  sameRow?: boolean
}

/** نامِ کوتاهِ داخلی برای دکمه‌های تولیدی موتور */
export type OutboxButton = OutboxButtonDTO

export interface OutboxMessageDTO {
  outboxId: string
  chatId: string
  text: string
  kind: string
  buttons: OutboxButtonDTO[]
  editMessageId?: string | null
}

export interface GroupEventChoiceDTO {
  key: string
  label: string
  style: ButtonStyle | null
  voters: number
}

export interface GroupEventDTO {
  id: string
  emoji: string
  title: string
  body: string
  kind: string
  kindLabel: string
  status: string
  participantsCount: number
  choices: GroupEventChoiceDTO[]
  expiresAt: string | null
  createdAt: string
  /** V17-W3 (W3-F2) — کلیدِ انتخابِ بیننده در همین رویدادِ باز؛ null = هنوز انتخاب
   *  نکرده. مینی‌اپ با همین فیلد دکمه‌ی انتخاب‌شده را علامت می‌زند — همان چیزی که
   *  رباتِ گروه از پنلِ ge: می‌دهد، حالا در خودِ مینی‌اپ (Journey G، §10/§18). */
  myChoice: string | null
}

export interface GameSessionDTO {
  id: string
  gameKey: string
  name: string
  emoji: string
  phase: string
  phaseLabel: string
  status: string
  participants: { playerId: string; name: string; avatar: string }[]
  subject: string
  closesAt: string | null
  createdAt: string
}

export interface GroupVoteDTO {
  id: string
  kind: string
  subject: string
  options: { key: string; label: string; style: ButtonStyle | null; count: number; voted: boolean }[]
  closesAt: string
  myVote: string | null
}

export interface GroupRumorDTO {
  id: string
  text: string
  truthOddsLabel: string
  spreadCount: number
  createdAt: string
}

export interface GroupMemeDTO {
  id: string
  emoji: string
  text: string
  confidence: number
  usageCount: number
}

export interface GroupProjectDTO {
  id: string
  key: string
  name: string
  emoji: string
  description: string
  benefit: string
  goal: number
  contributed: number
  myContribution: number
  status: string
}

export interface GroupMysteryDTO {
  id: string
  title: string
  emoji: string
  status: string
  progress: number
  cluesTotal: number
  hook: string
}

export interface GroupMemberDTO {
  playerId: string
  name: string
  avatar: string
  role: string | null
  roleLabel: string | null
  roleEmoji: string | null
  title: string | null
  rep: { fame: number; trust: number; chaos: number }
  messageCount: number
  gameCount: number
  winCount: number
  lastSeenAt: string
  onlineLabel: string
}

export interface GroupHistoryDTO {
  id: string
  icon: string
  text: string
  createdAt: string
}

// ─── V13 موجِ ۲: دعوتِ دوئل + تنظیماتِ ادمین (افزودنی — Mini App نادیده می‌گیرد) ──

/** دعوتِ دوئلِ گروهی — فقط میدان‌های نمایشی؛ تلگرام‌آی‌دی هرگز بیرون نمی‌رود */
export interface GroupChallengeDTO {
  id: string
  status: string // pending|accepted|declined|cancelled|expired|resolved
  challengerName: string
  targetName: string
  /** نقشِ بیننده در این دعوت — contextual keyboard برای هدف/مهاجم (V13 §6.3) */
  myRole: "challenger" | "target" | null
  winnerName: string | null
  expiresAt: string
  createdAt: string
}

/** تنظیماتِ ادمینِ گروه — settingsJson روی GroupWorld (پیش‌فرض‌ها: باز/عادی/عادی) */
export interface GroupSettingsDTO {
  enabled: boolean
  noise: "normal" | "quiet" | "silent"
  eventFreq: "off" | "rare" | "normal"
}

export interface GroupSnapshotDTO {
  exists: boolean
  chatId: string
  title: string
  district: string
  districtName: string
  districtEmoji: string
  moodLabel: string
  moodEmoji: string
  state: string
  stateLabel: string
  weatherLabel: string
  weatherEmoji: string
  cultureTag: string
  cultureLabel: string
  cultureEmoji: string
  cultureLine: string
  chaos: number
  socialTemp: number
  socialTempLabel: string
  treasury: number
  reputationLabel: string
  population: number
  activePlayers: number
  mayor: { name: string; avatar: string } | null
  roles: { key: string; name: string; emoji: string; holder: string | null }[]
  currentEvent: GroupEventDTO | null
  activeGame: GameSessionDTO | null
  openVotes: GroupVoteDTO[]
  members: GroupMemberDTO[]
  history: GroupHistoryDTO[]
  rumors: GroupRumorDTO[]
  memes: GroupMemeDTO[]
  projects: GroupProjectDTO[]
  mysteries: GroupMysteryDTO[]
  achievements: GroupAchievementDef[]
  achievementsUnlocked: string[]
  /** V14 Task 15b — شمارِ دستاوردهای بازشده (راحتِ رندر؛ برابرِ طولِ achievementsUnlocked) */
  achievementsUnlockedCount?: number
  /** دعوت‌های دوئلِ بازِ گروه (موجِ ۲؛ افزودنی — خواننده‌های کهنه نادیده می‌گیرند) */
  challenges?: GroupChallengeDTO[]
  whatsHappening: string
  whyComeBack: string
  serverTime: string
}

export interface GroupHomeCardDTO {
  text: string
  buttons: OutboxButtonDTO[]
}

export interface ObserveResponseDTO {
  action: "none" | "reply" | "react"
  text?: string
  buttons?: OutboxButtonDTO[]
}

export interface GroupTickResponseDTO {
  messages: OutboxMessageDTO[]
  groupsTicked: number
}

export interface GroupActionResponseDTO {
  ok: boolean
  message: string
  flavor?: string
  snapshot?: GroupSnapshotDTO
}

export interface MyGroupsDTO {
  groups: {
    chatId: string
    title: string
    cultureLabel: string
    cultureEmoji: string
    moodEmoji: string
    population: number
    isMember: boolean
  }[]
}
