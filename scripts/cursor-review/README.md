# Cursor SDK — code review

Headless code review for FlowState using [`@cursor/sdk`](https://cursor.com/docs/sdk/typescript).

## Setup

1. Create an API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (user key) or Team → Service accounts (CI).
2. Add to `.env.local` in the repo root (gitignored, loaded automatically by `pnpm review`):

   ```bash
   CURSOR_API_KEY="cursor_..."
   ```

   CI uses the GitHub secret `CURSOR_API_KEY` — not `.env.local`.

3. Node **22.13+** required (matches CI).

`@cursor/sdk` local runtime also needs `@connectrpc/connect-node` (declared in this repo's `devDependencies` — upstream SDK omits it from published deps).

## Local review (feature branch)

Compare current branch to `main` and stream the review to the terminal:

```powershell
pnpm review
```

With change plan context (plan drift). Auto-detected from `features/<change-id>` branch names; override explicitly:

```powershell
pnpm review --change-id fix-stale-suggestion-after-delete
```

Save report under `reports/` (gitignored):

```powershell
pnpm review --output reports/review.md
```

Resume a prior conversation:

```powershell
pnpm review --resume agent-abc123
```

## Cloud review (PR / CI)

Runs on a Cursor VM against the GitHub repo. Prefer **commit SHA** over branch names — Cursor validates branch existence against GitHub and may reject names like `features/foo` even when the branch exists.

```powershell
$sha = git rev-parse HEAD
pnpm review:cloud --ref $sha --change-id my-change-id
```

On a PR, CI passes `--pr-url` so the agent attaches to the pull request directly.

### Cloud troubleshooting

| Error | Fix |
| --- | --- |
| `Failed to verify existence of branch` | Use `--ref $(git rev-parse HEAD)` instead of branch name; ensure repo is connected in [Cursor Integrations](https://cursor.com/dashboard/integrations) and API key has GitHub access |
| `Missing CURSOR_API_KEY` | Set in `.env.local` and export in PowerShell before `pnpm review` |

For GitHub Actions, add repository secret `CURSOR_API_KEY`. Workflow `.github/workflows/cursor-review.yml` checks out the PR head commit, runs a cloud agent (scope computed inside the VM), auto-passes `--change-id` for `features/*` branches, and updates a single PR comment on each push.

## Runtime choice

| Mode | Command | When |
| --- | --- | --- |
| **Local** | `pnpm review` | Dev machine with repo checkout; reads your working tree |
| **Cloud** | `pnpm review:cloud` | CI, parallel reviews, or no local checkout |

Always set `local` or `cloud` explicitly in scripts — the SDK defaults to local if omitted.

## Safety

Local runs use `autoReview: true` and `sandboxOptions.enabled: true`. The prompt forbids file edits; the agent is instructed read-only. For strict CI gates, treat output as advisory — merge still requires human review and existing CI (`pnpm check`, `pnpm test`, e2e belt).
