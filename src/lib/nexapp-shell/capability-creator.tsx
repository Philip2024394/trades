"use client";
// NEX Creator capability · Philip 2026-08-30 · Slice 2 · Capability Surface
//
// Surfaces the 7 Creator tools as ROUND BUTTONS inside the NEX shell.
// Same Registry + Renderer pattern as Network/Studio. Honest per Rule 5:
// most tools have working backends but no dedicated Creator-surface UI
// yet · buttons are disabled with truthful status labels. No standalone-
// page ejection · shell chrome remains present.

import React from "react";
import {
  PenLine,
  Image as ImageIcon,
  Video,
  Share2,
  Sparkles,
  Megaphone,
  Search,
} from "lucide-react";
import { capabilityRegistry, type CapabilityViewProps } from "./capabilities";
import { CapabilityHeader } from "@/components/nexapp/CapabilityHeader";

interface CreatorTool {
  id: string;
  label: string;
  status: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}

const TOOLS: CreatorTool[] = [
  { id: "ai-writer",          label: "AI Writer",     status: "Backend live · UI pending",              blurb: "Draft posts, articles, quotes, product copy.",                     icon: PenLine },
  { id: "image-editor",       label: "Image Editor",  status: "Pending",                                blurb: "Crop, retouch, transparent PNGs from source images.",              icon: ImageIcon },
  { id: "video-creator",      label: "Video Creator", status: "Backend live · UI pending",              blurb: "Short-form video from a template + your assets.",                  icon: Video },
  { id: "social-composer",    label: "Social",        status: "Backend live · Activity surface later",  blurb: "Draft, validate and schedule posts across channels.",              icon: Share2 },
  { id: "content-generation", label: "Content Gen",   status: "Backend live · UI pending",              blurb: "Fact-checked, brand-consistent content pipeline.",                 icon: Sparkles },
  { id: "marketing",          label: "Marketing",     status: "Pending",                                blurb: "Campaign design, audience targeting, promo scheduling.",           icon: Megaphone },
  { id: "seo",                label: "SEO",           status: "Partial · GSC integration pending",      blurb: "Sitemap, schema, GSC insight, ranking tools.",                     icon: Search },
];

function CreatorEntryView(_props: CapabilityViewProps) {
  return (
    <>
      <CapabilityHeader eyebrow="Creator" title="Make content" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
          padding: "0 20px 20px",
          justifyItems: "center",
        }}
      >
        {TOOLS.map(({ id, label, status, blurb, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={`${label} · ${status}`}
            title={blurb}
            disabled
            style={{
              appearance: "none",
              width: "100%",
              maxWidth: 92,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(74,201,255,0.28)",
              color: "rgba(245,245,245,0.9)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 6,
              fontFamily: "inherit",
              cursor: "not-allowed",
              boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
            }}
          >
            <Icon size={22} strokeWidth={1.8} color="rgba(74,201,255,0.92)" />
            <span
              style={{
                fontSize: 10,
                letterSpacing: 0.3,
                textAlign: "center",
                lineHeight: 1.15,
                padding: "0 2px",
              }}
            >
              {label}
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          margin: "8px 20px 40px",
          padding: 16,
          borderRadius: 12,
          background: "rgba(74,201,255,0.06)",
          border: "1px solid rgba(74,201,255,0.22)",
          fontSize: 12,
          color: "rgba(245,245,245,0.7)",
          lineHeight: 1.55,
        }}
      >
        Creator brings NEX&apos;s content-generation tools into one place. Several
        backends already run today (AI Writer &middot; Video Creator &middot;
        Social composer &middot; Content Gen); their dedicated Creator surfaces
        are being wired in later batches. Nothing here fabricates functionality
        &mdash; each button shows its true status.
      </div>
    </>
  );
}

capabilityRegistry.register({
  id: "creator",
  label: "Creator",
  entryView: "entry",
  views: { entry: CreatorEntryView },
  wants: {
    composer: false,
    orb: "default",
    railAccent: "#4ac9ff",
  },
});
