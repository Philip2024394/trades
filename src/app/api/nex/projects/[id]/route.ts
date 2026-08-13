// GET    /api/nex/projects/:id   · fetch a single project
// PATCH  /api/nex/projects/:id   · update status / conversation_id / append_message
// DELETE /api/nex/projects/:id   · cancel (hard delete for v1)
// Philip 2026-08-02 · Project Object v2 · Supabase-backed.

import { NextResponse } from "next/server";
import {
  appendMessageForSession,
  cancelProjectForSession,
  getProjectForSession,
  updateConversationIdForSession,
  updatePurposeForSession,
  updateStatusForSession,
} from "@/lib/nex/projects/server-repo";
import type {
  ProjectMessageRole,
  ProjectStatus,
} from "@/lib/nex/projects/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

const STATUSES = new Set<ProjectStatus>([
  "planning",
  "waiting_for_quotation",
  "quotation_received",
  "agreed",
  "in_progress",
  "completed",
  "reviewed",
]);

const MESSAGE_ROLES = new Set<ProjectMessageRole>(["customer", "nex", "merchant"]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const project = await getProjectForSession(sessionId, id);
    if (!project) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, project });
  } catch (err) {
    console.error("[nex-projects][GET/id]", err);
    const detail =
      process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json(
      { ok: false, error: "get_failed", detail },
      { status: 500 },
    );
  }
}

type PatchBody = {
  status?: ProjectStatus;
  conversation_id?: string;
  // Purpose · pass a string to set/replace · null to clear · omit to leave.
  purpose?: string | null;
  append_message?: {
    role?: ProjectMessageRole;
    text?: string;
  };
};

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 400 });
  }
  const { id } = await ctx.params;
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    let latest = await getProjectForSession(sessionId, id);
    if (!latest) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) {
        return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
      }
      latest = (await updateStatusForSession(sessionId, id, body.status)) ?? latest;
    }

    if (body.conversation_id !== undefined) {
      const cid = String(body.conversation_id).trim();
      if (cid.length > 0) {
        latest = (await updateConversationIdForSession(sessionId, id, cid)) ?? latest;
      }
    }

    if (body.purpose !== undefined) {
      const val = body.purpose === null ? null : String(body.purpose).slice(0, 240);
      latest = (await updatePurposeForSession(sessionId, id, val)) ?? latest;
    }

    if (body.append_message !== undefined) {
      const role = body.append_message.role;
      const text = body.append_message.text?.trim();
      if (!role || !MESSAGE_ROLES.has(role) || !text) {
        return NextResponse.json({ ok: false, error: "invalid_message" }, { status: 400 });
      }
      latest = (await appendMessageForSession(sessionId, id, role, text)) ?? latest;
    }

    return NextResponse.json({ ok: true, project: latest });
  } catch (err) {
    console.error("[nex-projects][PATCH]", err);
    return NextResponse.json({ ok: false, error: "patch_failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 400 });
  }
  const { id } = await ctx.params;
  try {
    const removed = await cancelProjectForSession(sessionId, id);
    if (!removed) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[nex-projects][DELETE]", err);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
