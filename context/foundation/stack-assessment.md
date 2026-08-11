---
project: flow-state
assessed_at: 2026-08-11T14:45:00Z
updated: 2026-08-11
agent_readiness: ready-with-compensation
context_type: brownfield
prd_version: 4
assessment_focus: "PRD v4 — day schedule, RRULE, planning session, work segments, habit activation, cross-day recovery"
prd_ref: context/foundation/prd-v4.md
shape_ref: context/foundation/shape-notes.md#change-thread-prd-v4--day-schedule-habit-activation-gtdatomic-habits
stack_components:
  language: TypeScript (strict)
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
domain_gaps: 5
---

## Stack Components

**Language — TypeScript:** `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`, and `checkJs`. End-to-end types from Prisma generated client through tRPC routers to React components.

**Framework — Next.js 16 App Router:** T3-derived layout — `src/app/` routes, `_components/` co-located with pages, `src/server/api/routers/` for tRPC. React 19 client components for interactive Pomodoro UI.

**API — tRPC + Zod:** Routers registered in `src/server/api/root.ts`; inputs validated with Zod; React Query integration via `~/trpc/react`.

**ORM — Prisma 7:** Schema in `prisma/schema.prisma`; client generated to `./generated/prisma/client`; Neon HTTP adapter for serverless. Migrations via `pnpm prisma migrate dev` only.

**Testing — Vitest + Playwright:** Unit/integration co-located `*.test.ts` under `src/`; E2E belt in `e2e/` with auth pool and `@skip-belt` tagging. Lefthook runs related tests pre-commit.

**Tooling — Biome 2:** Sole linter/formatter (`pnpm check`); no ESLint/Prettier split.

**UI libraries relevant to v4:** `@dnd-kit/*` (task reorder — reusable for schedule block drag); `@visx/*` (Podsumowanie charts — extend for plan-vs-execution); `next-intl` (bilingual copy).

**CI/CD — GitHub Actions:** Quality job (check, typecheck, test) + E2E job on PR/push to main.

**Deployment — Vercel:** Native Next.js target; preview deploys on PR.

**Auth — Neon Auth (beta):** Email/password, Google OAuth, password recovery; guest device-local storage merge on sign-in.

**Instruction files:** `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `context/foundation/prd-v4.md`, `context/foundation/user-flow.md`, `context/foundation/roadmap-references/flow-coherence-recommendations.md`, `.cursor/skills/neon-database/SKILL.md`.

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

**Convention-based — pass (framework); partial (PRD v4 schedule domain)**

- Evidence (framework): `AGENTS.md` documents route layout, tRPC registration, Prisma `@@map`, path alias `~/`, dual data-mode repositories.
- Evidence (domain gap): Plan dnia is still mock + budget (`src/app/_components/plan-dnia-view.tsx`); no schedule entity conventions, RRULE library, or planning-session mode yet. Timer hub (`use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`) remains high blast radius for day-open and cross-day recovery (F-07 conductor shipped — reuse required).

**Popular in training data — pass**

- Evidence: TypeScript, Next.js App Router, React, tRPC, Prisma, Vitest, and Playwright are mainstream in the JS/TS ecosystem training corpus.
- Note: RRULE library choice is not yet in the repo — agent must follow an explicit plan decision, not invent ad hoc recurrence logic.

**Well-documented — pass (core); partial (Neon Auth beta)**

- Evidence: Next.js, Prisma, tRPC, Vitest, and Playwright have versioned official docs.
- Partial: `@neondatabase/auth` at `0.4.1-beta` — project compensates via `.cursor/skills/neon-database/SKILL.md`.

## PRD v4 Change Scope — Agent Readiness

Assessment scoped to `context/foundation/prd-v4.md` `## Scope of Change` (US-08–US-18, FR-001–018).

