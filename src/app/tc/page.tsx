// /tc — Trade Center workspace home.
//
// Week 5: the "Today's Work" strip now renders discovered widgets
// from every registered App. Zero hard-coded App slugs — every tile
// is a projection over appRegistry + widget handler registry.

import { appRegistry } from "@/platform/registry";
import { discoverWidgetsForSlot } from "@/platform/widgets/discovery";
import { renderWidgetPayload } from "@/platform/widgets/runtime";
import { WidgetTile } from "@/platform/shell/WidgetTile";

export const dynamic = "force-dynamic";

export default async function TradeCenterHome() {
  const homeWidgets = discoverWidgetsForSlot("home.today");

  // Fan out to every widget's handler in parallel. Each call is
  // instrumented + safe: `renderWidgetPayload` returns an empty
  // payload if the handler is missing or throws.
  const payloads = await Promise.all(
    homeWidgets.map(async (w) => ({
      widget: w,
      payload: await renderWidgetPayload(w.id)
    }))
  );

  const apps = appRegistry.list();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Eyebrow */}
      <div className="mb-1 flex items-center gap-2">
        <span
          className="block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: "#FFB300" }}
          aria-hidden
        />
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          Trade Center · Today
        </span>
      </div>
      <h1 className="text-[28px] font-black leading-tight text-neutral-900">
        Today's work.
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] text-neutral-600">
        Every tile below is contributed by an App you have installed.
        Nothing on this page is hard-coded to a specific App — the
        shell walks the widget registry and renders whatever it finds.
        Press <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd> for the palette, <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-mono">⌘\</kbd> for the Copilot.
      </p>

      {/* Widgets */}
      <section aria-label="Today's work" className="mt-8">
        {payloads.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed p-8 text-center text-[12px] text-neutral-500">
            No Apps have contributed a home.today widget yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {payloads.map(({ widget, payload }) => (
              <WidgetTile key={widget.id} widget={widget} payload={payload}/>
            ))}
          </div>
        )}
      </section>

      {/* Apps rail */}
      <section className="mt-10" aria-label="Installed apps">
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
          {apps.length} installed apps
        </h2>
        <ul className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <li
              key={app.slug}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3"
            >
              <span className="text-[20px]" aria-hidden>{app.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black text-neutral-900">{app.name}</div>
                <div className="truncate text-[11px] text-neutral-500">{app.tagline}</div>
              </div>
              <a
                href={`/tc/${app.slug}`}
                className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
              >
                Open
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
