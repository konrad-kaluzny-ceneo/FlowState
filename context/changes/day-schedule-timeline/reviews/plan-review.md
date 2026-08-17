<!-- PLAN-REVIEW-REPORT -->
# Plan Review: day-schedule-timeline

- **Plan**: `context/changes/day-schedule-timeline/plan.md`
- **Mode**: Deep
- **Date**: 2026-08-17
- **Verdict**: SOUND (after triage; was REVISE)
- **Findings**: 0 critical, 8 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS (was WARNING; F7 fixed) |
| Lean Execution | PASS |
| Architectural Fitness | PASS (was WARNING; F1/F3/F6 fixed) |
| Blind Spots | PASS (was WARNING; F2/F4/F5/F9 fixed) |
| Plan Completeness | PASS (was WARNING; F8 fixed) |

## Grounding

Grounding: 10/10 paths ✓, 6/6 symbols ✓, brief↔plan ✓ (guest mock decision updated during triage).

Paths: `prisma/schema.prisma`, `src/app/_components/plan-dnia-view.tsx`, `src/server/api/routers/day-plan.ts`, `src/lib/data-mode/types.ts`, `src/hooks/use-day-plan.ts`, `src/app/plan/page.tsx`, `src/lib/repositories/guest-repositories.ts`, `src/lib/data-mode/data-mode-context.tsx`, `e2e/seed.spec.ts`, `src/app/api/mcp/mcp-tools.ts`.

## Findings

### F1 — Phase 3 Intent deletes guest calendar mock

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Integrate into plan-dnia-view; Phase 1 i18n
- **Detail**: Phase 3 Intent originally said remove `DayCalendarMock` while Contract kept it for guests. During triage the product call was: guests do not need a fake “coming soon” calendar once the real timeline exists for accounts.
- **Fix**: Delete `DayCalendarMock` / `ComingSoonPreview` entirely. Auth gets `DayScheduleTimeline`. Guest keeps `guestEmpty` only.
- **Decision**: FIXED (differently after product call — drop mock, do not preserve it)

### F2 — E2E belt auth cites the wrong credential path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — E2E belt spec
- **Detail**: Phase 5 mixed `seed.spec.ts` fixtures with `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`. Belt auth is worker `storageState`; those env vars are for agent manual login only.
- **Fix**: Point belt spec at `e2e/fixtures.ts` + `e2e/helpers/daily-plan.ts` tRPC seed. Mention `E2E_TEST_*` only under Manual Verification.
- **Decision**: FIXED

### F3 — Edit panel invents Sheet/Popover that do not exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 4 — Block edit panel
- **Detail**: No Sheet/Popover/Dialog in `src/`. Task edit uses `ModalShell`.
- **Fix**: Specify `ModalShell` (same as `TaskDetailPanel`).
- **Decision**: FIXED

### F4 — Task FKs have no onDelete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Prisma schema
- **Detail**: Default Restrict would block task delete when a block references the task.
- **Fix A ⭐**: `focusTaskId` `onDelete: SetNull`; `ScheduleBlockTask` `onDelete: Cascade`. Task back-relations required.
- **Decision**: FIXED (Fix A)

### F5 — Changing block type does not clear attachments

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 updateBlock + Phase 4 edit type
- **Detail**: Type change could leave `focusTaskId` / batch rows on an incompatible type.
- **Fix**: Same-transaction cleanup of illegal attachments/meta on type change.
- **Decision**: FIXED

### F6 — Plan says the view already owns useDayPlan; the page does

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 3 — Plan page wiring
- **Detail**: `useDayPlan` is called in `src/app/plan/page.tsx`, not the view.
- **Fix A ⭐**: `AuthenticatedPlanPage` owns both hooks and passes both into `PlanDniaView`.
- **Decision**: FIXED (Fix A)

### F7 — Task picker is active-only; the rest of the app includes planned

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 4 attachments
- **Detail**: Fokus/delegation pickers use `active` + `planned`.
- **Fix A ⭐**: Allow `active` or `planned`; reject completed/archived/blocked/delegated.
- **Decision**: FIXED (Fix A)

### F8 — New model ids are unspecified (Int vs cuid)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Prisma schema
- **Detail**: `ScheduleBlock` / `UserContextTag` `id` had no type.
- **Fix**: `Int @id @default(autoincrement())`; router ids `z.number().int()`.
- **Decision**: FIXED

### F9 — A block can store both a fixed GTD context and a custom tag

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 schema + Phase 2 create/update + Phase 4 context picker
- **Detail**: Both context FKs optional with no XOR.
- **Fix**: Reject when both non-null; modal clears the other field.
- **Decision**: FIXED
