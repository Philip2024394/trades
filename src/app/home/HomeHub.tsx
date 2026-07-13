// My Home hub — client component. Property card + Timeline + Projects
// + Documents + Warranty (stubbed) + "Next up" suggestions.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  Sparkles,
  ShieldCheck,
  FileText,
  Plus,
  Wand2,
  MapPin,
  LogOut,
  ChevronDown,
  Receipt,
  CheckCircle2,
  ExternalLink,
  ClipboardCheck,
  Camera,
  ChevronRight,
  Lock
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import { ClaimPropertyForm } from "./ClaimPropertyForm";
import { NewProjectForm } from "./NewProjectForm";
import { DashboardNoticeStrip } from "@/components/home/DashboardNoticeStrip";
import type { ResolvedNotice } from "@/lib/os/vault/notices";

type Party = {
  id: string;
  displayName: string;
  email: string | null;
};

type PropertyCard = {
  id: string;
  addressLines: string[];
  postcode: string;
  city: string | null;
  isPlaceholder: boolean;
  tenure: string | null;
  bedrooms: number | null;
  built_year: number | null;
};

type Claim = {
  id: string;
  addressLines: string[];
  postcode: string;
};

type Project = {
  id: string;
  title: string;
  leaf_slug: string | null;
  status: string;
  updated_at: string;
  primary_business_listing_id: string | null;
};

type Document = {
  id: string;
  kind: string;
  title: string;
  expires_at: string | null;
  created_at: string;
};

type TimelineEvent = {
  id: string;
  verb: string;
  subject_type: string;
  subject_id: string | null;
  headline: string;
  payload: Record<string, unknown>;
  occurred_at: string;
  project_id: string | null;
};

type Quote = {
  id: string;
  title: string;
  status: string;
  totalPence: number;
  shareToken: string;
  projectId: string;
  merchantName: string;
  acceptedAt: string | null;
};

type JobEntry = {
  headline: string;
  media_urls: string[];
  occurred_at: string;
  kind: string;
};

type Job = {
  id: string;
  title: string;
  status: string;
  progress: number;
  startedAt: string | null;
  finishedAt: string | null;
  merchantName: string;
  entries: JobEntry[];
};

type VaultSummary = {
  active: boolean;
  tier: "none" | "basic" | "trial" | "lifetime";
  storagePercentUsed: number;
  passportTransferable: boolean;
};

