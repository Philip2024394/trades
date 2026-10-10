// src/lib/nex-native/family-safety/child-account-creation/_server-actions.ts
//
// NEX Family Safety · Child Account Creation (CC-1) · server actions.
// --------------------------------------------------------------------
// Thin "server action" wrappers that:
//   1. Resolve the current viewer via the sealed session primitive
//      (`resolveNexAppSessionFromContext`) · never trust the caller.
//   2. Call the appropriate service method with `actorAccountId` set
//      to the resolved viewer's `nex_account.id`.
//   3. Return a bare result the UI can consume · never leak errors
//      verbatim · map internal errors to a stable error code string.
//
// Load-bearing anti-patterns:
//   · NEVER accept a `parentAccountId` or `actorAccountId` input from
//     the UI · the viewer is the sole authority on who they are.
//   · NEVER return a plaintext credential · the password-reset action
//     returns ONLY the opaque reference ticket.
//   · NEVER expose raw bytes · the upload action takes bytes IN but
//     returns ONLY the opaque submission id (bytes travel to secure
//     storage, never back out).

"use server";

import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";

import {
  CHILD_CREATION_ERROR_CODES,
  type ChildCreationRequest,
  type ChildCreationState,
  type GovernmentIdDocumentType,
  type ParentCustodyLink,
  type ParentCustodyAuditEntry,
  UI_TO_DB_DOCUMENT_TYPE,
} from "./types";
import * as childCreationService from "./child-account-creation-service";
import * as custodyService from "../custody/parent-custody-service";
import * as auditLogService from "../custody/parent-custody-audit-log-service";
import {
  submitDocument,
  type IdDocumentMimeType,
} from "../id-verifier/id-verification-storage";
import {
  isChildCreateUIEnabled,
  isChildCreateLiveModeEnabled,
} from "./feature-flag";

// ─────────────────────────────────────────────────────────────────────
// §1 · Shared result envelope
// ─────────────────────────────────────────────────────────────────────

export type ServerActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string };

async function resolveActor(): Promise<string | null> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) return null;
  return session.account.id;
}

function failUnauthenticated<T>(): ServerActionResult<T> {
  return { ok: false, code: "child-creation.unauthenticated" };
}

function failUIDisabled<T>(): ServerActionResult<T> {
  return { ok: false, code: "child-creation.ui_disabled" };
}

function wrap<T>(fn: () => Promise<T>): Promise<ServerActionResult<T>> {
  return fn()
    .then((value) => ({ ok: true as const, value }))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // Only pass through known error codes · otherwise generic.
      const known = Object.values(CHILD_CREATION_ERROR_CODES).includes(
        msg as (typeof CHILD_CREATION_ERROR_CODES)[keyof typeof CHILD_CREATION_ERROR_CODES],
      );
      return {
        ok: false as const,
        code: known ? msg : "child-creation.internal_error",
      };
    });
}

// ─────────────────────────────────────────────────────────────────────
// §2 · createChildCreationRequestAction
// ─────────────────────────────────────────────────────────────────────

