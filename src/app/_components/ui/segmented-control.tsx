"use client";

export type SegmentedControlOption<T extends string | number> = {
	value: T;
	label: string;
};

export type SegmentedControlProps<T extends string | number> = {
	options: SegmentedControlOption<T>[];
	value: T;
	onChange: (value: T) => void;
	colorMap?: Record<string, string>;
};

export function SegmentedControl<T extends string | number>({
	options,
	value,
	onChange,
	colorMap,
}: SegmentedControlProps<T>) {
	return (
		<div className="flex flex-wrap gap-1">
			{options.map((opt) => {
				const isActive = opt.value === value;
				const activeColor =
					colorMap?.[String(opt.value)] ?? "bg-accent-cta text-on-cta";
				return (
					<button
						aria-pressed={isActive}
						className={`rounded-chip px-2 py-1 font-medium text-xs transition ${
							isActive
								? activeColor
								: "bg-surface-panel text-text-secondary hover:bg-surface-card-muted"
						}`}
						key={String(opt.value)}
						onClick={() => onChange(opt.value)}
						onMouseDown={(event) => event.preventDefault()}
						type="button"
					>
						{opt.label}
					</button>
				);
			})}
		</div>
	);
}
