"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import {
	type EndSessionConfirmVariant,
	getEndSessionConfirmCopy,
} from "~/lib/session/end-session-copy";

type EndSessionConfirmOverlayProps = {
	onConfirm: () => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	variant?: EndSessionConfirmVariant;
};

export function EndSessionConfirmOverlay({
	onConfirm,
	onCancel,
	isSubmitting = false,
	variant = "immediate",
}: EndSessionConfirmOverlayProps) {
	const copy = getEndSessionConfirmCopy(variant);

	return (
		<OverlayScrim
			role="dialog"
			testId="end-session-confirm-overlay"
			zIndex={58}
		>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">{copy.title}</h2>
				<p className="mt-4 text-sm text-text-secondary">{copy.body}</p>
				<div className="mt-8 flex flex-col gap-3">
					<button
						className={`${overlayButtonClass.primaryFull} disabled:cursor-not-allowed`}
						data-testid="end-session-confirm-btn"
						disabled={isSubmitting}
						onClick={onConfirm}
						type="button"
					>
						{copy.confirmLabel}
					</button>
					<button
						className={overlayButtonClass.secondaryFull}
						data-testid="end-session-confirm-cancel-btn"
						disabled={isSubmitting}
						onClick={onCancel}
						type="button"
					>
						{copy.cancelLabel}
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
