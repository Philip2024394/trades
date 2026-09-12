// src/app/nexapp/lab/brief/page.tsx
//
// Founder ADR-0304 · Weekly Brief · founder-facing page.

import { WeeklyBriefClient } from "./WeeklyBriefClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Weekly Brief" };

export default function BriefPage() { return <WeeklyBriefClient />; }
