// GET/POST /api/cron/nex-domain-auth-refresh
//
// Founder-authorised programme · Session-19 · World-proof gate #3 · 2026-09-22.
//
// Refreshes SPF/DKIM/DMARC state for every tracked sending domain using the
// production DNS-based DomainAuthChecker (Session-10).
//
// GATED: NEX_DOMAIN_AUTH_CHECKER_ACTIVATION must equal "on" · else 503 dormant.
// When active, iterates marketing_sender_domain_auth · calls refreshDomainAuth
// with a fresh DnsDomainAuthChecker · records updated state.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import {
  DnsDomainAuthChecker,
  refreshDomainAuth,
} from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run() {
  if (process.env.NEX_DOMAIN_AUTH_CHECKER_ACTIVATION !== "on") {
    return NextResponse.json({
      ok: false,
      state: "endpoint_dormant",
      note: "set NEX_DOMAIN_AUTH_CHECKER_ACTIVATION=on to activate DNS-based domain auth refresh",
    }, { status: 503 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const domains = await client.query<{ sending_domain: string }>(
      `SELECT sending_domain FROM nex.marketing_sender_domain_auth ORDER BY updated_at ASC LIMIT 50`,
    ).catch(() => ({ rows: [] as { sending_domain: string }[] }));

    const checker = new DnsDomainAuthChecker();
    const results: Array<{ sending_domain: string; ok: boolean; error?: string }> = [];
    for (const row of domains.rows) {
      try {
        await refreshDomainAuth(client, { sending_domain: row.sending_domain, checker });
        results.push({ sending_domain: row.sending_domain, ok: true });
      } catch (e) {
        results.push({ sending_domain: row.sending_domain, ok: false, error: (e as Error).message });
      }
    }
    return NextResponse.json({ ok: true, state: "active", refreshed: results.length, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error", detail: (e as Error).message }, { status: 500 });
  } finally { client.release(); }
}

export async function GET()  { return run(); }
export async function POST() { return run(); }
