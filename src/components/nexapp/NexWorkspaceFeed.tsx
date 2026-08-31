// src/components/nexapp/NexWorkspaceFeed.tsx · Philip 2026-08-29
//
// Discover → Feed workspace · lives INSIDE the /nexapp shell.
// Phase 3 · PR-6.
//
// Narrow wrap of Video Feed V1 (src/app/nex-video/VideoFeedClient.tsx) —
// the existing recency-only vertical-swipe feed. The `contained` prop
// switches its positioning from `fixed inset-0` (viewport) to
// `absolute inset-0` (workspace zone), so the phone frame stays intact
// around the feed.
//
// No feed-ranking redesign. No new sources. If Feed V1 renders on its
// standalone page, it renders here.

"use client";

import React from "react";
import { VideoFeedClient } from "@/app/nex-video/VideoFeedClient";

export function NexWorkspaceFeed() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <VideoFeedClient contained />
    </div>
  );
}
