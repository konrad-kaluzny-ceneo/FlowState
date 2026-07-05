"use client";

import type { ReactNode } from "react";

type ComingSoonPreviewProps = {
	label: string;
	children: ReactNode;
	testId?: string;
};

export function ComingSoonPreview({
	label,
	children,
	testId = "coming-soon-preview",
}: ComingSoonPreviewProps) {
	return (
		<div
			className="relative overflow-hidden rounded-card border border-card-border bg-surface-card shadow-sm"
			data-testid={testId}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none select-none blur-[6px]"
				data-testid={`${testId}-mock`}
			>
				{children}
			</div>
			<div aria-hidden="true" className="absolute inset-0 bg-scrim/85" />
			<div className="absolute inset-0 flex items-center justify-center p-6">
				<p
					className="text-center font-semibold text-sm text-text-section tracking-wide"
					data-testid={`${testId}-label`}
				>
					{label}
				</p>
			</div>
		</div>
	);
}
