# Auth Narrative and Guest-Merge Success Handoff (S-14) — Plan Brief

> Full plan: `context/changes/auth-merge-first-impression/plan.md`
> Research: `context/changes/auth-merge-first-impression/research.md`

## What & Why

S-08 merged guest work silently — users couldn't tell their trial data survived sign-in. S-14 completes FR-003c's UX half and adds pre-auth value narrative so sign-in/sign-up pages explain FlowState's mindful Pomodoro wedge (energy check-ins, session-aware suggestions) before credentials, and post-auth users see an explicit merge-success moment instead of a quiet import.

## Starting Point

Auth pages are forms-only on the dark gradient. `GuestImportOnMount` returns counts from the server action but discards them client-side; only failures show UI. S-11 shipped `FirstRunOverlay` with `shouldDeferFirstRun()` stubbed to `hasGuestData()` only — after blob clear, first-run can beat merge acknowledgment to the screen.

## Desired End State

Sign-in gets a minimal value subtitle; sign-up gets a fuller value block in a card wrapper aligned with sign-in. After guest→auth merge with importable data, a `z-[55]` modal shows task/cycle counts, up to three preview titles from the pre-clear snapshot, unlock copy, and **Continue** dismiss. First-run stays hidden while guest blob exists, import runs, or merge-success is visible — then may appear after Continue.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|------------------|--------|
| Merge-success surface | Modal at `z-[55]` (mirror FirstRunOverlay) | Matches existing overlay pattern; explicit acknowledgment beats toast | Proxy / Research |
| Auth narrative scope | Both sign-in and sign-up | Sign-in minimal subtitle; sign-up fuller block — meets FR-001/002 without bloating returning-user sign-in | Proxy / Research |
| Merge CTA | Continue dismiss only | MVP handoff; no scroll-to-task-list in this slice | Proxy |
| Title preview | Counts + up to 3 titles from pre-import snapshot | Names imported work; avoids post-merge suffix confusion | Proxy / Research |
| First-run defer | OR: guest blob \| import in-flight \| merge-success visible | S-11 coordination — merge-success always wins timing | Proxy / Research |
| Zero-import merge | Skip modal when both counts are 0 | Nothing meaningful to confirm; avoids empty celebration | Plan |
| Copy location | `merge-copy.ts` + extend `onboarding/copy.ts` | Pure helpers testable; auth strings centralized | Plan |

## Scope

**In scope:**
- `src/lib/guest/merge-copy.ts` + tests
- Extended `src/lib/onboarding/defer.ts` + tests; hook subscription update
- `MergeSuccessOverlay`, `GuestMergeUiProvider`, `GuestImportOnMount` wiring
- `AuthValueNarrative` on sign-in/sign-up pages
- E2E `merge-success-on-sign-in.spec.ts` + helper updates

**Out of scope:**
- Review-tasks CTA / scroll behavior
- Server merge logic changes, analytics, OAuth flow changes
- Auth visual polish beyond sign-up card alignment (S-12)
- test-plan §6 cookbook update

## Architecture / Approach

```
/auth/* → AuthValueNarrative (pre-auth copy, FR-001/002)

HomeShell
  OnboardingProvider → useOnboardingState (defer via shouldDeferFirstRun)
  GuestMergeUiProvider
    GuestImportOnMount → setImportInFlight / build copy / setMergeSuccessVisible
    MergeSuccessOverlay (FR-003c)
    FirstRunOverlay (deferred until merge dismissed)

defer.ts: hasGuestData() OR importInFlight OR mergeSuccessVisible
merge-copy.ts: extractPreviewTaskTitles + buildMergeSuccessCopy
```

Titles captured from snapshot before `clearGuestSnapshot()`. Defer pub/sub mirrors `guest/store.ts` so onboarding hook re-renders when merge modal opens/closes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Merge copy helpers (TDD) | Title extraction + modal copy builder + unit tests | Overflow/singular grammar edge cases |
| 2. Defer extension (TDD) | import-in-flight + merge-visible flags + hook subscribe | Race if defer clears before modal mounts |
| 3. Merge-success UI (Implement) | Overlay + context + GuestImportOnMount wiring | Title capture after blob clear |
| 4. Auth narrative (Implement) | Sign-in subtitle + sign-up value block + card align | Marketing oversell vs guest parity |
| 5. E2E ordering (Implement) | Merge-success before first-run browser proof | Flaky timing on import + refresh |

**Prerequisites:** S-08 (guest merge), S-11 (first-run + defer stub) — both shipped on branch.

**Estimated effort:** ~2 implementation sessions across 5 phases.

## Open Risks & Assumptions

- Auth marketing copy must stay accurate: guest trial has single-cycle focus, not check-ins or full sessions (roadmap risk).
- `router.refresh()` after import may cause brief UI flicker behind modal — acceptable if modal mounts before refresh completes.
- Both overlays at same z-index rely entirely on defer mutual exclusion — do not render both visible.
- OAuth path assumed identical to email (lands `/`, same import mount) — manual spot-check if OAuth env configured.

## Success Criteria (Summary)

- Sign-in/sign-up pages communicate FlowState value without overselling guest features.
- Guest sign-in shows merge-success modal with counts and preview titles; Continue dismisses.
- First-run does not appear until merge-success dismissed when guest data was merged.
- `pnpm check`, `pnpm test`, and targeted e2e specs pass in CI.
