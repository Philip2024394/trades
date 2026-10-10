// src/app/nex-native/family-safety/layout.tsx
//
// NEX Family Safety · route-group layout · authored 2026-10-10.
// -------------------------------------------------------------
// Enforces two invariants for every /family-safety/* page:
//
//   1. The viewer MUST be signed in. Anonymous visitors are
//      redirected to /nex-native/sign-in (same contract the sealed
//      Settings landing uses).
//
//   2. The Family Safety UI MUST be enabled. If the sealed
//      `isFamilySafetyEnabled()` flag returns FALSE, every path
//      under /family-safety/* renders the honest "not available"
//      surface INLINE (we cannot redirect to the not-available
//      route · it is itself under this layout and would loop).
//
// This layout DOES NOT render the FamilySafetyShell · each page
// mounts the shell with its own `activeNav`. That split lets FS-2 /
// FS-3 / FS-4 wrap their multi-step surfaces with sub-navigation
// without fighting the layout.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyEnabled } from "@/lib/nex-native/family-safety/feature-flag";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FamilySafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");
  if (!isFamilySafetyEnabled()) {
    return (
      <FamilySafetyShell subtitle="This feature is paused for now.">
        <EmptyState
          glyph="🚧"
          title="Family Safety is not available"
          description="The Family Safety pilot is paused in this environment. If you're an operator and this is unexpected, set NEX_FAMILY_SAFETY_ENABLED to 'true' (or unset it) and reload."
          ctaHref="/nex-native/settings"
          ctaLabel="Back to Settings"
          testId="nex-family-safety-not-available-inline"
        />
      </FamilySafetyShell>
    );
  }
  return <>{children}</>;
}
