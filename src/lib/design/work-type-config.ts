export const WORK_TYPE_CONFIG = {
	DEEP_WORK: {
		label: "Deep",
		bg: "bg-worktype-deep-bg",
		text: "text-worktype-deep-text",
		segmentActive: "bg-worktype-deep-bg text-worktype-deep-text",
	},
	OPERATIONAL: {
		label: "Ops",
		bg: "bg-worktype-ops-bg",
		text: "text-worktype-ops-text",
		segmentActive: "bg-worktype-ops-bg text-worktype-ops-text",
	},
	REACTIVE: {
		label: "Reactive",
		bg: "bg-worktype-reactive-bg",
		text: "text-worktype-reactive-text",
		segmentActive: "bg-worktype-reactive-bg text-worktype-reactive-text",
	},
} as const;

export type WorkTypeKey = keyof typeof WORK_TYPE_CONFIG;
