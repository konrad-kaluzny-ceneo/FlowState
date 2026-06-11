# Impeccable Design Foundation Implementation Plan

## Overview

Produce repo-root `DESIGN.md` — FlowState's visual system specification — via Impeccable **shape → document**, scoped to wedge surfaces (home shell, task list, cycle transition overlays). This is a **documentation-only** foundation slice: no component refactors, no token migration in `globals.css`. Output gates downstream craft slices S-12 (overlay polish) and S-13 (home visual craft).

## Current State Analysis

FlowState has no design system. Styling is ad-hoc Tailwind 4 utilities with a single font token in `src/styles/globals.css`. A dark navy gradient shell, glass-morphism cards, and purple primary CTAs repeat across 25+ components, but accent colors diverge (purple home, blue sign-in, indigo sign-up, teal break, green mark-done, amber suggestion highlight). No `DESIGN.md`, no `PRODUCT.md`, and no Impeccable skills are installed. Prerequisite S-09 (optimistic task mutations) is **done** — F-04 is unblocked.

### Key Discoveries:

- Tailwind v4 uses CSS-first config — tokens belong in `globals.css` `@theme { }`, not a JS config file (`src/styles/globals.css:1-7`)
- Eight near-identical overlay implementations share a scrim+card recipe — `DESIGN.md` should spec a shared primitive pattern; implementation deferred to S-12
- E2E asserts behavior via `data-testid` and `ring-purple-500` on focused rows — craft slices must preserve these contracts
- `WORK_TYPE_CONFIG` color map is duplicated in `task-list.tsx` and `task-suggestion-card.tsx` — `DESIGN.md` must define a single work-type badge palette
- Six archived slices explicitly deferred visual polish to F-04/S-12/S-13 — craft debt is intentional

## Desired End State

After this plan completes:

1. `DESIGN.md` at repo root captures color, typography, spacing, motion, component patterns, energy identities (Focused/Steady/Fading), work-type badge palette, unified CTA/accent tokens (including auth), and a future-patterns note for focus-shell dimming during WORK.
2. `PRODUCT.md` at repo root gives Impeccable commands product context distilled from the PRD.
3. Impeccable skills are installed under `.cursor/` (and companion harness folders per installer).
4. `AGENTS.md` references `@DESIGN.md` for downstream craft work.
5. `context/changes/impeccable-design-foundation/shape-brief.md` archives the shape discovery output.
6. No runtime or visual changes — `pnpm test` and e2e belt remain green without modification.

**Verification:** A reviewer can hand `DESIGN.md` to an implementer starting S-12 or S-13 and they can craft overlays/home surfaces without re-discovering personality, tokens, or wedge scope.

## What We're NOT Doing

- Component refactors or CSS token migration in `globals.css` (S-12/S-13)
- Auth page visual craft — only CTA/accent token definitions in `DESIGN.md` (S-13)
- Layout metadata cleanup (`"Create T3 App"` in `layout.tsx`) — S-13
- Focus-shell dimming implementation — future-patterns note only
- Copy/voice finalization for S-19/S-21/S-17 — deferred per roadmap orchestration note
- Visual regression tests or `impeccable detect` CI wiring — out of scope
- shadcn/Radix adoption or `cn()` utility introduction

## Implementation Approach

Follow roadmap Stream F chain: **shape → document**. Do not run `/impeccable init` (would duplicate discovery); instead manually create `PRODUCT.md` from PRD, then run `/impeccable shape` scoped to wedge surfaces with calm/minimal personality locked from planning session, then `/impeccable document` to generate spec-compliant `DESIGN.md`. Post-process the generated doc against the research checklist (energy identities, motion timing, work-type palette, auth CTA tokens, e2e contract preservation note, future-patterns section). Update agent onboarding last.

## Critical Implementation Details

