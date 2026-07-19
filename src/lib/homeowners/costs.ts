// SiteBook Project Costs — server-side lifecycle for the homeowner-
// private cost ledger.
//
// Everything here enforces ownership at the query level — every call
// requires homeownerId and checks the cost/project belongs to them
// before touching a row. Trades cannot invoke these paths.
//
// See migration 20260719140000_hammerex_sitebook_costs.sql.
// Blueprint: docs/SITEBOOK_BLUEPRINT_v2_2_FINAL.md · Project Cost v1.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadProjectDocumentActivation } from "./costDocuments";

export type CostKind =
  | "labour"
  | "materials"
  | "deposit"
  | "final"
  | "extra"
  | "supplier"
  | "other";

export type CostStatus =
  | "draft"
  | "agreed"
  | "part_paid"
  | "paid"
  | "cancelled";

export type PaymentMethod = "cash" | "bank" | "card" | "other";

export type Cost = {
  id:                  string;
  homeowner_id:        string;
  project_id:          string;
  trade_listing_id:    string | null;
  trade_name:          string | null;
  kind:                CostKind;
  description:         string | null;
  agreed_pence:        number;
  paid_pence:          number;
  status:              CostStatus;
  post_id:             string | null;
  invitation_id:       string | null;
  agreed_at:           string | null;
  due_at:              string | null;
  created_at:          string;
  updated_at:          string;
};

export type CostPayment = {
  id:            string;
  cost_id:       string;
  amount_pence:  number;
  method:        PaymentMethod;
  paid_at:       string;
  note:          string | null;
  created_at:    string;
};

export type CostWithPayments = Cost & { payments: CostPayment[] };

export type ProjectCostSummary = {
  project_id:      string;
  project_title:   string;
  project_image:   string | null;   // cover_photo_url — nullable
  agreed_pence:    number;
  paid_pence:      number;
  costs_count:     number;
  /** True when the project has at least one uploaded document (quote,
   *  invoice, receipt, spreadsheet, photo). Derived at query time by
   *  loadProjectCostSummary — drives the "Activated" chip on the
   *  Project Cost tile. */
  activated:       boolean;
  status:          "healthy" | "watch" | "overdue" | "empty";
};

// ─── Create ─────────────────────────────────────────────────────────

export async function createCost(input: {
  homeownerId:     string;
  projectId:       string;
  tradeListingId?: string | null;
  tradeName?:      string | null;
  kind?:           CostKind;
  description?:    string | null;
  agreedPence:     number;
  postId?:         string | null;
  invitationId?:   string | null;
  agreedAt?:       string | null;
  dueAt?:          string | null;
  status?:         CostStatus;
}): Promise<{ ok: true; cost: Cost } | { ok: false; error: string }> {
  if (input.agreedPence < 0)          return { ok: false, error: "negative-amount" };
  if (input.agreedPence > 100_000_00) return { ok: false, error: "amount-too-large" }; // £100k cap
  // Verify project ownership
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", input.projectId)
    .eq("homeowner_id", input.homeownerId)
    .maybeSingle();
  if (!proj.data) return { ok: false, error: "project-not-found" };

  const ins = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .insert({
      homeowner_id:     input.homeownerId,
      project_id:       input.projectId,
      trade_listing_id: input.tradeListingId ?? null,
      trade_name:       input.tradeName      ?? null,
      kind:             input.kind           ?? "labour",
      description:      input.description    ?? null,
      agreed_pence:     input.agreedPence,
      status:           input.status         ?? "agreed",
      post_id:          input.postId         ?? null,
      invitation_id:    input.invitationId   ?? null,
      agreed_at:        input.agreedAt       ?? new Date().toISOString(),
      due_at:           input.dueAt          ?? null
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  return { ok: true, cost: ins.data as Cost };
}

// ─── Payments ───────────────────────────────────────────────────────

export async function addPayment(input: {
  homeownerId:  string;
  costId:       string;
  amountPence:  number;
  method?:      PaymentMethod;
  paidAt?:      string;
  note?:        string;
}): Promise<{ ok: true; payment: CostPayment } | { ok: false; error: string }> {
  if (input.amountPence === 0) return { ok: false, error: "zero-amount" };
  // Verify cost ownership
  const cost = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("id, homeowner_id, agreed_pence")
    .eq("id", input.costId)
    .eq("homeowner_id", input.homeownerId)
    .maybeSingle();
  if (!cost.data) return { ok: false, error: "cost-not-found" };
  const ins = await supabaseAdmin
    .from("hammerex_sitebook_cost_payments")
    .insert({
      cost_id:      input.costId,
      amount_pence: input.amountPence,
      method:       input.method  ?? "other",
      paid_at:      input.paidAt  ?? new Date().toISOString(),
      note:         input.note    ?? null
    })
    .select("*")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: "insert-failed" };
  // Trigger will have recomputed paid_pence + status
  return { ok: true, payment: ins.data as CostPayment };
}

/** Mark a cost fully paid — inserts a payment for the outstanding
 *  balance. If already paid, no-op. */
export async function markPaid(input: {
  homeownerId: string;
  costId:      string;
  method?:     PaymentMethod;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const cost = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .select("id, homeowner_id, agreed_pence, paid_pence")
    .eq("id", input.costId)
    .eq("homeowner_id", input.homeownerId)
    .maybeSingle();
  if (!cost.data) return { ok: false, error: "cost-not-found" };
  const c   = cost.data as { agreed_pence: number; paid_pence: number };
  const due = c.agreed_pence - c.paid_pence;
  if (due <= 0) return { ok: true };
  return addPayment({
    homeownerId: input.homeownerId,
    costId:      input.costId,
    amountPence: due,
    method:      input.method
  }) as Promise<{ ok: true } | { ok: false; error: string }>;
}

// ─── Update / Delete ───────────────────────────────────────────────

export async function updateCost(input: {
  homeownerId: string;
  id:          string;
  patch: Partial<Pick<Cost,
    "trade_name" | "trade_listing_id" | "kind" | "description" |
    "agreed_pence" | "due_at" | "status">>;
}): Promise<{ ok: true; cost: Cost } | { ok: false; error: string }> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .update(input.patch)
    .eq("id", input.id)
    .eq("homeowner_id", input.homeownerId)
    .select("*")
    .maybeSingle();
  if (!res.data) return { ok: false, error: "not-found" };
  return { ok: true, cost: res.data as Cost };
}

export async function deleteCost(input: {
  homeownerId: string;
  id:          string;
}): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_sitebook_costs")
    .delete()
    .eq("id", input.id)
    .eq("homeowner_id", input.homeownerId)
    .select("id")
    .maybeSingle();
  return !!res.data;
}

