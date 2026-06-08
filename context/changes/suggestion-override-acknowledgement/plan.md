# Plan: suggestion-override-acknowledgement

## Goal

After post-check-in suggestion override, user sees a brief validating acknowledgement line. Override still recorded via existing `recordDecision` tRPC.

## Progress

### Phase 1 — Copy + hook state

- [x] Add `OVERRIDE_ACK_LINE` in `src/lib/suggestion/override-ack-copy.ts`
- [x] Extend `use-pomodoro-cycle` with `overrideAcknowledgement` state, show on override, auto-dismiss 3s
- [x] Unit test: override sets ack; accept does not

**Automated:** `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`

### Phase 2 — UI + e2e

- [x] Render ack in `pomodoro-dashboard.tsx` with `data-testid="suggestion-override-ack"`
- [x] Extend `e2e/task-suggestion.spec.ts` override test for ack visibility

**Automated:** `pnpm test`; `set CI=true && pnpm test:e2e -- e2e/task-suggestion.spec.ts`

### Phase 3 — Docs + ship

- [ ] Update change status; roadmap on merge via ship-slice

**Automated:** `pnpm check`
