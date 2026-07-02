<!-- PLAN-REVIEW-REPORT -->

# Plan Review — Stateful Illustration System (S-43)

**Plan**: `context/changes/stateful-illustration-system/plan.md`
**Reviewed**: 2026-07-02
**Verdict**: APPROVED (after auto-applied fix)

## Summary

The plan is well-grounded: file/line claims for `HomeHeroSprig`, `deriveHomeSessionState()`, the rail slot, the `showBreakTransitionLine`/`showInFlowSummary` transient-flag precedent, and the 7 wedge-gate files' zero illustration imports all check out against the actual source. One CRITICAL architectural defect was found in Phase 2's "single-owner derivation" design and has been fixed directly in `plan.md`/`plan-brief.md`.

## Findings

### CRITICAL — Phase 2 "single derivation owner" was architecturally impossible as drafted (RESOLVED)

The plan's flagged open item ("exact `home-shell.tsx` ↔ `PomodoroDashboardBody` render-tree relationship not fully traced") was a real gap, not a benign unknown. Verified via direct read of `src/app/_components/home-shell.tsx`:

- `HomeShellContent` (lines 65-116) renders `<HomeHeroSprig />` directly at line 98.
- The same `HomeShellContent` renders `<PomodoroDashboard />` at line 111, which wraps `PomodoroDashboardBody` (`pomodoro-dashboard.tsx:1094`/`1121`) — a **sibling** subtree, not a parent/child of the hero.

The original Phase 2 §4 said `PomodoroDashboardBody` should "own the single `resolveIllustrationVariant()` call and pass the result to both sites" — impossible, since a child component cannot pass data to its sibling. If implemented as written, the implementer would hit this wall at Phase 2 and either (a) stall, or (b) improvise two independent derivations, silently violating the plan's own "never two independent derivations" contract and risking hero/rail drift.

**Fix applied**: Rewrote Implementation Approach and Phase 2 §4 in `plan.md` to name `HomeShellContent` (the actual common ancestor) as the derivation owner, with `narrativeLatestEnergy`/`recentlyClosedSession` surfaced up to it via the existing provider/hook layer (`DataModeProvider`/`OnboardingProvider` or a new small hook), and the resolved variant passed down as a prop to both the hero (`home-shell.tsx:98`) and, via a new prop through `PomodoroDashboard`, to the rail (`pomodoro-dashboard.tsx:807-811`). Also updated `plan-brief.md`'s "Open Risks & Assumptions" line from "needs confirming" to the resolved finding.

### NOTE — Guardrail scope is correctly narrow

Spot-checked `check-in-overlay.tsx` and `overlay-shell.tsx`: neither imports from `design/illustrations`, confirming the plan's Phase 3 premise. No barrel re-export of illustrations exists that would make the string-match guardrail miss an indirect import — scan approach is sound as written.

### NOTE — Transient-flag precedent confirmed

`showBreakTransitionLine`/`showInFlowSummary` exist in `home-session-state.ts` (lines 42-43, consumed 254/280) exactly as cited, supporting the `recentlyClosedSession` design by analogy.

## Confidence

90/100 — high confidence in the file-level verification performed; the one residual soft spot is whether `narrativeLatestEnergy`/`recentlyClosedSession` can be cleanly surfaced to `HomeShellContent` without deeper hook restructuring, which the fixed plan text now correctly flags as an implementer decision rather than glossing over.
