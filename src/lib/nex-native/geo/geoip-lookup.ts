// src/lib/nex-native/geo/geoip-lookup.ts
//
// NEX GeoIP lookup · sealed 2026-10-06 (Phase 1.0 Security).
//
// Approximate city/country lookup for sign-in events + active sessions.
// Self-hosted · uses MaxMind GeoLite2-City.mmdb under the NEX
// infrastructure principle (no third-party IP disclosure). The IP never
// leaves NEX servers.
//
// LICENSE: GeoLite2-City is free for commercial + non-commercial use
// under the MaxMind GeoLite End User License Agreement at
// https://www.maxmind.com/en/geolite/eula. Attribution is required
// where the derived data is displayed to users; see /rights copy.
//
// SETUP (ops · one-time + monthly refresh):
//   1. Create a free MaxMind account at https://www.maxmind.com/en/geolite2/signup
//   2. Generate a license key under Account → Manage License Keys
//   3. Download GeoLite2-City.mmdb (or run `geoipupdate`) and place it at
//      deploy/maxmind/GeoLite2-City.mmdb (gitignored) OR point the
//      NEX_MAXMIND_DB_PATH env var at the file's location.
//   4. Refresh monthly · MaxMind publishes updates twice weekly.
//
// GRACEFUL DEGRADATION:
//   If the .mmdb file is missing OR the lookup throws, we return
//   { city: null, country: null }. The sign-in flow continues · the
//   UI shows "Unknown location" and we never block authentication on
//   a geo-DB outage. This also means the test suite does not require
//   the .mmdb to be present on the machine running the tests.

import * as path from "node:path";
import * as fs from "node:fs";

export interface ApproxLocation {
  city: string | null;
  country: string | null;
  /** True when the lookup actually consulted the GeoLite2 DB · false when
   *  the DB was unavailable OR the IP was not in a looked-up form (e.g.
   *  loopback, private range, or a non-IP string). Lets the caller log
   *  whether the "null" result is a real "not in DB" vs infra absence. */
  resolved: boolean;
}

export const UNKNOWN_LOCATION: ApproxLocation = Object.freeze({
  city: null,
  country: null,
  resolved: false,
});

// Resolve the DB path once at module load. Env var wins; default is
// deploy/maxmind/GeoLite2-City.mmdb relative to the repo root.
function resolveDbPath(): string {
  const fromEnv = process.env.NEX_MAXMIND_DB_PATH;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  return path.resolve(process.cwd(), "deploy/maxmind/GeoLite2-City.mmdb");
}

// Cache the reader instance across calls. maxmind.open() reads the file
// into memory once and performs lookups synchronously via a lookup()
// method. The reader stays alive for the lifetime of the Node process.
let readerPromise: Promise<MaxMindReader | null> | null = null;

interface MaxMindReader {
  get(ip: string): MaxMindCityResponse | null;
}

interface MaxMindCityResponse {
  city?: { names?: { en?: string } };
  country?: { names?: { en?: string }; iso_code?: string };
  // Many more fields exist · we only care about city + country for UI.
}

async function loadReader(): Promise<MaxMindReader | null> {
  const dbPath = resolveDbPath();
  // Check file existence before dynamic-importing maxmind so we fail
  // fast and silently when the DB is not provisioned on this machine.
  try {
    const stat = await fs.promises.stat(dbPath);
    if (!stat.isFile() || stat.size < 1024) return null;
  } catch {
    return null;
  }
  try {
    const mod = await import("maxmind");
    // maxmind v5 exports `open(path)` returning a Reader<T>.
    const reader = await mod.open<MaxMindCityResponse>(dbPath);
    return reader as MaxMindReader;
  } catch (e) {
    // Any failure (bad DB file, incompatible version, OOM) degrades to
    // "no DB available". Logged once at startup so ops notices.
    console.warn(
      `[nex-geo] GeoLite2 reader failed to initialise · lookups will return UNKNOWN_LOCATION · ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  }
}

function getReader(): Promise<MaxMindReader | null> {
  if (!readerPromise) readerPromise = loadReader();
  return readerPromise;
}

/** Reset the cached reader · test-only. The subsequent call to
 *  `lookupApproxLocation` will re-resolve the DB path and re-open the
 *  file. Normal callers should not use this. */
export function _resetGeoReaderForTests(): void {
  readerPromise = null;
}

// Loopback + private ranges we never bother looking up.
const PRIVATE_PATTERNS: readonly RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  for (const re of PRIVATE_PATTERNS) if (re.test(ip)) return true;
  return false;
}

/** Approximate city + country for a public IP · null for private/
 *  loopback/invalid inputs · null for IPs not present in GeoLite2 ·
 *  null when the GeoLite2 DB is not provisioned on this machine. */
export async function lookupApproxLocation(
  ip: string | null | undefined,
): Promise<ApproxLocation> {
  if (!ip) return UNKNOWN_LOCATION;
  const trimmed = ip.trim();
  if (!trimmed) return UNKNOWN_LOCATION;
  if (isPrivateIp(trimmed)) return UNKNOWN_LOCATION;
  const reader = await getReader();
  if (!reader) return UNKNOWN_LOCATION;
  try {
    const row = reader.get(trimmed);
    if (!row) return { city: null, country: null, resolved: true };
    const city = row.city?.names?.en ?? null;
    const country = row.country?.names?.en ?? row.country?.iso_code ?? null;
    return { city, country, resolved: true };
  } catch {
    return UNKNOWN_LOCATION;
  }
}

/** Convert an ApproxLocation to a short display string suitable for
 *  the UI (devices list, activity log). Never leaks the raw IP ·
 *  callers that have the raw IP are responsible for not showing it in
 *  the consumer UI. */
export function formatApproxLocation(loc: ApproxLocation): string {
  if (!loc.resolved) return "Unknown location";
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.country) return loc.country;
  if (loc.city) return loc.city;
  return "Unknown location";
}
