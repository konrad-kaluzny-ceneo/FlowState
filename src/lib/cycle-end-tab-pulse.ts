const PULSE_PREFIX = "● ";
const PULSE_INTERVAL_MS = 1500;
const PULSE_FAVICON_QUERY = "?pulse=1";

let intervalId: ReturnType<typeof setInterval> | null = null;
let originalTitle: string | null = null;
let originalFaviconHref: string | null = null;
let faviconLink: HTMLLinkElement | null = null;
let prefixVisible = false;

function findFaviconLink(): HTMLLinkElement | null {
	if (typeof document === "undefined") {
		return null;
	}

	return (
		document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
		document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]')
	);
}

function applyPulseTick(reducedMotion: boolean) {
	if (originalTitle == null) {
		return;
	}

	prefixVisible = !prefixVisible;
	document.title = prefixVisible
		? `${PULSE_PREFIX}${originalTitle}`
		: originalTitle;

	if (!reducedMotion && faviconLink != null && originalFaviconHref != null) {
		const baseHref = originalFaviconHref.split("?")[0] ?? originalFaviconHref;
		faviconLink.href = prefixVisible
			? `${baseHref}${PULSE_FAVICON_QUERY}`
			: originalFaviconHref;
	}
}

export function startCycleEndTabPulse(options?: { reducedMotion?: boolean }) {
	if (typeof document === "undefined") {
		return;
	}

	const reducedMotion = options?.reducedMotion ?? false;

	if (intervalId != null) {
		return;
	}
	originalTitle = document.title;
	prefixVisible = false;

	if (!reducedMotion) {
		faviconLink = findFaviconLink();
		if (faviconLink != null) {
			originalFaviconHref = faviconLink.href;
		}
	}

	applyPulseTick(reducedMotion);
	intervalId = setInterval(() => {
		applyPulseTick(reducedMotion);
	}, PULSE_INTERVAL_MS);
}

export function stopCycleEndTabPulse() {
	if (intervalId != null) {
		clearInterval(intervalId);
		intervalId = null;
	}

	if (originalTitle != null) {
		document.title = originalTitle;
		originalTitle = null;
	}

	if (faviconLink != null && originalFaviconHref != null) {
		faviconLink.href = originalFaviconHref;
	}

	faviconLink = null;
	originalFaviconHref = null;
	prefixVisible = false;
}

export function isCycleEndTabPulseActive(): boolean {
	return intervalId != null;
}

if (
	typeof window !== "undefined" &&
	process.env.NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER === "1"
) {
	const w = window as Window & {
		__stopCycleEndTabPulse?: () => void;
		__isCycleEndTabPulseActive?: () => boolean;
	};
	w.__stopCycleEndTabPulse = stopCycleEndTabPulse;
	w.__isCycleEndTabPulseActive = isCycleEndTabPulseActive;
}
