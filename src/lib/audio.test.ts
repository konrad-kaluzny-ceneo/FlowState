import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioManager } from "~/lib/audio";

describe("createAudioManager", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("unlocks AudioContext on unlock", async () => {
		const resume = vi.fn().mockResolvedValue(undefined);
		const close = vi.fn().mockResolvedValue(undefined);

		class MockAudioContext {
			state = "suspended";
			destination = {};
			resume = resume;
			close = close;
			createBufferSource() {
				return {
					buffer: null,
					connect: vi.fn(),
					start: vi.fn(),
				};
			}
			decodeAudioData = vi.fn().mockResolvedValue({});
		}

		vi.stubGlobal("AudioContext", MockAudioContext);

		const manager = createAudioManager();
		await manager.unlock();

		expect(resume).toHaveBeenCalled();
		manager.dispose();
	});

	it("preloads and plays via Web Audio when context is unlocked", async () => {
		const start = vi.fn();
		const decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });

		class MockAudioContext {
			state = "running";
			destination = {};
			resume = vi.fn().mockResolvedValue(undefined);
			close = vi.fn().mockResolvedValue(undefined);
			decodeAudioData = decodeAudioData;
			createBufferSource() {
				return {
					buffer: null,
					connect: vi.fn(),
					start,
				};
			}
		}

		vi.stubGlobal("AudioContext", MockAudioContext);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
			}),
		);

		const manager = createAudioManager();
		await manager.unlock();
		await manager.preload("/sounds/pomodoro-complete.mp3");
		await manager.playAlarm();

		expect(decodeAudioData).toHaveBeenCalled();
		expect(start).toHaveBeenCalled();
		manager.dispose();
	});

	it("falls back to HTMLAudioElement when decode fails", async () => {
		const play = vi.fn().mockResolvedValue(undefined);
		const load = vi.fn().mockResolvedValue(undefined);

		class MockAudio {
			muted = false;
			preload = "";
			currentTime = 0;
			play = play;
			load = load;
			pause = vi.fn();
		}

		class MockAudioContext {
			state = "running";
			destination = {};
			resume = vi.fn().mockResolvedValue(undefined);
			close = vi.fn().mockResolvedValue(undefined);
			decodeAudioData = vi.fn().mockRejectedValue(new Error("decode failed"));
		}

		vi.stubGlobal("Audio", MockAudio);
		vi.stubGlobal("AudioContext", MockAudioContext);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
			}),
		);

		const manager = createAudioManager();
		await manager.unlock();
		await manager.preload("/sounds/pomodoro-complete.mp3");
		await manager.playAlarm();

		expect(play).toHaveBeenCalled();
	});

	it("skips playback when mode is muted", async () => {
		const start = vi.fn();

		class MockAudioContext {
			state = "running";
			destination = {};
			resume = vi.fn().mockResolvedValue(undefined);
			close = vi.fn().mockResolvedValue(undefined);
			decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
			createBufferSource() {
				return {
					buffer: null,
					connect: vi.fn(),
					start,
				};
			}
		}

		vi.stubGlobal("AudioContext", MockAudioContext);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
			}),
		);

		const manager = createAudioManager();
		await manager.unlock();
		await manager.preload("/sounds/pomodoro-complete.mp3");
		await manager.playAlarm({ mode: "muted" });

		expect(start).not.toHaveBeenCalled();
		manager.dispose();
	});

	it("applies soft gain on Web Audio path", async () => {
		const start = vi.fn();
		const gainConnect = vi.fn();
		const sourceConnect = vi.fn();
		const decodeAudioData = vi.fn().mockResolvedValue({ duration: 1 });
		const destination = {};
		let gainValue = 1;

		class MockAudioContext {
			state = "running";
			destination = destination;
			resume = vi.fn().mockResolvedValue(undefined);
			close = vi.fn().mockResolvedValue(undefined);
			decodeAudioData = decodeAudioData;
			createGain() {
				return {
					gain: {
						get value() {
							return gainValue;
						},
						set value(next: number) {
							gainValue = next;
						},
					},
					connect: gainConnect,
				};
			}
			createBufferSource() {
				return {
					buffer: null,
					connect: sourceConnect,
					start,
				};
			}
		}

		vi.stubGlobal("AudioContext", MockAudioContext);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
			}),
		);

		const manager = createAudioManager();
		await manager.unlock();
		await manager.preload("/sounds/pomodoro-complete.mp3");
		await manager.playAlarm({ mode: "soft" });

		expect(sourceConnect).toHaveBeenCalled();
		expect(gainConnect).toHaveBeenCalledWith(destination);
		expect(gainValue).toBe(0.25);
		expect(start).toHaveBeenCalled();
		manager.dispose();
	});

	it("sets soft volume on HTML fallback path", async () => {
		const play = vi.fn().mockResolvedValue(undefined);
		const load = vi.fn().mockResolvedValue(undefined);
		const audioInstances: Array<{ volume: number }> = [];

		class MockAudio {
			muted = false;
			preload = "";
			currentTime = 0;
			volume = 1;
			play = play;
			load = load;
			pause = vi.fn();

			constructor() {
				audioInstances.push(this);
			}
		}

		class MockAudioContext {
			state = "running";
			destination = {};
			resume = vi.fn().mockResolvedValue(undefined);
			close = vi.fn().mockResolvedValue(undefined);
			decodeAudioData = vi.fn().mockRejectedValue(new Error("decode failed"));
		}

		vi.stubGlobal("Audio", MockAudio);
		vi.stubGlobal("AudioContext", MockAudioContext);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
			}),
		);

		const manager = createAudioManager();
		await manager.unlock();
		await manager.preload("/sounds/pomodoro-complete.mp3");
		await manager.playAlarm({ mode: "soft" });

		expect(play).toHaveBeenCalled();
		expect(audioInstances[0]?.volume).toBe(0.25);
		manager.dispose();
	});

	it("swallows autoplay NotAllowedError on HTML fallback", async () => {
		const play = vi
			.fn()
			.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));

		class MockAudio {
			muted = false;
			preload = "";
			currentTime = 0;
			play = play;
			load = vi.fn().mockResolvedValue(undefined);
			pause = vi.fn();
		}

		vi.stubGlobal("Audio", MockAudio);

		const manager = createAudioManager();
		await manager.preload("/sounds/pomodoro-complete.mp3");

		await expect(manager.playAlarm()).resolves.toBeUndefined();
	});
});