| Change area | Stack touchpoints | Agent readiness | Notes |
|-------------|-------------------|-----------------|-------|
| **US-18 / FR-014** Cross-day stale session fix | `use-pomodoro-cycle.ts`, session/cycle routers, local midnight helpers | **Needs compensation** | Ship first — unblocks day-open trust. Run `pnpm change-impact` before timer-hub edits. |
| **US-08 / FR-001–004** Daily schedule + RRULE | `plan-dnia-view.tsx`, new Prisma models, tRPC day-plan router extension | **Needs compensation** | No RRULE in codebase today; no real timeline UI — only `ComingSoonPreview` mock. Pick library in plan; `@dnd-kit` available for drag-resize. |
| **US-14 / FR-005–006** Planning session mode | New session category, day totals (extends S-52), Plan dnia UI | **Ready with note** | Must not trigger wedge gates; separate from Pomodoro hook paths or explicitly branched in conductor. |
| **US-10–11 / FR-007–008** Plan→Fokus + day-open | `plan-dnia-view.tsx`, `home-session-state`, F-07 conductor | **Needs compensation** | Cross-route handoff + day-open beat must not stack with energy gate or kickoff (T-01–T-05). |
| **US-16–17 / FR-009–011** Work segments + off-session % | New segment model, Podsumowanie (`@visx/*`), recap routers | **Ready** | Analytics patterns exist (S-48); extend, do not duplicate day-stats hooks ad hoc. |
| **US-13 / FR-012–013** Attention signals | `src/lib/break-out-of-tab-alert/`, tab title pulse (S-20 pattern) | **Ready** | Extend break-alerts precedent; ≤1 notification/day; favicon pulse follows existing reduced-motion patterns. |
| **US-15** GTD batch blocks | Schedule block ↔ task relations, suggestion pool | **Ready with note** | Batch is new UX; scorer input optional — preserve override freedom (FR-018). |

**Efficient delivery implication:** Core stack does not block PRD v4. Sequential bottlenecks are (1) cross-day correctness, (2) schedule + RRULE foundation, (3) conductor-safe day-open/handoff — not framework choice. Parallel after schedule MVP: planning session mode, segment metrics, attention signals.

## Gaps & Compensation

### Gap 1 — Schedule and RRULE domain (no existing patterns)

**What failed:** Convention at the PRD v4 domain layer — no persisted time blocks, no recurrence library, Plan dnia is placeholder-only.

**Why it matters:** US-08, US-09, and FR-003 are net-new product surface. Agents may hand-roll recurrence, split day-plan vs schedule models, or edit `plan-dnia-view.tsx` without repository/tRPC parity for guest + auth.

**Compensation:**

- First slice (`day-schedule-timeline`) must define: block types enum, local-day key binding (same as S-27), guest vs auth repository methods — extend `TaskRepository`/`DayPlan` pattern, not parallel CRUD from components.
- RRULE: select one library in `/10x-plan`; document timezone + materialization rules (local midnight, first Plan dnia open).
- Remove `ComingSoonPreview` mock only when real axis ships; keep budget panel integration on same `localDateKey`.

### Gap 2 — Timer hub blast radius (day-open, cross-day, handoff)

**What failed:** Not a framework gate failure — orchestration risk persists in `use-pomodoro-cycle.ts` and `pomodoro-dashboard.tsx`.

**Why it matters:** US-11, US-18, and FR-007–008 touch the same mutex surface as wedge beats. Regression risk: false break prompt, stacked day-open + energy gate, broken kickoff after Plan→Fokus navigation.

**Compensation:**

- Run `pnpm change-impact` before any edit to timer-hub files (mandatory per `AGENTS.md`).
- Route day-open through F-07 conductor — one beat only; document priority vs return-handoff and kickoff in plan.
- Cross-day fix slice completes before day-open steering slice.

### Gap 3 — Planning session vs wedge loop

**What failed:** No third session category today (only focus Pomodoro + breaks).

**Why it matters:** FR-005 explicitly bypasses check-in/suggestion gates. Accidental wiring into cycle enum or wedge hooks will break US-01 guardrails.

**Compensation:**

- Planning session is a **separate timer category** in day totals — not a `WORK` cycle with special casing unless plan explicitly chooses that shape.
- Document in slice plan: no `recordDecision`, no check-in overlay, no suggestion fetch during planning.

