import * as vscode from 'vscode';
import { messageOf } from './requirementInput';

/**
 * Unified LLM access. Prefers the editor's own language models
 * (vscode.lm — works in VS Code with the models the user is already
 * signed into, e.g. Copilot). Falls back to an OpenAI-compatible HTTP
 * endpoint for editors that don't expose their models to extensions
 * (Cursor, Windsurf, Antigravity).
 */
export class ModelClient {
	private lmModel?: vscode.LanguageModelChat;
	private readonly secrets: vscode.SecretStorage;

	private constructor(secrets: vscode.SecretStorage) {
		this.secrets = secrets;
	}

	/** Builds the client, asking the user to pick a model where possible. */
	static async create(secrets: vscode.SecretStorage): Promise<ModelClient | undefined> {
		const client = new ModelClient(secrets);
		const models = await trySelectModels();
		if (models.length === 1) {
			client.lmModel = models[0];
		} else if (models.length > 1) {
			const picked = await vscode.window.showQuickPick(
				models.map((m) => ({
					label: `${m.name}`,
					description: `${m.vendor} · ${m.family} · ${m.id}`,
					model: m,
				})),
				{ placeHolder: 'Just Spec It: which AI model should write the docs?', ignoreFocusOut: true }
			);
			if (!picked) {
				return undefined;
			}
			client.lmModel = picked.model;
		}

		if (!client.lmModel && !(await ensureFallbackConfigured(secrets))) {
			return undefined;
		}
		return client;
	}

	/** True when the editor's own models are used (no API key needed). */
	get usesEditorModel(): boolean {
		return this.lmModel !== undefined;
	}

	async complete(system: string, user: string, token: vscode.CancellationToken): Promise<string> {
		const content = await (this.lmModel
			? this.completeWithLm(system, user, token)
			: this.completeWithHttp(system, user, token));
		if (!content.trim()) {
			throw new Error('The selected model returned an empty response.');
		}
		return content;
	}

	private async completeWithLm(system: string, user: string, token: vscode.CancellationToken): Promise<string> {
		const prompt = `${system}\n\n---\n\n${user}`;
		const messages = [vscode.LanguageModelChatMessage.User(prompt)];
		try {
			const request = await this.lmModel!.sendRequest(messages, undefined, token);
			let text = '';
			for await (const chunk of request.text) {
				text += chunk;
			}
			return text;
		} catch (err) {
			if (err instanceof vscode.CancellationError) {
				throw err;
			}
			throw new Error(`Editor model request failed: ${messageOf(err)}`);
		}
	}

	private async completeWithHttp(system: string, user: string, token: vscode.CancellationToken): Promise<string> {
		const cfg = vscode.workspace.getConfiguration('justSpecIt');
		const apiKey = (await this.secrets.get(FALLBACK_API_KEY_SECRET))?.trim() ?? '';
		const baseUrl = (cfg.get<string>('baseUrl') ?? 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
		const model = (cfg.get<string>('model') ?? 'gpt-4o-mini').trim();
		const controller = new AbortController();
		const cancellation = token.onCancellationRequested(() => controller.abort());
		if (token.isCancellationRequested) {
			controller.abort();
		}

		try {
			let response: Response;
			try {
				response = await fetch(`${baseUrl}/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
					},
					body: JSON.stringify({
						model,
						messages: [
							{ role: 'system', content: system },
							{ role: 'user', content: user },
						],
					}),
					signal: controller.signal,
				});
			} catch (err) {
				if (token.isCancellationRequested) {
					throw new vscode.CancellationError();
				}
				throw new Error(`Fallback provider request failed: ${messageOf(err)}`);
			}

			if (!response.ok) {
				const body = await response.text().catch(() => '');
				throw new Error(`Fallback provider returned ${response.status}: ${body.slice(0, 300)}`);
			}

			const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
			const content = data.choices?.[0]?.message?.content;
			if (typeof content !== 'string') {
				throw new Error('Fallback provider returned a response in an unsupported format.');
			}
			return content;
		} finally {
			cancellation.dispose();
		}
	}
}

async function trySelectModels(): Promise<vscode.LanguageModelChat[]> {
	try {
		return await vscode.lm.selectChatModels({});
	} catch {
		// No auth provider / not supported in this editor (e.g. some forks).
		return [];
	}
}

const FALLBACK_API_KEY_SECRET = 'justSpecIt.fallbackApiKey';

export async function configureFallbackApiKey(secrets: vscode.SecretStorage): Promise<void> {
	const existing = await secrets.get(FALLBACK_API_KEY_SECRET);
	const action = await vscode.window.showQuickPick(
		[
			{ label: '$(key) Set API key', action: 'set' as const },
			...(existing ? [{ label: '$(trash) Clear saved API key', action: 'clear' as const }] : []),
		],
		{ placeHolder: existing ? 'A fallback API key is saved securely' : 'No fallback API key is saved', ignoreFocusOut: true }
	);
	if (!action) {
		return;
	}
	if (action.action === 'clear') {
		await secrets.delete(FALLBACK_API_KEY_SECRET);
		vscode.window.showInformationMessage('Just Spec It: fallback API key cleared.');
		return;
	}

	const apiKey = await vscode.window.showInputBox({
		prompt: 'Enter the API key for your OpenAI-compatible fallback provider',
		password: true,
		ignoreFocusOut: true,
		validateInput: (value) => value.trim() ? undefined : 'API key cannot be empty.',
	});
	if (apiKey === undefined) {
		return;
	}
	await secrets.store(FALLBACK_API_KEY_SECRET, apiKey.trim());
	vscode.window.showInformationMessage('Just Spec It: fallback API key saved in VS Code secret storage.');
}

async function ensureFallbackConfigured(secrets: vscode.SecretStorage): Promise<boolean> {
	const cfg = vscode.workspace.getConfiguration('justSpecIt');
	const apiKey = (await secrets.get(FALLBACK_API_KEY_SECRET))?.trim() ?? '';
	const baseUrl = (cfg.get<string>('baseUrl') ?? '').trim();
	const model = (cfg.get<string>('model') ?? '').trim();

	let url: URL;
	try {
		url = new URL(baseUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error('unsupported protocol');
		}
	} catch {
		return showFallbackProblem('The fallback base URL must be a valid HTTP or HTTPS URL.');
	}

	if (!model) {
		return showFallbackProblem('The fallback model name is empty.');
	}

	const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
	if (!apiKey && !localHosts.has(url.hostname)) {
		return showFallbackProblem('No editor AI model is available and the fallback provider has no API key.', true);
	}
	return true;
}

async function showFallbackProblem(message: string, canSetKey = false): Promise<boolean> {
	const pick = await vscode.window.showWarningMessage(
		`Just Spec It: ${message}`,
		...(canSetKey ? ['Set API Key'] : []),
		'Open Settings'
	);
	if (pick === 'Set API Key') {
		await vscode.commands.executeCommand('justSpecIt.configureApiKey');
	}
	if (pick === 'Open Settings') {
		await vscode.commands.executeCommand('workbench.action.openSettings', 'justSpecIt');
	}
	return false;
}
