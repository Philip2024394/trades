// NEX1 · CAPABILITY A · v5.0.0-alpha.5 vocabulary tests
// Cluster 7 additions: CHAT-INTERFACE OPERATIONAL VOCABULARY
// Composed from 4 parallel research agents (Alpha CLI/prompt-patterns · Beta auth/secret/security ·
// Gamma feature-scaffolding/UI/realtime · Delta refactor/test/perf/debug/viewport/data-eng).
// All 374 additions are inert CODE_CONCEPT lexemes. Brand-free per Founder policy.

import { describe, it, expect } from "vitest";
import { classifyFounderIntent } from "../classifier";
import { CODE_CONCEPT_LEXEMES, VOCABULARY_VERSION } from "../vocabulary";
import type { Nex1IntentClassified } from "../types";

function classified(result: ReturnType<typeof classifyFounderIntent>): Nex1IntentClassified {
  if (result.kind !== "classified") throw new Error(`expected classified, got ${result.kind}`);
  return result;
}

// ── Alpha · CLI / prompt-patterns / high-leverage keywords (52)
const ALPHA_CONCEPTS: readonly string[] = [
  "init-command", "plan-mode", "plan-command", "compact-mode", "clear-command",
  "goal-directed", "ultracode", "spec-writer", "pre-flight-check", "preflight",
  "existence-check", "anti-hallucination", "grep-verify", "grounded-build",
  "codebase-first", "verify-schema", "verify-models", "best-approach",
  "brutal-review", "senior-review", "solid-check", "solid-violation",
  "security-audit", "performance-audit", "bottleneck-analysis",
  "refactor-in-place", "behavior-preserving", "behaviour-preserving",
  "before-after-diff", "gated", "deterministic", "isolated", "schema-verified",
  "diff-only", "execution-guardrail", "edge-case-first", "failure-mode",
  "happy-path", "invariants", "invariant", "blast-radius", "context-verification",
  "lean-reference", "subagent-scoped", "read-only-first", "typing-policy",
  "error-resilience", "reasoning-trace", "plan-then-execute", "propose-diff",
  "staged-rollout", "sub-phase", "alpha-bump",
];

// ── Beta · auth / secret / env / security-attack&defence (91)
const BETA_CONCEPTS: readonly string[] = [
  "oauth2", "oidc", "mfa", "2fa", "totp", "magic-link", "passwordless-auth",
  "api-token", "session-revocation", "password-reset", "refresh-token",
  "access-token", "bearer-token", "session-token", "jwt-rotation", "token-scope",
  "token-revocation", "rbac", "role-based-access-control", "permission-check",
  "resource-ownership", "tenant-switching", "single-sign-on", "saml-consumer",
  "oauth-callback", "oauth-state", "oauth-scope", "pkce",
  "multi-factor-authentication", "time-based-otp", "hotp", "api-key", "env-var",
  "environment-variable", "secret-key", "dotenv", "dot-env",
  "env-file", "env-vars", "secret-rotation", "key-management", "secret-vault",
  "secret-manager", "secure-store", "private-key", "public-key", "key-pair",
  "api-secret", "session-secret", "credential-leak", "secret-leak",
  "hardcoded-secret", "secret-scanner", "vault-secret", "encryption-key",
  "at-rest-encryption", "in-transit-encryption", "xss", "cross-site-scripting",
  "injection-attack", "sanitize-input", "escape-input", "escape-output",
  "sql-injection", "parameterized-query", "prepared-statement",
  "cross-site-request-forgery", "samesite-cookie", "anti-csrf-token",
  "cross-origin-resource-sharing", "cors-block", "cors-preflight",
  "cors-allow-list", "content-security-policy", "security-headers",
  "x-frame-options", "clickjacking", "strict-transport-security", "hsts",
  "referrer-policy", "permissions-policy", "path-traversal",
  "directory-traversal", "ssrf", "server-side-request-forgery", "open-redirect",
  "insecure-deserialization", "xxe", "xml-external-entity", "rate-limit-bypass",
  "brute-force-protection", "timing-attack", "replay-attack",
];

