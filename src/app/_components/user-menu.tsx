"use client";

import { useState } from "react";
import { authClient } from "~/lib/auth/client";

export function UserMenu({ userName }: { userName: string }) {
	const [error, setError] = useState<string | null>(null);
	const [isSigningOut, setIsSigningOut] = useState(false);

	async function handleSignOut() {
		setError(null);
		setIsSigningOut(true);

		try {
			await authClient.signOut();
			window.location.href = "/auth/sign-in";
		} catch {
			setError("Sign-out failed. Please try again.");
			setIsSigningOut(false);
		}
	}

	return (
		<div className="flex items-center gap-3">
			<span className="text-sm text-white/80">{userName}</span>
			<button
				className="rounded-md bg-white/10 px-3 py-1.5 font-medium text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
				disabled={isSigningOut}
				onClick={handleSignOut}
				type="button"
			>
				{isSigningOut ? "Signing out…" : "Sign out"}
			</button>
			{error && (
				<span className="text-red-400 text-sm" role="alert">
					{error}
				</span>
			)}
		</div>
	);
}
