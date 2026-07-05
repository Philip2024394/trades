// websiteRecipeRegistry — types.
//
// Recipes are lightweight orchestrators. They REFERENCE playbooks;
// they never duplicate decision logic. Overrides are rare and small.

import type { EvidenceProfile, PlaybookFacets } from "../playbooks/types";

export type WebsiteRecipeManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  appliesTo: {
    trades: readonly string[];
    profileFlags?: readonly string[];
    growthGoals?: readonly string[];
    countries?: readonly string[];
  };

  /** Ordered playbook ids. Order matters for merge precedence — later
   *  playbooks override earlier ones on conflicting facets. */
  playbooks: readonly string[];

  /** Rare recipe-level facet overrides applied last in the merge. */
  overrides?: PlaybookFacets;

  source: "platform-authored" | "agency-authored" | "data-derived";
  evidence: EvidenceProfile;

  publisher?: { name: string; verified: boolean };
};

export type FrozenWebsiteRecipeManifest = Readonly<WebsiteRecipeManifest>;
