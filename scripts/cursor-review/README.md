# Cursor SDK — code review

Headless code review for FlowState using [`@cursor/sdk`](https://cursor.com/docs/sdk/typescript).

## Setup

1. Create an API key: [Cursor Dashboard → Integrations](https://cursor.com/dashboard/integrations) (user key) or Team → Service accounts (CI).
2. Add to `.env.local` (not committed):

   ```bash
   CURSOR_API_KEY="cursor_..."
   ```

3. Node **22.13+** required (matches CI).

## Local review (feature branch)

Compare current branch to `main` and stream the review to the terminal:

```powershell
$env:CURSOR_API_KEY = "cursor_..."   # or load from .env.local
pnpm review
```

With change plan context (plan drift):

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

Runs on a Cursor VM against the GitHub repo. Useful when the runner has no full dev setup.

```powershell
pnpm review:cloud --ref features/my-change-id
```

For GitHub Actions, add repository secret `CURSOR_API_KEY` and use workflow `.github/workflows/cursor-review.yml` (manual dispatch or PR trigger).

## Runtime choice

| Mode | Command | When |
| --- | --- | --- |
| **Local** | `pnpm review` | Dev machine with repo checkout; reads your working tree |
| **Cloud** | `pnpm review:cloud` | CI, parallel reviews, or no local checkout |

Always set `local` or `cloud` explicitly in scripts — the SDK defaults to local if omitted.

## Safety

Local runs use `autoReview: true` and `sandboxOptions.enabled: true`. The prompt forbids file edits; the agent is instructed read-only. For strict CI gates, treat output as advisory — merge still requires human review and existing CI (`pnpm check`, `pnpm test`, e2e belt).
