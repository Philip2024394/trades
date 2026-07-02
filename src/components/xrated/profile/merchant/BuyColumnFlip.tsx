"use client";

// BuyColumnFlip — 3D flip card wrapper around the PDP buy column.
//
// Front face = the full product buy column (title, price, qty, bulk,
// CTAs). Back face = the Material Calculator with its own close header.
// The flip is triggered by `<CalcOpenButton>`, which is rendered inside
// the BuyColumnDetails right-action slot (where the Ref code used to
// live). The Ref code has moved onto the gallery image overlay.
//
// Height handling: both faces share the same CSS grid cell so the
// container is as tall as the taller face. When the calculator is
// taller than the front face the container grows; harmless because the
// rest of the page flow is below.
//
// Context — exposes { open, setOpen } so the calc-open button (front
// face, top right of BuyColumnDetails) and the in-card Close button
// (back face header) both toggle the same state without prop drilling.

import { createContext, useContext, useState, type ReactNode } from "react";

type FlipCtx = {
  open: boolean;
  hasCalculator: boolean;
  setOpen: (v: boolean) => void;
};

const FlipContext = createContext<FlipCtx>({
  open: false,
  hasCalculator: false,
  setOpen: () => {}
});

export function useCalcFlip(): FlipCtx {
  return useContext(FlipContext);
}

export function BuyColumnFlip({
  hasCalculator,
  back,
  children
}: {
  hasCalculator: boolean;
  back: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ctx: FlipCtx = { open, hasCalculator, setOpen };

  if (!hasCalculator) {
    return (
      <FlipContext.Provider value={ctx}>
        <div className="flex flex-col gap-3">{children}</div>
      </FlipContext.Provider>
    );
  }

  // Render ONLY the visible face. The earlier 3D grid-stack flip caused
  // a huge whitespace gap under the front face because both faces shared
  // the same grid cell and the container sized itself to the (much
  // taller) calculator back. Swap-render keeps the column height = the
  // visible face's natural height.
  return (
    <FlipContext.Provider value={ctx}>
      <div className="relative">
        {!open ? (
          <div
            key="front"
            className="flex flex-col gap-3"
            style={{ animation: "buy-col-fade 200ms ease-out" }}
          >
            {children}
          </div>
        ) : (
          <div
            key="back"
            className="flex flex-col gap-3"
            style={{ animation: "buy-col-fade 200ms ease-out" }}
          >
            <div
              className="flex items-center justify-between gap-3 rounded-2xl border-2 bg-neutral-50 px-4 py-3"
              style={{ borderColor: "#FFB300" }}
            >
              <div className="flex items-center gap-2 text-neutral-900">
                <CalculatorIcon size={18} />
                <h3 className="text-[13px] font-extrabold uppercase tracking-widest">
                  Material Calculator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[12px] font-extrabold uppercase tracking-wider text-white transition active:scale-95 hover:bg-[#0F7A3F]"
                aria-label="Close calculator"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
            {back}
          </div>
        )}
        <style>{`
          @keyframes buy-col-fade {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </FlipContext.Provider>
  );
}

// Small calculator icon button — rendered in the BuyColumnDetails right
// slot in place of the Ref text. Tap → flip to calculator.
export function CalcOpenButton() {
  const { hasCalculator, setOpen, open } = useCalcFlip();
  if (!hasCalculator) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label="Open material calculator"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-extrabold uppercase tracking-wider text-black transition hover:opacity-90 active:scale-95"
      style={{ background: "#FFB300" }}
    >
      <CalculatorIcon size={14} />
      Calculator
    </button>
  );
}

function CalculatorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="3" />
      <circle cx="8.5" cy="12" r="0.6" fill="currentColor" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="12" r="0.6" fill="currentColor" />
      <circle cx="8.5" cy="15" r="0.6" fill="currentColor" />
      <circle cx="12" cy="15" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="15" r="0.6" fill="currentColor" />
      <circle cx="8.5" cy="18" r="0.6" fill="currentColor" />
      <circle cx="12" cy="18" r="0.6" fill="currentColor" />
      <circle cx="15.5" cy="18" r="0.6" fill="currentColor" />
    </svg>
  );
}
