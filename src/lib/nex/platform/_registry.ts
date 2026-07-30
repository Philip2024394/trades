// Brain Registry — the public API surface for interacting with published
// Reference Brains. All server-side.
//
// Post ADR-0042: the underlying loader has been severed from the
// filesystem (`brains/**/brain.json` and `.author-studio-drafts/`) and
// currently returns an empty registry. The Supabase read to
// `hammerex_nex_brain_versions` will be wired in when the first module
// (Terminology) publishes — Author-Driven Rule (ADR-0041).
//
// Every consumer (Intent Router, Chat API, Composer, Admin dashboard)
// goes through this — never touches the loader directly. Consumers
// must gracefully handle an empty registry (which they already do,
// e.g. `brain-chat/route.ts` returns 503 `no_brains_available`).

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import {
  ensureLoaded, forceReload, getLastScanAt, getBrainsRootPath
} from "./_loader";
import type { BrainDescriptor, BrainManifest } from "./_manifest";

// ─── Read API ─────────────────────────────────────────────────────

export function getBrains(): BrainDescriptor[] {
  return [...ensureLoaded().values()].sort((a, b) => a.priority - b.priority);
}

export function getBrain(slug: string): BrainDescriptor | null {
  return ensureLoaded().get(slug) ?? null;
}

export function getLiveBrains(): BrainDescriptor[] {
  return getBrains().filter((b) => b.enabled && b.status === "live");
}

export function getBrainsByCategory(category: string): BrainDescriptor[] {
  return getBrains().filter((b) => b.category === category);
}

export function listCategories(): string[] {
  return [...new Set(getBrains().map((b) => b.category))].sort();
}

// The General Brain is the always-available fallback per Intent
// Router spec — never Staircase.
export function getGeneralBrain(): BrainDescriptor | null {
  return getBrain("general");
}

// ─── Write / lifecycle API ────────────────────────────────────────

export function registerBrain(_manifest: BrainManifest): void {
  // Post ADR-0042: filesystem registration is severed. Brains enter the
  // runtime only through the Sole Authoritative Path — Layer 1 evidence
  // → Layer 2 draft → review → certification → publication into
  // `hammerex_nex_brain_versions`. Programmatic registration would
  // create a parallel truth path (rejected · see ADR-0042).
  throw new Error("registerBrain: not supported — brains must publish to hammerex_nex_brain_versions via the Sole Authoritative Path (see ADR-0042)");
}

export function unregisterBrain(_slug: string): void {
  // Post ADR-0042: `hammerex_nex_brain_versions` is immutable (BEFORE
  // DELETE trigger enforces this). Un-registration would mean deleting
  // a published brain version, which is not permitted. Superseding
  // versions is the correct mechanism.
  throw new Error("unregisterBrain: not supported — brain versions are immutable (see ADR-0042 + BEFORE DELETE trigger)");
}

export function reloadBrains(): number {
  return forceReload().size;
}

// ─── Health + statistics ──────────────────────────────────────────

export type BrainHealth = {
  slug:             string;
  title:            string;
  status:           string;
  enabled:          boolean;
  manifest_ok:      boolean;
  knowledge_files:  number;
  knowledge_size_kb: number;
  last_loaded_at:   number;
  load_error?:      string;
};

export function brainHealth(): BrainHealth[] {
  return getBrains().map((b) => {
    let sizeBytes = 0;
    for (const kfile of b._resolvedKnowledge) {
      try {
        const raw = readFileSync(kfile);
        sizeBytes += raw.length;
      } catch {
        // count as zero — file was removed between load and now
      }
    }
    return {
      slug:              b.slug,
      title:             b.title,
      status:            b.status,
      enabled:           b.enabled,
      manifest_ok:       existsSync(b._manifestPath),
      knowledge_files:   b._resolvedKnowledge.length,
      knowledge_size_kb: Math.round(sizeBytes / 1024),
      last_loaded_at:    b._loadedAt,
      load_error:        b._loadError
    };
  });
}

export type BrainStatistics = {
  total:             number;
  live:              number;
  coming_soon:       number;
  disabled:          number;
  categories:        number;
  total_knowledge_files: number;
  total_knowledge_size_kb: number;
  brains_root:       string;
  last_scan_at:      number;
};

export function brainStatistics(): BrainStatistics {
  const brains = getBrains();
  const health = brainHealth();
  return {
    total:                   brains.length,
    live:                    brains.filter((b) => b.status === "live").length,
    coming_soon:             brains.filter((b) => b.status === "coming_soon").length,
    disabled:                brains.filter((b) => b.status === "disabled").length,
    categories:              listCategories().length,
    total_knowledge_files:   health.reduce((s, h) => s + h.knowledge_files, 0),
    total_knowledge_size_kb: health.reduce((s, h) => s + h.knowledge_size_kb, 0),
    brains_root:             getBrainsRootPath(),
    last_scan_at:            getLastScanAt()
  };
}
