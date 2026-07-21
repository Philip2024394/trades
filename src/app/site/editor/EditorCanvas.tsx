"use client";

// EditorCanvas — the actual Konva stage. Split out of EditorClient
// so react-konva can be imported as ONE unit (not per-component
// dynamic() imports which produced a broken scene tree — Stage /
// Layer / KImage each lazy-loading meant the base image mounted
// before its parent Layer existed).
//
// The whole file is client-only (dynamic-imported by EditorClient
// with ssr:false).

import { forwardRef, useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Circle, Line, Group, Text as KText, Image as KImage, Transformer } from "react-konva";
import type Konva from "konva";
import type { BaseImageSlot, EditorLayer, EditorMode, ImageLayer, TextLayer } from "@/lib/siteEditor/types";
import { findFont } from "@/lib/siteEditor/fonts";

/** Marching-ants dash offset — animates from 0 → dashPattern total
 *  in a loop so the yellow dashed border around the selected layer
 *  "runs" clockwise. requestAnimationFrame keeps it smooth. */
function useMarchingAnts(active: boolean): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      // ~30px cycle in 1s → visible but not distracting
      setOffset(((t - start) / 1000) * 30 * -1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return offset;
}

/** Bounding rect for any layer — used to draw the marching-ants
 *  selection border. Handles all kinds; shapes/text return their
 *  declared width/height, images pull from layerImgs. */
function boundsOf(layer: EditorLayer, imgFor: (id: string) => HTMLImageElement | null): { x: number; y: number; w: number; h: number } {
  if (layer.kind === "text" || layer.kind === "shape") {
    return { x: layer.x, y: layer.y, w: (layer as { width: number }).width, h: (layer as { height?: number; fontSize?: number }).height ?? (layer as { fontSize?: number }).fontSize ?? 24 };
  }
  if (layer.kind === "image" || layer.kind === "overlay" || layer.kind === "banner") {
    const img = imgFor(layer.id);
    const w = (layer as ImageLayer).width  || img?.naturalWidth  || 100;
    const h = (layer as ImageLayer).height || img?.naturalHeight || 100;
    return { x: layer.x, y: layer.y, w, h };
  }
  return { x: layer.x, y: layer.y, w: 100, h: 100 };
}

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";

export type CanvasHandle = Konva.Stage;

export type EditorCanvasProps = {
  width:            number;
  height:           number;
  paid:             boolean;
  baseImg:          HTMLImageElement | null;
  /** When the base slot is a video, this holds the HTMLVideoElement
   *  that Konva uses as the KImage texture. Overlays composite on
   *  top. Null when the base is an image (fallback to baseImg). */
  baseVideo?:       HTMLVideoElement | null;
  /** True while the video is playing — drives a Konva.Animation loop
   *  that redraws the stage each frame so the composited overlays
   *  update alongside the moving video texture. */
  videoPlaying?:    boolean;
  /** Current playback time in seconds. Used to compute per-layer
   *  animation opacity (fade in/out) during preview. */
  videoTime?:       number;
  base:             BaseImageSlot;
  /** Set in beforeAfter mode — right-half base image + slot. */
  secondaryImg?:    HTMLImageElement | null;
  secondaryBase?:   BaseImageSlot;
  mode:             EditorMode;
  /** In beforeAfter mode, which half is currently being edited.
   *  The active half's border pulses brighter yellow so the user
   *  knows which side new uploads / library picks will land on. */
  activeSlot?:      "base" | "secondary";
  layers:           EditorLayer[];
  selectedLayerId:  string | null;
  layerImgs:        Record<string, HTMLImageElement>;
  onBaseDragEnd:    (x: number, y: number) => void;
  onSecondaryDragEnd?: (x: number, y: number) => void;
  onLayerSelect:    (id: string | null) => void;
  onLayerDragEnd:   (id: string, x: number, y: number) => void;
  /** Called after a resize or rotation gesture ends. Konva applies
   *  scaleX/scaleY to the node during transform; the handler here
   *  translates that back into width/height + rotation on the layer. */
  onLayerTransformEnd?: (id: string, patch: { x: number; y: number; width: number; height: number; rotation: number }) => void;
  /** Frame-aware safe zone dim overlay. When true, everything outside
   *  the platform-safe area gets a semi-transparent dark scrim so
   *  merchants see visually where text/badges will get cropped by
   *  platform chrome. Toggled off during export so the flatten doesn't
   *  bake the scrim into the download. Default: true. */
  showSafeZone?:    boolean;
  /** Merchant slug used for the per-user trace watermark. Rendered
   *  at ~12% opacity in every corner so a leaked download can be
   *  traced back to the account that pulled it. Present for both
   *  free and paid tiers — free gets the bold visible watermark
   *  ADDITIONALLY. Null when the caller isn't associated with a
   *  merchant (anonymous editor session). */
  merchantSlug?:    string | null;
};

