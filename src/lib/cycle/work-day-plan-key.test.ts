import { describe, expect, it } from "vitest";
import { withWorkDayPlanKey } from "~/lib/cycle/work-day-plan-key";

const baseArgs = { cycleId: 42, markTaskDone: true } as const;

describe("withWorkDayPlanKey", () => {
	it("stamps the local date key for authenticated WORK completions", () => {
		expect(
			withWorkDayPlanKey(baseArgs, {
				kind: "WORK",
				mode: "authenticated",
				now: new Date(2026, 6, 4),
			}),
		).toEqual({ ...baseArgs, localDateKey: "2026-07-04" });
	});

	it("returns the input untouched in guest mode", () => {
		const result = withWorkDayPlanKey(baseArgs, {
			kind: "WORK",
			mode: "guest",
		});

		expect(result).toBe(baseArgs);
		expect(result).not.toHaveProperty("localDateKey");
	});

	it("returns the input untouched for break cycles", () => {
		for (const kind of ["SHORT_BREAK", "LONG_BREAK", null] as const) {
			const result = withWorkDayPlanKey(baseArgs, {
				kind,
				mode: "authenticated",
			});

			expect(result).toBe(baseArgs);
			expect(result).not.toHaveProperty("localDateKey");
		}
	});

	it("preserves the completion flags it passes through", () => {
		expect(
			withWorkDayPlanKey(
				{
					cycleId: "opt-1",
					markTaskBlocked: true,
					incrementInterruption: true,
				},
				{ kind: "WORK", mode: "authenticated", now: new Date(2026, 0, 9) },
			),
		).toEqual({
			cycleId: "opt-1",
			markTaskBlocked: true,
			incrementInterruption: true,
			localDateKey: "2026-01-09",
		});
	});
});
