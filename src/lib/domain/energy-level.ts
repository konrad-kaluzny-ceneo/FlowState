export type EnergyLevel = "FOCUSED" | "STEADY" | "FADING";

export const energyLevelSchema = [
	"FOCUSED",
	"STEADY",
	"FADING",
] as const satisfies readonly EnergyLevel[];
