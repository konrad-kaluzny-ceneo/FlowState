# Impeccable Design Foundation — Plan Brief

> Full plan: `context/changes/impeccable-design-foundation/plan.md`
> Research: `context/changes/impeccable-design-foundation/research.md`

## What & Why

FlowState has no design system — 25+ components share ad-hoc Tailwind utilities with diverging accents and no token layer. F-04 produces `DESIGN.md` via Impeccable shape → document so downstream craft slices (S-12 overlay polish, S-13 home visual craft) can ship cohesive visuals without re-discovering personality or wedge scope on every slice.

## Starting Point

Styling is Tailwind 4 CSS-first with one font token in `globals.css`. A navy gradient shell, glass-morphism cards, and purple CTAs repeat across wedge surfaces, but accents diverge (blue sign-in, indigo sign-up, teal break, green mark-done). No `DESIGN.md`, no `PRODUCT.md`, no Impeccable skills. S-09 (optimistic mutations) is done — F-04 is unblocked.

## Desired End State

Repo-root `DESIGN.md` captures color, typography, spacing, motion, component patterns, energy identities, work-type badge palette, and unified CTA tokens. `PRODUCT.md` feeds Impeccable context. Impeccable skills are installed. `AGENTS.md` references `@DESIGN.md`. No runtime changes — tests stay green. S-12 and S-13 can start craft immediately from the spec.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Personality direction | Calm / minimal mindfulness | Matches Pomodoro focus wedge and FR-016 restrained delight | Plan |
| `DESIGN.md` location | Repo root | Impeccable default; agents discover via `@DESIGN.md` | Plan |
| Auth pages | Tokens only — defer craft to S-13 | Keeps F-04 documentation-only while resolving accent split at spec level | Plan |
| Motion spec depth | Spec timing/easing now, implement in S-12/S-13 | Resolves S-12 "how much motion?" unknown upfront | Plan |
| Focus-shell dimming | Future-patterns note only | Captures parked roadmap intent without F-04 scope creep | Plan |
| Impeccable setup | Install skills + `AGENTS.md` ref | Enables `/impeccable craft`/`polish` for S-12/S-13 immediately | Plan |

## Scope

**In scope:** Impeccable skills install, `PRODUCT.md` from PRD, `/impeccable shape` discovery, `/impeccable document` generation, post-processed `DESIGN.md` at repo root, `shape-brief.md` archive, `AGENTS.md` reference.

**Out of scope:** Component refactors, `globals.css` token migration, auth page craft, layout metadata cleanup, focus-shell dimming implementation, copy/voice modules, visual regression tests, shadcn/Radix adoption.

## Architecture / Approach

Documentation-only foundation following roadmap Stream F: **shape → document**. Manually create `PRODUCT.md` (skip `/impeccable init`), run shape scoped to wedge surfaces with user participation, run document to extract/generate spec, post-process against research checklist (energy identities, motion timing, accent unification, e2e contract note). S-12/S-13 implement tokens in `globals.css` `@theme` and apply craft to components.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Toolchain setup | Impeccable skills, `PRODUCT.md`, feature branch | Interactive installer prompt on Windows |
| 2. Shape discovery | `shape-brief.md` with locked calm/minimal direction | Open-ended discovery stalls without user participation |
| 3. DESIGN.md generation | Repo-root spec with full checklist coverage | Generated doc may inherit current accent inconsistencies — post-process required |
| 4. Agent onboarding | `AGENTS.md` ref, verification, no `src/` changes | Accidental component edits during document pass |

**Prerequisites:** S-09 done; PRD and roadmap available; product owner available for shape session.
**Estimated effort:** ~1-2 sessions across 4 phases (shape session is the longest).

## Open Risks & Assumptions

- Shape discovery requires active user participation — cannot be fully automated
- `/impeccable document` extracts from current code — post-processing needed for energy identities and accent unification the code doesn't yet express
- Impeccable skills install adds ~15+ files to repo — acceptable per planning decision
- Calm voice copy module (S-19/S-21/S-17) remains deferred until after `DESIGN.md` per roadmap

## Success Criteria (Summary)

- `DESIGN.md` at repo root satisfies S-12/S-13 implementers without additional discovery
- All research checklist sections present (colors, typography, spacing, motion, energy identity, work-type palette, auth CTA tokens, future patterns)
- No changes under `src/`; `pnpm test` and e2e belt unchanged
- Product owner approves spec as gate for craft slices
