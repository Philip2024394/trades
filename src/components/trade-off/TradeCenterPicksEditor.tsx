"use client";

// TradeCenterPicksEditor — Trade Center Picks CRUD for the dashboard.
//
// One panel, two flows:
//   1. Picks list (default).
//   2. Add / Edit pick modal — product picker (dropdown of the
//      merchant's xrated products), status picker, optional
//      arrival_at date, optional expires_at date, 200-char note.
//
// Remove is a single-button action on each row (no modal — picks
// are merchant-self-managed, no audit trail needed).
//
// No image upload — picks borrow the product's cover image.
// Hard cap at 24 picks per listing (API also enforces).

import { useEffect, useMemo, useState } from "react";
import type {
  HammerexXratedTradeCenterPick,
  HammerexXratedProduct
} from "@/lib/supabase";
import { TradeCenterPicksStatusPicker } from "./TradeCenterPicksStatusPicker";
import {
  STATUS_LABELS,
  TradeCenterPickStatusChip,
  type TradeCenterPickStatusKey
} from "@/components/xrated/profile/merchant/TradeCenterPickStatusChip";

const MAX_PICKS = 24;
const WARN_AT = 21;
const NOTE_MAX = 200;
// Commercial-detail field limits — kept in lock-step with the DB CHECK
// constraints on the picks table and the validator in the upsert API.
const LONG_DESC_MAX = 1200;
const CTA_LABEL_MAX = 60;
const ARRIVAL_WINDOW_MAX = 60;

// Three-state toggle helper — stored as boolean | null; UI surfaces as
// Yes / No / Not specified. "Not specified" is the default so a fresh
// pick never accidentally claims either way.
type Tristate = "yes" | "no" | "unset";
function boolToTri(v: boolean | null | undefined): Tristate {
  if (v === true) return "yes";
  if (v === false) return "no";
  return "unset";
}
function triToBool(t: Tristate): boolean | null {
  if (t === "yes") return true;
  if (t === "no") return false;
  return null;
}

// Pence ⇄ pounds string for the optional CTA-price field. Empty string
// = unset (saves NULL). Stored canonical is pence.
function penceToPoundsInput(p: number | null | undefined): string {
  if (typeof p !== "number") return "";
  return (p / 100).toFixed(2).replace(/\.00$/, "");
}
function poundsInputToPence(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

type ProductLite = Pick<
  HammerexXratedProduct,
  "id" | "name" | "slug" | "cover_url"
>;

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; pick: HammerexXratedTradeCenterPick };

function isoDateOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function TradeCenterPicksEditor({
  slug,
  editToken,
  initialPicks,
  products
}: {
  slug: string;
  editToken: string;
  initialPicks: HammerexXratedTradeCenterPick[];
  products: ProductLite[];
}) {
  const [picks, setPicks] = useState<HammerexXratedTradeCenterPick[]>(initialPicks);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const productById = useMemo(() => {
    const m = new Map<string, ProductLite>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const count = picks.length;
  const atCap = count >= MAX_PICKS;
  const nearCap = count >= WARN_AT && count < MAX_PICKS;
  const noProducts = products.length === 0;

  async function removePick(pick: HammerexXratedTradeCenterPick) {
    setErr(null);
    setMsg(null);
    setBusyId(pick.id);
    try {
      const res = await fetch("/api/trade-off/trade-center-picks/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          pick_id: pick.id
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Remove failed.");
        return;
      }
      setPicks((prev) => prev.filter((x) => x.id !== pick.id));
      setMsg("Pick removed.");
    } catch {
      setErr("Network error.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Your picks</h2>
          <p className="mt-1 text-[13px] text-brand-muted">
            {count}/{MAX_PICKS} active &middot; banners render on your
            profile until you remove them or they expire.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setMsg(null);
            setMode({ kind: "create" });
          }}
          disabled={atCap || noProducts}
          className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-4 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add pick
        </button>
      </div>

      {noProducts && (
        <p className="rounded-lg border border-brand-line bg-brand-bg px-3 py-2 text-[13px] font-semibold text-brand-muted">
          Add at least one product to your Trade Center before pinning
          picks. Trade Center products live under the Shop Mode editor.
        </p>
      )}
      {nearCap && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-[13px] font-semibold text-brand-accent">
          You&rsquo;re close to the {MAX_PICKS}-pick cap ({count}/{MAX_PICKS}).
          Remove old picks to free slots.
        </p>
      )}
      {atCap && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300">
          Cap reached ({MAX_PICKS}/{MAX_PICKS}). Remove a pick before adding
          another.
        </p>
      )}

      {err && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
          {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-2 text-xs font-semibold text-brand-accent">
          {msg}
        </p>
      )}

      <PickList
        picks={picks}
        productById={productById}
        busyId={busyId}
        onEdit={(pick) => {
          setErr(null);
          setMsg(null);
          setMode({ kind: "edit", pick });
        }}
        onRemove={removePick}
      />

      {mode.kind === "create" && (
        <PickModal
          slug={slug}
          editToken={editToken}
          products={products}
          existingProductIds={new Set(picks.map((p) => p.product_id))}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={(pick) => {
            setPicks((prev) => [...prev, pick]);
            setMode({ kind: "list" });
            setMsg(`Pick added.`);
          }}
        />
      )}

      {mode.kind === "edit" && (
        <PickModal
          slug={slug}
          editToken={editToken}
          products={products}
          existingProductIds={
            new Set(
              picks
                .filter((p) => p.id !== mode.pick.id)
                .map((p) => p.product_id)
            )
          }
          editing={mode.pick}
          onCancel={() => setMode({ kind: "list" })}
          onSaved={(pick) => {
            setPicks((prev) =>
              prev.map((x) => (x.id === pick.id ? pick : x))
            );
            setMode({ kind: "list" });
            setMsg(`Pick updated.`);
          }}
        />
      )}
    </div>
  );
}

// ─── Pick list ────────────────────────────────────────────────────────

