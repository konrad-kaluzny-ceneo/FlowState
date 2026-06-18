import {
	getPersonaPresetLabel,
	PERSONA_PRESET_CUSTOM_ID,
	type PersonaPresetId,
} from "~/lib/task/persona-presets";

const PERSONA_TRUST_HINTS: Record<PersonaPresetId, string> = {
	focus: "deep work matches how you framed this",
	synchro: "operational work fits your choice",
	firefight: "reactive work fits your choice",
	"warm-up": "a light warm-up fits your choice",
	meeting: "meeting prep fits your choice",
	plan: "planning work fits your choice",
	research: "research fits how you framed this",
	quick: "a quick task fits your choice",
};

export function buildPersonaTrustClause(
	personaPresetId: string | null | undefined,
): string | null {
	if (personaPresetId == null || personaPresetId === PERSONA_PRESET_CUSTOM_ID) {
		return null;
	}

	const label = getPersonaPresetLabel(personaPresetId);
	if (label == null) {
		return null;
	}

	const hint = PERSONA_TRUST_HINTS[personaPresetId as PersonaPresetId];
	if (hint == null) {
		return null;
	}

	return `${label} — ${hint}.`;
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
