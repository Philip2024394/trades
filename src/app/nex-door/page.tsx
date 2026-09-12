// NEX Door · UI-only prototype · Philip 2026-08-28.
//
// DOCTRINE (Philip 2026-08-28 · LOCKED):
//   · The metal door IS the physical authentication metaphor.
//   · Button label = "KNOCK TO ENTER" (EN) · "KETUK PINTU" (ID) · not
//     "REQUEST ACCESS" — knocking is universal + tactile + magical.
//   · TWO-TIER IDENTITY:
//       #NEXID   = permanent number, auto-assigned at signup (never expires)
//       @NEXNAME = optional vanity name, claimed LATER inside profile
//     Removes handle-collision friction at signup. Foundation for future
//     name-marketplace (premium/short/business names).
//   · Signup requires only PHOTO + NAME. City optional. Address later if a
//     feature actually needs it.
//   · Never expose phone number as public identity (auth/recovery only).
//   · FIRST VISIT is theatrical (introduction moment).
//   · RETURNING VISIT is near-instant (~800ms door open). Magic in the
//     transition, not a 5-second cinematic every time.
//
// UI-only prototype · all auth is FAKE. Profile persisted to localStorage
// so returning-user flow can be tested. Real WebAuthn/passkey + phone
// verification + password recovery + monetized name-claim come later.

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  BEZEL_ASPECT_RATIO,
  BEZEL_METAL,
  NEX_INNER_VIEWPORT_CSS,
  NEX_FRAME_INNER_ROOM,
} from "@/components/nexapp/hud/geometry";
import { NexVoiceOrb, type OrbLookDirection } from "@/components/nexapp/NexVoiceOrb";
import { FaceDetector, FilesetResolver, type Detection } from "@mediapipe/tasks-vision";
import {
  useNexIdentity,
  DEFAULT_COUNTRY_CODE,
  findCountry,
} from "@/lib/nex-identity";

const PROFILE_KEY = "nex-door-profile";

interface NexProfile {
  nexId:    string;   // "#00482173" · permanent · auto-assigned at signup
  photo?:   string;   // data URL from FileReader
  name:     string;   // "Philip"
  nexName?: string;   // "@philip" · optional vanity name · claimed LATER
  city?:    string;   // optional
}

type Phase =
  | "closed"           // door shut · shows KNOCK button or returning identity
  | "knocking"         // brief animation · door responds to knock
  | "auth-form"        // phone/email + verification code
  | "unlocking"        // brief · locks disengage
  | "profile"          // photo + name (+ optional city)
  | "id-reveal"        // ceremony · ACCESS GRANTED → YOUR NEX ID → #number → subtitle
  | "opening"          // door slides down
  | "face-scan"        // returning · biometric fake scan
  | "password-fallback"; // returning · use password fallback

// Generate a permanent NEX ID number. Prototype uses random 7-digit ·
// no `#` prefix (Philip 2026-08-28 · "Hi nexid 3739393" format).
function generateNexId(): string {
  const n = Math.floor(1_000_000 + Math.random() * 9_000_000);
  return String(n);
}
// Display helper · strips any legacy `#` prefix from stored IDs.
function displayId(raw: string): string {
  return raw.startsWith("#") ? raw.slice(1) : raw;
}

// Philip 2026-08-29 · name normaliser · every name must render with a
// capital first letter of every word ("philip" → "Philip", "philip john"
// → "Philip John"). Applied on display + on save so legacy records with
// lowercase names appear correctly without a data migration and new
// records are persisted in the correct case. Preserves interior
// capitalisation (McDonald, O'Brien) by only touching character 0 of
// each whitespace-separated word.
function capitalizeName(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .filter(Boolean)
    .join(" ");
}

