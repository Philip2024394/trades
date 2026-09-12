// src/lib/nex-code-intelligence/work-order.ts
//
// NEX1 · Engineering Work Order compiler.
// authored_by = master_ai_engineer · founder-authorised 2026-09-12
//
// CI-7: NEX is the Work Order compiler. Turns a user's request +
// detected file context into a STRUCTURED order. Never sends arbitrary
// prose to the Engineering Brain.
//
// v0 · deterministic classification of the operation kind + slot fill.
// Complex/ambiguous cases produce an order with `capability_status.
// transformation_supported=false` and a limitations list · never fabricates
// support.

import { randomBytes } from "node:crypto";
import type { EngineeringWorkOrder, OperationKind, FileIntelligence } from "./types";
import { requirementsFor } from "./operation-taxonomy";
import { languageById } from "./registry-store";

export interface WorkOrderInput {
  readonly originating_request: string;
  readonly file_intelligences?: readonly FileIntelligence[];
  readonly explicit_target_language?: string;
}

// Deterministic patterns → operation kind. Never conflated (CI-5).
interface OpRule { readonly kind: OperationKind; readonly patterns: readonly RegExp[]; readonly target_hint?: string; }
const OP_RULES: readonly OpRule[] = Object.freeze([
  { kind: "FORMAT",                 patterns: [/\bformat\s+(?:this|the)\s+(?:file|code|project)?\b/i, /\brun\s+(?:the\s+)?formatter\b/i, /\bapply\s+(?:the\s+)?(?:formatter|prettier|black|gofmt|rustfmt|shfmt)\b/i] },
  { kind: "STYLE_CHANGE",           patterns: [/\bmatch\s+(?:the\s+)?project['’]?s?\s+(?:code|coding)?\s*style\b/i, /\bapply\s+(?:the\s+)?project\s+style\b/i, /\bconform\s+(?:to\s+)?(?:the\s+)?project\s+style\b/i] },
  { kind: "LINT_FIX",               patterns: [/\bfix\s+(?:the\s+)?lint(?:ing)?\b/i, /\bapply\s+(?:the\s+)?linter\b/i, /\brun\s+eslint\s+--fix\b/i] },
  { kind: "SYNTAX_REPAIR",          patterns: [/\brepair\s+(?:the\s+)?syntax\b/i, /\bmake\s+(?:this|it)\s+parse\b/i, /\bfix\s+(?:the\s+)?parse\s+errors?\b/i] },
  { kind: "DIALECT_CHANGE",         patterns: [/\bmigrate\s+(?:from\s+)?python\s*2\s+to\s+python\s*3\b/i, /\bport\s+to\s+python\s*3\b/i, /\bupgrade\s+to\s+(?:es2020|es2015|esnext)\b/i] },
  { kind: "LANGUAGE_TRANSLATION",   patterns: [/\bconvert\s+(?:this\s+)?(?:javascript|js)\s+(?:file\s+)?to\s+typescript\b/i, /\btranslate\s+(?:this\s+)?(?:file\s+)?from\s+\w+\s+to\s+\w+\b/i, /\brewrite\s+in\s+(?:typescript|python|go|rust|java|kotlin|c\+\+|c#)\b/i, /\bport\s+this\s+(?:to|into)\s+(?:typescript|python|go|rust|java|kotlin)\b/i] },
  { kind: "FRAMEWORK_MIGRATION",    patterns: [/\bmigrate\s+(?:the\s+)?project\s+from\s+\w+\s+to\s+\w+\b/i, /\bupgrade\s+(?:the\s+)?(?:react|vue|angular|svelte|astro)\s+(?:major\s+)?version\b/i] },
  { kind: "DEPENDENCY_MIGRATION",   patterns: [/\bupgrade\s+(?:the\s+)?(?:package|dependency|library)\b/i, /\bbump\s+(?:the\s+)?version\s+of\b/i] },
  { kind: "FILE_FORMAT_CONVERSION", patterns: [/\bconvert\s+(?:this\s+)?json\s+to\s+yaml\b/i, /\bconvert\s+(?:this\s+)?yaml\s+to\s+json\b/i, /\bconvert\s+(?:this\s+)?toml\s+to\s+json\b/i] },
  { kind: "PROJECT_MIGRATION",      patterns: [/\bmigrate\s+(?:this\s+)?(?:react\s+)?javascript\s+project\s+to\s+typescript\b/i, /\bmove\s+(?:the\s+)?project\s+from\s+\w+\s+to\s+\w+\b/i] },
  { kind: "REFACTOR",               patterns: [/\brefactor\b/i, /\brename\s+\w+\s+to\s+\w+\b/i, /\bextract\s+(?:a\s+)?(?:function|method|module)\b/i, /\binline\s+(?:this|the)\s+(?:variable|function)\b/i] },
  { kind: "TEST_CHANGE",            patterns: [/\b(?:add|update|fix)\s+(?:the\s+)?tests?\b/i, /\bwrite\s+(?:unit|integration)?\s*tests?\s+for\b/i] },
  { kind: "CONFIGURATION_CHANGE",   patterns: [/\bupdate\s+(?:the\s+)?config(?:uration)?\b/i, /\bchange\s+(?:the\s+)?tsconfig\b/i, /\badd\s+(?:a\s+)?field\s+to\s+package\.json\b/i] },
  { kind: "BUG_FIX",                patterns: [/\bfix\s+(?:the\s+)?bug\b/i, /\bresolve\s+(?:the\s+)?(?:issue|error|crash)\b/i, /\brepair\s+(?:the\s+)?bug\b/i] },
  { kind: "FEATURE_CHANGE",         patterns: [/\badd\s+(?:a\s+)?(?:new\s+)?feature\b/i, /\bimplement\s+(?:a\s+)?new\b/i, /\bcreate\s+(?:a\s+)?new\s+\w+/i] },
]);

// Target-language patterns (used when task is LANGUAGE_TRANSLATION or PROJECT_MIGRATION)
const TARGET_LANG_PATTERNS: readonly { lang: string; regex: RegExp }[] = Object.freeze([
  { lang: "typescript", regex: /\bto\s+typescript\b|\bin\s+typescript\b/i },
  { lang: "javascript", regex: /\bto\s+javascript\b|\bto\s+js\b/i },
  { lang: "python",     regex: /\bto\s+python\b|\bin\s+python\b/i },
  { lang: "go",         regex: /\bto\s+go(?:lang)?\b|\bin\s+go(?:lang)?\b/i },
  { lang: "rust",       regex: /\bto\s+rust\b|\bin\s+rust\b/i },
  { lang: "java",       regex: /\bto\s+java\b|\bin\s+java\b/i },
  { lang: "kotlin",     regex: /\bto\s+kotlin\b|\bin\s+kotlin\b/i },
  { lang: "csharp",     regex: /\bto\s+c#\b|\bto\s+csharp\b|\bin\s+c#\b/i },
  { lang: "cpp",        regex: /\bto\s+c\+\+\b|\bin\s+c\+\+\b/i },
  { lang: "yaml",       regex: /\bto\s+yaml\b/i },
  { lang: "json",       regex: /\bto\s+json\b/i },
  { lang: "toml",       regex: /\bto\s+toml\b/i },
]);

export function compileWorkOrder(input: WorkOrderInput): EngineeringWorkOrder {
  const request = input.originating_request ?? "";
  const files = input.file_intelligences ?? [];
  const kind = classifyOperation(request);
  const req = requirementsFor(kind);

  const source_language = files.length > 0 ? (files[0].language.detected_value ?? null) : null;
  const target_language = deriveTargetLanguage(kind, request, input.explicit_target_language);
  const scope: EngineeringWorkOrder["source"]["scope"] =
    kind === "PROJECT_MIGRATION" || kind === "FRAMEWORK_MIGRATION" ? "project" :
    files.length > 1 ? "multi_file" : "single_file";

  // Determine limitations · never over-claim (CI-6)
  const limitations: string[] = [];
  const src = source_language ? languageById(source_language) : null;
  const tgt = target_language ? languageById(target_language) : null;
  const source_lang_capable = !!src?.capability?.DETECTED;
  const target_lang_capable = tgt ? !!tgt.capability?.DETECTED : true; // no target = trivially capable
  // v0 · no language has TRANSFORMED true in the registry · transformation is not yet supported
  const transformation_supported = false;
  if (!transformation_supported) limitations.push("v0 · transformation capability=false across all registered languages · Work Order is a DRAFT · execution requires future authorised transformation capability");
  if (kind === "LANGUAGE_TRANSLATION" && !target_language) limitations.push("target language not identified · Work Order incomplete · CI-6");
  if (kind === "LANGUAGE_TRANSLATION" && files.some((f) => f.is_generated)) limitations.push("source contains generated files · CI-11 · excluded from transformation");
  if (files.some((f) => f.is_vendored)) limitations.push("vendored files present · CI-11 · excluded from transformation");

  return {
    work_order_id: "wo_" + randomBytes(6).toString("hex"),
    created_at: new Date().toISOString(),
    originating_request: request,
    interpreted_intent: describeIntent(kind, source_language, target_language, scope),
    task: kind,
    source: {
      language: source_language,
      scope,
      files: files.map((f) => f.path),
    },
    target: target_language ? { language: target_language, dialect: null } : null,
    constraints: {
      preserve_semantics: req.parser_required && req.semantic_analysis_required,
      preserve_project_style: /project['’]?s?\s+style|project style|match\s+the\s+rest/i.test(request),
      generated_files_excluded: true,
      vendored_files_excluded: true,
      extra: [],
    },
    validation: {
      parse_target_required: req.parser_required,
      type_check_required: req.semantic_analysis_required,
      tests_required_if_available: req.test_required,
      diff_required: req.rollback_required,
    },
    authorisation: {
      mutation_required: req.authorisation_required,
      authorised: false,
      authorisation_scope: `${kind}·${scope}`,
    },
    capability_status: {
      source_lang_capable,
      target_lang_capable,
      transformation_supported,
      limitations,
    },
    attribution: {
      external_llm_used: false,
      independent_authorship_percent: 0,
      deterministic: true,
      taught_by: "master_ai_engineer",
      work_order_version: "v0.1.0",
    },
  };
}

function classifyOperation(request: string): OperationKind {
  const matches: OperationKind[] = [];
  for (const rule of OP_RULES) {
    for (const p of rule.patterns) {
      if (p.test(request)) { matches.push(rule.kind); break; }
    }
  }
  if (matches.length === 0) return "REFACTOR"; // default to REFACTOR · never fabricate a specific target task
  // Priority: PROJECT_MIGRATION > FRAMEWORK_MIGRATION > LANGUAGE_TRANSLATION > DIALECT_CHANGE > everything else
  const priority: OperationKind[] = ["PROJECT_MIGRATION","FRAMEWORK_MIGRATION","LANGUAGE_TRANSLATION","DIALECT_CHANGE","DEPENDENCY_MIGRATION","FILE_FORMAT_CONVERSION","SYNTAX_REPAIR","LINT_FIX","STYLE_CHANGE","FORMAT","TEST_CHANGE","CONFIGURATION_CHANGE","BUG_FIX","FEATURE_CHANGE","REFACTOR"];
  for (const p of priority) if (matches.includes(p)) return p;
  return matches[0];
}

function deriveTargetLanguage(kind: OperationKind, request: string, explicit?: string): string | null {
  if (explicit) return explicit;
  if (kind !== "LANGUAGE_TRANSLATION" && kind !== "PROJECT_MIGRATION" && kind !== "DIALECT_CHANGE" && kind !== "FILE_FORMAT_CONVERSION") return null;
  for (const p of TARGET_LANG_PATTERNS) if (p.regex.test(request)) return p.lang;
  return null;
}

function describeIntent(kind: OperationKind, source: string | null, target: string | null, scope: string): string {
  switch (kind) {
    case "FORMAT":                 return `format ${scope} in ${source ?? "detected language"}`;
    case "STYLE_CHANGE":           return `apply project style to ${scope}`;
    case "LINT_FIX":               return `apply lint fixes to ${scope}`;
    case "SYNTAX_REPAIR":          return `repair syntax in ${scope}`;
    case "DIALECT_CHANGE":         return `dialect change within ${source ?? "detected language"}`;
    case "LANGUAGE_TRANSLATION":   return `translate from ${source ?? "detected language"} to ${target ?? "unspecified target"} · ${scope}`;
    case "FRAMEWORK_MIGRATION":    return `framework migration · ${scope}`;
    case "DEPENDENCY_MIGRATION":   return `dependency version migration`;
    case "FILE_FORMAT_CONVERSION": return `file format conversion ${source ?? "source"} → ${target ?? "target"}`;
    case "PROJECT_MIGRATION":      return `project-wide migration to ${target ?? "unspecified target"}`;
    case "REFACTOR":               return `refactor · ${scope}`;
    case "BUG_FIX":                return `bug fix · ${scope}`;
    case "FEATURE_CHANGE":         return `feature change · ${scope}`;
    case "TEST_CHANGE":            return `test change · ${scope}`;
    case "CONFIGURATION_CHANGE":   return `configuration change`;
  }
}
