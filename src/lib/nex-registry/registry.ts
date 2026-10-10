// src/lib/nex-registry/registry.ts
//
// NEX Registry · Storage/Query Engine (Ledger B additive · Zero LLM)
//
// Governs entries across component / icon / font / animation / section /
// asset / template / layout / design-system categories.
//
// FOUNDER INVARIANTS
//   · Ledger B additive · never mutates frozen infrastructure
//   · Zero LLM · pure deterministic
//   · Anti-fabrication · every CORE/APPROVED entry must have a real
//     ProvenanceRecord with license_verified=true and a concrete
//     nex_compatibility signal
//   · Registry NEVER duplicates existing NEX stores · it PROXIES to them
//     via proxy_target (Studio sectionRegistry · image-manifest · etc.)
//   · Registry NEVER auto-imports external code · it only records what
//     is already in the repo or is explicitly documented as a candidate
//
// Design boundary
//   · This module holds an in-memory catalog seeded from evidence gathered
//     during the master discovery pass. It does NOT scan node_modules or
//     the filesystem live. Callers can register additional entries at
//     runtime via registerEntry(), which requires a real provenance
//     record.

import {
  computeEntryId,
  computeProvenanceHash,
  isAutoSelectable,
  requiresLicenseReview,
  REGISTRY_CATEGORIES,
  type LibraryEntry,
  type LicenseClass,
  type ProvenanceRecord,
  type QualityTier,
  type RegistryCategory,
  type DeviceSupport,
} from "./types";

// ── Storage (module-scoped · deterministic) ───────────────────────────
const REGISTRY = new Map<string, LibraryEntry>();

