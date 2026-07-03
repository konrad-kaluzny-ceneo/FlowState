import type { EnergyLevel } from "~/lib/domain/energy-level";
import type { HomeSessionState } from "~/lib/home/home-session-state";

export type IllustrationVariant =
	| "idle"
	| "energy_choice"
	| "work"
	| "break"
	| "return"
	| "closure";

export type ResolveIllustrationVariantInput = {
	state: HomeSessionState;
	narrativeLatestEnergy: EnergyLevel | null;
	recentlyClosedSession: boolean;
	// Accepted for future use (e.g. freezing the resolved variant while a gate
	// is visually settling). Not branched on today: illustrations render
	// outside gate trees already, so this is a documented no-op for now.
	wedgeGateActive: boolean;
};

const ENERGY_TINTED_VARIANTS = new Set<IllustrationVariant>([
	"work",
	"energy_choice",
]);

export function resolveIllustrationVariant({
	state,
	recentlyClosedSession,
}: ResolveIllustrationVariantInput): IllustrationVariant {
	if (recentlyClosedSession) {
		return "closure";
	}
	switch (state) {
		case "steering":
			return "energy_choice";
		case "active_work":
			return "work";
		case "returning":
			return "return";
		case "break":
			return "break";
		case "idle":
			return "idle";
	}
}

export function resolveIllustrationEnergyTint(
	input: ResolveIllustrationVariantInput,
): EnergyLevel | null {
	const variant = resolveIllustrationVariant(input);
	if (!ENERGY_TINTED_VARIANTS.has(variant)) {
		return null;
	}
	return input.narrativeLatestEnergy;
}
