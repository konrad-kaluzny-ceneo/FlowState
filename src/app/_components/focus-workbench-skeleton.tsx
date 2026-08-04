import { useTranslations } from "next-intl";

/**
 * Stable-height placeholder for the /focus workbench while tasks suspend or
 * active-cycle recovery settles — avoids CLS from tiny loading text → full grid.
 */
export function FocusWorkbenchSkeleton() {
	const t = useTranslations("Home");

	return (
		<div
			aria-busy="true"
			aria-live="polite"
			className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-8"
			data-testid="dashboard-loading"
		>
			<span className="sr-only">{t("dashboardLoading")}</span>
			<div className="order-1 flex min-h-[22rem] flex-col gap-4">
				<div className="h-4 w-40 animate-pulse rounded bg-surface-panel" />
				<div className="h-8 w-3/4 max-w-md animate-pulse rounded bg-surface-panel" />
				<div className="h-4 w-full max-w-lg animate-pulse rounded bg-surface-panel" />
				<div className="mt-2 h-28 w-full max-w-md animate-pulse rounded-xl bg-surface-panel" />
				<div className="h-10 w-40 animate-pulse rounded-lg bg-surface-panel" />
			</div>
			<div className="order-2 flex flex-col gap-4 max-lg:order-3">
				<div className="h-24 w-full animate-pulse rounded-xl bg-surface-panel" />
				<div className="h-20 w-full animate-pulse rounded-xl bg-surface-panel" />
				<div className="h-16 w-full animate-pulse rounded-xl bg-surface-panel" />
			</div>
		</div>
	);
}
