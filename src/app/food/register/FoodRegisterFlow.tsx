// Client component · two-stage flow: (1) registration form → (2) OTP entry.
// No page redirects · everything happens on /food/register for a coherent UX.

"use client";

import { useState, type FormEvent } from "react";

type Stage =
  | { kind: "form" }
  | { kind: "otp"; publicListingRef: string; businessName: string; destination: string; expiresAt: string; devPlaintextCode: string | null }
  | { kind: "success"; publicListingRef: string; businessName: string; promotedFields: string[] };

const CATEGORIES = [
  { value: "restaurant", label: "Restoran" },
  { value: "coffee-cafe", label: "Kafe & Kopi" },
  { value: "fast-food", label: "Makanan Cepat Saji" },
  { value: "ice-cream-dessert", label: "Es Krim & Dessert" },
];

export function FoodRegisterFlow() {
  const [stage, setStage] = useState<Stage>({ kind: "form" });

  if (stage.kind === "success") {
    return (
      <SuccessCard
        publicListingRef={stage.publicListingRef}
        businessName={stage.businessName}
        promotedFields={stage.promotedFields}
      />
    );
  }

  if (stage.kind === "otp") {
    return (
      <OtpEntry
        publicListingRef={stage.publicListingRef}
        businessName={stage.businessName}
        destination={stage.destination}
        expiresAt={stage.expiresAt}
        devPlaintextCode={stage.devPlaintextCode}
        onSuccess={(promotedFields) =>
          setStage({ kind: "success", publicListingRef: stage.publicListingRef, businessName: stage.businessName, promotedFields })
        }
      />
    );
  }

  return (
    <RegisterForm
      onSubmitted={(r) =>
        setStage({
          kind: "otp",
          publicListingRef: r.publicListingRef,
          businessName: r.businessName,
          destination: r.destination,
          expiresAt: r.expiresAt,
          devPlaintextCode: r.devPlaintextCode,
        })
      }
    />
  );
}

// ── Stage 1 · registration form ─────────────────────────────────────────────

