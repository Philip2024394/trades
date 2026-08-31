// src/components/nexapp/NexWorkspaceMyRoles.tsx · Philip 2026-08-29
//
// Me → My Roles workspace · lives INSIDE the /nexapp persistent shell.
// Migrated from /nex-provider-register standalone page (Phase 2 · PR-3).
//
// Two views:
//   "menu"              — three role tiles (Provider · Business · Creator)
//   "provider-register" — the full provider onboarding form
//
// Business and Creator roles show "Coming soon" placeholders inside the
// workspace (still inside the shell — no external navigation).
//
// Functional parity for Provider registration — same fields, same API call
// (/api/nex/provider/register), same live ProviderBikeCard preview, same
// price + availability toggle.
//
// Doctrine anchors:
//   · project_nex_five_button_ia_doctrine_2026_08_29 (Me → My roles)
//   · project_nex_persistent_app_shell_doctrine_2026_08_29 (no standalone page)
//   · project_nex_mobility_doctrine_2026_08_29 (Provider not Driver)

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ProviderBikeCard } from "@/components/nex/ProviderBikeCard";

type Bike = {
  slug: string; brand: string; model: string; year_range: string; cc: number;
  category: "matic"|"maxi"|"sport"|"commuter"|"bebek"|"adventure"|"retro"|"electric";
  base_image: string; base_color: string; common_colors: string[];
};

const PALETTE = [
  { hex: "#dc2626", name: "Red" }, { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Yellow" }, { hex: "#22c55e", name: "Green" },
  { hex: "#06b6d4", name: "Cyan" }, { hex: "#3b82f6", name: "Blue" },
  { hex: "#8b5cf6", name: "Purple" }, { hex: "#ec4899", name: "Pink" },
  { hex: "#78350f", name: "Brown" }, { hex: "#f5f5dc", name: "Cream" },
  { hex: "#94a3b8", name: "Silver" }, { hex: "#111827", name: "Black" },
];
const CITIES = ["Jakarta","Denpasar","Bandung","Yogyakarta","Surabaya","Makassar","Medan","Semarang","Palembang","Balikpapan","Malang","Solo"];
const LANGUAGES = ["English","Mandarin","Japanese","Korean","Arabic","Dutch","German","French","Jawa","Sunda","Batak","Bali"];
const PRICE_PRESETS = [15000, 18000, 22000, 28000, 35000];

function ensureDeviceId(): string {
  if (typeof window === "undefined") return "device:preview-ssr";
  let id = localStorage.getItem("nex_device_id");
  if (!id || !id.startsWith("device:")) {
    id = "device:" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("nex_device_id", id);
  }
  return id;
}

type View = "menu" | "provider-register";

export function NexWorkspaceMyRoles() {
  const [view, setView] = useState<View>("menu");
  return (
    <div style={{
      color: "rgba(245,245,245,0.94)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      padding: "12px 14px 24px",
      height: "100%", overflowY: "auto",
    }}>
      {view === "menu" && <RolesMenu onPick={setView} />}
      {view === "provider-register" && <ProviderRegisterView onBack={() => setView("menu")} />}
    </div>
  );
}

// ─── Menu view ──────────────────────────────────────────────────────

function RolesMenu({ onPick }: { onPick: (v: View) => void }) {
  return (
    <>
      <div style={{
        fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
        color: "rgba(249,115,22,0.9)", fontWeight: 800, marginBottom: 4,
      }}>Me · My roles</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>
        What do you want to do on NEX?
      </h1>
      <p style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
        Roles are additive. You can turn any of these on later without changing anything about your account.
      </p>

      <RoleTile
        emoji="🏍"
        title="Become a provider"
        blurb="Offer bike, parcel, or food-run services on the NEX network. You set your price. NEX takes 8% after your 2 free monthly requests."
        cta="Register as provider"
        onClick={() => onPick("provider-register")}
      />
      <RoleTile
        emoji="🏢"
        title="Claim a business"
        blurb="Take ownership of an existing NEX directory listing (food, services, accommodation, seller). Edit hours, photos, replies to reviews."
        cta="Coming soon"
        disabled
      />
      <RoleTile
        emoji="🎥"
        title="Become a creator"
        blurb="Publish video and posts to the NEX Feed. Reach nearby customers."
        cta="Coming soon"
        disabled
      />
    </>
  );
}

function RoleTile({ emoji, title, blurb, cta, onClick, disabled }: {
  emoji: string; title: string; blurb: string; cta: string;
  onClick?: () => void; disabled?: boolean;
}) {
  return (
    <div style={{
      marginBottom: 10, padding: "14px 16px", borderRadius: 14,
      background: "rgba(15,20,30,0.6)", border: "1px solid rgba(255,255,255,0.06)",
      opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 22 }}>{emoji}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(245,245,245,0.97)" }}>{title}</div>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(203,213,225,0.85)", marginBottom: 10 }}>
        {blurb}
      </div>
      <button onClick={onClick} disabled={disabled}
        style={{
          width: "100%", padding: "9px 12px",
          background: disabled ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.9)",
          color: disabled ? "rgba(148,163,184,0.7)" : "white",
          border: disabled ? "1px solid rgba(255,255,255,0.08)" : "none",
          borderRadius: 10,
          fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
          cursor: disabled ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}>{cta}</button>
    </div>
  );
}

