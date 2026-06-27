"use client";

// Customer-side Project Beacon form. Lives on the /find hero behind a
// toggle. Customer enters name + WhatsApp + city/postcode + trade +
// project description, hits Send, and we ping 3 nearest paid Xrated
// trades. They WhatsApp the customer direct.
//
// We don't sit in the middle: nothing about the lead lives on Xrated
// once the push fires. The customer's number is in the push payload,
// the trade taps to open WhatsApp pre-addressed to them, and that's
// the whole interaction. We hold an audit row (without the WhatsApp).

import { useState, type FormEvent } from "react";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";

const BRAND_YELLOW = "#FFB300";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | {
      kind: "sent";
      recipients: number;
      tradeLabel: string;
      city: string;
    }
  | { kind: "error"; message: string };

export function ProjectBeaconForm({
  detectedCountry
}: {
  detectedCountry?: string;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [tradeSlug, setTradeSlug] = useState("");
  const [project, setProject] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const country = detectedCountry ?? "GB";
  const remaining = 240 - project.length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/trade-off/project-beacon/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          city: city.trim(),
          postcode: postcode.trim(),
          trade_slug: tradeSlug,
          project_description: project.trim(),
          country
        })
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        recipients_pinged?: number;
        trade_label?: string;
        city?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          kind: "error",
          message: data.error ?? `Couldn't send (${res.status})`
        });
        return;
      }
      setState({
        kind: "sent",
        recipients: data.recipients_pinged ?? 0,
        tradeLabel: data.trade_label ?? "",
        city: data.city ?? city
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error"
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <div
        className="rounded-2xl border-2 bg-white p-6 shadow-xl sm:p-7"
        style={{
          borderColor: BRAND_YELLOW,
          boxShadow: `0 20px 50px ${BRAND_YELLOW}33`
        }}
      >
        <p
          className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: BRAND_YELLOW }}
        >
          Beacon sent
        </p>
        <h3 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Sit tight — {state.recipients} trade
          {state.recipients === 1 ? "" : "s"} just got pinged.
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
          The {state.recipients === 0 ? "available" : `${state.recipients} closest`}{" "}
          {state.tradeLabel.toLowerCase()}
          {state.recipients === 1 ? "" : "s"} in {state.city} just got a
          phone notification with your project details. They&rsquo;ll
          WhatsApp you direct &mdash; Xrated never sits between you. If
          you don&rsquo;t hear back within an hour, send another beacon
          or browse the list directly above.
        </p>
        {state.recipients === 0 && (
          <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-[13px] text-neutral-600">
            No {state.tradeLabel.toLowerCase()}s on Xrated in {state.city}{" "}
            yet &mdash; check back soon, the membership is growing.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setState({ kind: "idle" });
            setName("");
            setWhatsapp("");
            setCity("");
            setPostcode("");
            setTradeSlug("");
            setProject("");
          }}
          className="mt-4 inline-flex h-10 items-center rounded-lg border border-neutral-200 bg-white px-4 text-[12px] font-extrabold uppercase tracking-wider text-neutral-700 transition hover:border-neutral-300"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border-2 bg-white p-4 shadow-xl sm:p-5"
      style={{
        borderColor: BRAND_YELLOW,
        boxShadow: `0 20px 50px ${BRAND_YELLOW}33`
      }}
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:gap-2.5">
        {/* Trade */}
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Trade needed
          </span>
          <select
            required
            value={tradeSlug}
            onChange={(e) => setTradeSlug(e.target.value)}
            disabled={state.kind === "sending"}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 focus:border-neutral-400 focus:outline-none sm:text-sm"
          >
            <option value="">Choose a trade…</option>
            {TRADE_OFF_TRADES.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {/* City */}
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            City / area
          </span>
          <input
            required
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={state.kind === "sending"}
            placeholder="e.g. Manchester"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Postcode optional */}
        <label className="flex flex-col gap-1 sm:col-span-4">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Postcode (optional)
          </span>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            disabled={state.kind === "sending"}
            placeholder="M14"
            maxLength={8}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold uppercase text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Name */}
        <label className="flex flex-col gap-1 sm:col-span-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Your name
          </span>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={state.kind === "sending"}
            placeholder="First name only is fine"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* WhatsApp */}
        <label className="flex flex-col gap-1 sm:col-span-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            Your WhatsApp number
          </span>
          <input
            required
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            disabled={state.kind === "sending"}
            placeholder="+44 7700 900123"
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-[13px] font-extrabold text-neutral-900 placeholder:font-bold placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Project description */}
        <label className="flex flex-col gap-1 sm:col-span-12">
          <span className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
            <span>Project</span>
            <span className={remaining < 0 ? "text-red-600" : ""}>
              {remaining}
            </span>
          </span>
          <textarea
            required
            rows={2}
            value={project}
            onChange={(e) => setProject(e.target.value.slice(0, 240))}
            disabled={state.kind === "sending"}
            placeholder="One line — what do you need? When? Budget if you have one."
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none sm:text-sm"
          />
        </label>

        {/* Submit + privacy line */}
        <div className="flex flex-col gap-2 sm:col-span-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-[11px] text-neutral-500 sm:text-[12px]">
            We send your project to the 3 closest trades. They&rsquo;ll
            WhatsApp you direct &mdash; Xrated never sits in the middle.
          </p>
          <button
            type="submit"
            disabled={state.kind === "sending"}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-extrabold uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            style={{
              background: BRAND_YELLOW,
              boxShadow: `0 6px 20px ${BRAND_YELLOW}55`
            }}
          >
            {state.kind === "sending" ? "Sending…" : "Send to nearest 3"}
            {state.kind !== "sending" && (
              <span aria-hidden="true">&rarr;</span>
            )}
          </button>
        </div>

        {state.kind === "error" && (
          <p className="text-[12px] font-bold text-red-600 sm:col-span-12">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

export default ProjectBeaconForm;
