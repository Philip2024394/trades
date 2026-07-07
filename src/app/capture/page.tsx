// /capture — the merchant's primary action surface.
//
// One tap from the home screen. Photos + a handful of chips + one
// "Post" button. Emits a business event, feed projection composes the
// post, 60-min approval buffer starts.
//
// This is the whole growth engine as far as the tradesperson is
// concerned. Everything else is invisible.

"use client";

import { useState } from "react";
import { ArrowLeft, Camera, CheckCircle2, Loader2, X } from "lucide-react";
import Link from "next/link";

type Stage = "started" | "in_progress" | "completed";

const TRADE_OPTIONS = [
  "builder",
  "plumber",
  "electrician",
  "roofer",
  "landscaper",
  "carpenter",
  "decorator",
  "groundworker",
  "driveway_installer",
  "kitchen_fitter",
  "bathroom_installer",
  "window_installer",
  "plasterer"
] as const;

const SERVICE_BY_TRADE: Record<string, string[]> = {
  builder: ["extension", "loft_conversion", "new_build", "refurb"],
  plumber: ["boiler_install", "leak_repair", "bathroom_install", "radiator"],
  electrician: ["rewire", "consumer_unit", "ev_charger", "downlight"],
  roofer: ["slate_re_tile", "concrete_re_tile", "flat_roof", "valley_lead"],
  landscaper: ["patio", "decking", "artificial_grass", "garden_wall"],
  carpenter: ["skirting", "kitchen", "loft_ladders", "internal_doors"],
  decorator: ["interior_paint", "wallpaper", "exterior_paint"],
  groundworker: ["drainage", "foundations", "trenching"],
  driveway_installer: ["resin_bound", "block_paving", "tarmac", "gravel"],
  kitchen_fitter: ["full_refurb", "worktop_replacement", "island_install"],
  bathroom_installer: ["full_refurb", "wet_room", "walk_in_shower"],
  window_installer: ["upvc_windows", "sash_replacement", "bi_fold"],
  plasterer: ["skim", "re_plaster", "float_and_set"]
};

const MATERIAL_LIBRARY: Record<string, string[]> = {
  roofer: ["welsh_slate", "spanish_slate", "concrete_tile", "clay_tile", "lead"],
  landscaper: ["sandstone", "porcelain", "limestone", "granite", "resin"],
  driveway_installer: ["resin", "block_paving", "tarmac", "gravel"],
  builder: ["brick", "block", "steel", "timber"],
  carpenter: ["oak", "pine", "walnut", "mdf"],
  kitchen_fitter: ["oak", "quartz", "granite", "laminate"],
  bathroom_installer: ["porcelain", "ceramic", "marble", "vinyl"]
};

export default function CapturePage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg bg-neutral-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Cancel"
            className="rounded-md p-1 text-neutral-500 transition hover:bg-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="text-[13px] font-semibold text-neutral-900">
              Record today&apos;s work
            </div>
            <div className="text-[11px] text-neutral-500">
              Post to your website in one tap
            </div>
          </div>
        </div>
      </header>
      <CaptureFlow />
    </main>
  );
}

