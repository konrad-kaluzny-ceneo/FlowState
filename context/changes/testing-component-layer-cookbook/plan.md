# Testing Component Layer Cookbook Implementation Plan

## Overview

Close test-plan **§3 Phase 6** (`Uncovered UI & auth paths`) by adding co-located **component smoke** and **auth action** tests for every `_components` file that still lacks `*.test.tsx`, extending guest-repository coverage where gaps remain, and formalizing the fast layer in `context/foundation/test-plan.md` (new **§6.9**, **§4** stack row, **§1** belt-vs-component checklist). Finish with a **narrowed Stryker** run on newly covered files and mark Phase 6 `complete`. Phase 5 (mutation oracle hardening on survived mutants) stays a separate change.

## Current State Analysis

The fast test layer exists but is under-documented. **18** `*.test.tsx` files live under `src/` (14 in `_components/`, 4 in `hooks/`). Phase 7 demoted 10 e2e specs to Vitest/component; overlay prompts follow the **dumb component** pattern (`mid-cycle-completion-prompt.test.tsx`, `check-in-overlay.test.tsx`) while state machines live in `use-pomodoro-cycle.test.tsx`. `task-list.test.tsx` is the only component test that mocks a custom hook at the module boundary.

**Nine `_components` files still lack co-located tests:**

| File | Complexity | Notes |
|------|------------|-------|
| `guest-banner.tsx` | Thin | Static copy + links; `data-testid="guest-banner"` |
| `kickoff-duration-chips.tsx` | Thin | Prop-driven; chip label + `onSelect` |
| `empty-active-tasks-guide.tsx` | Thin | Presentational CTA |
| `guest-merge-ui-context.tsx` | Medium | Context provider + merge success state |
| `guest-import-on-mount.tsx` | Medium | Mount effect + tRPC `guest.import` |
| `oauth-session-verifier.tsx` | Medium | Session verification side effect |
| `user-menu.tsx` | Medium | Auth menu + sign-out |
| `home-shell.tsx` | High | Composes dashboard, overlays, guest import |
| `pomodoro-dashboard.tsx` | High | Orchestrates hooks + all cycle overlays (`PomodoroDashboardBody` ~400 LOC) |

**Auth:** schema/validation tests exist (`sign-in/validation.test.ts`, `sign-up/validation.test.ts`); **server actions** `sign-in/action.ts` and `sign-up/actions.ts` have no dedicated tests.

**Repositories:** `guest-repositories.test.ts` covers core CRUD; Stryker §6.7 Phase 6 priority #2 may still have uncovered branches.

**Cookbook gap:** §6 has 6.1 unit, 6.2 integration, 6.3 e2e — no first-class component section. Component guidance is scattered in §6.3 demotion bullets and §6.8 latency.

### Key Discoveries

- **Convention split** (`recommendations.md`, explore agent): overlays = props + `vi.fn()` callbacks, no `vi.mock`; composite widgets with mutation side effects mock hooks (`task-list.test.tsx`); state machines use `renderHook` + tRPC/repo mocks (`use-pomodoro-cycle.test.tsx`).
- **§6.9 placement** (user decision): append at end — avoids renumbering §6.3 belt references (dozens of citations).
- **`PomodoroDashboardBody`** is module-private; smoke tests should either export it for testing or mock `usePomodoroCycle` / `useGuestDomainTasks` at the `PomodoroDashboard` boundary — prefer **exporting `PomodoroDashboardBody`** only if hook-mock surface is unwieldy (decide in Phase 4).
- **L-04** (`lessons.md`): co-located component smoke for unbounded text and per-surface latency oracles — `task-list.test.tsx` is canonical.

## Desired End State

1. **Every `_components/*.tsx` has a co-located `*.test.tsx`** with at least one user-visible oracle per file (layout branch, callback wiring, or gate visibility).
2. **`sign-in/action.ts` and `sign-up/actions.ts`** have co-located tests covering empty-field validation, auth error mapping, and network-error path (mock `~/lib/auth/server`).
3. **`context/foundation/test-plan.md`** updated:
   - **§1** — new principle or extension of principle #4: belt-vs-component checklist before adding Playwright.
   - **§4** — new row: `component + hook (RTL)` | Vitest + RTL | 4.1.7 | …
   - **§6.9** — `Adding a component test` (location, dumb vs composite, hook split, references, run command).
   - **§6.6** — Phase 6 shipped block for change `testing-component-layer-cookbook`.
   - **§3** — Phase 6 row `complete` + change folder column.
   - **§8** — narrowed Stryker note on new files; `Next session` → Phase 5.
