"use client";

// Customer-side Project store · Philip 2026-08-02 · v2 (Supabase-backed).
//
// v1 was localStorage-only. v2 moves the source of truth to the dedicated
// Nex Supabase project via /api/nex/projects/* server routes. localStorage
// now holds ONLY the session identifier — the row data itself lives in
// Postgres so it survives cache clears and (when auth arrives) syncs
// across devices.
//
// Session identity model:
//   - First call to getSessionId() generates a UUID and persists it under
//     the localStorage key `nex.session_id.v1`. Subsequent calls return
//     the same id. This is what the server uses to scope every query.
//   - When real auth lands, we'll attach the session_id rows to the newly
//     authenticated user_id in a one-time migration so no data is orphaned.
//
// Reactivity:
//   - PROJECTS_UPDATED_EVENT still fires after every write so listening
//     components refresh. Cross-tab reactivity needs Realtime — deferred
//     to v2.5.

import type {
  Project,
  ProjectIntent,
  ProjectMessageRole,
  ProjectStatus,
} from "./types";
import { isOpenStatus } from "./types";

const SESSION_KEY = "nex.session_id.v1";
export const PROJECTS_UPDATED_EVENT = "nex-projects-updated";

// ─── Session identity ────────────────────────────────────────────────

/**
 * Return the persistent per-browser session id. Generates one on first
 * call. SSR-safe (returns empty string on the server) — callers should
 * only invoke this from client components / event handlers.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = generateSessionId();
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / quota → return a per-tab id so the tab still works
    return generateSessionId();
  }
}

function generateSessionId(): string {
  // crypto.randomUUID is available in all modern browsers Next.js targets.
  // Fallback for extremely old runtimes: timestamp + random.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function emitUpdate(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECTS_UPDATED_EVENT));
}

// ─── HTTP helpers ────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const sessionId = getSessionId();
  const res = await fetch(path, {
    method: "GET",
    headers: { "x-nex-session-id": sessionId },
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `GET ${path} failed`);
  }
  return data;
}

async function apiJson<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const sessionId = getSessionId();
  const res = await fetch(path, {
    method,
    headers: {
      "x-nex-session-id": sessionId,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json()) as { ok: boolean; error?: string } & T;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `${method} ${path} failed`);
  }
  return data;
}

// ─── Reads ──────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  const { projects } = await apiGet<{ projects: Project[] }>("/api/nex/projects");
  return projects;
}

export async function listOpenProjects(): Promise<Project[]> {
  const all = await listProjects();
  return all.filter((p) => isOpenStatus(p.status));
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const { project } = await apiGet<{ project: Project }>(
      `/api/nex/projects/${encodeURIComponent(id)}`,
    );
    return project;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return null;
    throw err;
  }
}

export async function findOpenProjectForMerchant(
  merchantId: string,
): Promise<Project | null> {
  const open = await listOpenProjects();
  return open.find((p) => p.merchant_id === merchantId) ?? null;
}

// ─── Writes ─────────────────────────────────────────────────────────

export type CreateProjectInput = {
  merchant_id: string;
  merchant_name: string;
  merchant_avatar_url?: string;
  intent?: ProjectIntent;
  purpose?: string;
  initial_customer_message?: string;
  initial_nex_reply?: string;
  conversation_id?: string;
};

/**
 * Auto-compose a starter purpose sentence at project-creation time.
 * Free-text flows use the customer's first message (trimmed). Chip flows
 * use an intent+merchant sentence. Either can be edited later via the
 * detail page's purpose editor.
 */
export function composeStarterPurpose(input: {
  merchantName: string;
  intent?: ProjectIntent;
  firstCustomerMessage?: string;
  merchantTrade?: string;
}): string {
  const first = input.firstCustomerMessage?.trim();
  // If the customer typed something meaningful (not just a chip prefill),
  // use their own words — capped to a single sentence.
  const looksAuthored = first && first.length >= 12 && !isChipPrefill(first);
  if (looksAuthored) {
    const oneLine = first.replace(/\s+/g, " ").slice(0, 240);
    return oneLine.endsWith(".") ? oneLine : oneLine + ".";
  }

  const trade = input.merchantTrade?.toLowerCase();
  const withTrade = trade ? ` for a ${trade} project` : "";
  switch (input.intent) {
    case "quote":    return `Get a quotation from ${input.merchantName}${withTrade}.`;
    case "survey":   return `Book a site survey with ${input.merchantName}${withTrade}.`;
    case "question": return `Get answers from ${input.merchantName}${withTrade}.`;
    case "order":    return `Discuss an existing order with ${input.merchantName}.`;
    case "advice":   return `Get advice from ${input.merchantName}${withTrade}.`;
    default:         return `Work with ${input.merchantName}${withTrade}.`;
  }
}

const CHIP_PREFILLS = new Set([
  "i'd like to request a quotation.",
  "i'd like to arrange a site survey.",
  "i have a question about your services.",
  "i'd like to discuss an existing order.",
  "i'd like some advice before deciding.",
]);
function isChipPrefill(text: string): boolean {
  return CHIP_PREFILLS.has(text.trim().toLowerCase());
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { project } = await apiJson<{ project: Project }>(
    "/api/nex/projects",
    "POST",
    input,
  );
  emitUpdate();
  return project;
}

export async function appendMessage(
  projectId: string,
  role: ProjectMessageRole,
  text: string,
): Promise<Project | null> {
  try {
    const { project } = await apiJson<{ project: Project }>(
      `/api/nex/projects/${encodeURIComponent(projectId)}`,
      "PATCH",
      { append_message: { role, text } },
    );
    emitUpdate();
    return project;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return null;
    throw err;
  }
}

export async function updateStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<Project | null> {
  try {
    const { project } = await apiJson<{ project: Project }>(
      `/api/nex/projects/${encodeURIComponent(projectId)}`,
      "PATCH",
      { status },
    );
    emitUpdate();
    return project;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return null;
    throw err;
  }
}

export async function updateConversationId(
  projectId: string,
  conversationId: string,
): Promise<Project | null> {
  try {
    const { project } = await apiJson<{ project: Project }>(
      `/api/nex/projects/${encodeURIComponent(projectId)}`,
      "PATCH",
      { conversation_id: conversationId },
    );
    emitUpdate();
    return project;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return null;
    throw err;
  }
}

export async function updatePurpose(
  projectId: string,
  purpose: string | null,
): Promise<Project | null> {
  try {
    const { project } = await apiJson<{ project: Project }>(
      `/api/nex/projects/${encodeURIComponent(projectId)}`,
      "PATCH",
      { purpose },
    );
    emitUpdate();
    return project;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return null;
    throw err;
  }
}

export async function cancelProject(projectId: string): Promise<boolean> {
  try {
    await apiJson<Record<string, never>>(
      `/api/nex/projects/${encodeURIComponent(projectId)}`,
      "DELETE",
    );
    emitUpdate();
    return true;
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") return false;
    throw err;
  }
}

// ─── Time-format helper (unchanged from v1) ─────────────────────────

export function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m === 1 ? "1 min ago" : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return h === 1 ? "1 hr ago" : `${h} hrs ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  const date = new Date(ts);
  return date.toLocaleDateString();
}
