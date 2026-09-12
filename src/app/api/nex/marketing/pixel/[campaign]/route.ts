// GET /api/nex/marketing/pixel/[campaign]?e=<email>
//
// 1x1 PNG open-tracking pixel. Increments open_count on the contact
// and the campaign. Always returns the pixel, even on errors, so a
// broken tracker never breaks the email render.

import { getPool } from "@/lib/nex/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Smallest valid transparent 1x1 PNG (67 bytes)
const PIXEL = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000164944415478da62fcfffffffffe07000000ffff03000006000502be1c0f7d0000000049454e44ae426082",
  "hex"
);

async function recordOpen(campaignId: string, email: string) {
  try {
    const pool = await getPool();
    if (!pool) return;
    const c = await pool.connect();
    try {
      await c.query(
        `UPDATE nex.marketing_contact SET open_count=open_count+1 WHERE LOWER(email)=LOWER($1)`,
        [email]
      );
      await c.query(
        `UPDATE nex.marketing_campaign SET opened_count=opened_count+1 WHERE campaign_id=$1`,
        [campaignId]
      );
      await c.query(
        `INSERT INTO nex.marketing_bounce_log (esp, email, event_type, raw_payload)
         VALUES ('pixel', $1, 'open', $2::jsonb)`,
        [email, JSON.stringify({ campaign_id: campaignId })]
      );
    } finally { c.release(); }
  } catch { /* silent · tracker never breaks render */ }
}

export async function GET(req: Request, ctx: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await ctx.params;
  const url = new URL(req.url);
  const email = url.searchParams.get("e");
  if (email && campaign) void recordOpen(campaign, email);
  return new Response(PIXEL, {
    status: 200,
    headers: { "content-type": "image/png", "cache-control": "no-store, no-cache", "content-length": String(PIXEL.length) },
  });
}
