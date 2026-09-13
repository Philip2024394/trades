// WO-INTELLIGENCE-02 · Node.js official documentation ingestion adapter.
//
// Node.js publishes machine-readable API docs as JSON alongside the HTML
// at nodejs.org/api/*.json. The JSON is a structured tree of modules,
// classes, methods, and text descriptions — ideal for deterministic
// ingestion.
//
// Each parsed unit becomes a KnowledgeFragment with:
//   - external_id: `nodejs-docs::<module>::<name>` (stable across runs)
//   - title: the API name (e.g. "fs.readFile")
//   - abstract: the desc text (stripped of HTML tags)
//   - authors: ["Node.js Project"] (official documentation authorship)
//   - categories: ["nodejs-docs", <module>, <api_type>]
//   - primary_category: "nodejs-docs"
//   - published_at: derived from the doc's version stability metadata,
//     falling back to fetched_at when absent
//
// No LLM. Pure text extraction.

import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "../provenance";
import type { KnowledgeFragment, SourceRecord } from "../types";

/**
 * Extract fragments from a Node.js API doc JSON payload. The payload
 * shape follows Node's `doc/api/*.json` convention: a top-level object
 * with a `modules` array; each module has methods/classes/properties.
 * We walk the tree and emit one fragment per notable leaf.
 */
export function parseNodejsDocs(jsonText: string, sourceId: string): KnowledgeFragment[] {
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); }
  catch { return []; }
  if (typeof parsed !== "object" || parsed === null) return [];

  const modules = (parsed as { modules?: unknown[] }).modules ?? [];
  const fragments: KnowledgeFragment[] = [];
  const now = new Date().toISOString();

  for (const mod of modules) {
    walkNode(mod, [], (unit) => {
      if (!unit.name || !unit.description) return;
      const externalId = `nodejs-docs::${unit.pathPrefix.join("::")}::${unit.name}`;
      const fragmentId = `intel-fragment-${sha256Hex(externalId).slice(0, 16)}`;
      const abstract = stripHtml(unit.description);
      const categoriesArr = ["nodejs-docs", ...unit.pathPrefix, unit.type ?? "api"];
      const canonical = [externalId, unit.name, abstract, "Node.js Project", ...categoriesArr, "nodejs-docs", unit.stability ?? now].join("");
      const contentHash = sha256Hex(canonical);
      const base = {
        record_type: "NEX_INTELLIGENCE_KNOWLEDGE_FRAGMENT" as const,
        fragment_id: fragmentId,
        source_id: sourceId,
        external_id: externalId,
        title: unit.name,
        abstract,
        authors: Object.freeze(["Node.js Project"]) as readonly string[],
        categories: Object.freeze(categoriesArr) as readonly string[],
        primary_category: "nodejs-docs",
        published_at: unit.stability ?? now,
        content_hash_sha256: contentHash,
      };
      fragments.push({ ...base, provenance_chain_hash: provenanceChainHash(base, []) });
    });
  }
  return fragments;
}

interface UnitEntry {
  name: string;
  description: string;
  type: string;
  pathPrefix: string[];
  stability?: string;
}

function walkNode(node: unknown, pathPrefix: readonly string[], emit: (u: UnitEntry) => void): void {
  if (typeof node !== "object" || node === null) return;
  const n = node as Record<string, unknown>;
  const name = typeof n.name === "string" ? n.name : (typeof n.textRaw === "string" ? n.textRaw : "");
  const desc = typeof n.desc === "string" ? n.desc : (typeof n.description === "string" ? n.description : "");
  const type = typeof n.type === "string" ? n.type : "unknown";
  const stability = typeof n.stability === "number" || typeof n.stability === "string" ? String(n.stability) : undefined;

  if (name && desc) emit({ name, description: desc, type, pathPrefix: [...pathPrefix], stability });

  const newPath = name ? [...pathPrefix, name] : [...pathPrefix];
  const childArrayKeys = ["modules", "classes", "methods", "properties", "events", "signatures", "params"];
  for (const k of childArrayKeys) {
    const arr = n[k];
    if (Array.isArray(arr)) for (const child of arr) walkNode(child, newPath, emit);
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convenience: given a SourceRecord that carries a Node.js docs JSON
 * payload, extract fragments in one call.
 */
export function ingestNodejsDocsSource(source: SourceRecord): KnowledgeFragment[] {
  const ref = source.raw_content_ref;
  if (!ref.startsWith("inline:base64:")) throw new Error(`[nodejs-docs] unsupported raw_content_ref: ${ref.slice(0, 30)}...`);
  const body = Buffer.from(ref.slice("inline:base64:".length), "base64").toString("utf8");
  return parseNodejsDocs(body, source.source_id);
}
