/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
	forbidden: [
		{
			name: "no-circular",
			severity: "warn",
			comment:
				"This dependency is part of a circular relationship. You might want to revise " +
				"your solution (i.e. use dependency inversion, make sure the modules have a single responsibility).",
			from: {},
			to: {
				circular: true,
			},
		},
		{
			name: "no-orphans",
			comment:
				"This is an orphan module - it's likely not used (anymore?). Either use it or " +
				"remove it. If it's logical this module is an orphan (e.g. a Next.js route entry), " +
				"add an exception in this configuration.",
			severity: "warn",
			from: {
				orphan: true,
				pathNot: [
					"(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$",
					"[.]d[.]ts$",
					"(^|/)tsconfig[.]json$",
					"(^|/)(?:babel|webpack|next)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$",
					// Next.js App Router entry points (resolved only by the framework)
					"(^|/)(?:page|layout|route|loading|error|not-found|global-error|template|default)[.]tsx?$",
					"(^|/)middleware[.]ts$",
					// Vitest setup and test helpers (entry points for the test runner)
					"(^|/)src/test/",
					"(^|/)src/test-utils/",
				],
			},
			to: {},
		},
		{
			name: "no-deprecated-core",
			comment:
				"A module depends on a node core module that has been deprecated. Find an alternative.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["core"],
				path: [
					"^v8/tools/codemap$",
					"^v8/tools/consarray$",
					"^v8/tools/csvparser$",
					"^v8/tools/logreader$",
					"^v8/tools/profile_view$",
					"^v8/tools/profile$",
					"^v8/tools/SourceMap$",
					"^v8/tools/splaytree$",
					"^v8/tools/tickprocessor-driver$",
					"^v8/tools/tickprocessor$",
					"^node-inspect/lib/_inspect$",
					"^node-inspect/lib/internal/inspect_client$",
					"^node-inspect/lib/internal/inspect_repl$",
					"^async_hooks$",
					"^punycode$",
					"^domain$",
					"^constants$",
					"^sys$",
					"^_linklist$",
					"^_stream_wrap$",
				],
			},
		},
		{
			name: "not-to-deprecated",
			comment:
				"This module uses a deprecated npm package. Upgrade or find an alternative.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["deprecated"],
			},
		},
		{
			name: "no-non-package-json",
			severity: "error",
			comment:
				"This module depends on an npm package that isn't in dependencies. " +
				"Add it to package.json dependencies.",
			from: {},
			to: {
				dependencyTypes: ["npm-no-pkg", "npm-unknown"],
			},
		},
		{
			name: "not-to-unresolvable",
			comment:
				"This module depends on a module that cannot be resolved. " +
				"Add the package to package.json or fix the import path.",
			severity: "error",
			from: {},
			to: {
				couldNotResolve: true,
			},
		},
		{
			name: "no-duplicate-dep-types",
			comment:
				"This module depends on an npm package that occurs more than once in package.json " +
				"(e.g. in both dependencies and devDependencies).",
			severity: "warn",
			from: {},
			to: {
				moreThanOneDependencyType: true,
				dependencyTypesNot: ["type-only"],
			},
		},
		{
			name: "not-to-test",
			comment:
				"Don't allow dependencies from production code to co-located test files.",
			severity: "error",
			from: {
				pathNot: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
			to: {
				path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
		},
		{
			name: "not-to-spec",
			comment:
				"Production code must not import spec/test files. Factor shared helpers out.",
			severity: "error",
			from: {},
			to: {
				path: "[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
			},
		},
		{
			name: "not-to-dev-dep",
			severity: "error",
			comment:
				"Production code depends on a devDependency. Move the package to dependencies " +
				"or exclude this path in the not-to-dev-dep rule.",
			from: {
				path: "^src",
				pathNot: [
					"[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$",
					"^src/test-utils/",
					"^src/test/",
				],
			},
			to: {
				dependencyTypes: ["npm-dev"],
				dependencyTypesNot: ["type-only"],
				pathNot: ["node_modules/@types/"],
			},
		},
		{
			name: "server-not-to-app-ui",
			severity: "warn",
			comment:
				"Server layer should not import UI components. Keep API/domain logic separate from presentation.",
			from: {
				path: "^src/server",
			},
			to: {
				path: "^src/app/_components",
			},
		},
		{
			name: "lib-not-to-server-runtime",
			severity: "warn",
			comment:
				"Shared lib should not import server runtime (db, routers). Use type-only imports or move code.",
			from: {
				path: "^src/lib",
			},
			to: {
				path: "^src/server",
				dependencyTypesNot: ["type-only"],
			},
		},
		{
			name: "optional-deps-used",
			severity: "info",
			comment: "This module depends on an optional npm dependency.",
			from: {},
			to: {
				dependencyTypes: ["npm-optional"],
			},
		},
		{
			name: "peer-deps-used",
			comment: "This module depends on a peer dependency.",
			severity: "warn",
			from: {},
			to: {
				dependencyTypes: ["npm-peer"],
			},
		},
	],
	options: {
		doNotFollow: {
			path: ["node_modules", "\\.next", "generated"],
		},
		moduleSystems: ["cjs", "es6"],
		tsPreCompilationDeps: true,
		tsConfig: {
			fileName: "tsconfig.json",
		},
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default", "types"],
		},
		skipAnalysisNotInRules: true,
		reporterOptions: {
			dot: {
				collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			archi: {
				collapsePattern:
					"^(?:src|e2e)/[^/]+|node_modules/(?:@[^/]+/[^/]+|[^/]+)",
			},
			text: {
				highlightFocused: true,
			},
		},
	},
};
