// src/app/nex-native/vault/home/_file-list.tsx
//
// Stage 5 · shared Vault file-row renderer. Used by every file room.
// Glass-styled rows + Lucide extension badge + Open button that
// requests a short-lived signed URL from the Stage 4 endpoint.

import type { VaultFileRow } from "@/lib/nex-native/vault-file-service";
import {
  FileText,
  ImageIcon,
  Film,
  FileCode,
  FileAudio,
  File as FileIcon,
} from "lucide-react";
import { OpenVaultFileButton } from "./_open-vault-file-button";
import { NEX, GLASS_CHIP } from "./_palette";

interface Props {
  files: VaultFileRow[];
}

export function VaultFileList({ files }: Props) {
  return (
    <section
      data-nex-vault-file-list
      style={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {files.map((f) => (
        <article
          key={f.id}
          data-nex-vault-file-id={f.id}
          style={{
            ...GLASS_CHIP,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 14,
            minHeight: 60,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: NEX.accentSoft,
              color: NEX.accent,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${NEX.accentStrong}`,
            }}
          >
            <FileTypeIcon mime={f.mime_type} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: NEX.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {f.display_name}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 11.5,
                color: NEX.textSecondary,
              }}
            >
              {formatBytes(f.byte_size)} · {formatRelative(f.created_at)}
            </div>
          </div>
          <OpenVaultFileButton fileId={f.id} displayName={f.display_name} />
        </article>
      ))}
    </section>
  );
}

function FileTypeIcon({ mime }: { mime: string }) {
  const common = { size: 20, strokeWidth: 1.6, "aria-hidden": true as const };
  if (mime.startsWith("image/")) return <ImageIcon {...common} />;
  if (mime.startsWith("video/")) return <Film {...common} />;
  if (mime.startsWith("audio/")) return <FileAudio {...common} />;
  if (mime === "application/pdf" || mime === "text/plain") return <FileText {...common} />;
  if (mime.includes("json") || mime.includes("xml") || mime.includes("javascript")) {
    return <FileCode {...common} />;
  }
  return <FileIcon {...common} />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
