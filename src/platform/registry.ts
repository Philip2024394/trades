// App Registry — the runtime index of every installed App manifest.
//
// Milestone 1 · Registry Kit migration:
// Composes over `createRegistry` from @/platform/registryKit. Every
// existing caller (App manifests self-registering, App Store API,
// Studio browser, page nav-compose, dependency resolver, conflict
// checker) works verbatim.
//
// Domain-specific methods preserved: `.listByIndustry()`,
// `.listByPage()`, `.listAppsThatCreatePages()`,
// `.resolveDependencies()`, `.checkConflicts()`.

import type { Frozen, RegistrationBase } from "@/platform/registryKit";
import { createRegistry } from "@/platform/registryKit";
import type {
  AppCategory,
  AppManifest,
  FrozenAppManifest,
  IndustrySlug,
  PageSlug
} from "./manifest/types";

type AppRegistration = AppManifest & RegistrationBase;
type FrozenAppRegistration = Frozen<AppRegistration>;

const inner = createRegistry<AppRegistration>({
  label: "appRegistry",
  idFormat: "slug",
  validate: (m) => {
    if (m.manifestVersion !== 1) {
      throw new Error(
        `unsupported manifestVersion ${m.manifestVersion} for App "${m.slug}".`
      );
    }
    if (!m.name || !m.tagline || !m.description) {
      throw new Error(
        `App "${m.slug}" missing name/tagline/description.`
      );
    }
    if (!m.publisher?.name) {
      throw new Error(`App "${m.slug}" missing publisher.name.`);
    }
    if (m.storage?.tables?.length) {
      const prefix = `app_${m.slug.replace(/-/g, "_")}_`;
      for (const t of m.storage.tables) {
        if (typeof t !== "string" || !t.startsWith(prefix)) {
          throw new Error(
            `App "${m.slug}" table "${t}" must be prefixed with "${prefix}".`
          );
        }
      }
    }
    for (const s of m.studio.sections) {
      if (!s.id || s.id.includes(".")) {
        throw new Error(
          `App "${m.slug}" section id "${s.id}" invalid — non-empty, no dots.`
        );
      }
    }
    if (m.requirements.dependencies.includes(m.slug)) {
      throw new Error(`App "${m.slug}" cannot depend on itself.`);
    }
    if (m.requirements.conflicts.includes(m.slug)) {
      throw new Error(`App "${m.slug}" cannot conflict with itself.`);
    }

    // ─── Trade Center Week 1 validation (ADR-033 through ADR-047) ──
    //
    // Every namespaced declaration MUST prefix its id with the App
    // slug so cross-App discovery cannot collide. All fields are
    // optional — Apps not opting in skip the checks entirely.
    const nsPrefix = `${m.slug}.`;
    if (m.aiTools?.length) {
      for (const t of m.aiTools) {
        if (!t.name.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" aiTool name "${t.name}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.featureFlags?.length) {
      for (const f of m.featureFlags) {
        if (!f.key.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" featureFlag key "${f.key}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.telemetry?.length) {
      for (const t of m.telemetry) {
        if (!t.metric.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" telemetry metric "${t.metric}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.commands?.length) {
      for (const c of m.commands) {
        if (!c.id.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" command id "${c.id}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.declaredCapabilities?.length) {
      for (const cap of m.declaredCapabilities) {
        if (!cap.key.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" declaredCapability key "${cap.key}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.searchProviders?.length) {
      for (const sp of m.searchProviders) {
        if (!sp.id.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" searchProvider id "${sp.id}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.widgets?.length) {
      for (const w of m.widgets) {
        if (!w.id.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" widget id "${w.id}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    if (m.notificationKinds?.length) {
      for (const n of m.notificationKinds) {
        if (!n.kind.startsWith(nsPrefix)) {
          throw new Error(
            `App "${m.slug}" notificationKind "${n.kind}" must start with "${nsPrefix}".`
          );
        }
      }
    }
    // platformCompat semver validation — deferred to registryKit
    // validators if/when we wire them; for Week 1 we accept any
    // string and rely on downstream consumers to enforce.
  }
});

function normalise(m: AppManifest): AppRegistration {
  return {
    ...m,
    // RegistrationBase — id from slug; other fields already present.
    id: m.slug,
    tags: [
      ...(m.compatibility.industries ?? []),
      ...(m.compatibility.pages ?? []),
      m.category
    ].filter(Boolean),
    searchKeywords: [m.tagline, m.category]
  };
}

export const appRegistry = {
  register(manifest: AppManifest): FrozenAppRegistration {
    return inner.register(normalise(manifest));
  },
  get(slug: string): FrozenAppRegistration | undefined {
    return inner.get(slug);
  },
  getOrThrow(slug: string): FrozenAppRegistration {
    return inner.getOrThrow(slug);
  },
  has(slug: string): boolean {
    return inner.has(slug);
  },
  list(): FrozenAppRegistration[] {
    return inner.list();
  },
  listByCategory(category: AppCategory): FrozenAppRegistration[] {
    return inner.listByCategory(category);
  },
  size(): number {
    return inner.size();
  },

  /** Every App compatible with a given industry. `industry === "*"`
   *  returns every App. Otherwise returns Apps whose
   *  `compatibility.industries` contains the industry OR `"*"`. */
  listByIndustry(industry: IndustrySlug): FrozenAppRegistration[] {
    if (industry === "*") return inner.list();
    return inner
      .list()
      .filter(
        (m) =>
          m.compatibility.industries.includes("*") ||
          m.compatibility.industries.includes(industry)
      );
  },

  /** Every App that can be inserted into a given page. */
  listByPage(pageId: PageSlug): FrozenAppRegistration[] {
    if (pageId === "*") return inner.list();
    return inner
      .list()
      .filter(
        (m) =>
          m.compatibility.pages.includes("*") ||
          m.compatibility.pages.includes(pageId)
      );
  },

  /** Every App that CREATES a page on install. */
  listAppsThatCreatePages(): FrozenAppRegistration[] {
    return inner.list().filter((m) => m.compatibility.createsPages.length > 0);
  },

  /** Transitive dependency resolution. Throws if a dep is missing. */
  resolveDependencies(slug: string): FrozenAppRegistration[] {
    const seen = new Set<string>();
    const out: FrozenAppRegistration[] = [];
    const visit = (s: string): void => {
      if (seen.has(s)) return;
      seen.add(s);
      const m = inner.getOrThrow(s);
      for (const dep of m.requirements.dependencies) visit(dep);
      out.push(m);
    };
    visit(slug);
    return out.filter((m) => m.slug !== slug);
  },

  /** Every conflict pair in the proposed install set. */
  checkConflicts(
    slugs: string[]
  ): { app: string; conflictsWith: string }[] {
    const conflicts: { app: string; conflictsWith: string }[] = [];
    const wanted = new Set(slugs);
    for (const slug of slugs) {
      const m = inner.get(slug);
      if (!m) continue;
      for (const other of m.requirements.conflicts) {
        if (wanted.has(other)) {
          conflicts.push({ app: slug, conflictsWith: other });
        }
      }
    }
    return conflicts;
  },

  // ─── New surface inherited from the kit ─────────────────────────
  search: inner.search,
  describe: inner.describe,
  listByTag: inner.listByTag,
  categories: inner.categories,
  tags: inner.tags,
  counts: inner.counts,
  resolveAlias: inner.resolveAlias,
  selfCheck: inner.selfCheck,
  snapshot: inner.snapshot
};

// Legacy type re-export.
export type { FrozenAppManifest };
