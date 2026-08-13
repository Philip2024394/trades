// Knowledge Layer types — the retrieval contract that every Brain uses to
// query domain knowledge. Extraction rule (Philip 2026-08-03 evening redirect):
// Brains contain HOW to reason; Knowledge contains WHAT is known. Never blur.
//
// Placed in src/lib/nex/knowledge-layer/ (not src/lib/nex/knowledge/) because
// the latter contains a legacy retrieval implementation over knowledge_master.json.
// This layer supersedes that legacy path per Phase B.5 doctrine.
//
// Doctrine: docs/brains/nex-knowledge-layer-extraction-philip-2026-08-03.md
// Composes with Architecture v2 refinements #1 + #9.

export type MaturityLevel = "bronze" | "silver" | "gold";

/** Types of knowledge items a retrieval call can return. */
export type KnowledgeItemType =
  | "faq"
  | "article"
  | "image"
  | "component"
  | "calculator"
  | "standard"
  | "video"
  | "manufacturer"
  | "case_study";

export type KnowledgeItem = {
  type: KnowledgeItemType;
  id: string;
  source: string;
  relevance: number;
  summary: string;
  content: Record<string, unknown>;
  tags: readonly string[];
  authored_by?: string;
  rule_a_verified?: boolean;
  a_plus?: boolean;
};

export type RetrieveFilters = {
  tags?: readonly string[];
  audience_level?: 1 | 2 | 3;
  a_plus_only?: boolean;
  include_drafts?: boolean;
  item_types?: readonly KnowledgeItemType[];
};

export type RetrieveRequest = {
  domain: string;
  query: string;
  filters?: RetrieveFilters;
  limit?: number;
  min_relevance?: number;
  min_confidence?: number;
};

export type RetrieveResult = {
  items: readonly KnowledgeItem[];
  overall_confidence: number;
  sources: readonly string[];
  domain: string;
  needs_clarification: boolean;
  trace_reason: string;
};

export type KnowledgeYamlDeclaration = {
  knowledge_id: string;
  knowledge_version: string;
  last_updated: string;
  maturity_level: MaturityLevel;
  governance: {
    rule_a_anti_fabrication: "pass" | "fail";
    rule_c_attributable_origin: string;
  };
  sources: {
    faqs?: string;
    articles?: string;
    components?: string;
    calculators?: string;
    standards?: string;
    videos?: string;
    manufacturers?: string;
    images_index?: string;
  };
  retrieval_config?: {
    primary_key?: string;
    secondary_keys?: readonly string[];
    full_text_fields?: readonly string[];
    vector_embed?: boolean;
  };
  cross_domain_dependencies?: readonly string[];
};
