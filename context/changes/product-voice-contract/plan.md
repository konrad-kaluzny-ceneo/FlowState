# Product Voice Contract Implementation Plan

## Overview

Build F-14 as two clearly separated workstreams: a technical localization workstream that makes English and Polish first-class without changing shipped copy, followed by a product voice workstream that codifies FlowState's bilingual promise, tone, vocabulary, and future-slice acceptance checklist. The slice unlocks S-40 home IA, S-41 desktop workbench copy, and S-42 mindful day memory without letting infrastructure migration blur into copywriting.

## Current State Analysis

- FlowState has no i18n library, no locale routing/defaulting, no Polish UI copy, and a hardcoded `<html lang="en">`.
- User-facing copy is split between test-backed `src/lib/**` copy modules and many inline component/auth/hook strings, including aria labels, placeholders, Zod messages, and calm recovery errors.
- `UserPreference` exists but only stores `cycleEndAudioMode`; guest preferences already use scoped localStorage patterns that can be mirrored for language.
- Existing copy already has a stable voice: calm, clear, trustworthy, short second-person lines, honest accounting, explicit agency, and a signature "fact — reassurance" cadence.
- Polish needs ICU plural categories, locale-aware date/time formatting, and careful length-budget handling for 120-character closure fields.

## Desired End State

FlowState supports `en` and `pl` as first-class locales through `next-intl`, with cookie-based locale selection, first-visit `Accept-Language` defaulting, persisted authed and guest preferences, and a language switch in the user menu next to theme controls. Existing English copy is migrated unchanged into message catalogs, while the Polish catalog is structurally complete with EN-fallback placeholders until the voice workstream fills target PL copy for the F-14 acceptance zones.

`context/foundation/product-voice.md` becomes the durable source of truth for bilingual product language: promise, tone, preferred vocabulary, copy zones, examples/non-examples, the 5-second purpose test, suggestion rationale and recap closure examples in both languages, and an acceptance checklist future slices must cite before changing user-facing copy.

### Key Discoveries:

- Research recommends `next-intl` because the app is client-heavy and Polish pluralization makes a hand-rolled dictionary risky.
- F-14 mandates separate localization architecture and product-copy workstreams.
- `PRODUCT.md` locks the verbal north star as mindful, clear, trustworthy, and "a quiet room, not a productivity dashboard shouting for attention."
- PRD v3 preserves at most one interstitial line plus one gate per transition beat; voice work must choose the winning line, not add more copy surfaces.
- S-21, S-30, F-04, and F-06 are prerequisites whose shipped copy and design constraints should be absorbed rather than reinvented.

## What We're NOT Doing

- S-40 home IA reset, S-41 desktop calm workbench, or S-42 day memory formatter implementation.
- URL-based locale routing or `/en` / `/pl` path segments.
- Translating Neon-auth server error messages; only FlowState-owned Zod and UI error strings are in scope.
- Changing shipped English wording during the localization migration.
- Filling the whole Polish product catalog during infrastructure phases; Phase 1 uses EN-fallback placeholders except where Phase 2 acceptance requires target PL examples.
- Introducing analytics dashboards, gamified language, streak language, productivity-bro vocabulary, or generic wellness platitudes.
- Refactoring wedge conductor logic, scoring behavior, auth flows, timer behavior, or task CRUD beyond text extraction required for localization.

## Decisions (Decision Proxy)

| Decision | Choice | Confidence | Rationale |
| --- | --- | --- | --- |
| i18n library | `next-intl` | 90% | Research shows FlowState needs client component support, ICU plurals for Polish, typed keys, and locale-aware formatting. |
| Locale routing | Cookie-based locale, no URL segments | 90% | The app is an authenticated/product surface, not SEO content; this avoids route churn and matches the requested boundary. |
| Default locale | English fallback, first-visit `Accept-Language` detection in `proxy.ts` | 85% | EN remains the stable baseline while Polish users get a respectful first default when the browser clearly prefers `pl`. |
| Locale persistence | Cookie + `UserPreference.language` for authed users + scoped guest localStorage | 90% | Mirrors existing FlowState preference patterns and keeps guest/auth behavior explicit. |
| Language switch placement | User menu next to theme | 85% | Language is a durable preference, and the existing user-menu/settings area is the least disruptive surface. |
| Phase 1 PL catalog content | EN-fallback placeholders | 85% | Keeps migration as infrastructure-only and avoids smuggling copy decisions into localization work. |
| Polish copy budget | Preserve current DB caps initially; document PL length risk and test critical 120-character zones | 75% | Avoids schema churn in the infrastructure slice unless actual target PL strings prove caps insufficient. |
| Auth errors | Translate FlowState-owned Zod/UI strings only | 90% | Neon server messages are external and not safely controllable in this slice. |
| E2E strategy | Stabilize selectors and run belt after text migration | 85% | Text assertions may break when strings move to catalogs; selectors should carry tests wherever possible. |

