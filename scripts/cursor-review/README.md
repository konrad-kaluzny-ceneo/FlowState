# Cursor SDK — code review

Headless code review for FlowState using [`@cursor/sdk`](https://cursor.com/docs/sdk/typescript).

## Setup

1. Create an API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (user key) or Team → Service accounts (CI).
2. Add to `.env.local` in the repo root (gitignored, loaded automatically by `pnpm review`):

   ```bash
   CURSOR_API_KEY="cursor_..."
   ```

   CI uses the GitHub secret `CURSOR_API_KEY` — not `.env.local`. When the secret is unset or **invalid**, the `cursor-review` workflow **succeeds with a notice** and does not block CI.

   > **CI runs in local mode.** The `cursor-review` workflow checks out the PR head on the runner and runs `pnpm review` (local SDK runtime). This needs **only** `CURSOR_API_KEY` — it does **not** require the repository to be connected in [Cursor → Integrations](https://cursor.com/dashboard/integrations). The cloud path (`pnpm review:cloud`) does require that integration and is kept for ad-hoc local use only.

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

## CI review (GitHub Actions)

Add repository secret `CURSOR_API_KEY`. Workflow `.github/workflows/cursor-review.yml` uses composite action `.github/actions/cursor-review` and runs the SDK in **local mode on the runner** — **no Cursor GitHub integration required**:

- Checks out the PR head commit (`fetch-depth: 0`) and runs `pnpm review` against the working tree, diffing vs `origin/main`.
- Auto-passes `--change-id` for `features/*` branches plus the PR title/description for context.
- Upserts a single PR comment (`<!-- cursor-review-v1 -->`) and applies `ai-cr:*` labels from `reports/review.json`.

Why local on CI: the cloud path resolves the repo/PR through Cursor's GitHub integration (fails with `pr_resolution_failed` when absent). Local mode reads the already-checked-out files, so only the API key is needed.

## Cloud review (ad-hoc, requires integration)

Runs on a Cursor VM against the GitHub repo — **requires the repo connected in [Cursor Integrations](https://cursor.com/dashboard/integrations)**. Not used by CI. Prefer **commit SHA** over branch names — Cursor validates branch existence against GitHub and may reject names like `features/foo` even when the branch exists.

```powershell
$sha = git rev-parse HEAD
pnpm review:cloud --ref $sha --change-id my-change-id
```

### Troubleshooting

| Error | Fix |
| --- | --- |
| `[pr_resolution_failed] Failed to fetch pull request details` | Cloud `--pr-url` needs the repo connected in [Cursor Integrations](https://cursor.com/dashboard/integrations). If you cannot configure that, use the local CI path (default) — it needs no integration |
| `Failed to verify existence of branch` | Use `--ref $(git rev-parse HEAD)` instead of branch name; ensure repo is connected in [Cursor Integrations](https://cursor.com/dashboard/integrations) and API key has GitHub access |
| `Missing CURSOR_API_KEY` | Set in `.env.local` and export in PowerShell before `pnpm review` |
| `Invalid User API Key` | Rotate key in [Cursor Integrations](https://cursor.com/dashboard/integrations); CI treats this as skipped (does not fail the workflow) |

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
| **Local** | `pnpm review` | Dev machine **and CI** with a repo checkout; reads the working tree; no Cursor GitHub integration |
| **Cloud** | `pnpm review:cloud` | Ad-hoc parallel reviews or no local checkout; **requires** Cursor GitHub integration |

Always set `local` or `cloud` explicitly in scripts — the SDK defaults to local if omitted.

## Safety

Local runs use `autoReview: true` and `sandboxOptions.enabled: true`. The prompt forbids file edits; the agent is instructed read-only. For strict CI gates, treat output as advisory — merge still requires human review and existing CI (`pnpm check`, `pnpm test`, e2e belt).
