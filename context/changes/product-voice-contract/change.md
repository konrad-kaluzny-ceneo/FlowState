---
change_id: product-voice-contract
title: Product voice contract (bilingual EN/PL foundation + voice.md)
status: implemented
created: 2026-06-27
updated: 2026-06-27
archived_at: null
---

## Notes

F-14 foundation slice. Two clearly separated workstreams (see `context/foundation/roadmap-references/items/F-14.md`):

- **Workstream A — bilingual EN/PL system (i18n infrastructure):** `next-intl`, cookie + `Accept-Language` defaulting, `UserPreference.language` + guest localStorage, user-menu EN/PL switch, EN copy migrated unchanged into `messages/en.json`, structurally aligned `messages/pl.json` with EN-fallback placeholders except F-14 acceptance zones.
- **Workstream B — voice contract:** `context/foundation/product-voice.md` (promise, tone, vocabulary, copy zones, examples/non-examples, EN + PL) + future-slice acceptance checklist.

Trackers: [FLO-93](https://linear.app/flowstate-10xdev/issue/FLO-93/flowstate-product-voice-contract-f-14) / [#171](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/171).

### F-14 implementation summary

| Acceptance bullet | Status | Evidence |
| --- | --- | --- |
| EN + PL first-class locales | Done | `next-intl`, `messages/en.json` + `messages/pl.json`, locale hook + preference API |
| Translation resource structure | Done | Namespaced catalogs; key parity tests |
| Explicit language defaulting + switch | Done | `proxy.ts` cookie/`Accept-Language`; user menu next to theme |
| Phase 1 copy migration without wording changes | Done | EN outputs preserved in copy-module tests (p3) |
| `product-voice.md` contract | Done | `context/foundation/product-voice.md` |
| 5-second purpose test (what to do next / co teraz) | Done | §5-second purpose test; `Home.purposeHeader` in both locales |
| Calm first-suggestion rationale EN + PL | Done | `Scoring.rationale.*` target copy + `acceptance-copy.test.ts` |
| Recap closure done / remains / return-to EN + PL | Done | `DayMemory.*` labels + collapsed line; narrative-copy tests |
| Future-slice acceptance checklist | Done | §Future-slice acceptance checklist in `product-voice.md` |
| Separate localization vs copy workstreams | Done | Phases 1–4 infra; Phases 5–7 voice |

**Manual verification (deferred to PR/QA):** Phases 1–7 manual Progress rows remain unchecked in `plan.md` — browser locale persistence, visual PL quality, and end-to-end flow walkthrough require human confirmation outside automated gates.

**Follow-up (non-blocking):** Phase 3 noted deferred inline string extractions in overlay shells (`plan.md` Phase 3 deferred list); PL length budgets on 120-char closure fields documented in voice contract — no schema change required for acceptance examples.

## Artifacts

- `research.md` — codebase research (i18n state, full string inventory, voice source material, i18n recommendation).
- `plan.md` — approved implementation plan.
- `plan-brief.md` — concise implementation handoff.
- `reviews/plan-review.md` — approved plan review with auto-triaged warning fixes.

## Handoff

Shipped on `features/product-voice-contract`. Next: `/10x-archive product-voice-contract` after PR merge; unlocks S-40, S-41, S-42 (cite `product-voice.md` checklist before copy changes).
