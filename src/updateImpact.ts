export interface UpdateRecommendation {
	readonly file: string;
	readonly reason: string;
}

const ALL_FILES = [
	'requirements.md',
	'architecture.md',
	'phase-plan.md',
	'decisions.md',
	'tasks.md',
	'README.md',
] as const;

/**
 * Recommends documents affected by a change note without spending another model
 * request. The user always gets the final say in the following multi-select.
 */
export function recommendDocUpdates(changeNote: string): UpdateRecommendation[] {
	const note = changeNote.trim().toLowerCase();
	if (!note) {
		return ALL_FILES.map((file) => ({ file, reason: 'Refresh from the current project state' }));
	}

	const recommendations = new Map<string, string>();
	const add = (files: readonly string[], reason: string): void => {
		for (const file of files) {
			recommendations.set(file, recommendations.get(file) ?? reason);
		}
	};
	const mentions = (...terms: string[]): boolean => terms.some((term) => note.includes(term));

	for (const file of ALL_FILES) {
		if (note.includes(file.toLowerCase())) {
			add([file], 'Named explicitly in the change');
		}
	}

	if (mentions('requirement', 'scope', 'acceptance', 'user stor', 'new feature', 'add feature', 'remove feature')) {
		add(ALL_FILES, 'Scope or behavior changes flow through the full plan');
	}
	if (mentions(
		'architecture', 'api', 'rest', 'grpc', 'graphql', 'database', 'storage', 'schema',
		'auth', 'security', 'framework', 'language', 'dependency', 'integration', 'component',
		'performance', 'cache', 'queue', 'service'
	)) {
		add(['architecture.md', 'decisions.md', 'phase-plan.md', 'tasks.md', 'README.md'], 'Technical design change');
	}
	if (mentions('phase', 'milestone', 'rollout', 'migration', 'sequence', 'deadline', 'schedule', 'plan')) {
		add(['phase-plan.md', 'tasks.md', 'README.md'], 'Delivery-plan change');
	}
	if (mentions('decision', 'tradeoff', 'trade-off', 'switch', 'replace', 'instead of')) {
		add(['decisions.md', 'architecture.md', 'phase-plan.md', 'tasks.md', 'README.md'], 'Decision or technology choice changed');
	}
	if (mentions('task', 'checklist', 'implementation step')) {
		add(['tasks.md', 'README.md'], 'Implementation checklist changed');
	}
	if (mentions('readme', 'project memory', 'overview', 'glossary')) {
		add(['README.md'], 'Project overview changed');
	}

	if (recommendations.size === 0) {
		return ALL_FILES.map((file) => ({ file, reason: 'Impact is unclear; full refresh is safest' }));
	}
	if (!recommendations.has('README.md')) {
		add(['README.md'], 'Keep project memory consistent');
	}

	return ALL_FILES
		.filter((file) => recommendations.has(file))
		.map((file) => ({ file, reason: recommendations.get(file)! }));
}
