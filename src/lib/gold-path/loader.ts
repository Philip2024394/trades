// Gold Path loader — task queries + insertions.

import { createClient } from "@supabase/supabase-js";
import type {
  GoldPathStatus,
  GoldPathTask,
  GoldPathTaskKind,
  GoldPathUrgency
} from "./types";

function client() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type Row = {
  id: string;
  merchant_id: string;
  task_kind: string;
  title: string;
  body_markdown: string | null;
  cta_kind: string | null;
  cta_target: string | null;
  urgency: GoldPathUrgency;
  source_event_id: string | null;
  source_projection_type: string | null;
  status: GoldPathStatus;
  opens_at: string;
  expires_at: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToTask(row: Row): GoldPathTask {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    taskKind: row.task_kind as GoldPathTaskKind,
    title: row.title,
    bodyMarkdown: row.body_markdown,
    ctaKind: row.cta_kind,
    ctaTarget: row.cta_target,
    urgency: row.urgency,
    sourceEventId: row.source_event_id,
    sourceProjectionType: row.source_projection_type,
    status: row.status,
    opensAt: row.opens_at,
    expiresAt: row.expires_at,
    doneAt: row.done_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function insertGoldPathTask(input: {
  merchantId: string;
  taskKind: GoldPathTaskKind;
  title: string;
  bodyMarkdown?: string;
  ctaKind?: string;
  ctaTarget?: string;
  urgency?: GoldPathUrgency;
  sourceEventId?: string;
  sourceProjectionType?: string;
  expiresAt?: string;
}): Promise<GoldPathTask | null> {
  const c = client();
  if (!c) return null;
  const { data, error } = await c
    .from("gold_path_tasks")
    .upsert(
      {
        merchant_id: input.merchantId,
        task_kind: input.taskKind,
        title: input.title,
        body_markdown: input.bodyMarkdown ?? null,
        cta_kind: input.ctaKind ?? null,
        cta_target: input.ctaTarget ?? null,
        urgency: input.urgency ?? "normal",
        source_event_id: input.sourceEventId ?? null,
        source_projection_type: input.sourceProjectionType ?? null,
        expires_at: input.expiresAt ?? null,
        status: "open"
      },
      { onConflict: "source_event_id,task_kind" }
    )
    .select("*")
    .maybeSingle();
  if (error || !data) return null;
  return rowToTask(data as Row);
}

export async function loadOpenTasks(
  merchantId: string,
  limit = 20
): Promise<GoldPathTask[]> {
  const c = client();
  if (!c) return [];
  const { data } = await c
    .from("gold_path_tasks")
    .select("*")
    .eq("merchant_id", merchantId)
    .in("status", ["open", "in_progress"])
    .order("urgency", { ascending: false })
    .order("opens_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => rowToTask(r as Row));
}

export async function completeTask(
  merchantId: string,
  taskId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("gold_path_tasks")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("merchant_id", merchantId)
    .eq("id", taskId);
  return !error;
}

export async function dismissTask(
  merchantId: string,
  taskId: string
): Promise<boolean> {
  const c = client();
  if (!c) return false;
  const { error } = await c
    .from("gold_path_tasks")
    .update({ status: "dismissed" })
    .eq("merchant_id", merchantId)
    .eq("id", taskId);
  return !error;
}
