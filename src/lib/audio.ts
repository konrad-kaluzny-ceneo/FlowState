const ALARM_FALLBACK_SELECTOR = "audio[data-pomodoro-alarm]";

function isPlaybackBlocked(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		(error.name === "NotAllowedError" || error.name === "AbortError")
	);
}

async function primeHtmlAudioElement(audio: HTMLAudioElement): Promise<void> {
	const previousMuted = audio.muted;
	audio.muted = true;
	try {
		await audio.play();
		audio.pause();
		audio.currentTime = 0;
	} catch {
		// Autoplay policy may still block until a user gesture; playAlarm handles that.
	} finally {
		audio.muted = previousMuted;
	}
}

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
				try {
					await context.resume();
				} catch {
					// Best-effort; playAlarm retries resume.
				}
			}

			if (alarmUrl) {
				fallbackAudio ??= new Audio(alarmUrl);
				fallbackAudio.preload = "auto";
				await primeHtmlAudioElement(fallbackAudio);
			}
		},

		async preload(url: string) {
			alarmUrl = url;

			if (typeof window === "undefined") {
				return;
			}

			await this.unlock();

			if (!context) {
				return;
			}

			try {
				const response = await fetch(url);
				const arrayBuffer = await response.arrayBuffer();
				buffer = await context.decodeAudioData(arrayBuffer);
			} catch {
				fallbackAudio ??= new Audio(url);
				fallbackAudio.preload = "auto";
				try {
					await fallbackAudio.load();
				} catch {
					// Decode/load failures fall back to play-time HTML audio.
				}
			}
		},

		async playAlarm() {
			if (typeof window === "undefined") {
				return;
			}

			try {
				if (context) {
					if (context.state === "suspended") {
						await context.resume();
					}

					if (buffer) {
						const source = context.createBufferSource();
						source.buffer = buffer;
						source.connect(context.destination);
						source.start(0);
						return;
					}
				}

				const existing = document.querySelector<HTMLAudioElement>(
					ALARM_FALLBACK_SELECTOR,
				);
				const audio =
					fallbackAudio ?? existing ?? (alarmUrl ? new Audio(alarmUrl) : null);
				if (!audio) {
					return;
				}

				audio.currentTime = 0;
				await audio.play();
			} catch (error) {
				if (!isPlaybackBlocked(error)) {
					throw error;
				}
			}
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
