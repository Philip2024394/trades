"use client";

// Client component · combines the create-theme form with a live
// preview panel that recomputes on every field change.

import * as React from "react";

const NEX = {
  panel: "#03101D",
  fieldBg: "rgba(4,20,36,0.85)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  orange: "#FF7200",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

interface Props {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
}

export function ThemePreviewClient({ action }: Props) {
  const [id, setId] = React.useState("");
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [accent, setAccent] = React.useState("#009FEF");
  const [tier, setTier] = React.useState<"gratis" | "bisnis">("bisnis");
  const [category, setCategory] = React.useState<"standard" | "premium">(
    "premium",
  );
  const [heroImage, setHeroImage] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("100");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 380px)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <form
          action={action as (formData: FormData) => void | Promise<void>}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <Field
            label="Slug (id)"
            hint="lowercase alphanumerics + underscore/hyphen · 2-31 chars · starts with a letter"
            name="id"
            value={id}
            onChange={setId}
            placeholder="aurora"
            required
            pattern="^[a-z][a-z0-9_-]{1,30}$"
            monospace
          />
          <Field
            label="Display name"
            name="name"
            value={name}
            onChange={setName}
            placeholder="Aurora"
            required
          />
          <Field
            label="Tagline"
            hint="one short marketing line · shown in the picker"
            name="tagline"
            value={tagline}
            onChange={setTagline}
            placeholder="Green northern lights · rare and alive"
          />

          <div>
            <div style={labelStyle}>Accent colour</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                style={{
                  width: 52,
                  height: 44,
                  padding: 0,
                  border: `1px solid ${NEX.cyanSoft}`,
                  borderRadius: 8,
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
              <input
                type="text"
                name="accent_hex"
                value={accent}
                onChange={(e) => setAccent(e.target.value.toUpperCase())}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
                style={{
                  ...inputStyle,
                  fontFamily: "ui-monospace, monospace",
                  textTransform: "uppercase",
                  flex: 1,
                }}
              />
            </div>
            <div style={hintStyle}>
              drives bubble rims, composer, ripple · #RRGGBB
            </div>
          </div>

          <div>
            <div style={labelStyle}>Tier</div>
            <select
              name="tier"
              value={tier}
              onChange={(e) =>
                setTier(e.target.value as "gratis" | "bisnis")
              }
              style={inputStyle}
            >
              <option value="gratis">Gratis · free forever</option>
              <option value="bisnis">Bisnis · premium upgrade</option>
            </select>
          </div>

          <div>
            <div style={labelStyle}>Category</div>
            <select
              name="category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "standard" | "premium")
              }
              style={inputStyle}
            >
              <option value="standard">Standard · base library</option>
              <option value="premium">Premium · ready-made</option>
            </select>
          </div>

          <Field
            label="Hero image URL"
            hint="optional · reserved for future portrait/background variants · paste an https URL (upload UI comes later)"
            name="hero_image_url"
            value={heroImage}
            onChange={setHeroImage}
            placeholder="https://images.unsplash.com/..."
            monospace
          />

          <Field
            label="Sort order"
            hint="lower = shows first in the picker · 100 is a good default"
            name="sort_order"
            value={sortOrder}
            onChange={setSortOrder}
            placeholder="100"
            type="number"
          />

          <button
            type="submit"
            style={{
              marginTop: 12,
              padding: "12px 20px",
              borderRadius: 10,
              background: NEX.orange,
              color: "#0B0F1A",
              border: "none",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            Create theme
          </button>
        </form>

        <PreviewPanel
          accent={accent}
          name={name || "Theme name"}
          tagline={tagline || "Preview · edit the fields to see changes"}
          tier={tier}
          heroImage={heroImage}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  name,
  value,
  onChange,
  placeholder,
  required,
  pattern,
  type = "text",
  monospace,
}: {
  label: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  type?: "text" | "number";
  monospace?: boolean;
}) {
  return (
    <div>
      <div style={labelStyle}>
        {label}
        {required && <span style={{ color: NEX.orange, marginLeft: 4 }}>*</span>}
      </div>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        style={{
          ...inputStyle,
          ...(monospace ? { fontFamily: "ui-monospace, monospace" } : {}),
        }}
      />
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  );
}

function PreviewPanel({
  accent,
  name,
  tagline,
  tier,
  heroImage,
}: {
  accent: string;
  name: string;
  tagline: string;
  tier: "gratis" | "bisnis";
  heroImage: string;
}) {
  const rgb = hexToRgb(accent);
  const outgoingRim = `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
  const incomingRim = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
  const glow = `rgba(${rgb.r},${rgb.g},${rgb.b},0.25)`;

  return (
    <div style={{ position: "sticky", top: 20 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: NEX.textDim,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        Live preview
      </div>
      <div
        style={{
          background: NEX.panel,
          border: `1px solid ${NEX.cyanSoft}`,
          borderRadius: 20,
          padding: 18,
        }}
      >
        {/* Accent + tier chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 22px ${glow}`,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 11, color: NEX.textMute, fontFamily: "ui-monospace, monospace" }}>
              {accent.toUpperCase()}
            </div>
          </div>
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              background:
                tier === "bisnis"
                  ? "rgba(255,120,0,0.18)"
                  : "rgba(22,214,107,0.18)",
              color: tier === "bisnis" ? NEX.orange : "#16D66B",
            }}
          >
            {tier}
          </span>
        </div>

        {/* Optional hero image preview */}
        {heroImage && (
          <div
            style={{
              width: "100%",
              height: 120,
              borderRadius: 12,
              backgroundImage: `url(${heroImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `1px solid ${NEX.cyanSoft}`,
              marginBottom: 14,
            }}
          />
        )}

        {/* Bubble preview */}
        <div style={{ fontSize: 11, color: NEX.textDim, marginBottom: 6, letterSpacing: "0.06em" }}>
          {tagline}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <MockBubble mine={false} rim={incomingRim}>
            Hey! Just saw your latest post. Looks amazing 👋
          </MockBubble>
          <MockBubble mine={true} rim={outgoingRim}>
            Thanks! Really happy with how it turned out.
          </MockBubble>
        </div>

        {/* Composer preview */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(12,32,58,0.62)",
            border: `1px solid ${outgoingRim}`,
            boxShadow: `0 0 10px ${glow}`,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              color: NEX.textDim,
            }}
          >
            +
          </span>
          <span style={{ flex: 1, color: NEX.textMute, fontSize: 12 }}>
            Message…
          </span>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: NEX.orange,
              color: "#0B0F1A",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ➤
          </span>
        </div>
      </div>
    </div>
  );
}

function MockBubble({
  mine,
  rim,
  children,
}: {
  mine: boolean;
  rim: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "82%",
        padding: "8px 12px",
        borderRadius: 14,
        background: mine ? "rgba(12,32,58,0.62)" : "rgba(8,20,36,0.55)",
        border: `1px solid ${rim}`,
        color: NEX.text,
        fontSize: 12,
        lineHeight: 1.42,
      }}
    >
      {children}
    </div>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full || "009FEF", 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: NEX.textDim,
  marginBottom: 5,
};
const hintStyle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  color: NEX.textMute,
  lineHeight: 1.45,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  background: NEX.fieldBg,
  color: NEX.text,
  border: `1px solid ${NEX.cyanSoft}`,
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
