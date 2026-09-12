// src/app/nexapp/lab/shadow-mode/page.tsx
// NEX Lab · Shadow Mode Room · founder-INTERNAL · authorised 2026-09-12.
// Observation-only surface · never affects live chat.

import { ShadowModeRoomClient } from "./ShadowModeRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Shadow Mode · founder-internal" };

export default function ShadowModeRoomPage() {
  return <ShadowModeRoomClient />;
}
