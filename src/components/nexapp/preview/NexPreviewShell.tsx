// NEX Design Preview Mode · shell UI.
//
// Locked-viewport iframe wrapper + control panel.
//   · Device presets (iPhone 390/393/402 · Android 360 · Custom)
//   · Zoom: Fit · 100 · 110 · 125
//   · Orientation: Portrait / Landscape
//   · Toggles: viewport dimensions · safe-area · touch targets · device frame
//   · Live-reloads via Next Fast Refresh inside the iframe
//
// The NEX layout inside the iframe is authored at the SELECTED CSS-pixel
// viewport (e.g. 390×844) regardless of the developer's monitor size.
// The wrapping <div> is scaled visually via CSS transform for zoom.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEVICE_PRESETS = [
  { id: "iphone-390", label: "iPhone 390 × 844",  w: 390, h: 844 },
  { id: "iphone-393", label: "iPhone 393 × 852",  w: 393, h: 852 },
  { id: "iphone-402", label: "iPhone 402 × 874",  w: 402, h: 874 },
  { id: "android-360", label: "Android 360 × 800", w: 360, h: 800 },
  { id: "custom",     label: "Custom",             w: 390, h: 844 },
] as const;

type PresetId = typeof DEVICE_PRESETS[number]["id"];

const ZOOM_PRESETS = ["fit", "100", "110", "125"] as const;
type ZoomPreset = typeof ZOOM_PRESETS[number];

type Orientation = "portrait" | "landscape";

type TouchTarget = { x: number; y: number; w: number; h: number; ok: boolean };

const MIN_TOUCH_PX = 44;   // Apple HIG · Android WCAG 2.5.5

