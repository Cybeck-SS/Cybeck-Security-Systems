# Cybeck Security Systems v0.1.16

## Profile sessions

- Requires profile creation and authentication before opening the Cybeck dashboard.
- Separates notes, tasks, incidents, and security history for each profile.
- Migrates existing local records into the first authenticated profile once.
- Clears command permission, active commands, and remote target state at sign-out.
- Supports password-confirmed profile deletion with optional profile data removal.

## Network repair

- Adds DHCP release and renewal.
- Adds DNS cache flushing.
- Adds Wi-Fi disconnect and reconnect for the active wireless profile.
- Adds restart control for the active default-route network adapter.
- Adds Windows Winsock and IP stack reset with clear restart guidance.
- Uses fixed repair actions, confirmation prompts, and Windows UAC for actions that require administrator access.

## Reliability

- Adds automated coverage for every visible button and form handler.
- Adds validation tests for the network repair action allowlist and input rejection.
- Passes all 35 automated tests.
