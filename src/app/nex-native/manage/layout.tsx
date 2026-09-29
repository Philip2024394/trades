// src/app/nex-native/manage/layout.tsx
//
// Bridge 55 · Phase 1 launch gate for the entire /manage/* tree.
// -------------------------------------------------------------
// One redirect check at the layout level covers every merchant
// dashboard subroute (analytics · banners · email · ladder · menu ·
// orders · products · shop · site · venue). When commerce is off,
// any /manage/* URL bounces to /home. Admins can bypass with
// ?commerce=1 on the direct child page.
//
// Note: search params don't propagate to layouts in App Router, so
// this gate is UNCONDITIONAL for /manage/*. Admins who need to
// reach a manage page directly should:
//   1. Set NEX_COMMERCE_ENABLED=1 in .env.local for the session, OR
//   2. Toggle Phase 2 launch mode when it's ready
// This is intentional — /manage is a full merchant surface and
// there's no user reason for it to leak into Phase 1.

import { redirect } from "next/navigation";
import type * as React from "react";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!NEX_COMMERCE_ENABLED) {
    redirect("/nex-native/home");
  }
  return <>{children}</>;
}
