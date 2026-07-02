"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import type { EnergyLevel } from "~/lib/domain/energy-level";

import type { IllustrationVariant } from "./illustration-variant";

export type HomeIllustrationState = {
	variant: IllustrationVariant;
	energyTint: EnergyLevel | null;
};

const IDLE_ILLUSTRATION_STATE: HomeIllustrationState = {
	variant: "idle",
	energyTint: null,
};

type HomeIllustrationVariantContextValue = {
	illustration: HomeIllustrationState;
	publish: (next: HomeIllustrationState) => void;
};

const HomeIllustrationVariantContext =
	createContext<HomeIllustrationVariantContextValue | null>(null);

/**
 * Single-owner bridge for the resolved illustration variant. The dashboard
 * body owns the session-state derivation (`deriveHomeSessionState()` +
 * `resolveIllustrationVariant()`, one call per render pass, downstream of
 * committed cycle state) and publishes the result here; the home hero — a
 * sibling of the dashboard under `HomeShellContent` — consumes the same
 * value. One derivation, two consumers. Without a provider, or before the
 * dashboard mounts (guest hero, authenticated Suspense fallback), consumers
 * degrade to the calm `idle` baseline.
 */
export function HomeIllustrationVariantProvider({
	children,
}: {
	children: ReactNode;
}) {
	const [illustration, publish] = useState<HomeIllustrationState>(
		IDLE_ILLUSTRATION_STATE,
	);
	const value = useMemo(() => ({ illustration, publish }), [illustration]);

	return (
		<HomeIllustrationVariantContext.Provider value={value}>
			{children}
		</HomeIllustrationVariantContext.Provider>
	);
}

export function useHomeIllustrationVariant(): HomeIllustrationState {
	return (
		useContext(HomeIllustrationVariantContext)?.illustration ??
		IDLE_ILLUSTRATION_STATE
	);
}

export function usePublishHomeIllustrationVariant(
	illustration: HomeIllustrationState,
): void {
	const publish = useContext(HomeIllustrationVariantContext)?.publish;

	useEffect(() => {
		publish?.(illustration);
	}, [publish, illustration]);
}
