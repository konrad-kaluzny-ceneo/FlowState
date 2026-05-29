# Frame Brief: Guest usage and merge on login

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

A new user cannot try FlowState (tasks + focus sessions) without creating an account first. The product should allow that trial path, persist guest work locally, and fold it into the account after login without losing data.

## Initial Framing (preserved)

- **User's stated cause or approach**: Unauthenticated users store everything in localStorage; after login, data merges into the server account.
- **User's proposed direction**: Add a roadmap feature and implement guest mode with merge-on-login.
- **Pre-dispatch narrowing**: Leading concern is **onboarding** (try before signup), not a generic auth refactor. Guest surface must include **tasks and starting focus sessions** at minimum; broader parity only where features do not require a server session. On merge: data should be **added**; conflicts should be rare; if they occur, **keep both versions** rather than picking a winner.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Onboarding / product intent** — friction from “account first” blocks evaluating the core loop before commitment.
2. **Auth & route gates** — proxy + page redirect prevent any unauthenticated UI (`proxy.ts`, `page.tsx`).
3. **Data & API model** — all domain reads/writes are `protectedProcedure` + Prisma `userId`; no client-side domain store for guests.
4. **PRD / roadmap contract** — MVP explicitly requires login; guest mode reverses a prior Socrates decision (FR-001) and needs documented scope.
5. **Merge semantics** — “no conflicts” vs “keep both versions” is underspecified for tasks/cycles with integer FKs and titles.

Initial framing sat on dimensions **2 + 3** (localStorage + merge) but treated them as the whole problem; the leading concern is **1**, with **3** as the implementation load and **4** as a gating amendment.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **Onboarding intent** — users bounce because they must register before value | User narrowing: leading concern is try-before-signup; PRD FR-001 records rejected “registration adds friction before value” (`prd.md:63-64`) | **STRONG** |
| **Auth/UI gate** — redirects alone explain “can’t use app” | `proxy.ts:5-16` Neon Auth middleware → `/auth/sign-in`; `page.tsx:13-15` second redirect; only `/auth/*` and static assets are public | **STRONG** (symptom, not sufficient fix) |
| **Data layer** — guest mode needs parallel persistence, not bypass | All task/cycle/session/check-in procedures use `protectedProcedure` (`task.ts`, `cycle.ts`, `session.ts`); UI uses tRPC only (`pomodoro-dashboard.tsx:13`, `use-pomodoro-cycle.ts`); localStorage today is duration pref only (`duration-storage.ts`) | **STRONG** (primary engineering surface) |
| **PRD/roadmap gap** — feature is out of current contract | Primary success = logged-in user (`prd.md:33`); Access Control: login required (`prd.md:156`); roadmap has no guest slice; only note in `guest-local-storage-merge/change.md` | **STRONG** |
| **Initial framing (localStorage + merge)** — correct direction | Matches user intent but understates dual-store architecture and PRD amendment; merge rules contradict DB uniqueness unless “both versions” means duplicate rows | **WEAK** as a complete problem statement |

## Narrowing Signals

- User prioritized **onboarding** over data-loss anxiety or roadmap housekeeping alone.
- Minimum guest surface: **tasks + focus sessions**; full logged-in parity only where session-less logic is feasible.
- Merge preference: **additive**; on conflict, **retain both** — this rules out naive “server wins” but forces explicit duplicate/ID-remap policy in planning (cannot assume conflict-free merge).

## Cross-System Convention

FlowState’s shipped contract is **login-first, server-authoritative** (PRD, roadmap north star, e2e infra). The guardrail “auth must not destroy local state on failed login” (`prd.md:42`) protects in-session browser state during auth errors — it does **not** establish guest mode.

Independent codebase search (without presupposing localStorage) landed on the same chain: **proxy → page redirect → protected tRPC → per-user DB** — not a missing guest-storage module.

Pressure-test: Lifting redirects alone would still yield `UNAUTHORIZED` on every task/cycle call; the initial “localStorage” direction is consistent with needed **client-side domain storage**, but the plan must center **guest domain replica + merge**, not storage technology.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Remove signup friction for the core loop by letting users run **tasks + Pomodoro sessions** without an account, backed by a **client-side domain store** with a defined **merge-into-account on login** — while amending PRD/roadmap so this does not conflict with “login required” and “no silent data loss.”

The user’s localStorage + merge story is directionally right but incomplete: today’s blocker is a **stacked auth wall** (symptom) on top of a **server-only data path** (root load). “Add to roadmap” is a **documentation/tracking** step inside that scope change, not a separate problem. Merge cannot be hand-waved as conflict-free if duplicates are required on collision.

## Confidence

**HIGH** — auth gate, server-only API, and PRD/roadmap absence are verified with file references; user narrowing aligns with onboarding reframe.

**MEDIUM** on merge semantics — additive + duplicate-on-conflict needs explicit rules (task title collisions, active cycle, ID remapping) before implementation.

## What Changes for /10x-plan

Plan a **vertical slice** (roadmap entry + PRD touch): guest client store for Task/Session/Cycle (minimum), auth/route changes to render the dashboard without session, **post-login merge** mutation or client-orchestrated import with ID remap, and tests for “guest work survives login.” Do **not** plan as “remove `redirect` in `page.tsx` only.” Defer full parity (check-ins, scoring, multi-session breaks) unless each feature is shown session-optional.

## References

- `proxy.ts:5-16` — auth middleware, sign-in redirect
- `src/app/page.tsx:10-17` — session gate + protected prefetch
- `src/server/api/trpc.ts:128-161` — `publicProcedure` unused; `protectedProcedure` enforces session
- `src/server/api/routers/task.ts`, `cycle.ts`, `session.ts` — all domain procedures protected
- `src/app/_components/pomodoro-dashboard.tsx:13`, `src/hooks/use-pomodoro-cycle.ts` — tRPC-only data path
- `src/lib/duration-storage.ts` — only existing localStorage (duration pref)
- `context/foundation/prd.md:33,42,63-64,156` — logged-in success, FR-001, login required
- `context/foundation/roadmap.md` — no guest slice in At a glance / Streams
- `context/changes/guest-local-storage-merge/change.md` — original intent
- Investigation: auth gate (agent f662c043), data layer (agent 8dfdfcc9), PRD scope (agent c32af7e0), independent causes (agent 837f138a)
