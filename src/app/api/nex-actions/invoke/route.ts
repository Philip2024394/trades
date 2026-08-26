// src/app/api/nex-actions/invoke/route.ts
//
// The ONE endpoint that runs NEX Actions. All grenades / consumables /
// intelligence / actions flow through here. Server enforces auth + resolves
// the action from the registry + runs through the deps chain. The client
// never provides costs, balances, or outcomes.

import { NextResponse, type NextRequest } from "next/server";
import { runNexAction } from "@/lib/nex-actions/runtime/run";
import { nexActionRuntimeDeps } from "@/lib/nex-actions/runtime/deps";
import type { NexActionContext } from "@/lib/nex-actions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvokeBody = {
  actionId: string;
  nonce?: string;
  target?: {
    kind: "message";
    messageId: string;
    conversationId: string;
  };
  clientPayload?: Record<string, unknown>;
};

// MVP auth: read the user identity from a header. F4 will replace with
// Supabase session validation. For dev + smoke testing we accept:
//   x-nex-user-id           (required)
//   x-nex-user-display-name (required)
async function resolveUser(req: NextRequest): Promise<{ id: string; displayName: string } | null> {
  const id = req.headers.get("x-nex-user-id");
  const displayName = req.headers.get("x-nex-user-display-name");
  if (!id || !displayName) return null;
  return { id, displayName };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: InvokeBody;
  try {
    body = (await req.json()) as InvokeBody;
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad-request", message: "invalid JSON" } }, { status: 400 });
  }
  if (!body?.actionId || typeof body.actionId !== "string") {
    return NextResponse.json({ ok: false, error: { code: "bad-request", message: "actionId required" } }, { status: 400 });
  }

  const user = await resolveUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: { code: "unauthorised" } }, { status: 401 });
  }

  const ctx: NexActionContext = {
    actionId:  body.actionId,
    invokedAt: Date.now(),
    user,
    target:    body.target,
    clientPayload: { ...(body.clientPayload ?? {}), nonce: body.nonce },
  };

  const result = await runNexAction(body.actionId, ctx, nexActionRuntimeDeps);

  // Log server-side rejection reason so dev console has visibility (Next
  // dev otherwise swallows the JSON body when status is >= 400).
  if (!result.ok) {
    console.warn(
      `[nex-actions] action=${body.actionId} user=${user.id} target=${JSON.stringify(body.target ?? null)} → REJECT`,
      JSON.stringify(result.error),
    );
  }

  const status = result.ok
    ? 200
    : result.error.code === "unauthorised" ? 401
    : result.error.code === "forbidden"    ? 403
    : result.error.code === "rate-limited" ? 429
    : result.error.code === "insufficient-sparks" ? 402
    : result.error.code === "handler-not-found"   ? 404
    : result.error.code === "handler-failed"
      && typeof (result.error as { message?: string }).message === "string"
      && /message-not-found|already-deleted/.test((result.error as { message: string }).message)
        ? 404
    : 500;

  return NextResponse.json(result, { status });
}
