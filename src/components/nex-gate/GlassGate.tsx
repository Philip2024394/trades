"use client";

// src/components/nex-gate/GlassGate.tsx
//
// NEX Glass Gate · reference-match composition · Philip 2026-09-07
//
// The entry experience. Three visible layers:
//
//   1. NexEnvironment · atmospheric blue world drifting behind
//      everything (blobs + slow lighting sweep + NEX orb with an
//      orbital ring).
//   2. Foreground · wordmark, tagline, sign-in form, create-account
//      row, and the small circular N mark at the bottom.
//   3. Reveal transition on successful auth (~1000ms) that fades the
//      foreground and brightens the orb, then hands off to /nexapp.
//
// Truth discipline (§17):
//   · The visual reveal ONLY starts after real auth succeeds.
//   · If Supabase can't be reached, the panel stays in an honest
//     error state and the environment stays behind the foreground.
//   · No mock success mode ships in this component.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { NexEnvironment } from "./NexEnvironment";
import { SignInPanel } from "./SignInPanel";
import styles from "./glass-gate.module.css";

/** Total duration of the reveal transition, in ms. Kept in sync with
 *  --gate-transition in glass-gate.module.css so the JS handoff to the
 *  router lines up with the visual end of the animation. */
const REVEAL_MS = 1000;

/** Where to send the user once the reveal completes. `/nexapp` is the
 *  canonical NEX home per the 2026-08-24 single-home doctrine. */
const HOME_ROUTE = "/nexapp";

export function GlassGate() {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Journey B · session restore (§24). If the user already holds a
  // valid Supabase session, bypass the gate and go straight to /nexapp.
  // Any error — including Supabase being unreachable — is treated as
  // "not authenticated" so the gate renders honestly and the user can
  // still see the atmosphere.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url  = process.env.NEXT_PUBLIC_NEX_SUPABASE_URL;
        const anon = process.env.NEXT_PUBLIC_NEX_SUPABASE_ANON_KEY;
        if (!url || !anon) return;
        const supabase = createBrowserClient(url, anon);
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data?.session?.user) router.replace(HOME_ROUTE);
      } catch {
        // Silent · unauthenticated is the correct fallback.
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleAuthenticated = () => {
    setOpening(true);
    timerRef.current = setTimeout(() => {
      router.push(HOME_ROUTE);
    }, REVEAL_MS);
  };

  return (
    <div
      className={`${styles.root} ${opening ? styles.opening : ""}`}
      data-testid="nex-gate"
      data-phase={opening ? "opening" : "idle"}
    >
      {/* Layer 1 · atmospheric world + orb. */}
      <NexEnvironment />

      {/* Layer 2 · foreground content. Positioned absolute against the
          viewport per reference coordinates (see glass-gate.module.css). */}
      <div className={styles.foreground}>
        <div className={styles.wordmark} aria-label="NEX">
          <span aria-hidden>NE</span>
          <span className={styles.wordmarkX} aria-hidden>X</span>
        </div>

        <div className={styles.tagline}>Your world is waiting.</div>

        <SignInPanel onAuthenticated={handleAuthenticated} />

        {/* Small circular N mark at the very bottom of the composition. */}
        <div className={styles.bottomMark} aria-hidden data-testid="nex-gate-bottom-mark">
          <span>N</span>
        </div>
      </div>
    </div>
  );
}
