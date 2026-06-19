import { getFactorContributions } from "./dominant-factor";
import { buildRationale, type RationaleKey } from "./rationale";
import type { ScoringContext, ScoringTask } from "./score-task";

export type RationaleFactorItem = { key: RationaleKey; copy: string };

export type RationaleBreakdown = {
	headline: string;
	dominant: RationaleFactorItem[];
	alsoConsidered: string[];
};

export const FACTOR_CHIP_LABELS: Partial<Record<RationaleKey, string>> = {
	override_preference: "Last override",
	interruptions: "Interruptions",
	late_day: "Time of day",
	fatigue: "Cycles completed",
	energy_deep: "Energy fit",
	energy_light: "Energy fit",
	eisenhower_priority: "High priority",
	importance_focus: "Important now",
	low_effort_fit: "Quick win",
	horizon_asap: "Due ASAP",
	capacity_fit: "Fits your remaining focus",
};

const EXCLUDED_CHIP_KEYS = new Set<RationaleKey>([
	"default",
	"kickoff_fresh",
	"kickoff_resume",
]);

export function buildRationaleBreakdown(
	task: ScoringTask,
	context: ScoringContext,
	opts: { headline: string; headlineKey: RationaleKey },
): RationaleBreakdown {
	const ranked = getFactorContributions(task, context)
		.filter((contribution) => contribution.magnitude > 0)
		.sort((a, b) => b.magnitude - a.magnitude);

	const secondary = ranked.filter(
		(contribution) => contribution.key !== opts.headlineKey,
	);

	const dominant = secondary.slice(0, 3).map((contribution) => ({
		key: contribution.key,
		copy: buildRationale(contribution.key, context),
	}));

	const alsoConsidered: string[] = [];
	const seenChipLabels = new Set<string>();

	for (const contribution of secondary.slice(3)) {
		if (EXCLUDED_CHIP_KEYS.has(contribution.key)) {
			continue;
		}
		const label = FACTOR_CHIP_LABELS[contribution.key];
		if (label == null || seenChipLabels.has(label)) {
			continue;
		}
		seenChipLabels.add(label);
		alsoConsidered.push(label);
		if (alsoConsidered.length >= 4) {
			break;
		}
	}

	return {
		headline: opts.headline,
		dominant,
		alsoConsidered,
	};
}
