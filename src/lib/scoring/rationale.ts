import type { ScoringContext } from "./score-task";

export type RationaleKey =
	| "energy_deep"
	| "energy_light"
	| "fatigue"
	| "late_day"
	| "interruptions"
	| "override_preference"
	| "default";

export function buildRationale(
	key: RationaleKey,
	context: ScoringContext,
): string {
	switch (key) {
		case "energy_deep":
			return "Deep work — you're focused with few interruptions";
		case "energy_light":
			return "Light ops — energy fading, better suited for lighter tasks";
		case "fatigue":
			return context.completedWorkCycles >= 2
				? `Light admin — energy dipping after ${context.completedWorkCycles} cycles`
				: "Light admin — session fatigue building";
		case "late_day":
			return "Light task — late in the day, save deep work for tomorrow";
		case "interruptions":
			return "Reactive work — session had several interruptions";
		case "override_preference":
			return "Matches your last pick — continuing that thread";
		default:
			return "Next up based on your energy and task mix";
	}
}
