"use client";

// src/app/nexapp/nex-agent/SketchOverlay.tsx
//
// Sketch mode · transparent canvas over the LEFT preview iframe. Founder draws
// annotations (arrows · circles · notes) that go with the next prompt as a data
// URL. NEX1 sees "this is where I want the change" in visual form.
//
// Discipline:
//   - Non-destructive · never modifies the iframe · never leaks into production
//   - Escape · toggle · Clear · undo (last stroke) supported
//   - Data URL is included in the prompt payload · scanned by security-scan
//     endpoint before being handed to nex1
//
// Renders NOTHING when disabled · so cost is zero when off.

import { useEffect, useRef, useState } from "react";

export type SketchColor = "cyan" | "orange" | "red" | "yellow";

const COLOR_HEX: Record<SketchColor, string> = {
  cyan:   "#22D3EE",
  orange: "#F97316",
  red:    "#EF4444",
  yellow: "#EAB308",
};

export interface SketchOverlayProps {
  readonly enabled: boolean;
  readonly onExit: () => void;
  readonly onExport: (dataUrl: string | null) => void;
}

interface Stroke {
  readonly color: SketchColor;
  readonly width: number;
  readonly points: Array<{ x: number; y: number }>;
}

export function SketchOverlay({ enabled, onExit, onExport }: SketchOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState<SketchColor>("orange");
  const [width, setWidth] = useState<number>(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

  // Resize canvas to container size · redraw on resize
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      redrawAll();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) drawStroke(ctx, s);
    if (drawingRef.current) drawStroke(ctx, drawingRef.current);
  };
  useEffect(() => { redrawAll(); }, [strokes]);   // eslint-disable-line react-hooks/exhaustive-deps

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length < 2) {
      if (s.points.length === 1) {
        ctx.fillStyle = COLOR_HEX[s.color];
        ctx.beginPath();
        ctx.arc(s.points[0].x, s.points[0].y, s.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    ctx.strokeStyle = COLOR_HEX[s.color];
    ctx.lineWidth = s.width;
    ctx.shadowColor = COLOR_HEX[s.color];
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = { color, width, points: [getPoint(e)] };
    redrawAll();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current.points.push(getPoint(e));
    redrawAll();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    const finished = drawingRef.current;
    drawingRef.current = null;
    setStrokes((prev) => [...prev, finished]);
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clear = () => setStrokes([]);

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) { onExport(null); onExit(); return; }
    try {
      const url = canvas.toDataURL("image/png");
      onExport(url);
    } catch { onExport(null); }
    onExit();
  };

  // ESC exits · CMD/CTRL Z undoes
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onExit(); e.preventDefault(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { undo(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onExit]);

  if (!enabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute", inset: 0,
          cursor: "crosshair",
          touchAction: "none",
          background: "rgba(11, 18, 32, 0.08)",
        }}
      />

      {/* Toolbar · top center · non-blocking */}
      <div style={{
        position: "absolute",
        top: 12, left: "50%",
        transform: "translateX(-50%)",
        display: "flex", gap: 6, alignItems: "center",
        padding: "6px 8px",
        background: "rgba(11, 18, 32, 0.95)",
        border: "1px solid rgba(34, 211, 238, 0.35)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        zIndex: 61,
      }}>
        <span style={{ fontSize: 10, color: "var(--naw-cyan, #22D3EE)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>Sketch</span>
        {(Object.keys(COLOR_HEX) as SketchColor[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: COLOR_HEX[c],
              border: color === c ? `2px solid #F9FAFB` : "2px solid transparent",
              boxShadow: color === c ? `0 0 8px ${COLOR_HEX[c]}` : "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
        <span style={{ width: 1, height: 20, background: "rgba(148,163,184,0.3)", margin: "0 4px" }} />
        <input
          type="range" min={1} max={16} value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          style={{ width: 60 }}
          aria-label="Stroke width"
        />
        <span style={{ fontSize: 10, color: "#94A3B8", minWidth: 20, textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{width}px</span>
        <span style={{ width: 1, height: 20, background: "rgba(148,163,184,0.3)", margin: "0 4px" }} />
        <button type="button" onClick={undo} disabled={strokes.length === 0} className="naw-btn-secondary" style={{ fontSize: 11 }}>↶ Undo</button>
        <button type="button" onClick={clear} disabled={strokes.length === 0} className="naw-btn-secondary" style={{ fontSize: 11 }}>Clear</button>
        <button type="button" onClick={commit} className="naw-btn-primary" style={{ fontSize: 11, padding: "5px 10px" }}>✓ Attach ({strokes.length})</button>
        <button type="button" onClick={onExit} className="naw-btn-secondary" style={{ fontSize: 11 }}>✕ Exit</button>
      </div>
    </div>
  );
}
