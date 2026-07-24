// POST /api/brain/estimate
//
// Body:
//   { brain_slug: string,
//     scope: { rule_key: string, quantity: number, region?: string, context?: object }
//   }
//
// Returns one estimate line resolved through the Brain's pricing_model.
// Multi-line estimates come from the Phase 28 Estimator engine composing
// multiple /api/brain/estimate calls — this endpoint deliberately stays
// single-rule so waste/overhead/profit/VAT policy stays owned by the
// existing engine.

import type { NextRequest } from "next/server";
import { brainRegistry, estimateWithBrain } from "@/lib/nex/brains";
import { jsonError, jsonOk, requireBrainRuntime } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const off = requireBrainRuntime();
  if (off) return off;

  let body: { brain_slug?: unknown; scope?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  if (typeof body.brain_slug !== "string" || body.brain_slug.trim() === "") {
    return jsonError("bad_request", "brain_slug is required");
  }
  const scope = body.scope as { rule_key?: unknown; quantity?: unknown; region?: unknown; context?: unknown } | null;
  if (!scope || typeof scope !== "object") return jsonError("bad_request", "scope is required");
  if (typeof scope.rule_key !== "string" || scope.rule_key.trim() === "") {
    return jsonError("bad_request", "scope.rule_key is required");
  }
  if (typeof scope.quantity !== "number" || !Number.isFinite(scope.quantity) || scope.quantity <= 0) {
    return jsonError("bad_request", "scope.quantity must be a positive number");
  }

  const brain = brainRegistry.get(body.brain_slug);
  if (!brain) return jsonError("brain_not_registered", `Brain '${body.brain_slug}' is not registered`, 404);
  if (brain.manifest.status !== "published") {
    return jsonError("brain_not_published", `Brain '${body.brain_slug}' has status=${brain.manifest.status}`, 409);
  }

  const result = estimateWithBrain({
    brain,
    scope: {
      rule_key: scope.rule_key,
      quantity: scope.quantity,
      region:   typeof scope.region === "string" ? scope.region : undefined,
      context:  typeof scope.context === "object" && scope.context ? scope.context as Record<string, unknown> : undefined
    }
  });

  if (!result.ok) {
    const status = result.reason === "rule_not_found" ? 404 : 422;
    return jsonError(result.reason, result.detail, status);
  }

  return jsonOk({ line: result.line, brain_version: result.brain_version });
}
