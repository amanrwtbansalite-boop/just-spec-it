import * as vscode from 'vscode';
import * as path from 'path';
import { ModelClient, configureFallbackApiKey } from './modelProvider';
import { collectProjectContext } from './projectContext';
import { getRequirement, messageOf } from './requirementInput';
import { DOC_SPECS, systemPrompt, userPrompt, DocSpec } from './prompts';
import { writeDocs, findExistingDocs, readExistingDocs, openDocument, resolveOutputDirectory, assertOutputDirectorySafe, DocContents } from './docWriter';
import { recommendDocUpdates } from './updateImpact';

const GITHUB_URL = 'https://github.com/amanrwtbansalite-boop/just-spec-it';
const SUCCESS_COUNT_KEY = 'justSpecIt.successfulRuns';
const STAR_PROMPT_SHOWN_KEY = 'justSpecIt.starPromptShown';
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
	extensionContext = context;
	context.subscriptions.push(
		vscode.commands.registerCommand('justSpecIt.generate', () => runGenerate()),
		vscode.commands.registerCommand('justSpecIt.updateFile', () => runUpdate()),
		vscode.commands.registerCommand('justSpecIt.configureApiKey', () => configureFallbackApiKey(context.secrets))
	);
}

export function deactivate(): void {}

/** Full flow: requirement in, all six docs out. */
async function runGenerate(): Promise<void> {
	const root = await pickWorkspaceRoot();
	if (!root) {
		return;
	}

	if (!(await validateOutputDirectory(root))) {
		return;
	}

	const existing = await findExistingDocs(root);
	if (existing.length > 0 && !(await confirmOverwrite(existing))) {
		return;
	}

	const requirement = await getRequirement();
	if (!requirement) {
		return;
	}

	await generateAndWrite(root, requirement, new Map(), DOC_SPECS, undefined);
}

/** Partial flow: regenerate only the selected docs, keeping the rest. */
async function runUpdate(): Promise<void> {
	const root = await pickWorkspaceRoot();
	if (!root) {
		return;
	}
	if (!(await validateOutputDirectory(root))) {
		return;
	}

	const existing = await findExistingDocs(root);
	if (existing.length === 0) {
		vscode.window.showInformationMessage(
			'Just Spec It: no generated docs found yet — run "Generate Spec Docs" first.'
		);
		return;
	}

	const changeNote = await vscode.window.showInputBox({
		prompt: 'Optional: what should change? (Leave empty to regenerate from the current project state.)',
		ignoreFocusOut: true,
	});
	if (changeNote === undefined) {
		return;
	}

	const recommendations = recommendDocUpdates(changeNote);
	const recommendationByFile = new Map(recommendations.map((item) => [item.file, item.reason]));
	const selected = await vscode.window.showQuickPick(
		DOC_SPECS.map((spec) => {
			const reason = recommendationByFile.get(spec.file);
			return {
				label: spec.file,
				description: reason ? `Recommended · ${spec.title}` : spec.title,
				detail: reason,
				picked: reason !== undefined && (existing.includes(spec.file) || spec.file === 'README.md'),
				spec,
			};
		}),
		{ canPickMany: true, placeHolder: 'Review the recommended docs to regenerate', ignoreFocusOut: true }
	);
	if (!selected || selected.length === 0) {
		return;
	}

	// Read every existing doc: dependencies provide context and selected docs provide
	// a baseline that the model can revise instead of recreating from memory.
	const existingDocs = await readExistingDocs(root, DOC_SPECS.map((s) => s.file));
	const selectedFiles = new Set(selected.map((item) => item.spec.file));
	const orderedSpecs = DOC_SPECS.filter((spec) => selectedFiles.has(spec.file));

	await generateAndWrite(root, undefined, existingDocs, orderedSpecs, changeNote);
}

async function generateAndWrite(
	root: vscode.WorkspaceFolder,
	requirement: string | undefined,
	existingDocs: DocContents,
	docs: readonly DocSpec[],
	changeNote?: string
): Promise<void> {
	const projectContext = await collectAndReviewProjectContext(root);
	if (projectContext === undefined) {
		return;
	}

	const client = await ModelClient.create(extensionContext.secrets);
	if (!client) {
		return;
	}

	const completedAll = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Just Spec It', cancellable: true },
		async (progress, token) => {
			const effectiveRequirement = requirement ?? existingDocs.get('requirements.md') ?? '(No explicit requirement — infer from the existing docs and project context.)';
			const baselineDocs: DocContents = new Map(existingDocs);
			const priorDocs: DocContents = new Map(existingDocs);
			const generated: DocContents = new Map();
			let firstWritten: vscode.Uri | undefined;

			for (const spec of docs) {
				if (token.isCancellationRequested) {
					vscode.window.showWarningMessage('Just Spec It: cancelled. Docs written so far are saved.');
					break;
				}
				progress.report({ message: `Generating ${spec.file}…` });
				try {
					const text = await client.complete(
						systemPrompt(),
						userPrompt(spec, effectiveRequirement, projectContext, priorDocs, {
							existingContent: baselineDocs.get(spec.file),
							changeNote,
						}),
						token
					);
					priorDocs.set(spec.file, text);
					generated.set(spec.file, text);
					const written = await writeDocs(root, new Map([[spec.file, text]]));
					firstWritten ??= written[0];

					if (spec.file === 'requirements.md' && docs.some((candidate) => candidate.file !== 'requirements.md')) {
						const reviewed = await reviewRequirements(written[0]);
						if (reviewed === undefined) {
							break;
						}
						priorDocs.set(spec.file, reviewed);
						generated.set(spec.file, reviewed);
					}
				} catch (err) {
					if (err instanceof vscode.CancellationError) {
						vscode.window.showWarningMessage('Just Spec It: cancelled. Docs written so far are saved.');
						break;
					}
					const choice = await vscode.window.showErrorMessage(
						`Just Spec It: failed to generate ${spec.file}. ${messageOf(err)}`,
						'Skip and continue'
					);
					if (choice !== 'Skip and continue') {
						break;
					}
				}
			}

			const names = [...generated.keys()];
			if (names.length > 0) {
				const where = path.relative(root.uri.fsPath, resolveOutputDirectory(root)) || '.';
				vscode.window.showInformationMessage(`Just Spec It: wrote ${names.length} file(s) to ${where}/ — ${names.join(', ')}`);
				if (firstWritten) {
					try {
						await openDocument(firstWritten);
					} catch (err) {
						vscode.window.showWarningMessage(`Just Spec It: docs were written, but the editor could not open ${names[0]}. ${messageOf(err)}`);
					}
				}
			} else {
				vscode.window.showWarningMessage('Just Spec It: nothing was written.');
			}
			return docs.length > 0 && names.length === docs.length;
		}
	);

	if (completedAll) {
		await recordSuccessfulRunAndMaybePromptForStar();
	}
}

