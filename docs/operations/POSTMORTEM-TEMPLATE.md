# Postmortem · [Incident title]

**Incident ID:** [YYYY-MM-DD-slug]
**Severity:** P?
**Duration:** [X min · from Y UTC to Z UTC]
**Author:** [name]
**Date:** [YYYY-MM-DD]

---

## Summary

One paragraph. What broke, for whom, how long, how it ended.

## Impact

- Users affected: [count / segment]
- Data affected: [record count / tables]
- Revenue impact: [£ estimate]
- SLO budget consumed: [X min of Y budget]

## Timeline (all times UTC)

| Time | Event |
|---|---|
| HH:MM | Alert fired |
| HH:MM | Operator ack'd |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service healthy |
| HH:MM | All-clear posted |

## Root cause

The single cause, plainly stated. If there were multiple contributing factors, list the primary + secondary.

## Contributing factors

- [ ] Human error (specify — no blame)
- [ ] Software defect (link to commit / PR)
- [ ] Third-party outage (link to provider status)
- [ ] Capacity limit (specify metric + threshold hit)
- [ ] Deployment / change (link to deploy)
- [ ] Missing safeguard (specify what would have caught it)

## What went well

- Alert fired in [X min] (target [Y min])
- Mitigation from runbook `<name>.md` worked
- Comms cadence held

## What went badly

- Alert didn't fire until [X min] after user impact began
- Runbook missing for this scenario — had to improvise
- Mitigation required destructive action because reversible was unavailable

## Action items

| # | Action | Owner | Due | Ticket |
|---|---|---|---|---|
| 1 | [add alert for symptom X] | [name] | YYYY-MM-DD | link |
| 2 | [author runbook Y] | [name] | YYYY-MM-DD | link |
| 3 | [fix root cause Z] | [name] | YYYY-MM-DD | link |

**Tracking rule:** action items appear in the next monthly ops review until closed. Missed twice = escalate priority.

## Follow-up

- [ ] Postmortem shared with team
- [ ] Runbook created / updated
- [ ] Alert threshold adjusted
- [ ] SLO reviewed for impact
- [ ] Public status page updated with resolution note (if applicable)

## Attachments

- Correlation IDs affected: [list]
- Logs snapshot: [link]
- Metrics screenshot: [link]
- Related audit-log queries: [link]
