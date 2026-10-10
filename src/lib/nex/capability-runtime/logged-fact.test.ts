// src/lib/nex/capability-runtime/logged-fact.test.ts
//
// Stage 5 acceptance tests · LoggedFact + DurableProvenanceRef validation.
// §19 discipline · allow AND correct-refusal cases for every rule.

import { describe, it, expect } from "vitest";
import {
  validateProvenanceRef,
  validateLoggedFact,
  loggedFactFromRows,
  loggedFactFromQuery,
  type LoggedFact,
  type DurableProvenanceRef,
} from "./logged-fact";

const iso = "2026-09-23T08:40:00.000Z";

const rowProv: DurableProvenanceRef = {
  kind: "durable_row",
  store: "nex.aof_agent_event",
  row_ids: ["12345", "12346"],
  recorded_at: iso,
};

const queryProv: DurableProvenanceRef = {
  kind: "durable_query",
  store: "nex.harvest_business_candidate",
  query_signature: "count-by-country:GB",
  recorded_at: iso,
};

describe("validateProvenanceRef · allow-behaviour", () => {
  it("accepts well-formed durable_row provenance", () => {
    const r = validateProvenanceRef(rowProv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("durable_row");
  });

  it("accepts well-formed durable_query provenance", () => {
    const r = validateProvenanceRef(queryProv);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.kind).toBe("durable_query");
  });

  it("accepts a single-row durable_row provenance", () => {
    const r = validateProvenanceRef({ ...rowProv, row_ids: ["42"] });
    expect(r.ok).toBe(true);
  });
});

