// POST /api/brain/query
//
// Body:
//   { brain_slugs: string[]        // REQUIRED, no wildcards per ADR-0021
//     query: string
//     modules?: BrainModuleName[]
//     region?: string
//     limit?: number
//   }
//
// Returns { status, data, provenance }.
// Feature-flagged behind NEX_BRAIN_RUNTIME_ENABLED — returns 503 when off.

import type { NextRequest } from "next/server";
import { DomainSeparationError, retrieveFromBrains } from "@/lib/nex/brains";
import { ensureBrainLoaded } from "@/lib/nex/brains/_ensure_loaded";
import { jsonError, jsonOk, requireBrainRuntime } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const off = requireBrainRuntime();
  if (off) return off;

  let body: {
    brain_slugs?: unknown;
    query?:       unknown;
    modules?:     unknown;
    region?:      unknown;
    limit?:       unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  if (!Array.isArray(body.brain_slugs)) return jsonError("bad_request", "brain_slugs must be an array");
  if (typeof body.query !== "string" || body.query.trim() === "") {
    return jsonError("bad_request", "query is required");
  }

  // Lazy-load requested Brains into the runtime registry from
  // filesystem drafts. In prod-with-team mode this would come from
  // an explicit "load published pack" step post Panel signoff.
  for (const slug of body.brain_slugs) {
    if (typeof slug === "string") {
      await ensureBrainLoaded(slug);
    }
  }

  try {
    const result = retrieveFromBrains({
      brain_slugs: body.brain_slugs as string[],
      query:       body.query,
      modules:     Array.isArray(body.modules) ? body.modules as never : undefined,
      region:      typeof body.region === "string" ? body.region : undefined,
      limit:       typeof body.limit === "number"  ? body.limit  : undefined
    });
    return jsonOk({
      status:     result.status,
      data:       result.data,
      provenance: result.provenance
    });
  } catch (err) {
    if (err instanceof DomainSeparationError) return jsonError("domain_separation_violation", err.message, 422);
    return jsonError("internal_error", err instanceof Error ? err.message : String(err), 500);
  }
}
