import { describe, expect, it } from "vitest";

import {
	POST_MERGE_CHECK_IN_COACH_LINE,
	SUGGESTION_COACH_LINE,
} from "~/lib/onboarding/copy";
import {
	completeAuthenticatedWedgeCoach,
	isPostMergeWedgeCoachActive,
	resolveCheckInCoachLine,
	resolveSuggestionCoachLine,
} from "~/lib/onboarding/post-merge-wedge-coach";
import { DEFAULT_ONBOARDING_STATE } from "~/lib/onboarding/types";

describe("post-merge wedge coach", () => {
	const eligible = {
		...DEFAULT_ONBOARDING_STATE,
		authenticatedWedgeCoachEligible: true,
	};

	it("is active when eligible and not yet seen", () => {
		expect(isPostMergeWedgeCoachActive(eligible)).toBe(true);
	});

	it("is inactive after bridge complete", () => {
		expect(
			isPostMergeWedgeCoachActive({
				...eligible,
				hasSeenAuthenticatedWedge: true,
			}),
		).toBe(false);
	});

	it("uses post-merge check-in copy when active", () => {
		expect(resolveCheckInCoachLine(eligible, true)).toBe(
			POST_MERGE_CHECK_IN_COACH_LINE,
		);
	});

	it("uses default check-in copy for direct sign-up", () => {
		expect(resolveCheckInCoachLine(DEFAULT_ONBOARDING_STATE, true)).toContain(
			"energy",
		);
	});

	it("uses persona-aware suggestion copy when preset label present", () => {
		const line = resolveSuggestionCoachLine(eligible, true, "Synchro");
		expect(line).toContain("Synchro");
	});

	it("uses default suggestion copy when not post-merge", () => {
		expect(
			resolveSuggestionCoachLine(DEFAULT_ONBOARDING_STATE, true, null),
		).toBe(SUGGESTION_COACH_LINE);
	});

	it("completes bridge flags on suggestion seen", () => {
		expect(completeAuthenticatedWedgeCoach(eligible)).toEqual({
			suggestionCoachSeen: true,
			hasSeenAuthenticatedWedge: true,
			authenticatedWedgeCoachEligible: false,
		});
	});
});
