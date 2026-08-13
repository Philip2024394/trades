// src/app/api/nex/brain/supervisor-sweep/route.ts
//
// Wave 2 · Phase 6 · W-C-COMPANION cron entrypoint.
// Governed by: docs/headquarters-production-readiness/W-C-COMPANION-PHASE-6-DESIGN.md §6, §7
//
// Behaviour matrix per design §6.5:
//   env unset                  → 200 { ok: true, disabled: true }
//   auth fails                 → 401 / 500 (via cronAuthErrorBody)
//   advisory lock not acquired → 200 { ok: true, skipped_concurrent: true }
//   sweep runs                 → 200 { ok: true, disabled: false, result }
//   sweep throws               → 500 · logs · counter incr · lock released via finally
//
// Auth: shared cron boundary with scope='supervisor' — first real consumer of D4
// scoped tokens. Compatible with F14 HMAC.
//
// Concurrency: pg advisory lock with a documented 63-bit constant. Auto-released
// on connection close (session-scoped) — belt AND braces (explicit unlock in
// finally + implicit release on release()).

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkCronAuth, cronAuthErrorBody } from "@/lib/nex/brain/auth/require-cron-token";
import { runFromRequest } from "@/lib/nex/observability/correlation";
import { brainStore } from "@/lib/nex/brain/storage";
import { getJob, updateJob, listJobs } from "@/lib/nex/jobs/fs-store";
import { runSupervisorSweep } from "@/lib/nex/jobs/supervisor";
import { withClient } from "@/lib/nex/db";
import { incr } from "@/lib/nex/observability/counters";
import { emitSignal } from "@/lib/nex/observability/signals";
import { logger } from "@/lib/nex/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const log = logger("api.brain.supervisor-sweep");

// Advisory-lock constant · 63-bit prime · documented so future locks avoid collision.
// See W-C-COMPANION-PHASE-6-DESIGN.md §7.2.
const SUPERVISOR_ADVISORY_LOCK = BigInt("7291374928374623942");

function isEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEX_KJOB_SUPERVISOR_ENABLED === "1";
}

async function tryAcquireLock(): Promise<boolean | null> {
  // Returns true = acquired, false = someone else holds it, null = pg unavailable.
  return withClient(async (c) => {
    const r = await c.query(`SELECT pg_try_advisory_lock($1) AS locked`, [SUPERVISOR_ADVISORY_LOCK.toString()]);
    return Boolean((r.rows[0] as { locked?: boolean } | undefined)?.locked);
  });
}

async function releaseLock(): Promise<void> {
  try {
    await withClient(async (c) => {
      await c.query(`SELECT pg_advisory_unlock($1)`, [SUPERVISOR_ADVISORY_LOCK.toString()]);
    });
  } catch (e) {
    log.warn("advisory_unlock_failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

// Phase 6 · post-incident hardening (2026-08-10). The route now accepts
// probe-mode query params for scoped verification runs:
//   ?probe_mode=1&only_kjids=<uuid>[,<uuid>...]
//
// Design invariants (all enforced BELOW · not left to caller discipline):
//   1. probe_mode=1 requires a non-empty only_kjids · route rejects otherwise
//   2. probe_mode=1 requires the same cron_secret auth · not a bypass
//   3. probe_mode=1 BYPASSES the NEX_KJOB_SUPERVISOR_ENABLED gate ·
//      the supervisor's `probe_mode` guard is the safety boundary that
//      replaces the enable-flag semantic for scoped runs
//   4. Normal cron traffic has NO query params · production behaviour unchanged
//   5. The supervisor's `probe_mode: true` + `only_kjids: [...]` guard is
//      what makes this route-level probe safe · the route just plumbs
//      the values through
function parseProbeMode(req: NextRequest): { probe_mode: boolean; only_kjids: string[] | undefined; error?: string } {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe_mode") === "1";
  const raw = url.searchParams.get("only_kjids");
  if (!probe) return { probe_mode: false, only_kjids: undefined };
  if (!raw) return { probe_mode: true, only_kjids: undefined, error: "probe_mode=1 requires only_kjids" };
  const kjids = raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  if (kjids.length === 0) return { probe_mode: true, only_kjids: [], error: "probe_mode=1 requires non-empty only_kjids" };
  return { probe_mode: true, only_kjids: kjids };
}

async function runSweep(req: NextRequest): Promise<NextResponse> {
  const auth = checkCronAuth(req, process.env, { scope: "supervisor" });
  if (!auth.ok) {
    return NextResponse.json(cronAuthErrorBody(auth), { status: auth.status });
  }

  const probe = parseProbeMode(req);
  if (probe.probe_mode && probe.error) {
    return NextResponse.json({ ok: false, error: "probe_mode_bad_input", detail: probe.error }, { status: 400 });
  }

  // Production path: gate on ENABLED. Probe path: gate bypassed · safety lives in supervisor's own guard.
  if (!probe.probe_mode && !isEnabled()) {
    return NextResponse.json({ ok: true, disabled: true, reason: "NEX_KJOB_SUPERVISOR_ENABLED != 1" });
  }

  const locked = await tryAcquireLock();
  if (locked === null) {
    // pg unavailable · treat as skip so cron does not 500 into retry storms.
    incr("supervisor.error");
    emitSignal({ subsystem: "supervisor", kind: "error", code: "advisory-lock-pool-unavailable", detail: "pg pool returned null" });
    return NextResponse.json({ ok: true, skipped_concurrent: false, error: "advisory_lock_pool_unavailable" }, { status: 500 });
  }
  if (!locked) {
    emitSignal({ subsystem: "supervisor", kind: "sweep-skipped-concurrent", code: "advisory-lock" });
    return NextResponse.json({ ok: true, skipped_concurrent: true });
  }

  try {
    const store = brainStore();
    const result = await runSupervisorSweep(store, { getJob, updateJob, listJobs }, {
      probe_mode: probe.probe_mode,
      only_kjids: probe.only_kjids,
    });
    return NextResponse.json({ ok: true, disabled: false, probe_mode: probe.probe_mode, only_kjids: probe.only_kjids ?? null, result });
  } catch (err) {
    incr("supervisor.error");
    const message = err instanceof Error ? err.message : String(err);
    log.error("sweep_failed", { error: message, probe_mode: probe.probe_mode });
    emitSignal({ subsystem: "supervisor", kind: "error", code: "sweep-body", detail: message.slice(0, 240) });
    return NextResponse.json({ ok: false, error: "sweep_failed" }, { status: 500 });
  } finally {
    await releaseLock();
  }
}

// CADP1 pattern · each exported handler wraps DIRECTLY in runFromRequest so
// the correlation-adoption drift-catcher's regex can pattern-match the call
// site within the 200-char window it scans after `export async function <VERB>`.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return runFromRequest(req, () => runSweep(req));
}
export async function POST(req: NextRequest): Promise<NextResponse> {
  return runFromRequest(req, () => runSweep(req));
}
