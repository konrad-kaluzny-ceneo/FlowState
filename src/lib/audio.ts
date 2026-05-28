const ALARM_FALLBACK_SELECTOR = "audio[data-pomodoro-alarm]";

export function createAudioManager(): {
	unlock(): Promise<void>;
	preload(url: string): Promise<void>;
	playAlarm(): Promise<void>;
	dispose(): void;
} {
	let context: AudioContext | null = null;
	let buffer: AudioBuffer | null = null;
	let fallbackAudio: HTMLAudioElement | null = null;
	let alarmUrl: string | null = null;

	return {
		async unlock() {
			if (typeof window === "undefined") {
				return;
			}

			context ??= new AudioContext();
			if (context.state === "suspended") {
				await context.resume();
			}
		},

		async preload(url: string) {
			alarmUrl = url;

			if (typeof window === "undefined") {
				return;
			}

			if (context) {
				const response = await fetch(url);
				const arrayBuffer = await response.arrayBuffer();
				buffer = await context.decodeAudioData(arrayBuffer);
				return;
			}

			fallbackAudio = new Audio(url);
			fallbackAudio.preload = "auto";
			await fallbackAudio.load();
		},

		async playAlarm() {
			if (typeof window === "undefined") {
				return;
			}

			if (context && buffer) {
				const source = context.createBufferSource();
				source.buffer = buffer;
				source.connect(context.destination);
				source.start(0);
				return;
			}

			const existing = document.querySelector<HTMLAudioElement>(
				ALARM_FALLBACK_SELECTOR,
			);
			const audio = fallbackAudio ?? existing ?? (alarmUrl ? new Audio(alarmUrl) : null);
			if (!audio) {
				return;
			}

			audio.currentTime = 0;
			await audio.play();
		},

		dispose() {
			void context?.close();
			context = null;
			buffer = null;
			fallbackAudio = null;
			alarmUrl = null;
		},
	};
}
