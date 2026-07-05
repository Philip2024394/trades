// registryKit · telemetry — tests.

import { createRegistry } from "../createRegistry";
import type { RegistrationBase } from "../types";

type Fx = RegistrationBase;

function fx(id: string): Fx {
  return {
    id,
    version: "1.0.0",
    name: id,
    description: id,
    category: "test"
  };
}

// ─── onRegister fires ────────────────────────────────────────────
{
  const events: string[] = [];
  const r = createRegistry<Fx>({
    label: "T",
    idFormat: "slug",
    telemetry: {
      onRegister: (reg) => events.push(`reg:${reg.id}`)
    }
  });
  r.register(fx("alpha"));
  r.register(fx("beta"));
  console.assert(
    events.join(",") === "reg:alpha,reg:beta",
    "T1a: onRegister fires per register"
  );
}

// ─── onGet fires with hit/miss ───────────────────────────────────
{
  const events: string[] = [];
  const r = createRegistry<Fx>({
    label: "T",
    idFormat: "slug",
    telemetry: {
      onGet: (id, hit) => events.push(`${id}:${hit}`)
    }
  });
  r.register(fx("alpha"));
  r.get("alpha");
  r.get("nope");
  console.assert(events[0] === "alpha:true", "T2a: hit=true");
  console.assert(events[1] === "nope:false", "T2b: miss=false");
}

// ─── onMiss fires on miss only ───────────────────────────────────
{
  const misses: string[] = [];
  const r = createRegistry<Fx>({
    label: "T",
    idFormat: "slug",
    telemetry: {
      onMiss: (id) => misses.push(id)
    }
  });
  r.register(fx("alpha"));
  r.get("alpha");
  r.get("nope1");
  r.get("nope2");
  console.assert(
    misses.join(",") === "nope1,nope2",
    "T3a: onMiss fires on miss only"
  );
}

// ─── Hook errors are swallowed ───────────────────────────────────
{
  const r = createRegistry<Fx>({
    label: "T",
    idFormat: "slug",
    telemetry: {
      onRegister: () => {
        throw new Error("boom");
      }
    }
  });
  let threw = false;
  try {
    r.register(fx("alpha"));
  } catch {
    threw = true;
  }
  console.assert(!threw, "T4a: telemetry hook error does not propagate");
  console.assert(r.has("alpha"), "T4b: registration succeeded despite hook error");
}

console.log("registryKit · telemetry: all assertions passed.");
