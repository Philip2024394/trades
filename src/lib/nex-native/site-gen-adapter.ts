// src/lib/nex-native/site-gen-adapter.ts
//
// Wave D Slice 16g/16h · SiteGenAdapter interface + adapters.
// -----------------------------------------------------------
// Founder-sealed doctrine 2026-09-25 · two-engine architecture:
//   · Adapters produce STRUCTURED NEX Site Specifications · never JSX
//   · NEX validator owns the yes/no decision
//   · Default backend = NEX-owned Generation Engine, never external SaaS
//
// Currently shipped adapters:
//   · ConsoleAdapter        · deterministic dry-run · zero network · always OK
//   · NexGenEngineAdapter   · Slice 16h: wired to runGenerationEngine +
//                             model-registry.selectModel("default"). Injects
//                             modelResolver + runEngine + fallback for tests.
//                             On any model failure / JSON parse failure /
//                             validation failure → honest fallback to
//                             ConsoleAdapter (doctrine: never lie).

import "server-only";
import type { NexSiteSpec, SpecValidationResult } from "./site-spec";
import { NEX_SITE_SPEC_VERSION, validateSiteSpec } from "./site-spec";
import type { NexSiteAccent, NexSiteSection, NexSiteTemplate } from "./site-service";
import { NEX_SITE_ACCENTS, NEX_SITE_TEMPLATES, DEFAULT_SECTIONS } from "./site-service";
import { validateSubjectCoherence } from "./site-templates";

export interface SiteGenInput {
  prompt: string;
  business: {
    business_id: string;
    display_name: string;
    description: string | null;
  };
}

export interface SiteGenResult {
  spec: NexSiteSpec;
  adapter_name: string;
  is_dry_run: boolean;
  fallback_reason?: string;   // populated when the adapter fell back honestly
}

export interface SiteGenAdapter {
  readonly name: string;
  readonly is_dry_run: boolean;
  generate(input: SiteGenInput): Promise<SiteGenResult>;
}

// ---------------------------------------------------------------------------
// Deterministic helpers (used by ConsoleAdapter + as fallback for engine)
// ---------------------------------------------------------------------------

function extractAccent(prompt: string): NexSiteAccent {
  const p = prompt.toLowerCase();
  for (const a of NEX_SITE_ACCENTS) if (p.includes(a)) return a;
  return "slate";
}
function extractTemplate(prompt: string): NexSiteTemplate {
  const p = prompt.toLowerCase();
  if (p.includes("artisan") || p.includes("handmade") || p.includes("bespoke")) return "warm-artisan";
  return "modern-minimal";
}
function extractHeadline(prompt: string, businessName: string): string {
  const cleaned = prompt.trim().replace(/^(make|build|create|design)\s+(me\s+)?(a\s+)?(site|page|app|website)(\s+for)?/i, "").trim();
  if (cleaned.length > 8 && cleaned.length < 200) return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return businessName;
}
function extractSubline(prompt: string, description: string | null): string {
  if (description && description.trim().length > 0 && description.length < 240) return description.trim();
  if (prompt.trim().length > 20 && prompt.length < 240) return prompt.trim();
  return "Message us on NEX to start a conversation.";
}
function extractCta(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/quote|estimate/.test(p)) return "Get a quote";
  if (/book/.test(p)) return "Book a call";
  if (/shop|buy/.test(p)) return "See products";
  return "Message us";
}

function buildDeterministicSpec(input: SiteGenInput): NexSiteSpec {
  return {
    version: NEX_SITE_SPEC_VERSION,
    identity: { template: extractTemplate(input.prompt) },
    business: { business_id: input.business.business_id },
    theme: { accent: extractAccent(input.prompt) },
    sections: DEFAULT_SECTIONS.map((t): { type: NexSiteSection } => ({ type: t })),
    content: {
      hero_headline: extractHeadline(input.prompt, input.business.display_name),
      hero_subline: extractSubline(input.prompt, input.business.description),
      cta_label: extractCta(input.prompt),
    },
    products: { source: "business.products" },
    media: { source: "business.product_images" },
    ctas: [{ action: "open_nex_chat" }],
    permissions: { viewer_scope: "public", edit_scope: "owner_only", publish_scope: "owner_only" },
    publication_state: "draft",
  };
}

// ---------------------------------------------------------------------------
// ConsoleAdapter · deterministic dry-run
// ---------------------------------------------------------------------------

