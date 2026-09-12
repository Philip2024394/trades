// src/app/nexapp/lab/page.tsx
//
// Founder ADR-0304 · /nexapp/lab · Master AI Lab landing.
// Shows all 10 rooms with live growth + drill-in.

import { LabLandingClient } from "./LabLandingClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Master AI orchestrated" };

export default function LabPage() { return <LabLandingClient />; }
