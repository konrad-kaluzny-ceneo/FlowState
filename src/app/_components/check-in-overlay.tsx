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

type CheckInOverlayProps = {
	cycleId: number;
	onSubmit: (energy: CheckInEnergy) => Promise<void>;
	isSubmitting?: boolean;
	coachLine?: string;
};

export function CheckInOverlay({
	cycleId,
	onSubmit,
	isSubmitting = false,
	coachLine,
}: CheckInOverlayProps) {
	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
			data-cycle-id={cycleId}
			data-testid="check-in-overlay"
			role="dialog"
		>
			<div className="w-full max-w-md rounded-xl border border-white/20 bg-[#1a1a2e] p-8 text-center shadow-xl">
				<h2 className="font-bold text-2xl text-white">
					How&apos;s your energy?
				</h2>
				<p className="mt-2 text-sm text-white/60">
					Select one before your break starts.
				</p>
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
							disabled={isSubmitting}
							key={option.value}
							onClick={() => void onSubmit(option.value)}
							type="button"
						>
							{option.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
