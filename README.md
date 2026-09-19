# Cybeck Security Systems v0.1.3

Local Windows desktop security monitor built with Electron. Run `npm start` from this folder. Run `npm test` for focused checks. `npm run build` creates a Windows installer in `release/`; building does not publish it.

## Monitoring features

- Network and internet status, signal, latency chart, adapter and gateway details, diagnostics, offline/restored states, and Quick Actions.
- Session security events, alert lifecycles, filtered timeline, outages, downtime, recovery time, connection reliability, and signal statistics.
- Read-only TCP and UDP connection snapshots with process name, PID, addresses, ports, protocol, state, and time observed in the current session. Windows supplies these snapshots every 15 seconds; up to 300 rows are shown. A lightweight TCP attempt poll runs every 2 seconds.
- Cautious observations for new listening ports, unidentified processes, connections to uncommon destination ports, high established-connection counts, repeated observed TCP attempts, DNS configuration changes, and repeated DNS lookup failures. DNS checks query `example.com` through the configured resolver every 15 seconds. The first connection scan establishes a baseline. An observation is not a malware verdict.
- Incident records with investigation, containment review, resolution, false-positive and archive status, notes, timeline, and PDF or JSON report export. A user can explicitly block one incident's remote IP with a Windows Firewall outbound rule and remove that exact Cybeck rule later. Both actions require in-app confirmation and may need Windows administrator access. Detection never blocks traffic automatically.
- Local event, incident, and daily summary history in Electron's user-data folder as `security-history.json`, encrypted with Windows' user-bound storage protection. History is bounded to the latest 500 events, 200 incidents, and 31 daily summaries. If encryption is unavailable, Cybeck does not save history.
- Operations dashboard with live status, open incidents, recent activity, monitoring module status, and today/7-day/30-day totals.

## Limits

Connection duration is the time a socket has been observed during the current app session. The 2-second attempt poll can still miss very short attempts; it is not a complete record of failed connections. The connection monitor does not capture packets, inspect payloads, identify domains for each IP, or prove malicious behavior. Process lookup can return `Unknown` when Windows does not expose a process. Network monitoring and history are local to this device.

The updater remains configured separately from these monitoring features.
