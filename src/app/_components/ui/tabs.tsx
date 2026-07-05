"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { useRef } from "react";

export type TabItem = {
	value: string;
	label: ReactNode;
};

export type TabsProps = {
	items: TabItem[];
	value: string;
	onChange: (value: string) => void;
	"aria-label": string;
	id?: string;
};

function focusTabAt(
	container: HTMLDivElement | null,
	index: number,
	count: number,
) {
	if (container == null || count === 0) {
		return;
	}
	const wrapped = ((index % count) + count) % count;
	const tab =
		container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[wrapped];
	tab?.focus();
}

export function Tabs({
	items,
	value,
	onChange,
	"aria-label": ariaLabel,
	id,
}: TabsProps) {
	const listRef = useRef<HTMLDivElement>(null);
	const activeIndex = items.findIndex((item) => item.value === value);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (items.length === 0) {
			return;
		}
		const currentIndex = activeIndex === -1 ? 0 : activeIndex;

		const wrap = (index: number) =>
			((index % items.length) + items.length) % items.length;
		const selectAt = (index: number) => {
			const item = items[wrap(index)];
			if (item != null) {
				focusTabAt(listRef.current, wrap(index), items.length);
				onChange(item.value);
			}
		};

		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			event.preventDefault();
			selectAt(currentIndex + 1);
			return;
		}

		if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			event.preventDefault();
			selectAt(currentIndex - 1);
			return;
		}

		if (event.key === "Home") {
			event.preventDefault();
			selectAt(0);
			return;
		}

		if (event.key === "End") {
			event.preventDefault();
			selectAt(items.length - 1);
		}
	};

	return (
		<div
			aria-label={ariaLabel}
			className="flex flex-wrap gap-1"
			id={id}
			onKeyDown={handleKeyDown}
			ref={listRef}
			role="tablist"
		>
			{items.map((item) => {
				const isActive = item.value === value;
				return (
					<button
						aria-controls={`${id ?? ariaLabel}-panel-${item.value}`}
						aria-selected={isActive}
						className={`rounded-chip px-3 py-1.5 font-medium text-sm transition ${
							isActive
								? "bg-segment-active text-on-cta"
								: "bg-segment-inactive text-text-secondary hover:bg-surface-card-muted"
						}`}
						id={`${id ?? ariaLabel}-tab-${item.value}`}
						key={item.value}
						onClick={() => onChange(item.value)}
						role="tab"
						tabIndex={isActive ? 0 : -1}
						type="button"
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}

export type TabPanelProps = {
	value: string;
	activeValue: string;
	children: ReactNode;
	id?: string;
	tabsId?: string;
};

export function TabPanel({
	value,
	activeValue,
	children,
	id,
	tabsId,
}: TabPanelProps) {
	if (value !== activeValue) {
		return null;
	}

	return (
		<div
			aria-labelledby={`${tabsId ?? ""}-tab-${value}`}
			id={id ?? `${tabsId ?? ""}-panel-${value}`}
			role="tabpanel"
		>
			{children}
		</div>
	);
}
