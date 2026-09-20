# Cybeck Security Systems v0.1.5

- Added CMD and Windows PowerShell command consoles within the Operations page.
- Commands run locally with the signed-in Windows user's permissions after an in-app confirmation. Output streams into the app while monitoring remains active.
- Added Stop and Clear Output controls, one-command-at-a-time execution, a 30-second runtime limit, and a 128 KB output limit.
- Preserved the Network Monitor, security events, incident workflows, local history, and updater.

The console cannot elevate Windows privileges and is not remotely hosted. The Windows installer is unsigned and may still prompt or be blocked by Windows security protections.
