"use client";

export type CheckInEnergyUi = "focused" | "steady" | "fading";

export type CheckInEnergy = "FOCUSED" | "STEADY" | "FADING";

const ENERGY_OPTIONS: {
	ui: CheckInEnergyUi;
	value: CheckInEnergy;
	label: string;
	testId: string;
	buttonClass: string;
}[] = [
	{
		ui: "focused",
		value: "FOCUSED",
		label: "Focused",
		testId: "check-in-energy-focused",
		buttonClass:
			"border-energy-focused-border bg-energy-focused-bg hover:border-energy-focused-border hover:bg-energy-focused-bg",
	},
	{
		ui: "steady",
		value: "STEADY",
		label: "Steady",
		testId: "check-in-energy-steady",
		buttonClass:
			"border-energy-steady-border bg-energy-steady-bg hover:border-energy-steady-border hover:bg-energy-steady-bg",
	},
	{
		ui: "fading",
		value: "FADING",
		label: "Fading",
		testId: "check-in-energy-fading",
		buttonClass:
			"border-energy-fading-border bg-energy-fading-bg hover:border-energy-fading-border hover:bg-energy-fading-bg",
	},
];

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
			<div className="mt-8 flex flex-col gap-3">
				{ENERGY_OPTIONS.map((option) => (
					<button
						className={`rounded-lg border py-3 font-semibold text-primary transition disabled:opacity-50 ${option.buttonClass}`}
						data-testid={option.testId}
						disabled={disabled}
						key={option.value}
						onClick={() => onSelect(option.value)}
						type="button"
					>
						{option.label}
					</button>
				))}
			</div>
		</>
	);
}
