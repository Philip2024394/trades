// Server-side Nex Projects repository · Philip 2026-08-02.
//
// All Supabase reads/writes for the Projects capability. The API routes
// under /api/nex/projects/* call these functions after validating the
// x-nex-session-id header. Client code MUST NOT import this — it uses
// the Nex Supabase server-only client.

import "server-only";
import { nexSupabase } from "@/lib/nex/supabase";
import type {
  Project,
  ProjectIntent,
  ProjectMember,
  ProjectMessage,
  ProjectMessageRole,
  ProjectStatus,
} from "./types";

// ─── Row shapes (Supabase) ───────────────────────────────────────────

type ProjectRow = {
  id: string;
  session_id: string;
  owner_user_id: string | null;
  merchant_id: string;
  merchant_name: string;
  merchant_avatar_url: string | null;
  title: string;
  purpose: string | null;
  status: ProjectStatus;
  intent: ProjectIntent | null;
  conversation_id: string | null;
  members: ProjectMember[];
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  project_id: string;
  role: ProjectMessageRole;
  text: string;
  created_at: string;
};

// ─── Missing-table detection · graceful degradation (Philip 2026-08-02)
//
// If Philip hasn't yet run supabase/migrations/20260802220000_nex_projects_v1.sql
// against the Nex Supabase project, every SELECT returns 42P01 ("relation
// does not exist"). Reads should degrade to empty rather than 500 the whole
// UI. Writes still fail loudly so users never think their data was saved.
// A one-shot console warning tells the developer exactly what to do.

let migrationWarningLogged = false;
function isMissingTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01") return true;
  const msg = err.message ?? "";
  return /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg);
}
function warnMigrationMissing(): void {
  if (migrationWarningLogged) return;
  migrationWarningLogged = true;
  console.warn(
    "[nex-projects] Nex Supabase tables not found. Apply the migration:\n" +
    "  1. Open the Nex Supabase dashboard (project ijvqdvsvwtwxzcqmoqit)\n" +
    "  2. SQL Editor → New query\n" +
    "  3. Paste the contents of supabase/migrations/20260802220000_nex_projects_v1.sql\n" +
    "  4. Run\n" +
    "Until this is done, Projects reads will return empty and writes will fail.",
  );
}

// ─── Row → domain mappers ────────────────────────────────────────────

function toProject(row: ProjectRow, messages: MessageRow[]): Project {
  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose ?? undefined,
    status: row.status,
    merchant_id: row.merchant_id,
    merchant_name: row.merchant_name,
    merchant_avatar_url: row.merchant_avatar_url ?? undefined,
    members: Array.isArray(row.members) ? row.members : [],
    messages: messages
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(toMessage),
    intent: row.intent ?? undefined,
    conversation_id: row.conversation_id ?? undefined,
    created_at: Date.parse(row.created_at),
    updated_at: Date.parse(row.updated_at),
  };
}

function toMessage(row: MessageRow): ProjectMessage {
  return {
    id: row.id,
    role: row.role,
    text: row.text,
    created_at: Date.parse(row.created_at),
  };
}

// ─── List projects for a session ────────────────────────────────────

export async function listProjectsForSession(sessionId: string): Promise<Project[]> {
  const { data: rows, error } = await nexSupabase
    .from("nex_projects")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingTableError(error)) { warnMigrationMissing(); return []; }
    throw new Error(`listProjectsForSession failed: ${error.message}`);
  }
  if (!rows || rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: msgs, error: mErr } = await nexSupabase
    .from("nex_projects_messages")
    .select("*")
    .in("project_id", ids);
  if (mErr) {
    if (isMissingTableError(mErr)) { warnMigrationMissing(); return (rows as ProjectRow[]).map((r) => toProject(r, [])); }
    throw new Error(`listProjectsForSession messages failed: ${mErr.message}`);
  }

  const byProject = new Map<string, MessageRow[]>();
  for (const m of (msgs ?? []) as MessageRow[]) {
    const arr = byProject.get(m.project_id) ?? [];
    arr.push(m);
    byProject.set(m.project_id, arr);
  }

  return (rows as ProjectRow[]).map((r) => toProject(r, byProject.get(r.id) ?? []));
}

// ─── Get one project ────────────────────────────────────────────────

export async function getProjectForSession(
  sessionId: string,
  projectId: string,
): Promise<Project | null> {
  const { data: row, error } = await nexSupabase
    .from("nex_projects")
    .select("*")
    .eq("session_id", sessionId)
    .eq("id", projectId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) { warnMigrationMissing(); return null; }
    throw new Error(`getProjectForSession failed: ${error.message}`);
  }
  if (!row) return null;

  const { data: msgs, error: mErr } = await nexSupabase
    .from("nex_projects_messages")
    .select("*")
    .eq("project_id", projectId);
  if (mErr) {
    if (isMissingTableError(mErr)) { warnMigrationMissing(); return toProject(row as ProjectRow, []); }
    throw new Error(`getProjectForSession messages failed: ${mErr.message}`);
  }

  return toProject(row as ProjectRow, (msgs ?? []) as MessageRow[]);
}

// ─── Create ─────────────────────────────────────────────────────────

