"use client";

// src/app/nex-native/nex-socials/_intro-client.tsx
//
// NEX Socials · intro experience · founder-sealed 2026-10-07.
//
// Three states:
//
//   kind = "poster"    · fullscreen night-life hero + "Enter NEX Socials"
//                        CTA + "Skip to NEX Socials" ghost link
//   kind = "playing"   · fullscreen video playing with sound · skip link in corner
//   kind = "ended"     · very brief fade before router.push to the discover canvas
//
// Audio: user tap → video.play() → sound allowed. No autoplay fight.
// Mute/unmute toggle is offered during playback for anyone on
// headphones in public.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BG_URL = "/nex-socials/night-life-background.png";
const INTRO_SRC = "/nex-socials/intro.mp4";
const DISCOVER_HREF = "/nex-native/nex-socials/discover";

const NEX_NAVY = "#020914";
const NEX_ORANGE = "#FF7200";
const NEX_CYAN = "#00AFFF";
const NEX_TEXT = "#F2F5F8";
const NEX_TEXT_DIM = "rgba(242, 245, 248, 0.72)";

type Stage = "poster" | "playing" | "ended";

export function NexSocialsIntro() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stage, setStage] = useState<Stage>("poster");
  const [muted, setMuted] = useState(false);

  // Preload the <link rel="preload"> for the mp4 so playback is instant
  // once the user taps "Enter". We insert the link imperatively because
  // Next.js server-side preload hooks don't apply to a client-only route.
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = INTRO_SRC;
    link.type = "video/mp4";
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, []);

  const goToDiscover = useCallback(() => {
    router.push(DISCOVER_HREF);
  }, [router]);

  const onEnter = useCallback(() => {
    setStage("playing");
    // Attempt to play after state settles so the <video> element exists.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = false;
      v.play().catch(() => {
        // If audio-with-sound is still blocked, fall back to muted.
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {
          // Playback impossible → skip to discover.
          goToDiscover();
        });
      });
    });
  }, [goToDiscover]);

  const onEnded = useCallback(() => {
    setStage("ended");
    // Brief 220ms fade handled by CSS, then navigate.
    const t = window.setTimeout(goToDiscover, 220);
    return () => window.clearTimeout(t);
  }, [goToDiscover]);

  const onToggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  if (stage === "playing" || stage === "ended") {
    return (
      <main
        data-nex-socials-intro
        data-nex-socials-intro-stage={stage}
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          opacity: stage === "ended" ? 0 : 1,
          transition: "opacity 220ms ease",
          zIndex: 50,
        }}
      >
        <video
          ref={videoRef}
          data-nex-socials-intro-video
          src={INTRO_SRC}
          playsInline
          preload="auto"
          onEnded={onEnded}
          onClick={onToggleMute}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 16,
            top: "max(16px, env(safe-area-inset-top))",
            display: "flex",
            gap: 10,
            zIndex: 1,
          }}
        >
          <button
            type="button"
            data-nex-socials-intro-mute
            onClick={onToggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            style={ghostBtnStyle()}
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            data-nex-socials-intro-skip
            onClick={goToDiscover}
            aria-label="Skip intro"
            style={ghostBtnStyle()}
          >
            Skip
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      data-nex-socials-intro
      data-nex-socials-intro-stage="poster"
      style={{
        position: "fixed",
        inset: 0,
        background: `linear-gradient(180deg, rgba(2,9,20,0.35) 0%, rgba(2,9,20,0.80) 100%), url("${BG_URL}") center/cover no-repeat ${NEX_NAVY}`,
        color: NEX_TEXT,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding:
          "max(20px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom))",
        zIndex: 50,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 6,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: NEX_ORANGE }}>NEX</span>
          <span>SOCIALS</span>
        </span>
        <button
          type="button"
          data-nex-socials-intro-exit
          onClick={() => router.push("/nex-native/home")}
          aria-label="Exit NEX Socials"
          style={ghostBtnStyle()}
        >
          Exit
        </button>
      </header>

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 16,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: NEX_CYAN,
          }}
        >
          Social · Floating profiles
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            lineHeight: 1.15,
            fontWeight: 700,
            maxWidth: 520,
          }}
        >
          Meet the city tonight.
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: NEX_TEXT_DIM,
            maxWidth: 480,
          }}
        >
          Business openings, new friends, dating, nightlife partners.
          Everyone around you, floating in one place.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            maxWidth: 360,
            marginTop: 8,
          }}
        >
          <button
            type="button"
            data-nex-socials-intro-enter
            onClick={onEnter}
            style={primaryBtnStyle()}
          >
            Enter NEX Socials
          </button>
          <button
            type="button"
            data-nex-socials-intro-skip-poster
            onClick={goToDiscover}
            style={ghostBtnStyle({ wide: true })}
          >
            Skip intro · go straight to Socials
          </button>
        </div>
      </section>
    </main>
  );
}

function primaryBtnStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    padding: "16px 22px",
    background: NEX_ORANGE,
    color: "#1A1300",
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: "0.02em",
    boxShadow: "0 10px 28px rgba(255, 114, 0, 0.35)",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function ghostBtnStyle({ wide = false }: { wide?: boolean } = {}): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: wide ? "100%" : "auto",
    padding: wide ? "12px 18px" : "8px 14px",
    background: "rgba(2, 9, 20, 0.55)",
    color: NEX_TEXT,
    border: `1px solid rgba(0, 175, 255, 0.35)`,
    borderRadius: 999,
    fontSize: wide ? 14 : 12.5,
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    fontFamily: "inherit",
  };
}
