"use client";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import {
	END_SESSION_CONFIRM_BODY,
	END_SESSION_CONFIRM_CANCEL_LABEL,
	END_SESSION_CONFIRM_LABEL,
	END_SESSION_CONFIRM_TITLE,
} from "~/lib/session/end-session-copy";

type EndSessionConfirmOverlayProps = {
	onConfirm: () => void;
	onCancel: () => void;
	isSubmitting?: boolean;
};

export function EndSessionConfirmOverlay({
	onConfirm,
	onCancel,
	isSubmitting = false,
}: EndSessionConfirmOverlayProps) {
	return (
		<OverlayScrim
			role="dialog"
			testId="end-session-confirm-overlay"
			zIndex={58}
		>
			<OverlayCard>
				<h2 className="font-semibold text-2xl text-primary">
					{END_SESSION_CONFIRM_TITLE}
				</h2>
				<p className="mt-4 text-sm text-text-secondary">
					{END_SESSION_CONFIRM_BODY}
				</p>
				<div className="mt-8 flex flex-col gap-3">
					<button
						className={`${overlayButtonClass.primaryFull} disabled:cursor-not-allowed`}
						data-testid="end-session-confirm-btn"
						disabled={isSubmitting}
						onClick={onConfirm}
						type="button"
					>
						{END_SESSION_CONFIRM_LABEL}
					</button>
					<button
						className={overlayButtonClass.secondaryFull}
						data-testid="end-session-confirm-cancel-btn"
						disabled={isSubmitting}
						onClick={onCancel}
						type="button"
					>
						{END_SESSION_CONFIRM_CANCEL_LABEL}
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
