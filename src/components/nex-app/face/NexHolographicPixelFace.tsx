"use client";

// NexHolographicPixelFace · pixel-perfect reconstruction of the reference.
//
// Uses the SAME defensive dynamic-import pattern that made NexTalkingFace
// finally work. Zero risk of a hang: every dynamic step has a visible
// stage label and a timeout.
//
// Pipeline:
//   build-time · scripts/generate-face-points.mjs
//                    ↓ reference PNG → cyan-pixel sample
//   public/nex/face-points.json  (~28k points · x,y,z,brightness,phase,size)
//   public/nex/face-contour.json (~214 vertices)
//                    ↓
//   runtime   · this component (WebGL Points · GLSL shader animation)
//
// Runtime rule: reference PNG is never loaded here.

import { useEffect, useRef, useState } from "react";

const POINTS_URL  = "/nex/face-points.json";
const CONTOUR_URL = "/nex/face-contour.json";

type FacePoint    = { x: number; y: number; z: number; b: number; p: number; s: number };
type ContourPoint = { x: number; y: number };

const POINT_VERT = /* glsl */ `
attribute float aPhase;
attribute float aBrightness;
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSmile;   // 0 = neutral · 1 = full smile
varying float vBrightness;
varying float vSmileGlow;

// Smile deformation — rebuild the lower face as a curved arc.
// mouthMask isolates points in the mouth band; cheekMask covers the
// zone just above where cheeks pull up during a real smile.
vec3 applySmile(vec3 p, float amount) {
  // Mouth centre in the reference · x=0 y=-0.15 (below face centre)
  float mouthCY = -0.15;
  float dy      = p.y - mouthCY;
  float ax      = abs(p.x);

  // Vertical proximity to the mouth line (falls off above / below)
  float bandY   = smoothstep(0.22, 0.02, abs(dy));
  // Horizontal extent — full inside face, zero beyond cheek line
  float bandX   = smoothstep(0.42, 0.08, ax);
  float mouthMask = bandY * bandX;

  // Parabolic lift · corners rise faster than centre
  float lift = amount * mouthMask * (0.14 * p.x * p.x + 0.02);
  // Slight centre drop so the middle of the lip stays anchored
  lift -= amount * mouthMask * 0.008 * (1.0 - smoothstep(0.02, 0.20, ax));

  // Cheek raise — points just above the mouth get pulled up + out
  float cheekBand = smoothstep(0.08, 0.30, dy) * smoothstep(0.55, 0.15, ax);
  float cheekLift = amount * cheekBand * 0.030;

  p.y += lift + cheekLift;
  // Corners also shift outward a hair for width
  p.x += amount * mouthMask * sign(p.x) * 0.012 * smoothstep(0.05, 0.28, ax);

  vSmileGlow = clamp((mouthMask + cheekBand) * amount, 0.0, 1.0);
  return p;
}

void main() {
  vec3 pos = position;

  // Smile · deforms mouth + cheek region
  pos = applySmile(pos, uSmile);

  // Subtle per-particle wobble so the face reads as continuously
  // rendered rather than a static plot.
  float wobble = 0.0015 * sin(uTime * 1.3 + aPhase * 6.28);
  pos.x += wobble * cos(aPhase * 3.14);
  pos.y += wobble * sin(aPhase * 3.14);

  // Slow energy wave up the face
  float wave = sin(pos.y * 3.0 + uTime * 0.4);
  float energy = 0.65 + 0.35 * wave * 0.5;

  // Per-particle shimmer
  float shimmer = 0.80 + 0.20 * sin(uTime * 1.6 + aPhase * 6.28);

  // Smile brightens the affected zone so the expression reads clearly
  float smileBoost = 1.0 + 0.55 * vSmileGlow;

  vBrightness = aBrightness * energy * shimmer * smileBoost;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPixelRatio * 1.9 * (0.9 + 0.3 * shimmer) * (1.0 + 0.35 * vSmileGlow);
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
varying float vBrightness;
varying float vSmileGlow;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float glow = smoothstep(0.5, 0.10, d);
  float a = (core * 0.95 + glow * 0.25) * vBrightness;
  vec3 base = vec3(0.13, 0.82, 0.93);
  vec3 hot  = vec3(0.72, 0.99, 1.00);
  // Smile tint · slight warm-cyan lift on the affected band
  vec3 warm = vec3(0.42, 0.98, 1.00);
  vec3 col  = mix(base, hot, core);
  col       = mix(col,  warm, vSmileGlow * 0.55);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const CONTOUR_VERT = /* glsl */ `
