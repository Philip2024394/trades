// /trade-off/yard/canteens/[slug]/about — read-only "About this canteen".
//
// Linked from the CanteenHeader's About chip. Renders canteen banner,
// name, tagline, host card, member/activity stats, founding-100 badge,
// and a back-to-canteen link. Falls back cleanly for mock canteens
// (server-side reader already handles that).
//
// Public. No auth. RLS makes canteens readable to anon so this stays
// cacheable at the edge.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, MapPin, Calendar, Activity, ChevronRight } from "lucide-react";
import { canteenBySlugFromDb, adminForCanteenFromDb } from "@/lib/canteens.server";
import { BRAND, absolute } from "@/lib/seo";

export const dynamic = "force-dynamic";

const CREAM = "#FBF6EC";
const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK = "#0A0A0A";
const BRAND_GREEN_DARK = "#166534";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) {
    return { title: "Canteen not found | Thenetworkers" };
  }
  return {
    title: `About ${canteen.name} | Thenetworkers`,
    description: canteen.tagline,
    alternates: { canonical: `/trade-off/yard/canteens/${slug}/about` },
    openGraph: {
      type: "website",
      siteName: BRAND.name,
      title: `About ${canteen.name}`,
      description: canteen.tagline,
      url: absolute(`/trade-off/yard/canteens/${slug}/about`),
      images: canteen.headerBgUrl ? [{ url: canteen.headerBgUrl }] : undefined
    }
  };
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / (24 * 60 * 60 * 1000)));
}

export default async function CanteenAboutPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const canteen = await canteenBySlugFromDb(slug);
  if (!canteen) notFound();

  // Admin card is optional — the mock reader returns null for canteens
  // without a paired admin member. We still render the page.
  const admin = await adminForCanteenFromDb(canteen.id);
  const daysOld = daysSince(canteen.createdAt);

  return (
    <main className="min-h-screen" style={{ backgroundColor: CREAM }}>
      {/* Hero — matches the canteen header visual language */}
      <section className="relative overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
        {canteen.headerBgUrl ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url('${canteen.headerBgUrl}')`,
              backgroundSize: "cover",
              backgroundPosition: "center"
            }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 20% 30%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 80% 70%, ${BRAND_YELLOW}18 0%, transparent 55%)`
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.85) 100%)"
          }}
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8">
          <Link
            href={`/trade-off/yard/canteens/${slug}`}
            className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/85 backdrop-blur transition hover:bg-white/15"
          >
            <ArrowLeft size={10} strokeWidth={3}/>
            Back to canteen
          </Link>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-sm px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em]"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              {canteen.tradeLabel}
            </span>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
            About this canteen
          </div>
          <h1 className="mt-1 text-[28px] font-black leading-[1.05] text-white drop-shadow-md sm:text-[36px]">
            {canteen.name}
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-snug text-white/85 sm:text-[14px]">
            {canteen.tagline}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Host card */}
        <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Hosted by
          </div>
          <div className="flex items-center gap-3">
            {admin?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={admin.avatarUrl}
                alt=""
                className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-black"
                style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
              >
                {canteen.hostDisplayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-black text-neutral-900">{canteen.hostDisplayName}</div>
              {admin?.city && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-neutral-500">
                  <MapPin size={11}/>
                  {admin.city}
                </div>
              )}
              {admin?.bioShort && (
                <p className="mt-1.5 text-[12.5px] leading-snug text-neutral-700">{admin.bioShort}</p>
              )}
            </div>
            <Link
              href={`/trade/${canteen.hostSlug}`}
              className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition"
              style={{ backgroundColor: BRAND_YELLOW }}
            >
              View profile
              <ChevronRight size={11}/>
            </Link>
          </div>
        </div>

        {/* Stats grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            icon={<Users size={14}/>}
            label="Members"
            value={String(canteen.memberCount)}
          />
          <StatTile
            icon={<Activity size={14}/>}
            label="Posts / 30d"
            value={String(canteen.postsLast30d)}
            accent={canteen.activityStreakMonths >= 3 ? "green" : undefined}
          />
          <StatTile
            icon={<Calendar size={14}/>}
            label="Live since"
            value={daysOld < 30 ? `${daysOld}d ago` : formatFullDate(canteen.createdAt)}
          />
        </div>

        {/* Details block */}
        <div className="rounded-xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            The details
          </div>
          <dl className="grid gap-3 text-[13px]">
            <Row label="Trade" value={canteen.tradeLabel}/>
            <Row label="Slug" value={canteen.slug}/>
            <Row label="Created" value={formatFullDate(canteen.createdAt)}/>
            <Row label="Activity streak" value={canteen.activityStreakMonths === 0 ? "None yet" : `${canteen.activityStreakMonths} month${canteen.activityStreakMonths === 1 ? "" : "s"}`}/>
          </dl>
        </div>

        {/* Back link — bottom for long scrolls */}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/trade-off/yard/canteens/${slug}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            <ArrowLeft size={12} strokeWidth={2.5}/>
            Back to {canteen.name}
          </Link>
        </div>
      </section>
    </main>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "green";
}) {
  return (
    <div className="rounded-xl border bg-white p-3 shadow-sm" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div
        className="mt-1.5 text-[20px] font-black leading-none"
        style={{ color: accent === "green" ? BRAND_GREEN_DARK : "#0A0A0A" }}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <dt className="text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="text-right text-[13px] font-bold text-neutral-800">{value}</dd>
    </div>
  );
}
