// src/app/api/nex-control/agents/stop/route.ts
//
// NEX Agent Runtime · Control Plane · STOP endpoint
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §3 · §17 · §26 · §28
//
// STOP must actually stop (§3). This endpoint:
//   1. Verifies founder identity.
//   2. Writes desired_state=STOPPED to the registry.
//   3. If `agent_id === "all"`, sets the founder_stop_override flag
//      (§17) so no watchdog can restart the agents.
//   4. Sends SIGTERM to the live process, waits for graceful exit,
//      escalates to force-kill if grace expires.
//   5. Records the audit outcome with the actual result.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveFounderIdentity } from "@/lib/nex/founder/identity";
import {
  stopAgent,
  stopAll,
  ensureAuthorizedAgentsRegistered,
} from "@/lib/nex/agent-runtime/control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveFounder(): Promise<{ userId: string | null; authorized: boolean; reason: string }> {
  const auth = await getAuthenticatedUser();
  if (!auth.ok) {
    return { userId: null, authorized: false, reason: `no_authenticated_user:${auth.error}` };
  }
  const identity = resolveFounderIdentity({
    supabase_user_id: auth.user.supabase_user_id,
    email: auth.user.email ?? "",
  });
  if (identity.kind !== "founder_candidate") {
    return { userId: auth.user.supabase_user_id, authorized: false, reason: `not_founder:${identity.reason}` };
  }
  return { userId: identity.supabase_user_id, authorized: true, reason: "founder_identity_verified" };
}

export async function POST(req: Request) {
  ensureAuthorizedAgentsRegistered();
  const { userId: founderUserId, authorized, reason } = await resolveFounder();

  const body = await req.json().catch(() => ({}));
  const target: string = String(body.agent_id ?? "").toLowerCase();
  const graceMs = typeof body.grace_ms === "number" ? body.grace_ms : undefined;

  if (!authorized) {
    if (target === "all") {
      const r = await stopAll({
        founder_user_id: null,
        authorization: "REJECTED",
        authorization_reason: reason,
      });
      return NextResponse.json({ ok: false, unauthorized: true, reason, per_agent: r.per_agent }, { status: 401 });
    }
    if (target === "programmer" || target === "accommodation") {
      const r = await stopAgent({
        agent_id: target,
        founder_user_id: null,
        authorization: "REJECTED",
        authorization_reason: reason,
      });
      return NextResponse.json({ ok: false, unauthorized: true, reason, result: r }, { status: 401 });
    }
    return NextResponse.json({ ok: false, unauthorized: true, reason }, { status: 401 });
  }

  if (target === "all") {
    const r = await stopAll({
      founder_user_id: founderUserId,
      authorization: "AUTHORIZED",
      authorization_reason: reason,
    });
    return NextResponse.json({ ok: true, per_agent: r.per_agent, override_set: r.override_set });
  }
  if (target !== "programmer" && target !== "accommodation") {
    return NextResponse.json(
      { ok: false, reason: `unknown_agent_id:${target}` },
      { status: 400 },
    );
  }
  const r = await stopAgent({
    agent_id: target,
    founder_user_id: founderUserId,
    authorization: "AUTHORIZED",
    authorization_reason: reason,
    grace_ms: graceMs,
  });
  return NextResponse.json({ ok: r.ok, result: r });
}