- **Shape requires user participation** — `/impeccable shape` runs a multi-round discovery interview. The implementer must involve the product owner for personality confirmation and wedge surface sign-off; do not auto-accept defaults that contradict calm/minimal direction.
- **Document reads existing code** — `/impeccable document` extracts from current components. Post-generation editing is expected to resolve accent unification (purple vs blue vs indigo) and add energy-state identities that today's code lacks.
- **Motion spec is prescriptive, not implemented** — `DESIGN.md` must define overlay enter/exit timing, completion delight (sub-second restrained per FR-016), and 200ms-safe motion rules (L-04). S-12/S-13 implement; F-04 only documents.

## Phase 1: Impeccable toolchain setup

### Overview

Install Impeccable skills, create the feature branch, and distill `PRODUCT.md` so shape/document commands have product context.

### Changes Required:

#### 1. Feature branch

**File**: git branch

**Intent**: Start slice work on the correct branch per AGENTS.md.

**Contract**: `git switch main; git pull; git switch -c features/impeccable-design-foundation` (or resume existing branch).

#### 2. Impeccable skills install

**File**: `.cursor/` (and `.github/`, `.kiro/` per installer prompt)

**Intent**: Enable `/impeccable shape`, `/impeccable document`, and downstream `/impeccable craft`/`polish` for S-12/S-13.

**Contract**: Run non-interactive install from repo root (Windows PowerShell: `"Y" | npx impeccable skills install`); accept default harness folders (`.cursor`, `.github`, `.kiro`). Commit resulting skill files.

#### 3. PRODUCT.md

**File**: `PRODUCT.md` (repo root, new)

**Intent**: Give Impeccable commands persistent product context — users, brand voice, anti-references — without duplicating full PRD.

**Contract**: Distill from `context/foundation/prd.md`: primary persona (dynamic knowledge worker), product register (calm mindfulness wedge, not throughput task manager), brand voice (calm, restrained, focus-enabling), anti-references (arcade/surprise animations, visual noise, purple-gradient-slop AI aesthetic), wedge surfaces inventory (home shell, task list active/completed hierarchy, cycle transition overlays). Keep under ~80 lines.

### Success Criteria:

#### Automated Verification:

- Impeccable CLI responds: `npx impeccable --version`
- Skills directory exists with shape and document commands: `npx impeccable skills help` lists `/shape` and `/document`
- `PRODUCT.md` exists at repo root
- `pnpm check` passes (no broken references from skill install)

#### Manual Verification:

- Skill files appear under `.cursor/skills/` (or equivalent Impeccable install path)
- `PRODUCT.md` accurately reflects PRD calm/focus positioning without contradicting FR-016 restraint

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shape discovery

### Overview

Run `/impeccable shape` to produce a design brief locking calm/minimal personality, wedge surface inventory, energy identities, and token vocabulary — saved as `shape-brief.md` in the change folder.

### Changes Required:

#### 1. Shape discovery session

**File**: (interactive — no source edit)

**Intent**: Lock visual direction through Impeccable's multi-round discovery before generating `DESIGN.md`.

**Contract**: Invoke `/impeccable shape` in Cursor with scope constraints:
- **In scope**: home shell, task list (active/completed hierarchy, focus ring, work-type badges), cycle transition overlays (check-in, cycle-complete, suggestion, wind-down, mid-cycle, kickoff-readiness, tab catch-up, first-run, merge-success), timer/duration controls as supporting surfaces
- **Out of scope**: auth page craft (tokens only), focus-shell dimming implementation, copy/voice modules
- **Personality**: calm/minimal mindfulness — restrained palette, generous whitespace, subtle purposeful motion
- **PRD anchors**: active/completed visually clear (Secondary Success Criteria), selected task highlighted (US-01), 200ms acknowledgement NFR

#### 2. Shape brief archive

**File**: `context/changes/impeccable-design-foundation/shape-brief.md`

**Intent**: Preserve shape discovery output for traceability and S-12/S-13 reference.

**Contract**: Save the shape session output including: personality statement, wedge surface inventory, energy identity direction (Focused/Steady/Fading), color personality, motion principles, anti-patterns to avoid.

