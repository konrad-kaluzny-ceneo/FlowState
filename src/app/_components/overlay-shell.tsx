"use client";

import {
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
} from "react";

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
		"border-border-subtle bg-surface-overlay ring-1 ring-accent-suggestion",
};

const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
	).filter((element) => !element.hasAttribute("disabled"));
}

type OverlayScrimProps = {
	children: ReactNode;
	testId: string;
	zIndex?: OverlayZIndex;
	role?: "dialog" | "presentation";
	cycleId?: number;
	/** Modal gate: stable id of the visible heading element */
	ariaLabelledBy?: string;
	/** Modal gate: optional id of supporting description copy */
	ariaDescribedBy?: string;
	/** Modal gate: first interactive control (default) or labelled dialog container */
	initialFocus?: "first-control" | "dialog";
	/** Modal gate: wired only where a non-destructive dismiss path already exists */
	onEscape?: () => void;
};

export function OverlayScrim({
	children,
	testId,
	zIndex = 50,
	role = "presentation",
	cycleId,
	ariaLabelledBy,
	ariaDescribedBy,
	initialFocus = "first-control",
	onEscape,
}: OverlayScrimProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const isModal = role === "dialog";

	useEffect(() => {
		if (!isModal) {
			return;
		}

		const container = containerRef.current;
		if (container == null) {
			return;
		}

		const previousFocus = document.activeElement as HTMLElement | null;
		const focusables = getFocusableElements(container);

		if (initialFocus === "first-control" && focusables.length > 0) {
			focusables[0]?.focus();
		} else {
			container.focus();
		}

		return () => {
			if (previousFocus?.isConnected) {
				previousFocus.focus();
			}
		};
	}, [initialFocus, isModal]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (!isModal) {
				return;
			}

			if (event.key === "Escape" && onEscape != null) {
				event.preventDefault();
				event.stopPropagation();
				onEscape();
				return;
			}

			if (event.key !== "Tab") {
				return;
			}

			const container = containerRef.current;
			if (container == null) {
				return;
			}

			const focusables = getFocusableElements(container);
			if (focusables.length === 0) {
				event.preventDefault();
				container.focus();
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement;

			if (event.shiftKey) {
				if (active === first || active === container) {
					event.preventDefault();
					last?.focus();
				}
				return;
			}

			if (active === last) {
				event.preventDefault();
				first?.focus();
			}
		},
		[isModal, onEscape],
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal scrim is role="dialog" with keyboard focus lifecycle
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-* apply only when role="dialog"
		<div
			aria-describedby={isModal ? ariaDescribedBy : undefined}
			aria-labelledby={isModal ? ariaLabelledBy : undefined}
			aria-modal={isModal ? true : undefined}
			className={`overlay-enter fixed inset-0 ${Z_INDEX_CLASS[zIndex]} flex items-center justify-center bg-scrim p-4`}
			data-cycle-id={cycleId}
			data-testid={testId}
			onKeyDown={handleKeyDown}
			ref={containerRef}
			role={role}
			tabIndex={isModal ? -1 : undefined}
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
		"rounded-lg bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50",
	primaryFull:
		"w-full rounded-lg bg-accent-cta py-3 font-semibold text-on-cta transition hover:bg-accent-cta-hover disabled:opacity-50",
	secondary:
		"rounded-lg border border-border-subtle bg-surface-panel py-3 font-semibold text-primary transition hover:bg-surface-card-muted disabled:opacity-50",
	secondaryFull:
		"w-full rounded-lg border border-border-subtle bg-surface-panel py-3 font-semibold text-primary transition hover:bg-surface-card-muted disabled:opacity-50",
	success:
		"rounded-lg bg-accent-success py-3 font-semibold text-on-cta transition hover:opacity-90 disabled:opacity-50",
	breakPrimary:
		"w-full rounded-lg bg-accent-break py-3 font-semibold text-on-cta transition hover:opacity-90 disabled:opacity-50",
	breakSecondary:
		"w-full rounded-lg border border-border-break py-3 font-semibold text-accent-break transition hover:bg-surface-panel disabled:opacity-50",
} as const;
