"use client";

import type { MergeSuccessCopy } from "~/lib/guest/merge-copy";

type MergeSuccessOverlayProps = {
	copy: MergeSuccessCopy;
	visible: boolean;
	onDismiss: () => void;
};

type ParsedMergeBody = {
	countLine: string;
	previewTitles: string[];
	overflowHint: string | null;
	unlockLine: string;
};

function parseMergeSuccessBody(body: string): ParsedMergeBody {
	const sections = body.split("\n\n").filter((section) => section.length > 0);

	if (sections.length === 0) {
		return {
			countLine: "",
			previewTitles: [],
			overflowHint: null,
			unlockLine: "",
		};
	}

	if (sections.length === 1) {
		return {
			countLine: sections[0] ?? "",
			previewTitles: [],
			overflowHint: null,
			unlockLine: "",
		};
	}

	const countLine = sections[0] ?? "";
	const unlockLine = sections[sections.length - 1] ?? "";
	const previewTitles: string[] = [];
	let overflowHint: string | null = null;

	for (const section of sections.slice(1, -1)) {
		for (const line of section.split("\n")) {
			if (line.startsWith("• ")) {
				previewTitles.push(line.slice(2));
			} else if (line.startsWith("+ ")) {
				overflowHint = line;
			}
		}
	}

	return { countLine, previewTitles, overflowHint, unlockLine };
}

export function MergeSuccessOverlay({
	copy,
	visible,
	onDismiss,
}: MergeSuccessOverlayProps) {
	if (!visible) {
		return null;
	}

	const { title, body, dismissLabel } = copy;
	const { countLine, previewTitles, overflowHint, unlockLine } =
		parseMergeSuccessBody(body);

	return (
		<div
			className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
			data-testid="merge-success-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">{title}</h2>
				<div className="mt-4 text-left text-sm text-white/70">
					{countLine.length > 0 && <p>{countLine}</p>}
					{previewTitles.length > 0 && (
						<ul className="mt-3 list-disc space-y-1 pl-5">
							{previewTitles.map((previewTitle) => (
								<li key={previewTitle}>{previewTitle}</li>
							))}
						</ul>
					)}
					{overflowHint != null && (
						<p className="mt-2 text-white/60">{overflowHint}</p>
					)}
					{unlockLine.length > 0 && <p className="mt-4">{unlockLine}</p>}
				</div>
				<button
					className="mt-8 w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-500"
					data-testid="merge-success-dismiss-btn"
					onClick={onDismiss}
					type="button"
				>
					{dismissLabel}
				</button>
			</div>
		</div>
	);
}
