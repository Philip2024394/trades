// src/app/nexapp/lab/promotions/page.tsx
//
// Founder ADR-0304 · Promotions queue · founder-only.
// Shows pending briefs · APPROVE with signature · full audit history.

import { PromotionsClient } from "./PromotionsClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Promotions · Founder-only" };

export default function PromotionsPage() { return <PromotionsClient />; }
