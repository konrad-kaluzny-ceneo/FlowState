# Task Resume Context Note (S-18) Implementation Plan

## Overview

Add optional `Task.resumeNote` (~120 chars) captured at mid-cycle completion continue path and editable on task rows; display on `TaskSuggestionCard` and when manually refocusing a task with a stored note. Display-only — no scorer changes. Unblocks S-17 handoff.

## Decision Log (orchestrator proxy)

| Question | Decision | Confidence |
|----------|----------|------------|
| `Task.resumeNote` vs snapshot | Persistent nullable `resumeNote` on Task (F-05 pattern) | 88% |
| Auto-clear on complete? | Clear `resumeNote` when task status → completed | 85% |
| Scoring influence? | Display-only; bundle in `suggestion.next` payload | 92% |
| Mid-cycle note target | Attach to **newly selected next task** on continue path | 78% |
| Manual refocus surface | Muted subtitle on active row when focusing task with note | 80% |
| Show during running WORK? | No — idle/break selection only | 85% |

## Current State Analysis

- No resume field in Prisma, tRPC, guest, or UI.
- Mid-cycle continue: `MidCycleCompletionPrompt` → `onMidCycleContinueWithTask` marks pending done + `rebindTask`.
- Suggestion card shows title + rationale; no secondary context line.
- Focus locked during WORK running; manual refocus when idle/break.

## Desired End State

1. User on mid-cycle continue path can optionally enter ~120 char note (skippable) for the **next** task before continuing cycle.
2. User can edit/clear `resumeNote` on active task row (compact field, wedge-gated display).
3. Post-check-in and kickoff suggestion cards show resume note below title when present.
4. Manual Focus on task with note shows subtitle on that row (`data-testid="task-resume-note"`).
5. Note clears when task marked completed.
6. Guest + server parity; guest import preserves note.
7. `pnpm check`, `pnpm test` green.

## What We're NOT Doing

- Mid-cycle switch without mark-complete (no UI exists)
- Scorer / rationale template changes
- S-17 narrative or 8h handoff (downstream)
- Guest suggestion card (auth-only wedge surfaces)
- Optimistic task mutation for mid-cycle capture path
- E2e belt expansion (component tests sufficient)

## Phase 1: Schema + domain layer

### Changes

- `prisma/schema.prisma`: add `resumeNote String? @db.VarChar(120) @map("resume_note")`
- Run `pnpm prisma migrate dev --name task_resume_note`
- `src/lib/data-mode/types.ts`: add `resumeNote: string | null` to `DomainTask`; extend repository create/update
- `src/lib/guest/schema.ts`: add optional `resumeNote` max 120
- `src/lib/repositories/server-repositories.ts` + `guest-repositories.ts`: map field
- `src/server/api/lib/import-guest-snapshot.ts`: import `resumeNote`
- `src/server/api/routers/task.ts`: Zod + create/update; clear on status completed
- Unit test: task router resumeNote validation + clear-on-complete

### Success Criteria

- Migration applies; `pnpm test` passes for task router tests
- `pnpm check`, `pnpm typecheck`

## Phase 2: Mid-cycle capture UI

### Changes

- Extend `MidCycleCompletionPrompt`: when `selectedTaskId` set, show optional textarea (max 120, skip link) before continue
- Props: `onContinueWithTask(taskId, resumeNote?: string | null)`
- `use-pomodoro-cycle.ts` `onMidCycleContinueWithTask`: if note provided, `tasks.update` next task with `resumeNote` before rebind (after dismiss overlay — sync persist)
- Component test: `mid-cycle-completion-prompt.test.tsx` — capture, skip, max length

### Success Criteria

- Component tests pass
- Hook test: continue with note persists via update mock

## Phase 3: Wedge display surfaces

### Changes

- `suggestion.ts` `next`: include `resumeNote` from winner task in response
- `TaskSuggestionData` + card: show muted line below title when `resumeNote` present
- `task-list.tsx`: show resume subtitle on row when `resumeNote` set; optional inline edit (small textarea on row expand or dedicated edit affordance)
- `use-pomodoro-cycle` suggestion mapping: pass `resumeNote`
- Component tests: `task-suggestion-card.test.tsx`, `task-list.test.tsx`

### Success Criteria

- Component tests pass; full `pnpm test`

## Phase 4: Verification + docs

### Changes

- Update `change.md` status through implementation
- Run `pnpm check`, `pnpm test`

## References

- `context/foundation/roadmap.md` §S-18
- Archive: `2026-06-11-eisenhower-effort-task-attributes`, `2026-06-06-testing-active-slice-browser-proofs`
- `context/foundation/lessons.md` L-04

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Schema + domain layer

#### Automated

- [x] 1.1 Prisma migration + generate
- [x] 1.2 Domain, guest, repos, import, tRPC + tests

### Phase 2: Mid-cycle capture UI

#### Automated

- [x] 2.1 MidCycleCompletionPrompt capture + hook wire
- [x] 2.2 Component + hook tests

### Phase 3: Wedge display surfaces

#### Automated

- [x] 3.1 Suggestion API + card display
- [x] 3.2 Task list subtitle + manual refocus display
- [x] 3.3 Component tests

### Phase 4: Verification

#### Automated

- [x] 4.1 Full `pnpm check` + `pnpm test`
