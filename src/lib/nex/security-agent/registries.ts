// src/lib/nex/security-agent/registries.ts
//
// Read-only loaders for the three canonical registries the Security Agent
// consumes. The Agent NEVER writes to any of these files.
//
// - docs/nex-work-map.json          — capability registry
// - docs/nex-file-capability-map.json — path → CAP-XXX mappings
// - docs/nex-locked-doctrines.json  — sec.* rejection codes + patterns

import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface WorkMapCapability {
  readonly id: string;
  readonly name: string;
  readonly group: string;
  readonly impact_boost_to?: readonly string[];
  readonly retro_benefits_available?: readonly unknown[];
}

interface WorkMap {
  readonly map_version: string;
  readonly capabilities: readonly WorkMapCapability[];
}

interface FileMapping {
  readonly id: string;
  readonly path_pattern: string;
  readonly owning_capability: string;
  readonly capability_name?: string;
  readonly precedence: number;
  readonly notes?: string;
}

interface FileCapabilityMap {
  readonly map_version: string;
  readonly fallback_action: "reject" | "accept";
  readonly fallback_rejection_code: string;
  readonly mappings: readonly FileMapping[];
  readonly special_owners: Readonly<
    Record<string, { readonly meaning: string; readonly rejection_code: string }>
  >;
}

interface Doctrine {
  readonly id: string;
  readonly name: string;
  readonly principle: string;
  readonly source_adr: string;
  readonly check_type: "code_pattern" | "migration_check" | "runtime_check";
  readonly forbidden_patterns: readonly string[];
  readonly rejection_code: string;
  readonly priority: "high" | "medium" | "low";
}

interface LockedDoctrines {
  readonly map_version: string;
  readonly doctrines: readonly Doctrine[];
}

export interface LoadedRegistries {
  readonly workMap: WorkMap;
  readonly fileMap: FileCapabilityMap;
  readonly doctrines: LockedDoctrines;
  readonly loadedAt: string;
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadRegistries(cwd?: string): Promise<LoadedRegistries> {
  const base = cwd ?? process.cwd();
  const [workMap, fileMap, doctrines] = await Promise.all([
    readJson<WorkMap>(join(base, "docs", "nex-work-map.json")),
    readJson<FileCapabilityMap>(join(base, "docs", "nex-file-capability-map.json")),
    readJson<LockedDoctrines>(join(base, "docs", "nex-locked-doctrines.json")),
  ]);
  return { workMap, fileMap, doctrines, loadedAt: new Date().toISOString() };
}

/**
 * Resolve a file path to its owning CAP-XXX via the file-capability-map.
 * Precedence-aware · higher precedence wins on overlap · returns
 * `CAP-UNASSIGNED` or `ROGUE` for fallback matches.
 *
 * NOTE: pattern matching here is simple glob semantics · not the full
 * micromatch grammar. For Stage 1 MVP · we handle:
 *   - exact path match
 *   - `**` at end matches everything under a prefix
 *   - `*.ext` matches files with the extension
 * Full glob is a future refinement (recorded in growth ledger notes).
 */
export function resolveCapabilityForPath(
  path: string,
  fileMap: FileCapabilityMap,
): { readonly capability: string; readonly mappingId: string; readonly precedence: number } | null {
  let best: {
    capability: string;
    mappingId: string;
    precedence: number;
  } | null = null;
  for (const m of fileMap.mappings) {
    if (matchesPattern(path, m.path_pattern)) {
      if (best === null || m.precedence > best.precedence) {
        best = {
          capability: m.owning_capability,
          mappingId: m.id,
          precedence: m.precedence,
        };
      }
    }
  }
  return best;
}

/**
 * Simple glob matcher for Stage 1 MVP.
 * Handles: `foo/bar/**` · `**\/*.ts` · `foo/bar/*.ext` · exact paths.
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Exact
  if (pattern === path) return true;
  // `**/*.ext` or `**/*` — match any file with the extension anywhere
  const regex = globToRegex(pattern);
  return regex.test(path);
}

function globToRegex(glob: string): RegExp {
  // Escape regex specials except * and /
  let src = "";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        // ** — match any number of path segments (including empty)
        src += ".*";
        i += 2;
        if (glob[i] === "/") i += 1; // consume trailing slash to avoid `.*/`
        continue;
      }
      // single * — match anything except /
      src += "[^/]*";
      i += 1;
      continue;
    }
    if (/[.+?^${}()|[\]\\]/.test(c)) {
      src += "\\" + c;
    } else {
      src += c;
    }
    i += 1;
  }
  return new RegExp("^" + src + "$");
}
