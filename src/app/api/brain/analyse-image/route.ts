// POST /api/brain/analyse-image
//
// Body:
//   { brain_slug: string,     // single Brain per call — compound scopes call multiple times
//     image_url: string,
//     region?: string
//   }
//
// Returns Vision analysis + Brain-matched defects.
// Feature-flagged behind NEX_BRAIN_RUNTIME_ENABLED.

import type { NextRequest } from "next/server";
import { analyseImageWithBrain, brainRegistry } from "@/lib/nex/brains";
import { jsonError, jsonOk, requireBrainRuntime } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const off = requireBrainRuntime();
  if (off) return off;

  let body: { brain_slug?: unknown; image_url?: unknown; region?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  if (typeof body.brain_slug !== "string" || body.brain_slug.trim() === "") {
    return jsonError("bad_request", "brain_slug is required");
  }
  if (typeof body.image_url !== "string" || body.image_url.trim() === "") {
    return jsonError("bad_request", "image_url is required");
  }

  const brain = brainRegistry.get(body.brain_slug);
  if (!brain) return jsonError("brain_not_registered", `Brain '${body.brain_slug}' is not registered`, 404);
  if (brain.manifest.status !== "published") {
    return jsonError("brain_not_published", `Brain '${body.brain_slug}' has status=${brain.manifest.status}`, 409);
  }

  try {
    const result = await analyseImageWithBrain({
      brain,
      imageUrl: body.image_url,
      region:   typeof body.region === "string" ? body.region : undefined
    });
    return jsonOk({
      analysis:        result.analysis,
      matched_defects: result.matched_defects,
      provenance:      result.provenance
    });
  } catch (err) {
    return jsonError("vision_failed", err instanceof Error ? err.message : String(err), 500);
  }
}
