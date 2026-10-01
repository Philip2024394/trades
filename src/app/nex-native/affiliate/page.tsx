// src/app/nex-native/affiliate/page.tsx
//
// NEX Affiliate · minimum shippable dashboard · sealed 2026-10-01.
// -----------------------------------------------------------------------------
// First-run surface after joining the Affiliate Network. Shows:
//   · Welcome / joined-at state
//   · Empty-state message explaining what lands next (seller
//     marketplace · product rotation · ledger)
//   · Links out to the real NEX chat so the user is never stranded
//
// Full dashboard (balances · pending · confirmed · paid · referrals ·
// disputes) ships as subsequent bridges once the attribution and
// ledger tables land.

import type * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAffiliateByAccountId } from "@/lib/nex-native/affiliate-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  border: "rgba(139,169,209,0.18)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.35)",
  green: "#8FFF6E",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function AffiliateDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ joined?: string }>;
}): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  const affiliate = await getAffiliateByAccountId(session.account.id);
  if (!affiliate) redirect("/nex-native/affiliate/join");

  const sp = (await searchParams) ?? {};
  const justJoined = sp.joined === "1";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top, 0) + 32px) 20px 60px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          NEX Affiliate · Dashboard
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(26px, 5vw, 38px)",
            fontWeight: 500,
            lineHeight: 1.1,
          }}
        >
          {justJoined ? "You're in." : "Welcome back."}
        </h1>
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 14,
            lineHeight: 1.55,
            color: NEX.textDim,
          }}
        >
          You joined on <strong>{formatDate(affiliate.joined_at)}</strong>.
          Terms version <code>{affiliate.terms_version}</code>. Status{" "}
          <strong style={{ color: NEX.green }}>{affiliate.status}</strong>.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <StatCard label="Confirmed commission" value="Rp 0" sub="No sales yet" />
          <StatCard label="Pending commission" value="Rp 0" sub="Awaiting qualifying orders" />
          <StatCard label="Paid out" value="Rp 0" sub="By sellers directly" />
          <StatCard label="Referrals" value="0" sub="Affiliates you brought in" />
        </div>

        <section
          style={{
            background: NEX.panel,
            border: `1px solid ${NEX.border}`,
            borderRadius: 16,
            padding: "20px",
            marginBottom: 18,
          }}
        >
          <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>
            Next · pick sellers to promote
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              color: NEX.textDim,
              lineHeight: 1.55,
            }}
          >
            The Affiliate Marketplace is being built in the next bridge
            · it lists sellers who have activated the programme and
            lets you add their products to your affiliate shop with
            one tap. Until then, your dashboard is quiet by design — no
            fake "attributed sale" numbers.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/nex-native/chat"
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: `linear-gradient(180deg, ${NEX.cyan} 0%, #0073b8 100%)`,
                color: "#FFF",
                textDecoration: "none",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                boxShadow: "0 8px 20px rgba(0,175,255,0.3)",
              }}
            >
              Back to NEX Chat
            </Link>
            <Link
              href="/nex-native/about/terms#section-13"
              style={{
                padding: "10px 20px",
                borderRadius: 999,
                background: "transparent",
                border: `1px solid ${NEX.border}`,
                color: NEX.textDim,
                textDecoration: "none",
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              Programme Terms
            </Link>
          </div>
        </section>

        <p
          style={{
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          NEX records affiliate activity and provides the transaction
          evidence used to help affiliates and sellers resolve
          commission disputes. NEX does not hold affiliate funds or
          make payments on behalf of sellers.
        </p>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.border}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: NEX.textMute,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: NEX.text }}>
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: NEX.textDim,
          lineHeight: 1.4,
        }}
      >
        {sub}
      </div>
    </div>
  );
}
