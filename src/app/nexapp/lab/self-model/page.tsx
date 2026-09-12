// src/app/nexapp/lab/self-model/page.tsx
//
// NEX Lab · Self-Model Room · founder-authorised Sprint A + D (2026-09-12).
// Read-only projection of the 7 introspective-reporter endpoints. Never
// mutates any subsystem. SM-4/5/6 discipline: cannot_yet first · evidence
// pointers only · honest "unmeasured" on missing substrates.

import { SelfModelRoomClient } from "./SelfModelRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Self-Model Room" };

export default function SelfModelRoomPage() {
  return <SelfModelRoomClient />;
}
