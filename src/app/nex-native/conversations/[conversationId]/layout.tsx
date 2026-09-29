// src/app/nex-native/conversations/[conversationId]/layout.tsx
//
// Bridge 55 · Phase 1 launch gate for business/customer chat threads.
// -------------------------------------------------------------------
// Business conversations are commerce-only (buyer↔seller chat about
// orders / products / carts). Hidden when NEX_COMMERCE_ENABLED is
// off. Peer chat (friend↔friend) lives at /nex-native/chat/peer/*
// and is NOT affected — that surface remains fully available in
// Phase 1 as the core NEX chat experience.

import { redirect } from "next/navigation";
import type * as React from "react";
import { NEX_COMMERCE_ENABLED } from "@/lib/nex-native/launch-flags";

export default function ConversationThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!NEX_COMMERCE_ENABLED) {
    redirect("/nex-native/home");
  }
  return <>{children}</>;
}
