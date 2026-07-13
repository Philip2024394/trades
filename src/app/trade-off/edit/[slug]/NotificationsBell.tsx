// Bell icon shown in the trade edit dashboard header.
//
// Server component — takes the unread targeted-notification count and
// renders a small link with a badge. Zero client JS. Sits next to
// LogoutButton. Amber badge when there are unread items, silent when
// the inbox is empty.

import Link from "next/link";
import { Bell } from "lucide-react";

export function NotificationsBell({
  slug,
  token,
  unreadCount
}: {
  slug: string;
  token: string;
  unreadCount: number;
}) {
  const hasUnread = unreadCount > 0;
  return (
    <Link
      href={`/trade-off/edit/${slug}/notifications?token=${encodeURIComponent(token)}`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-line bg-brand-surface transition hover:border-brand-accent hover:text-brand-accent"
      title={
        hasUnread
          ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}`
          : "Notifications inbox"
      }
      aria-label={
        hasUnread
          ? `Notifications — ${unreadCount} unread`
          : "Notifications"
      }
    >
      <Bell className="h-4 w-4" aria-hidden />
      {hasUnread ? (
        <span
          className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
          style={{ background: "#FFB300", color: "#0A0A0A" }}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