export function NexPreviewShell({ targetUrl }: { targetUrl: string }) {
  const [preset, setPreset] = useState<PresetId>("iphone-393");
  const [customW, setCustomW] = useState(390);
  const [customH, setCustomH] = useState(844);
  const [zoom, setZoom] = useState<ZoomPreset>("fit");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [showDimensions, setShowDimensions] = useState(true);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showTouchTargets, setShowTouchTargets] = useState(false);
  const [showFrame, setShowFrame] = useState(true);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 800 });
  const [touchTargets, setTouchTargets] = useState<TouchTarget[]>([]);
  const [iframeKey, setIframeKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Resolve preset → base dimensions.
  const base = useMemo(() => {
    if (preset === "custom") return { w: customW, h: customH };
    const p = DEVICE_PRESETS.find((d) => d.id === preset)!;
    return { w: p.w, h: p.h };
  }, [preset, customW, customH]);

  // Apply orientation swap.
  const device = useMemo(() => {
    return orientation === "portrait"
      ? { w: base.w, h: base.h }
      : { w: base.h, h: base.w };
  }, [base, orientation]);

  // Measure stage size for fit-to-screen calc.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute effective scale.
  const scale = useMemo(() => {
    if (zoom === "fit") {
      const padding = 40 + (showFrame ? 40 : 0);   // reserve for chrome
      const sw = (stageSize.w - padding) / device.w;
      const sh = (stageSize.h - padding) / device.h;
      return Math.max(0.15, Math.min(sw, sh));
    }
    return Number(zoom) / 100;
  }, [zoom, device, stageSize, showFrame]);

  // Re-scan touch targets on iframe load, preset change, or toggle.
  const scanTouchTargets = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const targets: TouchTarget[] = [];
    const nodes = doc.querySelectorAll(
      'button, a[href], input, [role="button"], [role="link"], select, textarea',
    );
    nodes.forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      targets.push({
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
        ok: rect.width >= MIN_TOUCH_PX && rect.height >= MIN_TOUCH_PX,
      });
    });
    setTouchTargets(targets);
  }, []);

  useEffect(() => {
    if (!showTouchTargets) return;
    scanTouchTargets();
    const id = setInterval(scanTouchTargets, 800);  // catch state changes
    return () => clearInterval(id);
  }, [showTouchTargets, loaded, scanTouchTargets]);

  const onIframeLoad = useCallback(() => {
    setLoaded(true);
    if (showTouchTargets) scanTouchTargets();
  }, [showTouchTargets, scanTouchTargets]);

  const reload = useCallback(() => {
    setLoaded(false);
    setIframeKey((k) => k + 1);
  }, []);

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <ControlPanel
        preset={preset}
        onPresetChange={setPreset}
        customW={customW}
        customH={customH}
        onCustomChange={(w, h) => { setCustomW(w); setCustomH(h); }}
        zoom={zoom}
        onZoomChange={setZoom}
        orientation={orientation}
        onOrientationChange={setOrientation}
        showDimensions={showDimensions}
        onShowDimensions={setShowDimensions}
        showSafeArea={showSafeArea}
        onShowSafeArea={setShowSafeArea}
        showTouchTargets={showTouchTargets}
        onShowTouchTargets={setShowTouchTargets}
        showFrame={showFrame}
        onShowFrame={setShowFrame}
        onReload={reload}
        device={device}
        effectiveScale={scale}
        targetUrl={targetUrl}
      />

      <div ref={stageRef} style={styles.stage}>
        {/* Wrapper carries the visual scale · inner iframe stays at
            device.w × device.h in CSS pixels · what the NEX layout sees. */}
        <div
          style={{
            width: device.w,
            height: device.h,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "relative",
            transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          {showFrame && <DeviceFrame />}

          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={targetUrl}
            title="NEX preview"
            onLoad={onIframeLoad}
            style={{
              display: "block",
              width: device.w,
              height: device.h,
              border: "none",
              borderRadius: showFrame ? 42 : 0,
              background: "#050505",
              boxShadow: showFrame
                ? "0 30px 80px -20px rgba(0, 0, 0, 0.9), 0 0 0 2px rgba(255,255,255,0.06)"
                : "0 20px 60px -20px rgba(0, 0, 0, 0.7)",
            }}
          />

          {showSafeArea && <SafeAreaOverlay />}
          {showTouchTargets && (
            <TouchTargetOverlay targets={touchTargets} />
          )}
          {showDimensions && (
            <DimensionsBadge w={device.w} h={device.h} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Control panel
// ═══════════════════════════════════════════════════════════════

type ControlPanelProps = {
  preset: PresetId;
  onPresetChange: (p: PresetId) => void;
  customW: number;
  customH: number;
  onCustomChange: (w: number, h: number) => void;
  zoom: ZoomPreset;
  onZoomChange: (z: ZoomPreset) => void;
  orientation: Orientation;
  onOrientationChange: (o: Orientation) => void;
  showDimensions: boolean;
  onShowDimensions: (v: boolean) => void;
  showSafeArea: boolean;
  onShowSafeArea: (v: boolean) => void;
  showTouchTargets: boolean;
  onShowTouchTargets: (v: boolean) => void;
  showFrame: boolean;
  onShowFrame: (v: boolean) => void;
  onReload: () => void;
  device: { w: number; h: number };
  effectiveScale: number;
  targetUrl: string;
};

function ControlPanel(p: ControlPanelProps) {
  return (
    <aside style={styles.controlPanel}>
      <div style={styles.brand}>
        <span style={{ color: "#F5F5F5", fontWeight: 800, letterSpacing: 1 }}>NE</span>
        <span style={{ color: "#F97316", fontWeight: 800, letterSpacing: 1 }}>X</span>
        <span style={{ color: "#6B7280", fontSize: 11, marginLeft: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>
          Design Preview
        </span>
      </div>

      <Section title="Device">
        <select
          value={p.preset}
          onChange={(e) => p.onPresetChange(e.target.value as PresetId)}
          style={styles.select}
        >
          {DEVICE_PRESETS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        {p.preset === "custom" && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <NumberInput
              label="W"
              value={p.customW}
              onChange={(v) => p.onCustomChange(v, p.customH)}
            />
            <NumberInput
              label="H"
              value={p.customH}
              onChange={(v) => p.onCustomChange(p.customW, v)}
            />
          </div>
        )}
      </Section>

      <Section title="Zoom">
        <SegmentedControl
          options={ZOOM_PRESETS.map((z) => ({
            value: z,
            label: z === "fit" ? "Fit" : `${z}%`,
          }))}
          value={p.zoom}
          onChange={(v) => p.onZoomChange(v as ZoomPreset)}
        />
        <div style={styles.metaRow}>
          <span>Effective</span>
          <span>{Math.round(p.effectiveScale * 100)}%</span>
        </div>
      </Section>

      <Section title="Orientation">
        <SegmentedControl
          options={[
            { value: "portrait",  label: "Portrait"  },
            { value: "landscape", label: "Landscape" },
          ]}
          value={p.orientation}
          onChange={(v) => p.onOrientationChange(v as Orientation)}
        />
      </Section>

      <Section title="Developer">
        <Toggle label="Show viewport dimensions" checked={p.showDimensions}   onChange={p.onShowDimensions} />
        <Toggle label="Show safe-area boundaries" checked={p.showSafeArea}    onChange={p.onShowSafeArea} />
        <Toggle label="Show touch targets"        checked={p.showTouchTargets} onChange={p.onShowTouchTargets} />
        <Toggle label="Show device frame"         checked={p.showFrame}        onChange={p.onShowFrame} />
      </Section>

      <Section title="Actions">
        <button onClick={p.onReload} style={styles.btn}>Reload preview</button>
        <a href={p.targetUrl} target="_blank" rel="noreferrer" style={{ ...styles.btn, display: "block", textAlign: "center", marginTop: 8, textDecoration: "none" }}>
          Open standalone ↗
        </a>
      </Section>

      <div style={styles.footNote}>
        Development-only tool. Production /nexapp is never wrapped.
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              ...styles.segmentedBtn,
              background: active ? "#F97316" : "transparent",
              color: active ? "#0a0a0a" : "#F5F5F5",
              fontWeight: active ? 700 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={styles.toggleRow}>
      <span>{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 34,
          height: 20,
          borderRadius: 999,
          background: checked ? "#F97316" : "#333",
          position: "relative",
          cursor: "pointer",
          transition: "background 140ms",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 140ms",
          }}
        />
      </span>
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
      <span style={{ fontSize: 11, color: "#9CA3AF" }}>{label}</span>
      <input
        type="number"
        value={value}
        min={200}
        max={2000}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{
          flex: 1,
          background: "#151515",
          border: "1px solid #333",
          borderRadius: 6,
          color: "#F5F5F5",
          padding: "6px 8px",
          fontSize: 12,
          minWidth: 0,
        }}
      />
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════
// Overlays
// ═══════════════════════════════════════════════════════════════

function DeviceFrame() {
  // Thin bezel around the iframe · sits behind it (negative inset).
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: -12,
        borderRadius: 54,
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "inset 0 0 0 2px #000, 0 0 60px rgba(0,0,0,0.6)",
        zIndex: -1,
      }}
    />
  );
}

function SafeAreaOverlay() {
  // Approx iPhone 14 safe areas.
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 47, background: "rgba(59,130,246,0.14)", borderBottom: "1px dashed rgba(59,130,246,0.55)" }}>
        <span style={overlayLabelStyle}>top safe · 47px</span>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 34, background: "rgba(59,130,246,0.14)", borderTop: "1px dashed rgba(59,130,246,0.55)" }}>
        <span style={overlayLabelStyle}>bottom safe · 34px</span>
      </div>
    </div>
  );
}

