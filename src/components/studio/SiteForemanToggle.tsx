"use client";

// Site-Foreman Mode toggle.
//
// PRD Feature #84 — flips the Studio to a high-contrast dark palette
// for editing in direct outdoor sunlight (roof, van, driveway).
// Persists to localStorage so the merchant's setting survives page
// reloads. Sets data-site-foreman="on" on <html> — CSS in globals.css
// applies the palette override only under .studio-shell so public
// pages are never affected.

import { useEffect, useState } from "react";

const STORAGE_KEY = "studio-site-foreman";

export function SiteForemanToggle() {
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") {
        setOn(true);
        document.documentElement.setAttribute("data-site-foreman", "on");
      }
    } catch {
      // localStorage unavailable — silently ignore
    }
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    if (next) {
      document.documentElement.setAttribute("data-site-foreman", "on");
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
    } else {
      document.documentElement.removeAttribute("data-site-foreman");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  // Avoid hydration flash — render nothing on the server / first client
  // paint until we've read localStorage.
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={
        on
          ? "Site-Foreman mode ON — high-contrast for sunlight"
          : "Site-Foreman mode — high-contrast for editing outdoors"
      }
      className="grid h-10 w-10 place-items-center rounded-lg border transition"
      style={{
        borderColor: on ? "#FFB300" : "#E5E5E5",
        background: on ? "#0A0A0A" : "#FFFFFF",
        color: on ? "#FFB300" : "#525252"
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Sun-with-hard-hat icon: circle sun + hard-hat cap */}
        <circle cx="12" cy="13" r="4" />
        <path d="M4 20h16" />
        <path d="M6 20a6 6 0 0 1 12 0" />
        <line x1="12" y1="3" x2="12" y2="5" />
        <line x1="5" y1="7" x2="6.5" y2="8.5" />
        <line x1="19" y1="7" x2="17.5" y2="8.5" />
      </svg>
    </button>
  );
}
