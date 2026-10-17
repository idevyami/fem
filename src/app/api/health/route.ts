import { db } from "@/lib/db"
import { jsonOk, jsonErr } from "@/lib/game/api"

export const dynamic = "force-dynamic"

// سلامتِ ارزان: فقط «زنده است؟ دیتابیس جواب می‌دهد؟» — بدون worldTick،
// بدون بازیکن، بدون کلید. ربات و نگهبان برای liveness از همین استفاده می‌کنند
// تا دیگر به مسیرهای بازی POST خالی نزنند (نویزِ 400 و tickِ ناخواسته از بین می‌رود).
const BOOT_AT = Date.now()

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`
    return jsonOk({
      ok: true,
      db: true,
      uptimeSec: Math.floor((Date.now() - BOOT_AT) / 1000),
    })
  } catch {
    return jsonErr("دیتابیس جواب نمی‌دهد.", 503, "db_down")
  }
}
