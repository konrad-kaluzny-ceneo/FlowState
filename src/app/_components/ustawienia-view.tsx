"use client";

import {
	Bell,
	Check,
	type LucideIcon,
	Monitor,
	Moon,
	Palette,
	Plug,
	Settings2,
	Sun,
	Timer,
	Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { CycleAudioPreferenceControl } from "~/app/_components/cycle-audio-preference-control";
import { DurationPicker } from "~/app/_components/duration-picker";
import { EnergySelector } from "~/app/_components/energy-selector";
import { LanguageSwitch } from "~/app/_components/language-switch";
import { OutOfTabBreakAlertsControl } from "~/app/_components/out-of-tab-break-alerts-control";
import {
	SettingsPanel,
	SettingsRow,
} from "~/app/_components/settings-primitives";
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
	icon: LucideIcon;
	authOnly?: boolean;
};

const TAB_DEFS: TabDef[] = [
	{
		id: "general",
		labelKey: "sectionGeneral",
		descKey: "tabGeneralDesc",
		icon: Settings2,
	},
	{
		id: "focus",
		labelKey: "sectionFocusSessions",
		descKey: "tabFocusDesc",
		icon: Timer,
	},
	{
		id: "breaks",
		labelKey: "sectionBreaksNotifications",
		descKey: "tabBreaksDesc",
		icon: Bell,
	},
	{
		id: "appearance",
		labelKey: "sectionAppearance",
		descKey: "tabAppearanceDesc",
		icon: Palette,
	},
	{
		id: "energy",
		labelKey: "sectionDayEnergy",
		descKey: "tabEnergyDesc",
		icon: Zap,
		authOnly: true,
	},
	{
		id: "integrations",
		labelKey: "sectionIntegrations",
		descKey: "tabIntegrationsDesc",
		icon: Plug,
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
			className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 lg:py-10"
			data-testid="ustawienia-view"
		>
			<header className="mb-8 lg:mb-10">
				<h1 className="font-semibold text-2xl text-primary text-wrap-balance lg:text-3xl">
					{t("title")}
				</h1>
				<p className="mt-1.5 text-sm text-text-secondary lg:text-base">
					{t("subtitle")}
				</p>
			</header>

			<div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
				<nav
					aria-label={t("navAriaLabel")}
					className="flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
					data-testid="settings-nav"
				>
					{visibleTabs.map((tab) => {
						const isActive = tab.id === resolvedTab;
						const Icon = tab.icon;
						return (
							<button
								aria-current={isActive ? "page" : undefined}
								className={`flex min-w-[9.5rem] shrink-0 items-start gap-3 rounded-card px-4 py-3 text-left transition-colors duration-150 lg:w-full lg:min-w-0 ${
									isActive
										? "bg-segment-active/12 shadow-sm"
										: "hover:bg-surface-card-muted"
								}`}
								data-testid={`settings-tab-${tab.id}`}
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								type="button"
							>
								<Icon
									aria-hidden="true"
									className={`mt-0.5 h-4 w-4 shrink-0 ${
										isActive ? "text-accent-cta" : "text-text-dimmed"
									}`}
									strokeWidth={1.75}
								/>
								<span className="min-w-0">
									<span
										className={`block font-semibold text-sm ${
											isActive ? "text-primary" : "text-text-secondary"
										}`}
									>
										{t(tab.labelKey)}
									</span>
									<span className="mt-0.5 block text-text-dimmed text-xs leading-snug">
										{t(tab.descKey)}
									</span>
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
						<SettingsPanel
							testId="settings-general-section"
							title={t("sectionGeneral")}
							titleId="settings-general-heading"
						>
							<SettingsRow label={t("languageLabel")}>
								<LanguageSwitch
									disabled={langPending}
									locale={locale}
									onChange={setLocale}
									variant="settings"
								/>
							</SettingsRow>

							{isAuthenticated && (
								<SettingsRow label={t("userNameLabel")}>
									<div className="flex flex-wrap items-center justify-end gap-3">
										{userName != null && (
											<span className="font-medium text-primary text-sm">
												{userName}
											</span>
										)}
										<button
											className="rounded-control border border-border-subtle bg-surface-card px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-surface-card-muted disabled:opacity-50"
											data-testid="settings-sign-out"
											disabled={isSigningOut}
											onClick={handleSignOut}
											type="button"
										>
											{isSigningOut ? t("signingOut") : t("signOut")}
										</button>
									</div>
								</SettingsRow>
							)}
							{signOutError && (
								<p className="pt-2 text-red-400 text-sm" role="alert">
									{signOutError}
								</p>
							)}
						</SettingsPanel>
					)}

					{resolvedTab === "focus" && (
						<SettingsPanel
							testId="settings-focus-section"
							title={t("sectionFocusSessions")}
							titleId="settings-focus-heading"
						>
							<SettingsRow label={t("workDurationLabel")}>
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
									variant="settings"
								/>
							</SettingsRow>

							<SettingsRow label={t("shortBreakLabel")}>
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
									variant="settings"
								/>
							</SettingsRow>

							<SettingsRow label={t("longBreakLabel")}>
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
									variant="settings"
								/>
							</SettingsRow>
						</SettingsPanel>
					)}

					{resolvedTab === "breaks" && (
						<SettingsPanel
							testId="settings-breaks-section"
							title={t("sectionBreaksNotifications")}
							titleId="settings-breaks-heading"
						>
							<SettingsRow label={t("breakAlertsLabel")}>
								<OutOfTabBreakAlertsControl
									enabled={breakAlertsEnabled}
									onChange={setBreakAlertsEnabled}
									variant="settings"
								/>
							</SettingsRow>

							<SettingsRow label={t("cycleEndAudioLabel")}>
								<CycleAudioPreferenceControl
									mode={audioMode}
									onChange={setAudioMode}
									variant="settings"
								/>
							</SettingsRow>
						</SettingsPanel>
					)}

					{resolvedTab === "appearance" && (
						<SettingsPanel
							testId="settings-appearance-section"
							title={t("sectionAppearance")}
							titleId="settings-appearance-heading"
						>
							<SettingsRow label={t("themeLabel")}>
								<ThemeSelector preference={preference} setTheme={setTheme} />
							</SettingsRow>
						</SettingsPanel>
					)}

					{resolvedTab === "energy" && isAuthenticated && (
						<SettingsPanel
							testId="settings-day-energy-section"
							title={t("sectionDayEnergy")}
							titleId="settings-energy-heading"
						>
							<SettingsRow
								description={t("dayEnergyBody")}
								label={t("sectionDayEnergy")}
							>
								<EnergySelector
									disabled={isSavingEnergy || isLoadingEnergy}
									onSelect={(value) => {
										void setEnergy(value);
									}}
									selectedValue={energy}
								/>
							</SettingsRow>
						</SettingsPanel>
					)}

					{resolvedTab === "integrations" && (
						<section
							aria-labelledby="settings-integrations-heading"
							className="space-y-4"
							data-testid="settings-integrations-section"
						>
							<div>
								<h2
									className="font-semibold text-lg text-primary"
									id="settings-integrations-heading"
								>
									{t("sectionIntegrations")}
								</h2>
								<p className="mt-1.5 text-sm text-text-secondary">
									{t("integrationsBody")}
								</p>
							</div>
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

type ThemeOption = "light" | "dark" | "system";

function ThemeSelector({
	preference,
	setTheme,
}: {
	preference: string;
	setTheme: (p: ThemeOption) => void;
}) {
	const t = useTranslations("Preferences.theme");

	const options: {
		value: ThemeOption;
		labelKey: "light" | "dark" | "system";
		Icon: LucideIcon;
		previewClass: string;
	}[] = [
		{
			value: "light",
			labelKey: "light",
			Icon: Sun,
			previewClass:
				"bg-gradient-to-b from-shell-top to-shell-bottom border border-border-subtle",
		},
		{
			value: "dark",
			labelKey: "dark",
			Icon: Moon,
			previewClass: "bg-gradient-to-b from-[#1e2433] to-[#252b3d]",
		},
		{
			value: "system",
			labelKey: "system",
			Icon: Monitor,
			previewClass:
				"bg-gradient-to-r from-shell-top via-shell-top to-[#252b3d]",
		},
	];

	return (
		<fieldset
			className="grid grid-cols-3 gap-3"
			data-testid="settings-theme-toggle"
		>
			<legend className="sr-only">{t("legend")}</legend>
			{options.map((option) => {
				const isSelected = preference === option.value;
				return (
					<label
						className={`group relative cursor-pointer overflow-hidden rounded-card border-2 transition-colors duration-150 ${
							isSelected
								? "border-accent-cta shadow-sm"
								: "border-border-subtle hover:border-accent-cta/40"
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
						<div
							aria-hidden="true"
							className={`aspect-[4/3] ${option.previewClass}`}
						/>
						<div className="flex items-center justify-center gap-1.5 border-border-subtle border-t bg-surface-card px-2 py-2">
							<option.Icon
								aria-hidden="true"
								className="h-3.5 w-3.5 text-text-dimmed"
								strokeWidth={1.75}
							/>
							<span className="font-medium text-primary text-xs">
								{t(option.labelKey)}
							</span>
						</div>
						{isSelected && (
							<span
								aria-hidden="true"
								className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-cta text-on-cta"
							>
								<Check
									aria-hidden="true"
									className="h-3 w-3"
									strokeWidth={2.5}
								/>
							</span>
						)}
					</label>
				);
			})}
		</fieldset>
	);
}
