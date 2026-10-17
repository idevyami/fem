"use client"
// FEMBOY WAR — Mini App API client (typed, fetch-based)
// همه‌ی درخواست‌ها relative و به پورت 3000 (همان origin) هستند.
//
// V16-2 (ممیزیِ ⑦ — مدلِ خطا): قبلاً هر خطایی — از 401ِ نشست تا قطعِ شبکه — به یک
// رشته‌ی عمومی «شهری جوابی نداد» فرو می‌ریخت و کلاینت کور بود. حالا post/get
// خطا را رده‌بندی می‌کند و ApiErr را با code/status/retryAfterSec برمی‌گرداند:
//   · 401/403 نشست → رویدادِ session-expired (GameShell شیتِ «ادامه بده» را می‌آورد)
//   · 429 نرخ → لحنِ «کدکس نفس می‌خواهد…» + ثانیه‌های انتظار اگر معلوم باشد
//   · 5xx/شبکه/پاسخِ HTML → «شهر الان جواب نمی‌دهد» + راهنمایِ کوتاهِ عملی
//   · تایم‌اوت (AbortSignal) → پیامِ متمایزِ «دیر جواب می‌دهد»
//   · خطاهای 4xxِ موتور → همان صدای فارسیِ خودِ موتور، دست‌نخورده
// امضایِ متدها عقب‌سازگار مانده (همه‌ی اسکرین‌ها ApiResult می‌خوانند).

import type {
  ApiResult,
  AuthResponse,
  GameSnapshot,
  EventResponse,
  ChooseResponse,
  ActionResponse,
  MarketSnapshot,
  HistoryResponse,
  ProfileResponse,
  LeaderboardResponse,
  HistoryItemDTO,
  GuideResponse,
  CityNewsResponse,
  CharacterData,
  CharacterActionData,
  CombatData,
  CombatActionData,
  HallDTO,
} from "./contract"
import type { GroupActionResponseDTO, GroupSnapshotDTO } from "./group/types"

/** چیزِ کوچکِ گروه در لیستِ «گروه‌های من» */
export interface GroupChipDTO {
  chatId: string
  title: string
  cultureLabel: string
  cultureEmoji: string
  moodEmoji: string
  population: number
  isMember: boolean
}

/** بازیِ قابلِ اجرا در گروه — ok/why از موتور می‌آید */
export interface GroupGameInfo {
  key: string
  name: string
  emoji: string
  tagline: string
  ok: boolean
  why: string
}

// ─── V14 موجِ 16b: کدکسِ راهنما (server-side help codex → Mini App) ──────────

/** دسته‌ی کدکس — سطحِ یک */
export interface HelpCategoryDTO {
  id: string
  icon: string
  titleFa: string
  titleEn: string
  descFa: string
  topicCount: number
}

/** موضوعِ کدکس در یک نگاه — بدونِ بلوک‌ها */
export interface HelpTopicStubDTO {
  id: string
  cat: string
  icon: string
  titleFa: string
  titleEn: string
  summaryFa: string
}

/** عبارتِ طبیعیِ پشتیبانی‌شده — عینِ همان که ربات می‌شناسد */
export interface HelpPhraseDTO {
  fa: string
  en?: string
  where: "private" | "group" | "both"
}

/** پاسخِ موضوع با صفحه‌بندیِ سمتِ سرور */
export interface HelpTopicPageDTO {
  topic: HelpTopicStubDTO & {
    /** موضوع‌های مرتبط — حل‌شده به stub تا چیپِ پرش ساخته شود */
    related: { id: string; icon: string; titleFa: string; summaryFa: string }[]
    phrases: HelpPhraseDTO[]
    examples: string[]
  }
  blocks: { h?: string; lines: string[] }[]
  page: number
  pageCount: number
}

/** نتیجه‌ی جست‌وجوی کدکس */
export interface HelpSearchResultDTO {
  id: string
  icon: string
  titleFa: string
  summaryFa: string
  matchedOn: "title" | "summary" | "phrase"
}

/** پاسخِ /api/group/snapshot — دنیای زنده‌ی گروه + لیست گروه‌ها + بازی‌ها */
export interface GroupScreenData {
  groups: GroupChipDTO[]
  snapshot: GroupSnapshotDTO | null
  games: GroupGameInfo[]
}

// ─── V16-2: لایه‌ی نقلیِ رده‌بندی‌شده (ممیزیِ ⑦) ─────────────────────────────

/** حداکثر انتظار برای یک پاسخ — بعدش «دیر جواب می‌دهد» */
const REQUEST_TIMEOUT_MS = 20000

/** صدایِ عمومیِ شهرِ خاموش — 5xx/شبکه/HTML */
const SERVER_DOWN_MSG = "شهر الان جواب نمی‌دهد — چند لحظه بعد دوباره امتحان کن."
/** صدایِ متمایزِ تایم‌اوت */
const TIMEOUT_MSG = "پاسخِ شهر این‌بار دیر آمد — یک بارِ دیگر امتحان کن."
/** صدایِ ۴۲۹ وقتی خودِ بدنه چیزی نگفته */
const RATE_MSG = "کدکس نفس می‌خواهد — چند لحظه بعد دوباره امتحان کن."
/** صدایِ ۴۰۱ وقتی بدنه چیزی نگفته */
const SESSION_MSG = "نشستت منقضی شد."

