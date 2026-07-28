"use client";

import { Check, Copy, Eye, KeyRound, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { api } from "~/trpc/react";

type ApiKeyScope = "READ" | "READ_WRITE";

const SCOPE_OPTIONS: ApiKeyScope[] = ["READ", "READ_WRITE"];

type ApiKeysPanelProps = {
	isAuthenticated: boolean;
};

/**
 * Settings panel for self-serve MCP API keys (S-46). Authenticated-only: guests
 * are shown a sign-in prompt. The plaintext key returned by `create` is shown
 * exactly once in a dismissible reveal — it is never re-fetchable.
 */
export function ApiKeysPanel({ isAuthenticated }: ApiKeysPanelProps) {
	const t = useTranslations("Settings.apiKeys");

	if (!isAuthenticated) {
		return (
			<section
				aria-labelledby="settings-api-keys-heading"
				className="rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
				data-testid="settings-api-keys-section"
			>
				<div className="flex items-start gap-3">
					<KeyRound
						aria-hidden="true"
						className="mt-0.5 h-5 w-5 shrink-0 text-text-dimmed"
						strokeWidth={1.75}
					/>
					<div>
						<h3
							className="font-semibold text-primary"
							id="settings-api-keys-heading"
						>
							{t("title")}
						</h3>
						<p className="mt-1.5 text-sm text-text-secondary">
							{t("signInPrompt")}
						</p>
					</div>
				</div>
			</section>
		);
	}

	return <AuthenticatedApiKeysPanel />;
}

function AuthenticatedApiKeysPanel() {
	const t = useTranslations("Settings.apiKeys");
	const format = useFormatter();
	const utils = api.useUtils();

	const listQuery = api.apiKey.list.useQuery();

	const [name, setName] = useState("");
	const [scope, setScope] = useState<ApiKeyScope>("READ");
	const [revealedKey, setRevealedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [revokeError, setRevokeError] = useState<string | null>(null);

	const createMutation = api.apiKey.create.useMutation({
		onSuccess: (data) => {
			setRevealedKey(data.plaintext);
			setCopied(false);
			setName("");
			setScope("READ");
			void utils.apiKey.list.invalidate();
		},
		onError: (error) => {
			setFormError(error.message || t("createError"));
		},
	});

	const revokeMutation = api.apiKey.revoke.useMutation({
		onSuccess: () => {
			setRevokeError(null);
			void utils.apiKey.list.invalidate();
		},
		onError: () => {
			setRevokeError(t("revokeError"));
		},
	});

	const trimmedName = name.trim();
	const canSubmit =
		trimmedName.length >= 1 &&
		trimmedName.length <= 64 &&
		!createMutation.isPending;

	function handleCreate() {
		setFormError(null);
		if (!canSubmit) {
			return;
		}
		createMutation.mutate({ name: trimmedName, scope });
	}

	async function handleCopy() {
		if (revealedKey == null) {
			return;
		}
		try {
			await navigator.clipboard.writeText(revealedKey);
			setCopied(true);
		} catch {
			// Clipboard may be unavailable; the key remains visible to copy manually.
		}
	}

	const keys = listQuery.data ?? [];

	return (
		<section
			aria-labelledby="settings-api-keys-heading"
			className="space-y-6 rounded-card border border-card-border bg-surface-card p-6 shadow-sm"
			data-testid="settings-api-keys-section"
		>
			<div className="flex items-start gap-3">
				<KeyRound
					aria-hidden="true"
					className="mt-0.5 h-5 w-5 shrink-0 text-accent-cta"
					strokeWidth={1.75}
				/>
				<div>
					<h3
						className="font-semibold text-primary"
						id="settings-api-keys-heading"
					>
						{t("title")}
					</h3>
					<p className="mt-1.5 text-sm text-text-secondary">{t("body")}</p>
				</div>
			</div>

			{revealedKey != null && (
				<div
					className="rounded-card border border-accent-cta/40 bg-segment-active/12 p-4"
					data-testid="api-key-reveal"
					role="alert"
				>
					<div className="flex items-start gap-2">
						<Eye
							aria-hidden="true"
							className="mt-0.5 h-4 w-4 shrink-0 text-accent-cta"
							strokeWidth={1.75}
						/>
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-primary text-sm">
								{t("revealTitle")}
							</p>
							<p className="mt-1 text-text-secondary text-xs">
								{t("revealWarning")}
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-2">
								<code
									className="min-w-0 flex-1 break-all rounded-control border border-border-subtle bg-surface-card px-3 py-2 font-mono text-primary text-xs"
									data-testid="api-key-reveal-value"
								>
									{revealedKey}
								</code>
								<button
									className="inline-flex items-center gap-1.5 rounded-control bg-accent-cta px-3 py-2 font-medium text-on-cta text-xs transition-colors hover:opacity-90"
									data-testid="api-key-copy"
									onClick={() => void handleCopy()}
									type="button"
								>
									{copied ? (
										<Check aria-hidden="true" className="h-3.5 w-3.5" />
									) : (
										<Copy aria-hidden="true" className="h-3.5 w-3.5" />
									)}
									{copied ? t("copied") : t("copy")}
								</button>
							</div>
							<button
								className="mt-3 font-medium text-text-dimmed text-xs underline-offset-2 hover:text-text-secondary hover:underline"
								data-testid="api-key-reveal-dismiss"
								onClick={() => setRevealedKey(null)}
								type="button"
							>
								{t("dismissReveal")}
							</button>
						</div>
					</div>
				</div>
			)}

			<div className="space-y-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex min-w-0 flex-1 flex-col gap-1.5">
						<span className="font-medium text-primary text-sm">
							{t("nameLabel")}
						</span>
						<input
							className="rounded-control border border-border-subtle bg-surface-card px-3 py-2 text-primary text-sm outline-none transition-colors focus:border-accent-cta"
							data-testid="api-key-name-input"
							maxLength={64}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("namePlaceholder")}
							type="text"
							value={name}
						/>
					</label>
					<label className="flex flex-col gap-1.5 sm:w-48">
						<span className="font-medium text-primary text-sm">
							{t("scopeLabel")}
						</span>
						<select
							className="rounded-control border border-border-subtle bg-surface-card px-3 py-2 text-primary text-sm outline-none transition-colors focus:border-accent-cta"
							data-testid="api-key-scope-select"
							onChange={(e) => setScope(e.target.value as ApiKeyScope)}
							value={scope}
						>
							{SCOPE_OPTIONS.map((option) => (
								<option key={option} value={option}>
									{t(`scope.${option}`)}
								</option>
							))}
						</select>
					</label>
					<button
						className="rounded-control bg-accent-cta px-4 py-2 font-medium text-on-cta text-sm transition-colors hover:opacity-90 disabled:opacity-50"
						data-testid="api-key-create"
						disabled={!canSubmit}
						onClick={handleCreate}
						type="button"
					>
						{createMutation.isPending ? t("creating") : t("createButton")}
					</button>
				</div>
				<p className="text-text-dimmed text-xs">{t("scopeHelp")}</p>
				{formError != null && (
					<p className="text-red-400 text-sm" role="alert">
						{formError}
					</p>
				)}
			</div>

			<div className="space-y-3">
				<h4 className="font-semibold text-primary text-sm">{t("listTitle")}</h4>
				{revokeError != null && (
					<p className="text-red-400 text-sm" role="alert">
						{revokeError}
					</p>
				)}
				{listQuery.isLoading ? (
					<p className="text-sm text-text-dimmed">{t("loading")}</p>
				) : listQuery.isError ? (
					<p className="text-red-400 text-sm" role="alert">
						{t("listError")}
					</p>
				) : keys.length === 0 ? (
					<p
						className="rounded-card border border-border-subtle border-dashed px-4 py-6 text-center text-sm text-text-dimmed"
						data-testid="api-key-empty"
					>
						{t("empty")}
					</p>
				) : (
					<ul className="space-y-2" data-testid="api-key-list">
						{keys.map((key) => {
							const isRevoked = key.revokedAt != null;
							return (
								<li
									className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-card-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
									data-testid="api-key-list-item"
									key={key.id}
								>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-medium text-primary text-sm">
												{key.name}
											</span>
											<span className="rounded-full bg-segment-active/12 px-2 py-0.5 font-medium text-accent-cta text-xs">
												{t(`scope.${key.scope}`)}
											</span>
											{isRevoked && (
												<span className="rounded-full bg-red-500/12 px-2 py-0.5 font-medium text-red-400 text-xs">
													{t("revokedBadge")}
												</span>
											)}
										</div>
										<p className="mt-1 text-text-dimmed text-xs">
											{t("createdAt", {
												date: format.dateTime(new Date(key.createdAt), {
													dateStyle: "medium",
												}),
											})}
											{" · "}
											{key.lastUsedAt != null
												? t("lastUsedAt", {
														date: format.dateTime(new Date(key.lastUsedAt), {
															dateStyle: "medium",
														}),
													})
												: t("neverUsed")}
										</p>
									</div>
									{!isRevoked && (
										<button
											className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-control border border-border-subtle px-3 py-1.5 font-medium text-red-400 text-xs transition-colors hover:bg-red-500/10 disabled:opacity-50 sm:self-auto"
											data-testid="api-key-revoke"
											disabled={revokeMutation.isPending}
											onClick={() => revokeMutation.mutate({ id: key.id })}
											type="button"
										>
											<Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
											{t("revoke")}
										</button>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</section>
	);
}
