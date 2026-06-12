"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import {
	CLOSURE_DISMISS_LABEL,
	CLOSURE_TITLE,
} from "~/lib/session/narrative-copy";

type SessionClosureOverlayProps = {
	closureLine: string;
	onDismiss: () => void;
};

export function SessionClosureOverlay({
	closureLine,
	onDismiss,
}: SessionClosureOverlayProps) {
	return (
		<OverlayScrim role="dialog" testId="session-closure-overlay" zIndex={58}>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">{CLOSURE_TITLE}</h2>
				<p
					className="mt-4 text-sm text-text-secondary"
					data-testid="session-closure-line"
				>
					{closureLine}
				</p>
				<button
					className={`${overlayButtonClass.primaryFull} mt-8`}
					data-testid="session-closure-dismiss-btn"
					onClick={onDismiss}
					type="button"
				>
					{CLOSURE_DISMISS_LABEL}
				</button>
			</OverlayCard>
		</OverlayScrim>
	);
}
