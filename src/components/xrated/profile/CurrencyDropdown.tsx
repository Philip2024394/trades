"use client";

// CurrencyDropdown — display-only currency picker pill for the Xrated PDP.
//
// Canonical price is always GBP. This widget lets a customer flip the
// displayed price into USD/EUR/AUD using indicative rates from
// src/lib/fx.ts. The choice is persisted in localStorage so it survives
// page navigation, and broadcast on a window CustomEvent so PriceDisplay
// (or anything else listening) can re-render without prop drilling.
//
// House rules: 13px floor, yellow accent #FFB300. The dropdown panel
// pulls from a closed list of supported codes — we deliberately do not
// expose every entry in FX (IDR / SGD / MYR / VND aren't relevant to a
// UK trades audience yet).

import { useEffect, useRef, useState } from "react";
import { FX } from "@/lib/fx";

export const SUPPORTED_DISPLAY_CURRENCIES = ["GBP", "USD", "EUR", "AUD"] as const;
export type DisplayCurrency = typeof SUPPORTED_DISPLAY_CURRENCIES[number];

export const CURRENCY_STORAGE_KEY = "xrated_currency";
export const CURRENCY_CHANGE_EVENT = "xrated:currency-change";

const CURRENCY_LABEL: Record<DisplayCurrency, { symbol: string; flag: string }> = {
  GBP: { symbol: FX.GBP.symbol, flag: "\u{1F1EC}\u{1F1E7}" },
  USD: { symbol: FX.USD.symbol, flag: "\u{1F1FA}\u{1F1F8}" },
  EUR: { symbol: FX.EUR.symbol, flag: "\u{1F1EA}\u{1F1FA}" },
  AUD: { symbol: FX.AUD.symbol, flag: "\u{1F1E6}\u{1F1FA}" }
};

function readStoredCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return "GBP";
  try {
    const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (raw && (SUPPORTED_DISPLAY_CURRENCIES as readonly string[]).includes(raw)) {
      return raw as DisplayCurrency;
    }
  } catch {
    // SSR / private mode — fall through to default.
  }
  return "GBP";
}

export function CurrencyDropdown() {
  const [current, setCurrent] = useState<DisplayCurrency>("GBP");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Hydrate from localStorage and listen for in-tab events so multiple
  // CurrencyDropdown instances (unlikely but possible) stay in sync.
  useEffect(() => {
    setCurrent(readStoredCurrency());
    function onChange(e: Event) {
      const ce = e as CustomEvent<{ currency: DisplayCurrency }>;
      if (ce.detail?.currency) setCurrent(ce.detail.currency);
    }
    window.addEventListener(CURRENCY_CHANGE_EVENT, onChange as EventListener);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange as EventListener);
    };
  }, []);

  // Click-outside closes the menu.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(code: DisplayCurrency) {
    setCurrent(code);
    setOpen(false);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
    } catch {
      // Quota / private mode — ignore.
    }
    window.dispatchEvent(
      new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: { currency: code } })
    );
  }

  const label = CURRENCY_LABEL[current];
  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change displayed currency"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 transition hover:border-[#FFB300]"
      >
        <span aria-hidden="true">{label.flag}</span>
        <span>
          {current} {label.symbol}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`transition ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Currency"
          className="absolute left-0 top-11 z-30 min-w-[160px] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl"
        >
          {SUPPORTED_DISPLAY_CURRENCIES.map((code) => {
            const meta = CURRENCY_LABEL[code];
            const active = code === current;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(code)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-extrabold transition ${
                    active
                      ? "bg-[#FFB300] text-neutral-900"
                      : "bg-white text-neutral-800 hover:bg-neutral-100"
                  }`}
                >
                  <span aria-hidden="true">{meta.flag}</span>
                  <span>
                    {code} {meta.symbol}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CurrencyDropdown;