// ─── رویدادِ نشستِ منقضی (401) — GameShell گوش می‌دهد و شیتِ «ادامه بده» را می‌آورد ───

type SessionExpiredCb = () => void
const sessionExpiredCbs = new Set<SessionExpiredCb>()
/** ضدِ طوفانِ 401: تا ۴ ثانیه فقط یک بار رویداد شلیک می‌شود */
let lastSessionNotifyAt = 0

/** ثبتِ شنونده‌ی «نشست منقضی شد» — خروجی، تابعِ لغوِ ثبت است */
export function onSessionExpired(cb: SessionExpiredCb): () => void {
  sessionExpiredCbs.add(cb)
  return () => sessionExpiredCbs.delete(cb)
}

function notifySessionExpired(): void {
  const now = Date.now()
  if (now - lastSessionNotifyAt < 4000) return
  lastSessionNotifyAt = now
  for (const cb of sessionExpiredCbs) {
    try {
      cb()
    } catch {
      // شنونده‌ی خراب نباید بقیه را بشکند
    }
  }
}

/** آیا این وضعیت/کد یعنی «نشست نیست»؟ (resolveCaller → 401 unauthorized) */
function isSessionGone(status: number, code?: string): boolean {
  // login_failed یعنی «تلاشِ ورود ناموفق»، نه «نشستِ وسطِ بازی مُرد» — شیت نمی‌آورد
  if (status === 401) return code === undefined || code === "unauthorized"
  return status === 403 && code === "unauthorized"
}

/** ثانیه‌های انتظار از بدنه یا از متنِ فارسیِ پیام («N ثانیه صبر کن») */
function parseRetryAfter(body: Record<string, unknown> | undefined, message: string): number | undefined {
  for (const raw of [body?.retryAfter, body?.retryAfterSec]) {
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
    if (Number.isFinite(n) && n > 0) return Math.ceil(n)
  }
  const m = /(\d+)\s*ثانیه/.exec(message)
  if (m) return Number(m[1])
  return undefined
}

/**
 * رده‌بندیِ پاسخِ غیر-OK به ApiErr — صدای فارسی درست + code/status.
 * `body` همان JSONِ خوانده‌شده است (وقتی بدنه HTML/خراب باشد undefined).
 */
function classifyErr(res: Response, body: Record<string, unknown> | undefined): ApiResult<never> {
  const status = res.status
  const bodyErr = typeof body?.error === "string" ? body.error : undefined
  const code = typeof body?.code === "string" ? body.code : undefined

  // نشست — مهم‌ترین حالت: رویداد شلیک می‌شود تا پوسته، شیتِ بازیابی بیاورد
  if (isSessionGone(status, code)) {
    notifySessionExpired()
    return { ok: false, error: bodyErr ?? SESSION_MSG, code: code ?? "unauthorized", status }
  }

  // نرخ‌گذاری — لحنِ «کدکس نفس می‌خواهد»؛ صدای خودِ سرور (با ثانیه‌ها) اگر باشد برتری دارد
  if (status === 429 || code === "rate_limited") {
    const message = bodyErr ?? RATE_MSG
    return { ok: false, error: message, code: code ?? "rate_limited", status, retryAfterSec: parseRetryAfter(body, message) }
  }

  // سرور/HTML — پیامِ خودمان با راهنمایِ عملی؛ پیامِ ۵xxِ سرور («حتی ما هم…») ارزشِ تکرار ندارد
  if (status >= 500 || !body) {
    return { ok: false, error: SERVER_DOWN_MSG, code: code ?? (status >= 500 ? "server" : "network"), status }
  }

  // خطای 4xxِ موتور — همان صدای فارسیِ خودِ موتور (این شغلِ موتور است، نه خرابیِ شهر)
  return { ok: false, error: bodyErr ?? SERVER_DOWN_MSG, code: code ?? `http_${status}`, status }
}

