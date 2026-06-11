import type { ScoringContext } from "./score-task";

export type RationaleKey =
	| "energy_deep"
	| "energy_light"
	| "fatigue"
	| "late_day"
	| "interruptions"
	| "override_preference"
	| "eisenhower_priority"
	| "importance_focus"
	| "low_effort_fit"
	| "horizon_asap"
	| "kickoff_fresh"
	| "kickoff_resume"
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
		case "eisenhower_priority":
			return "High urgency and importance — top of the queue";
		case "importance_focus":
			return "Important work — good moment while you're focused";
		case "low_effort_fit":
			return "Quick win — fits your fading energy";
		case "horizon_asap":
			return "Due ASAP — time-sensitive commitment";
		case "kickoff_fresh":
			return "Fresh session — here's a strong starting point";
		case "kickoff_resume":
			return "Back from break — ready for your next focus block";
		default:
			return "Next up based on your energy and task mix";
	}
}
