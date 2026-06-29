"use client";

import { useTranslations } from "next-intl";

import { GuestBanner } from "~/app/_components/guest-banner";

function GuestRailBlock({
	children,
	testId,
}: {
	children: React.ReactNode;
	testId: string;
}) {
	return (
		<div
			className="w-full max-w-lg rounded-lg border border-border-subtle bg-surface-panel/50 px-4 py-3 text-sm text-text-secondary lg:max-w-none"
			data-testid={testId}
		>
			{children}
		</div>
	);
}

export function GuestContextRail() {
	const t = useTranslations("Guest.rail");

	return (
		<>
			<GuestRailBlock testId="guest-rail-value-prop">
				<p className="text-text-primary">{t("valueProp")}</p>
			</GuestRailBlock>
			<GuestBanner variant="rail-activation" />
			<GuestRailBlock testId="guest-rail-guidance">
				<p>{t("guidance")}</p>
			</GuestRailBlock>
		</>
	);
}
