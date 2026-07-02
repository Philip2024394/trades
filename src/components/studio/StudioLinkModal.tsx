"use client";

// StudioLinkModal — edit a button's href.
//
// Opened when the toolbar's Link tool fires for a button-priority
// element. The editor derives the sibling href field from the label
// element key by convention (primaryCtaLabel → primaryCtaHref).
// Merchant types a URL, we save to config[hrefKey] via saveConfigField.
// Special-cased `#whatsapp` is preserved — the renderer already swaps
// it for the merchant's WhatsApp URL at render time.

import { useEffect, useState } from "react";

const YELLOW = "#FFB300";

type Props = {
  instanceId: string;
  labelKey: string;
  hrefKey: string;
  currentValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
};

export function StudioLinkModal({
  instanceId,
  labelKey,
  hrefKey,
  currentValue,
  onSave,
  onClose
}: Props) {
  const [value, setValue] = useState(currentValue);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    onSave(value.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Edit link"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            Link
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            Where does this button go?
          </h2>
          <p className="mt-1 truncate text-[11px] font-mono text-neutral-400">
            {instanceId} · {hrefKey}
          </p>
        </header>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              URL or path
            </span>
            <input
              type="text"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
              className="mt-1 block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 font-mono text-[12px] focus:border-neutral-500 focus:outline-none"
              placeholder="/plant-hire/machines"
            />
          </label>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
            <p className="font-bold text-neutral-800">Special values</p>
            <ul className="mt-1 space-y-0.5">
              <li>
                <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                  #whatsapp
                </code>{" "}
                — opens WhatsApp with your business number.
              </li>
              <li>
                <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                  tel:07…
                </code>{" "}
                — tap-to-call on mobile.
              </li>
              <li>
                <code className="rounded bg-white px-1 py-0.5 font-mono text-[10px]">
                  mailto:…
                </code>{" "}
                — open the merchant&rsquo;s email client.
              </li>
              <li>Anything starting with <code>/</code> stays on your site.</li>
            </ul>
          </div>

          <p className="text-[11px] text-neutral-500">
            The visible button text (
            <code className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-[10px]">
              {labelKey}
            </code>
            ) stays as-is — press Enter on the button to edit that too.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
            style={{ background: "#0A0A0A" }}
          >
            Save link →
          </button>
        </footer>
      </div>
    </div>
  );
}
