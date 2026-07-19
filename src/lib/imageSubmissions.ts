// Trade image submissions — server-side helpers.
//
// Runs the auto-quality gate on incoming image URLs, then
// reads/writes the networkers_image_submissions table. Public search
// helper here unions with the curated hero library on the caller
// side so /trade-off/search Inspiration can render both without
// caring which source produced each image.
//
// SERVER-ONLY.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SubmissionStatus = "pending" | "auto_approved" | "approved" | "rejected";

/** Product tag on a Site Interest image. Human-tagged only; never
 *  AI-inferred per feedback_never_suggest_extra_products.md. */
export type MaterialTag = {
  kind:  "hammerex" | "trade_center" | "external";
  ref:   string;   // canonical product identifier for the kind
  label: string;   // display name shown on the "Get materials" button
  url:   string;   // absolute link to the exact product page
};

export type ImageSubmission = {
  id: string;
  submitterSlug: string;
  submitterDisplay: string | null;
  submitterAvatarUrl: string | null;
  sourcePostId: string | null;
  sourceCanteenId: string | null;
  imageUrl: string;
  altText: string | null;
  tradeSlug: string | null;
  keywords: string[];
  materials: MaterialTag[];
  status: SubmissionStatus;
  qualityScore: number;
  qualityFlags: string[];
  moderatedBy: string | null;
  moderatedAt: string | null;
  moderationNote: string | null;
  createdAt: string;
};

// ─── Quality gate ─────────────────────────────────────────────
//
// Runs at submit time. Fast, non-blocking checks — no ML, no image
// processing yet. The gate returns:
//   • qualityScore (0-100)  — higher is better
//   • qualityFlags (string[]) — machine-readable reason codes
//   • initialStatus         — 'auto_approved' when quality clears
//                             the auto bar, 'pending' otherwise
//
// The auto bar is deliberately conservative: only images that clearly
// pass on every checkable dimension skip the queue. Anything ambiguous
// lands in pending and a human decides.

export type QualityResult = {
  qualityScore: number;
  qualityFlags: string[];
  initialStatus: "auto_approved" | "pending";
};

const AUTO_APPROVE_THRESHOLD = 80;

/** Fetch HEAD to get content-length + content-type without pulling
 *  the whole image. Timeouts and network failures return null so the
 *  caller can flag `unreachable` rather than swallow the miss. */
async function headImage(url: string): Promise<{ bytes: number; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    const ct = res.headers.get("content-type") ?? "";
    return { bytes: len, contentType: ct };
  } catch {
    return null;
  }
}

export async function runQualityGate(params: {
  imageUrl: string;
  altText?: string | null;
  keywords?: string[];
}): Promise<QualityResult> {
  const flags: string[] = [];
  let score = 100;

  // URL sanity — a bad URL is an instant reject candidate but we
  // still let the row land so admin can see the attempt (useful for
  // spotting bot floods).
  let host = "";
  try {
    host = new URL(params.imageUrl).hostname;
  } catch {
    flags.push("invalid_url");
    score -= 60;
  }

  // Known-good CDNs — nudge score up because we can trust dimensions
  // roughly (ImageKit auto-optimises). Not a guarantee, just a hint.
  if (host.endsWith(".imagekit.io") || host.endsWith(".imgix.net") || host.endsWith(".cloudinary.com")) {
    // trusted CDN — no score change but skip the HEAD check to save
    // latency (these CDNs return correct content-length for the raw
    // asset).
  } else {
    const head = await headImage(params.imageUrl);
    if (!head) {
      flags.push("unreachable");
      score -= 30;
    } else {
      if (!head.contentType.startsWith("image/")) {
        flags.push("not_an_image");
        score -= 40;
      }
      // File-size heuristic — smaller than 20KB is almost always a
      // thumbnail or icon; larger than 8MB is raw / unoptimised.
      if (head.bytes > 0 && head.bytes < 20 * 1024) {
        flags.push("likely_thumbnail");
        score -= 25;
      }
      if (head.bytes > 8 * 1024 * 1024) {
        flags.push("oversized");
        score -= 10;
      }
    }
  }

  // Alt text presence — accessibility + SEO signal. Missing alt is
  // recoverable in moderation (admin can add) but auto-approve
  // requires it.
  if (!params.altText || params.altText.trim().length < 6) {
    flags.push("missing_alt");
    score -= 15;
  }

  // Keywords — need at least one for the search index to hit.
  const keywordCount = (params.keywords ?? []).filter((k) => k.trim().length >= 2).length;
  if (keywordCount === 0) {
    flags.push("no_keywords");
    score -= 20;
  } else if (keywordCount === 1) {
    // Single keyword works but is a weaker signal — nudge down but
    // don't block auto-approve on its own.
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));
  const initialStatus: "auto_approved" | "pending" =
    score >= AUTO_APPROVE_THRESHOLD && flags.length === 0 ? "auto_approved" : "pending";

  return { qualityScore: score, qualityFlags: flags, initialStatus };
}

