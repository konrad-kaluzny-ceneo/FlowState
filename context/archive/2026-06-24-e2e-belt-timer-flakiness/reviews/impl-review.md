---
date: 2026-06-26
reviewer: code-reviewer subagent
change_id: e2e-belt-timer-flakiness
verdict: APPROVED
---

# Implementation review — e2e-belt-timer-flakiness

## Verdict

**APPROVED** — zero CRITICAL findings.

## Summary

`ensureFakeClock` at the top of `clickStartCycle` correctly closes the 1s belt wall-clock race under `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`. WeakSet idempotency keeps 30s/60s, guest, and auth callers safe. README documents UI-start vs API-seed contract.

## Findings triage

| ID | Severity | Action |
|----|----------|--------|
| Belt 20/21 locally | medium | Accepted — target flake mode fixed; seed R7 passed on isolated retry; CI uses `next start` |
| Direct Start Cycle bypass in skip-belt spec | low | Deferred |
| Stale pattern note in change.md | low | Deferred |

## Confidence

92% — helper design matches research; local belt 20/21 with all previously flaky fast-cycle specs green.
