// src/lib/nex/security-agent/inspect-doctrines.ts
//
// Run doctrine checks against the proposed change. Each doctrine in
// docs/nex-locked-doctrines.json declares forbidden_patterns · we
// scan proposedFiles[].newContentPreview + change metadata for matches.
//
// Doctrine matching in Stage 1 MVP is pattern-based (regex/substring).
// More sophisticated semantic checks (AST-based) are Phase D.3.b territory.
//
// Every rejection carries the exact doctrine ID and rejection code from
// the registry · never invented.

import type {
  ProposedFileChange,
  SecurityInspectionRequest,
  SecurityRejection,
  SecurityRejectionCode,
} from "./types";
import type { LoadedRegistries } from "./registries";

// Doctrines whose forbidden_patterns can be matched by simple substring
// or regex against proposed file content. High-priority doctrines that
// map to well-defined patterns.
const PATTERN_DOCTRINES: readonly {
  id: string;
  patterns: readonly RegExp[];
  code: SecurityRejectionCode;
  message: string;
}[] = [
  {
    id: "DOC-034",
    patterns: [
      /git\s+push\s+--force/,
      /git\s+reset\s+--hard/,
      /--no-verify/,
      /--no-gpg-sign/,
    ],
    code: "sec.destructive_git_op_attempted",
    message: "Destructive or unsigned git operations forbidden (DOC-034 · CLAUDE.md).",
  },
  {
    id: "DOC-035",
    patterns: [
      /src\/lib\/nex\/truth-engine\/verifier\/[^\/]*\.ts/,
      /db\/migrations\/stage-1a-/,
    ],
    code: "sec.stage_1a_foundation_modified",
    message: "Stage 1a foundation modification requires founder-authored amendment ADR (DOC-035).",
  },
  {
    id: "DOC-018-01",
    patterns: [/R01_THRESHOLDS\s*=\s*\[/, /new\s+threshold\s*:/i],
    code: "sec.r01_threshold_invention_attempted",
    message: "R-01 threshold values are locked in ADR-0314a.2.n (DOC-018).",
  },
  {
    id: "DOC-021",
    patterns: [/LEVENSHTEIN_INITIAL_THRESHOLD\s*=\s*[^0]/],
    code: "sec.r17_threshold_invention_attempted",
    message: "R-17 30% Levenshtein initial threshold is locked in ADR-0314a.2.m D-17.",
  },
  {
    id: "DOC-028",
    patterns: [
      /class\s+\w*Guardian\w*[^{]*\{[^}]*(?:set|update|promote|authoris|create|invent|mutate|persist|apply|register|install)[A-Z]/,
    ],
    code: "sec.guardian_surface_invention_attempted",
    message: "Guardian classes must not expose set*/update*/create*/promote*/authoris*/register*/install*/invent*/mutate*/persist*/apply* methods (DOC-028).",
  },
];

/**
 * Doctrine categories that check WHOLE-CHANGE properties (not per-file):
 *   - change_reason must reference a CAP-XXX
 *   - proposedFiles must not contain secrets/credentials
 */
function inspectChangeReason(
  request: SecurityInspectionRequest,
  registries: LoadedRegistries,
): readonly SecurityRejection[] {
  const rejections: SecurityRejection[] = [];
  const capsInReason = request.changeReason.match(/CAP-\d+/g) ?? [];
  if (capsInReason.length === 0) {
    rejections.push({
      code: "sec.work_map_bypassed",
      message:
        "changeReason must reference at least one CAP-XXX identifier from the Work Map (DOC-036). Empty or capability-less commit reasons are rejected.",
      detail: { changeReason: request.changeReason },
    });
    return rejections;
  }
  // Verify each cited CAP exists in the Work Map
  const knownCaps = new Set(registries.workMap.capabilities.map((c) => c.id));
  for (const cap of capsInReason) {
    if (!knownCaps.has(cap)) {
      rejections.push({
        code: "sec.work_map_bypassed",
        message: `changeReason cites ${cap} but the Work Map has no such capability. Adding a new CAP-XXX requires a founder-authored ADR amendment first.`,
        detail: { unknown_cap: cap },
      });
    }
  }
  return rejections;
}

function inspectSecretsInContent(
  files: readonly ProposedFileChange[],
): readonly SecurityRejection[] {
  const rejections: SecurityRejection[] = [];
  const secretPatterns: readonly { name: string; pattern: RegExp }[] = [
    { name: "aws_access_key_id", pattern: /AKIA[0-9A-Z]{16}/ },
    { name: "openai_api_key", pattern: /sk-[A-Za-z0-9]{40,}/ },
    { name: "supabase_service_role", pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/ },
    { name: "private_key_pem", pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
    { name: "generic_bearer_token", pattern: /Bearer\s+[A-Za-z0-9_.\-]{40,}/ },
  ];
  for (const f of files) {
    if (!f.newContentPreview) continue;
    for (const { name, pattern } of secretPatterns) {
      if (pattern.test(f.newContentPreview)) {
        rejections.push({
          code: "sec.destructive_git_op_attempted",
          message: `File ${f.path} appears to contain a credential (${name}). Secrets scanning per DOC-034 CLAUDE.md discipline.`,
          filePath: f.path,
          detail: { secret_kind: name },
        });
      }
    }
  }
  return rejections;
}

export function inspectDoctrines(
  request: SecurityInspectionRequest,
  registries: LoadedRegistries,
): readonly SecurityRejection[] {
  const rejections: SecurityRejection[] = [];

  // Whole-change checks
  rejections.push(...inspectChangeReason(request, registries));
  rejections.push(...inspectSecretsInContent(request.proposedFiles));

  // Per-file pattern-doctrine checks
  for (const f of request.proposedFiles) {
    // Path-based doctrine checks (file location alone triggers)
    for (const doctrine of PATTERN_DOCTRINES) {
      for (const pattern of doctrine.patterns) {
        if (pattern.test(f.path)) {
          rejections.push({
            code: doctrine.code,
            message: `${doctrine.message} File ${f.path} matches doctrine ${doctrine.id} pattern.`,
            filePath: f.path,
            detail: { doctrine_id: doctrine.id, pattern: pattern.source },
          });
        }
      }
    }
    // Content-based checks
    if (f.newContentPreview) {
      for (const doctrine of PATTERN_DOCTRINES) {
        for (const pattern of doctrine.patterns) {
          if (pattern.test(f.newContentPreview)) {
            rejections.push({
              code: doctrine.code,
              message: `${doctrine.message} Content of ${f.path} matches doctrine ${doctrine.id} pattern.`,
              filePath: f.path,
              detail: { doctrine_id: doctrine.id, pattern: pattern.source },
            });
          }
        }
      }
    }
  }

  return rejections;
}
