// /join/[token] — public invitation landing page.
//
// Trade taps nw.app/join/{token} from their WhatsApp message. Sees:
//   • Homeowner name + SiteBook nickname
//   • City (never exact address — privacy model preserved)
//   • Project(s) being invited to, with title + brief + budget
//   • Accept + Decline buttons
//
// No auth required — the token is the credential. Tokens are
// crypto-random 12-char strings, scoped to a specific (trade,
// project[]) pair, revocable by the homeowner.

import { BookOpen, MapPin, Wallet, Users } from "lucide-react";
import { supabaseAdmin }         from "@/lib/supabaseAdmin";
import { loadInvitationByToken } from "@/lib/homeowners/invitations";
import { JoinActions }           from "./JoinActions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";
const OFF_WHITE    = "#FBF6EC";

type ProjectRow = {
  id:              string;
  title:           string;
  description:     string | null;
  address_city:    string | null;
  budget_min_gbp:  number | null;
  budget_max_gbp:  number | null;
  timeline:        string | null;
};

function formatBudget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 1000 ? `£${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `£${n}`;
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)}`;
  return fmt((max || min) as number);
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv       = await loadInvitationByToken(token);

  if (!inv) return <TerminalState kind="not-found"/>;
  if (inv.status === "revoked")    return <TerminalState kind="revoked"/>;
  if (inv.status === "accepted")   return <TerminalState kind="accepted"/>;
  if (inv.status === "declined")   return <TerminalState kind="declined"/>;

  // Load homeowner + projects for context
  const [hoRes, projRes] = await Promise.all([
    supabaseAdmin
      .from("hammerex_homeowners")
      .select("first_name, house_nickname, city")
      .eq("id", inv.homeowner_id)
      .maybeSingle(),
    supabaseAdmin
      .from("hammerex_sitebook_projects")
      .select("id, title, description, address_city, budget_min_gbp, budget_max_gbp, timeline")
      .in("id", inv.project_ids)
  ]);

  const homeowner = hoRes.data as { first_name: string | null; house_nickname: string; city: string | null } | null;
  const projects  = (projRes.data as ProjectRow[]) ?? [];

  const ownerName = homeowner?.first_name || "the homeowner";
  const nickname  = homeowner?.house_nickname || "SiteBook";

  return (
    <div className="min-h-screen" style={{ backgroundColor: OFF_WHITE }}>
      <header className="border-b border-neutral-200 backdrop-blur" style={{ backgroundColor: OFF_WHITE }}>
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
            <BookOpen size={14} strokeWidth={2.4}/>
          </span>
          <span className="font-black text-neutral-900">SiteBook Invitation</span>
          <span className="ml-auto text-[10.5px] font-black uppercase tracking-wider text-neutral-500">
            {inv.trade_merchant_name || "You"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            You&rsquo;re invited
          </p>
          <h1 className="mt-1 text-[22px] font-black leading-tight text-neutral-900">
            {ownerName} invited you to <span style={{ color: "#166534" }}>{nickname}</span>.
          </h1>
          <p className="mt-2 text-[13px] text-neutral-600">
            Accept to join {ownerName}&rsquo;s project SiteBook — see the brief, upload photos, quote, and coordinate directly. WhatsApp still works for chat; SiteBook keeps the record.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-bold">
              <Users size={11}/> {projects.length === 1 ? "1 project" : `${projects.length} projects`}
            </span>
            {homeowner?.city && (
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 font-bold">
                <MapPin size={11}/> {homeowner.city}
              </span>
            )}
          </div>
        </div>

        {/* Project cards */}
        <div className="mt-4 space-y-3">
          {projects.map((p) => {
            const budget = formatBudget(p.budget_min_gbp, p.budget_max_gbp);
            return (
              <div key={p.id} className="rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Project</p>
                <h3 className="mt-1 text-[16px] font-black text-neutral-900">{p.title}</h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                  {p.address_city && <span className="inline-flex items-center gap-1"><MapPin size={10}/> {p.address_city}</span>}
                  {budget && <span className="inline-flex items-center gap-1"><Wallet size={10}/> {budget}</span>}
                  {p.timeline && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-0.5 font-bold text-neutral-700">{p.timeline.replace(/-/g, " ")}</span>}
                </div>
                {p.description && (
                  <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-neutral-700">
                    {p.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Accept / Decline */}
        <div className="mt-4 rounded-2xl border-2 border-neutral-200 bg-white p-5 shadow-sm">
          <JoinActions token={token} projectCount={projects.length}/>
        </div>

        <p className="mt-4 text-center text-[10.5px] text-neutral-400">
          Powered by <span className="font-black text-neutral-500">The Network</span> · SiteBook
        </p>
      </main>
    </div>
  );
}

function TerminalState({ kind }: { kind: "not-found" | "revoked" | "accepted" | "declined" }) {
  const copy = {
    "not-found": { title: "Invitation not found",  body: "This link isn't valid. It may have been mistyped, or the homeowner removed it." },
    "revoked":   { title: "Invitation withdrawn",  body: "The homeowner has withdrawn this invitation. If they still want to work with you, they'll send a new one." },
    "accepted":  { title: "Already accepted",      body: "You've already accepted this invitation. Head to your SiteBook to see the project." },
    "declined":  { title: "Already declined",      body: "You've already declined this invitation. If that was a mistake, the homeowner can resend." }
  }[kind];

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: OFF_WHITE }}>
      <div className="max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
          <BookOpen size={18} strokeWidth={2.4}/>
        </span>
        <h1 className="mt-3 text-[17px] font-black text-neutral-900">{copy.title}</h1>
        <p className="mt-1.5 text-[13px] text-neutral-600">{copy.body}</p>
        <p className="mt-4 text-[10.5px] font-black uppercase tracking-wider text-neutral-500">The Network · SiteBook</p>
      </div>
    </div>
  );
}
