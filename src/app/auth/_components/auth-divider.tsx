export function AuthDivider() {
	return (
		<div className="flex items-center gap-3">
			<div className="h-px flex-1 bg-border-subtle" />
			<span className="text-sm text-text-dimmed">or</span>
			<div className="h-px flex-1 bg-border-subtle" />
		</div>
	);
}
