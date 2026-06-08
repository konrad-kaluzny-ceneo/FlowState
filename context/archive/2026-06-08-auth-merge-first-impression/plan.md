# Auth Narrative and Guest-Merge Success Handoff (S-14) Implementation Plan

## Overview

Complete roadmap slice S-14 (`auth-merge-first-impression`, FLO-27 / #40): add pre-auth value narrative on sign-in and sign-up pages, and replace silent guest→account import with an explicit merge-success modal that names imported work and what unlocked — coordinated with S-11 first-run so merge-success always wins the overlay stack.

**PRD:** FR-001, FR-002, FR-003c, NFR (no silent data loss).

## Current State Analysis

Research and codebase confirm:

- Auth pages are credential + OAuth only — no product value narrative (`sign-in/page.tsx`, `sign-up/page.tsx`).
- Guest merge succeeds silently: `GuestImportOnMount` discards `{ importedTasks, importedCycles }` from `importGuestSnapshotAction`; only failures surface via amber alert (`guest-import-error`).
- S-11 first-run is shipped: `FirstRunOverlay` at `z-[55]`, `shouldDeferFirstRun()` in `defer.ts` returns `hasGuestData()` only — after blob clear, auth first-run can appear before user sees merge confirmation.
- Task titles for preview must be captured from the pre-clear client snapshot (`loadGuestSnapshotForImport()`), not post-merge server list (suffix collisions would confuse copy).
- Existing patterns to mirror: `FirstRunOverlay` modal shell, `forgot-password/page.tsx` subtitle spacing, `subscribeGuestStore` pub/sub in `guest/store.ts`, E2E helpers in `e2e/helpers/onboarding.ts`.

### Key Discoveries:

- Merge-success and first-run share `z-[55]` — mutual exclusion via `shouldDeferFirstRun()`, not z-index stacking.
- `use-onboarding-state.ts` already subscribes to guest store for defer reactivity — extend with defer-state subscription.
- Sign-up page lacks the card wrapper sign-in uses — align when adding fuller value block.
- Risk #5 (test-plan): merge data survival covered by `guest-merge-on-sign-in.spec.ts`; success UI and ordering vs first-run are new e2e scope for this slice.
- Auth copy must not imply guest trial includes check-ins or multi-cycle sessions (roadmap risk: marketing oversell).

## Desired End State

1. **Sign-in (`/auth/sign-in`):** H1 unchanged; minimal subtitle below title explains mindful Pomodoro focus and that signing in unlocks full sessions, check-ins, and suggestions.
2. **Sign-up (`/auth/sign-up`):** Fuller value block (card wrapper aligned with sign-in) covering the wedge — mindful cycles on chosen tasks, energy check-ins, session-aware next-task suggestions with rationale — without claiming guest trial already has those features.
3. **Post-auth merge (guest data present):** After successful import, modal (`data-testid="merge-success-overlay"`, `z-[55]`) shows task/cycle counts, up to three preview task titles from pre-import snapshot, unlock line, and **Continue** dismiss only.
4. **S-11 coordination:** First-run hidden while guest blob present, import in-flight, or merge-success modal visible; after merge dismiss, auth first-run may appear on next render if not yet dismissed.
5. **Zero-import success:** If merge returns `importedTasks === 0 && importedCycles === 0`, skip modal (nothing meaningful to confirm); defer clears normally.
6. **Verification:** `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e` including new merge-success ordering spec; existing `guest-merge-on-sign-in.spec.ts` and `first-run-onboarding.spec.ts` still pass.

### Acceptance Criteria (PRD mapping)

| Criterion | PRD ref | Verification |
|-----------|---------|--------------|
| Sign-up communicates product value before account creation | FR-001 | Sign-up page value block visible; copy mentions wedge without oversell |
| Sign-in communicates why to authenticate | FR-002 | Sign-in minimal subtitle present |
| Post-auth merge is explicit, not silent | FR-003c, NFR | Merge-success modal after guest sign-in; counts + titles shown |
| Guest data not lost on merge | FR-003c, Risk #5 | Existing merge e2e + modal does not block data appearing in list |
| First-run does not compete with merge-success | S-11 coordination | E2E: merge modal visible first; first-run only after Continue |

## What We're NOT Doing

- "Review imported tasks" CTA or scroll-to-task-list behavior (Continue dismiss only)
- Server-side merge acknowledgment persistence / Prisma changes
- Auth page visual polish beyond card alignment for sign-up (S-12 / separate follow-up)
- OAuth-specific copy or flow changes (lands same `/` merge path)
- Analytics events for auth narrative or merge funnel
- Changing merge transaction logic (`import-guest-snapshot.ts` server lib)
- Guest-mode auth value narrative (auth pages are pre-auth only)
- Updating test-plan §6 cookbook (optional follow-up after ship)

## Implementation Approach

Six sequential phases: pure copy/defer logic (TDD) → merge-success UI wiring (implement) → auth page narrative (implement) → e2e proofs. Copy centralized in `src/lib/onboarding/copy.ts` (extend) and new `src/lib/guest/merge-copy.ts` for merge-specific formatting. Defer flags live in `src/lib/onboarding/defer.ts` with pub/sub matching guest store pattern. `GuestMergeUiProvider` at `HomeShell` bridges `GuestImportOnMount` success state to `MergeSuccessOverlay` sibling.

## Critical Implementation Details

**Title capture timing:** Call `extractPreviewTaskTitles(snapshot, 3)` on the snapshot loaded *before* `importGuestSnapshotAction` resolves — same object passed to the action. Do not re-read from localStorage after `clearGuestSnapshot()`.

**Defer flag lifecycle:** `setImportInFlight(true)` at import start; `false` in `finally`. On success with showable counts, `setMergeSuccessVisible(true)` before blob clear; on dismiss, `setMergeSuccessVisible(false)`. Failed import: never set merge-success visible.

**Modal skip rule:** Show merge-success only when `result.ok && (importedTasks > 0 || importedCycles > 0)`.

**Z-index / overlap:** Both overlays use `z-[55]`. Only one renders visible at a time — merge-success when `mergeSuccessVisible`; first-run when `isFirstRunVisible && !shouldDeferFirstRun()`. Do not raise merge-success above first-run; defer is the contract.

**E2E helper order:** Extend `dismissFirstRunIfVisible` (or add `dismissMergeSuccessIfVisible`) so merge-success is dismissed before first-run in specs that hit post-merge auth home.

---

## Phase 1: Merge Copy Helpers (TDD)

### Overview

Pure functions to extract preview task titles from a guest snapshot and build merge-success modal copy (counts, title list, unlock line, CTA label).

**PRD:** FR-003c.

### Changes Required:

#### 1. Preview title extraction

**File**: `src/lib/guest/merge-copy.ts` (new)

**Intent**: Deterministically pick up to N task titles from a snapshot for user-facing merge preview.

**Contract**: Export `extractPreviewTaskTitles(snapshot: GuestSnapshotV1, maxTitles?: number): string[]`. Default `maxTitles = 3`. Order: active tasks first (by `createdAt` ascending), then completed if fewer than max. Map to `title` strings only; skip empty titles.

#### 2. Merge success copy builder

**File**: `src/lib/guest/merge-copy.ts` (extend)

**Intent**: Single builder for modal strings from import counts and preview titles.

**Contract**: Export type `MergeSuccessInput = { importedTasks: number; importedCycles: number; previewTitles: string[] }`. Export `buildMergeSuccessCopy(input): MergeSuccessCopy`. Export type `MergeSuccessCopy = { title: string; body: string; dismissLabel: string }` (shared by overlay props in Phase 3). Body includes count line (handle singular/plural), bullet or comma-separated preview of up to 3 titles with "+ N more" when `importedTasks > previewTitles.length`, and one sentence on unlocked features (full sessions, check-ins, suggestions). `dismissLabel` = `"Continue"`.

#### 3. Unit tests

**File**: `src/lib/guest/merge-copy.test.ts` (new)

**Intent**: Lock copy shape and edge cases without UI.

**Contract**: Cases: 0 titles with counts; 1/3/5 tasks (overflow "+ N more"); cycles-only import (0 tasks, >0 cycles); active-before-completed ordering; singular "1 task" / "1 cycle" grammar.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/lib/guest/merge-copy.test.ts` passes

#### Manual Verification:

- N/A (pure logic phase)

**Implementation Note**: Pause for automated green before Phase 2.

---

## Phase 2: Defer Coordination Extension (TDD)

### Overview

Extend `shouldDeferFirstRun()` to defer while import is in-flight or merge-success modal is visible — not only while guest blob exists.

**PRD:** FR-003c (UX half of merge acknowledgment); S-11 coordination.

### Changes Required:

#### 1. Defer state module

**File**: `src/lib/onboarding/defer.ts` (extend)

**Intent**: Central defer gate for first-run vs merge-success timing.

**Contract**: Export `setImportInFlight(inFlight: boolean): void`, `setMergeSuccessVisible(visible: boolean): void`, `subscribeDeferState(listener: () => void): () => void`, `resetDeferStateForTests(): void` (test-only reset). Extend `shouldDeferFirstRun(): boolean` to return true when any of: `hasGuestData()`, import in-flight, merge-success visible. SSR (`typeof window === "undefined"`) → false. Pub/sub notifies on flag changes (mirror `guest/store.ts` listener pattern).

#### 2. Hook subscription

**File**: `src/hooks/use-onboarding-state.ts` (extend)

**Intent**: Recompute `isFirstRunVisible` when defer flags change, not only guest blob.

**Contract**: In existing defer `useEffect`, also subscribe to `subscribeDeferState` and call `setDeferFirstRun(shouldDeferFirstRun())` on both guest store and defer state changes. Cleanup both subscriptions.

#### 3. Unit tests

**File**: `src/lib/onboarding/defer.test.ts` (new)

**Intent**: Prove OR semantics and flag independence.

**Contract**: Mock or stub `hasGuestData` if needed (vi.mock). Cases: each flag alone defers; all false → no defer; toggling import in-flight notifies subscriber; merge-success visible defers after guest blob cleared; reset helper clears flags between tests.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/lib/onboarding/defer.test.ts` passes
- `pnpm exec vitest run src/lib/onboarding/storage.test.ts` passes (regression)

#### Manual Verification:

- N/A (pure logic phase)

**Implementation Note**: Pause for automated green before Phase 3.

---

## Phase 3: Merge-Success Overlay + Import Wiring (Implement)

### Overview

Add `MergeSuccessOverlay` modal and wire `GuestImportOnMount` to surface successful merge with preview titles; mount overlay sibling in `HomeShell`.

**PRD:** FR-003c, NFR (no silent data loss).

### Changes Required:

#### 1. Merge-success overlay component

**File**: `src/app/_components/merge-success-overlay.tsx` (new)

**Intent**: Dismissible modal matching `FirstRunOverlay` visual pattern.

**Contract**: Props `{ copy: MergeSuccessCopy; visible: boolean; onDismiss: () => void }` where `MergeSuccessCopy` matches builder output. Render `fixed inset-0 z-[55]` backdrop when visible, `data-testid="merge-success-overlay"`, `role="dialog"`. Primary button `data-testid="merge-success-dismiss-btn"` with `dismissLabel`. Explicit button dismiss only (no backdrop click). Optional unordered list for preview titles when present.

#### 2. Guest merge UI context

**File**: `src/app/_components/guest-merge-ui-context.tsx` (new)

**Intent**: Lift merge-success visibility and copy from import mount to shell overlay.

**Contract**: Export `GuestMergeUiProvider`, `useGuestMergeUi()` returning `{ mergeSuccessCopy: MergeSuccessCopy | null; mergeSuccessVisible: boolean; dismissMergeSuccess: () => void }`. Provider holds copy state; `dismissMergeSuccess` clears visible flag and calls `setMergeSuccessVisible(false)`.

#### 3. Guest import on mount

**File**: `src/app/_components/guest-import-on-mount.tsx` (extend)

**Intent**: Drive defer flags and merge-success state through import lifecycle.

**Contract**: Consume `useGuestMergeUi()` (or receive callbacks via context setter exported from provider — provider wraps import). On import start: `setImportInFlight(true)`. Load snapshot; compute `previewTitles = extractPreviewTaskTitles(snapshot)`. On success: if counts showable, build copy, set provider state visible, `setMergeSuccessVisible(true)`; then existing success path (`markGuestImportDone`, `clearGuestSnapshot`, invalidate, refresh). On failure: existing error UI. In `finally`: `setImportInFlight(false)`. Error toast behavior unchanged.

#### 4. Home shell integration

**File**: `src/app/_components/home-shell.tsx` (extend)

**Intent**: Mount merge-success overlay as sibling to first-run and import.

**Contract**: Wrap `HomeShellContent` (or `DataModeProvider` + its children) in `GuestMergeUiProvider` **inside** `OnboardingProvider` so `useOnboarding()` defer hook and `useGuestMergeUi()` both resolve — provider must be an **ancestor** of `GuestImportOnMount`, not a sibling. Render `<MergeSuccessOverlay />` driven by `useGuestMergeUi()` between `GuestImportOnMount` and `FirstRunOverlay`. Authenticated-only provider scope is acceptable (guest mode never imports).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual Verification:

- Guest trial → add tasks → sign in → merge-success modal shows counts and up to 3 titles; Continue dismisses; first-run appears if not previously dismissed for auth user
- Sign-in without guest data → no merge modal; first-run behaves as today
- Import failure → amber error only; no merge modal

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Auth Page Value Narrative (Implement)

### Overview

Add pre-auth product value copy to sign-in (minimal subtitle) and sign-up (fuller value block); align sign-up layout with sign-in card wrapper.

**PRD:** FR-001, FR-002.

### Changes Required:

#### 1. Auth value copy

**File**: `src/lib/onboarding/copy.ts` (extend)

**Intent**: Centralize auth page strings; keep tone calm and accurate to guest vs auth parity.

**Contract**: Export type `AuthPageVariant = "sign-in" | "sign-up"`. Export `getAuthValueCopy(variant): { subtitle?: string; valueBlock?: { heading: string; lines: string[] } }`. Sign-in: single `subtitle` string (~one line) mentioning mindful focus cycles and unlocking sessions/check-ins/suggestions. Sign-up: `valueBlock` with short heading + 2–3 lines covering Pomodoro on chosen tasks, energy check-ins, session-aware suggestions — do not state guest trial includes check-ins or multi-cycle sessions.

#### 2. Shared auth value component

**File**: `src/app/auth/_components/auth-value-narrative.tsx` (new)

**Intent**: Reusable presentation for sign-in subtitle vs sign-up block.

**Contract**: Props `{ variant: AuthPageVariant }`. Sign-in renders centered `text-sm text-white/60` subtitle. Sign-up renders compact value block above form (heading + lines). No interactive elements.

#### 3. Sign-in page

**File**: `src/app/auth/sign-in/page.tsx` (extend)

**Intent**: Insert minimal value subtitle between H1 and form.

**Contract**: Render `<AuthValueNarrative variant="sign-in" />` below H1 with spacing matching `forgot-password/page.tsx` subtitle pattern (`mb-6` before form).

#### 4. Sign-up page

**File**: `src/app/auth/sign-up/page.tsx` (extend)

**Intent**: Fuller value narrative + visual alignment with sign-in card.

**Contract**: Wrap form area in `max-w-md rounded-lg bg-white/5 p-8 shadow-xl backdrop-blur-sm` container matching sign-in. Place `<AuthValueNarrative variant="sign-up" />` inside card above form. Replace generic "Sign up to start using FlowState" with value block content.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes

#### Manual Verification:

- Sign-in shows one-line value subtitle; form unchanged functionally
- Sign-up shows fuller value block inside card wrapper; OAuth + email signup still work
- Copy does not claim guest users get check-ins or full multi-cycle sessions

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: E2E — Merge-Success Ordering vs First-Run (Implement)

### Overview

Browser proof that merge-success modal appears after guest sign-in, blocks first-run until dismissed, then first-run can appear — extends Risk #5 coverage with explicit success UI.

**PRD:** FR-003c; test-plan Risk #5 (user-visible merge confirmation).

### Changes Required:

#### 1. Onboarding e2e helpers

**File**: `e2e/helpers/onboarding.ts` (extend)

**Intent**: Stable dismiss path for merge-success before first-run in composite flows.

**Contract**: Export `dismissMergeSuccessIfVisible(page)` — click `merge-success-dismiss-btn` if overlay visible, assert hidden. Update `dismissFirstRunIfVisible` to call `dismissMergeSuccessIfVisible` first (merge wins ordering).

#### 2. Merge-success ordering spec

**File**: `e2e/merge-success-on-sign-in.spec.ts` (new)

**Intent**: Prove modal content and first-run defer coordination.

**Contract**: Modeled on `guest-merge-on-sign-in.spec.ts`. Setup: `clearOnboardingKeys(page)` before guest task seeding so auth first-run is eligible after merge dismiss (`firstRunDismissed` false). Flow: guest adds 1–2 tasks → sign in → assert `merge-success-overlay` visible and `first-run-overlay` hidden → assert copy mentions task title(s) and counts → dismiss merge → assert merge hidden → assert `first-run-overlay` visible. Timeout 90s. Use `createTestUser` / `signInAsUser` helpers.

#### 3. Regression guard

**File**: `e2e/guest-merge-on-sign-in.spec.ts` (extend if needed)

**Intent**: Ensure existing merge data proof still passes with new dismiss helper behavior.

**Contract**: If spec uses `dismissFirstRunIfVisible`, verify it still passes after helper update (merge dismiss becomes no-op when no guest merge).

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm exec playwright test e2e/merge-success-on-sign-in.spec.ts` passes
- `set CI=true && pnpm exec playwright test e2e/guest-merge-on-sign-in.spec.ts` passes
- `set CI=true && pnpm exec playwright test e2e/first-run-onboarding.spec.ts` passes

#### Manual Verification:

- OAuth sign-in with guest data follows same merge-success path (spot-check in dev if OAuth configured)

**Implementation Note**: Final phase — ready for PR after all automated green.

---

## Testing Strategy

### Unit Tests:

- `merge-copy.test.ts` — title extraction order, overflow copy, singular/plural counts
- `defer.test.ts` — import in-flight, merge-visible, guest blob OR semantics, subscription notify

### Integration Tests:

- No new server integration required (merge logic unchanged from S-08)

### E2E Tests:

- `merge-success-on-sign-in.spec.ts` — primary new risk proof for FR-003c UX + S-11 ordering
- Regression: `guest-merge-on-sign-in.spec.ts`, `first-run-onboarding.spec.ts`

### Manual Testing Steps:

1. Guest with 4+ tasks → sign up → modal shows 3 titles + overflow hint
2. Auth home without prior guest data → no merge modal
3. Failed import (simulate offline/action error if possible) → error toast, no merge modal, no stuck defer
4. Sign-in/sign-up pages readable on mobile width

## Performance Considerations

Negligible — copy builders run once per merge; defer flags are in-memory. No additional network calls.

## Migration Notes

No schema migration. Existing guest blobs import unchanged. Users mid-import on deploy get same transaction behavior; new UI layer only.

## References

- Research: `context/changes/auth-merge-first-impression/research.md`
- S-11 plan (defer stub): `context/changes/first-run-wedge-onboarding/plan.md`
- Test-plan Risk #5: `context/foundation/test-plan.md`
- Modal pattern: `src/app/_components/first-run-overlay.tsx`
- Import mount: `src/app/_components/guest-import-on-mount.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Merge Copy Helpers (TDD)

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm exec vitest run src/lib/guest/merge-copy.test.ts` passes

### Phase 2: Defer Coordination Extension (TDD)

#### Automated

- [x] 2.1 `pnpm check` passes
- [x] 2.2 `pnpm typecheck` passes
- [x] 2.3 `pnpm exec vitest run src/lib/onboarding/defer.test.ts` passes
- [x] 2.4 `pnpm exec vitest run src/lib/onboarding/storage.test.ts` passes (regression)

### Phase 3: Merge-Success Overlay + Import Wiring (Implement)

#### Automated

- [x] 3.1 `pnpm check` passes
- [x] 3.2 `pnpm typecheck` passes
- [x] 3.3 `pnpm test` passes

#### Manual

- [ ] 3.4 Guest sign-in shows merge-success modal with counts/titles; Continue dismisses; first-run follows if eligible
- [ ] 3.5 Sign-in without guest data shows no merge modal
- [ ] 3.6 Import failure shows error toast only, no merge modal

### Phase 4: Auth Page Value Narrative (Implement)

#### Automated

- [x] 4.1 `pnpm check` passes
- [x] 4.2 `pnpm typecheck` passes
- [x] 4.3 `pnpm test` passes

#### Manual

- [ ] 4.4 Sign-in minimal subtitle and sign-up fuller value block render correctly
- [ ] 4.5 Auth copy does not oversell guest trial features

### Phase 5: E2E — Merge-Success Ordering vs First-Run (Implement)

#### Automated

- [x] 5.1 `pnpm check` passes
- [x] 5.2 `pnpm typecheck` passes
- [ ] 5.3 `pnpm test` passes
- [x] 5.4 `set CI=true && pnpm exec playwright test e2e/merge-success-on-sign-in.spec.ts` passes
- [x] 5.5 `set CI=true && pnpm exec playwright test e2e/guest-merge-on-sign-in.spec.ts` passes
- [x] 5.6 `set CI=true && pnpm exec playwright test e2e/first-run-onboarding.spec.ts` passes

#### Manual

- [ ] 5.7 OAuth sign-in with guest data shows merge-success before first-run (spot-check if OAuth configured)
