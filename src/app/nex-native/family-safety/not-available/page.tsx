// src/app/nex-native/family-safety/not-available/page.tsx
//
// NEX Family Safety · honest "not available" page · authored 2026-10-10.
// ----------------------------------------------------------------------
// Rendered when a dependency (feature flag off, DB unreachable, etc.)
// prevents the Family Safety UI from doing anything useful. This is
// NEVER a silent 404 · we explicitly tell the viewer what's happening
// and how to go back.
//
// This route also serves as a stable landing page the layout can
// redirect to (today it inlines the state instead of redirecting · the
// route remains available for future direct-link usage, e.g. from HQ
// support).

import * as React from "react";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function FamilySafetyNotAvailablePage() {
  return (
    <FamilySafetyShell subtitle="This feature is temporarily unavailable.">
      <EmptyState
        glyph="🚧"
        title="Family Safety is not available right now"
        description="We hit a snag loading your family data, or Family Safety has been paused in this environment. Your account is unchanged · nothing has been shared, invited, or revoked. Please head back to Settings and try again shortly."
        ctaHref="/nex-native/settings"
        ctaLabel="Back to Settings"
        testId="nex-family-safety-not-available-page"
      />
    </FamilySafetyShell>
  );
}
