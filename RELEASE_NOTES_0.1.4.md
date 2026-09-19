# Cybeck Security Systems v0.1.4

This release packages the current workspace and preserves the Network Monitor, Operations dashboard, security event monitoring, incident workflows, local history, and updater from v0.1.3.

- Added a safeguard that stops the normal publish command when Windows code signing is unavailable.
- Documented supported Windows versions and the signing requirements for future releases.

This installer is unsigned because no trusted code-signing identity is available for this project. Windows SmartScreen or Smart App Control may warn or block it. This release does not resolve Windows security reputation warnings.
