// Admin Customer Support hub — dropdown of support tools for paid
// members. Currently lists canteen restore; other tools slot in here as
// they land.
//
// Only rendered under the (authed) admin layout so the top-level route
// is already session-gated.

import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer Support — Admin" };

const SUPPORT_TOOLS: { href: string; title: string; description: string; live: boolean }[] = [
  {
    href: "/admin/support/canteens",
    title: "Restore a canteen",
    description:
      "Roll a paid merchant's canteen back to a prior snapshot. Non-destructive — pre-restore snapshot is captured first so the restore itself is undoable. Requires admin passcode + slug confirmation + reason note (all logged).",
    live: true
  },
  {
    href: "/admin/support/impersonate",
    title: "Impersonate a merchant (coming soon)",
    description:
      "View any canteen exactly as its owner sees it — for triaging support tickets without asking merchants to screenshot.",
    live: false
  },
  {
    href: "/admin/support/comms",
    title: "Send comms to a member (coming soon)",
    description:
      "Send a WhatsApp / email to a specific merchant from the admin dashboard with a shared template library.",
    live: false
  }
];

export default function AdminSupportHubPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold text-brand-text">Customer Support</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Tools for helping paid members recover from mistakes. Every action here is logged with the actor + reason.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {SUPPORT_TOOLS.map((tool) => (
          <li key={tool.href}>
            {tool.live ? (
              <Link
                href={tool.href}
                className="block rounded-lg border border-brand-line bg-brand-surface p-4 transition hover:border-brand-accent"
              >
                <div className="text-sm font-semibold text-brand-text">{tool.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">{tool.description}</p>
              </Link>
            ) : (
              <div className="cursor-not-allowed rounded-lg border border-dashed border-brand-line bg-brand-surface p-4 opacity-60">
                <div className="text-sm font-semibold text-brand-text">{tool.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-brand-muted">{tool.description}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
