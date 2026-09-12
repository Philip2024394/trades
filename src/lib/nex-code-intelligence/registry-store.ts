// src/lib/nex-code-intelligence/registry-store.ts
// Read-only loader for the Code Intelligence Registry.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Registry, LanguageEntry } from "./types";

let CACHE: Registry | null = null;

export function loadRegistry(): Registry {
  if (CACHE) return CACHE;
  const p = resolve(process.cwd(), "data/nex1-code-intelligence/registry-v0.1.0.json");
  CACHE = JSON.parse(readFileSync(p, "utf8")) as Registry;
  return CACHE;
}
export function _resetRegistryCache(): void { CACHE = null; }

export function languagesByExtension(): ReadonlyMap<string, readonly LanguageEntry[]> {
  const m = new Map<string, LanguageEntry[]>();
  for (const l of loadRegistry().languages) {
    for (const ext of l.extensions) {
      const key = ext.toLowerCase();
      const arr = m.get(key) ?? [];
      arr.push(l);
      m.set(key, arr);
    }
  }
  return m;
}

export function languagesByFilename(): ReadonlyMap<string, readonly LanguageEntry[]> {
  const m = new Map<string, LanguageEntry[]>();
  for (const l of loadRegistry().languages) {
    for (const n of l.filenames) {
      const arr = m.get(n) ?? [];
      arr.push(l);
      m.set(n, arr);
    }
  }
  return m;
}

export function languagesByShebang(): ReadonlyMap<string, readonly LanguageEntry[]> {
  const m = new Map<string, LanguageEntry[]>();
  for (const l of loadRegistry().languages) {
    for (const sb of l.shebangs) {
      const arr = m.get(sb) ?? [];
      arr.push(l);
      m.set(sb, arr);
    }
  }
  return m;
}

export function languageById(id: string): LanguageEntry | null {
  return loadRegistry().languages.find((l) => l.id === id) ?? null;
}
