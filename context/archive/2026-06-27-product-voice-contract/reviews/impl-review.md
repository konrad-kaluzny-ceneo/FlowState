<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Product Voice Contract Implementation Plan

- **Plan**: `context/changes/product-voice-contract/plan.md`
- **Scope**: Phases 1–7 (all automated Progress items complete)
- **Date**: 2026-06-27
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 2 observations
- **Confidence**: 91%

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Automated verification (re-run during review)

| Command | Result |
|---------|--------|
| `pnpm check` | PASS — 402 files, no issues |
| `pnpm test` | PASS — 132 files, 996 tests |
| `set CI=true && pnpm test:e2e:belt` | PASS — 21 passed (~1.2m) |

## Plan drift summary

| Area | Plan intent | Implementation | Verdict |
|------|-------------|----------------|---------|
| `next-intl` + plugin | Single i18n dep, no URL segments | `next.config.js`, `src/i18n/routing.ts` (`localePrefix: "never"`) | MATCH |
| Locale cookie + `Accept-Language` | First-visit detection in `proxy.ts` | `ensureLocaleCookie` composes after auth proxy | MATCH |
| `UserPreference.language` | Prisma migration, tRPC get/set | Migration `20260627120000_add_user_preference_language`, `preference.ts` + tests | MATCH |
| Guest locale storage | Scoped localStorage mirror | `src/lib/language-preference/storage.ts` + tests | MATCH |
| Language switch | User menu next to theme | `HeaderPreferenceControls` → `LanguageSwitch` + theme fieldset | MATCH |
| EN copy migration | Byte-equivalent EN outputs | Copy-module tests + `messages/en.json` | MATCH |
| PL placeholders + F-14 targets | Structural parity; target PL in acceptance zones | `messages-parity.test.ts`, `acceptance-copy.test.ts` | MATCH |
| `product-voice.md` | Promise, tone, checklist, EN+PL | Full contract with §Future-slice acceptance checklist | MATCH |
| E2E belt stabilization | Selectors over brittle text | Belt green after p4/p7 commits | MATCH |
| Phase 3 inline extraction | Full component surface | Deferred list documented in `plan.md` Progress | DRIFT (documented) |

## Findings

### F1 — Phase 3 inline strings partially deferred

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `plan.md` Phase 3 Progress deferred list; overlay shells e.g. `merge-success-overlay.tsx`
- **Detail**: Plan Phase 3 called for broad inline string extraction. Progress notes a deferred batch (overlay shells, some dashboard literals). Several listed files were migrated in p3/p4 (`guest-banner.tsx`, `check-in-overlay.tsx`, `task-fields-panel.tsx`, `session-closure-overlay.tsx` via copy modules), but `merge-success-overlay.tsx` still renders prop-driven copy without direct catalog keys, and the deferred list remains open. `change.md` documents this as non-blocking follow-up — acceptable for F-14 release gate but leaves PL mode showing EN in some overlay chrome until a follow-up slice.
- **Fix**: Track deferred extractions as a small follow-up change (or S-40/S-41 prep) citing `plan.md` deferred list; no blocker for F-14 archive.
- **Decision**: ACCEPTED (documented follow-up in `change.md`)

### F2 — Header chrome strings not in catalogs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/app/_components/user-menu.tsx:27-42`, `src/app/_components/header-preference-controls.tsx:10-14`
- **Detail**: Language switch labels use `Preferences.language` messages, but sign-out button/error strings (`Sign out`, `Signing out…`, `Sign-out failed…`) and theme toggle labels (`Light`, `Dark`, `System`, `Theme` legend) remain hardcoded English. In PL mode the header therefore mixes localized and EN-only chrome.
- **Fix**: Add `Auth.signOut*` / `Preferences.theme.*` keys to both catalogs and wire `useTranslations` in `user-menu.tsx` and `header-preference-controls.tsx`.
- **Decision**: PENDING (non-blocking; belt does not assert header copy)

### F3 — Manual Progress rows unchecked

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `plan.md` Progress §Manual (Phases 1–7)
- **Detail**: All 21 manual verification checkboxes remain `- [ ]`. `change.md` explicitly defers browser locale persistence, visual PL quality, and flow walkthrough to PR/QA. Automated gates and acceptance tests provide strong signal; human confirmation still outstanding before production confidence is complete.
- **Fix**: Complete manual checklist during PR review / QA using steps in plan §Manual Testing Steps.
- **Decision**: ACCEPTED (intentional deferral per `change.md`)

### F4 — Local E2E logs `preference.get` column errors without migration

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: E2E webserver logs during belt run
- **Detail**: Belt passed (21/21), but server logs showed `userPreference.findUnique` failing with missing `language` column when the local Neon/dev DB has not applied `20260627120000_add_user_preference_language`. Migration SQL and Prisma schema are correct; authenticated locale persistence requires `pnpm prisma migrate dev` (or deploy migrate) on each environment.
- **Fix**: Ensure CI/deploy runs Prisma migrate; document in PR that reviewers must migrate before auth locale manual checks.
- **Decision**: ACCEPTED (operator/environment step, not code defect)

## Critical fixes applied

None — no CRITICAL findings identified.

## Overall assessment

F-14 ships the planned bilingual infrastructure (`next-intl`, cookie/`Accept-Language`, preference API, catalogs, language switch) and the durable `product-voice.md` contract with guarded EN/PL acceptance examples. All automated plan Progress items and quality gates pass on `features/product-voice-contract`. Residual risk is limited to documented deferred inline extractions, a few hardcoded header strings, and unchecked manual QA rows — none block archive/merge.
