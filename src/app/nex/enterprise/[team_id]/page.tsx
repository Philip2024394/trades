// src/app/nex/enterprise/[team_id]/page.tsx
//
// Founder Phase 16 · P16-4 · Admin console UI.
// Server component · membership check on server · no client JS required.

import { cookies } from "next/headers";
import { resolveSession } from "@/lib/nex/identity-auth";
import { getRoleInTeam, listMembers, listAuditEvents } from "@/lib/nex/enterprise";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export const dynamic = "force-dynamic";

async function getTeam(team_id: string) {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT team_id::text, slug, name, tier, created_at::text
       FROM nex.team WHERE team_id = $1 AND deleted_at IS NULL`,
    [team_id],
  );
  return (r.rows[0] as unknown as { team_id: string; slug: string; name: string; tier: string; created_at: string }) ?? null;
}

export default async function EnterpriseAdminPage({ params }: { params: Promise<{ team_id: string }> }) {
  const { team_id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("nex_session")?.value ?? null;
  const session = await resolveSession(token);

  const styles = {
    main: { maxWidth: 960, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" } as const,
    h1: { margin: "0 0 0.25rem", fontSize: "1.75rem" } as const,
    sub: { color: "#71717a", fontSize: "0.875rem", marginBottom: "1.5rem" } as const,
    card: { border: "1px solid #e4e4e7", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" } as const,
    h2: { margin: "0 0 0.75rem", fontSize: "1.125rem" } as const,
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "0.9rem" },
    th: { textAlign: "left" as const, padding: "0.5rem 0.75rem", background: "#fafafa", borderBottom: "1px solid #e4e4e7" },
    td: { padding: "0.5rem 0.75rem", borderBottom: "1px solid #f4f4f5" },
    badge: { display: "inline-block", padding: "0.1rem 0.5rem", background: "#e0e7ff", color: "#3730a3", borderRadius: 4, fontSize: "0.75rem" } as const,
    link: { color: "#2563eb", textDecoration: "none" } as const,
  };

  if (!session?.user_id) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Sign in required</h1>
        <p style={styles.sub}>You must be signed in to view this admin console.</p>
      </main>
    );
  }

  const team = await getTeam(team_id);
  if (!team) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Team not found</h1>
      </main>
    );
  }

  const role = await getRoleInTeam(team_id, session.user_id);
  if (!role) {
    return (
      <main style={styles.main}>
        <h1 style={styles.h1}>Not a member</h1>
        <p style={styles.sub}>You do not have access to team {team.name}.</p>
      </main>
    );
  }

  const members = await listMembers(team_id);
  const events = await listAuditEvents(team_id, 20);

  return (
    <main style={styles.main}>
      <header>
        <div style={{ fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          NEX Enterprise · Admin Console
        </div>
        <h1 style={styles.h1}>{team.name}</h1>
        <p style={styles.sub}>
          Slug: {team.slug} · Tier: <span style={styles.badge}>{team.tier}</span> · Your role:{" "}
          <span style={styles.badge}>{role}</span> · Created {new Date(team.created_at).toLocaleDateString()}
        </p>
      </header>

      <section style={styles.card} aria-label="members">
        <h2 style={styles.h2}>Members ({members.length})</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User ID</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Invited by</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td style={styles.td}>
                  <code>{m.user_id.slice(0, 12)}…</code>
                  {m.user_id === session.user_id && <span style={{ ...styles.badge, marginLeft: 6 }}>you</span>}
                </td>
                <td style={styles.td}>{m.role}</td>
                <td style={styles.td}>{new Date(m.joined_at).toLocaleDateString()}</td>
                <td style={styles.td}>{m.invited_by ? <code>{m.invited_by.slice(0, 8)}…</code> : <span style={{ color: "#a1a1aa" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={styles.card} aria-label="audit">
        <h2 style={styles.h2}>Recent audit events ({events.length})</h2>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>When</th>
              <th style={styles.th}>Actor</th>
              <th style={styles.th}>Action</th>
              <th style={styles.th}>Target</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.audit_event_id}>
                <td style={styles.td}>{new Date(ev.created_at).toLocaleString()}</td>
                <td style={styles.td}>{ev.actor_user_id ? <code>{ev.actor_user_id.slice(0, 8)}…</code> : <span style={{ color: "#a1a1aa" }}>system</span>}</td>
                <td style={styles.td}><code>{ev.action}</code></td>
                <td style={styles.td}>{ev.target ? <code>{ev.target.slice(0, 12)}…</code> : <span style={{ color: "#a1a1aa" }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(role === "owner" || role === "admin") && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
            <a href={`/api/nex/enterprise/teams/${team_id}/audit/export?format=ndjson`} style={styles.link}>
              Download full audit log (NDJSON)
            </a>{" · "}
            <a href={`/api/nex/enterprise/teams/${team_id}/audit/export?format=json`} style={styles.link}>
              JSON
            </a>
          </p>
        )}
      </section>

      <footer style={{ marginTop: "2rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.8rem", color: "#52525b" }}>
        <strong>NEX audit doctrine:</strong> every enterprise action is recorded immutably. Exports include the export event itself. Rows arrive from the audit table verbatim — nothing synthesised.
      </footer>
    </main>
  );
}
