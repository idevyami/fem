import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // ─── V13.5 — باندلِ دیپلوی باید خودکفا باشد ─────────────────────────────
  // `src/lib/db.ts` کلاینتِ Prisma را با requireِ داینامیک می‌سازد — tracerِ
  // Next آن را نمی‌بیند و در standalone حذف می‌شود (علتِ 500ِ خامِ همه‌ی
  // مسیرها در دیپلویِ ۲۱:۵۷). این‌جا صریحاً همراهش می‌بریم:
  //   • .prisma/client  — کلاینتِ تولیدشده + موتورِ کوئریِ SQLite
  //   • @prisma/client  — پکیجِ stub که require می‌شود
  //   • @prisma/engines — موتورها
  //   • db/             — فایلِ دیتابیسِ SQLite
  //   • bot-secret.env  — BOT_TOKEN (اعتبارسنجیِ initData) + GAME_SECRET + SERVICE_KEY
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@prisma/engines/**/*",
      "./db/**/*",
      "./mini-services/bot/bot-secret.env",
      "./prisma/schema.prisma",
    ],
    "/": [
      "./node_modules/.prisma/**/*",
      "./node_modules/@prisma/client/**/*",
      "./node_modules/@prisma/engines/**/*",
      "./db/**/*",
      "./mini-services/bot/bot-secret.env",
      "./prisma/schema.prisma",
    ],
  },
};

export default nextConfig;
