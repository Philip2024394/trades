// /report-an-issue — site-wide "Report an issue" surface.
//
// Anyone (signed in or not) can file a bug, a broken link, or a
// feature request. Lands in hammerex_bug_reports and surfaces on
// /admin/red-zone in the User category.
//
// Deliberately simple: one page, three-kind picker, body textarea,
// optional email so we can close the loop. IP + user-agent are
// captured server-side. No auth check.

import type { Metadata } from "next";
import { ReportAnIssueShell } from "./ReportAnIssueShell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Report an issue | Thenetworkers",
  description: "Report a bug, broken link, or feature request on Thenetworkers.app. Every report lands in the operational queue and is reviewed by the team.",
  robots: { index: true, follow: true }
};

export default function ReportAnIssuePage() {
  return <ReportAnIssueShell/>;
}
