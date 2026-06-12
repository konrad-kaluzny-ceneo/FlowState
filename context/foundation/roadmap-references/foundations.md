> Detail reference — load on demand. Index: [roadmap.md](../roadmap.md).

# Foundations (F-01…F-06)

## Foundations

### F-01: Session domain model wired through data and API

- **Outcome:** (foundation) Pomodoro session domain is expressible: Task carries `workType` and `weight`; `Session`, `Cycle`, and `CheckIn` exist as Prisma models with strict per-user isolation; matching tRPC routers are registered in `~/server/api/root.ts`. No user-visible UI changes from this foundation alone.
- **Change ID:** session-domain-model
- **Linear:** [FLO-6](https://linear.app/flowstate-10xdev/issue/FLO-6)
- **GitHub:** [#5](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/5) (closed)
- **PRD refs:** NFR (data isolation), NFR (no silent data loss), NFR (90-day session retention), FR-017, FR-018, FR-019, FR-020
- **Unlocks:** S-01 (cycle entity to start), S-02 (session lifecycle), S-03 (mid-cycle decision recorded), S-04 (Task attribute columns), S-05 (CheckIn entity), S-06 (scoring inputs queryable). Also unlocks the `## Open Roadmap Questions` Q1 work (formula calibration depends on durable session+check-in data).
- **Prerequisites:** —
- **Parallel with:** S-07 (auth recovery; touches auth surface, not data model)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every other slice (except S-07) has a runtime dependency on it. The risk is over-reach — designing the schema for post-MVP features (analytics, ML scoring) instead of just the must-have FRs. Mitigation: schema scope is bounded by the FR list cited above; anything not on that list is out.
- **Status:** done

### F-02: E2E test infrastructure (Playwright + test auth)

- **Outcome:** (foundation) Playwright is installed and configured with a programmatic test-user authentication flow (bypassing interactive login); a single smoke test proves the pipeline works by signing in, loading the task list, and asserting DOM content. Agent and CI can run `pnpm test:e2e` to verify any UI-facing behavior in a real browser.
- **Change ID:** e2e-test-infra
- **Linear:** [FLO-14](https://linear.app/flowstate-10xdev/issue/FLO-14)
- **GitHub:** [#6](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/6)
- **PRD refs:** NFR (crash/refresh recovery), NFR (200ms acknowledgement), NFR (timer drift ≤ ±2s) — all require browser-level verification
- **Unlocks:** S-01 (cycle UI verifiable e2e), S-02 (session lifecycle e2e), S-03 (mid-cycle prompt e2e), S-04 (task attribute UI e2e), S-05 (check-in UI e2e), S-06 (suggestion UI e2e), S-07 (recovery flow e2e). Every slice with user-visible behavior depends on this to be properly verified.
- **Prerequisites:** —
- **Parallel with:** F-01, S-07 (planning only — S-07 implementation requires F-02)
- **Blockers:** —
- **Unknowns:**
  - How to authenticate a test user programmatically with Neon Auth — direct API call to get a session cookie, or a test-only auth bypass route? Owner: implementer (downstream `/10x-plan`). Block: no — both approaches are well-documented patterns.
- **Risk:** Without this, every UI-facing slice ships without real e2e confidence. The risk of NOT doing this is compounding: each slice adds manual verification debt that cannot be automated retroactively without this foundation. The risk of doing it is minimal — Playwright setup is well-understood and the scope is bounded to "auth + one smoke test".
- **Status:** done

### F-03: Align Prisma config with Prisma 7 conventions

- **Outcome:** (foundation) `prisma.config.ts` matches the official Prisma 7 pattern: `import "dotenv/config"`, `env()` from `prisma/config`, relative schema/migrations paths; `DATABASE_URL_UNPOOLED` in `datasource.url` for CLI (migrate, db push, studio). Runtime stays on pooled `DATABASE_URL` via `@prisma/adapter-neon` in `src/server/db/index.ts`.
- **Change ID:** align-prisma-config
- **Linear:** [FLO-22](https://linear.app/flowstate-10xdev/issue/FLO-22)
- **GitHub:** [#33](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/33)
- **PRD refs:** —
- **Unlocks:** — (hygiene; reduces agent confusion when running Prisma CLI)
- **Prerequisites:** —
- **Parallel with:** any slice (no runtime dependency)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal — config-only; verify `pnpm prisma migrate status` and `pnpm db:generate` after change.
- **Status:** proposed

### F-04: Impeccable design foundation

- **Outcome:** (foundation) `DESIGN.md` captures FlowState's visual system — color, typography, spacing, motion, and component patterns — produced via `/impeccable shape` discovery and `/impeccable document`, so downstream craft slices stay on-brand.
- **Change ID:** impeccable-design-foundation
- **Linear:** [FLO-25](https://linear.app/flowstate-10xdev/issue/FLO-25)
- **GitHub:** [#36](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/36)
- **PRD refs:** Secondary Success Criteria (active/completed split visually clear), NFR (200ms acknowledgement), proposed-FR-visual-design-system
- **Unlocks:** S-12 (wedge overlay polish), S-13 (home visual craft)
- **Prerequisites:** S-09
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Calm/minimal vs bolder personality — which direction fits the mindfulness wedge? Owner: user. Block: no.
  - Does `DESIGN.md` live at repo root or under `context/foundation/`? Owner: implementer. Block: no.
- **Risk:** Open-ended shape discovery stalls without a locked calm/focus product voice — scope discovery to wedge surfaces (home, task list, cycle transitions) only.
- **Status:** done

### F-05: Eisenhower effort task attributes (scorer v2 substrate)

- **Outcome:** (foundation) Task carries separate importance (1–3) and urgency (1–3), optional effort estimate in minutes, and commitment horizon (ASAP / this week / when possible) at create/edit; existing `weight` migrates to urgency with sensible defaults; `workType` unchanged; deterministic scorer v2 applies Eisenhower (urgency×importance), Pareto (importance when Focused), and Ockham (low-effort when Fading); rationale templates and S-23 expander factors updated.
- **Change ID:** eisenhower-effort-task-attributes
- **Linear:** [FLO-57](https://linear.app/flowstate-10xdev/issue/FLO-57)
- **GitHub:** [#78](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/78)
- **PRD refs:** FR-017, FR-018, FR-021, proposed-FR-task-importance, proposed-FR-commitment-horizon, proposed-FR-effort-estimate
- **Unlocks:** S-27 (daily standing + capacity), S-23 factor breakdown refresh after ship
- **Prerequisites:** S-04, S-06
- **Parallel with:** S-25, S-26, S-23
- **Blockers:** —
- **Unknowns:**
  - Migrate existing `weight` → urgency only, or copy to both axes? Owner: implementer. Block: no.
  - Cap effort range (e.g. 5–240 min) and treat null as unknown in scoring? Owner: implementer. Block: no.
  - Relabel weight UI as "urgency" or keep label with tooltip? Owner: user. Block: no.
- **Risk:** Three user-facing scales plus horizon may feel heavy at task creation — mitigate with defaults (importance 2, urgency 2, horizon when possible) and compact pickers; `weight` retained as legacy fallback in v1. Expand score 73/90 — **promote** (roadmap-expand 2026-06-09); merges importance-commitment-horizon + effort estimate from ideation batch.
- **Status:** done

### F-06: Serene Pastel Well-being rebrand

- **Outcome:** (foundation) `DESIGN.md` and `globals.css` `@theme` pivot from dark navy glass to **Serene Pastel Well-being** as the canonical light-default palette; remap `home-shell`, `overlay-shell` scrims, task cards, and auth CTAs; optional calm dark mode sub-phase (desaturated pastels on `#1E2433`, not current navy).
- **Change ID:** serene-pastel-rebrand
- **Linear:** [FLO-62](https://linear.app/flowstate-10xdev/issue/FLO-62)
- **GitHub:** [#97](https://github.com/konrad-kaluzny-ceneo/FlowState/issues/97)
- **PRD refs:** Secondary Success Criteria, NFR (200ms acknowledgement), proposed-FR-visual-design-system
- **Unlocks:** S-28 (wellness-illustration-foundation), downstream calm-garden wedge craft (P-103, not committed)
- **Prerequisites:** F-04, S-13
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Ship light-only default or include optional calm dark variant in DESIGN.md? Owner: user. Block: no.
  - Migrate e2e focus-ring assertions to new token utility or preserve legacy class alias? Owner: implementer. Block: no.
- **Risk:** Token rename or focus-ring utility changes break Playwright contracts (`ring-purple-500`, `data-testid`) unless updated in the same slice. Expand score 75/90 — **promote** (roadmap-expand 2026-06-11 wellness batch P-101).
- **Status:** done

### F-07: Wedge transition conductor

- **Outcome:** (foundation) Pure orchestrator enforces at most **one** calm interstitial line + **one** gate per transition beat — check-in, suggestion, S-19 ack, S-17 narrative, S-21 copy, S-16 wind-down, and S-22 catch-up coordinate via priority rules instead of stacking overlays.
- **Change ID:** wedge-transition-conductor
- **Linear:** —
- **GitHub:** —
- **PRD refs:** FR-014, FR-020, FR-029, FR-040, FR-041, NFR (200ms acknowledgement)
- **Unlocks:** Safe ship of S-21 mindful copy without B-04-class regressions; OQ2 resolution
- **Prerequisites:** S-12, S-19
- **Parallel with:** S-17, S-21
- **Blockers:** —
- **Unknowns:**
  - Central module in `pomodoro-dashboard` vs extracted hook — owner: implementer. Block: no.
  - Priority order when wind-down and check-in both eligible — owner: user + implementer in `/10x-plan`. Block: no.
- **Risk:** Refactor of gate logic touches e2e belt and `data-testid` contracts; behavior-parity tests required. Expand score 67/90 (coherence) / 65 revise→foundation (gap batch).
- **Status:** proposed
