"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { OnboardingScope } from "~/lib/onboarding/types";

type AppUserContextValue = {
	scope: OnboardingScope;
	userName: string | null;
};

const AppUserContext = createContext<AppUserContextValue | null>(null);

export function AppUserProvider({
	children,
	scope,
	userName,
}: {
	children: ReactNode;
	scope: OnboardingScope;
	userName: string | null;
}) {
	return (
		<AppUserContext.Provider value={{ scope, userName }}>
			{children}
		</AppUserContext.Provider>
	);
}

export function useAppUser(): AppUserContextValue {
	const ctx = useContext(AppUserContext);
	if (ctx == null) {
		throw new Error("useAppUser must be used within AppUserProvider");
	}
	return ctx;
}
