"use client";

// JoinDiscoverShell — signup form for the Discover pool.
// V1: form UI only, submits to console + success state. V2: wires to
// the discovery service (creates profile + assigns to visibility pool).

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, User } from "lucide-react";
import { StatusBar } from "../shell/StatusBar";

const COUNTRIES = [
  "United Kingdom", "Ireland", "France", "Germany", "Spain", "Italy",
  "Netherlands", "Portugal", "United States", "Canada", "Australia",
  "New Zealand", "South Africa", "India", "United Arab Emirates",
  "Singapore", "Japan", "Indonesia"
];

const LOOKING_FOR = [
  { id: "relationship", label: "Relationship" },
  { id: "marriage",     label: "Marriage" },
  { id: "casual",       label: "Casual dating" },
  { id: "fun",          label: "Fun" },
  { id: "friendship",   label: "Friendship" },
  { id: "networking",   label: "Networking" },
  { id: "not-sure",     label: "Not sure yet" }
];

const GENDERS = [
  { id: "male",   label: "Male" },
  { id: "female", label: "Female" },
  { id: "other",  label: "Other" }
];

export function JoinDiscoverShell() {
  const [name, setName]             = useState("");
  const [country, setCountry]       = useState("United Kingdom");
  const [age, setAge]               = useState("");
  const [gender, setGender]         = useState("");
  const [occupation, setOccupation] = useState("");
  const [lookingFor, setLookingFor] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted]   = useState(false);

  function toggleLookingFor(id: string) {
    setLookingFor((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.info("[discover:join] submit", {
      name, country, age: Number(age), gender, occupation,
      looking_for: [...lookingFor]
    });
    setSubmitted(true);
  }

  const valid = name.trim().length >= 2 &&
                country.trim().length > 0 &&
                Number(age) >= 18 &&
                gender !== "" &&
                lookingFor.size > 0;

  return (
    <div
      className="relative mx-auto flex min-h-screen max-w-md flex-col"
      style={{ background: "var(--nex-cream)" }}
    >
      <StatusBar />

      {/* Slim top bar with back arrow */}
      <header
        className="flex items-center gap-3 px-4 pt-2 pb-2"
        style={{
          background: "color-mix(in oklab, var(--nex-cream) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--nex-neutral-200)"
        }}
      >
        <Link href="/nex-app/discover" aria-label="Back to Discover"
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{ color: "var(--nex-neutral-700)" }}>
          <ArrowLeft size={22} strokeWidth={1.75} />
        </Link>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.32em]"
                style={{ color: "var(--nex-accent-500)" }}>
            Join Discover
          </span>
          <span className="text-[11px] leading-tight"
                style={{ color: "var(--nex-neutral-500)" }}>
            Create your profile in 30 seconds
          </span>
        </div>
      </header>

      <main className="flex-1 px-5 pb-8 pt-5">
        {submitted ? (
          <SubmittedState name={name} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="First name">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Sarah"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
                autoComplete="given-name"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Age">
                <input
                  required
                  type="number"
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="29"
                  className={INPUT_CLASS}
                style={INPUT_STYLE}
                />
              </Field>
              <Field label="Country">
                <select
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={INPUT_CLASS}
                style={INPUT_STYLE}
                >
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Gender">
              <div className="flex gap-2">
                {GENDERS.map((g) => {
                  const active = gender === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGender(g.id)}
                      className="flex-1 rounded-full py-2 text-[12px] font-semibold transition-all"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)"
                          : "var(--nex-neutral-0)",
                        color: active ? "var(--nex-neutral-0)" : "var(--nex-neutral-700)",
                        border: active ? "none" : "1px solid var(--nex-neutral-300)"
                      }}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Occupation">
              <input
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Interior Designer"
                className={INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </Field>

            <Field label="Looking for (pick one or more)">
              <div className="flex flex-wrap gap-1.5">
                {LOOKING_FOR.map((l) => {
                  const active = lookingFor.has(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLookingFor(l.id)}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
                      style={{
                        background: active
                          ? "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)"
                          : "var(--nex-neutral-0)",
                        color: active ? "var(--nex-neutral-0)" : "var(--nex-neutral-700)",
                        border: active ? "none" : "1px solid var(--nex-neutral-300)"
                      }}
                    >
                      {active && <Check size={12} strokeWidth={2.75} />}
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <p className="text-[10.5px] leading-[1.5] mt-1"
               style={{ color: "var(--nex-neutral-500)" }}>
              By joining you agree to be visible in the Discover feed. You can pause your
              profile or leave at any time from Settings.
            </p>

            <button
              type="submit"
              disabled={!valid}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-black transition-transform active:scale-[0.99] disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
                color: "var(--nex-neutral-0)",
                boxShadow: "var(--nex-shadow-md)"
              }}
            >
              <User size={15} strokeWidth={2.25} />
              Join Discover
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:outline-2 focus:outline-[color:var(--nex-accent-500)]";

const INPUT_STYLE = {
  background: "var(--nex-neutral-0)",
  border: "1px solid var(--nex-neutral-300)",
  color: "var(--nex-neutral-900)"
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wider"
            style={{ color: "var(--nex-neutral-500)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function SubmittedState({ name }: { name: string }) {
  return (
    <div className="mt-14 flex flex-col items-center text-center">
      <span
        className="mb-4 grid h-16 w-16 place-items-center rounded-full"
        style={{ background: "var(--nex-accent-50)", color: "var(--nex-accent-500)" }}
        aria-hidden
      >
        <Check size={30} strokeWidth={2.5} />
      </span>
      <h2 className="text-[18px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
        You&apos;re in{name ? `, ${name.split(" ")[0]}` : ""}.
      </h2>
      <p className="mt-2 max-w-xs text-[13px] leading-[1.5]" style={{ color: "var(--nex-neutral-500)" }}>
        Your profile will start appearing in the Discover feed shortly. Others can send
        introductions through NEX — you accept, decline or ignore.
      </p>
      <Link
        href="/nex-app/discover"
        className="mt-6 rounded-full px-5 py-2 text-[12px] font-semibold"
        style={{
          background: "linear-gradient(135deg, var(--nex-accent-500) 0%, var(--nex-accent-600) 100%)",
          color: "var(--nex-neutral-0)"
        }}
      >
        Back to Discover
      </Link>
    </div>
  );
}
