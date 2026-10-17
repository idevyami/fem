// فرمت اعداد و زمان — همه‌ی اعداد UI از همین‌جا رد می‌شوند (V11: ارقام انگلیسی)

const faFmt = new Intl.NumberFormat("en-US");

/** عدد → رشته با ارقام انگلیسی و جداکننده هزارگان (1,234) */
export function faNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return faFmt.format(Math.round(n));
}

/** عدد با علامت: +1,200 / −300 */
export function faSigned(n: number): string {
  if (n > 0) return `+${faNum(n)}`;
  if (n < 0) return `−${faNum(Math.abs(n))}`;
  return faNum(0);
}

/** درصد: 108 → «108%» */
export function faPercent(n: number): string {
  return `${faNum(n)}%`;
}

/** «3 دقیقه پیش» با Intl.RelativeTimeFormat — فقط کلاینت (ارقام انگلیسی) */
const rtf = new Intl.RelativeTimeFormat("fa-IR-u-nu-latn", { numeric: "auto" });

export function faTimeAgo(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  return rtf.format(-Math.round(diffHour / 24), "day");
}

/** کپی متن با fallback برای مرورگرهای قدیمی/محیط‌های بدون clipboard API */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
