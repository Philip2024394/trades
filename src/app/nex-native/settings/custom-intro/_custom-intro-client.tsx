"use client";

// src/app/nex-native/settings/custom-intro/_custom-intro-client.tsx
//
// NEX Phase 1.0 Custom Intro · client surface.
// Sealed 2026-10-06. Owns the four presentation states:
//   · not_purchased   → "Get Custom Intro Rp500,000" → NEX1 chat
//   · purchased_no_video → upload UI
//   · active          → preview + toggle off + replace
//   · disabled        → "Turn on" + preview
//
// Entitlement is granted admin-side after NEX1-chat manual payment ·
// the row's EXISTENCE in nex_account_custom_intro = entitled. The
// client never trusts a client-side "paid=true" flag.

import * as React from "react";
import { CUSTOM_INTRO_VIDEO_LIMITS } from "@/lib/nex-native/custom-intro-config";

const NEX = {
  bg: "#020914",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  rose: "#FF6B8A",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
};

export type CustomIntroState = "not_purchased" | "purchased_no_video" | "active" | "disabled";

export interface CustomIntroClientProps {
  state: CustomIntroState;
  priceIdr: number;
  nex1Href: string;
  accountId: string;
  videoKey: string | null;
  durationMs: number | null;
}

export function CustomIntroClient(props: CustomIntroClientProps): React.JSX.Element {
  const { state, priceIdr, nex1Href, accountId, videoKey, durationMs } = props;

  if (state === "not_purchased") {
    return (
      <NotPurchasedState priceIdr={priceIdr} nex1Href={nex1Href} />
    );
  }

  if (state === "purchased_no_video") {
    return <UploadState accountId={accountId} />;
  }

  // active or disabled
  return (
    <ActiveOrDisabledState
      state={state}
      videoKey={videoKey}
      durationMs={durationMs}
      accountId={accountId}
    />
  );
}

// ---------------------------------------------------------------------------
// State A · not purchased
// ---------------------------------------------------------------------------

