// src/lib/nex/aof/adapters/registry.ts
//
// NEX Autonomous Operations Framework · API Adapter Registry
// Founder-authorised programme · 2026-09-22.
//
// Generalises access to discovery sources. Each adapter implements a
// small deterministic contract (search/probe → parsed elements). The
// registry looks up adapters by source_slug (matching nex.harvest_source
// rows). Agents don't care how a source works internally.

import type { OverpassAdapter } from "@/lib/nex/harvest";
import { ProductionOverpassAdapter, NULL_OVERPASS_ADAPTER } from "@/lib/nex/harvest";
import type { NominatimAdapter } from "./nominatim-adapter";
import { ProductionNominatimAdapter, NULL_NOMINATIM_ADAPTER } from "./nominatim-adapter";
import type { WikidataAdapter } from "./wikidata-adapter";
import { ProductionWikidataAdapter, NULL_WIKIDATA_ADAPTER } from "./wikidata-adapter";

export interface DiscoveryAdapterEntry {
  readonly source_slug: string;
  readonly kind: "overpass" | "nominatim" | "wikidata";
  readonly adapter: OverpassAdapter | NominatimAdapter | WikidataAdapter;
}

export class AdapterRegistry {
  private readonly by_slug: Map<string, DiscoveryAdapterEntry> = new Map();
  register(entry: DiscoveryAdapterEntry): void {
    this.by_slug.set(entry.source_slug, entry);
  }
  get(source_slug: string): DiscoveryAdapterEntry | null {
    return this.by_slug.get(source_slug) ?? null;
  }
  list(): ReadonlyArray<DiscoveryAdapterEntry> {
    return [...this.by_slug.values()];
  }
}

export interface BuildDefaultRegistryInput {
  readonly overpass_allowed_hosts?: ReadonlyArray<string>;
  readonly nominatim_allowed_hosts?: ReadonlyArray<string>;
  readonly wikidata_allowed_hosts?: ReadonlyArray<string>;
  readonly env?: NodeJS.ProcessEnv;
}

// Registers adapters for the known Founder-signed sources currently in
// nex.harvest_source. Returns NULL adapters when allowlist entries are
// absent · they stay dormant but present so the registry surface is
// complete for audit.
//
// Founder authorisation Wave F adds:
//   * wikidata_query_service → ProductionWikidataAdapter
//   * osm_overpass_kumi → reuse ProductionOverpassAdapter (kumi.systems host)
export function buildDefaultDiscoveryRegistry(input: BuildDefaultRegistryInput): AdapterRegistry {
  const reg = new AdapterRegistry();
  const oa = new Set((input.overpass_allowed_hosts ?? []).map(h => h.toLowerCase()));
  const na = new Set((input.nominatim_allowed_hosts ?? []).map(h => h.toLowerCase()));
  const wa = new Set((input.wikidata_allowed_hosts ?? []).map(h => h.toLowerCase()));

  // Overpass mirrors · Wave F adds overpass.kumi.systems
  const overpassHostList = ["overpass.osm.ch", "overpass-api.de", "lz4.overpass-api.de", "overpass.kumi.systems"];
  const overpassHosts = overpassHostList.filter(h => oa.has(h));
  const overpassSlugs = ["osm_overpass_primary", "osm_overpass_swiss_mirror", "osm_overpass_lz4", "osm_overpass_kumi"];
  if (overpassHosts.length > 0) {
    const overpass = new ProductionOverpassAdapter({ allowed_hosts: overpassHosts });
    for (const slug of overpassSlugs) reg.register({ source_slug: slug, kind: "overpass", adapter: overpass });
  } else {
    for (const slug of overpassSlugs) reg.register({ source_slug: slug, kind: "overpass", adapter: NULL_OVERPASS_ADAPTER });
  }

  // Nominatim
  if (na.has("nominatim.openstreetmap.org")) {
    const nom = new ProductionNominatimAdapter({ allowed_hosts: ["nominatim.openstreetmap.org"] });
    reg.register({ source_slug: "nominatim_openstreetmap", kind: "nominatim", adapter: nom });
  } else {
    reg.register({ source_slug: "nominatim_openstreetmap", kind: "nominatim", adapter: NULL_NOMINATIM_ADAPTER });
  }

  // Wikidata Query Service (Wave F)
  if (wa.has("query.wikidata.org")) {
    const wd = new ProductionWikidataAdapter({ allowed_hosts: ["query.wikidata.org"] });
    reg.register({ source_slug: "wikidata_query_service", kind: "wikidata", adapter: wd });
  } else {
    reg.register({ source_slug: "wikidata_query_service", kind: "wikidata", adapter: NULL_WIKIDATA_ADAPTER });
  }
  return reg;
}

export const _REGISTRY_HAS_NULL_ADAPTERS_UNTIL_ALLOWLISTED =
  "registry_returns_NULL_adapter_variants_when_allowed_hosts_missing_never_throws";
