// NEX Design Catalogue · Master Template 1 · Chat preview page
// (Philip 2026-08-15).
//
// Route: /nex-app/design-catalogue/staircase/master-template-1/chat
//
// This is the customer-facing chat surface for Master Template 1.
// From the customer's perspective they've chosen to chat with Summit —
// so this page is Summit's chat window, not a NEX-branded surface.
// Zero NEX chrome, no design-catalogue dev bar.
//
// Dev-only route (returns 404 outside development).

import { notFound } from "next/navigation";
import { STCH01 } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/sections/ST-CH01";
import { StaircaseDesignProvider } from "@/lib/design-catalogue/premium-architectural/staircase/master-template-1/StaircaseDesign";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat with Summit", robots: { index: false } };

// Session 4 · Commit 1 (Philip 2026-08-20 · wiring-only, no design writes).
// Wraps STCH01 in a design-state provider so the chat surface has a
// StaircaseDesign context to read (and, from Commit 2 onwards behind
// NEX_CHAT_WRITES_ENABLED, to write into). Commit 1 only reads.
export default function MasterTemplate1ChatPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <StaircaseDesignProvider>
      <STCH01 />
    </StaircaseDesignProvider>
  );
}
