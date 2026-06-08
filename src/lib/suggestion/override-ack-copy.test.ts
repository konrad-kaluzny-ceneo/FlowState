import { describe, expect, it } from "vitest";

import {
	OVERRIDE_ACK_LINE,
	OVERRIDE_ACK_VISIBLE_MS,
} from "~/lib/suggestion/override-ack-copy";

describe("override-ack-copy", () => {
	it("uses neutral validating copy", () => {
		expect(OVERRIDE_ACK_LINE).toMatch(/noted/i);
		expect(OVERRIDE_ACK_LINE).not.toMatch(/wrong|mistake|should/i);
	});

	it("auto-dismiss window is at least one second", () => {
		expect(OVERRIDE_ACK_VISIBLE_MS).toBeGreaterThanOrEqual(1_000);
	});
});
