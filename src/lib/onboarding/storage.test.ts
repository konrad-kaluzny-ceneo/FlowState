import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_KEY_GUEST, onboardingKeyForScope } from "./keys";
import {
	enableAuthenticatedWedgeCoach,
	loadOnboardingState,
	patchOnboardingState,
	saveOnboardingState,
} from "./storage";
import { DEFAULT_ONBOARDING_STATE } from "./types";

describe("onboarding storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("returns defaults when nothing stored", () => {
		expect(loadOnboardingState({ mode: "guest" })).toEqual(
			DEFAULT_ONBOARDING_STATE,
		);
	});

	it("round-trips all flags", () => {
		const state: typeof DEFAULT_ONBOARDING_STATE = {
			firstRunDismissed: true,
			checkInCoachSeen: true,
			suggestionCoachSeen: false,
			presetCoachDismissed: true,
			authenticatedWedgeCoachEligible: true,
			hasSeenAuthenticatedWedge: false,
		};

		saveOnboardingState({ mode: "guest" }, state);
		expect(loadOnboardingState({ mode: "guest" })).toEqual(state);
	});

	it("returns defaults for corrupt JSON", () => {
		localStorage.setItem(ONBOARDING_KEY_GUEST, "not-json");
		expect(loadOnboardingState({ mode: "guest" })).toEqual(
			DEFAULT_ONBOARDING_STATE,
		);
	});

	it("ignores unknown fields on read", () => {
		localStorage.setItem(
			ONBOARDING_KEY_GUEST,
			JSON.stringify({
				v: 1,
				firstRunDismissed: true,
				unknownField: "ignored",
			}),
		);

		expect(loadOnboardingState({ mode: "guest" })).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			firstRunDismissed: true,
		});
	});

	it("patches partial state and persists", () => {
		const next = patchOnboardingState(
			{ mode: "guest" },
			{
				firstRunDismissed: true,
			},
		);

		expect(next).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			firstRunDismissed: true,
		});
		expect(loadOnboardingState({ mode: "guest" })).toEqual(next);
	});

	it("parses and patches presetCoachDismissed", () => {
		localStorage.setItem(
			ONBOARDING_KEY_GUEST,
			JSON.stringify({ v: 1, presetCoachDismissed: true }),
		);

		expect(loadOnboardingState({ mode: "guest" })).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			presetCoachDismissed: true,
		});

		const next = patchOnboardingState(
			{ mode: "guest" },
			{ presetCoachDismissed: true },
		);

		expect(next.presetCoachDismissed).toBe(true);
		expect(loadOnboardingState({ mode: "guest" }).presetCoachDismissed).toBe(
			true,
		);
	});

	it("isolates guest and auth keys per userId", () => {
		saveOnboardingState(
			{ mode: "guest" },
			{
				...DEFAULT_ONBOARDING_STATE,
				firstRunDismissed: true,
			},
		);
		saveOnboardingState(
			{ mode: "authenticated", userId: "user-a" },
			{
				...DEFAULT_ONBOARDING_STATE,
				checkInCoachSeen: true,
			},
		);
		saveOnboardingState(
			{ mode: "authenticated", userId: "user-b" },
			{
				...DEFAULT_ONBOARDING_STATE,
				suggestionCoachSeen: true,
			},
		);

		expect(loadOnboardingState({ mode: "guest" })).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			firstRunDismissed: true,
		});
		expect(
			loadOnboardingState({ mode: "authenticated", userId: "user-a" }),
		).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			checkInCoachSeen: true,
		});
		expect(
			loadOnboardingState({ mode: "authenticated", userId: "user-b" }),
		).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			suggestionCoachSeen: true,
		});

		expect(onboardingKeyForScope({ mode: "guest" })).toBe(ONBOARDING_KEY_GUEST);
		expect(
			onboardingKeyForScope({ mode: "authenticated", userId: "user-a" }),
		).toBe("flowstate:onboarding:user-a");
		expect(
			onboardingKeyForScope({ mode: "authenticated", userId: "user-b" }),
		).not.toBe(
			onboardingKeyForScope({ mode: "authenticated", userId: "user-a" }),
		);
	});

	it("enables authenticated wedge coach for auth scope", () => {
		enableAuthenticatedWedgeCoach({
			mode: "authenticated",
			userId: "user-a",
		});
		expect(
			loadOnboardingState({ mode: "authenticated", userId: "user-a" }),
		).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			authenticatedWedgeCoachEligible: true,
		});
	});

	it("returns null key and skips writes for missing auth userId", () => {
		expect(
			onboardingKeyForScope({ mode: "authenticated", userId: "" }),
		).toBeNull();

		saveOnboardingState(
			{ mode: "authenticated", userId: "" },
			{
				...DEFAULT_ONBOARDING_STATE,
				firstRunDismissed: true,
			},
		);

		expect(localStorage.length).toBe(0);
		expect(loadOnboardingState({ mode: "authenticated", userId: "" })).toEqual(
			DEFAULT_ONBOARDING_STATE,
		);
	});
});

describe("onboarding storage SSR guard", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns defaults on read and no-ops on write without window", () => {
		vi.stubGlobal("window", undefined);

		expect(loadOnboardingState({ mode: "guest" })).toEqual(
			DEFAULT_ONBOARDING_STATE,
		);

		saveOnboardingState(
			{ mode: "guest" },
			{
				...DEFAULT_ONBOARDING_STATE,
				firstRunDismissed: true,
			},
		);

		expect(
			patchOnboardingState({ mode: "guest" }, { firstRunDismissed: true }),
		).toEqual({
			...DEFAULT_ONBOARDING_STATE,
			firstRunDismissed: true,
		});
	});
});
