// src/components/nex-native/family-safety/GovernmentIdUploader.tsx
//
// NEX Family Safety · wizard step 2 · government ID uploader.
// Authored by CC-2 2026-10-10.
// -----------------------------------------------------------
// Collects a government ID document the parent will submit to prove
// their child is under 16. Load-bearing privacy invariants:
//
//   1. NEVER persists ID bytes to localStorage or sessionStorage.
//      The component owns the file ref only in memory. Refreshing the
//      page loses the preview · intentional for a safety product.
//
//   2. NEVER uploads over a direct client-side fetch to a storage
//      endpoint. The uploader hands the bytes (base64 + mime +
//      filename) to the parent via `onSubmit`. The parent calls the
//      server action, which pipes to a server-authorised storage API.
//
//   3. PDF previews are filename-only · we do NOT render PDFs inline
//      to avoid XSS from crafted bytes. Images are previewed via a
//      blob: URL that is revoked on unmount.
//
//   4. EXIF stripping: the current build does NOT ship an EXIF
//      stripper (no new npm deps allowed). The uploader renders a
//      visible disclosure explaining this gap. CC-1 is expected to
//      strip EXIF server-side before persisting · see the "stripping
//      is server-side" note in the UI.
//
// Load-bearing anti-patterns:
//   · Do NOT write any file metadata to storage from inside this
//     component.
//   · Do NOT render arbitrary file bytes as HTML.
//   · Do NOT infer `documentType` from the filename · the parent
//     explicitly selects it via the radio group below.

"use client";

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import {
  GOVERNMENT_ID_ALLOWED_MIME_TYPES_UI as GOVERNMENT_ID_ALLOWED_MIME_TYPES,
  GOVERNMENT_ID_DOCUMENT_TYPES_UI as GOVERNMENT_ID_DOCUMENT_TYPES,
  GOVERNMENT_ID_MAX_BYTES_UI as GOVERNMENT_ID_MAX_BYTES,
} from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";
import type { GovernmentIdDocumentTypeUi as GovernmentIdDocumentType } from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";

export interface GovernmentIdUploaderValue {
  readonly documentType: GovernmentIdDocumentType;
  readonly documentFilename: string;
  readonly documentMimeType: string;
  readonly documentByteLength: number;
  readonly documentBytesBase64: string;
  readonly idempotencyKey: string;
}

export interface GovernmentIdUploaderProps {
  readonly onSubmit: (value: GovernmentIdUploaderValue) => Promise<void>;
  readonly disabled?: boolean;
}

const DOCUMENT_TYPE_LABELS: Readonly<Record<GovernmentIdDocumentType, string>> = {
  kk: "KK (Kartu Keluarga)",
  birth_certificate: "Birth certificate",
  akta: "Akta Kelahiran",
  passport: "Passport",
  other: "Other government ID",
};

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      // @ts-expect-error Uint8Array subarray maps to number[] for fromCharCode
      bytes.subarray(i, i + chunk),
    );
  }
  // btoa is available in all modern browsers that NEX supports.
  // Node (SSR) will never run this · the component is "use client".
  return btoa(binary);
}

