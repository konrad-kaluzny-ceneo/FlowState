import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { EnergyLevel } from "~/lib/domain/energy-level";
import type { UserLocale } from "~/lib/domain/user-locale";

import {
	getClosurePrefix,
	getHandoffContinuePrefix,
	getHandoffLeftOffPrefix,
} from "./narrative-copy";

export const RETURN_HANDOFF_THRESHOLD_MS = 8 * 60 * 60 * 1000;

export function getReturnHandoffThresholdMs(): number {
	const override = process.env.NEXT_PUBLIC_E2E_RETURN_HANDOFF_THRESHOLD_MS;
	if (override != null && override.length > 0) {
		const parsed = Number(override);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return RETURN_HANDOFF_THRESHOLD_MS;
}

export type InFlowSummaryInput = {
	cyclesCompleted: number;
	tasksCompleted: number;
	latestEnergy: EnergyLevel | null;
	intention?: string | null;
};

export type ClosureLineInput = {
	cyclesCompleted: number;
	tasksCompleted: number;
	latestEnergy: EnergyLevel | null;
	endedBy: "user" | "timeout" | "pause_cap";
	/** S-38: user ended during an in-progress work block — clarify it is excluded from stats. */
	interruptedMidCycle?: boolean;
};

export type ReturnHandoffInput = {
	closureLine: string | null;
	resumeNote?: string | null;
	taskTitle?: string | null;
};

export type ReturnHandoffGateInput = {
	endedAt: Date | null;
	sessionId: number | string;
	dismissedSessionIds: string[];
};

function narrativeT(locale: UserLocale) {
	return createNamespaceTranslator("Session.narrative", locale);
}

function formatCycleCount(count: number, locale: UserLocale): string {
	return narrativeT(locale)("cycleCount", { count });
}

function formatTaskCount(count: number, locale: UserLocale): string {
	return narrativeT(locale)("taskDone", { count });
}

function formatEnergy(
	energy: EnergyLevel | null,
	locale: UserLocale,
): string | null {
	if (!energy) return null;
	const t = narrativeT(locale);
	const label =
		energy === "FOCUSED"
			? t("energyFocused")
			: energy === "STEADY"
				? t("energySteady")
				: t("energyFading");
	return t("feelingEnergy", { energy: label });
}

export function buildInFlowSummary(
	input: InFlowSummaryInput,
	locale: UserLocale = "en",
): string | null {
	const t = narrativeT(locale);
	const parts: string[] = [];

	if (input.cyclesCompleted > 0) {
		parts.push(formatCycleCount(input.cyclesCompleted, locale));
	}

	const taskPart = formatTaskCount(input.tasksCompleted, locale);
	if (taskPart) {
		parts.push(taskPart);
	}

	const energyPart = formatEnergy(input.latestEnergy, locale);
	if (energyPart) {
		parts.push(energyPart);
	}

	const intention = input.intention?.trim();
	if (intention) {
		parts.push(intention);
	}

	if (parts.length === 0) {
		return null;
	}

	return parts.join(t("separator"));
}

function formatClosureStatsParts(
	input: ClosureLineInput,
	locale: UserLocale,
): string {
	const t = narrativeT(locale);
	if (
		input.interruptedMidCycle &&
		input.endedBy === "user" &&
		input.cyclesCompleted === 0 &&
		input.tasksCompleted === 0
	) {
		return t("noFinishedCycles");
	}

	const cyclePart = formatCycleCount(
		Math.max(input.cyclesCompleted, 0),
		locale,
	);
	const taskPart = formatTaskCount(input.tasksCompleted, locale);
	return [cyclePart, taskPart].filter(Boolean).join(t("statsSeparator"));
}

function appendMidCycleNote(
	line: string,
	input: ClosureLineInput,
	locale: UserLocale,
): string {
	if (!input.interruptedMidCycle || input.endedBy !== "user") {
		return line;
	}

	const note = ` ${narrativeT(locale)("midCycleNotCounted")}`;
	if (line.length + note.length > 120) {
		return line;
	}

	return `${line}${note}`;
}

export function buildClosureLine(
	input: ClosureLineInput,
	locale: UserLocale = "en",
): string {
	const t = narrativeT(locale);
	const statsParts = formatClosureStatsParts(input, locale);
	const energyPart = formatEnergy(input.latestEnergy, locale);
	const prefix = getClosurePrefix(locale);

	if (input.endedBy === "pause_cap") {
		if (energyPart) {
			return appendMidCycleNote(
				t("pauseCapWithEnergy", {
					stats: statsParts,
					energy: capitalize(energyPart),
				}),
				input,
				locale,
			);
		}
		return appendMidCycleNote(
			t("pauseCapNoEnergy", { stats: statsParts }),
			input,
			locale,
		);
	}

	if (energyPart) {
		return appendMidCycleNote(
			t("closureWithEnergy", {
				prefix,
				stats: statsParts,
				energy: capitalize(energyPart),
			}),
			input,
			locale,
		);
	}

	return appendMidCycleNote(
		t("closureNoEnergy", { prefix, stats: statsParts }),
		input,
		locale,
	);
}

export function buildReturnHandoff(
	input: ReturnHandoffInput,
	locale: UserLocale = "en",
): string | null {
	const t = narrativeT(locale);
	const clauses: string[] = [];
	const resumeNote = input.resumeNote?.trim();
	const taskTitle = input.taskTitle?.trim();
	const closureLine = input.closureLine?.trim();
	const leftOff = getHandoffLeftOffPrefix(locale);
	const continuePrefix = getHandoffContinuePrefix(locale);

	if (resumeNote) {
		clauses.push(`${leftOff} ${resumeNote}`);
	} else if (taskTitle) {
		clauses.push(`${continuePrefix} ${taskTitle}`);
	}

	if (closureLine && clauses.length < 2) {
		clauses.push(closureLine);
	} else if (taskTitle && resumeNote && clauses.length < 2) {
		clauses.push(`${continuePrefix} ${taskTitle}`);
	}

	if (clauses.length === 0) {
		return null;
	}

	return clauses.slice(0, 2).join(t("separator"));
}

export function shouldShowReturnHandoff(
	input: ReturnHandoffGateInput,
): boolean {
	if (!input.endedAt) {
		return false;
	}

	const sessionKey = String(input.sessionId);
	if (input.dismissedSessionIds.includes(sessionKey)) {
		return false;
	}

	const elapsedMs = Date.now() - input.endedAt.getTime();
	return elapsedMs >= getReturnHandoffThresholdMs();
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

/** @deprecated EN-only — tests use buildClosureLine with default locale */
export const MID_CYCLE_FOCUS_NOT_COUNTED =
	narrativeT("en")("midCycleNotCounted");
