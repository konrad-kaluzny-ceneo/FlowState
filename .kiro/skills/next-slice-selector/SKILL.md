---
name: next-slice-selector
description: Selects the best next FlowState roadmap slice by ranking candidates, proposing top 3 (including parallel bundles), asking the user to choose, then marking the chosen slice as active in roadmap.md and synced via update-status. Use when deciding what to implement next, prioritizing slices, or preparing to start a new slice from roadmap.md.
---

# Next slice selector (roadmap -> active)

Use this skill to decide the next slice from `context/foundation/roadmap.md` and activate it consistently across roadmap + Linear + GitHub.

Use with [update-status](../update-status/SKILL.md) for synchronization rules and mirror verification.

## Inputs

- Canonical roadmap: `context/foundation/roadmap.md`
- Optional context from user: current capacity, preference for quick wins vs wedge work, willingness to run parallel slices

## Output contract

1. Ranking: top 3 next options (single slices or one parallel bundle option)
2. User decision: explicit choice confirmed by the user
3. Activation: chosen slice marked `active` in roadmap and synced through `/update-status`

## Selection workflow

### 1) Read and normalize roadmap state

1. Read `context/foundation/roadmap.md` fully.
2. Build candidate set from slices/foundations not finished yet:
   - Include statuses: `ready`, `proposed`
   - Exclude: `done`, `active`, `blocked`, `parked` (if present)
3. Parse per item:
   - Roadmap ID (`F-*` / `S-*`)
   - Change ID
   - Current status
   - Prerequisites
   - Parallel-with notes
   - Linear and GitHub links
   - Outcome + risk notes

### 2) Score candidates

Use this deterministic scoring model:

- `+4` all prerequisites are `done`
- `+2` status is `ready`
- `+2` directly advances north-star path (`S-01` chain) or removes a known blocker
- `+1` high confidence / low unknowns
- `+1` high leverage unlocks many dependent slices
- `-2` has unresolved hard dependency
- `-1` marked with major unknowns requiring research before planning

Tie-breakers (in order):
1. Highest unlock value
2. Lowest implementation risk for current milestone
3. Better fit to user-stated priority (`speed` vs quality hardening)

### 3) Build top 3 recommendation

1. Return top 3 ranked options with one-line rationale each.
2. Include at most one "parallel bundle" option if:
   - both slices are dependency-safe now, and
   - roadmap marks them as parallel-compatible.
3. For every option, include:
   - item(s): roadmap ID + change ID
   - why now: dependency + value reasoning
   - caution: main risk or prerequisite watchout

### 4) Ask user to pick

Ask explicitly which option to implement now (single select).

If user chooses a parallel bundle, confirm whether:
- both slices should be set `active`, or
- only the primary slice should become `active` and the second stays `ready`.

Do not activate anything before the user confirms.

### 5) Activate and sync

After user choice:

1. In `context/foundation/roadmap.md`:
   - Set selected slice `- **Status:** active`
   - Update frontmatter `updated` date to today
2. If another slice is currently `active`, ask whether to:
   - switch active status to the new slice, or
   - keep current active and abort this activation
3. Run `/update-status` workflow to sync Linear/GitHub status and verify mirror consistency.
4. Report final mapping:
   - Roadmap ID + Change ID
   - Linear ID
   - GitHub issue
   - final status on all three surfaces

## Guardrails

- Never mark a slice `active` if prerequisites are not satisfied, unless user explicitly overrides.
- Never leave multiple active slices unless user explicitly requested parallel execution.
- Never create duplicate Linear/GitHub issues when mappings already exist in roadmap.
- If roadmap/Linear/GitHub states conflict, follow [update-status](../update-status/SKILL.md) "one source edited, mirror verified" rule.

## Recommended response format

Use this compact template:

```markdown
## Next slice recommendation

1. `S-xx` (`change-id`) — <why now>
2. `S-yy` (`change-id`) — <why now>
3. `S-aa + S-bb` (parallel option) — <why now>

Recommended: `<best-option>`

Choose what to activate:
- Option 1
- Option 2
- Option 3
```

After choice:

```markdown
Activated: `S-xx` (`change-id`)
- Roadmap: `active`
- Linear: `<state>`
- GitHub: `<state>`
```

## Related skills

- [update-status](../update-status/SKILL.md) - status synchronization and mirror verification
- [github-cli](../github-cli/SKILL.md) - GitHub issue operations via `gh`
