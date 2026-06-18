---
project: flow-state
assessed_at: 2026-06-13T17:03:22Z
updated: 2026-06-18
agent_readiness: ready-with-compensation
context_type: brownfield
prd_version: 3
assessment_focus: "PRD v3 change scope — wedge conductor, persona trust, daily planning, pause/resume, craft"
active_change_threads:
  - id: break-alerts-out-of-tab
    assessed_at: 2026-06-18T20:45:00Z
    agent_readiness: ready-with-compensation
    prd_ref: "context/foundation/prd.md — Change thread PRD: Break alerts outside active tab (narrow MVP)"
    shape_ref: "context/foundation/shape-notes.md — Change thread: Break alerts outside active tab"
    thread_gaps: 4
stack_components:
  language: TypeScript 6 (strict)
  framework: Next.js 16 App Router + React 19
  api: tRPC 11 + Zod 4 + TanStack Query 5
  orm: Prisma 7 + Neon serverless adapter
  build_tool: Next.js (Turbopack dev)
  test_runner: Vitest 4 + Playwright 1.60
  package_manager: pnpm
  ci_provider: GitHub Actions
  deployment_target: Vercel
  auth: Neon Auth 0.4.x-beta
gates_passed: 9
gates_failed: 0
domain_gaps: 2
change_thread_assessments:
  - id: timer-change-impact-digest
    assessed_at: 2026-06-18T12:00:00Z
    agent_readiness: ready-with-compensation
    prd_ref: context/foundation/prd.md#change-thread-prd-timer-change-impact-digest-narrow-mvp
    shape_ref: context/foundation/shape-notes.md#change-thread-timer-change-impact-digest-narrow-mvp
  - id: break-alerts-out-of-tab
    assessed_at: 2026-06-18T20:45:00Z
    agent_readiness: ready-with-compensation
    prd_ref: context/foundation/prd.md#change-thread-prd-break-alerts-outside-active-tab-narrow-mvp
    shape_ref: context/foundation/shape-notes.md#change-thread-break-alerts-outside-active-tab-narrow-mvp
    thread_gaps: 4
---

## Stack Components

**Language — TypeScript 6:** `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `checkJs`. End-to-end types from Prisma generated client through tRPC routers to React components.

**Framework — Next.js 16 App Router:** T3-derived layout — `src/app/` routes, `_components/` co-located with pages, `src/server/api/routers/` for tRPC. React 19 client components for interactive Pomodoro UI.

**API — tRPC + Zod:** Routers registered in `src/server/api/root.ts`; inputs validated with Zod; React Query integration via `~/trpc/react`. Type-safe contracts without manual OpenAPI.

**ORM — Prisma 7:** Schema in `prisma/schema.prisma`; client generated to `./generated/prisma/client`; Neon HTTP adapter for serverless. Migrations via `pnpm prisma migrate dev` only.

**Testing — Vitest + Playwright:** Unit/integration co-located `*.test.ts` under `src/`; E2E belt in `e2e/` with auth pool and `@skip-belt` tagging. Lefthook runs related tests pre-commit.

**Tooling — Biome 2:** Sole linter/formatter (`pnpm check`); no ESLint/Prettier split.

**CI/CD — GitHub Actions:** Quality job (check, typecheck, test) + E2E job on PR/push to main.

**Deployment — Vercel:** Native Next.js target; preview deploys on PR.

**Auth — Neon Auth (beta):** Email/password, Google OAuth, password recovery; guest local blob merge on sign-in.

**Instruction files:** `AGENTS.md`, `DESIGN.md`, `context/foundation/tech-stack.md`, `context/foundation/test-plan.md`, `context/foundation/user-flow.md`, `context/foundation/roadmap-references/flow-coherence-recommendations.md`.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ✓             | ✓          | pass    |
| Build tool  | —     | ✓          | ✓             | ✓          | pass    |
| Test runner | —     | —          | ✓             | ✓          | pass    |

Legend: ✓ = pass, ~ = partial, — = not applicable

### Gate Details

**Typed — pass**

- Evidence: `tsconfig.json` → `"strict": true`, `"noUncheckedIndexedAccess": true`.
- tRPC infers procedure I/O; Prisma generates model types; Zod validates at boundaries (`@t3-oss/env-nextjs` for env).

**Convention-based — pass (framework); partial (PRD v3 domain layer)**

- Evidence (framework): `AGENTS.md` documents route layout, tRPC registration, Prisma `@@map`, path alias `~/`.
- Evidence (domain gap): wedge transition logic is distributed across `src/hooks/use-pomodoro-cycle.ts` (~2100 lines), `src/app/_components/pomodoro-dashboard.tsx`, and pure helpers in `src/lib/catch-up/`, `src/lib/session/`. No central **transition conductor** yet (F-07). PRD v3 US-01 depends on extracting orchestration — agents editing one overlay can miss mutex rules documented in `user-flow.md` T-01–T-05.

**Popular in training data — pass**

- Evidence: TypeScript, Next.js App Router, React, tRPC, Prisma, Vitest, and Playwright are mainstream in the JS/TS ecosystem training corpus.

**Well-documented — pass (core); partial (Neon Auth beta)**

- Evidence: Next.js, Prisma, tRPC, Vitest, and Playwright have versioned official docs.
- Partial: `@neondatabase/auth` at `0.4.1-beta` — docs trail stable releases; project compensates via `.cursor/skills/neon-database/SKILL.md` and pinned version in `package.json`.

## PRD v3 Change Scope — Agent Readiness

Assessment scoped to `context/foundation/prd.md` v3 `## Scope of Change` and [`roadmap-references/prd-v3-horizon.md`](roadmap-references/prd-v3-horizon.md).

