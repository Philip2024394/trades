// POST /api/nex/founder/email-intelligence/verify-batch
//
// Founder-authorised · verifies mailboxes via SMTP RCPT-TO handshake.
// NEVER sends a message. Result comes from the recipient MX server.
// Persists to nex.email_verification + nex.domain_intelligence.
//
// Body (all optional):
//   {
//     "email_addresses": ["a@x.com", ...],  // explicit list (default: unverified addresses in DB)
//     "limit": 25,                            // cap when reading from DB
//     "max_concurrency": 6,
//     "per_domain_gap_ms": 2000,
//     "probe_catch_all": true,
//     "step_timeout_ms": 10000
//   }

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { verifyBatch } from "@/lib/nex/email-intelligence/smtp-verify";
import { recordVerification } from "@/lib/nex/email-intelligence/intelligence-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;   // batches can take several minutes with per-domain politeness

interface Body {
  email_addresses?: string[];
  limit?: number;
  max_concurrency?: number;
  per_domain_gap_ms?: number;
  probe_catch_all?: boolean;
  step_timeout_ms?: number;
  connect_timeout_ms?: number;
  only_unverified?: boolean;
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  let body: Body = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const client = await pool.connect();
  try {
    const serverNow = (await client.query(`SELECT now() AS n`)).rows[0].n.toISOString();
    let emails: string[] = [];

    if (body.email_addresses?.length) {
      emails = body.email_addresses.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"));
    } else {
      const limit = Math.max(1, Math.min(200, body.limit ?? 25));
      const onlyUnverified = body.only_unverified !== false;
      const rows = await client.query(
        `SELECT DISTINCT ON (LOWER(e.discovered_email))
                LOWER(e.discovered_email) AS email
           FROM nex.discovery_business_evidence e
           ${onlyUnverified ? `LEFT JOIN nex.email_verification v ON v.email_address = LOWER(e.discovered_email)` : ``}
          WHERE e.discovered_email IS NOT NULL
          ${onlyUnverified ? `AND v.email_address IS NULL` : ``}
          ORDER BY LOWER(e.discovered_email)
          LIMIT ${limit}`,
      );
      emails = rows.rows.map((r) => r.email);
    }

    if (emails.length === 0) {
      return NextResponse.json({
        ok: true, server_now: serverNow,
        verified_count: 0, results: [],
        note: "no_addresses_to_verify",
      });
    }

    const results = await verifyBatch(emails, {
      max_concurrency: Math.max(1, Math.min(16, body.max_concurrency ?? 6)),
      per_domain_gap_ms: Math.max(0, body.per_domain_gap_ms ?? 2000),
      probe_catch_all: body.probe_catch_all !== false,
      step_timeout_ms: Math.max(1000, Math.min(30000, body.step_timeout_ms ?? 10000)),
      connect_timeout_ms: Math.max(1000, Math.min(60000, body.connect_timeout_ms ?? 15000)),
    });

    // Persist every outcome
    for (const r of results) {
      try { await recordVerification(client, r, auth.actor); }
      catch (e) { /* schema not applied? surface as row-error but keep going */ (r as any).persist_error = (e as Error).message; }
    }

    const summary = {
      deliverable:    results.filter((r) => r.deliverable === "deliverable").length,
      undeliverable:  results.filter((r) => r.deliverable === "undeliverable").length,
      catch_all:      results.filter((r) => r.deliverable === "catch_all").length,
      risky:          results.filter((r) => r.deliverable === "risky").length,
      unknown:        results.filter((r) => r.deliverable === "unknown").length,
    };

    return NextResponse.json({
      ok: true,
      server_now: serverNow,
      verified_count: results.length,
      summary,
      results: results.map((r) => ({
        email_address: r.email_address, domain: r.domain, deliverable: r.deliverable,
        mx_host: r.mx_host, rcpt_code: r.rcpt_code, rcpt_response: r.rcpt_response,
        catch_all_probe_code: r.catch_all_probe_code, total_ms: r.total_ms,
        error_reason: r.error_reason,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: false, error: "schema_not_applied", detail: msg }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
