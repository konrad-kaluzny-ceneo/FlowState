export type CycleEndAudioMode = "normal" | "soft" | "muted";

export const DEFAULT_CYCLE_END_AUDIO_MODE: CycleEndAudioMode = "normal";

export const cycleEndAudioModeSchema = [
	"normal",
	"soft",
	"muted",
] as const satisfies readonly CycleEndAudioMode[];
