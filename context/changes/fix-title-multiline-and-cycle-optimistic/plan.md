# B-02 + B-03 — Multiline title edit and optimistic cycle start/interrupt

## Overview

Fix two production bugs in one change: multiline task title editing (B-02) and optimistic Start Cycle / Interrupt for authenticated users (B-03).

## Phase 1: Multiline task title edit (B-02)

- Replace edit `<input type="text">` with `<textarea>` (`rows={2}`, `resize-y`, `whitespace-pre-wrap`).
- Enter saves; Shift+Enter inserts newline; Escape cancels; blur saves.
- Read mode: `whitespace-pre-wrap break-words` on title button.

## Phase 2: Optimistic cycle start/interrupt (B-03)

- `start()`: transition to `running` + start worker before server calls; temp negative cycle id; reconcile ids on success; rollback on error.
- Track `cancelPendingStartRef` for interrupt-before-create-settles.
- `interrupt()`: idle UI immediately; rollback on server error.
- Unit tests with deferred mocks.

## Progress

### Phase 1
- [x] Multiline edit + display wrap in `task-list.tsx`

### Phase 2
- [x] Optimistic `start` / `interrupt` in `use-pomodoro-cycle.ts`
- [x] Unit tests for immediate UI transition

### Prevention (B-02 / B-03)
- [x] `use-pomodoro-cycle.test.tsx` — interrupt failure rollback + pending-create cancel
- [x] `task-list.test.tsx` — textarea multiline save + long title read mode
- [x] `lessons.md` L-04, `test-plan.md` §6.8, `AGENTS.md` component-smoke bullet
- [x] Inline comments in `task-list.tsx` and `use-pomodoro-cycle.ts`

### Automated verification
- [x] `pnpm test` (392 passed)
- [ ] `pnpm check` (pre-existing CRLF on unrelated files; changed files formatted)
