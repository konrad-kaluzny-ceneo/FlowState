---
date: 2026-06-08T12:00:00+02:00
researcher: Cursor Agent (10x-research)
git_commit: 28b80d7d8da135e9d3a401bdea2f7bac765f2e75
branch: konradkaluzny/flo-27-on-auth-pages-understand-flowstates-value-after-sign-in-with
repository: FlowState
topic: "S-14 auth-merge-first-impression — auth value narrative and guest-merge success handoff"
tags: [research, codebase, auth, guest-merge, onboarding, first-run, FR-001, FR-002, FR-003c, S-14, S-11]
status: complete
last_updated: 2026-06-08
last_updated_by: Cursor Agent (10x-research)
---

# Research: S-14 Auth narrative and guest-merge success handoff

**Date**: 2026-06-08T12:00:00+02:00  
**Researcher**: Cursor Agent (10x-research)  
**Git Commit**: `28b80d7d8da135e9d3a401bdea2f7bac765f2e75`  
**Branch**: `konradkaluzny/flo-27-on-auth-pages-understand-flowstates-value-after-sign-in-with`  
**Repository**: FlowState

## Research Question

For roadmap slice S-14 (`auth-merge-first-impression`, FLO-27 / #40):

1. What do auth pages (sign-in, sign-up) show today — layout, copy, shared components?
2. Where does guest merge happen, what user feedback exists, and what merge result data is available?
3. How does S-11 first-run onboarding interact (overlays, defer hooks) — what could conflict with merge-success UI?
4. What do prior changes (`guest-local-storage-merge`, `first-run-wedge-onboarding`) document?
5. What E2E patterns exist for auth/guest merge flows?

PRD: FR-001, FR-002, FR-003c, NFR (no silent data loss). Coordinate with S-11 first-run timing.

## Summary

- **Auth pages: no value narrative today.** Sign-in and sign-up are credential + OAuth forms on the dark gradient. No mention of mindful Pomodoro, energy check-ins, or session-aware suggestions.
- **Guest merge: silent success, loud failure.** `GuestImportOnMount` → `importGuestSnapshotAction` returns `{ importedTasks, importedCycles }` but client discards counts; only errors show amber alert (`guest-import-error`).
- **S-11 is shipped on this branch.** `shouldDeferFirstRun()` defers while `hasGuestData()` only — after import clears blob, auth first-run can appear immediately. S-14 must add merge-success UI and extend defer coordination.

## Detailed Findings

### 1. Auth pages

- `src/app/auth/sign-in/page.tsx` — H1 only, no value body
- `src/app/auth/sign-up/page.tsx` — generic subtitle, no card wrapper (inconsistent)
- `forgot-password/page.tsx` — subtitle pattern to reuse for value copy
- Both actions `redirect("/")` on success; merge runs on home mount

### 2. Guest merge flow

- `home-shell.tsx` mounts `GuestImportOnMount` when authenticated
- Success: `markGuestImportDone()`, `clearGuestSnapshot()`, invalidate queries — **no UI**
- Failure: amber toast `guest-import-error`
- Counts available from server action; titles from pre-clear client snapshot

### 3. S-11 coordination

- `defer.ts`: `shouldDeferFirstRun() => hasGuestData()` — partial stub
- After merge clears guest data, first-run can show before user sees merge success
- `FirstRunOverlay` at `z-[55]` — mirror for merge-success overlay
- Extend defer: import in-flight | merge-success visible | guest blob present

### 4. Historical context

- S-08 archived: silent merge by design; S-14 completes FR-003c UX half
- S-11 plan: merge-success > first-run priority; defer stub awaiting S-14

### 5. E2E

- `guest-merge-on-sign-in.spec.ts` — data survival, no success UI assertion
- `first-run-onboarding.spec.ts` — assumes no merge-success modal
- Add spec for merge-success visibility + ordering before first-run

## Code References

- `src/app/auth/sign-in/page.tsx:6-14` — sign-in shell
- `src/app/auth/sign-up/page.tsx:6-14` — sign-up shell
- `src/app/auth/forgot-password/page.tsx:6-14` — subtitle pattern
- `src/app/_components/guest-import-on-mount.tsx:30-79` — silent import
- `src/app/_actions/import-guest-snapshot.ts:8-40` — success counts
- `src/lib/onboarding/defer.ts:7-14` — S-14 extension point
- `src/app/_components/first-run-overlay.tsx:11-41` — modal pattern
- `e2e/guest-merge-on-sign-in.spec.ts` — merge proof

## Architecture Insights

1. Auth narrative = pre-auth on `/auth/*`; merge-success = post-auth on `/`
2. Extend `GuestImportOnMount` + new overlay sibling in `HomeShell`
3. `shouldDeferFirstRun()` OR import-in-flight | merge-success-visible | hasGuestData()
4. OAuth lands same path as email — identical merge-success flow

## Open Questions

1. Modal vs banner vs toast for merge-success (recommend modal — matches FirstRunOverlay)
2. Value copy on both sign-in and sign-up (recommend both — minimal sign-in, fuller sign-up)
3. Title listing vs counts only (recommend counts + up to 3 titles from pre-import snapshot)
4. CTA: Continue only (no review-tasks scroll in MVP)
