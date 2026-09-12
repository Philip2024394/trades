// src/app/api/nex/conversations/[id]/route.ts
//
// Founder Phase 13 · P13-2 · Read a specific conversation + append a message.
//
// GET   → conversation + messages
// POST  { role, content, meta? } → appends a message (auto-titles on first user msg)

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { getConversation, appendMessage, createConversation } from "@/lib/nex/conversations";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await getConversation(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const role = body.role as string;
  const content = body.content as string;
  if (!["user", "assistant", "system", "tool"].includes(role ?? "")) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }
  if (typeof content !== "string" || content.length === 0 || content.length > 100_000) {
    return NextResponse.json({ error: "invalid_content" }, { status: 400 });
  }

  // Ensure the conversation exists (upsert semantics for new sessions).
  const existing = await getConversation(id);
  if (!existing) {
    await createConversation({ conversation_id: id, user_id: session?.user_id ?? null });
  }

  const msg = await appendMessage({
    conversation_id: id,
    role: role as "user" | "assistant" | "system" | "tool",
    content,
    meta: (body.meta as Record<string, unknown>) ?? undefined,
  });
  if (!msg) return NextResponse.json({ error: "persistence_unavailable" }, { status: 503 });
  return NextResponse.json({ message: msg });
}
