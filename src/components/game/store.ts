"use client"

// استور مرکزی بازی — تنها منبع حقیقت: snapshot
import { create } from "zustand"
import { api } from "@/lib/game/client"
import type { GroupScreenData } from "@/lib/game/client"
import type { ActionResponse, GameSnapshot, GuideResponse } from "@/lib/game/contract"
import { haptic, hapticNotify } from "./telegram"

export type TabKey = "home" | "soul" | "city" | "group" | "bag" | "market" | "me"

export type ToastKind = "success" | "error" | "voice"

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

let toastSeq = 0

interface GameState {
  snapshot: GameSnapshot | null
  setSnapshot: (s: GameSnapshot) => void
  /** راهنمای V4 — مقطع/مسیر/هدف‌ها/فرصت‌ها/قدم‌ بعدی (null = هنوز نیامده؛ کارت بی‌صدا قایم می‌شود) */
  guide: GuideResponse | null
  setGuide: (g: GuideResponse | null) => void
  /** خاموش کردن رکاپ آفلاین بعد از دیدن */
  clearOfflineRecap: () => void
  activeTab: TabKey
  setActiveTab: (tab: TabKey) => void
  /** V16-2 (ممیزیِ ⑮): پشته‌ی تب‌های قبلی — دکمه‌ی برگشتِ تلگرام به‌جای «همیشه خانه»، مسیرِ واقعی را برمی‌گرداند */
  tabStack: TabKey[]
  /** برگشتِ یک قدم در تاریخِ تب‌ها — پشته‌ی خالی → خانه. برگشت، خودش در تاریخ ثبت نمی‌شود */
  goBackTab: () => void
  /** V16-2 (ممیزیِ ⑧): نسخه‌ی دنیا — فقط با اکشن/رویدادِ موفق بالا می‌رود؛
   *  پیشخوان (راهنما + آخرین خبر) به‌جای هر تیکِ serverTime به این وابسته است */
  worldVersion: number
  bumpWorld: () => void
  /** V16-2 (ممیزیِ ⑦): شماره‌ی تازه‌سازیِ صفحه‌ها — بعد از بازیابیِ نشست بالا می‌رود؛
   *  اسکرین‌های دارایِ لودرِ خودشان (من/فمبوی/بازار/شهر) به آن وابسته‌اند تا همان صفحه تازه شود */
  reloadSeq: number
  requestReload: () => void
  toasts: ToastItem[]
  toast: (kind: ToastKind, title: string, description?: string) => void
  dismissToast: (id: number) => void
  /** اجرای اکشن سرور + به‌روزرسانی snapshot + توست خودکار. true یعنی موفق */
  runAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>
  /** V17-W2 (F1) — نتیجه‌ی آخرین اکشنِ پیشخوان: کارتِ نتیجه‌ی درون‌صفحه‌ای.
   *  V17-W3 (F1): دیگر فقطِ خانه نیست — خرید/فروش/پس‌دادنِ بدهی هم از مسیرِ
   *  runActionReveal می‌روند و کارت را در جایگاهِ خودِ صفحه‌شان می‌گیرند
   *  (بازار/کیف/من). هر صفحه با ترکِ تب کارتِ خودش را جمع می‌کند؛ null = کارتی نیست. */
  actionOutcome: ActionResponse | null
  setActionOutcome: (o: ActionResponse | null) => void
  /** V17-W2 (F1) — اکشنِ پیشخوان با کارتِ نتیجه: موفقیتِ همراهِ دلتا → کارت (بدونِ توستِ
   *  تکراریِ همان متن)؛ موفقیتِ بی‌دلتا → همان توستِ همیشگی؛ خطا → توستِ خطا.
   *  پاسخِ کامل برمی‌گردد (شیءِ truthy) تا مصرف‌کننده‌های بولی‌مانند بی‌تغییر کار کنند؛ null = شکست. */
  runActionReveal: (action: string, payload?: Record<string, unknown>) => Promise<ActionResponse | null>
  /** تازه‌سازی snapshot از سرور */
  refresh: () => Promise<boolean>
  /** V17-W3 (F5) — سکشنِ مقصدِ تبِ فمبوی (deep-link): CTAهای بیرونی (مسیرِ زندگی،
   *  کارتِ فمبویِ پیشخوان، کارت‌های نتیجه) قبل از رفتن به تبِ فمبوی ستش می‌کنند و
   *  SoulScreen هنگامِ ورود مصرفش می‌کند — فقط کلیدِ سکشن‌های موجود، صفحه‌ی تازه نه.
   *  null = ورودِ عادی (سکشنِ آخرِ خودِ صفحه). */
  pendingSoulSection: string | null
  setPendingSoulSection: (s: string | null) => void
  /** V17-W3 (hotfixِ runNext): شیتِ مقصدِ تبِ «من» (deep-link) — «بدهی‌ات را پس
   *  بده» از مسیرِ زندگی به‌جایِ شلیکِ بی‌مبلغ (که موتور ۱ سکه می‌پرداخت!) به
   *  شیتِ مبلغ می‌رود؛ null = ورودِ عادی. فقط کلیدهای شیت‌های موجود. */
  pendingMeSheet: "debt" | null
  setPendingMeSheet: (s: "debt" | null) => void
  // ─── V6: قولِ بازی روی این دستگاه ───
  /** درخواستِ پخشِ دوباره‌ی اینترو از تبِ «من» — GameShell مصرفش می‌کند */
  replayIntro: boolean
  requestIntroReplay: () => void
  consumeIntroReplay: () => void
  /** کارتِ «برگشتی» — یک بار در هر جلسه برای بازیکنِ برگشته (بدون ماندگاری) */
  returningWelcome: boolean
  markReturningWelcome: () => void
  dismissReturningWelcome: () => void
  // ─── V5: شهرِ گروه ───
  /** دنیای زنده‌ی گروهِ انتخابی (null = هنوز واکشی نشده) */
  groupData: GroupScreenData | null
  groupLoading: boolean
  groupError: string | null
  /** گروهِ انتخابی — در localStorage ماندگار است */
  selectedChatId: string | null
  setSelectedChatId: (chatId: string | null) => void
  /** واکشیِ دنیای گروه — بدون chatId یعنی «گروه‌های من» */
  loadGroup: (chatId?: string | null) => Promise<boolean>
  /** اکشن روی گروه (vote/joinGame/…) + توست + تازه‌سازی. true یعنی موفق */
  runGroupAction: (action: string, payload?: Record<string, unknown>) => Promise<boolean>
}

