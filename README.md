# Cybeck Security Systems v0.1.9

Local Windows desktop security monitor built with Electron. Run `npm start` from this folder. Run `npm test` for focused checks. `npm run build` creates a Windows installer in `release/`; building does not publish it.

## Monitoring features

- Network and internet status, signal, latency chart, adapter and gateway details, diagnostics, offline/restored states, and Quick Actions.
- Session security events, alert lifecycles, filtered timeline, outages, downtime, recovery time, connection reliability, and signal statistics.
- Read-only TCP and UDP connection snapshots with process name, PID, addresses, ports, protocol, state, and time observed in the current session. Windows supplies these snapshots every 15 seconds; up to 300 rows are shown. A lightweight TCP attempt poll runs every 2 seconds.
- Cautious observations for new listening ports, unidentified processes, connections to uncommon destination ports, high established-connection counts, repeated observed TCP attempts, DNS configuration changes, and repeated DNS lookup failures. DNS checks query `example.com` through the configured resolver every 15 seconds. The first connection scan establishes a baseline. An observation is not a malware verdict.
- Incident records with investigation, containment review, resolution, false-positive and archive status, notes, timeline, and PDF or JSON report export. A user can explicitly block one incident's remote IP with a Windows Firewall outbound rule and remove that exact Cybeck rule later. Both actions require in-app confirmation and may need Windows administrator access. Detection never blocks traffic automatically.
- Local event, incident, and daily summary history in Electron's user-data folder as `security-history.json`, encrypted with Windows' user-bound storage protection. History is bounded to the latest 500 events, 200 incidents, and 31 daily summaries. If encryption is unavailable, Cybeck does not save history.
- Operations dashboard with live status, open incidents, recent activity, monitoring module status, and today/7-day/30-day totals.
- Operations local command console for CMD and Windows PowerShell. One in-app approval enables both shells for the current Cybeck window session; closing the window clears access. Access can also be revoked in Operations. Commands run with the current Windows user's permissions, stream output in the app, and can be stopped. One command runs at a time with a 30-second and 128 KB output limit. The console does not elevate privileges, persist output, or expose a remote service.
- Collapsible Operations history and command panels retain their open or closed state locally. The Remote Systems panel connects to a second Windows, Linux, or macOS computer through its existing SSH service using an SSH key and trusted host key. It can display CPU, memory, disk, and process snapshots (with optional 15-second refresh) and run explicit remote commands. Windows Remote Desktop opens the built-in client for screen control. No remote credentials are stored, and the remote connection ends when Cybeck closes.
- The Remote Systems panel can check whether the default RDP port is reachable. A successful port check does not prove that Windows sign-in or screen control will succeed. Windows Home cannot host Remote Desktop. For a Windows Home target, the Quick Assist button opens Microsoft's separate screen-sharing app; the second PC must enter the session code and approve sharing and any control request.
- Remote Systems includes an AnyDesk launcher. It accepts a remote AnyDesk ID or alias and opens an installed AnyDesk client through its registered Windows URL handler. The viewer, approval, and control remain in AnyDesk. Cybeck does not install, bundle, license, or store credentials for AnyDesk.

## Remote computer setup

On the second computer, enable its SSH server, authorize your SSH public key for the remote account, and verify the host key from this Windows account before connecting in Cybeck. Use the remote computer's name or IP address, SSH username, port, and OS in Operations. SSH commands use that remote account's permissions; privileged commands require the remote OS's own authorization. Windows screen control uses the separate Remote Desktop button with the computer address and does not require SSH, but Remote Desktop must be enabled on a supported host and the account must be allowed to sign in. Windows Home targets can use Quick Assist for attended screen sharing and control. Keep these services on a trusted network or a trusted VPN. Cybeck does not configure remote services or bypass their authentication.

## Limits

Connection duration is the time a socket has been observed during the current app session. The 2-second attempt poll can still miss very short attempts; it is not a complete record of failed connections. The connection monitor does not capture packets, inspect payloads, identify domains for each IP, or prove malicious behavior. Process lookup can return `Unknown` when Windows does not expose a process. Network monitoring and history are local to this device.

The updater remains configured separately from these monitoring features.

## Windows distribution

Electron 38 requires Windows 10 or later. The current installer targets 64-bit Intel/AMD Windows; other architectures need separately built and tested installers.

The v0.1.9 GitHub installer is unsigned. Windows may show a SmartScreen or Smart App Control warning, and managed device policy may block it. Do not disable Windows security features or add blanket antivirus exclusions. A trusted publisher signature requires a valid code-signing certificate or signing service; a self-signed certificate does not establish public trust.

To resolve the Smart App Control block, obtain a publicly trusted RSA code-signing identity or configure Microsoft's Artifact Signing public-trust service. For a certificate file, supply electron-builder with `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` through your local environment or protected CI secrets. Keep the private key and password out of the repository. Run `npm run build:release` and `npm run verify:release` before uploading any installer or update manifest. Both commands must succeed; the verifier checks the installer, app executable, and elevation helper. The `npm run publish` command also requires code signing. The v0.1.9 installer was published before a signing identity was available and remains unsigned; do not replace its assets under the same tag. Create a new version and test its signed installer on a Windows device with Smart App Control enabled. A valid signature does not guarantee immediate SmartScreen reputation or acceptance under every managed-device policy.
