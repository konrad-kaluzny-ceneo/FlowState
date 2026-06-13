"use client";

import { HANDOFF_DISMISS_LABEL } from "~/lib/session/narrative-copy";

type ReturnHandoffBannerProps = {
	line: string;
	onDismiss: () => void;
	visible: boolean;
};

export function ReturnHandoffBanner({
	line,
	onDismiss,
	visible,
}: ReturnHandoffBannerProps) {
	if (!visible) {
		return null;
	}

	return (
		<div
			className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-panel/80 px-4 py-3 text-center"
			data-testid="return-handoff-banner"
			role="status"
		>
			<p
				className="text-sm text-text-secondary"
				data-testid="return-handoff-line"
			>
				{line}
			</p>
			<button
				className="mt-3 text-accent-cta text-sm underline hover:text-primary"
				data-testid="return-handoff-dismiss-btn"
				onClick={onDismiss}
				type="button"
			>
				{HANDOFF_DISMISS_LABEL}
			</button>
		</div>
	);
}
