---
project: FlowState
type: lessons
created: 2026-05-28
updated: 2026-05-28
---

# Lessons learned

Recurring rules and pitfalls surfaced during implementation. Referenced by `/10x-plan` and `/10x-implement` to avoid repeat mistakes.

---

## L-01: Never create duplicate Linear issues for existing roadmap items

**Trigger:** `/10x-linear-backlog` or any issue-creation flow for a roadmap slice.

**Rule:** Before creating a Linear issue for a roadmap item, check if a `FLO-*` ID already exists in `roadmap.md` for that Change ID. If it does, use the existing issue — never create a second one.

**What went wrong:** On 2026-05-27, a second sync run created FLO-15–18 as duplicates of FLO-14, FLO-8, FLO-13, FLO-7. Each duplicate was auto-linked to the same GitHub issue as the canonical. When duplicates were later marked Done/Canceled, the two-way Linear ↔ GitHub sync closed the canonical GitHub issues — breaking the project state.

**Impact:** GitHub issues #7, #9, #13 were incorrectly closed. Required manual reopen and attachment cleanup.

---

## L-02: Detach GitHub attachment before canceling a duplicate Linear issue

**Trigger:** Canceling or closing a Linear issue that shares a GitHub attachment with another (canonical) issue.

**Rule:** Always delete the GitHub attachment from the duplicate Linear issue *before* changing its status to Canceled or Done. The two-way sync fires on status change — if the attachment is still present at that moment, it will close the linked GitHub issue.

**Sequence:**
1. Delete attachment (Linear MCP `delete_attachment`)
2. Set status to Canceled (`save_issue` state=Canceled)

Never reverse this order.

**What went wrong:** FLO-15 (duplicate of FLO-14) was marked Done while still linked to GitHub #6. FLO-16/17/18 were canceled while still linked to #7/#13/#9. The sync closed all linked GitHub issues.

---

## L-03: Verify Linear ↔ GitHub sync after any bulk status change

**Trigger:** Changing status on more than one Linear or GitHub issue in a single session.

**Rule:** After bulk changes, run the verification table from the `update-status` skill for every affected pair. Don't assume the sync handled it correctly — especially when canceled/closed issues share attachments with open ones.

**Check:** `gh issue list --state all --json number,title,state` + Linear MCP `list_issues` filtered by team.
