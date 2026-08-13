"use client";

// use-case.ts — client-side hook for Case-aware surfaces (V5).
//
// Manages:
//   · anonymous_return_token in localStorage (V5 · durable across sessions · Stage 1 · C6)
//   · Case creation via POST /api/nex/refacing/cases
//   · Case reads via GET /api/nex/refacing/cases/[rf_id]?token=
//   · Photo attach via POST .../attach-photo
//   · Contact attach via POST .../attach-contact
//
// Storage keys:
//   · `nex-refacing-active-case-id`      → most recent rf_ id
//   · `nex-refacing-token-<rf_id>`       → per-case anonymous return token
//
// Consumers: /nex-app/refacing/page.tsx (upload-first entry) ·
//             /nex-app/refacing/your-project/[rf_id]/page.tsx (resume surface)

import { useCallback, useEffect, useState } from "react";
import type { RefacingCase, FeelingValue, DesignDirection } from "./case-schema";
import type { SeeDirection } from "./retrieval";

const LS_ACTIVE_KEY = "nex-refacing-active-case-id";
const LS_TOKEN_PREFIX = "nex-refacing-token-";

export function getActiveCaseId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LS_ACTIVE_KEY);
}

export function getTokenForCase(caseId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LS_TOKEN_PREFIX + caseId);
}

export function setActiveCase(caseId: string, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_ACTIVE_KEY, caseId);
  window.localStorage.setItem(LS_TOKEN_PREFIX + caseId, token);
}

export function clearActiveCase(): void {
  if (typeof window === "undefined") return;
  const cur = window.localStorage.getItem(LS_ACTIVE_KEY);
  if (cur) window.localStorage.removeItem(LS_TOKEN_PREFIX + cur);
  window.localStorage.removeItem(LS_ACTIVE_KEY);
}

async function jsonPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!json.ok) {
    throw new Error(`POST ${url} failed · ${json.error ?? res.statusText}`);
  }
  return json;
}

async function jsonGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!json.ok) {
    throw new Error(`GET ${url} failed · ${json.error ?? res.statusText}`);
  }
  return json;
}

/**
 * Ensure the visitor has a Case. Creates one on demand.
 * Returns the case-id and token.
 */
export async function ensureCase(): Promise<{ refacing_case_id: string; anonymous_return_token: string }> {
  const existing = getActiveCaseId();
  if (existing) {
    const token = getTokenForCase(existing);
    if (token) return { refacing_case_id: existing, anonymous_return_token: token };
  }

  const created = await jsonPost<{
    ok: true;
    refacing_case_id: string;
    anonymous_return_token: string;
  }>("/api/nex/refacing/cases");

  setActiveCase(created.refacing_case_id, created.anonymous_return_token);
  return {
    refacing_case_id: created.refacing_case_id,
    anonymous_return_token: created.anonymous_return_token,
  };
}

export async function uploadBasePhoto(
  caseId: string,
  token: string,
  file: File
): Promise<{ case: RefacingCase; photo: { image_id: string; captured_at: string } }> {
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/attach-photo?token=${encodeURIComponent(token)}`,
    { method: "POST", body: form }
  );
  const json = (await res.json()) as {
    ok?: boolean;
    error?: string;
    case: RefacingCase;
    photo: { image_id: string; captured_at: string };
  };
  if (!json.ok) throw new Error(`attach-photo failed · ${json.error ?? res.statusText}`);
  return { case: json.case, photo: json.photo };
}

export async function attachContact(
  caseId: string,
  token: string,
  contact: {
    name: string;
    phone?: string;
    email?: string;
    postcode?: string;
    contact_preference?: "whatsapp" | "email" | "phone" | "nex_chat";
  }
): Promise<{ case: RefacingCase }> {
  const json = await jsonPost<{ ok: true; case: RefacingCase }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/attach-contact?token=${encodeURIComponent(token)}`,
    contact
  );
  return { case: json.case };
}

export async function readCase(
  caseId: string,
  token: string
): Promise<RefacingCase> {
  const json = await jsonGet<{ ok: true; case: RefacingCase }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}?token=${encodeURIComponent(token)}`
  );
  return json.case;
}

// ── SEE UI · Step 1-8 · client hooks per SEE-UI-SPEC.md §E ────────────────

export async function confirmBase(
  caseId: string,
  token: string
): Promise<{ case: RefacingCase }> {
  const json = await jsonPost<{ ok: true; case: RefacingCase }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/confirm-base?token=${encodeURIComponent(token)}`
  );
  return { case: json.case };
}

export async function submitIntent(
  caseId: string,
  token: string,
  feelings: FeelingValue[],
  mustNotChangeItems: string[]
): Promise<{ case: RefacingCase }> {
  const json = await jsonPost<{ ok: true; case: RefacingCase }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/intent?token=${encodeURIComponent(token)}`,
    { feelings, must_not_change_items: mustNotChangeItems }
  );
  return { case: json.case };
}

export async function fetchDirections(
  caseId: string,
  token: string
): Promise<{ directions: SeeDirection[]; empty: boolean }> {
  const json = await jsonGet<{ ok: true; directions: SeeDirection[]; empty: boolean }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/directions?token=${encodeURIComponent(token)}`
  );
  return { directions: json.directions, empty: json.empty };
}

export async function selectDirection(
  caseId: string,
  token: string,
  direction: DesignDirection,
  heroImageId: string,
  suggestedName: string,
  reasonForExisting: string,
  keyMaterialsDescription: string,
  referenceImageIds: string[]
): Promise<{ case: RefacingCase }> {
  const json = await jsonPost<{ ok: true; case: RefacingCase }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/select-direction?token=${encodeURIComponent(token)}`,
    {
      direction,
      hero_image_id: heroImageId,
      suggested_name: suggestedName,
      reason_for_existing: reasonForExisting,
      key_materials_description: keyMaterialsDescription,
      reference_image_ids: referenceImageIds,
    }
  );
  return { case: json.case };
}

export async function saveDirection(
  caseId: string,
  token: string,
  direction: DesignDirection,
  name: string,
  reasonForExisting: string,
  keyMaterialsDescription: string,
  referenceImageIds: string[]
): Promise<{ case: RefacingCase; saved_count: number }> {
  const json = await jsonPost<{ ok: true; case: RefacingCase; saved_count: number }>(
    `/api/nex/refacing/cases/${encodeURIComponent(caseId)}/save-direction?token=${encodeURIComponent(token)}`,
    {
      direction,
      name,
      reason_for_existing: reasonForExisting,
      key_materials_description: keyMaterialsDescription,
      reference_image_ids: referenceImageIds,
    }
  );
  return { case: json.case, saved_count: json.saved_count };
}

/**
 * React hook · resolves the current Case (if any) from localStorage and fetches it.
 * Returns { case, loading, error, refresh }.
 * Never creates a Case implicitly · call ensureCase() from an action handler.
 */
export function useCurrentRefacingCase(): {
  refacingCase: RefacingCase | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [refacingCase, setRefacingCase] = useState<RefacingCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = getActiveCaseId();
      if (!id) {
        setRefacingCase(null);
        return;
      }
      const token = getTokenForCase(id);
      if (!token) {
        setRefacingCase(null);
        return;
      }
      const c = await readCase(id, token);
      setRefacingCase(c);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { refacingCase, loading, error, refresh };
}