export const useGame = create<GameState>((set, get) => ({
  snapshot: null,
  setSnapshot: (s) => set({ snapshot: s }),
  guide: null,
  setGuide: (g) => set({ guide: g }),
  clearOfflineRecap: () =>
    set((st) => (st.snapshot ? { snapshot: { ...st.snapshot, offlineRecap: null } } : {})),
  activeTab: "home",
  // پشته‌ی تاریخِ تب — سقفِ ۳۰ قدم؛ رفت‌وبرگشتِ طولانی طوفان نمی‌سازد
  tabStack: [],
  setActiveTab: (tab) =>
    set((st) => {
      if (st.activeTab === tab) return st
      return { activeTab: tab, tabStack: [...st.tabStack.slice(-29), st.activeTab] }
    }),
  goBackTab: () => {
    const st = get()
    if (st.tabStack.length === 0) {
      if (st.activeTab !== "home") set({ activeTab: "home" })
      return
    }
    const prev = st.tabStack[st.tabStack.length - 1] as TabKey
    set({ activeTab: prev, tabStack: st.tabStack.slice(0, -1) })
  },
  worldVersion: 0,
  bumpWorld: () => set((st) => ({ worldVersion: st.worldVersion + 1 })),
  reloadSeq: 0,
  requestReload: () => set((st) => ({ reloadSeq: st.reloadSeq + 1 })),
  toasts: [],
  toast: (kind, title, description) => {
    const id = ++toastSeq
    set((st) => ({ toasts: [...st.toasts.slice(-2), { id, kind, title, description }] }))
    // هپتیکِ نوتیفیکیشن: موفق/خطا نتیجه را می‌گویند؛ خنثی فقط یک ضربه‌ی سبک می‌زند
    if (kind === "success") hapticNotify("success")
    else if (kind === "error") hapticNotify("error")
    else haptic("light")
    if (typeof window !== "undefined") {
      window.setTimeout(() => get().dismissToast(id), 3500)
    }
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  // ─── V6: قولِ بازی روی این دستگاه ───
  replayIntro: false,
  requestIntroReplay: () => set({ replayIntro: true }),
  consumeIntroReplay: () => set({ replayIntro: false }),
  returningWelcome: false,
  markReturningWelcome: () => set({ returningWelcome: true }),
  dismissReturningWelcome: () => set({ returningWelcome: false }),
  runAction: async (action, payload) => {
    const res = await api.action(action, payload)
    if (res.ok) {
      get().setSnapshot(res.data.snapshot)
      // V16-2 (ممیزیِ ⑧): اکشن تمام شد — دنیا نسخه می‌گیرد تا پیشخوان (راهنما/آخرین خبر) تازه شود
      get().bumpWorld()
      if (res.data.message) {
        get().toast("success", res.data.message, res.data.flavor ?? undefined)
      }
      return true
    }
    get().toast("error", res.error)
    return false
  },
  // ─── V17-W2 (F1): اکشن‌های پیشخوان با انکشافِ نتیجه ───
  actionOutcome: null,
  setActionOutcome: (o) => set({ actionOutcome: o }),
  runActionReveal: async (action, payload) => {
    const res = await api.action(action, payload)
    if (!res.ok) {
      get().toast("error", res.error)
      return null
    }
    get().setSnapshot(res.data.snapshot)
    // دنیا نسخه می‌گیرد تا پیشخوان (راهنما/آخرین خبر/فرصت‌ها) تازه شود
    get().bumpWorld()
    if (res.data.deltas.length > 0) {
      // کارتِ نتیجه خودش پیام را کامل می‌گوید — توستِ موفقیتِ همان متن تکرار نمی‌شود؛
      // فقط هپتیکِ موفقیتِ همیشگی می‌ماند (بازخوردِ لمسی حفظ شد)
      hapticNotify("success")
      get().setActionOutcome(res.data)
    } else if (res.data.message) {
      // اکشنِ بی‌دلتا چیزی برای کارت ندارد — همان توستِ همیشگی
      get().toast("success", res.data.message, res.data.flavor ?? undefined)
    }
    return res.data
  },
  refresh: async () => {
    const res = await api.state()
    if (res.ok) {
      get().setSnapshot(res.data.snapshot)
      return true
    }
    return false
  },
  // ─── V17-W3 (F5): deep-linkِ سکشنِ تبِ فمبوی ───
  pendingSoulSection: null,
  setPendingSoulSection: (s) => set({ pendingSoulSection: s }),
  pendingMeSheet: null,
  setPendingMeSheet: (s) => set({ pendingMeSheet: s }),
  // ─── V5: شهرِ گروه ───
  groupData: null,
  groupLoading: false,
  groupError: null,
  selectedChatId: readStoredChatId(),
  setSelectedChatId: (chatId) => {
    writeStoredChatId(chatId)
    set({ selectedChatId: chatId })
  },
  loadGroup: async (chatId) => {
    const target = chatId !== undefined && chatId !== null ? chatId : get().selectedChatId
    set({ groupLoading: true, groupError: null })
    const res = await api.groupSnapshot(target ?? undefined)
    if (!res.ok) {
      set({ groupLoading: false, groupError: res.error })
      return false
    }
    const groups = res.data.groups
    const stillMine = target ? groups.some((g) => g.chatId === target) : false
    if (target && stillMine) {
      set({ groupData: res.data, groupLoading: false })
      return true
    }
    // گروهِ انتخابی دیگر مالِ تو نیست (یا هنوز چیزی انتخاب نشده) — اولین گروهِ من
    const next = groups[0]?.chatId ?? null
    if (next) {
      get().setSelectedChatId(next)
      const r2 = await api.groupSnapshot(next)
      if (r2.ok) {
        set({ groupData: r2.data, groupLoading: false })
        return true
      }
      set({ groupLoading: false, groupError: r2.error })
      return false
    }
    // هیچ گروهی نیست — حالتِ خالی
    if (get().selectedChatId) get().setSelectedChatId(null)
    set({ groupData: res.data, groupLoading: false })
    return true
  },
  runGroupAction: async (action, payload) => {
    const chatId = get().selectedChatId
    if (!chatId) {
      get().toast("error", "هنوز گروهی انتخاب نشده.")
      return false
    }
    const res = await api.groupAction(chatId, action, payload)
    if (res.ok) {
      const d = res.data
      get().toast(d.ok ? "success" : "error", d.message, d.flavor ?? undefined)
      // دنیا زنده است — تازه‌اش کن
      await get().loadGroup(chatId)
      return d.ok
    }
    get().toast("error", res.error)
    return false
  },
}))

// ─── ماندگاریِ گروهِ انتخابی ────────────────────────────────────────────

const CHAT_ID_KEY = "femwar.group.chatId"

// ─── V16-2 (ممیزیِ ⑦): هویتِ آخرینِ مهمان — برای بازیابیِ نشست ─────────────
// نشستِ مهمانِ مرورگر با کوکی امضاشده است؛ اگر رازِ کوکی با ری‌استارتِ سرور عوض
// شود، شیتِ «نشستت منقضی شد» با همین اسم/آواتار بی‌صدا دوباره وارد می‌شود. ذخیره
// در sessionStorage (نه localStorage) — با بستنِ تب، هویتِ بازیابی هم پاک می‌شود.

const GUEST_NAME_KEY = "femwar.guest.name"
const GUEST_AVATAR_KEY = "femwar.guest.avatar"

/** ثبتِ هویتِ مهمان برای بازیابیِ نشست — بعد از ورودِ موفق یا ویرایشِ هویت صدا می‌شود */
export function persistGuestIdentity(name: string, avatar: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(GUEST_NAME_KEY, name)
    window.sessionStorage.setItem(GUEST_AVATAR_KEY, avatar)
  } catch {
    // حالتِ خصوصی — بازیابی از این مسیر ممکن نیست؛ بی‌خیال
  }
}

