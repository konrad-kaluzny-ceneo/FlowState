# Cursor SDK — code review

Headless code review for FlowState using [`@cursor/sdk`](https://cursor.com/docs/sdk/typescript).

## Setup

1. Create an API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (user key) or Team → Service accounts (CI).
2. Add to `.env.local` in the repo root (gitignored, loaded automatically by `pnpm review`):

   ```bash
   CURSOR_API_KEY="cursor_..."
   ```

   CI uses the GitHub secret `CURSOR_API_KEY` — not `.env.local`. When the secret is unset or **invalid**, the `cursor-review` workflow **succeeds with a notice** and does not block CI.

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
| `Invalid User API Key` | Rotate key in [Cursor Integrations](https://cursor.com/dashboard/integrations); CI treats this as skipped (does not fail the workflow) |

For GitHub Actions, add repository secret `CURSOR_API_KEY`. Workflow `.github/workflows/cursor-review.yml` uses composite action `.github/actions/cursor-review` — checks out the PR head commit, runs a cloud agent (scope computed inside the VM), auto-passes `--change-id` for `features/*` branches, upserts a single PR comment (`<!-- cursor-review-v1 -->`), and applies `ai-cr:*` labels from `reports/review.json`.

## PR labels (`ai-cr:*`)

| Label | Color | Meaning |
| --- | --- | --- |
| `ai-cr:passed` | Green | Review completed; all scores ≥ 6, no critical findings |
| `ai-cr:failed` | Red | Review completed with failures, or agent run error |
| `ai-cr:review` | Blue | Request on-demand re-run (removed at run start) |

Labels are created automatically on first workflow run when `CURSOR_API_KEY` is configured. Pass/fail is **advisory** — not a merge gate.

## On-demand retry

Add the `ai-cr:review` label to a PR to trigger a fresh review. The workflow removes `ai-cr:review`, `ai-cr:passed`, and `ai-cr:failed` before each run, then applies the new outcome.

## Scores & pass rules

The agent emits a **Scores** section (C1–C6, each 1–10). `review.ts` writes `reports/review.json` alongside `reports/review.md` with:

- `passed` — `true` when every present score ≥ 6 and no `critical` findings
- `scores`, `mean`, `failReasons`, `criticalCount`

C5 (plan alignment) is omitted from the mean when no `--change-id` is provided. When `CURSOR_API_KEY` is missing or invalid, the workflow skips review — no comment, no labels, job stays green.

## Runtime choice

| Mode | Command | When |
| --- | --- | --- |
| **Local** | `pnpm review` | Dev machine with repo checkout; reads your working tree |
| **Cloud** | `pnpm review:cloud` | CI, parallel reviews, or no local checkout |

Always set `local` or `cloud` explicitly in scripts — the SDK defaults to local if omitted.

## Safety

Local runs use `autoReview: true` and `sandboxOptions.enabled: true`. The prompt forbids file edits; the agent is instructed read-only. For strict CI gates, treat output as advisory — merge still requires human review and existing CI (`pnpm check`, `pnpm test`, e2e belt).