async function collectAndReviewProjectContext(root: vscode.WorkspaceFolder): Promise<string | undefined> {
	let projectContext = '(No project context available.)';
	try {
		projectContext = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Just Spec It: reading project context' },
			() => collectProjectContext(root)
		);
	} catch (err) {
		vscode.window.showWarningMessage(`Just Spec It: could not read project context (${messageOf(err)}). Continuing without it.`);
	}

	const previewEnabled = vscode.workspace.getConfiguration('justSpecIt').get<boolean>('previewContext') ?? true;
	if (!previewEnabled) {
		return projectContext;
	}

	const preview = await vscode.workspace.openTextDocument({ language: 'markdown', content: projectContext });
	await vscode.window.showTextDocument(preview, { preview: true });
	const choice = await vscode.window.showInformationMessage(
		'Just Spec It: review or edit this context preview. Only its current contents will be sent to the selected AI model.',
		'Send this context',
		'Cancel'
	);
	if (choice !== 'Send this context') {
		return undefined;
	}
	return preview.getText().trim() || '(No project context provided.)';
}

async function reviewRequirements(uri: vscode.Uri): Promise<string | undefined> {
	const document = await openDocument(uri);
	const choice = await vscode.window.showInformationMessage(
		'Just Spec It: review and edit requirements.md now. Continue only when its scope and acceptance criteria are correct.',
		'Continue generation',
		'Stop after requirements'
	);
	if (choice !== 'Continue generation') {
		return undefined;
	}
	if (!document.getText().trim()) {
		vscode.window.showErrorMessage('Just Spec It: requirements.md cannot be empty.');
		return undefined;
	}
	if (document.isDirty && !(await document.save())) {
		vscode.window.showErrorMessage('Just Spec It: requirements.md could not be saved.');
		return undefined;
	}
	return document.getText();
}

async function recordSuccessfulRunAndMaybePromptForStar(): Promise<void> {
	const count = extensionContext.globalState.get<number>(SUCCESS_COUNT_KEY, 0) + 1;
	await extensionContext.globalState.update(SUCCESS_COUNT_KEY, count);
	if (count < 3 || extensionContext.globalState.get<boolean>(STAR_PROMPT_SHOWN_KEY, false)) {
		return;
	}

	await extensionContext.globalState.update(STAR_PROMPT_SHOWN_KEY, true);
	const choice = await vscode.window.showInformationMessage(
		'Just Spec It: glad this is becoming part of your workflow. Would you like to star the project on GitHub?',
		'Star on GitHub',
		'No thanks'
	);
	if (choice === 'Star on GitHub') {
		await vscode.env.openExternal(vscode.Uri.parse(GITHUB_URL));
	}
}

async function validateOutputDirectory(root: vscode.WorkspaceFolder): Promise<boolean> {
	try {
		await assertOutputDirectorySafe(root);
		return true;
	} catch (err) {
		vscode.window.showErrorMessage(`Just Spec It: ${messageOf(err)}`);
		return false;
	}
}

async function pickWorkspaceRoot(): Promise<vscode.WorkspaceFolder | undefined> {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		vscode.window.showErrorMessage('Just Spec It: open a project folder first.');
		return undefined;
	}
	if (folders.length === 1) {
		return folders[0];
	}
	return vscode.window.showWorkspaceFolderPick({ placeHolder: 'Which project should the specs be generated for?' });
}

async function confirmOverwrite(existing: string[]): Promise<boolean> {
	const pick = await vscode.window.showWarningMessage(
		`Just Spec It: these files already exist and will be overwritten: ${existing.join(', ')}. Continue?`,
		{ modal: true },
		'Overwrite',
		'Update instead…'
	);
	if (pick === 'Update instead…') {
		await vscode.commands.executeCommand('justSpecIt.updateFile');
	}
	return pick === 'Overwrite';
}
