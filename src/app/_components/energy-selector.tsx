"use client";

export type CheckInEnergyUi = "focused" | "steady" | "fading";

export type CheckInEnergy = "FOCUSED" | "STEADY" | "FADING";

const ENERGY_OPTIONS: {
	ui: CheckInEnergyUi;
	value: CheckInEnergy;
	label: string;
	testId: string;
}[] = [
	{
		ui: "focused",
		value: "FOCUSED",
		label: "Focused",
		testId: "check-in-energy-focused",
	},
	{
		ui: "steady",
		value: "STEADY",
		label: "Steady",
		testId: "check-in-energy-steady",
	},
	{
		ui: "fading",
		value: "FADING",
		label: "Fading",
		testId: "check-in-energy-fading",
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
					className="mt-1 text-purple-200/70 text-xs"
					data-testid="check-in-coach-line"
				>
					{coachLine}
				</p>
			)}
			<div className="mt-8 flex flex-col gap-3">
				{ENERGY_OPTIONS.map((option) => (
					<button
						className="rounded-lg border border-white/20 bg-white/5 py-3 font-semibold text-white transition hover:border-purple-400/50 hover:bg-purple-500/20 disabled:opacity-50"
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