attribute float aT;
uniform float uTime;
varying float vHighlight;
void main() {
  float head = fract(uTime * 0.09);
  float d = abs(fract(aT - head + 0.5) - 0.5);
  vHighlight = smoothstep(0.15, 0.0, d);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const CONTOUR_FRAG = /* glsl */ `
precision highp float;
varying float vHighlight;
void main() {
  vec3 base = vec3(0.13, 0.82, 0.93);
  vec3 hot  = vec3(0.75, 1.00, 1.00);
  gl_FragColor = vec4(mix(base, hot, vHighlight), 0.60 + 0.40 * vHighlight);
}
`;

export interface NexHolographicPixelFaceProps {
  maxWidth?: number;
  bloomStrength?: number;
  /** Smile intensity · 0 = neutral, 1 = full grin. Default 0.9. */
  smile?: number;
  /** Add a gentle breathing pulse to the smile so it feels alive. */
  smileBreathing?: boolean;
}

export function NexHolographicPixelFace({
  maxWidth = 560,
  bloomStrength = 0.9,
  smile = 0.9,
  smileBreathing = true,
}: NexHolographicPixelFaceProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smileRef = useRef<number>(smile);
  const smileBreathingRef = useRef<boolean>(smileBreathing);
  smileRef.current = smile;
  smileBreathingRef.current = smileBreathing;
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [stage, setStage] = useState<string>("init");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ points: number; contour: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let composer: import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer | null = null;
    let ro: ResizeObserver | null = null;
    const disposables: Array<{ dispose?: () => void }> = [];

    (async () => {
      try {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) throw new Error("mount_missing");

        setStage("loading three.js…");
        const THREE = await Promise.race([
          import("three"),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("three_timeout_10s")), 10_000)),
        ]);
        if (cancelled) return;

        setStage("loading addons…");
        const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] =
          await Promise.race([
            Promise.all([
              import("three/examples/jsm/postprocessing/EffectComposer.js"),
              import("three/examples/jsm/postprocessing/RenderPass.js"),
              import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
            ]),
            new Promise<never>((_, r) => setTimeout(() => r(new Error("addons_timeout_15s")), 15_000)),
          ]) as [
            typeof import("three/examples/jsm/postprocessing/EffectComposer.js"),
            typeof import("three/examples/jsm/postprocessing/RenderPass.js"),
            typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
          ];
        if (cancelled) return;

        setStage("fetching pixel data…");
        const [rp, rc] = await Promise.all([
          fetch(POINTS_URL,  { cache: "force-cache" }),
          fetch(CONTOUR_URL, { cache: "force-cache" }),
        ]);
        if (!rp.ok) throw new Error(`points_http_${rp.status}`);
        if (!rc.ok) throw new Error(`contour_http_${rc.status}`);
        const pointsData:  { points:  FacePoint[]    } = await rp.json();
        const contourData: { contour: ContourPoint[] } = await rc.json();
        if (cancelled) return;

        // Wait for wrap dimensions
        for (let i = 0; i < 30; i++) {
          const r = wrap.getBoundingClientRect();
          if (r.width > 10 && r.height > 10) break;
          await new Promise((res) => setTimeout(res, 33));
        }
        if (cancelled) return;
        const rect = wrap.getBoundingClientRect();
        const w = Math.max(64, rect.width);
        const h = Math.max(64, rect.height);

        setStage("initialising renderer…");
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.setClearColor(0x000000, 1);
        disposables.push(renderer);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // Orthographic-ish framing: fit the [-1..1] point range with padding
        const aspect = w / h;
        const camera = new THREE.PerspectiveCamera(22, aspect, 0.01, 100);
        camera.position.set(0, 0, 5.6);
        camera.lookAt(0, 0, 0);

        setStage("building buffers…");
        const points = pointsData.points;
        const N = points.length;
        if (N === 0) throw new Error("no_points");
        const positions = new Float32Array(N * 3);
        const phases    = new Float32Array(N);
        const brights   = new Float32Array(N);
        const sizes     = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          positions[i * 3    ] = points[i].x;
          positions[i * 3 + 1] = points[i].y;
          positions[i * 3 + 2] = points[i].z;
          phases[i]  = points[i].p;
          brights[i] = points[i].b;
          sizes[i]   = points[i].s;
        }
        const pgeo = new THREE.BufferGeometry();
        pgeo.setAttribute("position",    new THREE.BufferAttribute(positions, 3));
        pgeo.setAttribute("aPhase",      new THREE.BufferAttribute(phases,    1));
        pgeo.setAttribute("aBrightness", new THREE.BufferAttribute(brights,   1));
        pgeo.setAttribute("aSize",       new THREE.BufferAttribute(sizes,     1));
        disposables.push(pgeo);

        const pmat = new THREE.ShaderMaterial({
          uniforms: {
            uTime:       { value: 0 },
            uPixelRatio: { value: renderer.getPixelRatio() },
            uSmile:      { value: 0 },
          },
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          transparent: true,
          depthWrite:  false,
          blending:    THREE.AdditiveBlending,
        });
        disposables.push(pmat);
        scene.add(new THREE.Points(pgeo, pmat));

        // Contour line
        let cmat: import("three").ShaderMaterial | null = null;
        const contour = contourData.contour;
        if (contour.length >= 4) {
          const M = contour.length;
          const cpos = new Float32Array((M + 1) * 3);
          const cT   = new Float32Array(M + 1);
          for (let i = 0; i < M; i++) {
            cpos[i * 3    ] = contour[i].x;
            cpos[i * 3 + 1] = contour[i].y;
            cpos[i * 3 + 2] = -0.02;
            cT[i] = i / M;
          }
          cpos[M * 3    ] = contour[0].x;
          cpos[M * 3 + 1] = contour[0].y;
          cpos[M * 3 + 2] = -0.02;
          cT[M] = 1;
          const cgeo = new THREE.BufferGeometry();
          cgeo.setAttribute("position", new THREE.BufferAttribute(cpos, 3));
          cgeo.setAttribute("aT",       new THREE.BufferAttribute(cT,   1));
          disposables.push(cgeo);
          cmat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader:   CONTOUR_VERT,
            fragmentShader: CONTOUR_FRAG,
            transparent: true,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
          });
          disposables.push(cmat);
          scene.add(new THREE.Line(cgeo, cmat));
        }

        // HUD corner brackets (code geometry — not from image)
        const bmat = new THREE.LineBasicMaterial({
          color: 0x22d3ee, transparent: true, opacity: 0.85, depthWrite: false,
        });
        disposables.push(bmat);
        const bOff = 0.90, bOffY = 1.08, bLen = 0.14;
        for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const) {
          const bg = new THREE.BufferGeometry();
          const v = new Float32Array([
            sx * bOff,             sy * bOffY,             0,
            sx * bOff - sx * bLen, sy * bOffY,             0,
            sx * bOff,             sy * bOffY,             0,
            sx * bOff,             sy * bOffY - sy * bLen, 0,
          ]);
          bg.setAttribute("position", new THREE.BufferAttribute(v, 3));
          disposables.push(bg);
          scene.add(new THREE.LineSegments(bg, bmat));
        }

        setStage("wiring bloom…");
        composer = new EffectComposer(renderer);
        composer.setSize(w, h);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), bloomStrength, 0.55, 0.10));

        const applySize = () => {
          const r = wrap.getBoundingClientRect();
          const nw = Math.max(64, r.width);
          const nh = Math.max(64, r.height);
          renderer.setSize(nw, nh, false);
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          composer?.setSize(nw, nh);
          pmat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        };
        ro = new ResizeObserver(applySize);
        ro.observe(wrap);

        if (cancelled) return;
        setStats({ points: N, contour: contour.length });
        setState("ready");

        const t0 = performance.now();
        const tick = () => {
          if (cancelled) return;
          const t = (performance.now() - t0) / 1000;
          pmat.uniforms.uTime.value = t;
          if (cmat) cmat.uniforms.uTime.value = t;
          bmat.opacity = 0.65 + 0.30 * Math.sin(t * 1.0);

          // Read smile props live via refs so changes don't restart WebGL.
          const smileTarget = Math.max(0, Math.min(1, smileRef.current));
          const easeIn = Math.min(1, t / 1.6);
          const easedIn = easeIn * easeIn * (3 - 2 * easeIn);
          const breath = smileBreathingRef.current ? (0.85 + 0.15 * Math.sin(t * 0.7)) : 1.0;
          pmat.uniforms.uSmile.value = smileTarget * easedIn * breath;

          composer?.render();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        // eslint-disable-next-line no-console
        console.error("[NexHolographicPixelFace] init failed:", e);
        setError(msg);
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      for (const d of disposables) { try { d.dispose?.(); } catch { /* ignore */ } }
    };
  }, [bloomStrength]);

  const wrapStyle: React.CSSProperties = {
    position: "relative",
    width: `min(${maxWidth}px, 92vw)`,
    aspectRatio: "3 / 4",
    margin: "0 auto",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 40px 90px rgba(0,0,0,0.6)",
    background: "#000000",
    isolation: "isolate",
  };
  const overlayStyle: React.CSSProperties = {
    position: "absolute", inset: 0, display: "grid", placeItems: "center",
    color: "#7dd3fc", fontSize: 13, letterSpacing: "0.08em",
    padding: "0 1rem", textAlign: "center", pointerEvents: "none",
    flexDirection: "column", gap: 8,
  };

  return (
    <div ref={wrapRef} style={wrapStyle} data-nex-pixel-face="true">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", background: "#000000" }}
      />
      {state === "loading" && (
        <div style={overlayStyle}>
          <div>Reconstructing from pixels…</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#22d3ee" }}>{stage}</div>
        </div>
      )}
      {state === "error" && (
        <div style={{ ...overlayStyle, color: "#fca5a5" }}>
          <div style={{ fontWeight: 700 }}>Renderer error</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-word", maxWidth: "90%" }}>
            {error}
          </div>
        </div>
      )}
      {stats && (
        <div style={{
          position: "absolute", left: 10, bottom: 8,
          color: "rgba(125,211,252,0.55)", fontSize: 10,
          letterSpacing: "0.08em", fontFamily: "monospace", pointerEvents: "none",
        }}>
          {stats.points.toLocaleString()} pixels · {stats.contour} contour
        </div>
      )}
    </div>
  );
}
