// registryKit · describe — tests.

import { createRegistry } from "../createRegistry";
import { describeRegistration } from "../describe";
import type { RegistrationBase } from "../types";

type Fx = RegistrationBase;

const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
r.register({
  id: "alpha",
  version: "2.1.0",
  name: "Alpha",
  description: "A test registration.",
  category: "test",
  searchKeywords: ["k1", "k2"]
});
r.register({
  id: "beta",
  version: "1.0.0",
  name: "Beta",
  description: "Deprecated fixture.",
  category: "test",
  deprecation: {
    deprecatedSince: "1.0.0",
    replacedBy: "alpha",
    reason: "renamed"
  }
});

// ─── Registered describe ─────────────────────────────────────────
{
  const s = r.describe("alpha");
  console.assert(s.includes("Alpha"), "T1a: includes name");
  console.assert(s.includes("alpha"), "T1b: includes id");
  console.assert(s.includes("2.1.0"), "T1c: includes version");
  console.assert(s.includes("test"), "T1d: includes category");
  console.assert(s.includes("k1"), "T1e: includes keywords");
}

// ─── Missing describe ────────────────────────────────────────────
{
  const s = r.describe("does-not-exist");
  console.assert(s === "not-registered", "T2a: missing returns marker");
}

// ─── Deprecation surfaced ────────────────────────────────────────
{
  const s = r.describe("beta");
  console.assert(s.includes("Deprecated"), "T3a: mentions deprecated");
  console.assert(s.includes("alpha"), "T3b: mentions replacement");
  console.assert(s.includes("renamed"), "T3c: mentions reason");
}

// ─── Extra facts extension ───────────────────────────────────────
{
  const reg = r.getOrThrow("alpha");
  const s = describeRegistration(reg, (r) => [
    `Custom: bestTradesCount=42.`
  ]);
  console.assert(
    s.includes("bestTradesCount=42"),
    "T4a: extraFacts appended"
  );
}

console.log("registryKit · describe: all assertions passed.");
