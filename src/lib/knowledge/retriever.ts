// AI Retrieval Architecture — engine.
//
// "Does this increase the amount of reusable knowledge inside the
//  platform? If yes, we're moving in the right direction."
//
// Pure function. Walks Merchant → Package → Domain layers, extracts
// every candidate node, lexically scores against the query, ranks +
// caps + returns. No DB reads, no async — the caller (an API route)
// loads merchant context first and hands it in.
//
// Scoring is lexical for v1. Embeddings land in Stage 6+ when the
// content library is large enough to justify the compute.

import { knowledgeDomainRegistry } from "./registry";
import { knowledgePackageRegistry } from "./packageRegistry";
import type {
  MerchantContext,
  RetrievalLayer,
  RetrievalNode,
  RetrievalNodeType,
  RetrievalQuery,
  RetrievalResult
} from "./retrievalTypes";

// ─── Public entry ───────────────────────────────────────────────

export function retrieveKnowledge(
  query: RetrievalQuery,
  merchant?: MerchantContext
): RetrievalResult {
  const candidates: RetrievalNode[] = [];
  const layersUsed = new Set<RetrievalLayer>();

  // 1. Merchant layer
  if (merchant) {
    const merchantNodes = collectMerchantNodes(merchant);
    for (const n of merchantNodes) candidates.push(n);
    if (merchantNodes.length > 0) layersUsed.add("merchant");
  }

  // 2. Package layer — driven by the merchant's trade slug
  if (merchant?.tradeSlug) {
    const packageNodes = collectPackageNodes(merchant.tradeSlug);
    for (const n of packageNodes) candidates.push(n);
    if (packageNodes.length > 0) layersUsed.add("package");
  }

  // 3. Domain layer — every registered domain
  const domainNodes = collectDomainNodes();
  for (const n of domainNodes) candidates.push(n);
  if (domainNodes.length > 0) layersUsed.add("domain");

  // 4. Type filter
  const typed = query.types
    ? candidates.filter((n) => query.types!.includes(n.type))
    : candidates;

  // 5. Score every candidate
  const queryTokens = tokenize(query.intent);
  const queryKeywords = new Set(
    (query.keywords ?? []).map((k) => k.toLowerCase())
  );
  const scored = typed.map((node) => ({
    ...node,
    score: scoreNode(node, queryTokens, queryKeywords)
  }));

  // 6. Sort. Ties broken by layer preference (merchant > package >
  //    domain) — personalisation wins.
  const layerRank: Record<RetrievalLayer, number> = {
    merchant: 3,
    package: 2,
    domain: 1,
    global: 0
  };
  scored.sort((a, b) => {
    if (b.score !== a.score) return (b.score ?? 0) - (a.score ?? 0);
    return layerRank[b.layer] - layerRank[a.layer];
  });

  const cap = query.maxResults ?? 12;
  // Only return positively-scored nodes — a score of 0 means nothing
  // in the query matched. We'd rather return fewer nodes than fill
  // with irrelevant ones the LLM might mis-cite.
  const kept = scored.filter((n) => (n.score ?? 0) > 0).slice(0, cap);

  const citedSources = Array.from(new Set(kept.map((n) => n.citation)));

  return {
    nodes: kept,
    meta: {
      layersUsed: Array.from(layersUsed),
      totalCandidates: scored.length,
      citedSources
    }
  };
}

// ─── Prompt helper ──────────────────────────────────────────────

/** Format a RetrievalResult as a prompt block the LLM can read.
 *  Deterministic — the same result always produces the same string. */
export function formatRetrievalForPrompt(result: RetrievalResult): string {
  if (result.nodes.length === 0) {
    return "CONTEXT: (no matching knowledge retrieved)";
  }
  const lines: string[] = ["CONTEXT (retrieved from the Knowledge Graph):"];
  for (const n of result.nodes) {
    lines.push("");
    lines.push(
      `[${n.id}] layer=${n.layer} type=${n.type} source=${n.citation}`
    );
    lines.push(`Title: ${n.title}`);
    lines.push(`Content: ${n.content}`);
  }
  lines.push("");
  lines.push(
    "STRICT RULES: answer using only the CONTEXT above. When you use a node, cite its id in square brackets. If nothing in the context answers the question, say so honestly."
  );
  return lines.join("\n");
}

// ─── Collectors ─────────────────────────────────────────────────

