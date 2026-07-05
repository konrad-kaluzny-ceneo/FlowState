---
name: update-status
description: Keeps FlowState roadmap.md, Linear (FLO team), and GitHub Issues aligned when starting, shipping, or rescoping work. Manually pairs and verifies FLO-* ↔ #* — no Linear ↔ GitHub auto-sync. Use when updating issue status, closing slices, syncing Linear and GitHub, editing roadmap.md, or after merge/PR with Fixes #N.
---

# Update status (roadmap + Linear + GitHub)

Use with [@github-cli](../github-cli/SKILL.md) for `gh` auth and PR commands. Always-applied summary: `AGENTS.md` § Roadmap, Linear & GitHub.

## Sources of truth

| Layer | ID format | Where |
|-------|-----------|--------|
| Roadmap | `F-01`…`S-07`, Change IDs | `context/foundation/roadmap.md` |
| Linear | `FLO-*`, team `FLO`, project FlowState MVP | Linear MCP or app |
| GitHub | `#*` on `konrad-kaluzny-ceneo/FlowState` | `gh issue …` |

`roadmap.md` maps all three (At a glance + slice sections). **No Linear ↔ GitHub auto-sync** — this file is the pairing table; create and update both sides manually. Do not duplicate issues.

## Account (GitHub)

| Item | Value |
|------|--------|
| Account | `konrad-kaluzny-ceneo` |
| Verify | `gh auth status` |
| Switch | `gh auth switch --user konrad-kaluzny-ceneo` |

## Verify pairing (after any status/title change)

Look up `FLO-*` ↔ `#*` in `roadmap.md`, then compare **title** and **state** (open/closed vs Linear status/Done) on both sides. Update the other side manually if they diverge.

| Changed in | Check with |
|------------|------------|
| Linear | `gh issue view <N> --json number,title,state` |
| GitHub | Linear MCP `get_issue` id=`FLO-*` |

```powershell
gh issue view 7 --json number,title,state
```

```text
Linear MCP: get_issue id=FLO-8
```

If still mismatched: refresh UIs; confirm the GitHub link on the Linear issue; patch the other side explicitly. Comment on both if the pair is ambiguous. Update `roadmap.md` **Status** only when roadmap scope/state changes, not for every field alignment check.

## Workflows

### Start work

1. Pick **roadmap ID** + **Change ID** from `roadmap.md`.
2. Use linked `FLO-*` / `#*`; reference in PR (`Fixes #N`).
3. Prefer Linear branch name when present (e.g. `konradkaluzny/flo-8-…`).

### Ship / complete slice

```
- [ ] PR to main with Fixes #N (or linked issue)
- [ ] Close/move issue in Linear **and** GitHub (both sides)
- [ ] Verify pairing (table above)
- [ ] roadmap.md: Status + slice **Status:** + frontmatter updated
- [ ] Optional: append roadmap ## Done on /10x-archive
```

### New scope

1. Add row to `roadmap.md` first.
2. Create issue in Linear **and** GitHub; cross-link both sides.
3. **Verify pair** (`FLO-*` ↔ `#*`), then add IDs to roadmap tables/sections.

## Tools

| Task | Tool |
|------|------|
| Read/update GH issue | `gh issue view`, `gh issue close`, `gh issue edit` |
| Read/update Linear | MCP `get_issue`, `save_issue`, `list_issues` |
| Roadmap edit | `context/foundation/roadmap.md` |

Linear MCP server: `linear-flowstate` (project `.cursor/mcp.json`). Workspace: `flowstate-10xdev`, team `FLO`, project `FlowState MVP`. Use project filter `FlowState MVP` when listing.

### Linear MCP setup (FlowState workspace)

The global Linear **plugin** may be authenticated to another workspace (e.g. Sandra `SAN-*`). FlowState issues live in **`flowstate-10xdev`** (`FLO-*`). Use the project server `linear-flowstate` — separate OAuth from the plugin.

1. `Ctrl+Shift+J` → **MCP** → find **`linear-flowstate`** (project).
2. Click **Needs authentication** (or **Connect**). If the browser does not open: **Output** → **MCP: linear-flowstate** → copy the auth URL manually.
3. Sign in with the Linear account that has access to **flowstate-10xdev** (not the Sandra-only account).
4. Verify: `list_teams` → team `FLO`; `get_issue` id=`FLO-6` → success.
5. In FlowState sessions, prefer **`linear-flowstate`** over the global Linear plugin so agents hit `FLO-*`, not `SAN-*`.

To re-auth: disable `linear-flowstate`, delete `%USERPROFILE%\.mcp-auth`, re-enable, connect again.

## Rules

- Never leave roadmap `done` while linked Linear or GitHub issue is still open.
- Do not track MVP work without a roadmap row.
- Update both Linear and GitHub for each status change; `roadmap.md` is the pairing table — don't maintain two divergent truths.

## Reference

- Roadmap: [context/foundation/roadmap.md](../../../context/foundation/roadmap.md)
- GitHub CLI skill: [github-cli](../github-cli/SKILL.md)
- Steering: [.kiro/steering/github-cli.md](../../../.kiro/steering/github-cli.md)
