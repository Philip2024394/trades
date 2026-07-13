// Compact section catalog for the Studio AI router.
//
// The section registry stores rich definitions (renderers, TypeScript
// types, animation manifests) that the LLM doesn't need. This module
// projects the registry down to just what the LLM must know to CHOOSE
// a section: id, name, library, description, best-for hints, editable
// field roles.
//
// Serialised to JSON on every AI request — but the JSON is identical
// across requests, so it lands in the prompt cache and is billed at
// ~10% of standard input tokens after the first call within 5 minutes.

import "@/lib/studio/sections";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import type { SectionLibrary } from "@/lib/studio/sectionTypes";

/** Minimal section signature the LLM router picks from. Ordering
 *  inside each library follows registration order — put strongest
 *  templates first in @/lib/studio/sections/index.ts. */
export type CatalogEntry = {
  id: string;
  name: string;
  library: SectionLibrary;
  description: string;
  bestForVerticals?: string[];
  /** The list of param keys the LLM can fill. Roles (headline /
   *  subhead / etc.) give the model semantic hooks. */
  fields: Array<{
    key: string;
    label: string;
    role?: string;
    /** Truncated to 60 chars so the catalog stays compact. */
    kind: string;
    maxLength?: number;
    default: unknown;
    aiPromptable?: boolean;
  }>;
};

/** Compact catalog. NOT cached in dev — Turbopack HMR can leave the
 *  registry partially populated. In production the registry is
 *  fully static and the JIT will inline this. */
export function getSectionCatalog(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const reg of sectionRegistry.list()) {
    entries.push({
      id: reg.id,
      name: reg.name,
      library: reg.library as SectionLibrary,
      description: reg.description,
      bestForVerticals: reg.bestForVerticals as string[] | undefined,
      fields: (reg.editableFields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        role: (f as { role?: string }).role,
        kind:
          typeof f.type === "object" && f.type && "kind" in f.type
            ? String((f.type as { kind: string }).kind)
            : "text",
        maxLength:
          typeof f.type === "object" && f.type && "maxLength" in f.type
            ? ((f.type as { maxLength?: number }).maxLength)
            : undefined,
        default: (f as { default?: unknown }).default,
        aiPromptable: (f as { aiPromptable?: boolean }).aiPromptable
      }))
    });
  }
  return entries;
}

/** Just the ids + names — used when the router needs to name-check a
 *  proposed section without paying to send fields. */
export function getSectionShortlist(): Array<{
  id: string;
  name: string;
  library: string;
  description: string;
}> {
  return getSectionCatalog().map((e) => ({
    id: e.id,
    name: e.name,
    library: e.library,
    description: e.description
  }));
}

/** Fetch full registration for a specific proposal id. Used when the
 *  router picks a section and the mutation engine needs the full field
 *  list to validate the LLM's returned params. */
export function getCatalogEntry(id: string): CatalogEntry | null {
  return getSectionCatalog().find((e) => e.id === id) ?? null;
}
