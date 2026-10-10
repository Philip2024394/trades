// src/lib/nex-native/directory/country-counts.ts
//
// NEX Directory · country-counts reader. Server-only.
//
// Derives the picker's country list from the sealed publication view
// nex.business_directory_v (migration 175). The user-facing picker can
// NEVER offer a country with zero listings · the query enforces that by
// construction via GROUP BY on a view that only exposes publishable
// rows.
//
// This file is read-only · it never writes to the database.
//
// Contract (consumed by src/components/nex-native/directory/CountryPicker):
//   { isoAlpha2: string; count: number }[] sorted by count DESC, then
//   alpha2 ASC for stable rendering.
//
// Deliberately NO fallback query against nex.business_canonical. The
// directory-service.ts rule stands: visitor rendering reads the sealed
// view, nothing else.

import "server-only";
import { Client } from "pg";

export interface CountryCount {
  readonly isoAlpha2: string;
  readonly count: number;
}

export interface ListCountryCountsIO {
  readonly connectionString: string;
}

/**
 * Impure · opens a Postgres connection, runs the sealed count query,
 * closes the connection. Returns a stable-ordered array.
 *
 * Why not a pool here? The picker-count query runs once per
 * server-render (or on-demand via a route handler); a short-lived
 * dedicated client avoids coupling into whatever pool configuration
 * the rest of directory-service.ts uses, and the picker is not a hot
 * path.
 */
export async function listCountryCounts(io: ListCountryCountsIO): Promise<readonly CountryCount[]> {
  const client = new Client({ connectionString: io.connectionString });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  try {
    const res = await client.query(
      "SELECT country, COUNT(*)::bigint AS n " +
        "FROM nex.business_directory_v " +
        "GROUP BY country " +
        "ORDER BY n DESC, country ASC",
    );
    return res.rows.map((r) => ({ isoAlpha2: String(r.country), count: Number(r.n) }));
  } finally {
    await client.end();
  }
}

/**
 * Pure · joins the DB counts to the ISO metadata so the picker renders
 * name + region without a second round-trip. Entries whose country code
 * is not present in ISO_COUNTRIES are preserved with name=null so
 * nothing is dropped silently; the picker renders the alpha-2 as the
 * display fallback.
 */
export interface CountryPickerEntry {
  readonly isoAlpha2: string;
  readonly name: string | null;
  readonly region: string | null;
  readonly count: number;
}

export function joinWithIso(
  counts: readonly CountryCount[],
  iso: ReadonlyArray<{ readonly isoAlpha2: string; readonly name: string; readonly region: string }>,
): readonly CountryPickerEntry[] {
  const idx = new Map(iso.map((c) => [c.isoAlpha2, c]));
  return counts.map((c) => {
    const meta = idx.get(c.isoAlpha2);
    return {
      isoAlpha2: c.isoAlpha2,
      name: meta ? meta.name : null,
      region: meta ? meta.region : null,
      count: c.count,
    };
  });
}
