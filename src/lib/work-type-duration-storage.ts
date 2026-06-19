import type { WorkType } from "~/lib/domain/work-type";

import {
	getKickoffPresetSec,
	getMaxWorkDurationSec,
	getMinWorkDurationSec,
} from "~/lib/duration-bounds";
import { getLastDuration } from "~/lib/duration-storage";
import type { OnboardingScope } from "~/lib/onboarding/types";

const KEY_GUEST = "flowstate:workTypeDurationSec";

export type WorkTypeDurationMap = Partial<Record<WorkType, number>>;

function keyForScope(scope: OnboardingScope): string | null {
	if (scope.mode === "guest") {
		return KEY_GUEST;
	}

	if (!scope.userId) {
		return null;
	}

	return `flowstate:workTypeDurationSec:${scope.userId}`;
}

function parseStoredMap(raw: string | null): WorkTypeDurationMap {
	if (raw == null) {
		return {};
	}

	try {
		const parsed = JSON.parse(raw) as WorkTypeDurationMap;
		if (parsed == null || typeof parsed !== "object") {
			return {};
		}
		return parsed;
	} catch {
		return {};
	}
}

function clampWorkDuration(sec: number): number {
	return Math.min(
		getMaxWorkDurationSec(),
		Math.max(getMinWorkDurationSec(), sec),
	);
}

function readStoredMap(scope: OnboardingScope): WorkTypeDurationMap {
	if (typeof window === "undefined") {
		return {};
	}

	const key = keyForScope(scope);
	if (key == null) {
		return {};
	}

	try {
		return parseStoredMap(localStorage.getItem(key));
	} catch {
		return {};
	}
}

function writeStoredMap(
	scope: OnboardingScope,
	map: WorkTypeDurationMap,
): void {
	if (typeof window === "undefined") {
		return;
	}

	const key = keyForScope(scope);
	if (key == null) {
		return;
	}

	try {
		localStorage.setItem(key, JSON.stringify(map));
	} catch {
		// localStorage unavailable
	}
}

function isValidStoredSec(sec: unknown): sec is number {
	return (
		typeof sec === "number" &&
		Number.isFinite(sec) &&
		sec >= getMinWorkDurationSec() &&
		sec <= getMaxWorkDurationSec()
	);
}

/** Returns remembered per-type duration only (undefined when never tapped). */
export function getWorkTypeDuration(
	workType: WorkType,
	scope: OnboardingScope,
): number | undefined {
	const stored = readStoredMap(scope)[workType];
	if (!isValidStoredSec(stored)) {
		return undefined;
	}
	return stored;
}

/** Persists duration on explicit chip tap only. */
export function setWorkTypeDuration(
	workType: WorkType,
	sec: number,
	scope: OnboardingScope,
): void {
	const map = readStoredMap(scope);
	map[workType] = clampWorkDuration(sec);
	writeStoredMap(scope, map);
}

/** Chip display value: remembered → PRD preset → global last duration. */
export function resolveKickoffChipSec(
	workType: WorkType,
	scope: OnboardingScope,
): number {
	const remembered = getWorkTypeDuration(workType, scope);
	if (remembered != null) {
		return remembered;
	}

	return getKickoffPresetSec(workType) ?? getLastDuration();
}
