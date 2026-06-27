"use client";

import { useLocale } from "next-intl";

import {
	OverlayCard,
	OverlayScrim,
	overlayButtonClass,
} from "~/app/_components/overlay-shell";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getClosureDismissLabel,
	getClosureTitle,
} from "~/lib/session/narrative-copy";

type SessionClosureOverlayProps = {
	closureLine: string;
	onDismiss: () => void;
};

export function SessionClosureOverlay({
	closureLine,
	onDismiss,
}: SessionClosureOverlayProps) {
	const locale = useLocale() as UserLocale;
	const title = getClosureTitle(locale);
	const dismissLabel = getClosureDismissLabel(locale);

	return (
		<OverlayScrim
			ariaDescribedBy="session-closure-description"
			ariaLabelledBy="session-closure-heading"
			onEscape={onDismiss}
			role="dialog"
			testId="session-closure-overlay"
			zIndex={58}
		>
			<OverlayCard>
				<h2
					className="font-semibold text-2xl text-primary"
					id="session-closure-heading"
				>
					{title}
				</h2>
				<p
					className="mt-4 text-sm text-text-secondary"
					data-testid="session-closure-line"
					id="session-closure-description"
				>
					{closureLine}
				</p>
				<button
					className={`${overlayButtonClass.primaryFull} mt-8`}
					data-testid="session-closure-dismiss-btn"
					onClick={onDismiss}
					type="button"
				>
					{dismissLabel}
				</button>
			</OverlayCard>
		</OverlayScrim>
	);
}