## Implementation Approach

Workstream A covers localization architecture: dependency, providers, locale negotiation, persistence, catalog structure, copy extraction, and regression stabilization. Workstream B covers product copy design: `product-voice.md`, target bilingual copy examples, purpose-test strings, rationale and recap closure language, and the future-slice checklist. The boundary is strict: Workstream A moves copy unchanged into resource files; Workstream B decides what the target voice says.

## Critical Implementation Details

**Locale precedence** should be deterministic: explicit language switch wins and persists to cookie plus the appropriate user/guest store; authenticated stored preference wins on later app loads; first-visit detection reads `Accept-Language` only when no locale cookie or stored preference exists; fallback is `en`.

**next-intl request wiring** should be treated as part of the foundation, not an implementation afterthought. The plan depends on three pieces staying aligned: the Next plugin in `next.config.js`, request config that loads `messages/<locale>.json`, and no-prefix routing/proxy logic that can coexist with Neon auth without dropping cookies or redirects.

**Catalog completeness** matters even before target Polish copy exists. Phase 1 should fail loudly on missing keys and keep both `en` and `pl` resources structurally aligned, with PL values intentionally mirroring EN placeholders until the voice workstream owns target wording.

**Selectors over text** should be preferred in tests touched by the migration. Text assertions remain appropriate only where the string itself is the contract, especially copy-module tests and the F-14 voice acceptance examples.

## Phase 1: Localization Foundation

### Overview

Introduce `next-intl`, locale types, message loading, root provider wiring, cookie-based locale negotiation, and persistence contracts without migrating the whole product copy surface yet.

### Changes Required:

#### 1. Dependency and configuration

**Files**: `package.json`, `next.config.js`

**Intent**: Add `next-intl` using pnpm and register the `next-intl` plugin with the existing Next App Router stack.

**Contract**: `next-intl` is the only new i18n dependency; `next.config.js` wraps the existing config with `createNextIntlPlugin`; package scripts remain pnpm-based and existing check/test commands remain unchanged.

#### 2. Locale model and message resources

**Files**: `src/i18n/request.ts`, `src/i18n/routing.ts`, `src/i18n/**`, `messages/en.json`, `messages/pl.json`

**Intent**: Establish the canonical locale set, default locale, cookie name, no-prefix routing config, request-time message loading, message namespaces, and structurally matching EN/PL catalogs.

**Contract**: Supported locales are exactly `en` and `pl`; default locale is `en`; routing uses no URL locale segments (for example `localePrefix: "never"`); request config reads the effective locale from the locale cookie or request headers and loads the matching messages; PL resources exist for every key but may intentionally hold EN-fallback placeholder text until the voice workstream fills target copy.

#### 3. Root layout provider

**File**: `src/app/layout.tsx`

**Intent**: Wrap the application in the i18n provider and derive `<html lang>` and metadata from the active locale.

**Contract**: `NextIntlClientProvider` receives the active locale and messages; `<html lang>` reflects `en` or `pl`; default metadata remains semantically equivalent to today's EN copy until Phase 2 updates target PL wording.

#### 4. Locale negotiation in proxy

**File**: `proxy.ts`

**Intent**: Detect a preferred locale on first visit while preserving the existing Neon auth route-protection behavior.

**Contract**: Locale negotiation only sets/reads the locale cookie and does not redirect or alter URL paths; `Accept-Language` detection is used only when no locale cookie is present; i18n handling runs before auth bypass/redirect decisions so `/`, protected routes, and auth-entry paths can all resolve the same effective locale; any response composition preserves both `next-intl` locale headers/cookies and Neon auth redirects.

#### 5. Authenticated preference storage

**Files**: `prisma/schema.prisma`, `src/server/api/routers/**`, `src/server/api/root.ts`

