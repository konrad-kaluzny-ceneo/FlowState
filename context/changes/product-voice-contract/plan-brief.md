# Product Voice Contract — Plan Brief

> Full plan: `context/changes/product-voice-contract/plan.md`
> Research: `context/changes/product-voice-contract/research.md`

## What & Why

F-14 gives FlowState a bilingual EN/PL language foundation and a durable product voice contract. The reason is practical: future slices need to answer "what to do next / co teraz" consistently without each feature inventing its own localization and copy style.

## Starting Point

There is no i18n today: no library, no locale defaulting, no Polish copy, and `<html lang="en">` is hardcoded. The app does have a strong implicit voice already, spread across copy modules and inline UI strings: calm, restrained, agency-preserving, and non-gamified.

## Desired End State

English and Polish are first-class locales through `next-intl`, with plugin/request-config wiring, no-prefix cookie-based locale selection, first-visit `Accept-Language` detection, stored authenticated and guest preferences, and a language switch in the user menu. Existing English copy is migrated unchanged into catalogs, while target PL copy is added only through the product voice workstream. `context/foundation/product-voice.md` becomes the contract future slices cite before changing user-facing copy.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| i18n library | `next-intl` | ICU plurals, client component support, typed keys, and locale formatting fit FlowState better than a hand-rolled dictionary. | Research / Plan |
| Locale routing | Cookie-based, no URL segments | FlowState is an app surface, not SEO content, so route churn is unnecessary. | User / Research |
| Default locale | EN fallback with first-visit `Accept-Language` detection | EN stays the stable baseline while Polish users get a respectful first default. | User / Plan |
| Preference persistence | Cookie + `UserPreference.language` + scoped guest localStorage | Mirrors existing theme/preference patterns across auth and guest modes. | User / Research |
| Language switch | User menu next to theme | Durable preference belongs near existing user controls, not in the timer flow. | User / Plan |
| Workstream boundary | Localization architecture first, target copy second | Prevents copywriting decisions from being smuggled into migration work. | F-14 / User |
| PL Phase 1 content | EN-fallback placeholders | Ensures catalog completeness while reserving real PL wording for the voice contract. | User / Plan |
| E2E strategy | Belt phase after selector/text updates | Text extraction can break brittle assertions; selectors should carry critical flows. | Plan |

## Scope

**In scope:**

- `next-intl` setup for EN and PL.
- Translation resource structure and catalog key parity.
- Cookie defaulting, `Accept-Language` first-visit detection, authenticated preference, and guest localStorage preference.
- User-menu language switch.
- Existing EN copy migration unchanged, with PL placeholders during infrastructure work.
- `context/foundation/product-voice.md` with bilingual promise, tone, vocabulary, examples/non-examples, purpose test, and future-slice checklist.
- Bilingual target examples for suggestion rationale and recap closure.

**Out of scope:**

- S-40 home IA, S-41 desktop workbench, or S-42 day memory formatter implementation.
- URL-based locale routing.
- Translating Neon auth server errors.
- Broad target PL translation during infrastructure phases.
- Timer/scoring/wedge/auth behavior changes beyond copy extraction.

## Architecture / Approach

The plan is split into two F-14 workstreams. Workstream A adds localization infrastructure, including `next.config.js`, `src/i18n/request.ts`, no-prefix routing/proxy composition, preference persistence, catalog structure, copy extraction, and regression stabilization. Workstream B authors the product voice contract and fills only the F-14 target bilingual copy zones. The boundary is strict: moving existing English copy is infrastructure; deciding target English/Polish wording is product copy design.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Localization Foundation | `next-intl`, locales, provider, proxy defaulting, persistence contracts | Breaking app boot or auth middleware while adding locale negotiation |
| 2. Language Switch and Preference Sync | User-menu EN/PL switch with cookie/auth/guest persistence | Preference precedence bugs between cookie, account, and guest storage |
| 3. English Copy Migration and PL Placeholders | Existing strings moved into catalogs unchanged | Accidental wording drift or missed aria/placeholder/error strings |
| 4. Localization Regression Belt | Tests and E2E selectors stabilized | Brittle text assertions masking real localization regressions |
| 5. Product Voice Contract | `context/foundation/product-voice.md` | Contract too vague to guide future slices |
| 6. Target Bilingual Acceptance Copy | Purpose, rationale, and recap closure examples in EN/PL | PL copy feels literal or exceeds tight closure budgets |
| 7. Future-Slice Checklist and Release Verification | Operational checklist and full release gate | Acceptance not clearly traceable to F-14 |

**Prerequisites:** Existing branch/change folder, F-14 research complete, S-21/S-30/F-04/F-06 context available.
**Estimated effort:** ~7 shippable phases; likely several focused implementation sessions because copy migration touches many surfaces.

## Open Risks & Assumptions

- Polish copy may stress existing 120-character closure/resume-note budgets; the plan preserves schema caps unless acceptance examples cannot fit.
- Catalog migration touches many client components, so missing aria labels/placeholders are a real risk.
- Auth server errors from Neon remain external; only FlowState-owned validation and UI messages are localized.
- `next-intl` adoption assumes the team accepts one runtime dependency to avoid hand-rolled pluralization and formatting.

## Success Criteria (Summary)

- Users can choose EN or PL, and the choice persists correctly for guest and authenticated modes without URL locale segments.
- Existing EN copy remains unchanged through infrastructure migration, with no visible raw keys or missing translations.
- `context/foundation/product-voice.md` defines the bilingual FlowState voice and checklist future slices must cite before changing copy.
