# Cybeck Security Systems v0.1.5

Local Windows desktop security monitor built with Electron. Run `npm start` from this folder. Run `npm test` for focused checks. `npm run build` creates a Windows installer in `release/`; building does not publish it.

## Monitoring features

- Network and internet status, signal, latency chart, adapter and gateway details, diagnostics, offline/restored states, and Quick Actions.
- Session security events, alert lifecycles, filtered timeline, outages, downtime, recovery time, connection reliability, and signal statistics.
- Read-only TCP and UDP connection snapshots with process name, PID, addresses, ports, protocol, state, and time observed in the current session. Windows supplies these snapshots every 15 seconds; up to 300 rows are shown. A lightweight TCP attempt poll runs every 2 seconds.
- Cautious observations for new listening ports, unidentified processes, connections to uncommon destination ports, high established-connection counts, repeated observed TCP attempts, DNS configuration changes, and repeated DNS lookup failures. DNS checks query `example.com` through the configured resolver every 15 seconds. The first connection scan establishes a baseline. An observation is not a malware verdict.
- Incident records with investigation, containment review, resolution, false-positive and archive status, notes, timeline, and PDF or JSON report export. A user can explicitly block one incident's remote IP with a Windows Firewall outbound rule and remove that exact Cybeck rule later. Both actions require in-app confirmation and may need Windows administrator access. Detection never blocks traffic automatically.
- Local event, incident, and daily summary history in Electron's user-data folder as `security-history.json`, encrypted with Windows' user-bound storage protection. History is bounded to the latest 500 events, 200 incidents, and 31 daily summaries. If encryption is unavailable, Cybeck does not save history.
- Operations dashboard with live status, open incidents, recent activity, monitoring module status, and today/7-day/30-day totals.
- Operations local command console for CMD and Windows PowerShell. Every command requires an in-app approval, runs with the current Windows user's permissions, streams output in the app, and can be stopped. One command runs at a time with a 30-second and 128 KB output limit. The console does not elevate privileges, persist output, or expose a remote service.

## Limits

Connection duration is the time a socket has been observed during the current app session. The 2-second attempt poll can still miss very short attempts; it is not a complete record of failed connections. The connection monitor does not capture packets, inspect payloads, identify domains for each IP, or prove malicious behavior. Process lookup can return `Unknown` when Windows does not expose a process. Network monitoring and history are local to this device.

The updater remains configured separately from these monitoring features.

## Windows distribution

Electron 38 requires Windows 10 or later. The current installer targets 64-bit Intel/AMD Windows; other architectures need separately built and tested installers.

The v0.1.5 GitHub installer is unsigned. Windows may show a SmartScreen or Smart App Control warning, and managed device policy may block it. Do not disable Windows security features or add blanket antivirus exclusions. A trusted publisher signature requires a valid code-signing certificate or signing service; a self-signed certificate does not establish public trust.

For future public releases, supply electron-builder with a trusted code-signing identity (for example `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`) and run `npm run publish`. The publish command requires a valid signature and fails before uploading if signing is unavailable. Verify the resulting installer and app executable with `Get-AuthenticodeSignature` and test on the Windows versions and architectures you intend to support. Even signed new releases may need time to build SmartScreen reputation.
