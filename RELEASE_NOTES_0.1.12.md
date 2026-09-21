# Cybeck Security Systems v0.1.12

- Fixed the explicit **Restart & Install** action to install the downloaded update silently and force Cybeck to relaunch afterward.
- Ordinary app exit no longer installs a pending update in the background. Installation now starts only when the user selects **Restart & Install**.
- Added an **Installing and restarting** state and prevents repeated install clicks.
- Restricted the install command to the local Cybeck application window.
- Changed active-network selection to follow Windows' lowest-metric usable default route, so Ethernet is displayed when it is carrying traffic even if Wi-Fi remains associated.
- Added explicit Wi-Fi, Ethernet, VPN, cellular, Bluetooth, and other-adapter classification. Ethernet now shows link state and negotiated link speed instead of a false Wi-Fi signal value.
- Changed live reachability measurement from ICMP-only ping to a TCP 443 probe, improving feedback on networks that block ping. Network type and adapter changes are included in session monitoring events.
- Improved text wrapping, icon containment, panel padding, button sizing, and responsive layouts throughout the application. The Network Quick Actions control no longer overlaps task controls, and the Dashboard, Network Monitor, Operations, Tasks, Notes, Settings, and About layouts remain within their borders at narrower window sizes.

The update from v0.1.11 into this fixed build still runs the v0.1.11 updater code. If Cybeck does not reopen after that update, open it manually once. Updates started from v0.1.12 and later use the corrected restart path.

Automated tests passed. The installer remains unsigned because no publicly trusted code-signing identity is configured. Windows Smart App Control or managed device policy may block the installer or the relaunched application.
