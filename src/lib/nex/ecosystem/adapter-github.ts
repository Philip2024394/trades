// src/lib/nex/ecosystem/adapter-github.ts
//
// UWI · Wave 8.C · GitHub adapter (metadata-only)
// Founder-authorised programme (Rule 5o.T · sequencing discipline per
// `feedback_master_extension_sequencing_discipline.md`).
//
// Proves the `EcosystemAdapter` contract generalises off Hugging Face.
// Same shape · same discipline · different ecosystem.
//
// **METADATA-ONLY.** No repository archive is downloaded here. That is
// the sandbox-extraction path (Wave 8.B `extractZipToSandbox`) which
// callers may compose separately when they want full runtime-purity /
// capability inspection.
//
// **PRODUCTION ALLOWLIST NOT YET AUTHORISED.** Adapter fetching against
// api.github.com uses the injectable fetcher (stdlib fetch by default)
// so that acceptance tests can prove the technical shape works. Adding
// api.github.com to the constitutional internet-gate allowlist for
// permanent runtime use is a Wave 6 M26 HMAC-signed human-authority
// action — kept SEPARATE from adapter-shipping per the founder's
// principle "adapter reaching an ecosystem ≠ constitutional
// authorisation to use it in permanent runtime".

import type {
  EcosystemAdapter,
  EcosystemResource,
  ResourceKindInEcosystem,
} from "./types";

export interface GitHubAdapterConfig {
  readonly api_base: string;
  /** Injectable fetch · production wiring passes guardedFetch when allowlist is authorised. */
  readonly fetcher: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
  readonly now: () => Date;
  /** Optional GitHub personal-access-token · lifts rate limit from 60→5000 req/hr but is
   *  NOT required for adapter operation. Never sent unless explicitly configured. */
  readonly token?: string;
}

export const GITHUB_API_BASE = "https://api.github.com";

export function makeGitHubAdapter(config: Partial<GitHubAdapterConfig> = {}): EcosystemAdapter {
  const cfg: GitHubAdapterConfig = {
    api_base: config.api_base ?? GITHUB_API_BASE,
    fetcher: config.fetcher ?? defaultFetcher(config.token),
    now: config.now ?? (() => new Date()),
    token: config.token,
  };
  return new GitHubAdapter(cfg);
}

function defaultFetcher(token?: string): (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return async (url: string) => {
    const headers: Record<string, string> = {
      "user-agent": "Nex/1.0 (+https://nex.local; unified-research-intelligence)",
      "accept": "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    };
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    return { ok: res.ok, status: res.status, json: async () => await res.json() };
  };
}

/** Extract a declared licence identifier from GitHub metadata if present.
 *  GitHub returns a `license` object with `spdx_id` field (see
 *  https://docs.github.com/en/rest/repos/repos). Exposed as a named
 *  export so orchestrator wiring can call it without reaching into the
 *  class. */
export function extractDeclaredGitHubLicense(metadata: Record<string, unknown>): { spdx: string | null; text: string | null } {
  const lic = metadata["license"];
  if (lic && typeof lic === "object" && lic !== null) {
    const spdx_field = (lic as Record<string, unknown>)["spdx_id"];
    const name_field = (lic as Record<string, unknown>)["name"];
    const spdx = typeof spdx_field === "string" && spdx_field !== "NOASSERTION" ? spdx_field : null;
    const text = typeof name_field === "string" ? name_field : null;
    return { spdx, text };
  }
  return { spdx: null, text: null };
}

class GitHubAdapter implements EcosystemAdapter {
  readonly ecosystem = "github" as const;
  constructor(private readonly cfg: GitHubAdapterConfig) {}

  async fetchMetadata(id: string): Promise<EcosystemResource | null> {
    // GitHub id format: "{owner}/{name}" for repositories
    // Try repositories endpoint first · gists / releases handled by listResources
    const url = `${this.cfg.api_base}/repos/${encodeURIComponent(id).replace(/%2F/g, "/")}`;
    const res = await this.cfg.fetcher(url);
    if (!res.ok) return null;
    let json: any;
    try { json = await res.json(); } catch { return null; }
    if (!json || typeof json !== "object") return null;
    return {
      ecosystem: this.ecosystem,
      resource_kind: "repository",
      id,
      source_url: url,
      metadata: json,
      fetched_at_iso: this.cfg.now().toISOString(),
    };
  }

  async listResources(input: {
    resource_kind: ResourceKindInEcosystem;
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReadonlyArray<EcosystemResource>> {
    if (input.resource_kind !== "repository") return [];
    const url = new URL(`${this.cfg.api_base}/search/repositories`);
    if (input.query) url.searchParams.set("q", input.query);
    url.searchParams.set("per_page", String(Math.min(input.limit ?? 10, 100)));
    if (input.offset) {
      // GitHub search uses page (1-indexed) · convert offset to page
      const per_page = Math.min(input.limit ?? 10, 100);
      url.searchParams.set("page", String(Math.floor(input.offset / per_page) + 1));
    }
    url.searchParams.set("sort", "stars");

    const res = await this.cfg.fetcher(url.toString());
    if (!res.ok) return [];
    let json: any;
    try { json = await res.json(); } catch { return []; }
    const items = json?.items;
    if (!Array.isArray(items)) return [];
    const now_iso = this.cfg.now().toISOString();
    return items.map((entry: any) => ({
      ecosystem: this.ecosystem,
      resource_kind: "repository" as ResourceKindInEcosystem,
      id: String(entry?.full_name ?? ""),
      source_url: `${this.cfg.api_base}/repos/${String(entry?.full_name ?? "")}`,
      metadata: entry ?? {},
      fetched_at_iso: now_iso,
    })).filter(r => r.id.length > 0);
  }
}
