// Studio App Manifest — plugin contract per V1 Part 3.
//
// Every Studio App declares its manifest at src/apps/<slug>/manifest.ts.
// The Capability Registry scans, validates, and exposes them to the
// runtime. Adding a new App = adding a new manifest. No changes to
// the kernel.

import { z } from "zod";
import type { EventHandler } from "./runtime";
import type { EventEnvelope } from "./event-bus";

// ─── Manifest Zod schema ─────────────────────────────────────────

export const StudioAppManifestSchema = z.object({
  id:            z.string().regex(/^[a-z0-9-]+\.[a-z0-9-]+$/), // e.g. "vehicle.van-wrap"
  name:          z.string().min(2).max(80),
  version:       z.string().regex(/^\d+\.\d+\.\d+$/),
  studio:        z.enum([
    "Brand", "Vehicle", "Website", "Print",
    "Marketing", "Photography", "Documents",
    "Social", "Office", "Growth"
  ]),
  category:      z.string(),
  description:   z.string().max(400),
  icon:          z.string(),
  status:        z.enum(["enabled", "disabled", "beta"]),

  dependencies: z.array(z.object({
    id:              z.string(),
    minimumVersion:  z.string(),
    required:        z.boolean()
  })).default([]),

  requiredBrandFields: z.array(z.object({
    path:     z.string(),          // e.g. "identity.companyName"
    required: z.boolean()
  })).default([]),

  outputs: z.array(z.object({
    type:        z.string(),
    mime:        z.string(),
    resolution:  z.string(),
    editable:    z.boolean()
  })).default([]),

  permissions: z.array(z.object({
    role:    z.enum(["Owner", "Admin", "Designer", "Staff", "Viewer", "Printer"]),
    action:  z.string()
  })).default([]),

  subscriptions: z.array(z.object({
    event:    z.string(),
    handler:  z.string(),
    priority: z.number().int().min(1).max(10)
  })).default([]),

  generator: z.object({
    type:      z.enum(["image", "document", "website", "app", "video"]),
    compiler:  z.string(),
    workflow:  z.string()
  }),

  storage: z.object({
    bucket:     z.string(),
    retention:  z.string(),
    versioned:  z.boolean(),
    cache:      z.boolean()
  }),

  exporters: z.array(z.object({
    type:     z.string(),
    enabled:  z.boolean()
  })).default([]),

  pricing: z.object({
    plan:     z.enum(["free", "one_time", "subscription"]),
    price:    z.number().min(0),
    credits:  z.number().int().min(0)
  }),

  ai: z.object({
    reasoningModel:  z.string(),
    imageModel:      z.string(),
    criticModel:     z.string(),
    maxAttempts:     z.number().int().min(1).max(10),
    temperature:     z.number().min(0).max(2)
  }),

  qa: z.object({
    minimumScore:    z.number().int().min(0).max(100),
    rules:           z.array(z.string()),
    autoFix:         z.boolean(),
    humanApproval:   z.boolean()
  })
});

export type StudioAppManifest = z.infer<typeof StudioAppManifestSchema>;

/** Generator function signature every App must export alongside its
 *  manifest. Returns a generation result once the pipeline resolves. */
export type AppGenerator = (input: AppGenerateInput) => Promise<AppGenerateResult>;

export type AppGenerateInput = {
  correlation_id: string;
  brand_snapshot: Record<string, unknown>;   // frozen BrandDNA
  user_prompt?:   string;
  reference_urls?: string[];
};

export type AppGenerateResult = {
  ok:             boolean;
  asset_urls?:    string[];
  prompt_used?:   string;
  cost_pence?:    number;
  latency_ms?:    number;
  error?:         string;
};

/** Every App module must export both a manifest and a generator. */
export type StudioAppModule = {
  manifest:  StudioAppManifest;
  generator: AppGenerator;
  handlers?: Record<string, EventHandler<unknown>>;   // subscription handlers by name
};

// ─── Capability Registry ─────────────────────────────────────────

class InMemoryRegistry {
  private apps: Map<string, StudioAppModule> = new Map();

  install(mod: StudioAppModule): void {
    // Validate manifest at install time — no unregistered fields, no
    // typos, correct shape. Throws on failure so a bad App never
    // reaches the runtime.
    const parsed = StudioAppManifestSchema.parse(mod.manifest);
    if (parsed.id !== mod.manifest.id) {
      throw new Error(`Manifest ID mismatch: ${parsed.id} vs ${mod.manifest.id}`);
    }
    this.apps.set(parsed.id, mod);
  }

  uninstall(id: string): void {
    this.apps.delete(id);
  }

  get(id: string): StudioAppModule | undefined {
    return this.apps.get(id);
  }

  list(): StudioAppModule[] {
    return Array.from(this.apps.values());
  }

  findByStudio(studio: StudioAppManifest["studio"]): StudioAppModule[] {
    return this.list().filter((m) => m.manifest.studio === studio);
  }

  /** Fire the App's generator with a validated envelope. Enforces
   *  the required Brand DNA fields per manifest. */
  async execute(id: string, input: AppGenerateInput): Promise<AppGenerateResult> {
    const mod = this.apps.get(id);
    if (!mod) return { ok: false, error: `app_not_found:${id}` };

    // Validate required brand fields are present in the snapshot.
    for (const req of mod.manifest.requiredBrandFields) {
      if (!req.required) continue;
      const value = readPath(input.brand_snapshot, req.path);
      if (value === undefined || value === null || value === "") {
        return { ok: false, error: `missing_required_brand_field:${req.path}` };
      }
    }

    return mod.generator(input);
  }
}

function readPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

export const capabilityRegistry = new InMemoryRegistry();

// ─── Bootstrap — scans src/apps/*/manifest.ts on first access ────

let bootstrapped = false;
export async function ensureAppsLoaded(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  // Static imports so Next.js bundles them. Each App module exports
  // its own manifest + generator + handlers.
  const modules: StudioAppModule[] = [
    // (await import("@/apps/van-wrap")).default,
    // add more Studio Apps here as they ship
  ];
  for (const mod of modules) {
    capabilityRegistry.install(mod);
  }
}
