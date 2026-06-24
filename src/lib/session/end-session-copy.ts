/** Confirm overlay copy for ending a session while a cycle is running or paused (B-08, T-04). */
export const END_SESSION_CONFIRM_TITLE = "End this session?";

export const END_SESSION_CONFIRM_BODY =
	"The current cycle will stop and you'll see a short session summary. You can start fresh whenever you're ready.";

export const END_SESSION_CONFIRM_LABEL = "End session";

export const END_SESSION_CONFIRM_CANCEL_LABEL = "Keep going";

/** B-09: user paused first — remaining time is frozen before closure confirm. */
export const PAUSE_AND_END_SESSION_CONFIRM_TITLE = "End session while paused?";

export const PAUSE_AND_END_SESSION_CONFIRM_BODY =
	"Your timer is paused. Ending now will close the session and show a short summary — you can return when you're ready.";

export const PAUSE_AND_END_SESSION_CONFIRM_LABEL = "End session";

export const PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL = "Stay paused";

export type EndSessionConfirmVariant = "immediate" | "after-pause";

export function getEndSessionConfirmCopy(variant: EndSessionConfirmVariant) {
	if (variant === "after-pause") {
		return {
			title: PAUSE_AND_END_SESSION_CONFIRM_TITLE,
			body: PAUSE_AND_END_SESSION_CONFIRM_BODY,
			confirmLabel: PAUSE_AND_END_SESSION_CONFIRM_LABEL,
			cancelLabel: PAUSE_AND_END_SESSION_CONFIRM_CANCEL_LABEL,
		};
	}

	return {
		title: END_SESSION_CONFIRM_TITLE,
		body: END_SESSION_CONFIRM_BODY,
		confirmLabel: END_SESSION_CONFIRM_LABEL,
		cancelLabel: END_SESSION_CONFIRM_CANCEL_LABEL,
	};
}