// ── Gamma · feature scaffolding / UI / realtime / files (100)
const GAMMA_CONCEPTS: readonly string[] = [
  "crud", "dto", "repository-pattern", "migration-file", "seeder",
  "soft-delete", "hard-delete", "polymorphic-relation", "audit-trail",
  "cursor-pagination", "offset-pagination", "pessimistic-locking",
  "optimistic-locking", "multi-tenant", "tenant-isolation", "tenant-id",
  "unified-tenant", "row-level-security", "wizard-form", "multi-step-form",
  "breadcrumb", "breadcrumbs-navigation", "infinite-scroll", "modal-dialog",
  "command-palette", "master-detail", "dashboard-grid", "sidebar-nav",
  "sidebar-navigation", "data-grid", "sticky-header", "kanban-board",
  "canvas-board", "settings-panel", "comment-tree", "comment-thread",
  "comment-thread-collapsible", "theme-toggle", "debounced-search",
  "fuzzy-search", "faceted-search", "search-filter", "draggable-card",
  "sortable-list", "unsaved-change-warning", "focus-trap", "escape-key-close",
  "dropdown", "dropdown-nested", "dropdown-menu", "tab-panel",
  "snackbar-queue", "responsive-layout", "breakpoint-first",
  "atomic-design-atom", "atomic-design-molecule", "atomic-design-organism",
  "atomic-design-template", "chunked-upload", "direct-upload", "resumable-upload",
  "multipart-upload-part", "drag-and-drop-upload", "image-compression",
  "image-pipeline", "thumbnail-generation", "webp-conversion", "exif-strip",
  "zip-package", "csv-parser", "xlsx-parser", "pdf-report", "audio-parser",
  "video-parser", "secure-file-proxy", "download-entitlement", "download-token",
  "audio-recorder", "screen-recorder", "camera-capture", "server-sent-events",
  "websocket-heartbeat", "websocket-server", "websocket-client", "live-chat",
  "cursor-tracking", "shared-cursor", "document-lock", "live-progress",
  "auto-reconnect", "exponential-reconnect", "pubsub-hub", "event-bus",
  "event-emitter", "stock-ticker", "price-flash", "price-tick",
  "live-activity-feed", "activity-stream",
];

// ── Delta · refactor / test / perf / debug / viewport / data-eng (145)
const DELTA_CONCEPTS: readonly string[] = [
  "callback-hell-refactor", "single-responsibility", "composition-over-inheritance",
  "fluent-builder", "pure-function", "immutable-config", "strategy-pattern",
  "dependency-injection", "null-object-pattern", "guard-clause", "early-return",
  "decouple-refactor", "flatten-conditional", "service-layer-extraction",
  "controller-slim", "presenter-pattern", "container-presentational",
  "runtime-schema-validation", "readonly-type", "strict-mode", "implicit-any",
  "type-assertion", "options-object", "destructuring-parameters",
  "exhaustive-check", "cache-aside", "cache-first-fallback-network", "n-plus-one",
  "batch-insert", "stale-while-revalidate", "query-timeout", "timeout-limiter",
  "virtualization", "virtualized-list", "virtualized-window", "worker-thread",
  "code-splitting", "dynamic-import", "tree-shaking", "bundle-splitting",
  "memoization", "memo-cache", "computed-cache", "precomputed-summary",
  "index-backed-query", "view-schema", "materialised-view", "hydration-mismatch",
  "layout-shift", "cls", "lcp", "fcp", "ttfb", "fid", "inp", "tbt",
  "skeleton-loader", "skeleton-placeholder", "intersection-observer",
  "mutation-observer", "resize-observer", "critical-css", "critical-render-path",
  "above-the-fold", "null-pointer", "undefined-access", "safe-chaining",
  "rerender-loop", "dependency-array", "hook-lifecycle", "effect-cleanup",
  "jitter-backoff", "retry-policy", "retry-budget", "request-lock",
  "mutation-lock", "distributed-lock", "event-listener-cleanup",
  "subscription-cleanup", "memory-allocation-bloat", "redirect-loop",
  "infinite-redirect", "cors-preflight-fail", "type-incompatibility", "tz-drift",
  "snapshot-test", "visual-regression", "mock-server", "test-fixture",
  "test-seeder", "time-freeze", "time-mock", "branch-coverage", "line-coverage",
  "precise-assertion", "test-cleanup", "mock-factory", "test-utility",
  "spec-helper", "integration-suite", "e2e-suite", "smoke-suite", "ci-pipeline",
  "cd-pipeline", "cicd", "canary-deployment", "smoke-test", "dockerise-build",
  "multi-stage-build", "container-image", "hermetic-build", "dead-letter-queue",
  "dlq", "rate-limiter", "least-privilege", "iam-role", "iam-policy",
  "iam-boundary", "liveness-probe", "readiness-probe", "startup-probe",
  "distributed-cron", "distributed-tracing", "trace-span", "trace-context",
  "w3c-traceparent", "mobile-viewport", "tablet-viewport", "desktop-viewport",
  "viewport-resize", "viewport-change", "viewport-mode", "screen-mode",
  "preview-panel", "preview-screen", "preview-frame", "side-menu-station",
  "side-menu-panel", "side-panel-station", "code-injection", "code-transfer",
  "code-payload", "hot-reload", "live-reload", "fast-refresh", "bounding-box",
  "responsive-preview", "responsive-simulation", "workspace-canvas",
  "workbench-panel", "station-panel", "data-pipeline", "data-transformation",
  "star-schema", "snowflake-schema", "data-warehouse", "data-lake",
  "data-lakehouse", "deduplication", "fuzzy-matching", "pii-masking",
  "columnar-storage", "stream-processing", "event-sourcing-store",
  "changelog-topic", "graphql-federation", "grpc-contract", "wasm-bridge",
  "state-machine", "finite-state-machine", "hardware-acceleration",
  "service-worker-cache", "offline-sync", "push-notification", "background-sync",
  "share-target", "web-share",
];

