// Mate cross-session memory. Read is cheap (one row). Refresh is a
// small Haiku call fired-and-forgotten after every ~8 messages.
//
// Injected into the fresh system suffix (not the cached prefix) so
// per-user memory doesn't kill the platform-wide prompt cache.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { completeJson } from "@/lib/llm/anthropic";
import type { MateSurface } from "./tools/types";

const REFRESH_EVERY = 8;                        // refresh after every 8 new messages
const MODEL_HAIKU   = "claude-haiku-4-5-20251001";

export type MateUserMemory = {
  surface:                  MateSurface;
  user_key:                 string;
  summary:                  string | null;
  salient_facts:            Record<string, unknown>;
  refreshed_at:             string | null;
  message_count_at_refresh: number;
};

/** Fast read — one row. Called on every Mate turn. */
export async function getUserMemory(surface: MateSurface, userKey: string): Promise<MateUserMemory | null> {
  if (surface === "visitor") return null;
  const { data } = await supabaseAdmin
    .from("hammerex_mate_user_memory")
    .select("surface, user_key, summary, salient_facts, refreshed_at, message_count_at_refresh")
    .eq("surface", surface)
    .eq("user_key", userKey)
    .maybeSingle();
  return (data ?? null) as MateUserMemory | null;
}

/** Format the memory for injection into the fresh system prompt.
 *  Returns "" when there's nothing yet — Mate just doesn't mention it. */
export function memoryToText(mem: MateUserMemory | null): string {
  if (!mem || (!mem.summary && Object.keys(mem.salient_facts ?? {}).length === 0)) return "";
  const facts = mem.salient_facts ?? {};
  const factLines = Object.entries(facts).map(([k, v]) => `  • ${k}: ${JSON.stringify(v)}`).join("\n");
  return [
    "WHAT YOU REMEMBER ABOUT THIS USER (from prior conversations — cite naturally, don't recite):",
    mem.summary ? mem.summary : "(no summary yet)",
    factLines ? `Salient facts:\n${factLines}` : ""
  ].filter(Boolean).join("\n");
}

/** Decide whether to fire a background refresh after the current turn.
 *  Returns true when we've accumulated REFRESH_EVERY new messages
 *  since the last refresh — or when there's no memory row yet at all. */
export function shouldRefresh(mem: MateUserMemory | null, currentMessageCount: number): boolean {
  if (!mem) return currentMessageCount >= 2;   // first refresh after 2 messages (1 user + 1 assistant)
  return (currentMessageCount - mem.message_count_at_refresh) >= REFRESH_EVERY;
}

type RefreshedShape = {
  summary:       string;
  salient_facts: Record<string, unknown>;
};

/** Background refresh — Haiku summarises the last N messages + folds
 *  in the previous summary. Fire-and-forget from the converse route.
 *  Never throws; on any failure the memory row is left untouched. */
export async function refreshUserMemory(surface: MateSurface, userKey: string, conversationIds: string[]): Promise<void> {
  if (surface === "visitor") return;
  try {
    const previous = await getUserMemory(surface, userKey);

    // Grab the most recent ~16 messages across the user's most recent
    // conversations. Batched into one query for cost.
    const { data: msgRows } = await supabaseAdmin
      .from("hammerex_mate_messages")
      .select("role, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(16);

    const recent = (msgRows ?? []).reverse();
    if (recent.length === 0) return;

    const transcript = recent.map((r) => `${r.role === "assistant" ? "MATE" : "USER"}: ${(r.content ?? "").slice(0, 400)}`).join("\n");

    const prompt = [
      previous?.summary
        ? `Previous memory summary: ${previous.summary}\n\nPrevious salient facts: ${JSON.stringify(previous.salient_facts ?? {})}\n\n`
        : "",
      "New conversation excerpts:",
      transcript,
      "",
      `You maintain a rolling memory for one ${surface} on The Networkers, a UK trades platform.`,
      "Return STRICT JSON with two keys:",
      '  "summary": under 200 words, first-person voice ("They asked about...", "They tend to...")',
      '  "salient_facts": object with up to 10 useful stable facts (city, primary trade, style preferences, recurring pain points, wins). Skip transient stuff.',
      "Never invent facts. If unsure, omit."
    ].join("\n");

    const refreshed = await completeJson<RefreshedShape>({
      system: "You are a memory summariser. Output JSON only. No prose.",
      messages: [{ role: "user", content: prompt }],
      model:   MODEL_HAIKU,
      maxTokens: 500,
      temperature: 0.2
    });

    if (!refreshed || typeof refreshed.summary !== "string") return;

    // Count messages so shouldRefresh() knows when to fire next time
    const { count } = await supabaseAdmin
      .from("hammerex_mate_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds);

    await supabaseAdmin
      .from("hammerex_mate_user_memory")
      .upsert({
        surface,
        user_key:                 userKey,
        summary:                  refreshed.summary.slice(0, 2000),
        salient_facts:            refreshed.salient_facts ?? {},
        refreshed_at:             new Date().toISOString(),
        message_count_at_refresh: count ?? 0
      }, { onConflict: "surface,user_key" });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[mate/memory] refresh failed", e);
  }
}

/** Pull the conversation IDs for a user (used by the refresh path). */
export async function conversationIdsForUser(surface: MateSurface, userKey: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_mate_conversations")
    .select("id")
    .eq("surface", surface)
    .eq("user_key", userKey)
    .order("last_message_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => r.id as string);
}
