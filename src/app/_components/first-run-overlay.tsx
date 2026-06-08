"use client";

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
		<div
			className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
			data-testid="first-run-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">{title}</h2>
				<p className="mt-4 text-sm text-white/70">{body}</p>
				<button
					className="mt-8 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500"
					data-testid="first-run-dismiss-btn"
					onClick={onDismiss}
					type="button"
				>
					{dismissLabel}
				</button>
			</div>
		</div>
	);
}
