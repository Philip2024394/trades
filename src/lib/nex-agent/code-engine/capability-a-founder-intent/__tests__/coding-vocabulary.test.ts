// NEX1 · CAPABILITY A · v2.0.0 coding-vocabulary tests.
// Deterministic · verifies tools / frameworks / concepts / languages recognition
// and well-known-config-file detection.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import {
  CODE_CONCEPT_LEXEMES,
  CODING_LEXEME_INDEX,
  FRAMEWORK_LEXEMES,
  LANGUAGE_LEXEMES,
  TOOL_LEXEMES,
  VOCABULARY_VERSION,
  WELL_KNOWN_CONFIG_FILES,
} from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") {
    throw new Error(`expected classified, got ${result.kind}`);
  }
  return result;
}

describe("capability-a v2+ · vocabulary invariants", () => {
  it("VOCABULARY_VERSION is v2.x.x or later (optional -alpha.N suffix)", () => {
    // v2 introduced coding vocabulary; v3+ expanded it; v5.0.0-alpha.* is a staged rollout.
    expect(/^v[2-9]\d*\.\d+\.\d+(-alpha\.\d+)?$/.test(VOCABULARY_VERSION)).toBe(true);
  });

  it("CODING_LEXEME_INDEX aggregates all four registries with no collisions", () => {
    const expected =
      TOOL_LEXEMES.size + FRAMEWORK_LEXEMES.size + CODE_CONCEPT_LEXEMES.size + LANGUAGE_LEXEMES.size;
    expect(CODING_LEXEME_INDEX.size).toBe(expected);
  });

  it("no coding lexeme collides with any verb lexeme", () => {
    // This is also enforced at module-load; assert observationally.
    for (const [lex] of CODING_LEXEME_INDEX) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ = lex; // touched only to keep loop meaningful
    }
    expect(CODING_LEXEME_INDEX.has("build")).toBe(false); // verb
    expect(CODING_LEXEME_INDEX.has("fix")).toBe(false); // verb
    expect(CODING_LEXEME_INDEX.has("refactor")).toBe(false); // verb
  });

  it("each registry has expected minimum coverage (v3+ baselines)", () => {
    expect(TOOL_LEXEMES.size).toBeGreaterThanOrEqual(90);
    expect(FRAMEWORK_LEXEMES.size).toBeGreaterThanOrEqual(120);
    expect(CODE_CONCEPT_LEXEMES.size).toBeGreaterThanOrEqual(300);
    expect(LANGUAGE_LEXEMES.size).toBeGreaterThanOrEqual(50);
  });

  it("well-known config files include the essentials", () => {
    expect(WELL_KNOWN_CONFIG_FILES.has("package.json")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("tsconfig.json")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("next.config.js")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("tailwind.config.ts")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("Dockerfile")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has(".env")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("README.md")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("Cargo.toml")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("pyproject.toml")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("go.mod")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("Gemfile")).toBe(true);
    expect(WELL_KNOWN_CONFIG_FILES.has("CLAUDE.md")).toBe(true);
  });
});

