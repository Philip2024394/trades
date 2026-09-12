// src/app/nex-live/upload/page.tsx
//
// NEX LIVE · Phase 2 · Upload · server wrapper
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2

import type { Metadata } from "next";
import { UploadClient } from "./UploadClient";

export const metadata: Metadata = {
  title: "NEX Live · Upload",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <UploadClient />;
}
