import { describe, expect, it } from "vitest";

import { getCatchUpCopy } from "./copy";

const endedAgo = "2 minutes ago";

describe("getCatchUpCopy", () => {
	it("includes task title for work confirm gate", () => {
		const copy = getCatchUpCopy("WORK_CONFIRM", {
			taskTitle: "Write tests",
			cycleKind: "WORK",
			endedAgo,
		});

		expect(copy.headline).toContain("Write tests");
		expect(copy.subcopy).toMatch(/confirm|next/i);
	});

	it("references break kind for break confirm gate", () => {
		const copy = getCatchUpCopy("BREAK_CONFIRM", {
			cycleKind: "SHORT_BREAK",
			endedAgo,
		});

		expect(copy.headline).toMatch(/break/i);
		expect(copy.subcopy).toMatch(/next/i);
	});

	it("names check-in as next action", () => {
		const copy = getCatchUpCopy("CHECK_IN", { endedAgo });

		expect(copy.headline).toMatch(/work/i);
		expect(copy.subcopy).toMatch(/check-in|energy/i);
	});

	it("names suggestion accept as next action", () => {
		const copy = getCatchUpCopy("SUGGESTION_ACCEPT", { endedAgo });

		expect(copy.subcopy).toMatch(/suggestion|task/i);
	});
});
