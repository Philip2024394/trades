// src/app/nex-live/tonight/page.tsx
//
// NEX LIVE · Master Experience · "What's happening" server wrapper
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build

import type { Metadata } from "next";
import { TonightClient } from "./TonightClient";

export const metadata: Metadata = {
  title: "NEX Live · Tonight",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <TonightClient />;
}
