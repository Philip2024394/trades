"use client";

// NexHolographicFace3D · production WebGL particle renderer.
//
// Runtime rule (Founder Doctrine · Phase 32):
//   Reference PNG is NEVER loaded at runtime.
//   No <img>, no CSS background, no texture, no overlay of the source
//   image. The face is generated ENTIRELY from `face-points.json` +
//   `face-contour.json` produced by scripts/generate-face-points.mjs.
//
// three.js is dynamic-imported INSIDE the useEffect so a resolve
// failure at bundle load time cannot crash the whole page render.
// Any error at any step surfaces visibly on the page.

import { useEffect, useRef, useState } from "react";

type ThreeModule = typeof import("three");

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
varying float vBrightness;

vec3 mod289v3(vec3 x)  { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289v2(vec2 x)  { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x)   { return mod289v3(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289v2(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                          + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec3 pos = position;
  float t = uTime * 0.18;
  float nx = snoise(pos.xy * 2.8 + vec2(t,        0.0)) * 0.006;
  float ny = snoise(pos.xy * 2.8 + vec2(0.0,       t)) * 0.006;
  float nz = snoise(pos.xy * 2.2 + vec2(t * 1.3, 5.7)) * 0.018;
  pos.x += nx;
  pos.y += ny;
  pos.z += nz;
  float wave    = snoise(pos.xy * 1.6 + vec2(0.0, uTime * 0.25));
  float energy  = 0.60 + 0.40 * wave;
  float shimmer = 0.75 + 0.25 * sin(uTime * 1.35 + aPhase * 6.2831);
  vBrightness   = aBrightness * energy * shimmer;
  vec4 mvPos    = modelViewMatrix * vec4(pos, 1.0);
  gl_Position   = projectionMatrix * mvPos;
  gl_PointSize  = aSize * uPixelRatio * (280.0 / -mvPos.z);
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
varying float vBrightness;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float glow = smoothstep(0.5, 0.12, d);
  float a    = (core * 0.9 + glow * 0.25) * vBrightness;
  vec3 base  = vec3(0.13, 0.82, 0.93);
  vec3 hot   = vec3(0.72, 0.99, 1.00);
  vec3 col   = mix(base, hot, core);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}
`;

const CONTOUR_VERT = /* glsl */ `
attribute float aT;
uniform float uTime;
varying float vHighlight;
void main() {
  float head = fract(uTime * 0.11);
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
  gl_FragColor = vec4(mix(base, hot, vHighlight), 0.55 + 0.45 * vHighlight);
}
`;

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════
export interface NexHolographicFace3DProps {
  maxWidth?: number;
  className?: string;
}

export function NexHolographicFace3D({ maxWidth = 560, className }: NexHolographicFace3DProps) {
  const wrapRef   = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ points: number; contour: number } | null>(null);
  const [stage, setStage] = useState<string>("init");

  // Diagnostic probe: fires immediately on mount, isolated from any
  // Three.js work. If we see "probe-fired" but not "loading three.js…",
  // useEffect works but the async init is what hangs.
  useEffect(() => {
    setStage("probe-fired");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let ro: ResizeObserver | null = null;
    const disposables: Array<{ dispose?: () => void }> = [];

    (async () => {
      try {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) throw new Error("mount_missing");

        // 1. Load three dynamically · race with a 10s timeout so a
        //    hanging Turbopack chunk surfaces visibly instead of
        //    leaving us stuck on "Loading…".
        setStage("loading three.js…");
        let THREE: ThreeModule;
        try {
          THREE = await Promise.race([
            import("three"),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("three_import_timeout_10s")), 10_000)),
          ]) as ThreeModule;
        } catch (e) {
          throw new Error(`three_import_failed: ${e instanceof Error ? e.message : e}`);
        }
        if (cancelled) return;

        // 2. Fetch geometry
        setStage("fetching point data…");
        const [rp, rc] = await Promise.all([
          fetch(POINTS_URL,  { cache: "force-cache" }),
          fetch(CONTOUR_URL, { cache: "force-cache" }),
        ]);
        if (!rp.ok) throw new Error(`points_http_${rp.status}`);
        if (!rc.ok) throw new Error(`contour_http_${rc.status}`);
        const pointsData:  { points:  FacePoint[]    } = await rp.json();
        const contourData: { contour: ContourPoint[] } = await rc.json();
        if (cancelled) return;
        setStage("building scene…");

        // 3. Wait for wrap to have real dimensions
        for (let tries = 0; tries < 30; tries++) {
          const r = wrap.getBoundingClientRect();
          if (r.width > 10 && r.height > 10) break;
          await new Promise((r) => setTimeout(r, 33));
        }
        if (cancelled) return;
        const rect = wrap.getBoundingClientRect();
        const width  = Math.max(64, rect.width);
        const height = Math.max(64, rect.height);

        // 4. WebGL context probe
        const glProbe =
          canvas.getContext("webgl2") ||
          canvas.getContext("webgl") ||
          canvas.getContext("experimental-webgl" as "webgl");
        if (!glProbe) throw new Error("webgl_not_supported_by_browser");

        // 5. Renderer
        renderer = new THREE.WebGLRenderer({
          canvas, antialias: true, alpha: false,
          powerPreference: "high-performance",
        });
        renderer.setClearColor(0x000000, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);

        // 6. Scene + camera
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, width / height, 0.01, 100);
        camera.position.set(0, 0, 2.35);
        camera.lookAt(0, 0, 0);

        // 7. Points geometry
        const points = pointsData.points;
        const N = points.length;
        if (N === 0) throw new Error("no_points_in_dataset");
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
          },
          vertexShader:   POINT_VERT,
          fragmentShader: POINT_FRAG,
          transparent: true,
          depthWrite:  false,
          blending:    THREE.AdditiveBlending,
        });
        disposables.push(pmat);
        scene.add(new THREE.Points(pgeo, pmat));

        // 8. Contour (Line, not LineLoop, for broader compat)
        let cmat: import("three").ShaderMaterial | null = null;
        const contour = contourData.contour;
        if (contour.length >= 4) {
          const M = contour.length;
          const cpos = new Float32Array((M + 1) * 3);
          const cT   = new Float32Array((M + 1));
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

        // 9. HUD corner brackets
        const bmat = new THREE.LineBasicMaterial({
          color: 0x22d3ee, transparent: true, opacity: 0.85, depthWrite: false,
        });
        disposables.push(bmat);
        const bOff = 0.86, bOffY = 1.02, bLen = 0.14;
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

        // 10. Resize
        const applySize = () => {
          if (!renderer || !wrap) return;
          const r = wrap.getBoundingClientRect();
          const w = Math.max(64, r.width);
          const h = Math.max(64, r.height);
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          pmat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
        };
        ro = new ResizeObserver(applySize);
        ro.observe(wrap);

        // 11. Kick off
        if (cancelled) return;
        setStats({ points: N, contour: contour.length });
        setState("ready");

        const t0 = performance.now();
        const tick = () => {
          if (cancelled || !renderer) return;
          const t = (performance.now() - t0) / 1000;
          pmat.uniforms.uTime.value = t;
          if (cmat) cmat.uniforms.uTime.value = t;
          bmat.opacity = 0.65 + 0.30 * Math.sin(t * 1.1);
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        // eslint-disable-next-line no-console
        console.error("[NexHolographicFace3D] init failed:", e);
        setError(msg);
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      for (const d of disposables) { try { d.dispose?.(); } catch { /* ignore */ } }
      try { renderer?.dispose(); } catch { /* ignore */ }
    };
  }, []);

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
  };

  return (
    <div ref={wrapRef} className={className} style={wrapStyle}
         data-nex-holo-face-3d="true" aria-label="NEX holographic face">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", background: "#000000" }}
        data-nex-holo-canvas="true"
      />
      {state === "loading" && (
        <div style={{ ...overlayStyle, flexDirection: "column", gap: 8 }}>
          <div>Loading point cloud…</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#22d3ee" }}>
            {stage}
          </div>
        </div>
      )}
      {state === "error" && (
        <div style={{ ...overlayStyle, color: "#fca5a5", flexDirection: "column" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Renderer error</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, wordBreak: "break-word", maxWidth: "90%" }}>
            {error}
          </div>
        </div>
      )}
      {stats && (
        <div style={{
          position: "absolute", left: 10, bottom: 8,
          color: "rgba(125,211,252,0.55)", fontSize: 10,
          letterSpacing: "0.08em", fontFamily: "monospace",
          pointerEvents: "none",
        }} data-nex-holo-stats="true">
          {stats.points.toLocaleString()} particles · {stats.contour} contour
        </div>
      )}
    </div>
  );
}
