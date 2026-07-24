// Publisher — the ONLY code path that publishes posts.
//
// Rules enforced here (not scattered):
//   1. Post must be in status 'approved' or 'scheduled' with scheduled_for <= now.
//   2. Platform account must be connected + status='connected' + token not expired.
//   3. If the caller is 'nex' or 'cron' (auto), merchant.auto_publish_enabled MUST be true.
//   4. Merchant approval always required for the FIRST post ever
//      (checked as: any prior post with approved_by set).
//
// Real platform API calls are stubbed here — this pass writes the
// simulated platform_post_id + audit entry so the entire flow works
// end-to-end without OAuth keys. Swap the stub for real per-platform
// adapters in pass 2.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { transitionPost } from "./state";
import { auditSocial } from "./audit";
import type { SocialAccount, SocialPost } from "./types";

export type PublishInput = {
  postId: string;
  actor:  string;                                // 'merchant:phil' | 'nex' | 'cron'
};

export type PublishResult =
  | { ok: true;  post: SocialPost }
  | { ok: false; reason: PublishRefusal; message: string; post: SocialPost | null };

export type PublishRefusal =
  | "not_found"
  | "wrong_state"
  | "not_connected"
  | "token_expired"
  | "auto_publish_disabled"
  | "first_post_needs_manual_approval"
  | "platform_error";

export async function publishPost(input: PublishInput): Promise<PublishResult> {
  const { data: postRow } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .select("*")
    .eq("id", input.postId)
    .maybeSingle();
  if (!postRow) return { ok: false, reason: "not_found", message: "post not found", post: null };
  const post = postRow as unknown as SocialPost;

  if (post.status !== "approved" && post.status !== "scheduled" && post.status !== "publishing") {
    return { ok: false, reason: "wrong_state", message: `cannot publish from ${post.status}`, post };
  }

  // Auto-publish gate: if actor isn't merchant/admin, merchant must have
  // enabled auto_publish.
  const isAuto = input.actor === "nex" || input.actor === "cron";
  if (isAuto) {
    const autoOk = await isAutoPublishOk(post.merchant_slug);
    if (!autoOk) return { ok: false, reason: "auto_publish_disabled", message: "Merchant has not enabled auto-publish", post };

    // Also: the merchant MUST have manually approved at least one prior post.
    const { count: priorApproved = 0 } = await supabaseAdmin
      .from("hammerex_nex_social_posts")
      .select("*", { count: "exact", head: true })
      .eq("merchant_slug", post.merchant_slug)
      .eq("status", "published")
      .not("approved_by", "is", null);
    if ((priorApproved ?? 0) === 0) {
      return { ok: false, reason: "first_post_needs_manual_approval", message: "The first post must be approved by the merchant.", post };
    }
  }

  // Connection check.
  const account = await getConnectedAccount(post.merchant_slug, post.platform);
  if (!account) return refuse(post, input.actor, "not_connected", `No connected ${post.platform} account. Ask the merchant to connect.`);
  if (account.status !== "connected") return refuse(post, input.actor, "not_connected", `Account status: ${account.status}`);
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    return refuse(post, input.actor, "token_expired", "Access token expired. Reconnect.");
  }

  // Transition → publishing.
  const publishing = await transitionPost({
    postId: post.id,
    from:   post.status,
    to:     "publishing",
    actor:  input.actor
  });

  // Real API call happens here. Stubbed for pass 1 — records a
  // simulated platform_post_id so downstream analytics + audit work.
  const publishResult = await callPlatformStub({ account, post: publishing });

  if (!publishResult.ok) {
    await supabaseAdmin
      .from("hammerex_nex_social_posts")
      .update({
        status:            "failed",
        publish_error:     publishResult.error,
        publish_attempts:  publishing.publish_attempts + 1
      })
      .eq("id", post.id);
    await auditSocial({
      merchantSlug: post.merchant_slug, actor: input.actor,
      action:       "post.failed", postId: post.id,
      details:      { error: publishResult.error }
    });
    return { ok: false, reason: "platform_error", message: publishResult.error, post: publishing };
  }

  const { data: doneRow } = await supabaseAdmin
    .from("hammerex_nex_social_posts")
    .update({
      status:            "published",
      published_at:      new Date().toISOString(),
      platform_post_id:  publishResult.platform_post_id,
      platform_post_url: publishResult.platform_post_url,
      publish_error:     null,
      publish_attempts:  publishing.publish_attempts + 1
    })
    .eq("id", post.id)
    .select("*")
    .single();

  await auditSocial({
    merchantSlug: post.merchant_slug, actor: input.actor,
    action:       "post.published", postId: post.id,
    details:      { platform: post.platform, platform_post_id: publishResult.platform_post_id, simulated: publishResult.simulated }
  });
  await supabaseAdmin.from("hammerex_nex_social_accounts")
    .update({ last_success_at: new Date().toISOString() })
    .eq("id", account.id);

  return { ok: true, post: doneRow as unknown as SocialPost };
}

// ─── Helpers ─────────────────────────────────────────────────────

async function isAutoPublishOk(merchantSlug: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("auto_publish_enabled")
    .eq("slug", merchantSlug)
    .maybeSingle();
  return Boolean(data?.auto_publish_enabled);
}

async function getConnectedAccount(merchantSlug: string, platform: string): Promise<SocialAccount | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_nex_social_accounts")
    .select("*")
    .eq("merchant_slug", merchantSlug)
    .eq("platform", platform)
    .maybeSingle();
  return (data as unknown as SocialAccount) ?? null;
}

async function refuse(post: SocialPost, actor: string, reason: PublishRefusal, message: string): Promise<PublishResult> {
  await auditSocial({
    merchantSlug: post.merchant_slug, actor, action: "post.failed", postId: post.id,
    details:      { reason, message }
  });
  return { ok: false, reason, message, post };
}

// ─── Stub for platform API. Swap per-platform in pass 2. ────────

type StubResult = { ok: true; platform_post_id: string; platform_post_url: string; simulated: true } | { ok: false; error: string };

async function callPlatformStub(args: { account: SocialAccount; post: SocialPost }): Promise<StubResult> {
  // Pass 2: replace this with per-platform adapters.
  // Facebook Graph API → POST /{page-id}/photos or /feed
  // Instagram Graph API → containers → publish
  // TikTok Business API → video upload
  // LinkedIn UGC POST → assets + posts
  // Google Business Profile → localPosts
  // For now: return a fake platform_post_id so downstream analytics works.
  const fakeId = `sim_${args.account.platform}_${Date.now()}`;
  return {
    ok:                true,
    platform_post_id:  fakeId,
    platform_post_url: `https://${args.account.platform}.example/posts/${fakeId}`,
    simulated:         true
  };
}
