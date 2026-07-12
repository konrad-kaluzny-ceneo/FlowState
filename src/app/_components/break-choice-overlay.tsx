"use client";

import { useTranslations } from "next-intl";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";

type BreakChoiceOverlayProps = {
	suggestedKind: "SHORT_BREAK" | "LONG_BREAK";
	onChoose: (kind: "SHORT_BREAK" | "LONG_BREAK") => void;
	isSubmitting?: boolean;
};

export function BreakChoiceOverlay({
	suggestedKind,
	onChoose,
	isSubmitting = false,
}: BreakChoiceOverlayProps) {
	const t = useTranslations("BreakChoice");

	return (
		<OverlayScrim
			ariaDescribedBy="break-choice-description"
			ariaLabelledBy="break-choice-heading"
			role="dialog"
			testId="break-choice-overlay"
		>
			<OverlayCard>
				<h2
					className="font-semibold text-2xl text-primary"
					id="break-choice-heading"
				>
					{t("heading")}
				</h2>
				<p
					className="mt-2 text-sm text-text-secondary"
					id="break-choice-description"
				>
					{t("description")}
				</p>
				<div className="mt-6 flex flex-col gap-3">
					<button
						aria-label={
							suggestedKind === "SHORT_BREAK"
								? t("shortLabelSuggested")
								: t("shortLabel")
						}
						className={
							suggestedKind === "SHORT_BREAK"
								? overlayButtonClass.primaryFull
								: overlayButtonClass.secondaryFull
						}
						data-testid="break-choice-short"
						disabled={isSubmitting}
						onClick={() => onChoose("SHORT_BREAK")}
						type="button"
					>
						{t("shortLabel")}
						{suggestedKind === "SHORT_BREAK" && (
							<span aria-label={t("suggestedAria")} className="ml-2" role="img">
								★
							</span>
						)}
					</button>
					<button
						aria-label={
							suggestedKind === "LONG_BREAK"
								? t("longLabelSuggested")
								: t("longLabel")
						}
						className={
							suggestedKind === "LONG_BREAK"
								? overlayButtonClass.primaryFull
								: overlayButtonClass.secondaryFull
						}
						data-testid="break-choice-long"
						disabled={isSubmitting}
						onClick={() => onChoose("LONG_BREAK")}
						type="button"
					>
						{t("longLabel")}
						{suggestedKind === "LONG_BREAK" && (
							<span aria-label={t("suggestedAria")} className="ml-2" role="img">
								★
							</span>
						)}
					</button>
				</div>
			</OverlayCard>
		</OverlayScrim>
	);
}
