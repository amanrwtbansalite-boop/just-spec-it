import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

const SKIP_DIRS = new Set([
	'node_modules', '.git', 'dist', 'build', 'out', 'target', '.next',
	'.nuxt', '.venv', 'venv', '__pycache__', '.gradle', 'bin', 'obj',
	'.idea', '.vscode-test', 'coverage', '.terraform', 'vendor',
]);

const MANIFESTS = [
	'package.json', 'requirements.txt', 'pyproject.toml', 'go.mod',
	'Cargo.toml', 'pom.xml', 'build.gradle', 'Gemfile', 'composer.json',
];

const MAX_TREE_LINES = 250;
const MAX_FILE_CHARS = 4000;

/** Collects a compact, token-budgeted snapshot of the project for the LLM. */
export async function collectProjectContext(root: vscode.WorkspaceFolder): Promise<string> {
	const rootPath = root.uri.fsPath;
	const parts: string[] = [];

	const tree = await buildTree(rootPath);
	if (tree) {
		parts.push(`### Directory structure\n\`\`\`\n${tree}\n\`\`\``);
	}

	for (const name of MANIFESTS) {
		const text = await tryRead(path.join(rootPath, name), MAX_FILE_CHARS);
		if (text) {
			parts.push(`### ${name}\n\`\`\`\n${text}\n\`\`\``);
		}
	}

	for (const name of ['README.md', 'README.rst', 'README.txt', 'readme.md']) {
		const text = await tryRead(path.join(rootPath, name), MAX_FILE_CHARS);
		if (text) {
			parts.push(`### ${name}\n\n${text}`);
			break;
		}
	}

	if (parts.length === 0) {
		return '(The project is empty or contains no readable files — treat this as a greenfield project.)';
	}
	return parts.join('\n\n');
}

async function buildTree(rootPath: string): Promise<string> {
	const lines: string[] = [];
	await walk(rootPath, rootPath, '', 0, lines);
	return lines.slice(0, MAX_TREE_LINES).join('\n');
}

async function walk(rootPath: string, dir: string, prefix: string, depth: number, lines: string[]): Promise<void> {
	if (depth > 3 || lines.length >= MAX_TREE_LINES) {
		return;
	}
	let entries;
	try {
		entries = await fs.readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	entries.sort((a, b) => (b.isDirectory() ? 1 : 0) - (a.isDirectory() ? 1 : 0) || a.name.localeCompare(b.name));

	for (const entry of entries) {
		if (lines.length >= MAX_TREE_LINES) {
			lines.push(`${prefix}… (truncated)`);
			return;
		}
		if (entry.name.startsWith('.') && entry.name !== '.github') {
			continue;
		}
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) {
				continue;
			}
			lines.push(`${prefix}${entry.name}/`);
			await walk(rootPath, path.join(dir, entry.name), `${prefix}${entry.name}/`, depth + 1, lines);
		} else {
			lines.push(`${prefix}${entry.name}`);
		}
	}
}

async function tryRead(filePath: string, maxChars: number): Promise<string | undefined> {
	try {
		const stat = await fs.stat(filePath);
		if (!stat.isFile() || stat.size > 1024 * 1024) {
			return undefined;
		}
		const raw = await fs.readFile(filePath, 'utf8');
		return raw.length > maxChars ? `${raw.slice(0, maxChars)}\n… (truncated)` : raw;
	} catch {
		return undefined;
	}
}