**Intent**: Persist language for authenticated users in `UserPreference` and expose a typed preference mutation/query through existing tRPC patterns.

**Contract**: Additive `UserPreference.language` field constrained to `en`/`pl` at the application boundary; migration is generated through Prisma, not handwritten SQL.

#### 6. Guest preference storage

**Files**: `src/lib/**-storage.ts`, `src/lib/data-mode/**`

**Intent**: Mirror the theme/audio localStorage pattern for guest locale persistence.

**Contract**: Guest locale storage is scoped and does not merge unrelated preferences; auth users use account-backed preference once available.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- Locale resource files for `en` and `pl` have matching key structure.
- Prisma migration is generated through `pnpm prisma migrate dev` if schema changes are implemented in this phase.

#### Manual Verification:

- First load with no cookie defaults to `en` unless browser language clearly prefers Polish.
- Existing auth route protection still works after `proxy.ts` locale negotiation is added.
- Guest and authenticated sessions render the app without missing translation errors.

**Implementation Note**: Pause after this phase for manual confirmation that locale detection and app boot are stable before migrating large copy surfaces.

---

## Phase 2: Language Switch and Preference Sync

### Overview

Add the user-facing language switch in the user menu next to theme controls and wire it to cookie, authenticated preference, and guest storage.

### Changes Required:

#### 1. User menu language control

**File**: `src/app/_components/user-menu.tsx`

**Intent**: Place a compact EN/PL language switch beside the existing theme/preference controls.

**Contract**: The switch exposes exactly English and Polish choices; it is keyboard accessible, has localized labels/aria text, and updates the active locale without URL changes.

#### 2. Locale preference hook

**Files**: `src/hooks/**`, `src/lib/**`

**Intent**: Centralize locale read/write behavior so components do not each understand cookie, localStorage, and tRPC persistence.

**Contract**: Explicit switch updates cookie immediately, then updates `UserPreference.language` for authenticated users or scoped guest localStorage for guests; failure to persist shows calm UI recovery without losing the active in-memory locale.

#### 3. Preference API tests

**Files**: `src/server/api/routers/**/*.test.ts`, co-located preference tests as applicable

**Intent**: Protect the language preference contract and invalid-locale handling.

**Contract**: Only `en` and `pl` are accepted; invalid values are rejected before persistence; existing preference behavior remains unchanged.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- Preference tests for valid/invalid locale updates pass.
- Component or hook tests prove explicit locale switch updates the active locale and persistence layer.

#### Manual Verification:

- Guest user can switch EN/PL, refresh, and keep the selected locale.
- Authenticated user can switch EN/PL, refresh, sign out/in, and keep the account preference.
- Language switch remains findable in the user menu and does not clutter the timer surface.

**Implementation Note**: Do not start target Polish copywriting here; this phase proves the preference mechanism only.

---

## Phase 3: English Copy Migration and PL Placeholders

### Overview

Move existing user-facing English strings into namespaced message catalogs without changing wording, and keep PL catalog keys aligned with EN-fallback placeholder values.

### Changes Required:

#### 1. Centralized copy modules

**Files**: `src/lib/onboarding/copy.ts`, `src/lib/session/*copy.ts`, `src/lib/catch-up/copy.ts`, `src/lib/guest/merge-copy.ts`, `src/lib/suggestion/override-ack-copy.ts`, `src/lib/scoring/rationale.ts`, `src/lib/scoring/rationale-breakdown.ts`, `src/lib/scoring/persona-trust-clause.ts`

**Intent**: Preserve existing copy-as-contract behavior while making messages translatable and ICU-ready.

**Contract**: Existing exported selectors keep stable behavior or receive an explicit locale/messages dependency; EN outputs remain byte-for-byte equivalent unless tests document a safe punctuation normalization; count-based strings use ICU plurals.

#### 2. Config/data label decoupling

**Files**: `src/lib/design/work-type-config.ts`, `src/lib/task/persona-presets.ts`

**Intent**: Separate translatable display labels from scoring/config data so localization does not couple to behavior.

**Contract**: Behavioral identifiers remain stable; UI labels come from message keys; scoring attributes and Tailwind class mappings do not depend on localized strings.

#### 3. Inline component strings

**Files**: `src/app/_components/**/*.tsx`, `src/app/auth/**/*.tsx`

