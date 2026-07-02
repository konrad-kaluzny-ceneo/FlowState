# Mindful day memory (S-42) — Plan Brief

> Full plan: `context/changes/mindful-day-memory/plan.md`
> Research: `context/changes/mindful-day-memory/research.md`

## What & Why

Replace the absent "what did I do today, what's left, where was I" moment on home with a calm, narrative day memory: a collapsed one-liner visible on every load, expanding into exactly three sections — Domknięte (done) / Zostaje (remains) / Wróć tutaj (return-to, naming the last focused task after interruption). This is S-30 Phase 2 — a pure formatter over the already-shipped `DailyRecap` substrate, not a new feature pipeline.

## Starting Point

`DailyRecap` (done/remains data), the `DayMemory.*` i18n catalog with ready pure copy accessors, and S-18's interruption-aware `continueTaskId`/`pickHandoffTaskContext` resume machinery are all already shipped and fully tested — but nothing consumes `DayMemory.*` yet, and no component composes these three sources together. S-40/S-41 explicitly reserved the copy namespace and left DOM placement undecided.

## Desired End State

Every home load (guest or authenticated) shows one calm line summarizing the day at the top of the primary region — no scroll needed. Tapping it reveals three narrative sections in prose, not the raw `title · 45m · timestamp` log style `DailyRecapPanel` already uses elsewhere. The line disappears during active focused work and reappears once the session ends, and is absent entirely when there's nothing to report.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| "Wróć tutaj" data source | `pomodoro.continueTaskId` + `pickHandoffTaskContext(tasks)`, not `DailyRecap.footprints` | `continueTaskId` is interruption-aware (any WORK cycle state via `Session.lastFocusedTaskId`); `footprints` is COMPLETED-cycle-only and would silently drop interrupted work | Research (85), confirmed via direct trace of `use-pomodoro-cycle.ts:471-495` |
| Formatter module location | `src/lib/recap/format-day-memory.ts` | Co-locates with `DailyRecap` types/builders, mirrors existing `build-daily-recap.ts` + `guest/recap.ts` pairing around one shared type | Plan |
| DOM placement | First child of `home-primary-region` inside `PomodoroDashboardBody`, not a new `home-shell.tsx` slot or `DailyRecapPanel` extension | `recap`/`continueTaskId`/`tasks` are only in scope inside `PomodoroDashboardBody`; primary region always renders and sits above the fold, achieving "no scroll" without prop-drilling or restructuring existing fetch boundaries | Plan (revises research's header-area suggestion, confidence 75, after tracing actual data scope) |
| Active-work visibility gating | Reuse existing `homeIa.state !== "active_work"` computed value; no new `HomeModuleKey` | Matches S-30/S-41's "recap hidden during active work" precedent without touching the tested `home-session-state.ts` state machine for one additive element | Plan |
| Guest parity | In scope now, near-zero incremental cost | `useDailyRecap()` and `continueTaskId` already branch guest/auth behind identical shapes; `PomodoroDashboardBody` is one shared component for both paths, so no extra branching is needed | Research (65) → Plan (confirmed low-cost after tracing `GuestPomodoroDashboard`) |
| Expanded section content style | Task-title lists + one return-to sentence, explicitly NOT `Recap.rowFormat` (`{label} · {minutes}m · {range}`) | Acceptance criteria explicitly require narrative sections, not a raw timing log; `DailyRecapPanel` already owns the log-style view and stays untouched | Plan (roadmap acceptance criterion, hard constraint) |

## Scope

**In scope:**
- `format-day-memory.ts` pure formatter (done/remains/return-to composition + collapsed line)
- `DayMemoryLine` presentational component (collapsed line + 3-section expand/collapse)
- Wiring into `PomodoroDashboardBody`'s primary region, gated on active-work state
- Guest and authenticated parity
- Unit tests (formatter + component) and extended `pomodoro-dashboard.test.tsx` region assertions

**Out of scope:**
- Any change to `DailyRecapPanel`, its tests, or its row/log format
- Any change to `home-session-state.ts` module-priority system
- New tRPC procedures, Prisma queries, or schema changes
- Footprint sub-phase / P-111 type-mix line (separate roadmap item)
- Dismiss-state persistence beyond component-local expand/collapse

## Architecture / Approach

Three-layer formatter-first build, following house pattern (F-14's `narrative-copy.ts`, S-18's `return-handoff.ts`): (1) pure formatter over `DailyRecap` + task list + `continueTaskId` → structured `DayMemory` result, delegating all copy to existing `narrative-copy.ts` accessors; (2) presentational component rendering that result with a hand-rolled disclosure toggle (matching `daily-recap-panel.tsx`'s `SectionToggle` pattern); (3) integration as the first element in `home-primary-region`, reusing an already-computed session-state boolean for active-work gating. No new data fetching at any layer.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure day-memory formatter (TDD) | `format-day-memory.ts`, fully unit-tested, no React | Miscounting remains/done or mishandling null return-to; mitigated by exact-string test style mirroring `acceptance-copy.test.ts` |
| 2. Day-memory presentational component (TDD, component-level) | `DayMemoryLine`, collapsed + 3-section expand, RTL-tested | Accidentally reproducing `DailyRecapPanel`'s log-row style instead of narrative prose |
| 3. Home integration (UI wiring) | Wired into `PomodoroDashboardBody`, visible above the fold, hidden during active work, guest+auth parity | Layout/scroll regression or visibility-gating drift from the active-work precedent; mitigated by structural (not pixel) test oracles plus manual no-scroll check |

**Prerequisites:** None outstanding — S-30, S-18, F-14, S-40, S-41 all shipped and archived; substrate fully verified against current code.
**Estimated effort:** ~1 session across 3 phases (formatter + component are small pure/presentational modules; integration is a small, well-scoped edit to one existing file).

## Open Risks & Assumptions

- Assumes `home-primary-region` (not header/purpose area, as research tentatively suggested at 75 confidence) is the correct "no scroll, no log" slot — verified during planning that `recap`/`continueTaskId` are only in scope inside `PomodoroDashboardBody`, making primary-region placement both correct and lower-risk than restructuring `home-shell.tsx`'s fetch boundaries. If this is wrong, Phase 3 is the only phase to redo.
- Assumes reusing `homeIa.state !== "active_work"` (rather than adding a new `HomeModuleKey`) is acceptable — this keeps `home-session-state.ts` untouched but means the day-memory element's visibility isn't part of that module's own test matrix; Phase 3's manual verification step explicitly covers this transition.

## Success Criteria (Summary)

- Home load shows a calm one-line day memory with no scroll, replacing the "nothing here" gap on first paint.
- Expanding it shows exactly three narrative sections, never a raw timing log.
- "Wróć tutaj" correctly names the last focused task even after an interrupted (not just completed) cycle.
- Guest and authenticated users get the same experience; zero new backend queries introduced.
