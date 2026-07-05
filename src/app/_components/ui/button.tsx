"use client";

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
	primary: "bg-accent-cta text-on-cta hover:bg-accent-cta-hover",
	secondary:
		"border border-border-subtle bg-surface-card text-primary hover:bg-surface-card-muted",
	ghost: "text-primary hover:bg-surface-card-muted",
	danger: "bg-danger text-on-danger hover:bg-danger-hover",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
	sm: "px-4 py-2 text-sm",
	md: "px-6 py-3 text-base",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			variant = "primary",
			size = "md",
			fullWidth = false,
			className = "",
			type = "button",
			children,
			...rest
		},
		ref,
	) => {
		return (
			<button
				className={`inline-flex items-center justify-center gap-2 rounded-control font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${fullWidth ? "w-full" : ""} ${className}`}
				ref={ref}
				type={type}
				{...rest}
			>
				{children}
			</button>
		);
	},
);

Button.displayName = "Button";
