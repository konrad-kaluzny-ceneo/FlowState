"use client";

import { useId } from "react";

type StyledCheckboxProps = {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	disabled?: boolean;
	id?: string;
	className?: string;
	"data-testid"?: string;
};

export function StyledCheckbox({
	checked,
	onChange,
	label,
	disabled = false,
	id,
	className = "",
	"data-testid": dataTestId,
}: StyledCheckboxProps) {
	const autoId = useId();
	const inputId = id ?? autoId;

	return (
		<label
			className={`flex cursor-pointer items-center gap-2 text-sm text-text-secondary ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
			htmlFor={inputId}
		>
			<input
				checked={checked}
				className="peer sr-only"
				data-testid={dataTestId}
				disabled={disabled}
				id={inputId}
				onChange={(event) => onChange(event.target.checked)}
				type="checkbox"
			/>
			<span
				aria-hidden="true"
				className="pointer-events-none flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-card transition-colors peer-checked:border-accent-cta peer-checked:bg-accent-cta peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-disabled:opacity-60"
			>
				{checked ? (
					<svg
						aria-hidden="true"
						className="h-3 w-3 text-on-cta"
						fill="none"
						stroke="currentColor"
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2.5}
						viewBox="0 0 16 16"
					>
						<path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
					</svg>
				) : null}
			</span>
			{label}
		</label>
	);
}
