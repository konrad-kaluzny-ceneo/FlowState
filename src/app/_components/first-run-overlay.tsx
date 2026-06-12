"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import { type FirstRunMode, getFirstRunCopy } from "~/lib/onboarding/copy";

type FirstRunOverlayProps = {
	mode: FirstRunMode;
	onDismiss: () => void;
	visible: boolean;
};

export function FirstRunOverlay({
	mode,
	onDismiss,
	visible,
}: FirstRunOverlayProps) {
	if (!visible) {
		return null;
	}

	const { title, body, dismissLabel } = getFirstRunCopy(mode);

	return (
		<OverlayScrim role="dialog" testId="first-run-overlay" zIndex={58}>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">{title}</h2>
				<p className="mt-4 text-sm text-text-secondary">{body}</p>
				<button
					className={`${overlayButtonClass.primaryFull} mt-8`}
					data-testid="first-run-dismiss-btn"
					onClick={onDismiss}
					type="button"
				>
					{dismissLabel}
				</button>
			</OverlayCard>
		</OverlayScrim>
	);
}
