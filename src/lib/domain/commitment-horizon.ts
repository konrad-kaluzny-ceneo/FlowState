export type CommitmentHorizon = "ASAP" | "THIS_WEEK" | "WHEN_POSSIBLE";

export const commitmentHorizonSchema = [
	"ASAP",
	"THIS_WEEK",
	"WHEN_POSSIBLE",
] as const satisfies readonly CommitmentHorizon[];
