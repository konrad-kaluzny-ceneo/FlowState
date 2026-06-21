import { describe, expect, it } from "vitest";

import {
	END_SESSION_CONFIRM_BODY,
	END_SESSION_CONFIRM_CANCEL_LABEL,
	END_SESSION_CONFIRM_LABEL,
	END_SESSION_CONFIRM_TITLE,
} from "./end-session-copy";

describe("end-session-copy", () => {
	it("exports non-empty calm strings without exclamation marks", () => {
		const copy = [
			END_SESSION_CONFIRM_TITLE,
			END_SESSION_CONFIRM_BODY,
			END_SESSION_CONFIRM_LABEL,
			END_SESSION_CONFIRM_CANCEL_LABEL,
		];

		for (const line of copy) {
			expect(line.trim().length).toBeGreaterThan(0);
			expect(line).not.toMatch(/!/);
		}
	});

	it("uses invitational tone for ending while a cycle is active", () => {
		const joined = [
			END_SESSION_CONFIRM_TITLE,
			END_SESSION_CONFIRM_BODY,
			END_SESSION_CONFIRM_LABEL,
			END_SESSION_CONFIRM_CANCEL_LABEL,
		].join(" ");

		expect(joined).toMatch(/session|cycle|end/i);
		expect(joined).not.toMatch(/wrong|mistake|must/i);
	});
});
