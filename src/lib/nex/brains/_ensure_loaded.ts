// Ensure a Brain is loaded into the in-memory runtime registry.
//
// The registry starts empty at server boot. For dev/single-tenant
// operation, we lazily load any Brain from its filesystem drafts
// (or DB drafts once migration applied) the first time it's queried.
//
// In prod-with-team mode this would be replaced by an explicit
// "load" endpoint driven by CTO after published pack export. For
// solo mode, on-demand loading gives immediate merchant-facing
// availability once the Author has drafted + accepted content.

import "server-only";
import { exportPackFromDrafts } from "@/lib/nex/brains/_studio/_pack_exporter";
import { brainRegistry } from "./_loader";
import type { BrainStatus } from "./_schema/manifest";

/** Idempotent · returns true if a Brain named `slug` is now in the
 *  registry (was there or just got loaded). Returns false when the
 *  slug has no drafts or the pack failed to boot. */
export async function ensureBrainLoaded(slug: string): Promise<{
  ok: boolean;
  loaded: boolean;
  reason?: string;
  status?: BrainStatus;
}> {
  if (brainRegistry.has(slug)) {
    return { ok: true, loaded: false, status: brainRegistry.get(slug)?.manifest.status };
  }

  const result = await exportPackFromDrafts(slug, "draft");
  if (!result.ok) {
    return { ok: false, loaded: false, reason: `${result.reason} · ${result.detail}` };
  }

  // For runtime purposes, we treat a booted draft-mode pack as
  // "queryable" · the manifest status stays whatever the Author has
  // set. If the retrieval router later refuses because status !==
  // "published", we surface that plainly.
  brainRegistry.register(result.loaded);
  return { ok: true, loaded: true, status: result.loaded.manifest.status };
}
