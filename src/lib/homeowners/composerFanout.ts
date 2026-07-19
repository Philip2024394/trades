// composerFanout — turns a UnifiedPostComposer payload into the
// right sequence of API calls.
//
// Order is deterministic so that dependent IDs are available when the
// next call needs them:
//   1. If newProject → POST /api/homeowner/projects → get projectId
//   2. POST /api/homeowner/posts (needs projectId when SiteBook mode)
//   3. Attach photos → POST /api/homeowner/projects/[id]/photos
//   4. If cost row → POST /api/homeowner/costs
//   5. Attach docs  → POST /api/homeowner/costs/documents (links to postId + costId if present)
//   6. If fix row       → POST /api/homeowner/things-to-fix
//   7. If home-care row → POST /api/homeowner/home-care
//
// Yard mode (destination='yard') is intentionally NOT handled by this
// helper yet — the Yard has its own endpoints. For now we throw so
// the composer surfaces "Yard posting isn't wired in yet" cleanly.
//
// Any single call failure is reported back but earlier successful calls
// are NOT rolled back — SiteBook is append-only by design.

import type { ComposerSubmitPayload, ComposerResult } from "@/components/homeowners/UnifiedPostComposer";

const HOME_CARE_CADENCE_DAYS: Record<"annual" | "6mo" | "3mo" | "monthly", number> = {
  annual:  365,
  "6mo":   180,
  "3mo":   90,
  monthly: 30
};

async function jsonPost<T>(url: string, body: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  const res  = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true, data };
}

async function formPost(url: string, fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const res  = await fetch(url, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
  return { ok: true };
}

export async function fanoutComposerSubmit(payload: ComposerSubmitPayload): Promise<ComposerResult> {
  if (payload.destination === "yard") {
    // Yard fanout intentionally not wired yet — see Yard v2 spec.
    return { ok: false, error: "Yard posting isn't wired yet — coming next." };
  }

  // ── 1. New project (if inflated) ────────────────────────────────
  let projectId = payload.projectId;
  if (payload.newProject) {
    const r = await jsonPost<{ projectId: string }>("/api/homeowner/projects", {
      title:         payload.newProject.title,
      address_city:  payload.newProject.city || undefined
    });
    if (!r.ok) return { ok: false, error: `Project: ${r.error}` };
    projectId = r.data!.projectId;
  }
  if (!projectId) return { ok: false, error: "No project selected" };

  // ── 2. Feed post ─────────────────────────────────────────────────
  // When the owner picked specific trades in the composer dropdown,
  // switch to selected-visibility so only those trades see the post.
  const hasInvitees = !!(payload.invitedListingIds && payload.invitedListingIds.length > 0);
  const postRes = await jsonPost<{ postId: string }>("/api/homeowner/posts", {
    projectId,
    title:             payload.title,
    body:              payload.body,
    visibility:        hasInvitees ? "selected" : "all-trades",
    invitedListingIds: hasInvitees ? payload.invitedListingIds : undefined
  });
  if (!postRes.ok) return { ok: false, error: `Post: ${postRes.error}` };
  const postId = postRes.data!.postId;

  // ── 2b. Cross-post to Yard as a beacon (best-effort, non-fatal) ──
  if (payload.crossPostToYard) {
    const yardRes = await jsonPost("/api/homeowner/beacons", {
      projectId,
      postId,
      title: payload.title,
      body:  payload.body
    });
    if (!yardRes.ok) {
      // Log but don't fail the whole submit — the sitebook post is
      // already in the DB, the yard broadcast is a bonus.
      console.warn("[composer-fanout] Yard cross-post failed:", yardRes.error);
    }
  }

  // ── 3. Photos (multipart, per-file) ──────────────────────────────
  if (payload.photos && payload.photos.length > 0) {
    for (const f of payload.photos) {
      const fd = new FormData();
      fd.append("file", f);
      const r = await formPost(`/api/homeowner/projects/${projectId}/photos`, fd);
      if (!r.ok) return { ok: false, error: `Photo: ${r.error}` };
    }
  }

  // ── 4. Cost row ──────────────────────────────────────────────────
  let costId: string | null = null;
  if (payload.cost) {
    const r = await jsonPost<{ cost: { id: string } }>("/api/homeowner/costs", {
      projectId,
      agreedPence:    payload.cost.amountPence,
      tradeListingId: payload.cost.tradeListingId  ?? undefined,
      tradeName:      payload.cost.tradeName       ?? undefined,
      postId
    });
    if (!r.ok) return { ok: false, error: `Cost: ${r.error}` };
    costId = r.data!.cost.id;
  }

  // ── 5. Documents (multipart, per-file, linked to cost/post) ──────
  if (payload.documents && payload.documents.length > 0) {
    for (const f of payload.documents) {
      const fd = new FormData();
      fd.append("file",      f);
      fd.append("projectId", projectId);
      if (costId) fd.append("costId", costId);
      fd.append("postId",    postId);
      const r = await formPost("/api/homeowner/costs/documents", fd);
      if (!r.ok) return { ok: false, error: `Document: ${r.error}` };
    }
  }

  // ── 6. Thing to fix ──────────────────────────────────────────────
  if (payload.fix) {
    let photoUrl: string | null = null;
    if (payload.fix.photo) {
      // Upload the photo through the project-photos endpoint (returns
      // storage_url that we then reuse as the fix photo URL).
      const fd = new FormData();
      fd.append("file",    payload.fix.photo);
      fd.append("caption", `Snag: ${payload.fix.title}`);
      const res  = await fetch(`/api/homeowner/projects/${projectId}/photos`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && typeof data.url === "string") photoUrl = data.url;
    }
    const r = await jsonPost("/api/homeowner/things-to-fix", {
      title:              payload.fix.title,
      projectId,
      photoUrl:           photoUrl                       ?? undefined,
      assigneeListingId:  payload.fix.assigneeListingId  ?? undefined,
      postId
    });
    if (!r.ok) return { ok: false, error: `Fix: ${r.error}` };
  }

  // ── 7. Home care ─────────────────────────────────────────────────
  if (payload.homeCare) {
    const r = await jsonPost("/api/homeowner/home-care", {
      title:       payload.homeCare.title,
      cadenceDays: HOME_CARE_CADENCE_DAYS[payload.homeCare.every]
    });
    if (!r.ok) return { ok: false, error: `Home care: ${r.error}` };
  }

  return { ok: true };
}
