<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fix MCP Integrations Tab Stale Placeholder

- **Plan**: context/changes/fix-mcp-integrations-tab-stale-placeholder/plan.md
- **Scope**: Phase 1 + 2 (full plan, both phases complete)
- **Date**: 2026-07-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Ran `pnpm exec vitest run src/app/_components/ustawienia-view.test.tsx` — 12/12 pass.
- Ran `pnpm typecheck` — clean.
- Ran `pnpm check` — clean on all changed files (pre-existing warnings in unrelated files, e.g. `use-pomodoro-cycle.test.tsx`, are out of scope).
- Repo-wide grep for `mcpComingSoon|mcpMock|McpIntegrationMock|settings-mcp-preview` under `src/`, `messages/` — only hit is the expected negative-assertion test (`queryByTestId("settings-mcp-preview")).toBeNull()`), confirming the stale mock is fully gone.
- Verified `mcpConfigSnippet` in `api-keys-panel.tsx:133-144` hardcodes the literal `"Bearer YOUR_API_KEY"` string with zero reference to `revealedKey` — a live key can never leak into the copyable config snippet, even while a key is actively revealed. Matches the plan's "Critical Implementation Details" security rule.
- Verified `origin` state is populated only inside `useEffect` (`api-keys-panel.tsx:75-77`), never read during render — no hydration mismatch, matching the plan's stated approach.
- Verified locale parity: all 7 new `Settings.apiKeys` keys (`setupTitle`, `setupIntro`, `endpointLabel`, `authLabel`, `toolsReadLabel`, `toolsWriteLabel`, `configLabel`) present in both `messages/en.json` and `messages/pl.json`, with the `YOUR_API_KEY` placeholder token byte-identical (untranslated) in both.
- Scope guardrails respected: no changes to `src/app/api/mcp` or the `apiKey` router; only one generic `mcpServers` JSON snippet (no per-client variants); no locale-parity test/lint added; guest view unchanged (still shows only the sign-in prompt).
- Epilogue commit `3f81c78` confirmed as pure bookkeeping (`change.md` status flip + `plan.md` Progress checkbox annotations) — no source touched.
- `git diff 3a67de7..3f81c78 --stat` shows exactly the 9 files expected (4 change-folder docs + 5 planned source/locale files) — no scope creep.

## Findings

### F1 — Phase 1 test repurposed instead of deleted

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/app/_components/ustawienia-view.test.tsx:212-225
- **Detail**: Plan said to delete the old "renders MCP coming soon preview" test outright ("it will be superseded by the Phase 2 test"). Instead it was renamed to "renders integrations panel without the stale MCP preview" and repurposed into a negative-assertion guard (`queryByTestId("settings-mcp-preview")).toBeNull()`). This is a stronger regression guard than the plan literally asked for — not a defect.
- **Fix**: None needed. Leaving the negative-assertion guard in place is arguably better than deleting it outright.
- **Decision**: ACCEPTED (no fix needed) — user chose "Save report only", no triage requested.

### F2 — No visible feedback on clipboard-copy failure

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/api-keys-panel.tsx:146-153
- **Detail**: `handleCopyConfig` (mirroring the pre-existing `handleCopy`) silently swallows `navigator.clipboard.writeText` rejection with only a code comment — no error state shown to the user. Pre-existing pattern in this file, not a regression introduced by this change.
- **Fix**: None needed for this PR; only worth revisiting if clipboard failures become a real user complaint.
- **Decision**: ACCEPTED (no fix needed) — user chose "Save report only", no triage requested.