### Gap 4 — Dual data mode for new entities

**Not a gate failure** — pattern exists in `src/lib/data-mode/` — but schedule, RRULE patterns, segments, and planning sessions must implement guest + auth repositories.

**Compensation:**

- Extend repository interfaces first; implement guest + server sides before UI.
- Guest schedule parity is Open Question #1 in PRD v4 — default auth-first if guest scope unclear.

### Gap 5 — Neon Auth beta (inherited)

**Compensation unchanged:** Pin auth deps; use neon-database skill for auth-adjacent work; no drive-by upgrades during v4 slices.

## Recommended Instruction File Additions

Ready-to-paste blocks for `AGENTS.md` (add when first v4 slice starts):

```markdown
## PRD v4 — day schedule & habit activation

- Product contract: `@context/foundation/prd-v4.md` (brownfield). Shape thread: `@context/foundation/shape-notes.md` (PRD v4 section).
- Plan dnia target: real daily time axis replaces "Kalendarz wkrótce" mock — blocks persist per local day; merge with existing focus-hours budget on same `localDateKey`.
- RRULE patterns materialize proposals editable per day — never auto-start Pomodoro; user always starts explicitly.
- Planning session ("teraz planuję") counts as work time (planning category) — does NOT trigger wedge check-in, suggestion, or `recordDecision`.
- Work-day segments: off-session time = segment elapsed minus (focus + planning + break session time); calm analytics only — no streak or guilt copy.
- GTD batch blocks: multiple tasks per batch block; at most one task per focus block.

## PRD v4 — timer hub edits (mandatory)

- Before editing `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx`, or `src/lib/wedge/**`: run `pnpm change-impact`.
- Day-open steering (US-11): single F-07-gated beat — mutex with energy gate and kickoff per `@context/foundation/user-flow.md` T-01–T-05.
- Cross-day stale session (US-18): calm closure on local date rollover before day-open; preserve S-52 totals — no silent data loss.
- Plan→Fokus handoff (US-10): cross-route navigation must land in valid kickoff eligibility — no blank steering dead-end.

## PRD v4 — attention signals

- Day-start browser notification: opt-in, ≤1 per local day, tab not focused — extend `@src/lib/break-out-of-tab-alert/` patterns; not a notification hub.
- Idle favicon/title pulse: extend S-20 tab-pulse behavior; respect `prefers-reduced-motion`; stop immediately on session start.
```

## Summary

**Overall verdict: ready-with-compensation.**

The T3-style stack (TypeScript, Next.js, tRPC, Prisma, Vitest, Playwright, Biome) passes all four agent-friendly criteria at the component level. PRD v4 does not require a stack change — it adds schedule, recurrence, planning-as-work, segment metrics, and activation signals on the existing foundation.

**Key strengths for v4 delivery:** End-to-end typing, established test belt, F-07 conductor already shipped, break-alerts + tab-pulse precedents, `@dnd-kit` for drag interactions, `@visx` for Podsumowanie extensions, dual data-mode repository pattern, and `pnpm change-impact` maintainer tooling for timer-hub edits.

**Key gaps for v4 delivery:** (1) no schedule/RRULE domain yet — first slices must establish models and conventions before UI polish; (2) timer hub remains high blast radius for cross-day fix and day-open — conductor mutex and change-impact are mandatory; (3) planning session must stay outside wedge gates; (4) guest/auth parity for new entities must follow repository interface first.

**Recommended next step:** `/10x-health-check` — validate dependency health and test coverage with focus on Plan dnia E2E, cross-day session scenarios, and notification permission paths before large schedule UI land.

**Suggested slice order (from shape-notes):** `fix-cross-day-stale-session` → `day-schedule-timeline` → `planning-session-mode` → `recurrence-weekly-patterns` → `work-day-segments-off-session` → `plan-to-focus-handoff` → `day-open-wedge-steering` → `idle-focus-attention-signals` → `schedule-plan-vs-execution`.