**Intent**: Extract visible labels, headings, button copy, placeholders, and aria text from high-density UI components into message namespaces.

**Contract**: User-visible EN wording remains unchanged; tests should prefer stable selectors where wording is not itself the contract.

#### 4. FlowState-owned validation and recovery strings

**Files**: `src/app/auth/**/schema.ts`, `src/hooks/use-pomodoro-cycle.ts`, `src/hooks/use-task-mutations.ts`

**Intent**: Localize FlowState-owned Zod/UI validation and recovery strings while leaving external Neon server errors untouched.

**Contract**: Zod/UI messages come from catalogs or locale-aware helpers; server-provided external errors are displayed or mapped only where the app already owns the wording.

#### 5. Locale-sensitive formatting

**Files**: `src/app/_components/daily-recap-panel.tsx`, `src/lib/utils/format-ended-ago.ts`, related formatting helpers

**Intent**: Replace hardcoded `en-GB` and English-only plural formatting with locale-aware formatting.

**Contract**: Date/time and relative/count strings use active locale; Polish plural categories are handled by ICU messages.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- Copy-module tests continue to assert unchanged EN output for migrated strings.
- Catalog key parity check passes for `en` and `pl`.

#### Manual Verification:

- Core guest and authenticated timer flows show no missing keys.
- EN app copy reads the same as before migration.
- PL mode is structurally complete but may display intentional EN fallback placeholders for not-yet-authored target copy.

**Implementation Note**: Treat any wording improvement temptation as Workstream B voice work, not this migration phase.

---

## Phase 4: Localization Regression Belt

### Overview

Stabilize test coverage and E2E assertions after large text extraction, especially where tests previously depended on inline English text.

### Changes Required:

#### 1. Unit and component test updates

**Files**: co-located `*.test.ts` and `*.test.tsx` files touched by migrated copy

**Intent**: Update tests to use message-aware helpers or stable selectors while preserving copy-contract assertions where copy is the behavior.

**Contract**: Tests do not become brittle by asserting translated UI text unless the string is the product contract being verified.

#### 2. E2E belt selector stabilization

**Files**: `e2e/**/*.spec.ts`, UI components that need stable test ids or accessible names

**Intent**: Keep the belt reliable across EN/PL locales and catalog-backed text.

**Contract**: Critical flow selectors use roles/test ids where appropriate; any remaining text assertions are intentionally tied to EN baseline or F-14 voice acceptance examples.

#### 3. Full verification pass

**Files**: no dedicated source file unless tests require selector hooks

**Intent**: Run the standard FlowState quality gates after the i18n workstream.

**Contract**: Commands follow AGENTS.md: `pnpm check`, `pnpm typecheck`, `pnpm test`, and `set CI=true && pnpm test:e2e:belt`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `set CI=true && pnpm test:e2e:belt` passes.

#### Manual Verification:

- Locale switch does not break critical guest/auth timer paths.
- No visible raw message keys appear in the main app, auth forms, timer overlays, or recap surfaces.
- Accessibility labels remain meaningful in EN and structurally present in PL mode.

**Implementation Note**: This is the release gate for Workstream A before target voice work starts.

---

## Phase 5: Product Voice Contract

### Overview

Author the durable bilingual product voice contract in `context/foundation/product-voice.md`, grounded in `PRODUCT.md`, PRD v3, research findings, and shipped copy exemplars.

### Changes Required:

#### 1. Voice contract document

**File**: `context/foundation/product-voice.md`

**Intent**: Create the authoritative FlowState voice reference for both future copywriting and implementation review.

**Contract**: Document includes promise, tone, preferred vocabulary, avoided vocabulary, copy zones, examples/non-examples, EN and PL guidance, and references to F-14 lineage.

#### 2. 5-second purpose test

**File**: `context/foundation/product-voice.md`

**Intent**: Define the maintainer test that every primary surface should answer quickly: "what does this app help me decide?"

**Contract**: Accepted answers are "what to do next" and "co teraz"; the document includes short EN and PL strings that support this without turning into a hero rewrite for S-40.

#### 3. Transition beat voice rule

**File**: `context/foundation/product-voice.md`

**Intent**: Encode the one interstitial line plus one gate rule as a copy constraint.

