// src/app/nexapp/lab/[slug]/page.tsx
//
// Founder ADR-0304 · Room drill-in · one page per Lab room.
// Shows: current harvest/verified counts, growth trend, recent
// harvest samples, target progress, promotion queue for this room.

import { LabRoomClient } from "./LabRoomClient";
import type { Metadata } from "next";
import { LAB_ROOMS } from "@/lib/nex/lab/rooms";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const room = LAB_ROOMS.find((r) => r.slug === slug);
  return { title: `NEX Lab · ${room?.display_name ?? slug}` };
}

export default async function LabRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LabRoomClient slug={slug} />;
}