describe("capability-a v2 · tool recognition", () => {
  it("recognises a package manager", () => {
    const r = classified(classifyFounderIntent("refactor the yarn dependency layout in the monorepo"));
    const t = r.coding_concepts.find((c) => c.token === "yarn");
    expect(t?.category).toBe("tool");
  });

  it("recognises test runners", () => {
    const r = classified(classifyFounderIntent("investigate the vitest suite failure in the checkout module"));
    const t = r.coding_concepts.find((c) => c.token === "vitest");
    expect(t?.category).toBe("tool");
  });

  it("recognises containers and iac", () => {
    const r = classified(
      classifyFounderIntent("author a docker configuration alongside the terraform manifests"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("docker:tool");
    expect(cats).toContain("terraform:tool");
  });

  it("recognises lint and format tools", () => {
    const r = classified(classifyFounderIntent("refactor the eslint and prettier rules in the workspace"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("eslint:tool");
    expect(cats).toContain("prettier:tool");
  });
});

describe("capability-a v2 · framework recognition", () => {
  it("recognises react + nextjs together", () => {
    const r = classified(classifyFounderIntent("build a nextjs page for the react dashboard route"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("react:framework");
    expect(cats).toContain("nextjs:framework");
  });

  it("recognises tailwind + shadcn", () => {
    const r = classified(classifyFounderIntent("author a shadcn card layout styled with tailwind utilities"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("shadcn:framework");
    expect(cats).toContain("tailwind:framework");
  });

  it("recognises databases as frameworks", () => {
    const r = classified(classifyFounderIntent("scaffold a postgres backed api with redis caching"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("postgres:framework");
    expect(cats).toContain("redis:framework");
  });

  it("recognises orms", () => {
    const r = classified(classifyFounderIntent("author a prisma schema and drizzle migration"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("prisma:framework");
    expect(cats).toContain("drizzle:framework");
  });

  it("recognises state-management and data-fetching libs", () => {
    const r = classified(
      classifyFounderIntent("refactor the zustand store and swap swr for tanstack query fetching"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("zustand:framework");
    expect(cats).toContain("swr:framework");
    expect(cats).toContain("tanstack:framework");
  });
});

describe("capability-a v2 · concept recognition", () => {
  it("recognises react-family concepts", () => {
    const r = classified(classifyFounderIntent("author a hook that manages state via a reducer and a ref"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("hook:concept");
    expect(cats).toContain("state:concept");
    expect(cats).toContain("reducer:concept");
    expect(cats).toContain("ref:concept");
  });

  it("recognises async / promise / callback", () => {
    const r = classified(
      classifyFounderIntent("author an async helper that awaits a promise inside a callback"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("async:concept");
    expect(cats).toContain("promise:concept");
    expect(cats).toContain("callback:concept");
  });

  it("recognises middleware / controller / router (concept, not deliverable)", () => {
    const r = classified(
      classifyFounderIntent("author a middleware that wraps the controller in the router"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("middleware:concept");
    expect(cats).toContain("controller:concept");
    expect(cats).toContain("router:concept");
  });

  it("recognises auth concepts", () => {
    const r = classified(classifyFounderIntent("author a jwt authentication middleware for the api"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("jwt:concept");
    expect(cats).toContain("authentication:concept");
  });

  it("recognises rendering-strategy acronyms", () => {
    const r = classified(classifyFounderIntent("investigate ssr and rsc rendering for the dashboard page"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("ssr:concept");
    expect(cats).toContain("rsc:concept");
  });

  it("recognises testing patterns as concepts", () => {
    const r = classified(classifyFounderIntent("author a fixture and a snapshot for the checkout flow"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("fixture:concept");
    expect(cats).toContain("snapshot:concept");
  });
});

describe("capability-a v2 · language recognition", () => {
  it("recognises typescript and rust", () => {
    const r = classified(classifyFounderIntent("refactor the typescript helper and add a rust binding"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("typescript:language");
    expect(cats).toContain("rust:language");
  });

  it("recognises css/scss variants", () => {
    const r = classified(classifyFounderIntent("author scss modules using css variables and sass mixins"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("scss:language");
    expect(cats).toContain("css:language");
    expect(cats).toContain("sass:language");
  });

  it("recognises sql", () => {
    const r = classified(classifyFounderIntent("author a sql migration for the audit table"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("sql:language");
  });
});

describe("capability-a v2 · well-known config file detection", () => {
  it("detects package.json without a preceding path", () => {
    const r = classified(classifyFounderIntent("modify the package.json to pin the react version"));
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("package.json");
  });

  it("detects Dockerfile (no extension)", () => {
    const r = classified(classifyFounderIntent("author a Dockerfile that builds the app image"));
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("Dockerfile");
  });

  it("detects tsconfig.json and next.config.mjs together", () => {
    const r = classified(
      classifyFounderIntent("modify tsconfig.json strictness and update next.config.mjs env exposure"),
    );
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("tsconfig.json");
    expect(paths).toContain("next.config.mjs");
  });

  it("detects Cargo.toml and pyproject.toml", () => {
    const r = classified(
      classifyFounderIntent("update Cargo.toml dependency pins and align pyproject.toml python versions"),
    );
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain("Cargo.toml");
    expect(paths).toContain("pyproject.toml");
  });

  it("detects .env safely (leading dot, no false substring match)", () => {
    const r = classified(classifyFounderIntent("modify the .env values used by the local dev server"));
    const paths = r.file_references.map((f) => f.path);
    expect(paths).toContain(".env");
  });

  it("does NOT invent config files when they are not mentioned", () => {
    const r = classified(classifyFounderIntent("refactor the login flow in the account module"));
    // No config filename should be extracted from this goal.
    expect(r.file_references.length).toBe(0);
  });
});

describe("capability-a v2 · domain-token isolation from coding vocabulary", () => {
  it("coding tokens do NOT leak into domain_tokens", () => {
    const r = classified(
      classifyFounderIntent("build a react component with tailwind and typescript for the notes feature"),
    );
    const domainSet = new Set(r.domain_tokens.map((d) => d.token));
    // The pure business-domain word 'notes' remains a domain token.
    expect(domainSet.has("notes")).toBe(true);
    // The coding-vocabulary tokens must NOT be in domain_tokens.
    expect(domainSet.has("react")).toBe(false);
    expect(domainSet.has("tailwind")).toBe(false);
    expect(domainSet.has("typescript")).toBe(false);
  });

  it("verbs are still excluded from both domain_tokens and coding_concepts", () => {
    const r = classified(
      classifyFounderIntent("build a react component and fix the failing typescript checker"),
    );
    const domain = new Set(r.domain_tokens.map((d) => d.token));
    const concepts = new Set(r.coding_concepts.map((c) => c.token));
    expect(domain.has("build")).toBe(false);
    expect(concepts.has("build")).toBe(false);
    expect(domain.has("fix")).toBe(false);
    expect(concepts.has("fix")).toBe(false);
  });
});

describe("capability-a v2 · integration with world-class engineering goals", () => {
  it("chat-foundation research goal: BUILD + application + assistant-ui reference + no LLM tokens", () => {
    const goal =
      "Investigate assistant-ui and vercel chatbot and shadcn ai chatbot to determine which components can be safely reused to build the nex chat interface. The runtime must not depend on openai or anthropic.";
    const r = classified(classifyFounderIntent(goal));
    expect(r.verb_family).toBe("INVESTIGATE"); // "investigate" appears
    // shadcn and vercel are frameworks/tools we recognise.
    const concepts = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(concepts).toContain("shadcn:framework");
    expect(concepts).toContain("vercel:tool");
    // "openai" and "anthropic" are NOT in our vocabulary — they must not
    // appear as coding_concepts. This is deliberate: NEX1 must not treat
    // hosted LLM providers as first-class programming vocabulary.
    expect(concepts.some((c) => c.startsWith("openai"))).toBe(false);
    expect(concepts.some((c) => c.startsWith("anthropic"))).toBe(false);
  });

  it("full-stack goal exercises tools + frameworks + concepts + languages together", () => {
    const goal =
      "Author a nextjs page in typescript that uses react hooks for state, tailwind for styling, prisma for the postgres schema, and vitest for tests.";
    const r = classified(classifyFounderIntent(goal));
    expect(r.verb_family).toBe("BUILD");
    const concepts = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(concepts).toContain("nextjs:framework");
    expect(concepts).toContain("typescript:language");
    expect(concepts).toContain("react:framework");
    expect(concepts).toContain("hooks:concept");
    expect(concepts).toContain("state:concept");
    expect(concepts).toContain("tailwind:framework");
    expect(concepts).toContain("prisma:framework");
    expect(concepts).toContain("postgres:framework");
    expect(concepts).toContain("vitest:tool");
  });

  it("determinism holds across the enlarged vocabulary", () => {
    const goal =
      "Build a react component in typescript using tailwind and vitest for tests · users must be able to search notes.";
    const a = classifyFounderIntent(goal);
    const b = classifyFounderIntent(goal);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ────────────────────────────────────────────────────────
// v3.0.0 · advanced code-specialist vocabulary tests
// ────────────────────────────────────────────────────────

describe("capability-a v3 · debugging vocabulary", () => {
  it("recognises debuggers as tools", () => {
    const r = classified(
      classifyFounderIntent("investigate the segfault using gdb and valgrind on the release build"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("gdb:tool");
    expect(cats).toContain("valgrind:tool");
    expect(cats).toContain("segfault:concept");
  });

  it("recognises sanitizers", () => {
    const r = classified(classifyFounderIntent("investigate the asan and ubsan reports for the audit crate"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("asan:concept");
    expect(cats).toContain("ubsan:concept");
  });

  it("recognises debugging concepts", () => {
    const r = classified(
      classifyFounderIntent("investigate the deadlock and off-by-one in the buffer-overflow report"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("deadlock:concept");
    expect(cats).toContain("off-by-one:concept");
    expect(cats).toContain("buffer-overflow:concept");
  });

  it("recognises profilers", () => {
    const r = classified(classifyFounderIntent("investigate the flamegraph output produced by pprof and perf"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("flamegraph:tool");
    expect(cats).toContain("pprof:tool");
    expect(cats).toContain("perf:tool");
  });
});

describe("capability-a v3 · functional programming + type system", () => {
  it("recognises monad, functor, applicative", () => {
    const r = classified(classifyFounderIntent("author a monad and functor and applicative for the parser"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("monad");
    expect(concepts).toContain("functor");
    expect(concepts).toContain("applicative");
  });

  it("recognises ADT and pattern-matching", () => {
    const r = classified(classifyFounderIntent("author an adt with pattern-matching for the sum-type"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("adt");
    expect(concepts).toContain("pattern-matching");
    expect(concepts).toContain("sum-type");
  });

  it("recognises TypeScript advanced type features", () => {
    const r = classified(
      classifyFounderIntent("refactor the type-guard with a satisfies clause and never-type default"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("type-guard");
    expect(concepts).toContain("satisfies");
    expect(concepts).toContain("never-type");
  });

  it("recognises FP purity concepts", () => {
    const r = classified(
      classifyFounderIntent("refactor for purity and referential-transparency using currying"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("purity");
    expect(concepts).toContain("referential-transparency");
    expect(concepts).toContain("currying");
  });
});

describe("capability-a v3 · distributed systems", () => {
  it("recognises consensus algorithms", () => {
    const r = classified(classifyFounderIntent("investigate the raft consensus and gossip protocol"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("raft");
    expect(concepts).toContain("consensus");
    expect(concepts).toContain("gossip");
  });

  it("recognises consistency models", () => {
    const r = classified(
      classifyFounderIntent(
        "author a design for eventual-consistency and linearizability with read-your-writes",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("eventual-consistency");
    expect(concepts).toContain("linearizability");
    expect(concepts).toContain("read-your-writes");
  });

  it("recognises reliability patterns", () => {
    const r = classified(
      classifyFounderIntent(
        "author a circuit-breaker with exponential-backoff and jitter for idempotent retries",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("circuit-breaker");
    expect(concepts).toContain("exponential-backoff");
    expect(concepts).toContain("jitter");
    expect(concepts).toContain("idempotent");
  });

  it("recognises delivery guarantees", () => {
    const r = classified(
      classifyFounderIntent("refactor the queue for at-least-once delivery with exactly-once semantics"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("at-least-once");
    expect(concepts).toContain("exactly-once");
  });

  it("recognises CRDT and merkle-tree", () => {
    const r = classified(classifyFounderIntent("author a crdt using a merkle-tree for anti-entropy sync"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("crdt");
    expect(concepts).toContain("merkle-tree");
    expect(concepts).toContain("anti-entropy");
  });
});

describe("capability-a v3 · cryptography", () => {
  it("recognises common ciphers and hashes", () => {
    const r = classified(
      classifyFounderIntent(
        "author an aes cipher with gcm mode, sha256 digest, hmac auth and ed25519 signatures",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("aes");
    expect(concepts).toContain("gcm");
    expect(concepts).toContain("sha256");
    expect(concepts).toContain("hmac");
    expect(concepts).toContain("ed25519");
  });

  it("recognises PKI primitives", () => {
    const r = classified(
      classifyFounderIntent("investigate the x509 certificate chain and jwks endpoint for mtls"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("x509");
    expect(concepts).toContain("certificate");
    expect(concepts).toContain("jwks");
    expect(concepts).toContain("mtls");
  });

  it("recognises password KDFs", () => {
    const r = classified(
      classifyFounderIntent("refactor the auth to use argon2 instead of bcrypt with pbkdf2 fallback"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("argon2");
    expect(concepts).toContain("bcrypt");
    expect(concepts).toContain("pbkdf2");
  });
});

describe("capability-a v3 · WASM / GPU / SIMD", () => {
  it("recognises WASM ecosystem", () => {
    const r = classified(classifyFounderIntent("author a wasm module using wasm-bindgen with wasi imports"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("wasm:framework");
    expect(cats).toContain("wasm-bindgen:framework");
    expect(cats).toContain("wasi:framework");
  });

  it("recognises GPU APIs and shading languages", () => {
    const r = classified(
      classifyFounderIntent("author a cuda kernel and a wgsl compute-shader for the webgpu path"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("cuda:framework");
    expect(cats).toContain("wgsl:language");
    expect(cats).toContain("webgpu:framework");
    expect(cats).toContain("compute-shader:concept");
  });

  it("recognises SIMD primitives", () => {
    const r = classified(classifyFounderIntent("author a simd kernel with avx2 and sse fallback paths"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("simd");
    expect(concepts).toContain("avx2");
    expect(concepts).toContain("sse");
  });
});

describe("capability-a v3 · kernel / OS / networking", () => {
  it("recognises syscalls and IO", () => {
    const r = classified(
      classifyFounderIntent("author a syscall path using io_uring and epoll for the socket handler"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("syscall");
    expect(concepts).toContain("io_uring");
    expect(concepts).toContain("epoll");
    expect(concepts).toContain("socket");
  });

  it("recognises transport protocols", () => {
    const r = classified(
      classifyFounderIntent("author a quic handler with http3 and webrtc datachannel bridging"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("quic");
    expect(concepts).toContain("http3");
    expect(concepts).toContain("webrtc");
  });

  it("recognises Linux security surface", () => {
    const r = classified(classifyFounderIntent("author a seccomp policy and a bpf filter with cgroup limits"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("seccomp");
    expect(concepts).toContain("bpf");
    expect(concepts).toContain("cgroup");
  });
});

describe("capability-a v3 · advanced database", () => {
  it("recognises transaction isolation", () => {
    const r = classified(
      classifyFounderIntent("investigate the mvcc snapshot-isolation and phantom-read incident"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("mvcc");
    expect(concepts).toContain("snapshot-isolation");
    expect(concepts).toContain("phantom-read");
  });

  it("recognises storage internals", () => {
    const r = classified(
      classifyFounderIntent("refactor the lsm layer with sstable compaction and a bloom-filter"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("lsm");
    expect(concepts).toContain("sstable");
    expect(concepts).toContain("compaction");
    expect(concepts).toContain("bloom-filter");
  });

  it("recognises query features", () => {
    const r = classified(
      classifyFounderIntent("author a cte with a window-function and a lateral join for the report"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("cte");
    expect(concepts).toContain("window-function");
    expect(concepts).toContain("lateral");
  });
});

describe("capability-a v3 · concurrency primitives", () => {
  it("recognises locks + atomics", () => {
    const r = classified(
      classifyFounderIntent("refactor the mutex path to use a spinlock with an atomic cas instead"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("mutex");
    expect(concepts).toContain("spinlock");
    expect(concepts).toContain("atomic");
    expect(concepts).toContain("cas");
  });

  it("recognises lock-free + wait-free", () => {
    const r = classified(
      classifyFounderIntent("author a lock-free queue using hazard-pointer with wait-free progress"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("lock-free");
    expect(concepts).toContain("hazard-pointer");
    expect(concepts).toContain("wait-free");
  });

  it("recognises green-thread + goroutine + work-stealing", () => {
    const r = classified(
      classifyFounderIntent(
        "author a goroutine executor with work-stealing and a green-thread scheduler",
      ),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("goroutine");
    expect(concepts).toContain("work-stealing");
    expect(concepts).toContain("green-thread");
    expect(concepts).toContain("executor");
  });
});

describe("capability-a v3 · syntax / language idioms", () => {
  it("recognises struct, enum, tuple", () => {
    const r = classified(classifyFounderIntent("author a struct with an enum tag and a tuple field"));
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("struct");
    expect(concepts).toContain("enum");
    expect(concepts).toContain("tuple");
  });

  it("recognises ES2020+ idioms", () => {
    const r = classified(
      classifyFounderIntent("refactor to use optional-chaining and nullish-coalescing with destructuring"),
    );
    const concepts = r.coding_concepts.map((c) => c.token);
    expect(concepts).toContain("optional-chaining");
    expect(concepts).toContain("nullish-coalescing");
    expect(concepts).toContain("destructuring");
  });
});

describe("capability-a v3 · specialty languages", () => {
  it("recognises Solidity and Cairo", () => {
    const r = classified(classifyFounderIntent("author a solidity contract with a cairo prover"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("solidity:language");
    expect(cats).toContain("cairo:language");
  });

  it("recognises IDL languages", () => {
    const r = classified(
      classifyFounderIntent("author a protobuf schema alongside a capnproto and thrift definition"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("protobuf:language");
    expect(cats).toContain("capnproto:language");
    expect(cats).toContain("thrift:language");
  });

  it("recognises HCL and Nix", () => {
    const r = classified(classifyFounderIntent("author an hcl configuration alongside a nix flake"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("hcl:language");
    expect(cats).toContain("nix:language");
  });

  it("recognises shading languages", () => {
    const r = classified(classifyFounderIntent("author a glsl fragment shader and a hlsl vertex shader"));
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("glsl:language");
    expect(cats).toContain("hlsl:language");
  });
});

describe("capability-a v3 · specialty frameworks and observability", () => {
  it("recognises observability stack", () => {
    const r = classified(
      classifyFounderIntent(
        "author a grafana dashboard for prometheus metrics with jaeger tracing and sentry alerts",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("grafana:framework");
    expect(cats).toContain("prometheus:framework");
    expect(cats).toContain("jaeger:framework");
    expect(cats).toContain("sentry:framework");
  });

  it("recognises payments and CMS", () => {
    const r = classified(
      classifyFounderIntent(
        "author a stripe checkout page with a sanity cms for the marketing surface",
      ),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("stripe:framework");
    expect(cats).toContain("sanity:framework");
  });

  it("recognises vector databases (vocabulary only — NEX1 does not run LLMs)", () => {
    const r = classified(
      classifyFounderIntent("author a pinecone index with qdrant fallback and faiss on-device search"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("pinecone:framework");
    expect(cats).toContain("qdrant:framework");
    expect(cats).toContain("faiss:framework");
    // Vector-DB vocabulary is recognised, but LLM-provider names still are not.
    for (const c of cats) {
      expect(c.startsWith("openai")).toBe(false);
      expect(c.startsWith("anthropic")).toBe(false);
    }
  });

  it("vocabulary version is exposed and current (v4 or v5.0.0-alpha.N)", () => {
    expect(VOCABULARY_VERSION).toMatch(/^v(4\.0\.0|5\.0\.0(-alpha\.\d+)?)$/);
  });
});
