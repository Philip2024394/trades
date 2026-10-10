// src/lib/nex-agent/code-engine/capability-save-push-envelope.ts
//
// NEX1 · Save/Push Envelope · Founder-authorised 2026-09-19 (§10-14, §18).
// Ledger B additive · Zero LLM · Deterministic.
//
// PURPOSE
//   Produce the deterministic state envelope that drives the "user is closing
//   workstation" confirmation modal. Consumes the project state detector +
//   provider registry snapshot, produces:
//
//     · one of 7 close-flow states
//     · plain-language message
//     · list of allowed close actions
//     · list of connected providers (from registry snapshot)
//     · anti-fabrication flag: "remote_save_verified" ONLY true when
//       PUSH_SUCCEEDED with fresh evidence
//
// FOUNDER PRINCIPLES HONOURED
//   · §11 "use plain language first · not Git terminology"
//   · §12 "only show providers that are actually connected"
//   · §14 "do not tell the user the project is saved remotely" on failure
//   · §18 "must never confuse local save with remote backup"

import { createHash } from "node:crypto";
import type { ProjectStateAssessment, ProjectGitState } from "./capability-project-state-detector";

export const SAVE_PUSH_ENVELOPE_VERSION = "save-push-envelope.v1.2026-09-19";

// ── 7 close-flow states (founder §10) ────────────────────────────────────

export type CloseFlowState =
  | "NO_CHANGES"
  | "LOCAL_UNCOMMITTED_CHANGES"
  | "LOCAL_COMMITTED_BUT_UNPUSHED"
  | "UNTRACKED_FILES"
  | "PENDING_GENERATED_FILES"
  | "PENDING_PROJECT_CHANGES"
  | "PUSHED_AND_CURRENT";

export type CloseAction =
  | "close_silently"
  | "prompt_save_locally_and_close"
  | "prompt_push_and_close"
  | "prompt_save_and_push"
  | "prompt_choose_provider"
  | "prompt_keep_working"
  | "prompt_connect_provider";

export interface ProviderSnapshot {
  readonly provider_id: string;         // e.g. "github", "gitlab", "bitbucket"
  readonly display_name: string;
  readonly connected: boolean;
  readonly authenticated: boolean;
  readonly has_default_repository: boolean;
}

export interface SavePushEnvelopeInput {
  readonly project_state: ProjectStateAssessment;
  readonly providers: readonly ProviderSnapshot[];
  readonly project_display_name: string;
  /** Optional generated-file marker: files known to have been auto-generated. */
  readonly known_generated_files?: readonly string[];
}

export interface SavePushEnvelope {
  readonly close_flow_state: CloseFlowState;
  readonly plain_language_message: string;
  readonly allowed_actions: readonly CloseAction[];
  readonly connected_providers: readonly ProviderSnapshot[];
  readonly remote_save_verified: boolean;
  readonly remote_save_verified_reason: string;
  readonly show_warning: boolean;
  readonly evidence_signals: readonly string[];
  readonly input_digest: string;
  readonly assessed_at_iso: string;
  readonly zero_llm: true;
  readonly ledger: "B";
  readonly version: string;
}

// ── Public entry ─────────────────────────────────────────────────────────

