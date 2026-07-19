// /sitebook/settings — homeowner account settings.

import { getHomeownerFromCookie } from "@/lib/homeowners/auth";

export const dynamic = "force-dynamic";

export default async function HomeownerSettingsPage() {
  const homeowner = (await getHomeownerFromCookie())!;

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-black text-neutral-900">Account settings</h1>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-[10.5px] font-black uppercase tracking-wider text-neutral-500">Your details</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
            <dt className="text-neutral-500">Email</dt><dd className="font-black text-neutral-900">{homeowner.email}</dd>
            <dt className="text-neutral-500">First name</dt><dd className="font-black text-neutral-900">{homeowner.first_name || "—"}</dd>
            <dt className="text-neutral-500">WhatsApp</dt><dd className="font-black text-neutral-900">{homeowner.whatsapp_number || "—"}</dd>
            <dt className="text-neutral-500">City</dt><dd className="font-black text-neutral-900">{homeowner.city || "—"}</dd>
            <dt className="text-neutral-500">Postcode</dt><dd className="font-black text-neutral-900">{homeowner.postcode || "—"}</dd>
            <dt className="text-neutral-500">Tier</dt><dd className="font-black text-neutral-900">{homeowner.premium_tier}</dd>
          </dl>
        </div>

        <div className="rounded-2xl border-2 bg-white p-5" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-[14px] font-black text-neutral-900">Install SiteBook to your phone</p>
          <p className="mt-1 text-[12px] text-neutral-600">
            Add SiteBook to your home screen — you&rsquo;ll get push notifications for messages, quotes, and warranty reminders. Works offline. No app store.
          </p>
          <p className="mt-2 text-[11px] text-neutral-500">
            <span className="font-black">On iPhone:</span> Tap Share → Add to Home Screen.
            <span className="ml-2 font-black">On Android:</span> Tap ⋮ → Add to Home Screen.
          </p>
        </div>
      </div>
    </section>
  );
}
