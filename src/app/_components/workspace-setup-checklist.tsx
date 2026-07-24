"use client";

import { useTranslations } from "next-intl";

import {
	SettingsPanel,
	SettingsRow,
} from "~/app/_components/settings-primitives";
import { WORKSPACE_TIPS } from "~/lib/workspace-setup-advisor/tips";
import type {
	WorkspaceTipCategory,
	WorkspaceTipId,
} from "~/lib/workspace-setup-advisor/types";

const CATEGORY_ORDER: readonly WorkspaceTipCategory[] = [
	"editor",
	"chat",
	"notifications",
	"device",
];

type WorkspaceSetupChecklistProps = {
	doneTipIds: readonly WorkspaceTipId[];
	onToggleTip: (id: WorkspaceTipId) => void;
};

function tipGuideUrl(
	tSetup: ReturnType<typeof useTranslations<"WorkspaceSetup">>,
	id: WorkspaceTipId,
): string | null {
	const key = `tips.${id}.guideUrl` as const;
	if (!tSetup.has(key)) {
		return null;
	}
	const url = tSetup(key);
	// Only trust absolute https guide links; guard against a future
	// translator inserting a javascript:/data: scheme into the catalog.
	return url.startsWith("https://") ? url : null;
}

function tipGuideLabel(
	tSetup: ReturnType<typeof useTranslations<"WorkspaceSetup">>,
	id: WorkspaceTipId,
): string {
	const key = `tips.${id}.guideLabel` as const;
	if (tSetup.has(key)) {
		return tSetup(key);
	}
	return tSetup("guideLabel");
}

export function WorkspaceSetupChecklist({
	doneTipIds,
	onToggleTip,
}: WorkspaceSetupChecklistProps) {
	const t = useTranslations("Settings");
	const tSetup = useTranslations("WorkspaceSetup");
	const doneSet = new Set(doneTipIds);

	return (
		<SettingsPanel
			testId="settings-workspace-section"
			title={t("sectionWorkspace")}
			titleId="settings-workspace-heading"
		>
			<SettingsRow
				description={t("workspaceBody")}
				label={t("sectionWorkspace")}
			>
				<div className="space-y-6">
					{CATEGORY_ORDER.map((category) => {
						const tips = WORKSPACE_TIPS.filter(
							(tip) => tip.category === category,
						);
						if (tips.length === 0) {
							return null;
						}

						return (
							<section
								aria-labelledby={`workspace-category-${category}`}
								key={category}
							>
								<h3
									className="mb-3 font-medium text-primary text-sm"
									id={`workspace-category-${category}`}
								>
									{tSetup(`categories.${category}`)}
								</h3>
								<ul className="space-y-3">
									{tips.map((tip) => {
										const done = doneSet.has(tip.id);
										const title = tSetup(`tips.${tip.id}.title`);
										const body = tSetup(`tips.${tip.id}.body`);
										const guideUrl = tipGuideUrl(tSetup, tip.id);
										const guideLabel = tipGuideLabel(tSetup, tip.id);
										const titleId = `workspace-tip-title-${tip.id}`;
										const bodyId = `workspace-tip-body-${tip.id}`;

										return (
											<li
												className="rounded-control border border-border-subtle bg-surface-card-muted/40 px-3 py-3"
												data-done={done ? "true" : "false"}
												data-testid={`workspace-tip-${tip.id}`}
												key={tip.id}
											>
												<label className="flex cursor-pointer items-start gap-3">
													<input
														aria-describedby={bodyId}
														aria-labelledby={titleId}
														checked={done}
														className="mt-1 h-4 w-4 shrink-0 accent-accent-cta"
														name={`workspace-tip-${tip.id}`}
														onChange={() => onToggleTip(tip.id)}
														type="checkbox"
													/>
													<span className="min-w-0">
														<span
															className="block font-medium text-primary text-sm"
															id={titleId}
														>
															{title}
														</span>
														<span
															className="mt-1 block text-text-secondary text-xs leading-relaxed"
															id={bodyId}
														>
															{body}
														</span>
													</span>
												</label>
												{guideUrl != null && (
													<a
														className="mt-2 ml-7 inline-block text-accent-cta text-xs underline-offset-2 hover:underline"
														href={guideUrl}
														rel="noopener noreferrer"
														target="_blank"
													>
														{guideLabel}
													</a>
												)}
											</li>
										);
									})}
								</ul>
							</section>
						);
					})}
				</div>
			</SettingsRow>
		</SettingsPanel>
	);
}
