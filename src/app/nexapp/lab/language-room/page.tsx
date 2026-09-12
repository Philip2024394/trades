// src/app/nexapp/lab/language-room/page.tsx
//
// NEX Lab · Language Room · founder directive 2026-09-12: "The Lab must
// have a Language Room displaying 24/7." Live-polls the deterministic
// scorecard endpoint every 10s. Never fabricates.

import { LanguageRoomClient } from "./LanguageRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Language Room" };

export default function LanguageRoomPage() {
  return <LanguageRoomClient />;
}
