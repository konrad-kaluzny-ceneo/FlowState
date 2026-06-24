import { CalmGardenBlob } from "./calm-garden-blob";
import { CalmGardenSprig } from "./calm-garden-sprig";

/** Empty Garden Bed — calm empty-state illustration for zero active tasks. */
export function EmptyGardenBed() {
	return (
		<div
			className="relative mx-auto flex h-24 w-32 items-center justify-center"
			data-testid="empty-garden-bed"
		>
			<CalmGardenBlob className="absolute inset-0 h-full w-full" />
			<CalmGardenSprig className="relative h-14 w-14 opacity-80" />
		</div>
	);
}
