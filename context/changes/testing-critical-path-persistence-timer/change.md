---
change_id: testing-critical-path-persistence-timer
title: Phase 1 test rollout — critical-path persistence and timer accuracy
status: planned
created: 2026-06-04
updated: 2026-06-04
archived_at: null
---

## Notes

Rollout Phase 1 of context/foundation/test-plan.md: "Critical-path persistence & timer".
Risks covered: #1 (page refresh/crash leaves missing or wrong task/cycle state), #2 (work cycle elapsed time drifts >±2s in backgrounded tab).
Test types planned: unit + integration + targeted e2e.
Risk response intent:
- Risk #1: After refresh mid-active work cycle, user sees the same tasks and the cycle resumes at the correct phase and remaining time. Must prove persisted state round-trips correctly — not just that save was called.
- Risk #2: At cycle end in a backgrounded tab, elapsed time is within ±2s of the configured work duration. Must prove the timer worker/clock handles background throttling — fake timers in jsdom alone are insufficient.
