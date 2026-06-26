# Frame Brief: Accessible Wedge Gates

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

S-39 crosses accessibility, keyboard shortcuts, wedge/session gates, and quality companion scope. The change needs framing before research so the plan does not drift into broad accessibility cleanup or shortcut design while trying to make wedge gates operable.

## Initial Framing (preserved)

- **User's stated cause or approach**: Accessible wedge gate work is risky because it spans screen-reader focus, live status, keyboard-first controls, wedge conductor behavior, and test-plan Phase 8 quality scope.
- **User's proposed direction**: Run S3 Frame for `accessible-wedge-gates`, then hand a bounded frame to research/plan. Write `frame.md`; do not implement code or create a PR.
- **Pre-dispatch narrowing**: Decision proxy selected "wedge gate operability while preserving one-gate calm" as the leading concern. The slice is not an app-wide accessibility audit.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Gate scope boundary** — the roadmap and change note intentionally bound the work to cycle complete, intention/readiness, check-in, suggestion accept/override, and closure. If this boundary slips, the slice becomes horizontal accessibility cleanup.
2. **Semantic dialog/card structure** — overlay surfaces use a shared `OverlayScrim`/`OverlayCard` primitive, but `role`, labelling, and modal semantics are not consistently explicit across gate types. This is where the user's accessibility framing mostly lands.
3. **Focus movement and containment** — the current shared overlay shell renders fixed scrims/cards but has no shared focus entry, restore, trap, or Escape policy. If this is the break point, users can see the gate but keyboard/screen-reader users may not land in it predictably.
4. **Live status and transition announcements** — roadmap unknowns call out live-region copy; current wedge status surfaces mostly render text changes without an explicit live-region contract. If this is the break point, the gate changes visually but is not announced calmly.
5. **Keyboard-first action model** — native buttons already cover Enter/Space, but the parked keyboard-shortcut idea can drift into single-key accelerators. If this is the break point, the plan must preserve primary actions and override freedom without shortcut overload.
6. **Conductor and quality companion** — the F-07 conductor enforces one blocking gate per beat, while test-plan Phase 8 owns wedge coherence and stuck-gate dismiss oracles. If this breaks, accessibility work may regress the one-gate rule or duplicate the quality rollout.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Boundary drift is the primary risk | `context/changes/accessible-wedge-gates/change.md:12-16` explicitly bounds scope to wedge gates and warns not to expand into a broad accessibility audit; `context/foundation/roadmap-references/items/S-39.md:11-17` repeats that S-39 should pair with Phase 8 and avoid shortcut/audit drift. | STRONG |
| Shared gate semantics are incomplete enough to justify the slice | `src/app/_components/overlay-shell.tsx:22-43` exposes only `role?: "dialog" \| "presentation"` and renders no `aria-modal`, `aria-labelledby`, or focus behavior; `cycle-complete-overlay.tsx:97-130` uses the default `presentation` scrim while behaving like a modal gate; `check-in-overlay.tsx:25-45`, `session-closure-overlay.tsx:22-41`, and `wind-down-overlay.tsx:28-62` set `role="dialog"` but still rely on unlabeled headings. | STRONG |
| Focus management is the real frame, not visual accessibility | `overlay-shell.tsx:30-47` is a static wrapper with no focus entry/restore/trap; multiple overlay components mount through it. `task-suggestion-card.tsx:208-279` is card-only, often inline, so focus policy must distinguish modal overlays from inline gates. | STRONG |
| Live status is a missing contract | S-39 names live status as an outcome and unknown (`context/foundation/roadmap-references/items/S-39.md:5,13-16`), while code search found `aria-live` in auth forms but not wedge gate surfaces. Wedge transition text such as `suggestion-override-ack` and break/in-flow lines render as plain paragraphs in `pomodoro-dashboard.tsx:625-631` and `489-506`. | STRONG |
| Keyboard shortcut work should become a broad accelerator system | Current gate actions are mostly native `<button>` controls (`energy-selector.tsx:130-145`, `task-suggestion-card.tsx:167-175`, `timer-panel.tsx:155-181`), and S-39's unknown frames extra shortcuts as unresolved, not required. Additional single-key shortcuts are not needed to satisfy baseline keyboard-first operation unless research finds a gap. | WEAK |
| Quality companion should be a separate implementation track inside S-39 | Test-plan Phase 8 covers wedge coherence risks #8-#12 and gives hook/component-first guidance (`context/foundation/test-plan.md:102`, `349-369`). S-39 should consume that quality contract, not absorb the entire rollout phase. | STRONG |