### Success Criteria:

#### Automated Verification:

- `context/changes/impeccable-design-foundation/shape-brief.md` exists and is non-empty

#### Manual Verification:

- Shape brief confirms calm/minimal direction (not bolder/expressive)
- Wedge surfaces match roadmap scope — no scope creep into analytics, settings, or auth craft
- Energy identities (Focused/Steady/Fading) have distinct visual direction defined
- User (product owner) has reviewed and approved the shape brief

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: DESIGN.md generation

### Overview

Run `/impeccable document` to generate spec-compliant `DESIGN.md`, then post-process against the research checklist to fill gaps the extractor cannot infer from current code.

### Changes Required:

#### 1. Document generation

**File**: `DESIGN.md` (repo root, new)

**Intent**: Produce the canonical visual system spec that S-12 and S-13 consume.

**Contract**: Invoke `/impeccable document` in Cursor. Impeccable generates Google Stitch-format spec from current codebase + `PRODUCT.md`.

#### 2. Post-process checklist

**File**: `DESIGN.md`

**Intent**: Ensure generated doc covers everything research identified that current code lacks or duplicates.

**Contract**: After generation, verify and add/edit sections as needed:

| Section | Requirement |
| --- | --- |
| Color tokens | Shell gradient, surfaces (`card`, `overlay`, `break`), text hierarchy, semantic accents (`cta`, `destructive`, `success`, `break`, `suggestion-highlight`) |
| Typography scale | Page title, overlay heading, timer display (`font-mono`), labels, coach copy |
| Spacing / radius | Card padding, row padding, `rounded-xl` vs `rounded-lg` |
| Component patterns | Overlay scrim+card primitive, segmented control, badge chips, primary/secondary CTA |
| Motion | Overlay enter/exit timing/easing, completion delight spec (sub-second restrained, FR-016), 200ms-safe rules (L-04) |
| Energy identity | Focused/Steady/Fading color/icon treatment |
| Work-type badge palette | Single source of truth for DEEP_WORK / OPERATIONAL / REACTIVE |
| Accent unification | Resolve purple vs blue vs indigo — unified `cta` token; auth pages reference same token |
| E2E contract note | Preserve `data-testid` values and focus ring semantic (document target token; S-12 may restyle but must keep test-visible behavior) |
| Future patterns | Focus-shell dimming during WORK — note only, not implementation spec |

#### 3. Tailwind v4 mapping note

**File**: `DESIGN.md`

**Intent**: Guide S-12/S-13 implementers on where tokens land in this stack.

**Contract**: Include a brief note that token implementation uses `src/styles/globals.css` `@theme { }` block (Tailwind v4 CSS-first config) — F-04 does not migrate tokens; S-12/S-13 do.

### Success Criteria:

#### Automated Verification:

- `DESIGN.md` exists at repo root
- `pnpm check` passes

#### Manual Verification:

- All checklist sections present and non-placeholder
- Motion section includes concrete timing guidance (not just principles)
- Auth CTA token defined (even though auth craft is S-13)
- Future-patterns section mentions focus-shell dimming
- No contradictions with calm/minimal shape brief
- Reviewer confirms doc is sufficient to start S-12 or S-13 without additional discovery

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Agent onboarding and verification

### Overview

Wire `DESIGN.md` into agent onboarding and confirm the slice introduces no runtime changes.

### Changes Required:

#### 1. AGENTS.md reference

**File**: `AGENTS.md`

**Intent**: Ensure future agents and craft slices discover the design system.

**Contract**: Add `@DESIGN.md` reference in Layout & conventions or a new Design section: "Visual system and craft rules: `@DESIGN.md`. Use `/impeccable craft` or `/impeccable polish` for wedge surface work (S-12, S-13)."

#### 2. Change metadata

**File**: `context/changes/impeccable-design-foundation/change.md`

**Intent**: Mark change as planned.

