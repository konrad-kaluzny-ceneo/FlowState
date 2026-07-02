import type { IllustrationVariant } from "~/lib/design/illustration-variant";
import type { EnergyLevel } from "~/lib/domain/energy-level";

import { CalmGardenBlob } from "./calm-garden-blob";
import { CalmGardenSprig } from "./calm-garden-sprig";

type HomeHeroSprigProps = {
	variant: IllustrationVariant;
	energyTint?: EnergyLevel | null;
};

/** Subtle botanical accent for the home header hero area. */
export function HomeHeroSprig({
	variant,
	energyTint = null,
}: HomeHeroSprigProps) {
	return (
		<div
			aria-hidden
			className="pointer-events-none relative mx-auto mb-1 h-12 w-20 opacity-90 transition-opacity duration-200 motion-reduce:transition-none"
			data-illustration-energy={energyTint ?? undefined}
			data-illustration-variant={variant}
			data-testid="home-hero-sprig"
		>
			<CalmGardenBlob
				className="absolute inset-0 h-full w-full scale-90"
				variant={variant}
			/>
			<CalmGardenSprig
				className="absolute top-1 left-1/2 h-9 w-9 -translate-x-1/2"
				variant={variant}
			/>
		</div>
	);
}
