# Review follow-ups: mcp-server-for-agents

Queued from `reviews/impl-review.md` triage (2026-07-26).

## F2 — Revoke API keys for deleted/disabled accounts (Fix A)

- **Source**: impl-review F2 (⚠️ WARNING, Safety & Quality) — `src/lib/api-keys/verify-token.ts:44`
- **Problem**: `verifyApiKey` trusts the mint-time snapshot on the `ApiKey` row; a user deleted/disabled in Neon Auth keeps working keys, and `userEmail`/`userName` PII goes stale.
- **Action**:
  1. Document (wherever account-deletion lands) that deleting an account MUST revoke all its API keys.
  2. Add a periodic cleanup job that revokes keys whose `userId` no longer exists in Neon Auth.
- **Open question**: verify Neon Auth exposes a server-side user-exists lookup usable from a job.

## F7 — Rate limiting on /api/mcp

- **Source**: impl-review F7 (👀 OBSERVATION, Safety & Quality) — `src/app/api/mcp/route.ts`; deferral accepted by the plan's "What We're NOT Doing".
- **Problem**: Every well-formed `fsk_` guess costs an indexed Neon lookup + hash; the endpoint can be hammered without any throttle.
- **Action**: Add IP-level rate limiting on `/api/mcp` — Next middleware or a Vercel WAF rule.
