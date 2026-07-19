// SiteBook Cost Documents — server-side attach/list/delete for the
// homeowner-private document store.
//
// A cost document is a quote / invoice / receipt / spreadsheet /
// photo attached to a project (and optionally to a specific cost
// row + the post that spawned it).
//
// See migration 20260719180000_hammerex_sitebook_cost_documents.sql.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CostDocumentKind =
  | "quote"
  | "invoice"
  | "receipt"
  | "spreadsheet"
  | "photo"
  | "other";

export type CostDocument = {
  id:            string;
  homeowner_id:  string;
  project_id:    string;
  cost_id:       string | null;
  post_id:       string | null;
  kind:          CostDocumentKind;
  file_name:     string;
  storage_path:  string;
  storage_url:   string;
  mime_type:     string;
  size_bytes:    number;
  note:          string | null;
  created_at:    string;
};

/** List every document for a given cost row. Homeowner-scoped. */
export async function loadDocumentsForCost(costId: string, homeownerId: string): Promise<CostDocument[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .select("*")
    .eq("cost_id",      costId)
    .eq("homeowner_id", homeownerId)
    .order("created_at", { ascending: true });
  return (res.data as CostDocument[]) ?? [];
}

/** Every doc across an entire project — used on the Cost Ledger view
 *  so a single query hydrates every cost's thumbnails. */
export async function loadDocumentsForProject(projectId: string, homeownerId: string): Promise<CostDocument[]> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .select("*")
    .eq("project_id",   projectId)
    .eq("homeowner_id", homeownerId)
    .order("created_at", { ascending: true });
  return (res.data as CostDocument[]) ?? [];
}

/** Delete a single document. Removes the storage object too. */
export async function deleteDocument(input: {
  homeownerId: string;
  id:          string;
}): Promise<boolean> {
  const doc = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .select("id, storage_path, homeowner_id")
    .eq("id", input.id)
    .eq("homeowner_id", input.homeownerId)
    .maybeSingle();
  if (!doc.data) return false;
  await supabaseAdmin.storage.from("sitebook-cost-documents").remove([doc.data.storage_path as string]);
  const del = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .delete()
    .eq("id", input.id)
    .eq("homeowner_id", input.homeownerId)
    .select("id")
    .maybeSingle();
  return !!del.data;
}

/** Map a set of project IDs → boolean has-any-document flag.
 *  Used by the Project Cost tile to derive the "Activated" chip. */
export async function loadProjectDocumentActivation(
  projectIds: string[],
  homeownerId: string
): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const res = await supabaseAdmin
    .from("hammerex_sitebook_cost_documents")
    .select("project_id")
    .in("project_id", projectIds)
    .eq("homeowner_id", homeownerId);
  const activated = new Set<string>();
  for (const r of (res.data as { project_id: string }[]) ?? []) {
    activated.add(r.project_id);
  }
  return activated;
}
