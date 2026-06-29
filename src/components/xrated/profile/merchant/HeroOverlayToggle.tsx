"use client";

// Yellow circular eye-toggle button (bottom-right) that hides/shows
// the wrapped overlay content on a banner image. Used on:
//   1. The Trade Center Picks rotating banner (Stuart's Yard Deals)
//   2. The pick detail page hero banner
//
// Lets a customer mute the overlay text (status chip, headlines, etc.)
// to see the unencumbered image — common ask on cinematic banners where
// the photo is the product.
//
// `stopPropagation` on click so tapping the eye doesn't trigger any
// parent link / navigation.

import { useState, type ReactNode } from "react";

const FADE_MS = 300;

export function HeroOverlayToggle({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity ${className}`}
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: `${FADE_MS}ms`
        }}
        aria-hidden={!visible}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible((v) => !v);
        }}
        className="absolute bottom-3 right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 shadow-md transition hover:opacity-90 sm:right-4"
        style={{ background: "#FFB300" }}
        aria-label={visible ? "Hide overlay text" : "Show overlay text"}
        aria-pressed={!visible}
      >
        {visible ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </>
  );
}
