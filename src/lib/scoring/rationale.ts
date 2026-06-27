import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";
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
	| "capacity_fit"
	| "default";

export function buildRationale(
	key: RationaleKey,
	context: ScoringContext,
	locale: UserLocale = "en",
): string {
	const t = createNamespaceTranslator("Scoring.rationale", locale);

	switch (key) {
		case "energy_deep":
			return t("energy_deep");
		case "energy_light":
			return t("energy_light");
		case "fatigue":
			return context.completedWorkCycles >= 2
				? t("fatigue_many", { cycles: context.completedWorkCycles })
				: t("fatigue");
		case "late_day":
			return t("late_day");
		case "interruptions":
			return t("interruptions");
		case "override_preference":
			return t("override_preference");
		case "eisenhower_priority":
			return t("eisenhower_priority");
		case "importance_focus":
			return t("importance_focus");
		case "low_effort_fit":
			return t("low_effort_fit");
		case "horizon_asap":
			return t("horizon_asap");
		case "kickoff_fresh":
			return t("kickoff_fresh");
		case "kickoff_resume":
			return t("kickoff_resume");
		case "capacity_fit": {
			const minutes = context.remainingFocusMinutes ?? 0;
			return t("capacity_fit", { minutes });
		}
		default:
			return t("default");
	}
}
