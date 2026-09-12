// src/app/nexapp/lab/ideas/page.tsx
//
// Founder 2026-09-10 · Innovation Room · landscape cards of AI-generated feature ideas.
// Cards show title + user_need + description. Founder clicks "Approve & Copy Brief"
// to move the idea to approved status and receive a paste-ready engineering brief.

import { IdeasRoomClient } from "./IdeasRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Lab · Innovation Room" };

export default function IdeasPage() { return <IdeasRoomClient />; }
