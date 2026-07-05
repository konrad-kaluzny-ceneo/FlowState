"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CycleAudioPreferenceControl } from "~/app/_components/cycle-audio-preference-control";
import { DurationPicker } from "~/app/_components/duration-picker";
import { LanguageSwitch } from "~/app/_components/language-switch";
import { OutOfTabBreakAlertsControl } from "~/app/_components/out-of-tab-break-alerts-control";
import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useLanguagePreference } from "~/hooks/use-language-preference";
import { useOutOfTabBreakAlertsPreference } from "~/hooks/use-out-of-tab-break-alerts-preference";
import { authClient } from "~/lib/auth/client";
import {
	getLongBreakPresets,
	getMaxBreakDurationSec,
	getMaxWorkDurationSec,
	getMinBreakDurationSec,
	getMinWorkDurationSec,
	getShortBreakPresets,
	getWorkDurationPresets,
} from "~/lib/duration-bounds";
import {
	getLastDuration,
	getLongBreakDuration,
	getShortBreakDuration,
	setLastDuration,
	setLongBreakDuration,
	setShortBreakDuration,
} from "~/lib/duration-storage";
import type { OnboardingScope } from "~/lib/onboarding/types";

import { useTheme } from "./theme-provider";

type UstawieniaViewProps = {
	scope: OnboardingScope;
	userName: string | null;
};

