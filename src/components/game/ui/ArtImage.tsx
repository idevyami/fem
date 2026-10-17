"use client"

// تصویرِ آرت با فالبک — اگر تصویر لود نشد، ایموجیِ کلاس در جعبه‌ی شیشه‌ایِ هم‌جایگزین می‌نشیند
import * as React from "react"
import { cn } from "@/lib/utils"

interface ArtImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** مسیرِ تصویر — در این بازی همیشه URLِ رشته‌ای است */
  src?: string
  /** ایموجیِ فالبک (کلاس/فمبوی) — در جعبه‌ی مرکزچینِ شیشه‌ای نمایش داده می‌شود */
  fallbackEmoji: string
}

export function ArtImage({ fallbackEmoji, alt = "", className, src, ...rest }: ArtImageProps) {
  // فالبک فقط برای همان src قفل است — با عوض‌شدنِ آرت، تصویر دوباره فرصت می‌گیرد
  const [failedFor, setFailedFor] = React.useState<string | null>(null)
  const failed = typeof src === "string" && failedFor === src

  if (failed) {
    return (
      <div
        {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
        className={cn("flex w-full items-center justify-center bg-white/[0.04] text-4xl", className)}
      >
        <span aria-hidden>{fallbackEmoji}</span>
      </div>
    )
  }

  return <img src={src} alt={alt} className={className} onError={() => setFailedFor(src ?? null)} {...rest} />
}
