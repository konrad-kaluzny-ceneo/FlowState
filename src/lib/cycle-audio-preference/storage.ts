import type { OnboardingScope } from "~/lib/onboarding/types";

import {
	type CycleEndAudioMode,
	cycleEndAudioModeSchema,
	DEFAULT_CYCLE_END_AUDIO_MODE,
} from "./types";

const KEY_GUEST = "flowstate:cycleEndAudio:guest";

function keyForScope(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return KEY_GUEST;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:cycleEndAudio:${scope.userId}`;
}

function isValidMode(value: unknown): value is CycleEndAudioMode {
	return (
		typeof value === "string" &&
		(cycleEndAudioModeSchema as readonly string[]).includes(value)
	);
}

function parseStoredMode(raw: string): CycleEndAudioMode | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (isValidMode(parsed)) {
			return parsed;
		}
	} catch {
		if (isValidMode(raw)) {
			return raw;
		}
	}

	return null;
}

export function readCycleEndAudioMode(
	scope: OnboardingScope,
): CycleEndAudioMode {
	if (typeof window === "undefined") {
		return DEFAULT_CYCLE_END_AUDIO_MODE;
	}

	const key = keyForScope(scope);
	if (key == null) {
		return DEFAULT_CYCLE_END_AUDIO_MODE;
	}

	try {
		const raw = localStorage.getItem(key);
		if (raw == null) {
			return DEFAULT_CYCLE_END_AUDIO_MODE;
		}

		return parseStoredMode(raw) ?? DEFAULT_CYCLE_END_AUDIO_MODE;
	} catch {
		return DEFAULT_CYCLE_END_AUDIO_MODE;
	}
}

export function writeCycleEndAudioMode(
	scope: OnboardingScope,
	mode: CycleEndAudioMode,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = keyForScope(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(mode));
	} catch {
		// localStorage unavailable (private mode, quota, etc.)
	}
}

/** Guest key only — for one-time auth handoff when server row is still default. */
export function readGuestModeForMerge(): CycleEndAudioMode | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const mode = readCycleEndAudioMode({ mode: "guest" });
		if (mode === DEFAULT_CYCLE_END_AUDIO_MODE) {
			return null;
		}
		return mode;
	} catch {
		return null;
	}
}
