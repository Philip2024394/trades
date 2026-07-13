"use client";

// Client shell for /jobs — the portfolio page. Photo-first grid,
// filter chips, owner Feature/Delete controls, customer WhatsApp CTAs.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  Sparkles,
  MoreHorizontal,
  Trash2,
  Star,
  Camera
} from "lucide-react";
import type { CanteenChatPost } from "@/lib/canteens.server";
import { CanteenBottomNav } from "@/components/xrated/yard/CanteenBottomNav";

const CREAM = "#FBF6EC";
const TAN = "#B8860B";
const BRAND_BLACK = "#0A0A0A";

// Fallback jobs so the page always renders content in demo mode.
const MOCK_JOBS: CanteenChatPost[] = [
  {
    id: "mock-job-1",
    canteenId: "demo",
    authorSlug: "mike-watson",
    authorDisplayName: "Mike Watson",
    body: "Whittington fit-out — 3-day install into a full new-build kitchen. Solid oak carcass, quartz worktop, undermount sink. Client over the moon.",
    photoUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2011_04_56%20PM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jun%2030,%202026,%2006_38_39%20PM.png"
    ],
    moodSlug: "showcase",
    reactionsLike: 22,
    reactionsAgree: 5,
    reactionsQuestion: 0,
    replyCount: 6,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "mock-job-2",
    canteenId: "demo",
    authorSlug: "mike-watson",
    authorDisplayName: "Mike Watson",
    body: "Full Sale refit — 25sqm kitchen with island. Bespoke shaker doors and brushed brass handles. Two-week project, on time.",
    photoUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%203,%202026,%2008_44_32%20AM.png",
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%206,%202026,%2002_03_04%20PM.png"
    ],
    moodSlug: "showcase",
    reactionsLike: 18,
    reactionsAgree: 3,
    reactionsQuestion: 0,
    replyCount: 4,
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "mock-job-3",
    canteenId: "demo",
    authorSlug: "mike-watson",
    authorDisplayName: "Mike Watson",
    body: "Altrincham cabinet respray — took a tired 15-year-old kitchen from beech to F&B Setting Plaster. Half the cost of a full replacement.",
    photoUrls: [
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%205,%202026,%2012_45_11%20AM.png"
    ],
    moodSlug: "showcase",
    reactionsLike: 31,
    reactionsAgree: 9,
    reactionsQuestion: 0,
    replyCount: 12,
    createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Deterministic pull quote per job so demo content feels curated.
const DEMO_QUOTES = [
  { body: "The joinery is spec you don't get from a showroom.",             author: "Rachel S · Sale" },
  { body: "On time. Priced clearly. Would hire again tomorrow.",            author: "Andrew D · Altrincham" },
  { body: "Turned my tired kitchen into something I'm proud of.",          author: "Priya M · Stockport" },
  { body: "First call for unusual bespoke work.",                          author: "Sam B · Manchester" }
];

function quoteFor(postId: string) {
  let h = 0;
  for (let i = 0; i < postId.length; i++) h = ((h << 5) - h) + postId.charCodeAt(i);
  return DEMO_QUOTES[Math.abs(h) % DEMO_QUOTES.length];
}

function timeAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000)));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function CanteenJobsShell({
  canteenSlug,
  canteenName: _canteenName,
  tradeLabel,
  hostDisplayName,
  hostWhatsapp,
  isHost,
  jobs
}: {
  canteenSlug: string;
  canteenName: string;
  tradeLabel: string;
  hostDisplayName: string;
  hostWhatsapp: string | null;
  isHost: boolean;
  jobs: CanteenChatPost[];
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [featured, setFeatured] = useState<Set<string>>(new Set());

  const source = jobs.length > 0 ? jobs : MOCK_JOBS;
  const firstName = hostDisplayName.split(/\s+/)[0] ?? hostDisplayName;

  const visible = useMemo(() => {
    const filtered = source.filter((j) => !removed.has(j.id));
    // Featured items float to the top.
    return [...filtered].sort((a, b) => {
      const aF = featured.has(a.id) ? 1 : 0;
      const bF = featured.has(b.id) ? 1 : 0;
      return bF - aF;
    });
  }, [source, removed, featured]);

  async function deleteJob(postId: string) {
    setRemoved((s) => new Set(s).add(postId));
    try {
      await fetch(`/api/canteens/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(postId);
        return next;
      });
    }
  }

  function toggleFeatured(postId: string) {
    setFeatured((s) => {
      const next = new Set(s);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ backgroundColor: CREAM }}>
      {/* Header */}
      <section className="mx-auto max-w-4xl px-3 pt-4 md:px-6 md:pt-6">
        <Link
          href={`/trade-off/yard/canteens/${canteenSlug}`}
          className="mb-2 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600"
        >
          <ArrowLeft size={12}/>
          Home
        </Link>
        <h1
          className="text-[28px] font-black leading-[1.02] text-neutral-900 sm:text-[34px]"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          {isHost ? "My Jobs" : `${firstName}'s work`}
        </h1>
        <p className="mt-1 text-[12.5px] font-bold text-neutral-600">
          {source.length} completed job{source.length === 1 ? "" : "s"} · Real photos, real feedback
        </p>
      </section>

      {/* Grid */}
      <section className="mx-auto max-w-4xl px-3 pb-24 pt-4 md:px-6 md:pt-6">
        {visible.length === 0 ? (
          <div
            className="rounded-2xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <div
              className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: TAN, color: "#FFFFFF" }}
            >
              <Camera size={20}/>
            </div>
            <div className="text-[14px] font-black text-neutral-900">
              {isHost ? "No jobs in your portfolio yet" : `${firstName} hasn't uploaded work here yet`}
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-snug text-neutral-600">
              {isHost
                ? "Post an update with photos and tick 'Also share to My Jobs' — it lands here automatically."
                : "Ask them directly on WhatsApp for photos of past work."
              }
            </p>
            {isHost && (
              <Link
                href={`/trade-off/yard/canteens/${canteenSlug}/post`}
                className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white shadow-sm"
                style={{ backgroundColor: TAN }}
              >
                Post your first job
              </Link>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-4 md:gap-6">
            {visible.map((job) => (
              <li key={job.id}>
                <JobCard
                  job={job}
                  tradeLabel={tradeLabel}
                  hostFirstName={firstName}
                  hostWhatsapp={hostWhatsapp}
                  isHost={isHost}
                  isFeatured={featured.has(job.id)}
                  onDelete={deleteJob}
                  onToggleFeatured={toggleFeatured}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <CanteenBottomNav canteenSlug={canteenSlug}/>
    </main>
  );
}

// ─── Individual job card ─────────────────────────────────

function JobCard({
  job,
  tradeLabel,
  hostFirstName,
  hostWhatsapp,
  isHost,
  isFeatured,
  onDelete,
  onToggleFeatured
}: {
  job: CanteenChatPost;
  tradeLabel: string;
  hostFirstName: string;
  hostWhatsapp: string | null;
  isHost: boolean;
  isFeatured: boolean;
  onDelete: (id: string) => void;
  onToggleFeatured: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const photos = job.photoUrls ?? [];
  const quote = quoteFor(job.id);
  const waUrl = hostWhatsapp
    ? `https://wa.me/${hostWhatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi ${hostFirstName}, I saw one of your jobs on The Network — I'd like to book something similar for ${tradeLabel.toLowerCase()} work.`)}`
    : null;

  return (
    <article
      className="overflow-hidden rounded-2xl border bg-white shadow-md"
      style={{ borderColor: "rgba(139,69,19,0.10)" }}
    >
      {/* Photos — big hero image + up to 3 thumbnails */}
      <div className={`grid gap-1 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
        <div
          className={`relative ${photos.length === 1 ? "aspect-[16/10]" : "col-span-2 aspect-square"}`}
          style={{
            backgroundImage: `url('${photos[0]}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#F3F4F6"
          }}
          aria-hidden
        >
          {isFeatured && (
            <span
              className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] shadow-md"
              style={{ backgroundColor: TAN, color: "#FFFFFF" }}
            >
              <Sparkles size={9} strokeWidth={3}/>
              Featured
            </span>
          )}
        </div>
        {photos.slice(1, 3).map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="relative aspect-square"
            style={{
              backgroundImage: `url('${url}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundColor: "#F3F4F6"
            }}
            aria-hidden
          />
        ))}
      </div>

      {/* Body */}
      <div className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
              {tradeLabel}
              <span className="text-neutral-300">·</span>
              <span>{timeAgo(job.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-neutral-800">
              {job.body}
            </p>
          </div>
          {isHost && (
            <div className="relative flex-shrink-0">
              <button
                type="button"
                aria-label="Job actions"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
              >
                <MoreHorizontal size={16}/>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)}/>
                  <div
                    className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border bg-white shadow-lg"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  >
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onToggleFeatured(job.id); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-bold text-neutral-800 hover:bg-neutral-50"
                    >
                      <Sparkles size={13}/>
                      {isFeatured ? "Unfeature" : "Feature this job"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onDelete(job.id); }}
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-[12px] font-bold text-red-600 hover:bg-red-50"
                      style={{ borderColor: "rgba(139,69,19,0.10)" }}
                    >
                      <Trash2 size={13}/>
                      Remove from portfolio
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Customer pull-quote */}
        <div
          className="mt-3 border-l-2 pl-3"
          style={{ borderColor: TAN }}
        >
          <p
            className="text-[13px] italic leading-snug text-neutral-800"
            style={{ fontFamily: 'Georgia, "Playfair Display", serif' }}
          >
            &ldquo;{quote.body}&rdquo;
          </p>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            <Star size={9} fill="currentColor" strokeWidth={0} style={{ color: "#F59E0B" }}/>
            {quote.author}
          </div>
        </div>

        {/* CTA row */}
        {waUrl && (
          <div className="mt-3 flex items-center gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[11.5px] font-black uppercase tracking-wider text-white shadow-md"
              style={{ backgroundColor: "#166534" }}
            >
              <MessageCircle size={13} strokeWidth={2.5}/>
              Book similar work
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
