"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import {
	WIND_DOWN_BODY,
	WIND_DOWN_END_SESSION_LABEL,
	WIND_DOWN_KEEP_GOING_LABEL,
	WIND_DOWN_TITLE,
} from "~/lib/session/wind-down-copy";

type WindDownOverlayProps = {
	rationale: string;
	onKeepGoing: () => void;
	onEndSession: () => void;
	isSubmitting?: boolean;
};

export function WindDownOverlay({
	rationale,
	onKeepGoing,
	onEndSession,
	isSubmitting = false,
}: WindDownOverlayProps) {
	return (
		<OverlayScrim
			ariaDescribedBy="wind-down-description"
			ariaLabelledBy="wind-down-heading"
			role="dialog"
			testId="wind-down-overlay"
			zIndex={58}
		>
			<OverlayCard>
				<h2
					className="font-semibold text-2xl text-primary"
					id="wind-down-heading"
				>
					{WIND_DOWN_TITLE}
				</h2>
				<p
					className="mt-4 text-sm text-text-secondary"
					id="wind-down-description"
				>
					{WIND_DOWN_BODY}
				</p>
				<p
					className="mt-2 text-accent-cta/70 text-xs"
					data-testid="wind-down-rationale"
				>
					{rationale}
				</p>
				<div className="mt-8 flex flex-col gap-3">
					<button
						className={`${overlayButtonClass.primaryFull} disabled:cursor-not-allowed`}
						data-testid="wind-down-keep-going-btn"
						disabled={isSubmitting}
						onClick={onKeepGoing}
						type="button"
					>
						{WIND_DOWN_KEEP_GOING_LABEL}
					</button>
					<button
						className="w-full rounded-lg border border-border-subtle py-3 text-sm text-text-secondary transition hover:border-red-400/40 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="wind-down-end-session-btn"
						disabled={isSubmitting}
						onClick={onEndSession}
						type="button"
					>
						{WIND_DOWN_END_SESSION_LABEL}
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