export default function NexDoorPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("closed");
  const [existingProfile, setExistingProfile] = useState<NexProfile | null>(null);
  // Canonical identity bridge · Philip 2026-08-29 · STEP 1.
  // /nex-door historically wrote only to nex-door-profile · useNexIdentity
  // reads from nex.identity · so a user could complete GRANT ACCESS and
  // arrive at /nexapp still classified as "onboarding". The bridge writes
  // to BOTH storages · nex.identity becomes the canonical source of truth
  // consumed by useNexIdentity + useNexActivation. nex-door-profile is
  // kept for backward compatibility.
  const identity = useNexIdentity();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) setExistingProfile(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Footer clock · Philip 2026-08-29. Live wall-clock time rendered
  // over the frame's composer field area (see LAYER 25). Format HH:MM
  // (24h) updated once per second. SSR seeds with empty string so we
  // don't hydrate a mismatched value · the effect fills it on mount.
  const [nowClock, setNowClock] = useState("");
  useEffect(() => {
    function tick() {
      const d = new Date();
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      setNowClock(`${h}:${m}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Side-lightning scheduler moved BELOW scanActive declaration
  // (search "SCAN BEAM SCHEDULER" below).

  // NEX EYE TRACKING · Philip 2026-08-29.
  // Landing orb follows the pointer (mouse on desktop, touch on mobile).
  // pointermove events are throttled to one rAF tick so state changes
  // are cheap. Direction is discrete (9 look targets) so the pupil only
  // re-transitions when the pointer crosses a 45° slice boundary.
  const centerOrbRef = useRef<HTMLDivElement | null>(null);
  const [orbLook, setOrbLook] = useState<OrbLookDirection | null>(null);
  useEffect(() => {
    let rafId: number | null = null;
    let latest: { x: number; y: number } | null = null;

    /** Map (dx, dy) from orb centre to one of 9 look directions.
     *  Screen coords · dy positive = down. Dead zone <18px reads as
     *  "centre" so the pupil rests when the pointer is on the orb. */
    function pickDirection(dx: number, dy: number): OrbLookDirection {
      const dist = Math.hypot(dx, dy);
      if (dist < 18) return "center";
      const deg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      if (deg < 22.5 || deg >= 337.5) return "right";
      if (deg < 67.5)                 return "down-right";
      if (deg < 112.5)                return "down";
      if (deg < 157.5)                return "down-left";
      if (deg < 202.5)                return "left";
      if (deg < 247.5)                return "up-left";
      if (deg < 292.5)                return "up";
      return "up-right";
    }

    function commit() {
      rafId = null;
      const el = centerOrbRef.current;
      if (!el || !latest) return;
      const rect = el.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const next = pickDirection(latest.x - cx, latest.y - cy);
      setOrbLook((prev) => (prev === next ? prev : next));
    }

    function onMove(e: PointerEvent) {
      latest = { x: e.clientX, y: e.clientY };
      if (rafId === null) rafId = requestAnimationFrame(commit);
    }
    // Pointer leaving the window · release the gaze back to centre so
    // the orb doesn't stay staring at the last edge position forever.
    function onLeave() {
      latest = null;
      setOrbLook(null);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("blur", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("blur", onLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Philip 2026-08-29 · door descent slowed 2× for a more deliberate,
  // premium reveal. First-visit door opening is theatrical (3200ms).
  // Returning is still fast but noticeable (1600ms).
  const openDurationMs = existingProfile ? 1600 : 3200;

  // ── Knock interaction ────────────────────────────────────────────────
  const [knockCount, setKnockCount] = useState(0);
  function handleKnock() {
    setPhase("knocking");
    setKnockCount((n) => n + 1);
    // Brief knock feedback then reveal auth form
    setTimeout(() => setPhase("auth-form"), 600);
  }

  // ── Auth form state ────────────────────────────────────────────────
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  function handleSendCode() {
    // DEV MODE (Philip 2026-08-28): no input guards · button just works.
    // Re-add `if (!contact.trim()) return;` before ship.
    setCodeSent(true);
  }
  function handleVerifyCode() {
    // DEV MODE: no code length check · re-add `if (code.trim().length < 4) return;` before ship.
    setPhase("unlocking");
    setTimeout(() => setPhase("profile"), 900);
  }

  // ── Profile form (photo + name + optional city) ────────────────────
  const [profile, setProfile] = useState<Omit<NexProfile, "nexId">>({
    photo: undefined, name: "", city: "",
  });
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, photo: reader.result as string }));
    reader.readAsDataURL(file);
  }

  const [assignedId, setAssignedId] = useState<string | null>(null);
  function handleGrantAccess() {
    // DEV MODE (Philip 2026-08-28): no name requirement · button just works.
    // Re-add `if (!profile.name.trim()) return;` before ship.
    const nexId = generateNexId();
    // Philip 2026-08-29 · normalise capitalisation before persist so
    // "philip" → "Philip" and "philip john" → "Philip John" get stored
    // in the canonical case (both this scoped store + nex.identity).
    const finalProfile: NexProfile = {
      nexId,
      ...profile,
      name:    capitalizeName(profile.name),
      nexName: profile.nexName ? capitalizeName(profile.nexName) : profile.nexName,
    };
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(finalProfile));
    } catch { /* ignore */ }
    setExistingProfile(finalProfile);
    setAssignedId(nexId);

    // ── Canonical identity bridge · Philip 2026-08-29 · STEP 1 ─────────
    // Also write nex.identity via the existing useNexIdentity save API so
    // /nexapp + useNexActivation see status: "ready". Reuses the identity
    // system's own schema + ID generation · does not duplicate identity
    // fields manually.
    //
    // Field mapping:
    //   name          · from the door's profile.name (may be blank in DEV MODE)
    //   phoneNumber   · from the auth-form contact input (may be blank in DEV MODE)
    //   countryCode   · defaults to DEFAULT_COUNTRY_CODE · door doesn't yet
    //                   capture country explicitly · aligned with the identity
    //                   contract's existing default rather than inventing a field
    //   country       · resolved from countryCode via findCountry()
    //   conversationLanguage · derived from country.initialLanguage
    //
    // Note: if name or phoneNumber is empty (DEV MODE only), useNexIdentity's
    // readStored() will discard the record on next reload · matches the
    // existing DEV behaviour of nex-door-profile (no validation in DEV).
    const country = findCountry(DEFAULT_COUNTRY_CODE);
    identity.save({
      name: capitalizeName(profile.name),
      phoneNumber: contact.trim(),
      countryCode: DEFAULT_COUNTRY_CODE,
      country: country?.name ?? "",
      conversationLanguage: country?.initialLanguage ?? "en",
    });
    // GRANT ACCESS → ceremony (single scene owns beats internally) → door.
    // Ceremony beat plan (Philip 2026-08-28 · extended hold so user can
    // write down / memorise their NEX ID before the door descends):
    //   0.0-1.5s  ACCESS GRANTED (fades in, holds, fades out)
    //   1.5-2.2s  "Hi," + "your nexid" labels rise in
    //   2.2-2.8s  NEXID digits reveal character-by-character
    //   3.0-3.9s  "This is yours permanently." fades in
    //   3.9-9.0s  full tableau HOLDS for ~5s (copy time)
    //   9.0s      door begins slow descent (openDurationMs · currently 3.2s)
    setPhase("id-reveal");
    setTimeout(() => setPhase("opening"), 9000);
    setTimeout(() => router.push("/nexapp"), 9000 + openDurationMs);
  }

  // ── Returning-user handlers · FAST ─────────────────────────────────
  // Philip 2026-08-29 · face scan now happens IN THE P-AVATAR CIRCLE
  // (same size · same position) rather than switching to a separate
  // scene. handleFaceEntry flips a local `scanActive` flag · the
  // ClosedReturning scene swaps ProfileAvatar → FaceScanAvatar which
  // opens getUserMedia and shows the live preview clipped to the
  // circle with a NEX scan effect. onComplete → normal door open ·
  // onError → revert to the P avatar so the user isn't stranded.
  const [scanActive, setScanActive] = useState(false);

  // ── SCAN BEAM SCHEDULER · Philip 2026-08-29 · scanActive only ──────
  // Two lightning bolts fire on a randomised schedule from the frame's
  // left/right wedges toward the face-scan orb edge, ONLY while the
  // scan is active. Each shot randomises variant (5) + duration
  // (350-900ms) + gap-to-next (700-3100ms) + which side leads. Jagged
  // path regenerated per shot so no two strikes look identical.
  const SCAN_BEAM_VARIANTS = ["flash", "flicker", "strike", "burst", "double"] as const;
  type ScanBeamVariant = typeof SCAN_BEAM_VARIANTS[number];
  type ScanBeamShot = {
    key: number;
    leftVariant: ScanBeamVariant;   rightVariant: ScanBeamVariant;
    leftDuration: number;           rightDuration: number;
    leftDelay: number;              rightDelay: number;
    leftPoints: string;             rightPoints: string;
  };
  const [scanBeam, setScanBeam] = useState<ScanBeamShot | null>(null);
  useEffect(() => {
    if (!scanActive) {
      setScanBeam(null);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let key = 0;
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
    function jaggedPath(side: "left" | "right"): string {
      const segments = 5 + Math.floor(Math.random() * 5);
      const pts: string[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const x = t * 100;
        const distFromSource = side === "left" ? t : 1 - t;
        const amp = 8 * (1 - distFromSource * 0.7);
        const y = 10 + (Math.random() - 0.5) * amp * 2;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(" ");
    }
    function fireNext() {
      if (cancelled) return;
      key++;
      const pattern = Math.random();
      const leftDelay  = pattern < 0.6 ? 0 : pattern < 0.8 ? 0  : 90;
      const rightDelay = pattern < 0.6 ? 0 : pattern < 0.8 ? 90 : 0;
      setScanBeam({
        key,
        leftVariant:   pick(SCAN_BEAM_VARIANTS),
        rightVariant:  pick(SCAN_BEAM_VARIANTS),
        leftDuration:  350 + Math.floor(Math.random() * 550),
        rightDuration: 350 + Math.floor(Math.random() * 550),
        leftDelay, rightDelay,
        leftPoints:  jaggedPath("left"),
        rightPoints: jaggedPath("right"),
      });
      timeoutId = setTimeout(fireNext, 700 + Math.floor(Math.random() * 2400));
    }
    timeoutId = setTimeout(fireNext, 200 + Math.floor(Math.random() * 400));
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanActive]);

  function handleFaceEntry() {
    setScanActive(true);
  }
  function handleScanComplete() {
    setScanActive(false);
    setPhase("opening");
    setTimeout(() => router.push("/nexapp"), openDurationMs);
  }
  function handleScanError() {
    // Camera permission denied / device error · quietly revert to the
    // P avatar. No modal / no error card · Philip explicitly requested
    // a return to the P avatar rather than a broken camera area.
    setScanActive(false);
  }
  function handleUsePassword() {
    setPhase("password-fallback");
  }
  function handlePasswordSubmit() {
    setPhase("opening");
    setTimeout(() => router.push("/nexapp"), openDurationMs);
  }

  // Philip 2026-08-29 · door slides DOWN on open (face-scan / grant-access)
  // and disappears beneath the footer chrome · interior is revealed from
  // ABOVE as the door descends · fog rises in the newly exposed area at
  // the top, following the receding door's top edge.
  const doorTranslate = phase === "opening" ? "translateY(110%)" : "translateY(0)";
  // Knock feedback · brief vertical bump on the door (tactile press
  // response, unrelated to the open direction).
  const doorKnockBump = phase === "knocking" ? "translateY(4px)" : "translateY(0)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
      }}
    >
      {/* ═══ NEX CONSOLE FRAME · Philip 2026-08-29 ═══
          Landing page renders the actual NEX HUD frame in COLLAPSED
          right-rail state (hud-frame-v12-norail.png). The door + all
          its state machine renders INSIDE this frame's interior
          viewport as the "closed inner screen". Same asset the shell
          uses · same aspect ratio · same geometry constants. */}
      <div
        style={{
          position: "relative",
          aspectRatio: BEZEL_ASPECT_RATIO,
          width: `min(100dvw, calc(100dvh * ${BEZEL_METAL.w} / ${BEZEL_METAL.h}))`,
          height: "auto",
          maxHeight: "100dvh",
          background: "#000000",
          overflow: "hidden",
        }}
      >
        {/* LAYER 0 · Interior background (behind door · behind frame overlay).
            Shows "ENTERING NEX…" once the door has descended. Constrained
            to the frame's inner viewport so it never sits over the bezel. */}
        <div
          style={{
            position: "absolute",
            top:    NEX_INNER_VIEWPORT_CSS.top,
            bottom: NEX_INNER_VIEWPORT_CSS.bottom,
            left:   0,
            right:  0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(245,245,245,0.75)",
            fontSize: 13,
            letterSpacing: 0.6,
            zIndex: 1,
          }}
        >
          ENTERING NEX…
        </div>

        {/* LAYER 1 · Door FOG · Philip 2026-08-29.
            Anchored to the TOP of the console viewport because the door
            slides DOWN on open · newly-revealed interior appears from
            ABOVE as the door descends · fog rises in the exposed area
            following the door's receding top edge. Frame overlay (z:20)
            clips the fog visually to the transparent viewport region ·
            no need for local overflow clipping. */}
        <div
          aria-hidden
          className={phase === "opening" ? "nex-door-fog nex-door-fog-active" : "nex-door-fog"}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "70%",
            pointerEvents: "none",
            zIndex: 2,
            ["--fog-duration" as unknown as string]: `${openDurationMs}ms`,
          } as CSSProperties}
        >
          <div
            aria-hidden
            className="nex-door-fog-plume"
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 78% 65% at 50% 92%, rgba(220,228,240,0.34) 0%, rgba(200,215,230,0.20) 35%, rgba(175,195,215,0.08) 65%, transparent 92%)",
              opacity: 0,
              filter: "blur(6px)",
              pointerEvents: "none",
            }}
          />
        </div>
        <style>{`
          @keyframes nex-door-fog-rise {
            0%      { opacity: 0;    transform: translateY(22%); }
            12.5%   { opacity: 0;    transform: translateY(20%); }
            68.75%  { opacity: 0.78; transform: translateY(4%); }
            90.625% { opacity: 1;    transform: translateY(0); }
            100%    { opacity: 0;    transform: translateY(-8%); }
          }
          .nex-door-fog-active .nex-door-fog-plume {
            animation: nex-door-fog-rise var(--fog-duration, 1600ms) cubic-bezier(0.4, 0, 0.2, 1) forwards;
          }
          @media (prefers-reduced-motion: reduce) {
            .nex-door-fog-active .nex-door-fog-plume { animation: none !important; opacity: 0 !important; }
          }
        `}</style>

        {/* LAYER 3 · THE METAL DOOR · Philip 2026-08-29.
            FULL WIDTH + FULL HEIGHT of the console viewport · passes
            UNDER the frame chrome (frame overlay at z:20 covers the
            door's top/bottom/sides). Visible only through the
            transparent inner viewport region of hud-frame-v12-norail.
            Slides DOWN on open (translateY(110%)) · disappears beneath
            the footer · top corners rounded 24px so the receding top
            edge reads as a physical hatch as it descends.
            Texture: Philip's brushed-metal asset at
            /nex/nex-door-closed-v2.png (was CSS gradient). Kept the
            existing inset shadows (edge highlights + top-bevel + knock
            ripple) as separate layers so the physical door feel is
            preserved on top of the texture. */}
        <div
        style={{
          position: "absolute",
          inset: 0,
          // Philip 2026-08-29 · door texture = new dark-brushed asset ·
          // no shade overlay · renders at its natural tone (was previously
          // multiplied with #3a3d42 titanium base · that darken pass is
          // now removed because the source asset is already dark).
          backgroundImage: "url('/nex/nex-door-closed-v2.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: "24px 24px 0 0",
          boxShadow:
            "0 0 60px rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.5), inset 2px 0 0 rgba(255,255,255,0.04), inset -2px 0 0 rgba(0,0,0,0.4)",
          overflow: "hidden",
          transform: `${doorTranslate} ${doorKnockBump}`,
          transition: phase === "opening"
            ? `transform ${openDurationMs}ms cubic-bezier(0.5, 0, 0.2, 1)`
            : "transform 180ms cubic-bezier(0.25, 1.5, 0.5, 1)",
          zIndex: 3,
        }}
      >
        {/* Top bevel highlight */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
        }} />
        {/* Knock ripple · fades outward when knockCount changes */}
        {knockCount > 0 && phase === "knocking" && (
          <div
            key={knockCount}
            aria-hidden
            style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: 120, height: 120, marginTop: -60, marginLeft: -60,
              borderRadius: "50%",
              border: "2px solid rgba(249,115,22,0.6)",
              animation: "nex-knock-ripple 600ms ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}

        {/* NEX wordmark · top */}
        <div style={{
          position: "absolute", top: "8%", left: 0, right: 0,
          textAlign: "center",
          fontSize: 42, fontWeight: 800, letterSpacing: 6,
          color: "rgba(245,245,245,0.92)",
        }}>
          NE<span style={{ color: "#f97316" }}>X</span>
        </div>

        {/* CONTENT AREA · varies by phase */}
        <div style={{
          position: "absolute",
          top: "22%", bottom: "12%", left: "8%", right: "8%",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 24,
          color: "rgba(245,245,245,0.85)",
        }}>
          {phase === "closed" && !existingProfile && <ClosedFirstVisit onKnock={handleKnock} />}
          {phase === "closed" && existingProfile && (
            <ClosedReturning
              profile={existingProfile}
              onFaceEntry={handleFaceEntry}
              onUsePassword={handleUsePassword}
              scanActive={scanActive}
              onScanComplete={handleScanComplete}
              onScanError={handleScanError}
              orbRef={centerOrbRef}
              orbLook={orbLook}
            />
          )}
          {phase === "knocking" && <KnockingScene />}
          {phase === "auth-form" && (
            <AuthForm
              contact={contact} setContact={setContact}
              code={code} setCode={setCode}
              codeSent={codeSent}
              onSendCode={handleSendCode}
              onVerify={handleVerifyCode}
            />
          )}
          {phase === "unlocking" && <UnlockingScene />}
          {phase === "profile" && (
            <ProfileForm
              profile={profile} setProfile={setProfile}
              photoInputRef={photoInputRef}
              onPhotoPick={handlePhotoPick}
              onGrantAccess={handleGrantAccess}
            />
          )}
          {phase === "id-reveal" && assignedId && <IdRevealScene nexId={assignedId} />}
          {phase === "face-scan" && existingProfile && <FaceScanScene profile={existingProfile} />}
          {phase === "password-fallback" && <PasswordFallback onSubmit={handlePasswordSubmit} />}
        </div>

        {/* Bottom bevel */}
        <div aria-hidden style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.6), transparent)",
        }} />
      </div>

        {/* LAYER 2 · NEX HUD FRAME OVERLAY · Philip 2026-08-29.
            The actual NEX bezel · v12-norail variant (rail hidden ·
            matches the landing's collapsed-rail intent). Paints on top
            of the door + interior region so the metal chrome is always
            visible even while the door is closed. z:20 mirrors the
            layering NexHudFrame uses in the app shell. Pointer-events
            none · door + inner content receive taps through the
            transparent interior. */}
        <img
          src="/nex/hud-frame-master.png"
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            pointerEvents: "none",
            zIndex: 20,
          }}
        />

        {/* LAYER 22 · SCAN-ONLY SIDE LIGHTNING · Philip 2026-08-29.
            Fires from the frame's left/right wedges toward the face-
            scan orb ONLY while scanActive is true. Renders above the
            frame overlay (z:22 > frame z:20) so bolts appear to
            originate AT the wedges. Pointer-events none. */}
        {scanActive && scanBeam && (
          <>
            <svg
              key={`sbl-${scanBeam.key}`}
              aria-hidden
              className={`nex-beam-el nex-beam-${scanBeam.leftVariant}`}
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                top: "calc(50% - 60px)",
                left: "5%",
                width: "calc(45% - 70px)",
                height: 44,
                transform: "translateY(-50%)",
                pointerEvents: "none",
                zIndex: 22,
                opacity: 0,
                overflow: "visible",
                animationDuration: `${scanBeam.leftDuration}ms`,
                animationDelay: `${scanBeam.leftDelay}ms`,
                filter:
                  "drop-shadow(0 0 1px #fed7aa) drop-shadow(0 0 3px #f97316) drop-shadow(0 0 8px rgba(249,115,22,0.6))",
              }}
            >
              <polyline points={scanBeam.leftPoints} fill="none" stroke="rgba(249,115,22,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={scanBeam.leftPoints} fill="none" stroke="#fff7ed" strokeWidth="0.45" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg
              key={`sbr-${scanBeam.key}`}
              aria-hidden
              className={`nex-beam-el nex-beam-${scanBeam.rightVariant}`}
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              style={{
                position: "absolute",
                top: "calc(50% - 60px)",
                right: "5%",
                width: "calc(45% - 70px)",
                height: 44,
                transform: "translateY(-50%)",
                pointerEvents: "none",
                zIndex: 22,
                opacity: 0,
                overflow: "visible",
                animationDuration: `${scanBeam.rightDuration}ms`,
                animationDelay: `${scanBeam.rightDelay}ms`,
                filter:
                  "drop-shadow(0 0 1px #fed7aa) drop-shadow(0 0 3px #f97316) drop-shadow(0 0 8px rgba(249,115,22,0.6))",
              }}
            >
              <polyline points={scanBeam.rightPoints} fill="none" stroke="rgba(249,115,22,0.55)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={scanBeam.rightPoints} fill="none" stroke="#fff7ed" strokeWidth="0.45" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
        {scanActive && (
          <style>{`
            @keyframes nex-beam-flash   { 0%{opacity:0} 5%{opacity:1} 35%{opacity:1} 50%{opacity:0.6} 60%{opacity:1} 100%{opacity:0} }
            @keyframes nex-beam-flicker { 0%{opacity:0} 8%{opacity:1} 14%{opacity:0.2} 22%{opacity:1} 32%{opacity:0.3} 45%{opacity:1} 60%{opacity:0.5} 75%{opacity:1} 100%{opacity:0} }
            @keyframes nex-beam-strike  { 0%{opacity:0} 4%{opacity:1} 80%{opacity:0.9} 100%{opacity:0} }
            @keyframes nex-beam-burst   { 0%{opacity:0} 10%{opacity:1} 25%{opacity:1} 100%{opacity:0} }
            @keyframes nex-beam-double  { 0%{opacity:0} 8%{opacity:1} 20%{opacity:0.15} 35%{opacity:1} 65%{opacity:1} 80%{opacity:0.4} 100%{opacity:0} }
            .nex-beam-el {
              animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
              animation-fill-mode: forwards;
              animation-iteration-count: 1;
            }
            .nex-beam-flash   { animation-name: nex-beam-flash; }
            .nex-beam-flicker { animation-name: nex-beam-flicker; }
            .nex-beam-strike  { animation-name: nex-beam-strike; }
            .nex-beam-burst   { animation-name: nex-beam-burst; }
            .nex-beam-double  { animation-name: nex-beam-double; }
            @media (prefers-reduced-motion: reduce) {
              .nex-beam-el { animation: none !important; opacity: 0 !important; }
            }
          `}</style>
        )}

        {/* LAYER 25 · FOOTER CLOCK · Philip 2026-08-29.
            Live wall-clock time centered over the frame's baked
            composer text-field area. z:25 above frame overlay + door ·
            pointer-events none · read-only. */}
        <div
          aria-live="polite"
          style={{
            position: "absolute",
            bottom: "calc(3.2% - 5px)",
            left: 0,
            right: 0,
            height: "8.5%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 25,
            fontFamily: `"SF Mono", "JetBrains Mono", ui-monospace, "Menlo", monospace`,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            fontSize: "clamp(14px, 2.2vh, 22px)",
            letterSpacing: "0.12em",
            color: "rgba(249, 165, 90, 0.92)",
            textShadow: "0 0 8px rgba(249, 115, 22, 0.35)",
          }}
        >
          {nowClock}
        </div>

        {/* LAYER 25 · HERO NEXID · Philip 2026-08-29.
            Returning user's NEXID rendered just under the NEX brand
            wordmark in the frame chrome. Same subtle light-gray as
            the original inline NEXID (rgba(245,245,245,0.55)) ·
            lightly enlarged from the original 11px readout to ~18px
            for hero-area legibility · no glow / no color change.
            Nudge (Philip 2026-08-29): pushed down from +12px → +50px
            → +65px so the text clears the NEX wordmark cleanly and
            sits with a bit of breathing room under the brand chrome. */}
        {existingProfile && (
          <div
            style={{
              position: "absolute",
              top: "calc(7.83% + 65px)",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 25,
              fontFamily: `-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif`,
              fontWeight: 600,
              fontSize: "clamp(14px, 1.9vh, 20px)",
              letterSpacing: "0.14em",
              color: "rgba(245,245,245,0.55)",
              whiteSpace: "nowrap",
            }}
          >
            NEX-ID{displayId(existingProfile.nexId)}
          </div>
        )}

        {/* LAYER 26 · Corner NEX orb REMOVED · Philip 2026-08-29 ·
            center orb in the identity circle carries the presence. */}
      </div>

      <style>{`
        @keyframes nex-knock-ripple {
          0%   { transform: scale(0.3); opacity: 0.9; border-width: 3px; }
          100% { transform: scale(2.2); opacity: 0;   border-width: 1px; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · CLOSED · FIRST VISIT · KNOCK button
// ─────────────────────────────────────────────────────────────────────────
function ClosedFirstVisit({ onKnock }: { onKnock: () => void }) {
  return (
    <>
      <div style={{
        width: 160, height: 160, borderRadius: "50%",
        background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.05), rgba(0,0,0,0.4))",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 34, fontWeight: 800, letterSpacing: 3,
        color: "rgba(245,245,245,0.85)",
        boxShadow: "inset 0 0 40px rgba(0,0,0,0.6)",
      }}>
        NE<span style={{ color: "#f97316" }}>X</span>
      </div>
      <DoorButton onClick={onKnock}>KNOCK TO ENTER</DoorButton>
      <div style={{ fontSize: 10, color: "rgba(245,245,245,0.4)", letterSpacing: 0.6 }}>
        ID: KETUK PINTU
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · CLOSED · RETURNING · shows identity + FACE ENTRY (fast)
// ─────────────────────────────────────────────────────────────────────────
/** Guidance prompt text for each scan state · Philip 2026-08-30.
 *  Sequence matches Philip's approved flow:
 *    LOOK AT CAMERA → guidance… → POSITION LOCKED → HOLD STILL → SCAN → SCAN COMPLETE */
function promptForScanState(state: ScanState | null): string {
  switch (state) {
    case "loading":       return "PREPARING SCANNER…";
    case "camera-error":  return "SCANNER UNAVAILABLE";
    case "no-face":       return "LOOK AT CAMERA";
    case "multi-face":    return "ONE FACE ONLY";
    case "too-far":       return "MOVE CLOSER";
    case "too-close":     return "MOVE BACK";
    case "needs-right":   return "SLIGHTLY RIGHT";
    case "needs-left":    return "SLIGHTLY LEFT";
    case "needs-up":      return "MOVE UP";
    case "needs-down":    return "MOVE DOWN";
    case "hold-still":    return "POSITION LOCKED";
    case "counting":      return "HOLD STILL";
    case "capturing":     return "SCAN";
    case "captured":      return "ENTERING NEX";
    default:              return "SCANNING…";
  }
}

function ClosedReturning({
  profile, onFaceEntry, onUsePassword,
  scanActive, onScanComplete, onScanError,
  orbRef, orbLook,
}: {
  profile: NexProfile;
  onFaceEntry: () => void;
  onUsePassword: () => void;
  scanActive: boolean;
  onScanComplete: () => void;
  onScanError: () => void;
  orbRef: React.RefObject<HTMLDivElement | null>;
  orbLook: OrbLookDirection | null;
}) {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  // Reset when scan starts/stops so the prompt starts fresh.
  useEffect(() => {
    if (!scanActive) setScanState(null);
  }, [scanActive]);
  return (
    <>
      {/* Philip 2026-08-29 · landing state now renders the NEX ORB in
          the main 140px circle (replaces the P letter / photo avatar).
          On tap ENTER WITH FACE, the orb swaps to FaceScanAvatar for
          the live camera preview. box-sizing:border-box + matching
          border keeps the layout identical between the two variants
          so nothing shifts on swap. */}
      <div style={{ transform: "translateY(10px)" }}>
        {scanActive ? (
          <FaceScanAvatar
            profile={profile}
            size={140}
            onComplete={onScanComplete}
            onError={onScanError}
            onStateChange={setScanState}
          />
        ) : (
          // Philip 2026-08-29 · landing orb · bare on dark backdrop,
          // eye follows the pointer via orbLook (see NexDoorPage eye-
          // tracking effect). autoReturn=false so the pupil holds on
          // the pointer instead of snapping back to centre every 700ms.
          // overflow:visible so the orb's floating rim decorations
          // (spinning outer ring + orbiting particles) can render
          // OUTSIDE the 140x140 layout box · without this they get
          // clipped and the orb looks stripped of its 2 main floating
          // items.
          <div
            ref={orbRef}
            style={{
              boxSizing: "border-box",
              width: 140,
              height: 140,
              borderRadius: "50%",
              overflow: "visible",
            }}
          >
            <NexVoiceOrb
              nexState="idle"
              size="100%"
              lookAt={orbLook}
              autoReturn={false}
            />
          </div>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(245,245,245,0.95)" }}>
        {capitalizeName(profile.nexName || profile.name)}
      </div>
      {/* NEXID under-name block removed · Philip 2026-08-29 · NEXID now
          lives under the NEX brand at the top of the frame (LAYER 25) ·
          keeping it under the name too would duplicate the readout. */}
      <div
        style={{
          fontSize: 12,
          letterSpacing: 0.6,
          color: "rgba(245,245,245,0.5)",
          minHeight: 16, // stable line-height so buttons below don't jitter
          textAlign: "center",
        }}
      >
        {scanActive ? promptForScanState(scanState) : "WELCOME BACK"}
      </div>
      {/* Philip 2026-08-29 · buttons kept in the DOM during scan · only
          opacity + pointer-events toggle · so the flex column's total
          height stays constant and the avatar/name don't shift when
          the scan starts. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: scanActive ? 0 : 1,
          pointerEvents: scanActive ? "none" : "auto",
          transition: "opacity 220ms ease",
        }}
      >
        <DoorButton onClick={onFaceEntry}>ENTER WITH FACE</DoorButton>
        <button
          type="button"
          onClick={onUsePassword}
          style={{
            appearance: "none", background: "transparent", border: "none",
            color: "rgba(245,245,245,0.5)", fontSize: 12, letterSpacing: 0.6,
            cursor: "pointer", padding: "8px 12px",
          }}
        >
          Use password
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · FACE SCAN AVATAR · Philip 2026-08-29 · CINEMATIC IGNITION v2
//
// Additive VFX layered over the existing 140px circle · no geometry /
// button / colour changes. The face-scan circle STAYS the same shape,
// size and position · the video preview inside it stays the same ·
// this component just wraps the whole thing in a "power ignition"
// visual language: short violent electrical burst (~1.2s), then a
// controlled calm scanning glow.
//
// Timeline (per Philip's spec):
//   0-100ms    · tap flash · tiny bright white pulse from centre
//   100-350ms  · electrical arcs explode outward from circle rim toward
//                surrounding frame (branching, irregular, non-symmetric)
//   350-600ms  · current sweeps along the drawn arcs (dashoffset finishes)
//   500-750ms  · horizontal scan line crosses circle · white-hot flash +
//                bloom + volumetric glow bloom the interior
//   750-1200ms · arcs fade · energy settles into calm scanning state
//   1200-1800  · calm scanning glow · subtle orange sweep + soft ring
//   1800-2350  · cyan confirmation burst · onComplete fires
//
// Arcs are procedurally generated per-mount (each activation is unique).
// Fail path: onError → parent reverts to ProfileAvatar (no broken UI).
// ─────────────────────────────────────────────────────────────────────────
type FaceScanArc = {
  id:       number;
  points:   string;   // SVG polyline "x,y x,y" · relative to SVG viewBox
  delay:    number;   // ms after ignition start
  duration: number;   // arc reveal duration in ms
  spark:    { x: number; y: number }; // endpoint for the terminal spark
};
type FaceScanPhase = "waiting" | "igniting" | "scanning" | "confirming";

/** Procedurally generate irregular branching arcs radiating outward
 *  from a circle rim. Coords are in SVG viewBox space (centred at
 *  `center`, extending up to `ringRadius + maxLength` outward). */
function generateFaceScanArcs(
  count:      number,
  center:     number,
  ringRadius: number,
  minLength:  number,
  maxLength:  number,
): FaceScanArc[] {
  const arcs: FaceScanArc[] = [];
  for (let i = 0; i < count; i++) {
    // Distribute arc origins around the circle · then jitter so they
    // aren't perfectly evenly spaced (organic / non-symmetric).
    const startAngle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
    const length     = minLength + Math.random() * (maxLength - minLength);
    const segments   = 4 + Math.floor(Math.random() * 4);
    let currentAngle = startAngle;
    const pts: string[] = [];
    let endX = center;
    let endY = center;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const distFromCenter = ringRadius + length * t;
      // Path angle wobbles as it extends outward (irregular)
      if (s > 0) currentAngle += (Math.random() - 0.5) * 0.4;
      // Perpendicular jitter for jagged look (0 at rim, grows outward)
      const perpAngle  = currentAngle + Math.PI / 2;
      const perpOffset = t > 0 ? (Math.random() - 0.5) * length * 0.18 : 0;
      const x = center + distFromCenter * Math.cos(currentAngle)
              + perpOffset * Math.cos(perpAngle);
      const y = center + distFromCenter * Math.sin(currentAngle)
              + perpOffset * Math.sin(perpAngle);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (s === segments) { endX = x; endY = y; }
    }
    arcs.push({
      id:       i,
      points:   pts.join(" "),
      delay:    100 + Math.floor(Math.random() * 180),   // 100-280ms
      duration: 220 + Math.floor(Math.random() * 220),   // 220-440ms
      spark:    { x: endX, y: endY },
    });
  }
  return arcs;
}

// ── SCAN STATE MACHINE · Philip 2026-08-30 ──────────────────────────
// Every state maps to a specific detection outcome. Only `hold-still`
// (correct AND stable for ≥800ms) advances to the countdown. Any drift
// out of `hold-still` before ignition aborts the countdown and returns
// to guidance. No fake states · no simulated progress.
export type ScanState =
  | "loading"       // detector or camera not ready yet
  | "camera-error"  // permission denied / device missing
  | "no-face"
  | "multi-face"
  | "too-far"
  | "too-close"
  | "needs-right"   // face is on user's LEFT · move right to center
  | "needs-left"    // face is on user's RIGHT · move left to center
  | "needs-down"    // face is HIGH in view · move down
  | "needs-up"      // face is LOW in view · move up
  | "hold-still"    // correct position · stability lock in progress
  | "counting"      // 3-2-1
  | "capturing"     // ignition sequence
  | "captured";     // success · onComplete fired

// Detection thresholds (proportion of raw video dimensions)
const SCAN_MIN_FACE_W    = 0.35;
const SCAN_MAX_FACE_W    = 0.68;
const SCAN_TOL_LEFT_X    = 0.38;  // user-perceived (mirrored) left edge
const SCAN_TOL_RIGHT_X   = 0.62;
const SCAN_TOL_TOP_Y     = 0.28;
const SCAN_TOL_BOTTOM_Y  = 0.65;
const SCAN_STABLE_MS     = 800;

// MediaPipe FaceDetector · loaded once per app lifecycle · cached in
// this module-scoped promise so subsequent scans skip the ~500-1500ms
// WASM + model download.
let cachedFaceDetectorPromise: Promise<FaceDetector> | null = null;
function loadFaceDetector(): Promise<FaceDetector> {
  if (cachedFaceDetectorPromise) return cachedFaceDetectorPromise;
  cachedFaceDetectorPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "/mediapipe/tasks-vision/wasm"
    );
    return FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/mediapipe/models/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.6,
    });
  })().catch((e) => {
    cachedFaceDetectorPromise = null;
    throw e;
  });
  return cachedFaceDetectorPromise;
}

function FaceScanAvatar({
  profile: _profile, size, onComplete, onError, onStateChange,
}: {
  profile: NexProfile;
  size: number;
  onComplete: () => void;
  onError: () => void;
  onStateChange?: (state: ScanState) => void;
}) {
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef      = useRef<FaceDetector | null>(null);
  const rafIdRef         = useRef<number | null>(null);
  const correctSinceRef  = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const stateChangeRef   = useRef<typeof onStateChange>(onStateChange);
  const onCompleteRef    = useRef<typeof onComplete>(onComplete);
  const onErrorRef       = useRef<typeof onError>(onError);
  stateChangeRef.current = onStateChange;
  onCompleteRef.current  = onComplete;
  onErrorRef.current     = onError;

  const [state, setState] = useState<ScanState>("loading");
  const [videoReady, setVideoReady] = useState(false);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [bbox, setBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [phase, setPhase] = useState<FaceScanPhase>("waiting");
  const [arcs, setArcs] = useState<FaceScanArc[]>([]);
  // Progressive bracket lock · Philip 2026-08-30. Corners engage one
  // at a time (~150ms apart · ~600ms total). Resets when the face is
  // lost so the lock plays again on re-detection.
  const [bracketProgress, setBracketProgress] = useState(0);

  const ARC_PADDING = Math.round(size * 0.85);
  const svgSize     = size + ARC_PADDING * 2;
  const svgCenter   = svgSize / 2;
  const ringRadius  = size / 2 - 2;

  // Notify parent on every state transition so it can render the
  // appropriate guidance prompt.
  useEffect(() => {
    stateChangeRef.current?.(state);
  }, [state]);

  // Progressive bracket engagement · Philip 2026-08-30. Corner 1 locks
  // → 2 → 3 → 4 with a ~150ms cadence + tiny flash on each. Triggered
  // by the FIRST bbox appearance in a scan session. If the face is
  // lost mid-sequence, progress resets to 0 so the lock plays fresh
  // when the face returns.
  const bboxWasPresent = bbox !== null;
  useEffect(() => {
    if (!bboxWasPresent) {
      setBracketProgress(0);
      return;
    }
    // Face just appeared · engage brackets sequentially.
    const timers: ReturnType<typeof setTimeout>[] = [];
    setBracketProgress(1);
    timers.push(setTimeout(() => setBracketProgress(2), 150));
    timers.push(setTimeout(() => setBracketProgress(3), 300));
    timers.push(setTimeout(() => setBracketProgress(4), 450));
    return () => timers.forEach(clearTimeout);
  }, [bboxWasPresent]);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Track countdown scheduling via a ref so it can be aborted mid-flight
    let countdownTimers: ReturnType<typeof setTimeout>[] = [];
    let countdownActive = false;

    function nowMs() { return performance.now(); }

    function commitState(next: ScanState) {
      setState((prev) => (prev === next ? prev : next));
    }

    /** Convert a Detection → normalised ScanState.
     *  detector coords are raw source-video pixels · we mirror X for
     *  guidance because the display is scaleX(-1). */
    function stateFromDetection(det: Detection | null, vidW: number, vidH: number): ScanState {
      if (!det?.boundingBox) return "no-face";
      const b = det.boundingBox;
      const faceW = b.width / vidW;
      if (faceW < SCAN_MIN_FACE_W) return "too-far";
      if (faceW > SCAN_MAX_FACE_W) return "too-close";
      const detectorCX = (b.originX + b.width / 2) / vidW;
      const detectorCY = (b.originY + b.height / 2) / vidH;
      const userCX = 1 - detectorCX; // mirror
      const userCY = detectorCY;
      if (userCX < SCAN_TOL_LEFT_X)  return "needs-right";
      if (userCX > SCAN_TOL_RIGHT_X) return "needs-left";
      if (userCY < SCAN_TOL_TOP_Y)    return "needs-down";
      if (userCY > SCAN_TOL_BOTTOM_Y) return "needs-up";
      return "hold-still";
    }

    // Philip 2026-08-30 · haptic tick · one short buzz per beat.
    // navigator.vibrate is Android/Chrome only · silently ignored on
    // iOS Safari and desktop. Never fires per-frame · only on beats.
    function haptic(ms: number) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate(ms); } catch { /* noop */ }
      }
    }

    function scheduleCountdown() {
      if (countdownActive) return;
      countdownActive = true;
      commitState("counting");
      // Tick 3 (warm orange · haptic)
      setCountdown(3); haptic(18);
      // Tick 2 (orange → cyan blend · haptic)
      countdownTimers.push(setTimeout(() => { setCountdown(2); haptic(18); }, 700));
      // Tick 1 (cyan · haptic)
      countdownTimers.push(setTimeout(() => { setCountdown(1); haptic(18); }, 1400));
      // SCAN moment · video freezes, ignition fires, brackets snap,
      // SCAN COMPLETE briefly, then door drops.
      countdownTimers.push(setTimeout(() => {
        setCountdown(null);
        // 1. Pause the video for the "face freeze" moment (~200ms).
        const vid = videoRef.current;
        if (vid) { try { vid.pause(); } catch { /* noop */ } }
        // 2. Fire the cinematic ignition + haptic (bigger buzz).
        setArcs(generateFaceScanArcs(7, svgCenter, ringRadius, size * 0.35, size * 0.85));
        setPhase("igniting");
        commitState("capturing");
        haptic(60);
        // 3. Brackets snap inward · triggered when phase → "scanning"
        //    (the bracket wrapper reacts via a CSS transform below).
        countdownTimers.push(setTimeout(() => setPhase("scanning"),   1200));
        // 4. Cyan confirmation burst.
        countdownTimers.push(setTimeout(() => setPhase("confirming"), 1800));
        // 5. SCAN COMPLETE · a brief hold, then onComplete fires.
        countdownTimers.push(setTimeout(() => {
          commitState("captured");
          onCompleteRef.current?.();
        }, 2350));
      }, 2100));
    }

    function abortCountdown() {
      if (!countdownActive) return;
      countdownActive = false;
      countdownTimers.forEach(clearTimeout);
      countdownTimers = [];
      setCountdown(null);
      setPhase("waiting");
    }

    function detectFrame() {
      if (cancelled) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) {
        rafIdRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      // Only process new frames (video.currentTime advances at frame rate).
      if (video.currentTime === lastVideoTimeRef.current) {
        rafIdRef.current = requestAnimationFrame(detectFrame);
        return;
      }
      lastVideoTimeRef.current = video.currentTime;
      const t = nowMs();
      const result = detector.detectForVideo(video, t);
      const detections = result.detections ?? [];

      // Compute state from detections
      let next: ScanState;
      let nextBbox: { x: number; y: number; w: number; h: number } | null = null;
      const vidW = video.videoWidth;
      const vidH = video.videoHeight;
      if (detections.length === 0) {
        next = "no-face";
      } else if (detections.length > 1) {
        next = "multi-face";
        const primary = detections[0];
        if (primary.boundingBox) {
          nextBbox = {
            x: primary.boundingBox.originX,
            y: primary.boundingBox.originY,
            w: primary.boundingBox.width,
            h: primary.boundingBox.height,
          };
        }
      } else {
        const det = detections[0];
        next = stateFromDetection(det, vidW, vidH);
        if (det.boundingBox) {
          nextBbox = {
            x: det.boundingBox.originX,
            y: det.boundingBox.originY,
            w: det.boundingBox.width,
            h: det.boundingBox.height,
          };
        }
      }
      setBbox(nextBbox);

      // Stability tracking · only "hold-still" builds toward countdown.
      // Any other state resets the timer and aborts an active countdown.
      if (next === "hold-still") {
        if (correctSinceRef.current === null) correctSinceRef.current = t;
        const stableFor = t - correctSinceRef.current;
        if (stableFor >= SCAN_STABLE_MS && !countdownActive) {
          scheduleCountdown();
        } else if (!countdownActive) {
          commitState("hold-still");
        }
        // If countdown already active, don't overwrite "counting" state
      } else {
        correctSinceRef.current = null;
        if (countdownActive) abortCountdown();
        commitState(next);
      }

      rafIdRef.current = requestAnimationFrame(detectFrame);
    }

    // Philip 2026-08-30 · error-state visibility. Every failure path
    // commits `camera-error` so the truthful prompt renders, then defers
    // onError by ~1800ms so the parent's quiet-revert-to-orb doesn't
    // unmount us before the user can see the message once.
    const FAIL_MESSAGE_HOLD_MS = 1800;
    function failWithHold() {
      commitState("camera-error");
      timers.push(setTimeout(() => {
        if (cancelled) return;
        onErrorRef.current?.();
      }, FAIL_MESSAGE_HOLD_MS));
    }
    async function boot() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        failWithHold();
        return;
      }
      commitState("loading");
      // Load MediaPipe detector (cached across scans)
      let detector: FaceDetector;
      try {
        detector = await loadFaceDetector();
        if (cancelled) return;
        detectorRef.current = detector;
      } catch {
        if (cancelled) return;
        failWithHold();
        return;
      }
      // Request camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch {
        if (cancelled) return;
        failWithHold();
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        try { await video.play(); } catch { /* autoplay may need user gesture · not fatal */ }
        setVideoReady(true);
        // Capture native dims once metadata loads
        const captureDims = () => {
          if (cancelled || !video.videoWidth || !video.videoHeight) return;
          setVideoDims({ w: video.videoWidth, h: video.videoHeight });
        };
        if (video.videoWidth) captureDims();
        else video.addEventListener("loadedmetadata", captureDims, { once: true });
      }
      commitState("no-face");
      // Kick off detection loop
      rafIdRef.current = requestAnimationFrame(detectFrame);
    }
    boot();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      countdownTimers.forEach(clearTimeout);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      // Do NOT close the detector · module-scoped cache · next scan reuses it
      detectorRef.current = null;
      lastVideoTimeRef.current = -1;
      correctSinceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const igniting  = phase === "igniting";
  const scanning  = phase === "scanning" || phase === "confirming";
  const confirming = phase === "confirming";

  return (
    <div style={{ position: "relative", width: size, height: size, overflow: "visible" }}>
      {/* Electrical arc overlay removed · Philip 2026-08-29. Kept the
          inside-the-circle VFX (ignition flash, scan line, bloom,
          calm sweep, confirmation burst) but no more filaments
          radiating outward from the rim. */}

      {/* ── CIRCLE (existing UI · unchanged geometry) ────────────────
          The video + all overlays live inside this clipped circle.
          box-sizing: border-box keeps this element's layout box at
          exactly `size × size` so it matches ProfileAvatar's box and
          the flex stack doesn't reflow when the avatar swaps. */}
      <div
        style={{
          position: "relative",
          boxSizing: "border-box",
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(249,115,22,0.6)",
          boxShadow: confirming
            ? "0 0 34px rgba(74,201,255,0.95), 0 0 14px rgba(74,201,255,1)"
            : scanning
            ? "0 0 24px rgba(249,115,22,0.4)"
            : igniting
            ? "0 0 42px rgba(255,255,255,0.85), 0 0 96px rgba(180,220,255,0.5)"
            : "0 0 24px rgba(249,115,22,0.35)",
          transition: "box-shadow 260ms ease-out",
          zIndex: 3,
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)", // mirror · natural selfie preview
            opacity: videoReady ? 1 : 0.4,
            transition: "opacity 260ms ease",
          }}
        />

        {/* ── TRACKING BRACKETS · Philip 2026-08-30 ────────────────
            4 corner brackets that lock onto the detected face bbox.
            SVG viewBox = raw video dims · preserveAspectRatio slice
            matches CSS object-fit: cover so bracket coords align with
            what the user sees. Same scaleX(-1) mirror as the video so
            brackets appear on the user's face. Bracket length = 18%
            of bbox width (capped 12-32 units in the source-coord
            space). Only rendered when we have a real bbox + video
            dims (i.e. detector is running + face is present). */}
        {bbox && videoDims && (
          <svg
            aria-hidden
            viewBox={`0 0 ${videoDims.w} ${videoDims.h}`}
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: "scaleX(-1)",
              pointerEvents: "none",
              zIndex: 4,
              overflow: "visible",
            }}
          >
            {(() => {
              const brLen = Math.max(12, Math.min(32, bbox.w * 0.18));
              const sw   = Math.max(2, Math.round(bbox.w * 0.012));
              const stroke = "rgba(120,220,255,0.95)";
              const glow   = "drop-shadow(0 0 3px rgba(74,201,255,0.7)) drop-shadow(0 0 8px rgba(74,201,255,0.35))";
              const props = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" as const };
              const x1 = bbox.x, y1 = bbox.y;
              const x2 = bbox.x + bbox.w, y2 = bbox.y + bbox.h;
              // Brackets snap INWARD during capture · scale toward bbox
              // centre once the scan reaches the "scanning" phase.
              // transform-origin uses raw viewBox units.
              const snapping = phase === "scanning" || phase === "confirming";
              const cx = bbox.x + bbox.w / 2;
              const cy = bbox.y + bbox.h / 2;
              return (
                <g
                  style={{
                    filter: glow,
                    transform: snapping ? "scale(0.15)" : "scale(1)",
                    transformOrigin: `${cx}px ${cy}px`,
                    transformBox: "view-box",
                    transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1), opacity 260ms ease-out",
                    opacity: snapping ? 0 : 1,
                  }}
                >
                  {/* Top-left · corner 1 */}
                  {bracketProgress >= 1 && (
                    <g style={{ animation: "nex-face-bracket-flash 280ms ease-out" }}>
                      <path d={`M ${x1} ${y1 + brLen} L ${x1} ${y1} L ${x1 + brLen} ${y1}`} {...props} />
                    </g>
                  )}
                  {/* Top-right · corner 2 */}
                  {bracketProgress >= 2 && (
                    <g style={{ animation: "nex-face-bracket-flash 280ms ease-out" }}>
                      <path d={`M ${x2 - brLen} ${y1} L ${x2} ${y1} L ${x2} ${y1 + brLen}`} {...props} />
                    </g>
                  )}
                  {/* Bottom-left · corner 3 */}
                  {bracketProgress >= 3 && (
                    <g style={{ animation: "nex-face-bracket-flash 280ms ease-out" }}>
                      <path d={`M ${x1} ${y2 - brLen} L ${x1} ${y2} L ${x1 + brLen} ${y2}`} {...props} />
                    </g>
                  )}
                  {/* Bottom-right · corner 4 · full face lock */}
                  {bracketProgress >= 4 && (
                    <g style={{ animation: "nex-face-bracket-flash 280ms ease-out" }}>
                      <path d={`M ${x2 - brLen} ${y2} L ${x2} ${y2} L ${x2} ${y2 - brLen}`} {...props} />
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>
        )}

        {/* ── IGNITION FLASH · centre burst · 0-350ms ──────────────── */}
        {igniting && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(255,240,210,0.7) 18%, rgba(255,200,140,0.3) 40%, transparent 65%)",
              mixBlendMode: "screen",
              opacity: 0,
              animation: "nex-face-ignite 380ms cubic-bezier(0.2,0.6,0.4,1) forwards",
              pointerEvents: "none",
            }}
          />
        )}

        {/* ── SCAN LINE · fires 500-750ms with intense flash ─────── */}
        {igniting && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 3,
              top: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.9) 45%, #ffffff 50%, rgba(255,255,255,0.9) 55%, transparent 100%)",
              boxShadow:
                "0 0 12px rgba(255,255,255,0.9), 0 0 24px #f97316, 0 0 48px rgba(249,115,22,0.5)",
              opacity: 0,
              animation: "nex-face-scanline 1200ms cubic-bezier(0.2,0.6,0.3,1) forwards",
              pointerEvents: "none",
            }}
          />
        )}

        {/* ── BLOOM · huge radial flash when scan line passes ─────── */}
        {igniting && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.95) 0%, rgba(255,240,220,0.4) 30%, transparent 65%)",
              mixBlendMode: "screen",
              opacity: 0,
              animation: "nex-face-bloom 1200ms cubic-bezier(0.2,0.4,0.4,1) forwards",
              pointerEvents: "none",
            }}
          />
        )}

        {/* ── CALM SCANNING SWEEP · takes over after ignition ─────── */}
        {scanning && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 2,
              top: 0,
              background: "linear-gradient(90deg, transparent, rgba(249,165,90,0.85), transparent)",
              boxShadow: "0 0 6px rgba(249,115,22,0.6)",
              animation: "nex-face-scan-sweep 2200ms linear infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* ── COUNTDOWN 3 · 2 · 1 · Philip 2026-08-30 ─────────────────
            Cinematic colour transition per tick:
              3 · warm orange   (start · warm energy)
              2 · orange↔cyan   (mid transition)
              1 · cyan          (unlock imminent · cool)
            Each number remounts (key) so its animation restarts. */}
        {countdown !== null && (() => {
          const tone =
            countdown === 3
              ? { text: "#ffd7ab", glow: "0 0 12px rgba(249,115,22,0.85), 0 0 34px rgba(249,115,22,0.45)" }
              : countdown === 2
              ? { text: "#e6d8ff", glow: "0 0 12px rgba(200,150,255,0.75), 0 0 34px rgba(120,180,240,0.45)" }
              : { text: "#bfeaff", glow: "0 0 12px rgba(120,220,255,0.90), 0 0 34px rgba(74,201,255,0.55)" };
          return (
            <div
              key={`cd-${countdown}`}
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
                zIndex: 5,
                fontFamily: `"SF Pro Display", -apple-system, "Segoe UI", system-ui, sans-serif`,
                fontWeight: 800,
                fontSize: size * 0.5,
                color: tone.text,
                textShadow: tone.glow,
                animation: "nex-face-countdown 700ms cubic-bezier(0.2,0.6,0.4,1) forwards",
              }}
            >
              {countdown}
            </div>
          );
        })()}

        {/* ── CONFIRMATION cyan burst · fires just before onComplete */}
        {confirming && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(74,201,255,0.55) 0%, rgba(74,201,255,0.15) 55%, transparent 80%)",
              animation: "nex-face-confirm 550ms ease-out forwards",
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes nex-face-ignite {
          0%   { opacity: 0; transform: scale(0.35); }
          12%  { opacity: 1; transform: scale(0.75); }
          40%  { opacity: 0.8; transform: scale(1.3); }
          100% { opacity: 0; transform: scale(1.85); }
        }
        @keyframes nex-face-arc-draw {
          from { stroke-dashoffset: 600; opacity: 0; }
          20%  { opacity: 1; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        @keyframes nex-face-arc-fade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @keyframes nex-face-arc-spark {
          0%   { opacity: 0; transform: scale(0.4); transform-origin: center; }
          25%  { opacity: 1; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes nex-face-scanline {
          0%   { top: -6%; opacity: 0; }
          40%  { top: -6%; opacity: 0; }        /* wait ~480ms */
          45%  { top: 0%;  opacity: 1; }        /* ~540ms · appears */
          62%  { top: 100%; opacity: 1; }       /* ~744ms · reaches bottom */
          70%  { opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes nex-face-bloom {
          0%   { opacity: 0; }
          40%  { opacity: 0; }                  /* wait for scan line */
          52%  { opacity: 1; }                  /* peak flash · ~625ms */
          75%  { opacity: 0.15; }
          100% { opacity: 0; }
        }
        @keyframes nex-face-scan-sweep {
          0%   { top: -4%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes nex-face-confirm {
          0%   { opacity: 0; transform: scale(0.9); }
          30%  { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes nex-face-countdown {
          0%   { opacity: 0; transform: scale(0.55); }
          25%  { opacity: 1; transform: scale(1.05); }
          65%  { opacity: 1; transform: scale(1);    }
          100% { opacity: 0; transform: scale(1.35); }
        }
        @keyframes nex-face-bracket-in {
          0%   { opacity: 0; transform: scale(1.25); transform-origin: center; }
          60%  { opacity: 1; transform: scale(0.98); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* Progressive bracket-flash · fires as each corner locks in */
        @keyframes nex-face-bracket-flash {
          0%   { opacity: 0; filter: brightness(2); }
          40%  { opacity: 1; filter: brightness(1.8); }
          100% { opacity: 1; filter: brightness(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · KNOCKING · brief feedback after knock button pressed
// ─────────────────────────────────────────────────────────────────────────
function KnockingScene() {
  return (
    <div style={{ fontSize: 12, letterSpacing: 1, color: "rgba(245,245,245,0.7)" }}>
      KNOCK…
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · AUTH FORM
// ─────────────────────────────────────────────────────────────────────────
function AuthForm({
  contact, setContact, code, setCode, codeSent, onSendCode, onVerify,
}: {
  contact: string; setContact: (v: string) => void;
  code: string;    setCode:    (v: string) => void;
  codeSent: boolean;
  onSendCode: () => void;
  onVerify:   () => void;
}) {
  return (
    <>
      <div style={{ fontSize: 12, letterSpacing: 0.8, color: "rgba(245,245,245,0.55)" }}>
        VERIFY IDENTITY
      </div>
      <input
        type="text" value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Phone or email"
        disabled={codeSent}
        style={inputStyle}
      />
      {!codeSent && <DoorButton onClick={onSendCode}>SEND CODE</DoorButton>}
      {codeSent && (
        <>
          <input
            type="text" value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            style={inputStyle}
            autoFocus
          />
          <DoorButton onClick={onVerify}>VERIFY</DoorButton>
          <div style={{ fontSize: 10, color: "rgba(245,245,245,0.35)", letterSpacing: 0.4 }}>
            (prototype · any 4+ chars pass)
          </div>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · UNLOCKING
// ─────────────────────────────────────────────────────────────────────────
function UnlockingScene() {
  return (
    <>
      <div style={{
        fontSize: 42, color: "#f97316",
        animation: "nex-door-unlock-spin 900ms ease-in-out",
      }}>
        ✓
      </div>
      <div style={{ fontSize: 12, letterSpacing: 0.6, color: "rgba(245,245,245,0.6)" }}>
        DOOR UNLOCKING
      </div>
      <style>{`
        @keyframes nex-door-unlock-spin {
          0%   { transform: scale(0.3) rotate(-90deg); opacity: 0; }
          50%  { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · PROFILE · photo + name only (no @handle · no address)
// ─────────────────────────────────────────────────────────────────────────
function ProfileForm({
  profile, setProfile, photoInputRef, onPhotoPick, onGrantAccess,
}: {
  profile: Omit<NexProfile, "nexId">;
  setProfile: React.Dispatch<React.SetStateAction<Omit<NexProfile, "nexId">>>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  onPhotoPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGrantAccess: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: "100%" }}>
      <div style={{ fontSize: 12, letterSpacing: 0.8, color: "rgba(245,245,245,0.55)" }}>
        WHO ARE YOU
      </div>

      <button
        type="button"
        onClick={() => photoInputRef.current?.click()}
        style={{ appearance: "none", padding: 0, border: "none", cursor: "pointer", background: "transparent" }}
      >
        {profile.photo ? (
          <img
            src={profile.photo} alt=""
            style={{
              width: 96, height: 96, borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid rgba(249,115,22,0.6)",
              boxShadow: "0 0 20px rgba(249,115,22,0.3)",
            }}
          />
        ) : (
          <div style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px dashed rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, letterSpacing: 0.5, color: "rgba(245,245,245,0.5)",
            textAlign: "center", padding: 4,
          }}>
            TAP TO ADD PHOTO
          </div>
        )}
      </button>
      <input
        ref={photoInputRef}
        type="file" accept="image/*" onChange={onPhotoPick}
        style={{ display: "none" }}
      />

      <input
        type="text" value={profile.name}
        onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
        placeholder="Your name"
        style={inputStyle}
        autoFocus
      />
      <input
        type="text" value={profile.city ?? ""}
        onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
        placeholder="City (optional)"
        style={inputStyle}
      />
      <DoorButton onClick={onGrantAccess}>GRANT ACCESS</DoorButton>
      {/* Deliberately vague · no mention of NEX Name / monetization here.
          The ID reveal AFTER GRANT ACCESS is a reward · desire for a name
          is created later inside NEX, not at the door (Philip 2026-08-28). */}
      <div style={{ fontSize: 10, color: "rgba(245,245,245,0.4)", letterSpacing: 0.4, textAlign: "center", maxWidth: 260 }}>
        A permanent NEX ID will be created for you.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · ID REVEAL · premium hardware-issue ceremony · Philip 2026-08-28.
//
// Feels like a piece of luxury access hardware being ISSUED, not a form
// submission or a gaming victory screen. Sequential beats · monospace hero
// number · subtle glow · character-by-character reveal reads as "the
// number is being generated for you right now."
//
// Beat timeline (all keyframes triggered at scene mount via animation-delay):
//   0.0-1.5s   ACCESS GRANTED (absolute overlay · fades in, holds, fades out)
//   1.5s       YOUR NEX ID label rises into place
//   2.2s       #NEXID digits reveal one at a time (65ms stagger · 9 chars)
//   3.0s       "This is yours permanently." fades in
//   3.9-4.9s   full tableau holds · door begins descent at 4.9s (parent-driven)
// ─────────────────────────────────────────────────────────────────────────
function IdRevealScene({ nexId }: { nexId: string }) {
  const chars = displayId(nexId).split("");
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* BEAT 1 · ACCESS GRANTED · absolute overlay so identity stack
          renders in the same visual space without layout shift. */}
      <div
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 14,
          opacity: 0,
          animation: "nex-granted 1500ms ease-out forwards",
          pointerEvents: "none",
        }}
      >
        <div style={{
          fontSize: 44,
          color: "#f97316",
          filter: "drop-shadow(0 0 12px rgba(249,115,22,0.4))",
        }}>
          ✓
        </div>
        <div style={{
          fontSize: 11,
          letterSpacing: 2.2,
          color: "rgba(245,245,245,0.9)",
          fontWeight: 500,
        }}>
          ACCESS GRANTED
        </div>
      </div>

      {/* IDENTITY STACK · warm "Hi, your nexid [NUMBER]" greeting.
          Elements fade in sequentially via per-element animation-delay. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* BEAT 2a · warm greeting */}
        <div
          style={{
            opacity: 0,
            animation: "nex-fade-up 800ms ease-out 1500ms forwards",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: 0.2,
            color: "rgba(245,245,245,0.9)",
          }}
        >
          Hi,
        </div>

        {/* BEAT 2b · brand label · uppercase + orange · NEX NEXID.
            Philip 2026-08-28 · capitalised + coloured to match hero number
            + brand wordmark. Reads as one branded label above the ID. */}
        <div
          style={{
            opacity: 0,
            animation: "nex-fade-up 700ms ease-out 1800ms forwards",
            fontSize: 13,
            letterSpacing: 2.4,
            color: "#f97316",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          NEX NEXID
        </div>

        {/* BEAT 3 · HERO NUMBER · monospace · fits mobile & desktop.
            Font 46 (was 62) + letter-spacing 2 (was 4) keeps the number
            visually dominant but always inside the door frame width.
            Character-by-character reveal reads as "being issued live." */}
        <div
          style={{
            display: "flex",
            gap: 1,
            fontSize: 46,
            fontWeight: 500,
            fontFamily: `"SF Mono", "Menlo", "Consolas", ui-monospace, monospace`,
            letterSpacing: 2,
            color: "#f97316",
            textShadow: "0 0 22px rgba(249,115,22,0.35), 0 0 4px rgba(249,115,22,0.55)",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          {chars.map((ch, i) => (
            <span
              key={i}
              style={{
                opacity: 0,
                display: "inline-block",
                animation: `nex-digit-in 380ms cubic-bezier(0.2, 0.7, 0.35, 1) ${2200 + i * 65}ms forwards`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        {/* BEAT 4 · Subtitle · sentence case (warm, not clinical). */}
        <div
          style={{
            opacity: 0,
            animation: "nex-fade-up 900ms ease-out 3000ms forwards",
            fontSize: 11,
            letterSpacing: 0.4,
            color: "rgba(245,245,245,0.55)",
            marginTop: 12,
          }}
        >
          This is yours permanently.
        </div>
      </div>

      <style>{`
        @keyframes nex-granted {
          0%   { opacity: 0; transform: translate(-50%, -50%) translateY(6px); }
          18%  { opacity: 1; transform: translate(-50%, -50%) translateY(0);   }
          68%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes nex-fade-up {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
        @keyframes nex-digit-in {
          0%   { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · FACE SCAN (returning)
// ─────────────────────────────────────────────────────────────────────────
function FaceScanScene({ profile: _profile }: { profile: NexProfile }) {
  // Philip 2026-08-29 · face-scan circle replaced with the NEX orb.
  // During the scan window, the eye actively looks in different
  // directions (cycled every 300ms) so NEX visibly "reads" the user
  // instead of showing a static face. The orange scan line still
  // sweeps over the top for the auth affordance.
  const LOOK_CYCLE: OrbLookDirection[] = [
    "up-left", "up", "up-right", "right",
    "down-right", "down", "down-left", "left", "center",
  ];
  const [lookIdx, setLookIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setLookIdx((i) => (i + 1) % LOOK_CYCLE.length);
    }, 300);
    return () => clearInterval(id);
    // LOOK_CYCLE is a stable local const, safe to omit from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      {/* Philip 2026-08-29 · orb wrapper nudged DOWN 40px → 65px so
          the orb's centre aligns with the centre-vertical of the
          frame's side triangle wedges (where the lightning beams
          converge). */}
      <div style={{ position: "relative", width: 140, height: 140, marginTop: 65 }}>
        <NexVoiceOrb
          nexState="listening"
          size="100%"
          lookAt={LOOK_CYCLE[lookIdx]}
          autoReturn={false}
          pupilTransitionMs={220}
        />
        <div style={{
          position: "absolute", left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg, transparent, #f97316, transparent)",
          boxShadow: "0 0 12px #f97316",
          animation: "nex-face-scan 900ms ease-in-out",
          pointerEvents: "none",
        }} />
      </div>
      <div style={{ fontSize: 12, letterSpacing: 0.6, color: "rgba(245,245,245,0.7)" }}>
        SCANNING…
      </div>
      <style>{`
        @keyframes nex-face-scan {
          0%   { top: 0;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCENE · PASSWORD FALLBACK · Philip 2026-08-30 · 6-digit PIN + lockout
//
// Layout:
//   NexVoiceOrb (140) · label · 6 individual PIN boxes · error line · (auto-submit)
//   Locked variant: orb · "LOCKED" · mm:ss countdown · calm subtitle
//
// Behavior:
//   • Auto-focus first box · type digit auto-advances · backspace goes back
//   • Arrow keys move focus · paste 6 digits fills all
//   • Auto-submit ~200ms after 6th digit is entered
//   • Wrong password: 320ms subtle shake · red border pulse · boxes clear ·
//     attempts counter decrements · aria-live error text
//   • After 3 wrong attempts: 5-min lockout persisted in localStorage so a
//     page refresh doesn't bypass it. Countdown ticks every 1s. When it
//     hits 0, both localStorage keys clear and entry re-enables.
//   • Correct code: PROTOTYPE_CORRECT_CODE below. Real auth is a separate
//     batch (this is prototype-only per line 21 comment on the whole page).
// ─────────────────────────────────────────────────────────────────────────
function PasswordFallback({ onSubmit }: { onSubmit: () => void }) {
  // PROTOTYPE ONLY · replace with server-side auth call in a future batch.
  const PROTOTYPE_CORRECT_CODE = "123456";
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_MS = 5 * 60 * 1000;
  const LS_ATTEMPTS = "nexDoorAttempts";
  const LS_LOCKED_UNTIL = "nexDoorLockedUntil";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockedUntilMs, setLockedUntilMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const submittingRef = useRef(false);

  // Hydrate lockout state from localStorage on mount so refresh doesn't bypass.
  useEffect(() => {
    try {
      const savedLocked = Number(localStorage.getItem(LS_LOCKED_UNTIL) || 0);
      const savedAttempts = Number(localStorage.getItem(LS_ATTEMPTS) || 0);
      if (savedLocked > Date.now()) {
        setLockedUntilMs(savedLocked);
      } else if (savedLocked > 0) {
        localStorage.removeItem(LS_LOCKED_UNTIL);
        localStorage.removeItem(LS_ATTEMPTS);
      } else if (savedAttempts > 0) {
        setAttemptsLeft(Math.max(0, MAX_ATTEMPTS - savedAttempts));
      }
    } catch { /* localStorage unavailable · treat as fresh */ }
  }, []);

  // Countdown tick while locked. Cleans up on unmount or unlock.
  useEffect(() => {
    if (lockedUntilMs === null) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntilMs) {
        setLockedUntilMs(null);
        setAttemptsLeft(MAX_ATTEMPTS);
        setError(false);
        setDigits(["", "", "", "", "", ""]);
        try {
          localStorage.removeItem(LS_LOCKED_UNTIL);
          localStorage.removeItem(LS_ATTEMPTS);
        } catch { /* noop */ }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntilMs]);

  // Auto-focus first box when unlocked.
  useEffect(() => {
    if (lockedUntilMs !== null) return;
    const t = setTimeout(() => inputRefs.current[0]?.focus(), 50);
    return () => clearTimeout(t);
  }, [lockedUntilMs]);

  const isLocked = lockedUntilMs !== null;
  const secondsLeft = isLocked ? Math.max(0, Math.ceil((lockedUntilMs - now) / 1000)) : 0;
  const mmss = `${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, "0")}`;

  function submitCode(code: string) {
    if (submittingRef.current || isLocked) return;
    if (code.length !== 6) return;
    submittingRef.current = true;

    if (code === PROTOTYPE_CORRECT_CODE) {
      try {
        localStorage.removeItem(LS_ATTEMPTS);
        localStorage.removeItem(LS_LOCKED_UNTIL);
      } catch { /* noop */ }
      // Brief pause so the user sees the completed 6-digit code before
      // the door drops · matches the face-scan "ENTERING NEX" pacing.
      setTimeout(() => onSubmit(), 220);
      return;
    }

    // Wrong code path.
    const nextAttemptsLeft = attemptsLeft - 1;
    setError(true);
    setShake(true);
    setTimeout(() => setShake(false), 320);
    setTimeout(() => {
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      submittingRef.current = false;
    }, 360);

    setAttemptsLeft(nextAttemptsLeft);
    const usedAttempts = MAX_ATTEMPTS - nextAttemptsLeft;
    try { localStorage.setItem(LS_ATTEMPTS, String(usedAttempts)); } catch { /* noop */ }

    if (nextAttemptsLeft <= 0) {
      const until = Date.now() + LOCKOUT_MS;
      setLockedUntilMs(until);
      setNow(Date.now());
      try { localStorage.setItem(LS_LOCKED_UNTIL, String(until)); } catch { /* noop */ }
    }
  }

  function handleDigit(idx: number, raw: string) {
    if (isLocked || submittingRef.current) return;
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (error) setError(false);
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
    if (digit && idx === 5) {
      const code = next.join("");
      if (code.length === 6) submitCode(code);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (isLocked) return;
    if (e.key === "Backspace") {
      if (!digits[idx] && idx > 0) {
        e.preventDefault();
        const next = [...digits];
        next[idx - 1] = "";
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    } else if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === 6) submitCode(code);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (isLocked) return;
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""].map((_, i) => pasted[i] ?? "");
    setDigits(next);
    if (error) setError(false);
    if (pasted.length === 6) {
      submitCode(pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  }

  return (
    <>
      {/* NEX orb · sits above the password entry for continuity with the
          returning-user scene. Same size (140) so the orb doesn't jump
          when the user taps "Use password". */}
      <div
        style={{
          boxSizing: "border-box",
          width: 140,
          height: 140,
          borderRadius: "50%",
          overflow: "visible",
        }}
      >
        <NexVoiceOrb nexState="idle" size="100%" autoReturn={false} />
      </div>

      <div
        style={{
          fontSize: 12,
          letterSpacing: 0.8,
          color: isLocked ? "rgba(239,68,68,0.85)" : "rgba(245,245,245,0.55)",
          transition: "color 200ms ease",
        }}
      >
        {isLocked ? "LOCKED" : "USE PASSWORD"}
      </div>

      {isLocked ? (
        <>
          <div
            aria-live="polite"
            aria-label={`Locked. Try again in ${mmss}`}
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 2,
              color: "rgba(245,245,245,0.95)",
              lineHeight: 1,
            }}
          >
            {mmss}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "rgba(245,245,245,0.45)",
              letterSpacing: 0.4,
              textAlign: "center",
              maxWidth: 240,
            }}
          >
            Try again when the counter clears
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              width: "100%",
              maxWidth: 320,
              justifyContent: "center",
              animation: shake ? "nex-door-pin-shake 320ms ease-in-out" : undefined,
            }}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`Digit ${i + 1} of 6`}
                maxLength={1}
                value={d ? "•" : ""}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  appearance: "none",
                  flex: "1 1 0",
                  minWidth: 0,
                  maxWidth: 48,
                  height: 52,
                  padding: 0,
                  textAlign: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: "52px",
                  fontFamily: "inherit",
                  color: error
                    ? "rgba(239,68,68,0.95)"
                    : "rgba(245,245,245,0.95)",
                  background: "rgba(0,0,0,0.35)",
                  border: `1px solid ${
                    error
                      ? "rgba(239,68,68,0.75)"
                      : d
                      ? "rgba(249,115,22,0.6)"
                      : "rgba(255,255,255,0.15)"
                  }`,
                  borderRadius: 10,
                  outline: "none",
                  boxShadow: error
                    ? "0 0 0 3px rgba(239,68,68,0.15)"
                    : d
                    ? "0 0 0 3px rgba(249,115,22,0.15)"
                    : "none",
                  transition:
                    "border-color 140ms ease, box-shadow 140ms ease, color 140ms ease",
                }}
              />
            ))}
          </div>

          <div
            aria-live="polite"
            style={{
              fontSize: 11,
              letterSpacing: 0.4,
              minHeight: 14,
              color: error ? "rgba(239,68,68,0.9)" : "transparent",
              transition: "color 140ms ease",
            }}
          >
            {error
              ? `INCORRECT · ${attemptsLeft} ${attemptsLeft === 1 ? "ATTEMPT" : "ATTEMPTS"} LEFT`
              : "·"}
          </div>
        </>
      )}

      <style>{`
        @keyframes nex-door-pin-shake {
          0%   { transform: translateX(0); }
          20%  { transform: translateX(-6px); }
          40%  { transform: translateX(6px); }
          60%  { transform: translateX(-4px); }
          80%  { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────────────────────────────────
function ProfileAvatar({ profile, size }: { profile: NexProfile; size: number }) {
  // Philip 2026-08-29 · boxSizing border-box · so the 2px border lives
  // INSIDE the size×size layout box · matches FaceScanAvatar's inner
  // circle exactly · flex stack doesn't reflow when the avatar swaps.
  return profile.photo ? (
    <img
      src={profile.photo} alt=""
      style={{
        boxSizing: "border-box",
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover",
        border: "2px solid rgba(249,115,22,0.6)",
        boxShadow: "0 0 24px rgba(249,115,22,0.35)",
      }}
    />
  ) : (
    <div style={{
      boxSizing: "border-box",
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(180deg, rgba(249,115,22,0.3), rgba(249,115,22,0.1))",
      border: "2px solid rgba(249,115,22,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 800, color: "rgba(245,245,245,0.95)",
    }}>
      {(profile.name.charAt(0) || "?").toUpperCase()}
    </div>
  );
}

function DoorButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: "none", cursor: "pointer",
        padding: "14px 32px",
        fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
        color: "#0a0a0a",
        background: "linear-gradient(180deg, #fed7aa 0%, #f97316 60%, #ea580c 100%)",
        border: "none", borderRadius: 999,
        boxShadow: "0 4px 20px rgba(249,115,22,0.55), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  appearance: "none",
  width: "78%",
  maxWidth: 320,
  padding: "12px 14px",
  fontSize: 14,
  color: "rgba(245,245,245,0.95)",
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10,
  outline: "none",
  fontFamily: "inherit",
};
