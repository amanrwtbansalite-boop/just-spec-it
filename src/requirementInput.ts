import * as vscode from 'vscode';
import * as fs from 'fs/promises';

/**
 * Asks the user for the requirement: typed/pasted in one go, or read
 * from an existing file (ticket export, notes, REQUIREMENTS.md, ...).
 * Returns undefined when the user cancels.
 */
export async function getRequirement(): Promise<string | undefined> {
	const choice = await vscode.window.showQuickPick(
		[
			{
				label: '$(edit) Type or paste requirement',
				detail: 'Describe what you want to build in one go',
			},
			{
				label: '$(file-code) Read from a file',
				detail: 'Pick an existing file (markdown, text, ticket export) that contains the requirement',
			},
		],
		{ placeHolder: 'Just Spec It: how do you want to provide the requirement?', ignoreFocusOut: true }
	);
	if (!choice) {
		return undefined;
	}

	if (choice.label.startsWith('$(file-code)')) {
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: false,
			filters: { 'Requirement files': ['md', 'txt', 'rst', 'adoc'], 'All files': ['*'] },
			openLabel: 'Use this file as the requirement',
		});
		if (!uris || uris.length === 0) {
			return undefined;
		}
		try {
			const content = await fs.readFile(uris[0].fsPath, 'utf8');
			if (!content.trim()) {
				vscode.window.showErrorMessage('Just Spec It: the selected file is empty.');
				return undefined;
			}
			return content;
		} catch (err) {
			vscode.window.showErrorMessage(`Just Spec It: could not read the file. ${messageOf(err)}`);
			return undefined;
		}
	}

	const typed = await vscode.window.showInputBox({
		prompt: 'Describe what you want to build. Paste is fine — everything goes into the spec.',
		placeHolder: 'e.g. Add a REST API for managing tasks with auth, per-user lists, and due-date reminders',
		ignoreFocusOut: true,
	});
	if (typed === undefined || !typed.trim()) {
		if (typed !== undefined) {
			vscode.window.showErrorMessage('Just Spec It: the requirement was empty.');
		}
		return undefined;
	}
	return typed;
}

export function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
