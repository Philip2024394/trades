"use client";

// NEX HQ · Chat theme builder · client form + live preview.
//
// Every field has a plain-English label AND a "why this matters"
// explanation so operators can build a theme without any prior
// context. File input on the hero image · file goes to Supabase
// Storage bucket nex-chat-theme-hero via the Server Action.

import * as React from "react";

const NEX = {
  panel: "#03101D",
  fieldBg: "rgba(4,20,36,0.85)",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0,175,255,0.4)",
  cyanFaint: "rgba(0,175,255,0.14)",
  orange: "#FF7200",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

interface Props {
  action: (formData: FormData) => Promise<never> | void | Promise<void>;
}

export function ThemeBuilderForm({ action }: Props) {
  const [id, setId] = React.useState("");
  const [name, setName] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [accent, setAccent] = React.useState("#009FEF");
  const [tier, setTier] = React.useState<"gratis" | "bisnis">("bisnis");
  const [sortOrder, setSortOrder] = React.useState("100");
  const [heroPreview, setHeroPreview] = React.useState<string | null>(null);
  const [heroFileName, setHeroFileName] = React.useState<string | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setHeroPreview(null);
      setHeroFileName(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setHeroPreview(url);
    setHeroFileName(file.name);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)",
        gap: 28,
        alignItems: "start",
      }}
    >
      <form
        action={action as (formData: FormData) => void | Promise<void>}
        // File uploads require multipart · Server Actions handle this
        // automatically when a File is in the FormData.
        encType="multipart/form-data"
        style={{ display: "flex", flexDirection: "column", gap: 22 }}
      >
        <FieldBlock
          label="Theme ID"
          headline="A short internal name for this theme."
          hint="Users never see this — it's how we identify the theme in the database and code. Use lowercase letters, numbers, hyphens or underscores. Start with a letter. Examples: aurora · sunset-glow · night_2."
          required
        >
          <input
            type="text"
            name="id"
            value={id}
            onChange={(e) => setId(e.target.value.toLowerCase())}
            placeholder="e.g. aurora"
            required
            pattern="^[a-z][a-z0-9_-]{1,30}$"
            style={{
              ...inputStyle,
              fontFamily: "ui-monospace, monospace",
            }}
          />
        </FieldBlock>

        <FieldBlock
          label="Theme name"
          headline="The name users see in the theme picker."
          hint="Keep it evocative — the name is part of the sell. Examples: Aurora · Molten Sunset · Midnight Blue."
          required
        >
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aurora"
            required
            style={inputStyle}
          />
        </FieldBlock>

        <FieldBlock
          label="Tagline"
          headline="One short line describing the mood."
          hint="Shown under the theme name in the picker. Keep it under ~60 characters. Examples: 'Green northern lights · rare and alive', 'Molten orange · endless summer'."
        >
          <input
            type="text"
            name="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Green northern lights · rare and alive"
            style={inputStyle}
          />
        </FieldBlock>

        <FieldBlock
          label="Accent colour"
          headline="The main colour that paints the whole chat."
          hint="This colour draws the border around every message bubble, the composer input frame, and the ripple that blooms when a message arrives. Pick something that feels premium — the entire conversation carries this colour. Format: #RRGGBB."
          required
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value.toUpperCase())}
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
        </FieldBlock>

        <FieldBlock
          label="Who can use this theme?"
          headline="Free or premium."
          hint="Free themes are available to every NEX user forever — they see it in the 'Your themes' section of the picker. Premium themes are locked until the user upgrades to NEX Bisnis — they see it in the 'NEX Bisnis' section with a lock chip and an 'Upgrade to unlock' button."
          required
        >
          <div style={{ display: "flex", gap: 10 }}>
            <TierChoice
              value="gratis"
              selected={tier === "gratis"}
              onSelect={() => setTier("gratis")}
              title="Free"
              subtitle="Available to everyone forever."
              accent={NEX.green}
            />
            <TierChoice
              value="bisnis"
              selected={tier === "bisnis"}
              onSelect={() => setTier("bisnis")}
              title="Premium (Bisnis)"
              subtitle="Requires paid subscription."
              accent={NEX.orange}
            />
          </div>
          <input type="hidden" name="tier" value={tier} />
        </FieldBlock>

        <FieldBlock
          label="Background image (optional)"
          headline="Upload an image that represents this theme."
          hint="PNG · JPG · WebP · AVIF · up to 5 MB. Reserved for future portrait / atmosphere use — themes work perfectly without one. If you don't have an image ready, skip this. The file goes to Supabase Storage · you never see the URL."
        >
          <label
            style={{
              display: "block",
              padding: "12px 14px",
              borderRadius: 10,
              background: NEX.fieldBg,
              border: `1px dashed ${NEX.cyanSoft}`,
              cursor: "pointer",
              textAlign: "center",
              color: NEX.textDim,
              fontSize: 13,
            }}
          >
            <input
              type="file"
              name="hero_image_file"
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={handleFile}
              style={{ display: "none" }}
            />
            {heroFileName ? (
              <span style={{ color: NEX.text }}>
                📎 {heroFileName} · <span style={{ color: NEX.textMute }}>tap to change</span>
              </span>
            ) : (
              <span>📎 Choose an image from your computer</span>
            )}
          </label>
        </FieldBlock>

        <FieldBlock
          label="Order in the picker"
          headline="Lower numbers appear first."
          hint="If you want this theme to show up at the top of its section (Free or Premium), use a number like 10 or 20. Leave as 100 if you don't care."
        >
          <input
            type="number"
            name="sort_order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            min={0}
            max={10000}
            style={{ ...inputStyle, maxWidth: 160 }}
          />
        </FieldBlock>

        <button
          type="submit"
          style={{
            marginTop: 10,
            padding: "14px 24px",
            borderRadius: 12,
            background: NEX.orange,
            color: "#0B0F1A",
            border: "none",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          Create this theme
        </button>
      </form>

      <PreviewPanel
        accent={accent}
        name={name || "Theme name"}
        tagline={tagline || "Tagline appears here as you type"}
        tier={tier}
        heroPreview={heroPreview}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function FieldBlock({
  label,
  headline,
  hint,
  required,
  children,
}: {
  label: string;
  headline: string;
  hint: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: NEX.panel,
        border: `1px solid ${NEX.cyanSoft}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: NEX.cyan,
          marginBottom: 4,
        }}
      >
        {label}
        {required && <span style={{ color: NEX.orange, marginLeft: 4 }}>*</span>}
      </div>
      <div style={{ fontSize: 14, color: NEX.text, fontWeight: 500, marginBottom: 4 }}>
        {headline}
      </div>
      <div
        style={{
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.55,
          marginBottom: 12,
        }}
      >
        {hint}
      </div>
      {children}
    </div>
  );
}

function TierChoice({
  value,
  selected,
  onSelect,
  title,
  subtitle,
  accent,
}: {
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 3,
        padding: "12px 14px",
        borderRadius: 10,
        background: selected ? `${accent}22` : "rgba(0,0,0,0.25)",
        border: selected
          ? `1px solid ${accent}`
          : "1px solid rgba(255,255,255,0.08)",
        color: NEX.text,
        cursor: "pointer",
        textAlign: "left",
        transition: "background 160ms ease, border-color 160ms ease",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: selected ? accent : NEX.text }}>
        {title}
      </span>
      <span style={{ fontSize: 11, color: NEX.textDim, lineHeight: 1.4 }}>
        {subtitle}
      </span>
    </button>
  );
}

function PreviewPanel({
  accent,
  name,
  tagline,
  tier,
  heroPreview,
}: {
  accent: string;
  name: string;
  tagline: string;
  tier: "gratis" | "bisnis";
  heroPreview: string | null;
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
          fontWeight: 700,
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
              color: tier === "bisnis" ? NEX.orange : NEX.green,
            }}
          >
            {tier}
          </span>
        </div>

        {/* Optional hero image preview */}
        {heroPreview && (
          <div
            style={{
              width: "100%",
              height: 120,
              borderRadius: 12,
              backgroundImage: `url(${heroPreview})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `1px solid ${outgoingRim}`,
              marginBottom: 14,
            }}
          />
        )}

        <div style={{ fontSize: 11, color: NEX.textDim, marginBottom: 6 }}>
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
