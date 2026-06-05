---
change_id: testing-isolation-abuse-guest-merge
title: Phase 3 test rollout — isolation, abuse & guest merge
status: impl_reviewed
created: 2026-06-05
updated: 2026-06-05
archived_at: null
---

## Notes

Rollout Phase 3 of `context/foundation/test-plan.md`: "Isolation, abuse & guest merge".

Risks covered: #4 (per-user isolation on reads/mutations), #5 (guest→account merge integrity), #6 (IDOR via resource IDs).

Test types: integration only in this change (in-memory Prisma mocks). Guest→auth merge Playwright e2e deferred to a follow-up change per plan.

User constraint from slice selection: prioritize integration layers that do not require Playwright e2e as the cheapest signal.
