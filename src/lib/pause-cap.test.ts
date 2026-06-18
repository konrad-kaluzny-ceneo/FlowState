import { describe, expect, it } from "vitest";

import { PAUSE_CAP_MS } from "~/lib/pause-cap";

describe("PAUSE_CAP_MS", () => {
	it("defaults to 30 minutes", () => {
		expect(PAUSE_CAP_MS).toBe(30 * 60 * 1000);
	});
});
