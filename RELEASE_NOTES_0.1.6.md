# Cybeck Security Systems v0.1.6

- Replaced the per-command Operations prompt with one access request for CMD and PowerShell each time the Cybeck window is opened.
- Added a visible session access state and Revoke Access control. Closing Cybeck clears access; revoking it stops the current command.
- Retained local Windows user permissions, live output, Stop, the command limits, Network Monitor, incident workflows, and updater.

Session access does not grant administrator privileges. Windows still controls elevated actions. This installer is unsigned and may trigger Windows security warnings.
