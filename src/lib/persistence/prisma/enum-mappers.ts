import type {
	CommitmentHorizon as PrismaCommitmentHorizon,
	CycleEndAudioMode as PrismaCycleEndAudioMode,
	EnergyLevel as PrismaEnergyLevel,
	WorkType as PrismaWorkType,
} from "@prisma/generated";

import type {
	CommitmentHorizon,
	CycleEndAudioMode,
	EnergyLevel,
	WorkType,
} from "~/lib/domain";

const ENERGY_FROM_PRISMA: Record<PrismaEnergyLevel, EnergyLevel> = {
	FOCUSED: "FOCUSED",
	STEADY: "STEADY",
	FADING: "FADING",
};

const ENERGY_TO_PRISMA: Record<EnergyLevel, PrismaEnergyLevel> = {
	FOCUSED: "FOCUSED",
	STEADY: "STEADY",
	FADING: "FADING",
};

const WORK_TYPE_FROM_PRISMA: Record<PrismaWorkType, WorkType> = {
	DEEP_WORK: "DEEP_WORK",
	OPERATIONAL: "OPERATIONAL",
	REACTIVE: "REACTIVE",
};

const WORK_TYPE_TO_PRISMA: Record<WorkType, PrismaWorkType> = {
	DEEP_WORK: "DEEP_WORK",
	OPERATIONAL: "OPERATIONAL",
	REACTIVE: "REACTIVE",
};

const COMMITMENT_FROM_PRISMA: Record<
	PrismaCommitmentHorizon,
	CommitmentHorizon
> = {
	ASAP: "ASAP",
	THIS_WEEK: "THIS_WEEK",
	WHEN_POSSIBLE: "WHEN_POSSIBLE",
};

const COMMITMENT_TO_PRISMA: Record<CommitmentHorizon, PrismaCommitmentHorizon> =
	{
		ASAP: "ASAP",
		THIS_WEEK: "THIS_WEEK",
		WHEN_POSSIBLE: "WHEN_POSSIBLE",
	};

const AUDIO_FROM_PRISMA: Record<PrismaCycleEndAudioMode, CycleEndAudioMode> = {
	NORMAL: "normal",
	SOFT: "soft",
	MUTED: "muted",
};

const AUDIO_TO_PRISMA: Record<CycleEndAudioMode, PrismaCycleEndAudioMode> = {
	normal: "NORMAL",
	soft: "SOFT",
	muted: "MUTED",
};

export function fromPrismaEnergyLevel(value: PrismaEnergyLevel): EnergyLevel {
	return ENERGY_FROM_PRISMA[value];
}

export function toPrismaEnergyLevel(value: EnergyLevel): PrismaEnergyLevel {
	return ENERGY_TO_PRISMA[value];
}

export function fromPrismaWorkType(value: PrismaWorkType): WorkType {
	return WORK_TYPE_FROM_PRISMA[value];
}

export function toPrismaWorkType(value: WorkType): PrismaWorkType {
	return WORK_TYPE_TO_PRISMA[value];
}

export function fromPrismaCommitmentHorizon(
	value: PrismaCommitmentHorizon,
): CommitmentHorizon {
	return COMMITMENT_FROM_PRISMA[value];
}

export function toPrismaCommitmentHorizon(
	value: CommitmentHorizon,
): PrismaCommitmentHorizon {
	return COMMITMENT_TO_PRISMA[value];
}

export function fromPrismaCycleEndAudioMode(
	value: PrismaCycleEndAudioMode,
): CycleEndAudioMode {
	return AUDIO_FROM_PRISMA[value];
}

export function toPrismaCycleEndAudioMode(
	value: CycleEndAudioMode,
): PrismaCycleEndAudioMode {
	return AUDIO_TO_PRISMA[value];
}
