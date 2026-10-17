// پل WebApp تلگرام — همه‌چیز گارد شده؛ در مرورگر عادی هم بدون کرش کار می‌کند

export interface TgHapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void
  notificationOccurred(type: "error" | "success" | "warning"): void
  selectionChanged(): void
}

export interface TgViewportEvent {
  viewportHeight?: number
  viewportStableHeight?: number
  isExpanded?: boolean
}

export interface TgWebApp {
  initData: string
  ready(): void
  expand(): void
  setHeaderColor(color: string): void
  setBottomBarColor?(color: string): void
  /** جلوگیری از بستنِ تصادفیِ اپ با سوایپ — در تلگرامِ جدید پشتیبانی می‌شود */
  enableClosingConfirmation?(): void
  HapticFeedback?: TgHapticFeedback
  BackButton?: TgBackButton
  /** فقط لینک‌های t.me را می‌پذیرد — داخلِ WebView تلگرام با این باز می‌شود */
  openTelegramLink?(url: string): void
  viewportStableHeight?: number
  /** گوش‌دادنِ به رویدادهای WebApp (مثل viewportChanged) — نسخه‌های قدیمی ندارند */
  onEvent?(eventType: string, handler: (eventData: TgViewportEvent) => void): void
  offEvent?(eventType: string, handler: (eventData: TgViewportEvent) => void): void
}

export interface TgBackButton {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

interface TelegramWindow {
  Telegram?: { WebApp?: TgWebApp }
}

export function getWebApp(): TgWebApp | null {
  if (typeof window === "undefined") return null
  const tg = (window as unknown as TelegramWindow).Telegram
  return tg?.WebApp ?? null
}

/**
 * همگام‌سازیِ ارتفاعِ پایدارِ ویوپورت با CSS — `--tg-viewport-stable-height` رویِ ریشه.
 * یوتیلیتی‌هایی مثل `.min-h-app` از همین متغیر می‌خوانند (فالبک: 100dvh).
 */
function syncViewportVar(px: number | undefined): void {
  if (typeof document === "undefined") return
  if (px === undefined || !Number.isFinite(px) || px <= 0) return
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${px}px`)
}

/** آماده‌سازی WebApp — فقط در محیط تلگرام اثر دارد */
export function initTelegram(): void {
  const wa = getWebApp()
  if (!wa) return
  try {
    wa.ready()
    wa.expand()
    // رنگِ هدر/نوارِ تلگرام — همان `--background` (توکنِ واحدِ رنگ در globals.css)
    wa.setHeaderColor("#0f0d12")
    wa.setBottomBarColor?.("#0f0d12")
    // سوایپِ بستن را قفلِ تأیید می‌کنیم — بازیِ نیمه‌کاره نباید با یک ژست بمیرد
    wa.enableClosingConfirmation?.()
    // ارتفاعِ پایدارِ ویوپورت — هم‌اکنون و با هر تغییرِ زنده
    syncViewportVar(wa.viewportStableHeight)
    wa.onEvent?.("viewportChanged", (e) => syncViewportVar(e?.viewportStableHeight))
  } catch {
    // بعضی نسخه‌های WebApp قدیمی‌اند — بی‌خیال
  }
}

/** هپتیک سبک برای لمس‌های لذت‌بخش */
export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style)
  } catch {
    // بی‌هپتیک هم زندگی می‌شود
  }
}

/** هپتیکِ نوتیفیکیشن — برای توست‌های موفق/خطا (خنثی همان impact می‌ماند) */
export function hapticNotify(type: "error" | "success" | "warning"): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred(type)
  } catch {
    // بی‌هپتیک هم زندگی می‌شود
  }
}

/**
 * باز کردنِ لینکِ t.me — داخلِ WebView تلگرام، `<a target="_blank">` اغلب کار نمی‌کند؛
 * باید از WebApp.openTelegramLink رد شود. بیرون از تلگرام → پنجره‌ی جدید.
 */
export function openTgLink(url: string): void {
  try {
    const wa = getWebApp()
    if (wa?.openTelegramLink) {
      wa.openTelegramLink(url)
      return
    }
  } catch {
    // نسخه‌های قدیمی — می‌افتیم سراغ پنجره‌ی جدید
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer")
  } catch {
    // پاپ‌آپ بلاک شد — هیچ راهی نماند
  }
}

/**
 * اگر اسکریپت WebApp (که باید با beforeInteractive آمده باشد) هنوز لود نشده،
 * همین‌جا داینامیک تزریقش می‌کنیم و حداکثر timeout صبر می‌کنیم.
 */
export function ensureTelegramScript(timeoutMs = 2500): Promise<TgWebApp | null> {
  return new Promise((resolve) => {
    const existing = getWebApp()
    if (existing) return resolve(existing)
    if (typeof document === "undefined") return resolve(null)

    const done = () => resolve(getWebApp())
    const timer = window.setTimeout(() => resolve(getWebApp()), timeoutMs)

    const s = document.createElement("script")
    s.src = "https://telegram.org/js/telegram-web-app.js"
    s.async = true
    s.onload = () => {
      window.clearTimeout(timer)
      done()
    }
    s.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    document.head.appendChild(s)
  })
}