// ── Registration ──────────────────────────────────────────────────────
export function registerEntry(entry: Omit<LibraryEntry, "entry_id" | "documented_at_iso" | "zero_llm" | "ledger"> & { documented_at_iso?: string }): LibraryEntry {
  const entry_id = computeEntryId({
    category: entry.category,
    name: entry.name,
    source_repository: entry.provenance.source_repository,
  });
  const full: LibraryEntry = {
    ...entry,
    entry_id,
    documented_at_iso: entry.documented_at_iso ?? new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
  // Anti-fabrication invariant: CORE/APPROVED require verified license.
  if (isAutoSelectable(full.quality_tier) && !full.provenance.license_verified) {
    throw new Error(
      `nex-registry: cannot mark entry as ${full.quality_tier} without license_verified=true (entry ${full.name})`,
    );
  }
  REGISTRY.set(entry_id, full);
  return full;
}

// ── Query ─────────────────────────────────────────────────────────────
export function getEntry(entry_id: string): LibraryEntry | null {
  return REGISTRY.get(entry_id) ?? null;
}

export function listByCategory(category: RegistryCategory): readonly LibraryEntry[] {
  const rows: LibraryEntry[] = [];
  for (const e of REGISTRY.values()) if (e.category === category) rows.push(e);
  return Object.freeze(rows.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listByTier(tier: QualityTier): readonly LibraryEntry[] {
  const rows: LibraryEntry[] = [];
  for (const e of REGISTRY.values()) if (e.quality_tier === tier) rows.push(e);
  return Object.freeze(rows.sort((a, b) => a.name.localeCompare(b.name)));
}

export function listAutoSelectable(): readonly LibraryEntry[] {
  const rows: LibraryEntry[] = [];
  for (const e of REGISTRY.values()) if (isAutoSelectable(e.quality_tier)) rows.push(e);
  return Object.freeze(rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));
}

export function search(input: {
  category?: RegistryCategory;
  tier?: QualityTier;
  device?: keyof DeviceSupport;
  usage_context_includes?: string;
  license_commercial_safe?: boolean;
}): readonly LibraryEntry[] {
  const rows: LibraryEntry[] = [];
  for (const e of REGISTRY.values()) {
    if (input.category && e.category !== input.category) continue;
    if (input.tier && e.quality_tier !== input.tier) continue;
    if (input.device && !e.device_support[input.device]) continue;
    if (input.usage_context_includes && !e.usage_context.includes(input.usage_context_includes)) continue;
    if (input.license_commercial_safe && requiresLicenseReview(e.provenance.license)) continue;
    rows.push(e);
  }
  return Object.freeze(rows.sort((a, b) => a.name.localeCompare(b.name)));
}

export function count(): number {
  return REGISTRY.size;
}

export function summary(): Record<RegistryCategory, number> {
  const out = Object.fromEntries(REGISTRY_CATEGORIES.map((c) => [c, 0])) as Record<RegistryCategory, number>;
  for (const e of REGISTRY.values()) out[e.category] += 1;
  return out;
}

export function _resetRegistryForTests(): void {
  REGISTRY.clear();
}

// ── ProvenanceRecord constructor (with hash) ───────────────────────────
function prov(input: Omit<ProvenanceRecord, "provenance_hash">): ProvenanceRecord {
  return { ...input, provenance_hash: computeProvenanceHash(input) };
}

// ── CORE population · seeded from the master discovery map ─────────────
// Everything below has an evidence anchor in the discovery report. Each
// entry is either (a) already in the repo (shadcn / Lucide / framer-motion
// / Google Fonts / NexHudTheme / Studio registry / image manifest) or (b)
// a documented candidate held at APPROVED tier pending real import.

const NOW = new Date().toISOString();
const ALL_DEVICES: DeviceSupport = { desktop: true, tablet: true, mobile: true, pwa: true };

export function seedCoreRegistry(): void {
  _resetRegistryForTests();
  // ── shadcn/ui components (27 · already installed) ───────────────────
  const SHADCN_COMPONENTS: readonly { name: string; variants: string[]; path: string }[] = [
    { name: "Accordion", variants: ["default"], path: "src/components/ui/accordion.tsx" },
    { name: "Alert", variants: ["default", "destructive"], path: "src/components/ui/alert.tsx" },
    { name: "Avatar", variants: ["default"], path: "src/components/ui/avatar.tsx" },
    { name: "Badge", variants: ["default", "secondary", "destructive", "outline"], path: "src/components/ui/badge.tsx" },
    { name: "Button", variants: ["default", "secondary", "outline", "ghost", "destructive", "link"], path: "src/components/ui/button.tsx" },
    { name: "Card", variants: ["default"], path: "src/components/ui/card.tsx" },
    { name: "Checkbox", variants: ["default"], path: "src/components/ui/checkbox.tsx" },
    { name: "Dialog", variants: ["default"], path: "src/components/ui/dialog.tsx" },
    { name: "Drawer", variants: ["default"], path: "src/components/ui/drawer.tsx" },
    { name: "DropdownMenu", variants: ["default"], path: "src/components/ui/dropdown-menu.tsx" },
    { name: "Form", variants: ["default"], path: "src/components/ui/form.tsx" },
    { name: "Input", variants: ["default"], path: "src/components/ui/input.tsx" },
    { name: "Label", variants: ["default"], path: "src/components/ui/label.tsx" },
    { name: "Pagination", variants: ["default"], path: "src/components/ui/pagination.tsx" },
    { name: "Popover", variants: ["default"], path: "src/components/ui/popover.tsx" },
    { name: "Progress", variants: ["default"], path: "src/components/ui/progress.tsx" },
    { name: "RadioGroup", variants: ["default"], path: "src/components/ui/radio-group.tsx" },
    { name: "Reveal", variants: ["fade", "slide"], path: "src/components/ui/reveal.tsx" },
    { name: "Select", variants: ["default"], path: "src/components/ui/select.tsx" },
    { name: "Separator", variants: ["default"], path: "src/components/ui/separator.tsx" },
    { name: "Sheet", variants: ["default"], path: "src/components/ui/sheet.tsx" },
    { name: "Skeleton", variants: ["default"], path: "src/components/ui/skeleton.tsx" },
    { name: "Switch", variants: ["default"], path: "src/components/ui/switch.tsx" },
    { name: "Tabs", variants: ["default"], path: "src/components/ui/tabs.tsx" },
    { name: "Textarea", variants: ["default"], path: "src/components/ui/textarea.tsx" },
    { name: "Toast", variants: ["default", "destructive"], path: "src/components/ui/toast.tsx" },
    { name: "Tooltip", variants: ["default"], path: "src/components/ui/tooltip.tsx" },
  ];
  for (const c of SHADCN_COMPONENTS) {
    registerEntry({
      category: "component",
      name: c.name,
      description: `shadcn/ui ${c.name} primitive · already installed in repo · Radix-based or shadcn-custom`,
      quality_tier: "CORE",
      provenance: prov({
        source_repository: "shadcn-ui/ui",
        source_url: "https://ui.shadcn.com",
        source_commit: null,
        source_version: "installed-in-repo",
        license: "MIT",
        license_verified: true,
        framework: ["react", "tailwindcss", "radix-ui"],
        dependencies: ["react", "tailwindcss-animate", "class-variance-authority", "clsx"],
        security_status: "clean",
        accessibility_status: "aria_and_keyboard_verified",
        visual_quality: "excellent",
        modernity_status: "current",
        nex_compatibility: "verified",
        nex_modifications: [],
        import_date: NOW,
      }),
      usage_context: ["desktop", "tablet", "mobile", "pwa", "workstation"],
      variants: c.variants,
      device_support: ALL_DEVICES,
      path_in_repo: c.path,
      proxy_target: null,
    });
  }

  // ── Icons · Lucide (already installed · ~897 usage sites) ───────────
  registerEntry({
    category: "icon",
    name: "lucide-react",
    description: "Lucide icon family · sole icon library in-use across the repo · consistent stroke, thin/technical aesthetic",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: "lucide-icons/lucide",
      source_url: "https://lucide.dev",
      source_commit: null,
      source_version: "^1.23.0",
      license: "ISC",
      license_verified: true,
      framework: ["react"],
      dependencies: ["lucide-react"],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "excellent",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["default_icon_family"],
    variants: ["outline"],
    device_support: ALL_DEVICES,
    path_in_repo: null,
    proxy_target: "package:lucide-react",
  });

  // ── Fonts · Google Fonts via next/font (CSS-var pattern) ────────────
  registerEntry({
    category: "font",
    name: "google-fonts-css-var",
    description: "Google Fonts loaded dynamically via CSS custom properties --font-heading, --font-body, --font-inter · swappable per ThemeProvider",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: "google/fonts",
      source_url: "https://fonts.google.com",
      source_commit: null,
      source_version: "cdn",
      license: "SIL_OFL",
      license_verified: true,
      framework: ["next.js"],
      dependencies: ["next"],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "excellent",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: ["exposed as --font-* CSS vars"],
      import_date: NOW,
    }),
    usage_context: ["all_pages"],
    variants: ["heading", "body", "inter"],
    device_support: ALL_DEVICES,
    path_in_repo: null,
    proxy_target: "css-var:--font-inter,--font-heading,--font-body",
  });

  // ── Animation · framer-motion ───────────────────────────────────────
  registerEntry({
    category: "animation",
    name: "framer-motion",
    description: "Framer Motion · ~34 import sites · interactive motion + layout transitions · already installed",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: "framer/motion",
      source_url: "https://motion.dev",
      source_commit: null,
      source_version: "^12.42.2",
      license: "MIT",
      license_verified: true,
      framework: ["react"],
      dependencies: ["framer-motion"],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "excellent",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["hover", "reveal", "layout", "page_transition"],
    variants: [],
    device_support: ALL_DEVICES,
    path_in_repo: null,
    proxy_target: "package:framer-motion",
  });

  // ── Animation · tailwindcss-animate ─────────────────────────────────
  registerEntry({
    category: "animation",
    name: "tailwindcss-animate",
    description: "Utility animation keyframes for accordion, fade-in, and animate-spin loaders",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: "jamiebuilds/tailwindcss-animate",
      source_url: "https://github.com/jamiebuilds/tailwindcss-animate",
      source_commit: null,
      source_version: "^1.0.7",
      license: "MIT",
      license_verified: true,
      framework: ["tailwindcss"],
      dependencies: ["tailwindcss-animate"],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "good",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["accordion", "loader", "fade"],
    variants: ["animate-spin", "animate-fade-in", "accordion-down", "accordion-up"],
    device_support: ALL_DEVICES,
    path_in_repo: null,
    proxy_target: "package:tailwindcss-animate",
  });

  // ── Design system · NexHudTheme (native · themeable contract) ───────
  registerEntry({
    category: "design_system",
    name: "NexHudTheme",
    description: "NEX HUD themeable design contract · swappable, geometry-invariant · brand tokens + semantic tokens + material system + type scale + radius + spacing",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: null,
      source_url: null,
      source_commit: null,
      source_version: "themeable-architecture-2026-08-25",
      license: "PROPRIETARY_NEX",
      license_verified: true,
      framework: ["tailwindcss", "react"],
      dependencies: [],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "excellent",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["default_design_system"],
    variants: ["light", "dark", "material-metal", "material-polymer", "material-wood", "material-silk", "material-glass"],
    device_support: ALL_DEVICES,
    path_in_repo: "src/components/nexapp/hud/theme.ts",
    proxy_target: null,
  });

  // ── Sections · proxy to Studio's existing sectionRegistry ───────────
  registerEntry({
    category: "section",
    name: "studio-section-registry",
    description: "Proxy pointer to the existing Studio section registry (50+ section types across 20+ categories) · do not duplicate",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: null,
      source_url: null,
      source_commit: null,
      source_version: "in-repo",
      license: "PROPRIETARY_NEX",
      license_verified: true,
      framework: ["react", "next.js", "tailwindcss"],
      dependencies: [],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "good",
      modernity_status: "modern",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["merchant_site", "landing_page"],
    variants: ["50+ section types"],
    device_support: ALL_DEVICES,
    path_in_repo: "src/lib/studio/sectionRegistry.ts",
    proxy_target: "in-repo:src/lib/studio/sectionRegistry",
  });

  // ── Assets · proxy to existing image manifest ───────────────────────
  registerEntry({
    category: "asset",
    name: "nex-image-manifest",
    description: "Proxy pointer to the existing NEX image manifest (187K+ rows) · do not duplicate · ADR-0024 enforcement",
    quality_tier: "CORE",
    provenance: prov({
      source_repository: null,
      source_url: null,
      source_commit: null,
      source_version: "in-repo",
      license: "PROPRIETARY_NEX",
      license_verified: true,
      framework: [],
      dependencies: [],
      security_status: "clean",
      accessibility_status: "not_assessed",
      visual_quality: "not_assessed",
      modernity_status: "current",
      nex_compatibility: "verified",
      nex_modifications: [],
      import_date: NOW,
    }),
    usage_context: ["project_asset", "hero", "gallery"],
    variants: [],
    device_support: ALL_DEVICES,
    path_in_repo: "data/nex-image-manifest.json",
    proxy_target: "in-repo:data/nex-image-manifest.json",
  });
  // ── Template and layout categories intentionally left empty in Phase 1
  //     (§38: schemas only · no mass imports). Approved templates enter
  //     the registry only after real import review.
}

// ── Manifest export (§32 template metadata alignment) ─────────────────
export interface RegistryManifest {
  readonly version: string;
  readonly total_entries: number;
  readonly by_category: Record<RegistryCategory, number>;
  readonly by_tier: Record<QualityTier, number>;
  readonly generated_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
}

export function exportManifest(): RegistryManifest {
  const by_category = summary();
  const by_tier: Record<QualityTier, number> = {
    CORE: 0, APPROVED: 0, ALTERNATIVE: 0, SPECIALIST: 0,
    EXPERIMENTAL: 0, LEGACY: 0, QUARANTINED: 0, DO_NOT_USE: 0,
  };
  for (const e of REGISTRY.values()) by_tier[e.quality_tier] += 1;
  return {
    version: "nex-registry.v1.2026-09-19",
    total_entries: REGISTRY.size,
    by_category,
    by_tier,
    generated_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
  };
}
