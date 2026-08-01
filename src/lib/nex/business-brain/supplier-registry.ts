// Business Brain · Supplier Registry (Philip 2026-08-02)
//
// The Supplier Preparation Workflow lives in Business Brain, NOT Staircase Brain
// (Philip 2026-08-02 architecture rule · verbatim: "This should NOT live inside
// Staircase Brain. Correct separation: Staircase Brain → Customer Understanding
// → Business Brain → Supplier Workflow").
//
// Storage: `data/nex-suppliers.json` (git-tracked source of truth · admin CRUD
// endpoint is a follow-up). Match layer takes an enquiry's requirements and
// returns candidate suppliers filtered by country + trade + capabilities.

import "server-only";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const REGISTRY_PATH = "data/nex-suppliers.json";

// Philip 2026-08-02 · Supplier Memory v1.
// Supabase (nex_suppliers) is the PRIMARY source. JSON registry remains as
// read-only fallback for one release cycle. If Supabase is unavailable /
// unseeded, the JSON reader takes over so the workflow never fails open.
//
// Cache holds whichever source was authoritative for this fetch cycle · a
// short TTL keeps the read path fast without pinning stale data.
let supabaseAvailable: boolean | null = null;   // null = not yet probed

export type SupplierPriority = "primary" | "partner" | "listed";

export type SupplierRecord = {
  supplier_id:      string;
  name:             string;
  trade:            string[];           // e.g. ["staircase_manufacturer", "staircase_designer"]
  countries:        string[];           // ISO-ish country codes matching AdvisorState.user_country
  capabilities:     string[];           // staircase types + materials + services the supplier handles
  notes?:           string;             // internal note · not sent to customer
  handoff_message:  string;             // customer-facing line rendered at Step 4 · "I'll pass this to..."
  active:           boolean;
  priority:         SupplierPriority;

  // Philip 2026-08-02 · Step 5 trust rule · never surface unverified suppliers in the handoff.
  // Unverified suppliers may be LISTED in the registry (for internal tracking) but the matching
  // layer excludes them from customer-facing results. Defaults to false when not explicitly set.
  verified?:        boolean;
};

export type SupplierRegistry = {
  version:            number;
  updated_at:         string;
  suppliers:          SupplierRecord[];
  generic_fallbacks:  Record<string, string>;  // country → fallback message when no partnered supplier
};

let cached: { registry: SupplierRegistry; loadedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute · registry rarely changes at runtime

function registryPath(): string {
  return join(process.cwd(), REGISTRY_PATH);
}

function loadRegistry(): SupplierRegistry {
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) return cached.registry;

  const path = registryPath();
  if (!existsSync(path)) {
    const empty: SupplierRegistry = {
      version: 1,
      updated_at: new Date().toISOString(),
      suppliers: [],
      generic_fallbacks: {},
    };
    cached = { registry: empty, loadedAt: now };
    return empty;
  }

  try {
    const raw = readFileSync(path, "utf8");
    const registry = JSON.parse(raw) as SupplierRegistry;
    cached = { registry, loadedAt: now };
    return registry;
  } catch {
    const empty: SupplierRegistry = {
      version: 1,
      updated_at: new Date().toISOString(),
      suppliers: [],
      generic_fallbacks: {},
    };
    cached = { registry: empty, loadedAt: now };
    return empty;
  }
}

// ─── Supabase primary read path (Philip 2026-08-02) ─────────────────
//
// listSuppliersFromSupabase() attempts the Supabase source first · falls back
// to JSON on any failure. supabaseAvailable is memoized per process so we
// don't probe the database on every read after a first success/failure.
async function listSuppliersFromSupabase(): Promise<SupplierRecord[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("nex_suppliers")
      .select("supplier_id,name,trade,countries,capabilities,handoff_message,notes,active,verified,priority")
      .eq("active", true);
    if (error) {
      // Likely: migration not applied yet · table doesn't exist. Silently
      // fall back to JSON. Only log once per process to avoid noise.
      if (supabaseAvailable !== false) {
        // eslint-disable-next-line no-console
        console.warn("[nex-suppliers] Supabase unavailable · falling back to JSON registry (", error.message, ")");
      }
      supabaseAvailable = false;
      return null;
    }
    supabaseAvailable = true;
    return (data ?? []).map((row) => ({
      supplier_id:     row.supplier_id,
      name:            row.name,
      trade:           row.trade ?? [],
      countries:       row.countries ?? [],
      capabilities:    row.capabilities ?? [],
      handoff_message: row.handoff_message ?? "",
      notes:           row.notes ?? undefined,
      active:          row.active,
      verified:        row.verified === true,
      priority:        (["primary","partner","listed"] as const).includes(row.priority) ? row.priority : "listed",
    })) as SupplierRecord[];
  } catch (err) {
    if (supabaseAvailable !== false) {
      // eslint-disable-next-line no-console
      console.warn("[nex-suppliers] Supabase read threw · falling back to JSON registry (", (err as Error).message, ")");
    }
    supabaseAvailable = false;
    return null;
  }
}

