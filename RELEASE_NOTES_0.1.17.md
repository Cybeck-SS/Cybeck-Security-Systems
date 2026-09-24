# Cybeck Security Systems v0.1.17

## Local Test Mode

- Adds `Start Cybeck Test Mode.cmd` for launching the current project build directly.
- Keeps the packaged updater inactive throughout the local test session.
- Labels the running channel as Local Test Mode in application information.
- Preserves profile authentication, Network Monitor, Operations, Tasks, Notes, Vault, remote access integrations, and network repair controls.

## Verification

- Passes JavaScript syntax validation.
- Passes all 35 automated tests.

The public installer remains unsigned until a trusted RSA code-signing identity is configured. Windows Smart App Control may block unsigned installation or updating on enforced devices.
