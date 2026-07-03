# Home Layout Composition Contract + Navbar + Hero Removal — Plan Brief

> Full plan: `context/changes/fix-home-layout-spacing/plan.md`
> Frame brief: `context/changes/fix-home-layout-spacing/frame.md`
> Research: `context/changes/fix-home-layout-spacing/research.md`

## What & Why

From the frame: **the home layout composition layer has no enforced contract — regions render even when empty, spacing is one flat token applied at every nesting level (ignoring the `section-gap` token DESIGN.md prescribes), and width constraints are set per-component instead of per-zone.** This change fixes that contract (D-01) and, per the defect register's fix wave 2, bundles two binding product decisions: remove the home hero (D-07) and add an app navbar with the brand mark on every page including auth (D-06). The navbar also eliminates the mobile defect where the floating fixed header overlaps content.

## Starting Point

The header is `fixed top-0 right-0` with zero responsive handling (`layout.tsx:77`). The hero block in `home-shell.tsx:102-117` is the only user of its i18n keys. Four `HomeLayoutRegion`s render unconditionally in `gap-8` columns (one is always empty by design), `gap-8` (2rem) appears at 5 nesting levels while DESIGN.md's `section-gap: 1.5rem` is unwired, and 17 components self-cap at `max-w-lg` with only 4 opting into desktop expansion — producing the ragged edges, doubled gaps, and mobile overlap in the defect screenshots. No test can see any of this (structural jsdom oracles + desktop-only Playwright).

## Desired End State

Every page has a calm in-flow navbar (sprig + FlowState → `/`, language/theme, user + sign-out) that can never overlap content. Home opens straight into the workbench — no hero. All cards in a column share one left edge at every width; gaps between sections are a uniform token-driven 1.5rem with 2rem reserved for zone seams; no session state produces a phantom gap. A geometry belt at 1280 and 375 fails CI if any of this regresses.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem framing | Composition contract, not margin tweaks | Three STRONG-verdict hypotheses (empty regions, flat scale, width raggedness) share one layer | Frame |
| Scope bundle | D-01 + D-07 (hero out) + D-06 (navbar) | Register fix-wave 2; hero removal changes D-01's layout assumptions, so they ship together | Register |
| Navbar behavior | Static in-flow bar, compact mobile (no hamburger, not sticky) | Occupying real layout space kills the overlap defect by construction with the smallest delta | Plan |
| Brand mark | CalmGarden sprig + "FlowState" wordmark | Reuses the only brand asset; keeps Calm Garden present after hero removal (aligns with D-04 direction) | Plan |
| Purpose copy ("co teraz?") | Delete, amend product-voice.md now | Keeps the F-14 contract truthful; the primary region's first card now answers the question | Plan |
| Spacing scale | Two-tier: 1.5rem sections / 2rem zones (wire `--spacing-section`) | Honors DESIGN.md as written and creates the hierarchy the frame demands | Plan (value: Frame/DESIGN.md) |
| Empty regions | Conditional render + delete `home-inventory-zone` | DOM reflects reality; kills the never-used S-41 placeholder | Plan |
| Width ownership | `HomeLayoutRegion` carries `max-w-lg lg:max-w-none`; 17 components stripped | One left edge per column owned in one place (banners exempt as transient alerts) | Frame (mechanism: Plan) |
| Regression oracle | Playwright bounding-box spec + 375×812 project | Deterministic geometry assertions tied to the exact defect class; adds the missing mobile belt | Plan |

## Scope

**In scope:** app navbar (all 6 routes), fixed-header deletion, hero removal + i18n cleanup + product-voice amendment, section-gap token wiring, two-tier gaps, zone-owned widths, conditional regions, inventory-zone deletion, layout-rhythm e2e spec + mobile Playwright project, affected unit/e2e test updates.

**Out of scope:** D-04 illustration visibility (wave 5), D-10 vocabulary (wave 4), overlay/wedge surfaces, timer/session logic and the S-40 derivation matrix, other DESIGN.md tokens, `OfflineBanner`/`GuestBanner` width behavior.

## Architecture / Approach

Root layout becomes a flex column: `AppNavbar` (server-rendered, outside the home illustration provider — static sprig pose) then page content with `flex-1` replacing per-page `min-h-screen`. The home composition layer keeps S-41's 62/38 grid but gains the contract: regions render only with content, carry the width cap, and space children with the new `gap-section` token. Everything else (module derivation, rail, overlays) is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. App navbar | Navbar on all routes; fixed header gone; mobile overlap fixed | Viewport-height accounting on 5 pages (phantom scrollbars) |
| 2. Hero removal | Home opens with content; voice contract amended | Breaking the rail illustration's provider/publish plumbing |
| 3. Composition contract | Token-driven rhythm, one left edge, no phantom gaps | Region `hasContent` drifting from child conditions (flicker) |
| 4. Visual-rhythm belt | Geometry oracle at 1280 + 375 | Bounding-box flake without proper waits |

**Prerequisites:** none technical; reconcile the uncommitted `mvp-defect-intake` register + duplicate change folder on `main` before merge.
**Estimated effort:** ~3-4 implementation sessions (one per phase; 3 is the largest).

## Open Risks & Assumptions

- Tightening 2rem → 1.5rem between sections is a visible rhythm change everywhere on home — deliberately chosen, but needs an eyes-on pass in both themes before merge (Phase 3 manual criteria).
- The navbar sprig at ~24-32px may read as a smudge until wave 5 revises illustration contrast — accepted, since D-04 handles visibility later.
- Assumes Tailwind v4 `--spacing-section` token generates `gap-section`/`space-y-section` utilities (v4 `@theme` convention).

## Success Criteria (Summary)

- No viewport width shows overlapping chrome or misaligned card edges on home or auth pages; spacing between home sections is uniformly 24px.
- The brand lives in a navbar on every page; home starts with actionable content and still answers "co teraz?" with its first card.
- `layout-rhythm.spec.ts` fails if a width cap or overlap regression is reintroduced — on desktop and mobile projects alike.