export class ConsoleAdapter implements SiteGenAdapter {
  readonly name = "console";
  readonly is_dry_run = true;
  async generate(input: SiteGenInput): Promise<SiteGenResult> {
    const spec = buildDeterministicSpec(input);
    console.log(`[nex-site-gen · console · dry-run] business=${input.business.business_id.slice(0, 8)} template=${spec.identity.template} accent=${spec.theme.accent} sections=${spec.sections.length}`);
    return { spec, adapter_name: this.name, is_dry_run: true };
  }
}

// ---------------------------------------------------------------------------
// NexGenEngineAdapter · wired to the NEX-owned local model registry
// ---------------------------------------------------------------------------

// Types kept local so this file compiles cleanly even when the intelligence
// package is refactored. Only the small subset the adapter needs.
export interface EngineRunLike {
  ok: boolean;
  text?: string;
  error?: string;
  modelId?: string | null;
}
export type ModelResolver = () => { id: string; generate: unknown } | null;
export type EngineRunner = (
  model: { id: string; generate: unknown },
  input: { systemPrompt: string; messages: Array<{ role: string; content: string }>; maxTokens?: number; temperature?: number },
) => Promise<EngineRunLike>;

const SITE_SPEC_SYSTEM_PROMPT = `You are the NEX AI Builder. Your ONLY job is to output a JSON document matching the NEX Site Specification v1.
STRICT RULES:
  - Output NOTHING except one JSON object. No prose. No markdown fences. No commentary.
  - Every value MUST be inside the allowed enum · unknown values will be rejected.
  - Allowed template values: ${NEX_SITE_TEMPLATES.join(", ")}
  - Allowed accent values: ${NEX_SITE_ACCENTS.join(", ")}
  - Allowed section types: ${DEFAULT_SECTIONS.join(", ")} (extra types exist but stick to these)
  - Allowed cta actions: open_nex_chat, call_phone, email
  - publication_state must be "draft"
  - Do not include a business_id · NEX injects it
Schema:
{
  "version": 1,
  "identity": { "template": "<template>" },
  "business": { "business_id": "" },
  "theme": { "accent": "<accent>" },
  "sections": [ { "type": "<section>" }, ... ],
  "content": { "hero_headline": "<text>", "hero_subline": "<text>", "cta_label": "<text>" },
  "products": { "source": "business.products" },
  "media": { "source": "business.product_images" },
  "ctas": [ { "action": "open_nex_chat" } ],
  "publication_state": "draft"
}`;

/** Extract a JSON object from noisy model output · returns null if none found. */
function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  // If wrapped in ```json ... ``` fence, strip
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fenceMatch ? fenceMatch[1]!.trim() : trimmed;
  // Find first { and matching } · greedy from last }
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first < 0 || last <= first) return null;
  const candidate = body.slice(first, last + 1);
  try { return JSON.parse(candidate); } catch { return null; }
}

export interface NexGenEngineAdapterOptions {
  /** Returns a model instance or null when nothing is registered. */
  modelResolver?: ModelResolver;
  /** Runs the generation engine · defaults to the production one via dynamic import. */
  runEngine?: EngineRunner;
  /** Adapter to fall back to on any failure (default: ConsoleAdapter). */
  fallback?: SiteGenAdapter;
  /** Cap on JSON parse retries within a single generate call. */
  maxAttempts?: number;
}

export class NexGenEngineAdapter implements SiteGenAdapter {
  readonly name = "nex-gen-engine";
  /** is_dry_run reports the LAST run's status · flips to false only when a
   *  real model call returned a validated spec. Callers should check the
   *  SiteGenResult.is_dry_run for authoritative per-call reporting. */
  is_dry_run = true;

  private modelResolver: ModelResolver;
  private runEngine: EngineRunner | null;
  private fallback: SiteGenAdapter;
  private maxAttempts: number;

  constructor(opts: NexGenEngineAdapterOptions = {}) {
    this.modelResolver = opts.modelResolver ?? (() => null);
    this.runEngine = opts.runEngine ?? null;   // dynamic import path in generate()
    this.fallback = opts.fallback ?? new ConsoleAdapter();
    this.maxAttempts = Math.max(1, Math.min(3, opts.maxAttempts ?? 2));
  }

