// src/app/nex-native/vault/home/_open-vault-file-button.tsx
//
// Client-side open button · requests a short-lived signed URL from the
// Stage 4 endpoint and opens it in a new tab. The URL has a 60s TTL;
// after that it expires and a fresh click issues a new one.

"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

interface Props {
  fileId: string;
  displayName: string;
}

export function OpenVaultFileButton({ fileId, displayName }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onOpen(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/nex/vault/files/${encodeURIComponent(fileId)}/signed-url`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setErr(`Could not open · HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      const j = (await res.json()) as { url?: string; error?: string };
      if (!j.url) {
        setErr(j.error ?? "no url");
        setBusy(false);
        return;
      }
      window.open(j.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        onClick={() => void onOpen()}
        disabled={busy}
        aria-label={`Open ${displayName}`}
        data-nex-vault-open-file={fileId}
        style={{
          background: "rgba(255, 138, 42, 0.14)",
          color: "#FF8A2A",
          border: "1px solid rgba(255, 138, 42, 0.26)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          borderRadius: 999,
          padding: "6px 12px 6px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {!busy && <ExternalLink size={12} strokeWidth={2} aria-hidden />}
        {busy ? "Opening…" : "Open"}
      </button>
      {err && (
        <span
          style={{ fontSize: 10.5, color: "#FFB199" }}
          data-nex-vault-open-file-error
        >
          {err}
        </span>
      )}
    </div>
  );
}
