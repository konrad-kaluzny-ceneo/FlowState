<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: MCP Server for AI Agents

- **Plan**: context/changes/mcp-server-for-agents/plan.md
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-07-26
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

Verification evidence (2026-07-26): typecheck ✅, targeted tests 37/37 ✅, full suite 1476/1476 ✅, migration applied ✅, `pnpm build` ❌ (F1). Post-triage final gate: typecheck ✅, full suite 1485/1485 ✅, `pnpm build` ✅. `pnpm check` exits 1 only on uncommitted local `.claude/settings.local.json` formatting — unrelated to this change. Manual rows 2.5–2.8 / 3.6–3.10 remain honestly unchecked. All 12 planned items MATCH; the two path deviations (panel in `src/app/_components/`, catalogs in root `messages/`) reflect the plan being wrong about repo layout. Unplanned edits (`task.ts`, `server-repositories.ts`, `vitest.config.ts`) all trace to justified bugfix commit b42c882. Zero "What We're NOT Doing" violations (`dayPlan.getOrCreate` verified as a pure query — never inserts).

## Findings

### F1 — pnpm build fails: MCP_API_KEY_PEPPER missing from local env

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/env.js:40 / .env
- **Detail**: Required server var added to .env.example only; neither .env nor .env.local defines it, so `pnpm build` and `pnpm dev` fail with "Invalid environment variables" despite Progress row 3.4 checked at c72f406. Vercel deploy will also fail unless the var is set there.
- **Fix**: Generate a ≥32-char secret into .env (and .env.local if used); set MCP_API_KEY_PEPPER in Vercel project env before merging.
- **Decision**: FIXED — user added the var to .env (verified: 32 chars). Vercel env still a pre-deploy manual step.

### F2 — API keys never re-check that the user still exists

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/api-keys/verify-token.ts:44
- **Detail**: verifyApiKey resolves identity entirely from the ApiKey row's mint-time snapshot (userId, userEmail, userName). Deleted/disabled Neon Auth accounts keep working keys; email/name changes leave stale PII duplicated outside the auth store.
- **Fix A ⭐ Recommended**: Track as follow-up: document that account deletion must revoke keys; add a periodic cleanup job revoking keys whose userId no longer exists in Neon Auth.
  - Strength: No per-request cost; fits v1 PAT scope and the plan's deferral posture.
  - Tradeoff: Window where a deleted account's key still works.
  - Confidence: HIGH — no account-deletion flow shipped today; window currently theoretical.
  - Blind spot: Whether Neon Auth exposes a cheap server-side user-exists lookup — unverified.
- **Fix B**: Verify user liveness inside verifyApiKey on every request.
  - Strength: Closes the gap at the gate immediately.
  - Tradeoff: Extra auth-store round trip per MCP call inside the 10s budget.
  - Confidence: MEDIUM — same unverified Neon Auth API.
  - Blind spot: Latency/cost under agent traffic.
- **Decision**: FIXED via Fix A — queued in follow-ups/review-fixes.md (cleanup job + deletion-must-revoke rule).

### F3 — Keys have no expiry and no per-user cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: prisma/schema.prisma:228, src/server/api/routers/api-key.ts:37
- **Detail**: revokedAt is the only kill switch — keys live forever; `create` has no cap on active keys per user. Leaked long-lived PATs stay valid indefinitely.
- **Fix**: Add optional `expiresAt` (checked in verifyApiKey next to revokedAt) and cap active keys per user (e.g. 10) in `create`. Additive migration.
  - Strength: Standard PAT hygiene; few lines on already-touched paths.
  - Tradeoff: Slight UX addition (expiry choice) or a silent default to pick.
  - Confidence: HIGH — no design unknowns.
  - Blind spot: Default lifetime suited to agent integrations (S-47) — product call.
- **Decision**: FIXED — expiresAt column (migration 20260726081031), expiry check in verifyApiKey, MAX_ACTIVE_KEYS_PER_USER=10 cap in create; 3 new tests. expiresAt stays null on create until an expiry UI ships.