// ─── Provider registration view ─────────────────────────────────────

function ProviderRegisterView({ onBack }: { onBack: () => void }) {
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [learnerRef, setLearnerRef] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("+62");
  const [brand, setBrand] = useState<string>("");
  const [bikeSlug, setBikeSlug] = useState<string>("");
  const [bikeYear, setBikeYear] = useState<number>(2023);
  const [paintHex, setPaintHex] = useState<string>("#dc2626");
  const [plate, setPlate] = useState("");
  const [city, setCity] = useState<string>("Yogyakarta");
  const [language, setLanguage] = useState<string>("English");
  const [raincoat, setRaincoat] = useState<boolean>(false);
  const [priceIdr, setPriceIdr] = useState<number>(18000);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [submitState, setSubmitState] = useState<"idle"|"submitting"|"ok"|"error">("idle");
  const [serverMsg, setServerMsg] = useState<string>("");

  useEffect(() => {
    setLearnerRef(ensureDeviceId());
    fetch("/api/nex/bike-models").then((r) => r.json()).then((d) => setBikes(d.bikes ?? []));
  }, []);

  const brands = useMemo(() => Array.from(new Set(bikes.map((b) => b.brand))).sort(), [bikes]);
  const modelsForBrand = useMemo(() => bikes.filter((b) => b.brand === brand), [bikes, brand]);
  const selectedBike = useMemo(() => bikes.find((b) => b.slug === bikeSlug), [bikes, bikeSlug]);

  useEffect(() => {
    if (brand && modelsForBrand.length > 0 && !modelsForBrand.find((b) => b.slug === bikeSlug)) {
      setBikeSlug(modelsForBrand[0].slug);
    }
  }, [brand, modelsForBrand, bikeSlug]);

  async function submit() {
    setSubmitState("submitting");
    setServerMsg("");
    try {
      const resp = await fetch("/api/nex/provider/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          learner_ref: learnerRef,
          full_name: fullName,
          whatsapp_e164: whatsapp,
          bike_slug: bikeSlug,
          bike_year: bikeYear,
          bike_color_hex: paintHex,
          plate,
          city,
          secondary_language: language || null,
          provides_raincoat: raincoat,
          price_per_service_idr: priceIdr,
          is_available: isAvailable,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setSubmitState("error");
        setServerMsg(Array.isArray(data.errors) ? data.errors.join(" · ") : (data.error ?? "failed"));
      } else {
        setSubmitState("ok");
        setServerMsg(`Registered · provider_id=${data.provider_id?.slice(0,8)}… · status=${data.status}`);
      }
    } catch (err) {
      setSubmitState("error");
      setServerMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <button onClick={onBack}
        style={{
          background: "none", border: "none", padding: 0, marginBottom: 8,
          color: "rgba(148,163,184,0.85)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
        }}>← My roles</button>
      <div style={{
        fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase",
        color: "rgba(249,115,22,0.9)", fontWeight: 700, marginBottom: 4,
      }}>Become a provider</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, letterSpacing: -0.3 }}>
        Join the NEX network
      </h1>
      <p style={{ fontSize: 11, color: "rgba(245,245,245,0.55)", marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
        Indonesian law requires your real name, WhatsApp and bike details. All data stored in NEX Postgres · never in your browser.
      </p>

      {selectedBike && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase",
            color: "rgba(245,245,245,0.5)", marginBottom: 6,
          }}>How customers will see you</div>
          <ProviderBikeCard
            bikeSlug={selectedBike.slug}
            paintHex={paintHex}
            providerName={fullName || "Your name"}
            providerRating={5.0}
            plate={plate || "____ ____"}
            yearRange={String(bikeYear)}
            cc={selectedBike.cc}
            category={selectedBike.category}
            brand={selectedBike.brand}
            model={selectedBike.model}
            secondaryLanguage={language || undefined}
            providesRaincoat={raincoat}
          />
        </div>
      )}

      <div style={{
        padding: "16px 18px", borderRadius: 14,
        background: "rgba(15,20,30,0.6)", border: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <FieldLabel label="Full name (as on ID)">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Andi Wijaya" style={inputStyle} />
        </FieldLabel>

        <FieldLabel label="WhatsApp (E.164 · +62...)">
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+6281234567890" style={inputStyle} />
        </FieldLabel>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FieldLabel label="Bike brand">
            <select value={brand} onChange={(e) => setBrand(e.target.value)} style={inputStyle}>
              <option value="">— pick —</option>
              {brands.map((b) => (<option key={b} value={b} style={{ background: "#0a0e18" }}>{b}</option>))}
            </select>
          </FieldLabel>
          <FieldLabel label="Model">
            <select value={bikeSlug} onChange={(e) => setBikeSlug(e.target.value)} disabled={!brand} style={inputStyle}>
              <option value="">— pick —</option>
              {modelsForBrand.map((b) => (
                <option key={b.slug} value={b.slug} style={{ background: "#0a0e18" }}>
                  {b.model} · {b.cc > 0 ? `${b.cc}cc` : "electric"}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <FieldLabel label={`Year (${selectedBike?.year_range ?? "TBD"})`}>
            <input type="number" min="1980" max="2030" value={bikeYear}
              onChange={(e) => setBikeYear(Number(e.target.value))} style={inputStyle} />
          </FieldLabel>
          <FieldLabel label="Plate">
            <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="B 4218 UYE" style={{ ...inputStyle, fontFamily: "monospace" }} />
          </FieldLabel>
        </div>

        <FieldLabel label="Bike colour (recolor preview above)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 4 }}>
            {PALETTE.map((c) => (
              <button key={c.hex} type="button" onClick={() => setPaintHex(c.hex)} title={c.name}
                style={{
                  width: 26, height: 26, borderRadius: 999, background: c.hex, cursor: "pointer",
                  border: paintHex === c.hex ? "2px solid white" : "1px solid rgba(255,255,255,0.15)",
                  boxShadow: paintHex === c.hex ? "0 0 0 2px rgba(255,255,255,0.15)" : "none",
                }}
              />
            ))}
            <input type="color" value={paintHex} onChange={(e) => setPaintHex(e.target.value)}
              style={{ width: 28, height: 28, padding: 0, borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)", background: "transparent", cursor: "pointer" }} />
          </div>
        </FieldLabel>

        <FieldLabel label="Operating city">
          <select value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle}>
            {CITIES.map((c) => (<option key={c} value={c} style={{ background: "#0a0e18" }}>{c}</option>))}
          </select>
        </FieldLabel>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
          <FieldLabel label="Language beyond Bahasa Indonesia">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle}>
              <option value="">— none —</option>
              {LANGUAGES.map((l) => (<option key={l} value={l} style={{ background: "#0a0e18" }}>{l}</option>))}
            </select>
          </FieldLabel>
          <FieldLabel label="Raincoat">
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 32,
              border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "0 8px",
              background: "rgba(255,255,255,0.05)", cursor: "pointer",
            }}>
              <input type="checkbox" checked={raincoat}
                onChange={(e) => setRaincoat(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "#22c55e" }} />
              <span style={{ fontSize: 12 }}>{raincoat ? "Yes" : "No"}</span>
            </label>
          </FieldLabel>
        </div>

        <FieldLabel label="Your price per service (customer sees this)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 5 }}>
            {PRICE_PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setPriceIdr(p)}
                style={{
                  padding: "5px 10px", fontSize: 11, fontWeight: 600,
                  borderRadius: 999, cursor: "pointer",
                  background: priceIdr === p ? "rgba(249,115,22,0.28)" : "rgba(255,255,255,0.05)",
                  border: priceIdr === p ? "1px solid rgba(249,115,22,0.55)" : "1px solid rgba(255,255,255,0.12)",
                  color: priceIdr === p ? "rgba(254,215,170,0.98)" : "rgba(245,245,245,0.75)",
                  fontFamily: "inherit",
                }}>
                Rp {p.toLocaleString("id-ID")}
              </button>
            ))}
          </div>
          <input type="number" min="1000" max="5000000" step="1000"
            value={priceIdr}
            onChange={(e) => setPriceIdr(Math.max(1000, Number(e.target.value) || 0))}
            style={inputStyle} />
          <div style={{ fontSize: 10, color: "rgba(148,163,184,0.7)", marginTop: 4, lineHeight: 1.4 }}>
            NEX takes 8% ({formatIdr(Math.round(priceIdr * 0.08))}) per completed request, after your 2 free monthly requests.
          </div>
        </FieldLabel>

        <FieldLabel label="I'm available for requests right now">
          <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38,
            border: `1px solid ${isAvailable ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.15)"}`,
            borderRadius: 8, padding: "0 10px",
            background: isAvailable ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.05)",
            cursor: "pointer",
          }}>
            <input type="checkbox" checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "#22c55e" }} />
            <span style={{ fontSize: 12, fontWeight: 600,
              color: isAvailable ? "rgba(134,239,172,0.98)" : "rgba(245,245,245,0.75)" }}>
              {isAvailable ? "Available · will receive requests" : "Offline · will not receive requests"}
            </span>
          </label>
        </FieldLabel>

        <button onClick={submit} disabled={submitState === "submitting"}
          style={{
            marginTop: 4, padding: "10px 14px",
            background: submitState === "submitting" ? "rgba(249,115,22,0.4)" : "rgba(249,115,22,0.9)",
            color: "white", border: "none", borderRadius: 10,
            fontSize: 13, fontWeight: 700, letterSpacing: 0.4,
            cursor: submitState === "submitting" ? "wait" : "pointer",
            fontFamily: "inherit",
          }}>
          {submitState === "submitting" ? "Submitting…" : "Register with NEX"}
        </button>

        {serverMsg && (
          <div style={{
            padding: "8px 10px", borderRadius: 8, fontSize: 12,
            background: submitState === "ok" ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.14)",
            border: submitState === "ok" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(220,38,38,0.3)",
            color: submitState === "ok" ? "rgba(134,239,172,0.95)" : "rgba(252,165,165,0.95)",
          }}>{serverMsg}</div>
        )}

        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.55)", textAlign: "center", marginTop: 2 }}>
          Anonymous device identity · {learnerRef ? learnerRef.slice(0, 18) + "…" : "generating…"}
        </div>
      </div>
    </>
  );
}

function formatIdr(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 9px", fontSize: 13,
  borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.05)", color: "rgba(245,245,245,0.95)",
  fontFamily: "inherit",
};

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 10, color: "rgba(245,245,245,0.6)", letterSpacing: 0.3 }}>{label}</span>
      {children}
    </label>
  );
}
