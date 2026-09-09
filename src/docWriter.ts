import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DOC_SPECS } from './prompts';

export type DocContents = Map<string, string>;

/** Resolves and validates the configured output directory. */
export function resolveOutputDirectory(root: vscode.WorkspaceFolder): string {
	const configured = (vscode.workspace.getConfiguration('justSpecIt').get<string>('outputDir') ?? 'docs').trim();
	if (!configured) {
		throw new Error('"justSpecIt.outputDir" must not be empty.');
	}
	if (path.isAbsolute(configured)) {
		throw new Error('"justSpecIt.outputDir" must be relative to the workspace folder.');
	}

	const rootPath = path.resolve(root.uri.fsPath);
	const outDir = path.resolve(rootPath, configured);
	const relative = path.relative(rootPath, outDir);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error('"justSpecIt.outputDir" must stay inside the workspace folder.');
	}
	return outDir;
}

/** Rejects output paths whose nearest existing directory escapes through a symlink. */
export async function assertOutputDirectorySafe(root: vscode.WorkspaceFolder): Promise<string> {
	const outDir = resolveOutputDirectory(root);
	const realRoot = await fs.realpath(root.uri.fsPath);
	const realAncestor = await realPathOfNearestExisting(outDir);
	const relative = path.relative(realRoot, realAncestor);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error('"justSpecIt.outputDir" resolves outside the workspace through a symbolic link.');
	}
	return outDir;
}

/** Writes generated docs into `<workspace>/<outputDir>`. */
export async function writeDocs(
	root: vscode.WorkspaceFolder,
	docs: DocContents
): Promise<vscode.Uri[]> {
	const outDir = await assertOutputDirectorySafe(root);
	await fs.mkdir(outDir, { recursive: true });
	// Recheck after creation so a newly resolved directory is covered too.
	await assertOutputDirectorySafe(root);

	const written: vscode.Uri[] = [];
	for (const [file, content] of docs) {
		const uri = vscode.Uri.file(path.join(outDir, file));
		await fs.writeFile(uri.fsPath, normalize(content), 'utf8');
		written.push(uri);
	}

	return written;
}

/** Opens a generated document without rewriting it. */
export async function openDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
	const doc = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(doc, { preview: false });
	return doc;
}

/** Returns the paths of the standard docs that already exist on disk. */
export async function findExistingDocs(root: vscode.WorkspaceFolder): Promise<string[]> {
	const outDir = await assertOutputDirectorySafe(root);
	const existing: string[] = [];
	for (const spec of DOC_SPECS) {
		try {
			await fs.access(path.join(outDir, spec.file));
			existing.push(spec.file);
		} catch {
			// not there — fine
		}
	}
	return existing;
}

/** Reads existing docs (when present) so regeneration stays consistent with them. */
export async function readExistingDocs(root: vscode.WorkspaceFolder, files: readonly string[]): Promise<DocContents> {
	const outDir = await assertOutputDirectorySafe(root);
	const contents: DocContents = new Map();
	for (const file of files) {
		try {
			contents.set(file, await fs.readFile(path.join(outDir, file), 'utf8'));
		} catch {
			// missing — skip
		}
	}
	return contents;
}

async function realPathOfNearestExisting(candidate: string): Promise<string> {
	let current = candidate;
	while (true) {
		try {
			return await fs.realpath(current);
		} catch (err) {
			if (!isMissingPathError(err)) {
				throw err;
			}
			const parent = path.dirname(current);
			if (parent === current) {
				throw err;
			}
			current = parent;
		}
	}
}

function isMissingPathError(err: unknown): err is NodeJS.ErrnoException {
	return err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
}

/** Strips code fences the model may have wrapped the doc in. */
function normalize(text: string): string {
	let t = text.trim();
	const fence = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
	if (fence) {
		t = fence[1];
	}
	if (!t.endsWith('\n')) {
		t += '\n';
	}
	return t;
}