describe("validateProvenanceRef · correct-refusal", () => {
  it("rejects non-object", () => {
    for (const bad of [null, undefined, "s", 42, [], true]) {
      expect(validateProvenanceRef(bad).ok).toBe(false);
    }
  });

  it("rejects empty store", () => {
    const r = validateProvenanceRef({ ...rowProv, store: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("store");
  });

  it("rejects unknown kind", () => {
    const r = validateProvenanceRef({ ...rowProv, kind: "cache" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("kind");
  });

  it("rejects durable_row with empty row_ids (anti-fabrication)", () => {
    const r = validateProvenanceRef({ ...rowProv, row_ids: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("row_ids");
  });

  it("rejects durable_row with non-string row_ids", () => {
    const r = validateProvenanceRef({ ...rowProv, row_ids: [42, ""] as unknown[] });
    expect(r.ok).toBe(false);
  });

  it("rejects durable_query without query_signature", () => {
    const r = validateProvenanceRef({ ...queryProv, query_signature: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("query_signature");
  });

  it("rejects non-ISO recorded_at", () => {
    for (const ts of ["yesterday", "2026-09-23", ""]) {
      const r = validateProvenanceRef({ ...rowProv, recorded_at: ts });
      expect(r.ok).toBe(false);
    }
  });
});

describe("validateLoggedFact · allow-behaviour", () => {
  it("accepts a well-formed LoggedFact carrying durable_row provenance", () => {
    const fact: LoggedFact<{ count: number }> = {
      value: { count: 5 },
      provenance: rowProv,
      recorded_at: iso,
    };
    const r = validateLoggedFact<{ count: number }>(fact);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.value.count).toBe(5);
  });

  it("accepts a LoggedFact carrying durable_query provenance", () => {
    const fact: LoggedFact<string> = {
      value: "aggregate-result",
      provenance: queryProv,
      recorded_at: iso,
    };
    expect(validateLoggedFact<string>(fact).ok).toBe(true);
  });

  it("accepts null value (some facts genuinely have null as the answer)", () => {
    const fact: LoggedFact<null> = {
      value: null,
      provenance: rowProv,
      recorded_at: iso,
    };
    expect(validateLoggedFact<null>(fact).ok).toBe(true);
  });
});

describe("validateLoggedFact · correct-refusal (§19)", () => {
  it("rejects non-object", () => {
    for (const bad of [null, undefined, "s", 42, [], true]) {
      expect(validateLoggedFact(bad).ok).toBe(false);
    }
  });

  it("rejects fact without value key", () => {
    const bad = { provenance: rowProv, recorded_at: iso };
    const r = validateLoggedFact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("value");
  });

  it("rejects fact without provenance (§ core doctrine · no fact flows without provenance)", () => {
    const bad = { value: 1, recorded_at: iso };
    const r = validateLoggedFact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("provenance");
  });

  it("rejects fact whose provenance is malformed (empty store)", () => {
    const bad = {
      value: 1,
      provenance: { ...rowProv, store: "" },
      recorded_at: iso,
    };
    const r = validateLoggedFact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("provenance:");
  });

  it("rejects fact whose provenance has empty row_ids", () => {
    const bad = {
      value: [],
      provenance: { ...rowProv, row_ids: [] },
      recorded_at: iso,
    };
    const r = validateLoggedFact(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("row_ids");
  });

  it("rejects fact with non-ISO recorded_at", () => {
    const bad = { value: 1, provenance: rowProv, recorded_at: "yesterday" };
    expect(validateLoggedFact(bad).ok).toBe(false);
  });
});

describe("loggedFactFromRows constructor", () => {
  it("builds a durable_row LoggedFact from row_ids", () => {
    const f = loggedFactFromRows({
      value: { total: 3 },
      store: "nex.harvest_business_candidate",
      row_ids: ["a", "b", "c"],
      recorded_at: iso,
    });
    expect(f.value).toEqual({ total: 3 });
    expect(f.provenance.kind).toBe("durable_row");
    expect(f.provenance.store).toBe("nex.harvest_business_candidate");
    if (f.provenance.kind === "durable_row") {
      expect(f.provenance.row_ids).toEqual(["a", "b", "c"]);
    }
    expect(validateLoggedFact(f).ok).toBe(true);
  });

  it("uses current time when recorded_at omitted", () => {
    const f = loggedFactFromRows({
      value: 1,
      store: "nex.aof_agent_event",
      row_ids: ["1"],
    });
    expect(f.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("loggedFactFromQuery constructor", () => {
  it("builds a durable_query LoggedFact from query signature", () => {
    const f = loggedFactFromQuery({
      value: 42,
      store: "nex.aof_cycle",
      query_signature: "count-cycles-last-24h",
      recorded_at: iso,
    });
    expect(f.value).toBe(42);
    expect(f.provenance.kind).toBe("durable_query");
    if (f.provenance.kind === "durable_query") {
      expect(f.provenance.query_signature).toBe("count-cycles-last-24h");
    }
    expect(validateLoggedFact(f).ok).toBe(true);
  });
});

describe("Stage 5 doctrine invariants (compile-time + surface checks)", () => {
  it("logged-fact module exports NO update/delete/mutate helpers", async () => {
    const mod = await import("./logged-fact");
    for (const key of Object.keys(mod)) {
      expect(key.toLowerCase()).not.toMatch(/^(update|delete|remove|mutate|patch|store|persist|write)/);
    }
  });

  it("logged-fact module does NOT import a store/writer module", async () => {
    // Read source text and assert no writer-side imports appear.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/capability-runtime/logged-fact.ts"),
      "utf8",
    );
    // Must not import from any authoritative writer path.
    expect(src).not.toMatch(/from ["'].*aof\/lifecycle["']/);
    expect(src).not.toMatch(/from ["'].*aof\/cycle["']/);
    expect(src).not.toMatch(/from ["'].*harvest\/queue["']/);
    expect(src).not.toMatch(/from ["'].*discovery-world\/business-evidence["']/);
    // Doctrine reasserted at source level.
  });

  it("LoggedFact type is fully readonly at compile time (spot check via runtime)", () => {
    const f = loggedFactFromRows({
      value: { a: 1 },
      store: "nex.aof_agent_event",
      row_ids: ["1"],
      recorded_at: iso,
    });
    // Runtime spot: object is a plain literal, not a proxy or setter-carrying class.
    expect(Object.getPrototypeOf(f)).toBe(Object.prototype);
  });
});
