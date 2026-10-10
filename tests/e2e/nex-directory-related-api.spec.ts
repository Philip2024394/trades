// tests/e2e/nex-directory-related-api.spec.ts
//
// NEX Directory · Wave Stabilisation 2026-10-10 · S1 agent.
//
// Scope
//   · HTTP contract regression for the sealed `related` endpoint:
//     `/api/nex-directory/v1/related/[id]`
//   · Does not touch the DB. Does not open a browser context. Uses
//     plain `fetch` so this spec also runs as a tiny API smoke test
//     in CI contexts that disable the browser projects.
//
// Why read the listings endpoint first
//   The seed `canonical_business_id` is picked live from the first
//   row of `/api/nex-directory/v1/listings?country=ID&limit=1&offset=0`
//   so the test survives the continuous ingestion loop replacing /
//   reshuffling the top of the directory.
//
// Pre-flight
//   Skips when the dev server at localhost:3008 is unreachable.

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.NEX_E2E_BASE_URL ?? "http://localhost:3008";

async function serverReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/nex-native/directory`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    return r.status > 0 && r.status < 500;
  } catch {
    return false;
  }
}

test.describe("NEX Directory · wave-stabilisation · /related API", () => {
  test.beforeAll(async () => {
    const alive = await serverReachable();
    test.skip(
      !alive,
      `SKIPPED · dev server not reachable at ${BASE_URL}.`,
    );
  });

  test("happy path · valid canonical id returns ok=true", async () => {
    // Step 1 · pick a live canonical id.
    const listingsRes = await fetch(
      `${BASE_URL}/api/nex-directory/v1/listings?country=ID&limit=1&offset=0`,
      { signal: AbortSignal.timeout(15_000) },
    );
    expect(listingsRes.status, "listings endpoint must 200").toBe(200);
    const listingsJson = (await listingsRes.json()) as {
      ok: boolean;
      systemReady: boolean;
      listings: ReadonlyArray<{ canonicalBusinessId: string }>;
      total: number;
    };
    expect(listingsJson.ok).toBe(true);
    test.skip(
      !listingsJson.systemReady,
      "SKIPPED · listings system not ready.",
    );
    expect(listingsJson.listings.length).toBeGreaterThanOrEqual(1);
    const canonicalId = listingsJson.listings[0]!.canonicalBusinessId;
    expect(canonicalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Step 2 · hit the sealed related endpoint.
    const relatedRes = await fetch(
      `${BASE_URL}/api/nex-directory/v1/related/${canonicalId}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    expect(relatedRes.status).toBe(200);
    const relatedJson = (await relatedRes.json()) as {
      ok: boolean;
      anchor_has_coordinates?: boolean;
      anchor_name?: string;
      groups?: ReadonlyArray<unknown>;
    };
    expect(relatedJson.ok).toBe(true);
    expect(Array.isArray(relatedJson.groups)).toBe(true);
  });

  test("malformed canonical id · HTTP 400 invalid_canonical_id", async () => {
    const res = await fetch(
      `${BASE_URL}/api/nex-directory/v1/related/not-a-uuid`,
      { signal: AbortSignal.timeout(15_000) },
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("invalid_canonical_id");
  });

  test("well-formed-but-absent canonical id · HTTP 404 not_found", async () => {
    const res = await fetch(
      `${BASE_URL}/api/nex-directory/v1/related/00000000-0000-0000-0000-000000000000`,
      { signal: AbortSignal.timeout(15_000) },
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("not_found");
  });
});
