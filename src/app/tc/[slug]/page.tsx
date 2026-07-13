// /tc/[slug] — per-App workspace surface (placeholder for Week 1).
//
// Real per-App routes come from `manifest.compatibility.createsPages`
// via the runtime pageManagement system. Week 1 renders a placeholder
// so the sidebar links resolve to something visible.

import { notFound } from "next/navigation";
import { appRegistry } from "@/platform/registry";
import { bootstrapPlatform } from "@/platform/bootstrap";

bootstrapPlatform();

export const dynamic = "force-dynamic";

export default async function AppPlaceholder({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const app = appRegistry.get(slug);
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        {app.category}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[28px]" aria-hidden>{app.icon}</span>
        <h1 className="text-[28px] font-black leading-tight text-neutral-900">
          {app.name}
        </h1>
      </div>
      <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
        {app.tagline}
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="text-[12px] leading-relaxed text-neutral-700">
          {app.description}
        </div>

        {app.commands && app.commands.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
              Commands this App contributes to ⌘K
            </div>
            <ul className="mt-2 divide-y divide-neutral-100">
              {app.commands.map((cmd) => (
                <li key={cmd.id} className="flex items-center justify-between py-2 text-[12px]">
                  <span className="font-bold text-neutral-800">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono text-neutral-600">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center text-[12px] text-neutral-500">
        Real per-App content lands in later weeks per PLATFORM_DELTA §6.
        The Week 1 goal is to prove the shell renders the App identity
        purely from the manifest.
      </div>
    </div>
  );
}
