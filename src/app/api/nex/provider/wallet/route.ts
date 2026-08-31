// GET/POST /api/nex/provider/wallet · Philip 2026-08-29
//
// GET  ?learner_ref=device:xxx · returns provider's wallet + monthly
//                                allowance + recent transactions
// POST ?learner_ref=device:xxx {amount_idr:20000} · adds a top-up (v1
//                                stub · no real payment yet · flagged)

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

const MIN_TOPUP_IDR = 20000;
const ALLOWED_TOPUPS = new Set([20000, 50000, 100000, 250000, 500000]);
const MONTHLY_FREE_ALLOWANCE = 2;

function validateLearnerRef(ref: unknown): string | null {
  if (typeof ref !== "string") return null;
  const trimmed = ref.trim();
  if (!/^(nex_id:\d+|device:[a-zA-Z0-9-]{8,})$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(req: NextRequest) {
  const learner = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  if (!learner) return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });

  const client = await getPool().connect();
  try {
    const { rows: pRows } = await client.query(
      `SELECT provider_id, full_name, price_per_service_idr, is_available, status
       FROM nex.provider_profile WHERE learner_ref = $1 LIMIT 1`,
      [learner],
    );
    if (pRows.length === 0) {
      return NextResponse.json({ ok: true, profile: null, wallet: null, transactions: [] });
    }
    const profile = pRows[0];

    const { rows: wRows } = await client.query(
      `SELECT balance_idr, updated_at FROM nex.provider_wallet WHERE provider_id = $1`,
      [profile.provider_id],
    );
    const wallet = wRows[0] ?? { balance_idr: 0, updated_at: null };

    const { rows: freeRows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.service_request
       WHERE provider_id = $1 AND state = 'COMPLETED' AND completed_at >= date_trunc('month', now())`,
      [profile.provider_id],
    );
    const free_used = freeRows[0].n as number;

    const { rows: txRows } = await client.query(
      `SELECT transaction_id, kind, amount_idr, balance_after_idr,
              related_request_id, note, created_at
       FROM nex.provider_wallet_transaction
       WHERE provider_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [profile.provider_id],
    );

    return NextResponse.json({
      ok: true,
      profile: {
        provider_id: profile.provider_id,
        name: profile.full_name,
        price_per_service_idr: profile.price_per_service_idr,
        is_available: profile.is_available,
        status: profile.status,
      },
      wallet: {
        balance_idr: wallet.balance_idr ?? 0,
        updated_at: wallet.updated_at,
      },
      monthly_allowance: {
        allowance: MONTHLY_FREE_ALLOWANCE,
        used_this_month: free_used,
        remaining_this_month: Math.max(0, MONTHLY_FREE_ALLOWANCE - free_used),
      },
      current_fee_when_applicable_idr:
        profile.price_per_service_idr
          ? Math.round(Number(profile.price_per_service_idr) * 0.08)
          : null,
      transactions: txRows,
    });
  } finally {
    client.release();
  }
}

// POST · stub top-up · v1 · no real payment · marks transactions clearly
export async function POST(req: NextRequest) {
  const learner = validateLearnerRef(req.nextUrl.searchParams.get("learner_ref"));
  if (!learner) return NextResponse.json({ ok: false, error: "invalid learner_ref" }, { status: 400 });

  let payload: Record<string, unknown>;
  try { payload = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }

  const amount = Number(payload.amount_idr);
  if (!Number.isFinite(amount) || amount < MIN_TOPUP_IDR)
    return NextResponse.json({ ok: false, error: `min top-up Rp ${MIN_TOPUP_IDR}` }, { status: 400 });
  if (!ALLOWED_TOPUPS.has(amount))
    return NextResponse.json({ ok: false, error: `amount must be one of ${[...ALLOWED_TOPUPS].join(",")}` }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows: pRows } = await client.query(
      `SELECT provider_id FROM nex.provider_profile WHERE learner_ref = $1 LIMIT 1`,
      [learner],
    );
    if (pRows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ ok: false, error: "provider not found" }, { status: 404 });
    }
    const provider_id = pRows[0].provider_id as string;

    // UPSERT wallet · lock row
    await client.query(
      `INSERT INTO nex.provider_wallet (provider_id, balance_idr)
       VALUES ($1, 0)
       ON CONFLICT (provider_id) DO NOTHING`,
      [provider_id],
    );
    const { rows: wRows } = await client.query(
      `SELECT balance_idr FROM nex.provider_wallet WHERE provider_id = $1 FOR UPDATE`,
      [provider_id],
    );
    const newBalance = (wRows[0]?.balance_idr ?? 0) + amount;

    await client.query(
      `UPDATE nex.provider_wallet SET balance_idr = $2, updated_at = now() WHERE provider_id = $1`,
      [provider_id, newBalance],
    );
    await client.query(
      `INSERT INTO nex.provider_wallet_transaction
         (provider_id, kind, amount_idr, balance_after_idr, note)
       VALUES ($1, 'topup', $2, $3, $4)`,
      [provider_id, amount, newBalance, "STUB top-up · v1 · no real payment wired yet"],
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, balance_idr: newBalance });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