**Contract**: Future copy must choose a single winning line per beat and must not add stacked reassurance, rationale, narrative, and gate copy to the same transition.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes after markdown/doc changes.
- `context/foundation/product-voice.md` exists and includes EN and PL sections.
- The document contains a future-slice acceptance checklist.

#### Manual Verification:

- The contract reads consistently with `PRODUCT.md`: mindful, clear, trustworthy, restrained.
- The 5-second purpose test is explicit in both EN and PL.
- Examples and non-examples make it hard to accidentally write gamified, punitive, or generic wellness copy.

**Implementation Note**: This phase is product/copy specialization, not infrastructure. It should not introduce broad catalog rewrites beyond documenting the contract.

---

## Phase 6: Target Bilingual Acceptance Copy

### Overview

Fill the F-14 target copy acceptance zones in both languages: suggestion rationale, recap closure done/remains/return-to language, and purpose-test copy strings.

### Changes Required:

#### 1. Suggestion rationale target examples

**Files**: `context/foundation/product-voice.md`, `messages/en.json`, `messages/pl.json`, `src/lib/scoring/rationale.ts`

**Intent**: Provide calm rationale examples in EN and target PL that future suggestion surfaces can cite.

**Contract**: First suggestion rationale remains one line, explains why calmly, and preserves override freedom; PL strings are no longer EN placeholders for the acceptance examples.

#### 2. Recap closure target examples

**Files**: `context/foundation/product-voice.md`, `messages/en.json`, `messages/pl.json`, `src/lib/session/narrative-copy.ts`, `src/lib/session/narrative-builder.ts`

**Intent**: Define done/remains/return-to closure language for both EN and PL while respecting recap-vs-narrative boundaries.

**Contract**: EN and PL examples cover done, remains, and return-to; Polish labels include `Domknięte`, `Zostaje`, and `Wróć tutaj`; generated closure text respects existing length budgets or documents a follow-up if the budget proves too tight.

#### 3. Purpose-test strings

**Files**: `context/foundation/product-voice.md`, `messages/en.json`, `messages/pl.json`

**Intent**: Add the bilingual strings that future S-40/S-41/S-42 work can reuse or cite.

**Contract**: Strings support "what to do next / co teraz" without implementing the S-40 home IA surface in this slice.

#### 4. Voice acceptance tests

**Files**: co-located copy tests for rationale/recap modules as appropriate

**Intent**: Guard the target acceptance examples from accidental drift.

**Contract**: Tests assert the F-14 acceptance examples render in both locales and remain within relevant one-line/length constraints.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- Copy tests verify EN and PL target acceptance examples for rationale and recap closure.

#### Manual Verification:

- First suggestion rationale reads calm and non-punitive in both EN and PL.
- Recap closure language covers done, remains, and return-to in both languages.
- PL copy sounds like FlowState, not a literal machine translation of English.

**Implementation Note**: Limit catalog target-copy work to F-14 acceptance zones unless a nearby string must change to keep a complete sentence grammatical.

---

## Phase 7: Future-Slice Checklist and Release Verification

### Overview

Close the slice by making the voice contract operational for future work, updating change references as needed, and running the full release gate.

### Changes Required:

#### 1. Future-slice acceptance checklist

**File**: `context/foundation/product-voice.md`

**Intent**: Give S-40, S-41, S-42, and later slices a concise checklist they must cite before changing user-facing copy.

**Contract**: Checklist covers locale key parity, EN/PL copy ownership, one-line rationale constraints, recap closure vocabulary, 5-second purpose test, non-example avoidance, and transition-beat budget.

#### 2. Context references

**Files**: `context/foundation/roadmap-references/items/F-14.md`, `context/foundation/roadmap.md`, `context/foundation/lessons.md` if a durable lesson is discovered

**Intent**: Keep roadmap/context artifacts aligned with the shipped voice foundation.

**Contract**: Only update status/references needed by this slice; do not create duplicate tracker issues or alter unrelated roadmap items.

#### 3. Final verification

**Files**: no dedicated source file unless verification exposes a small fix

**Intent**: Prove the localization and voice workstreams hold together before handoff.

**Contract**: Run the standard gates and verify both locales manually on the critical surfaces touched by F-14.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `set CI=true && pnpm test:e2e:belt` passes.

#### Manual Verification:

- `context/foundation/product-voice.md` is actionable for a future implementer without reading this plan.
- EN and PL can be selected, persisted, and rendered through critical app flows.
- F-14 acceptance bullets are all satisfied and documented in the implementation summary.

