"use client";

// Xrated Trades — standalone operating hours editor.
//
// Extracted from the inline editor that lived in PremiumCustomisationPanel
// so it can sit on its own sub-route (/edit/<slug>/operating-hours) like
// every other feature page. Saves directly to /api/trade-off/update with
// just the `operating_hours` field — no other premium-form state in flight.
//
// Available to every tier — the AvailabilityPill on the public profile
// reads these hours regardless of paid status, so even a free profile
// can set "Mon-Fri 8am-5pm, Sat 8am-1pm" and have customers see a
// real "Back online at 7:00 AM" message instead of a permanent
// "Currently offline".

import { useState } from "react";

type Slot = { open: string; close: string } | null;
type HoursMap = Record<string, Slot>;

const DAY_ROW: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" }
];

const DEFAULT_HOURS: HoursMap = {
  mon: { open: "08:00", close: "17:00" },
  tue: { open: "08:00", close: "17:00" },
  wed: { open: "08:00", close: "17:00" },
  thu: { open: "08:00", close: "17:00" },
  fri: { open: "08:00", close: "17:00" },
  sat: { open: "08:00", close: "13:00" },
  sun: null
};

export function OperatingHoursEditor({
  slug,
  editToken,
  initialHours
}: {
  slug: string;
  editToken: string;
  initialHours: HoursMap | null;
}) {
  const [hours, setHours] = useState<HoursMap>(
    initialHours && Object.keys(initialHours).length > 0
      ? initialHours
      : DEFAULT_HOURS
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setSlot(day: string, slot: Slot) {
    setHours((h) => ({ ...h, [day]: slot }));
    setSavedAt(null);
  }

  function applyWeekdays() {
    const weekday: Slot = { open: "08:00", close: "17:00" };
    setHours({
      mon: weekday,
      tue: weekday,
      wed: weekday,
      thu: weekday,
      fri: weekday,
      sat: { open: "08:00", close: "13:00" },
      sun: null
    });
    setSavedAt(null);
  }

  function applyAllClosed() {
    setHours({
      mon: null,
      tue: null,
      wed: null,
      thu: null,
      fri: null,
      sat: null,
      sun: null
    });
    setSavedAt(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/trade-off/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          token: editToken,
          operating_hours: hours
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(`Save failed (${res.status}): ${txt.slice(0, 120)}`);
        return;
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Network error saving hours"
      );
    } finally {
      setSaving(false);
    }
  }

  const justSaved = savedAt && Date.now() - savedAt < 4000;

  return (
    <div className="space-y-5">
      {/* Quick presets */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={applyWeekdays}
          className="inline-flex h-10 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Apply Mon–Fri 8–5, Sat 8–1
        </button>
        <button
          type="button"
          onClick={applyAllClosed}
          className="inline-flex h-10 items-center rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
        >
          Mark every day closed
        </button>
      </div>

      {/* Day rows */}
      <ul className="space-y-2">
        {DAY_ROW.map(({ key, label }) => {
          const slot = hours[key] ?? null;
          const closed = !slot;
          return (
            <li
              key={key}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border border-brand-line bg-brand-surface px-3 py-2.5"
            >
              <span className="col-span-12 text-[13px] font-bold text-brand-text sm:col-span-3">
                {label}
              </span>
              <label className="col-span-4 inline-flex items-center gap-1.5 text-[13px] text-brand-muted sm:col-span-2">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) =>
                    setSlot(
                      key,
                      e.target.checked
                        ? null
                        : { open: "08:00", close: "17:00" }
                    )
                  }
                  className="h-4 w-4 accent-brand-accent"
                />
                Closed
              </label>
              <input
                type="time"
                disabled={closed}
                value={slot?.open ?? ""}
                onChange={(e) =>
                  setSlot(key, {
                    open: e.target.value,
                    close: slot?.close ?? "17:00"
                  })
                }
                className="col-span-4 h-11 rounded-md border border-brand-line bg-brand-bg px-2 text-[13px] text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none sm:col-span-3"
                aria-label={`${label} open time`}
              />
              <input
                type="time"
                disabled={closed}
                value={slot?.close ?? ""}
                onChange={(e) =>
                  setSlot(key, {
                    open: slot?.open ?? "08:00",
                    close: e.target.value
                  })
                }
                className="col-span-4 h-11 rounded-md border border-brand-line bg-brand-bg px-2 text-[13px] text-brand-text disabled:opacity-40 focus:border-brand-accent focus:outline-none sm:col-span-4"
                aria-label={`${label} close time`}
              />
            </li>
          );
        })}
      </ul>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center rounded-xl bg-brand-accent px-6 text-[13px] font-extrabold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save operating hours"}
        </button>
        {justSaved && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-600">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Saved
          </span>
        )}
        {error && (
          <span className="text-[13px] font-bold text-red-600">{error}</span>
        )}
      </div>

      <p className="text-[13px] text-brand-muted">
        Customers see a live <span className="font-bold text-brand-text">Available now</span>{" "}
        or <span className="font-bold text-brand-text">Back online at 7:00 AM</span> badge on
        your profile based on these hours. Set them once and the badge updates
        automatically as the day progresses.
      </p>
    </div>
  );
}

export default OperatingHoursEditor;
