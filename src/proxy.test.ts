import { test as fcTest } from "@fast-check/vitest";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { isGuestPublicPath } from "~/lib/auth/public-paths";

/**
 * Feature: neon-auth, Property 3: Middleware route exclusion
 * Validates: Requirements 3.4
 */

const MIDDLEWARE_MATCHER =
	/^\/((?!_next\/static|_next\/image|favicon\.ico|api\/auth|auth\/).*)$/;

const pathSuffixArb = fc
	.array(fc.stringMatching(/^[a-z0-9._-]{1,20}$/), {
		minLength: 0,
		maxLength: 4,
	})
	.map((segments) => (segments.length > 0 ? `/${segments.join("/")}` : ""));

describe("Feature: neon-auth, Property 3: Middleware route exclusion", () => {
	fcTest.prop([pathSuffixArb], { numRuns: 100 })(
		"paths starting with /_next/static are excluded from middleware",
		(suffix) => {
			const path = `/_next/static${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(false);
		},
	);

	fcTest.prop([pathSuffixArb], { numRuns: 100 })(
		"paths starting with /_next/image are excluded from middleware",
		(suffix) => {
			const path = `/_next/image${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(false);
		},
	);

	fcTest.prop([pathSuffixArb], { numRuns: 100 })(
		"paths starting with /favicon.ico are excluded from middleware",
		(suffix) => {
			const path = `/favicon.ico${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(false);
		},
	);

	fcTest.prop([pathSuffixArb], { numRuns: 100 })(
		"paths starting with /api/auth are excluded from middleware",
		(suffix) => {
			const path = `/api/auth${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(false);
		},
	);

	fcTest.prop([pathSuffixArb], { numRuns: 100 })(
		"paths starting with /auth/ are excluded from middleware",
		(suffix) => {
			const path = `/auth/${suffix.startsWith("/") ? suffix.slice(1) : suffix || "sign-in"}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(false);
		},
	);

	fcTest.prop(
		[
			fc.constantFrom(
				"/dashboard",
				"/tasks",
				"/settings",
				"/profile",
				"/api/trpc",
				"/api/tasks",
			),
			pathSuffixArb,
		],
		{ numRuns: 100 },
	)(
		"protected paths (not matching exclusion patterns) are matched by middleware",
		(basePath, suffix) => {
			const path = `${basePath}${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(true);
		},
	);

	fcTest.prop(
		[
			fc
				.stringMatching(/^[a-z]{1,15}$/)
				.filter(
					(seg) =>
						seg !== "auth" &&
						!seg.startsWith("_next") &&
						seg !== "favicon" &&
						seg !== "api",
				),
			pathSuffixArb,
		],
		{ numRuns: 100 },
	)(
		"arbitrary non-excluded paths are matched by middleware",
		(firstSegment, suffix) => {
			const path = `/${firstSegment}${suffix}`;
			expect(MIDDLEWARE_MATCHER.test(path)).toBe(true);
		},
	);
});

describe("guest public path (S-08)", () => {
	it("allows unauthenticated access to home", () => {
		expect(isGuestPublicPath("/")).toBe(true);
	});

	it("does not treat other paths as guest-public", () => {
		expect(isGuestPublicPath("/settings")).toBe(false);
		expect(isGuestPublicPath("/auth/sign-in")).toBe(false);
	});
});
