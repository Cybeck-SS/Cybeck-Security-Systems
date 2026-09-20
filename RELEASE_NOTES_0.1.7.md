# Cybeck Security Systems v0.1.7

- Made Monitoring History and the Operations command panels collapsible, with their visibility preference saved locally.
- Added a Remote Systems panel for a second Windows, Linux, or macOS computer using its existing SSH service and key-based login.
- Added remote CPU, memory, disk, and process snapshots, optional 15-second refresh, explicit remote commands, Stop, Disconnect, and a Windows Remote Desktop launch option.
- Remote access requires an in-app target confirmation and the remote computer's own authentication. No passwords or remote credentials are stored by Cybeck.

The remote computer must already have SSH configured with a trusted host key and authorized account. Windows Remote Desktop also requires a supported and enabled host. This installer remains unsigned. Windows Application Control blocked the packaged executable on the build machine, so an installed-app smoke test and a live connection to a second computer could not be completed there; the tests and browser preview passed.
