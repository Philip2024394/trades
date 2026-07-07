// /project/track?token=…
//
// Homeowner-side view of a submitted project. Read-only. No account
// required — the signed tracking token is enough. Shows:
//   • Project summary (title, scope, budget, timeframe)
//   • Invited trades + reply state
//   • Trade replies in chronological order
//   • CTA to convert into a full Notebook account

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  MapPin,
  Wallet,
  Users,
  MessageSquare,
  CheckCircle2,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { verifyProjectTrackToken } from "@/lib/projectTrackToken";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your project · The Construction Notebook",
  robots: { index: false, follow: false }
};

type InvitedTrade = {
  businessId: string;
  displayName: string;
  slug: string;
  trade: string;
  avatarUrl: string | null;
  hasReplied: boolean;
};

type ReplyRow = {
  id: string;
  merchantName: string;
  message: string;
  occurredAt: string;
};

type ProjectView = {
  id: string;
  title: string;
  status: string;
  scope: string;
  timeframe: string;
  budget: string;
  postcode: string;
  invited: InvitedTrade[];
  replies: ReplyRow[];
  createdAt: string;
};

async function loadProjectView(projectId: string): Promise<ProjectView | null> {
  const { data: project } = await supabaseAdmin
    .from("os_projects")
    .select("id, title, status, notes, property_id, created_at")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [propRes, participantsRes, timelineRes] = await Promise.all([
    supabaseAdmin
      .from("os_properties")
      .select("postcode")
      .eq("id", project.property_id)
      .maybeSingle(),
    supabaseAdmin
      .from("os_project_participants")
      .select("business_id, joined_at")
      .eq("project_id", projectId)
      .eq("role", "main_contractor"),
    supabaseAdmin
      .from("os_home_timeline_events")
      .select("id, verb, headline, payload, occurred_at, subject_id")
      .eq("subject_id", projectId)
      .eq("verb", "project.reply")
      .order("occurred_at", { ascending: false })
      .limit(50)
  ]);

  const notes = (project.notes ?? "").split("\n").filter(Boolean);
  const scope = notes.find((l) => l.startsWith("Scope:"))?.replace(/^Scope:\s*/, "") ?? "";
  const timeframe = notes.find((l) => l.startsWith("Timeframe:"))?.replace(/^Timeframe:\s*/, "") ?? "";
  const budget = notes.find((l) => l.startsWith("Budget:"))?.replace(/^Budget:\s*/, "") ?? "";

  const participants = (participantsRes.data ?? []) as Array<{
    business_id: string;
    joined_at: string;
  }>;

  const businessIds = participants.map((p) => p.business_id).filter(Boolean);

  const { data: businesses } = businessIds.length > 0
    ? await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, display_name, slug, primary_trade, avatar_url")
        .in("id", businessIds)
    : { data: [] as Array<{
        id: string;
        display_name: string;
        slug: string;
        primary_trade: string;
        avatar_url: string | null;
      }> };

  const businessMap = new Map(
    (businesses ?? []).map((b) => [b.id, b])
  );

  const timeline = (timelineRes.data ?? []) as Array<{
    id: string;
    headline: string;
    payload: { merchant_name?: string; message?: string; business_id?: string };
    occurred_at: string;
  }>;

  const repliedBusinessIds = new Set(
    timeline
      .map((t) => t.payload?.business_id)
      .filter((id): id is string => Boolean(id))
  );

  const invited: InvitedTrade[] = participants.map((p) => {
    const b = businessMap.get(p.business_id);
    return {
      businessId: p.business_id,
      displayName: b?.display_name ?? "Trade",
      slug: b?.slug ?? "",
      trade: b?.primary_trade ?? "",
      avatarUrl: b?.avatar_url ?? null,
      hasReplied: repliedBusinessIds.has(p.business_id)
    };
  });

  const replies: ReplyRow[] = timeline.map((t) => ({
    id: t.id,
    merchantName: t.payload?.merchant_name ?? "Trade",
    message: t.payload?.message ?? "",
    occurredAt: t.occurred_at
  }));

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    scope,
    timeframe,
    budget,
    postcode: propRes.data?.postcode ?? "",
    invited,
    replies,
    createdAt: project.created_at
  };
}

