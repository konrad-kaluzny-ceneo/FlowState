> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).

# Bugs (B-01…B-04)

## Bugs

### B-01: Cycle end audio toggle unresponsive

- **Outcome:** user can click **Normal**, **Soft**, or **Muted** on the timer panel **Cycle end audio** control and see the selection update immediately; preference persists across refresh (localStorage for guests, server profile when logged in); cycle-end chime respects the chosen mode.
- **Change ID:** fix-cycle-audio-toggle
- **Linear:** [FLO-53](https://linear.app/flowstate-10xdev/issue/FLO-53)
- **GitHub:** [#72](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/72)
- **PRD refs:** FR-013, FR-014
- **Prerequisites:** S-20 (shipped — regression)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Server-sync effect in `useCycleEndAudioPreference` may overwrite optimistic UI before mutation completes; e2e may have seeded preference without exercising live toggle.
- **Status:** done — shipped via [PR #77](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/77) (2026-06-09)

### B-02: Task title edit truncates long names

- **Outcome:** user editing a task title sees a multi-line text control that wraps long names across several lines (auto-resize or scroll) so the full title is readable and editable — not a single-line input that clips overflow.
- **Change ID:** fix-task-title-multiline-edit
- **Linear:** [FLO-54](https://linear.app/flowstate-10xdev/issue/FLO-54)
- **GitHub:** [#73](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/73)
- **PRD refs:** FR-005, FR-008
- **Prerequisites:** —
- **Parallel with:** B-01
- **Blockers:** —
- **Unknowns:** Enter key — newline vs save (document in implement plan).
- **Risk:** Multi-line titles in list display may need matching wrap/read mode when not editing.
- **Status:** done — archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85)).

### B-03: Cycle start / interrupt not optimistic

- **Outcome:** logged-in user clicking **Start Cycle** or **Interrupt** sees the timer panel update within 200ms — running countdown on start, idle/ready on interrupt — without waiting for `sessions.getOrCreateActive` / `cycles.create` / `cycles.interrupt` to complete; server sync runs async with rollback on failure (mirror S-09 task mutation contract).
- **Change ID:** fix-cycle-start-interrupt-optimistic
- **Linear:** [FLO-55](https://linear.app/flowstate-10xdev/issue/FLO-55)
- **GitHub:** [#74](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/74)
- **PRD refs:** NFR (200ms acknowledgement), FR-009, FR-012
- **Prerequisites:** S-09 (optimistic pattern shipped for tasks)
- **Parallel with:** B-01, B-02
- **Blockers:** —
- **Unknowns:** Full S-27 wedge optimistic scope (check-in, suggestion accept) vs fix Start/Interrupt only in B-03 — owner: `/10x-plan`. Block: no.
- **Risk:** Optimistic cycle state diverges on double-submit or server rejection; guest path already local-first — parity testing required.
- **Status:** done — archived 2026-06-10 → `context/archive/2026-06-09-fix-title-multiline-and-cycle-optimistic/` ([PR #85](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/85), [PR #86](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/86)).

### B-04: Cycle Complete overlay flashes after check-in

- **Outcome:** after submitting energy at cycle end, user never sees the stale **Cycle Complete!** modal again — transition proceeds immediately to break start, suggestion loading, or wind-down without a multi-second freeze on the old overlay.
- **Change ID:** fix-cycle-complete-flash-after-checkin
- **Linear:** [FLO-56](https://linear.app/flowstate-10xdev/issue/FLO-56)
- **GitHub:** [#75](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/75)
- **PRD refs:** FR-020, FR-021, NFR (200ms acknowledgement)
- **Prerequisites:** S-05, S-06
- **Parallel with:** B-03
- **Blockers:** —
- **Unknowns:** Show explicit post-check-in loading shell vs hide overlay via `postCheckInTransitioning` flag — owner: `/10x-plan`. Block: no.
- **Risk:** `awaitingCheckIn=false` + `state=completed` gap is the flash window; wind-down branch must stay excluded.
- **Status:** done — shipped via [PR #82](https://github.com/konrad-kaluzny-ceneo/FlowState/pull/82) (2026-06-09)
