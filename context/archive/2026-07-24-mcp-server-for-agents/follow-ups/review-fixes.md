# Review follow-ups: mcp-server-for-agents

Queued from `reviews/impl-review.md` triage (2026-07-26).

## F2 — Revoke API keys for deleted/disabled accounts (Fix A)

- **Source**: impl-review F2 (⚠️ WARNING, Safety & Quality) — `src/lib/api-keys/verify-token.ts:44`
- **Problem**: `verifyApiKey` trusts the mint-time snapshot on the `ApiKey` row and only checks `revokedAt`/expiry — it never checks live Neon Auth account status. A user deleted **or disabled** in Neon Auth keeps working keys, and `userEmail`/`userName` PII goes stale. This is a security/account-lifecycle gap, not just a staleness concern.
- **Action**:
  1. Document (wherever account-deletion/disablement lands) that deleting or disabling an account MUST revoke all its API keys.
  2. Add a periodic cleanup job that revokes keys whose `userId` no longer exists, or is disabled, in Neon Auth.
- **Open question**: verify Neon Auth exposes a server-side user-exists/disabled-status lookup usable from a job.

## F7 — Rate limiting on /api/mcp

- **Source**: impl-review F7 (👀 OBSERVATION, Safety & Quality) — `src/app/api/mcp/route.ts`; deferral accepted by the plan's "What We're NOT Doing".
- **Problem**: Every well-formed `fsk_` guess costs an indexed Neon lookup + hash; the endpoint can be hammered without any throttle.
- **Action**: Add IP-level rate limiting on `/api/mcp` — Next middleware or a Vercel WAF rule.
