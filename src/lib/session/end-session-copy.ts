/** Confirm overlay copy for ending a session while a cycle is running or paused (B-08, T-04). */
export const END_SESSION_CONFIRM_TITLE = "End this session?";

/** S-38: mid-cycle WORK end — sets closure expectations. */
export const END_SESSION_CONFIRM_BODY =
	"Finished cycles and completed tasks will appear in your summary. This in-progress focus block won't be counted.";

/** B-08: break cycles use cycle-neutral copy (no focus-block / mid-cycle note). */
export const END_SESSION_BREAK_CONFIRM_BODY =
	"The current cycle will stop and you'll see a short session summary. You can start fresh whenever you're ready.";

export const END_SESSION_CONFIRM_LABEL = "End session";

export const END_SESSION_CONFIRM_CANCEL_LABEL = "Keep going";

/** B-09: user paused first — remaining time is frozen before closure confirm. */
export const PAUSE_AND_END_SESSION_CONFIRM_TITLE = "End session while paused?";

/** S-38: paused WORK end. */
export const PAUSE_AND_END_SESSION_CONFIRM_BODY =
	"Finished cycles and completed tasks will appear in your summary. Your paused focus block won't be counted.";

/** B-09: paused break — cycle-neutral copy. */
export const PAUSE_AND_END_SESSION_BREAK_CONFIRM_BODY =
	"Your timer is paused. Ending now will close the session and show a short summary — you can return when you're ready.";

export const PAUSE_AND_END_SESSION_CONFIRM_LABEL = "End session";

export const PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL = "Stay paused";

export type EndSessionConfirmVariant = "immediate" | "after-pause";

/** WORK vs break — S-38 wording applies only during WORK blocks. */
export type EndSessionCycleContext = "work" | "break";

export function getEndSessionConfirmCopy(
	variant: EndSessionConfirmVariant,
	cycleContext: EndSessionCycleContext = "work",
) {
	if (variant === "after-pause") {
		return {
			title: PAUSE_AND_END_SESSION_CONFIRM_TITLE,
			body:
				cycleContext === "work"
					? PAUSE_AND_END_SESSION_CONFIRM_BODY
					: PAUSE_AND_END_SESSION_BREAK_CONFIRM_BODY,
			confirmLabel: PAUSE_AND_END_SESSION_CONFIRM_LABEL,
			cancelLabel: PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL,
		};
	}

	return {
		title: END_SESSION_CONFIRM_TITLE,
		body:
			cycleContext === "work"
				? END_SESSION_CONFIRM_BODY
				: END_SESSION_BREAK_CONFIRM_BODY,
		confirmLabel: END_SESSION_CONFIRM_LABEL,
		cancelLabel: END_SESSION_CONFIRM_CANCEL_LABEL,
	};
}
