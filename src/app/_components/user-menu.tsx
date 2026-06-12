"use client";

import { useState } from "react";
import { authClient } from "~/lib/auth/client";
import type { ThemePreference } from "~/lib/design/theme";
import { useTheme } from "./theme-provider";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
];

export function UserMenu({ userName }: { userName: string }) {
	const { preference, setTheme } = useTheme();
	const [error, setError] = useState<string | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function handleSignOut() {
		setError(null);
		setIsSigningOut(true);

		try {
			await authClient.signOut();
			window.location.href = "/auth/sign-in";
		} catch {
			setError("Sign-out failed. Please try again.");
			setIsSigningOut(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			<fieldset
				className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card p-0.5"
				data-testid="theme-toggle"
			>
				<legend className="sr-only">Theme</legend>
				{THEME_OPTIONS.map((option) => {
					const isSelected = preference === option.value;
					return (
						<label
							className={`cursor-pointer rounded px-2 py-1 font-medium text-xs transition-colors ${
								isSelected
									? "bg-segment-active text-on-cta"
									: "text-text-secondary hover:bg-surface-card-muted hover:text-primary"
							}`}
							key={option.value}
						>
							<input
								checked={isSelected}
								className="sr-only"
								name="theme"
								onChange={() => setTheme(option.value)}
								type="radio"
								value={option.value}
							/>
							{option.label}
						</label>
					);
				})}
			</fieldset>
			<span className="text-primary text-sm">{userName}</span>
			<button
				className="rounded-md border border-border-subtle bg-surface-card px-3 py-1.5 font-medium text-primary text-sm transition-colors hover:bg-surface-card-muted disabled:opacity-50"
				disabled={isSigningOut}
				onClick={handleSignOut}
				type="button"
			>
				{isSigningOut ? "Signing out…" : "Sign out"}
			</button>
			{error && (
				<span className="text-red-400 text-sm" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
