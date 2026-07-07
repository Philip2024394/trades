// OS Foundation — Project + Specification helpers.
//
// A Project is a body of work at a Property. A Specification is the
// versioned structured description of what the customer wants. Every
// render / quote / order attaches to a Specification.
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordTimelineEvent } from "@/lib/os/timeline";

export type ProjectStatus =
  | "idea"
  | "specced"
  | "quoted"
  | "accepted"
  | "surveyed"
  | "in_progress"
  | "signed_off"
  | "closed"
  | "abandoned";

export type ProjectRecord = {
  id: string;
  property_id: string;
  primary_party_id: string | null;
  primary_business_listing_id: string | null;
  title: string;
  leaf_slug: string | null;
  status: ProjectStatus;
  budget_pence_low: number | null;
  budget_pence_high: number | null;
  target_start_date: string | null;
  target_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function findOrCreateProject(input: {
  propertyId: string;
  primaryPartyId?: string | null;
  primaryBusinessListingId?: string | null;
  title: string;
  leafSlug?: string | null;
}): Promise<ProjectRecord> {
  // If a project already exists on this property with the same leaf +
  // no closure yet, reuse it. This keeps a homeowner's "Kitchen" as one
  // project across multiple visits instead of forking on every render.
  if (input.leafSlug) {
    const { data: existing } = await supabaseAdmin
      .from("os_projects")
      .select("*")
      .eq("property_id", input.propertyId)
      .eq("leaf_slug", input.leafSlug)
      .not("status", "in", "(closed,abandoned)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return existing as ProjectRecord;
  }

  const { data: created, error } = await supabaseAdmin
    .from("os_projects")
    .insert({
      property_id: input.propertyId,
      primary_party_id: input.primaryPartyId ?? null,
      primary_business_listing_id: input.primaryBusinessListingId ?? null,
      title: input.title,
      leaf_slug: input.leafSlug ?? null,
      status: "idea" as const
    })
    .select("*")
    .single();
  if (error || !created) {
    throw new Error(`Failed to create project: ${error?.message}`);
  }
  const project = created as ProjectRecord;

  await recordTimelineEvent({
    propertyId: input.propertyId,
    projectId: project.id,
    actorPartyId: input.primaryPartyId ?? null,
    actorBusinessListingId: input.primaryBusinessListingId ?? null,
    verb: "project.opened",
    subjectType: "project",
    subjectId: project.id,
    headline: `Project opened: ${project.title}`,
    payload: { leaf_slug: project.leaf_slug }
  });

  return project;
}

export async function updateProjectStatus(input: {
  projectId: string;
  status: ProjectStatus;
  actorPartyId?: string | null;
  actorBusinessListingId?: string | null;
}): Promise<void> {
  const { data: project } = await supabaseAdmin
    .from("os_projects")
    .update({ status: input.status })
    .eq("id", input.projectId)
    .select("property_id, title")
    .single();
  if (!project) return;

  const verbMap: Record<ProjectStatus, string | null> = {
    idea: null,
    specced: "project.specced",
    quoted: "project.quoted",
    accepted: "project.accepted",
    surveyed: null,
    in_progress: null,
    signed_off: "project.signed_off",
    closed: "project.closed",
    abandoned: null
  };
  const verb = verbMap[input.status];
  if (!verb) return;

  await recordTimelineEvent({
    propertyId: project.property_id,
    projectId: input.projectId,
    actorPartyId: input.actorPartyId ?? null,
    actorBusinessListingId: input.actorBusinessListingId ?? null,
    verb: verb as Parameters<typeof recordTimelineEvent>[0]["verb"],
    subjectType: "project",
    subjectId: input.projectId,
    headline: `${project.title}: ${input.status.replace(/_/g, " ")}`
  });
}

// ---------------------------------------------------------------------
// Specifications
// ---------------------------------------------------------------------

export type SpecificationChoices = {
  style?: string;
  material?: string;
  colour?: string;
  hardware?: string[];
};

export type BomLine = {
  sku?: string;
  label: string;
  qty: number;
  unit_price_pence?: number;
  source_business_id?: string;
};

export type SpecificationRecord = {
  id: string;
  project_id: string;
  version: number;
  leaf_slug: string;
  choices: SpecificationChoices;
  bom: BomLine[];
  total_pence: number | null;
  authored_by_party_id: string | null;
  authored_by_business_listing_id: string | null;
  created_at: string;
};

export async function appendSpecification(input: {
  projectId: string;
  leafSlug: string;
  choices: SpecificationChoices;
  bom?: BomLine[];
  authoredByPartyId?: string | null;
  authoredByBusinessListingId?: string | null;
}): Promise<SpecificationRecord> {
  const { data: previous } = await supabaseAdmin
    .from("os_specifications")
    .select("version")
    .eq("project_id", input.projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (previous?.version ?? 0) + 1;

  const bom = input.bom ?? [];
  const totalPence = bom.reduce((acc, line) => {
    if (typeof line.unit_price_pence === "number") {
      return acc + line.unit_price_pence * line.qty;
    }
    return acc;
  }, 0);

  const { data, error } = await supabaseAdmin
    .from("os_specifications")
    .insert({
      project_id: input.projectId,
      version: nextVersion,
      leaf_slug: input.leafSlug,
      choices: input.choices,
      bom,
      total_pence: totalPence > 0 ? totalPence : null,
      authored_by_party_id: input.authoredByPartyId ?? null,
      authored_by_business_listing_id:
        input.authoredByBusinessListingId ?? null
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to append specification: ${error?.message}`);
  }
  return data as SpecificationRecord;
}
