import type { CommitmentHorizon } from "~/lib/data-mode/types";
import type { WorkTypeKey } from "~/lib/design/work-type-config";

export type PersonaPresetId =
	| "focus"
	| "synchro"
	| "firefight"
	| "warm-up"
	| "meeting"
	| "plan"
	| "research"
	| "quick";

export type PersonaPresetCreateState = {
	workType: WorkTypeKey;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: string;
	commitmentHorizon: CommitmentHorizon;
};

export type TaskPersonaPreset = {
	id: PersonaPresetId;
	label: string;
	workType: WorkTypeKey;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	effortMinutes: number;
	commitmentHorizon: CommitmentHorizon;
};

export type TaskBadgeDisplayMode = "legacy" | "persona" | "custom-detail";

export type TaskPresetAttributes = {
	workType: WorkTypeKey;
	urgency: 1 | 2 | 3;
	importance: 1 | 2 | 3;
	commitmentHorizon: CommitmentHorizon;
	effortMinutes: number | null;
};

export const PERSONA_PRESET_CUSTOM_ID = "custom" as const;

export const TASK_PERSONA_PRESETS: readonly TaskPersonaPreset[] = [
	{
		id: "focus",
		label: "Focus",
		workType: "DEEP_WORK",
		urgency: 2,
		importance: 3,
		effortMinutes: 45,
		commitmentHorizon: "THIS_WEEK",
	},
	{
		id: "synchro",
		label: "Synchro",
		workType: "OPERATIONAL",
		urgency: 2,
		importance: 2,
		effortMinutes: 15,
		commitmentHorizon: "WHEN_POSSIBLE",
	},
	{
		id: "firefight",
		label: "Firefight",
		workType: "REACTIVE",
		urgency: 3,
		importance: 2,
		effortMinutes: 30,
		commitmentHorizon: "ASAP",
	},
	{
		id: "warm-up",
		label: "Warm up",
		workType: "DEEP_WORK",
		urgency: 1,
		importance: 2,
		effortMinutes: 15,
		commitmentHorizon: "THIS_WEEK",
	},
	{
		id: "meeting",
		label: "Meeting",
		workType: "OPERATIONAL",
		urgency: 2,
		importance: 2,
		effortMinutes: 30,
		commitmentHorizon: "THIS_WEEK",
	},
	{
		id: "plan",
		label: "Plan",
		workType: "DEEP_WORK",
		urgency: 2,
		importance: 3,
		effortMinutes: 60,
		commitmentHorizon: "THIS_WEEK",
	},
	{
		id: "research",
		label: "Research",
		workType: "DEEP_WORK",
		urgency: 1,
		importance: 2,
		effortMinutes: 45,
		commitmentHorizon: "WHEN_POSSIBLE",
	},
	{
		id: "quick",
		label: "Quick",
		workType: "OPERATIONAL",
		urgency: 1,
		importance: 1,
		effortMinutes: 10,
		commitmentHorizon: "ASAP",
	},
];

export const PERSONA_PRESET_IDS: readonly PersonaPresetId[] =
	TASK_PERSONA_PRESETS.map((preset) => preset.id);

export const DEFAULT_CREATE_FORM_ATTRIBUTES: PersonaPresetCreateState = {
	workType: "OPERATIONAL",
	urgency: 2,
	importance: 2,
	effortMinutes: "",
	commitmentHorizon: "WHEN_POSSIBLE",
};

export function isStoredPersonaPresetId(id: string): boolean {
	if (id === PERSONA_PRESET_CUSTOM_ID) {
		return true;
	}
	return TASK_PERSONA_PRESETS.some((preset) => preset.id === id);
}

export function getPersonaPresetById(
	id: string,
): TaskPersonaPreset | undefined {
	return TASK_PERSONA_PRESETS.find((preset) => preset.id === id);
}

export function getPersonaPresetLabel(id: string): string | undefined {
	return getPersonaPresetById(id)?.label;
}

export function taskAttributesMatchPreset(
	task: TaskPresetAttributes,
	presetId: string,
	options?: { ignoreEffort?: boolean },
): boolean {
	const preset = getPersonaPresetById(presetId);
	if (preset == null) {
		return false;
	}

	if (task.workType !== preset.workType) {
		return false;
	}
	if (task.urgency !== preset.urgency) {
		return false;
	}
	if (task.importance !== preset.importance) {
		return false;
	}
	if (task.commitmentHorizon !== preset.commitmentHorizon) {
		return false;
	}
	if (!options?.ignoreEffort && task.effortMinutes !== preset.effortMinutes) {
		return false;
	}

	return true;
}

export function getTaskBadgeDisplayMode(
	task: TaskPresetAttributes & {
		personaPresetId: string | null;
	},
): TaskBadgeDisplayMode {
	if (task.personaPresetId == null) {
		return "legacy";
	}
	if (task.personaPresetId === PERSONA_PRESET_CUSTOM_ID) {
		return "custom-detail";
	}
	if (getPersonaPresetById(task.personaPresetId) == null) {
		return "custom-detail";
	}
	if (
		taskAttributesMatchPreset(task, task.personaPresetId, {
			ignoreEffort: true,
		})
	) {
		return "persona";
	}
	return "custom-detail";
}

export function applyPersonaPresetToCreateState(
	presetId: PersonaPresetId,
): PersonaPresetCreateState {
	const preset = TASK_PERSONA_PRESETS.find((entry) => entry.id === presetId);
	if (preset == null) {
		throw new Error(`Unknown persona preset: ${presetId}`);
	}

	return {
		workType: preset.workType,
		urgency: preset.urgency,
		importance: preset.importance,
		effortMinutes: String(preset.effortMinutes),
		commitmentHorizon: preset.commitmentHorizon,
	};
}
