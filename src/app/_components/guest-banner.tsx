"use client";

import Link from "next/link";

export function GuestBanner() {
	return (
		<div
			className="w-full max-w-lg rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm"
			data-testid="guest-banner"
		>
			<p>
				Your tasks are saved on this device only.{" "}
				<Link
					className="font-medium text-amber-200 underline hover:text-white"
					href="/auth/sign-in"
				>
					Sign in
				</Link>{" "}
				or{" "}
				<Link
					className="font-medium text-amber-200 underline hover:text-white"
					href="/auth/sign-up"
				>
					sign up
				</Link>{" "}
				to save across devices.
			</p>
		</div>
	);
}
