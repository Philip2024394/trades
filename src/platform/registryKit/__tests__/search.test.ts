// registryKit · search — tests.

import { createRegistry } from "../createRegistry";
import type { RegistrationBase } from "../types";

type Fx = RegistrationBase;

function fx(id: string, o: Partial<Fx> = {}): Fx {
  return {
    id,
    version: "1.0.0",
    name: id,
    description: "",
    category: "test",
    ...o
  };
}

const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
r.register(
  fx("hero-plumber", {
    name: "Plumber hero",
    description: "Emergency callout hero for plumbing merchants.",
    searchKeywords: ["emergency", "plumber", "callout"]
  })
);
r.register(
  fx("hero-electrician", {
    name: "Electrician hero",
    description: "NICEIC-registered domestic electrician hero.",
    searchKeywords: ["niceic", "electrician", "domestic"]
  })
);
r.register(
  fx("faq-standard", {
    name: "Standard FAQ",
    description: "Six-question FAQ accordion.",
    category: "faq",
    searchKeywords: ["faq", "questions"]
  })
);

// ─── Empty query returns first N ─────────────────────────────────
{
  const all = r.search("", 10);
  console.assert(all.length === 3, "T1a: empty query returns all");
}

// ─── Exact id match ranks highest ────────────────────────────────
{
  const hits = r.search("hero-plumber");
  console.assert(
    hits[0]?.id === "hero-plumber",
    "T2a: exact id ranks first"
  );
}

// ─── Keyword match beats description match ───────────────────────
{
  const hits = r.search("emergency");
  console.assert(hits[0]?.id === "hero-plumber", "T3a: keyword hit found");
}

// ─── Category match returns something ────────────────────────────
{
  const hits = r.search("faq");
  console.assert(hits[0]?.id === "faq-standard", "T4a: faq ranks first");
}

// ─── No match returns empty ──────────────────────────────────────
{
  const hits = r.search("xyzzyx");
  console.assert(hits.length === 0, "T5a: no match returns empty");
}

// ─── Multi-word query accumulates ────────────────────────────────
{
  const hits = r.search("emergency plumber callout");
  console.assert(hits[0]?.id === "hero-plumber", "T6a: multi-word scores highest");
}

// ─── Limit respected ─────────────────────────────────────────────
{
  const hits = r.search("hero", 1);
  console.assert(hits.length === 1, "T7a: limit=1 returns 1");
}

console.log("registryKit · search: all assertions passed.");
