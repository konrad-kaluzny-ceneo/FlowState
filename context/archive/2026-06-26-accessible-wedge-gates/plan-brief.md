# Accessible Wedge Gates — Plan Brief

> Full plan: `context/changes/accessible-wedge-gates/plan.md`
> Frame brief: `context/changes/accessible-wedge-gates/frame.md`
> Research: `context/changes/accessible-wedge-gates/research.md`

## What & Why

FlowState's wedge gates need a bounded operability contract for focus, announcement, and keyboard-first action across existing gate surfaces while preserving the F-07 one-gate transition rule. This is not an app-wide accessibility audit; it is a finishing slice for the existing wedge path so screen-reader and keyboard users can open, understand, act on, and leave each gate calmly.

## Starting Point

The conductor already enforces one blocking gate per beat, and most gate actions are native buttons. The gap is that modal overlays lack a shared focus/label/dialog contract, inline gates lack labelled regions/status semantics, and tests do not yet assert role, focus, live-region, or keyboard-first behavior.

## Desired End State

Modal wedge gates are labelled dialogs with predictable initial focus, focus containment, and clean restore/next-beat transfer. Inline wedge gates remain inline, but expose clear names, selected/expanded state, and polite live status for gate changes. Existing conductor behavior, override freedom, and calm one-gate flow remain unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Architecture | Primitive-first modal contract | `OverlayScrim` is the shared modal wrapper, so centralizing focus/labels there avoids one-off overlay fixes. | Research |
| Gate model | Two-tier modal vs inline operability | Modal gates need focus containment; inline suggestion/steering cards need labelled regions and normal tab order. | Frame / Research |
| Keyboard scope | Standard keyboard-first controls only | Native buttons already cover Enter/Space; extra single-key shortcuts are unresolved and high drift risk. | Frame / Research |
| Live status | Polite, visible-copy-based announcements | Calm status should support the existing transition beat, not add assertive chatter or extra interstitial copy. | Frame / Plan |
| Conductor | Preserve F-07 behavior | S-39 must not add a gate, change `GATE_PRIORITY`, or weaken the one-gate rule. | Roadmap / Research |
| Testing | Hook/component first, e2e axe only if needed | Test plan Phase 8 says cheapest real signal wins; component assertions can observe most role/focus/live contracts. | Test Plan / Research |

## Scope

**In scope:**

- Shared modal semantics/focus lifecycle in `OverlayScrim`.
- Modal gate heading/description association for target S-39 gates: cycle complete, check-in, wind-down, and closure. End-session confirm and mid-cycle prompt stay compatibility-only if shared primitive API changes require mechanical updates.
- Inline suggestion, steering, energy, timer start, and dashboard live-status accessibility semantics.
- Focused component/hook/dashboard tests plus Phase 8 / §6.10 test-plan update.
- Optional wedge-scoped axe extension using existing Playwright axe setup only if it adds signal.

**Out of scope:**

- App-wide accessibility audit.
- Global shortcut manager or single-key accelerator map.
- New conductor gate or transition-priority rewrite.
- Visual rebrand, mobile/native accessibility scope, database/API changes.

## Architecture / Approach

The plan keeps domain orchestration in `src/lib/wedge/transition-conductor.ts` and `src/hooks/use-pomodoro-cycle.ts`, UI operability in `_components`, and documentation in `context/foundation/test-plan.md`. Phase 1 handles modal gates through the shared overlay primitive, Phase 2 handles inline gates and live status, and Phase 3 folds the new assertions into Phase 8 quality guidance plus the focused wedge regression commands.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared Modal Gate Contract | Labelled dialogs, focus lifecycle, and modal tests for blocking gates | Focus trap or restore could strand the next beat |
| 2. Inline Gate Semantics and Live Status | Labelled inline regions, selected/expanded state, polite announcements | Live regions could become noisy or shortcut scope could drift |
| 3. Phase 8 Quality Companion and Regression Belt | Test-plan Phase 8 update, focused regression set, optional scoped axe | Coverage could drift into a broad audit instead of wedge gates |

**Prerequisites:** Existing branch `features/accessible-wedge-gates`; F-07, S-21, S-28 already done; S4 research complete with 86/100 confidence.
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- Exact initial focus targets are implementation choices, but the plan sets the default policy: first meaningful interactive control, or labelled dialog context when there is no obvious next action.
- Escape is intentionally limited to gates with an existing non-destructive dismiss path.
- No new accessibility test dependency is assumed; existing RTL assertions and Playwright axe are enough unless implementation proves otherwise.
- Manual screen-reader verification is useful but not required to start implementation; automated role/focus/live oracles are the main acceptance contract.

## Success Criteria (Summary)

- Each target wedge gate can be reached, understood, operated, and closed with keyboard-first behavior and screen-reader-safe labels/status.
- F-07 one-gate transition behavior and override freedom remain intact.
- Phase 8 / §6.10 records S-39 role, focus, live-status, and keyboard action oracles for future wedge-gate changes.