/** هسته‌ی نقلی — POST/GET با تایم‌اوت، تشخیصِ HTML و رده‌بندیِ خطا */
async function request<T>(path: string, method: "POST" | "GET", body?: Record<string, unknown>): Promise<ApiResult<T>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: ctrl.signal,
    })
  } catch (e) {
    // تایم‌اوتِ خودمان → پیامِ متمایز؛ بقیه‌ی اختلال‌ها → شهرِ خاموش
    const timedOut = e instanceof DOMException && (e.name === "AbortError" || e.name === "TimeoutError")
    return { ok: false, error: timedOut ? TIMEOUT_MSG : SERVER_DOWN_MSG, code: timedOut ? "timeout" : "network" }
  } finally {
    clearTimeout(timer)
  }

  // بدنه‌ی غیر-JSON (صفحه‌ی خطایِ HTMLِ dev/پروکسی) → بدونِ json() خوردن
  const ct = res.headers.get("content-type") ?? ""
  if (!ct.includes("json")) {
    return classifyErr(res, undefined)
  }
  let json: unknown
  try {
    json = await res.json()
  } catch {
    return classifyErr(res, undefined)
  }

  // قراردادِ سرور: { ok: true, data } | { ok: false, error, code }
  const envelope = json as { ok?: unknown; data?: unknown; error?: unknown; code?: unknown }
  if (res.ok && envelope?.ok === true) {
    return { ok: true, data: envelope.data as T }
  }
  if (res.ok && envelope?.ok === false) {
    // 200 با ok:false — موتور گفته «نشد»؛ همان صدای خودش
    const err = typeof envelope.error === "string" ? envelope.error : SERVER_DOWN_MSG
    return { ok: false, error: err, code: typeof envelope.code === "string" ? envelope.code : "engine" }
  }
  if (!res.ok) {
    return classifyErr(res, envelope)
  }
  // شکلِ ناشناخته — محتاطانه
  return { ok: false, error: SERVER_DOWN_MSG, code: "bad_envelope" }
}

async function post<T>(path: string, body?: Record<string, unknown>): Promise<ApiResult<T>> {
  return request<T>(path, "POST", body)
}

/** GET هم‌شکلِ post — همان ApiResult، همان رده‌بندیِ خطا */
async function get<T>(path: string): Promise<ApiResult<T>> {
  return request<T>(path, "GET")
}

export interface CatalogResponse {
  districts: {
    key: string
    name: string
    emoji: string
    description: string
    mood: string
    risk: number
    playerCount: number
    activeFlavor: string | null
  }[]
  currentDistrict: string
  jobs: {
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
  }[]
  vehicles: {
    key: string
    name: string
    emoji: string
    rarity: string
    basePrice: number
    speed: number
    description: string
    quirk: string
  }[]
  houses: {
    key: string
    name: string
    emoji: string
    price: number
    rent: number
    comfort: number
    security: number
    description: string
  }[]
  economyIndex: number
}

export interface AuthRequest {
  initData?: string
  name?: string
  avatar?: string
}

export interface LoginFull extends AuthResponse {
  snapshot: GameSnapshot
}

export const api = {
  login: (body: AuthRequest) => post<LoginFull>("/api/auth", body as Record<string, unknown>),
  state: () => post<{ snapshot: GameSnapshot }>("/api/game/state"),
  drawEvent: () => post<EventResponse>("/api/game/event"),
  choose: (eventId: string, optionIndex: number) => post<ChooseResponse>("/api/game/choose", { eventId, optionIndex }),
  action: (action: string, payload?: Record<string, unknown>) => post<ActionResponse>("/api/game/action", { action, payload }),
  market: () => post<MarketSnapshot>("/api/game/market"),
  catalog: () => post<CatalogResponse>("/api/game/catalog"),
  history: (cursor = 0, limit = 25) =>
    post<{ items: HistoryItemDTO[]; hasMore: boolean; nextCursor: number }>("/api/game/history", { cursor, limit }),
  profile: (playerId?: string) => post<ProfileResponse | null>("/api/game/profile", playerId ? { playerId } : {}),
  leaderboard: () => post<LeaderboardResponse>("/api/game/leaderboard"),
  guide: () => post<GuideResponse>("/api/game/guide"),
  citynews: () => post<CityNewsResponse>("/api/game/citynews"),
  // ─── V5: شهرِ گروه ───
  groupSnapshot: (chatId?: string) => post<GroupScreenData>("/api/group/snapshot", chatId ? { chatId } : {}),
  groupAction: (chatId: string, action: string, payload?: Record<string, unknown>) =>
    post<GroupActionResponseDTO>("/api/group/action", { chatId, action, payload: payload ?? {} }),
  // ─── V7/V8: فمبویِ روح‌بسته ───
  character: () => get<CharacterData>("/api/game/character"),
  characterAction: (action: string, payload?: Record<string, unknown>) =>
    post<CharacterActionData>("/api/game/character", { action, payload: payload ?? {} }),
  combat: () => get<CombatData>("/api/game/combat"),
  combatAction: (action: string, payload?: Record<string, unknown>) =>
    post<CombatActionData>("/api/game/combat", { action, payload: payload ?? {} }),
  hall: (board: string) => get<HallDTO>(`/api/game/character/hall?board=${encodeURIComponent(board)}`),
  // ─── V14 موجِ 16b: کدکسِ راهنما ───
  helpCategories: () => post<{ categories: HelpCategoryDTO[] }>("/api/game/help", { action: "categories" }),
  helpTopics: (categoryId: string) =>
    post<{ category: { id: string; icon: string; titleFa: string; descFa: string }; topics: HelpTopicStubDTO[] }>(
      "/api/game/help",
      { action: "topics", categoryId },
    ),
  helpTopic: (id: string, page = 0) => post<HelpTopicPageDTO>("/api/game/help", { action: "topic", id, page }),
  helpSearch: (q: string) => post<{ results: HelpSearchResultDTO[] }>("/api/game/help", { action: "search", q }),
}

export { post as apiPost }
