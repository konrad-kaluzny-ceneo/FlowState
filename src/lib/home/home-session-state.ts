import { shouldShowWorkFocusShell } from "~/lib/design/work-focus-shell";

export const HOME_MODULE_KEYS = [
	"purposeHeader",
	"timer",
	"nextFocus",
	"steering",
	"recap",
	"inventory",
	"archive",
	"statusLine",
	"returnBanner",
] as const;

export type HomeModuleKey = (typeof HOME_MODULE_KEYS)[number];
export type HomeModulePriority = "primary" | "secondary" | "hidden";
export type HomeSessionState =
	| "idle"
	| "steering"
	| "active_work"
	| "break"
	| "returning";

export type HomeModulePriorities = Record<HomeModuleKey, HomeModulePriority>;

export type DeriveHomeSessionStateInput = {
	dataMode: "guest" | "authenticated";
	cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null;
	cycleState: "idle" | "running" | "paused" | "completed";
	wedgeGateActive: boolean;
	enableSuggestionGate: boolean;
	showSessionEnergy: boolean;
	showSessionFocus: boolean;
	pendingKickoffSuggestionStatus: "idle" | "loading" | "ready" | "error";
	pendingSuggestionStatus: "idle" | "loading" | "ready" | "error";
	focusedTaskId: string | number | null;
	continueTaskId: string | number | null;
	hasPreFocusedKickoff: boolean;
	workTypeDurationScopeAvailable: boolean;
	taskInventoryView: "list" | "archive";
	recapAvailable: boolean;
	showInFlowSummary: boolean;
	showBreakTransitionLine: boolean;
};

export type DeriveHomeSessionStateOutput = {
	state: HomeSessionState;
	modules: HomeModulePriorities;
};

function hiddenModules(): HomeModulePriorities {
	return {
		purposeHeader: "hidden",
		timer: "hidden",
		nextFocus: "hidden",
		steering: "hidden",
		recap: "hidden",
		inventory: "hidden",
		archive: "hidden",
		statusLine: "hidden",
		returnBanner: "hidden",
	};
}

function isBreakCycleKind(
	cycleKind: DeriveHomeSessionStateInput["cycleKind"],
): boolean {
	return cycleKind === "SHORT_BREAK" || cycleKind === "LONG_BREAK";
}

function isBreakRunning(input: DeriveHomeSessionStateInput): boolean {
	return input.cycleState === "running" && isBreakCycleKind(input.cycleKind);
}

function hasKickoffCard(input: DeriveHomeSessionStateInput): boolean {
	return (
		input.enableSuggestionGate &&
		input.cycleState !== "paused" &&
		input.cycleState === "idle" &&
		input.focusedTaskId == null &&
		input.pendingKickoffSuggestionStatus !== "idle" &&
		!input.showSessionEnergy &&
		!input.showSessionFocus
	);
}

function hasBreakSuggestion(input: DeriveHomeSessionStateInput): boolean {
	return (
		input.enableSuggestionGate &&
		input.cycleState !== "paused" &&
		isBreakRunning(input) &&
		input.pendingSuggestionStatus !== "idle"
	);
}

function hasKickoffDurationChips(input: DeriveHomeSessionStateInput): boolean {
	return (
		input.enableSuggestionGate &&
		input.cycleState !== "paused" &&
		input.hasPreFocusedKickoff &&
		input.cycleState === "idle" &&
		input.focusedTaskId != null &&
		input.pendingKickoffSuggestionStatus === "ready" &&
		input.workTypeDurationScopeAvailable
	);
}

function hasNextFocusAffordance(input: DeriveHomeSessionStateInput): boolean {
	return (
		hasKickoffCard(input) ||
		hasBreakSuggestion(input) ||
		hasKickoffDurationChips(input)
	);
}

function isActiveWork(input: DeriveHomeSessionStateInput): boolean {
	return shouldShowWorkFocusShell({
		cycleKind: input.cycleKind,
		state: input.cycleState,
		wedgeGateActive: input.wedgeGateActive,
	});
}

function isBreakSession(input: DeriveHomeSessionStateInput): boolean {
	if (input.wedgeGateActive || !isBreakCycleKind(input.cycleKind)) {
		return false;
	}
	return input.cycleState === "running" || input.cycleState === "paused";
}

function isReturning(input: DeriveHomeSessionStateInput): boolean {
	return (
		input.continueTaskId != null &&
		input.cycleState === "idle" &&
		input.cycleKind === null &&
		!input.wedgeGateActive
	);
}