function CaptureFlow() {
  const [photos, setPhotos] = useState<
    Array<{ id: string; dataUrl: string }>
  >([]);
  const [trade, setTrade] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [materials, setMaterials] = useState<string[]>([]);
  const [postcode, setPostcode] = useState<string>("");
  const [stage, setStage] = useState<Stage>("in_progress");
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [consentNotRequired, setConsentNotRequired] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    scheduledFor: string;
    slug: string;
    postId?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const services = SERVICE_BY_TRADE[trade] ?? [];
  const materialSuggestions = MATERIAL_LIBRARY[trade] ?? [];

  const consentReady = consentGranted || consentNotRequired;
  const canSubmit =
    !busy &&
    photos.length > 0 &&
    trade &&
    (stage !== "completed" || service) &&
    consentReady;

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .slice(0, 8 - photos.length)
      .forEach((f) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setPhotos((prev) => [
              ...prev,
              {
                id: `p-${Math.random().toString(36).slice(2, 8)}`,
                dataUrl: reader.result as string
              }
            ]);
          }
        };
        reader.readAsDataURL(f);
      });
  };

  const toggleMaterial = (m: string) => {
    setMaterials((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Demo merchant identity for now; production reads from session.
      const merchantId = "demo-merchant";
      const eventType = stage === "completed" ? "job_completed" : "work_captured";
      const jobId = `job-${Date.now().toString(36)}`;
      const idempotencyKey = `${jobId}-${eventType}`;
      const consentState = consentGranted
        ? "granted"
        : consentNotRequired
        ? "not_required"
        : "pending";
      const res = await fetch("/api/events/emit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId,
          eventType,
          idempotencyKey,
          payload: {
            job_id: jobId,
            trade,
            service,
            materials,
            postcode: postcode.toUpperCase(),
            stage,
            consent_state: consentState,
            // In production these are uploaded to Storage first + real URLs
            // stored here. For MVP we pass data URLs so the demo works
            // without S3.
            photo_urls: photos.map((p) => p.dataUrl)
          }
        })
      });
      if (!res.ok) throw new Error(`emit returned ${res.status}`);
      const data = (await res.json()) as {
        projections: Array<{
          projectionType: string;
          status: string;
          reason?: string;
          targetRef?: { slug?: string; feedPostId?: string; scheduledFor?: string };
        }>;
      };
      const feedOutcome = data.projections.find(
        (p) => p.projectionType === "website_update"
      );
      if (
        feedOutcome &&
        feedOutcome.status === "done" &&
        feedOutcome.targetRef?.scheduledFor
      ) {
        setResult({
          scheduledFor: feedOutcome.targetRef.scheduledFor,
          slug: feedOutcome.targetRef.slug ?? "",
          postId: feedOutcome.targetRef.feedPostId
        });
      } else if (feedOutcome && feedOutcome.status === "held") {
        setError(feedOutcome.reason ?? "post was held — check activity");
      } else {
        setError("event recorded but no feed post created");
      }
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const time = new Date(result.scheduledFor);
    const minutes = Math.max(1, Math.round((time.getTime() - Date.now()) / 60000));
    return (
      <div className="px-4 py-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <div className="text-[15px] font-bold text-neutral-900">
                Queued for your website
              </div>
              <div className="mt-1 text-[13px] text-neutral-700">
                Publishing in about {minutes} minutes. Tap Hold if you want to
                pause it — otherwise it goes live automatically.
              </div>
              <div className="mt-3 flex gap-2">
                {result.postId ? (
                  <HoldButton postId={result.postId} />
                ) : null}
                <Link
                  href="/feed/demo-merchant"
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-neutral-50"
                >
                  View live feed
                </Link>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setPhotos([]);
            setService("");
            setMaterials([]);
          }}
          className="mt-4 w-full rounded-full bg-neutral-900 py-2.5 text-[13px] font-semibold text-white transition hover:bg-neutral-800"
        >
          Record another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <section>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Photos
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-neutral-200"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.dataUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {photos.length < 8 ? (
            <label
              htmlFor="photo-input"
              className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-neutral-300 bg-white text-neutral-500 transition hover:border-neutral-400"
            >
              <Camera className="h-5 w-5" />
              <span className="text-[10px] font-medium">Add</span>
              <input
                id="photo-input"
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.currentTarget.files)}
              />
            </label>
          ) : null}
        </div>
      </section>

      <section>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Trade
          </span>
          <select
            value={trade}
            onChange={(e) => {
              setTrade(e.currentTarget.value);
              setService("");
              setMaterials([]);
            }}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px]"
          >
            <option value="">Pick a trade…</option>
            {TRADE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </section>

      {trade ? (
        <section>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Service {stage === "completed" ? "" : "(optional)"}
            </span>
            <select
              value={service}
              onChange={(e) => setService(e.currentTarget.value)}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px]"
            >
              <option value="">Pick a service…</option>
              {services.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      {materialSuggestions.length > 0 ? (
        <section>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Materials (tap all that apply)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {materialSuggestions.map((m) => {
              const selected = materials.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMaterial(m)}
                  className={`rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition ${
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  {m.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Postcode district
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.currentTarget.value.toUpperCase())}
            placeholder="LS6"
            maxLength={4}
            className="w-32 rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-[13px] uppercase tracking-widest"
          />
        </label>
      </section>

      <section>
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Stage
        </div>
        <div className="flex gap-2">
          {(["started", "in_progress", "completed"] as Stage[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`flex-1 rounded-full border-2 px-2.5 py-1.5 text-[11px] font-medium transition ${
                stage === s
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {s === "in_progress" ? "In progress" : s === "completed" ? "Completed" : "Started"}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Customer permission
        </div>
        <label className="flex items-start gap-2 text-[12px] text-neutral-800">
          <input
            type="checkbox"
            checked={consentGranted}
            onChange={(e) => {
              setConsentGranted(e.currentTarget.checked);
              if (e.currentTarget.checked) setConsentNotRequired(false);
            }}
            className="mt-0.5"
          />
          Customer has said we can share these photos
        </label>
        <label className="mt-1 flex items-start gap-2 text-[12px] text-neutral-700">
          <input
            type="checkbox"
            checked={consentNotRequired}
            onChange={(e) => {
              setConsentNotRequired(e.currentTarget.checked);
              if (e.currentTarget.checked) setConsentGranted(false);
            }}
            className="mt-0.5"
          />
          Not applicable (public site, no customer property visible)
        </label>
        {!consentReady ? (
          <div className="mt-2 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900">
            Without permission the post will be held for you to release later
            — a light safeguard so a photo of a customer&apos;s house never
            goes live by accident.
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-800">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="sticky bottom-4 mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-3 text-[14px] font-bold text-neutral-900 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Recording…" : "Post everywhere it fits →"}
      </button>
    </div>
  );
}

function HoldButton({ postId }: { postId: string }) {
  const [held, setHeld] = useState(false);
  const [busy, setBusy] = useState(false);
  if (held) {
    return (
      <span className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[12px] font-medium text-neutral-600">
        Held — release from feed page
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/feed/hold/${postId}`, {
          method: "POST",
          headers: { "x-merchant-id": "demo-merchant" }
        });
        setHeld(true);
        setBusy(false);
      }}
      className="rounded-full bg-neutral-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-50"
    >
      Hold
    </button>
  );
}
