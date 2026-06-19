<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: break-alerts-out-of-tab

**Date:** 2026-06-19  
**Verdict:** APPROVED

## Summary

Phases 1–4 implemented. Hook fires `fireBreakOutOfTabAlert` on both `startBreakAfterWorkComplete` (guest/sync paths) and optimistic auth `continueAfterCheckIn` break start — required because authenticated check-in does not use `startBreakAfterWorkComplete`. Toggle-off short-circuits before orchestrator call.

**Confidence:** 93%

## Decision

**APPROVED** — proceed to PR.
