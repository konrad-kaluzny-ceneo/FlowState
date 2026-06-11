# Focus Home Visual Craft — Implementation Plan

## Overview

Apply DESIGN.md tokens to the home shell, layout metadata, guest banner, and task list; add calm per-task completion delight (FR-016 subset). **Out of scope:** overlay components (S-12), auth pages (deferred).

## Progress

- [x] Phase 1: Design tokens in `globals.css` + shared work-type config
- [x] Phase 2: Home shell + layout metadata craft
- [x] Phase 3: Task list hierarchy + completion delight + tests
- [x] Phase 4: Verification (`pnpm check`, `pnpm test`)

## Phase 1: Design tokens + shared config

**Files:** `src/styles/globals.css`, `src/lib/design/work-type-config.ts`

- Add `@theme` colors: shell-top/bottom, surface-card, surface-card-muted, border-subtle, text-secondary, text-dimmed, accent-cta/hover/success, work-type badge colors.
- Add `@keyframes task-complete-delight` + `.animate-task-complete` with `prefers-reduced-motion` guard.
- Extract `WORK_TYPE_CONFIG` to shared module; import in `task-list.tsx` only (S-12 may update suggestion card).

## Phase 2: Home shell + metadata

**Files:** `src/app/layout.tsx`, `src/app/_components/home-shell.tsx`

- Replace T3 metadata with FlowState title/description.
- Tokenize shell gradient, wordmark, tagline using theme utilities.
- Polish guest banner with border-subtle / surface-card tokens (keep amber semantic for guest warning).

## Phase 3: Task list craft

**Files:** `src/app/_components/task-list.tsx`, `src/app/_components/task-list.test.tsx`

- Use token utilities for active/completed rows, section headings, form inputs, primary CTA.
- Preserve `ring-2 ring-purple-500` on focused row (e2e contract).
- On mark-complete: add `animate-task-complete` class + fire mutation immediately (no await).
- Completed title: `text-dimmed line-through` per DESIGN.md.
- Test: completion animation class applied on mark-complete click.

## Phase 4: Verification

- `pnpm check` + `pnpm test`

## What We're NOT Doing

- Overlay refactors (S-12)
- Auth page visual alignment (deferred)
- `task-suggestion-card.tsx` work-type dedup (S-12 scope overlap — optional follow-up)

## S-12 merge note

If S-12 merges first with overlapping `@theme` tokens, rebase and dedupe — token names are identical per DESIGN.md.
