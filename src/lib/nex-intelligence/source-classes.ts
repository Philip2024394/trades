// WO-INTELLIGENCE-02 · source-class taxonomy + authority classification.
//
// Founder-authorised 2026-09-13. Every source in the crawler manifest MUST
// declare its source class. The class affects the Scoring Engine's
// confidence calculation (higher-authority classes contribute more per
// record to confidence) BUT never grants execution authority.
//
// New source classes require their own founder-signed WO. Slice-2 adds
// exactly ONE additional class (official_technical_documentation) beyond
// slice-1's academic_publication.

export type SourceClass =
  | "academic_publication"          // peer-reviewed research (arXiv, journals)
  | "official_technical_documentation"  // vendor-owned official docs (Node.js, etc)
  | "standards_specification"       // normative specs (TC39, ECMA, RFC)
  | "official_project_repository"   // vendor observation (release metadata)
  | "high_quality_engineering_source";  // curated engineering blogs

export interface SourceClassAuthority {
  readonly source_class: SourceClass;
  /** Weight applied to the confidence calc per record from this class.
   *  Higher = more authoritative. Weights normalised inside scoring. */
  readonly authority_weight: number;
  /** Human-readable rationale for the weight. */
  readonly rationale: string;
}

export const SOURCE_CLASS_AUTHORITY: Readonly<Record<SourceClass, SourceClassAuthority>> = Object.freeze({
  academic_publication: {
    source_class: "academic_publication",
    authority_weight: 0.7,
    rationale: "Peer-reviewed publications carry evidential weight but authors' claims are not always operational truth.",
  },
  official_technical_documentation: {
    source_class: "official_technical_documentation",
    authority_weight: 0.9,
    rationale: "Vendor-owned official documentation is the strongest evidence for what a specific tool/version does. Kept below 1.0 because docs can drift from implementation.",
  },
  standards_specification: {
    source_class: "standards_specification",
    authority_weight: 1.0,
    rationale: "Normative specifications (TC39, ECMA, RFC) define correct behaviour by construction — highest weight.",
  },
  official_project_repository: {
    source_class: "official_project_repository",
    authority_weight: 0.6,
    rationale: "Release metadata and repository observation are useful but require context (release notes ≠ correct behaviour).",
  },
  high_quality_engineering_source: {
    source_class: "high_quality_engineering_source",
    authority_weight: 0.5,
    rationale: "Curated engineering blogs are useful for pattern discovery but individual authorship reduces authority.",
  },
});

/**
 * Return the authority weight for a given source class. Returns 0 for
 * unknown classes — an unknown class MUST NOT boost confidence.
 */
export function authorityWeight(sc: SourceClass | string | undefined): number {
  if (!sc) return 0;
  const entry = SOURCE_CLASS_AUTHORITY[sc as SourceClass];
  return entry ? entry.authority_weight : 0;
}
