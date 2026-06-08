import type { CycleEndAudioMode as PrismaCycleEndAudioMode } from "@prisma/generated";

export type CycleEndAudioMode = "normal" | "soft" | "muted";

export const DEFAULT_CYCLE_END_AUDIO_MODE: CycleEndAudioMode = "normal";

export const cycleEndAudioModeSchema = ["normal", "soft", "muted"] as const;

const PRISMA_TO_CLIENT: Record<PrismaCycleEndAudioMode, CycleEndAudioMode> = {
	NORMAL: "normal",
	SOFT: "soft",
	MUTED: "muted",
};

const CLIENT_TO_PRISMA: Record<CycleEndAudioMode, PrismaCycleEndAudioMode> = {
	normal: "NORMAL",
	soft: "SOFT",
	muted: "MUTED",
};

export function fromPrismaMode(
	mode: PrismaCycleEndAudioMode,
): CycleEndAudioMode {
	return PRISMA_TO_CLIENT[mode];
}

export function toPrismaMode(mode: CycleEndAudioMode): PrismaCycleEndAudioMode {
	return CLIENT_TO_PRISMA[mode];
}
