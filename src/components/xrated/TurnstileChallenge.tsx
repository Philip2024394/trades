"use client";

// Cloudflare Turnstile bot-challenge widget — STUB UI.
//
// When NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set, the component renders
// nothing and the parent form keeps working unchanged. When it's set,
// the public Turnstile script is loaded and a "managed" challenge is
// rendered into the placeholder div. The token surfaces via the
// `onToken` callback so the caller can attach it to the form submit.
//
// Server-side verification (against TURNSTILE_SECRET_KEY) belongs in
// the receiving API route — this component only mints the token.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
        }
      ) => string;
      reset?: (id?: string) => void;
    };
  }
}

export function TurnstileChallenge({
  onToken
}: {
  onToken: (token: string) => void;
}): React.ReactElement | null {
  const ref = useRef<HTMLDivElement | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const target = ref.current;

    function mount() {
      if (!window.turnstile || !target) return;
      window.turnstile.render(target, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token)
      });
    }

    if (window.turnstile) {
      mount();
      return;
    }

    const scriptId = "cf-turnstile-script";
    if (!document.getElementById(scriptId)) {
      const s = document.createElement("script");
      s.id = scriptId;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.onload = () => mount();
      document.head.appendChild(s);
    } else {
      // Already loading — poll briefly.
      const t = setInterval(() => {
        if (window.turnstile) {
          clearInterval(t);
          mount();
        }
      }, 200);
      return () => clearInterval(t);
    }
  }, [siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={ref} className="my-3" />;
}
