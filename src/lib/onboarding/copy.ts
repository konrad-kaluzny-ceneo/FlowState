export type FirstRunMode = "guest" | "authenticated";

export type FirstRunCopy = {
	title: string;
	body: string;
	dismissLabel: string;
};

export function getFirstRunCopy(mode: FirstRunMode): FirstRunCopy {
	if (mode === "guest") {
		return {
			title: "Welcome to FlowState",
			body: "Add a task, tap Focus on it, then start a focus cycle. When you're ready for more, sign in to unlock energy check-ins and smart task suggestions after each cycle.",
			dismissLabel: "Got it",
		};
	}

	return {
		title: "Your wedge workflow",
		body: "When a focus cycle ends, you'll get a quick energy check-in. FlowState then suggests your best next task with a short rationale — accept the suggestion or pick any other task to focus.",
		dismissLabel: "Got it",
	};
}
