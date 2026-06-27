"use client";

import { useTranslations } from "next-intl";

import type { UserLocale } from "~/lib/language-preference/types";
import { userLocaleSchema } from "~/lib/language-preference/types";

type LanguageSwitchProps = {
	locale: UserLocale;
	onChange: (locale: UserLocale) => void;
	disabled?: boolean;
};

export function LanguageSwitch({
	locale,
	onChange,
	disabled = false,
}: LanguageSwitchProps) {
	const t = useTranslations("Preferences.language");

	return (
		<fieldset
			className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card p-0.5"
			data-testid="language-switch"
		>
			<legend className="sr-only">{t("legend")}</legend>
			{userLocaleSchema.map((option) => {
				const isSelected = locale === option;
				return (
					<label
						className={`cursor-pointer rounded px-2 py-1 font-medium text-xs transition-colors ${
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
