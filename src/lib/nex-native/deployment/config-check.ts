// src/lib/nex-native/deployment/config-check.ts
//
// NEX-native · boot-time production configuration validator (server-only).
// -----------------------------------------------------------------------
// A deploy that boots with missing or unsafe env should fail loudly at
// startup rather than silently limping in a half-broken state. This
// helper runs the launch-candidate config audit at process start.
//
// Callers:
//   · `scripts/nex-native-boot-check.mts` for CI / pre-deploy verification
//   · Instrumentation hook if we later wire it into Next.js instrumentation
//
// The check answers ONE question: "would this process serve a real user
// safely right now, or would it silently misbehave?"
//
// It does NOT enforce hosted-AI presence · it enforces hosted-AI ABSENCE.

import "server-only";

export type CheckSeverity = "error" | "warning" | "ok";

export interface ConfigCheckFinding {
  key: string;
  severity: CheckSeverity;
  message: string;
}

export interface ConfigCheckReport {
  overall: "ok" | "warnings" | "unsafe";
  findings: ConfigCheckFinding[];
  timestamp: string;
}

interface EnvSpec {
  name: string;
  required: boolean;
  pattern?: RegExp;
  disallowedValues?: readonly string[];
  purpose: string;
}

// Required + optional env-var specification. Every value NEX-native
// depends on at runtime is listed here explicitly. New env vars added
// elsewhere should be added here too.
const ENV_SPEC: readonly EnvSpec[] = [
  // Authoritative NEX Supabase project · required
  {
    name: "NEXT_PUBLIC_NEX_SUPABASE_URL",
    required: true,
    pattern: /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/,
    disallowedValues: ["http://localhost", "https://localhost", ""],
    purpose: "Authoritative NEX Supabase URL (ijvqdvsvwtwxzcqmoqit or equivalent production project)",
  },
  {
    name: "NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY",
    required: true,
    // Supabase anon keys are JWTs · start with "ey" (base64 of `{`), have
    // two dots separating header/payload/signature, and are typically
    // 150-250 chars long. Real-world variants use `_` and `-` in URL-safe
    // base64. The check is intentionally permissive shape-only · the
    // actual token verification happens when Supabase rejects a bad key.
    pattern: /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    purpose: "Supabase anon JWT · public · required for browser client + SSR",
  },
  {
    name: "NEX_SUPABASE_SERVICE_ROLE_KEY",
    required: true,
    pattern: /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
    purpose: "Supabase service-role JWT · secret · never client-bundled",
  },
  {
    name: "DATABASE_URL",
    required: true,
    pattern: /^postgres(ql)?:\/\/.+:.+@.+:\d+\/.+/,
    disallowedValues: ["postgres://localhost", "postgresql://localhost"],
    purpose: "Direct Postgres URL for the worker fleet · used by nex_generation_job queue",
  },

  // Runtime feature flags
  {
    name: "NEX_INLINE_REPLY",
    required: false,
    disallowedValues: ["1"], // production must NOT run inline · this bypasses the queue
    purpose: "Dev-only opt-out that runs NEX reply inline instead of via the queue · MUST be unset (or !== '1') in production",
  },

  // Engine health surface admin key · optional but strongly recommended
  {
    name: "NEX_ENGINE_HEALTH_ADMIN_KEY",
    required: false,
    disallowedValues: ["", "changeme", "admin", "secret"],
    purpose: "Shared secret for /api/nex-native/engine/health · when unset the endpoint returns 503",
  },

  // Autoscaler + backpressure tunables · optional
  { name: "NEX_AUTOSCALE_MIN_WORKERS", required: false, purpose: "Autoscaler floor" },
  { name: "NEX_AUTOSCALE_MAX_WORKERS", required: false, purpose: "Autoscaler ceiling" },
  { name: "NEX_BACKPRESSURE_MAX_QUEUED_PER_ACCOUNT", required: false, purpose: "Per-account queue cap" },
  { name: "NEX_BACKPRESSURE_GLOBAL_SOFT_CAP", required: false, purpose: "Warm → hot threshold" },
  { name: "NEX_BACKPRESSURE_GLOBAL_HARD_CAP", required: false, purpose: "Reject-new threshold" },
];

// Banned hosted-AI env vars · doctrine: no hosted AI in production. If
// any of these are set, this deploy is contaminated and must be stopped.
const BANNED_HOSTED_AI_ENV: readonly string[] = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_ORG_ID",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GOOGLE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "TOGETHER_API_KEY",
  "REPLICATE_API_TOKEN",
  "COHERE_API_KEY",
  "MISTRAL_API_KEY",
];

// Ollama endpoint env vars · doctrine: no Ollama daemon dependency.
const BANNED_OLLAMA_ENV: readonly string[] = ["OLLAMA_HOST", "OLLAMA_ORIGINS", "OLLAMA_MODELS"];

/**
 * Run the full pre-boot config check. Returns a structured report.
 * Callers decide whether to exit non-zero on `unsafe`.
 */
export function runConfigCheck(env: NodeJS.ProcessEnv = process.env): ConfigCheckReport {
  const findings: ConfigCheckFinding[] = [];

  for (const spec of ENV_SPEC) {
    const raw = env[spec.name];
    const value = typeof raw === "string" ? raw.trim() : "";

    if (spec.required && !value) {
      findings.push({
        key: spec.name,
        severity: "error",
        message: `${spec.name} is required but not set · ${spec.purpose}`,
      });
      continue;
    }
    if (!spec.required && !value) {
      // optional + absent · silent OK, do not add a finding
      continue;
    }
    if (spec.pattern && value && !spec.pattern.test(value)) {
      findings.push({
        key: spec.name,
        severity: "error",
        message: `${spec.name} does not match expected shape · ${spec.purpose}`,
      });
      continue;
    }
    if (spec.disallowedValues && value && spec.disallowedValues.some((d) => d && value.startsWith(d))) {
      findings.push({
        key: spec.name,
        severity: "error",
        message: `${spec.name}=${value.slice(0, 40)} contains a disallowed value · ${spec.purpose}`,
      });
      continue;
    }
    findings.push({
      key: spec.name,
      severity: "ok",
      message: `${spec.name} present and valid`,
    });
  }

  // Hosted-AI presence · doctrine violation if any of these are set
  for (const banned of BANNED_HOSTED_AI_ENV) {
    if (env[banned]) {
      findings.push({
        key: banned,
        severity: "error",
        message: `${banned} is set · hosted-AI doctrine violation · unset before starting production`,
      });
    }
  }
  for (const banned of BANNED_OLLAMA_ENV) {
    if (env[banned]) {
      findings.push({
        key: banned,
        severity: "error",
        message: `${banned} is set · Ollama daemon dependency doctrine violation · unset before starting production`,
      });
    }
  }

  const hasError = findings.some((f) => f.severity === "error");
  const hasWarning = findings.some((f) => f.severity === "warning");
  const overall: ConfigCheckReport["overall"] = hasError ? "unsafe" : hasWarning ? "warnings" : "ok";

  return {
    overall,
    findings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Convenience helper for `scripts/nex-native-boot-check.mts` and similar
 * CI callers. Returns a POSIX-friendly exit code so pipelines can gate on it.
 */
export function configCheckExitCode(report: ConfigCheckReport): number {
  return report.overall === "unsafe" ? 1 : 0;
}
