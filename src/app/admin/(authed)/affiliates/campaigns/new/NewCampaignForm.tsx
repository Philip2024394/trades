"use client";

import { useState } from "react";

export function NewCampaignForm(): React.ReactElement {
  const [kind, setKind] = useState<"competition" | "bonus" | "seasonal">("bonus");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [bonusPence, setBonusPence] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [prizePence, setPrizePence] = useState(0);
  const [prizeCount, setPrizeCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/affiliates/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          description,
          starts_at: startsAt ? new Date(startsAt).toISOString() : null,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
          bonus_pence: Number(bonusPence) || 0,
          multiplier: Number(multiplier) || 1,
          prize_pence: Number(prizePence) || 0,
          prize_count: Number(prizeCount) || 0
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error ?? "Could not create campaign.");
        return;
      }
      window.location.href = "/admin/affiliates/campaigns";
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-[13px]">
      <label className="block">
        <span className="font-bold text-brand-text">Kind</span>
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "competition" | "bonus" | "seasonal")
          }
          className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        >
          <option value="bonus">Bonus (extra value on every commission)</option>
          <option value="seasonal">Seasonal (themed bonus window)</option>
          <option value="competition">Competition (prize at end)</option>
        </select>
      </label>
      <label className="block">
        <span className="font-bold text-brand-text">Title</span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
        />
      </label>
      <label className="block">
        <span className="font-bold text-brand-text">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] text-brand-text"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-bold text-brand-text">Starts</span>
          <input
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
          />
        </label>
        <label className="block">
          <span className="font-bold text-brand-text">Ends</span>
          <input
            type="datetime-local"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-bold text-brand-text">Bonus pence</span>
          <input
            type="number"
            min={0}
            value={bonusPence}
            onChange={(e) => setBonusPence(Number(e.target.value))}
            className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
          />
          <span className="mt-1 block text-[13px] text-brand-muted">
            Added to base £10. Use 500 to add £5.
          </span>
        </label>
        <label className="block">
          <span className="font-bold text-brand-text">Multiplier</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text"
          />
          <span className="mt-1 block text-[13px] text-brand-muted">
            Multiplies base £10. Use 2 to double the base.
          </span>
        </label>
      </div>
      {kind === "competition" && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-line bg-brand-bg p-3">
          <label className="block">
            <span className="font-bold text-brand-text">Prize pence</span>
            <input
              type="number"
              min={0}
              value={prizePence}
              onChange={(e) => setPrizePence(Number(e.target.value))}
              className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text"
            />
          </label>
          <label className="block">
            <span className="font-bold text-brand-text">Prize count</span>
            <input
              type="number"
              min={0}
              value={prizeCount}
              onChange={(e) => setPrizeCount(Number(e.target.value))}
              className="mt-1 block h-10 w-full rounded-lg border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text"
            />
            <span className="mt-1 block text-[13px] text-brand-muted">
              Top N affiliates get the prize.
            </span>
          </label>
        </div>
      )}
      {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-accent px-6 text-[13px] font-bold text-black disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create campaign"}
      </button>
    </form>
  );
}