function collectMerchantNodes(merchant: MerchantContext): RetrievalNode[] {
  const out: RetrievalNode[] = [];

  if (merchant.brandName) {
    out.push({
      id: `merchant.merchant-blueprint.brand`,
      layer: "merchant",
      type: "merchant-blueprint",
      title: `Brand: ${merchant.brandName}`,
      content: `The merchant's trading name is ${merchant.brandName}${
        merchant.city ? `, based in ${merchant.city}` : ""
      }. Their primary trade is ${merchant.tradeSlug}.`,
      citation: "internal:studio_brands",
      keywords: [merchant.brandName.toLowerCase(), merchant.tradeSlug]
    });
  }

  if (merchant.coveragePostcode || merchant.coverageRadiusMi) {
    out.push({
      id: `merchant.merchant-coverage.default`,
      layer: "merchant",
      type: "merchant-coverage",
      title: "Coverage area",
      content: `Coverage centred on ${
        merchant.coveragePostcode ?? "(no postcode set)"
      } with a ${merchant.coverageRadiusMi ?? "unspecified"}-mile radius. Beyond this radius: not on the standard service map.`,
      citation: "internal:studio_brand_outcomes",
      keywords: ["coverage", "postcode", "radius", "area"]
    });
  }

  for (const cred of merchant.heldCredentials ?? []) {
    out.push({
      id: `merchant.merchant-credential.${cred.scheme}`,
      layer: "merchant",
      type: "merchant-credential",
      title: `${cred.displayLabel ?? cred.scheme} · ${cred.status}`,
      content: `The merchant holds a ${cred.scheme} registration under number ${cred.number}. Status: ${cred.status}.`,
      citation: "internal:studio_brand_credentials",
      keywords: [cred.scheme, cred.status]
    });
  }

  if (merchant.publishedBlueprintSlug) {
    out.push({
      id: `merchant.merchant-blueprint.published`,
      layer: "merchant",
      type: "merchant-blueprint",
      title: "Published blueprint",
      content: `The merchant's currently published site uses the "${merchant.publishedBlueprintSlug}" blueprint.`,
      citation: "internal:studio_layouts",
      keywords: ["blueprint", merchant.publishedBlueprintSlug]
    });
  }

  return out;
}

function collectPackageNodes(tradeSlug: string): RetrievalNode[] {
  const pkgs = knowledgePackageRegistry.listByTrade(tradeSlug);
  const pkg = pkgs[0];
  if (!pkg) return [];
  const citation = `internal:packages/${pkg.id}.ts`;
  const out: RetrievalNode[] = [];

  // Services
  for (const svc of pkg.services) {
    out.push({
      id: `package.package-service.${pkg.id}.${svc.slug}`,
      layer: "package",
      type: "package-service",
      title: `${svc.name} (${svc.frequency}, ${svc.pricingModel})`,
      content: svc.description,
      citation,
      keywords: [svc.slug, svc.name.toLowerCase(), svc.frequency, svc.pricingModel]
    });
  }

  // Customer types
  for (const ct of pkg.customerTypes) {
    out.push({
      id: `package.package-customer-type.${pkg.id}.${ct.slug}`,
      layer: "package",
      type: "package-customer-type",
      title: `Customer type: ${ct.name}`,
      content: ct.description,
      citation,
      keywords: [ct.slug, ct.name.toLowerCase(), "customer"]
    });
  }

  // Workflow
  for (const step of pkg.workflow) {
    out.push({
      id: `package.package-workflow-step.${pkg.id}.${step.slug}`,
      layer: "package",
      type: "package-workflow-step",
      title: `Workflow: ${step.name}`,
      content: step.description,
      citation,
      keywords: [step.slug, step.name.toLowerCase(), "workflow"]
    });
  }

  // FAQs
  for (const faq of pkg.commonFaqs) {
    out.push({
      id: `package.package-faq.${pkg.id}.${slugify(faq.question)}`,
      layer: "package",
      type: "package-faq",
      title: `FAQ: ${faq.question}`,
      content: faq.answer,
      citation,
      keywords: extractKeywords(faq.question)
    });
  }

  // Extension retrieval hooks + extension compliance
  for (const ext of pkg.extensions) {
    for (const hook of ext.aiRetrieval ?? []) {
      out.push({
        id: `package.package-extension-hook.${pkg.id}.${hook.id}`,
        layer: "package",
        type: "package-extension-hook",
        title: `AI hook (${ext.domainId}): ${hook.id}`,
        content: hook.description,
        citation,
        keywords: hook.keywords ?? []
      });
    }
    for (const c of ext.compliance ?? []) {
      out.push({
        id: `package.package-extension-compliance.${pkg.id}.${c.id}`,
        layer: "package",
        type: "package-extension-compliance",
        title: `${c.name} (${c.regulator})`,
        content: `${c.name} — regulator: ${c.regulator}. Source: ${c.source}`,
        citation: c.source,
        keywords: [c.id, c.regulator.toLowerCase()]
      });
    }
  }

  return out;
}

