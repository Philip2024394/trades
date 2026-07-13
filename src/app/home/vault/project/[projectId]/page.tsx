// /home/vault/project/[projectId] — one project's full vault record.
//
// Reads the os_project_record_summary() aggregate function and
// renders every trade hired, quote received, milestone completed,
// signoff signed, payment made, review left, warranty registered,
// document uploaded, and video captured for this project.
//
// This is the "project owner has record of all trades and supplies"
// surface, structurally.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  ReceiptText,
  CheckSquare,
  ShieldCheck,
  Star,
  FileText,
  Video,
  Download,
  CreditCard,
  AlertTriangle
} from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { loadVaultEntitlements } from "@/lib/os/vault/entitlements";
import { loadProjectRecord, partyOwnsProject } from "@/lib/os/vault/queries";
import {
  SurfaceCard,
  PageHeader,
  SectionHeader,
  Grid,
  MetricCard,
  Badge,
  EmptyState
} from "@/platform/ui";
import { BundleDownloadPanel } from "./BundleDownloadPanel";
import { VaultVideoUploader } from "@/components/home/VaultVideoUploader";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Project record — Thenetworkers",
  robots: { index: false, follow: false }
};

type ProjectSummary = {
  project?: { id: string; title: string; status: string; property_id: string };
  property?: { address_lines?: string[]; city?: string; postcode?: string };
  participants?: Array<{
    id: string;
    role: string;
    business_id?: string | null;
    party_id?: string | null;
    joined_at?: string;
    left_at?: string | null;
  }>;
  quotes?: Array<{
    quote: {
      id: string;
      quote_number: string;
      summary: string;
      total_pence: number;
      state: string;
      drafted_at: string;
    };
    line_items: Array<{
      id: string;
      description: string;
      quantity: number;
      unit_price_pence: number;
      line_total_pence: number;
    }>;
  }>;
  milestones?: Array<{
    id: string;
    milestone_type: string;
    title: string;
    status: string;
    target_date?: string | null;
    completed_at?: string | null;
    amount_pence?: number | null;
  }>;
  signoffs?: Array<{
    id: string;
    signoff_type: string;
    signed_off_at: string;
    satisfaction_score?: number | null;
  }>;
  payments?: Array<{
    id: string;
    amount_pence: number;
    payment_method: string;
    status: string;
    paid_at: string;
  }>;
  reviews?: Array<{
    id: string;
    overall_score: number;
    headline?: string | null;
    body: string;
    submitted_at: string;
  }>;
  warranties?: Array<{
    id: string;
    warranty_type: string;
    scope: string;
    starts_at: string;
    expires_at: string;
    status: string;
  }>;
  documents?: Array<{
    id: string;
    title: string;
    kind: string;
    file_url: string;
    created_at: string;
  }>;
  videos?: Array<{
    id: string;
    title: string;
    video_category: string;
    duration_seconds?: number | null;
    created_at: string;
  }>;
  disputes?: Array<{
    id: string;
    dispute_type: string;
    summary: string;
    state: string;
    raised_at: string;
  }>;
};