// ─── Read ──────────────────────────────────────────────────────────

/** All costs for a project + all their payments. Homeowner-scoped. */
export async function loadCostsForProject(projectId: string, homeownerId: string): Promise<CostWithPayments[]> {
  const proj = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("id", projectId)
    .eq("homeowner_id", homeownerId)
    .maybeSingle();
  if (!proj.data) return [];
  const [costsRes, paymentsRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("*")
      .eq("project_id", projectId)
      .eq("homeowner_id", homeownerId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("hammerex_sitebook_cost_payments")
      .select("*, hammerex_sitebook_costs!inner(project_id)")
      .eq("hammerex_sitebook_costs.project_id", projectId)
  ]);
  const costs   = (costsRes.data as Cost[]) ?? [];
  const paymap  = new Map<string, CostPayment[]>();
  for (const p of (paymentsRes.data as (CostPayment & { hammerex_sitebook_costs: unknown })[]) ?? []) {
    const arr = paymap.get(p.cost_id) ?? [];
    arr.push(p);
    paymap.set(p.cost_id, arr);
  }
  return costs.map((c) => ({ ...c, payments: paymap.get(c.id) ?? [] }));
}

/** Rollup per project for the Project Cost card in the right rail.
 *  Empty projects (no costs) are included with empty status so the
 *  homeowner sees "set price" prompts. */
export async function loadProjectCostSummary(homeownerId: string): Promise<ProjectCostSummary[]> {
  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id, title, status, cover_photo_url")
    .eq("homeowner_id", homeownerId)
    .in("status", ["active", "in-progress", "draft"])
    .order("created_at", { ascending: false });
  const projRows = (projects.data as { id: string; title: string; status: string; cover_photo_url: string | null }[]) ?? [];
  if (projRows.length === 0) return [];

  const projIds = projRows.map((p) => p.id);
  const [costsRes, activatedSet] = await Promise.all([
    supabaseAdmin
      .from("hammerex_sitebook_costs")
      .select("project_id, agreed_pence, paid_pence, status, due_at")
      .in("project_id", projIds)
      .eq("homeowner_id", homeownerId)
      .not("status", "eq", "cancelled"),
    loadProjectDocumentActivation(projIds, homeownerId)
  ]);
  const costs = costsRes;
  const now = Date.now();
  type CostRow = { project_id: string; agreed_pence: number; paid_pence: number; status: string; due_at: string | null };
  const rows = (costs.data as CostRow[]) ?? [];
  const byProject = new Map<string, { agreed: number; paid: number; count: number; anyOverdue: boolean }>();
  for (const c of rows) {
    const acc = byProject.get(c.project_id) ?? { agreed: 0, paid: 0, count: 0, anyOverdue: false };
    acc.agreed += c.agreed_pence;
    acc.paid   += c.paid_pence;
    acc.count  += 1;
    const outstanding = c.agreed_pence - c.paid_pence;
    if (outstanding > 0 && c.due_at && Date.parse(c.due_at) < now) acc.anyOverdue = true;
    byProject.set(c.project_id, acc);
  }

  return projRows.map((p) => {
    const acc = byProject.get(p.id);
    const activated = activatedSet.has(p.id);
    if (!acc || acc.count === 0) {
      return {
        project_id:    p.id,
        project_title: p.title,
        project_image: p.cover_photo_url,
        agreed_pence:  0,
        paid_pence:    0,
        costs_count:   0,
        activated,
        status:        "empty" as const
      };
    }
    const outstanding = acc.agreed - acc.paid;
    const status: ProjectCostSummary["status"] =
      acc.anyOverdue        ? "overdue"
      : outstanding <= 0    ? "healthy"
      :                       "watch";
    return {
      project_id:    p.id,
      project_title: p.title,
      project_image: p.cover_photo_url,
      agreed_pence:  acc.agreed,
      paid_pence:    acc.paid,
      costs_count:   acc.count,
      activated,
      status
    };
  });
}
