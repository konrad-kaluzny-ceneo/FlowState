# Align README With Implementation — Plan Brief

> Full plan: `context/changes/fix-readme/plan.md`

## What & Why

Update `README.md` so it matches FlowState's actual implementation. The README currently carries stale Drizzle and Next.js 15 wording after the project moved to Prisma 7 and Next.js 16, which can mislead new contributors during setup.

## Starting Point

The README is structurally useful but stale in four places: Tech Stack, environment setup, Scripts, and Project Structure. The source of truth is already present in `context/foundation/tech-stack.md`, `package.json`, `.env.example`, `src/env.js`, and the Prisma files.

## Desired End State

The README accurately says FlowState uses Next.js 16, Prisma 7 with `@prisma/adapter-neon`, Neon Serverless Postgres, Neon Auth, and Prisma CLI-backed database scripts. Setup instructions mention the required DB and Neon Auth env vars, plus the optional Cursor SDK key for review scripts.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Scope | Minimal factual correction | Keeps the diff small and avoids turning a README fix into a rewrite. |
| Scripts section | Core commands only | Keeps onboarding useful without duplicating every maintainer script from `package.json`. |
| Env documentation | Required DB + Neon Auth vars, optional Cursor key | Prevents first-run env validation failures while avoiding secret duplication. |
| Verification | `pnpm check` + manual source comparison | Appropriate for markdown-only drift while preserving the repo's local quality habit. |

## Scope

**In scope:**

- Correct stale Next.js/Prisma/Drizzle stack wording in `README.md`.
- Correct Prisma-related script descriptions.
- Document required DB and Neon Auth env vars at setup level.
- Fix the Project Structure block so DB schema/migrations point to `prisma/`.

**Out of scope:**

- Runtime code, Prisma schema, migrations, generated client, or package script changes.
- Full README rewrite or product copy polish.
- Exhaustive listing of every package script.
- Runtime/browser testing.

## Architecture / Approach

Use `context/foundation/tech-stack.md` as the canonical stack narrative, `package.json` as the command source, `.env.example` and `src/env.js` as the env source, and Prisma files as the DB source. Edit only the README sections that contradict those files, then run `pnpm check` and manually compare the final wording.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. README Factual Alignment | Corrects Tech Stack, setup env vars, script descriptions, and project structure | Over-expanding scope beyond factual drift |
| 2. Source-of-Truth Verification and Handoff | Confirms README matches source files and diff stays doc-only | Missing one stale reference or creating unrelated churn |

**Prerequisites:** Existing `context/changes/fix-readme/change.md`; access to the repo source files used as documentation anchors.
**Estimated effort:** One short implementation session across two phases.

## Open Risks & Assumptions

- Assumption: `context/foundation/tech-stack.md` is the stack source of truth when README and implementation disagree.
- Risk: An implementer may be tempted to list every script in `package.json`; the plan intentionally keeps the README concise.

## Success Criteria (Summary)

- README no longer mentions Drizzle or Next.js 15 as current implementation facts.
- README setup and scripts match `.env.example`, `src/env.js`, and `package.json`.
- `pnpm check` passes and the final diff is limited to README plus change artifacts.
