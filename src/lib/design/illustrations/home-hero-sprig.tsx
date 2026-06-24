import { CalmGardenBlob } from "./calm-garden-blob";
import { CalmGardenSprig } from "./calm-garden-sprig";

/** Subtle botanical accent for the home header hero area. */
export function HomeHeroSprig() {
	return (
		<div
			aria-hidden
			className="pointer-events-none relative mx-auto mb-1 h-12 w-20 opacity-90"
			data-testid="home-hero-sprig"
		>
			<CalmGardenBlob className="absolute inset-0 h-full w-full scale-90" />
			<CalmGardenSprig className="absolute top-1 left-1/2 h-9 w-9 -translate-x-1/2" />
		</div>
	);
}