| Change area | Stack touchpoints | Agent readiness | Notes |
|-------------|-------------------|-----------------|-------|
| **US-01** Transition conductor (F-07, B-05–B-08, S-34, S-35) | `use-pomodoro-cycle.ts`, overlay components, tRPC cycle router | **Needs compensation** | Highest risk: implicit gate ordering. Ship F-07 foundation before feature slices. E2E belt must cover beat mutex. |
| **US-02** Persona presets + trust bridge (S-29, S-32) | Task create UI, `src/lib/scoring/`, suggestion rationale | **Ready** | Typed scoring lib with tests; patterns in `persona-preset-picker.tsx`. |
| **US-03** Daily standing + recap (S-27, S-30) | Prisma schema, task router, narrative builders | **Ready** | Standard CRUD + display; local-midnight reset is a documented PRD constraint. |
| **US-04** Pause/resume (S-24) | Prisma cycle enum, timer hook, guest blob | **Ready with note** | Pause cap ~30 min and no-interruption rule must be in instruction files; touches guest + auth dual path via `data-mode`. |
| **Craft** Focus shell, Calm Garden (S-28, S-31) | `DESIGN.md`, home/wedge components | **Ready** | Visual tokens and `/impeccable` skill referenced in AGENTS.md. |

**Efficient delivery implication:** Core stack does not block PRD v3. Sequential bottleneck is **domain orchestration** (Stream N), not framework choice. Parallel craft slices (S-28, S-31) can run beside S-29; conductor work should not be skipped.

## Gaps & Compensation

### Gap 1 — Wedge transition orchestration (convention at domain layer)

**What failed:** No single module enforces “max 1 interstitial + 1 gate per beat.” Logic spans hook + dashboard + lib helpers.

**Why it matters:** PRD v3 Primary success (US-01) and guardrail against interstitial fatigue. Agents adding S-21 copy, S-17 narrative, or S-19 ack without conductor context will reintroduce B-05-class stacking bugs.

**Compensation:**

- Implement F-07 (`wedge-transition-conductor`) as explicit pure module + hook before S-21/S-34/S-35.
- Require `/10x-plan` to read `user-flow.md` and `flow-coherence-recommendations.md` for any wedge-touching slice.
- Extend E2E belt with beat-mutex scenarios after F-07.

### Gap 2 — Neon Auth beta documentation

**What failed:** Third-party auth provider is pre-1.0; official docs less stable than core stack.

**Why it matters:** Low for PRD v3 (auth preserved, no changes) unless OAuth/guest merge regressions during parallel work.

**Compensation:**

- Pin `@neondatabase/auth` version in plans; use `@.cursor/skills/neon-database/SKILL.md` for auth operations.
- Do not upgrade auth deps in unrelated slices.

### Gap 3 — Dual data mode (guest vs authenticated)

**Not a gate failure** — pattern exists in `src/lib/data-mode/` — but PRD v3 modifies guest narrative (shortened closure) and adds pause semantics across both paths.

