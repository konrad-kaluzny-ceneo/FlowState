import { describe, expect, it } from "vitest";

import {
	END_SESSION_BREAK_CONFIRM_BODY,
	END_SESSION_CONFIRM_BODY,
	END_SESSION_CONFIRM_CANCEL_LABEL,
	END_SESSION_CONFIRM_LABEL,
	END_SESSION_CONFIRM_TITLE,
	getEndSessionConfirmCopy,
	PAUSE_AND_END_SESSION_BREAK_CONFIRM_BODY,
	PAUSE_AND_END_SESSION_CONFIRM_BODY,
	PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL,
	PAUSE_AND_END_SESSION_CONFIRM_LABEL,
	PAUSE_AND_END_SESSION_CONFIRM_TITLE,
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

	it("exports distinct after-pause copy for B-09", () => {
		const afterPause = getEndSessionConfirmCopy("after-pause");
		expect(afterPause.title).toBe(PAUSE_AND_END_SESSION_CONFIRM_TITLE);
		expect(afterPause.body).toBe(PAUSE_AND_END_SESSION_CONFIRM_BODY);
		expect(afterPause.confirmLabel).toBe(PAUSE_AND_END_SESSION_CONFIRM_LABEL);
		expect(afterPause.cancelLabel).toBe(
			PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL,
		);
		expect(afterPause.body).toMatch(/paused/i);
		expect(afterPause.cancelLabel).toMatch(/Stay paused/i);
	});

	it("sets mid-cycle expectations in confirm copy for WORK only (S-38)", () => {
		const immediate = getEndSessionConfirmCopy("immediate", "work");
		expect(immediate.body).toMatch(/won't be counted/i);
		expect(immediate.body).toMatch(/Finished cycles/i);

		const afterPause = getEndSessionConfirmCopy("after-pause", "work");
		expect(afterPause.body).toMatch(/won't be counted/i);
	});

	it("uses break-neutral copy without focus-block wording", () => {
		const immediate = getEndSessionConfirmCopy("immediate", "break");
		expect(immediate.body).toBe(END_SESSION_BREAK_CONFIRM_BODY);
		expect(immediate.body).not.toMatch(/focus block/i);

		const afterPause = getEndSessionConfirmCopy("after-pause", "break");
		expect(afterPause.body).toBe(PAUSE_AND_END_SESSION_BREAK_CONFIRM_BODY);
		expect(afterPause.body).not.toMatch(/focus block/i);
	});
});
