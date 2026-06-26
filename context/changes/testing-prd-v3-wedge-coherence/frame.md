# Frame Brief: PRD v3 Wedge Coherence

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Test-plan Phase 8 needs to prove PRD v3 wedge coherence across transition mutex, pause semantics, optimistic wedge, network recovery, stuck-gate dismiss, and S-39 operability oracles. The scope is high-risk because it could sprawl across conductor, pause, optimistic wedge, recovery, and accessibility work instead of staying a quality rollout.

## Initial Framing (preserved)

- **User's stated cause or approach**: Phase 8 should be framed before research/planning because wedge risk notes are high and the phase spans several shipped feature areas.
- **User's proposed direction**: Produce a framing artifact that narrows what this phase should and should not include; do not implement code or plan implementation details.
- **Pre-dispatch narrowing**: Proxy decision: the leading concern is scope boundary, not root-cause debugging. Treat Phase 8 as a coordinated proof strategy for shipped PRD v3 wedge behavior, not as a product reopen. Confidence: HIGH.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Risk coverage boundary** — Phase 8 could incorrectly try to cover every wedge-adjacent behavior rather than only test-plan risks #8-#12 and S-39 operability oracles.
2. **Product-vs-quality boundary** — Q-08 could reopen shipped product slices (F-07, S-24, S-34, S-35, S-39) instead of proving their user-facing contracts.
3. **Layer-selection boundary** — Phase 8 could over-promote proofs into the Playwright belt or duplicate full-catalog e2e coverage despite the test-plan's cost x signal rules.
4. **Oracle-boundary coherence** — Dismiss, mutex, latency, recovery, pause, and operability could be treated as unrelated test chores, missing the shared wedge-transition invariant.
5. **Cookbook/update boundary** — The work could stop at tests without updating the durable §6.10 cookbook where future wedge changes are supposed to learn the pattern.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Risk coverage boundary is the main risk | `context/foundation/test-plan.md:64-68` defines risks #8-#12; `context/foundation/test-plan.md:102` names Phase 8 explicitly as risks #8-#12 plus S-39; `context/changes/testing-prd-v3-wedge-coherence/change.md:20-29` repeats the same risk list. | STRONG |
| Product-vs-quality boundary is the main risk | `context/foundation/roadmap-references/items/Q-08.md:14-16` says this is a quality companion, not a reopen of S-39; `context/foundation/roadmap.md:90` labels Q-08 `(quality)`; `context/changes/testing-prd-v3-wedge-coherence/change.md:31-33` says all product prerequisites are done. | STRONG |
| Layer-selection boundary is the main risk | `context/foundation/test-plan.md:21-43` requires cost x signal and component/hook-first selection before belt additions; `context/foundation/test-plan.md:349-381` says belt extension only when hook/component cannot observe dismiss or operability. | STRONG |
| Oracle-boundary coherence is the main risk | `context/foundation/prd.md:78-95` makes transition mutex, 200ms handoff, pause, and recovery PRD guardrails; `context/foundation/lessons.md:66-70` says every wedge transition gate must assert open, primary action, and close; `D:\repos\10xdev\FlowState\AGENTS.md:30-36` reinforces the conductor, pause, and optimistic wedge domain rules. | STRONG |
| Cookbook/update boundary is the main risk | `context/foundation/test-plan.md:162-166` defines §6 as the growing cookbook; `context/foundation/test-plan.md:349-382` already contains S-39/dismiss oracle guidance that Phase 8 should use and refine; `context/changes/testing-prd-v3-wedge-coherence/change.md:29` names cookbook §6.10 updates as part of the outcome. | MEDIUM |

## Narrowing Signals

- Proxy decision: Phase 8 should include a single coordinated wedge-coherence quality rollout for risks #8-#12, because the roadmap, Q-08 item, test plan, and change brief all point to the same risk bundle. Confidence: HIGH.
- Proxy decision: Phase 8 should not add or alter product behavior unless research finds a test blocker that proves shipped behavior is untestable as specified. The product rows are already done and Q-08 is explicitly a quality companion. Confidence: HIGH.
- Proxy decision: Layer selection must stay hook/component-first with belt additions only for user-visible flows that cheaper layers cannot observe. This is explicit in the test-plan strategy and §6.10 belt-extension rule. Confidence: HIGH.
- Proxy decision: S-39 belongs as an oracle layer for operability on wedge gates, not as a broad accessibility audit or new product surface. Confidence: HIGH.
- Proxy decision: Updating §6.10 is in scope only to capture patterns discovered while Phase 8 ships; broad test-plan refresh or unrelated cookbook sections are out of scope. Confidence: MEDIUM.

