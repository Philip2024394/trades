// src/app/nex-live/my/page.tsx
//
// NEX LIVE · Phase B · MY LIVE server wrapper
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B
//
// Minimal server component — hosts the client surface. Deferred UI
// (analytics, scheduling, live sessions) is NOT included per §8 · §14.

import type { Metadata } from "next";
import { MyLiveClient } from "./MyLiveClient";

export const metadata: Metadata = {
  title: "NEX Live · My Live",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <MyLiveClient />;
}
