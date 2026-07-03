---
change_id: fix-home-layout-spacing
title: Fix home layout spacing
status: implementing
created: 2026-07-03
updated: 2026-07-03
archived_at: null
---

## Notes

- Defect **D-01** from the post-MVP intake register (`context/changes/mvp-defect-intake/change.md`, uncommitted on `main` as of 2026-07-03).
- Prior `/10x-frame` exists: [frame.md](frame.md) (HIGH confidence) — problem reframed as a missing layout composition contract (empty regions, flat `gap-8` scale vs DESIGN.md `section-gap`, per-component width caps).
- Register fix-wave 2 **extends this change's scope**: D-01 (composition contract) + **D-07 hero removal** + **D-06 navbar with logo (also on /auth/*)**. User decisions override prior design decisions (S-13/F-06 hero, S-41 details).
- Research: [research.md](research.md) — adds the mobile fixed-header overlap (layout.tsx:77) as a defect beyond the frame's dimension map; screenshots from 2026-07-03 session.
- ⚠️ This change folder was recreated in worktree `nice-mayer-9c0cd2`; an older copy (change.md + frame.md) sits untracked in the main working dir — reconcile before merge.