4. **Narrowed Stryker** on newly covered component/auth paths shows no surviving mutants that imply user-visible bugs (or oracles added until clean on those files).
5. **`pnpm check` and `pnpm test`** green; belt unchanged (`pnpm test:e2e:belt` not required unless dashboard export touches e2e hooks).

## What We're NOT Doing

- Full §3 Phase 5 mutation hardening (survived mutants in hooks/routers) — separate change.
- New Playwright specs or belt rows.
- MSW or new test runners.
- Rewriting §1–§5 strategy wholesale (targeted §1 extension + §4/§6 only).
- 100% mutation score chase — narrowed Stryker on new coverage only.
- Testing `home-shell` / `pomodoro-dashboard` through e2e when component smoke suffices.

## Implementation Approach

Work **thin → thick**: presentational smokes first (fast ROI, establishes §6.9 patterns), then guest/auth wiring components, then shell/dashboard integration smokes, then auth actions + repository gaps, then cookbook sync, then Stryker verification. Follow existing RTL conventions (`render` + `screen` + `fireEvent`; `renderHook` only in `src/hooks/`). Mock at the **nearest boundary**: props for dumb overlays, `vi.mock("~/hooks/...")` for composite widgets, `vi.mock("~/lib/auth/server")` for server actions.

## Critical Implementation Details

### Component test decision tree (for §6.9 and implementer)

1. **Presentational** (props in, callbacks out) → `render` + `vi.fn()` handlers; **no** `vi.mock`.
2. **Composite with hook side effects** (task list, dashboard) → mock hook module; assert DOM + mock call args.
3. **State machine / optimistic / recovery** → `src/hooks/*.test.tsx` with `renderHook`; component test only asserts mount visibility if needed.
4. **Before adding belt e2e** → answer §1 checklist: “Does merge gate need a new belt row, or is component + existing belt seed enough?”

### `pomodoro-dashboard` smoke scope

Assert **one branch per major overlay gate** via controlled `usePomodoroCycle` mock return values (or injected `PomodoroDashboardBody` props): e.g. `awaitingCheckIn` shows check-in overlay test id; `midCyclePendingTask` shows mid-cycle prompt; idle shows timer panel. Do **not** re-test cycle state machine logic (covered in `use-pomodoro-cycle.test.tsx`).

### Auth action test pattern

Mirror `protected-procedure.test.ts` / router tests: mock `auth.signIn.email` / `auth.signUp.email`; call action with `FormData`; assert returned `error` / redirect behavior. No real Neon calls.

---

## Phase 1: Presentational Component Smokes

### Overview

Add co-located tests for thin, prop-driven components — establishes §6.9 reference patterns with minimal mocking.

### Changes Required:

#### 1. Thin overlay / CTA components

**Files**: `src/app/_components/guest-banner.test.tsx`, `kickoff-duration-chips.test.tsx`, `empty-active-tasks-guide.test.tsx`

**Intent**: Smoke user-visible copy, links/testids, chip selection callback, and empty-state CTA per test-plan Risks #3/#5 UI entry points.

**Contract**: One `describe` per file; assert `data-testid` presence; `fireEvent.click` on chip calls `onSelect(sec)`; guest-banner links to `/auth/sign-in` and `/auth/sign-up`.

#### 2. Auth chrome components (if untested)

**Files**: `src/app/auth/_components/google-sign-in-button.test.tsx`, `auth-divider.test.tsx`, `auth-value-narrative.test.tsx` (only if no test exists after inventory)

**Intent**: Render smoke for auth marketing/chrome — optional in this phase if time-constrained; include only when file count confirms zero coverage.

