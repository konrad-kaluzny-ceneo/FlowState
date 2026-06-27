"use client";

import { LanguageSwitch } from "~/app/_components/language-switch";
import { useLanguagePreference } from "~/hooks/use-language-preference";
import type { ThemePreference } from "~/lib/design/theme";
import type { OnboardingScope } from "~/lib/onboarding/types";

import { useTheme } from "./theme-provider";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
];

type HeaderPreferenceControlsProps = {
	scope: OnboardingScope;
};

export function HeaderPreferenceControls({
	scope,
}: HeaderPreferenceControlsProps) {
	const { preference, setTheme } = useTheme();
	const { locale, setLocale, isPending, persistError } =
		useLanguagePreference(scope);

	return (
		<div className="flex items-center gap-2">
			<LanguageSwitch
				disabled={isPending}
				locale={locale}
				onChange={setLocale}
			/>
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
			{persistError && (
				<span className="text-sm text-text-secondary" role="status">
					{persistError}
				</span>
			)}
		</div>
	);
}
