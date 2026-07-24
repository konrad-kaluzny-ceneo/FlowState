import type { WorkspaceTip, WorkspaceTipId } from "./types";

export const WORKSPACE_TIPS = [
	{ id: "cursor-agents", category: "editor" },
	{ id: "claude-agents", category: "editor" },
	{ id: "slack-dnd", category: "chat" },
	{ id: "teams-focus", category: "chat" },
	{ id: "browser-notifications", category: "notifications" },
	{ id: "email-batching", category: "notifications" },
	{ id: "phone-dnd", category: "device" },
	{ id: "os-focus", category: "device" },
] as const satisfies readonly WorkspaceTip[];

const TIP_ID_SET: ReadonlySet<string> = new Set(
	WORKSPACE_TIPS.map((tip) => tip.id),
);

export function isWorkspaceTipId(value: string): value is WorkspaceTipId {
	return TIP_ID_SET.has(value);
}

export function filterKnownTipIds(ids: readonly string[]): WorkspaceTipId[] {
	const seen = new Set<WorkspaceTipId>();
	const result: WorkspaceTipId[] = [];

	for (const id of ids) {
		if (!isWorkspaceTipId(id) || seen.has(id)) {
			continue;
		}
		seen.add(id);
		result.push(id);
	}

	return result;
}
