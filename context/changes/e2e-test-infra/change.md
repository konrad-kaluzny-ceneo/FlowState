---
change_id: e2e-test-infra
title: Playwright e2e test infrastructure with authenticated test user
status: researched
created: 2026-05-28
updated: 2026-05-28
roadmap_ref: F-02
linear: FLO-14
github: "#6"
prd_refs:
  - "NFR (crash/refresh recovery)"
  - "NFR (200ms acknowledgement)"
  - "NFR (timer drift <= +-2s)"
unlocks:
  - S-01 (first-pomodoro-cycle)
  - S-02 (full-session-with-breaks)
  - S-03 (mid-cycle-completion-prompt)
  - S-04 (task-attributes-for-scoring)
  - S-05 (end-of-cycle-checkin)
  - S-06 (adaptive-task-suggestion)
  - S-07 (account-recovery-flow)
prerequisites: []
parallel_with:
  - F-01 (session-domain-model - done)
  - S-07 (account-recovery-flow - planning only)
research_required: true
---

# Change: e2e-test-infra

Foundation slice F-02 from `context/foundation/roadmap.md`. Installs Playwright, defines a programmatic authenticated-test-user flow against Neon Auth (beta), and ships one smoke test that signs in, loads the task list, and asserts DOM content. Agent and CI can run `pnpm test:e2e` to verify any UI-facing behavior in a real browser.

This change is tagged `needs-research` in the roadmap. Internal + external research lands in `research.md` before `/10x-plan` runs.

## Artefakty

- `research.md` - internal codebase + external research (Playwright auth strategies with Neon Auth, Next.js 16 + Playwright integration patterns)
- `plan.md` - implementation plan (after research)
