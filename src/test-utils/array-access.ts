export function atOrThrow<T>(arr: readonly T[], index: number): T {
	const value = arr[index];
	if (value === undefined) {
		throw new Error(`Missing element at index ${index}`);
	}
	return value;
}

export function atModOrThrow<T>(arr: readonly T[], index: number): T {
	if (arr.length === 0) {
		throw new Error("Cannot pick from empty array");
	}
	return atOrThrow(arr, index % arr.length);
}