function NotPurchasedState({
  priceIdr,
  nex1Href,
}: {
  priceIdr: number;
  nex1Href: string;
}): React.JSX.Element {
  return (
    <div
      data-nex-custom-intro-state="not_purchased"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          padding: "20px 20px",
          borderRadius: 14,
          background: NEX.panel,
          border: `1px solid ${NEX.panelAccent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: NEX.cyan,
              letterSpacing: "-0.01em",
            }}
          >
            Rp {priceIdr.toLocaleString("id-ID")}
          </div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.textDim,
              fontWeight: 700,
            }}
          >
            One-time
          </div>
        </div>
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 14,
            color: NEX.text,
            lineHeight: 1.6,
          }}
        >
          Make your World feel like your own. Use your own short video to
          welcome visitors when they enter your chat.
        </p>
        <ul
          style={{
            margin: "0 0 14px 18px",
            padding: 0,
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.6,
          }}
        >
          <li>Up to 10 seconds · 16:9 landscape · MP4</li>
          <li>Plays before visitors enter your chat</li>
          <li>Replace it or turn it off at any time</li>
          <li>Yours forever once purchased</li>
        </ul>
        <a
          href={nex1Href}
          data-nex-custom-intro-cta="get"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 20px",
            borderRadius: 999,
            background: NEX.cyan,
            color: NEX.bg,
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textDecoration: "none",
          }}
        >
          Get Custom Intro
        </a>
      </div>
      <div
        style={{
          fontSize: 11,
          color: NEX.textDim,
          lineHeight: 1.55,
        }}
      >
        Message NEX1 to pay via bank transfer, GoPay, DANA, ShopeePay, or
        QRIS. Once we confirm the payment we&apos;ll turn on Custom Intro
        for your account and you&apos;ll be able to upload your video
        from this page.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State B · purchased, no video → upload form
// ---------------------------------------------------------------------------

function UploadState({ accountId }: { accountId: string }): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setProgress("Reading video…");
    try {
      // Extract metadata via a hidden <video> element.
      const meta = await readVideoMetadata(file);
      setProgress(
        `Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB · ${Math.round(meta.duration_ms / 1000)}s · ${meta.width}×${meta.height}`,
      );
      const form = new FormData();
      form.append("file", file);
      form.append("duration_ms", String(Math.round(meta.duration_ms)));
      form.append("width", String(meta.width));
      form.append("height", String(meta.height));
      const res = await fetch("/api/nex-native/custom-intro/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "upload_failed");
      setProgress("Upload complete.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div data-nex-custom-intro-state="purchased_no_video" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.panelAccent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: NEX.green,
              boxShadow: "0 0 8px rgba(22,214,107,0.6)",
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Custom Intro is unlocked</div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          Upload a short MP4 to activate it. Visitors will see your
          video when they open your chat.
        </p>
      </div>

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          background: NEX.panel,
          border: `1px dashed ${NEX.panelAccent}`,
        }}
      >
        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: NEX.cyan, fontWeight: 800, marginBottom: 6 }}>
          Video requirements
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
          <li>MP4 or MOV</li>
          <li>Between {CUSTOM_INTRO_VIDEO_LIMITS.min_duration_ms / 1000} and {CUSTOM_INTRO_VIDEO_LIMITS.max_duration_ms / 1000} seconds</li>
          <li>16:9 landscape (we check this automatically)</li>
          <li>Up to {Math.round(CUSTOM_INTRO_VIDEO_LIMITS.max_size_bytes / 1024 / 1024)} MB</li>
        </ul>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        data-nex-custom-intro-upload-input
        onChange={onFileChosen}
        disabled={busy}
        style={{ display: "none" }}
      />
      <button
        type="button"
        data-nex-custom-intro-upload-trigger
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          padding: "14px 20px",
          borderRadius: 10,
          background: busy ? NEX.panel : NEX.cyan,
          color: busy ? NEX.textDim : NEX.bg,
          border: `1px solid ${NEX.cyan}`,
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: busy ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {busy ? progress || "Uploading…" : "Upload your intro"}
      </button>
      {error && (
        <div
          role="alert"
          data-nex-custom-intro-error
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,107,138,0.14)",
            border: `1px solid rgba(255,107,138,0.4)`,
            color: NEX.text,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
      <input type="hidden" value={accountId} data-nex-custom-intro-account-id readOnly />
    </div>
  );
}

// ---------------------------------------------------------------------------
// State C/D · active or disabled
// ---------------------------------------------------------------------------

function ActiveOrDisabledState({
  state,
  videoKey,
  durationMs,
  accountId,
}: {
  state: "active" | "disabled";
  videoKey: string | null;
  durationMs: number | null;
  accountId: string;
}): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  async function toggleEnabled(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nex-native/custom-intro/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "toggle_failed");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function onReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const meta = await readVideoMetadata(file);
      const form = new FormData();
      form.append("file", file);
      form.append("duration_ms", String(Math.round(meta.duration_ms)));
      form.append("width", String(meta.width));
      form.append("height", String(meta.height));
      const res = await fetch("/api/nex-native/custom-intro/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "upload_failed");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  // Prefer the server actions for toggle + remove so we keep the
  // "no JS" fallback working. onToggleEnabled below posts to the
  // server-action endpoint via the hidden form.

  return (
    <div
      data-nex-custom-intro-state={state}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div
        data-nex-custom-intro-status
        data-nex-custom-intro-status-state={state}
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          background: NEX.panel,
          border: `1px solid ${NEX.panelAccent}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: state === "active" ? NEX.green : NEX.textDim,
              boxShadow: state === "active" ? "0 0 8px rgba(22,214,107,0.6)" : "none",
            }}
          />
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Custom Intro is {state === "active" ? "on" : "off"}
          </div>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          {state === "active"
            ? "Visitors see your custom video when they enter your chat."
            : "Visitors see your normal World Intro instead. Turn it back on anytime."}
        </p>
        {durationMs && (
          <div
            style={{
              marginTop: 8,
              fontSize: 11,
              color: NEX.textDim,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {(durationMs / 1000).toFixed(1)}s video
          </div>
        )}
      </div>

      {videoKey && (
        <video
          data-nex-custom-intro-preview
          src={`/api/nex-native/custom-intro/video?account_id=${encodeURIComponent(accountId)}`}
          controls
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            borderRadius: 12,
            background: "#000",
            aspectRatio: "16 / 9",
          }}
        />
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          data-nex-custom-intro-toggle={state === "active" ? "turn-off" : "turn-on"}
          onClick={() => toggleEnabled(state !== "active")}
          disabled={busy}
          style={{
            flex: "1 1 auto",
            padding: "11px 16px",
            borderRadius: 10,
            background: state === "active" ? "transparent" : NEX.cyan,
            color: state === "active" ? NEX.cyan : NEX.bg,
            border: `1px solid ${NEX.cyan}`,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {state === "active" ? "Turn off" : "Turn on"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          data-nex-custom-intro-replace-input
          onChange={onReplace}
          disabled={busy}
          style={{ display: "none" }}
        />
        <button
          type="button"
          data-nex-custom-intro-replace-trigger
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            flex: "1 1 auto",
            padding: "11px 16px",
            borderRadius: 10,
            background: "transparent",
            color: NEX.text,
            border: `1px solid ${NEX.panelAccent}`,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            cursor: busy ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Replace video
        </button>
      </div>

      {error && (
        <div
          role="alert"
          data-nex-custom-intro-error
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(255,107,138,0.14)",
            border: `1px solid rgba(255,107,138,0.4)`,
            color: NEX.text,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper · read duration + dimensions via a hidden <video>
// ---------------------------------------------------------------------------

interface VideoMeta {
  duration_ms: number;
  width: number;
  height: number;
}

function readVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.src = url;
    el.muted = true;
    el.playsInline = true;
    el.onloadedmetadata = () => {
      const meta: VideoMeta = {
        duration_ms: (el.duration || 0) * 1000,
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
      };
      URL.revokeObjectURL(url);
      el.remove();
      if (!meta.duration_ms || !meta.width || !meta.height) {
        reject(new Error("Could not read video metadata · try a different file"));
      } else {
        resolve(meta);
      }
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      el.remove();
      reject(new Error("Could not open video · try a different file"));
    };
  });
}
