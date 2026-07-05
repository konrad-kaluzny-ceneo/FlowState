<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Stateful Illustration System (S-43)

- **Plan**: context/changes/stateful-illustration-system/plan.md
- **Scope**: Phase 4 of 4 (full plan review)
- **Date**: 2026-07-03
- **Verdict**: APPROVED (2 warnings found and fixed in-review)
- **Findings**: 0 critical, 2 warnings (both FIXED), 5 observations

## Review basis

- Diff: `git diff 2753691..HEAD -- src/ e2e/` (20 files, +993/−16 before fixes).
- Two parallel sub-reviews (plan drift; safety/quality/pattern) + independent verification.
- Automated criteria re-run at review time: `pnpm typecheck` PASS, `pnpm check` (Biome; repo has no `lint` script — see F7) PASS, `pnpm vitest run` 1154/1154 PASS (after fixes; 1152/1152 before), `pnpm exec playwright test e2e/stateful-illustration.spec.ts` PASS 1/1 (re-run post-fix).
- Slice-specific safety gates: S-34 downstream derivation PASS (`use-pomodoro-cycle.ts` untouched; variant resolved in a `useMemo` over committed state, `pomodoro-dashboard.tsx:600+`); 7 wedge gate files zero-diff vs baseline; `aria-hidden` preserved on all 4 illustration components and asserted in unit + e2e; `package.json`/lockfile untouched (no new deps); crossfade CSS-only ≤200ms with `motion-reduce:transition-none`, zero JS timers.
- Logged deviations (a) provider bridge, (b) `energyTint` → `data-illustration-energy`, (c) `empty-garden-bed.tsx` `variant="idle"`, (d) dashboard-local `recentlyClosedSession`: all verified soundly executed. One production derivation site feeds both hero (via context) and rail (direct memo); guest/pre-publish hero degrades to the `idle` baseline; energy-tint CSS specificity correct; (c) forced by the required `variant` prop and visually identical to baseline.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS (2 warnings fixed in-review) |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Stale illustration variant on publisher unmount

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/lib/design/home-illustration-variant.tsx:68-76 (pre-fix)
- **Detail**: `usePublishHomeIllustrationVariant` had no effect cleanup — if `PomodoroDashboardBody` unmounts while the provider stays mounted (error boundary, suspense swap, data-mode remount), the hero keeps the last published variant (e.g. stale `work`) instead of resetting to `idle`. Unreachable in today's tree but the hook contract shouldn't depend on that.
- **Fix**: Added an unmount cleanup effect that publishes `IDLE_ILLUSTRATION_STATE`, plus a unit test ("resets consumers to the idle baseline when the publisher unmounts").
- **Decision**: FIXED

### F2 — Closure flag fires on gate suppression, not only dismissal

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/app/_components/pomodoro-dashboard.tsx:454-463 (pre-fix)
- **Detail**: `recentlyClosedSession` was set on any visible→hidden transition of the closure gate. `showSessionClosure` (transition-conductor.ts:63-75) also flips false on `cyclePaused` suppression or cycle recovery (`activeCycle` non-null / `state` leaves `idle`) while `pendingClosureLine` is still set — those paths would set the flag spuriously and, since `closure` has top resolver precedence, could mask the `work` variant until the next state change.
- **Fix**: Guard the set on `pomodoro.pendingClosureLine == null` (true dismissal is exactly `dismissSessionClosure()` → `setPendingClosureLine(null)`), added `pendingClosureLine` to effect deps, plus a unit test ("does not show the closure variant when the gate is suppressed without dismissal"). Gate dismissal handlers themselves remain untouched (wedge-transition lesson respected).
- **Decision**: FIXED

### F3 — Closure variant has no time-based fallback

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/pomodoro-dashboard.tsx:574-588
- **Detail**: `closure` persists until the next `homeIa.state` change — if the user idles after dismissal it stays indefinitely. Matches the accepted decision (d) "clear-on-next-state-change" and the no-JS-timer constraint, but the Phase 2 BDD phrase "briefly shows" reads time-bounded. Sanctioned; flag for design awareness only.
- **Decision**: ACCEPTED (per logged decision d)

### F4 — Unused `wedgeGateActive` dep causes no-op republish per gate toggle

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/app/_components/pomodoro-dashboard.tsx:596-612
- **Detail**: `wedgeGateActive` is a memo dep but the resolver never branches on it (documented no-op input kept for signature parity with `work-focus-shell.ts`). Each gate open/close creates a new object identity → context publish → hero re-render with identical values. Negligible blast radius; kept for input-shape parity.
- **Decision**: SKIPPED (cost < churn)

### F5 — Guardrail test is a one-level static scan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/design/illustrations/no-illustrations-on-gates.test.ts:26-33
- **Detail**: Stronger than planned (catches alias/relative/barrel paths, bans the context module, `existsSync` anti-vacuous guard) but won't catch a laundered transitive import. Backed by runtime e2e assertions that gates contain no illustration testids. Acceptable tripwire; a `no-restricted-imports` zone could close the transitive hole later.
- **Decision**: SKIPPED (acceptable residual)

### F6 — E2E hero locator relies on `.first()`; return/closure unit-only

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: e2e/stateful-illustration.spec.ts:37-41
- **Detail**: Two nodes share `home-hero-sprig` testid (hero + rail copy); `.first()` relies on DOM order — container-scoping would be sturdier. `return`/`closure` variants are covered at unit level only. Fine for a `@skip-belt` catalog spec.
- **Decision**: SKIPPED (non-blocking; note for future e2e touch)

### F7 — Plan verification command drift + open manual checkboxes

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md (Progress 2.7, 4.4); package.json scripts
- **Detail**: Plan's `pnpm lint` doesn't exist — repo convention is `pnpm check` (Biome), which passes. Manual items 2.7 (reduced-motion feel) and 4.4 (visual mid-gate confirmation) remain `[ ]` — pending human/manual QA; reduced-motion behavior is covered by `motion-reduce:transition-none` classes asserted in unit tests, and mid-gate absence is asserted by e2e, so risk is low.
- **Decision**: ACCEPTED (pending manual QA before ship)

## Fix commits

- Fixes for F1 + F2 (code + 2 new unit tests) committed on this branch as a review-fix commit; full suite re-run green (1154/1154), typecheck/lint green, targeted e2e re-run green.
