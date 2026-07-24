// POST /api/authors/brains/[slug]/extract
//
// Body: { raw_input: string, module_hint?: string }
// Runs the LLM structuring layer over the Author's raw input, returns
// the candidate run. Candidates are queued as `pending` — nothing has
// entered the Brain yet.
//
// If the extraction API is unavailable (no ANTHROPIC_API_KEY), the
// endpoint returns 503 with a clear reason so the Author knows to
// fall back to the normal Studio editors.

import type { NextRequest } from "next/server";
import {
  saveRun,
  structureAuthorKnowledge
} from "@/lib/nex/brains/_studio/_extraction";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireStudio } from "../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;
  const { slug } = await ctx.params;

  let body: { raw_input?: unknown; module_hint?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  if (typeof body.raw_input !== "string" || body.raw_input.trim() === "") {
    return jsonError("bad_request", "raw_input is required");
  }
  const moduleHint = typeof body.module_hint === "string" ? body.module_hint : undefined;

  // Attempt to fetch Author's display name from the registry — the
  // prompt uses it. Falls back to the author_id when the table
  // isn't there yet.
  let authorName = gate.authorId;
  try {
    const { data } = await supabaseAdmin
      .from("hammerex_nex_brains")
      .select("primary_author_name, name")
      .eq("slug", slug)
      .maybeSingle();
    if (data?.primary_author_name) authorName = data.primary_author_name;
    const brainName = data?.name ?? slug;

    const result = await structureAuthorKnowledge({
      brain_slug:  slug,
      brain_name:  brainName,
      author_id:   gate.authorId,
      author_name: authorName,
      raw_input:   body.raw_input,
      module_hint: moduleHint
    });

    if (!result.ok) {
      const status = result.reason === "no_llm_key" ? 503 : 422;
      return jsonError(result.reason, result.detail, status);
    }

    await saveRun(result.run);
    return jsonOk({
      run_id:     result.run.run_id,
      candidates: result.run.candidates,
      created_at: result.run.created_at,
      note:       "Every candidate is provisional. Nothing has been added to the Brain. Review each candidate below and click Accept to merge it into the appropriate module draft."
    });
  } catch (err) {
    // Table missing paths land here too.
    const result = await structureAuthorKnowledge({
      brain_slug:  slug,
      brain_name:  slug,
      author_id:   gate.authorId,
      author_name: authorName,
      raw_input:   body.raw_input,
      module_hint: moduleHint
    });
    if (!result.ok) {
      const status = result.reason === "no_llm_key" ? 503 : 422;
      return jsonError(result.reason, result.detail, status);
    }
    await saveRun(result.run);
    return jsonOk({
      run_id:     result.run.run_id,
      candidates: result.run.candidates,
      created_at: result.run.created_at,
      registry_lookup_error: err instanceof Error ? err.message : String(err),
      note:       "Registry lookup failed — extraction ran against slug only. Every candidate is still provisional."
    });
  }
}
