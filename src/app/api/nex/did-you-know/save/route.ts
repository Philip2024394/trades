// POST /api/nex/did-you-know/save · Philip 2026-08-28
// GET  /api/nex/did-you-know/save?learner_ref=... · returns saved fact ids
//
// NEX Data Safety doctrine: user saves live in Postgres, NOT localStorage.
// See project_nex_data_safety_no_localstorage_2026_08_28.md
//
// Identity: learner_ref is either "nex_id:{number}" (authenticated) or
// "device:{uuid}" (anonymous). When user later logs in with NEX ID, the
// server-side merge migrates device:{uuid} rows to nex_id:{number} rows.

import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

const { Pool } = pg;
let pool: pg.Pool | null = null;
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.NEX_POSTGRES_URL ??
        "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
      max: 3,
    });
  }
  return pool;
}

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (trimmed.length < 8 || trimmed.length > 80) return null;
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{16,})$/.test(trimmed)) return null;
  return trimmed;
}

// GET · list saved fact ids for a learner
export async function GET(req: NextRequest) {
  const learner = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  if (!learner) {
    return NextResponse.json(
      { ok: false, error: "invalid learner_ref" },
      { status: 400 },
    );
  }

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      const { rows } = await client.query(
        `SELECT fact_id::text AS id, saved_at FROM nex.brain_user_saved_facts
         WHERE learner_ref = $1
         ORDER BY saved_at DESC
         LIMIT 500`,
        [learner],
      );
      return NextResponse.json(
        { ok: true, saved: rows, count: rows.length },
        { headers: { "cache-control": "private, no-store" } },
      );
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// POST · toggle save on a fact
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const body = (payload ?? {}) as Record<string, unknown>;
  const learner = validateLearnerRef(body.learner_ref);
  const factId = typeof body.fact_id === "string" ? body.fact_id.trim() : "";
  const action = body.action === "unsave" ? "unsave" : "save";

  if (!learner) {
    return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(factId)) {
    return NextResponse.json({ ok: false, error: "invalid fact_id" }, { status: 400 });
  }

  try {
    const p = getPool();
    const client = await p.connect();
    try {
      if (action === "unsave") {
        await client.query(
          `DELETE FROM nex.brain_user_saved_facts
           WHERE learner_ref = $1 AND fact_id = $2::uuid`,
          [learner, factId],
        );
        return NextResponse.json({ ok: true, action: "unsaved" });
      }

      // ensure fact exists so we don't create dangling save rows
      const { rows: exists } = await client.query(
        `SELECT 1 FROM nex.brain_did_you_know_indonesia WHERE fact_id = $1::uuid AND is_active = true`,
        [factId],
      );
      if (exists.length === 0) {
        return NextResponse.json({ ok: false, error: "fact not found" }, { status: 404 });
      }

      await client.query(
        `INSERT INTO nex.brain_user_saved_facts (learner_ref, fact_id)
         VALUES ($1, $2::uuid)
         ON CONFLICT (learner_ref, fact_id) DO UPDATE SET
           seen_count = nex.brain_user_saved_facts.seen_count + 1,
           last_seen_at = now()`,
        [learner, factId],
      );
      return NextResponse.json({ ok: true, action: "saved" });
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
