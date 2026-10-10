// src/lib/nex/ecosystem/adapter-hugging-face.ts
//
// UWI · Wave 8.A · Hugging Face adapter (metadata-only)
// Founder-authorised programme (Rule 5o.B + 5o.R).
//
// **METADATA-ONLY** per Rule 5o.R: NEX does not download models, dataset
// files, or spaces contents in Wave 8.A. This adapter fetches PUBLIC API
// metadata only and passes it to the repository-audit-orchestrator for
// judgement.
//
// Uses the Hugging Face public API:
//   https://huggingface.co/api/models/{id}
//   https://huggingface.co/api/datasets/{id}
//   https://huggingface.co/api/spaces/{id}
//   https://huggingface.co/api/models?search=<query>&limit=<n>&full=<bool>
//
// All fetches go through Wave 3's discovery layer conceptually (robots
// gate + politeness). For Wave 8.A we accept an injectable `fetcher` so
// production wire will pass `guardedFetch`; tests pass a mock.

import type {
  EcosystemAdapter,
  EcosystemResource,
  ResourceKindInEcosystem,
} from "./types";

export interface HuggingFaceAdapterConfig {
  readonly api_base: string;
  /** Injectable fetch · production wiring passes guardedFetch. */
  readonly fetcher: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
  /** Injectable now-fn for deterministic tests. */
  readonly now: () => Date;
}

export const HUGGING_FACE_API_BASE = "https://huggingface.co/api";

export function makeHuggingFaceAdapter(config: Partial<HuggingFaceAdapterConfig> = {}): EcosystemAdapter {
  const cfg: HuggingFaceAdapterConfig = {
    api_base: config.api_base ?? HUGGING_FACE_API_BASE,
    fetcher: config.fetcher ?? defaultFetcher,
    now: config.now ?? (() => new Date()),
  };
  return new HuggingFaceAdapter(cfg);
}

async function defaultFetcher(url: string): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  // Wave 8.A note: production wiring should route this through
  // `guardedFetch` from `src/lib/nex-agent/code-engine/capability-production-internet-gate.ts`
  // so the constitutional gate + host allowlist + audit trail all fire.
  // For Wave 8.A tests we accept the built-in fetch (Node 22 stdlib).
  const res = await fetch(url, {
    method: "GET",
    headers: { "user-agent": "Nex/1.0 (+https://nex.local; unified-research-intelligence)", "accept": "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.ok, status: res.status, json: async () => await res.json() };
}

/** Extract a declared licence identifier from HF metadata if present.
 *  Exposed as a named export so orchestrator wiring can call it without
 *  reaching into the class. */
export function extractDeclaredLicense(metadata: Record<string, unknown>): { spdx: string | null; text: string | null } {
  const cd_a = metadata["cardData"] as Record<string, unknown> | undefined;
  const cd_b = metadata["card_data"] as Record<string, unknown> | undefined;
  const from_card_a = cd_a && typeof cd_a["license"] === "string" ? cd_a["license"] as string : null;
  const from_card_b = cd_b && typeof cd_b["license"] === "string" ? cd_b["license"] as string : null;
  const from_top = typeof metadata["license"] === "string" ? metadata["license"] as string : null;
  const raw = from_card_a ?? from_card_b ?? from_top ?? null;
  if (raw) {
    const norm = raw.trim().toLowerCase();
    const spdx = norm === "mit" ? "MIT"
               : norm === "apache-2.0" ? "Apache-2.0"
               : norm === "bsd-3-clause" ? "BSD-3-Clause"
               : norm === "bsd-2-clause" ? "BSD-2-Clause"
               : norm === "cc0-1.0" ? "CC0-1.0"
               : norm.startsWith("gpl-3") ? "GPL-3.0"
               : norm.startsWith("agpl") ? "AGPL-3.0"
               : norm.startsWith("lgpl") ? "LGPL-3.0"
               : norm.startsWith("mpl") ? "MPL-2.0"
               : null;
    return { spdx, text: raw };
  }
  return { spdx: null, text: null };
}

class HuggingFaceAdapter implements EcosystemAdapter {
  readonly ecosystem = "hugging_face" as const;
  constructor(private readonly cfg: HuggingFaceAdapterConfig) {}

  async fetchMetadata(id: string): Promise<EcosystemResource | null> {
    // HF id format: "{owner}/{name}" for models/datasets/spaces
    // Try each resource-kind endpoint · first success wins
    for (const [kind, path] of [
      ["model", "models"],
      ["dataset", "datasets"],
      ["space", "spaces"],
    ] as ReadonlyArray<[ResourceKindInEcosystem, string]>) {
      const url = `${this.cfg.api_base}/${path}/${encodeURIComponent(id).replace(/%2F/g, "/")}`;
      const res = await this.cfg.fetcher(url);
      if (!res.ok) continue;
      let json: any;
      try { json = await res.json(); } catch { continue; }
      return {
        ecosystem: this.ecosystem,
        resource_kind: kind,
        id,
        source_url: url,
        metadata: json ?? {},
        fetched_at_iso: this.cfg.now().toISOString(),
      };
    }
    return null;
  }

  async listResources(input: {
    resource_kind: ResourceKindInEcosystem;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadonlyArray<EcosystemResource>> {
    if (!["model", "dataset", "space"].includes(input.resource_kind)) return [];
    const path = input.resource_kind === "model" ? "models"
              : input.resource_kind === "dataset" ? "datasets"
              : "spaces";
    const url = new URL(`${this.cfg.api_base}/${path}`);
    if (input.query) url.searchParams.set("search", input.query);
    if (input.limit) url.searchParams.set("limit", String(input.limit));
    if (input.offset) url.searchParams.set("skip", String(input.offset));
    // NOTE: `full=false` avoids downloading everything. Metadata-only Wave 8.A discipline.
    url.searchParams.set("full", "false");

    const res = await this.cfg.fetcher(url.toString());
    if (!res.ok) return [];
    let json: any;
    try { json = await res.json(); } catch { return []; }
    if (!Array.isArray(json)) return [];
    const now_iso = this.cfg.now().toISOString();
    return json.map((entry: any) => ({
      ecosystem: this.ecosystem,
      resource_kind: input.resource_kind,
      id: String(entry?.id ?? entry?._id ?? entry?.modelId ?? entry?.name ?? ""),
      source_url: `${this.cfg.api_base}/${path}/${String(entry?.id ?? entry?._id ?? "")}`,
      metadata: entry ?? {},
      fetched_at_iso: now_iso,
    })).filter(r => r.id.length > 0);
  }

  /** @deprecated · use the named export `extractDeclaredLicense`. Kept for backcompat. */
  static extractDeclaredLicense = extractDeclaredLicense;
}
