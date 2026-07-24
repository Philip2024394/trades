// GET /api/brain/registry
//
// Returns every registered Brain's public metadata. No content leaked —
// this is just the manifest per Brain. Callers use this to discover
// available Brains before issuing /api/brain/query.

import { brainRegistry } from "@/lib/nex/brains";
import { jsonOk, requireBrainRuntime } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const off = requireBrainRuntime();
  if (off) return off;

  const entries = brainRegistry.list().map((brain) => ({
    slug:                brain.manifest.slug,
    name:                brain.manifest.name,
    category:            brain.manifest.category,
    version:             brain.manifest.version,
    status:              brain.manifest.status,
    primary_author_name: brain.manifest.primary_author_name,
    supported_countries: brain.manifest.supported_countries,
    published_at:        brain.manifest.published_at,
    last_reviewed_at:    brain.manifest.last_reviewed_at,
    v1_modules_present:  brain.manifest.v1_modules_present
  }));

  return jsonOk({ brains: entries, count: entries.length });
}
