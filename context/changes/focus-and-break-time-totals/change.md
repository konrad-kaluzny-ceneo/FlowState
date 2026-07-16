---
change_id: focus-and-break-time-totals
title: Honest focus and break time totals — count stopped-early cycles and report break time
status: implementing
created: 2026-07-15
updated: 2026-07-16
roadmap_id: S-52
prd_refs: US-07
---

## Notes

Roadmap slice S-52 (`/10x-roadmap-add` 2026-07-14). Makes the daily "Twój dzień"
totals honest: today they count only WORK cycles the timer carried to their end,
so stopping a cycle early discards the work and break time is never measured.

Goal (PL): wiarygodny obraz realnie przepracowanego czasu skupienia i odpoczynku,
a nie tylko sesji doprowadzonych do końca timera.

Resolved decisions (this planning session, 2026-07-15):
- **Display:** two separate totals — focus time and break time side by side.
- **Guest parity:** add guest-side DayStats so both modes report the same
  focus + break totals (charts stay auth-only).
- **Charts:** hourly + work-type charts follow the same widened counting.
- **Session KPIs:** `sessionCount` / avg stay COMPLETED-WORK-only.
- **Forward-only:** accept the ship-day straddle; no cutoff constant (rolling
  ~24h window means past days are never re-shown).
- **Sub-minute:** keep the existing 1-minute floor.
- **Pause-then-stopped:** interrupt-from-PAUSED sets `endedAt = pausedAt`.
- **S-27 focus budget:** left unchanged (out of scope).

Prereqs (all done): S-24, S-30, S-42, S-45, S-50.
Linear: [FLO-105](https://linear.app/flowstate-10xdev/issue/FLO-105/user-sees-in-twoj-dzien-the-total-time-actually-spent-on-focus-cycles)
GitHub: [#204](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/204)
Item detail: `context/foundation/roadmap-references/items/S-52.md`.
