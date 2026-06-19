// @vitest-environment node

import { describe, expect, it } from "vitest";
import { suggestTestCommands } from "./test-catalog.mjs";

describe("suggestTestCommands", () => {
	it("returns hook vitest for default timer hub target", () => {
		const commands = suggestTestCommands([], "src/hooks/use-pomodoro-cycle.ts");
		expect(commands).toContain(
			"pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx",
		);
	});

	it("adds belt e2e when an e2e path co-changed", () => {
		const commands = suggestTestCommands(
			[{ path: "e2e/pomodoro-cycle.spec.ts", count: 3 }],
			"src/hooks/use-pomodoro-cycle.ts",
		);
		expect(commands).toContain("set CI=true && pnpm test:e2e:belt");
	});

	it("deduplicates commands and caps at four", () => {
		const commands = suggestTestCommands(
			[
				{ path: "e2e/pomodoro-cycle.spec.ts", count: 1 },
				{ path: "e2e/helpers/work-cycle.ts", count: 1 },
				{
					path: "src/hooks/use-pomodoro-cycle.test.tsx",
					count: 5,
				},
				{
					path: "src/app/_components/pomodoro-dashboard.tsx",
					count: 2,
				},
			],
			"src/hooks/use-pomodoro-cycle.ts",
		);

		expect(commands.length).toBeLessThanOrEqual(4);
		expect(new Set(commands).size).toBe(commands.length);
	});

	it("falls back to pnpm test for unrelated paths", () => {
		const commands = suggestTestCommands([], "src/lib/utils.ts");
		expect(commands).toEqual(["pnpm test"]);
	});
});