**Compensation:**

- Any slice touching session/cycle state must test guest + auth paths.
- Reference `useRepositories()` pattern; never bypass data-mode for “quick fixes.”

## Recommended Instruction File Additions

Ready-to-paste blocks for `AGENTS.md` (add after Layout & conventions):

```markdown
## Wedge transition conductor (PRD v3 / F-07)

- At each transition beat, at most **one interstitial line** plus **one gate** may be visible. Never stack check-in, suggestion, override ack, narrative, wind-down, or break copy on the same beat.
- Gate priority and mutex rules: `@context/foundation/user-flow.md` (T-01–T-05) and `@context/foundation/roadmap-references/flow-coherence-recommendations.md`.
- New transition surfaces MUST route through the conductor module (F-07) — do not add overlay `&&` branches directly in `pomodoro-dashboard.tsx` or `use-pomodoro-cycle.ts` without conductor integration.
- Flow-coherence hotfixes (B-05–B-08) ship before or inside F-07; see `@context/foundation/roadmap.md` Stream N.

## Pause/resume semantics (PRD v3 / S-24)

- Pause suspends cycle timer; does **not** increment session interruption count.
- Pause cap ~30 minutes → auto-end session calmly (PRD v3 OQ1).
- Implement pause for both guest blob and authenticated cycle paths via `@src/lib/data-mode/`.

## PRD v3 planning

- Product contract: `@context/foundation/prd.md` v3 (brownfield). Slice map: `@context/foundation/roadmap-references/prd-v3-horizon.md`.
- Optimistic wedge transitions (S-34): follow optimistic task mutation patterns from S-09; perceived check-in → suggestion ≤200ms.
```

## Summary

**Overall verdict: ready-with-compensation.**

The T3-style stack (TypeScript, Next.js, tRPC, Prisma, Vitest, Playwright, Biome) passes all four agent-friendly criteria at the component level. PRD v3 does not require stack changes — it deepens product behavior on a stack that already supports typed, convention-based agent workflows.

**Key strengths for v3 delivery:** End-to-end typing, established test belt, documented layout rules, scoring lib with unit tests, existing optimistic mutation patterns (S-09), and split roadmap references that keep planning context loadable on demand.

**Key gaps for v3 delivery:** (1) wedge transition orchestration is implicit until F-07 lands — budget conductor foundation before copy/craft slices that touch beats; (2) Neon Auth beta needs version pinning when touching auth-adjacent code; (3) dual guest/auth paths require explicit test coverage for pause and narrative changes.

**Recommended next step:** `/10x-health-check` — dependency audit and CI coverage validation, with focus on E2E belt completeness for PRD v3 guardrails (200ms wedge, network recovery, beat mutex).

---

## Change thread assessment: Break alerts outside active tab (narrow MVP)

**Assessed:** 2026-06-18  
**PRD:** `context/foundation/prd.md` — Change thread PRD: Break alerts outside active tab (narrow MVP)  
**Shape:** `context/foundation/shape-notes.md` — Change thread: Break alerts outside active tab  
**Scope:** FR-001–006 — browser system notifications + background break audio when app tab is not focused at **break start**; first-session permission explain; one-action disable; no backend changes.

> Base stack assessment above (2026-06-13, PRD v3) is unchanged. This section evaluates **agent readiness for the narrow MVP thread only**.

### Inherited stack verdict

The T3-style stack (TypeScript strict, Next.js App Router, Vitest, Playwright, Biome, pnpm) **inherits all four agent-friendly criteria passes** from the baseline assessment. This thread introduces **browser platform APIs**, not new framework dependencies — no `package.json` changes required for MVP.

| Layer | Relevance to thread | Baseline passes? |
|-------|---------------------|------------------|
| TypeScript strict | New notification preference types, permission state enums | ✓ |
| Next.js client components | First-session prompt UI, settings toggle | ✓ |
| Vitest | Unit tests for notification helper, preference storage, audio+visibility branch | ✓ |
| Playwright | E2E with `notifications` permission + background tab | ✓ (with compensation) |
| tRPC / Prisma | Out of scope — preference is device-local only | n/a |

**Thread verdict: ready-with-compensation** — stack does not block delivery; gaps are **missing patterns and test harness**, not framework choice.

### PRD thread — stack touchpoints

