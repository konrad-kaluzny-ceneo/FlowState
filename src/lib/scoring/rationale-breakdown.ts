import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

import { getFactorContributions } from "./dominant-factor";
import { buildRationale, type RationaleKey } from "./rationale";
import type { ScoringContext, ScoringTask } from "./score-task";

export type RationaleFactorItem = { key: RationaleKey; copy: string };

export type RationaleBreakdown = {
	headline: string;
	dominant: RationaleFactorItem[];
	alsoConsidered: string[];
};

const FACTOR_CHIP_KEYS: Partial<Record<RationaleKey, string>> = {
	override_preference: "override_preference",
	interruptions: "interruptions",
	late_day: "late_day",
	fatigue: "fatigue",
	energy_deep: "energy_deep",
	energy_light: "energy_light",
	eisenhower_priority: "eisenhower_priority",
	importance_focus: "importance_focus",
	low_effort_fit: "low_effort_fit",
	horizon_asap: "horizon_asap",
	capacity_fit: "capacity_fit",
};

const EXCLUDED_CHIP_KEYS = new Set<RationaleKey>([
	"default",
	"kickoff_fresh",
	"kickoff_resume",
]);

export function getFactorChipLabel(
	key: RationaleKey,
	locale: UserLocale = "en",
): string | undefined {
	const messageKey = FACTOR_CHIP_KEYS[key];
	if (messageKey == null) {
		return undefined;
	}
	return createNamespaceTranslator("Scoring.factorChips", locale)(messageKey);
}

/** @deprecated Use getFactorChipLabel(key, locale) */
export const FACTOR_CHIP_LABELS: Partial<Record<RationaleKey, string>> =
	Object.fromEntries(
		Object.entries(FACTOR_CHIP_KEYS).map(([key, messageKey]) => [
			key,
			createNamespaceTranslator("Scoring.factorChips", "en")(messageKey),
		]),
	) as Partial<Record<RationaleKey, string>>;

export function buildRationaleBreakdown(
	task: ScoringTask,
	context: ScoringContext,
	opts: { headline: string; headlineKey: RationaleKey },
	locale: UserLocale = "en",
): RationaleBreakdown {
	const ranked = getFactorContributions(task, context)
		.filter((contribution) => contribution.magnitude > 0)
		.sort((a, b) => b.magnitude - a.magnitude);

	const secondary = ranked.filter(
		(contribution) => contribution.key !== opts.headlineKey,
	);

	const dominant = secondary.slice(0, 3).map((contribution) => ({
		key: contribution.key,
		copy: buildRationale(contribution.key, context, locale),
	}));

	const alsoConsidered: string[] = [];
	const seenChipLabels = new Set<string>();

	for (const contribution of secondary.slice(3)) {
		if (EXCLUDED_CHIP_KEYS.has(contribution.key)) {
			continue;
		}
		const label = getFactorChipLabel(contribution.key, locale);
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
