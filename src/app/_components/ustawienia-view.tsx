"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { CycleAudioPreferenceControl } from "~/app/_components/cycle-audio-preference-control";
import { DurationPicker } from "~/app/_components/duration-picker";
import { EnergySelector } from "~/app/_components/energy-selector";
import { LanguageSwitch } from "~/app/_components/language-switch";
import { OutOfTabBreakAlertsControl } from "~/app/_components/out-of-tab-break-alerts-control";
import { ComingSoonPreview } from "~/app/_components/ui/coming-soon-preview";
import { useCycleEndAudioPreference } from "~/hooks/use-cycle-end-audio-preference";
import { useDayEnergy } from "~/hooks/use-day-energy";
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

type SettingsTab =
	| "general"
	| "focus"
	| "breaks"
	| "appearance"
	| "energy"
	| "integrations";

type TabDef = {
	id: SettingsTab;
	labelKey:
		| "sectionGeneral"
		| "sectionFocusSessions"
		| "sectionBreaksNotifications"
		| "sectionAppearance"
		| "sectionDayEnergy"
		| "sectionIntegrations";
	descKey:
		| "tabGeneralDesc"
		| "tabFocusDesc"
		| "tabBreaksDesc"
		| "tabAppearanceDesc"
		| "tabEnergyDesc"
		| "tabIntegrationsDesc";
	authOnly?: boolean;
};

const TAB_DEFS: TabDef[] = [
	{
		id: "general",
		labelKey: "sectionGeneral",
		descKey: "tabGeneralDesc",
	},
	{
		id: "focus",
		labelKey: "sectionFocusSessions",
		descKey: "tabFocusDesc",
	},
	{
		id: "breaks",
		labelKey: "sectionBreaksNotifications",
		descKey: "tabBreaksDesc",
	},
	{
		id: "appearance",
		labelKey: "sectionAppearance",
		descKey: "tabAppearanceDesc",
	},
	{
		id: "energy",
		labelKey: "sectionDayEnergy",
		descKey: "tabEnergyDesc",
		authOnly: true,
	},
	{
		id: "integrations",
		labelKey: "sectionIntegrations",
		descKey: "tabIntegrationsDesc",
	},
];

export function UstawieniaView({ scope, userName }: UstawieniaViewProps) {
	const t = useTranslations("Settings");
	const tTimer = useTranslations("Timer");
	const isAuthenticated = scope.mode === "authenticated";

	const visibleTabs = useMemo(
		() => TAB_DEFS.filter((tab) => !tab.authOnly || isAuthenticated),
		[isAuthenticated],
	);

	const [activeTab, setActiveTab] = useState<SettingsTab>("general");

	const resolvedTab = visibleTabs.some((tab) => tab.id === activeTab)
		? activeTab
		: "general";

	const {
		locale,
		setLocale,
		isPending: langPending,
	} = useLanguagePreference(scope);

	const { preference, setTheme } = useTheme();

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

	const { enabled: breakAlertsEnabled, setEnabled: setBreakAlertsEnabled } =
		useOutOfTabBreakAlertsPreference(scope);

	const { mode: audioMode, setMode: setAudioMode } =
		useCycleEndAudioPreference(scope);

	const {
		energy,
		setEnergy,
		isSaving: isSavingEnergy,
		isLoading: isLoadingEnergy,
	} = useDayEnergy();

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
			className="mx-auto w-full max-w-5xl px-4 py-8"
			data-testid="ustawienia-view"
		>
			<header className="mb-8">
				<h1 className="font-semibold text-2xl text-primary">{t("title")}</h1>
				<p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>
			</header>

			<div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
				<nav
					aria-label={t("navAriaLabel")}
					className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:gap-0.5"
					data-testid="settings-nav"
				>
					{visibleTabs.map((tab) => {
						const isActive = tab.id === resolvedTab;
						return (
							<button
								aria-current={isActive ? "page" : undefined}
								className={`rounded-card px-4 py-3 text-left transition ${
									isActive
										? "bg-segment-active/15 shadow-sm"
										: "hover:bg-surface-card-muted"
								}`}
								data-testid={`settings-tab-${tab.id}`}
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								type="button"
							>
								<span
									className={`block font-semibold text-sm ${
										isActive ? "text-primary" : "text-text-secondary"
									}`}
								>
									{t(tab.labelKey)}
								</span>
								<span className="mt-0.5 block text-text-dimmed text-xs">
									{t(tab.descKey)}
								</span>
							</button>
						);
					})}
				</nav>

				<div
					className="min-w-0 flex-1"
					data-testid={`settings-panel-${resolvedTab}`}
				>
					{resolvedTab === "general" && (
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

							{isAuthenticated && (
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
					)}

					{resolvedTab === "focus" && (
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
								<p className="text-sm text-text-secondary">
									{t("shortBreakLabel")}
								</p>
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
								<p className="text-sm text-text-secondary">
									{t("longBreakLabel")}
								</p>
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
					)}

					{resolvedTab === "breaks" && (
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
					)}

					{resolvedTab === "appearance" && (
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
								<span className="text-sm text-text-secondary">
									{t("themeLabel")}
								</span>
								<ThemeToggle preference={preference} setTheme={setTheme} />
							</div>
						</section>
					)}

					{resolvedTab === "energy" && isAuthenticated && (
						<section
							aria-labelledby="settings-energy-heading"
							className="space-y-4 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
							data-testid="settings-day-energy-section"
						>
							<h2
								className="font-semibold text-lg text-primary"
								id="settings-energy-heading"
							>
								{t("sectionDayEnergy")}
							</h2>
							<p className="text-sm text-text-secondary">
								{t("dayEnergyBody")}
							</p>
							<EnergySelector
								disabled={isSavingEnergy || isLoadingEnergy}
								onSelect={(value) => {
									void setEnergy(value);
								}}
								selectedValue={energy}
							/>
						</section>
					)}

					{resolvedTab === "integrations" && (
						<section
							aria-labelledby="settings-integrations-heading"
							className="space-y-4"
							data-testid="settings-integrations-section"
						>
							<h2
								className="font-semibold text-lg text-primary"
								id="settings-integrations-heading"
							>
								{t("sectionIntegrations")}
							</h2>
							<p className="text-sm text-text-secondary">
								{t("integrationsBody")}
							</p>
							<ComingSoonPreview
								label={t("mcpComingSoon")}
								testId="settings-mcp-preview"
							>
								<McpIntegrationMock />
							</ComingSoonPreview>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}

function McpIntegrationMock() {
	const t = useTranslations("Settings");

	return (
		<div className="space-y-4 p-6">
			<div className="rounded-card border border-card-border bg-surface-card-muted p-5">
				<h3 className="font-semibold text-primary">{t("mcpMockTitle")}</h3>
				<p className="mt-2 text-sm text-text-secondary">
					{t("mcpMockDescription")}
				</p>
				<button
					className="mt-4 rounded-control bg-accent-cta px-4 py-2 font-medium text-on-cta text-sm"
					type="button"
				>
					{t("mcpMockConnect")}
				</button>
			</div>
		</div>
	);
}

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
