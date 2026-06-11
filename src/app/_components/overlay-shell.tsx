"use client";

import type { ReactNode } from "react";

const Z_INDEX_CLASS = {
	50: "z-50",
	58: "z-[58]",
	60: "z-[60]",
} as const;

type OverlayZIndex = keyof typeof Z_INDEX_CLASS;

type OverlayCardVariant = "default" | "break" | "suggestion";

const CARD_VARIANT_CLASS: Record<OverlayCardVariant, string> = {
	default: "border-border-subtle bg-surface-overlay",
	break: "border-border-break bg-surface-break",
	suggestion:
		"border-border-subtle bg-surface-overlay ring-1 ring-amber-400/20",
};

type OverlayScrimProps = {
	children: ReactNode;
	testId: string;
	zIndex?: OverlayZIndex;
	role?: "dialog" | "presentation";
	cycleId?: number;
};

export function OverlayScrim({
	children,
	testId,
	zIndex = 50,
	role = "presentation",
	cycleId,
}: OverlayScrimProps) {
	return (
		<div
			className={`overlay-enter fixed inset-0 ${Z_INDEX_CLASS[zIndex]} flex items-center justify-center bg-black/60 p-4`}
			data-cycle-id={cycleId}
			data-testid={testId}
			role={role}
		>
			{children}
		</div>
	);
}

type OverlayCardProps = {
	children: ReactNode;
	variant?: OverlayCardVariant;
	className?: string;
	maxWidth?: "md" | "lg";
	padding?: "p-6" | "p-8";
	centered?: boolean;
};

export function OverlayCard({
	children,
	variant = "default",
	className = "",
	maxWidth = "md",
	padding = "p-8",
	centered = true,
}: OverlayCardProps) {
	const widthClass = maxWidth === "lg" ? "max-w-lg" : "max-w-md";
	const alignClass = centered ? "text-center" : "";

	return (
		<div
			className={`overlay-enter w-full ${widthClass} rounded-xl border shadow-xl ${CARD_VARIANT_CLASS[variant]} ${padding} ${alignClass} ${className}`}
		>
			{children}
		</div>
	);
}

export const overlayButtonClass = {
	primary:
		"rounded-lg bg-accent-cta py-3 font-semibold text-white transition hover:bg-accent-cta-hover disabled:opacity-50",
	primaryFull:
		"w-full rounded-lg bg-accent-cta py-3 font-semibold text-white transition hover:bg-accent-cta-hover disabled:opacity-50",
	secondary:
		"rounded-lg border border-border-subtle bg-white/5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50",
	secondaryFull:
		"w-full rounded-lg border border-border-subtle bg-white/5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-50",
	success:
		"rounded-lg bg-accent-success py-3 font-semibold text-white transition hover:bg-green-500 disabled:opacity-50",
	breakPrimary:
		"w-full rounded-lg bg-accent-break py-3 font-semibold text-white transition hover:bg-teal-500 disabled:opacity-50",
	breakSecondary:
		"w-full rounded-lg border border-border-break py-3 font-semibold text-teal-100 transition hover:bg-teal-500/20 disabled:opacity-50",
} as const;
