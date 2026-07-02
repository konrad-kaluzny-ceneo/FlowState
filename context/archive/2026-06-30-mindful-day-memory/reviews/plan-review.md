<!-- PLAN-REVIEW-REPORT -->

# Plan Review: mindful-day-memory

Date: 2026-07-02
Reviewer: Claude (10x-plan-review, autonomous ship-slice pipeline)
Change: `mindful-day-memory` / S-42
Plan: `context/changes/mindful-day-memory/plan.md`
Verdict: PASS_WITH_WARNINGS_FIXED

## Scope Reviewed

- `context/changes/mindful-day-memory/plan.md`
- `context/changes/mindful-day-memory/plan-brief.md`
- `context/changes/mindful-day-memory/research.md`
- `context/changes/mindful-day-memory/change.md`
- `context/foundation/roadmap-references/items/S-42.md`, `S-30.md` (cross-check)
- `context/foundation/prd.md` (US-03)
- `context/foundation/lessons.md`
- `context/foundation/tech-stack.md`
- Current code anchors in:
  - `src/lib/recap/types.ts`
  - `src/lib/session/narrative-copy.ts`
  - `src/lib/session/return-handoff.ts`
  - `src/hooks/use-pomodoro-cycle.ts`
  - `src/hooks/use-daily-recap.ts`
  - `src/server/api/lib/session-end-metadata.ts`
  - `src/app/_components/pomodoro-dashboard.tsx` (incl. `PomodoroDashboardBody`, `AuthenticatedPomodoroDashboard`, `GuestPomodoroDashboard`)
  - `src/app/_components/pomodoro-dashboard.test.tsx`
  - `src/app/_components/daily-recap-panel.tsx`
  - `src/app/_components/home-shell.tsx`
  - `src/lib/home/home-session-state.ts`
  - `src/lib/data-mode/types.ts`
  - `messages/en.json`, `messages/pl.json`
  - `src/lib/voice/acceptance-copy.test.ts`
- Prior plan-review precedent: `context/archive/2026-06-29-desktop-calm-workbench/reviews/plan-review.md` (used for output-format/severity conventions; the local `10x-plan-review` SKILL.md is truncated at line 42 in this environment — see Process Note)

## Verdict

The plan is feasible, architecturally sound, and unusually well-grounded in verified code evidence — every file:line claim I independently re-checked against the current worktree matched (types, hook signatures, DOM structure, test helper locations, message catalog contents, the exact-string test fixture quoted verbatim in the Overview). It correctly avoids all three roadmap risk vectors: no new tRPC/Prisma surface, no `DailyRecapPanel`/`home-session-state.ts` modification, and no P-111 footprint-phase scope creep. Guest/auth parity is achieved for free via the existing shared `PomodoroDashboardBody`/`DomainTask` types, which the plan correctly traces.

