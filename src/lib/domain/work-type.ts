export type WorkType = "DEEP_WORK" | "OPERATIONAL" | "REACTIVE";

export const workTypeSchema = [
	"DEEP_WORK",
	"OPERATIONAL",
	"REACTIVE",
] as const satisfies readonly WorkType[];
