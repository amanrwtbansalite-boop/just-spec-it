import assert from 'node:assert/strict';
import test from 'node:test';
import { DOC_SPECS, MAX_FILES, userPrompt } from '../src/prompts';
import { recommendDocUpdates } from '../src/updateImpact';

const expectedFiles = [
	'requirements.md',
	'architecture.md',
	'phase-plan.md',
	'decisions.md',
	'tasks.md',
	'README.md',
];

test('defines the six-document chain in canonical order', () => {
	assert.equal(MAX_FILES, 6);
	assert.deepEqual(DOC_SPECS.map((spec) => spec.file), expectedFiles);
	assert.deepEqual(DOC_SPECS.at(-1)?.needs, expectedFiles.slice(0, -1));
});

test('includes the current document and update note when regenerating', () => {
	const prompt = userPrompt(
		DOC_SPECS[1],
		'Build a task API',
		'TypeScript project',
		new Map([['requirements.md', '# Requirements\n\nFR-001']]),
		{ existingContent: '# Architecture\n\nREST', changeNote: 'Switch REST to gRPC' }
	);
	assert.match(prompt, /Already written: requirements\.md/);
	assert.match(prompt, /Current version of architecture\.md/);
	assert.match(prompt, /Switch REST to gRPC/);
});

test('recommends downstream docs for an architecture change', () => {
	const files = recommendDocUpdates('Switch REST to gRPC').map((item) => item.file);
	assert.deepEqual(files, ['architecture.md', 'phase-plan.md', 'decisions.md', 'tasks.md', 'README.md']);
});

test('recommends the complete chain for a scope change', () => {
	const files = recommendDocUpdates('Add feature: team workspaces').map((item) => item.file);
	assert.deepEqual(files, expectedFiles);
});

test('falls back to a full refresh when impact is unclear', () => {
	const files = recommendDocUpdates('Make it better').map((item) => item.file);
	assert.deepEqual(files, expectedFiles);
});
