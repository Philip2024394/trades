// /reviewer/[id] — reviewer profile.
//
// One of two identifiers works: a merchant slug (verified reviewer
// linked to a Network listing) or an anonymous cookie UUID (walk-up
// reviewer). Either way, the page shows their accountability record
// + every review they've written. Trust transparency: buyers can
// click any review and see who wrote it and their history.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { overallForReview } from "@/lib/reviews";
import { reviewerWeight } from "@/lib/reviewerAccountability";
import { ArrowLeft, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Reviewer · The Network`,
    description: `Accountability record + reviews written by this member on The Network.`,
    alternates: { canonical: `/reviewer/${id}` },
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: "Reviewer profile",
      description: "Accountability record + review history.",
      url: absolute(`/reviewer/${id}`)
    }
  };
}

export default async function ReviewerProfilePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Reviews written by this identifier (matches slug OR cookie).
  const res = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id, merchant_slug, reviewer_display_name, reviewer_trade_label, reviewer_city, quality_score, communication_score, punctuality_score, value_score, cleanliness_score, trade_specific_score, body, status, created_at")
    .or(`reviewer_slug.eq.${id},reviewer_cookie.eq.${id}`)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  const reviews = res.data ?? [];
  if (reviews.length === 0) notFound();

  // Sample the display name + trade + city from the most recent review.
  const first = reviews[0] as {
    reviewer_display_name: string;
    reviewer_trade_label: string | null;
    reviewer_city: string | null;
  };
  const displayName = first.reviewer_display_name;
  const tradeLabel = first.reviewer_trade_label ?? "";
  const city = first.reviewer_city ?? "";

  const weight = await reviewerWeight(id);

  // Simple counts for the summary strip.
  const submitted = reviews.length;
  const disputedRes = await supabaseAdmin
    .from("hammerex_network_reviewer_accountability")
    .select("reviews_disputed, reviews_removed")
    .eq("reviewer_slug", id)
    .maybeSingle();
  const disputed = disputedRes.data?.reviews_disputed ?? 0;
  const removed = disputedRes.data?.reviews_removed ?? 0;

  const trustTone: "trusted" | "default" | "contested" =
    weight >= 1.25 ? "trusted" : weight <= 0.75 ? "contested" : "default";

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader />
      <div className="pb-16">
        <section
          className="relative overflow-hidden border-b"
          style={{ backgroundColor: "#0A0A0A", borderColor: "rgba(255,179,0,0.2)" }}
        >
          <div className="mx-auto max-w-3xl px-3 py-8 md:px-6 md:py-10">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={11} strokeWidth={2.5}/>
              Back to The Network
            </Link>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 shadow-lg"
                style={{ borderColor: "#FFB300", backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <span className="text-[24px] font-black">{displayName.charAt(0)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: "#FFB300" }}>
                  Reviewer
                </div>
                <h1 className="text-[22px] font-black leading-tight text-white md:text-[26px]">
                  {displayName}
                </h1>
                <div className="text-[11px] font-bold text-neutral-400">
                  {tradeLabel}{city ? ` · ${city}` : ""}
                </div>
              </div>
            </div>

            {/* Accountability strip */}
            <div
              className="mt-5 rounded-2xl border p-4"
              style={{
                borderColor: trustTone === "contested" ? "#DC2626" : trustTone === "trusted" ? "#166534" : "rgba(255,179,0,0.4)",
                backgroundColor: "rgba(255,255,255,0.03)"
              }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                {trustTone === "trusted" && <ShieldCheck size={12} color="#7EE7A5" strokeWidth={2.5}/>}
                {trustTone === "contested" && <ShieldAlert size={12} color="#FCA5A5" strokeWidth={2.5}/>}
                {trustTone === "default" && <ShieldCheck size={12} color="#FFB300" strokeWidth={2.5}/>}
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-300">
                  {trustTone === "trusted" ? "Trusted voice on The Network" : trustTone === "contested" ? "Contested reviewer history" : "Reviewer accountability"}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-[12px] text-neutral-300">
                <div>
                  <span className="text-[20px] font-black tabular-nums text-white">{submitted}</span>
                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">submitted</span>
                </div>
                <div>
                  <span className="text-[20px] font-black tabular-nums text-white">{disputed}</span>
                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">disputed</span>
                </div>
                <div>
                  <span className="text-[20px] font-black tabular-nums text-white">{removed}</span>
                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">removed</span>
                </div>
                <div>
                  <span className="text-[20px] font-black tabular-nums text-white">{weight.toFixed(2)}×</span>
                  <span className="ml-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">vote weight</span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-neutral-500">
                Weight multiplies this reviewer's vote in every merchant aggregate. Baseline 1.0×; drops as disputes accumulate. Verified job reviews weight higher.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-3xl px-3 pt-6 md:px-6 md:pt-8">
          <div className="mb-3 flex items-center gap-1.5">
            <Star size={12} fill="#FFB300" color="#FFB300" strokeWidth={0}/>
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-700">
              Reviews written · {reviews.length}
            </span>
          </div>
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <ReviewerReviewCard row={r}/>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <XratedFooter />
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReviewerReviewCard({ row }: { row: any }) {
  const overall = overallForReview({
    quality: row.quality_score,
    communication: row.communication_score,
    punctuality: row.punctuality_score,
    value: row.value_score,
    cleanliness: row.cleanliness_score,
    trade_specific: row.trade_specific_score ?? undefined
  });
  return (
    <article className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Star size={13} fill="#FFB300" color="#FFB300" strokeWidth={0}/>
          <span className="text-[16px] font-black tabular-nums text-neutral-900">{overall.toFixed(1)}</span>
          <Link href={`/trade/${row.merchant_slug}/reviews`} className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
            → {row.merchant_slug}
          </Link>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
          {formatAgo(row.created_at)}
        </span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-800">"{row.body}"</p>
    </article>
  );
}

function formatAgo(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
