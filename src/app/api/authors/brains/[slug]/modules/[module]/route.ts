// GET  /api/authors/brains/[slug]/modules/[module]
// PUT  /api/authors/brains/[slug]/modules/[module]
//
// GET returns the Author's current draft for a module (or a scaffold
// if no draft exists). PUT writes a new draft, validating against
// the Zod schema for that module first.

import type { NextRequest } from "next/server";
import {
  BrainManifestSchema,
  MODULE_SCHEMAS,
  V1_MODULE_NAMES,
  type V1ModuleName
} from "@/lib/nex/brains/_schema";
import { readDraft, scaffoldModule, writeDraft } from "@/lib/nex/brains/_studio";
import { jsonError, jsonOk, requireStudio } from "../../../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const V1_SET = new Set<string>(V1_MODULE_NAMES);
const KNOWN_MODULES = new Set<string>([...V1_SET, "manifest"]);

function isV1(name: string): name is V1ModuleName {
  return V1_SET.has(name);
}

function validate(module: string, payload: unknown): { ok: true; data: unknown } | { ok: false; error: string } {
  if (module === "manifest") {
    const parsed = BrainManifestSchema.safeParse(payload);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: parsed.error.message };
  }
  if (!isV1(module)) return { ok: false, error: `Unknown module '${module}'` };
  const parsed = MODULE_SCHEMAS[module].safeParse(payload);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: parsed.error.message };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string; module: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;

  const { slug, module } = await ctx.params;
  if (!KNOWN_MODULES.has(module)) return jsonError("unknown_module", `Module '${module}' is not part of V1`, 400);

  const existing = await readDraft({ brain_slug: slug, module });
  if (existing) return jsonOk({ payload: existing.payload, version: existing.version, updated_at: existing.updated_at });

  // No draft yet — return a scaffold. For manifest, the scaffold is
  // caller-supplied on first save (we can't invent Author name/creds),
  // so return null and let the client seed it.
  if (module === "manifest") return jsonOk({ payload: null, scaffold: true });

  return jsonOk({
    payload: scaffoldModule(module as V1ModuleName, {
      author_id: gate.authorId,
      version:   "0.1.0"
    }),
    scaffold: true
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string; module: string }> }) {
  const gate = await requireStudio();
  if (!gate.ok) return gate.response;

  const { slug, module } = await ctx.params;
  if (!KNOWN_MODULES.has(module)) return jsonError("unknown_module", `Module '${module}' is not part of V1`, 400);

  let body: { payload?: unknown; version?: unknown };
  try { body = await req.json(); } catch {
    return jsonError("invalid_json", "Request body is not valid JSON");
  }

  const version = typeof body.version === "string" && body.version.trim() !== "" ? body.version.trim() : "0.1.0";
  const validated = validate(module, body.payload);
  if (!validated.ok) return jsonError("schema_validation_failed", validated.error, 422);

  const saved = await writeDraft({
    brain_slug: slug,
    module,
    author_id:  gate.authorId,
    version,
    payload:    validated.data
  });

  return jsonOk({ payload: saved.payload, version: saved.version, updated_at: saved.updated_at });
}