export type CreateProjectServerInput = {
  sessionId: string;
  merchant_id: string;
  merchant_name: string;
  merchant_avatar_url?: string;
  intent?: ProjectIntent;
  purpose?: string;
  initial_customer_message?: string;
  initial_nex_reply?: string;
  conversation_id?: string;
};

export async function createProjectForSession(
  input: CreateProjectServerInput,
): Promise<Project> {
  const title = titleForIntent(input.intent, input.merchant_name);
  const members: ProjectMember[] = [
    { role: "customer", display_name: "You" },
    {
      role: "merchant",
      display_name: input.merchant_name,
      merchant_id: input.merchant_id,
      avatar_url: input.merchant_avatar_url,
    },
    { role: "nex", display_name: "Nex" },
  ];

  const { data: row, error } = await nexSupabase
    .from("nex_projects")
    .insert({
      session_id: input.sessionId,
      merchant_id: input.merchant_id,
      merchant_name: input.merchant_name,
      merchant_avatar_url: input.merchant_avatar_url ?? null,
      title,
      purpose: input.purpose?.trim() || null,
      status: "waiting_for_quotation",
      intent: input.intent ?? null,
      conversation_id: input.conversation_id ?? null,
      members,
    })
    .select("*")
    .single();
  if (error || !row) throw new Error(`createProjectForSession failed: ${error?.message}`);

  const projectId = (row as ProjectRow).id;
  const messages: Array<{ role: ProjectMessageRole; text: string }> = [];
  if (input.initial_customer_message) {
    messages.push({ role: "customer", text: input.initial_customer_message });
  }
  if (input.initial_nex_reply) {
    messages.push({ role: "nex", text: input.initial_nex_reply });
  }
  if (messages.length > 0) {
    const { error: mErr } = await nexSupabase.from("nex_projects_messages").insert(
      messages.map((m) => ({ project_id: projectId, role: m.role, text: m.text })),
    );
    if (mErr) throw new Error(`createProjectForSession messages failed: ${mErr.message}`);
  }

  const created = await getProjectForSession(input.sessionId, projectId);
  if (!created) throw new Error("createProjectForSession · project vanished after insert");
  return created;
}

// ─── Append message ─────────────────────────────────────────────────

export async function appendMessageForSession(
  sessionId: string,
  projectId: string,
  role: ProjectMessageRole,
  text: string,
): Promise<Project | null> {
  // Ownership guard — refuse to write to a project this session doesn't own
  const owned = await getProjectForSession(sessionId, projectId);
  if (!owned) return null;

  const { error } = await nexSupabase
    .from("nex_projects_messages")
    .insert({ project_id: projectId, role, text });
  if (error) throw new Error(`appendMessageForSession failed: ${error.message}`);

  return getProjectForSession(sessionId, projectId);
}

// ─── Update status ──────────────────────────────────────────────────

export async function updateStatusForSession(
  sessionId: string,
  projectId: string,
  status: ProjectStatus,
): Promise<Project | null> {
  const { data: row, error } = await nexSupabase
    .from("nex_projects")
    .update({ status })
    .eq("session_id", sessionId)
    .eq("id", projectId)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`updateStatusForSession failed: ${error.message}`);
  if (!row) return null;
  return getProjectForSession(sessionId, projectId);
}

// ─── Update purpose ─────────────────────────────────────────────────

export async function updatePurposeForSession(
  sessionId: string,
  projectId: string,
  purpose: string | null,
): Promise<Project | null> {
  const clean = purpose?.trim() || null;
  const { error } = await nexSupabase
    .from("nex_projects")
    .update({ purpose: clean })
    .eq("session_id", sessionId)
    .eq("id", projectId);
  if (error) throw new Error(`updatePurposeForSession failed: ${error.message}`);
  return getProjectForSession(sessionId, projectId);
}

// ─── Update conversation id ─────────────────────────────────────────

export async function updateConversationIdForSession(
  sessionId: string,
  projectId: string,
  conversationId: string,
): Promise<Project | null> {
  const { error } = await nexSupabase
    .from("nex_projects")
    .update({ conversation_id: conversationId })
    .eq("session_id", sessionId)
    .eq("id", projectId);
  if (error) throw new Error(`updateConversationIdForSession failed: ${error.message}`);
  return getProjectForSession(sessionId, projectId);
}

// ─── Cancel (delete) ────────────────────────────────────────────────

export async function cancelProjectForSession(
  sessionId: string,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await nexSupabase
    .from("nex_projects")
    .delete()
    .eq("session_id", sessionId)
    .eq("id", projectId)
    .select("id");
  if (error) throw new Error(`cancelProjectForSession failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// ─── Helpers ────────────────────────────────────────────────────────

function titleForIntent(intent: ProjectIntent | undefined, merchantName: string): string {
  switch (intent) {
    case "quote":    return `Quotation from ${merchantName}`;
    case "survey":   return `Site survey with ${merchantName}`;
    case "question": return `Question for ${merchantName}`;
    case "order":    return `Existing order with ${merchantName}`;
    case "advice":   return `Advice from ${merchantName}`;
    default:         return `Project with ${merchantName}`;
  }
}
