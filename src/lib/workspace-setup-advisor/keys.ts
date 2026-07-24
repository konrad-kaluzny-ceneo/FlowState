import type { OnboardingScope } from "~/lib/onboarding/types";

export const WORKSPACE_SETUP_KEY_GUEST =
	"flowstate:workspaceSetupAdvisor:guest";

export function workspaceSetupKeyForScope(
	scope: OnboardingScope,
): string | null {
	if (scope.mode === "guest") {
		return WORKSPACE_SETUP_KEY_GUEST;
	}

	if (!scope.userId) {
		return null;
	}

	// Namespace authenticated keys under `user:` so an (unlikely) userId of
	// "guest" cannot collide with the guest key and merge state across scopes.
	return `flowstate:workspaceSetupAdvisor:user:${scope.userId}`;
}