**Implementation Note**: If final PL copy reveals unavoidable schema-length changes, document that as a follow-up unless acceptance examples cannot fit.

---

## Testing Strategy

### Unit Tests:

- Locale preference validation accepts only `en` and `pl`.
- Message catalog key parity between EN and PL.
- Copy module migrations preserve existing EN strings during infrastructure phases.
- ICU plural examples cover English and Polish count categories for merge/recap/ended-ago strings.
- Voice acceptance examples render one-line rationale and recap closure copy in both locales.

### Component Tests:

- User menu language switch renders accessibly and updates locale state.
- High-density UI components render translated labels without raw message keys.
- Auth form validation renders FlowState-owned localized messages.
- Timer/recap/suggestion surfaces preserve accessible labels after string extraction.

### Integration Tests:

- Authenticated language preference persists through account-backed `UserPreference`.
- Guest language preference persists through scoped localStorage.
- Explicit language switch updates cookie and active locale without URL path changes.
- Locale detection does not regress Neon auth route protection in `proxy.ts`.

### E2E Belt:

- Run `set CI=true && pnpm test:e2e:belt` after selector/text assertion updates.
- Prefer selectors over visible text unless the test is explicitly asserting F-14 copy acceptance.

### Manual Testing Steps:

1. Clear locale cookie/localStorage, set browser language to English, and confirm first load uses EN.
2. Clear locale cookie/localStorage, set browser language to Polish, and confirm first load chooses PL when no explicit preference exists.
3. Switch language as guest, refresh, and confirm persistence.
4. Switch language as authenticated user, refresh/sign out/sign in, and confirm account persistence.
5. Walk the core timer flow in EN and PL modes: task list, timer panel, suggestion card, transition overlays, recap, and auth forms.
6. Read `context/foundation/product-voice.md` against `PRODUCT.md` and confirm the voice contract preserves calm, focused, restrained language.

## Performance Considerations

- Scope client messages by namespace where possible to avoid shipping unnecessary catalog data to every client component.
- Locale detection in `proxy.ts` should be simple cookie/header parsing and must not add network calls.
- Preference writes should not block immediate UI feedback; the active locale can update optimistically with calm recovery if persistence fails.
- PL strings may be longer; verify critical 120-character closure and resume-note zones before considering schema changes.

## Migration Notes

- Add `UserPreference.language` through Prisma migration tooling only.
- Existing users without a stored language fall back to cookie/default behavior; no backfill is required unless the implementation chooses a non-null DB default.
- Existing EN copy remains the source of truth during Workstream A; PL placeholders intentionally mirror EN until Workstream B target copy is accepted.
- External Neon auth errors are not translated in this slice.

## References

