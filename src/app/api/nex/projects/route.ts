// GET /api/nex/projects       · list projects for session
// POST /api/nex/projects      · create a new project
// Philip 2026-08-02 · Project Object v2 · Supabase-backed.
//
// Session identity is passed via the `x-nex-session-id` header (browser
// generates + persists a UUID in localStorage). No auth in v1 · server
// filters every query by session_id so browsers see only their own rows.

import { NextResponse } from "next/server";
import {
  createProjectForSession,
  listProjectsForSession,
} from "@/lib/nex/projects/server-repo";
import type { ProjectIntent } from "@/lib/nex/projects/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSessionId(req: Request): string | null {
  const raw = req.headers.get("x-nex-session-id");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

export async function GET(req: Request) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 400 });
  }
  try {
    const projects = await listProjectsForSession(sessionId);
    return NextResponse.json({ ok: true, projects });
  } catch (err) {
    console.error("[nex-projects][GET]", err);
    const detail =
      process.env.NODE_ENV !== "production" && err instanceof Error ? err.message : undefined;
    return NextResponse.json(
      { ok: false, error: "list_failed", detail },
      { status: 500 },
    );
  }
}

type CreateBody = {
  merchant_id?: string;
  merchant_name?: string;
  merchant_avatar_url?: string;
  intent?: ProjectIntent;
  purpose?: string;
  initial_customer_message?: string;
  initial_nex_reply?: string;
  conversation_id?: string;
};

const KNOWN_INTENTS = new Set(["quote", "survey", "question", "order", "advice"]);

export async function POST(req: Request) {
  const sessionId = readSessionId(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "session_id_required" }, { status: 400 });
  }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  const merchant_id = body.merchant_id?.trim();
  const merchant_name = body.merchant_name?.trim();
  if (!merchant_id || !merchant_name) {
    return NextResponse.json(
      { ok: false, error: "merchant_id_and_name_required" },
      { status: 400 },
    );
  }
  const intent =
    body.intent && KNOWN_INTENTS.has(body.intent) ? body.intent : undefined;
  try {
    const project = await createProjectForSession({
      sessionId,
      merchant_id,
      merchant_name,
      merchant_avatar_url: body.merchant_avatar_url?.trim() || undefined,
      intent,
      purpose: body.purpose?.trim() || undefined,
      initial_customer_message: body.initial_customer_message?.trim() || undefined,
      initial_nex_reply: body.initial_nex_reply?.trim() || undefined,
      conversation_id: body.conversation_id?.trim() || undefined,
    });
    return NextResponse.json({ ok: true, project });
  } catch (err) {
    console.error("[nex-projects][POST]", err);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