/** هویتِ آخرینِ مهمانِ این جلسه — null یعنی چیزی ذخیره نشده */
export function readPersistedGuestIdentity(): { name: string; avatar: string } | null {
  if (typeof window === "undefined") return null
  try {
    const name = window.sessionStorage.getItem(GUEST_NAME_KEY)
    if (!name) return null
    return { name, avatar: window.sessionStorage.getItem(GUEST_AVATAR_KEY) || "🎀" }
  } catch {
    return null
  }
}

// ─── قولِ بازی — یک بار برای هر بازیکن روی هر دستگاه (V8: کلیدِ per-player) ──

const INTRO_SEEN_PREFIX = "femwar.introSeen.v2."

/** آیا این بازیکن روی این دستگاه قولِ بازی (اوترو) را دیده است؟ — خطا/حالت خصوصی → false */
export function hasSeenIntro(playerId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(INTRO_SEEN_PREFIX + playerId) === "1"
  } catch {
    return false
  }
}

/** ثبتِ «دیده شد» برای همین بازیکن — بعد از پایانِ اینترو (هر حالتی) صدا می‌شود */
export function markIntroSeen(playerId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(INTRO_SEEN_PREFIX + playerId, "1")
  } catch {
    // حالت خصوصیِ مرورگر — مهم نیست؛ جلسه‌ی بعد دوباره نشانش می‌دهیم
  }
}

function readStoredChatId(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(CHAT_ID_KEY) || null
  } catch {
    return null
  }
}

function writeStoredChatId(chatId: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (chatId) window.localStorage.setItem(CHAT_ID_KEY, chatId)
    else window.localStorage.removeItem(CHAT_ID_KEY)
  } catch {
    // حالت خصوصیِ مرورگر — بی‌خیال
  }
}
