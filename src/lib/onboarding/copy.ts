export type FirstRunMode = "guest" | "authenticated";

export type FirstRunCopy = {
	title: string;
	body: string;
	dismissLabel: string;
};

export function getFirstRunCopy(mode: FirstRunMode): FirstRunCopy {
	if (mode === "guest") {
		return {
			title: "Welcome to FlowState",
			body: "Add a task, tap Focus on it, then start a focus cycle. When you're ready for more, sign in to unlock energy check-ins and smart task suggestions after each cycle.",
			dismissLabel: "Got it",
		};
	}

	return {
		title: "Your wedge workflow",
		body: "When a focus cycle ends, you'll get a quick energy check-in. FlowState then suggests your best next task with a short rationale — accept the suggestion or pick any other task to focus.",
		dismissLabel: "Got it",
	};
}

export const CHECK_IN_COACH_LINE =
	"This quick check-in helps FlowState suggest what fits your energy.";

export const SUGGESTION_COACH_LINE =
	"Accept the suggestion or tap Focus on any other task — you're always in control.";

export const POST_MERGE_CHECK_IN_COACH_LINE =
	"Now that you're signed in, this check-in unlocks personalized next-task suggestions.";

export const POST_MERGE_SUGGESTION_COACH_LINE =
	"FlowState picked this based on your energy — accept it or choose any task.";

export const POST_MERGE_SUGGESTION_COACH_WITH_PRESET_LINE =
	"Your {preset} preset helped shape this pick — accept it or choose any task.";

export function getPostMergeSuggestionCoachLine(
	personaPresetLabel: string | null,
): string {
	if (personaPresetLabel != null && personaPresetLabel.length > 0) {
		return POST_MERGE_SUGGESTION_COACH_WITH_PRESET_LINE.replace(
			"{preset}",
			personaPresetLabel,
		);
	}
	return POST_MERGE_SUGGESTION_COACH_LINE;
}

export const PRESET_COACH_LINE =
	"Presets pre-fill work type and priority — tap Custom if you want full control.";

export type AuthPageVariant = "sign-in" | "sign-up";

export type AuthValueCopy = {
	subtitle?: string;
	valueBlock?: { heading: string; lines: string[] };
};

export function getAuthValueCopy(variant: AuthPageVariant): AuthValueCopy {
	if (variant === "sign-in") {
		return {
			subtitle:
				"Mindful focus cycles on your tasks — sign in to unlock full sessions, energy check-ins, and session-aware suggestions.",
		};
	}

	return {
		valueBlock: {
			heading: "Your mindful Pomodoro workflow",
			lines: [
				"Run focus cycles on the tasks you choose, one at a time.",
				"After each cycle, log a quick energy check-in.",
				"FlowState suggests your best next task with a short rationale.",
			],
		},
	};
}
