"use client";

// Blueprint card — decision-only info per PRD §6.

import type { BlueprintRow } from "./BlueprintBrowser";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const NEUTRAL = "#525252";

const VARIANT_COLORS: Record<string, { bg: string; ink: string }> = {
  corporate: { bg: "#F1F5F9", ink: "#0F172A" },
  industrial: { bg: "#111827", ink: "#F9FAFB" },
  tradesman: { bg: "#FFF7ED", ink: "#7C2D12" },
  premium: { bg: "#0A0A0A", ink: "#F5F5F5" },
  emergency: { bg: "#FEE2E2", ink: "#7F1D1D" },
  minimal: { bg: "#FFFFFF", ink: "#171717" }
};

export function BlueprintCard({
  blueprint,
  installing,
  onInstall,
  onPreview
}: {
  blueprint: BlueprintRow;
  installing: boolean;
  onInstall: () => void;
  onPreview: () => void;
}) {
  const variant = VARIANT_COLORS[blueprint.variant] ?? VARIANT_COLORS.minimal;
  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md"
      aria-label={blueprint.name}
    >
      {/* Mobile preview mock — a lightweight visual, real preview lands
          with the Playwright snapshot pipeline in Lane 4. */}
      <div
        className="relative aspect-[9/16] max-h-[280px] w-full overflow-hidden border-b border-neutral-100"
        style={{ background: variant.bg, color: variant.ink }}
      >
        <div className="absolute inset-0 p-4">
          <div
            className="mb-3 h-1 w-8 rounded-full opacity-60"
            style={{ background: variant.ink }}
          />
          <div
            className="mb-4 h-4 w-3/4 rounded"
            style={{ background: variant.ink, opacity: 0.85 }}
          />
          <div
            className="mb-2 h-2 w-full rounded"
            style={{ background: variant.ink, opacity: 0.3 }}
          />
          <div
            className="mb-2 h-2 w-5/6 rounded"
            style={{ background: variant.ink, opacity: 0.3 }}
          />
          <div className="mt-4 flex gap-2">
            <div
              className="h-7 rounded-md px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest"
              style={{ background: YELLOW, color: "#0A0A0A" }}
            >
              Call now
            </div>
            <div
              className="h-7 rounded-md px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest"
              style={{ background: "#25D366", color: "#FFFFFF" }}
            >
              WhatsApp
            </div>
          </div>
          <div className="mt-6 space-y-1.5">
            <div className="h-8 w-full rounded" style={{ background: variant.ink, opacity: 0.1 }} />
            <div className="h-8 w-full rounded" style={{ background: variant.ink, opacity: 0.1 }} />
            <div className="h-8 w-full rounded" style={{ background: variant.ink, opacity: 0.1 }} />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
          {blueprint.variant}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-[15px] font-extrabold leading-tight text-neutral-900">
            {blueprint.name}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-neutral-500">
            {blueprint.browserCard.oneLiner}
          </p>
        </div>

        {/* Rank reasons — only shown if we have any */}
        {blueprint.rankReasons.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {blueprint.rankReasons.slice(0, 3).map((r) => (
              <li
                key={r}
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                style={{ background: "#FEF3C7", color: "#78350F" }}
              >
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* Scores */}
        <div className="grid grid-cols-4 gap-2 border-t border-neutral-100 pt-3">
          <ScoreCell label="Conv" value={blueprint.score.conversion} />
          <ScoreCell label="Trust" value={blueprint.score.trust} />
          <ScoreCell label="Mob" value={blueprint.score.mobile} />
          <ScoreCell label="SEO" value={blueprint.score.seo} />
        </div>

        {/* Verified widgets */}
        {blueprint.requiredCredentials.length > 0 && (
          <div className="text-[10px] text-neutral-600">
            <span className="font-extrabold uppercase tracking-widest text-neutral-500">
              Verified widgets:{" "}
            </span>
            {blueprint.requiredCredentials
              .slice(0, 3)
              .map((c) => credentialLabel(c))
              .join(" · ")}
            {blueprint.requiredCredentials.length > 3 &&
              ` +${blueprint.requiredCredentials.length - 3}`}
          </div>
        )}

        {/* Sections included */}
        <div className="text-[10px] text-neutral-600">
          <span className="font-extrabold uppercase tracking-widest text-neutral-500">
            Apps auto-select:{" "}
          </span>
          {blueprint.suggestedApps.slice(0, 3).join(" · ")}
          {blueprint.suggestedApps.length > 3 &&
            ` +${blueprint.suggestedApps.length - 3}`}
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-3">
          <div>
            <p
              className="text-[9px] font-extrabold uppercase tracking-widest"
              style={{ color: NEUTRAL }}
            >
              Build time
            </p>
            <p className="text-[13px] font-extrabold text-neutral-900">
              ~{blueprint.browserCard.estimatedBuildMinutes} min
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onPreview}
              className="inline-flex h-10 items-center rounded-xl border border-neutral-300 bg-white px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onInstall}
              disabled={installing}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: YELLOW }}
            >
              {installing ? "Installing…" : "Use blueprint"}
            </button>
          </div>
        </div>

        {/* Price label */}
        <p
          className="text-center text-[9px] font-extrabold uppercase tracking-widest"
          style={{ color: GREEN }}
        >
          {blueprint.browserCard.priceLabel}
        </p>
      </div>
    </article>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? "#10B981" : value >= 75 ? "#FFB300" : "#DC2626";
  return (
    <div className="text-center">
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: NEUTRAL }}
      >
        {label}
      </p>
      <p
        className="text-[16px] font-extrabold leading-none"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

const CREDENTIAL_LABELS: Record<string, string> = {
  "gas-safe": "Gas Safe",
  niceic: "NICEIC",
  napit: "NAPIT",
  stroma: "STROMA",
  trustmark: "TrustMark",
  fmb: "FMB",
  mcs: "MCS",
  hetas: "HETAS",
  oftec: "OFTEC",
  fensa: "FENSA",
  certass: "CERTASS",
  chas: "CHAS",
  safecontractor: "SafeContractor",
  smas: "SMAS",
  constructionline: "Constructionline",
  ipaf: "IPAF",
  pasma: "PASMA",
  "waste-carrier": "Waste Carrier",
  "companies-house": "Companies House",
  vat: "VAT",
  "public-liability": "Public Liability",
  cscs: "CSCS"
};
function credentialLabel(scheme: string): string {
  return CREDENTIAL_LABELS[scheme] ?? scheme;
}
