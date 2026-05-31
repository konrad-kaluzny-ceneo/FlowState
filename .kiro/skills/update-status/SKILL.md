---
name: update-status
description: Keeps FlowState roadmap.md, Linear (FLO team), and GitHub Issues in sync when starting, shipping, or rescoping work. Manually propagates status to both Linear and GitHub after changes. Use when updating issue status, closing slices, syncing Linear and GitHub, editing roadmap.md, or after merge/PR with Fixes #N.
---

# Update status (roadmap + Linear + GitHub)

Use with [@github-cli](../github-cli/SKILL.md) for `gh` auth and PR commands. Always-applied summary: `AGENTS.md` § Roadmap, Linear & GitHub.

## Sources of truth

| Layer | ID format | Where |
|-------|-----------|--------|
| Roadmap | `F-01`…`S-07`, Change IDs | `context/foundation/roadmap.md` |
| Linear | `FLO-*`, team `FLO`, project FlowState MVP | Linear MCP or app |
| GitHub | `#*` on `konrad-kaluzny-ceneo/FlowState` | `gh issue …` |

`roadmap.md` maps all three (At a glance + slice sections). Do not duplicate issues.

## Account (GitHub)

| Item | Value |
|------|--------|
| Account | `konrad-kaluzny-ceneo` |
| Verify | `gh auth status` |
| Switch | `gh auth switch --user konrad-kaluzny-ceneo` |

## Propagating status

There is **no automatic sync** between Linear and GitHub. When closing or updating an issue, you must update **both** sides manually:

1. Close/update on GitHub: `gh issue close <N>` or `gh issue edit <N> --add-label done`
2. Close/update on Linear: Linear MCP `save_issue` with state=Done (or appropriate status)
3. Verify both match after propagation

| Action | GitHub | Linear |
|--------|--------|--------|
| Close issue | `gh issue close <N>` | `save_issue` id=`FLO-*` state=Done |
| Reopen issue | `gh issue reopen <N>` | `save_issue` id=`FLO-*` state=In Progress |
| Verify state | `gh issue view <N> --json number,title,state` | `get_issue` id=`FLO-*` |

## Workflows

### Start work

1. Pick **roadmap ID** + **Change ID** from `roadmap.md`.
2. Use linked `FLO-*` / `#*`; reference in PR (`Fixes #N`).
3. Prefer Linear branch name when present (e.g. `konradkaluzny/flo-8-…`).

### Ship / complete slice

```
- [ ] PR to main with Fixes #N (or linked issue)
- [ ] Close issue on GitHub: gh issue close <N>
- [ ] Close issue on Linear: save_issue state=Done
- [ ] Verify both sides match
- [ ] roadmap.md: Status + slice **Status:** + frontmatter updated
- [ ] Optional: append roadmap ## Done on /10x-archive
```

### New scope

1. Add row to `roadmap.md` first.
2. Create issue in Linear **and** GitHub (no auto-mirror).
3. Add IDs to roadmap tables/sections.

## Tools

| Task | Tool |
|------|------|
| Read/update GH issue | `gh issue view`, `gh issue close`, `gh issue edit` |
| Read/update Linear | MCP `get_issue`, `save_issue`, `list_issues` |
| Roadmap edit | `context/foundation/roadmap.md` |

Linear MCP server: `project-0-FlowState-linear` (Cursor). Use project filter `FlowState MVP` when listing.

## Rules

- Never leave roadmap `done` while linked Linear or GitHub issue is still open.
- Do not track MVP work without a roadmap row.
- Always propagate status changes to both GitHub and Linear manually.

## Reference

- Roadmap: [context/foundation/roadmap.md](../../../context/foundation/roadmap.md)
- GitHub CLI skill: [github-cli](../github-cli/SKILL.md)
- Steering: [.kiro/steering/github-cli.md](../../../.kiro/steering/github-cli.md)
