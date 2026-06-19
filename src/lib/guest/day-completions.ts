import { formatLocalDateKey } from "~/lib/time/local-date-key";

const GUEST_DAY_COMPLETIONS_KEY = "flowstate:guest-day-completions-v1";

type GuestDayCompletionsStore = {
	localDateKey: string;
	taskIds: string[];
};

const listeners = new Set<() => void>();

function notifyListeners(): void {
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeGuestDayCompletions(onChange: () => void): () => void {
	listeners.add(onChange);
	return () => {
		listeners.delete(onChange);
	};
}

export function getGuestDayCompletionsStorageKey(): string {
	return GUEST_DAY_COMPLETIONS_KEY;
}

function readStore(): GuestDayCompletionsStore {
	if (typeof window === "undefined") {
		return { localDateKey: formatLocalDateKey(), taskIds: [] };
	}

	try {
		const raw = localStorage.getItem(GUEST_DAY_COMPLETIONS_KEY);
		if (raw == null) {
			return { localDateKey: formatLocalDateKey(), taskIds: [] };
		}
		const parsed: unknown = JSON.parse(raw);
		if (
			typeof parsed !== "object" ||
			parsed == null ||
			!("localDateKey" in parsed) ||
			!("taskIds" in parsed)
		) {
			return { localDateKey: formatLocalDateKey(), taskIds: [] };
		}
		const store = parsed as GuestDayCompletionsStore;
		const today = formatLocalDateKey();
		if (store.localDateKey !== today) {
			return { localDateKey: today, taskIds: [] };
		}
		return {
			localDateKey: store.localDateKey,
			taskIds: Array.isArray(store.taskIds)
				? store.taskIds.filter((id): id is string => typeof id === "string")
				: [],
		};
	} catch {
		return { localDateKey: formatLocalDateKey(), taskIds: [] };
	}
}

function writeStore(store: GuestDayCompletionsStore): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.setItem(GUEST_DAY_COMPLETIONS_KEY, JSON.stringify(store));
	notifyListeners();
}

export function isGuestTaskDoneForToday(taskId: string): boolean {
	const store = readStore();
	return store.taskIds.includes(taskId);
}

export function markGuestTaskDoneForToday(taskId: string): void {
	const store = readStore();
	if (store.taskIds.includes(taskId)) {
		return;
	}
	writeStore({
		localDateKey: store.localDateKey,
		taskIds: [...store.taskIds, taskId],
	});
}

export function getGuestDoneForTodayTaskIds(): Set<string> {
	return new Set(readStore().taskIds);
}
