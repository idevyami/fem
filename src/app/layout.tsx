import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "🎀 Femboy War",
  description: "شبیه‌ساز اجتماعیِ آشوبناک. هیچ‌کس نمی‌داند بعدش چه می‌شود.",
  applicationName: "FEMBOY WAR",
  keywords: ["فمبوی وار", "بازی", "مینی‌اپ تلگرام", "شبیه‌ساز اجتماعی"],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0f0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground font-sans min-h-screen">
        {/* اسکریپت WebApp تلگرام — قبل از هیدریشن؛ اگر شبکه اجازه نداد، بوتِ کلاینت خودش fallback می‌کند */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
