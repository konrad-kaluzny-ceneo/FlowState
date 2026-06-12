"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import {
	applyThemeToDocument,
	type ResolvedTheme,
	readStoredThemePreference,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ThemePreference,
} from "~/lib/design/theme";

type ThemeContextValue = {
	preference: ThemePreference;
	resolved: ResolvedTheme;
	setTheme: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [preference, setPreference] = useState<ThemePreference>("light");
	const [resolved, setResolved] = useState<ResolvedTheme>("light");

	const syncResolved = useCallback((nextPreference: ThemePreference) => {
		const nextResolved = resolveTheme(nextPreference);
		setResolved(nextResolved);
		applyThemeToDocument(nextResolved);
	}, []);

	useEffect(() => {
		const stored = readStoredThemePreference();
		const initial = stored ?? "light";
		setPreference(initial);
		syncResolved(initial);
	}, [syncResolved]);

	useEffect(() => {
		if (preference !== "system") {
			return;
		}

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => syncResolved("system");

		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [preference, syncResolved]);

	const setTheme = useCallback(
		(next: ThemePreference) => {
			setPreference(next);
			try {
				localStorage.setItem(THEME_STORAGE_KEY, next);
			} catch {
				// Private/locked storage — preference still applies for this session
			}
			syncResolved(next);
		},
		[syncResolved],
	);

	const value = useMemo(
		() => ({ preference, resolved, setTheme }),
		[preference, resolved, setTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within ThemeProvider");
	}
	return context;
}
