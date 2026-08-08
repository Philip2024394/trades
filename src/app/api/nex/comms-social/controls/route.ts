// POST /api/nex/comms-social/controls · toggle global pause
// Body: { global_pause: boolean, actor: string, reason?: string }
// GET  /api/nex/comms-social/controls
//
// Charter §S-V global admin kill switch. Toggling requires admin
// bypass; Phase 4 uses admin bypass explicitly. Production Phase 7 UI
// gates this behind the nex_admin_publish grant.
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/db";
import { getSocialControls } from "@/lib/nex/comms-social/controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const controls = await getSocialControls();
  return NextResponse.json({ ok: true, controls });
}

export async function POST(request: Request) {
  let body: { global_pause?: boolean; actor?: string; reason?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (typeof body.global_pause !== "boolean" || !body.actor) {
    return NextResponse.json({ ok: false, error: "global_pause + actor required" }, { status: 400 });
  }
  await withClient(async (c) => {
    await c.query("BEGIN");
    try {
      await c.query("SET LOCAL ROLE nex_social_app");
      await c.query("SELECT set_config('nex.social_admin_bypass', 'on', true)");
      await c.query(
        `UPDATE nex.social_controls
            SET global_pause = $1::boolean,
                global_pause_at = CASE WHEN $1::boolean THEN NOW() ELSE NULL END,
                global_pause_by = CASE WHEN $1::boolean THEN $2::text ELSE NULL END,
                global_pause_reason = CASE WHEN $1::boolean THEN $3::text ELSE NULL END,
                updated_at = NOW()
          WHERE singleton = TRUE`,
        [body.global_pause, body.actor, body.reason ?? null]);
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK"); throw e; }
  });
  const controls = await getSocialControls();
  return NextResponse.json({ ok: true, controls });
}
