"use client";

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
		<div
			className="fixed inset-0 z-[58] flex items-center justify-center bg-black/60 p-4"
			data-testid="wind-down-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">{WIND_DOWN_TITLE}</h2>
				<p className="mt-4 text-sm text-white/70">{WIND_DOWN_BODY}</p>
				<p
					className="mt-2 text-purple-200/70 text-xs"
					data-testid="wind-down-rationale"
				>
					{rationale}
				</p>
				<div className="mt-8 flex flex-col gap-3">
					<button
						className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="wind-down-keep-going-btn"
						disabled={isSubmitting}
						onClick={onKeepGoing}
						type="button"
					>
						{WIND_DOWN_KEEP_GOING_LABEL}
					</button>
					<button
						className="w-full rounded-lg border border-white/20 py-3 text-sm text-white/60 transition hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
						data-testid="wind-down-end-session-btn"
						disabled={isSubmitting}
						onClick={onEndSession}
						type="button"
					>
						{WIND_DOWN_END_SESSION_LABEL}
					</button>
				</div>
			</div>
		</div>
	);
}