**Contract**: Render without throw; stable testids or role selectors documented in §6.9.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/guest-banner.test.tsx src/app/_components/kickoff-duration-chips.test.tsx src/app/_components/empty-active-tasks-guide.test.tsx`
- `pnpm check`
- `pnpm test`

#### Manual Verification:

- Spot-read new tests: no `vi.mock` on presentational files; callbacks use `vi.fn().mockResolvedValue(undefined)` where async.

---

## Phase 2: Guest Flow & Auth Wiring Components

### Overview

Cover guest merge/import and session verification components — medium complexity, mock tRPC and context boundaries.

### Changes Required:

#### 1. Guest merge UI context

**File**: `src/app/_components/guest-merge-ui-context.test.tsx`

**Intent**: Provider exposes merge success copy/visibility; dismiss clears state.

**Contract**: `renderHook` or wrapper component pattern with `GuestMergeUiProvider`; assert `mergeSuccessVisible` toggles and `dismissMergeSuccess` callback.

#### 2. Guest import on mount

**File**: `src/app/_components/guest-import-on-mount.test.tsx`

**Intent**: When authenticated + guest blob present, import mutation fires once; no duplicate import on re-render.

**Contract**: `vi.mock("~/trpc/react")` for `api.guest.import.useMutation`; mock `localStorage` / guest guard per existing guest test patterns.

#### 3. OAuth session verifier

**File**: `src/app/_components/oauth-session-verifier.test.tsx`

**Intent**: Mount behavior when session valid/invalid — assert redirect or null render without real OAuth.

**Contract**: Mock `~/lib/auth/client` or router `useRouter` per existing auth test conventions in repo.

#### 4. User menu

**File**: `src/app/_components/user-menu.test.tsx`

**Intent**: Signed-in user sees menu; sign-out control present and wired.

**Contract**: Mock auth session hook; assert menu testids / sign-out handler.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/guest-merge-ui-context.test.tsx src/app/_components/guest-import-on-mount.test.tsx src/app/_components/oauth-session-verifier.test.tsx src/app/_components/user-menu.test.tsx`
- `pnpm test`

#### Manual Verification:

- Mocks stop at tRPC/auth boundary — no real network.

---

## Phase 3: Shell & Dashboard Integration Smokes

### Overview

Cover the two highest-complexity `_components` files: `home-shell.tsx` and `pomodoro-dashboard.tsx`.

### Changes Required:

#### 1. Home shell

**File**: `src/app/_components/home-shell.test.tsx`

**Intent**: Guest mode shows `guest-banner`; authenticated mode mounts import + dashboard; first-run overlay visibility respects merge-success suppression (mirror `HomeShellContent` logic).

**Contract**: Mock `PomodoroDashboard`, `GuestImportOnMount`, onboarding hooks as needed; assert conditional children and `data-testid` visibility matrix.

#### 2. Pomodoro dashboard

**File**: `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Smoke overlay visibility matrix for `PomodoroDashboardBody` — timer panel idle, check-in gate, mid-cycle prompt, wind-down — without duplicating hook state machine tests.

**Contract**: Prefer testing `PomodoroDashboardBody` with stub `tasks`/`refreshTasks` and mocked `usePomodoroCycle` return slices; export `PomodoroDashboardBody` from module only if required. Gate flags `enableCheckInGate` / `enableWindDownGate` / `enableSuggestionGate` exercised at least once each.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/_components/home-shell.test.tsx src/app/_components/pomodoro-dashboard.test.tsx`
- `pnpm test`

#### Manual Verification:

- Dashboard tests do not duplicate cases already in `use-pomodoro-cycle.test.tsx` (grep for overlapping titles).

---

## Phase 4: Auth Actions & Repository Gaps

### Overview

Close §6.7 Phase 6 priority #2 and #3: server auth actions and any remaining guest-repository branches.

### Changes Required:

#### 1. Sign-in action

**File**: `src/app/auth/sign-in/action.test.ts`

**Intent**: Empty email/password returns field message; invalid credentials return generic error; network error code maps to connection message.

**Contract**: `vi.mock("~/lib/auth/server")`; build `FormData`; assert `SignInFormState` shapes — no `redirect()` in tests (mock `next/navigation` if needed).

#### 2. Sign-up action

**File**: `src/app/auth/sign-up/actions.test.ts`

**Intent**: Parallel coverage for sign-up validation paths and auth error mapping.

**Contract**: Same mock boundary as sign-in; reuse patterns from `sign-up/validation.test.ts` for input fixtures.

#### 3. Guest repositories extension

