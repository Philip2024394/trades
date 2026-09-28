// src/app/nex-native/report/[accountId]/page.tsx
//
// Bridge 17e · Report an account · dedicated page (settings-style).
// -----------------------------------------------------------------
// Moved from the floating pill on peer chat (per Founder direction
// 2026-09-28: "report seller can be in settings or report account
// in settings same area as block account should have report option
// also"). Now reachable from:
//   · /friends · Report button next to Remove / Block
//   · A future settings/report link
//
// Renders a full-page form with radio reason picker + note field ·
// server-side snapshot of the peer conversation still captured by
// reportService.createReport as before.

import type * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import * as accountService from "@/lib/nex-native/account-service";
import * as reportService from "@/lib/nex-native/report-service";
import {
  resolveLocale,
  REPORT_STRINGS,
} from "@/lib/nex-native/i18n/safe-trade-strings";
import { reportUserAction } from "../../_actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  bg: "#020914",
  panel: "#050f1e",
  panelSoft: "rgba(6, 15, 28, 0.72)",
  border: "rgba(139, 169, 209, 0.14)",
  borderStrong: "rgba(139, 169, 209, 0.24)",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
  cyan: "#00AFFF",
  red: "#FF3355",
  redSoft: "rgba(255,51,85,0.35)",
};

const SERIF =
  "'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export default async function ReportAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ back?: string; lang?: string; report_error?: string }>;
}) {
  const { accountId: reportedId } = await params;
  const sp = await searchParams;

  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    const next = `/nex-native/report/${reportedId}`;
    redirect(`/nex-native/sign-in?next=${encodeURIComponent(next)}`);
  }
  if (reportedId === session.account.id) redirect("/nex-native/friends");

  const target = await accountService.getAccountById(reportedId);
  if (!target) notFound();

  const acceptLanguage = (await headers()).get("accept-language");
  const locale = resolveLocale({
    urlParam: sp.lang ?? null,
    accountLocale: session.account.locale ?? null,
    acceptLanguage,
  });
  const strings = REPORT_STRINGS[locale];

  const alreadyReported = await reportService
    .viewerHasReported(session.account.id, reportedId)
    .catch(() => false);
  const back =
    (sp.back ?? "").startsWith("/nex-native/") ? sp.back! : "/nex-native/friends";
  const bound = reportUserAction.bind(null, reportedId);
  const firstName = target.display_name.split(/\s+/)[0] ?? target.display_name;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily: SANS,
        paddingBottom: 80,
      }}
    >
      <header
        style={{
          padding: "calc(env(safe-area-inset-top, 0) + 14px) 20px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${NEX.border}`,
        }}
      >
        <Link
          href={back}
          style={{
            fontSize: 11,
            color: NEX.textDim,
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          ← Back
        </Link>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "36px 20px" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: NEX.red,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          🚨 Report
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: SERIF,
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: "-0.012em",
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          {strings.title.replace("{name}", firstName)}
        </h1>
        <p
          style={{
            margin: "0 0 22px",
            fontSize: 13,
            lineHeight: 1.6,
            color: NEX.textDim,
          }}
        >
          {strings.lede}
        </p>

        {sp.report_error && (
          <div
            role="status"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,51,85,0.10)",
              border: `1px solid ${NEX.redSoft}`,
              color: "#FFB4C0",
              fontSize: 12,
              marginBottom: 18,
            }}
          >
            {sp.report_error}
          </div>
        )}

        {alreadyReported ? (
          <AlreadyReportedNotice firstName={firstName} />
        ) : (
          <form action={bound}>
            <input type="hidden" name="back" value={back} />
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              {strings.reason_label}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {reportService.NEX_REPORT_REASONS.map((slug) => {
                const meta = reportService.NEX_REPORT_REASON_LABEL[slug];
                const localized = strings.reasons[slug];
                return (
                  <label
                    key={slug}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px 28px 1fr",
                      gap: 12,
                      alignItems: "start",
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: NEX.panelSoft,
                      border: `1px solid ${NEX.border}`,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={slug}
                      required
                      style={{ width: 16, height: 16, marginTop: 3, accentColor: NEX.red }}
                    />
                    <span aria-hidden style={{ fontSize: 18, lineHeight: "24px" }}>
                      {meta.emoji}
                    </span>
                    <span>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>
                        {localized.label}
                      </div>
                      <div style={{ fontSize: 12, color: NEX.textDim, lineHeight: 1.5 }}>
                        {localized.blurb}
                      </div>
                    </span>
                  </label>
                );
              })}
            </div>

            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: NEX.textMute,
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              {strings.note_label}
            </div>
            <textarea
              name="note"
              rows={4}
              maxLength={2000}
              placeholder={strings.note_placeholder}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${NEX.borderStrong}`,
                color: NEX.text,
                fontSize: 14,
                fontFamily: "inherit",
                lineHeight: 1.55,
                resize: "vertical",
                outline: "none",
                marginBottom: 16,
              }}
            />

            <p
              style={{
                margin: "0 0 20px",
                fontSize: 11,
                color: NEX.textMute,
                lineHeight: 1.55,
              }}
            >
              {strings.disclaimer}{" "}
              <Link
                href="/nex-native/terms"
                target="_blank"
                rel="noopener"
                style={{ color: NEX.cyan, textDecoration: "underline" }}
              >
                /terms
              </Link>
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <Link
                href={back}
                style={{
                  flex: 1,
                  padding: "13px 16px",
                  borderRadius: 12,
                  background: "rgba(139,169,209,0.08)",
                  border: `1px solid ${NEX.borderStrong}`,
                  color: NEX.text,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                {strings.cancel}
              </Link>
              <button
                type="submit"
                style={{
                  flex: 2,
                  padding: "13px 16px",
                  borderRadius: 12,
                  background: "linear-gradient(180deg, #FF5A70 0%, #FF3355 100%)",
                  border: `1px solid ${NEX.redSoft}`,
                  color: "#0B0F1A",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow:
                    "0 10px 22px rgba(255,51,85,0.42), inset 0 1px 0 rgba(255,255,255,0.28)",
                }}
              >
                {strings.submit}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function AlreadyReportedNotice({ firstName }: { firstName: string }) {
  return (
    <div
      style={{
        padding: "22px 20px",
        borderRadius: 14,
        background: "rgba(22,214,107,0.08)",
        border: "1px solid rgba(22,214,107,0.35)",
        color: "#B8F1CC",
        fontSize: 14,
        lineHeight: 1.6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#16D66B",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        ✓ Report received
      </div>
      You&apos;ve already reported {firstName}. Every report is reviewed
      manually within 48h during pilot. Multiple independent reports on
      the same account trigger an auto-review sweep.
    </div>
  );
}
