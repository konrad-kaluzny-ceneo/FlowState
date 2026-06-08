import { describe, expect, it } from "vitest";

import {
	WIND_DOWN_BODY,
	WIND_DOWN_END_SESSION_LABEL,
	WIND_DOWN_KEEP_GOING_LABEL,
	WIND_DOWN_TITLE,
} from "./wind-down-copy";

describe("wind-down-copy", () => {
	it("uses invitational tone without preachy language", () => {
		const copy = [
			WIND_DOWN_TITLE,
			WIND_DOWN_BODY,
			WIND_DOWN_KEEP_GOING_LABEL,
			WIND_DOWN_END_SESSION_LABEL,
		].join(" ");

		expect(copy).toMatch(/wrap up|keep going|end session/i);
		expect(copy).not.toMatch(/wrong|mistake|should/i);
	});
});
