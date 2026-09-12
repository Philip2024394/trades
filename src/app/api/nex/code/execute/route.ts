// src/app/api/nex/code/execute/route.ts
//
// Founder Phase 20 · P20-3 · Sandboxed JavaScript execution endpoint.
//
// POST body: { code, language?, budget_ms?, conversation_id? }
//
// Doctrine anchors:
//   code-doctrine · output is INPUT · never establishes truth
//   #5 · code text passes through untrusted-content sanitiser before storage

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { executeSandboxed, persistExecution } from "@/lib/nex/code-interpreter";
import { CodeExecuteRequestSchema } from "@/lib/nex/code-interpreter/contract";
import { sanitiseUntrustedContent } from "@/lib/nex/live-chat-completion/safety/untrusted-content-sanitiser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const parsed = CodeExecuteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", detail: parsed.error.flatten() }, { status: 400 });
  }

  // Doctrine #5 · sanitise the code text before persisting it as an artefact.
  // NOTE: the sanitiser runs against the code STRING to protect provenance
  // storage · we do NOT modify the code that runs, since JS is a code path
  // not a text path. The sanitiser output is only used for the stored hash.
  const sanit = sanitiseUntrustedContent({ text: parsed.data.code, source_kind: "tool" });

  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);
  const conversation_id = typeof body.conversation_id === "string" ? body.conversation_id : null;

  try {
    const result = await executeSandboxed(parsed.data);

    persistExecution(result, {
      conversation_id,
      user_id: session?.user_id ?? null,
      sanitiser_neutralised: sanit.neutralised_count,
    });

    return NextResponse.json({
      ok: result.ok,
      execution_id: result.execution_id,
      language: result.language,
      code_hash: result.code_hash,
      code_length: result.code_length,
      stdout: result.stdout,
      stderr: result.stderr,
      return_value: result.return_value,
      return_kind: result.return_kind,
      timed_out: result.timed_out,
      error_class: result.error_class,
      error_message: result.error_message,
      request_ms: result.request_ms,
      doctrine_note: "COMPUTED OUTPUT IS INPUT · NEVER ESTABLISHES TRUTH",
      sanitiser_neutralised: sanit.neutralised_count,
    });
  } catch (e) {
    return NextResponse.json({
      error: "execute_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}
