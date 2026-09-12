"use client";

// NexTalkingFace · production hologram head renderer.
//
// Stack (from Phase 33 research):
//   · Three.js r186 (installed)
//   · Three examples/jsm : GLTFLoader + EffectComposer + UnrealBloomPass + RenderPass
//   · Public bootstrap avatar: facecap.glb from Three.js official CDN
//     (same head used in threejs.org/examples/webgl_morphtargets_face.html)
//   · No external services · no signups · no license risk
//
// What it does (Option A · no lip-sync yet):
//   1. Loads facecap.glb over the wire (~1MB · Draco-compressed)
//   2. Traverses the scene, finds the SkinnedMesh with morphTargetDictionary
//   3. Swaps its material for a cyan wireframe MeshBasicMaterial —
//      morph targets keep animating because they operate on geometry
//      (per confirmed research recipe)
//   4. Idle head sway (subtle continuous yaw + pitch)
//   5. Rare natural blink via morphTargetInfluences on eyeBlink shapes
//   6. UnrealBloom post-processing for the cyan glow
//   7. Error surfacing: any failure shows a visible message
//
// Everything is dynamic-imported to avoid Turbopack chunk hang.

import { useEffect, useRef, useState } from "react";

// Public bootstrap GLB — Three.js's official face-cap head. This is
// the exact model used in the webgl_morphtargets_face demo.
const BOOTSTRAP_GLB = "https://threejs.org/examples/models/gltf/facecap.glb";

export interface NexTalkingFaceProps {
  maxWidth?: number;
  glbUrl?: string;              // override with your own RPM/VRM URL later
  cyan?: number;                // hex color, default 0x22d3ee
  bloomStrength?: number;       // default 1.2
}

