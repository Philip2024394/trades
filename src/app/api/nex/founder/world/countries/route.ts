// GET /api/nex/founder/world/countries?programme=scaffolding
// Returns every world country with per-programme state joined in.
// Founder-only · read-only.
import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadWorldCountries, loadProgrammeBySlug, loadCountryStates } from "@/lib/nex/discovery-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const programmeSlug = url.searchParams.get("programme") ?? "scaffolding";

  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const countries = await loadWorldCountries(client);
    const programme = await loadProgrammeBySlug(client, programmeSlug);
    const states = programme ? await loadCountryStates(client, programme.programme_id) : [];
    const stateByIso = new Map(states.map(s => [s.iso_alpha_2, s]));
    return NextResponse.json({
      ok: true,
      programme,
      countries: countries.map(c => ({ ...c, state: stateByIso.get(c.iso_alpha_2) ?? null })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) return NextResponse.json({ ok: true, countries: [], programme: null, warning: "schema_not_applied", detail: msg });
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