export const EditorCanvas = forwardRef<CanvasHandle, EditorCanvasProps>(function EditorCanvas(
  { width, height, paid, baseImg, baseVideo, videoPlaying, videoTime, base, secondaryImg, secondaryBase, mode, activeSlot, layers, selectedLayerId, layerImgs, onBaseDragEnd, onSecondaryDragEnd, onLayerSelect, onLayerDragEnd, onLayerTransformEnd, showSafeZone = true, merchantSlug = null },
  ref
) {
  // Konva.Animation loop — while the video plays, tick the base
  // layer's batchDraw so the KImage refreshes with each new video
  // frame. When paused we stop the loop for zero-cost idle.
  const baseLayerRef = useRef<Konva.Layer | null>(null);
  useEffect(() => {
    if (!baseVideo || !videoPlaying) return;
    // Lazy-load Konva just for the Animation class. react-konva
    // already brings it in so this is a memoised subsequent load.
    let cancelled = false;
    (async () => {
      const KonvaMod = (await import("konva")).default;
      if (cancelled) return;
      const anim = new KonvaMod.Animation(() => { /* redraw on every AF */ }, baseLayerRef.current);
      anim.start();
      // Return a cleanup that also stops the animation.
      const stop = () => anim.stop();
      // We store on a captured closure so the outer cleanup can call it.
      (anim as unknown as { _cleanupHook?: () => void })._cleanupHook = stop;
      // Attach to a symbol on the videoEl so we can retrieve it in cleanup.
      (baseVideo as unknown as { __konvaAnim?: typeof anim }).__konvaAnim = anim;
    })();
    return () => {
      cancelled = true;
      const anim = (baseVideo as unknown as { __konvaAnim?: { stop: () => void } }).__konvaAnim;
      if (anim) anim.stop();
    };
  }, [baseVideo, videoPlaying]);
  const orderedLayers = [...layers].sort((a, b) => a.z - b.z);
  const isSplit  = mode === "beforeAfter";
  const halfW    = width / 2;
  const clipLeft  = { x: 0,     y: 0, width: halfW, height };
  const clipRight = { x: halfW, y: 0, width: halfW, height };

  // Marching-ants animation — only runs while a layer is selected.
  const dashOffset = useMarchingAnts(Boolean(selectedLayerId));
  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;
  const selBounds = selectedLayer
    ? boundsOf(selectedLayer, (id) => layerImgs[id] ?? null)
    : null;

  // Snap guides — vertical + horizontal lines shown live during
  // drag when the layer aligns with the canvas centre, an edge, or
  // another layer's centre/edge. Both cleared on drag end.
  const [snapGuides, setSnapGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  // Konva Transformer — draws corner resize anchors + a top-center
  // rotation handle (line + circle) around the currently-selected
  // layer. Bound to the layer node by Konva id after each render.
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const stageInternalRef = useRef<Konva.Stage | null>(null);
  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageInternalRef.current;
    if (!tr || !stage) return;
    if (!selectedLayerId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    // Position-locked layers (template-authored) skip Transformer
    // binding so resize / rotate handles never appear — the marching-
    // ants selection ring still shows so the user knows what's picked.
    const sel = layers.find((l) => l.id === selectedLayerId);
    if (sel && sel.kind === "text" && sel.locked === "position") {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }
    const node = stage.findOne(`#${selectedLayerId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedLayerId, layers]);

  return (
    <Stage
      ref={(node) => {
        stageInternalRef.current = node;
        // Preserve the forwardRef contract for EditorClient's export path.
        if (typeof ref === "function") ref(node as unknown as CanvasHandle);
        else if (ref) (ref as React.MutableRefObject<CanvasHandle | null>).current = node as unknown as CanvasHandle;
      }}
      width={width}
      height={height}
      onMouseDown={(e) => {
        if (e.target === e.target.getStage()) onLayerSelect(null);
      }}
      onTouchStart={(e) => {
        if (e.target === e.target.getStage()) onLayerSelect(null);
      }}
    >
      {/* Base image / video layer — in beforeAfter mode the left
          base is clipped to the left half only so drags can't spill
          across. When the slot is a video (base.kind === "video")
          we render the HTMLVideoElement as the Konva texture; the
          Animation loop above redraws each frame during playback. */}
      <Layer ref={baseLayerRef}>
        {base.kind === "video" && baseVideo && (
          <Group clipX={isSplit ? clipLeft.x : 0} clipY={0} clipWidth={isSplit ? clipLeft.width : width} clipHeight={height}>
            <KImage
              image={baseVideo as unknown as HTMLImageElement}
              x={0}
              y={0}
              width={width}
              height={height}
              listening={false}
            />
          </Group>
        )}
        {base.kind !== "video" && baseImg && (
          <Group clipX={isSplit ? clipLeft.x : 0} clipY={0} clipWidth={isSplit ? clipLeft.width : width} clipHeight={height}>
            <KImage
              image={baseImg}
              x={base.offsetX}
              y={base.offsetY}
              width={baseImg.naturalWidth  * (base.scaleX ?? base.scale)}
              height={baseImg.naturalHeight * (base.scaleY ?? base.scale)}
              draggable
              onDragEnd={(e) => onBaseDragEnd(e.target.x(), e.target.y())}
            />
          </Group>
        )}
        {/* Template placeholder — dashed cream frame + centred prompt
            when the base slot is marked as a placeholder AND no photo
            has been loaded yet. Vanishes the moment the merchant sets
            a URL. Interaction (tap to open library) is wired on the
            outer container — the group here is purely visual. */}
        {base.isPlaceholder && !baseImg && (
          <Group listening={false}>
            <Rect
              x={20}
              y={20}
              width={width  - 40}
              height={height - 40}
              cornerRadius={12}
              fill="rgba(251,246,236,0.9)"
              stroke={BRAND_YELLOW}
              strokeWidth={2}
              dash={[10, 6]}
            />
            <KText
              x={0}
              y={height / 2 - 14}
              width={width}
              align="center"
              text="Tap to add your photo"
              fontFamily="system-ui"
              fontSize={16}
              fontStyle="700"
              fill={BRAND_BLACK}
            />
            <KText
              x={0}
              y={height / 2 + 8}
              width={width}
              align="center"
              text="Template ready — swap in one of your Site images"
              fontFamily="system-ui"
              fontSize={11}
              fill="rgba(10,10,10,0.55)"
            />
          </Group>
        )}
        {isSplit && secondaryImg && secondaryBase && (
          <Group clipX={clipRight.x} clipY={0} clipWidth={clipRight.width} clipHeight={height}>
            <KImage
              image={secondaryImg}
              x={secondaryBase.offsetX}
              y={secondaryBase.offsetY}
              width={secondaryImg.naturalWidth  * secondaryBase.scale}
              height={secondaryImg.naturalHeight * secondaryBase.scale}
              draggable
              dragBoundFunc={(pos) => ({
                // Keep the drag inside the right half's clip so the
                // handle doesn't wander over the divider.
                x: Math.max(clipRight.x - (secondaryImg.naturalWidth  * secondaryBase.scale) + 20, Math.min(pos.x, clipRight.x + clipRight.width - 20)),
                y: pos.y
              })}
              onDragEnd={(e) => onSecondaryDragEnd?.(e.target.x(), e.target.y())}
            />
          </Group>
        )}
      </Layer>

      {/* Overlay layers */}
      <Layer>
        {orderedLayers.map((layer) => {
          const isSelected = selectedLayerId === layer.id;
          // Build snap sources for this specific layer — canvas
          // centre + edges + OTHER layers' edges/centres (excluding
          // the layer being dragged itself). Recomputed per-map so
          // adding a new layer immediately updates snap targets.
          const others = orderedLayers.filter((l) => l.id !== layer.id);
          const snapVerticals: number[]   = [0, width / 2, width];
          const snapHorizontals: number[] = [0, height / 2, height];
          for (const o of others) {
            const w = (o as { width?: number }).width  ?? 100;
            const hh = (o as { height?: number }).height ?? 100;
            snapVerticals.push(o.x, o.x + w / 2, o.x + w);
            snapHorizontals.push(o.y, o.y + hh / 2, o.y + hh);
          }
          return renderLayer(layer, {
            imgFor:    (id) => layerImgs[id] ?? null,
            selected:  isSelected,
            onToggle:  () => onLayerSelect(isSelected ? null : layer.id),
            onDragEnd: (x, y) => onLayerDragEnd(layer.id, x, y),
            canvasW:   width,
            canvasH:   height,
            videoTime,
            snapVerticals,
            snapHorizontals,
            onSnapUpdate: (guides) => setSnapGuides(guides)
          });
        })}
        {/* Konva Transformer — corner resize handles + top-center
            rotation handle (line + circle) around the selected layer.
            Border is transparent because the marching-ants Rect above
            handles the visible selection ring. */}
        <Transformer
          ref={transformerRef}
          rotateEnabled
          keepRatio={false}
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          rotateAnchorOffset={28}
          anchorSize={14}
          anchorFill={BRAND_YELLOW}
          anchorStroke={BRAND_BLACK}
          anchorStrokeWidth={2}
          anchorCornerRadius={7}
          borderEnabled={false}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={5}
          // Constrain resize so the box never leaves the frame and
          // never shrinks below 30px on either axis.
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30 || newBox.height < 30) return oldBox;
            if (newBox.x < 0 || newBox.y < 0)             return oldBox;
            if (newBox.x + newBox.width  > width)         return oldBox;
            if (newBox.y + newBox.height > height)        return oldBox;
            return newBox;
          }}
          onTransformEnd={() => {
            const tr = transformerRef.current;
            const node = tr?.nodes()[0];
            if (!node || !onLayerTransformEnd) return;
            const sx = node.scaleX();
            const sy = node.scaleY();
            const w  = Math.max(30, node.width()  * sx);
            const h  = Math.max(30, node.height() * sy);
            // Reset scale to 1 — we bake it into width/height so
            // subsequent transforms start from a clean state.
            node.scaleX(1);
            node.scaleY(1);
            onLayerTransformEnd(String(node.id()), {
              x:        node.x(),
              y:        node.y(),
              width:    w,
              height:   h,
              rotation: node.rotation()
            });
          }}
        />
      </Layer>

      {/* Marching-ants selection ring — yellow dashed border around
          the currently-selected overlay layer with animated dash
          offset (the "running lights" effect). Kept in its own
          non-listening layer so it doesn't intercept drags. */}
      <Layer listening={false}>
        {selectedLayer && selBounds && selectedLayer.kind !== "text" && (
          <Rect
            x={selBounds.x - 4}
            y={selBounds.y - 4}
            width={selBounds.w + 8}
            height={selBounds.h + 8}
            rotation={selectedLayer.rotation}
            stroke={BRAND_YELLOW}
            strokeWidth={2}
            dash={[10, 6]}
            dashOffset={dashOffset}
            shadowColor={BRAND_YELLOW}
            shadowBlur={8}
            shadowOpacity={0.6}
          />
        )}
        {/* Text layers get a slightly thinner ring since their bounds
            are usually smaller and text sits inside. */}
        {selectedLayer && selBounds && selectedLayer.kind === "text" && (
          <Rect
            x={selBounds.x - 3}
            y={selBounds.y - 3}
            width={selBounds.w + 6}
            height={selBounds.h + 6}
            rotation={selectedLayer.rotation}
            stroke={BRAND_YELLOW}
            strokeWidth={1.5}
            dash={[8, 5]}
            dashOffset={dashOffset}
            shadowColor={BRAND_YELLOW}
            shadowBlur={6}
            shadowOpacity={0.5}
          />
        )}
      </Layer>

      {/* Frame overlay — solid yellow border + watermark for free
          tier + B/A divider, labels, and active-half glow when in
          beforeAfter mode. Also renders safe-zone guides on 9:16
          Story / Reel / TikTok / Snap frames so trades know NOT to
          put text/badges under the platform's chrome bars. */}
      <Layer listening={false}>
        {/* Base solid yellow frame — always drawn full-canvas. */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          stroke={BRAND_YELLOW}
          strokeWidth={3}
        />
        {/* Per-frame safe-zone dim overlay. Everything OUTSIDE the
            platform-safe area is dimmed so trades can visually see
            where text/badges will get cropped by chrome. Rules tuned
            to each platform's real crop (tightened after Story tests
            showed 14/18 was leaving barely any workable middle):
              9:16 vertical  (Story/Reel/TT/Snap) — 12% top, 15% bottom
              4:5 portrait   (IG portrait / Canteen)  — 6% top,  8% bottom
              square-ish     (IG feed / FB square)    — 5% all sides
              landscape      (FB feed 1200×630)       — 4% all sides
            Hidden during export via showSafeZone=false. */}
        {showSafeZone && (() => {
          const aspect = height / Math.max(1, width);
          let padTop:    number;
          let padBottom: number;
          let padSide:   number;
          if (aspect > 1.5) {           // Tall: Story / Reel / TikTok / Snap
            padTop = 0.12; padBottom = 0.15; padSide = 0.04;
          } else if (aspect > 1.1) {    // Portrait: IG portrait / Canteen
            padTop = 0.06; padBottom = 0.08; padSide = 0.04;
          } else if (aspect > 0.85) {   // Square: IG feed / FB square
            padTop = 0.05; padBottom = 0.05; padSide = 0.05;
          } else {                       // Landscape: FB feed 1200×630
            padTop = 0.04; padBottom = 0.04; padSide = 0.04;
          }
          const topH  = Math.round(height * padTop);
          const botH  = Math.round(height * padBottom);
          const sideW = Math.round(width  * padSide);
          const dim   = "rgba(0,0,0,0.35)";
          return (
            <>
              {/* Top strip */}
              <Rect x={0} y={0} width={width} height={topH} fill={dim}/>
              {/* Bottom strip */}
              <Rect x={0} y={height - botH} width={width} height={botH} fill={dim}/>
              {/* Left strip (between top + bottom) */}
              <Rect x={0} y={topH} width={sideW} height={height - topH - botH} fill={dim}/>
              {/* Right strip (between top + bottom) */}
              <Rect x={width - sideW} y={topH} width={sideW} height={height - topH - botH} fill={dim}/>
              {/* SAFE ZONE label — small, dark red so it reads on any
                  background without dominating the composition. */}
              <KText
                x={0}
                y={topH + 4}
                width={width}
                text="SAFE ZONE"
                align="center"
                fontSize={10}
                fontStyle="bold"
                fill="#8B0000"
              />
            </>
          );
        })()}
        {isSplit && (
          <>
            {/* Divider — solid yellow. */}
            <Line
              points={[halfW, 0, halfW, height]}
              stroke={BRAND_YELLOW}
              strokeWidth={3}
            />
            {/* Active-half glow — bright thick yellow border over the
                half the user is currently editing so they know which
                side new uploads / library picks will land on. Non-
                active half gets a dimmed border by contrast. */}
            {activeSlot === "base" && (
              <>
                <Rect
                  x={2}
                  y={2}
                  width={halfW - 4}
                  height={height - 4}
                  stroke={BRAND_YELLOW}
                  strokeWidth={6}
                  shadowColor={BRAND_YELLOW}
                  shadowBlur={16}
                  shadowOpacity={0.8}
                />
                {/* Dim the OTHER half's border. */}
                <Rect
                  x={halfW + 2}
                  y={2}
                  width={halfW - 4}
                  height={height - 4}
                  stroke="rgba(255,179,0,0.35)"
                  strokeWidth={2}
                />
              </>
            )}
            {activeSlot === "secondary" && (
              <>
                <Rect
                  x={halfW + 2}
                  y={2}
                  width={halfW - 4}
                  height={height - 4}
                  stroke={BRAND_YELLOW}
                  strokeWidth={6}
                  shadowColor={BRAND_YELLOW}
                  shadowBlur={16}
                  shadowOpacity={0.8}
                />
                <Rect
                  x={2}
                  y={2}
                  width={halfW - 4}
                  height={height - 4}
                  stroke="rgba(255,179,0,0.35)"
                  strokeWidth={2}
                />
              </>
            )}
            {/* BEFORE chip — top-center of left half */}
            <Rect
              x={halfW / 2 - 40}
              y={12}
              width={80}
              height={22}
              cornerRadius={11}
              fill="#0A0A0A"
              opacity={0.9}
            />
            <KText
              x={halfW / 2 - 40}
              y={14}
              width={80}
              text="BEFORE"
              align="center"
              fontSize={12}
              fontStyle="bold"
              fill={BRAND_YELLOW}
            />
            {/* AFTER chip — top-center of right half */}
            <Rect
              x={halfW + halfW / 2 - 40}
              y={12}
              width={80}
              height={22}
              cornerRadius={11}
              fill="#0A0A0A"
              opacity={0.9}
            />
            <KText
              x={halfW + halfW / 2 - 40}
              y={14}
              width={80}
              text="AFTER"
              align="center"
              fontSize={12}
              fontStyle="bold"
              fill={BRAND_YELLOW}
            />
          </>
        )}
        {!paid && (() => {
          // Per-frame safe placement.
          //   9:16 Story / Reel / TikTok / Snap → bottom-CENTRE
          //     (avoids the platform's send-message bar on the right
          //      and the like/share stack — bottom-centre stays clear)
          //   Square / 4:5 / Facebook feed → bottom-LEFT (as before)
          const tall = height / Math.max(1, width) > 1.5;
          const yPad = tall ? 220 : 22;   // extra lift on 9:16 to clear IG/TT chrome
          const y = height - yPad;
          const dotX = tall ? width / 2 - 78 : 12;
          const textX = dotX + 14;
          return (
            <>
              <Circle
                x={dotX + 4}
                y={y - 4}
                radius={5}
                fill={BRAND_YELLOW}
                opacity={0.9}
                shadowColor="#000"
                shadowBlur={2}
                shadowOpacity={0.4}
              />
              <KText
                x={textX}
                y={y - 12}
                text="thenetworkers.app"
                fontSize={14}
                fontStyle="bold"
                fill="#FFFFFF"
                opacity={0.85}
                shadowColor="#000"
                shadowBlur={3}
                shadowOpacity={0.55}
              />
            </>
          );
        })()}

        {/* Per-user trace watermark — always renders when the caller
            has a merchant slug (both free + paid). Faint 4-corner
            "thenetworkers.app/<slug>" at ~12% opacity so a leaked
            export can be tied back to the account that made it.
            Doesn't interfere with the visible free-tier watermark;
            invisible-ish to viewers, provable in DMCA. */}
        {merchantSlug && (() => {
          const tag  = `thenetworkers.app/${merchantSlug}`;
          const fs   = Math.max(9, Math.round(Math.min(width, height) * 0.014));
          const pad  = Math.round(fs * 0.9);
          const op   = 0.12;
          return (
            <>
              {/* Top-left */}
              <KText x={pad}         y={pad}         text={tag} fontSize={fs} fontStyle="bold" fill="#FFFFFF" opacity={op} shadowColor="#000" shadowBlur={2} shadowOpacity={0.35}/>
              {/* Top-right */}
              <KText x={0}           y={pad}         width={width - pad} align="right" text={tag} fontSize={fs} fontStyle="bold" fill="#FFFFFF" opacity={op} shadowColor="#000" shadowBlur={2} shadowOpacity={0.35}/>
              {/* Bottom-left */}
              <KText x={pad}         y={height - pad - fs} text={tag} fontSize={fs} fontStyle="bold" fill="#FFFFFF" opacity={op} shadowColor="#000" shadowBlur={2} shadowOpacity={0.35}/>
              {/* Bottom-right */}
              <KText x={0}           y={height - pad - fs} width={width - pad} align="right" text={tag} fontSize={fs} fontStyle="bold" fill="#FFFFFF" opacity={op} shadowColor="#000" shadowBlur={2} shadowOpacity={0.35}/>
            </>
          );
        })()}

        {/* Snap guide lines — hot pink so they read against any
            background. Only shown while a layer is being dragged
            and its edge/centre aligns with a snap target. */}
        {snapGuides.v.map((x, i) => (
          <Line
            key={`v-${i}`}
            points={[x, 0, x, height]}
            stroke="#FF3366"
            strokeWidth={1}
            dash={[4, 4]}
            opacity={0.9}
          />
        ))}
        {snapGuides.h.map((y, i) => (
          <Line
            key={`h-${i}`}
            points={[0, y, width, y]}
            stroke="#FF3366"
            strokeWidth={1}
            dash={[4, 4]}
            opacity={0.9}
          />
        ))}
      </Layer>
    </Stage>
  );
});

// ============================================================ layer render

type LayerHelpers = {
  imgFor:    (id: string) => HTMLImageElement | null;
  selected:  boolean;
  /** Toggle selection on this layer. If it's already selected, this
   *  deselects (badge "sticks" in place with no editing ring).
   *  Clicking it again re-selects and the marching-ants ring returns. */
  onToggle:  () => void;
  onDragEnd: (x: number, y: number) => void;
  /** Canvas bounds for drag constraint — badges can't leave the frame. */
  canvasW:   number;
  canvasH:   number;
  /** Current video playback time in seconds (undefined when base is
   *  an image). Passed so animated overlays can compute live opacity
   *  from their enter/exit/fade timing. */
  videoTime?: number;
  /** Snap source lines (x for vertical guides, y for horizontal) —
   *  used during drag to align to canvas centre + other layers. */
  snapVerticals:   number[];
  snapHorizontals: number[];
  /** Fired on every drag frame with the currently-active guide
   *  positions so the canvas can render feedback lines. */
  onSnapUpdate:    (guides: { v: number[]; h: number[] }) => void;
};

/** Compute a layer's live opacity based on animation timing +
 *  current video time. Static layers return layer.opacity as-is. */
function liveOpacity(layer: EditorLayer, videoTime: number | undefined): number {
  const a = layer.animation;
  const base = layer.opacity;
  if (!a || videoTime === undefined) return base;
  if (videoTime < a.enterAtSec) return 0;
  if (videoTime > a.exitAtSec)  return 0;
  // Fade-in ramp
  const fadeInEnd  = a.enterAtSec + a.fadeInSec;
  if (a.fadeInSec > 0 && videoTime < fadeInEnd) {
    return base * ((videoTime - a.enterAtSec) / a.fadeInSec);
  }
  // Fade-out ramp
  const fadeOutStart = a.exitAtSec - a.fadeOutSec;
  if (a.fadeOutSec > 0 && videoTime > fadeOutStart) {
    return base * (1 - (videoTime - fadeOutStart) / a.fadeOutSec);
  }
  return base;
}

function renderLayer(layer: EditorLayer, h: LayerHelpers): React.ReactElement | null {
  const layerW = (layer as { width?: number }).width ?? 100;
  const layerH = (layer as { height?: number }).height ?? 100;

  // Snap threshold — 6px in canvas pixels. Aligning within this
  // distance snaps the layer + shows a guide line.
  const SNAP_PX = 6;

  // Drag bound — keep the layer's origin (x,y) at least 20px inside
  // the frame so the badge never fully disappears off-canvas. ALSO
  // snaps to alignment lines (canvas centre, canvas edges, other
  // layers' centres/edges) — visible guides live in the parent
  // canvas via onSnapUpdate.
  const dragBound = (pos: { x: number; y: number }) => {
    // Clamp inside frame.
    let x = Math.max(-layerW + 20, Math.min(pos.x, h.canvasW - 20));
    let y = Math.max(-layerH + 20, Math.min(pos.y, h.canvasH - 20));
    // Layer's edge + centre candidates.
    const layerLeft   = x;
    const layerCentre = x + layerW / 2;
    const layerRight  = x + layerW;
    const layerTop    = y;
    const layerMiddle = y + layerH / 2;
    const layerBottom = y + layerH;
    // Snap X.
    const hitsV: number[] = [];
    for (const g of h.snapVerticals) {
      if (Math.abs(layerLeft   - g) <= SNAP_PX) { x = g;               hitsV.push(g); break; }
      if (Math.abs(layerCentre - g) <= SNAP_PX) { x = g - layerW / 2;  hitsV.push(g); break; }
      if (Math.abs(layerRight  - g) <= SNAP_PX) { x = g - layerW;      hitsV.push(g); break; }
    }
    // Snap Y.
    const hitsH: number[] = [];
    for (const g of h.snapHorizontals) {
      if (Math.abs(layerTop    - g) <= SNAP_PX) { y = g;               hitsH.push(g); break; }
      if (Math.abs(layerMiddle - g) <= SNAP_PX) { y = g - layerH / 2;  hitsH.push(g); break; }
      if (Math.abs(layerBottom - g) <= SNAP_PX) { y = g - layerH;      hitsH.push(g); break; }
    }
    h.onSnapUpdate({ v: hitsV, h: hitsH });
    return { x, y };
  };

  const effectiveOpacity = liveOpacity(layer, h.videoTime);
  const common = {
    id:        layer.id,     // Konva id — Transformer uses stage.findOne(`#${id}`)
    x:         layer.x,
    y:         layer.y,
    rotation:  layer.rotation,
    opacity:   effectiveOpacity,
    draggable: true,
    onClick:   h.onToggle,
    onTap:     h.onToggle,
    dragBoundFunc: dragBound,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      h.onDragEnd(e.target.x(), e.target.y());
      // Clear snap guides on drag end.
      h.onSnapUpdate({ v: [], h: [] });
    }
  };
  if (layer.kind === "text") {
    const t = layer as TextLayer;
    const font = findFont(t.fontFamily);
    const eff  = t.effects ?? {};
    // Approximate text height for the highlight rect — Konva doesn't
    // give us a tight measurement without a font-metrics probe, so
    // we lean on 1.3× line-height convention.
    const estH = Math.round(t.fontSize * 1.3);
    // Render order matters: highlight rect BEHIND the text so the
    // text sits on top. Both share the same rotation/opacity.
    return (
      <Group
        key={layer.id}
        id={layer.id}
        x={t.x}
        y={t.y}
        rotation={t.rotation}
        opacity={common.opacity}
        draggable
        onClick={h.onToggle}
        onTap={h.onToggle}
        dragBoundFunc={dragBound}
        onDragEnd={(e) => h.onDragEnd(e.target.x(), e.target.y())}
      >
        {eff.highlight && (
          <Rect
            x={-eff.highlight.padding}
            y={-eff.highlight.padding * 0.4}
            width={t.width + eff.highlight.padding * 2}
            height={estH + eff.highlight.padding * 0.8}
            fill={eff.highlight.color}
            cornerRadius={Math.round(t.fontSize * 0.15)}
          />
        )}
        <KText
          x={0}
          y={0}
          text={t.text}
          width={t.width}
          fontSize={t.fontSize}
          fontFamily={font.cssFamily}
          fontStyle={t.fontWeight >= 700 ? "bold" : "normal"}
          fill={t.color}
          align={t.align}
          shadowColor={eff.shadow?.color}
          shadowBlur={eff.shadow?.blur ?? 0}
          shadowOffsetX={eff.shadow?.offsetX ?? 0}
          shadowOffsetY={eff.shadow?.offsetY ?? 0}
          shadowEnabled={Boolean(eff.shadow)}
          stroke={eff.outline?.color}
          strokeWidth={eff.outline?.width ?? 0}
          fillAfterStrokeEnabled  // paint the fill AFTER the stroke so
                                 // outlines don't erode letter interiors
        />
      </Group>
    );
  }
  if (layer.kind === "shape") {
    // Fill / stroke are BOTH nullable now — transparent-fill shapes
    // (outline preset) pass null so the background image bleeds
    // through. Konva reads undefined as "no fill" which matches.
    const shapeFill:   string | undefined = layer.fill   ?? undefined;
    const shapeStroke: string | undefined = layer.stroke ?? undefined;
    const shapeStrokeW: number            = layer.strokeWidth ?? 0;
    if (layer.shape === "circle") {
      return (
        <Circle
          key={layer.id}
          {...common}
          x={layer.x + layer.width / 2}
          y={layer.y + layer.height / 2}
          radius={Math.min(layer.width, layer.height) / 2}
          fill={shapeFill}
          stroke={shapeStroke}
          strokeWidth={shapeStrokeW}
        />
      );
    }
    if (layer.shape === "rect") {
      return (
        <Rect
          key={layer.id}
          {...common}
          width={layer.width}
          height={layer.height}
          fill={shapeFill}
          stroke={shapeStroke}
          strokeWidth={shapeStrokeW}
          cornerRadius={8}
        />
      );
    }
    if (layer.shape === "triangle") {
      return (
        <Line
          key={layer.id}
          {...common}
          points={[layer.width / 2, 0, layer.width, layer.height, 0, layer.height]}
          closed
          fill={shapeFill}
          stroke={shapeStroke}
          strokeWidth={shapeStrokeW}
        />
      );
    }
    if (layer.shape === "arrow") {
      // Arrows are stroke-driven — the "fill" acts as the arrow's
      // colour when solid, and stroke acts as the outline when the
      // shape is styled outline-only.
      const arrowStroke = shapeFill ?? shapeStroke ?? "#0A0A0A";
      return (
        <Line
          key={layer.id}
          {...common}
          points={[0, layer.height / 2, layer.width - 20, layer.height / 2, layer.width - 20, 0, layer.width, layer.height / 2, layer.width - 20, layer.height, layer.width - 20, layer.height / 2]}
          stroke={arrowStroke}
          strokeWidth={Math.max(4, shapeStrokeW || 6)}
          lineCap="round"
          lineJoin="round"
        />
      );
    }
    if (layer.shape === "star") {
      const points: number[] = [];
      const outerR = Math.min(layer.width, layer.height) / 2;
      const innerR = outerR * 0.5;
      const cx = layer.width / 2;
      const cy = layer.height / 2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        points.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      return (
        <Line
          key={layer.id}
          {...common}
          points={points}
          closed
          fill={shapeFill}
          stroke={shapeStroke}
          strokeWidth={shapeStrokeW}
        />
      );
    }
    return null;
  }
  if (layer.kind === "image" || layer.kind === "overlay" || layer.kind === "banner") {
    const image = h.imgFor(layer.id);
    if (!image) return null;
    return (
      <KImage
        key={layer.id}
        {...common}
        image={image}
        width={(layer as ImageLayer).width}
        height={(layer as ImageLayer).height}
      />
    );
  }
  return null;
}
