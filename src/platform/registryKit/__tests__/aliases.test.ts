// registryKit · alias resolution — end-to-end test across register/get/has.
// (selfCheck.test.ts covers alias validation, this file covers behaviour.)

import { createRegistry } from "../createRegistry";
import type { RegistrationBase } from "../types";

type Fx = RegistrationBase;

const r = createRegistry<Fx>({ label: "T", idFormat: "slug" });
r.register({
  id: "hero-plumber-v2",
  version: "2.0.0",
  name: "Plumber hero v2",
  description: "Rebuilt with visualEffect + KG binding.",
  category: "hero",
  aliases: ["hero-plumber", "hero-plumber-v1"]
});

// ─── has() sees both canonical + aliases ─────────────────────────
console.assert(r.has("hero-plumber-v2"), "T1a: canonical id ok");
console.assert(r.has("hero-plumber"), "T1b: legacy alias ok");
console.assert(r.has("hero-plumber-v1"), "T1c: v1 alias ok");
console.assert(!r.has("hero-plumber-v3"), "T1d: unknown id false");

// ─── get() unwraps aliases ───────────────────────────────────────
console.assert(
  r.get("hero-plumber")?.id === "hero-plumber-v2",
  "T2a: alias get returns canonical"
);
console.assert(
  r.get("hero-plumber-v1")?.id === "hero-plumber-v2",
  "T2b: v1 alias get returns canonical"
);
console.assert(
  r.get("hero-plumber-v2")?.id === "hero-plumber-v2",
  "T2c: canonical get returns itself"
);

// ─── resolveAlias ────────────────────────────────────────────────
console.assert(
  r.resolveAlias("hero-plumber") === "hero-plumber-v2",
  "T3a: resolveAlias returns canonical"
);
console.assert(
  r.resolveAlias("hero-plumber-v2") === null,
  "T3b: resolveAlias(canonical) returns null (not an alias)"
);
console.assert(
  r.resolveAlias("unknown") === null,
  "T3c: resolveAlias(unknown) returns null"
);

// ─── ids() lists canonicals only ─────────────────────────────────
console.assert(
  r.ids().length === 1,
  "T4a: ids() lists canonicals only, not aliases"
);
console.assert(
  r.ids()[0] === "hero-plumber-v2",
  "T4b: canonical id present"
);

console.log("registryKit · aliases: all assertions passed.");
