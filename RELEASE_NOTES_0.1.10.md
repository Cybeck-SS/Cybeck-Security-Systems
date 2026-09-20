# Cybeck Security Systems v0.1.10

- Fixed the AnyDesk launch path for portable copies without a registered `anydesk:` URL handler.
- Cybeck looks for a valid AnyDesk executable in standard install locations and the current user's Downloads or Desktop folder. It checks the executable's AnyDesk publisher signature before launching it.
- Added **Choose AnyDesk.exe** for installations in other locations. This choice lasts for the current app session.

AnyDesk remains a separate application and is not included in the Cybeck installer. The second computer still needs AnyDesk and its own connection approval or authentication. A live two-computer connection was not available for this build. Automated tests and local Electron startup passed.

This installer is **unsigned** because no publicly trusted code-signing identity is configured. Windows Smart App Control blocked the packaged Cybeck executable on the build machine; it may block this release on other devices too. The signed-release verification command intentionally rejects this package. Do not disable Windows security controls to run it.
