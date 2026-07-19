// /homeowners/login — client-side homeowner login.
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";

const BRAND_YELLOW = "#FFB300";
const BRAND_GREEN  = "#166534";

export default function HomeownerLoginPage() {
  const router     = useRouter();
  const params     = useSearchParams();
  const next       = params.get("next") || "/sitebook";
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [status, setStatus]       = useState<"idle" | "sending" | "error">("idle");
  const [message, setMessage]     = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const res = await fetch("/api/homeowner/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setStatus("error");
      setMessage(data.error === "invalid-credentials" ? "Email or password is wrong." : "Login failed. Try again.");
      return;
    }
    router.push(next);
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      <XratedHeader/>
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="rounded-2xl border-2 bg-white p-6 shadow-lg" style={{ borderColor: BRAND_YELLOW }}>
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>Welcome back</p>
          <h1 className="mt-2 text-2xl font-black text-neutral-900">Open your SiteBook</h1>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label htmlFor="email" className="block">
              <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">Email</span>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="you@your-email.com"/>
            </label>
            <label htmlFor="password" className="block">
              <span className="mb-1 block text-[10.5px] font-black uppercase tracking-wider text-neutral-600">Password</span>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Your password"/>
            </label>

            {status === "error" && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-bold text-red-800">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[12px] font-black uppercase tracking-wider text-white transition hover:brightness-95 disabled:opacity-60"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              {status === "sending" ? "Opening SiteBook…" : "Log in →"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-[13px] text-neutral-600">
          Don&rsquo;t have an account? <Link href="/homeowners/signup" className="font-black text-neutral-900 underline">Start free</Link>
        </p>
      </section>
      <XratedFooter/>
    </main>
  );
}
