# Plan Brief: fix-timeout-closure-on-load (B-06)

**Roadmap:** B-06 · **PRD:** US-01 · **Transition:** T-03

## Problem

Timeout session closure appears only when starting the next cycle, not on page load. User sees kickoff readiness without context that the prior session ended.

## Solution

Call existing `maybePresentTimeoutClosure` during `recoverActiveCycle` idle hydrate (no active cycle), **before** `sessionStartIdleFlag`. Reorder hook functions so recovery can invoke closure helper.

## Phases

1. **Char test** — Vitest pins hydrate path (red)
2. **Enforcement** — reorder + defer kickoff flag (green)

## Risk

Double closure mitigated by `wasClosureShown` sessionStorage + B-05 dashboard mutex.

## Out of scope

F-07 conductor, E2E 4h timeout, copy changes.