function PickList({
  picks,
  productById,
  busyId,
  onEdit,
  onRemove
}: {
  picks: HammerexXratedTradeCenterPick[];
  productById: Map<string, ProductLite>;
  busyId: string | null;
  onEdit: (pick: HammerexXratedTradeCenterPick) => void;
  onRemove: (pick: HammerexXratedTradeCenterPick) => void;
}) {
  if (picks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-brand-line bg-brand-bg px-4 py-6 text-center text-[13px] text-brand-muted">
        No picks yet. Tap &ldquo;+ Add pick&rdquo; to pin your first
        product banner.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {picks.map((pick) => {
        const product = productById.get(pick.product_id);
        const expired =
          pick.expires_at !== null &&
          new Date(pick.expires_at).getTime() < Date.now();
        return (
          <li
            key={pick.id}
            className="flex flex-wrap items-start gap-3 rounded-lg border border-brand-line bg-brand-bg p-3"
          >
            <div
              className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-brand-line bg-brand-surface"
              aria-hidden="true"
            >
              {product?.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.cover_url}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-brand-muted">
                  N/A
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <TradeCenterPickStatusChip status={pick.status} size="sm" />
                {expired && (
                  <span className="inline-flex items-center rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-300">
                    Expired
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-[13px] font-bold text-brand-text">
                {product?.name ?? "Unknown product"}
              </p>
              {pick.note && (
                <p className="mt-0.5 line-clamp-2 text-[13px] text-brand-muted">
                  {pick.note}
                </p>
              )}
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => onEdit(pick)}
                disabled={busyId === pick.id}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-surface px-3 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-50 sm:flex-none"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onRemove(pick)}
                disabled={busyId === pick.id}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-red-500/50 bg-red-500/10 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50 sm:flex-none"
              >
                {busyId === pick.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Pick modal ───────────────────────────────────────────────────────

function PickModal({
  slug,
  editToken,
  products,
  existingProductIds,
  editing,
  onCancel,
  onSaved
}: {
  slug: string;
  editToken: string;
  products: ProductLite[];
  existingProductIds: Set<string>;
  editing?: HammerexXratedTradeCenterPick;
  onCancel: () => void;
  onSaved: (pick: HammerexXratedTradeCenterPick) => void;
}) {
  const [productId, setProductId] = useState<string>(
    editing?.product_id ?? products.find((p) => !existingProductIds.has(p.id))?.id ?? ""
  );
  const [status, setStatus] = useState<TradeCenterPickStatusKey | null>(
    editing?.status ?? null
  );
  const [arrivalAt, setArrivalAt] = useState<string>(
    isoDateOnly(editing?.arrival_at ?? null)
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    isoDateOnly(editing?.expires_at ?? null)
  );
  const [note, setNote] = useState<string>(editing?.note ?? "");
  // Commercial-detail fields — all optional, all stored as NULL when
  // empty. Surface them collapsed under a <details> so the default
  // "add a pick" flow stays light.
  const [longDescription, setLongDescription] = useState<string>(
    editing?.long_description ?? ""
  );
  const [ctaPricePounds, setCtaPricePounds] = useState<string>(
    penceToPoundsInput(editing?.cta_price_pence ?? null)
  );
  const [ctaPriceLabel, setCtaPriceLabel] = useState<string>(
    editing?.cta_price_label ?? ""
  );
  const [arrivalWindowLabel, setArrivalWindowLabel] = useState<string>(
    editing?.arrival_window_label ?? ""
  );
  const [deliveryAvailable, setDeliveryAvailable] = useState<Tristate>(
    boolToTri(editing?.delivery_available)
  );
  const [installationAvailable, setInstallationAvailable] = useState<Tristate>(
    boolToTri(editing?.installation_available)
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!editing;
  const canSave =
    productId.length > 0 && status !== null && !saving;

  async function save() {
    if (!canSave || !status) return;
    setErr(null);
    setSaving(true);
    try {
      const res = await fetch("/api/trade-off/trade-center-picks/upsert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          edit_token: editToken,
          pick: {
            id: editing?.id,
            product_id: productId,
            status,
            arrival_at: dateInputToIso(arrivalAt),
            expires_at: dateInputToIso(expiresAt),
            note: note.trim().slice(0, NOTE_MAX) || null,
            sort_order: editing?.sort_order ?? 0,
            long_description:
              longDescription.trim().slice(0, LONG_DESC_MAX) || null,
            cta_price_pence: poundsInputToPence(ctaPricePounds),
            cta_price_label:
              ctaPriceLabel.trim().slice(0, CTA_LABEL_MAX) || null,
            arrival_window_label:
              arrivalWindowLabel.trim().slice(0, ARRIVAL_WINDOW_MAX) || null,
            delivery_available: triToBool(deliveryAvailable),
            installation_available: triToBool(installationAvailable)
          }
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Save failed.");
        return;
      }
      onSaved(j.pick as HammerexXratedTradeCenterPick);
    } catch {
      setErr("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={isEdit ? "Edit pick" : "Add pick"} onCancel={onCancel}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Product *
          </span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={isEdit}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent disabled:opacity-60"
          >
            <option value="">— Choose product —</option>
            {products.map((p) => {
              const taken = existingProductIds.has(p.id) && p.id !== productId;
              return (
                <option key={p.id} value={p.id} disabled={taken}>
                  {p.name}
                  {taken ? " (already pinned)" : ""}
                </option>
              );
            })}
          </select>
          {isEdit && (
            <p className="mt-1 text-[10px] uppercase tracking-widest text-brand-muted">
              Remove the pick to re-bind it to a different product.
            </p>
          )}
        </label>

        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
            Status *
          </p>
          <TradeCenterPicksStatusPicker
            value={status}
            onChange={(next) => setStatus(next)}
          />
          {status && (
            <p className="mt-1 text-[13px] text-brand-muted">
              {STATUS_LABELS[status].description}
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Arrival date (pre-order / new arrival)
          </span>
          <input
            type="date"
            value={arrivalAt}
            onChange={(e) => setArrivalAt(e.target.value)}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Expires on (optional — banner falls off after this date)
          </span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
            Note ({note.length}/{NOTE_MAX})
          </span>
          <textarea
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="One short line — what makes this pick worth a customer&rsquo;s attention."
            className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
          />
        </label>

        <details className="rounded-md border border-brand-line bg-brand-bg">
          <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-muted transition hover:text-brand-text">
            Commercial details (optional)
          </summary>
          <div className="space-y-4 border-t border-brand-line px-3 py-4">
            <p className="text-[13px] text-brand-muted">
              Fill whichever fields are relevant for this pick. Anything
              left blank renders nothing on the public detail page.
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
                Long description ({longDescription.length}/{LONG_DESC_MAX})
              </span>
              <textarea
                value={longDescription}
                maxLength={LONG_DESC_MAX}
                onChange={(e) => setLongDescription(e.target.value)}
                rows={5}
                placeholder="Tell the customer what makes this pick worth their attention — pricing context, availability, who it's for."
                className="block w-full rounded-md border border-brand-line bg-brand-surface px-3 py-2 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
                  Price (£) — numeric
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={ctaPricePounds}
                  onChange={(e) => setCtaPricePounds(e.target.value)}
                  placeholder="e.g. 8.50"
                  className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
                  Price label ({ctaPriceLabel.length}/{CTA_LABEL_MAX})
                </span>
                <input
                  type="text"
                  maxLength={CTA_LABEL_MAX}
                  value={ctaPriceLabel}
                  onChange={(e) => setCtaPriceLabel(e.target.value)}
                  placeholder="e.g. 20% off list, POA, from £450/pallet"
                  className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
                />
              </label>
            </div>
            <p className="text-[13px] text-brand-muted">
              Numeric price wins when both are set. Leave both blank to
              show &ldquo;Enquire for price&rdquo;.
            </p>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-brand-muted">
                Arrival / availability label ({arrivalWindowLabel.length}/
                {ARRIVAL_WINDOW_MAX})
              </span>
              <input
                type="text"
                maxLength={ARRIVAL_WINDOW_MAX}
                value={arrivalWindowLabel}
                onChange={(e) => setArrivalWindowLabel(e.target.value)}
                placeholder="e.g. End July 2026, Available immediately"
                className="block h-11 w-full rounded-md border border-brand-line bg-brand-surface px-3 text-[13px] text-brand-text outline-none focus:border-brand-accent"
              />
            </label>

            <TristateRow
              label="Delivery available"
              value={deliveryAvailable}
              onChange={setDeliveryAvailable}
            />
            <TristateRow
              label="Installation available"
              value={installationAvailable}
              onChange={setInstallationAvailable}
            />
          </div>
        </details>

        {err && (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
            {err}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="inline-flex h-11 items-center rounded-lg bg-brand-accent px-5 text-xs font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add pick"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-bg px-4 text-xs font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Tristate Yes / No / Not specified ────────────────────────────────

function TristateRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: Tristate;
  onChange: (next: Tristate) => void;
}) {
  const options: { key: Tristate; label: string }[] = [
    { key: "yes", label: "Yes" },
    { key: "no", label: "No" },
    { key: "unset", label: "Not specified" }
  ];
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`inline-flex h-11 items-center rounded-md border px-3 text-[13px] font-bold transition ${
                selected
                  ? "border-brand-accent bg-brand-accent text-black"
                  : "border-brand-line bg-brand-surface text-brand-text hover:border-brand-accent hover:text-brand-accent"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────

function ModalShell({
  title,
  children,
  onCancel
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-brand-line bg-brand-bg">
        <div className="flex items-center justify-between border-b border-brand-line bg-brand-surface px-4 py-3">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-brand-accent">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-md px-2 text-xs font-bold text-brand-muted transition hover:text-brand-text"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
