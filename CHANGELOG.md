# Changelog

All notable changes to Just Spec It are documented here.

## [0.2.0] - 2026-09-10

### Added

- A sixth generated document, `docs/README.md`, as durable project memory and a spec index.
- An editable preview of the exact context sent to the selected model.
- A review checkpoint after `requirements.md` and before downstream generation.
- Deterministic update-impact recommendations with human-readable reasons.
- A respectful, one-time GitHub star prompt after three successful full runs.
- Secure fallback API-key storage through VS Code SecretStorage.
- Automated tests, GitHub Actions CI, issue templates, and a companion Codex plugin.

### Changed

- Renamed the update command to **Update Spec Docs**.
- Improved public documentation, privacy guidance, and provider setup.

## [0.1.0] - 2026-09-09

- Initial five-document spec generation flow.
- VS Code language-model support with an OpenAI-compatible fallback.
- Safe workspace-relative output and selective document updates.
