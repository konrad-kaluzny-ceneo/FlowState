---
change_id: testing-quality-gates-wiring
title: Quality-gates wiring (test-plan Phase 4)
status: implementing
created: 2026-06-06
updated: 2026-06-06
archived_at: null
---

## Notes

Open a change folder for rollout Phase 4 of context/foundation/test-plan.md: "Quality-gates wiring".
Risks covered: cross-cutting (lint, typecheck, unit/integration, critical e2e on every PR). Test types planned: CI gates.
Risk response intent:
- Lock the test floor so merges cannot bypass lint, typecheck, Vitest suite, or Playwright critical flows already shipped in Phases 1-2.
- Wire set CI=true && pnpm test:e2e with E2E_REUSE_SERVER or playwright webServer config per AGENTS.md; use E2E_WORKERS=1 if Neon Auth rate-limits parallel sign-up.
After creating the folder, follow the downstream continuation rule.