| FR / area | Existing code | Agent readiness | Evidence |
|-----------|---------------|-----------------|----------|
| **FR-002** System notification at break start (tab unfocused) | **None** — no `Notification` API usage in `src/` | **Needs new module** | `grep Notification` → 0 matches in app code |
| **FR-003** Background break audio | `src/lib/audio.ts` (`createAudioManager`), `use-pomodoro-cycle.ts` `handleCycleExpired` | **Extend existing** | `playAlarm` on cycle complete; autoplay blocked silently (`isPlaybackBlocked`) |
| **FR-001** First-session permission explain | `src/lib/onboarding/` (storage, defer, copy) | **Ready pattern** | Guest/user scoped localStorage keys; defer/subscribe pattern in `defer.ts` |
| **FR-004** One-action disable | `src/lib/cycle-audio-preference/` | **Ready pattern** | `readCycleEndAudioMode` / `writeCycleEndAudioMode` — extend or parallel module |
| Tab visibility / hidden tracking | `use-pomodoro-cycle.ts` visibility listener, `tabWasHiddenWhileRunningRef` | **Ready** | Lines ~861–883; tests mock `document.visibilityState` in `use-pomodoro-cycle.test.tsx` |
| In-tab fallback (title pulse) | `src/lib/cycle-end-tab-pulse.ts` | **Partial — wrong trigger** | Pulse only when `cycleKind === "WORK"` and audio mode soft/muted — **not** break start, **not** system notification |
| Catch-up overlays when hidden | `setCatchUpFromExpiry`, dashboard overlays | **Preserved — do not conflate** | Work-cycle gate UX; break alert is separate channel per PRD thread |
| **FR-005/006** Preserved in-tab behavior | Audio modes, pause, guest/auth paths | **Ready with regression risk** | Hook tests + E2E belt; blast radius concentrated in timer hub |

**Efficient delivery implication:** Ship a small `src/lib/break-out-of-tab-alert/` (or similar) pure module + thin hook integration at **break-start boundary**. Do not route through wedge conductor (F-07) — PRD thread explicitly scopes away from overlay mutex. Trace exactly where `cycleKind` becomes `SHORT_BREAK` / `LONG_BREAK` with `state === "running"` before wiring notification — work-cycle expiry alone is insufficient if check-in gate delays break start.

### Thread-specific gaps & compensation

#### Gap T1 — No notification API pattern in codebase

**What’s missing:** Zero existing `Notification.requestPermission`, `new Notification`, or service-worker push infrastructure. No `manifest.json` / PWA — MVP uses **tab-scoped** Notification API only (valid while browser process runs).

**Why it matters for agents:** Agents may confabulate service-worker push, Next.js server routes, or tRPC persistence for a device-local browser permission.

**Compensation (ready-to-paste for `AGENTS.md`):**

```markdown
## Break out-of-tab alerts (narrow MVP / change thread)

- **Browser Notification API only** — no service worker, no PWA manifest, no server-side push, no Prisma field for MVP.
- Fire **one** system notification when break timer **starts** (`SHORT_BREAK` / `LONG_BREAK` running) AND app tab is not focused — not on work-cycle expiry alone if check-in gate still pending.
- Reuse Page Visibility patterns from `use-pomodoro-cycle.ts` (`tabWasHiddenWhileRunningRef`, `visibilitychange` listener) — do not duplicate hidden-tab tracking.
- User preference for out-of-tab alerts: follow `cycle-audio-preference` scoped localStorage pattern (guest + authenticated user keys).
- Respect existing `CycleEndAudioMode` (normal / soft / muted) for in-tab audio; out-of-tab path is additive, not a replacement.
- One settings action disables **all** out-of-tab alerts (notification + background break-audio path) without breaking in-tab timer.
- No work blocking — informational only; no modal gates on notification click beyond focusing the tab.
```

#### Gap T2 — Break-start vs work-end timing in timer hub

**What’s missing:** Current out-of-tab signals target **work cycle end** (`handleCycleExpired` → `playAlarm`, tab pulse for WORK only). PRD thread requires alert at **break start** — may occur after check-in gate completes.

**Why it matters:** Agent wiring notification to `handleCycleExpired` alone will ping during work→break transition before break actually runs, or miss delayed break starts.

**Compensation:**

- In slice plan, name the exact hook state transition (file + function) for break start before implementation.
- Add Vitest case: check-in pending → no notification; break running + hidden → notification once.

