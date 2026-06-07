# Guest usage with localStorage and merge on login — Plan Brief

> Full plan: `context/changes/guest-local-storage-merge/plan.md`
> Frame brief: `context/changes/guest-local-storage-merge/frame.md`

## What & Why

> **The actual problem to plan around is**: Remove signup friction for the core loop by letting users run **tasks + Pomodoro sessions** without an account, backed by a **client-side domain store** with a defined **merge-into-account on login** — while amending PRD/roadmap so this does not conflict with “login required” and “no silent data loss.”

## Starting Point

Auth blocks `/` (proxy + page redirect). All domain data flows through `protectedProcedure` tRPC to Postgres. Only localStorage in use is timer duration preference. PRD and roadmap assume login-first; S-01 core cycle is shipped.

## Desired End State

Visitors use `/` without an account: tasks + work cycles persist in a versioned localStorage blob and survive refresh. After sign-in or sign-up, one server import brings data into their account (with title suffixes on collision). **Logged-in users never use guest storage for tasks/cycles** — server remains source of truth. Roadmap lists **S-08** for this slice.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Data access pattern | Repository interface (guest + server) | Keeps hooks single-path and testable. | Plan |
| Guest storage | localStorage `flowstate:guest-v1` | Matches user intent; consistent with duration pref pattern. | Frame / Plan |
| Guest IDs | UUID strings, remap on import | No Prisma migration. | Plan |
| Logged-in + localStorage | **No** — server only when session exists | Avoids split-brain; guest blob cleared after import. | Plan (user question) |
| Merge execution | `guest.import` tRPC + client trigger after auth | Atomic, testable ID remap. | Plan |
| Auth surface | `/` allowed without session | Same URL for trial and product. | Plan |
| Active cycle at login | Import as RUNNING if not expired | Honors no silent data loss. | Frame |
| Title collision | New row; suffix ` (2)`, ` (3)`, … | User asked for numbered version suffix. | Plan |
| Roadmap slot | **S-08** after S-01, parallel S-02/S-07 | Onboarding without blocking breaks track. | Plan |
| Out of scope | Check-ins, breaks, guest tRPC persistence | Frame deferral. | Frame |

## Scope

**In scope:** Guest blob schema; guest store; repositories; open `/` for guests; guest banner CTAs; `guest.import`; post-auth import + blob clear; PRD/roadmap S-08; unit + integration + E2E guest path.

**Out of scope:** Breaks/multi-session (S-02); check-ins (S-05); full feature parity; IndexedDB; DB UUID migration; anonymous Neon tokens.

## Architecture / Approach

`DataModeProvider` picks `guest` vs `authenticated` from session. Repositories hide tRPC vs localStorage. Timer/audio/recovery logic reuses S-01 patterns against guest snapshot for active cycle. On auth, client calls `guest.import` once, then clears `flowstate:guest-v1`. Duration pref key may remain shared.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. PRD | Guest trial FRs (S-08 verify only) | Linear duplicate issues (L-01) |
| 2. Guest store | Schema + localStorage adapter | Quota / private mode |
| 3. Auth spike | `/` open for guests (**gate** before Phase 4) | Neon middleware config |
| 4. Repositories | Dual backend + full dashboard refactor | Suspense/UUID touch (timer, overlay) |
| 5. Import | `guest.import` + post-auth merge | Partial import / double import |
| 6. E2E | guest-trial + smoke + hook tests | Playwright auth project split |

**Prerequisites:** S-01 done, F-02 done  
**Estimated effort:** ~4–5 implementation sessions across 6 phases

## Open Risks & Assumptions

- Neon Auth middleware must support optional session on `/` — **Phase 3 auth spike (gate)**; Phase 4 blocked until incognito `/` works.
- Guest data is device-local; clearing browser storage loses guest work (banner copy).
- Frame noted MEDIUM confidence on merge edge cases — covered by suffix + RUNNING/expired rules above.

## Success Criteria (Summary)

- Unauthenticated user completes task + cycle on `/` with refresh recovery (local).
- Sign-in/up merges guest data once; logged-in session never reads guest domain blob afterward.
- Authenticated smoke and new guest E2E pass in CI.