- Related research: `context/changes/product-voice-contract/research.md`
- Change brief: `context/changes/product-voice-contract/change.md`
- Roadmap item: `context/foundation/roadmap-references/items/F-14.md`
- Product voice source: `PRODUCT.md`
- PRD voice constraints: `context/foundation/prd.md`
- Lessons: `context/foundation/lessons.md`
- Progress format: `d:\repos\10xdev\private-skills\.cursor\skills\10x-plan\references\progress-format.md`
- Reference plan: `context/archive/2026-06-21-mindful-transition-copy/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Localization Foundation

#### Automated

- [x] 1.1 `pnpm check` passes. — 6259626
- [x] 1.2 `pnpm typecheck` passes. — 6259626
- [x] 1.3 Locale resource files for `en` and `pl` have matching key structure. — 6259626
- [x] 1.4 Prisma migration is generated through `pnpm prisma migrate dev` if schema changes are implemented in this phase. — 6259626

#### Manual

- [ ] 1.5 First load with no cookie defaults to `en` unless browser language clearly prefers Polish.
- [ ] 1.6 Existing auth route protection still works after `proxy.ts` locale negotiation is added.
- [ ] 1.7 Guest and authenticated sessions render the app without missing translation errors.

### Phase 2: Language Switch and Preference Sync

#### Automated

- [x] 2.1 `pnpm check` passes. — 64db07c
- [x] 2.2 `pnpm typecheck` passes. — 64db07c
- [x] 2.3 Preference tests for valid/invalid locale updates pass. — 64db07c
- [x] 2.4 Component or hook tests prove explicit locale switch updates the active locale and persistence layer. — 64db07c

#### Manual

- [ ] 2.5 Guest user can switch EN/PL, refresh, and keep the selected locale.
- [ ] 2.6 Authenticated user can switch EN/PL, refresh, sign out/in, and keep the account preference.
- [ ] 2.7 Language switch remains findable in the user menu and does not clutter the timer surface.

### Phase 3: English Copy Migration and PL Placeholders

#### Automated

- [x] 3.1 `pnpm check` passes. — 835255b
- [x] 3.2 `pnpm typecheck` passes. — 835255b
- [x] 3.3 `pnpm test` passes. — 835255b
- [x] 3.4 Copy-module tests continue to assert unchanged EN output for migrated strings. — 835255b
- [x] 3.5 Catalog key parity check passes for `en` and `pl`. — 835255b

#### Manual

- [ ] 3.6 Core guest and authenticated timer flows show no missing keys.
- [ ] 3.7 EN app copy reads the same as before migration.
- [ ] 3.8 PL mode is structurally complete but may display intentional EN fallback placeholders for not-yet-authored target copy.

**Phase 3 deferred (inline strings — Phase 4 belt):** `task-fields-panel.tsx` (horizon/axis labels), `guest-banner.tsx`, `check-in-overlay.tsx` (heading/body), `energy-selector.tsx`, `focus-budget-prompt.tsx`, `break-alerts-permission-prompt.tsx`, `kickoff-duration-chips.tsx`, `duration-picker.tsx`, `session-closure-overlay.tsx`, `merge-success-overlay.tsx`, `pomodoro-dashboard.tsx` (steering card strings already in SessionSteering namespace but overlay shells may retain literals).

### Phase 4: Localization Regression Belt

#### Automated

- [x] 4.1 `pnpm check` passes. — c60c558
- [x] 4.2 `pnpm typecheck` passes. — c60c558
- [x] 4.3 `pnpm test` passes. — c60c558
- [x] 4.4 `set CI=true && pnpm test:e2e:belt` passes. — c60c558

#### Manual

- [ ] 4.5 Locale switch does not break critical guest/auth timer paths.
- [ ] 4.6 No visible raw message keys appear in the main app, auth forms, timer overlays, or recap surfaces.
- [ ] 4.7 Accessibility labels remain meaningful in EN and structurally present in PL mode.

### Phase 5: Product Voice Contract

#### Automated

- [x] 5.1 `pnpm check` passes after markdown/doc changes. — 122cb71
- [x] 5.2 `context/foundation/product-voice.md` exists and includes EN and PL sections. — 122cb71
- [x] 5.3 The document contains a future-slice acceptance checklist. — 122cb71

#### Manual

- [ ] 5.4 The contract reads consistently with `PRODUCT.md`: mindful, clear, trustworthy, restrained.
- [ ] 5.5 The 5-second purpose test is explicit in both EN and PL.
- [ ] 5.6 Examples and non-examples make it hard to accidentally write gamified, punitive, or generic wellness copy.

### Phase 6: Target Bilingual Acceptance Copy

#### Automated

- [x] 6.1 `pnpm check` passes. — 0e280c2
- [x] 6.2 `pnpm typecheck` passes. — 0e280c2
- [x] 6.3 `pnpm test` passes. — 0e280c2
- [x] 6.4 Copy tests verify EN and PL target acceptance examples for rationale and recap closure. — 0e280c2

#### Manual

- [ ] 6.5 First suggestion rationale reads calm and non-punitive in both EN and PL.
- [ ] 6.6 Recap closure language covers done, remains, and return-to in both languages.
- [ ] 6.7 PL copy sounds like FlowState, not a literal machine translation of English.

### Phase 7: Future-Slice Checklist and Release Verification

#### Automated

- [ ] 7.1 `pnpm check` passes.
- [ ] 7.2 `pnpm typecheck` passes.
- [ ] 7.3 `pnpm test` passes.
- [ ] 7.4 `set CI=true && pnpm test:e2e:belt` passes.

#### Manual

- [ ] 7.5 `context/foundation/product-voice.md` is actionable for a future implementer without reading this plan.
- [ ] 7.6 EN and PL can be selected, persisted, and rendered through critical app flows.
- [ ] 7.7 F-14 acceptance bullets are all satisfied and documented in the implementation summary.
