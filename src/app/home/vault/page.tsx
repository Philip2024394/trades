// /home/vault — Property Vault landing page.
//
// Shows the homeowner:
//   • Their current entitlement + storage usage
//   • Every project with a vault record (docs / videos / quotes / warranties)
//   • Ready-to-download bundles
//   • The dashboard notice CTA (upgrade if free tier)
//
// Server component. All state resolved before render.

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  FileText,
  Video,
  ReceiptText,
  ScrollText,
  Download,
  ChevronRight,
  FolderOpen
} from "lucide-react";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import {
  loadVaultEntitlements,
  loadStorageUsage,
  formatBytes
} from "@/lib/os/vault/entitlements";
import { listVaultProjectsForParty } from "@/lib/os/vault/queries";
import { resolveActiveNotices } from "@/lib/os/vault/notices";
import {
  SurfaceCard,
  PageHeader,
  SectionHeader,
  Grid,
  MetricCard,
  EmptyState,
  Badge
} from "@/platform/ui";
import type { BadgeTone } from "@/platform/ui";
import { DashboardNoticeStrip } from "@/components/home/DashboardNoticeStrip";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Property Vault — Xrated Trades",
  robots: { index: false, follow: false }
};

const TIER_LABEL: Record<string, string> = {
  none: "Free",
  basic: "Basic",
  trial: "Trial",
  lifetime: "Lifetime"
};

const TIER_TONE: Record<string, BadgeTone> = {
  none: "neutral",
  basic: "blue",
  trial: "amber",
  lifetime: "emerald"
};

export default async function VaultPage() {
  const party = await loadHomeownerSession();
  if (!party) {
    redirect("/home/sign-in?next=/home/vault");
  }

  const [entitlements, projects] = await Promise.all([
    loadVaultEntitlements(party.id),
    listVaultProjectsForParty(party.id)
  ]);

  const usage = await loadStorageUsage(party.id, entitlements);

  const notices = await resolveActiveNotices(party.id, {
    vaultTier: entitlements.vaultTier,
    projectCount: projects.length,
    videoCount: projects.reduce((n, p) => n + p.videoCount, 0),
    hasCompletedBundle: projects.some((p) => p.hasBundle),
    hasPendingPropertyTransfer: false
  });

  const readyBundles = projects.filter((p) => p.hasBundle);
  const totalDocuments = projects.reduce((n, p) => n + p.documentCount, 0);
  const totalVideos = projects.reduce((n, p) => n + p.videoCount, 0);
  const totalWarranties = projects.reduce((n, p) => n + p.warrantyCount, 0);

  return (
    <main className="mx-auto max-w-5xl p-4 md:p-6">
      <PageHeader
        overline="My Home"
        title="Property Vault"
        subtitle="Every quote, receipt, warranty, document and photo from every project on your home — safe and searchable."
      />

      {notices.length > 0 ? (
        <div className="mb-6">
          <DashboardNoticeStrip notice={notices[0]} />
        </div>
      ) : null}

      <section className="mb-8">
        <SectionHeader title="Your Vault" />
        <Grid density="compact">
          <MetricCard
            label="Plan"
            value={TIER_LABEL[entitlements.vaultTier] ?? "Free"}
            description={
              entitlements.vaultActive
                ? entitlements.passportTransferable
                  ? "Property Passport — transferable at sale"
                  : "Active"
                : "Upgrade to keep every record safe"
            }
          />
          <MetricCard
            label="Storage"
            value={`${usage.percentUsed}%`}
            description={`${formatBytes(usage.totalBytes)} of ${formatBytes(entitlements.storageTotalBytes)}`}
          />
          <MetricCard
            label="Projects"
            value={projects.length}
            description={
              projects.length === 0
                ? "Add your first project to begin"
                : `${totalDocuments} docs · ${totalVideos} videos · ${totalWarranties} warranties`
            }
          />
        </Grid>
      </section>

      {readyBundles.length > 0 ? (
        <section className="mb-8">
          <SectionHeader
            title="Ready to download"
            trailing={
              <span className="text-[13px] text-neutral-500">
                {readyBundles.length} project bundle
                {readyBundles.length === 1 ? "" : "s"}
              </span>
            }
          />
          <div className="space-y-2">
            {readyBundles.map((p) => (
              <SurfaceCard
                key={p.id}
                variant="primary"
                padding="md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100"
                    aria-hidden
                  >
                    <Download className="h-5 w-5 text-emerald-800" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-neutral-900">
                      {p.title}
                    </div>
                    <div className="text-[13px] text-neutral-500">
                      Bundle ready
                      {p.latestBundleReadyAt
                        ? ` · ${new Date(p.latestBundleReadyAt).toLocaleDateString()}`
                        : null}
                    </div>
                  </div>
                  <Link
                    href={`/home/vault/project/${p.id}`}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-amber-800 hover:text-amber-900"
                  >
                    Open
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <SectionHeader
          title="Projects in the Vault"
          trailing={
            <span className="text-[13px] text-neutral-500">
              {projects.length} total
            </span>
          }
        />
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No projects yet"
            description="Add a project on your home page to start capturing records here."
          />
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <SurfaceCard
                key={p.id}
                variant="primary"
                padding="md"
              >
                <Link
                  href={`/home/vault/project/${p.id}`}
                  className="flex items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="truncate text-[14px] font-semibold text-neutral-900">
                        {p.title}
                      </div>
                      <Badge tone={TIER_TONE[p.status] ?? "neutral"}>
                        {p.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" aria-hidden />
                        {p.documentCount} docs
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Video className="h-3.5 w-3.5" aria-hidden />
                        {p.videoCount} videos
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ReceiptText className="h-3.5 w-3.5" aria-hidden />
                        {p.quoteCount} quotes
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ScrollText className="h-3.5 w-3.5" aria-hidden />
                        {p.warrantyCount} warranties
                      </span>
                    </div>
                  </div>
                  <ChevronRight
                    className="mt-1 h-5 w-5 shrink-0 text-neutral-400"
                    aria-hidden
                  />
                </Link>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="How the Vault works" />
        <SurfaceCard variant="primary" padding="md">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
              aria-hidden
            >
              <ShieldCheck className="h-5 w-5 text-amber-800" />
            </div>
            <div className="text-[13px] leading-relaxed text-neutral-700">
              <p>
                Every quote your trades send, every warranty they register,
                every receipt you receive, every photo they upload — it all
                lands here, tied to the project and to your property.
              </p>
              <p className="mt-2">
                When a project completes we bundle everything into a single
                download. If you sell your home, the record passes to the
                next owner (with your consent) — verified renovation history
                that adds real value at sale.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </section>
    </main>
  );
}
