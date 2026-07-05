"use client";

// Credential Manager — merchant-facing add / verify / delete.
//
// Every scheme flagged as auto-verified shows a real status pill
// (verified / expired / suspended / not-found / error). Schemes with
// no public API show "self-declared" plus a link to the scheme's own
// public register so end-users can verify independently.

import { useEffect, useState } from "react";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const RED = "#DC2626";
const BLUE = "#2563EB";
const NEUTRAL = "#525252";

type CredentialRow = {
  id: string;
  scheme: string;
  number: string;
  status: string;
  verified_at: string | null;
  expires_at: string | null;
  display_label: string | null;
};

type SchemeOption = {
  slug: string;
  label: string;
  help: string;
  autoVerified: boolean;
  registerUrl: string | null;
};

const SCHEMES: SchemeOption[] = [
  {
    slug: "companies-house",
    label: "Companies House",
    help: "UK registered company number",
    autoVerified: true,
    registerUrl: "https://find-and-update.company-information.service.gov.uk"
  },
  {
    slug: "vat",
    label: "VAT",
    help: "UK VAT registration number",
    autoVerified: true,
    registerUrl: "https://www.gov.uk/check-uk-vat-number"
  },
  {
    slug: "gas-safe",
    label: "Gas Safe",
    help: "Gas engineers — mandatory",
    autoVerified: false,
    registerUrl: "https://www.gassaferegister.co.uk/find-an-engineer/"
  },
  {
    slug: "niceic",
    label: "NICEIC",
    help: "Electrical Part P scheme",
    autoVerified: false,
    registerUrl: "https://niceic.com/find-a-contractor"
  },
  {
    slug: "napit",
    label: "NAPIT",
    help: "Electrical Part P scheme",
    autoVerified: false,
    registerUrl: "https://napit.org.uk/find-an-installer"
  },
  {
    slug: "mcs",
    label: "MCS",
    help: "Renewables — needed for BUS grants",
    autoVerified: false,
    registerUrl: "https://mcscertified.com/find-an-installer/"
  },
  {
    slug: "trustmark",
    label: "TrustMark",
    help: "Government-endorsed quality scheme",
    autoVerified: false,
    registerUrl: "https://www.trustmark.org.uk/homeowner/find-a-tradesperson"
  },
  {
    slug: "fmb",
    label: "FMB",
    help: "Federation of Master Builders",
    autoVerified: false,
    registerUrl: "https://www.fmb.org.uk/find-a-builder.html"
  },
  {
    slug: "chas",
    label: "CHAS",
    help: "SSIP contractor prequal",
    autoVerified: false,
    registerUrl: "https://www.chas.co.uk/find-a-supplier/"
  },
  {
    slug: "safecontractor",
    label: "SafeContractor",
    help: "SSIP contractor prequal",
    autoVerified: false,
    registerUrl: "https://www.safecontractor.com/contractor-search/"
  },
  {
    slug: "fensa",
    label: "FENSA",
    help: "Replacement windows",
    autoVerified: false,
    registerUrl: "https://www.fensa.org.uk/find-installer"
  },
  {
    slug: "ipaf",
    label: "IPAF",
    help: "Access platform operator card",
    autoVerified: false,
    registerUrl: "https://www.ipaf.org/en/pal-card-check"
  },
  {
    slug: "pasma",
    label: "PASMA",
    help: "Mobile tower operator card",
    autoVerified: false,
    registerUrl: "https://pasma.co.uk/pasma-cardholder-check/"
  },
  {
    slug: "waste-carrier",
    label: "Waste Carrier",
    help: "Mandatory for waste transport",
    autoVerified: false,
    registerUrl:
      "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers"
  },
  {
    slug: "public-liability",
    label: "Public Liability",
    help: "Insurance certificate — self-declared, expires_at manual",
    autoVerified: false,
    registerUrl: null
  },
  {
    slug: "cscs",
    label: "CSCS",
    help: "Card-holder count — smart-check via CSCS app",
    autoVerified: false,
    registerUrl: "https://www.cscs.uk.com/applying-for-cards/smart-check/"
  }
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  verified: { label: "Verified", color: GREEN },
  "self-declared": { label: "Self-declared", color: BLUE },
  unverified: { label: "Pending", color: AMBER },
  expired: { label: "Expired", color: RED },
  suspended: { label: "Suspended", color: RED },
  "not-found": { label: "Not found", color: RED },
  error: { label: "Check failed", color: NEUTRAL }
};

