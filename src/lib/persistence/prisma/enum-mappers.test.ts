import { describe, expect, it } from "vitest";

import {
	fromPrismaCommitmentHorizon,
	fromPrismaCycleEndAudioMode,
	fromPrismaEnergyLevel,
	fromPrismaWorkType,
	toPrismaCommitmentHorizon,
	toPrismaCycleEndAudioMode,
	toPrismaEnergyLevel,
	toPrismaWorkType,
} from "./enum-mappers";

describe("enum-mappers", () => {
	it("round-trips energy levels", () => {
		expect(fromPrismaEnergyLevel("FOCUSED")).toBe("FOCUSED");
		expect(toPrismaEnergyLevel("STEADY")).toBe("STEADY");
	});

	it("round-trips work types", () => {
		expect(fromPrismaWorkType("DEEP_WORK")).toBe("DEEP_WORK");
		expect(toPrismaWorkType("REACTIVE")).toBe("REACTIVE");
	});

	it("round-trips commitment horizons", () => {
		expect(fromPrismaCommitmentHorizon("ASAP")).toBe("ASAP");
		expect(toPrismaCommitmentHorizon("WHEN_POSSIBLE")).toBe("WHEN_POSSIBLE");
	});

	it("maps cycle end audio modes between prisma and domain", () => {
		expect(fromPrismaCycleEndAudioMode("NORMAL")).toBe("normal");
		expect(toPrismaCycleEndAudioMode("muted")).toBe("MUTED");
	});
});