export function UstawieniaView({ scope, userName }: UstawieniaViewProps) {
	const t = useTranslations("Settings");
	const tTimer = useTranslations("Timer");

	// Language
	const {
		locale,
		setLocale,
		isPending: langPending,
	} = useLanguagePreference(scope);

	// Theme
	const { preference, setTheme } = useTheme();

	// Durations
	const [workDurationSec, setWorkDurationSec] = useState(() =>
		getLastDuration(),
	);
	const [shortBreakSec, setShortBreakSec] = useState(() =>
		getShortBreakDuration(),
	);
	const [longBreakSec, setLongBreakSec] = useState(() =>
		getLongBreakDuration(),
	);

	const workMinSec = getMinWorkDurationSec();
	const workMaxSec = getMaxWorkDurationSec();
	const breakMinSec = getMinBreakDurationSec();
	const breakMaxSec = getMaxBreakDurationSec();

	// Break alerts
	const { enabled: breakAlertsEnabled, setEnabled: setBreakAlertsEnabled } =
		useOutOfTabBreakAlertsPreference(scope);

	// Audio
	const { mode: audioMode, setMode: setAudioMode } =
		useCycleEndAudioPreference(scope);

	// Sign out
	const [signOutError, setSignOutError] = useState<string | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function handleSignOut() {
		setSignOutError(null);
		setIsSigningOut(true);
		try {
			await authClient.signOut();
			window.location.href = "/auth/sign-in";
		} catch {
			setSignOutError(t("signOutError"));
			setIsSigningOut(false);
		}
	}

	return (
		<div
			className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8"
			data-testid="ustawienia-view"
		>
			<h1 className="font-semibold text-2xl text-primary">{t("title")}</h1>

			{/* Ogólne */}
			<section
				aria-labelledby="settings-general-heading"
				className="space-y-4 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			>
				<h2
					className="font-semibold text-lg text-primary"
					id="settings-general-heading"
				>
					{t("sectionGeneral")}
				</h2>

				<div className="flex items-center justify-between">
					<span className="text-sm text-text-secondary">
						{t("languageLabel")}
					</span>
					<LanguageSwitch
						disabled={langPending}
						locale={locale}
						onChange={setLocale}
					/>
				</div>

				{scope.mode === "authenticated" && (
					<div className="flex items-center justify-between">
						<span className="text-sm text-text-secondary">
							{t("userNameLabel")}
						</span>
						<div className="flex items-center gap-3">
							{userName != null && (
								<span className="text-primary text-sm">{userName}</span>
							)}
							<button
								className="rounded-control border border-border-subtle bg-surface-card px-3 py-1.5 font-medium text-primary text-sm transition-colors hover:bg-surface-card-muted disabled:opacity-50"
								data-testid="settings-sign-out"
								disabled={isSigningOut}
								onClick={handleSignOut}
								type="button"
							>
								{isSigningOut ? t("signingOut") : t("signOut")}
							</button>
						</div>
					</div>
				)}
				{signOutError && (
					<p className="text-red-400 text-sm" role="alert">
						{signOutError}
					</p>
				)}
			</section>

			{/* Sesje skupienia */}
			<section
				aria-labelledby="settings-focus-heading"
				className="space-y-4 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			>
				<h2
					className="font-semibold text-lg text-primary"
					id="settings-focus-heading"
				>
					{t("sectionFocusSessions")}
				</h2>

				<div className="space-y-2">
					<p className="text-sm text-text-secondary">
						{t("workDurationLabel")}
					</p>
					<DurationPicker
						boundsLabel={tTimer("boundsWork")}
						maxSec={workMaxSec}
						minSec={workMinSec}
						onChangeSec={(sec) => {
							setWorkDurationSec(sec);
							setLastDuration(sec);
						}}
						presets={getWorkDurationPresets()}
						testIdPrefix="settings-work-duration"
						valueSec={workDurationSec}
					/>
				</div>

				<div className="space-y-2">
					<p className="text-sm text-text-secondary">{t("shortBreakLabel")}</p>
					<DurationPicker
						boundsLabel={tTimer("boundsBreak")}
						maxSec={breakMaxSec}
						minSec={breakMinSec}
						onChangeSec={(sec) => {
							setShortBreakSec(sec);
							setShortBreakDuration(sec);
						}}
						presets={getShortBreakPresets()}
						testIdPrefix="settings-short-break-duration"
						valueSec={shortBreakSec}
					/>
				</div>

				<div className="space-y-2">
					<p className="text-sm text-text-secondary">{t("longBreakLabel")}</p>
					<DurationPicker
						boundsLabel={tTimer("boundsBreak")}
						maxSec={breakMaxSec}
						minSec={breakMinSec}
						onChangeSec={(sec) => {
							setLongBreakSec(sec);
							setLongBreakDuration(sec);
						}}
						presets={getLongBreakPresets()}
						testIdPrefix="settings-long-break-duration"
						valueSec={longBreakSec}
					/>
				</div>
			</section>

			{/* Przerwy / Powiadomienia */}
			<section
				aria-labelledby="settings-breaks-heading"
				className="space-y-4 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			>
				<h2
					className="font-semibold text-lg text-primary"
					id="settings-breaks-heading"
				>
					{t("sectionBreaksNotifications")}
				</h2>

				<OutOfTabBreakAlertsControl
					enabled={breakAlertsEnabled}
					onChange={setBreakAlertsEnabled}
				/>

				<div className="pt-2">
					<p className="mb-2 text-center text-sm text-text-secondary">
						{t("cycleEndAudioLabel")}
					</p>
					<CycleAudioPreferenceControl
						mode={audioMode}
						onChange={setAudioMode}
					/>
				</div>
			</section>

			{/* Wygląd */}
			<section
				aria-labelledby="settings-appearance-heading"
				className="space-y-4 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			>
				<h2
					className="font-semibold text-lg text-primary"
					id="settings-appearance-heading"
				>
					{t("sectionAppearance")}
				</h2>

				<div className="flex items-center justify-between">
					<span className="text-sm text-text-secondary">{t("themeLabel")}</span>
					<ThemeToggle preference={preference} setTheme={setTheme} />
				</div>
			</section>
		</div>
	);
}

// Inline theme toggle matching the existing style from header-preference-controls
function ThemeToggle({
	preference,
	setTheme,
}: {
	preference: string;
	setTheme: (p: "light" | "dark" | "system") => void;
}) {
	const t = useTranslations("Preferences.theme");
	const options = [
		{ value: "light" as const, labelKey: "light" as const },
		{ value: "dark" as const, labelKey: "dark" as const },
		{ value: "system" as const, labelKey: "system" as const },
	];

	return (
		<fieldset
			className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-card p-0.5"
			data-testid="settings-theme-toggle"
		>
			<legend className="sr-only">{t("legend")}</legend>
			{options.map((option) => {
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
							name="settings-theme"
							onChange={() => setTheme(option.value)}
							type="radio"
							value={option.value}
						/>
						{t(option.labelKey)}
					</label>
				);
			})}
		</fieldset>
	);
}