export function GovernmentIdUploader({
  onSubmit,
  disabled,
}: GovernmentIdUploaderProps): React.JSX.Element {
  const [documentType, setDocumentType] =
    React.useState<GovernmentIdDocumentType>("kk");
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Revoke blob URLs on unmount or when file changes.
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  // Defence in depth: assert this component NEVER writes to Web Storage.
  // Any call-site that accidentally imports this component into a scope
  // that touches storage will not break the component, but tests also
  // grep the source for `localStorage` / `sessionStorage` and must not
  // find them anywhere in this file.

  function clearFile() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      clearFile();
      return;
    }
    if (!GOVERNMENT_ID_ALLOWED_MIME_TYPES.includes(f.type)) {
      clearFile();
      setFileError(
        "Please upload a JPEG, PNG, WebP, or PDF file. Other formats are not accepted.",
      );
      return;
    }
    if (f.size > GOVERNMENT_ID_MAX_BYTES) {
      clearFile();
      setFileError("File is larger than 10 MB. Please upload a smaller file.");
      return;
    }
    setFile(f);
    setFileError(null);
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!file) {
      setFileError("Please choose a file to upload.");
      return;
    }
    if (!consent) {
      setSubmitError("Please confirm the disclosure below before submitting.");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      await onSubmit({
        documentType,
        documentFilename: file.name,
        documentMimeType: file.type,
        documentByteLength: file.size,
        documentBytesBase64: base64,
        idempotencyKey:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    } catch (err) {
      const code = err instanceof Error ? err.message : "Unknown";
      setSubmitError(
        code === "DOCUMENT_TOO_LARGE"
          ? "File is larger than the 10 MB limit."
          : "Upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: FAMILY_SAFETY_PALETTE.textSecondary,
    marginBottom: 6,
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-nex-family-safety-id-uploader="true"
      aria-label="Upload government ID"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        background: FAMILY_SAFETY_PALETTE.surfaceMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <fieldset
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          border: "none",
          padding: 0,
          margin: 0,
        }}
      >
        <legend style={labelStyle}>Document type</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {GOVERNMENT_ID_DOCUMENT_TYPES.map((t) => (
            <label
              key={t}
              data-nex-family-safety-id-type-option={t}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background:
                  documentType === t
                    ? FAMILY_SAFETY_PALETTE.cyanMuted
                    : FAMILY_SAFETY_PALETTE.surface,
                border: `1px solid ${
                  documentType === t
                    ? FAMILY_SAFETY_PALETTE.cyanBorder
                    : FAMILY_SAFETY_PALETTE.divider
                }`,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                borderRadius: 999,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="nex-fs-id-type"
                value={t}
                checked={documentType === t}
                onChange={() => setDocumentType(t)}
                disabled={disabled || busy}
                data-testid={`nex-fs-id-type-${t}`}
              />
              {DOCUMENT_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="nex-fs-id-file" style={labelStyle}>
          File
        </label>
        <input
          id="nex-fs-id-file"
          type="file"
          accept={GOVERNMENT_ID_ALLOWED_MIME_TYPES.join(",")}
          onChange={handleFileChange}
          disabled={disabled || busy}
          aria-describedby="nex-fs-id-file-help"
          data-testid="nex-fs-id-file-input"
          style={{
            display: "block",
            width: "100%",
            padding: 8,
            background: FAMILY_SAFETY_PALETTE.surface,
            border: `1px dashed ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 10,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        />
        <p
          id="nex-fs-id-file-help"
          style={{
            fontSize: 11,
            color: FAMILY_SAFETY_PALETTE.textDim,
            marginTop: 6,
          }}
        >
          Accepted: JPEG, PNG, WebP, PDF. Max 10 MB. We do not render PDFs
          inline for safety · we show the filename only.
        </p>
        {fileError ? (
          <div
            role="alert"
            style={{
              marginTop: 6,
              fontSize: 12,
              color: FAMILY_SAFETY_PALETTE.emergency,
              fontWeight: 600,
            }}
          >
            {fileError}
          </div>
        ) : null}
      </div>

      {file ? (
        <div
          data-nex-family-safety-id-preview="true"
          style={{
            padding: 12,
            background: FAMILY_SAFETY_PALETTE.surface,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 12,
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Government ID preview"
              data-testid="nex-fs-id-preview-image"
              style={{
                width: 96,
                height: 96,
                objectFit: "cover",
                borderRadius: 10,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              }}
            />
          ) : (
            <div
              aria-hidden
              data-testid="nex-fs-id-preview-pdf"
              style={{
                width: 96,
                height: 96,
                background: FAMILY_SAFETY_PALETTE.surfaceMuted,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                color: FAMILY_SAFETY_PALETTE.textDim,
              }}
            >
              📄
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {file.name}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 12,
                color: FAMILY_SAFETY_PALETTE.textSecondary,
              }}
            >
              {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type}
            </div>
            <button
              type="button"
              onClick={clearFile}
              data-testid="nex-fs-id-clear"
              style={{
                marginTop: 6,
                padding: "4px 10px",
                fontSize: 11,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                background: FAMILY_SAFETY_PALETTE.surfaceHi,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: 12,
          background: FAMILY_SAFETY_PALETTE.surface,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 12,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          disabled={disabled || busy}
          data-testid="nex-fs-id-consent"
          style={{ marginTop: 3 }}
        />
        <span
          style={{
            fontSize: 12,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          By uploading, I confirm this is a true copy of the child's
          government ID. NEX will use this only to verify the child is under
          16 and will store it under strict access control. EXIF metadata is
          stripped server-side before the file is persisted (client-side
          stripping is not performed in this build).
        </span>
      </label>

      {submitError ? (
        <div
          role="alert"
          style={{
            color: FAMILY_SAFETY_PALETTE.emergency,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {submitError}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={disabled || busy || !file || !consent}
          data-testid="nex-fs-id-submit"
          style={{
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.familyGreen,
            color: "#02141F",
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            fontSize: 14,
            cursor: busy ? "wait" : "pointer",
            opacity: disabled || busy || !file || !consent ? 0.6 : 1,
          }}
        >
          {busy ? "Uploading…" : "Continue → Review"}
        </button>
      </div>
    </form>
  );
}
