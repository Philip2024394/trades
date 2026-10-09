// src/lib/nex-native/__tests__/directory-v1-api-contract.test.ts
//
// Contract tests for the Directory v1 public API route.
// Pure · exercises the HTTP contract shape via the request handler directly.
// No live DB. The underlying listDirectory() is mocked to confirm the route's
// input validation + response shape invariants independent of DB state.

import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.mock must come before the import of the route module.
vi.mock("@/lib/nex-native/directory/directory-service", () => ({
  listDirectory: vi.fn(),
}));

import { listDirectory } from "@/lib/nex-native/directory/directory-service";
import { GET } from "@/app/api/nex-directory/v1/listings/route";

const mockedListDirectory = listDirectory as unknown as ReturnType<
  typeof vi.fn
>;

async function hit(url: string): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const req = new Request(url, { method: "GET" });
  const res = await GET(req);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

beforeEach(() => {
  mockedListDirectory.mockReset();
});

// ═════════════════════════════════════════════════════════════════════
// §1 · Input validation
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/nex-directory/v1/listings · input validation", () => {
  test("rejects missing country", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings",
    );
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/invalid_country/);
  });

  test("rejects malformed country (contains digits)", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=a1",
    );
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/invalid_country/);
  });

  test("rejects numeric country", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=12",
    );
    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/invalid_country/);
  });

  test("accepts valid country (ID)", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID",
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.country).toBe("ID");
  });

  test("rejects limit > 100", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&limit=200",
    );
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/invalid_limit/);
  });

  test("rejects limit = 0", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&limit=0",
    );
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/invalid_limit/);
  });

  test("rejects negative offset", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&offset=-1",
    );
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/invalid_offset/);
  });

  test("rejects invalid classification", async () => {
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&classification=unknown",
    );
    expect(status).toBe(400);
    expect(String(body.error)).toMatch(/invalid_classification/);
  });

  test("accepts classification=all", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    const { status } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&classification=all",
    );
    expect(status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §2 · Honest empty state (publication gate yields 0)
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/nex-directory/v1/listings · honest empty state", () => {
  test("empty results array when publication view returns 0 rows", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID",
    );
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.listings)).toBe(true);
    expect((body.listings as unknown[]).length).toBe(0);
    expect(body.total).toBe(0);
    // Honest-empty invariant: no fabricated listings, no fallback,
    // no error banner leaking into the public shape.
    expect(body.diagnostic).toBeNull();
  });

  test("empty attributions when listings is empty", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    const { body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID",
    );
    expect(Array.isArray(body.attributions)).toBe(true);
    expect((body.attributions as unknown[]).length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §3 · 503 when DB unreachable
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/nex-directory/v1/listings · DB preparing state", () => {
  test("503 when listDirectory returns systemReady=false", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: false,
      diagnostic: "NEX_POSTGRES_URL not configured",
    });
    const { status, body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID",
    );
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toBe("directory_system_preparing");
    expect(body.diagnostic).toBe("NEX_POSTGRES_URL not configured");
  });
});

// ═════════════════════════════════════════════════════════════════════
// §4 · Response contract shape
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/nex-directory/v1/listings · response shape", () => {
  test("response has ok/country/listings/destinations/attributions/systemReady/diagnostic/total/limit/offset keys", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    const { body } = await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&limit=10&offset=5",
    );
    expect(body).toHaveProperty("ok", true);
    expect(body).toHaveProperty("country", "ID");
    expect(body).toHaveProperty("listings");
    expect(body).toHaveProperty("destinations");
    expect(body).toHaveProperty("attributions");
    expect(body).toHaveProperty("systemReady", true);
    expect(body).toHaveProperty("diagnostic", null);
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("limit", 10);
    expect(body).toHaveProperty("offset", 5);
  });
});

// ═════════════════════════════════════════════════════════════════════
// §5 · Delegates to sealed listDirectory() correctly
// ═════════════════════════════════════════════════════════════════════

describe("GET /api/nex-directory/v1/listings · delegation", () => {
  test("passes query parameters through to listDirectory()", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&q=warung&classification=business&limit=5&offset=10",
    );
    expect(mockedListDirectory).toHaveBeenCalledWith({
      country: "ID",
      q: "warung",
      classification: "business",
      limit: 5,
      offset: 10,
    });
  });

  test("omits q when blank", async () => {
    mockedListDirectory.mockResolvedValueOnce({
      results: [],
      systemReady: true,
      diagnostic: null,
    });
    await hit(
      "http://localhost/api/nex-directory/v1/listings?country=ID&q=%20%20",
    );
    const callArgs = mockedListDirectory.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(callArgs.q).toBeUndefined();
  });
});
