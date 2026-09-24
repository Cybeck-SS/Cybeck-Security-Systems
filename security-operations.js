// Phases 2–7: read-only connection observations, incidents, reports and local history.
// A snapshot shows what Windows reports at scan time; it is not packet capture.
(() => {
    const bridge = window.windowControls;
    if (!bridge) return;

    const history = { days: {}, incidents: [], events: [] };
    const pendingEvents = [];
    const observedAt = new Map();
    let connectionSequence = 0;
    const incidentExpanded = new Map();
    const processNames = new Map();
    const attemptTimes = new Map();
    const attemptAlerted = new Map();
    let activeAttemptKeys = new Set();
    let attemptPollInProgress = false;
    const incidentKeys = new Set();
    let loaded = false;
    let historyWritable = true;
    let latestSample = null;
    let previousSample = null;
    let priorSessionCounts = { networkOutages: 0, internetOutages: 0 };
    let scanInProgress = false;
    let deviceName = "Unavailable";
    let dnsFailures = 0;
    let dnsIssueActive = false;
    let saveTimer = null;
    let saveChain = Promise.resolve();

    const text = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    };
    const el = (tag, className, value) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = String(value);
        return node;
    };
    const dayKey = (date = new Date()) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const dayRecord = (key) => history.days[key] ||= { events: 0, networkOutages: 0, internetOutages: 0 };
    const isOpen = (incident) => !["RESOLVED", "FALSE POSITIVE", "ARCHIVED"].includes(incident.status);

    function scheduleSave() {
        if (!loaded || !historyWritable) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            const snapshot = JSON.parse(JSON.stringify(history));
            saveChain = saveChain.then(() => bridge.saveSecurityHistory(snapshot))
                .then((saved) => text("ops-storage-status", saved ? "Saved locally on this device" : "Local history could not be saved"))
                .catch(() => text("ops-storage-status", "Local history could not be saved"));
        }, 300);
    }

    function storeEvent(event) {
        const identity = `${event.time}|${event.type}|${event.message}`;
        if (history.events.some((item) => `${item.time}|${item.type}|${item.message}` === identity)) return;
        history.events.unshift({ time: event.time, type: event.type, message: event.message });
        history.events.length = Math.min(history.events.length, 500);
        dayRecord(dayKey(event.time)).events += 1;
        renderActivity();
        renderHistory();
        scheduleSave();
    }

    function renderActivity() {
        const box = document.getElementById("ops-recent-activity");
        if (!box) return;
        box.replaceChildren();
        if (!history.events.length) { box.textContent = "No activity recorded yet."; return; }
        for (const event of history.events.slice(0, 10)) {
            const row = el("div", "ops-activity-row");
            const task = el("button", "", "Create task");
            task.type = "button";
            task.dataset.createWork = "task";
            task.dataset.workSource = "operations";
            task.dataset.workTitle = `Review ${event.type.toLowerCase()} event`;
            task.dataset.workReference = `${event.time} · ${event.message}`.slice(0, 180);
            row.append(el("time", "", new Date(event.time).toLocaleString()),
                el("strong", "", event.type), el("span", "", event.message), task);
            box.append(row);
        }
    }

    function renderHistory() {
        const keys = Object.keys(history.days);
        function summary(days) {
            const cutoff = new Date();
            cutoff.setHours(0, 0, 0, 0);
            cutoff.setDate(cutoff.getDate() - days + 1);
            const totals = { events: 0, outages: 0 };
            for (const key of keys) {
                if (new Date(`${key}T00:00:00`) < cutoff) continue;
                const day = history.days[key];
                totals.events += Number(day.events) || 0;
                totals.outages += (Number(day.networkOutages) || 0) + (Number(day.internetOutages) || 0);
            }
            const incidents = history.incidents.filter((item) => new Date(item.detected) >= cutoff).length;
            return `${totals.events} events · ${totals.outages} outages · ${incidents} incidents`;
        }
        text("ops-today", summary(1));
        text("ops-week", summary(7));
        text("ops-month", summary(30));
    }

    function renderOperations() {
        const open = history.incidents.filter(isOpen).length;
        const online = latestSample?.connected && latestSample?.internet;
        const activeAlerts = window.cybeckMonitor?.getStatistics().activeAlerts || 0;
        text("ops-network-status", !latestSample ? "CHECKING" : online ? "ONLINE" : "OFFLINE");
        text("ops-active-alerts", activeAlerts);
        text("ops-open-incidents", open);
        text("ops-system-status", !latestSample ? "CHECKING" : !online ? "ATTENTION" : open || activeAlerts ? "REVIEW" : "NORMAL");
    }

    function addTimeline(incident, action) {
        incident.timeline.push({ time: new Date().toISOString(), action });
        incident.updated = new Date().toISOString();
        scheduleSave();
    }

    function createIncident(observation, key) {
        const scopedKey = `${dayKey()}:${key}`;
        if (incidentKeys.has(scopedKey)) return;
        incidentKeys.add(scopedKey);
        const row = observation.connection || {};
        const next = Math.max(0, ...history.incidents.map((item) => Number(item.id?.slice(4)) || 0)) + 1;
        const detected = new Date().toISOString();
        const incident = {
            id: `CYB-${String(next).padStart(5, "0")}`,
            observationKey: scopedKey,
            severity: observation.severity,
            status: "NEW",
            detected,
            updated: detected,
            source: observation.source || "Connection Monitor",
            device: deviceName,
            network: latestSample?.ssid || "Unavailable",
            event: observation.title,
            evidence: observation.detail,
            process: row.process || "Unavailable",
            processId: row.processId || null,
            localAddress: row.localAddress || "Unavailable",
            remoteAddress: row.remoteAddress || "Unavailable",
            remotePort: row.remotePort || null,
            protocol: row.protocol || "Unavailable",
            timeline: [{ time: detected, action: "Observation recorded" }],
            notes: ""
        };
        history.incidents.unshift(incident);
        history.incidents.length = Math.min(history.incidents.length, 200);
        renderIncidents();
        renderOperations();
        scheduleSave();
    }

    function renderIncidents() {
        const list = document.getElementById("incident-list");
        if (!list) return;
        list.replaceChildren();
        if (!history.incidents.length) { list.textContent = "No incidents recorded."; return; }
        const incidents = history.incidents.slice(0, 30);
        const severities = [...new Set(incidents.map((incident) => incident.severity || "WARNING"))]
            .sort((a, b) => ({ ALERT: 0, WARNING: 1, INFO: 2 }[a] ?? 3) - ({ ALERT: 0, WARNING: 1, INFO: 2 }[b] ?? 3));
        for (const severity of severities) for (const [sectionLabel, include] of [
            ["Active", (incident) => isOpen(incident)],
            ["Completed", (incident) => !isOpen(incident)]
        ]) {
            const grouped = incidents.filter((incident) => (incident.severity || "WARNING") === severity && include(incident));
            if (!grouped.length) continue;
            const group = el("details", `incident-group incident-group-${sectionLabel.toLowerCase()}`);
            group.open = sectionLabel === "Active";
            group.append(el("summary", "incident-group-summary", `${severity} · ${sectionLabel} (${grouped.length})`));
            const section = el("div", "incident-section");
            for (const incident of grouped) {
            const card = el("details", "incident-card");
            card.dataset.incidentCard = incident.id;
            card.open = incidentExpanded.has(incident.id) ? incidentExpanded.get(incident.id) : isOpen(incident);
            const head = el("summary", "incident-heading");
            head.append(el("strong", "", `${incident.id} · ${incident.event}`),
                el("span", "", `${incident.severity} · ${incident.status}`));
            const content = el("div", "incident-content");
            content.append(el("p", "", incident.evidence),
                el("small", "", `Detected ${new Date(incident.detected).toLocaleString()} · ${incident.process} · ${incident.remoteAddress}:${incident.remotePort || "—"}`));
            const controls = el("div", "incident-controls");
            const followUp = el("button", "", "Create task");
            followUp.type = "button";
            followUp.dataset.createWork = "task";
            followUp.dataset.workSource = "network";
            followUp.dataset.workTitle = `Investigate ${incident.id}`;
            followUp.dataset.workReference = incident.id;
            controls.append(followUp);
            for (const [action, label] of [
                ["investigate", "Investigate"], ["contain", "Mark for Containment"],
                ["resolve", "Resolve"], ["false-positive", "False Positive"],
                ["archive", "Archive"], ["export", "Export Report"],
                [incident.firewallRuleName ? "remove-block" : "block-ip", incident.firewallRuleName ? "Remove IP Block" : "Block Remote IP"]
            ]) {
                if (action === "block-ip" && (!incident.remoteAddress || incident.remoteAddress === "Unavailable")) continue;
                const button = el("button", "", label);
                button.type = "button";
                button.dataset.incidentId = incident.id;
                button.dataset.incidentAction = action;
                controls.append(button);
            }
            content.append(controls);
            if (incident.firewallRuleName) content.append(el("small", "incident-block-state", `Outbound IP block active: ${incident.remoteAddress}`));
            if (incident.lastActionMessage) content.append(el("small", "incident-action-status", incident.lastActionMessage));
            const note = el("textarea", "incident-note");
            note.placeholder = "Analyst notes";
            note.setAttribute("aria-label", `Notes for ${incident.id}`);
            note.value = incident.notes || "";
            note.dataset.incidentNote = incident.id;
            content.append(note);
            const timeline = el("div", "incident-timeline");
            for (const entry of (incident.timeline || []).slice(-5)) {
                timeline.append(el("div", "", `${new Date(entry.time).toLocaleString()} · ${entry.action}`));
            }
            content.append(timeline);
            card.append(head, content);
            section.append(card);
            }
            group.append(section);
            list.append(group);
        }
    }

    document.getElementById("incident-list")?.addEventListener("toggle", (event) => {
        const card = event.target.closest?.("[data-incident-card]");
        if (card === event.target) incidentExpanded.set(card.dataset.incidentCard, card.open);
    }, true);

    document.getElementById("incident-list")?.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-incident-action]");
        if (!button) return;
        const incident = history.incidents.find((item) => item.id === button.dataset.incidentId);
        if (!incident) return;
        const action = button.dataset.incidentAction;
        if (action === "block-ip" || action === "remove-block") {
            button.disabled = true;
            const result = action === "block-ip"
                ? await bridge.blockIncidentIp(incident.id, incident.remoteAddress)
                : await bridge.removeIncidentBlock(incident.id, incident.remoteAddress);
            if (result.success) {
                if (action === "block-ip") {
                    incident.firewallRuleName = result.ruleName;
                    incident.status = "CONTAINED";
                    addTimeline(incident, `Outbound Windows Firewall block added for ${incident.remoteAddress}`);
                } else {
                    incident.firewallRuleName = null;
                    incident.status = "INVESTIGATING";
                    addTimeline(incident, `Outbound Windows Firewall block removed for ${incident.remoteAddress}`);
                }
                incident.lastActionMessage = null;
            } else if (!result.canceled) {
                if (action === "remove-block" && (await bridge.getIncidentBlockStatus(incident.id, incident.remoteAddress)) === false) {
                    incident.firewallRuleName = null;
                    incident.status = "INVESTIGATING";
                    addTimeline(incident, "Previously recorded firewall block is no longer present");
                } else incident.lastActionMessage = result.error || "Firewall action failed.";
            }
            renderIncidents();
            renderOperations();
            return;
        }
        if (action === "export") {
            const report = { ...incident, exportedAt: new Date().toISOString(), reportVersion: 1,
                durationMs: Math.max(0, new Date(incident.updated) - new Date(incident.detected)),
                resolution: ["RESOLVED", "FALSE POSITIVE", "ARCHIVED"].includes(incident.status) ? incident.status : "OPEN",
                note: "Local observation only. An unusual connection is not proof of malicious activity." };
            const result = await bridge.exportIncidentReport(report);
            if (result.success) addTimeline(incident, "Report exported");
            renderIncidents();
            return;
        }
        const states = {
            investigate: ["INVESTIGATING", "Investigation opened"],
            contain: ["CONTAINMENT REVIEW", "Marked for containment review; no network or process changes were made"],
            resolve: ["RESOLVED", "Incident resolved"],
            "false-positive": ["FALSE POSITIVE", "Marked as false positive"],
            archive: ["ARCHIVED", "Incident archived"]
        };
        if (!states[action]) return;
        if (incident.firewallRuleName && ["resolve", "false-positive", "archive"].includes(action)) {
            incident.lastActionMessage = "Remove the active IP block before closing this incident.";
            renderIncidents();
            return;
        }
        incident.lastActionMessage = null;
        incident.status = states[action][0];
        addTimeline(incident, states[action][1]);
        renderIncidents();
        renderOperations();
    });

    document.getElementById("incident-list")?.addEventListener("change", (event) => {
        const id = event.target.dataset.incidentNote;
        if (!id) return;
        const incident = history.incidents.find((item) => item.id === id);
        if (!incident) return;
        incident.notes = event.target.value.slice(0, 5000);
        addTimeline(incident, "Analyst notes updated");
        renderIncidents();
    });

    function handleSample(sample) {
        latestSample = sample;
        if (loaded) {
            const day = dayRecord(dayKey(sample.time));
            day.networkOutages += Math.max(0, sample.networkOutages - priorSessionCounts.networkOutages);
            day.internetOutages += Math.max(0, sample.internetOutages - priorSessionCounts.internetOutages);
            priorSessionCounts = { networkOutages: sample.networkOutages, internetOutages: sample.internetOutages };
            if (previousSample && sample.connected && previousSample.dns !== sample.dns &&
                sample.dns !== "Unavailable" && previousSample.dns !== "Unavailable") {
                const detail = `DNS configuration changed from ${previousSample.dns} to ${sample.dns}. Verify this change if unexpected.`;
                addSecurityEvent("WARNING", detail, "warning", `dns:${previousSample.dns}->${sample.dns}`, 60000);
                createIncident({ severity: "WARNING", title: "DNS configuration changed", detail,
                    source: "Network Monitor" }, `dns:${previousSample.dns}->${sample.dns}`);
            }
            previousSample = sample;
            renderHistory();
            scheduleSave();
        }
        renderOperations();
    }

    document.addEventListener("cybeck-security-event", (event) => {
        if (!loaded) pendingEvents.push(event.detail);
        else storeEvent(event.detail);
    });
    document.addEventListener("cybeck-network-sample", (event) => handleSample(event.detail));

    function connectionKey(row) {
        return [row.protocol, row.processId, row.localAddress, row.localPort,
            row.remoteAddress, row.remotePort, row.state].join("|");
    }

    async function scanConnections() {
        if (scanInProgress) return;
        scanInProgress = true;
        text("connection-scan-status", "Scanning local connections…");
        try {
            const result = await bridge.getActiveConnections();
            if (result.error) {
                text("connection-scan-status", result.error);
                text("ops-module-connections", "UNAVAILABLE");
                return;
            }
            const rows = result.connections || [];
            deviceName = result.deviceName || "Unavailable";
            if (latestSample?.internet && latestSample?.connected) {
                dnsFailures = result.dnsWorking ? 0 : dnsFailures + 1;
                if (dnsFailures >= 3 && !dnsIssueActive) {
                    dnsIssueActive = true;
                    setSecurityCondition("dns-failures", true);
                    const detail = "Three consecutive DNS lookups failed while the internet route was reported online. This may be a resolver problem.";
                    addSecurityEvent("WARNING", detail, "warning", "repeated-dns-failure", 60000);
                    createIncident({ severity: "WARNING", title: "Repeated DNS lookup failures",
                        detail, source: "Connection Monitor" }, "repeated-dns-failure");
                } else if (result.dnsWorking && dnsIssueActive) {
                    dnsIssueActive = false;
                    setSecurityCondition("dns-failures", false);
                    addSecurityEvent("RESOLVED", "DNS lookup succeeded again.", "info", "dns-recovered", 60000);
                }
            } else { dnsFailures = 0; dnsIssueActive = false; setSecurityCondition("dns-failures", false); }
            renderOperations();
            const currentKeys = new Set();
            const body = document.getElementById("connection-rows");
            body.replaceChildren();
            const now = Date.now();
            for (const row of rows) {
                const key = connectionKey(row);
                if (!observedAt.has(key)) observedAt.set(key, { firstSeen: now, sequence: ++connectionSequence });
            }
            const newestFirst = [...rows].sort((a, b) => observedAt.get(connectionKey(b)).sequence - observedAt.get(connectionKey(a)).sequence);
            for (const row of newestFirst) {
                processNames.set(row.processId, row.process);
                const key = connectionKey(row);
                currentKeys.add(key);
                const observed = observedAt.get(key);
                const tr = el("tr");
                for (const value of [row.process, `${row.localAddress}:${row.localPort}`,
                    row.remoteAddress || "—", row.remotePort || "—", row.protocol,
                    row.state, `${Math.floor((now - observed.firstSeen) / 1000)}s`]) {
                    tr.append(el("td", "", value));
                }
                body.append(tr);
            }
            if (!rows.length) { const tr = el("tr"); const cell = el("td", "", "No connections reported."); cell.colSpan = 7; tr.append(cell); body.append(tr); }
            for (const key of observedAt.keys()) if (!currentKeys.has(key)) observedAt.delete(key);
            text("connection-scan-status", `${rows.length} connections · Last scan ${new Date().toLocaleTimeString()} · Showing up to 300`);
            text("ops-module-connections", "ACTIVE");
            for (const observation of result.observations || []) {
                const row = observation.connection;
                const key = observation.kind === "uncommon-destination-port"
                    ? `${observation.kind}:${row.processId}:${row.remotePort}`
                    : observation.kind === "unidentified-process"
                        ? `${observation.kind}:${row.processId}:${row.remoteAddress}`
                        : observation.kind === "many-connections"
                            ? `${observation.kind}:${row.processId}`
                            : `${observation.kind}:${row.processId}:${row.localPort}`;
                addSecurityEvent(observation.severity, observation.detail,
                    observation.severity === "WARNING" ? "warning" : "info", key, 60000);
                if (observation.severity === "WARNING") createIncident(observation, key);
            }
        } catch (error) {
            text("connection-scan-status", `Connection scan unavailable: ${error.message}`);
            text("ops-module-connections", "UNAVAILABLE");
        } finally { scanInProgress = false; }
    }

    document.getElementById("refresh-connections")?.addEventListener("click", scanConnections);
    document.querySelector('#operations [data-page="network"]')?.addEventListener("click", () => openPage("network"));

    async function pollAttempts() {
        if (attemptPollInProgress) return;
        attemptPollInProgress = true;
        try {
            const attempts = await bridge.getConnectionAttempts();
            const now = Date.now();
            const current = new Set();
            for (const attempt of attempts) {
                const key = `${attempt.processId}|${attempt.remoteEndpoint}`;
                current.add(key);
                if (activeAttemptKeys.has(key)) continue;
                const recent = (attemptTimes.get(key) || []).filter((time) => now - time < 120000);
                recent.push(now);
                attemptTimes.set(key, recent);
                if (recent.length < 3 || now - (attemptAlerted.get(key) || 0) < 300000) continue;
                attemptAlerted.set(key, now);
                const process = processNames.get(attempt.processId) || "Unknown";
                const detail = `${process} (PID ${attempt.processId}) was observed attempting a TCP connection to ${attempt.remoteEndpoint} at least three times in two minutes. Short attempts between scans may be missed.`;
                const portSeparator = attempt.remoteEndpoint.lastIndexOf(":");
                const remoteAddress = attempt.remoteEndpoint.slice(0, portSeparator).replace(/^\[|\]$/g, "");
                const remotePort = Number(attempt.remoteEndpoint.slice(portSeparator + 1)) || null;
                addSecurityEvent("WARNING", detail, "warning", `attempts:${key}`, 300000);
                createIncident({ severity: "WARNING", title: "Repeated observed connection attempts", detail,
                    connection: { process, processId: attempt.processId, remoteAddress, remotePort, protocol: "TCP" } }, `attempts:${key}`);
            }
            activeAttemptKeys = current;
            for (const [key, times] of attemptTimes) {
                if (times.every((time) => now - time >= 120000)) attemptTimes.delete(key);
            }
        } catch (error) {
            // The 15-second full scan remains active if this optional fast poll fails.
        } finally { attemptPollInProgress = false; }
    }

    async function initialize() {
        try {
            const saved = await bridge.loadSecurityHistory();
            if (saved?.error) {
                historyWritable = false;
                text("ops-storage-status", saved.error);
            }
            if (saved && typeof saved === "object") {
                history.days = saved.days && typeof saved.days === "object" ? saved.days : {};
                history.incidents = Array.isArray(saved.incidents) ? saved.incidents.slice(0, 200) : [];
                history.events = Array.isArray(saved.events) ? saved.events.slice(0, 500) : [];
            }
            for (const incident of history.incidents) if (incident.observationKey) incidentKeys.add(incident.observationKey);
            for (const incident of history.incidents.filter((item) => item.firewallRuleName)) {
                if ((await bridge.getIncidentBlockStatus(incident.id, incident.remoteAddress)) === false) {
                    incident.firewallRuleName = null;
                    if (incident.status === "CONTAINED") incident.status = "INVESTIGATING";
                    incident.timeline ||= [];
                    incident.timeline.push({ time: new Date().toISOString(), action: "Previously recorded firewall block is no longer present" });
                }
            }
            loaded = true;
            for (const event of pendingEvents) storeEvent(event);
            pendingEvents.length = 0;
            for (const event of window.cybeckMonitor?.getEvents() || []) storeEvent(event);
            if (latestSample) handleSample(latestSample);
            if (historyWritable) text("ops-storage-status", "Saved locally on this device");
        } catch (error) {
            loaded = true;
            text("ops-storage-status", `History unavailable: ${error.message}`);
        }
        renderActivity(); renderHistory(); renderIncidents(); renderOperations();
        scanConnections();
        setInterval(scanConnections, 15000);
        pollAttempts();
        setInterval(pollAttempts, 2000);
    }
    if (window.cybeckProfileReady) initialize();
    else window.addEventListener("cybeck-profile-ready", initialize, { once: true });
})();