export async function createChildCreationRequestAction(input: {
  readonly childDisplayName: string;
  readonly childDeclaredDateOfBirth: string;
}): Promise<ServerActionResult<ChildCreationRequest>> {
  if (!isChildCreateUIEnabled()) return failUIDisabled();
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    childCreationService.createChildCreationRequest({
      parentAccountId: actor,
      actorAccountId: actor,
      childDisplayName: input.childDisplayName,
      childDeclaredDateOfBirth: input.childDeclaredDateOfBirth,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// §3 · uploadIdDocumentAction
// ─────────────────────────────────────────────────────────────────────

export async function uploadIdDocumentAction(input: {
  readonly requestId: string;
  readonly documentType: GovernmentIdDocumentType;
  readonly documentBytes: Uint8Array;
  readonly mimeType: IdDocumentMimeType;
  readonly idempotencyKey: string;
}): Promise<ServerActionResult<{ submissionId: string; request: ChildCreationRequest }>> {
  if (!isChildCreateUIEnabled()) return failUIDisabled();
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  const dbDocType = UI_TO_DB_DOCUMENT_TYPE[input.documentType];
  if (!dbDocType) {
    return { ok: false, code: CHILD_CREATION_ERROR_CODES.INVALID_MIME };
  }
  return wrap(async () => {
    const stored = await submitDocument({
      submitterAccountId: actor,
      documentType: dbDocType,
      documentBytes: input.documentBytes,
      mimeType: input.mimeType,
      idempotencyKey: input.idempotencyKey,
    });
    const request = await childCreationService.attachIdSubmission({
      requestId: input.requestId,
      submissionId: stored.submissionId,
      actorAccountId: actor,
    });
    return { submissionId: stored.submissionId, request };
  });
}

// ─────────────────────────────────────────────────────────────────────
// §4 · transitionCreationStateAction
// ─────────────────────────────────────────────────────────────────────

export async function transitionCreationStateAction(input: {
  readonly requestId: string;
  readonly nextState: ChildCreationState;
  readonly reason?: string;
}): Promise<ServerActionResult<ChildCreationRequest>> {
  if (!isChildCreateUIEnabled()) return failUIDisabled();
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    childCreationService.transitionCreationState({
      requestId: input.requestId,
      nextState: input.nextState,
      actorAccountId: actor,
      reason: input.reason,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// §5 · cancelRequestAction
// ─────────────────────────────────────────────────────────────────────

export async function cancelRequestAction(input: {
  readonly requestId: string;
  readonly reason?: string;
}): Promise<ServerActionResult<ChildCreationRequest>> {
  if (!isChildCreateUIEnabled()) return failUIDisabled();
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    childCreationService.cancelRequest(input.requestId, actor, input.reason),
  );
}

// ─────────────────────────────────────────────────────────────────────
// §6 · materialiseChildAccountAction · live-mode gated
// ─────────────────────────────────────────────────────────────────────

export async function materialiseChildAccountAction(input: {
  readonly requestId: string;
}): Promise<ServerActionResult<ChildCreationRequest>> {
  if (!isChildCreateUIEnabled()) return failUIDisabled();
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    childCreationService.materialiseChildAccount({
      requestId: input.requestId,
      actorAccountId: actor,
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────
// §7 · getRequestByIdAction + listRequestsForParentAction
// ─────────────────────────────────────────────────────────────────────

export async function getRequestByIdAction(input: {
  readonly requestId: string;
}): Promise<ServerActionResult<ChildCreationRequest | null>> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    childCreationService.getRequestById(input.requestId, actor),
  );
}

export async function listRequestsForParentAction(): Promise<
  ServerActionResult<readonly ChildCreationRequest[]>
> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() => childCreationService.listRequestsForParent(actor));
}

// ─────────────────────────────────────────────────────────────────────
// §8 · Custody actions
// ─────────────────────────────────────────────────────────────────────

export async function listCustodiesForParentAction(): Promise<
  ServerActionResult<readonly ParentCustodyLink[]>
> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() => custodyService.listCustodiesForParent(actor));
}

export async function getCustodyByIdAction(input: {
  readonly custodyId: string;
}): Promise<ServerActionResult<ParentCustodyLink | null>> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() => custodyService.getCustodyById(input.custodyId, actor));
}

export async function revokeCustodyAction(input: {
  readonly custodyId: string;
  readonly reason: string;
}): Promise<ServerActionResult<ParentCustodyLink>> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    custodyService.revokeCustody(input.custodyId, actor, input.reason),
  );
}

export async function requestPasswordResetForChildAction(input: {
  readonly custodyId: string;
}): Promise<ServerActionResult<{ resetTokenRefOpaque: string; expiresAt: string }>> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    custodyService.requestPasswordResetForChild({
      custodyId: input.custodyId,
      actorAccountId: actor,
    }),
  );
}

export async function readRecentAuditForCustodyAction(input: {
  readonly custodyId: string;
  readonly limit?: number;
}): Promise<ServerActionResult<readonly ParentCustodyAuditEntry[]>> {
  const actor = await resolveActor();
  if (!actor) return failUnauthenticated();
  return wrap(() =>
    auditLogService.readRecentForCustody(input.custodyId, actor, input.limit),
  );
}

// ─────────────────────────────────────────────────────────────────────
// §9 · Flag introspection (safe · boolean only)
// ─────────────────────────────────────────────────────────────────────

export async function isChildCreateLiveModeEnabledAction(): Promise<
  ServerActionResult<boolean>
> {
  return { ok: true, value: isChildCreateLiveModeEnabled() };
}
