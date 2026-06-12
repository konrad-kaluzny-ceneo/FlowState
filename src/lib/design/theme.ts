export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "flowstate-theme";

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
	if (preference === "light" || preference === "dark") {
		return preference;
	}

	if (typeof window !== "undefined") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	}

	return "light";
}

export function readStoredThemePreference(): ThemePreference | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "system") {
			return stored;
		}
	} catch {
		return null;
	}

	return null;
}

export function applyThemeToDocument(resolved: ResolvedTheme): void {
	document.documentElement.dataset.theme = resolved;
}
