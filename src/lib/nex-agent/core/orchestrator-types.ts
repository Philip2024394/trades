// src/lib/nex-agent/core/orchestrator-types.ts
//
// Shared types between orchestrator.ts and discussion.ts (avoids circular imports).

export interface Intent {
  kind: "add_feature" | "fix_bug" | "explain" | "refactor" | "add_migration" | "add_api_route" | "unknown";
  subject: string;
  hints: { area?: string; file_hints: string[]; verbs: string[] };
  confidence: number;
}

export interface PlanStep { number: number; action: string; tool?: string; target?: string; rationale: string; }

export interface ProposedFile {
  path: string;
  action: "create" | "modify";
  language: string;             // "typescript" | "sql" | "markdown" | ...
  why: string;
  preview_content: string;      // template content · never executed · shown in UI as diff-like preview
}

export interface Plan {
  intent: Intent;
  files_to_read: string[];
  files_to_touch: string[];
  files_to_create: string[];
  acceptance_test: string;
  steps: PlanStep[];
  risks: string[];
  verification_gates_to_run: string[];
  read_results: Array<{ tool: string; ok: boolean; summary: string }>;
  proposed_files?: ProposedFile[];  // V1.1 · founder previews before approval
  round?: number;                    // V1.1 · which round this plan version belongs to
}

export interface ReviewResult {
  pass: boolean;
  findings: Array<{ severity: string; rule: string; detail: string; location?: string }>;
  reviewer: "nex2" | "nex3";
  round: number;                     // V1.1
}
