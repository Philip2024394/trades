// NEX Comms Centre · Social · Phase 10 · starter template seed.
//
// Every merchant-provisioned tenant receives one safe, grounded content
// template so the First-Post Wizard never lands on "no active template".
//
// The template deliberately uses a single required variable bound to the
// merchant's own business_profile.description source — a factual claim
// class per §S-III. No subjective descriptors, no comparative claims,
// no social proof, no urgency. This keeps the starter guaranteed-safe
// against the Phase 3 validator pipeline.

import { upsertContentTemplate } from "../content/templates";
import type { PgClientLike } from "@/lib/nex/db";
import type { TenantId } from "../types";
import type { ContentTemplate } from "../content/types";

const STARTER_SLUG = "nex-starter-introduction";

const STARTER_TEMPLATE_BODY = "{{business_description}}";

// Idempotent · calling twice will UPDATE the existing row. Safe to call
// from provisioning and from a repair job.
export async function ensureStarterTemplate(
  client: PgClientLike,
  tenant_id: TenantId,
): Promise<ContentTemplate> {
  return await upsertContentTemplate({
    client,
    tenant_id,
    slug: STARTER_SLUG,
    kind: "company",
    body: STARTER_TEMPLATE_BODY,
    variable_slots: [
      {
        name:         "business_description",
        source_kind:  "business_profile",
        source_path:  "description",
        required:     true,
        claim_class:  "factual",
      },
    ],
    hashtags_slots: [],
    cta_slot: {
      template: "Get in touch.",
    },
    min_source_refs: 1,
    status: "active",
  });
}

export const STARTER_TEMPLATE_SLUG = STARTER_SLUG;