const overlayLabelStyle: React.CSSProperties = {
  position: "absolute",
  right: 6,
  top: 4,
  fontSize: 10,
  fontFamily: `ui-monospace, "SF Mono", Menlo, monospace`,
  color: "rgba(255,255,255,0.85)",
  background: "rgba(59,130,246,0.7)",
  padding: "1px 5px",
  borderRadius: 4,
};

function TouchTargetOverlay({ targets }: { targets: TouchTarget[] }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 12 }}>
      {targets.map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: t.x,
            top: t.y,
            width: t.w,
            height: t.h,
            border: `1.5px solid ${t.ok ? "rgba(16,185,129,0.85)" : "rgba(239,68,68,0.85)"}`,
            background: t.ok ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.14)",
            borderRadius: 4,
            boxSizing: "border-box",
          }}
          title={`${Math.round(t.w)}×${Math.round(t.h)}${t.ok ? "" : " · below 44×44"}`}
        />
      ))}
    </div>
  );
}

function DimensionsBadge({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -28,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(15,15,15,0.9)",
        color: "#F5F5F5",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontFamily: `ui-monospace, "SF Mono", Menlo, monospace`,
        letterSpacing: 0.4,
        pointerEvents: "none",
        zIndex: 11,
      }}
    >
      {w} × {h}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100dvh",
    width: "100vw",
    background: "#0e0e0e",
    color: "#F5F5F5",
    fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
    overflow: "hidden",
  },
  controlPanel: {
    width: 288,
    minWidth: 288,
    borderRight: "1px solid #1e1e1e",
    background: "#0a0a0a",
    padding: "18px 16px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    overflowY: "auto",
  },
  brand: {
    fontSize: 22,
    lineHeight: 1,
    marginBottom: 6,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 700,
  },
  select: {
    width: "100%",
    background: "#151515",
    color: "#F5F5F5",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },
  segmented: {
    display: "flex",
    background: "#151515",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  segmentedBtn: {
    flex: 1,
    padding: "7px 8px",
    background: "transparent",
    border: "none",
    color: "#F5F5F5",
    fontSize: 12,
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 120ms",
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 12.5,
    cursor: "pointer",
    color: "#F5F5F5",
    gap: 8,
  },
  btn: {
    width: "100%",
    background: "#F97316",
    border: "none",
    color: "#0a0a0a",
    padding: "9px 12px",
    borderRadius: 6,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.2,
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#6B7280",
    fontFamily: `ui-monospace, "SF Mono", Menlo, monospace`,
    padding: "4px 2px 0",
  },
  footNote: {
    marginTop: "auto",
    paddingTop: 12,
    borderTop: "1px solid #1e1e1e",
    fontSize: 10.5,
    color: "#6B7280",
    lineHeight: 1.5,
  },
  stage: {
    flex: 1,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at 50% 40%, #1a1a1a 0%, #0a0a0a 60%, #060606 100%)",
    overflow: "hidden",
  },
};
