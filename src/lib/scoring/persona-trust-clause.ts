import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getPersonaPresetLabel,
	PERSONA_PRESET_CUSTOM_ID,
	type PersonaPresetId,
	resolveTaskPersonaBadge,
	type TaskPresetAttributes,
} from "~/lib/task/persona-presets";

const PERSONA_TRUST_KEYS: Record<PersonaPresetId, string> = {
	focus: "focus",
	synchro: "synchro",
	firefight: "firefight",
	"warm-up": "warm-up",
	meeting: "meeting",
	plan: "plan",
	research: "research",
	quick: "quick",
};

export function buildPersonaTrustClause(
	personaPresetId: string | null | undefined,
	locale: UserLocale = "en",
): string | null {
	if (personaPresetId == null || personaPresetId === PERSONA_PRESET_CUSTOM_ID) {
		return null;
	}

	const label = getPersonaPresetLabel(personaPresetId, locale);
	if (label == null) {
		return null;
	}

	const hintKey = PERSONA_TRUST_KEYS[personaPresetId as PersonaPresetId];
	if (hintKey == null) {
		return null;
	}

	const hint = createNamespaceTranslator(
		"Scoring.personaTrust",
		locale,
	)(hintKey);
	return `${label} — ${hint}.`;
}

export function buildPersonaTrustClauseForTask(
	task: TaskPresetAttributes & { personaPresetId: string | null },
	locale: UserLocale = "en",
): string | null {
	const badge = resolveTaskPersonaBadge(task);
	if (badge.mode !== "persona" || badge.presetId == null) {
		return null;
	}
	return buildPersonaTrustClause(badge.presetId, locale);
}

export function composeSuggestionRationale(
	scoringRationale: string,
	personaClause: string | null,
): string {
	if (personaClause == null) {
		return scoringRationale;
	}
	return `${personaClause} ${scoringRationale}`;
}
