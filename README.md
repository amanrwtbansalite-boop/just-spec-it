![Just Spec It — One requirement. Six focused docs.](images/social-preview.png)

# Just Spec It

Turn one product requirement into six focused, connected planning documents—without leaving your editor.

[![CI](https://github.com/amanrwtbansalite-boop/just-spec-it/actions/workflows/ci.yml/badge.svg)](https://github.com/amanrwtbansalite-boop/just-spec-it/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-7c3aed.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-14b8a6.svg)](CHANGELOG.md)

Just Spec It is a lightweight spec-driven development extension for VS Code and compatible editors. Describe what you want to build once; it reads a compact snapshot of your project, lets you inspect exactly what will be sent to the model, and writes a coherent spec set to `docs/`.

No new project format. No telemetry. In VS Code, no separate API key is normally required.

## Why developers use it

- **One input, six useful docs.** Enough structure for humans and coding agents without a documentation maze.
- **Review before propagation.** Correct `requirements.md` before architecture, plans, and tasks inherit a mistake.
- **Transparent context.** Preview and edit the exact project context before it is sent to the model.
- **Consistent updates.** Describe what changed and Just Spec It recommends the affected documents.
- **Grounded in your repository.** The extension reads the tree, README, and common manifest files—not your source code.
- **Model choice.** Prefer VS Code's available language models, or configure an OpenAI-compatible endpoint.

## The six-document spec

| File | Purpose |
| --- | --- |
| `docs/requirements.md` | Scope, testable requirements, and acceptance criteria |
| `docs/architecture.md` | Components, data flow, technology choices, risks, and proposed layout |
| `docs/phase-plan.md` | Ordered implementation phases, each with a clear completion condition |
| `docs/decisions.md` | Concise architecture decision records and their consequences |
| `docs/tasks.md` | Actionable checkbox tasks grouped by phase |
| `docs/README.md` | Project memory: overview, glossary, constraints, spec index, and next action |

The files are generated as a chain. Later documents receive the relevant approved earlier documents, so tasks stay aligned with the architecture and requirements.

## Quick start

1. Install the latest `.vsix` from [GitHub Releases](https://github.com/amanrwtbansalite-boop/just-spec-it/releases).
2. Open your project in VS Code.
3. Open the Command Palette (`Cmd/Ctrl+Shift+P`).
4. Run **Just Spec It: Generate Spec Docs**.
5. Type a requirement or choose an existing requirement file.
6. Review the context preview, then approve or edit `requirements.md` before the remaining docs are generated.

Your completed spec appears in `docs/`.

Want a safe first run? Use [`examples/sample-requirement.md`](examples/sample-requirement.md).

To install a downloaded package from the terminal:

```bash
code --install-extension just-spec-it-0.2.0.vsix
```

Cursor, Windsurf, and other VS Code-compatible editors can install the same VSIX through their Extensions menu.

## Keep an existing spec current

Run **Just Spec It: Update Spec Docs**, then describe the change—for example, “replace REST with gRPC” or “add organization-level permissions.” The extension recommends the documents that are likely affected and explains why. You can accept or change the selection before anything is regenerated.

Existing documents are used as context, while unselected files are left untouched.

## Model setup

### VS Code

Just Spec It first uses the language models made available by VS Code. If several are available, you choose one. Access can still depend on the installed model provider and your account permissions.

### OpenAI-compatible fallback

For editors that do not expose their internal model, configure any compatible endpoint:

```jsonc
{
  "justSpecIt.baseUrl": "https://api.openai.com/v1",
  "justSpecIt.model": "gpt-4o-mini"
}
```

Localhost providers such as Ollama may be used without an API key:

```jsonc
{
  "justSpecIt.baseUrl": "http://localhost:11434/v1",
  "justSpecIt.model": "your-local-model"
}
```

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `justSpecIt.baseUrl` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `justSpecIt.model` | `gpt-4o-mini` | Fallback model name |
| `justSpecIt.outputDir` | `docs` | Workspace-relative output directory; cannot escape the workspace |
| `justSpecIt.previewContext` | `true` | Show an editable preview of the exact model context |

## ChatGPT and Codex

The repository also contains a companion Codex plugin in [`chatgpt-plugin/`](chatgpt-plugin/). It provides the same six-document workflow as an AI skill. After cloning the repository, install it in Codex with:

```bash
codex plugin add ./chatgpt-plugin
```

Then ask: “Use Just Spec It to create the project spec for this repository.”

The VS Code extension and Codex plugin are separate packages because editor extensions and ChatGPT/Codex plugins use different integration systems.

## Privacy and security

Before generation, Just Spec It shows the context it plans to send. By default that context contains:

- the requirement you provided;
- a bounded directory tree;
- the project README;
- common manifest files such as `package.json`, `requirements.txt`, `go.mod`, or `Cargo.toml`.

It does not intentionally collect source-file contents and it has no analytics or telemetry. The approved context is sent only to the model provider you select. Review the preview if your filenames, README, or manifests contain sensitive information.

Use **Just Spec It: Set or Clear Fallback API Key** to store a provider key in VS Code's secret storage. Keys are not placed in `settings.json`. See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Development

Requirements: Node.js 22+ and VS Code 1.100+.

```bash
npm ci
npm test
npm run compile
npm run vsix
```

Press `F5` in VS Code to launch an Extension Development Host.

```text
src/
├── extension.ts         command registration and orchestration
├── requirementInput.ts  typed or file-based requirement input
├── projectContext.ts    bounded repository context collection
├── prompts.ts           six document definitions and chained prompts
├── updateImpact.ts      deterministic update recommendations
├── modelProvider.ts     VS Code model and compatible-provider fallback
└── docWriter.ts         safe document writing and cleanup
```

## Roadmap

- More project templates while preserving the small default spec
- Better visual diffs before updating an existing document
- Exportable context presets for teams
- Compatibility testing across more VS Code-based editors

Have an idea? Open a [feature request](https://github.com/amanrwtbansalite-boop/just-spec-it/issues/new/choose). Small, focused pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Help the project grow

If Just Spec It saves you planning time, star the repository and share a real example of what you built with it. Useful bug reports, editor compatibility notes, and before/after spec examples help even more.

## License

[MIT](LICENSE)
