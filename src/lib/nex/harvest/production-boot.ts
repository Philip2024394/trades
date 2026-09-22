// src/lib/nex/harvest/production-boot.ts
//
// NEX 24/7 World Harvest Engine · Production Boot Glue
// Founder-authorised · scope-locked wire-in only · 2026-09-22.
//
// The single place that constructs production adapters for the H5
// controller. Reads the Founder-signed allowlist file · returns either
// production adapters (when NEX_PAGE_FETCHER_ACTIVATION === "on") or
// null_defaults (module NULLs will apply at the controller).
//
// This is COMPOSITION · NOT NEW ARCHITECTURE. Only the cron endpoint
// (and, in tests, this helper directly) constructs production adapters.
//
// GOVERNANCE HARD-LOCKS:
//   * Adapter construction is gated on NEX_PAGE_FETCHER_ACTIVATION === "on"
//   * Allowed hosts come from `data/nex-page-fetcher-allowlist.json` only
//   * File must carry `signed_by: "founder"` and non-empty `allowed_hosts`
//   * Never throws · unreadable/malformed file → null_defaults with reason
//   * NULL_OVERPASS_ADAPTER + NULL_FETCHER remain module defaults everywhere

import { promises as fs } from "node:fs";
import path from "node:path";
import type { OverpassAdapter } from "./overpass-adapter";
import type { PageFetcher } from "@/lib/nex/discovery-world";
import { ProductionOverpassAdapter } from "./production-overpass-adapter";
import { ProductionPageFetcher, type AllowlistFile } from "@/lib/nex/discovery-world";

export interface ProductionBootDeps {
  readonly env: NodeJS.ProcessEnv;
  readonly allowlist_path?: string;
  readonly read_file?: (p: string) => Promise<string>;
}

export interface ResolvedProductionAdapters {
  readonly source: "production" | "null_defaults";
  readonly reason: string;
  readonly allowlist_path_resolved: string;
  readonly overpass_adapter?: OverpassAdapter;
  readonly page_fetcher?: PageFetcher;
}

const DEFAULT_ALLOWLIST_REL_PATH = "data/nex-page-fetcher-allowlist.json";

export async function resolveProductionHarvestAdapters(
  deps: ProductionBootDeps,
): Promise<ResolvedProductionAdapters> {
  const allowlist_path_resolved = path.resolve(
    deps.allowlist_path ?? path.join(process.cwd(), DEFAULT_ALLOWLIST_REL_PATH),
  );

  if (deps.env.NEX_PAGE_FETCHER_ACTIVATION !== "on") {
    return {
      source: "null_defaults",
      reason: "NEX_PAGE_FETCHER_ACTIVATION not equal 'on' · production adapters not constructed",
      allowlist_path_resolved,
    };
  }

  let text: string;
  try {
    text = deps.read_file
      ? await deps.read_file(allowlist_path_resolved)
      : await fs.readFile(allowlist_path_resolved, "utf8");
  } catch (e) {
    return {
      source: "null_defaults",
      reason: `allowlist file unreadable · ${(e as Error).message}`,
      allowlist_path_resolved,
    };
  }

  let allowlist: AllowlistFile;
  try {
    allowlist = JSON.parse(text) as AllowlistFile;
  } catch (e) {
    return {
      source: "null_defaults",
      reason: `allowlist file invalid JSON · ${(e as Error).message}`,
      allowlist_path_resolved,
    };
  }

  if (!allowlist || allowlist.signed_by !== "founder" || !allowlist.signed_at) {
    return {
      source: "null_defaults",
      reason: "allowlist file missing Founder signature",
      allowlist_path_resolved,
    };
  }
  if (!Array.isArray(allowlist.allowed_hosts) || allowlist.allowed_hosts.length === 0) {
    return {
      source: "null_defaults",
      reason: "allowlist file has empty allowed_hosts",
      allowlist_path_resolved,
    };
  }

  const hosts = allowlist.allowed_hosts.map(h => h.host);
  const overpass_adapter: OverpassAdapter = new ProductionOverpassAdapter({
    allowed_hosts: hosts,
  });
  const page_fetcher: PageFetcher = new ProductionPageFetcher({
    allowlist,
    env: deps.env,
  });

  return {
    source: "production",
    reason: `production adapters constructed · ${hosts.length} Founder-signed host(s)`,
    allowlist_path_resolved,
    overpass_adapter,
    page_fetcher,
  };
}

// ─── Structural boundary markers ────────────────────────────────────
export const _PRODUCTION_BOOT_GATED_BY_ACTIVATION_ENV =
  "resolveProductionHarvestAdapters_returns_null_defaults_when_NEX_PAGE_FETCHER_ACTIVATION_is_not_on";
export const _PRODUCTION_BOOT_HOSTS_FROM_FOUNDER_SIGNED_ALLOWLIST =
  "allowed_hosts_come_from_founder_signed_allowlist_file_only_never_hardcoded_never_env_var";
export const _PRODUCTION_BOOT_NEVER_THROWS =
  "unreadable_or_malformed_or_unsigned_allowlist_returns_null_defaults_with_reason_never_throws";
export const _PRODUCTION_BOOT_IS_THE_ONLY_PRODUCTION_CONSTRUCTOR =
  "outside_of_tests_only_this_file_constructs_ProductionOverpassAdapter_and_ProductionPageFetcher_for_the_harvest_controller";
