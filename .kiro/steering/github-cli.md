## GitHub CLI (`gh`) Usage

The `gh` CLI is installed and authenticated in this workspace. Use it for GitHub operations instead of the web UI or raw API calls.

### Available Operations

- **Pull Requests:** `gh pr create`, `gh pr list`, `gh pr view`, `gh pr merge`, `gh pr checkout`
- **Issues:** `gh issue create`, `gh issue list`, `gh issue view`, `gh issue close`
- **Repos:** `gh repo view`, `gh repo clone`
- **Releases:** `gh release create`, `gh release list`
- **Workflows:** `gh run list`, `gh run view`, `gh run watch`
- **General:** `gh api` for any GitHub REST/GraphQL API call

### Account

- This project uses the `konrad-kaluzny-ceneo` GitHub account.
- If a `gh` command fails with auth issues, verify the active account: `gh auth status`
- To switch if needed: `gh auth switch --user konrad-kaluzny-ceneo`

### Rules

- Always push to a new branch before creating a PR — never push directly to `main`.
- Use `gh pr create --fill` to auto-populate title/body from commits, or provide `--title` and `--body` explicitly.
- For draft PRs use `gh pr create --draft`.
- Prefer non-interactive flags (`--yes`, `--body`, `--title`) since the agent cannot handle interactive prompts.
- When listing items, use `--json` flag for structured output when parsing is needed (e.g., `gh pr list --json number,title,state`).
- Use `gh auth status` to verify authentication before operations if something fails unexpectedly.
