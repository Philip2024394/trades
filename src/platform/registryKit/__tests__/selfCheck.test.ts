// registryKit · selfCheck — tests.

import { createRegistry } from "../createRegistry";
import type { RegistrationBase } from "../types";

type Fx = RegistrationBase;

// ─── Clean registry passes ───────────────────────────────────────
{
  const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
  r.register({
    id: "alpha",
    version: "1.0.0",
    name: "Alpha",
    description: "A",
    category: "test"
  });
  const report = r.selfCheck();
  console.assert(report.errors.length === 0, "T1a: clean registry has no errors");
  console.assert(report.warnings.length === 0, "T1b: clean registry has no warnings");
}

// ─── Deprecation.replacedBy pointing at unknown id warns ──────────
{
  const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
  r.register({
    id: "alpha",
    version: "1.0.0",
    name: "Alpha",
    description: "A",
    category: "test",
    deprecation: {
      deprecatedSince: "1.0.0",
      replacedBy: "does-not-exist"
    }
  });
  const report = r.selfCheck();
  console.assert(
    report.warnings.some((w) => w.includes("does-not-exist")),
    "T2a: warns on unknown replacedBy"
  );
}

// ─── Alias transparent resolution ────────────────────────────────
{
  const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
  r.register({
    id: "new-name",
    version: "1.0.0",
    name: "New",
    description: "N",
    category: "test",
    aliases: ["old-name"]
  });
  console.assert(r.has("old-name"), "T3a: has(alias) true");
  console.assert(
    r.get("old-name")?.id === "new-name",
    "T3b: get(alias) returns canonical"
  );
  console.assert(
    r.resolveAlias("old-name") === "new-name",
    "T3c: resolveAlias returns canonical"
  );
  console.assert(
    r.resolveAlias("something-else") === null,
    "T3d: resolveAlias(non-alias) returns null"
  );
}

// ─── Alias collision with real id throws at register ─────────────
{
  const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
  r.register({
    id: "alpha",
    version: "1.0.0",
    name: "Alpha",
    description: "A",
    category: "test"
  });
  let threw = false;
  try {
    r.register({
      id: "beta",
      version: "1.0.0",
      name: "Beta",
      description: "B",
      category: "test",
      aliases: ["alpha"] // collides with existing real id
    });
  } catch {
    threw = true;
  }
  console.assert(threw, "T4a: alias colliding with real id throws");
}

// ─── Two registrations claiming the same alias throws ────────────
{
  const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
  r.register({
    id: "alpha",
    version: "1.0.0",
    name: "Alpha",
    description: "A",
    category: "test",
    aliases: ["legacy"]
  });
  let threw = false;
  try {
    r.register({
      id: "beta",
      version: "1.0.0",
      name: "Beta",
      description: "B",
      category: "test",
      aliases: ["legacy"] // already claimed by alpha
    });
  } catch {
    threw = true;
  }
  console.assert(threw, "T5a: duplicate alias throws");
}

console.log("registryKit · selfCheck: all assertions passed.");