export default async function ProjectTrackPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token;
  if (!token) notFound();

  const payload = verifyProjectTrackToken(token);
  if (!payload) {
    return (
      <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
        <div className="mx-auto max-w-lg px-6 py-16 text-center">
          <h1 className="text-[24px] font-bold">Link expired.</h1>
          <p className="mt-4 text-[14px] text-[#1B1A17]/60">
            This tracking link is invalid or has expired. Submit a new brief
            or open a Notebook to keep every project on file.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900"
          >
            Back to the Notebook
          </Link>
        </div>
      </main>
    );
  }

  const view = await loadProjectView(payload.projectId);
  if (!view) notFound();

  const repliedCount = view.invited.filter((i) => i.hasReplied).length;

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
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>

        <div className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-300">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
            aria-hidden
          />
          The Construction Notebook · Project
        </div>

        <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight md:text-[42px]">
          {view.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#1B1A17]/60">
          {view.postcode ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {view.postcode}
            </span>
          ) : null}
          {view.timeframe ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {view.timeframe}
            </span>
          ) : null}
          {view.budget ? (
            <span className="inline-flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {view.budget}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            Submitted{" "}
            {new Date(view.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}
          </span>
        </div>

        {/* Scope */}
        {view.scope ? (
          <div className="mt-8 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#1B1A17]/55">
              Your brief
            </div>
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.6] text-[#1B1A17]/85">
              {view.scope}
            </p>
          </div>
        ) : null}

        {/* Invited trades */}
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#1B1A17]/55">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Trades on your brief · {repliedCount}/{view.invited.length} replied
          </div>
          <div className="space-y-2">
            {view.invited.map((t) => (
              <div
                key={t.businessId}
                className="flex items-center gap-3 rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-3"
              >
                <div className="relative">
                  {t.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.avatarUrl}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-400 text-[14px] font-black text-neutral-900">
                      {t.displayName
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold text-[#1B1A17]">
                    {t.displayName}
                  </div>
                  <div className="text-[13px] capitalize text-[#1B1A17]/60">
                    {t.trade.replace(/-/g, " ")}
                  </div>
                </div>
                {t.hasReplied ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    Replied
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1B1A17]/45">
                    Waiting
                  </span>
                )}
              </div>
            ))}
            {view.invited.length === 0 ? (
              <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[13px] text-[#1B1A17]/60">
                No trades yet — check back once trades near you have joined.
              </div>
            ) : null}
          </div>
        </div>

        {/* Replies */}
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#1B1A17]/55">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            Replies
          </div>
          {view.replies.length === 0 ? (
            <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4 text-[13px] text-[#1B1A17]/60">
              No replies yet. Trades usually respond within 24 hours — check
              back or wait for the email.
            </div>
          ) : (
            <div className="space-y-3">
              {view.replies.map((r) => (
                <article
                  key={r.id}
                  className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-[14px] font-bold text-[#1B1A17]">
                      {r.merchantName}
                    </div>
                    <div className="text-[13px] text-[#1B1A17]/55">
                      {new Date(r.occurredAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.55] text-[#1B1A17]/85">
                    {r.message}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Upgrade CTA */}
        <div className="mt-12 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[#1B1A17]">
                Open your Notebook — free.
              </p>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#1B1A17]/70">
                Keep every project, warranty, photo and reply in one place.
                Follows your home when you sell.
              </p>
              <div className="mt-4">
                <Link
                  href="/home"
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[14px] font-bold text-neutral-900 hover:bg-amber-300"
                >
                  Open Notebook
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#1B1A17]/12 pt-6 text-[13px] text-[#1B1A17]/45">
          This tracking link is valid for 60 days.
        </div>
      </div>
    </main>
  );
}
