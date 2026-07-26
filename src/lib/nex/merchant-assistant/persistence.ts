// NEX Merchant Assistant — thread + message persistence.
//
// Threads and messages back the audit trail per the Phase 7 Increment 3
// audit approach (Option A per Philip): every tool call recorded in
// app_nex_merchant_assistant_messages.tool_calls JSONB. Extension to
// os_activity_events deferred to a later increment.
//
// All writes use supabaseAdmin (service-role, bypasses RLS). Merchant
// ownership is enforced by the callers passing ctx.merchantId — never
// trusted from client input.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AnthropicContentBlock } from "@/lib/llm/anthropic";
import type { ToolExecutionResult } from "./types";

export type ToolCallAuditEntry = {
  tool: string;
  input: Record<string, unknown>;
  result: ToolExecutionResult;
};

/** Load or create an active thread for the caller. If threadId is
 *  passed, verify ownership before returning. Returns a threadId. */
export async function ensureThread(
  merchantId: string,
  threadId: string | null
): Promise<string> {
  if (threadId) {
    const { data } = await supabaseAdmin
      .from("app_nex_merchant_assistant_threads")
      .select("id, merchant_id")
      .eq("id", threadId)
      .maybeSingle();
    // Ownership re-check
    if (data && (data.merchant_id as string) === merchantId) {
      await supabaseAdmin
        .from("app_nex_merchant_assistant_threads")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", threadId);
      return threadId;
    }
    // Fall through — mismatched or missing thread → create a fresh one
  }

  const { data: created, error } = await supabaseAdmin
    .from("app_nex_merchant_assistant_threads")
    .insert({ merchant_id: merchantId })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Could not create thread: ${error?.message ?? "unknown"}`);
  }
  return created.id as string;
}

/** Persist a chat message with any tool_calls audit trail. */
export async function persistMessage(input: {
  threadId: string;
  merchantId: string;
  role: "user" | "assistant" | "system";
  content: AnthropicContentBlock[] | string;
  toolCalls?: ToolCallAuditEntry[];
}): Promise<void> {
  // Normalise to content-block array
  const contentBlocks: AnthropicContentBlock[] =
    typeof input.content === "string"
      ? [{ type: "text", text: input.content }]
      : input.content;

  const toolCallsPayload =
    input.toolCalls && input.toolCalls.length > 0
      ? input.toolCalls.map((c) => ({
          tool: c.tool,
          input: c.input,
          result: c.result,
        }))
      : null;

  await supabaseAdmin.from("app_nex_merchant_assistant_messages").insert({
    thread_id: input.threadId,
    merchant_id: input.merchantId,
    role: input.role,
    content: contentBlocks,
    tool_calls: toolCallsPayload,
  });
}