**Contract**: Set `status: planned`, update `updated` date.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm test` passes (unchanged baseline — no code changes expected)
- `pnpm typecheck` passes

#### Manual Verification:

- `AGENTS.md` reference to `@DESIGN.md` is discoverable
- Full artifact set present: `PRODUCT.md`, `DESIGN.md`, `shape-brief.md`, Impeccable skills
- No unintended changes under `src/` (diff review)
- Product owner approves `DESIGN.md` as gate for S-12/S-13

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to archive/PR.

---

## Testing Strategy

### Unit Tests:

- No new unit tests — documentation-only slice
- Existing suite must remain green (`pnpm test`)

### Integration Tests:

- No integration test changes
- E2E belt unchanged (`set CI=true && pnpm test:e2e:belt`)

### Manual Testing Steps:

1. Read `DESIGN.md` cover-to-cover — confirm calm/minimal voice and wedge scope
2. Cross-check energy identities against `energy-selector.tsx` current undifferentiated state — spec must define the delta S-12 will implement
3. Cross-check active/completed hierarchy spec against `task-list.tsx:679-782` — spec must define visual delta S-13 will implement
4. Verify `DESIGN.md` motion section respects 200ms NFR and FR-016 restraint
5. Confirm no files under `src/app/_components/` were modified

## Performance Considerations

None — no runtime changes. Motion tokens documented in `DESIGN.md` must explicitly note that animations must not block perceived 200ms acknowledgement on interactive surfaces (L-04).

## Migration Notes

No data or schema migration. Downstream S-12/S-13 will incrementally replace inline Tailwind utilities with `@theme` tokens — that migration is their scope, not F-04.

## References

- Related research: `context/changes/impeccable-design-foundation/research.md`
- Roadmap F-04: `context/foundation/roadmap.md` (L162-177)
- PRD Secondary Success Criteria: `context/foundation/prd.md` (L37)
- Impeccable docs: https://impeccable.style/docs/
- Similar deferred-polish pattern: `context/archive/2026-06-07-first-run-wedge-onboarding/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Impeccable toolchain setup

#### Automated

- [x] 1.1 Impeccable CLI responds: `npx impeccable --version`
- [x] 1.2 Skills directory exists with shape and document commands: `npx impeccable skills help` lists `/shape` and `/document`
- [x] 1.3 `PRODUCT.md` exists at repo root
- [x] 1.4 `pnpm check` passes

#### Manual

- [x] 1.5 Skill files appear under `.cursor/skills/` (or equivalent Impeccable install path)
- [x] 1.6 `PRODUCT.md` accurately reflects PRD calm/focus positioning

### Phase 2: Shape discovery

#### Automated

- [x] 2.1 `context/changes/impeccable-design-foundation/shape-brief.md` exists and is non-empty

#### Manual

- [x] 2.2 Shape brief confirms calm/minimal direction
- [x] 2.3 Wedge surfaces match roadmap scope
- [x] 2.4 Energy identities have distinct visual direction
- [x] 2.5 User (product owner) has reviewed and approved the shape brief

### Phase 3: DESIGN.md generation

#### Automated

- [x] 3.1 `DESIGN.md` exists at repo root
- [x] 3.2 `pnpm check` passes

#### Manual

- [x] 3.3 All checklist sections present and non-placeholder
- [x] 3.4 Motion section includes concrete timing guidance
- [x] 3.5 Auth CTA token defined
- [x] 3.6 Future-patterns section mentions focus-shell dimming
- [x] 3.7 Reviewer confirms doc sufficient for S-12/S-13

### Phase 4: Agent onboarding and verification

#### Automated

- [x] 4.1 `pnpm check` passes
- [x] 4.2 `pnpm test` passes
- [x] 4.3 `pnpm typecheck` passes

#### Manual

- [x] 4.4 `AGENTS.md` reference to `@DESIGN.md` is discoverable
- [x] 4.5 Full artifact set present
- [x] 4.6 No unintended changes under `src/`
- [x] 4.7 Product owner approves `DESIGN.md` as gate for S-12/S-13