// ─── Table shaper ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeSubmission(r: any): ImageSubmission {
  // Defensive materials parse — JSONB comes back as a JS object or
  // string depending on the driver, and we don't trust anything to
  // be well-formed until we've validated shape.
  let materials: MaterialTag[] = [];
  const raw = r.materials;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const kind  = String(item.kind ?? "");
      const ref   = String(item.ref ?? "");
      const label = String(item.label ?? "");
      const url   = String(item.url ?? "");
      if (!ref || !label || !url) continue;
      if (kind !== "hammerex" && kind !== "trade_center" && kind !== "external") continue;
      materials.push({ kind, ref, label, url });
    }
  }
  return {
    id: r.id,
    submitterSlug: r.submitter_slug,
    submitterDisplay: r.submitter_display ?? null,
    submitterAvatarUrl: r.submitter_avatar_url ?? null,
    sourcePostId: r.source_post_id ?? null,
    sourceCanteenId: r.source_canteen_id ?? null,
    imageUrl: r.image_url,
    altText: r.alt_text ?? null,
    tradeSlug: r.trade_slug ?? null,
    keywords: (r.keywords ?? []) as string[],
    materials,
    status: r.status,
    qualityScore: r.quality_score ?? 0,
    qualityFlags: (r.quality_flags ?? []) as string[],
    moderatedBy: r.moderated_by ?? null,
    moderatedAt: r.moderated_at ?? null,
    moderationNote: r.moderation_note ?? null,
    createdAt: r.created_at
  };
}

// ─── Reads ────────────────────────────────────────────────────

/** Moderator queue — pending + auto_approved, oldest first (FIFO
 *  fairness). Auto-approved rows are still visible so admin can
 *  spot-check the gate + un-approve if it let something junky
 *  through. */