## Narrowing Signals

- S-39 was promoted from parked P-102/P-103 only after F-07, S-21, and S-28 landed; this makes it a finishing operability slice on existing wedge gates, not a foundation refactor.
- The current conductor already suppresses competing gates and paused-cycle gates (`src/lib/wedge/transition-conductor.ts:53-129`, `132-151`), so the frame should preserve conductor behavior instead of replacing it.
- The strongest code gap is shared gate operability semantics (focus/live/labels), not lack of clickable controls: most actions are already buttons, but the modal/inline accessibility contract is inconsistent.
- The quality plan already names stuck-gate and transition coherence risks, so S-39 should add targeted a11y/keyboard oracles at the same gate matrix rather than introduce broad axe scans as the main deliverable.

## Cross-System Convention

Accessible modal gates usually need a labelled dialog or equivalent semantic region, predictable initial focus, contained tab order while blocking, focus restoration on close, and announced state changes for asynchronous transitions. Inline decision cards usually need labelled regions/groups, normal tab order, clear disabled/loading states, and polite live status only when content changes without user focus moving.

That convention matches the leading hypothesis: FlowState has a shared overlay primitive and a conductor, but the accessibility contract is not yet centralized. The plan should codify per-gate operability on top of existing UI primitives instead of inventing a new overlay stack or an app-wide shortcut layer.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: FlowState's wedge gates need a bounded operability contract for focus, announcement, and keyboard-first action across existing gate surfaces while preserving the F-07 one-gate transition rule.

The initial framing was correct, with one refinement: "keyboard shortcuts" should mean keyboard-first operation of gate actions by default, not a broad single-key accelerator system. The accessibility work belongs on wedge gate primitives and representative gate instances, with Phase 8 tests proving the same gates still open, announce, accept action, and close.

## Confidence

- **HIGH** — strong document evidence, matching code evidence, and a decisive scope signal from the change note and S-39 reference.

Confidence: 87/100. Remaining unknowns are planning-level choices, not framing blockers: exact focus entry target per gate, live-region copy, and whether any non-native shortcut earns its cost.

## What Changes for /10x-plan

Plan S-39 as a narrow wedge-gate operability slice. Research should inventory each target gate's current semantic role, focus path, live status, primary keyboard action, and existing dismiss oracle, then plan targeted changes and tests against that matrix.

Do not plan a broad accessibility audit, visual rebrand, native mobile support, global shortcut manager, or replacement of the transition conductor.

## Decision Log

| Step | Decision | Rationale | Confidence |
| --- | --- | --- | --- |
| S3 proxy | Treat "wedge gate operability while preserving one-gate calm" as the leading concern | Change note and S-39 item both explicitly bound scope to wedge gates and Phase 8 companion quality. | 90 |
| S3 proxy | Keep keyboard scope to native keyboard-first gate operation unless research proves a specific shortcut need | Existing controls are mostly native buttons; S-39 lists additional shortcut map as an unknown, not a prerequisite. | 78 |
| S3 proxy | Treat live regions as status announcements for gate changes, not extra interstitial copy | PRD guardrail forbids interstitial fatigue; live status must support the same calm transition beat. | 82 |
| S3 proxy | Make focus management a shared gate primitive concern, with modal vs inline distinctions | `OverlayScrim` is shared and currently lacks focus behavior, while suggestion/steering cards are inline. | 85 |

## References

- Source files: `context/foundation/roadmap.md:89`, `context/foundation/roadmap-references/items/S-39.md:5-17`, `context/changes/accessible-wedge-gates/change.md:12-16`, `context/foundation/prd.md:76-95`, `context/foundation/user-flow.md:153-183`, `context/foundation/test-plan.md:102`, `context/foundation/test-plan.md:349-369`, `src/app/_components/overlay-shell.tsx:22-47`, `src/app/_components/cycle-complete-overlay.tsx:97-130`, `src/app/_components/check-in-overlay.tsx:25-45`, `src/app/_components/task-suggestion-card.tsx:208-279`, `src/lib/wedge/transition-conductor.ts:53-151`.
- Related research: none yet.
- Investigation tasks: none; this S3 run used inline investigation because it is already running as a subagent and the parent request did not require nested agents.
