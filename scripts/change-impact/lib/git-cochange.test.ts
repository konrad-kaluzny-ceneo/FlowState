// @vitest-environment node

import { describe, expect, it } from "vitest";
import { aggregateCommits, normalizeRepoPath } from "./git-cochange.mjs";

describe("normalizeRepoPath", () => {
	it("strips leading ./ and normalizes slashes", () => {
		expect(normalizeRepoPath(".\\src\\hooks\\use-pomodoro-cycle.ts")).toBe(
			"src/hooks/use-pomodoro-cycle.ts",
		);
	});
});

describe("aggregateCommits", () => {
	it("returns empty when no commits touch the target", () => {
		const rows = aggregateCommits(
			[["src/app/_components/task-list.tsx"]],
			"src/hooks/use-pomodoro-cycle.ts",
		);
		expect(rows).toEqual([]);
	});

	it("counts co-changed paths across commits", () => {
		const target = "src/hooks/use-pomodoro-cycle.ts";
		const rows = aggregateCommits(
			[
				[target, "src/hooks/use-pomodoro-cycle.test.tsx"],
				[target, "src/app/_components/pomodoro-dashboard.tsx"],
				[
					target,
					"src/hooks/use-pomodoro-cycle.test.tsx",
					"e2e/pomodoro-cycle.spec.ts",
				],
			],
			target,
		);

		expect(rows[0]).toEqual({
			path: "src/hooks/use-pomodoro-cycle.test.tsx",
			count: 2,
		});
		expect(rows).toContainEqual({
			path: "src/app/_components/pomodoro-dashboard.tsx",
			count: 1,
		});
		expect(rows).toContainEqual({
			path: "e2e/pomodoro-cycle.spec.ts",
			count: 1,
		});
	});

	it("excludes the target path from co-change counts", () => {
		const target = "src/hooks/use-pomodoro-cycle.ts";
		const rows = aggregateCommits([[target]], target);
		expect(rows).toEqual([]);
	});
});
