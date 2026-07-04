# Status Vocabulary Unification — Plan Brief

> Full plan: `context/changes/status-vocabulary-unification/plan.md`
> Research: `context/changes/mvp-defect-intake/research.md`

## What & Why

Fix wave 4 (**D-10**): one consistent Polish status vocabulary across the app — **Ukończone** / **Aktywne** / **Zarchiwizowane** — matching the task list. The S-42 “zoned” day-memory labels (Domknięte, Zostaje, Zrobione, otwarte) are unieważnione per product decision 2026-07-03.

## Starting Point

Task list already uses `Aktywne ({count})` and `Ukończone ({count})` in `pl.json`. Day-memory, recap, home focus summary, and session narrative still use the old S-42 vocabulary. `product-voice.md` F-14 acceptance examples still document Domknięte / Zostaje. Tests lock exact PL strings in `acceptance-copy.test.ts` and `format-day-memory.test.ts`.

## Desired End State

All Polish status surfaces say Ukończone or Aktywne (or Zarchiwizowane where already correct). Contract amended. No runtime code changes — catalog + tests only. Full `pnpm test` green.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Canonical PL terms | Ukończone / Aktywne / Zarchiwizowane | Matches existing task-list headers | Register |
| Secondary keys | Include HomeFocusSummary, Recap, Session.narrative | Full app consistency per D-10 “jedna terminologia” | Research |
| EN catalog | No changes | PL-only defect | Register |
| Runtime code | No TS edits | All strings i18n-driven | Research |
| Return-to label | Keep Wróć tutaj | Not in banned list | Plan |
| Phase order | Contract → pl.json → tests → verify | Contract is source of truth before catalog | Plan |

## Scope

**In scope:** `product-voice.md`, `messages/pl.json` (10 keys across 4 namespaces), `acceptance-copy.test.ts`, `format-day-memory.test.ts`, manual PL verification.

**Out of scope:** `en.json`, TypeScript components, e2e specs, archive/roadmap doc rewrites, other defect waves.

## Architecture / Approach

Pure copy unification: amend the voice contract, batch-update `pl.json` keys, sync test oracles, run gates. Runtime formatters (`format-day-memory.ts`, `narrative-copy.ts`) consume keys automatically — no wiring changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contract amendment | product-voice.md unified vocabulary | Missing a checklist/example row |
| 2. pl.json catalog | All 10 keys updated | Awkward plural grammar in HomeFocusSummary |
| 3. Test oracles | acceptance + format-day-memory tests | Drift between catalog and test expected strings |
| 4. Verification | Full test + manual PL pass | Missed grep in unrelated pl.json key |

**Prerequisites:** Wave 2 layout stabilized (done); independent of waves 1/3/5.
**Estimated effort:** ~1 session (four small phases; no code logic).

## Open Risks & Assumptions

- Assumes “Zostało:” prefix in collapsed lines becomes “Aktywne:” (not merely section label change) — aligns `{remaining}` slot with active-work count wording.
- `HomeFocusSummary.budgetLine` uses “zostało” as quantity — intentionally out of scope.
- Historical archive docs still cite Domknięte/Zostaje — acceptable; only live contract + catalog updated.

## Success Criteria (Summary)

- PL day-memory, recap, and focus summary use Ukończone/Aktywne consistently with the task list.
- `product-voice.md` documents the amendment.
- `pnpm test` green; manual PL pass confirms no mixed terminology on home.
