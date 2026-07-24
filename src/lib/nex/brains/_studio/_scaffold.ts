// Author Studio scaffold — generates empty V1 module payloads that
// validate against the Zod schemas. Author opens a new Brain into a
// scaffolded state (headers filled from Author profile · module bodies
// empty) rather than staring at a blank JSON form.
//
// The scaffolds are STRUCTURAL. No Author-owned content is invented.
// Author's first act after opening is to add their first Fact / Rule /
// Playbook — the scaffold is just enough to satisfy Zod.

import type { V1ModuleName } from "@/lib/nex/brains/_schema";

export type ScaffoldHeaderInput = {
  author_id:   string;
  version:     string;
  regions?:    string[];
};

export function scaffoldManifest(input: {
  slug:                string;
  name:                string;
  author_id:           string;
  author_name?:        string;
  author_creds?:       string;
  supported_countries: string[];
  version:             string;
}) {
  return {
    slug:                 input.slug,
    name:                 input.name,
    category:             "trade" as const,
    version:              input.version,
    status:               "draft" as const,
    primary_author_id:    input.author_id,
    primary_author_name:  input.author_name ?? null,
    primary_author_creds: input.author_creds ?? null,
    supported_countries:  input.supported_countries,
    supported_regions:    null,
    published_at:         null,
    last_reviewed_at:     null,
    v1_modules_present:   []
  };
}

function stdHeader(input: ScaffoldHeaderInput) {
  return {
    version:     input.version,
    authored_by: input.author_id,
    authored_at: new Date().toISOString(),
    regions:     input.regions ?? []
  };
}

export function scaffoldModule(name: V1ModuleName, input: ScaffoldHeaderInput): unknown {
  const header = stdHeader(input);
  switch (name) {
    case "craft":
      return { header, facts: [], techniques: [], glossary: [] };
    case "regulations":
      return { header, regulations: [], rules: [] };
    case "materials":
      return { header, materials: [] };
    case "workflow":
      return { header, playbooks: [] };
    case "defects":
      return { header, defects: [] };
    case "pricing_model":
      return { header, rules: [] };
  }
}
