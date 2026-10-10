// GET /api/nex/member/marketing/senders
//
// Returns member's own authorised sender identities. Never returns
// credentials · never returns another member's senders.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveMemberAuth } from "@/lib/nex/marketing/member";
import { loadCandidatesForLane, loadCapacity } from "@/lib/nex/marketing/sender-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveMemberAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  const client = await pool.connect();
  try {
    // Strictly member-scoped
    const senders = await loadCandidatesForLane(client, "member", auth.member_id);
    const with_capacity = await Promise.all(senders.map(async s => {
      const cap = await loadCapacity(client, s);
      return {
        sender_id: s.sender_id,
        email: s.email,
        display_name: s.display_name,
        provider: s.provider,
        health_state: s.health_state,
        authentication_state: s.authentication_state,
        capacity: {
          hourly_limit: cap.hourly_limit,
          hourly_used: cap.hourly_used,
          hourly_remaining: cap.hourly_remaining,
          daily_limit: cap.daily_limit,
          daily_used: cap.daily_used,
          daily_remaining: cap.daily_remaining,
          effective_remaining: cap.effective_remaining,
        },
      };
    }));
    return NextResponse.json({
      ok: true,
      member_id: auth.member_id,
      senders: with_capacity,
    });
  } finally {
    client.release();
  }
}
