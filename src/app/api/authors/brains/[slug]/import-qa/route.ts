// POST /api/authors/brains/[slug]/import-qa
//
// Body: { raw_input: string }
//
// Zero-LLM path. Parses Q&A pairs deterministically and creates
// candidates the Author can Accept in one click each (or bulk).
// Cost per call: $0.

import type { NextRequest } from "next/server";
import { importQaKnowledge } from "@/lib/nex/brains/_studio/_qa_import";
import { jsonError, jsonOk, requireStudio } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;

  let body: { raw_input?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }
  if (typeof body.raw_input !== "string" || body.raw_input.trim() === "") {
    return jsonError("bad_request", "raw_input is required");
  }

  const result = await importQaKnowledge({
    brain_slug:  slug,
    author_id:   gate.authorId,
    author_name: gate.authorId,   // Author display name resolved from allowlist id
    raw_input:   body.raw_input
  });

  if (!result.ok) {
    const status = result.reason === "empty_input" || result.reason === "no_pairs_found" ? 422 : 400;
    return jsonError(result.reason, result.detail, status);
  }

  return jsonOk({
    run_id:     result.run.run_id,
    candidates: result.run.candidates,
    skipped:    result.skipped,
    created_at: result.run.created_at,
    note:       `Parsed ${result.run.candidates.length} Q&A pair(s) into candidates. No LLM used. Click Accept per item, or use the queue's bulk-approve in Admin once accepted.`
  });
}
