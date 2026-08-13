import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { isTrpcErrorCode } from "./error-code";

describe("isTrpcErrorCode", () => {
	it("matches TRPCClientError by data.code", () => {
		const error = new TRPCClientError("conflict", {
			result: {
				error: {
					code: "CONFLICT",
					message: "conflict",
					data: { code: "CONFLICT" },
				},
			},
		});

		expect(isTrpcErrorCode(error, "CONFLICT")).toBe(true);
		expect(isTrpcErrorCode(error, "NOT_FOUND")).toBe(false);
	});

	it("returns false for non-trpc errors", () => {
		expect(isTrpcErrorCode(new Error("nope"), "CONFLICT")).toBe(false);
	});
});