// Synchronous cache · updated in the background by listSuppliers()'s Supabase
// fetch. First call in a process returns from JSON while the Supabase probe
// warms up · every subsequent call has the latest Supabase snapshot.
let supabaseCache: { list: SupplierRecord[]; loadedAt: number } | null = null;

export function listSuppliers(): SupplierRecord[] {
  const now = Date.now();

  // Serve from warm Supabase cache when fresh
  if (supabaseCache && now - supabaseCache.loadedAt < CACHE_TTL_MS) {
    return supabaseCache.list;
  }

  // Kick off Supabase refresh in background · never await (workflow is sync)
  // Result populates supabaseCache for next call.
  void (async () => {
    const rows = await listSuppliersFromSupabase();
    if (rows) supabaseCache = { list: rows, loadedAt: Date.now() };
  })();

  // Return warm cache even if slightly stale · or fall back to JSON on cold start
  if (supabaseCache) return supabaseCache.list;
  return loadRegistry().suppliers.filter((s) => s.active);
}

/** Suppliers safe to surface in a customer-facing handoff (active AND verified). */
export function listVerifiedSuppliers(): SupplierRecord[] {
  return listSuppliers().filter((s) => s.verified === true);
}

export function getFallbackMessage(country: string | undefined): string | null {
  if (!country) return null;
  return loadRegistry().generic_fallbacks[country] ?? null;
}

// ─── Matching ─────────────────────────────────────────────────────

export type SupplierMatchQuery = {
  country?:         string;                    // e.g. "UK" · "IE" · "US" (from Regional Language Layer)
  staircase_type?:  string;                    // e.g. "straight_flight" · "spiral"
  materials?:       string[];                  // e.g. ["oak", "glass_balustrade"]
  trades_required?: string[];                  // default ["staircase_manufacturer"]
};

export type SupplierMatch = {
  supplier:            SupplierRecord;
  score:               number;
  matched_capabilities: string[];
  matched_country:     boolean;
};

/**
 * Match a customer enquiry against active suppliers.
 * Returns candidates sorted by score DESC · country match required unless
 * no supplier serves that country (in which case we return empty and the
 * caller can fall back to `getFallbackMessage()`).
 */
export function matchSuppliers(query: SupplierMatchQuery, limit = 3): SupplierMatch[] {
  // Philip 2026-08-02 · Step 5 trust rule · handoff only surfaces VERIFIED suppliers.
  const suppliers = listVerifiedSuppliers();
  const trades = query.trades_required && query.trades_required.length > 0
    ? query.trades_required
    : ["staircase_manufacturer"];

  const matches: SupplierMatch[] = [];
  for (const s of suppliers) {
    const matched_country = !query.country || s.countries.includes(query.country);
    if (!matched_country) continue;

    const tradeOverlap = trades.some((t) => s.trade.includes(t));
    if (!tradeOverlap) continue;

    let score = 0;
    const matched_capabilities: string[] = [];

    if (query.staircase_type && s.capabilities.includes(query.staircase_type)) {
      score += 3; matched_capabilities.push(query.staircase_type);
    }
    if (query.materials) {
      for (const m of query.materials) {
        if (s.capabilities.includes(m)) { score += 2; matched_capabilities.push(m); }
      }
    }

    // Priority tie-breaker
    if (s.priority === "primary") score += 5;
    else if (s.priority === "partner") score += 2;

    matches.push({ supplier: s, score, matched_capabilities, matched_country });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
