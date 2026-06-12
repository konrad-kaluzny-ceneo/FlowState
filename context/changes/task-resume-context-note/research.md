---
date: 2026-06-12T14:00:00+00:00
researcher: ship-slice-orchestrator
git_commit: pending
branch: features/task-resume-context-note
repository: FlowState
topic: "S-18 task-resume-context-note — schema, capture surfaces, wedge display"
tags: [research, task, resume-note, mid-cycle, suggestion]
status: complete
last_updated: 2026-06-12
last_updated_by: ship-slice-orchestrator
---

# Research: Task resume context note (S-18)

## Summary

No `resumeNote` field exists today. Task free text is `title` only (256 chars). Capture belongs on the **mid-cycle completion continue path** (`MidCycleCompletionPrompt` → `onMidCycleContinueWithTask`). Display belongs on `TaskSuggestionCard` and active task rows on manual refocus. Follow F-05 vertical slice pattern for schema + guest parity.

## Code References

| Area | File | Notes |
|------|------|-------|
| Prisma Task | `prisma/schema.prisma:62-87` | No note field |
| tRPC task router | `src/server/api/routers/task.ts` | create/update Zod |
| Domain types | `src/lib/data-mode/types.ts` | `DomainTask`, `TaskRepository` |
| Guest schema | `src/lib/guest/schema.ts` | `guestTaskSchema` |
| Guest import | `src/server/api/lib/import-guest-snapshot.ts` | Field mapping |
| Mid-cycle UI | `src/app/_components/mid-cycle-completion-prompt.tsx` | Continue vs end-break |
| Mid-cycle hook | `src/hooks/use-pomodoro-cycle.ts` | `onMidCycleContinueWithTask` |
| Suggestion card | `src/app/_components/task-suggestion-card.tsx` | `TaskSuggestionData` |
| Suggestion API | `src/server/api/routers/suggestion.ts` | `next` return shape |
| Task list | `src/app/_components/task-list.tsx` | Focus button, inline edit |

## Architecture Insights

- **No mid-cycle focus switch during WORK** except via mark-complete → continue (rebindTask).
- **S-09 optimistic mutations** bypass mid-cycle paths — resume save should use explicit `task.update` after overlay dismiss (L-04).
- **S-17 dependency**: persistent `Task.resumeNote` readable by future handoff composition.
- **E2E**: prefer component tests; belt extends `task-suggestion.spec.ts` only if browser-only signal needed.

## Prior Art

- F-05 Eisenhower: Prisma migrate → domain → guest → tRPC → repos (archive `2026-06-11-eisenhower-effort-task-attributes`)
- S-03 mid-cycle: archive `2026-06-06-testing-active-slice-browser-proofs`
- S-23 expander: secondary line below rationale in suggestion card

## Open Questions (resolved in plan)

See plan.md Decision Log — orchestrator proxy decisions at ≥80% confidence.