export function CredentialManager() {
  const [credentials, setCredentials] = useState<CredentialRow[] | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<string>("companies-house");
  const [numberInput, setNumberInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/studio/credentials");
      const json = (await res.json()) as
        | { ok: true; credentials: CredentialRow[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setCredentials(json.credentials);
    } catch (err) {
      setError((err as Error).message ?? "network");
    }
  }

  async function add() {
    if (!numberInput.trim()) return;
    setBusy("add");
    setError(null);
    try {
      const res = await fetchWithRetry("/api/studio/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheme: selectedScheme,
          number: numberInput.trim()
        })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "add-failed");
      setNumberInput("");
      await load();
      // Fire an immediate verify against auto-verified schemes so the
      // status flips in the same page load.
      const scheme = SCHEMES.find((s) => s.slug === selectedScheme);
      if (scheme?.autoVerified) {
        // load again after a tiny wait so the new row's id is available
        setTimeout(() => void triggerVerifyLatest(selectedScheme), 400);
      }
      setFlash("Added.");
      window.setTimeout(() => setFlash(null), 3000);
    } catch (err) {
      setError((err as Error).message ?? "add-failed");
    } finally {
      setBusy(null);
    }
  }

  async function triggerVerifyLatest(scheme: string) {
    const latest = credentials?.find((c) => c.scheme === scheme);
    if (!latest) return;
    await verify(latest.id);
  }

  async function verify(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetchWithRetry(
        `/api/studio/credentials/${id}/verify`,
        { method: "POST" }
      );
      const json = (await res.json()) as {
        ok: boolean;
        status?: string;
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? "verify-failed");
      await load();
    } catch (err) {
      setError((err as Error).message ?? "verify-failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this credential?")) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetchWithRetry(`/api/studio/credentials/${id}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "delete-failed");
      await load();
    } catch (err) {
      setError((err as Error).message ?? "delete-failed");
    } finally {
      setBusy(null);
    }
  }

  const schemeMeta = SCHEMES.find((s) => s.slug === selectedScheme);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Verified badges
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Turn on trust the moment we can prove it.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Companies House + HMRC VAT verify automatically — every day, and
        on demand. Every other scheme is self-declared and links back to
        the scheme's own public register so your customers can verify.
      </p>

      {flash && (
        <p
          role="status"
          className="mt-6 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-800"
        >
          {flash}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {error}
        </p>
      )}

      {/* Add form */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Scheme
            </label>
            <select
              value={selectedScheme}
              onChange={(e) => setSelectedScheme(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] font-bold outline-none focus:border-neutral-900"
            >
              {SCHEMES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label} {s.autoVerified ? "· auto" : ""}
                </option>
              ))}
            </select>
            {schemeMeta && (
              <p className="mt-1 text-[10px] text-neutral-500">
                {schemeMeta.help}
                {schemeMeta.registerUrl && (
                  <>
                    {" · "}
                    <a
                      href={schemeMeta.registerUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline"
                    >
                      Public register
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              Your number
            </label>
            <input
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="e.g. 12345678 or GB123456789"
              className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-neutral-900"
            />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={busy === "add" || !numberInput.trim()}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[11px] font-extrabold uppercase tracking-widest text-neutral-900 transition hover:brightness-95 disabled:opacity-40"
            style={{ background: YELLOW }}
          >
            {busy === "add" ? "Adding…" : "Add + verify"}
          </button>
        </div>
      </div>

      {/* Credentials list */}
      {credentials === null ? (
        <p className="mt-8 text-[13px] text-neutral-500">Loading…</p>
      ) : credentials.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-16 text-center text-[13px] font-bold text-neutral-500">
          No credentials yet — add your first above.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {credentials.map((c) => {
            const meta = SCHEMES.find((s) => s.slug === c.scheme);
            const statusMeta = STATUS_META[c.status] ?? STATUS_META.unverified;
            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-[14px] font-extrabold text-neutral-900">
                      {meta?.label ?? c.scheme}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
                      style={{ background: statusMeta.color }}
                    >
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-600">
                    <code className="rounded bg-neutral-100 px-1 font-mono">
                      {c.number}
                    </code>
                    {c.display_label && (
                      <>
                        {" · "}
                        {c.display_label}
                      </>
                    )}
                  </p>
                  {c.verified_at && (
                    <p className="text-[10px] text-neutral-500">
                      Verified{" "}
                      {new Date(c.verified_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </p>
                  )}
                  {c.expires_at && (
                    <p className="text-[10px] text-neutral-500">
                      Expires{" "}
                      {new Date(c.expires_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => verify(c.id)}
                    disabled={busy === c.id}
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
                  >
                    {busy === c.id ? "Checking…" : "Verify now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={busy === c.id}
                    className="rounded-md px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white transition disabled:opacity-40"
                    style={{ background: RED }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
