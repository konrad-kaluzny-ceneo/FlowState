"use client";

import { useTranslations } from "next-intl";

import type { UserLocale } from "~/lib/language-preference/types";
import { userLocaleSchema } from "~/lib/language-preference/types";

type LanguageSwitchProps = {
	locale: UserLocale;
	onChange: (locale: UserLocale) => void;
	disabled?: boolean;
	variant?: "default" | "settings";
};

export function LanguageSwitch({
	locale,
	onChange,
	disabled = false,
	variant = "default",
}: LanguageSwitchProps) {
	const t = useTranslations("Preferences.language");
	const isSettings = variant === "settings";

	return (
		<fieldset
			className={`flex items-center gap-1 rounded-control border border-border-subtle bg-surface-card p-1 ${
				isSettings ? "justify-end" : ""
			}`}
			data-testid="language-switch"
		>
			<legend className="sr-only">{t("legend")}</legend>
			{userLocaleSchema.map((option) => {
				const isSelected = locale === option;
				return (
					<label
						className={`cursor-pointer rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5 font-medium text-sm transition-colors duration-150 ${
							isSelected
								? "bg-segment-active text-on-cta"
								: "text-text-secondary hover:bg-surface-card-muted hover:text-primary"
						} ${disabled ? "pointer-events-none opacity-50" : ""}`}
						key={option}
					>
						<input
							checked={isSelected}
							className="sr-only"
							disabled={disabled}
							name="language"
							onChange={() => onChange(option)}
							type="radio"
							value={option}
						/>
						{t(option)}
					</label>
				);
			})}
		</fieldset>
	);
}
