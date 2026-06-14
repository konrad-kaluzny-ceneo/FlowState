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

import { WORK_TYPE_CONFIG } from "~/lib/design/work-type-config";
import {
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
	coachLine?: string;
	onDismissCoach?: () => void;
};

export function PersonaPresetPicker({
	selectedPresetId,
	showCustomPanel,
	onSelectPreset,
	onSelectCustom,
	coachLine,
	onDismissCoach,
}: PersonaPresetPickerProps) {
	const customPressed = showCustomPanel || selectedPresetId === "custom";

	return (
		<div className="space-y-2" data-testid="persona-preset-picker">
			<div className="flex flex-wrap gap-2">
				{TASK_PERSONA_PRESETS.map((preset) => {
					const config = WORK_TYPE_CONFIG[preset.workType];
					const Icon = PRESET_ICONS[preset.id];
					const isPressed = selectedPresetId === preset.id;

					return (
						<button
							aria-label={preset.label}
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
							<span>{preset.label}</span>
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
					Custom
				</button>
			</div>
			{coachLine != null && (
				<div
					className="flex items-start justify-between gap-2 rounded-lg border border-border-subtle bg-surface-panel px-3 py-2 text-sm text-text-secondary"
					data-testid="preset-coach"
				>
					<p>{coachLine}</p>
					{onDismissCoach != null && (
						<button
							className="shrink-0 text-text-dimmed text-xs underline transition hover:text-text-section"
							data-testid="preset-coach-dismiss-btn"
							onClick={onDismissCoach}
							type="button"
						>
							Got it
						</button>
					)}
				</div>
			)}
		</div>
	);
}