function collectDomainNodes(): RetrievalNode[] {
  const out: RetrievalNode[] = [];
  for (const domain of knowledgeDomainRegistry.list()) {
    const domainCitation = `internal:domains/${domain.id}.ts`;

    // Capabilities
    for (const cap of domain.capabilities) {
      out.push({
        id: `domain.domain-capability.${domain.id}.${cap.id}`,
        layer: "domain",
        type: "domain-capability",
        title: `${domain.name} capability: ${cap.name}`,
        content: cap.description,
        citation: domainCitation,
        keywords: [cap.id, cap.name.toLowerCase(), domain.id]
      });
    }

    // Entities
    for (const ent of domain.entities) {
      out.push({
        id: `domain.domain-entity.${domain.id}.${ent.id}`,
        layer: "domain",
        type: "domain-entity",
        title: `${domain.name} entity: ${ent.name}`,
        content: ent.description,
        citation: domainCitation,
        keywords: [ent.id, ent.name.toLowerCase()]
      });
    }

    // AI hooks
    for (const hook of domain.aiRetrieval) {
      out.push({
        id: `domain.domain-ai-hook.${domain.id}.${hook.id}`,
        layer: "domain",
        type: "domain-ai-hook",
        title: `${domain.name} hook: ${hook.id}`,
        content: hook.description,
        citation: domainCitation,
        keywords: hook.keywords ?? []
      });
    }

    // Integrations
    for (const integ of domain.integrations) {
      out.push({
        id: `domain.domain-integration.${domain.id}.${integ.id}`,
        layer: "domain",
        type: "domain-integration",
        title: `${integ.name} (${integ.category})`,
        content: integ.description,
        citation: domainCitation,
        keywords: [integ.id, integ.name.toLowerCase(), integ.category]
      });
    }

    // Compliance
    for (const c of domain.compliance) {
      out.push({
        id: `domain.domain-compliance.${domain.id}.${c.id}`,
        layer: "domain",
        type: "domain-compliance",
        title: c.name,
        content: `${c.name} — regulator: ${c.regulator}. Source: ${c.source}`,
        citation: c.source,
        keywords: [c.id, c.regulator.toLowerCase(), "compliance", "law", "regulation"]
      });
    }
  }
  return out;
}

// ─── Scoring ────────────────────────────────────────────────────

function scoreNode(
  node: RetrievalNode,
  queryTokens: Set<string>,
  queryKeywords: Set<string>
): number {
  const nodeTokens = tokenize(
    `${node.title} ${node.content} ${(node.keywords ?? []).join(" ")}`
  );
  let hits = 0;
  let boosts = 0;
  const totalQueryTokens = queryTokens.size;
  if (totalQueryTokens === 0) return 0;

  for (const t of queryTokens) {
    if (nodeTokens.has(t)) hits += 1;
  }

  // Keyword boosts — explicit query.keywords match on node.keywords
  for (const k of queryKeywords) {
    if ((node.keywords ?? []).includes(k)) boosts += 1;
  }

  const base = hits / totalQueryTokens;
  const withBoost = base + boosts * 0.15;
  return Math.max(0, Math.min(1, withBoost));
}

// ─── Text helpers ───────────────────────────────────────────────

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "for", "in", "on", "to",
  "with", "at", "by", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had", "will", "would", "could",
  "should", "may", "might", "can", "must", "i", "you", "he", "she",
  "it", "we", "they", "my", "your", "his", "her", "its", "our", "their",
  "this", "that", "these", "those", "if", "then", "so", "as", "than"
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

function extractKeywords(text: string): string[] {
  return Array.from(tokenize(text)).slice(0, 6);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
