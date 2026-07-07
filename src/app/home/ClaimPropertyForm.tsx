// Homeowner enters their real address — 2 address lines + city + postcode.
// Optional role picker (default: occupier).

"use client";

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";

export function ClaimPropertyForm({
  initialPostcode = "",
  onDone
}: {
  initialPostcode?: string;
  onDone: () => void;
}) {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState(initialPostcode);
  const [role, setRole] = useState<"owner" | "occupier" | "agent">("owner");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/os/properties/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          addressLines: [line1, line2].filter((l) => l.trim().length > 0),
          city: city || null,
          postcode,
          role
        })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not save your address.");
        return;
      }
      onDone();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="block text-[13px] font-semibold text-neutral-700">
          Address line 1
        </label>
        <input
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="e.g. 4 Elm Grove"
          required
          className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
        />
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-neutral-700">
          Address line 2 (optional)
        </label>
        <input
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          placeholder="e.g. Flat 3"
          className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[13px] font-semibold text-neutral-700">
            City / Town
          </label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Nottingham"
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 text-[14px] outline-none focus:border-neutral-900"
          />
        </div>
        <div>
          <label className="block text-[13px] font-semibold text-neutral-700">
            Postcode
          </label>
          <input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            required
            className="mt-1 block min-h-[44px] w-full rounded-lg border border-neutral-200 bg-white px-3 font-mono text-[14px] outline-none focus:border-neutral-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-[13px] font-semibold text-neutral-700">
          Your role
        </label>
        <div className="mt-1 flex gap-2">
          {(["owner", "occupier", "agent"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`min-h-[40px] rounded-full border px-3 text-[13px] font-semibold capitalize transition ${
                role === r
                  ? "border-neutral-900 bg-neutral-900 text-[#1B1A17]"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 text-[14px] font-semibold text-[#1B1A17] transition hover:bg-neutral-800 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" aria-hidden />
            Save address
          </>
        )}
      </button>
    </form>
  );
}
