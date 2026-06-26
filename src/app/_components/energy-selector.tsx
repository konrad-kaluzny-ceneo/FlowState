"use client";

export type CheckInEnergyUi = "focused" | "steady" | "fading";

export type CheckInEnergy = "FOCUSED" | "STEADY" | "FADING";

const ENERGY_OPTIONS: {
	ui: CheckInEnergyUi;
	value: CheckInEnergy;
	label: string;
	testId: string;
	buttonClass: string;
	iconClass: string;
}[] = [
	{
		ui: "focused",
		value: "FOCUSED",
		label: "Focused",
		testId: "check-in-energy-focused",
		buttonClass:
			"border-energy-focused-border bg-energy-focused-bg hover:border-energy-focused-border hover:bg-energy-focused-bg",
		iconClass: "text-energy-focused",
	},
	{
		ui: "steady",
		value: "STEADY",
		label: "Steady",
		testId: "check-in-energy-steady",
		buttonClass:
			"border-energy-steady-border bg-energy-steady-bg hover:border-energy-steady-border hover:bg-energy-steady-bg",
		iconClass: "text-energy-steady",
	},
	{
		ui: "fading",
		value: "FADING",
		label: "Fading",
		testId: "check-in-energy-fading",
		buttonClass:
			"border-energy-fading-border bg-energy-fading-bg hover:border-energy-fading-border hover:bg-energy-fading-bg",
		iconClass: "text-energy-fading",
	},
];

function EnergyOptionIcon({
	ui,
	className,
}: {
	ui: CheckInEnergyUi;
	className: string;
}) {
	if (ui === "focused") {
		return (
			<svg
				aria-hidden="true"
				className={className}
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
					fill="currentColor"
				/>
			</svg>
		);
	}

	if (ui === "steady") {
		return (
			<svg
				aria-hidden="true"
				className={className}
				fill="none"
				viewBox="0 0 24 24"
			>
				<path
					d="M5 12H19"
					stroke="currentColor"
					strokeLinecap="round"
					strokeWidth="2.5"
				/>
			</svg>
		);
	}

	return (
		<svg
			aria-hidden="true"
			className={className}
			fill="none"
			viewBox="0 0 24 24"
		>
			<path
				d="M12 3C8.5 3 6 5.5 6 9C6 11.5 7.5 13.5 9 15V17C9 18.1 9.9 19 11 19H13C14.1 19 15 18.1 15 17V15C16.5 13.5 18 11.5 18 9C18 5.5 15.5 3 12 3Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.75"
			/>
			<path
				d="M10 21H14"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.75"
			/>
		</svg>
	);
}

type EnergySelectorProps = {
	onSelect: (energy: CheckInEnergy) => void;
	disabled?: boolean;
	coachLine?: string;
};

export function EnergySelector({
	onSelect,
	disabled = false,
	coachLine,
}: EnergySelectorProps) {
	return (
		<>
			{coachLine != null && (
				<p
					className="mt-1 text-accent-cta/70 text-xs"
					data-testid="check-in-coach-line"
				>
					{coachLine}
				</p>
			)}
			<fieldset className="mt-4 border-0 p-0 sm:mt-6">
				<legend className="sr-only">Energy level</legend>
				<div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
					{ENERGY_OPTIONS.map((option) => (
						<button
							className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 font-semibold text-primary transition disabled:opacity-50 sm:py-2.5 ${option.buttonClass}`}
							data-testid={option.testId}
							disabled={disabled}
							key={option.value}
							onClick={() => onSelect(option.value)}
							type="button"
						>
							<EnergyOptionIcon
								className={`h-5 w-5 shrink-0 ${option.iconClass}`}
								ui={option.ui}
							/>
							<span>{option.label}</span>
						</button>
					))}
				</div>
			</fieldset>
		</>
	);
}