export function HomeHub({
  party,
  claims,
  activePropertyId,
  property,
  timeline,
  projects,
  documents,
  quotes,
  jobs,
  vaultNotice,
  vault
}: {
  party: Party;
  claims: Claim[];
  activePropertyId: string | null;
  property: PropertyCard | null;
  timeline: TimelineEvent[];
  projects: Project[];
  documents: Document[];
  quotes: Quote[];
  jobs: Job[];
  vaultNotice?: ResolvedNotice | null;
  vault?: VaultSummary;
}) {
  const [claimOpen, setClaimOpen] = useState(!property || property.isPlaceholder);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  async function logout() {
    await fetch("/api/os/homeowner/session/logout", { method: "POST" });
    window.location.href = "/home/sign-in";
  }

  const activeProjects = projects.filter((p) =>
    ["idea", "specced", "quoted", "accepted", "surveyed", "in_progress"].includes(p.status)
  );
  const doneProjects = projects.filter((p) => p.status === "signed_off" || p.status === "closed");

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Construction Notebook brand ribbon — signals that My Home
          is part of the wider network. Always at the very top of the
          homeowner surface. */}
      <div
        className="border-b border-amber-200/60"
        style={{ background: "linear-gradient(90deg, #ffffff 0%, #fff8e6 50%, #ffffff 100%)" }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-1.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-800 hover:text-amber-900"
            aria-label="XRatedTrade — The Construction Notebook"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-hidden
            />
            The Construction Notebook
          </Link>
          <span className="hidden text-[11px] font-medium uppercase tracking-widest text-neutral-500 sm:inline">
            Your home&apos;s record
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-neutral-900 p-1.5">
              <Home className="h-4 w-4 text-[#1B1A17]" aria-hidden />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-neutral-900 leading-tight">
                My Home
              </div>
              <div className="text-[11px] text-neutral-500 leading-tight">
                On the record
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {claims.length > 1 ? (
              <button
                type="button"
                onClick={() => setSwitcherOpen((s) => !s)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {property?.postcode || "Switch"}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
        {switcherOpen && claims.length > 1 ? (
          <div className="mx-auto max-w-4xl border-t border-neutral-100 bg-white px-4 py-2">
            {claims.map((c) => (
              <Link
                key={c.id}
                href={`/home?property=${c.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-neutral-700 hover:bg-neutral-100"
                onClick={() => setSwitcherOpen(false)}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {c.addressLines.filter((l) => !l.startsWith("Home at ")).join(", ") ||
                  `Property at ${c.postcode}`}
              </Link>
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {!property ? (
          <SurfaceCard variant="primary" padding="lg">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              Welcome, {party.displayName}
            </div>
            <h1 className="mt-2 text-2xl font-bold">Claim your property</h1>
            <p className="mt-1 text-[14px] text-neutral-600">
              Add your address so we can start your property timeline —
              every renovation, warranty and document in one place.
            </p>
            <div className="mt-4">
              <ClaimPropertyForm onDone={() => window.location.reload()} />
            </div>
          </SurfaceCard>
        ) : (
          <>
            {/* PROPERTY CARD */}
            <SurfaceCard variant="primary" padding="lg" className="mb-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                    Your home
                  </div>
                  <h1 className="mt-1 text-2xl font-bold leading-tight">
                    {property.isPlaceholder
                      ? `Property at ${property.postcode}`
                      : property.addressLines.filter((l) => !l.startsWith("Home at ")).join(", ") ||
                        `Property at ${property.postcode}`}
                  </h1>
                  <p className="mt-1 text-[13px] text-neutral-600">
                    {property.city ? `${property.city} · ` : ""}
                    {property.postcode}
                  </p>
                </div>
              </div>

              {property.isPlaceholder ? (
                <SurfaceCard variant="warning" padding="md" className="mt-4">
                  <div className="text-[13px] font-semibold">
                    Confirm your address to start your Home Timeline.
                  </div>
                  <p className="mt-1 text-[13px]">
                    We used your postcode from your first design. Add the
                    rest and warranties + documents will attach here
                    automatically going forward.
                  </p>
                  <button
                    type="button"
                    onClick={() => setClaimOpen((o) => !o)}
                    className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-[#1B1A17] hover:bg-neutral-800"
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Add address
                  </button>
                </SurfaceCard>
              ) : null}

              {claimOpen && property.isPlaceholder ? (
                <div className="mt-4">
                  <ClaimPropertyForm
                    initialPostcode={property.postcode}
                    onDone={() => window.location.reload()}
                  />
                </div>
              ) : null}
            </SurfaceCard>

            {/* NOTICE STRIP — Vault upgrade CTA, etc. */}
            {vaultNotice ? (
              <div className="mb-4">
                <DashboardNoticeStrip notice={vaultNotice} />
              </div>
            ) : null}

            {/* PROPERTY VAULT CARD */}
            <section className="mb-4">
              <Link
                href="/home/vault"
                className="block"
                aria-label="Open Property Vault"
              >
                <SurfaceCard variant="primary" padding="md">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
                      aria-hidden
                    >
                      {vault?.active ? (
                        <ShieldCheck className="h-5 w-5 text-amber-800" />
                      ) : (
                        <Lock className="h-5 w-5 text-neutral-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <div className="text-[14px] font-semibold text-neutral-900">
                          Property Vault
                        </div>
                        {vault?.active ? (
                          <span className="text-[13px] font-semibold text-emerald-800">
                            · Active ({vault.tier})
                          </span>
                        ) : (
                          <span className="text-[13px] text-neutral-500">
                            · Free tier
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px] text-neutral-600">
                        {vault?.active
                          ? `${vault.storagePercentUsed}% of storage used${
                              vault.passportTransferable
                                ? " · Passport transferable at sale"
                                : ""
                            }`
                          : "Every quote, receipt, warranty and photo — from £4.99/month"}
                      </div>
                    </div>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-neutral-400"
                      aria-hidden
                    />
                  </div>
                </SurfaceCard>
              </Link>
            </section>

            {/* MATERIALS PASSPORT — one honest chain of every trade
                action tagged to this property. Shareable link the
                homeowner can send to a surveyor / insurer / buyer at
                sale time. Self-hides on a placeholder property (no
                confirmed address yet). */}
            {!property.isPlaceholder && (
              <section className="mb-4">
                <Link
                  href={`/property/${property.id}/materials`}
                  aria-label="Open your Materials Passport"
                >
                  <SurfaceCard variant="primary" padding="md" interactive>
                    <div className="flex items-center gap-3">
                      <ShieldCheck
                        className="h-5 w-5 text-emerald-700"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                          Materials Passport
                        </div>
                        <div className="mt-0.5 text-[15px] font-black text-neutral-900">
                          See who worked on your property.
                        </div>
                        <div className="mt-0.5 text-[13px] text-neutral-500">
                          Every trade action tagged to this address — a
                          shareable chain surveyors, insurers, and future
                          buyers can verify without trusting anyone
                          individually.
                        </div>
                      </div>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-neutral-400"
                        aria-hidden
                      />
                    </div>
                  </SurfaceCard>
                </Link>
              </section>
            )}

            {/* PROJECTS */}
            <section className="mb-4">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold">Projects</h2>
                <button
                  type="button"
                  onClick={() => setNewProjectOpen((o) => !o)}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-[#1B1A17] hover:bg-neutral-800"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Start a project
                </button>
              </div>

              {newProjectOpen ? (
                <SurfaceCard variant="primary" padding="md" className="mb-3">
                  <NewProjectForm
                    propertyId={property.id}
                    onDone={() => window.location.reload()}
                  />
                </SurfaceCard>
              ) : null}

              {activeProjects.length === 0 ? (
                <SurfaceCard variant="secondary" padding="md">
                  <div className="text-[13px] text-neutral-600">
                    Nothing active yet. Start a project — a kitchen, bathroom,
                    driveway — and every render, quote and warranty for it
                    will live here.
                  </div>
                </SurfaceCard>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {activeProjects.map((p) => (
                    <SurfaceCard
                      key={p.id}
                      variant="primary"
                      padding="md"
                      interactive
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                        <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                          {p.leaf_slug?.replace(/_/g, " ") || "Project"}
                        </div>
                      </div>
                      <div className="mt-1 text-[16px] font-semibold text-neutral-900">
                        {p.title}
                      </div>
                      <div className="mt-1 text-[13px] text-neutral-500 capitalize">
                        {p.status.replace(/_/g, " ")}
                      </div>
                    </SurfaceCard>
                  ))}
                </div>
              )}

              {doneProjects.length > 0 ? (
                <div className="mt-4">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                    Finished ({doneProjects.length})
                  </h3>
                  <ul className="mt-2 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                    {doneProjects.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 text-[13px]"
                      >
                        <span className="font-medium text-neutral-900">
                          {p.title}
                        </span>
                        <span className="text-neutral-500">
                          {new Date(p.updated_at).toLocaleDateString(undefined, {
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {/* ACTIVE JOBS — the strongest signal to a homeowner that
                 the platform is working for them. Photos on top, no
                 phone-tag needed. */}
            {jobs.filter((j) => j.status !== "signed_off").length > 0 ? (
              <section className="mb-4">
                <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
                  <ClipboardCheck className="h-5 w-5" aria-hidden />
                  Work in progress
                </h2>
                <p className="mb-3 text-[13px] text-neutral-600">
                  Live updates from your trade — check-ins, photos, milestones.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {jobs
                    .filter((j) => j.status !== "signed_off")
                    .map((j) => {
                      const latestPhoto = j.entries
                        .find((e) => e.media_urls.length > 0)
                        ?.media_urls[0];
                      return (
                        <SurfaceCard
                          key={j.id}
                          variant="primary"
                          padding="none"
                          className="overflow-hidden"
                        >
                          {latestPhoto ? (
                            <img
                              src={latestPhoto}
                              alt=""
                              className="h-40 w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-32 items-center justify-center bg-neutral-100">
                              <Camera className="h-6 w-6 text-neutral-400" aria-hidden />
                            </div>
                          )}
                          <div className="p-3">
                            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                              {j.merchantName}
                            </div>
                            <div className="mt-0.5 text-[15px] font-semibold text-neutral-900">
                              {j.title}
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${j.progress}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-between text-[13px] text-neutral-500 capitalize">
                              <span>{j.status.replace(/_/g, " ")}</span>
                              <span>{j.progress}%</span>
                            </div>
                            {j.entries[0] ? (
                              <div className="mt-3 border-t border-neutral-100 pt-2 text-[13px]">
                                <div className="font-semibold text-neutral-900">
                                  {j.entries[0].headline}
                                </div>
                                <div className="text-neutral-500">
                                  {new Date(j.entries[0].occurred_at).toLocaleDateString(
                                    undefined,
                                    { day: "numeric", month: "short" }
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </SurfaceCard>
                      );
                    })}
                </div>
              </section>
            ) : null}

            {/* QUOTES */}
            {quotes.length > 0 ? (
              <section className="mb-4">
                <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
                  <Receipt className="h-5 w-5" aria-hidden />
                  Quotes ({quotes.length})
                </h2>
                <p className="mb-3 text-[13px] text-neutral-600">
                  All your quotes in one place — compare, accept or decline
                  side-by-side. No more chasing merchants for updates.
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {quotes.map((q) => {
                    const accepted = q.status === "accepted";
                    return (
                      <a
                        key={q.id}
                        href={`/quote/${q.shareToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <SurfaceCard
                          variant={accepted ? "success" : "primary"}
                          padding="md"
                          interactive
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                              {q.merchantName}
                            </div>
                            {accepted ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[13px] font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3 w-3" aria-hidden />
                                Accepted
                              </span>
                            ) : (
                              <span className="text-[13px] font-semibold capitalize text-neutral-600">
                                {q.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-[15px] font-semibold text-neutral-900">
                            {q.title}
                          </div>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold">
                              £{(q.totalPence / 100).toFixed(2)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-neutral-500">
                              Open
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </span>
                          </div>
                        </SurfaceCard>
                      </a>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* TIMELINE */}
            <section className="mb-4">
              <h2 className="mb-2 text-xl font-semibold">Home Timeline</h2>
              {timeline.length === 0 ? (
                <SurfaceCard variant="secondary" padding="md">
                  <div className="text-[13px] text-neutral-600">
                    Every render, quote, install and warranty on this
                    property will show up here — chronological, permanent.
                  </div>
                </SurfaceCard>
              ) : (
                <ol className="relative ml-4 border-l-2 border-neutral-200">
                  {timeline.map((e) => (
                    <li key={e.id} className="mb-4 ml-4">
                      <span className="absolute -left-[7px] mt-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-neutral-900" />
                      <div className="text-[13px] text-neutral-500">
                        {new Date(e.occurred_at).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </div>
                      <div className="text-[14px] font-semibold text-neutral-900">
                        {e.headline}
                      </div>
                      {e.verb === "render.completed" && e.payload.render_url ? (
                        <img
                          src={String(e.payload.render_url)}
                          alt=""
                          className="mt-2 max-w-[220px] rounded-lg border border-neutral-200"
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* WARRANTIES + DOCUMENTS */}
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SurfaceCard variant="primary" padding="md">
                <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Warranties
                </div>
                <p className="mt-2 text-[13px] text-neutral-600">
                  Every product installed on this property will register
                  its warranty here — automatically at sign-off.
                </p>
              </SurfaceCard>
              <SurfaceCard variant="primary" padding="md">
                <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Documents
                </div>
                {documents.length === 0 ? (
                  <p className="mt-2 text-[13px] text-neutral-600">
                    Receipts, EPCs, deeds, insurance — one place for all
                    your property paperwork.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {documents.slice(0, 8).map((d) => (
                      <li key={d.id} className="text-[13px] text-neutral-800">
                        {d.title}
                      </li>
                    ))}
                  </ul>
                )}
              </SurfaceCard>
            </section>

            {/* NEXT UP */}
            <section className="mt-4">
              <SurfaceCard variant="highlight" padding="md">
                <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-amber-900">
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  Next up
                </div>
                <p className="mt-2 text-[13px] text-amber-900">
                  Once your projects and warranties build up, this space
                  suggests your next best action — a service due, a warranty
                  expiring, a great trade nearby.
                </p>
              </SurfaceCard>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
