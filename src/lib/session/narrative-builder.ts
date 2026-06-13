import type { EnergyLevel } from "@prisma/generated";

import {
	CLOSURE_PREFIX,
	ENERGY_LABELS,
	HANDOFF_CONTINUE_PREFIX,
	HANDOFF_LEFT_OFF_PREFIX,
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
	endedBy: "user" | "timeout";
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

function formatCycleCount(count: number): string {
	return count === 1 ? "1 cycle" : `${count} cycles`;
}

function formatTaskCount(count: number): string {
	if (count === 0) return "";
	return count === 1 ? "1 task done" : `${count} tasks done`;
}

function formatEnergy(energy: EnergyLevel | null): string | null {
	if (!energy) return null;
	return `feeling ${ENERGY_LABELS[energy]}`;
}

export function buildInFlowSummary(input: InFlowSummaryInput): string | null {
	const parts: string[] = [];

	if (input.cyclesCompleted > 0) {
		parts.push(formatCycleCount(input.cyclesCompleted));
	}

	const taskPart = formatTaskCount(input.tasksCompleted);
	if (taskPart) {
		parts.push(taskPart);
	}

	const energyPart = formatEnergy(input.latestEnergy);
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

	return parts.join(" · ");
}

export function buildClosureLine(input: ClosureLineInput): string {
	const cyclePart = formatCycleCount(Math.max(input.cyclesCompleted, 0));
	const taskPart = formatTaskCount(input.tasksCompleted);
	const statsParts = [cyclePart, taskPart].filter(Boolean).join(", ");
	const energyPart = formatEnergy(input.latestEnergy);

	if (energyPart) {
		return `${CLOSURE_PREFIX} — ${statsParts}. ${capitalize(energyPart)}.`;
	}

	return `${CLOSURE_PREFIX} — ${statsParts}. Take a breath.`;
}

export function buildReturnHandoff(input: ReturnHandoffInput): string | null {
	const clauses: string[] = [];
	const resumeNote = input.resumeNote?.trim();
	const taskTitle = input.taskTitle?.trim();
	const closureLine = input.closureLine?.trim();

	if (resumeNote) {
		clauses.push(`${HANDOFF_LEFT_OFF_PREFIX} ${resumeNote}`);
	} else if (taskTitle) {
		clauses.push(`${HANDOFF_CONTINUE_PREFIX} ${taskTitle}`);
	}

	if (closureLine && clauses.length < 2) {
		clauses.push(closureLine);
	} else if (taskTitle && resumeNote && clauses.length < 2) {
		clauses.push(`${HANDOFF_CONTINUE_PREFIX} ${taskTitle}`);
	}

	if (clauses.length === 0) {
		return null;
	}

	return clauses.slice(0, 2).join(" · ");
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