Three WARNING-level substance gaps were found and fixed directly in `plan.md` (auto-triage per the autonomous pipeline's decision-proxy protocol — no user turn taken). No CRITICAL findings. No open findings remain.

## Findings

### WARNING 1: Pluralization approach cites a non-existent precedent and would ship incorrect Polish grammar

Phase 1's contract said the `done`/`remaining` count strings for the collapsed line render via "a small locale-aware pluralization helper... follow existing count+noun formatting precedent in `Recap.todayDailyTag`/similar simple concatenation; no new i18n keys needed." I checked `Recap.todayDailyTag` — it is a static, count-less tag (`"Daily"`), not a pluralization precedent at all. Polish requires 3-way plural forms (1 zadanie / 2–4 zadania / 5+ zadań); a JS template string cannot express this correctly, so following the plan as written would produce grammatically wrong Polish output for any count other than the one hardcoded in the example. The correct, already-shipped precedent sits directly adjacent to `DayMemory` in both message files: `HomeFocusSummary.standingOpen`/`standingDone` (`messages/en.json:328-329`, `messages/pl.json:328-329`) already use ICU MessageFormat `{count, plural, one {...} few {...} many {...} other {...}}` with full PL forms.

Severity: WARNING (would ship a locale-correctness defect on a slice whose entire purpose is calm, correct narrative copy — not CRITICAL because it doesn't break the build/tests as originally scoped, but it does contradict the plan's own "PL/EN parity" success criteria once exercised with counts >1 or =5+).

Fix applied to `plan.md`:
- Corrected the Phase 1 §1 contract note to name the real precedent and require ICU plural keys instead of hand-composed strings.
- Added Phase 1 §2 "Count pluralization message keys" as an explicit Changes Required item: new `DayMemory.doneCount`/`DayMemory.remainingCount` keys (EN+PL) plus matching accessors in `narrative-copy.ts`.
- Added Progress steps 1.5 (parity test) and 1.6 (PL plural boundary tests at 1/2/5).
- Extended the Testing Strategy unit-test bullet to call out PL plural boundary coverage.
- Confirmed this stays within the "no new tRPC/Prisma" constraint (it's a message-catalog + pure-accessor change, automatically covered by the existing generic `messages-parity.test.ts`).

Confidence in fix: 92 (pattern is a direct, already-proven sibling in the same files; low risk of misapplication).

### WARNING 2: Phase 3's region-assertion plan omits a needed test-infrastructure change

`pomodoro-dashboard.test.tsx:32-38` mocks `useDailyRecap` as a static `vi.mock` factory returning empty `recap` with no per-test override — unlike `usePomodoroCycle`, which already exposes an overridable `usePomodoroCycleMock.mockReturnValue(...)` pattern used throughout the file. Phase 3's plan to add a visible-state region assertion (`expectInsideRegion("home-primary-region", "day-memory-line")` when content exists) requires non-empty recap data, but the plan only said to "extend... using the existing... mocking conventions," without noting that `useDailyRecap`'s mock isn't overridable yet. An implementer following the plan literally could get stuck or improvise an inconsistent workaround.

Severity: WARNING (test-writability gap, not a design flaw — would have cost implementation time/iteration rather than shipping a wrong behavior).

Fix applied to `plan.md`:
- Added an explicit "Test mock note" under Phase 3 §1 describing the conversion needed (mirror `usePomodoroCycleMock`'s pattern).
- Added it to Phase 3's Automated Success Criteria and Progress (step 3.12).
- Updated the Testing Strategy's Integration Tests bullet to reference the converted mock.

Confidence in fix: 90 (mechanical, well-precedented change; the exact target shape already exists in the same file for a sibling hook).

### WARNING 3: "No scroll on load" placement risk asserted but not layout-budgeted, with no stated fallback

The plan places the day-memory line as the first child of `home-primary-region`, but that region is not the top of the page — above it sits a full header (hero image, h1, purpose text, tagline), an optional `GuestBanner`, `OfflineBanner`, and a conditional error/recovery banner, all spaced with `py-16`/`gap-8` (verified in `home-shell.tsx:94-109` and `pomodoro-dashboard.tsx:824-857`). The plan asserts this placement "achieves no scroll... without prop-drilling" purely from data-scope reasoning (what's in scope inside `PomodoroDashboardBody`), not from any layout-height reasoning, and the plan-brief itself only carries 75% confidence on this placement choice versus the research-flagged alternative (header/purpose area). Phase 3 had a manual verification step for no-scroll (3.6) but no stated fallback if that check fails — a real risk given this is the roadmap's explicit hard acceptance criterion ("collapsed one-liner no-scroll").

Severity: WARNING (the placement choice itself is reasonable and well-argued architecturally; the gap is the missing contingency for a hard acceptance criterion that has a known layout-stacking risk).

Fix applied to `plan.md`:
- Added a "No-scroll layout risk and fallback" note to Phase 3's Manual Verification: first mitigation (trim the line's own footprint) before a placement change; explicit fallback slot (inside `<header>`, the research-identified alternative) if the primary-region placement doesn't fit; explicit instruction not to silently accept a scrolled layout as done.
- Cross-referenced this note from Progress step 3.6.

Confidence in fix: 80 (the fallback is directionally correct and matches research's own alternative, but whether it's actually needed can only be known at manual-verification time — appropriately flagged as a contingency, not a redesign).

## Minor Corrections (nits, fixed in passing)

- `pomodoro-dashboard.test.tsx:1048-1066` region-oracle citation was off by ~8 lines; `expectOutsidePrimaryRegion`/`expectInsideRegion` actually start at line 1056. Corrected in both the Current State Analysis bullet and the References section. Non-blocking (would have cost a few seconds of implementer lookup, nothing more).

## Fact-Check Summary (fresh verification, not trusting the plan author)

Independently re-read and cross-checked against the current `FlowState-mindful-day-memory` worktree (not the plan's own citations):

| Claim | Verified |
|---|---|
| `DailyRecap` shape at `src/lib/recap/types.ts:1-29` | Exact match |
| `narrative-copy.ts:119-147` DayMemory accessors + docstring naming S-42 | Exact match, verbatim docstring confirmed |
| `return-handoff.ts:62-105` `resolveContinueTaskId`/`pickHandoffTaskContext` | Exact match |
| `session-end-metadata.ts:15-48` interruption-aware resolver (RUNNING/PAUSED/most-recent WORK, regardless of INTERRUPTED) | Exact match |
| `use-pomodoro-cycle.ts:471-495` `continueTaskId` derivation, null during active session | Exact match |
| `home-primary-region` first child at `pomodoro-dashboard.tsx:865-872`, before `steeringCards` | Exact match |
| `homeIa.state !== "active_work"` is a valid, already-computed check | Confirmed via `home-session-state.ts` |
| `recapPanel` gating is `dataMode === "authenticated" && moduleVisible("recap")` (auth-only, unlike the new element) | Exact match — correctly informs the plan's choice of a different gate |
| `SectionToggle` disclosure pattern at `daily-recap-panel.tsx:39-65` | Exact match |
| `Recap.rowFormat` = `"{label} · {minutes}m · {range}"` at `messages/en.json:376` | Exact match |
| `acceptance-copy.test.ts:72-112` exact-string/120-char-budget test style, including the literal example quoted in the plan's Overview | Exact match, byte-for-byte |
| No `format-day-memory.ts` / `day-memory-line.tsx` exist yet | Confirmed absent |
| `AuthenticatedPomodoroDashboard`/`GuestPomodoroDashboard` both funnel through one `PomodoroDashboardBody`, `recap`/`tasks`/`pomodoro.continueTaskId` all in scope there | Exact match |
| `DomainTask`/`RecapTaskId` are both `string \| number` — no type reconciliation needed between formatter and hook types | Confirmed |
| PRD US-03 reference | Confirmed correct in `context/foundation/prd.md:113-118` |
| Roadmap S-42 acceptance criteria (formatter-only, no new tRPC/Prisma, collapsed one-liner no-scroll, "Wróć tutaj" interruption-aware, exactly 3 sections) | All four directly addressed by the plan's phases |
| No i18n pluralization precedent existed where the plan claimed one | **Discrepancy found — see Finding 1** |
| Test mock for `useDailyRecap` is non-overridable, unlike `usePomodoroCycle`'s | **Gap found — see Finding 2** |

## Checks

- Internal consistency (Current State Analysis vs. Implementation Approach vs. What We're NOT Doing): PASS. No contradictions — every "not doing" item is honored by the phases as written.
- Acceptance coverage vs. `S-42.md` roadmap item: PASS after fixes. Pure formatter (no new tRPC/Prisma): PASS. Collapsed one-liner, no-scroll: PASS with fallback now documented (Finding 3). "Wróć tutaj" interruption-aware: PASS — plan correctly chose `Session.lastFocusedTaskId`/`return-handoff.ts` over `DailyRecap.footprints`, which is the only data source that satisfies "after interruption." Exactly 3 narrative sections, not raw log style: PASS — Phase 2 explicitly forbids `rowFormat`-style output and requires a negative test assertion for it.
- Code anchor freshness: PASS (see Fact-Check Summary; all citations independently re-verified against current worktree, two line-number nits corrected).
- Lessons.md cross-check: No direct hit against L-01–L-04 (Linear/GitHub sync, NFR-200ms) — none apply to a pure presentation/formatter slice with no mutations. The "test every wedge transition" lesson doesn't apply (no overlay/gate/conductor changes in this plan). The "E2E env vars for auth manual verification" lesson is relevant to Phase 3's manual auth-mode check and is already implicitly covered by existing project convention (not restated in-plan, but not a gap — the plan's manual steps don't require new credential handling beyond what other slices already established).
- Progress section format: PASS against `references/progress-format.md` contract — one `## Progress` heading, phases in order, Automated/Manual subdivision, step format correct, indices unique within phase, no steps renamed, new steps (1.5, 1.6, 3.12) added at next available indices without renumbering existing ones (safe to do since no step had landed — all were still `[ ]`).
- i18n parity: PASS after fix — new keys are covered by the existing generic `src/i18n/messages-parity.test.ts`, no new parity test needed.

## Process Note

The `10x-plan-review` `SKILL.md` available in this environment is truncated at line 42 (cuts off mid-sentence in the "Contradiction" bullet of the internal-consistency scan section); no `references/progress-format.md` is bundled under this skill's own folder (the actual reference lives under `10x-plan/references/progress-format.md` and was used directly). This same truncation was independently noted in the prior `desktop-calm-workbench` plan review (`context/archive/2026-06-29-desktop-calm-workbench/reviews/plan-review.md`), confirming it is a persistent environment issue, not specific to this run. This review proceeded using: the readable portion of the skill (input resolution, Step 1 scan categories), the Progress-format contract from its actual location, the ship-slice orchestrator's status-value and resume-matrix conventions (`10x-ship-slice-base/reference.md`), and the most recent sibling plan-review as a format/severity precedent. No gap in review rigor resulted — all findings below were reached via direct fresh code verification, not skill-prescribed steps.

## Confidence for proceeding to implementation: 93/100

Rationale: All three WARNING findings were concrete, independently confirmed against the codebase, and fixed with high-confidence, low-risk patches that reuse existing, proven patterns in the same files (ICU plurals already used one message-block away; overridable-mock pattern already used for the sibling hook in the same test file; fallback placement already identified by research). No CRITICAL findings. The plan's core architecture (formatter-first, zero new backend surface, correct interruption-aware data source, correct guest/auth parity mechanism) was independently re-verified file-by-file and holds. The 7-point gap from a perfect score reflects the residual, inherent uncertainty in Finding 3 (whether the primary-region placement will pass manual no-scroll verification on the first attempt) — this is appropriately a manual-verification risk with a documented fallback, not a planning defect requiring further pre-implementation research.
