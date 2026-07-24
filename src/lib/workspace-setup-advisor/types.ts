export type WorkspaceTipCategory =
	| "editor"
	| "chat"
	| "notifications"
	| "device";

export type WorkspaceTipId =
	| "cursor-agents"
	| "claude-agents"
	| "slack-dnd"
	| "teams-focus"
	| "browser-notifications"
	| "email-batching"
	| "phone-dnd"
	| "os-focus";

export interface WorkspaceTip {
	readonly id: WorkspaceTipId;
	readonly category: WorkspaceTipCategory;
}

export interface WorkspaceSetupState {
	doneTipIds: WorkspaceTipId[];
	nudgeDismissed: boolean;
}

export const DEFAULT_WORKSPACE_SETUP_STATE: WorkspaceSetupState = {
	doneTipIds: [],
	nudgeDismissed: false,
};