function poundsFromPence(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default async function ProjectVaultPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const party = await loadHomeownerSession();
  if (!party) {
    redirect(`/home/sign-in?next=/home/vault/project/${projectId}`);
  }

  const owns = await partyOwnsProject(party.id, projectId);
  if (!owns) notFound();

  const [record, entitlements] = await Promise.all([
    loadProjectRecord(projectId),
    loadVaultEntitlements(party.id)
  ]);
  if (!record) notFound();

  const summary = record as ProjectSummary;
  const project = summary.project;
  if (!project) notFound();

  const property = summary.property;
  const totalSpent =
    summary.payments
      ?.filter((p) => p.status === "both_confirmed" || p.status === "recorded")
      .reduce((sum, p) => sum + p.amount_pence, 0) ?? 0;

  const openDisputes = summary.disputes?.filter(
    (d) =>
      ![
        "resolved_amicable",
        "resolved_platform_ruling",
        "resolved_external",
        "withdrawn",
        "stale"
      ].includes(d.state)
  );

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4">
        <Link
          href="/home/vault"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Vault
        </Link>
      </div>

      <PageHeader
        overline={
          property
            ? `${property.address_lines?.[0] ?? ""}${property.city ? ` · ${property.city}` : ""}`
            : "My Home"
        }
        title={project.title}
        subtitle={`Status: ${project.status.replace(/_/g, " ")}`}
      />

      <section className="mb-6">
        <Grid density="kpi">
          <MetricCard
            label="Total spent"
            value={poundsFromPence(totalSpent)}
            description={`${summary.payments?.length ?? 0} payments`}
          />
          <MetricCard
            label="Trades hired"
            value={
              summary.participants?.filter(
                (p) => p.role === "main_contractor" || p.role === "sub_trade"
              ).length ?? 0
            }
            description={`${summary.participants?.length ?? 0} total participants`}
          />
          <MetricCard
            label="Warranties"
            value={
              summary.warranties?.filter((w) => w.status === "active").length ?? 0
            }
            description={`${summary.documents?.length ?? 0} documents`}
          />
          <MetricCard
            label="Signoffs"
            value={summary.signoffs?.length ?? 0}
            description={`${summary.reviews?.length ?? 0} reviews`}
          />
        </Grid>
      </section>

      <div className="mb-8">
        <BundleDownloadPanel
          projectId={projectId}
          bundleEnabled={entitlements.bundleExportEnabled}
        />
      </div>

      {openDisputes && openDisputes.length > 0 ? (
        <section className="mb-8">
          <SurfaceCard variant="danger" padding="md">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-700" aria-hidden />
              <div className="text-[13px]">
                <div className="font-bold text-red-800">
                  {openDisputes.length} open dispute
                  {openDisputes.length === 1 ? "" : "s"}
                </div>
                <div className="mt-1 text-red-700">
                  Review the details and settle before this project closes.
                </div>
              </div>
            </div>
          </SurfaceCard>
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeader title="Trades and suppliers" />
        {(summary.participants?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title="No participants yet"
            description="When you invite trades or merchants to this project, they'll appear here."
          />
        ) : (
          <SurfaceCard variant="primary" padding="none">
            <ul className="divide-y divide-neutral-100">
              {summary.participants?.map((p) => (
                <li key={p.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {p.role.replace(/_/g, " ")}
                    </div>
                    <span className="text-[13px] text-neutral-500">
                      Joined{" "}
                      {p.joined_at
                        ? new Date(p.joined_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  {p.left_at ? (
                    <div className="mt-1 text-[13px] text-neutral-500">
                      Left {new Date(p.left_at).toLocaleDateString()}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </SurfaceCard>
        )}
      </section>

      <section className="mb-8">
        <SectionHeader title="Quotes" />
        {(summary.quotes?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No quotes yet"
            description="Quotes your trades send will appear here."
          />
        ) : (
          <div className="space-y-2">
            {summary.quotes?.map(({ quote, line_items }) => (
              <SurfaceCard key={quote.id} variant="primary" padding="md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-neutral-900">
                      {quote.summary}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      #{quote.quote_number} ·{" "}
                      {new Date(quote.drafted_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-neutral-900">
                      {poundsFromPence(quote.total_pence)}
                    </div>
                    <Badge
                      tone={
                        quote.state === "accepted"
                          ? "emerald"
                          : quote.state === "rejected"
                            ? "red"
                            : "neutral"
                      }
                    >
                      {quote.state}
                    </Badge>
                  </div>
                </div>
                {line_items.length > 0 ? (
                  <div className="mt-2 border-t border-neutral-100 pt-2 text-[13px] text-neutral-600">
                    {line_items.length} line item
                    {line_items.length === 1 ? "" : "s"}
                  </div>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHeader title="Milestones" />
        {(summary.milestones?.length ?? 0) === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No milestones tracked"
            description="Milestones appear when a quote is accepted."
          />
        ) : (
          <SurfaceCard variant="primary" padding="none">
            <ul className="divide-y divide-neutral-100">
              {summary.milestones?.map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3">
                  <CheckSquare
                    className={`h-4 w-4 shrink-0 ${
                      m.status === "completed"
                        ? "text-emerald-700"
                        : "text-neutral-400"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {m.title}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {m.milestone_type.replace(/_/g, " ")}
                      {m.target_date
                        ? ` · target ${new Date(m.target_date).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  {m.amount_pence ? (
                    <div className="text-[13px] font-semibold text-neutral-700">
                      {poundsFromPence(m.amount_pence)}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </SurfaceCard>
        )}
      </section>

      <Grid density="cards">
        <section>
          <SectionHeader title="Warranties" />
          {(summary.warranties?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No warranties yet"
              description="Registered warranties appear here."
            />
          ) : (
            <SurfaceCard variant="primary" padding="none">
              <ul className="divide-y divide-neutral-100">
                {summary.warranties?.map((w) => (
                  <li key={w.id} className="p-3">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {w.scope}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      Until {new Date(w.expires_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}
        </section>

        <section>
          <SectionHeader title="Reviews" />
          {(summary.reviews?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Reviews you post will appear here."
            />
          ) : (
            <div className="space-y-2">
              {summary.reviews?.map((r) => (
                <SurfaceCard key={r.id} variant="primary" padding="md">
                  <div className="mb-1 flex items-center gap-2">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {r.overall_score}★
                    </div>
                    {r.headline ? (
                      <div className="truncate text-[13px] text-neutral-600">
                        {r.headline}
                      </div>
                    ) : null}
                  </div>
                  <p className="line-clamp-3 text-[13px] text-neutral-700">
                    {r.body}
                  </p>
                </SurfaceCard>
              ))}
            </div>
          )}
        </section>
      </Grid>

      <Grid density="cards" className="mt-8">
        <section>
          <SectionHeader title="Documents" />
          {(summary.documents?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Uploaded documents appear here."
            />
          ) : (
            <SurfaceCard variant="primary" padding="none">
              <ul className="divide-y divide-neutral-100">
                {summary.documents?.slice(0, 20).map((d) => (
                  <li key={d.id} className="p-3">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {d.title}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {d.kind} · {new Date(d.created_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}
        </section>

        <section>
          <SectionHeader title="Videos" />
          <div className="space-y-3">
            {(summary.videos?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Video}
                title="No videos yet"
                description={
                  entitlements.videoEnabled
                    ? "Upload walkthroughs, progress videos, and signoffs."
                    : "Add video storage to your Vault to record and share videos."
                }
              />
            ) : (
              <SurfaceCard variant="primary" padding="none">
                <ul className="divide-y divide-neutral-100">
                  {summary.videos?.map((v) => (
                    <li key={v.id} className="p-3">
                      <div className="text-[14px] font-semibold text-neutral-900">
                        {v.title}
                      </div>
                      <div className="text-[13px] text-neutral-500">
                        {v.video_category.replace(/_/g, " ")}
                        {v.duration_seconds
                          ? ` · ${Math.round(v.duration_seconds)}s`
                          : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}
            <VaultVideoUploader
              projectId={projectId}
              videoEnabled={entitlements.videoEnabled}
            />
          </div>
        </section>
      </Grid>

      <section className="mt-8">
        <SectionHeader title="Payments" />
        {(summary.payments?.length ?? 0) === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments recorded"
            description="Payments made against this project appear here."
          />
        ) : (
          <SurfaceCard variant="primary" padding="none">
            <ul className="divide-y divide-neutral-100">
              {summary.payments?.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-neutral-900">
                      {poundsFromPence(p.amount_pence)}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      {p.payment_method.replace(/_/g, " ")} ·{" "}
                      {new Date(p.paid_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge
                    tone={
                      p.status === "both_confirmed"
                        ? "emerald"
                        : p.status === "disputed" || p.status === "reversed"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        )}
      </section>
    </main>
  );
}
