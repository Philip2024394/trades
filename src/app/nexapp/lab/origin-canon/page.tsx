// src/app/nexapp/lab/origin-canon/page.tsx
//
// NEX Lab · Origin Canon Room · founder-authorised 2026-09-12.
// Lab-INTERNAL until reveal cadence decided. Shows canon status, layers,
// knowledge states, and a live classifier tester with the Golden Response
// Pattern preview.

import { OriginCanonRoomClient } from "./OriginCanonRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Origin Canon Room · internal" };

export default function OriginCanonRoomPage() {
  return <OriginCanonRoomClient />;
}