  async generate(input: SiteGenInput): Promise<SiteGenResult> {
    // 1 · Resolve model. If nothing registered, fall back honestly.
    const model = this.modelResolver();
    if (!model) {
      const { spec } = await this.fallback.generate(input);
      this.is_dry_run = true;
      return { spec, adapter_name: this.name, is_dry_run: true, fallback_reason: "no_model_registered" };
    }

    // 2 · Resolve engine runner (dynamic import so tests can stub cheaply).
    const runner = this.runEngine ?? await defaultRunner();
    if (!runner) {
      const { spec } = await this.fallback.generate(input);
      this.is_dry_run = true;
      return { spec, adapter_name: this.name, is_dry_run: true, fallback_reason: "no_engine_runner" };
    }

    const userMessage = `Business display name: ${input.business.display_name}\n` +
      `Description: ${input.business.description ?? "(none)"}\n` +
      `Prompt: ${input.prompt}\n` +
      `Output the JSON spec now.`;

    let lastError: string | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const result = await runner(model, {
        systemPrompt: SITE_SPEC_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
        maxTokens: 800,
        temperature: attempt === 1 ? 0.2 : 0.35,
      });
      if (!result.ok || !result.text) {
        lastError = `engine_failed_${attempt}: ${result.error ?? "no text"}`;
        continue;
      }
      const parsed = extractJson(result.text);
      if (!parsed) {
        lastError = `json_parse_failed_${attempt}`;
        continue;
      }
      // Inject business_id (adapter always overwrites what the model produced).
      // If the model DID emit a business.category, preserve it — coherence
      // check below uses it. If not, skip the coherence gate (backward compat).
      const parsedBusiness = (parsed as { business?: Record<string, unknown> })?.business ?? {};
      const withBusiness = {
        ...(parsed as Record<string, unknown>),
        business: {
          business_id: input.business.business_id,
          ...(typeof parsedBusiness.category === "string" ? { category: parsedBusiness.category } : {}),
        },
      };
      const check: SpecValidationResult = validateSiteSpec(withBusiness);
      if (check.ok) {
        // Wave 3 · coherence gate for LLM output when Template Intent fields present.
        const s = check.spec;
        if (s.identity.template_id && s.business.category) {
          const coherence = validateSubjectCoherence({
            business_category: s.business.category,
            template_id: s.identity.template_id,
            sections: s.sections.map((sec) => sec.type),
            copy_bag: [
              s.content.hero_headline,
              s.content.hero_subline,
              s.content.cta_label,
              input.business.display_name,
              input.business.description ?? "",
            ].filter((x): x is string => typeof x === "string" && x.length > 0),
          });
          if (!coherence.ok) {
            lastError = `coherence_${coherence.code}_${attempt}`;
            continue;
          }
        }
        this.is_dry_run = false;
        return { spec: check.spec, adapter_name: this.name, is_dry_run: false };
      }
      lastError = `spec_invalid_${attempt}: ${check.code}`;
    }

    // 3 · All attempts failed · honest fallback with deterministic spec.
    const { spec } = await this.fallback.generate(input);
    this.is_dry_run = true;
    return {
      spec,
      adapter_name: this.name,
      is_dry_run: true,
      fallback_reason: lastError ?? "unknown",
    };
  }
}

/** Lazily import the real engine runner. Returns null on any import failure
 *  (e.g. running in an environment without server-only or the intelligence
 *  pipeline) so callers can fall back cleanly. */
async function defaultRunner(): Promise<EngineRunner | null> {
  try {
    const { runGenerationEngine } = await import("./intelligence/generation-engine");
    return async (model, input) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await (runGenerationEngine as any)(model as any, {
        systemPrompt: input.systemPrompt,
        messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      });
      return {
        ok: !!out?.ok,
        text: out?.text,
        error: out?.error,
        modelId: out?.modelId ?? null,
      };
    };
  } catch {
    return null;
  }
}

/** Convenience: builds a NexGenEngineAdapter wired to the real model registry
 *  + real runGenerationEngine. Use setDefaultSiteGenAdapter(makeProductionAdapter())
 *  at boot to activate the local model backend. */
export async function makeProductionAdapter(): Promise<NexGenEngineAdapter> {
  const registry = await import("./intelligence/model-registry");
  const engine = await import("./intelligence/generation-engine");
  return new NexGenEngineAdapter({
    modelResolver: () => (registry.selectModel("default") as unknown as { id: string; generate: unknown } | null),
    runEngine: async (model, input) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await (engine.runGenerationEngine as any)(model as any, {
        systemPrompt: input.systemPrompt,
        messages: input.messages.map((m) => ({ role: m.role as never, content: m.content })),
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      });
      return {
        ok: !!out?.ok,
        text: out?.text,
        error: out?.error,
        modelId: out?.modelId ?? null,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Global adapter · swappable
// ---------------------------------------------------------------------------

export let DEFAULT_SITE_GEN_ADAPTER: SiteGenAdapter = new ConsoleAdapter();

export function setDefaultSiteGenAdapter(adapter: SiteGenAdapter): void {
  DEFAULT_SITE_GEN_ADAPTER = adapter;
}