function RegisterForm({
  onSubmitted,
}: {
  onSubmitted: (result: {
    publicListingRef: string;
    businessName: string;
    destination: string;
    expiresAt: string;
    devPlaintextCode: string | null;
  }) => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await fetch("/api/nex-food/claim/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          register: true,
          businessName: businessName.trim(),
          category,
          address: address.trim() || undefined,
          whatsapp: whatsapp.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? "Unknown error");
      onSubmitted(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field label="Nama bisnis" required>
        <input
          type="text" required
          placeholder="Warung Sate Pak Min"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          disabled={submitting}
          style={inputStyle}
        />
      </Field>

      <Field label="Kategori" required>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={submitting}
          style={{ ...inputStyle, appearance: "none" }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Alamat" hint="Opsional · isi jika Anda ingin muncul di pencarian lokasi">
        <input
          type="text"
          placeholder="Jl. Prawirotaman No. 12"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={submitting}
          style={inputStyle}
        />
      </Field>

      <Field label="Nomor WhatsApp" required hint="Kode verifikasi 6-digit akan dikirim ke nomor ini">
        <input
          type="tel" required
          placeholder="+62 812 3456 7890"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          disabled={submitting}
          inputMode="tel"
          style={inputStyle}
        />
      </Field>

      {error && (
        <div style={errorBoxStyle}>{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting || !businessName.trim() || !whatsapp.trim()}
        style={buttonStyle(submitting || !businessName.trim() || !whatsapp.trim())}
      >
        {submitting ? "Mendaftarkan…" : "Daftarkan bisnis saya"}
      </button>
    </form>
  );
}

// ── Stage 2 · OTP entry ─────────────────────────────────────────────────────

function OtpEntry({
  publicListingRef, businessName, destination, expiresAt, devPlaintextCode,
  onSuccess,
}: {
  publicListingRef: string;
  businessName: string;
  destination: string;
  expiresAt: string;
  devPlaintextCode: string | null;
  onSuccess: (promotedFields: string[]) => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await fetch("/api/nex-food/claim/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: publicListingRef, code: code.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error ?? "Unknown error");
      onSuccess(data.promotedFields ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const expiresIn = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...noticeBoxStyle, borderColor: "rgba(249,115,22,0.35)", background: "rgba(249,115,22,0.06)" }}>
        <strong style={{ color: "#c2410c" }}>{businessName} · {publicListingRef}</strong>
        <div style={{ marginTop: 4, fontSize: 12.5, color: "#7a5a3a" }}>
          Kode verifikasi telah dikirim ke {destination}. Kode kedaluwarsa
          dalam ~{expiresIn} menit.
        </div>
        {devPlaintextCode && (
          <div style={{
            marginTop: 8, padding: "8px 10px", background: "rgba(0,0,0,0.05)",
            borderRadius: 6, fontSize: 11.5, color: "#5a5a5a",
          }}>
            <strong style={{ color: "#c2410c" }}>[DEV MODE]</strong>{" "}
            Kode Anda: <code style={{ fontSize: 14, letterSpacing: 2 }}>{devPlaintextCode}</code>
            {" "}(hanya terlihat di mode pengembangan · production akan mengirim via WhatsApp saja)
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Kode 6-digit dari WhatsApp">
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code"
            maxLength={6} pattern="\d{6}" placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
            disabled={submitting}
            style={{
              ...inputStyle,
              fontSize: 24, letterSpacing: 8, textAlign: "center",
              fontFamily: "monospace", padding: "14px 16px",
            }}
            required
          />
        </Field>

        {error && (<div style={errorBoxStyle}>{error}</div>)}

        <button
          type="submit"
          disabled={submitting || code.length !== 6}
          style={buttonStyle(submitting || code.length !== 6)}
        >
          {submitting ? "Memverifikasi…" : "Verifikasi & klaim bisnis"}
        </button>
      </form>
    </div>
  );
}

// ── Stage 3 · success ───────────────────────────────────────────────────────

function SuccessCard({
  publicListingRef, businessName, promotedFields,
}: {
  publicListingRef: string;
  businessName: string;
  promotedFields: string[];
}) {
  return (
    <div style={{
      padding: "20px 18px",
      borderRadius: 12,
      background: "rgba(16, 185, 129, 0.08)",
      border: "1px solid rgba(16, 185, 129, 0.30)",
      color: "#166534",
    }}>
      <div style={{ fontSize: 11, letterSpacing: 2, color: "#059669", fontWeight: 700, marginBottom: 8 }}>
        KLAIM BERHASIL
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{businessName}</div>
      <div style={{ fontSize: 12, color: "#4a7a4a", marginTop: 2 }}>
        {publicListingRef}
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: "#3a5a3a", lineHeight: 1.55 }}>
        Bisnis Anda kini terdaftar di NEX Food Yogyakarta. Pelanggan yang
        menemukan bisnis Anda dapat menghubungi Anda langsung via WhatsApp.
      </div>
      {promotedFields.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#4a7a4a" }}>
          <strong>{promotedFields.length}</strong> kolom sekarang bertanda
          <em style={{ marginLeft: 4, color: "#059669" }}>owner-verified</em> (
          {promotedFields.join(", ")}).
        </div>
      )}
      <div style={{
        marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(16, 185, 129, 0.20)",
        fontSize: 11.5, color: "#4a7a4a",
      }}>
        Berikutnya: dashboard pemilik akan segera hadir untuk mengelola menu,
        foto, jam buka, dan pertanyaan pelanggan.
      </div>
    </div>
  );
}

// ── shared styles ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 14,
  background: "#ffffff",
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 8,
  color: "#1a1a1a",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
const errorBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.30)",
  color: "#991b1b",
  fontSize: 12.5,
};
const noticeBoxStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.10)",
  background: "#fff",
  fontSize: 13,
  color: "#333",
};
function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "13px 20px",
    fontSize: 14.5,
    fontWeight: 700,
    letterSpacing: 0.3,
    background: disabled ? "rgba(0,0,0,0.08)" : "#f97316",
    color: disabled ? "rgba(0,0,0,0.35)" : "#0a0a0a",
    border: "none",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 120ms ease",
  };
}

function Field({
  label, hint, required, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, color: "#4a4a4a", fontWeight: 600 }}>
        {label}
        {required && <span style={{ color: "#c2410c", marginLeft: 4 }}>*</span>}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11.5, color: "#8a8a8a", lineHeight: 1.4 }}>{hint}</span>
      )}
    </label>
  );
}
