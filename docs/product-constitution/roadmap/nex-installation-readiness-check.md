# Future Module Brief · NEX Installation Readiness Check

**Status:** Roadmap · not scheduled
**Source:** Philip O'Farrell · 2026-07-28
**Depends on:** Materials v1 (frozen) · basic Projects module (or delivery-date awareness in whichever module holds installation scheduling)
**Category:** Customer coordination · site preparation · pre-installation workflow

---

## The problem this solves

Many staircase problems are not caused by the staircase — they happen because the house is not ready when the installers arrive. Arriving on site with a finished timber staircase and discovering the house is not prepared is one of the biggest frustrations for staircase companies.

An experienced installer already checks these things mentally. NEX turns that experience into a repeatable customer process.

## The trigger

A few days before the scheduled installation date, NEX sends a customer readiness check.

## The eight-point checklist

### 1 · Old staircase removed (if replacing)

Before installers arrive:

- ✓ Old staircase removed
- ✓ Waste removed
- ✓ Access route clear

Installers need space to bring in strings, treads, handrails, newels, and tools.

### 2 · Walls and ceilings finished

The staircase area should ideally have plastering completed · ceilings finished · major building work completed. Avoid installing a finished timber staircase while builders are still plastering, cutting blocks, drilling, or creating dust. Dust damages finishes.

### 3 · Flooring condition

Depends on the staircase design. The company should know:

- Is flooring already fitted?
- Is flooring going underneath the staircase?
- Are skirting boards installed?

If flooring goes under the staircase → installers need the correct floor height. If the staircase sits on finished flooring → protection must be used.

### 4 · Temperature and humidity (critical for timber)

The house should be:

- ✓ weather sealed
- ✓ heated
- ✓ reasonably dry

Timber reacts to its environment (see `wood-intelligence-principles.md` Principle 3 · Environment changes the risk). A staircase should not be installed into a cold, damp building and then exposed to normal house conditions later.

### 5 · Power availability

Installers may need power for saws, drills, sanders, lighting, chargers. Usually standard household electricity is enough. They may bring extension leads, dust extraction, and cordless tools — but no power slows installation.

### 6 · Access and parking

A staircase contains long parts. Check: can a van park nearby · can long handrails enter the property · are doorways clear. A 4-metre handrail needs planning.

### 7 · Protect finished areas

Before installation: remove or protect furniture, carpets, decorations. The installers should protect floors, walls, finished surfaces.

### 8 · Builder coordination

A common mistake: builder says *"fit the staircase now, we'll finish plastering later."* This creates problems.

Better sequence:

```
First fix building work
        ↓
Plastering
        ↓
Drying period
        ↓
Staircase installation
        ↓
Final decoration
```

## The NEX customer message

Sent a few days before the scheduled installation date, in operations-manager voice:

```
NEX Installation Check

Your staircase installation is scheduled for 14 August.

Please confirm:
  ✓ Area clear
  ✓ Old staircase removed
  ✓ Electricity available
  ✓ Heating operational
  ✓ Walls/plastering complete
  ✓ Access route clear

Your staircase contains natural timber.
Stable room conditions help achieve the best result.

[All ready]  [Something's not ready]
```

If the customer replies *"something's not ready"*, NEX opens a short conversation to identify which item and offer to reschedule — never leave the installer walking into a problem.

## Quality-gate stance (all 12 must pass)

- **Q1 (feels like ops manager):** Passes — this is exactly what an experienced staircase installer would ring the customer to check the week before.
- **Q3 (owner reviews and approves, doesn't fill forms):** The check is a confirmation list, not a data-entry form.
- **Q6 (owner understands what will happen):** The confirm/not-ready split is clear · not-ready never silently proceeds.
- **Q8 (uncertain → ask):** If any item is ambiguous, NEX asks one specific follow-up.
- **Q9 (voice/photo/upload):** Owner should be able to send a photo of the site state as evidence · same input model as everywhere else.
- **Q11 (workshop manager test):** Passes — captures the mental checklist an experienced installer already runs.

## Design constraints

- Never send more than one nudge per installation. No spam. If the customer hasn't replied 48h before install, escalate to the staircase company's account instead of nagging the customer.
- Every reply captured in the audit trail alongside the delivery/install event.
- The photo-of-site variant uses the same multimodal LLM as delivery-note parsing — extract what's ready and what isn't, present it back for the customer to confirm.
- Never generate a *"failed readiness"* verdict. Always frame as *"here's what still needs to happen for a smooth install day"* — customer stays in control.

## Related documents

- `wood-intelligence-principles.md` — Principle 3 (environment changes risk) is the trade justification for the temperature/humidity check
- `docs/product-constitution/principles/0002-standard-nex-workflow.md` — this module is a pre-approval touchpoint on the six-step workflow
