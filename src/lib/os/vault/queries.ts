// OS — Vault query helpers.
//
// Reads the vault's projections for the homeowner dashboard.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type VaultProjectSummary = {
  id: string;
  title: string;
  status: string;
  propertyId: string;
  createdAt: string;
  documentCount: number;
  videoCount: number;
  quoteCount: number;
  warrantyCount: number;
  hasBundle: boolean;
  latestBundleId: string | null;
  latestBundleReadyAt: string | null;
  totalPence: number | null;
};

export async function listVaultProjectsForParty(
  partyId: string
): Promise<VaultProjectSummary[]> {
  // Get all projects for properties this party has claimed
  const { data: claims } = await supabaseAdmin
    .from("os_property_claims")
    .select("property_id")
    .eq("party_id", partyId);

  const propertyIds = (claims ?? []).map((c) => c.property_id);
  if (propertyIds.length === 0) return [];

  const { data: projects } = await supabaseAdmin
    .from("os_projects")
    .select("id, title, status, property_id, created_at")
    .in("property_id", propertyIds)
    .order("created_at", { ascending: false });

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  // Fetch counts across the vault primitives in parallel
  const [docsRes, videosRes, quotesRes, warrantiesRes, bundlesRes] =
    await Promise.all([
      supabaseAdmin
        .from("os_documents")
        .select("project_id")
        .in("project_id", projectIds),
      supabaseAdmin
        .from("os_project_videos")
        .select("project_id")
        .in("project_id", projectIds)
        .is("deleted_at", null),
      supabaseAdmin
        .from("os_project_quotes")
        .select("project_id, total_pence")
        .in("project_id", projectIds),
      supabaseAdmin
        .from("os_project_warranties")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("status", "active"),
      supabaseAdmin
        .from("os_project_bundle_exports")
        .select("id, project_id, status, ready_at, created_at")
        .in("project_id", projectIds)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
    ]);

  const docCount = new Map<string, number>();
  for (const d of docsRes.data ?? []) {
    if (!d.project_id) continue;
    docCount.set(d.project_id, (docCount.get(d.project_id) ?? 0) + 1);
  }
  const videoCount = new Map<string, number>();
  for (const v of videosRes.data ?? []) {
    if (!v.project_id) continue;
    videoCount.set(v.project_id, (videoCount.get(v.project_id) ?? 0) + 1);
  }
  const quoteCount = new Map<string, number>();
  const totalByProject = new Map<string, number>();
  for (const q of quotesRes.data ?? []) {
    if (!q.project_id) continue;
    quoteCount.set(q.project_id, (quoteCount.get(q.project_id) ?? 0) + 1);
    if (typeof q.total_pence === "number") {
      totalByProject.set(
        q.project_id,
        (totalByProject.get(q.project_id) ?? 0) + q.total_pence
      );
    }
  }
  const warrantyCount = new Map<string, number>();
  for (const w of warrantiesRes.data ?? []) {
    if (!w.project_id) continue;
    warrantyCount.set(
      w.project_id,
      (warrantyCount.get(w.project_id) ?? 0) + 1
    );
  }
  const latestBundleByProject = new Map<
    string,
    { id: string; readyAt: string | null }
  >();
  for (const b of bundlesRes.data ?? []) {
    if (!b.project_id) continue;
    if (!latestBundleByProject.has(b.project_id)) {
      latestBundleByProject.set(b.project_id, {
        id: b.id,
        readyAt: b.ready_at
      });
    }
  }

  return projects.map((p) => {
    const bundle = latestBundleByProject.get(p.id);
    return {
      id: p.id,
      title: p.title,
      status: p.status,
      propertyId: p.property_id,
      createdAt: p.created_at,
      documentCount: docCount.get(p.id) ?? 0,
      videoCount: videoCount.get(p.id) ?? 0,
      quoteCount: quoteCount.get(p.id) ?? 0,
      warrantyCount: warrantyCount.get(p.id) ?? 0,
      hasBundle: Boolean(bundle),
      latestBundleId: bundle?.id ?? null,
      latestBundleReadyAt: bundle?.readyAt ?? null,
      totalPence: totalByProject.get(p.id) ?? null
    };
  });
}

export async function loadProjectRecord(
  projectId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.rpc(
    "os_project_record_summary",
    { p_project_id: projectId }
  );
  if (error) throw error;
  return (data as Record<string, unknown>) ?? null;
}

export async function partyOwnsProject(
  partyId: string,
  projectId: string
): Promise<boolean> {
  const { data: project } = await supabaseAdmin
    .from("os_projects")
    .select("property_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return false;

  const { count } = await supabaseAdmin
    .from("os_property_claims")
    .select("id", { count: "exact", head: true })
    .eq("party_id", partyId)
    .eq("property_id", project.property_id);

  return (count ?? 0) > 0;
}

export async function queueProjectBundleExport(
  projectId: string,
  partyId: string,
  exportType:
    | "project_completion"
    | "homeowner_manual"
    | "property_sale_transfer"
    | "legal_disclosure"
    | "insurance_claim"
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("os_project_bundle_exports")
    .insert({
      project_id: projectId,
      exported_by_party_id: partyId,
      export_type: exportType,
      status: "queued"
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