describe("capability-a v5.0.0-alpha.5 · version + Cluster 7 growth", () => {
  it("VOCABULARY_VERSION is v5.0.0-alpha.5 or later alpha", () => {
    expect(VOCABULARY_VERSION.startsWith("v5.0.0-alpha.")).toBe(true);
  });
});

describe("capability-a v5.0.0-alpha.5 · Alpha (CLI+keywords) concepts registered", () => {
  for (const lex of ALPHA_CONCEPTS) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.5 · Beta (auth+secret+security) concepts registered", () => {
  for (const lex of BETA_CONCEPTS) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.5 · Gamma (scaffolding+UI+realtime) concepts registered", () => {
  for (const lex of GAMMA_CONCEPTS) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.5 · Delta (refactor+test+perf+viewport) concepts registered", () => {
  for (const lex of DELTA_CONCEPTS) {
    it(`CODE_CONCEPT_LEXEMES has \`${lex}\` = concept`, () => {
      expect(CODE_CONCEPT_LEXEMES.get(lex)).toBe("concept");
    });
  }
});

describe("capability-a v5.0.0-alpha.5 · classifier extracts chat-interface vocab", () => {
  it("auth family extracted", () => {
    const r = classified(
      classifyFounderIntent("build an oauth2 flow with pkce plus a refresh-token rotation"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("oauth2:concept");
    expect(cats).toContain("pkce:concept");
    expect(cats).toContain("refresh-token:concept");
  });

  it("secret / env family extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the api-key leak and move to a secret-manager with env-var indirection"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("api-key:concept");
    expect(cats).toContain("secret-manager:concept");
    expect(cats).toContain("env-var:concept");
  });

  it("security-attack family extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the xss and sql-injection surface plus csrf protection"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("xss:concept");
    expect(cats).toContain("sql-injection:concept");
  });

  it("CRUD scaffolding vocabulary extracted", () => {
    const r = classified(
      classifyFounderIntent("build a crud resource with dto and repository-pattern plus a seeder"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("crud:concept");
    expect(cats).toContain("dto:concept");
    expect(cats).toContain("repository-pattern:concept");
    expect(cats).toContain("seeder:concept");
  });

  it("UI pattern vocabulary extracted", () => {
    const r = classified(
      classifyFounderIntent("build an infinite-scroll list plus a command-palette and a modal-dialog with focus-trap"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("infinite-scroll:concept");
    expect(cats).toContain("command-palette:concept");
    expect(cats).toContain("modal-dialog:concept");
    expect(cats).toContain("focus-trap:concept");
  });

  it("core-web-vitals acronyms extracted", () => {
    const r = classified(
      classifyFounderIntent("investigate the lcp cls and inp scores on the marketing page"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("lcp:concept");
    expect(cats).toContain("cls:concept");
    expect(cats).toContain("inp:concept");
  });

  it("viewport + preview vocabulary extracted (Founder-specific)", () => {
    const r = classified(
      classifyFounderIntent("build a viewport-resize handler that switches between mobile-viewport tablet-viewport and desktop-viewport in the preview-panel"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("viewport-resize:concept");
    expect(cats).toContain("mobile-viewport:concept");
    expect(cats).toContain("tablet-viewport:concept");
    expect(cats).toContain("desktop-viewport:concept");
    expect(cats).toContain("preview-panel:concept");
  });

  it("side-menu code-injection workflow extracted", () => {
    const r = classified(
      classifyFounderIntent("build a code-transfer bridge that ships code-payload from side-menu-station to preview-screen"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("code-transfer:concept");
    expect(cats).toContain("code-payload:concept");
    expect(cats).toContain("side-menu-station:concept");
    expect(cats).toContain("preview-screen:concept");
  });

  it("high-leverage engineering keywords extracted", () => {
    const r = classified(
      classifyFounderIntent("build a gated deterministic isolated pipeline with schema-verified diff-only edits"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("gated:concept");
    expect(cats).toContain("deterministic:concept");
    expect(cats).toContain("isolated:concept");
    expect(cats).toContain("schema-verified:concept");
    expect(cats).toContain("diff-only:concept");
  });

  it("CLI / prompt-pattern vocabulary extracted", () => {
    const r = classified(
      classifyFounderIntent("build a spec-writer that runs a pre-flight-check with grep-verify plus a brutal-review pass"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("spec-writer:concept");
    expect(cats).toContain("pre-flight-check:concept");
    expect(cats).toContain("grep-verify:concept");
    expect(cats).toContain("brutal-review:concept");
  });

  it("distributed systems + tracing vocabulary extracted", () => {
    const r = classified(
      classifyFounderIntent("build a dead-letter-queue plus distributed-tracing with trace-span and w3c-traceparent propagation"),
    );
    const cats = r.coding_concepts.map((c) => `${c.token}:${c.category}`);
    expect(cats).toContain("dead-letter-queue:concept");
    expect(cats).toContain("distributed-tracing:concept");
    expect(cats).toContain("trace-span:concept");
    expect(cats).toContain("w3c-traceparent:concept");
  });
});
