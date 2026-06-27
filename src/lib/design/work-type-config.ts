import { createNamespaceTranslator } from "~/i18n/create-translator";
import type { UserLocale } from "~/lib/domain/user-locale";

export const WORK_TYPE_CONFIG = {
	DEEP_WORK: {
		bg: "bg-worktype-deep-bg",
		text: "text-worktype-deep-text",
		segmentActive: "bg-worktype-deep-bg text-worktype-deep-text",
	},
	OPERATIONAL: {
		bg: "bg-worktype-ops-bg",
		text: "text-worktype-ops-text",
		segmentActive: "bg-worktype-ops-bg text-worktype-ops-text",
	},
	REACTIVE: {
		bg: "bg-worktype-reactive-bg",
		text: "text-worktype-reactive-text",
		segmentActive: "bg-worktype-reactive-bg text-worktype-reactive-text",
	},
} as const;

export type WorkTypeKey = keyof typeof WORK_TYPE_CONFIG;

export function getWorkTypeLabel(
	workType: WorkTypeKey,
	locale: UserLocale = "en",
): string {
	return createNamespaceTranslator("Tasks.workType", locale)(workType);
}
