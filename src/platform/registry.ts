// App Registry — the runtime index of every installed App manifest.
//
// One instance per process. Every App calls `appRegistry.register()`
// at module load; Studio, the App Store, the Industry Pack installer,
// and the AI recommender all consume the registry rather than
// importing individual manifests.
//
// The registry never touches I/O. It's a pure in-memory index that
// serves as the single lookup surface for Apps by slug, category,
// industry, or target page.
//
// Duplicate slug registration throws — a collision is always a bug
// (double-import, typo, unrenamed fork), never intentional.

import type {
  AppCategory,
  AppManifest,
  FrozenAppManifest,
  IndustrySlug,
  PageSlug
} from "./manifest/types";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

class AppRegistry {
  private manifests = new Map<string, FrozenAppManifest>();
  private byCategory = new Map<AppCategory, FrozenAppManifest[]>();

  register(manifest: AppManifest): FrozenAppManifest {
    validateManifest(manifest);
    if (this.manifests.has(manifest.slug)) {
      throw new Error(
        `AppRegistry: duplicate registration for slug "${manifest.slug}". ` +
          `Every App must have a unique slug across the platform.`
      );
    }
    const frozen = deepFreeze(manifest) as FrozenAppManifest;
    this.manifests.set(manifest.slug, frozen);
    const bucket = this.byCategory.get(frozen.category) ?? [];
    bucket.push(frozen);
    this.byCategory.set(frozen.category, bucket);
    return frozen;
  }

  get(slug: string): FrozenAppManifest | undefined {
    return this.manifests.get(slug);
  }

  getOrThrow(slug: string): FrozenAppManifest {
    const m = this.manifests.get(slug);
    if (!m) {
      throw new Error(
        `AppRegistry: no App registered for slug "${slug}". ` +
          `Ensure the App's manifest module is imported before use.`
      );
    }
    return m;
  }

  has(slug: string): boolean {
    return this.manifests.has(slug);
  }

  list(): FrozenAppManifest[] {
    return Array.from(this.manifests.values());
  }

  listByCategory(category: AppCategory): FrozenAppManifest[] {
    return [...(this.byCategory.get(category) ?? [])];
  }

  /** Every App compatible with a given industry. `industry === "*"`
   *  returns every App. Otherwise returns Apps whose
   *  `compatibility.industries` contains the industry OR `"*"`. */
  listByIndustry(industry: IndustrySlug): FrozenAppManifest[] {
    if (industry === "*") return this.list();
    return this.list().filter(
      (m) =>
        m.compatibility.industries.includes("*") ||
        m.compatibility.industries.includes(industry)
    );
  }

  /** Every App that can be inserted into a given page. `pageId === "*"`
   *  returns every App. */
  listByPage(pageId: PageSlug): FrozenAppManifest[] {
    if (pageId === "*") return this.list();
    return this.list().filter(
      (m) =>
        m.compatibility.pages.includes("*") ||
        m.compatibility.pages.includes(pageId)
    );
  }

  /** Every App that CREATES a page on install (as opposed to inserting
   *  into an existing page). Used by the App Store to render the
   *  "This App will add a new page to your site" install card. */
  listAppsThatCreatePages(): FrozenAppManifest[] {
    return this.list().filter(
      (m) => m.compatibility.createsPages.length > 0
    );
  }

  /** Dependency resolution — returns manifests for every dependency,
   *  transitively. Throws if any dep is missing so a broken install
   *  fails fast. */
  resolveDependencies(slug: string): FrozenAppManifest[] {
    const seen = new Set<string>();
    const out: FrozenAppManifest[] = [];
    const visit = (s: string): void => {
      if (seen.has(s)) return;
      seen.add(s);
      const m = this.getOrThrow(s);
      for (const dep of m.requirements.dependencies) visit(dep);
      out.push(m);
    };
    visit(slug);
    // Remove the root — callers want the deps, not the root itself.
    return out.filter((m) => m.slug !== slug);
  }

