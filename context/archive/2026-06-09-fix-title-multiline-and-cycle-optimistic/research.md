# Research: fix-title-multiline-and-cycle-optimistic

## B-02 — Task title multiline edit

- **Symptom:** `task-list.tsx:231-240` uses `<input type="text">` for inline edit; long titles clip.
- **Display:** read mode at `:279` renders `{task.title}` without wrap classes.
- **Fix surface:** `TaskRow` edit control + display button only; `saveEdit` already passes full trimmed string.

## B-03 — Cycle start/interrupt not optimistic

- **Symptom:** `use-pomodoro-cycle.ts:1017-1123` `start()` / `interrupt()` await `sessions.getOrCreateActive` + `cycles.create` / `cycles.interrupt` before `setState("running")` or idle transition.
- **Contrast:** `use-task-mutations.ts` patches TanStack cache in `onMutate` for instant task CRUD (S-09).
- **Guest path:** repositories are sync-fast; bug is authenticated server round-trip only.
- **`isStarting`:** `pomodoro-dashboard.tsx:181` hardcodes `false` — unused; optimistic start makes running immediate instead.

## Risks

- **Start then fast interrupt:** temp negative cycle id before server `create` returns — must suppress or interrupt server cycle when create settles.
- **Timer drift:** reconcile worker `endTime` with server `startedAt` after create (existing `cycleEndTimeMs`).

## Tests

- `use-pomodoro-cycle.test.tsx` — add deferred `createCycle` / `interruptCycle` cases asserting immediate state.
- Task list: component-level test optional; manual + existing e2e smoke sufficient for textarea.
