# Cybeck Security Systems v0.1.13

## Added

- Cybeck Vault login with local profiles, password verification, Windows protected profile storage, manual locking, and temporary attempt lockout.
- Readable Notepad compatible note files under Documents, with current copies, revision history, and restore into Cybeck.

## Improved

- Active Connections now places newly observed connections at the top of the list.
- Incidents are collapsible and grouped by severity with separate active and completed sections.
- Notes urgency selection now uses a smoother orbit style cycle with mouse wheel support.
- Local encrypted saves use unique temporary files to prevent collisions between overlapping application instances.

## Security

- Vault passwords are stored as salted password verifiers and are never returned to the interface.
- Vault profile files are additionally protected through Windows secure storage.
- Five unsuccessful unlock attempts temporarily pause further attempts for that profile.
