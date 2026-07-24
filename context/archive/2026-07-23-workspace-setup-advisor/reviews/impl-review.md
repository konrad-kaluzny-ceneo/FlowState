<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Workspace Setup Advisor

- **Plan**: context/changes/workspace-setup-advisor/plan.md
- **Scope**: Full plan (Phases 1–4 of 4)
- **Date**: 2026-07-24
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated Verification

- `vitest` (6 files / 27 tests) — PASS
- `tsc --noEmit` — PASS
- `biome check` (14 files) — clean
- `playwright e2e/workspace-setup-advisor.spec.ts` — 1 passed (41s incl. server start, `@skip-belt`)

Manual criteria (Progress 1.4–1.5, 2.3–2.5, 3.3–3.4, 4.3–4.4) remain pending by design — Phase 1's Implementation Note pauses for human manual confirmation. Acknowledged as legitimately pending, not missing evidence.

## Findings

### F1 — Nudge aria-label duplicates its own visible text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/app/_components/workspace-setup-nudge.tsx:20
- **Detail**: The `<aside>` set `aria-label={body}` while also rendering the same string in `<p>{body}</p>`, so a screen reader announced the calm one-liner twice.
- **Fix**: Replaced `aria-label` with `aria-labelledby="workspace-nudge-body"` pointing at the `<p>` (added matching `id`).
- **Decision**: FIXED

### F2 — Guide URLs flow to href with no scheme allow-list

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (security, defense-in-depth)
- **Location**: src/app/_components/workspace-setup-checklist.tsx:35
- **Detail**: `guideUrl` came from the i18n catalog and was written straight into the anchor href with only a non-empty check. Current values are hardcoded HTTPS vendor-doc constants with `rel="noopener noreferrer"` + `target="_blank"`, so today's risk was nil, but there was no scheme guard against a future translator inserting `javascript:`/`data:`.
- **Fix**: `tipGuideUrl` now returns the URL only when it `startsWith("https://")` (subsumes the old length check).
- **Decision**: FIXED

### F3 — Stored `v` version field is written but never read

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (data safety / forward-compat)
- **Location**: src/lib/workspace-setup-advisor/storage.ts:11,56
- **Detail**: `persistState` writes `{ v: 1, ... }` but `parseStoredState` never reads `v`; there is no version-keyed migration branch. Forward-compat rests on `filterKnownTipIds` + boolean coercion — adequate for v1 and already more robust than the break-alerts reference (no version field at all). The field is inert today.
- **Fix**: None — v1 is correct. Add a version-keyed branch in `parseStoredState` deliberately when a v2 shape lands.
- **Decision**: SKIPPED
