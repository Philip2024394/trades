// NEX Business Context · permission gate (Philip 2026-08-14).
//
// The technical enforcement point for the customer/owner separation.
// Every API route MUST call assertPermission() before doing work.
// Return values are typed so TypeScript enforces handling.

import type { NexSession, NexRole } from "./types";

export type PermissionCheck =
  | { ok: true; session: NexSession }
  | { ok: false; status: 401 | 403; error: string };

export type PermissionRequirement = {
  requiredRole: NexRole | NexRole[];
  /** When set, session.businessSlug MUST equal this slug. */
  businessSlug?: string;
};

export function assertPermission(session: NexSession, req: PermissionRequirement): PermissionCheck {
  const required = Array.isArray(req.requiredRole) ? req.requiredRole : [req.requiredRole];

  if (session.role === "anonymous" && !required.includes("anonymous")) {
    return { ok: false, status: 401, error: "authentication-required" };
  }

  if (!required.includes(session.role)) {
    return { ok: false, status: 403, error: `role "${session.role}" not permitted (required: ${required.join(", ")})` };
  }

  // Anonymous callers have no session-bound business; the URL dictates the
  // business. Skip the businessSlug mismatch check for anonymous · the route
  // already only reached this line because it explicitly allows anonymous.
  if (req.businessSlug && session.role !== "anonymous" && session.businessSlug !== req.businessSlug) {
    return {
      ok: false,
      status: 403,
      error: `session.businessSlug="${session.businessSlug ?? "(none)"}" does not match required "${req.businessSlug}"`
    };
  }

  return { ok: true, session };
}

/** Convenience: 401/403 → NextResponse.json. */
export function permissionErrorResponse(check: Extract<PermissionCheck, { ok: false }>): Response {
  return new Response(JSON.stringify({ ok: false, error: check.error }), {
    status: check.status,
    headers: { "content-type": "application/json" }
  });
}