#### Gap T3 — E2E harness for notifications + background tab

**What’s missing:** No Playwright specs grant `notifications` permission or assert notification delivery. Visibility mocked only in Vitest (`Object.defineProperty(document, "visibilityState", …)`).

**Why it matters:** PRD guardrail “in-tab behavior must not regress” needs belt coverage; notification APIs behave differently in headless Chromium.

**Compensation:**

```markdown
## E2E — break out-of-tab alerts

- Grant permission in test setup: `context.grantPermissions(['notifications'])` (or project fixture equivalent).
- Prefer **two-tab** or `page.evaluate(() => Object.defineProperty(document, 'visibilityState', …))` to simulate unfocused app tab before break start.
- Assert at most one notification per break start; assert settings toggle suppresses subsequent notifications.
- Tag full notification E2E `@skip-belt` if flaky in CI; keep belt case for in-tab regression (audio + catch-up unchanged).
- Reference existing fake-timer helpers in `e2e/helpers/work-cycle.ts` for break timing.
```

#### Gap T4 — Browser policy variability (autoplay + permission)

**What’s missing:** `audio.ts` swallows `NotAllowedError` / `AbortError`; no user-facing fallback when both notification denied and audio blocked.

**Why it matters:** Agents may assume alerts always deliver; PRD requires graceful degradation.

**Compensation:**

- Unit-test denied-permission and autoplay-blocked paths — timer state must remain consistent.
- Settings surface must link to browser permission re-enable (PRD OQ2 — copy TBD in PRD, not stack).

### Quality gate assessment (thread-specific APIs)

| Surface | Typed | Convention | Training Data | Documented | Verdict |
|---------|-------|------------|---------------|------------|---------|
| Notification API (browser) | ✓ (TS DOM lib) | ✗ (no project convention yet) | ✓ (MDN + widespread) | ✓ (MDN) | **pass with compensation** |
| Page Visibility (existing) | ✓ | ✓ (project pattern in hook) | ✓ | ✓ | pass |
| Web Audio alarm (existing) | ✓ | ✓ (`lib/audio.ts`) | ✓ | ✓ | pass |
| Playwright notifications E2E | ✓ | ✗ (no project pattern yet) | ✓ | ✓ (Playwright docs) | **pass with compensation** |

### Thread summary

**Readiness: ready-with-compensation.**

Core stack needs no migration. The thread adds **client-only browser APIs** on top of proven timer, audio, onboarding, and preference patterns. Sequential risk is **correct break-start hook point** and **E2E permission setup**, not framework gaps.

**Key strengths:** Strict TypeScript, existing visibility tracking, audio manager with tests, scoped localStorage preferences (guest + auth), onboarding defer pattern for first-session explain.

**Key gaps:** (T1) no Notification module yet; (T2) break-start timing vs work-end; (T3) E2E notification harness; (T4) graceful degradation when permission/audio blocked.

**Recommended next step for this thread:** `/10x-health-check` with focus on timer-hub test coverage gaps for visibility/audio paths; then `/10x-new` + `/10x-plan` for break-alerts slice before touching `use-pomodoro-cycle.ts`.

---

## Change thread assessment: Timer change-impact digest (narrow MVP)

**Assessed:** 2026-06-18  
**Thread:** `timer-change-impact-digest` (internal dev CLI — no end-user product change)  
**PRD source:** `context/foundation/prd.md` — Change thread PRD: Timer change-impact digest  
**Shape source:** `context/foundation/shape-notes.md` — Change thread: Timer change-impact digest  
**Mom Test:** Git replay 4/5; narrow co-change MVP; CI gate deferred.

### Thread scope — stack touchpoints

| Touchpoint | Role in MVP | Already on stack? |
|------------|-------------|-------------------|
| **Node.js ESM scripts** | Host read-only CLI (`git` subprocess, stdout report) | Yes — `package.json` `"type": "module"`; precedent in `scripts/agent-hooks/*.mjs` |
| **Git CLI** | Co-change frequency via `git log --name-only` | Yes — repo has full history; Windows PowerShell dev env |
| **dependency-cruiser** | Optional fan-out count (nice-to-have FR-005) | Yes — devDep `^17.4.3`, scripts `depcruise`, `depcruise:graph`, config `.dependency-cruiser.cjs` |
| **Static test catalog** | Map co-changed paths → `pnpm test` / `vitest` / `test:e2e:belt` | Yes — commands documented in `AGENTS.md`, `context/map/repo-map.md`, `context/foundation/test-plan.md` |
| **TypeScript** | Optional typed script (`.ts` + `tsx`) vs `.mjs` like agent-hooks | Partial — strict TS for product; agent-hooks use untyped `.mjs` |
| **CI / lefthook** | Out of MVP — advisory CLI only | Yes — lefthook runs `vitest related` on staged files; no pre-change digest hook yet |
| **Product runtime** | Must remain untouched | N/A — tool lives under `scripts/` + `package.json` script entry |

