// Pack Registry — the runtime index of every Industry Pack manifest.
//
// Mirrors appRegistry (src/platform/registry.ts). Same discipline:
// packs self-register at module load, duplicate slugs throw,
// manifests are deep-frozen on registration.

import type { FrozenPackManifest, PackManifest } from "./types";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

class PackRegistry {
  private manifests = new Map<string, FrozenPackManifest>();
  private byIndustry = new Map<string, FrozenPackManifest[]>();

  register(manifest: PackManifest): FrozenPackManifest {
    validatePackManifest(manifest);
    if (this.manifests.has(manifest.slug)) {
      throw new Error(
        `PackRegistry: duplicate slug "${manifest.slug}".`
      );
    }
    const frozen = deepFreeze(manifest) as FrozenPackManifest;
    this.manifests.set(manifest.slug, frozen);
    const bucket = this.byIndustry.get(frozen.industry) ?? [];
    bucket.push(frozen);
    this.byIndustry.set(frozen.industry, bucket);
    return frozen;
  }

  get(slug: string): FrozenPackManifest | undefined {
    return this.manifests.get(slug);
  }

  getOrThrow(slug: string): FrozenPackManifest {
    const m = this.manifests.get(slug);
    if (!m) throw new Error(`PackRegistry: no pack for slug "${slug}"`);
    return m;
  }

  has(slug: string): boolean {
    return this.manifests.has(slug);
  }

  list(): FrozenPackManifest[] {
    return Array.from(this.manifests.values());
  }

  listByIndustry(industry: string): FrozenPackManifest[] {
    if (industry === "*") return this.list();
    return [...(this.byIndustry.get(industry) ?? [])].concat(
      // Wildcard packs surface in every industry filter.
      this.list().filter((p) => p.industry === "*")
    );
  }

  size(): number {
    return this.manifests.size;
  }
}

function validatePackManifest(m: PackManifest): void {
  if (m.manifestVersion !== 1) {
    throw new Error(
      `PackRegistry: unsupported manifestVersion ${m.manifestVersion}.`
    );
  }
  if (!SLUG_RE.test(m.slug)) {
    throw new Error(
      `PackRegistry: invalid slug "${m.slug}" — must be kebab-case.`
    );
  }
  if (!SEMVER_RE.test(m.version)) {
    throw new Error(
      `PackRegistry: invalid version "${m.version}" — must be semver.`
    );
  }
  if (!m.name || !m.tagline || !m.description) {
    throw new Error(
      `PackRegistry: pack "${m.slug}" missing name/tagline/description.`
    );
  }
  if (m.apps.length === 0) {
    throw new Error(
      `PackRegistry: pack "${m.slug}" must install at least one App.`
    );
  }
  const seen = new Set<string>();
  for (const entry of m.apps) {
    if (seen.has(entry.slug)) {
      throw new Error(
        `PackRegistry: pack "${m.slug}" lists App "${entry.slug}" twice.`
      );
    }
    seen.add(entry.slug);
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const anyValue = value as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyValue)) {
    deepFreeze(anyValue[key]);
  }
  return Object.freeze(value);
}

export const packRegistry = new PackRegistry();
export type { PackRegistry };
