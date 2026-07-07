// /entity/accept
//
// Two entry paths:
//   • email link → /api/entity/accept?token=... which does the mutation
//     and cookie set, then redirects here with ?ok=1
//   • ?token=... hits this page directly → redirect through the route
//     handler so the mutation runs.

import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { loadActiveMembership } from "@/lib/os/entitySession";

export const dynamic = "force-dynamic";

export default async function AcceptEntityInviteLanding({
  searchParams
}: {
  searchParams: Promise<{ token?: string; ok?: string }>;
}) {
  const { token, ok } = await searchParams;

  if (token && !ok) {
    redirect(`/api/entity/accept?token=${encodeURIComponent(token)}`);
  }

  const active = await loadActiveMembership();

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
      <div className="relative mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300"
              aria-hidden
            />
            <div>
              <h1 className="text-[22px] font-bold text-[#1B1A17]">
                You&apos;re in
                {active?.entity ? (
                  <>
                    <span className="text-[#1B1A17]/70"> — welcome to </span>
                    {active.entity.display_name}
                  </>
                ) : null}
                .
              </h1>
              <p className="mt-2 text-[14px] leading-[1.55] text-[#1B1A17]/80">
                {active
                  ? `Your role is `
                  : "Your invitation has been accepted. "}
                {active ? (
                  <b className="text-[#1B1A17]">{active.role}</b>
                ) : null}
                {active
                  ? ". This entity is now your active context — everything you do while it's selected attaches here."
                  : ""}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href="/home"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-neutral-900 hover:bg-amber-300"
                >
                  Open my Notebook
                </Link>
                <Link
                  href="/home/entity/members"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1B1A17]/20 bg-[#1B1A17]/4 px-5 text-[13px] font-semibold text-[#1B1A17] hover:bg-[#1B1A17]/5"
                >
                  See the team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
