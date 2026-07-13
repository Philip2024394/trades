// /home — My Home hub. The homeowner's primary surface.
//
// If not signed in → redirect to /home/sign-in.
// If signed in but no property claims → prompt to claim first property.
// Otherwise → render property card + timeline + projects + documents.

import { redirect } from "next/navigation";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { listClaimsForParty } from "@/lib/os/properties";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  loadStorageUsage,
  loadVaultEntitlements
} from "@/lib/os/vault/entitlements";
import { resolveActiveNotices } from "@/lib/os/vault/notices";
import { HomeHub } from "./HomeHub";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Home — Thenetworkers",
  robots: { index: false, follow: false }
};

type HomeTimelineEvent = {
  id: string;
  verb: string;
  subject_type: string;
  subject_id: string | null;
  headline: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  project_id: string | null;
};

export default async function MyHomePage({
  searchParams
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const party = await loadHomeownerSession();
  if (!party) {
    redirect("/home/sign-in");
  }

  const claims = await listClaimsForParty(party.id);
  if (claims.length === 0) {
    // No property yet — force the address flow.
    return (
      <HomeHub
        party={{ id: party.id, displayName: party.display_name, email: party.email }}
        activePropertyId={null}
        claims={[]}
        property={null}
        timeline={[]}
        projects={[]}
        documents={[]}
        quotes={[]}
        jobs={[]}
      />
    );
  }

  const sp = await searchParams;
  const activePropertyId =
    (sp.property && claims.find((c) => {
      const p = (
        c as unknown as { os_properties?: { id: string } | { id: string }[] }
      ).os_properties;
      const propObj = Array.isArray(p) ? p[0] : p;
      return propObj?.id === sp.property;
    }) &&
      sp.property) ||
    (() => {
      const first = (
        claims[0] as unknown as {
          os_properties?: { id: string } | { id: string }[];
        }
      ).os_properties;
      const propObj = Array.isArray(first) ? first[0] : first;
      return propObj?.id ?? null;
    })();

  if (!activePropertyId) {
    return (
      <HomeHub
        party={{ id: party.id, displayName: party.display_name, email: party.email }}
        activePropertyId={null}
        claims={[]}
        property={null}
        timeline={[]}
        projects={[]}
        documents={[]}
        quotes={[]}
        jobs={[]}
      />
    );
  }

  const [propertyRes, projectsRes, docsRes, timelineRes, quotesRes, jobsRes] = await Promise.all([
    supabaseAdmin
      .from("os_properties")
      .select("*")
      .eq("id", activePropertyId)
      .single(),
    supabaseAdmin
      .from("os_projects")
      .select(
        "id, title, leaf_slug, status, target_end_date, updated_at, primary_business_listing_id"
      )
      .eq("property_id", activePropertyId)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("os_documents")
      .select("id, kind, title, expires_at, created_at")
      .eq("property_id", activePropertyId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("os_home_timeline_events")
      .select(
        "id, verb, subject_type, subject_id, headline, payload, occurred_at, project_id"
      )
      .eq("property_id", activePropertyId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabaseAdmin
      .from("app_quote_workspace_quotes")
      .select(
        "id, title, status, total_pence, sent_at, first_viewed_at, accepted_at, rejected_at, expires_at, share_token, project_id, merchant_id"
      )
      .eq("property_id", activePropertyId)
      .in("status", ["sent", "viewed", "accepted"])
      .order("updated_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("app_job_diary_jobs")
      .select(
        "id, title, status, progress_percent, actual_start_date, actual_end_date, updated_at, merchant_id, project_id"
      )
      .eq("property_id", activePropertyId)
      .in("status", ["open", "in_progress", "snagging", "signed_off"])
      .order("updated_at", { ascending: false })
      .limit(20)
  ]);

  // For each job, pull the latest homeowner-visible entries with photos
  const jobIds = (jobsRes.data || []).map((j) => j.id);
  let entriesByJob = new Map<string, Array<{ headline: string; media_urls: string[]; occurred_at: string; kind: string }>>();
  if (jobIds.length > 0) {
    const { data: rawEntries } = await supabaseAdmin
      .from("app_job_diary_entries")
      .select("job_id, kind, headline, media_urls, occurred_at")
      .in("job_id", jobIds)
      .eq("homeowner_visible", true)
      .order("occurred_at", { ascending: false })
      .limit(60);
    (rawEntries || []).forEach((e) => {
      const existing = entriesByJob.get(e.job_id) || [];
      if (existing.length < 4) {
        existing.push({
          headline: e.headline,
          media_urls: e.media_urls || [],
          occurred_at: e.occurred_at,
          kind: e.kind
        });
      }
      entriesByJob.set(e.job_id, existing);
    });
  }

  // Enrich quotes + jobs with merchant name for display
  const merchantIds = Array.from(
    new Set([
      ...(quotesRes.data || []).map((q) => q.merchant_id),
      ...(jobsRes.data || []).map((j) => j.merchant_id)
    ])
  );
  const merchantMap = new Map<string, { display_name: string; trading_name: string | null }>();
  if (merchantIds.length > 0) {
    const { data: mrows } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id, display_name, trading_name")
      .in("id", merchantIds);
    (mrows || []).forEach((m) =>
      merchantMap.set(m.id, {
        display_name: m.display_name,
        trading_name: m.trading_name
      })
    );
  }

  const propertyRow = propertyRes.data;
  const isPlaceholder =
    propertyRow &&
    Array.isArray(propertyRow.address_lines) &&
    propertyRow.address_lines.length === 1 &&
    typeof propertyRow.address_lines[0] === "string" &&
    propertyRow.address_lines[0].startsWith("Home at ");

  // Property Vault entitlements + top-priority dashboard notice for Sarah.
  const vaultEntitlements = await loadVaultEntitlements(party.id);
  const [vaultUsage, vaultNotices] = await Promise.all([
    loadStorageUsage(party.id, vaultEntitlements),
    resolveActiveNotices(party.id, {
      vaultTier: vaultEntitlements.vaultTier,
      projectCount: (projectsRes.data || []).length,
      videoCount: 0,
      hasCompletedBundle: false,
      hasPendingPropertyTransfer: false
    })
  ]);

  return (
    <HomeHub
      party={{ id: party.id, displayName: party.display_name, email: party.email }}
      activePropertyId={activePropertyId}
      vault={{
        active: vaultEntitlements.vaultActive,
        tier: vaultEntitlements.vaultTier,
        storagePercentUsed: vaultUsage.percentUsed,
        passportTransferable: vaultEntitlements.passportTransferable
      }}
      vaultNotice={vaultNotices[0] ?? null}
      claims={claims.map((c) => {
        const p = (
          c as unknown as {
            os_properties?:
              | { id: string; postcode: string; address_lines: string[] }
              | { id: string; postcode: string; address_lines: string[] }[];
          }
        ).os_properties;
        const propObj = Array.isArray(p) ? p[0] : p;
        return {
          id: propObj?.id ?? "",
          postcode: propObj?.postcode ?? "",
          addressLines: propObj?.address_lines ?? []
        };
      })}
      property={
        propertyRow
          ? {
              id: propertyRow.id,
              addressLines: propertyRow.address_lines,
              postcode: propertyRow.postcode,
              city: propertyRow.city,
              isPlaceholder: Boolean(isPlaceholder),
              tenure: propertyRow.tenure,
              bedrooms: propertyRow.bedrooms,
              built_year: propertyRow.built_year
            }
          : null
      }
      timeline={(timelineRes.data || []) as HomeTimelineEvent[]}
      projects={projectsRes.data || []}
      documents={docsRes.data || []}
      quotes={(quotesRes.data || []).map((q) => {
        const m = merchantMap.get(q.merchant_id);
        return {
          id: q.id,
          title: q.title,
          status: q.status,
          totalPence: q.total_pence,
          shareToken: q.share_token,
          projectId: q.project_id,
          merchantName: m?.trading_name || m?.display_name || "Trade",
          acceptedAt: q.accepted_at
        };
      })}
      jobs={(jobsRes.data || []).map((j) => {
        const m = merchantMap.get(j.merchant_id);
        return {
          id: j.id,
          title: j.title,
          status: j.status,
          progress: j.progress_percent,
          startedAt: j.actual_start_date,
          finishedAt: j.actual_end_date,
          merchantName: m?.trading_name || m?.display_name || "Trade",
          entries: entriesByJob.get(j.id) || []
        };
      })}
    />
  );
}
