# Create wedge trust bridge — Implementation Plan

## Overview

S-32 / US-02: when a task created with a persona preset is suggested for the **first time** (kickoff or post-check-in), prepend one trust clause citing the preset label to the existing scoring rationale on `TaskSuggestionCard`. S-36 shipped `personaPresetId` persistence; this slice wires it into the suggestion read model only.

**Research:** `context/changes/create-wedge-trust-bridge/research.md`

## Current State Analysis

- Rationale is built in `src/lib/scoring/` and returned by `suggestion.next` (`suggestion.ts:190-214`, `273-297`).
- `Task.personaPresetId` exists (`prisma/schema.prisma:75`); create path persists catalog ids (`task-list.tsx:882-896`).
- Suggestion router maps tasks to `ScoringTask` **without** `personaPresetId` (`suggestion.ts:166-177`).
- `getPersonaPresetLabel()` exported from `persona-presets.ts:143-145`.
- `SuggestionDecision` tracks `suggestedTaskId` per kickoff/post-check-in — usable as first-suggestion oracle.
- No persona logic in scoring or UI today.

### Key Discoveries

- Domain G12: extend read model, not scorer (`context/domain/01-domain-distillation.md:226`).
- S-23 expander uses `breakdown.headline === rationale` contract (`suggestion.test.ts:357`).
- `"custom"` and `null` must skip persona clause (S-36 plan-review).

## Desired End State

- User creates task via preset (e.g. Firefight) → first time that task wins suggestion → card shows e.g. `Firefight — reactive work fits your choice. Deep work — you're focused…` (exact copy in helper).
- Second+ suggestion for same task → scoring rationale only (no persona clause).
- Kickoff and post-check-in both behave identically regarding persona clause.
- `pnpm check`, `pnpm typecheck`, `pnpm test` green.

### Verification

- `pnpm exec vitest run src/lib/scoring/persona-trust-clause.test.ts`
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`
- Manual: create preset task → kickoff suggestion shows persona clause; complete cycle → post-check-in on same task omits clause if already suggested once

## What We're NOT Doing

- Scorer ranking or new `RationaleKey` values
- S-23 expander / `TaskSuggestionCard` component changes
- Schema migrations
- Guest create persona persistence fix
- Belt e2e spec (router tests cover server contract)
- Per-session-only first suggestion (use decision history, not session scope)

## Implementation Approach

1. Pure helper module + unit tests (TDD-friendly, no DB).
2. Shared compose function used by both API branches after winner selection.
3. Async first-suggestion check in router (one `count` query per `next` call).
4. Router integration tests with seeded `SuggestionDecision` rows.

## Critical Implementation Details

**Breakdown headline:** After composing final `rationale`, pass composed string as `breakline.headline` to `buildRationaleBreakdown` — tests assert `breakdown.headline === rationale`. Keep `headlineKey` as the **scoring** key so expander still excludes the scoring factor, not the persona prefix.

**Copy template:** Static map keyed by preset id → short work-type hint (one sentence fragment). Example: `firefight` → `"reactive work fits your choice"`. Use `getPersonaPresetLabel(id)` for label. Format: `` `${label} — ${hint}.` `` then prepend to scoring rationale with a space.

**First-suggestion oracle:**

```typescript
const priorCount = await db.suggestionDecision.count({
  where: { userId, suggestedTaskId: task.id },
});
const isFirst = priorCount === 0;
```

Call **before** `recordDecision` for the current beat (decision row created on accept/override, not on `next`).

## Phase 1: Persona trust clause helper

### Overview

Pure functions for clause generation, skip rules, and rationale composition.

### Changes Required

#### 1. New module

**File:** `src/lib/scoring/persona-trust-clause.ts`

**Intent:** Encapsulate persona clause copy and composition; keep scorer modules persona-free.

**Contract:**

- `buildPersonaTrustClause(personaPresetId: string | null): string | null` — returns clause or null when skip (`null`, `"custom"`, unknown id).
- `composeSuggestionRationale(scoringRationale: string, personaClause: string | null): string` — prepend with space when clause present.
- `PERSONA_TRUST_HINTS: Record<PersonaPresetId, string>` — hint fragments per catalog id (8 entries).

#### 2. Unit tests

**File:** `src/lib/scoring/persona-trust-clause.test.ts`

**Intent:** Cover all 8 presets, skip sentinels, unknown id, composition edge cases (empty clause passthrough).

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/scoring/persona-trust-clause.test.ts`

---

## Phase 2: Suggestion router integration

### Overview

Wire helper into both `next` branches; query first-suggestion oracle; compose final rationale.

### Changes Required

#### 1. Shared private helper in router

**File:** `src/server/api/routers/suggestion.ts`

**Intent:** After winner task resolved and scoring rationale built, optionally prepend persona clause.

**Contract:**

- Add `async function applyPersonaTrustToRationale(db, userId, task, scoringRationale): Promise<string>`.
- Inside: if `!task.personaPresetId` skip; count prior decisions; if count > 0 skip; else compose.
- Use in post-check-in block before `buildRationaleBreakdown` (~line 190) and kickoff block (~line 273).
- Pass **composed** rationale as `headline` to `buildRationaleBreakdown`; return composed `rationale` in response.

#### 2. Router tests

**File:** `src/server/api/routers/suggestion.test.ts`

**Intent:** Prove persona clause on first suggestion; absent on second; absent for `"custom"`; works for kickoff and post-check-in.

**Contract:** Seed task with `personaPresetId: "synchro"`; assert rationale starts with `Synchro`; seed decision with that task as suggested; assert clause omitted on next call.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`
- `pnpm check`
- `pnpm typecheck`
- `pnpm test`

#### Manual Verification

- Dev: create Synchro preset task → idle kickoff → rationale cites Synchro
- Same task suggested again after prior decision → no persona prefix

---

## Phase 3: Docs sync

### Overview

Close resolved unknowns in roadmap item; mark change ready for review.

### Changes Required

#### 1. S-32 item unknowns

**File:** `context/foundation/roadmap-references/items/S-32.md`

**Intent:** Replace open unknowns with locked decisions from research (both contexts, stored id, first-suggestion oracle).

### Success Criteria

#### Automated Verification

- `pnpm test`

---

## Progress

### Phase 1 — Persona trust clause helper

- [x] Add `src/lib/scoring/persona-trust-clause.ts` with hint map + compose helpers
- [x] Add `src/lib/scoring/persona-trust-clause.test.ts` covering presets and skip rules

**Automated:** `pnpm exec vitest run src/lib/scoring/persona-trust-clause.test.ts`

### Phase 2 — Suggestion router integration

- [x] Add `applyPersonaTrustToRationale` in `suggestion.ts`; wire post-check-in + kickoff branches
- [x] Extend `suggestion.test.ts` with first-suggestion persona cases

**Automated:** `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`; `pnpm check`; `pnpm typecheck`; `pnpm test`

### Phase 3 — Docs sync

- [x] Update `context/foundation/roadmap-references/items/S-32.md` unknowns

**Automated:** `pnpm test`
