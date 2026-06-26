# Roadmap UX/UI story expand — Plan Brief

> Full plan: `context/changes/roadmap-ux-ui-story-expand/plan.md`
> Research: `context/changes/roadmap-ux-ui-story-expand/research.md`

## What & Why

After PRD v3 and quality hardening (Q-08, Q-09), FlowState needs a documented next chapter focused on UX/UI story — not new wedge mechanics. Users should understand within seconds that the app answers **co teraz?**; home hierarchy, desktop layout, calm day memory, and stateful visuals reinforce that promise.

This change writes the accepted roadmap rows and reference cards. **No product code** ships here.

## Starting Point

`/10x-roadmap-expand` batch 7 refined five proposals to ≥9.0 (`batch-7-ux-ui-story-chapter.md`, `expand-refinement-summary.md`). Parked/future overlap is analyzed in `parked-comparison.md`. Research confirmed ID availability (F-08, S-40–S-43), patch locations, and implementation feasibility for downstream slices. Nothing is committed to `roadmap.md` yet.

## Desired End State

`context/foundation/roadmap.md` lists F-08 and S-40–S-43 with correct prerequisites, stream placement, backlog handoff, and scope-merge notes. Item cards exist under `roadmap-references/items/`. Expand batch 7 is recorded in `roadmap-references/expand-batches/`. The change folder preserves planning context. First recommended downstream plan: `/10x-plan product-voice-contract`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Change scope | Documentation-only roadmap write | Expand batch is planning; code belongs in child change folders | Research |
| ID allocation | F-08, S-40, S-41, S-42, S-43 | No collision with S-39 / Q-09 terminus | Research |
| `main_goal` frontmatter | Keep `quality` until F-08 ships | Avoid relabeling before first slice lands; new Stream R carries the chapter | Plan |
| Commit order | F-08 → S-40 → S-41 → S-42 → S-43 | Voice + IA before desktop; recap after hierarchy; illustrations after rail slot defined | Research / batch-7 |
| S-42 relationship | New S-row, explicit S-30 phase 2 | Prevents duplicate of shipped recap substrate | Research |
| S-43 relationship | New S-row, absorbs S-28 phase 2 | Closes deferred overlay scrim work under one visual slice | Research |
| Purpose test | Manual 5s script + belt oracles | Validates hierarchy without product telemetry for the check | Plan |
| Issue pairs | Create Linear/GitHub for F-08 + S-40–S-43 after roadmap accept | Product/foundation slices; unlike Q-08/Q-09 quality companions | Plan / L-01 |
| Rail cap | ≤3 blocks | Keeps context rail focused; decision column primary | Plan |

## Scope

**In scope:**
- Patch `roadmap.md` (glance, streams, backlog handoff, scope merges, recommended next)
- Add `items/F-08.md`, `items/S-40.md` … `items/S-43.md`
- Update `roadmap-references/README.md` item index
- Record batch 7 in `expand-batches/batch-7-ux-ui-story-chapter.md`
- Update `change.md` status to `planned`

**Out of scope:**
- Any `src/` edits, migrations, or UI implementation
- Linear/GitHub issue creation before user accepts the roadmap patch
- Unparking session-reconnect calm banner (P-104) or other parked ideas
- Changing PRD v3 or test-plan phases

## Architecture / Approach

Treat this as a **roadmap index + reference-card patch** following the existing split-roadmap convention: glance rows stay short; Outcome/Unknowns/Risk live in `items/{ID}.md`. Scope merges table links S-42→S-30 and S-43→S-28 so future `/10x-plan` runs do not reopen settled relationships.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Freeze specs | Locked acceptance language for all five rows | Vague acceptance if hierarchy rules unclear |
| 2. Patch roadmap index | F-08 + S-40–S-43 in `roadmap.md` | Wrong prerequisite chain breaks sequencing |
| 3. Reference cards + expand batch | Item cards + README + expand-batches record | Duplicating detail into glance table |
| 4. Tracker prep (on accept) | Linear/GitHub pairs without duplicates | L-01 duplicate issue corruption |
| 5. Handoff | Status sync + first downstream `/10x-plan` target | Starting with S-40 before F-08 weakens copy contract |

**Prerequisites:** Q-09 done; expand refinement ≥9.0 accepted; user confirms roadmap write stance.

**Estimated effort:** ~1 session, 5 documentation phases.

## Open Risks & Assumptions

- User has not yet explicitly `commit`-accepted each P-ID — plan assumes all five promote per refinement docs.
- Polish-first copy in F-08 may temporarily coexist with English UI until child slices land.
- S-43 parallel work with S-41 is allowed in implementation but roadmap order lists S-43 after S-42 for rail-slot clarity.

## Success Criteria (Summary)

- Roadmap index shows the UX/UI story chapter with correct IDs, prerequisites, and stream.
- Each new row has a load-on-demand item card with merge notes and implementation risks.
- Scope merges explicitly record S-30 phase 2 and S-28 phase 2 absorption.
- Downstream implementer can run `/10x-plan product-voice-contract` without re-deriving expand analysis.