### Detected stack (thread-specific)

```
Thread runtime:     Node.js ESM (same repo as FlowState)
Co-change source:   git CLI (local subprocess)
Optional analysis:  dependency-cruiser (existing scripts; reports/ output optional)
Test layers:        Vitest 4 (unit/integration) + Playwright belt (e2e/)
Instruction context: AGENTS.md, context/map/repo-map.md, context/architect-report.md
Existing hook pattern: scripts/agent-hooks/ (lefthook post-edit, not pre-change)
Package manager:    pnpm (required by AGENTS.md)
```

### Quality gate assessment (thread components)

| Component              | Typed | Convention | Training Data | Documented | Verdict |
|------------------------|-------|------------|---------------|------------|---------|
| Node ESM dev scripts   | ~     | ✓          | ✓             | ✓          | pass-with-note |
| Git CLI (co-change)    | —     | ✓          | ✓             | ✓          | pass    |
| dependency-cruiser     | —     | ✓          | ~             | ✓          | pass-with-note |
| Vitest + Playwright    | —     | ✓          | ✓             | ✓          | pass    |

Legend: ✓ = pass, ~ = partial, — = not applicable

#### Gate details (thread)

**Node ESM dev scripts — pass-with-note (typed partial)**

- Evidence (convention): `scripts/agent-hooks/related-tests.mjs` — stdin hook input, `spawnPnpm`, project-root resolution via `lib/input.mjs`. Clear precedent for new `scripts/change-impact/` or `scripts/timer-digest.mjs`.
- Evidence (typed partial): agent-hooks use `.mjs` without TypeScript; product uses `strict` TS. MVP can ship as `.mjs` (fastest) or `.ts` executed via `node --import tsx` — not yet a repo convention for standalone tools.

**Git CLI — pass**

- Evidence: git history available; Mom Test replay used `git log` / `git diff-tree` successfully on timer-hub paths.
- Co-change parsing is standard git plumbing — high training-data coverage for agents.

**dependency-cruiser — pass-with-note (training data partial within niche)**

- Evidence: `package.json` scripts lines 26–30; `.dependency-cruiser.cjs` present; architect L3 artifacts cite fan-out counts.
- Partial: depcruise config covers `src/` only — `e2e/` is **outside** the dependency graph (`repo-map.md`: E2E co-changes via git, not imports). Digest must not imply E2E deps from depcruise; co-change table is authoritative for E2E layers.

**Vitest + Playwright — pass**

- Evidence: `pnpm test`, `pnpm exec vitest run`, `pnpm test:e2e:belt` in `AGENTS.md`; co-located `*.test.ts(x)` under `src/`; belt specs under `e2e/`.

### PRD thread scope — agent readiness

Scoped to digest thread `## Scope of Change` in `prd.md` (FR-001–006, US-01).

| Capability | Stack readiness | Notes |
|------------|-----------------|-------|
| **FR-001** Git co-change top-N report | **Ready** | git subprocess only; no new deps required |
| **FR-002** Static test-command block | **Ready with compensation** | Commands exist; mapping table must be authored once in script or small JSON — not yet on disk |
| **FR-003** One-screen stdout (~40 lines) | **Ready** | Formatting only |
| **FR-004** `--strict` / quiet threshold | **Ready** | CLI flags; threshold N from Open Question — tune on dry-run |
| **FR-005** Optional depcruise fan-out count | **Ready with compensation** | Run `pnpm depcruise` or parse cached output; `reports/` may be absent locally — graceful omit required |
| **FR-006** Zero product impact when not invoked | **Ready** | Isolated script; no `src/` edits required for MVP |

**Overall thread verdict: ready-with-compensation.**

