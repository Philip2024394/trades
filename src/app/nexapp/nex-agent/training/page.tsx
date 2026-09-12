// src/app/nexapp/nex-agent/training/page.tsx
//
// NEX Agent v1.1-T · Training Room · founder-facing.
// Left: lesson catalog · middle: current lesson + attempt view · right: doctrine ledger.

import { TrainingRoomClient } from "./TrainingRoomClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "NEX Agent · Training Room" };

export default function TrainingPage() { return <TrainingRoomClient />; }
