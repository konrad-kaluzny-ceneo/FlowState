import { beforeEach, describe, expect, it } from "vitest";

import {
	readCycleEndAudioMode,
	readGuestModeForMerge,
	writeCycleEndAudioMode,
} from "./storage";

const guestScope = { mode: "guest" as const };
const userAScope = { mode: "authenticated" as const, userId: "user-a" };
const userBScope = { mode: "authenticated" as const, userId: "user-b" };

describe("cycle-audio-preference storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("defaults to normal when key is missing", () => {
		expect(readCycleEndAudioMode(guestScope)).toBe("normal");
		expect(readCycleEndAudioMode(userAScope)).toBe("normal");
	});

	it("round-trips guest and authenticated keys separately", () => {
		writeCycleEndAudioMode(guestScope, "muted");
		writeCycleEndAudioMode(userAScope, "soft");

		expect(readCycleEndAudioMode(guestScope)).toBe("muted");
		expect(readCycleEndAudioMode(userAScope)).toBe("soft");
		expect(readCycleEndAudioMode(userBScope)).toBe("normal");
	});

	it("isolates authenticated users", () => {
		writeCycleEndAudioMode(userAScope, "muted");
		writeCycleEndAudioMode(userBScope, "soft");

		expect(localStorage.getItem("flowstate:cycleEndAudio:user-a")).toBe(
			'"muted"',
		);
		expect(localStorage.getItem("flowstate:cycleEndAudio:user-b")).toBe(
			'"soft"',
		);
	});

	it("falls back to normal for corrupt JSON", () => {
		localStorage.setItem("flowstate:cycleEndAudio:guest", "{not-json");
		localStorage.setItem(
			"flowstate:cycleEndAudio:user-a",
			JSON.stringify("loud"),
		);

		expect(readCycleEndAudioMode(guestScope)).toBe("normal");
		expect(readCycleEndAudioMode(userAScope)).toBe("normal");
	});

	it("readGuestModeForMerge returns non-normal guest value only", () => {
		expect(readGuestModeForMerge()).toBeNull();

		writeCycleEndAudioMode(guestScope, "soft");
		expect(readGuestModeForMerge()).toBe("soft");

		writeCycleEndAudioMode(guestScope, "normal");
		expect(readGuestModeForMerge()).toBeNull();
	});
});
