// Post state machine + transition helpers.
// The DB CHECK constraint on status enforces the enum values. This
// module enforces the ALLOWED_TRANSITIONS graph so we can never move
// a post from "published" back to "draft" (or similar illegal jumps).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ALLOWED_TRANSITIONS, type PostState, type SocialPost } from "./types";
import { auditSocial } from "./audit";

export type TransitionInput = {
  postId:     string;
  from:       PostState;
  to:         PostState;
  actor:      string;
  reason?:    string;
  patch?:     Partial<SocialPost>;                  // e.g. { approved_by, approved_at }
};

export async function transitionPost(input: TransitionInput): Promise<SocialPost> {
  if (!ALLOWED_TRANSITIONS[input.from].includes(input.to)) {
    throw new Error(`illegal transition ${input.from} → ${input.to}`);
  }

  const patch: Partial<SocialPost> = { ...(input.patch ?? {}), status: input.to };
  if (input.to === "rejected") patch.rejected_reason = input.reason ?? "no reason given";

  const { data, error } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .update(patch)
    .eq("id", input.postId)
    .eq("status", input.from)         // optimistic concurrency
    .select("*")
    .single();
  if (error || !data) throw new Error(`transition failed: ${error?.message ?? "row missing or state changed"}`);

  await auditSocial({
    merchantSlug: (data as SocialPost).merchant_slug,
    actor:        input.actor,
    action:       `post.${input.to}`,
    postId:       input.postId,
    details:      { from: input.from, to: input.to, reason: input.reason }
  });

  return data as unknown as SocialPost;
}

export async function readPost(id: string): Promise<SocialPost | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SocialPost) ?? null;
}
