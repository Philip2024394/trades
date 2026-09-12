// src/components/nex-app/live/creator-actions.ts
//
// NEX LIVE · Phase B · Creator action model + availability contract
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B
//
// PURE LOGIC. No React. No DOM. No fetch. No side-effects.
//
// PURPOSE (§4 · §5 · §6 · §7 · §8)
//   The single source of truth for what each creator action IS +
//   whether it is genuinely available RIGHT NOW.
//
// DISCIPLINE (§7 · §14 · §17)
//   `availability === "AVAILABLE"` MUST reflect real runtime backing:
//     · RECORD    — /nex-video/create exists in this repo (verified via audit)
//     · UPLOAD    — no dedicated file-picker exists yet; camera capture at
//                   /nex-video/create covers it. Reported as
//                   REDIRECT_TO_CAPTURE so the panel can honestly say
//                   "Record via camera for now" instead of pretending a
//                   separate uploader exists.
//     · EDIT      — no NEX video editor exists (audit confirmed);
//                   surface as NOT_YET_AVAILABLE.
//     · GO_LIVE   — no Live streaming infrastructure exists;
//                   surface as NOT_YET_AVAILABLE.
//     · MY_LIVE   — /nex-live/my page ships in this slice with honest
//                   "no declared items yet" state; AVAILABLE.
//
// Any change here must first change the underlying runtime. This module
// must never lie about availability.

// ── Action taxonomy ───────────────────────────────────────────────

export type CreatorActionId =
  | "RECORD"
  | "UPLOAD"
  | "EDIT"
  | "GO_LIVE"
  | "MY_LIVE";

export type CreatorActionAvailability =
  | "AVAILABLE"              // fully working now
  | "REDIRECT_TO_CAPTURE"    // no dedicated surface; the RECORD flow covers it
  | "NOT_YET_AVAILABLE";     // honest not-yet · no fake surface

export type CreatorAction = {
  id: CreatorActionId;
  label: string;
  short_hint: string;
  /** Where the action navigates when tapped. `null` when action is
   *  not-yet-available. */
  href: string | null;
  availability: CreatorActionAvailability;
  /** Presentational priority per §11 — Primary vs Secondary. */
  priority: "PRIMARY" | "SECONDARY";
  /** Machine-readable reason for the availability state. Rendered in
   *  the honesty layer of the panel (small text). */
  reason: string;
};

// ── The complete action list ─────────────────────────────────────
// Ordered by presentational priority (§11) — Primary first, then
// Secondary. The panel renders them in this order.

export function listCreatorActions(): CreatorAction[] {
  return [
    {
      id: "RECORD",
      label: "Record",
      short_hint: "Camera + microphone",
      href: "/nex-video/create",
      availability: "AVAILABLE",
      priority: "PRIMARY",
      reason: "existing_camera_recorder_at_nex_video_create",
    },
    {
      id: "UPLOAD",
      label: "Upload",
      short_hint: "Existing media + rights",
      // Phase 2 · dedicated uploader shipped at /nex-live/upload · chains
      // /api/nex-media/upload (bytes) + /api/nex-live/upload (rights).
      href: "/nex-live/upload",
      availability: "AVAILABLE",
      priority: "PRIMARY",
      reason: "phase2_upload_flow_with_rights_declaration",
    },
    {
      id: "GO_LIVE",
      label: "Go Live",
      short_hint: "Broadcast in real time",
      href: null,
      availability: "NOT_YET_AVAILABLE",
      priority: "PRIMARY",
      reason: "live_streaming_infrastructure_not_implemented",
    },
    {
      id: "EDIT",
      label: "Edit",
      short_hint: "Trim, cut, cover",
      href: null,
      availability: "NOT_YET_AVAILABLE",
      priority: "SECONDARY",
      reason: "video_editor_not_implemented",
    },
    {
      id: "MY_LIVE",
      label: "My Live",
      short_hint: "Your published items",
      href: "/nex-live/my",
      availability: "AVAILABLE",
      priority: "SECONDARY",
      reason: "my_live_surface_shipped_in_phase_b",
    },
  ];
}

/** Convenience predicate for the UI: is the action tappable? */
export function isTappable(action: CreatorAction): boolean {
  return action.availability !== "NOT_YET_AVAILABLE" && action.href !== null;
}

/** Convenience: return the customer-facing status text for an action.
 *  Used by the panel to render the honest availability strip. */
export function statusText(action: CreatorAction): string | null {
  switch (action.availability) {
    case "AVAILABLE":            return null;                      // no status needed — action just works
    case "REDIRECT_TO_CAPTURE":  return "Uses camera capture";
    case "NOT_YET_AVAILABLE":    return "Not available yet";
  }
}

/** Convenience: split by priority for panel layout. */
export function partitionByPriority(): { primary: CreatorAction[]; secondary: CreatorAction[] } {
  const all = listCreatorActions();
  return {
    primary: all.filter((a) => a.priority === "PRIMARY"),
    secondary: all.filter((a) => a.priority === "SECONDARY"),
  };
}
