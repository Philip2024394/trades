// /tc/jobs/new-site — Create a Site Project with a validated address.
//
// Trade adds a site project with:
//   - Site name ("Watson job")
//   - Address (via 3-mode SiteAddressInput)
//   - Optional directions ("second gate on left")
//   - Customer name (optional)
//
// Fixture-mode: creates a local entry, redirects to Site Projects.
// Production: POST /api/site-projects → creates row + geocodes.

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  ShieldCheck,
  MapPin,
  Info,
  Compass
} from "lucide-react";
import { MarketplaceHeader } from "@/apps/marketplace/components/MarketplaceHeader";
import { SiteAddressInput, type SiteAddress } from "@/apps/jobs/components/SiteAddressInput";

const SITE_PROJECTS_API = "/api/apps/notebook/site-projects";
const SITE_PROJECTS_CACHE_KEY = "tc.site-projects.demo";

export default function NewSitePage() {
  const router = useRouter();
  const [step, setStep] = useState<"address" | "details">("address");
  const [siteName, setSiteName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [directions, setDirections] = useState("");
  const [address, setAddress] = useState<SiteAddress | null>(null);
  const [saved, setSaved] = useState(false);

  async function persistSiteProject() {
    if (!address) return;
    try {
      const res = await fetch(SITE_PROJECTS_API, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          siteName:        siteName.trim() || "Untitled site",
          customerName:    customerName.trim() || undefined,
          addressMode:     address.mode,
          addressLabel:    address.label,
          addressLat:      address.latLng?.lat,
          addressLng:      address.latLng?.lng,
          addressPostcode: address.postcode,
          directions:      directions.trim() || undefined
        })
      });
      if (!res.ok) throw new Error(String(res.status));
      // Refresh the local cache used by the "Site Projects" left rail before auth ships.
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SITE_PROJECTS_CACHE_KEY);
      }
      setSaved(true);
      setTimeout(() => router.push("/tc/jobs"), 1000);
    } catch {
      setSaved(false);
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
        <MarketplaceHeader activeCategorySlug={null}/>
        <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-8">
          <div
            className="w-full rounded-2xl border bg-white p-6 text-center shadow-sm"
            style={{ borderColor: "rgba(22,101,52,0.35)" }}
          >
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "#166534" }}
            >
              <ShieldCheck size={26} strokeWidth={2.5} className="text-white"/>
            </div>
            <h1 className="mt-4 text-[18px] font-black text-neutral-900">Site project created</h1>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-neutral-600">
              Taking you to Site Projects…
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <MarketplaceHeader activeCategorySlug={null}/>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 md:px-6 md:py-8">
        <Link
          href="/tc/jobs"
          className="inline-flex min-h-[44px] items-center gap-2 text-[11.5px] font-bold text-neutral-600 hover:text-neutral-900"
        >
          <ArrowLeft size={13}/>
          Site Projects
        </Link>

        {/* Dark header */}
        <section
          className="overflow-hidden rounded-2xl border shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#0A0A0A" }}
        >
          <div className="p-4 md:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#FFB300" }}>
              TC · New Site Project
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-[20px] font-black leading-tight text-white md:text-[24px]">
              <Briefcase size={22}/>
              Add a site with a safe address
            </h1>
            <p className="mt-1 text-[11.5px] leading-snug text-white/70">
              UK postcode lookup means zero typos. Manual entry + What3Words fallback for the edge
              cases (new builds, sites with no postcode yet).
            </p>
          </div>
        </section>

        {/* Step tabs */}
        <div
          className="inline-flex w-full items-center gap-1 rounded-full border bg-white p-1 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          <StepTab active={step === "address"} onSelect={() => setStep("address")} num={1} label="Address"/>
          <StepTab active={step === "details"} onSelect={() => address && setStep("details")} num={2} label="Details" disabled={!address}/>
        </div>

        {step === "address" && (
          <SiteAddressInput
            initial={address ?? undefined}
            onSave={(a) => {
              setAddress(a);
              setStep("details");
            }}
          />
        )}

        {step === "details" && address && (
          <>
            {/* Selected address recap */}
            <section
              className="rounded-2xl border p-4 shadow-sm"
              style={{ borderColor: "rgba(22,101,52,0.35)", backgroundColor: "#F0FDF4" }}
            >
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#166534" }}/>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "#166534" }}>
                    Site address
                  </div>
                  <div className="mt-0.5 text-[13px] font-black leading-tight text-neutral-900">
                    {address.label}
                  </div>
                  <div className="mt-1 text-[10.5px] uppercase tracking-wider text-neutral-600">
                    via {address.mode === "postcode" ? "postcode lookup" : address.mode === "manual" ? "manual entry" : "What3Words"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("address")}
                  className="rounded-full border bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-800"
                  style={{ borderColor: "rgba(139,69,19,0.15)" }}
                >
                  Change
                </button>
              </div>
            </section>

            {/* Details form */}
            <section
              className="rounded-2xl border bg-white p-4 shadow-sm"
              style={{ borderColor: "rgba(139,69,19,0.15)" }}
            >
              <div className="flex flex-col gap-3">
                <Field label="Site name" required hint="What YOU call this job. Shown on your dashboard.">
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="Watson job · Kitchen refit · Plot 12"
                    className="min-h-[44px] rounded-md border bg-white px-3 text-[13px]"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    autoFocus
                  />
                </Field>
                <Field label="Customer name" hint="Optional — for your records.">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="David Watson"
                    className="min-h-[44px] rounded-md border bg-white px-3 text-[13px]"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  />
                </Field>
                <Field label="Directions" hint="Optional — anything a sat-nav gets wrong.">
                  <textarea
                    value={directions}
                    onChange={(e) => setDirections(e.target.value)}
                    rows={3}
                    placeholder="Second gate on left. Bin on the right marks the spot. Ignore sat-nav after Elm Ave."
                    className="rounded-md border bg-white p-3 text-[13px]"
                    style={{ borderColor: "rgba(139,69,19,0.15)" }}
                  />
                </Field>
              </div>
            </section>

            {/* Info footer */}
            <div className="flex items-start gap-2 rounded-md bg-neutral-50 p-3">
              <Info size={13} className="mt-0.5 flex-shrink-0 text-neutral-500"/>
              <p className="text-[10.5px] leading-snug text-neutral-500">
                This site becomes part of your Site Projects. Materials, quotes and orders can be tied
                to it. Trade Center uses the address for distance-to-merchant matching.
              </p>
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={persistSiteProject}
                disabled={siteName.trim() === ""}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full px-6 text-[13px] font-black uppercase tracking-wider shadow-sm disabled:opacity-40"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <Compass size={14}/>
                Create Site Project
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StepTab({
  active,
  onSelect,
  num,
  label,
  disabled
}: {
  active: boolean;
  onSelect: () => void;
  num: number;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider disabled:opacity-40"
      style={{
        backgroundColor: active ? "#0A0A0A" : "transparent",
        color: active ? "#FFB300" : "#525252"
      }}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
        style={{
          backgroundColor: active ? "#FFB300" : "#F5F0E4",
          color: "#0A0A0A"
        }}
      >
        {num}
      </span>
      {label}
    </button>
  );
}

function Field({
  label,
  required,
  hint,
  children
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="text-[10px] leading-snug text-neutral-500">{hint}</span>}
    </label>
  );
}