export function NexTalkingFace({
  maxWidth = 560,
  glbUrl = BOOTSTRAP_GLB,
  cyan = 0x22d3ee,
  bloomStrength = 1.2,
}: NexTalkingFaceProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [stage, setStage] = useState<string>("init");
  const [error, setError] = useState<string | null>(null);

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

        // Step 1: dynamic-import three + addons (avoid chunk hang)
        setStage("loading three.js…");
        const THREE = await Promise.race([
          import("three"),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("three_timeout_10s")), 10_000)),
        ]);
        if (cancelled) return;

        setStage("loading addons…");
        const [
          { GLTFLoader },
          { KTX2Loader },
          { MeshoptDecoder },
          { EffectComposer },
          { RenderPass },
          { UnrealBloomPass },
        ] = await Promise.race([
          Promise.all([
            import("three/examples/jsm/loaders/GLTFLoader.js"),
            import("three/examples/jsm/loaders/KTX2Loader.js"),
            import("three/examples/jsm/libs/meshopt_decoder.module.js"),
            import("three/examples/jsm/postprocessing/EffectComposer.js"),
            import("three/examples/jsm/postprocessing/RenderPass.js"),
            import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
          ]),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("addons_timeout_15s")), 15_000)),
        ]) as [
          typeof import("three/examples/jsm/loaders/GLTFLoader.js"),
          typeof import("three/examples/jsm/loaders/KTX2Loader.js"),
          typeof import("three/examples/jsm/libs/meshopt_decoder.module.js"),
          typeof import("three/examples/jsm/postprocessing/EffectComposer.js"),
          typeof import("three/examples/jsm/postprocessing/RenderPass.js"),
          typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
        ];
        if (cancelled) return;

        // Step 2: wait for wrap to size
        for (let i = 0; i < 30; i++) {
          const r = wrap.getBoundingClientRect();
          if (r.width > 10 && r.height > 10) break;
          await new Promise((res) => setTimeout(res, 33));
        }
        if (cancelled) return;
        const rect = wrap.getBoundingClientRect();
        const w = Math.max(64, rect.width);
        const h = Math.max(64, rect.height);

        // Step 3: renderer + scene + camera
        setStage("initialising renderer…");
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h, false);
        renderer.setClearColor(0x000000, 1);
        disposables.push(renderer);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        const camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 100);
        // Initial camera position · will be re-fit to the model's bounds
        // after the GLB loads so any avatar size works out of the box.
        camera.position.set(0, 0, 1);
        camera.lookAt(0, 0, 0);

        // Step 4: load the GLB · with KTX2 + Meshopt support
        setStage("loading avatar…");
        const ktx2 = new KTX2Loader()
          .setTranscoderPath("https://unpkg.com/three@0.186.0/examples/jsm/libs/basis/")
          .detectSupport(renderer);
        disposables.push(ktx2);
        const loader = new GLTFLoader();
        loader.setKTX2Loader(ktx2);
        loader.setMeshoptDecoder(MeshoptDecoder as unknown as import("three/examples/jsm/loaders/GLTFLoader.js").GLTFLoaderPlugin & { decodeGltfBuffer?: unknown });
        const gltf = await new Promise<import("three/examples/jsm/loaders/GLTFLoader.js").GLTF>((resolve, reject) => {
          loader.load(
            glbUrl,
            resolve,
            undefined,
            (e) => reject(new Error(`glb_load_failed: ${e instanceof ErrorEvent ? e.message : (e as Error).message ?? "unknown"}`)),
          );
        });
        if (cancelled) return;

        // Step 5: apply hologram · nearly-invisible base + edges overlay
        setStage("applying hologram shader…");
        // Base mesh: dark and translucent so it holds volume without
        // painting solid colour. Bloom will pick up the edges, not this.
        const baseMat = new THREE.MeshBasicMaterial({
          color: 0x001a24,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        });
        disposables.push(baseMat);
        // Edge overlay material: bright cyan lines drawn as LineSegments.
        // This is what visually reads as the wireframe.
        const edgeMat = new THREE.LineBasicMaterial({
          color: cyan,
          transparent: true,
          opacity: 0.9,
        });
        disposables.push(edgeMat);

        const blinkTargets: Array<{ mesh: import("three").Mesh; indexL: number; indexR: number }> = [];
        const edgeOverlays: import("three").LineSegments[] = [];
        gltf.scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.material = baseMat;
            // Cleaner topology than raw triangles: EdgesGeometry only
            // includes edges where the angle between adjacent faces
            // exceeds the threshold (20° here). Reads as a proper
            // wireframe, not a triangulated mess.
            const edges = new THREE.EdgesGeometry(obj.geometry as import("three").BufferGeometry, 20);
            disposables.push(edges);
            const line = new THREE.LineSegments(edges, edgeMat);
            // Parent to the mesh so blink + head sway carry the edges.
            obj.add(line);
            edgeOverlays.push(line);
            const dict = obj.morphTargetDictionary;
            if (dict) {
              const idxL = dict.eyeBlinkLeft ?? dict.eyeBlink_L ?? -1;
              const idxR = dict.eyeBlinkRight ?? dict.eyeBlink_R ?? -1;
              if (idxL >= 0 && idxR >= 0) blinkTargets.push({ mesh: obj, indexL: idxL, indexR: idxR });
            }
          }
        });
        scene.add(gltf.scene);

        // Auto-fit camera to the loaded model's bounding box · works for
        // any GLB (facecap, RPM, VRM) regardless of scale/units.
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        // Head-centric framing: focus a bit above the geometric centre
        // so the eyes sit around the middle of the frame instead of the
        // chin. Shift down 15% of height so we see forehead → chin.
        const focus = new THREE.Vector3(center.x, center.y + size.y * 0.15, center.z);
        // Distance so the model fits with ~15% padding
        const maxDim = Math.max(size.x, size.y * 1.05);
        const fov = (camera.fov * Math.PI) / 180;
        const dist = (maxDim / 2) / Math.tan(fov / 2) * 1.35;
        camera.position.set(focus.x, focus.y, focus.z + dist);
        camera.lookAt(focus);
        camera.near = dist / 100;
        camera.far  = dist * 100;
        camera.updateProjectionMatrix();
        gltf.scene.rotation.set(0, 0, 0);

        // Optional additional edge overlay for extra "wireframe" density
        // (kept off in bootstrap · enable later for richer aesthetic)

        // Step 6: post-processing
        setStage("wiring bloom…");
        composer = new EffectComposer(renderer);
        composer.setSize(w, h);
        composer.addPass(new RenderPass(scene, camera));
        // Calmer bloom · threshold pushed high so only the bright cyan
        // edges glow, not the base mesh.
        const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), bloomStrength * 0.55, 0.45, 0.65);
        composer.addPass(bloom);

        // Resize
        const applySize = () => {
          const r = wrap.getBoundingClientRect();
          const nw = Math.max(64, r.width);
          const nh = Math.max(64, r.height);
          renderer.setSize(nw, nh, false);
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          composer?.setSize(nw, nh);
        };
        ro = new ResizeObserver(applySize);
        ro.observe(wrap);

        // Step 7: kick off animation loop
        if (cancelled) return;
        setState("ready");

        // Blink scheduler · rare + natural
        let nextBlinkAt = performance.now() + 3500 + Math.random() * 4000;
        let blinkActive = false;
        let blinkStart = 0;

        const t0 = performance.now();
        const tick = () => {
          if (cancelled) return;
          const now = performance.now();
          const t = (now - t0) / 1000;

          // Idle head sway · sub-degree, calming
          gltf.scene.rotation.y = 0.05 * Math.sin(t * 0.35);
          gltf.scene.rotation.x = 0.02 * Math.sin(t * 0.27);

          // Rare natural blink
          if (!blinkActive && now >= nextBlinkAt) {
            blinkActive = true;
            blinkStart = now;
          }
          if (blinkActive) {
            const dt = (now - blinkStart) / 160;   // 160ms full blink
            const phase = dt < 0.5 ? dt * 2 : (1 - dt) * 2;
            const v = Math.max(0, Math.min(1, phase));
            for (const b of blinkTargets) {
              const inf = b.mesh.morphTargetInfluences;
              if (inf) {
                inf[b.indexL] = v;
                inf[b.indexR] = v;
              }
            }
            if (dt >= 1) {
              blinkActive = false;
              for (const b of blinkTargets) {
                const inf = b.mesh.morphTargetInfluences;
                if (inf) {
                  inf[b.indexL] = 0;
                  inf[b.indexR] = 0;
                }
              }
              nextBlinkAt = now + 4200 + Math.random() * 5000;
            }
          }

          composer?.render();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        // eslint-disable-next-line no-console
        console.error("[NexTalkingFace] init failed:", e);
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
  }, [glbUrl, cyan, bloomStrength]);

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
    <div ref={wrapRef} style={wrapStyle} data-nex-talking-face="true">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", background: "#000000" }}
      />
      {state === "loading" && (
        <div style={overlayStyle}>
          <div>Preparing hologram…</div>
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
    </div>
  );
}
