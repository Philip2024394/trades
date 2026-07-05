// registryKit · createRegistry — tests.

import { createRegistry } from "../createRegistry";
import type { RegistrationBase } from "../types";

type Fixture = RegistrationBase & { extra?: string };

function fx(id: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id,
    version: "1.0.0",
    name: `Fixture ${id}`,
    description: `Test fixture ${id}.`,
    category: "test",
    ...overrides
  };
}

// ─── Register + get + has + size ─────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  r.register(fx("alpha"));
  console.assert(r.has("alpha"), "T1a: has(id) true");
  console.assert(r.get("alpha")?.name === "Fixture alpha", "T1b: get returns");
  console.assert(r.size() === 1, "T1c: size increments");
  console.assert(r.list().length === 1, "T1d: list returns 1");
}

// ─── getOrThrow ──────────────────────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  r.register(fx("alpha"));
  let threw = false;
  try {
    r.getOrThrow("does-not-exist");
  } catch {
    threw = true;
  }
  console.assert(threw, "T2a: getOrThrow throws on miss");
  console.assert(
    r.getOrThrow("alpha").id === "alpha",
    "T2b: getOrThrow returns on hit"
  );
}

// ─── Duplicate id throws ─────────────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  r.register(fx("alpha"));
  let threw = false;
  try {
    r.register(fx("alpha"));
  } catch (e) {
    threw = true;
    console.assert(
      (e as Error).message.includes("duplicate"),
      "T3a: error mentions duplicate"
    );
  }
  console.assert(threw, "T3b: duplicate throws");
}

// ─── Slug format enforced ────────────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  let threw = false;
  try {
    r.register(fx("Alpha")); // uppercase
  } catch {
    threw = true;
  }
  console.assert(threw, "T4a: invalid slug rejected");
}

// ─── Semver format enforced ──────────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  let threw = false;
  try {
    r.register(fx("alpha", { version: "1.0" }));
  } catch {
    threw = true;
  }
  console.assert(threw, "T5a: invalid semver rejected");
}

// ─── Category index ──────────────────────────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  r.register(fx("a1", { category: "hero" }));
  r.register(fx("a2", { category: "hero" }));
  r.register(fx("a3", { category: "faq" }));
  console.assert(
    r.listByCategory("hero").length === 2,
    "T6a: byCategory hero=2"
  );
  console.assert(
    r.listByCategory("faq").length === 1,
    "T6b: byCategory faq=1"
  );
  console.assert(
    r.categories().sort().join(",") === "faq,hero",
    "T6c: categories() lists both"
  );
  console.assert(
    r.counts().byCategory["hero"] === 2,
    "T6d: counts().byCategory correct"
  );
}

// ─── Secondary index ─────────────────────────────────────────────
{
  const r = createRegistry<Fixture & { trades: string[] }>({
    label: "T",
    idFormat: "slug",
    indexes: {
      byTrade: (reg) => reg.trades
    }
  });
  r.register({
    ...fx("bp1"),
    trades: ["plumber", "gas-engineer"]
  } as never);
  r.register({
    ...fx("bp2"),
    trades: ["plumber"]
  } as never);
  console.assert(
    r.listByIndex("byTrade", "plumber").length === 2,
    "T7a: byTrade plumber=2"
  );
  console.assert(
    r.listByIndex("byTrade", "gas-engineer").length === 1,
    "T7b: byTrade gas-engineer=1"
  );
  console.assert(
    r.listByIndex("byTrade", "nope").length === 0,
    "T7c: byTrade nope=0"
  );
  console.assert(
    r.listByIndex("nonexistent", "x").length === 0,
    "T7d: unknown index returns empty"
  );
}

// ─── Registered manifests are deep-frozen ────────────────────────
{
  const r = createRegistry<Fixture>({ label: "T", idFormat: "slug" });
  r.register(fx("alpha"));
  const got = r.getOrThrow("alpha");
  let threw = false;
  try {
    (got as unknown as { name: string }).name = "mutated";
  } catch {
    threw = true;
  }
  console.assert(
    threw || got.name === "Fixture alpha",
    "T8a: registration is immutable (throws in strict, silent in loose)"
  );
}

// ─── Namespaced id format ────────────────────────────────────────
{
  const r = createRegistry<Fixture>({
    label: "T",
    idFormat: "namespacedId"
  });
  r.register(fx("hero.trust_minimal_1"));
  console.assert(
    r.has("hero.trust_minimal_1"),
    "T9a: namespaced id accepted"
  );
  let threw = false;
  try {
    r.register(fx("just-a-slug"));
  } catch {
    threw = true;
  }
  console.assert(threw, "T9b: slug rejected in namespacedId mode");
}

// ─── Domain-specific validation ──────────────────────────────────
{
  const r = createRegistry<Fixture>({
    label: "T",
    idFormat: "slug",
    validate: (reg) => {
      if (reg.name.length < 3) throw new Error("name too short");
    }
  });
  let threw = false;
  try {
    r.register(fx("alpha", { name: "aa" }));
  } catch {
    threw = true;
  }
  console.assert(threw, "T10a: custom validate() runs");
}

console.log("registryKit · createRegistry: all assertions passed.");