## Cross-System Convention

The project convention for testing rollout is risk-first and layer-minimal: risks are user/business failure scenarios, research grounds code ownership, and plans choose the cheapest test layer that gives signal. For wedge work specifically, repository guidance requires the F-07 conductor invariant, pause semantics, and optimistic wedge responsiveness to remain coordinated, while lessons require every affected transition gate to prove it can be dismissed and the next beat can proceed.

This supports the initial concern but narrows it: Phase 8 should not be five feature plans stitched together. It should be one quality frame around the shared wedge invariant: a transition beat remains calm, singular, actionable, recoverable, and operable.

## Reframed Problem Statement

> **The actual problem to plan around is**: Phase 8 must prove the shared PRD v3 wedge-transition invariant across shipped surfaces without reopening those surfaces as product scope or duplicating expensive browser coverage.

The initial framing was correct: this phase needs a boundary before planning because the same user flow crosses conductor, pause, optimistic handoff, recovery, and accessibility contracts. What changes is the cut: the plan should organize around user-visible failure scenarios and layer decisions, not around product-slice ownership or implementation areas.

## Frame Outcome

Phase 8 should include:

- A risk-to-oracle map for risks #8-#12, including which invariants can be proven at conductor/hook/component level and which, if any, require belt coverage.
- Dismiss/actionability proofs for every wedge gate touched by Phase 8's researched risk paths: visible gate, primary action, gate closes, next beat is unblocked.
- Mutex/coherence proofs for transition beats: at most one interstitial plus one gate, including closure/kickoff/check-in/suggestion sequences where research shows active risk.
- Pause semantic proofs at the behavior-contract level: remaining time preserved, pause not counted as interruption, long pause ends calmly.
- Optimistic/recovery proofs at the behavior-contract level: check-in-to-suggestion perceived responsiveness, stale UI avoidance, failed mutation recovery with preserved user intent and retry.
- S-39 operability oracles where they protect wedge gates in the Phase 8 risk paths: role/name, focus lifecycle, polite live status, and keyboard-first native controls.
- A focused §6.10 cookbook update only for reusable wedge coherence patterns discovered while implementing this phase.

Phase 8 should not include:

- New product behavior, new wedge surfaces, new conductor priorities, or UX redesign beyond what is required to make existing contracts testable.
- Reopening shipped rows F-07, S-21, S-24, S-28, S-34, S-35, or S-39 as feature work.
- Full Playwright catalog expansion, app-wide accessibility audits, broad axe coverage for wedge flows, or belt additions where hook/component tests observe the contract.
- Phase 5 mutation-oracle hardening outside the wedge-coherence risk paths.
- General refactors of `use-pomodoro-cycle`, `pomodoro-dashboard`, or `src/lib/wedge/**` unless research later proves a minimal testability blocker.
- PRD/test-plan strategy refresh beyond Phase 8's §6.10 pattern update.

## Confidence

**HIGH** — the roadmap, Q-08 item, PRD guardrails, lessons, and test-plan Phase 8 all converge on the same conclusion: this is a bounded quality companion for shipped PRD v3 wedge behavior. The only medium-confidence area is how much §6.10 will need to change, because that depends on patterns discovered during research and implementation.

## What Changes for /10x-plan

/10x-plan should treat this frame as a scope guard: plan the smallest coordinated proof rollout that covers risks #8-#12 and S-39 operability oracles, with explicit layer justification for every belt addition. It should not plan product changes first; if research exposes a shipped behavior bug, record it as a blocker or separate follow-up unless the minimal fix is necessary to make the quality proof truthful.

## References

- Source files: `context/foundation/roadmap.md:90`, `context/foundation/roadmap.md:111-114`, `context/foundation/roadmap-references/items/Q-08.md:3-16`
- Source files: `context/foundation/prd.md:78-95`, `context/foundation/prd.md:120-140`, `context/foundation/prd.md:171-181`
- Source files: `context/foundation/test-plan.md:17-43`, `context/foundation/test-plan.md:64-85`, `context/foundation/test-plan.md:93-103`, `context/foundation/test-plan.md:349-382`
- Source files: `context/foundation/lessons.md:66-70`, `D:\repos\10xdev\FlowState\AGENTS.md:30-36`
- Change brief: `context/changes/testing-prd-v3-wedge-coherence/change.md:14-37`
- Related research: none yet
- Investigation tasks: none; this S3 frame used the provided foundation documents directly and did not spawn child agents.
