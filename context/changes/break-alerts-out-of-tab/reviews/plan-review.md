<!-- PLAN-REVIEW-REPORT -->

# Plan Review: break-alerts-out-of-tab

**Date:** 2026-06-18  
**Reviewer:** Cursor Agent (`/10x-plan-review`, sub-agent code verification)  
**Plan:** `context/changes/break-alerts-out-of-tab/plan.md`  
**Brief:** `context/changes/break-alerts-out-of-tab/plan-brief.md`  
**Verdict:** READY WITH FIXES → **READY TO IMPLEMENT** (post-edit 2026-06-18)

## Summary

The plan correctly targets `startBreakAfterWorkComplete` as the sole break-start entry point and follows test-first phasing aligned with health-check. Sub-agent verified all break paths flow through that function, visibility guard choice, and settings surface anchors. **Fix before `/10x-implement`:** authenticated preference reads cannot work inside the hook without an injected getter (F1), denied-permission settings UX is underspecified vs FR-001 (F2), and alert placement inside async break-start must be pinned before network invalidation (F4).

**Confidence:** 88%

## Dimension verdicts

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Internal consistency | PASS | Trigger timing, visibility guard, and scope boundaries align |
| Feasibility | PASS | F1/F4 addressed in plan edit |
| Scope discipline | PASS | Work Mode Guard deferred; break-start only |
| Pattern compliance | PASS | Mirrors cycle-audio-preference; co-located tests |
| Success criteria | PASS | F6 e2e criterion fixed |

## Findings

| ID | Severity | Impact | Finding | Recommended fix |
|----|----------|--------|---------|-----------------|
| F1 | HIGH | HIGH | Hook has no `OnboardingScope`/`userId` — authenticated storage reads would default `true`, ignoring user toggle | Add `getOutOfTabBreakAlertsEnabled?: () => boolean` to `UsePomodoroCycleOptions`; wire from dashboard |
| F2 | HIGH | HIGH | FR-001/US-01 require settings path when permission **denied**; Phase 2 is toggle-only | Add denied-state helper + retry/settings copy in Phase 2 contract |
| F3 | MEDIUM | MEDIUM | Permission prompt may stack with first-run, cycle-intention, kickoff overlays | Define overlay priority in Phase 2; manual test first auth start |
| F4 | MEDIUM | MEDIUM | `startBreakAfterWorkComplete` is async; alert after final `await` risks wrong visibility | Mandate fire **immediately after** `startWorker`, before `Promise.all(invalidate)` |
| F5 | MEDIUM | LOW | Auth check-in gate delays break start; alert fires on async create window, not work expiry | Document expected reach window in brief/plan; add manual test step |
| F6 | MEDIUM | MEDIUM | Phase 4 `--grep-invert @skip-belt` on fully tagged spec = 0 tests | Use explicit file run; keep `@skip-belt` on file |
| F7 | MEDIUM | MEDIUM | Hook tests use QueryClient-only wrapper; direct `useOnboarding()` would break 68 tests | Prefer injected getter (F1); duplicate mocks in new describe |
| F8 | LOW | LOW | No guest→auth merge for out-of-tab pref (cycle audio has merge) | Optional follow-up; default `true` limits impact |
| F9 | LOW | LOW | Manual checklist missing denied-permission → audio-only fallback | Add manual step per PRD US-01 |
| F10 | LOW | LOW | Stale line refs for visibility listener (861-883 vs ~907-930) | Update refs when editing plan |

## Strengths

- Correct integration point — all break cycles through `startBreakAfterWorkComplete`
- Visibility guard matches code (`document.visibilityState`, not stale ref alone)
- Test-first phasing matches health-check T1–T4 gaps
- FR-005 preservation scoped — avoids `handleCycleExpired` catchUp paths
- Settings surface anchored in `timer-panel` / `CycleAudioPreferenceControl`

## Checklist

- [x] Desired end state matches PRD thread US-01–02 / FR-001–006
- [x] Scope boundaries clear (no Work Mode Guard, no service worker)
- [x] Phase ordering — lib → UI → hook last
- [x] Progress section mirrors phase Success Criteria
- [x] Authenticated pref wiring specified (F1 — plan Phase 2 §6 + Phase 3 §1-3)
- [x] Denied-permission UX specified (F2 — plan Phase 2 §2)
- [x] Phase 4 e2e success criterion valid (F6 — explicit file run)

## Triage (recommended before implement)

| ID | Suggested action |
|----|------------------|
| F1, F4 | **Edit plan Phase 3** — injected getter + synchronous alert placement |
| F2, F3 | **Edit plan Phase 2** — denied-permission UX + overlay sequence |
| F5, F6, F9 | **Edit plan** — manual tests + Phase 4 criterion |
| F7 | Covered by F1 fix |
| F8, F10 | Optional polish |

## Decision

**Plan edits applied (F1–F6, F3, F5, F9, F10). Proceed to `/10x-implement break-alerts-out-of-tab phase 1`.**

**Next:** `/10x-implement break-alerts-out-of-tab phase 1` (feature branch/worktree first per AGENTS.md).
