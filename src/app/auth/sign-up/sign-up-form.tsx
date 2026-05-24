"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type SignUpFormState, signUpAction } from "./actions";

const initialState: SignUpFormState = {
	errors: {},
	values: { name: "", email: "" },
};

export function SignUpForm() {
	const [state, formAction, isPending] = useActionState(
		signUpAction,
		initialState,
	);

	return (
		<form action={formAction} className="flex w-full flex-col gap-4" noValidate>
			{state.errors.form && (
				<div
					className="rounded-md bg-red-500/10 px-4 py-3 text-red-400 text-sm"
					role="alert"
				>
					{state.errors.form}
				</div>
			)}

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-white/80" htmlFor="name">
					Name
				</label>
				<input
					aria-describedby={state.errors.name ? "name-error" : undefined}
					aria-invalid={!!state.errors.name}
					className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					defaultValue={state.values.name}
					id="name"
					maxLength={100}
					name="name"
					placeholder="Your name"
					required
					type="text"
				/>
				{state.errors.name && (
					<p className="text-red-400 text-sm" id="name-error" role="alert">
						{state.errors.name}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-white/80" htmlFor="email">
					Email
				</label>
				<input
					aria-describedby={state.errors.email ? "email-error" : undefined}
					aria-invalid={!!state.errors.email}
					className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					defaultValue={state.values.email}
					id="email"
					maxLength={254}
					name="email"
					placeholder="you@example.com"
					required
					type="email"
				/>
				{state.errors.email && (
					<p className="text-red-400 text-sm" id="email-error" role="alert">
						{state.errors.email}
					</p>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-sm text-white/80" htmlFor="password">
					Password
				</label>
				<input
					aria-describedby={
						state.errors.password ? "password-error" : undefined
					}
					aria-invalid={!!state.errors.password}
					className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					id="password"
					maxLength={128}
					minLength={8}
					name="password"
					placeholder="At least 8 characters"
					required
					type="password"
				/>
				{state.errors.password && (
					<p className="text-red-400 text-sm" id="password-error" role="alert">
						{state.errors.password}
					</p>
				)}
			</div>

			<button
				aria-disabled={isPending}
				className="mt-2 rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#1a1a2e] disabled:cursor-not-allowed disabled:opacity-50"
				disabled={isPending}
				type="submit"
			>
				{isPending ? "Creating account..." : "Create account"}
			</button>

			<p className="mt-2 text-center text-sm text-white/60">
				Already have an account?{" "}
				<Link
					className="text-indigo-400 hover:text-indigo-300"
					href="/auth/sign-in"
				>
					Sign in
				</Link>
			</p>
		</form>
	);
}
