// src/lib/nex-native/family-safety/child-account-creation/actions.ts
//
// NEX Family Safety · child-account-creation server actions.
// ----------------------------------------------------------
// Authored by CC-2 (wizard UI agent) 2026-10-10.
// Every action resolves the sealed NEX session first · if there is
// no session, the action throws `NOT_SIGNED_IN` and the caller must
// route to /nex-native/sign-in.
//
// TODO (CC-1): the body of each action currently calls the LOCAL
// STUB service. When CC-1's wired module ships, change the imports
// at the top of this file to point at the authoritative module · the
// public interfaces (arguments + results) must not change.

"use server";

import "server-only";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import * as service from "./service";
import * as custodyService from "../custody/service";
import type {
  CancelRequestInput,
  CreateChildCreationRequestInput,
  CreateChildCreationRequestResult,
  TransitionCreationStateInput,
  UploadIdDocumentInput,
  UploadIdDocumentResult,
} from "./service";
import type { RequestPasswordResetForChildInput } from "../custody/service";
import type { ChildPasswordResetTicket } from "./types";

async function requireSessionAccountId(): Promise<string> {
  const s = await resolveNexAppSessionFromContext();
  if (!s) throw new Error("NOT_SIGNED_IN");
  return s.account.id;
}

export async function createChildCreationRequestAction(
  input: CreateChildCreationRequestInput,
): Promise<CreateChildCreationRequestResult> {
  const parentAccountId = await requireSessionAccountId();
  return service.createChildCreationRequest(parentAccountId, input);
}

export async function uploadIdDocumentAction(
  input: UploadIdDocumentInput,
): Promise<UploadIdDocumentResult> {
  const parentAccountId = await requireSessionAccountId();
  return service.uploadIdDocument(parentAccountId, input);
}

export async function transitionCreationStateAction(
  input: TransitionCreationStateInput,
): Promise<void> {
  const parentAccountId = await requireSessionAccountId();
  await service.transitionCreationState(parentAccountId, input);
}

export async function cancelRequestAction(
  input: CancelRequestInput,
): Promise<void> {
  const parentAccountId = await requireSessionAccountId();
  await service.cancelRequest(parentAccountId, input);
}

export async function requestPasswordResetForChildAction(
  input: RequestPasswordResetForChildInput,
): Promise<ChildPasswordResetTicket> {
  const parentAccountId = await requireSessionAccountId();
  return custodyService.requestPasswordResetForChild(parentAccountId, input);
}

export async function revokeCustodyAction(custodyId: string): Promise<void> {
  const parentAccountId = await requireSessionAccountId();
  await custodyService.revokeCustody(parentAccountId, custodyId);
}

/**
 * Pure read helper surfaced to the client only for the status-poll
 * hook on `/create-child/[requestId]/status`. Returns null when the
 * caller is not the request's parent.
 */
export async function readRequestForParentAction(requestId: string) {
  const parentAccountId = await requireSessionAccountId();
  return service.getRequestById(parentAccountId, requestId);
}

/**
 * Helper for the legal-clearance banner. Read on the server so the
 * client never has to re-check an env var.
 */
export async function isLiveModeAuthorisedAction(): Promise<boolean> {
  return isFamilySafetyProductionAuthorised();
}
