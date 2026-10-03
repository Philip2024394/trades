// src/app/nex-native/vault/home/_upload-dialog.tsx
//
// Stage 6 · upload dialog + "Upload / Scan / New Folder / Voice Note"
// quick-actions client wrapper. Scan + Voice Note are explicitly deferred
// per the sealed build plan (separate founder decisions). This component
// renders all four quick-action buttons and shows the dialog only for
// implemented actions.

"use client";

import { useRef, useState } from "react";
import { Upload, ScanLine, FolderPlus, Mic } from "lucide-react";
import { uploadVaultFileAction } from "../_upload-action";

type Mode = "upload" | "new-folder" | null;
type Category = "documents" | "photos" | "videos" | "plans" | "important" | "archived";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "photos",    label: "Photos" },
  { key: "videos",    label: "Videos" },
  { key: "plans",     label: "Plans & Drawings" },
  { key: "important", label: "Important" },
  { key: "archived",  label: "Archived" },
];

export function VaultQuickActions() {
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("documents");
  const [folderPath, setFolderPath] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onUpload(): Promise<void> {
    setErr(null);
    setOk(null);
    const f = fileRef.current?.files?.[0];
    if (!f) {
      setErr("Pick a file first");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("category", category);
      if (folderPath.trim()) fd.append("folder_path", folderPath.trim());
      const result = await uploadVaultFileAction(fd);
      if (result.ok) {
        setOk(`Uploaded · ${f.name}`);
        if (fileRef.current) fileRef.current.value = "";
      } else {
        setErr(result.reason);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function close(): void {
    if (busy) return;
    setMode(null);
    setErr(null);
    setOk(null);
    setFolderPath("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <section
        data-nex-vault-quick-actions
        aria-label="Quick actions"
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
        }}
      >
        <QuickActionButton
          actionKey="upload"
          label="Upload"
          enabled
          onClick={() => setMode("upload")}
          icon={<Upload size={18} strokeWidth={1.8} aria-hidden />}
        />
        <QuickActionButton
          actionKey="scan"
          label="Scan"
          enabled={false}
          tooltip="Scan is deferred to a later stage · OCR scope requires a separate founder decision"
          icon={<ScanLine size={18} strokeWidth={1.8} aria-hidden />}
        />
        <QuickActionButton
          actionKey="new-folder"
          label="New Folder"
          enabled
          onClick={() => setMode("new-folder")}
          icon={<FolderPlus size={18} strokeWidth={1.8} aria-hidden />}
        />
        <QuickActionButton
          actionKey="voice-note"
          label="Voice Note"
          enabled={false}
          tooltip="Voice Note is deferred to a later stage · MediaRecorder flow requires a separate founder decision"
          icon={<Mic size={18} strokeWidth={1.8} aria-hidden />}
        />
      </section>

      {mode && (
        <div
          role="dialog"
          aria-modal="true"
          data-nex-vault-upload-dialog
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 8, 15, 0.68)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(14, 10, 18, 0.78)",
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              border: "1px solid rgba(247, 239, 228, 0.10)",
              color: "#F2F5F8",
              borderRadius: 22,
              padding: "22px 20px",
              width: "100%",
              maxWidth: 420,
              boxShadow:
                "0 24px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(247,239,228,0.08)",
              fontFamily:
                "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>
              {mode === "upload" ? "Upload to Vault" : "New folder"}
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12.5,
                color: "#C9BFAE",
                lineHeight: 1.45,
              }}
            >
              {mode === "upload"
                ? "Pick a room, optionally a folder label, then a file. Only you can list and open what you upload here."
                : "Give the folder a name. In this stage, folders become visible once at least one file inside them is uploaded."}
            </p>

            <label
              style={{ display: "block", marginTop: 16, fontSize: 12, color: "#C9BFAE" }}
            >
              Room
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={busy}
                data-nex-vault-upload-category
                style={inputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </label>

            <label
              style={{ display: "block", marginTop: 12, fontSize: 12, color: "#C9BFAE" }}
            >
              Folder (optional)
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                disabled={busy}
                placeholder="e.g. 2026 · site-A"
                data-nex-vault-upload-folder
                style={inputStyle}
              />
            </label>

            {mode === "upload" && (
              <label
                style={{ display: "block", marginTop: 12, fontSize: 12, color: "#C9BFAE" }}
              >
                File
                <input
                  type="file"
                  ref={fileRef}
                  disabled={busy}
                  data-nex-vault-upload-file
                  style={{ ...inputStyle, padding: 8 }}
                />
              </label>
            )}

            {err && (
              <p data-nex-vault-upload-error style={{ marginTop: 12, fontSize: 12.5, color: "#FFB199" }}>{err}</p>
            )}
            {ok && (
              <p data-nex-vault-upload-ok style={{ marginTop: 12, fontSize: 12.5, color: "#9BE7B5" }}>{ok}</p>
            )}

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                style={cancelBtnStyle}
              >
                Close
              </button>
              {mode === "upload" && (
                <button
                  type="button"
                  onClick={() => void onUpload()}
                  disabled={busy}
                  data-nex-vault-upload-submit
                  style={{ ...primaryBtnStyle, opacity: busy ? 0.72 : 1 }}
                >
                  {busy ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface QBProps {
  actionKey: string;
  label: string;
  enabled: boolean;
  onClick?: () => void;
  tooltip?: string;
  icon: React.ReactNode;
}
function QuickActionButton({ actionKey, label, enabled, onClick, tooltip, icon }: QBProps) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      data-nex-vault-quick-action={actionKey}
      data-nex-vault-quick-action-state={enabled ? "ready" : "not-yet-available"}
      title={enabled ? label : (tooltip ?? "Not yet available")}
      aria-label={enabled ? label : `${label} · not yet available`}
      style={{
        background: "rgba(22, 16, 12, 0.62)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: `1px solid ${enabled ? "rgba(247,239,228,0.08)" : "rgba(247,239,228,0.05)"}`,
        borderRadius: 18,
        boxShadow:
          "0 1px 1px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.32), inset 0 1px 0 rgba(247,239,228,0.06)",
        minHeight: 92,
        padding: "14px 6px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: enabled ? "#F7EFE4" : "#8A7E6E",
        opacity: enabled ? 1 : 0.55,
        cursor: enabled ? "pointer" : "not-allowed",
        transition: "transform 160ms ease, background 160ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: enabled ? "rgba(255, 138, 42, 0.14)" : "rgba(138, 126, 110, 0.14)",
          color: enabled ? "#FF8A2A" : "#8A7E6E",
          border: `1px solid ${enabled ? "rgba(255, 138, 42, 0.26)" : "rgba(138, 126, 110, 0.14)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#0A0608",
  color: "#F7EFE4",
  fontSize: 13.5,
  fontFamily: "inherit",
};
const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#C9BFAE",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 999,
  padding: "10px 18px",
  fontSize: 13.5,
  cursor: "pointer",
};
const primaryBtnStyle: React.CSSProperties = {
  background: "#FF8A2A",
  color: "#1a0f04",
  border: "none",
  borderRadius: 999,
  padding: "10px 20px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

// Icons are imported from lucide-react at the top of this file.
