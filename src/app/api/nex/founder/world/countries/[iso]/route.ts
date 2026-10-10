// GET /api/nex/founder/world/countries/[iso]?programme=scaffolding
// Country intelligence · state + last cycle + business evidence (Founder-only).
// Emails included in this response — this is a FOUNDER-ONLY surface.
import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadCountryByIso, loadCountryState, loadProgrammeBySlug, loadBusinessesForCountry, loadEntitiesForCountry } from "@/lib/nex/discovery-world";
import { loadRelationships } from "@/lib/nex/discovery-intel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ iso: string }> }) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const { iso } = await params;
  const url = new URL(req.url);
  const programmeSlug = url.searchParams.get("programme") ?? "scaffolding";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const with_email_only = url.searchParams.get("with_email_only") === "1";

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const country = await loadCountryByIso(client, iso);
    if (!country) return NextResponse.json({ ok: false, error: "country_not_found" }, { status: 404 });
    const programme = await loadProgrammeBySlug(client, programmeSlug);
    if (!programme) return NextResponse.json({ ok: false, error: "programme_not_found" }, { status: 404 });
    const state = await loadCountryState(client, programme.programme_id, iso);
    const businesses = await loadBusinessesForCountry(client, { programme_id: programme.programme_id, iso, limit, with_email_only });
    // Part 13a · additive · entities discovered for this (programme, country)
    const entities = await loadEntitiesForCountry(client, programme.programme_id, iso, { limit: 50 }).catch(() => []);
    // Part 13a · additive · relationships scoped to the programme's topic
    const relationships = await loadRelationships(client, { topic: programme.topic, min_evidence: 1 }).catch(() => []);
    // Part 13a · additive · recent cycles touching this country (topic-scoped)
    const cyclesRes = await client.query(
      `SELECT cycle_id, cycle_seq, topic, started_at::text AS started_at,
              finished_at::text AS finished_at, duration_ms, outcome,
              businesses_discovered, new_emails, existing_matched, rejected_emails
         FROM nex.discovery_cycle
        WHERE topic = $1 AND $2 = ANY(countries_touched)
        ORDER BY cycle_seq DESC LIMIT 8`,
      [programme.topic, iso.toUpperCase()],
    ).catch(() => ({ rows: [] }));
    return NextResponse.json({ ok: true, country, programme, state, businesses, entities, relationships, recent_cycles: cyclesRes.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, country: null, programme: null, state: null, businesses: { total: 0, rows: [] }, entities: [], relationships: [], recent_cycles: [], warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
