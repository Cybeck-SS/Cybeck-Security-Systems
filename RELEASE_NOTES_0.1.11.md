# Cybeck Security Systems v0.1.11

- Added an Operations button to close the entire local AnyDesk application and end its sessions after confirmation. It can also close other AnyDesk sessions on the same PC.
- Added editable Tasks with status, urgency, due date, source, and reference. Network and Operations shortcuts, recent activity, and incidents can start a linked task.
- Added editable Notes with a lined editor and rotating urgency categories.
- Tasks and Notes save encrypted in Windows user data. JSON import and export support manual transfer and a later cloud-drive connection. Exported JSON is readable and should be kept private.

AnyDesk remains a separate application and is not bundled. The Windows command interface does not document a way to disconnect one selected AnyDesk session, so Cybeck closes the full local application when requested.

Automated tests passed. The local Electron launch attempt in this environment stopped with GPU and profile access errors, so a visual app check and a two-computer AnyDesk test remain outstanding.

This installer is unsigned because no publicly trusted code-signing identity is configured. Windows Smart App Control or managed device policy may block it. Do not disable Windows security controls to run it.
