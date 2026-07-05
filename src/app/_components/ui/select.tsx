"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

export type SelectOption<T extends string> = {
	value: T;
	label: string;
};

export type SelectProps<T extends string> = {
	options: SelectOption<T>[];
	value: T;
	onChange: (value: T) => void;
	"aria-label": string;
	id?: string;
	className?: string;
};

function optionElements(list: HTMLDivElement | null) {
	return list?.querySelectorAll<HTMLDivElement>('[role="option"]') ?? null;
}

export function Select<T extends string>({
	options,
	value,
	onChange,
	"aria-label": ariaLabel,
	id,
	className = "",
}: SelectProps<T>) {
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(() =>
		Math.max(
			options.findIndex((option) => option.value === value),
			0,
		),
	);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const generatedId = useId();
	const listboxId = id ?? generatedId;
	const selected = options.find((option) => option.value === value);

	useEffect(() => {
		if (!open) {
			return;
		}

		function handleClickOutside(event: MouseEvent) {
			const target = event.target as Node;
			if (
				buttonRef.current?.contains(target) ||
				listRef.current?.contains(target)
			) {
				return;
			}
			setOpen(false);
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [open]);

	useEffect(() => {
		if (!open) {
			return;
		}
		const idx = Math.max(
			options.findIndex((option) => option.value === value),
			0,
		);
		setActiveIndex(idx);
		const frame = requestAnimationFrame(() => {
			optionElements(listRef.current)?.[idx]?.focus();
		});
		return () => cancelAnimationFrame(frame);
	}, [open, options, value]);

	function commitAndClose(index: number) {
		const option = options[index];
		if (option != null) {
			onChange(option.value);
		}
		setOpen(false);
		buttonRef.current?.focus();
	}

	function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (
			event.key === "ArrowDown" ||
			event.key === "ArrowUp" ||
			event.key === "Enter" ||
			event.key === " "
		) {
			event.preventDefault();
			setOpen(true);
		}
	}

	function moveActive(nextIndex: number) {
		const wrapped =
			((nextIndex % options.length) + options.length) % options.length;
		setActiveIndex(wrapped);
		optionElements(listRef.current)?.[wrapped]?.focus();
	}

	function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			setOpen(false);
			buttonRef.current?.focus();
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveActive(activeIndex + 1);
			return;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			moveActive(activeIndex - 1);
			return;
		}
		if (event.key === "Home") {
			event.preventDefault();
			moveActive(0);
			return;
		}
		if (event.key === "End") {
			event.preventDefault();
			moveActive(options.length - 1);
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			commitAndClose(activeIndex);
		}
	}

	return (
		<div className={`relative inline-block ${className}`}>
			<button
				aria-expanded={open}
				aria-haspopup="listbox"
				aria-label={ariaLabel}
				className="flex items-center gap-2 rounded-chip border border-border-subtle bg-surface-card px-3 py-1.5 text-primary text-sm transition hover:bg-surface-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
				onClick={() => setOpen((prev) => !prev)}
				onKeyDown={handleTriggerKeyDown}
				ref={buttonRef}
				type="button"
			>
				{selected?.label ?? ariaLabel}
			</button>
			{open && (
				<div
					aria-label={ariaLabel}
					className="absolute z-10 mt-1 min-w-full overflow-hidden rounded-control border border-border-subtle bg-surface-overlay py-1 shadow-xl"
					id={listboxId}
					onKeyDown={handleListKeyDown}
					role="listbox"
					tabIndex={-1}
				>
					{options.map((option, index) => {
						const isSelected = option.value === value;
						return (
							// biome-ignore lint/a11y/useKeyWithClickEvents: option receives keyboard events via the shared listbox handler
							<div
								aria-selected={isSelected}
								className={`cursor-pointer px-3 py-1.5 text-sm transition focus:outline-none ${
									isSelected
										? "bg-segment-active text-on-cta"
										: "text-primary hover:bg-surface-card-muted"
								}`}
								key={option.value}
								onClick={() => commitAndClose(index)}
								onMouseEnter={() => setActiveIndex(index)}
								role="option"
								tabIndex={-1}
							>
								{option.label}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
