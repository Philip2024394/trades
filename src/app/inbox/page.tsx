// /inbox?token=…
//
// Merchant brief inbox. Opens from the email link fired by
// /api/project/submit. Token grants read-only access to that
// merchant's incoming project briefs for 30 days.
//
// Server component — token verification happens before render.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Clock, Wallet, User, Send } from "lucide-react";
import { verifyInboxToken } from "@/lib/inboxToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ReplyForm } from "./ReplyForm";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Trade Inbox · The Construction Notebook",
  robots: { index: false, follow: false }
};

type BriefRow = {
  projectId: string;
  title: string;
  leafSlug: string | null;
  notes: string | null;
  createdAt: string;
  status: string;
  homeownerName: string | null;
  homeownerEmail: string | null;
  homeownerWhatsapp: string | null;
  postcode: string;
};

async function loadBriefs(
  businessId: string
): Promise<{ merchant: { id: string; displayName: string; slug: string } | null; briefs: BriefRow[] }> {
  const { data: merchant } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, slug")
    .eq("id", businessId)
    .maybeSingle();

  if (!merchant) return { merchant: null, briefs: [] };

  // Load participant rows where this merchant is main_contractor
  // (invited to bid). Best-effort — the table may be empty in
  // environments where the V2 migrations haven't run.
  const { data: participants } = await supabaseAdmin
    .from("os_project_participants")
    .select("project_id, joined_at")
    .eq("business_id", businessId)
    .eq("role", "main_contractor")
    .order("joined_at", { ascending: false })
    .limit(50);

  const projectIds = (participants ?? []).map((p) => p.project_id);
  if (projectIds.length === 0) {
    return {
      merchant: {
        id: merchant.id,
        displayName: merchant.display_name,
        slug: merchant.slug
      },
      briefs: []
    };
  }

  const { data: projects } = await supabaseAdmin
    .from("os_projects")
    .select("id, title, leaf_slug, notes, created_at, status, property_id, primary_party_id")
    .in("id", projectIds)
    .order("created_at", { ascending: false });

  const rows = (projects ?? []) as Array<{
    id: string;
    title: string;
    leaf_slug: string | null;
    notes: string | null;
    created_at: string;
    status: string;
    property_id: string;
    primary_party_id: string | null;
  }>;

  const propertyIds = rows.map((r) => r.property_id).filter(Boolean);
  const partyIds = rows.map((r) => r.primary_party_id).filter(Boolean) as string[];

  const [{ data: props }, { data: parties }] = await Promise.all([
    supabaseAdmin
      .from("os_properties")
      .select("id, postcode")
      .in("id", propertyIds),
    partyIds.length > 0
      ? supabaseAdmin
          .from("os_parties")
          .select("id, display_name, email, whatsapp_e164")
          .in("id", partyIds)
      : Promise.resolve({ data: [] as Array<{
          id: string;
          display_name: string | null;
          email: string | null;
          whatsapp_e164: string | null;
        }> })
  ]);

  const propMap = new Map(
    (props ?? []).map((p) => [p.id, p.postcode as string])
  );
  const partyMap = new Map(
    (parties ?? []).map((p) => [p.id, p])
  );

  const briefs: BriefRow[] = rows.map((r) => {
    const party = r.primary_party_id ? partyMap.get(r.primary_party_id) : null;
    return {
      projectId: r.id,
      title: r.title,
      leafSlug: r.leaf_slug,
      notes: r.notes,
      createdAt: r.created_at,
      status: r.status,
      homeownerName: party?.display_name ?? null,
      homeownerEmail: party?.email ?? null,
      homeownerWhatsapp: party?.whatsapp_e164 ?? null,
      postcode: propMap.get(r.property_id) ?? ""
    };
  });

  return {
    merchant: {
      id: merchant.id,
      displayName: merchant.display_name,
      slug: merchant.slug
    },
    briefs
  };
}

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;
  if (!token) notFound();

  const payload = verifyInboxToken(token);
  if (!payload) {
    return (
      <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <h1 className="text-[24px] font-bold">Link expired.</h1>
          <p className="mt-4 text-[14px] text-[#1B1A17]/60">
            This inbox link is invalid or has expired. Ask the homeowner to
            resend, or head back to your Notebook.
          </p>
          <Link
            href={`/`}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900"
          >
            Home
          </Link>
        </div>
      </main>
    );
  }

  const { merchant, briefs } = await loadBriefs(payload.businessId);
  if (!merchant) notFound();

  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 39px, #ffffff 40px)",
          backgroundSize: "100% 40px"
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:px-8 md:py-14">
        <Link
          href={`/trade/${merchant.slug}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {merchant.displayName}
        </Link>

        <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            aria-hidden
          />
          The Construction Notebook · Trade Inbox
        </div>
        <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight md:text-[42px]">
          {briefs.length === 0
            ? "No new briefs yet."
            : `${briefs.length} new brief${briefs.length === 1 ? "" : "s"}.`}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-[1.55] text-[#1B1A17]/70">
          Homeowners send briefs directly to {merchant.displayName}. Replies
          go back through the Notebook so every conversation stays on record.
        </p>

        <div className="mt-10 space-y-5">
          {briefs.length === 0 ? (
            <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-6 text-center text-[14px] text-[#1B1A17]/60">
              As soon as a homeowner near you sends a brief matching your
              trades, it will land here.
            </div>
          ) : (
            briefs.map((b) => <BriefCard key={b.projectId} brief={b} />)
          )}
        </div>
      </div>
    </main>
  );
}

function BriefCard({ brief }: { brief: BriefRow }) {
  const notes = (brief.notes ?? "").split("\n").filter(Boolean);
  const scope = notes.find((l) => l.startsWith("Scope:"))?.replace(/^Scope:\s*/, "") ?? "";
  const timeframe = notes.find((l) => l.startsWith("Timeframe:"))?.replace(/^Timeframe:\s*/, "") ?? "";
  const budget = notes.find((l) => l.startsWith("Budget:"))?.replace(/^Budget:\s*/, "") ?? "";
  const contactPref =
    notes.find((l) => l.startsWith("Contact preference:"))?.replace(/^Contact preference:\s*/, "") ?? "";

  return (
    <article className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5 backdrop-blur md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-bold text-[#1B1A17] md:text-[20px]">
          {brief.title}
        </h2>
        <span className="text-[13px] text-[#1B1A17]/55">
          {new Date(brief.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#1B1A17]/60">
        {brief.postcode ? (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {brief.postcode}
          </span>
        ) : null}
        {timeframe ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {timeframe}
          </span>
        ) : null}
        {budget ? (
          <span className="inline-flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            {budget}
          </span>
        ) : null}
      </div>

      {scope ? (
        <p className="mt-4 text-[14px] leading-[1.55] text-[#1B1A17]/85">
          {scope}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl border border-[#1B1A17]/12 bg-[#FBF6EC]/40 p-3 text-[13px] text-[#1B1A17]/75">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#1B1A17]/55">
          <User className="h-3 w-3" aria-hidden />
          Homeowner contact
        </div>
        <div className="mt-1">
          <span className="font-semibold text-[#1B1A17]">
            {brief.homeownerName ?? "Homeowner"}
          </span>
          {brief.homeownerEmail ? (
            <>
              {" · "}
              <a
                href={`mailto:${brief.homeownerEmail}`}
                className="text-amber-300 hover:text-amber-200"
              >
                {brief.homeownerEmail}
              </a>
            </>
          ) : null}
          {brief.homeownerWhatsapp ? (
            <>
              {" · "}
              <span className="text-[#1B1A17]/60">{brief.homeownerWhatsapp}</span>
            </>
          ) : null}
        </div>
        {contactPref ? (
          <div className="mt-1 text-[13px] text-[#1B1A17]/55">
            Prefers: {contactPref}
          </div>
        ) : null}
      </div>

      <ReplyForm projectId={brief.projectId} />
    </article>
  );
}
