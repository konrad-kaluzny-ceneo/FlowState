"use client";

import {
	BookOpen,
	Brain,
	ClipboardList,
	Coffee,
	type LucideIcon,
	Mail,
	Timer,
	Users,
	Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";
import type { UserLocale } from "~/lib/domain/user-locale";
import {
	getPersonaPresetLabel,
	type PersonaPresetId,
	TASK_PERSONA_PRESETS,
} from "~/lib/task/persona-presets";

const PRESET_ICONS: Record<PersonaPresetId, LucideIcon> = {
	focus: Brain,
	synchro: Mail,
	firefight: Zap,
	"warm-up": Coffee,
	meeting: Users,
	plan: ClipboardList,
	research: BookOpen,
	quick: Timer,
};

type PersonaPresetPickerProps = {
	selectedPresetId: PersonaPresetId | "custom" | null;
	showCustomPanel: boolean;
	onSelectPreset: (presetId: PersonaPresetId) => void;
	onSelectCustom: () => void;
};

export function PersonaPresetPicker({
	selectedPresetId,
	showCustomPanel,
	onSelectPreset,
	onSelectCustom,
}: PersonaPresetPickerProps) {
	const locale = useLocale() as UserLocale;
	const tTasks = useTranslations("Tasks");
	const customPressed = showCustomPanel || selectedPresetId === "custom";

	return (
		<div className="space-y-2" data-testid="persona-preset-picker">
			<div className="flex flex-wrap gap-2">
				{TASK_PERSONA_PRESETS.map((preset) => {
					const config = WORK_TYPE_CONFIG[preset.workType];
					const Icon = PRESET_ICONS[preset.id];
					const isPressed = selectedPresetId === preset.id;
					const label = getPersonaPresetLabel(preset.id, locale) ?? preset.id;

					return (
						<button
							aria-label={label}
							aria-pressed={isPressed}
							className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
								isPressed
									? `${config.bg} ${config.text}`
									: "bg-segment-inactive text-text-secondary hover:bg-surface-panel"
							}`}
							data-testid={`persona-preset-${preset.id}`}
							key={preset.id}
							onClick={() => onSelectPreset(preset.id)}
							onMouseDown={(e) => e.preventDefault()}
							type="button"
						>
							<Icon
								aria-hidden
								className={`size-4 ${isPressed ? config.text : "text-text-dimmed"}`}
							/>
							<span>{label}</span>
						</button>
					);
				})}
				<button
					aria-pressed={customPressed}
					className={`rounded-lg px-3 py-2 text-sm transition ${
						customPressed
							? "bg-segment-active text-on-cta"
							: "bg-segment-inactive text-text-secondary hover:bg-surface-panel"
					}`}
					data-testid="persona-preset-custom"
					onClick={onSelectCustom}
					onMouseDown={(e) => e.preventDefault()}
					type="button"
				>
					{tTasks("custom")}
				</button>
			</div>
		</div>
	);
}