function isSteering(input: DeriveHomeSessionStateInput): boolean {
	return (
		input.enableSuggestionGate &&
		(input.showSessionEnergy || input.showSessionFocus)
	);
}

function resolveSessionState(
	input: DeriveHomeSessionStateInput,
): HomeSessionState {
	if (isActiveWork(input)) {
		return "active_work";
	}
	if (isBreakSession(input)) {
		return "break";
	}
	if (isReturning(input)) {
		return "returning";
	}
	if (isSteering(input)) {
		return "steering";
	}
	return "idle";
}

function applyInventoryArchiveView(
	modules: HomeModulePriorities,
	input: DeriveHomeSessionStateInput,
): void {
	if (input.taskInventoryView === "archive") {
		modules.archive = "primary";
		modules.inventory = "hidden";
	}
}

function applyRecap(
	modules: HomeModulePriorities,
	input: DeriveHomeSessionStateInput,
): void {
	if (input.recapAvailable && modules.recap === "hidden") {
		modules.recap = "secondary";
	}
}

function deriveIdleModules(
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	const modules = hiddenModules();
	modules.purposeHeader = "secondary";
	modules.returnBanner = "hidden";

	if (hasNextFocusAffordance(input)) {
		modules.nextFocus = "primary";
	}

	if (input.taskInventoryView === "list") {
		modules.inventory = "secondary";
	}

	applyRecap(modules, input);
	applyInventoryArchiveView(modules, input);
	return modules;
}

function deriveSteeringModules(
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	const modules = hiddenModules();
	modules.purposeHeader = "secondary";
	modules.steering = "primary";
	modules.returnBanner = "hidden";

	if (input.taskInventoryView === "list") {
		modules.inventory = "secondary";
	}

	applyRecap(modules, input);
	applyInventoryArchiveView(modules, input);
	return modules;
}

function deriveReturningModules(
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	const modules = hiddenModules();
	modules.purposeHeader = "secondary";
	modules.returnBanner = "hidden";

	if (hasNextFocusAffordance(input)) {
		modules.nextFocus = "primary";
		if (isSteering(input)) {
			modules.steering = "secondary";
		}
	} else if (isSteering(input)) {
		modules.steering = "primary";
	}

	if (input.taskInventoryView === "list") {
		modules.inventory = "secondary";
	}

	applyRecap(modules, input);
	applyInventoryArchiveView(modules, input);
	return modules;
}

function deriveActiveWorkModules(
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	const modules = hiddenModules();
	modules.timer = "primary";
	modules.purposeHeader = "secondary";
	modules.returnBanner = "hidden";

	if (input.showInFlowSummary) {
		modules.statusLine = "secondary";
	}

	if (input.taskInventoryView === "list") {
		modules.inventory = "secondary";
	}

	applyInventoryArchiveView(modules, input);
	return modules;
}

function deriveBreakModules(
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	const modules = hiddenModules();
	modules.purposeHeader = "secondary";
	modules.returnBanner = "hidden";

	if (hasBreakSuggestion(input)) {
		modules.nextFocus = "primary";
		modules.timer = "secondary";
	} else {
		modules.timer = "primary";
	}

	if (input.showInFlowSummary || input.showBreakTransitionLine) {
		modules.statusLine = "secondary";
	}

	if (input.taskInventoryView === "list") {
		modules.inventory = "secondary";
	}

	applyRecap(modules, input);
	applyInventoryArchiveView(modules, input);
	return modules;
}

function deriveModulePriorities(
	state: HomeSessionState,
	input: DeriveHomeSessionStateInput,
): HomeModulePriorities {
	switch (state) {
		case "idle":
			return deriveIdleModules(input);
		case "steering":
			return deriveSteeringModules(input);
		case "returning":
			return deriveReturningModules(input);
		case "active_work":
			return deriveActiveWorkModules(input);
		case "break":
			return deriveBreakModules(input);
	}
}

function normalizeGuestInput(
	input: DeriveHomeSessionStateInput,
): DeriveHomeSessionStateInput {
	if (input.dataMode !== "guest") {
		return input;
	}
	return { ...input, enableSuggestionGate: false };
}

export function deriveHomeSessionState(
	input: DeriveHomeSessionStateInput,
): DeriveHomeSessionStateOutput {
	const normalizedInput = normalizeGuestInput(input);
	const state = resolveSessionState(normalizedInput);
	const modules = deriveModulePriorities(state, normalizedInput);
	return { state, modules };
}