export async function imageSubmissionsQueue(limit = 60): Promise<ImageSubmission[]> {
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .select("*")
    .in("status", ["pending", "auto_approved"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (res.error || !res.data) return [];
  return res.data.map(shapeSubmission);
}

/** Public search — approved rows only, keyword intersection with the
 *  query tokens. Feeds the Inspiration tab alongside curated
 *  hero-library entries. */
/** Look up a single approved submission by its UUID. Powers the
 *  /trade-off/inspiration/[id] detail page for trade-uploaded images. */
export async function submissionById(id: string): Promise<ImageSubmission | null> {
  if (!id) return null;
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .select("*")
    .eq("id", id)
    .in("status", ["auto_approved", "approved"])
    .maybeSingle();
  if (res.error || !res.data) return null;
  const r = res.data;
  return {
    id:                 r.id as string,
    submitterSlug:      r.submitter_slug as string,
    submitterDisplay:   (r.submitter_display ?? null) as string | null,
    submitterAvatarUrl: (r.submitter_avatar_url ?? null) as string | null,
    sourcePostId:       (r.source_post_id ?? null) as string | null,
    sourceCanteenId:    (r.source_canteen_id ?? null) as string | null,
    imageUrl:           r.image_url as string,
    altText:            (r.alt_text ?? null) as string | null,
    tradeSlug:          (r.trade_slug ?? null) as string | null,
    keywords:           (r.keywords ?? []) as string[],
    materials:          (r.materials ?? []) as MaterialTag[],
    status:             r.status as SubmissionStatus,
    qualityScore:       (r.quality_score ?? 0) as number,
    qualityFlags:       (r.quality_flags ?? []) as string[],
    moderatedBy:        (r.moderated_by ?? null) as string | null,
    moderatedAt:        (r.moderated_at ?? null) as string | null,
    moderationNote:     (r.moderation_note ?? null) as string | null,
    createdAt:          r.created_at as string
  };
}

export async function approvedSubmissionsForQuery(query: string, limit = 60): Promise<ImageSubmission[]> {
  const cleaned = (query ?? "").toLowerCase().trim();
  if (!cleaned) return [];
  const tokens = cleaned
    .split(/[\s,]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];
  // Postgres `&&` (overlap) on the keywords array is index-hit via
  // the GIN index defined in the migration.
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .select("*")
    .in("status", ["approved", "auto_approved"])
    .overlaps("keywords", tokens)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (res.error || !res.data) return [];
  return res.data.map(shapeSubmission);
}

/** Batched enrichment for the /trade-off/search Inspiration tab.
 *  Given the source_canteen_id + source_post_id fields from a page's
 *  worth of submissions, resolves them to public-facing metadata:
 *    • canteen slug + display name (so the credit chip can link)
 *    • post reply_count (so the "view comments" button shows N)
 *  Two batched queries, deduped id lists — cheap regardless of how
 *  many submissions render on the page. */
export type SubmissionSourceInfo = {
  canteenSlug:      string | null;
  canteenName:      string | null;
  hostDisplayName:  string | null;
  postReplyCount:   number;
};
export type SubmissionSourceMap = {
  canteens: Record<string, { slug: string; name: string; hostDisplayName: string }>;
  posts:    Record<string, number>; // postId → reply_count
};

export async function enrichSubmissionSources(params: {
  canteenIds: string[];
  postIds:    string[];
}): Promise<SubmissionSourceMap> {
  const canteens: SubmissionSourceMap["canteens"] = {};
  const posts: SubmissionSourceMap["posts"] = {};

  const uniqueCanteenIds = Array.from(new Set(params.canteenIds.filter(Boolean)));
  const uniquePostIds = Array.from(new Set(params.postIds.filter(Boolean)));

  await Promise.all([
    (async () => {
      if (uniqueCanteenIds.length === 0) return;
      const res = await supabaseAdmin
        .from("hammerex_canteens")
        .select("id, slug, name, host_display_name")
        .in("id", uniqueCanteenIds);
      if (res.error || !res.data) return;
      for (const row of res.data) {
        canteens[row.id as string] = {
          slug:            (row.slug as string) ?? "",
          name:            (row.name as string) ?? "",
          hostDisplayName: (row.host_display_name as string) ?? ""
        };
      }
    })(),
    (async () => {
      if (uniquePostIds.length === 0) return;
      const res = await supabaseAdmin
        .from("hammerex_canteen_posts")
        .select("id, reply_count")
        .in("id", uniquePostIds);
      if (res.error || !res.data) return;
      for (const row of res.data) {
        posts[row.id as string] = (row.reply_count as number) ?? 0;
      }
    })()
  ]);

  return { canteens, posts };
}

/** Single-row read for the moderation detail view (future). */
export async function imageSubmissionById(id: string): Promise<ImageSubmission | null> {
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return shapeSubmission(res.data);
}

// ─── Writes ───────────────────────────────────────────────────

/** Insert a submission. Duplicates (same image_url + submitter_slug)
 *  upsert onto the existing row so a trade re-submitting after edit
 *  doesn't spawn ghost duplicates in the queue. */
export async function insertImageSubmission(params: {
  submitterSlug: string;
  submitterDisplay?: string | null;
  submitterAvatarUrl?: string | null;
  sourcePostId?: string | null;
  sourceCanteenId?: string | null;
  imageUrl: string;
  altText?: string | null;
  tradeSlug?: string | null;
  keywords: string[];
  qualityScore: number;
  qualityFlags: string[];
  initialStatus: "auto_approved" | "pending";
}): Promise<ImageSubmission | null> {
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .upsert(
      {
        submitter_slug:       params.submitterSlug,
        submitter_display:    params.submitterDisplay ?? null,
        submitter_avatar_url: params.submitterAvatarUrl ?? null,
        source_post_id:       params.sourcePostId ?? null,
        source_canteen_id:    params.sourceCanteenId ?? null,
        image_url:            params.imageUrl,
        alt_text:             params.altText ?? null,
        trade_slug:           params.tradeSlug ?? null,
        keywords:             params.keywords,
        status:               params.initialStatus,
        quality_score:        params.qualityScore,
        quality_flags:        params.qualityFlags
      },
      { onConflict: "image_url,submitter_slug", ignoreDuplicates: false }
    )
    .select("*")
    .single();
  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[imageSubmissions] insert failed", res.error);
    return null;
  }
  return shapeSubmission(res.data);
}

/** Moderator action — approve or reject with optional note. Also
 *  stamps moderated_by + moderated_at. */
export async function moderateSubmission(params: {
  id: string;
  moderatorSlug: string;
  decision: "approve" | "reject";
  note?: string | null;
}): Promise<ImageSubmission | null> {
  const res = await supabaseAdmin
    .from("networkers_image_submissions")
    .update({
      status:          params.decision === "approve" ? "approved" : "rejected",
      moderated_by:    params.moderatorSlug,
      moderated_at:    new Date().toISOString(),
      moderation_note: params.note ?? null
    })
    .eq("id", params.id)
    .select("*")
    .single();
  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[imageSubmissions] moderate failed", res.error);
    return null;
  }
  return shapeSubmission(res.data);
}
