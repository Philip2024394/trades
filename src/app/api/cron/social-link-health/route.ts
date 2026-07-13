// GET /api/cron/social-link-health
//
// Vercel Cron (hourly, see vercel.json) + optional pg_cron fallback.
// Walks every affiliate-claimed social link and HEAD-checks the URL with
// a 5-second timeout and a browser-style User-Agent. The status column
// flips to 'active' | 'broken' | 'removed' based on the response code.
//
// Auth: shared CRON_SECRET, sent as `Authorization: Bearer <secret>`.
//
// We cap each run at 200 links so even a busy site doesn't time the
// route out. The next hour picks up the rest (we order by
// last_checked_at ASC, NULLS FIRST so the oldest checks recycle first).
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PER_RUN_CAP = 200;
const TIMEOUT_MS = 5000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ThenetworkersHealthBot/1.0; +https://thenetworkers.app/affiliates)";

type Status = "active" | "broken" | "removed";

async function checkUrl(url: string): Promise<Status> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "broken";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT }
      });
    } catch (e) {
      // Some hosts 405 HEAD; retry as GET with no body.
      const e2 = e as { name?: string };
      if (e2?.name === "AbortError") return "broken";
      try {
        res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": USER_AGENT }
        });
      } catch {
        return "broken";
      }
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 200 && res.status < 400) return "active";
    if (res.status === 404 || res.status === 410) return "removed";
    return "broken";
  } catch {
    return "broken";
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  // Vercel Cron also sets x-vercel-cron=1; accept either auth path.
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron) {
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const rows = await supabaseAdmin
    .from("hammerex_affiliate_social_links")
    .select("id, url, status, last_checked_at")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(PER_RUN_CAP);

  if (rows.error) {
    return NextResponse.json(
      { ok: false, error: rows.error.message },
      { status: 500 }
    );
  }

  let active = 0;
  let broken = 0;
  let removed = 0;
  const now = new Date().toISOString();

  for (const row of rows.data ?? []) {
    if (typeof row.url !== "string") continue;
    const status = await checkUrl(row.url);
    if (status === "active") active++;
    else if (status === "removed") removed++;
    else broken++;
    await supabaseAdmin
      .from("hammerex_affiliate_social_links")
      .update({ status, last_checked_at: now })
      .eq("id", row.id);
  }

  return NextResponse.json({
    ok: true,
    checked: rows.data?.length ?? 0,
    active,
    broken,
    removed
  });
}
