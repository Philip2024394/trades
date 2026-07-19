// /store/membership-success — post-subscription page.
//
// Reads the membershipId query param, looks up the row (must be
// 'active'), sets the member cookie so subsequent downloads on this
// browser are free. Redirects browse-ready with a welcome message.

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setMemberCookie } from "@/lib/storeMemberSession";

export const dynamic = "force-dynamic";

async function loadMembership(id: string) {
  const res = await supabaseAdmin
    .from("hammerex_store_memberships")
    .select("id, email, tier, status, current_period_end")
    .eq("id", id)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data as {
    id: string;
    email: string;
    tier: "monthly" | "annual";
    status: "incomplete" | "active" | "past_due" | "canceled" | "expired";
    current_period_end: string | null;
  };
}

export default async function MembershipSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ membership?: string }>;
}) {
  const p = await searchParams;
  const membershipId = p.membership;
  if (!membershipId) redirect("/store#pricing");

  const m = await loadMembership(membershipId);
  if (!m) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[24px] font-black text-neutral-900">Membership not found</h1>
        <p className="mt-2 text-[13px] text-neutral-600">This link may have expired. Contact support if you&apos;ve paid.</p>
      </div>
    );
  }
  if (m.status !== "active") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-[24px] font-black text-neutral-900">Almost there…</h1>
        <p className="mt-2 text-[13px] text-neutral-600">
          Your payment is processing. Refresh in a moment — Stripe usually
          confirms within seconds. If it persists, check your email or contact support.
        </p>
      </div>
    );
  }

  // Active. Issue the member cookie so all subsequent downloads on
  // this browser are free (no more per-image checkout).
  await setMemberCookie(m.email);

  const renewsFmt = m.current_period_end
    ? new Date(m.current_period_end).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const tierLabel = m.tier === "annual" ? "Annual (£249/yr)" : "Monthly (£29/mo)";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div
        className="rounded-2xl border p-6 md:p-8"
        style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#F0FDF4" }}
      >
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-green-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          ✓ Membership active
        </div>
        <h1 className="text-[24px] font-black text-neutral-900 md:text-[28px]">
          Welcome to Site Interest Unlimited
        </h1>
        <p className="mt-1 text-[13px] text-neutral-700">
          You now have <span className="font-black">unlimited</span> access to every image in the
          library. No cart, no purchase — just tap download on any image. Renewal:{" "}
          <span className="font-black">{renewsFmt}</span>.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Your plan">
          <div className="text-[13px] font-black text-neutral-900">{tierLabel}</div>
          <div className="mt-0.5 text-[11px] text-neutral-500">Signed in as {m.email}</div>
          <div className="mt-2 text-[11px] text-neutral-500">Renews {renewsFmt}</div>
        </Panel>
        <Panel title="What you get">
          <ul className="space-y-1 text-[12px] text-neutral-700">
            <li>✓ Unlimited downloads — every image</li>
            <li>✓ Every quality — Web, Print, Full</li>
            <li>✓ Full commercial licence, always</li>
            <li>✓ All future additions to the library</li>
          </ul>
        </Panel>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/store/browse"
          className="inline-flex h-11 items-center rounded-md bg-neutral-900 px-5 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
        >
          Browse the library →
        </Link>
        <Link
          href="/legal/image-licence"
          className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          Licence terms →
        </Link>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">{title}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