**File**: `src/lib/repositories/guest-repositories.test.ts` (extend)

**Intent**: Add cases for Stryker no-coverage branches not yet exercised (inventory via `pnpm exec stryker run --mutate "src/lib/repositories/guest-repositories.ts"` if unclear).

**Contract**: localStorage fixtures only; no new test file unless split is cleaner.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/app/auth/sign-in/action.test.ts src/app/auth/sign-up/actions.test.ts src/lib/repositories/guest-repositories.test.ts`
- `pnpm test`

#### Manual Verification:

- Auth mocks do not call real Neon endpoints.

---

## Phase 5: Test-Plan Cookbook & Phase 6 Closure

### Overview

Formalize the component layer in `test-plan.md` and mark §3 Phase 6 complete — final doc-sync phase per testing-rollout precedent (`testing-e2e-belt-fast` Phase 5).

### Changes Required:

#### 1. §1 Strategy — belt vs component checklist

**File**: `context/foundation/test-plan.md`

**Intent**: Add principle **#5** (or extend #4): before adding Playwright to merge gate, confirm component/hook/integration cannot cover the risk; reference §6.9 decision tree.

**Contract**: Imperative tone matching existing principles; link to §6.9 and §6.3 belt table.

#### 2. §4 Stack — component + hook row

**File**: `context/foundation/test-plan.md`

**Intent**: Name Vitest + RTL + `renderHook` as distinct fast layer between unit/lib and tRPC integration.

**Contract**: New table row after `unit + integration` or before `API / server integration`; version 4.1.7; notes cite co-located `*.test.tsx` under `src/app/_components/` and `src/hooks/`.

#### 3. §6.9 Adding a component test

**File**: `context/foundation/test-plan.md`

**Intent**: Canonical cookbook entry: location, naming, dumb vs composite vs hook split, mocking policy, reference tests, run command, link to §6.8 latency + L-04.

**Contract**: Subsections: **Location**, **Naming**, **When to mock hooks**, **Reference tests** (`mid-cycle-completion-prompt.test.tsx`, `task-list.test.tsx`, `use-pomodoro-cycle.test.tsx`), **Run locally**, **Anti-patterns** (e2e for overlay layout-only regressions).

#### 4. §6.6 Phase 6 block + §3 status

**File**: `context/foundation/test-plan.md`

**Intent**: Document shipped scope, explicit limitation (no Phase 5), change folder `testing-component-layer-cookbook`; set Phase 6 row `complete`.

**Contract**: Update header `Last updated`; §8 `Next session` → Phase 5 (`testing-mutation-oracle-hardening`).

#### 5. Cross-link §6.8 component smoke bullet

**File**: `context/foundation/test-plan.md`

**Intent**: Point §6.8 component smoke bullet to §6.9 instead of only inline mention.

**Contract**: One-line cross-reference — no duplicate content.

### Success Criteria:

#### Automated Verification:

- `pnpm check` (if any markdown in scope — N/A for md-only; run if TS touched in same commit)

#### Manual Verification:

- Another contributor can add a component test using §6.9 alone (spot-read acceptance).
- §6.3 belt references still say §6.3 (no accidental renumber).

---

## Phase 6: Narrowed Stryker & Baseline Update

### Overview

Verify new test oracles kill obvious mutants on newly covered files; record baseline note in §8.

### Changes Required:

#### 1. Narrowed Stryker runs

**Intent**: Run targeted mutation on new/changed test targets; fix shallow oracles until no user-visible survived mutants remain on those files.

**Contract**: Commands (run sequentially, adjust file list to what shipped):

```
pnpm exec stryker run --mutate "src/app/_components/pomodoro-dashboard.tsx"
pnpm exec stryker run --mutate "src/app/_components/home-shell.tsx"
pnpm exec stryker run --mutate "src/app/auth/sign-in/action.ts"
pnpm exec stryker run --mutate "src/app/auth/sign-up/actions.ts"
```

Add other Phase 1–4 component paths if Stryker reports survived mutants with user-visible impact.

#### 2. §8 freshness ledger

**File**: `context/foundation/test-plan.md`

**Intent**: Note Phase 6 completion date; optional narrowed-mutation summary; keep full-run baseline date unless delta >10 points.

**Contract**: `Phase 6 component layer shipped: 2026-06-11 (testing-component-layer-cookbook)`.

### Success Criteria:

#### Automated Verification:

- `pnpm test`
- `pnpm check`
- Narrowed Stryker commands exit 0 with acceptable survivor review documented in Phase 6 §6.6 note (if any ignored per §6.7 review rule)

#### Manual Verification:

- Open `reports/mutation/mutation.html` for narrowed runs — survivors either fixed or explicitly documented as non-user-visible.

---

## Testing Strategy

### Component tests

- Follow §6.9 decision tree after Phase 5 lands.
- One meaningful assertion per user-visible branch; avoid snapshot-only tests.
- Reuse `data-testid` oracles from production components.

### Integration tests

- Auth actions: mock auth server only.
- Guest import: mock tRPC mutation; assert call count and payload shape.

### Manual Testing Steps

1. Read §6.9 end-to-end — confirm a new overlay could be tested without reading e2e docs.
2. Run `pnpm test` — full suite time should remain dominated by `use-pomodoro-cycle.test.tsx`, not new smokes.

## Performance Considerations

New component smokes should add <5s to `pnpm test` total. Avoid mounting full `PomodoroDashboard` with real Suspense/tRPC — mock boundaries.

## Migration Notes

None — test-only and documentation changes.

## References

- `context/changes/testing-component-layer-cookbook/recommendations.md`
- `context/changes/testing-e2e-belt-fast/plan.md` — cookbook closure precedent
- `context/foundation/test-plan.md` §3 Phase 6, §6.7 Phase 6 priority order
- `context/foundation/lessons.md` L-04
- `src/app/_components/mid-cycle-completion-prompt.test.tsx` — dumb overlay reference
- `src/app/_components/task-list.test.tsx` — hook-mock reference
- `src/hooks/use-pomodoro-cycle.test.tsx` — hook integration reference

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Presentational Component Smokes

#### Automated

- [x] 1.1 `pnpm exec vitest run` guest-banner, kickoff-duration-chips, empty-active-tasks-guide tests — 83a68d6
- [x] 1.2 `pnpm check` — 83a68d6
- [x] 1.3 `pnpm test` — 83a68d6

#### Manual

- [x] 1.4 Presentational tests use props-only pattern (no vi.mock on component modules) — 83a68d6

### Phase 2: Guest Flow & Auth Wiring Components

#### Automated

- [x] 2.1 `pnpm exec vitest run` guest-merge-ui-context, guest-import-on-mount, oauth-session-verifier, user-menu tests — 8724266
- [x] 2.2 `pnpm test` — 8724266

#### Manual

- [x] 2.3 Mocks stop at tRPC/auth boundary (no real network) — 8724266

### Phase 3: Shell & Dashboard Integration Smokes

#### Automated

- [x] 3.1 `pnpm exec vitest run` home-shell and pomodoro-dashboard tests — 1bf6820
- [x] 3.2 `pnpm test` — 1bf6820

#### Manual

- [x] 3.3 Dashboard tests do not duplicate use-pomodoro-cycle state machine cases — 1bf6820

### Phase 4: Auth Actions & Repository Gaps

#### Automated

- [x] 4.1 `pnpm exec vitest run` sign-in/action, sign-up/actions, guest-repositories tests — 2dcac33
- [x] 4.2 `pnpm test` — 2dcac33

#### Manual

- [x] 4.3 Auth action tests mock ~/lib/auth/server (no Neon calls) — 2dcac33

### Phase 5: Test-Plan Cookbook & Phase 6 Closure

#### Automated

- [x] 5.1 `pnpm check` and `pnpm test` after any incidental TS edits — 4968eae

#### Manual

- [x] 5.2 Spot-read §6.9 — contributor can add component test from cookbook alone — 4968eae
- [x] 5.3 §3 Phase 6 row marked complete with change folder — 4968eae

### Phase 6: Narrowed Stryker & Baseline Update

#### Automated

- [x] 6.1 Narrowed Stryker runs on new/changed source files — 9df083c
- [x] 6.2 `pnpm test` — 9df083c
- [x] 6.3 `pnpm check` — 9df083c

#### Manual

- [x] 6.4 Survivors in mutation report reviewed per §6.7 review rule — 9df083c