  /** Given a proposed install set of slugs, returns every conflict pair
   *  the merchant will hit. Empty array = clean install. */
  checkConflicts(
    slugs: string[]
  ): { app: string; conflictsWith: string }[] {
    const conflicts: { app: string; conflictsWith: string }[] = [];
    const wanted = new Set(slugs);
    for (const slug of slugs) {
      const m = this.get(slug);
      if (!m) continue;
      for (const other of m.requirements.conflicts) {
        if (wanted.has(other)) {
          conflicts.push({ app: slug, conflictsWith: other });
        }
      }
    }
    return conflicts;
  }

  /** Total registered Apps. Powers the App Store's "N apps available"
   *  hero copy without allocating the full list. */
  size(): number {
    return this.manifests.size;
  }
}

// ─── Validation ─────────────────────────────────────────────────────

function validateManifest(m: AppManifest): void {
  if (m.manifestVersion !== 1) {
    throw new Error(
      `AppRegistry: unsupported manifestVersion ${m.manifestVersion}. ` +
        `Platform only supports v1 today.`
    );
  }
  if (typeof m.slug !== "string" || !SLUG_RE.test(m.slug)) {
    throw new Error(
      `AppRegistry: invalid slug "${m.slug}" — must be kebab-case ` +
        `(lowercase letters, digits, single hyphens, no leading/trailing hyphen).`
    );
  }
  if (typeof m.version !== "string" || !SEMVER_RE.test(m.version)) {
    throw new Error(
      `AppRegistry: invalid version "${m.version}" for App "${m.slug}" ` +
        `— must be semver (e.g. "1.0.0" or "1.0.0-beta.1").`
    );
  }
  if (!m.name || !m.tagline || !m.description) {
    throw new Error(
      `AppRegistry: App "${m.slug}" missing required identity copy ` +
        `(name / tagline / description).`
    );
  }
  if (!m.publisher?.name) {
    throw new Error(
      `AppRegistry: App "${m.slug}" missing publisher.name.`
    );
  }

  // Storage naming rule — dashes in slug become underscores in the
  // required table prefix so DB names stay SQL-safe.
  if (m.storage?.tables?.length) {
    const prefix = `app_${m.slug.replace(/-/g, "_")}_`;
    for (const t of m.storage.tables) {
      if (typeof t !== "string" || !t.startsWith(prefix)) {
        throw new Error(
          `AppRegistry: App "${m.slug}" declared storage table "${t}" ` +
            `not matching required prefix "${prefix}". ` +
            `App-owned tables must be prefixed so uninstall+purge can scope by name.`
        );
      }
    }
  }

  // Section id local sanity — the platform namespaces to
  // `app.<slug>.<id>` at load time, so local ids must be non-empty
  // and free of dots.
  for (const s of m.studio.sections) {
    if (!s.id || s.id.includes(".")) {
      throw new Error(
        `AppRegistry: App "${m.slug}" section id "${s.id}" invalid ` +
          `— must be non-empty and free of dots (platform namespaces automatically).`
      );
    }
  }

  // Prevent depending on / conflicting with self.
  if (m.requirements.dependencies.includes(m.slug)) {
    throw new Error(
      `AppRegistry: App "${m.slug}" cannot depend on itself.`
    );
  }
  if (m.requirements.conflicts.includes(m.slug)) {
    throw new Error(
      `AppRegistry: App "${m.slug}" cannot conflict with itself.`
    );
  }
}

// ─── Deep freeze ────────────────────────────────────────────────────
//
// Manifests are treated as immutable once registered. Freezing catches
// accidental mutation at development time (a good number of bugs in
// registry-based systems come from callers mutating shared metadata).

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const anyValue = value as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyValue)) {
    deepFreeze(anyValue[key]);
  }
  return Object.freeze(value);
}

// ─── The one and only instance ─────────────────────────────────────

export const appRegistry = new AppRegistry();

/** Type-only export so consumers can annotate handlers/hooks without
 *  reaching into the class. */
export type { AppRegistry };
