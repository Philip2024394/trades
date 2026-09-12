// src/app/api/nex-control/agents/start/route.ts
//
// NEX Agent Runtime · Control Plane · START endpoint
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · §26 · §27 · §28
//
// Reuses the existing NEX founder identity/auth surface at
// src/lib/nex/founder/identity.ts — never creates a parallel
// authentication mechanism (§26).
//
// Body:
//   { agent_id: "programmer" | "accommodation" | "all" }
//
// Every command is audited via command-audit.ts. Unauthorized requests
// are recorded (with authorization: REJECTED) then rejected — §28: no
// silent activation, no silent rejection.

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/nex/brains/_auth";
import { resolveFounderIdentity } from "@/lib/nex/founder/identity";
import {
  startAgent,
  startAll,
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

  if (!authorized) {
    // §28: still audit the unauthorized attempt below via startAgent().
    if (target === "all") {
      const r = await startAll({
        founder_user_id: null,
        authorization: "REJECTED",
        authorization_reason: reason,
      });
      return NextResponse.json({ ok: false, unauthorized: true, reason, per_agent: r.per_agent }, { status: 401 });
    }
    if (target === "programmer" || target === "accommodation") {
      const r = await startAgent({
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
    const r = await startAll({
      founder_user_id: founderUserId,
      authorization: "AUTHORIZED",
      authorization_reason: reason,
    });
    return NextResponse.json({ ok: true, per_agent: r.per_agent, override_released: r.override_released });
  }
  if (target !== "programmer" && target !== "accommodation") {
    return NextResponse.json(
      { ok: false, reason: `unknown_agent_id:${target}` },
      { status: 400 },
    );
  }
  const r = await startAgent({
    agent_id: target,
    founder_user_id: founderUserId,
    authorization: "AUTHORIZED",
    authorization_reason: reason,
  });
  return NextResponse.json({ ok: r.ok, result: r });
}
