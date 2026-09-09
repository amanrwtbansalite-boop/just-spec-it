# Contributing to Just Spec It

Thanks for helping make specification-driven development easier.

## Before opening a change

- Search existing issues and discussions first.
- Keep proposals small and explain the user problem they solve.
- Do not add telemetry, silently expand collected context, or weaken path validation.
- Preserve the default six-document limit unless the project reaches consensus on a different model.

For a bug, include your editor and version, extension version, model/provider type, reproducible steps, expected result, and sanitized error output. Never include API keys or private project content.

## Local development

Use Node.js 22 or newer:

```bash
npm ci
npm test
npm run compile
```

Press `F5` in VS Code to exercise the extension in an Extension Development Host. Before submitting a pull request, also run:

```bash
npm run vsix
```

## Pull requests

- Link the issue or explain the motivation.
- Add or update tests for behavior changes.
- Update the README and changelog when the user experience changes.
- Keep generated bundles and package-lock changes consistent with the source.
- Confirm that logs, fixtures, screenshots, and generated specs contain no secrets.

By contributing, you agree that your contribution is licensed under the project's MIT License.
