"use client";

import { HeaderPreferenceControls } from "~/app/_components/header-preference-controls";
import type { OnboardingScope } from "~/lib/onboarding/types";

export function GuestHeaderControls({ scope }: { scope: OnboardingScope }) {
	return <HeaderPreferenceControls scope={scope} />;
}
