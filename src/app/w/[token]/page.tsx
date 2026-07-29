// Worker portal · single-purpose measurement UI · phone-first · isolated.
//
// This route intentionally sits outside /admin. It carries no NEX branding,
// no navigation, no menu — just the job. A worker on the shop floor
// scans a QR / opens a WhatsApp link, sees the pack + boards, taps a
// board, enters 7 numbers, taps Save.
//
// Auth: URL token only. The token is the entire credential.

import { headers } from "next/headers";
import WorkerPortalClient from "./_client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export default async function WorkerPortalPage({ params }: Ctx) {
  const { token } = await params;

  // Resolve base URL from request headers so absolute fetch works in dev
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/worker/${encodeURIComponent(token)}/validate`, { cache: "no-store" });
  const payload = await res.json().catch(() => ({}));

  if (!res.ok || !payload.ok) {
    return (
      <div style={rootStyle}>
        <div style={cardStyle}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Link no longer valid</h1>
          <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
            {payload.error ?? "This link cannot be used right now."}
          </p>
          <p style={{ color: "#888", fontSize: 12, marginTop: 12 }}>
            Ask the office for a new link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <WorkerPortalClient token={token} initial={payload.data} />
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f4f4f5",
  fontFamily: "system-ui, sans-serif",
  padding: 12,
};

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 8,
  padding: 16,
  maxWidth: 480,
  margin: "40px auto",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};