Core stack does not block the digest MVP. Friction is **missing conventions** for co-change tooling and the known **E2E-outside-graph** split — not framework choice.

### Gaps & compensation (thread)

#### Gap T1 — No co-change script convention yet

**What failed:** Convention gate for the new tool itself — no existing `pnpm change-impact` or co-change helper; agent-hooks run **after** edit (vitest related), not **before**.

**Why it matters:** Agents implementing FR-001 may invent ad-hoc bash one-liners or duplicate repo-map prose instead of a stable CLI contract.

**Compensation:**

- Add script at `scripts/change-impact/` (or `scripts/timer-change-impact.mjs`) following `scripts/agent-hooks/lib/spawn-pnpm.mjs` patterns for cwd resolution.
- Register `pnpm change-impact` in `package.json` — mirror `depcruise:*` script naming.
- Document default path: `src/hooks/use-pomodoro-cycle.ts`.

#### Gap T2 — E2E layer invisible to dependency-cruiser

**What failed:** depcruise graph excludes `e2e/`; co-change is the only signal for belt specs (`e2e/pomodoro-cycle.spec.ts`, helpers).

**Why it matters:** FR-002 test-command block must source E2E from git co-change + static catalog, not from depcruise fan-out.

**Compensation:**

- Hard-code path-prefix → test command map for timer hub (hook test, dashboard smoke, belt E2E) aligned with `repo-map.md` §3.
- Label E2E rows in output as `source: git co-change` vs `source: depcruise` when both present.

#### Gap T3 — Optional depcruise artifacts may be missing

**What failed:** FR-005 optional fan-out count assumes local depcruise output; `reports/` not guaranteed in every clone.

**Why it matters:** Script must not fail when reports absent; run lightweight `depcruise --focus <path> --output-type json` on demand or skip with message.

**Compensation:**

- On missing cache: print `fan-out: (run pnpm depcruise to generate)` and exit 0.
- Do not add depcruise to CI for this slice (thread non-goal).

#### Gap T4 — Agent-hooks risk patterns ≠ timer-hub checklist

**What failed:** `scripts/agent-hooks/lib/risk-areas.mjs` covers hooks, routers, `_components` generically — not co-change pairs or belt E2E reminder before edit.

**Why it matters:** Related-tests hook helps post-commit; digest fills pre-edit gap Mom Test identified. Both can coexist; neither replaces the other.

**Compensation:**

- Keep digest advisory in v1 (thread non-goal: no lefthook/CI gate until ≥3 manual uses).
- Optional v2: lefthook `pre-commit` only when timer-hub paths staged — out of MVP scope.

### Recommended instruction file additions (thread)

Ready-to-paste block for `AGENTS.md` (add when digest ships):

```markdown
## Timer change-impact digest (maintainer CLI)

- Before editing timer hub files (`use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, `src/lib/wedge/`), run: `pnpm change-impact -- <path>`.
- Output is advisory only — does not replace `pnpm test` or `pnpm test:e2e:belt` before merge.
- Top co-change paths come from **git history**, not depcruise — E2E specs are co-change signals (depcruise excludes `e2e/`).
- Default reference path: `src/hooks/use-pomodoro-cycle.ts`. Use `--strict` for full warnings on trivial edits.
- Static map: `@context/map/repo-map.md` §3 — digest complements, does not replace, repo-map.
- Do not wire CI/lefthook gates for this tool until manual habit validated (≥3 consecutive timer slices).
```

### Thread summary

**Verdict: ready-with-compensation.**

FlowState's existing Node ESM tooling, pnpm scripts, git, dependency-cruiser, Vitest, and Playwright belt are sufficient to ship the digest MVP in ~1 week after-hours without stack changes. Compensation focuses on **new script conventions**, **E2E-via-git labeling**, and **graceful depcruise optional path** — not replacing the stack.

**Key strengths:** Precedent in `scripts/agent-hooks/`; depcruise already wired; test commands standardized in AGENTS.md; Mom Test validated co-change signal on real git history.

**Key gaps:** No pre-change CLI yet; E2E outside depcruise graph; optional fan-out requires graceful degrade; maintainer habit unconfirmed before CI promotion.

**Recommended next step for this thread:** `/10x-new timer-change-impact-digest` → `/10x-plan` (prototype script + dry-run on `use-pomodoro-cycle.ts`); `/10x-health-check` optional for repo-wide CI context.