export function buildSavePushEnvelope(input: SavePushEnvelopeInput): SavePushEnvelope {
  const state = input.project_state.state;
  const signals: string[] = [`project_git_state=${state}`];
  const connectedProviders = input.providers.filter((p) => p.connected);
  const authenticatedProviders = connectedProviders.filter((p) => p.authenticated);
  signals.push(`connected_providers=${connectedProviders.length}`);
  signals.push(`authenticated_providers=${authenticatedProviders.length}`);

  const anyGenerated = (input.known_generated_files?.length ?? 0) > 0;
  if (anyGenerated) signals.push(`generated_files=${input.known_generated_files!.length}`);

  // ── Anti-fabrication: remote_save_verified ONLY when PUSH_SUCCEEDED ──
  // Per §14/§18: never tell user their work is saved remotely without evidence
  const remote_save_verified = state === "PUSH_SUCCEEDED";
  const remote_save_verified_reason = remote_save_verified
    ? "project_state=PUSH_SUCCEEDED · remote ref matches local HEAD with fresh push evidence"
    : `project_state=${state} · no verified remote-push evidence for current HEAD`;

  // ── Map project state → close-flow state ────────────────────────────
  const close_flow_state = mapCloseFlowState(state, anyGenerated);
  signals.push(`close_flow_state=${close_flow_state}`);

  // ── Assemble allowed actions + message ───────────────────────────────
  const allowed_actions: CloseAction[] = [];
  let plain_language_message = "";
  let show_warning = false;

  switch (close_flow_state) {
    case "NO_CHANGES":
      plain_language_message = "Project is up to date.";
      allowed_actions.push("close_silently");
      show_warning = false;
      break;
    case "PUSHED_AND_CURRENT":
      plain_language_message = "Project is saved and up to date.";
      allowed_actions.push("close_silently");
      show_warning = false;
      break;
    case "LOCAL_UNCOMMITTED_CHANGES":
      plain_language_message = `Your project "${input.project_display_name}" has unsaved changes.`;
      if (authenticatedProviders.length === 0) {
        allowed_actions.push("prompt_save_locally_and_close");
        allowed_actions.push("prompt_connect_provider");
      } else if (authenticatedProviders.length === 1) {
        allowed_actions.push("prompt_save_and_push");
        allowed_actions.push("prompt_save_locally_and_close");
      } else {
        allowed_actions.push("prompt_choose_provider");
        allowed_actions.push("prompt_save_locally_and_close");
      }
      allowed_actions.push("prompt_keep_working");
      show_warning = true;
      break;
    case "LOCAL_COMMITTED_BUT_UNPUSHED":
      plain_language_message = `Your project "${input.project_display_name}" has changes that haven't been pushed yet.`;
      if (authenticatedProviders.length === 0) {
        allowed_actions.push("prompt_save_locally_and_close");
        allowed_actions.push("prompt_connect_provider");
      } else if (authenticatedProviders.length === 1) {
        allowed_actions.push("prompt_push_and_close");
        allowed_actions.push("prompt_save_locally_and_close");
      } else {
        allowed_actions.push("prompt_choose_provider");
        allowed_actions.push("prompt_save_locally_and_close");
      }
      allowed_actions.push("prompt_keep_working");
      show_warning = true;
      break;
    case "UNTRACKED_FILES":
      plain_language_message = `Your project "${input.project_display_name}" has new files that haven't been saved yet.`;
      if (authenticatedProviders.length === 0) {
        allowed_actions.push("prompt_save_locally_and_close");
        allowed_actions.push("prompt_connect_provider");
      } else {
        allowed_actions.push("prompt_save_and_push");
        allowed_actions.push("prompt_save_locally_and_close");
      }
      allowed_actions.push("prompt_keep_working");
      show_warning = true;
      break;
    case "PENDING_GENERATED_FILES":
      plain_language_message = `Your project "${input.project_display_name}" has newly generated files that haven't been saved yet.`;
      allowed_actions.push("prompt_save_locally_and_close");
      if (authenticatedProviders.length > 0) allowed_actions.push("prompt_save_and_push");
      allowed_actions.push("prompt_keep_working");
      show_warning = true;
      break;
    case "PENDING_PROJECT_CHANGES":
      plain_language_message = `Your project "${input.project_display_name}" needs attention before closing.`;
      allowed_actions.push("prompt_save_locally_and_close");
      allowed_actions.push("prompt_keep_working");
      show_warning = true;
      break;
  }

  const input_digest = createHash("sha256")
    .update(JSON.stringify({
      state,
      close_flow_state,
      providers: connectedProviders.map((p) => `${p.provider_id}:${p.authenticated}`).sort(),
      any_generated: anyGenerated,
      version: SAVE_PUSH_ENVELOPE_VERSION,
    }))
    .digest("hex")
    .slice(0, 16);

  return {
    close_flow_state,
    plain_language_message,
    allowed_actions,
    connected_providers: connectedProviders,
    remote_save_verified,
    remote_save_verified_reason,
    show_warning,
    evidence_signals: signals,
    input_digest,
    assessed_at_iso: new Date().toISOString(),
    zero_llm: true,
    ledger: "B",
    version: SAVE_PUSH_ENVELOPE_VERSION,
  };
}

// ── Private ──────────────────────────────────────────────────────────────

function mapCloseFlowState(
  state: ProjectGitState,
  hasGenerated: boolean,
): CloseFlowState {
  // Ordered predicates. Every branch has concrete input criteria.
  if (state === "PUSH_SUCCEEDED") return "PUSHED_AND_CURRENT";
  if (state === "REMOTE_CURRENT") return "PUSHED_AND_CURRENT";
  if (state === "NOT_A_REPOSITORY") return hasGenerated ? "PENDING_GENERATED_FILES" : "NO_CHANGES";
  if (state === "LOCAL_MODIFIED") return "LOCAL_UNCOMMITTED_CHANGES";
  if (state === "LOCAL_UNTRACKED") {
    return hasGenerated ? "PENDING_GENERATED_FILES" : "UNTRACKED_FILES";
  }
  if (state === "LOCAL_COMMITTED") return "LOCAL_COMMITTED_BUT_UNPUSHED";
  if (state === "PUSH_PENDING") return "LOCAL_COMMITTED_BUT_UNPUSHED";
  if (state === "PUSH_FAILED") return "PENDING_PROJECT_CHANGES";
  if (state === "REMOTE_CONFLICT") return "PENDING_PROJECT_CHANGES";
  if (state === "REMOTE_BEHIND") return "PENDING_PROJECT_CHANGES";
  if (state === "LOCAL_CLEAN") return "NO_CHANGES";
  return "PENDING_PROJECT_CHANGES";
}