### F4 — task.update returns the raw Prisma row, unlike its siblings

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/server/api/routers/task.ts:202
- **Detail**: Bugfix b42c882 made `update` return the updated row unmapped, while `create`/`restore` return mapTaskFromPrisma(row). MCP update_task/complete_task emit Prisma-shaped tasks vs domain-shaped from create_task/list_tasks; web client type loosened to Promise<unknown> in server-repositories.ts:75 to absorb it.
- **Fix**: Return mapTaskFromPrisma(updatedTask) from both branches; restore the typed return in server-repositories (drop Promise<unknown>).
- **Decision**: FIXED — both update branches now return mapTaskFromPrisma(row); TrpcClient.task.update restored to Promise<DomainTask>. Side effect: task-resume-note.test.ts mock updated to return a full row (the mapper now validates it — a correctness win).

### F5 — Test gaps around the auth gate and read tools

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/mcp/mcp-tools.test.ts
- **Detail**: complete_task has its own requireWrite call (mcp-tools.ts:280) but no READ-denial test. None of the four read tools is tested (incl. get_next_suggestion's no-active-session branch); error mapping exercised only for NOT_FOUND.
- **Fix**: Add READ-denial coverage for complete_task, one test per read tool through the same caller path, one non-NOT_FOUND error-mapping case.
- **Decision**: FIXED — 6 tests added (complete_task READ denial; get_session_state/get_day_stats/get_day_plan/get_next_suggestion empty-state paths; BAD_REQUEST whitelisted-message mapping).

### F6 — Prefer HMAC over sha256(secret + pepper) [time-sensitive]

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/api-keys/api-key.ts:35
- **Detail**: Not practically exploitable with 256-bit random secrets, but HMAC-SHA256 is the textbook keyed construction. Swapping later invalidates all minted keys — do it BEFORE real users mint any.
- **Fix**: Switch hashSecret to createHmac("sha256", env.MCP_API_KEY_PEPPER).update(secret), pre-launch.
- **Decision**: FIXED — hashSecret now HMAC-SHA256(pepper, secret); docs updated; previously minted test keys invalidated.

### F7 — No rate limiting on /api/mcp (plan-accepted deferral)

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/mcp/route.ts
- **Detail**: Every well-formed fsk_ guess costs a DB lookup + hash. Plan explicitly deferred rate limiting ("follow-up risk") — not drift; flagged so it lands in a follow-up ticket.
- **Fix**: Create follow-up: IP-level rate limiting (middleware or Vercel WAF) on /api/mcp.
- **Decision**: FIXED — queued in follow-ups/review-fixes.md.

### F8 — Revoke failure is silent in the Settings panel

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/api-keys-panel.tsx:83
- **Detail**: revokeMutation has no onError while create surfaces createError. A failed revoke on a security action leaves the user believing the key is dead.
- **Fix**: Add symmetric translated onError message for revoke.
- **Decision**: FIXED — revokeError state + role="alert" message; Settings.apiKeys.revokeError added to en/pl (parity test green).

### F9 — Scope semantics footnotes

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/mcp/route.ts:47, src/server/api/routers/task.ts:50
- **Detail**: (a) AuthInfo.scopes (["read","write"]) populated but never enforced — real gate is extra.scope/requireWrite; drift risk if a future tool trusts scopes. (b) list_tasks triggers archiveStaleTasksForUser (updateMany) via task.list — READ keys do write own data; intended exception worth a comment.
- **Fix**: Comment scopes as advisory (or derive both from one source); comment the archive side effect as an intended READ exception.
- **Decision**: FIXED — advisory-only comment on AuthInfo.scopes in route.ts; intended-exception comment at archiveStaleTasksForUser in task.list.

### F10 — Minor perf footnotes

- **Severity**: 👀 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/api/mcp/mcp-tools.ts:170, src/lib/api-keys/verify-token.ts:53
- **Detail**: list_tasks is unbounded (whole backlog serializes into one tool result); lastUsedAt writes on every MCP call.
- **Fix**: Optionally bound list_tasks and stamp lastUsedAt only when >60s stale. Fine at current scale.
- **Decision**: SKIPPED — accepted as-is at current scale; revisit if agent traffic grows.
