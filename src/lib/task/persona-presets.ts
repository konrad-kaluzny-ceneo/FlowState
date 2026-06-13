import type { CommitmentHorizon } from "~/lib/data-mode/types";
import type { WorkTypeKey } from "~/lib/design/work-type-config";

export type PersonaPresetId = "deep-planning" | "mail-admin" | "hotfix-urgent";

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

export const TASK_PERSONA_PRESETS: readonly TaskPersonaPreset[] = [
	{
		id: "deep-planning",
		label: "Deep planning",
		workType: "DEEP_WORK",
		urgency: 2,
		importance: 3,
		effortMinutes: 60,
		commitmentHorizon: "THIS_WEEK",
	},
	{
		id: "mail-admin",
		label: "Mail & admin",
		workType: "OPERATIONAL",
		urgency: 2,
		importance: 2,
		effortMinutes: 15,
		commitmentHorizon: "WHEN_POSSIBLE",
	},
	{
		id: "hotfix-urgent",
		label: "Hotfix urgent",
		workType: "REACTIVE",
		urgency: 3,
		importance: 2,
		effortMinutes: 30,
		commitmentHorizon: "ASAP",
	},
];

export const DEFAULT_CREATE_FORM_ATTRIBUTES: PersonaPresetCreateState = {
	workType: "OPERATIONAL",
	urgency: 2,
	importance: 2,
	effortMinutes: "",
	commitmentHorizon: "WHEN_POSSIBLE",
};

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
