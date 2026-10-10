// GET /api/nex/founder/marketing/deliverability
//
// Founder-only view of per-domain SPF/DKIM/DMARC state + per-sender reputation.
// Read-only aggregate · no addresses · no doctrine changes.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadAllDomainAuth, loadSenderReputation } from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const domainAuth = await loadAllDomainAuth(client);
    // Load every sender + join in its reputation
    const senders = await client.query<{ sender_id: string; email: string; lane: string; provider: string; sending_domain: string | null; health_state: string; authentication_state: string }>(
      `SELECT sender_id, email, lane, provider, sending_domain, health_state, authentication_state
         FROM nex.marketing_sender_identity ORDER BY email`,
    );
    const enriched = await Promise.all(senders.rows.map(async s => {
      const rep = await loadSenderReputation(client, s.sender_id).catch(() => null);
      return { ...s, reputation: rep };
    }));
    return NextResponse.json({
      ok: true,
      domain_auth: domainAuth,
      senders: enriched,
      counters: {
        total_domains: domainAuth.length,
        aligned_domains: domainAuth.filter(d => d.aligned).length,
        total_senders: senders.rowCount ?? 0,
        senders_frozen: enriched.filter(e => e.reputation?.reputation_state === "frozen").length,
        senders_limited: enriched.filter(e => e.reputation?.reputation_state === "limited").length,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, domain_auth: [], senders: [], counters: null, warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
