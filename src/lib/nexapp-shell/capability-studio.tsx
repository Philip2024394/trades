"use client";
// NEX Studio capability · Philip 2026-08-30 · Slice 4 · Hybrid
//
// NEX-native Studio primary surface: round-button tiles for the major
// Studio destinations. All disabled + honest per Rule 5 — the actual
// Studio surfaces live in a separate authoring workspace with its own
// merchant sign-in. Tapping MORE → Studio now lands on this shell-
// native placeholder INSTEAD of ejecting the user to the /studio sign-in
// prompt (Philip 2026-08-30 flagged the sign-in as jarring UX).
//
// "Open full Studio" escape button intentionally NOT included in this
// slice · pre-existing Studio auth would still demand a fresh sign-in.
// A proper escape lands in a later batch once Studio auth is coordinated
// with the NEX session or gated by a warning.

import React from "react";
import {
  LayoutGrid,
  Wand2,
  FileCode,
  Image as ImageIcon,
  Send,
  Boxes,
} from "lucide-react";
import { capabilityRegistry, type CapabilityViewProps } from "./capabilities";
import { CapabilityHeader } from "@/components/nexapp/CapabilityHeader";

interface StudioDest {
  id: string;
  label: string;
  status: string;
  blurb: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}

const DESTINATIONS: StudioDest[] = [
  { id: "app-store",    label: "App Store",     status: "Live in full Studio", blurb: "Browse + install NEX apps.",                    icon: LayoutGrid },
  { id: "app-builder",  label: "App Builder",   status: "Live in full Studio", blurb: "6-worker pipeline for building custom NEX apps.", icon: Wand2 },
  { id: "templates",    label: "Templates",     status: "Live in full Studio", blurb: "Section templates + starter designs.",           icon: FileCode },
  { id: "media",        label: "Media",         status: "Live in full Studio", blurb: "Media library · upload + replace assets.",       icon: ImageIcon },
  { id: "publish",      label: "Publish",       status: "Live in full Studio", blurb: "Publish dashboard · pending changes + go-live.", icon: Send },
  { id: "my-apps",      label: "My Apps",       status: "Live in full Studio", blurb: "Installed apps · manage per merchant.",          icon: Boxes },
];

function StudioEntryView(_props: CapabilityViewProps) {
  return (
    <>
      <CapabilityHeader eyebrow="Studio" title="Build, publish, manage" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 16,
          padding: "0 20px 20px",
          justifyItems: "center",
        }}
      >
        {DESTINATIONS.map(({ id, label, status, blurb, icon: Icon }) => (
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
          color: "rgba(245,245,245,0.75)",
          lineHeight: 1.55,
        }}
      >
        Studio destinations live in a dedicated authoring workspace. NEX-native
        inline versions are being surfaced in later batches. Tapping Studio no
        longer ejects you to a sign-in prompt &mdash; this shell surface is the
        canonical entry point going forward.
      </div>
    </>
  );
}

capabilityRegistry.register({
  id: "studio",
  label: "Studio",
  entryView: "entry",
  views: { entry: StudioEntryView },
  wants: {
    composer: false,
    orb: "default",
    railAccent: "#4ac9ff",
  },
});
