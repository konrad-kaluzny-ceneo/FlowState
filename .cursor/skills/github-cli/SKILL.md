---
name: github-cli
description: GitHub CLI (gh) operations for FlowState — pull requests, issues, releases, and workflow runs using the konrad-kaluzny-ceneo account. Use when creating or reviewing PRs, managing issues, inspecting CI, releasing, or any GitHub task in this repository.
---

# GitHub CLI (`gh`)

Use `gh` for all GitHub operations in this repo instead of the web UI or raw API calls. Always-applied rules also live in `AGENTS.md` and `.cursor/rules/github-cli.mdc`.

## Account

| Item | Value |
|------|--------|
| Account | `konrad-kaluzny-ceneo` |
| Verify | `gh auth status` |
| Switch if needed | `gh auth switch --user konrad-kaluzny-ceneo` |

If a command fails with auth errors, check status and switch before retrying.

## Operations

| Area | Commands |
|------|----------|
| Pull requests | `gh pr create`, `gh pr list`, `gh pr view`, `gh pr merge`, `gh pr checkout` |
| Issues | `gh issue create`, `gh issue list`, `gh issue view`, `gh issue close` |
| Repos | `gh repo view`, `gh repo clone` |
| Releases | `gh release create`, `gh release list` |
| Workflows | `gh run list`, `gh run view`, `gh run watch` |
| General | `gh api` for REST/GraphQL |

## Rules

- Push to a **new branch** before opening a PR — never push directly to `main`.
- Prefer **non-interactive** flags (`--yes`, `--title`, `--body`, `--fill`); the agent cannot answer prompts.
- Use `--json` when parsing output (e.g. `gh pr list --json number,title,state`).
- Draft PRs: `gh pr create --draft`.
- Auto title/body from commits: `gh pr create --fill`, or set `--title` and `--body` explicitly.

## Create a pull request

1. **Branch state** (run in parallel): `git status`, `git diff`, check upstream tracking, `git log`, `git diff main...HEAD` (or your base branch).
2. **Push** if needed: `git push -u origin HEAD`
3. **Create PR**:

```bash
gh pr create --title "Short title" --body "## Summary
- Point 1

## Test plan
- [ ] Step 1"
```

On Windows PowerShell, prefer `--body-file path.md` or a quoted `--body` string if heredoc syntax is unavailable.

## Additional reference

Source steering doc: [.kiro/steering/github-cli.md](.kiro/steering/github-cli.md)
