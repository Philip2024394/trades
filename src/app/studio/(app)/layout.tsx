// Gated Studio layout. Everything inside /studio/(app)/* renders behind
// this. The route group segment "(app)" doesn't appear in URLs — routes
// stay at /studio/home, /studio/pages, /studio/media, etc.
//
// Auth: loadStudioSession() reads the HttpOnly cookie set by the entry
// route. Missing / invalid → bounce to /studio (where the sign-in
// screen lives). Valid → hand the merchant + brand to StudioShell and
// render children.

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { loadStudioSession } from "@/lib/studio/session";
import { StudioShell } from "@/components/studio/StudioShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Studio · Xrated Trades",
  robots: { index: false, follow: false }
};

export default async function StudioAppLayout({
  children
}: {
  children: ReactNode;
}) {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");

  return (
    <StudioShell merchant={session.merchant} brand={session.brand}>
      {children}
    </StudioShell>
  );
}
