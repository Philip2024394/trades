// Mate knowledge gaps — when a user thumbs-down a reply, we cluster
// the failure by normalised question and log it for admin curation.
// Repeat failures increment the same row so the top of the queue is
// the highest-signal thing to teach Mate about.

import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Cluster similar questions. First 120 chars, lowercased, whitespace
 *  collapsed, punctuation stripped, hashed. Not vector-perfect but
 *  catches near-duplicates cheaply. Vector similarity is a v2 upgrade. */
export function clusterKeyFor(question: string): string {
  const normalised = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return createHash("sha1").update(normalised).digest("hex");
}

/** Record a thumbs-down as a knowledge gap. Fire-and-forget from the
 *  feedback route. Never throws — if this fails the feedback signal
 *  still landed on the message row. */
export async function recordGap(messageId: string): Promise<void> {
  try {
    // Load the flagged assistant message + the immediately preceding
    // user message so we've got the question that produced the bad reply.
    const { data: asst } = await supabaseAdmin
      .from("hammerex_mate_messages")
      .select("id, conversation_id, content, context_snapshot, created_at")
      .eq("id", messageId)
      .eq("role", "assistant")
      .maybeSingle();
    if (!asst) return;

    const { data: convRow } = await supabaseAdmin
      .from("hammerex_mate_conversations")
      .select("surface")
      .eq("id", asst.conversation_id)
      .maybeSingle();
    if (!convRow) return;

    const { data: prior } = await supabaseAdmin
      .from("hammerex_mate_messages")
      .select("content, created_at")
      .eq("conversation_id", asst.conversation_id)
      .eq("role", "user")
      .lt("created_at", asst.created_at)
      .order("created_at", { ascending: false })
      .limit(1);
    const question = prior?.[0]?.content ?? "(unknown question)";
    const cluster  = clusterKeyFor(question);

    // Upsert — if the cluster already exists, bump count + last_flagged_at.
    const { data: existing } = await supabaseAdmin
      .from("hammerex_mate_gaps")
      .select("id, thumbs_down_count, status")
      .eq("cluster_key", cluster)
      .maybeSingle();

    if (existing) {
      // Re-opens a dismissed/reviewed gap if it starts firing again.
      await supabaseAdmin
        .from("hammerex_mate_gaps")
        .update({
          thumbs_down_count: existing.thumbs_down_count + 1,
          last_flagged_at:   new Date().toISOString(),
          status:            existing.status === "promoted" ? "promoted" : "open"
        })
        .eq("id", existing.id);
      return;
    }

    await supabaseAdmin.from("hammerex_mate_gaps").insert({
      cluster_key:       cluster,
      surface:           convRow.surface,
      sample_question:   question.slice(0, 1000),
      sample_reply:      (asst.content ?? "").slice(0, 2000),
      sample_message_id: asst.id,
      context_snapshot:  asst.context_snapshot
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[mate/gaps] recordGap failed:", e);
  }
}
